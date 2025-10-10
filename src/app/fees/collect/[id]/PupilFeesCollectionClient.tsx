'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

// Icons
import { 
  CurrencyCircleDollar, 
  Receipt, 
  Printer, 
  ArrowCircleLeft, 
  Users, 
  ArrowCounterClockwise 
} from '@phosphor-icons/react';

// Services and Hooks
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { PupilsService } from '@/lib/services/pupils.service';
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { PaymentsService } from '@/lib/services/payments.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';

// Utilities
import { getCurrentTerm, isTermActive } from '@/lib/utils/academic-year-utils';
import { 
  getValidAcademicYearsForPupil, 
  getValidTermsForPupil,
  isAcademicYearValidForPupil,
  isTermValidForPupil
} from './utils/feeProcessing';

// Types
import type { AcademicYear, Pupil, FeeStructure, PaymentRecord } from '@/types';

// Component imports
import { FeeCard } from './components/FeeCard';
import { PaymentModal } from './components/PaymentModal';
import { PrintModal } from './components/PrintModal';
import { SummaryModal } from './components/SummaryModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CarryForwardPaymentModal } from './components/CarryForwardPaymentModal';

// Hooks
import { usePupilFees } from './hooks/usePupilFees';
import { usePaymentProcessing } from './hooks/usePaymentProcessing';
import { useDigitalSignatureHelpers } from '@/lib/hooks/use-digital-signature';
import { useAuth } from '@/lib/contexts/auth-context';

// Performance and Error Handling
import { usePerformanceMonitor, useRenderTracker } from './utils/performance';
import { handleError, handleDataLoadingError } from './utils/errorHandling';
import { 
  processCarryForwardPayment, 
  validateCarryForwardPayment 
} from './utils/carryForwardPayments';

// Extended interfaces for this component
interface PupilFee extends FeeStructure {
  paid: number;
  balance: number;
  payments: PaymentRecord[];
  discount?: {
    id: string;
    name: string;
    amount: number;
    type: 'fixed' | 'percentage';
  };
  originalAmount?: number;
  feeBreakdown?: Array<{
    name: string;
    amount: number;
    paid: number;
    balance: number;
    term: string;
    year: string;
  }>;
}

interface PreviousTermBalance {
  amount: number;
  termInfo: { term: string; year: string };
  breakdown: Array<{
    name: string;
    amount: number;
    paid: number;
    balance: number;
    term: string;
    year: string;
  }>;
}

interface SelectedFee {
  feeId: string;
  amount: number;
  name: string;
  balance: number;
  amountPaid: number;
  feeBreakdown?: Array<{
    name: string;
    amount: number;
    paid: number;
    balance: number;
    term: string;
    year: string;
    feeStructureId?: string;
    termId?: string;
    academicYearId?: string;
  }>;
}

export default function PupilFeesCollectionClient({ pupilId: propPupilId }: { pupilId?: string }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { signAction } = useDigitalSignatureHelpers();
  
  // Performance monitoring
  const { measureOperation } = usePerformanceMonitor();
  const renderTracker = useRenderTracker('PupilFeesCollection');
  
  // Get pupilId from props (query param) or params (dynamic route)
  const pupilId = propPupilId || (params?.id as string);
  const shouldOpenSummary = searchParams?.get('openSummary') === 'true';

  // State management
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<AcademicYear | null>(null);
  const [lastPaymentTimestamp, setLastPaymentTimestamp] = useState<number>(0);

  // Listen for family payment updates to refresh data
  useEffect(() => {
    const handleFamilyPaymentUpdate = (event: CustomEvent) => {
      const { affectedPupilIds, timestamp } = event.detail;
      if (affectedPupilIds.includes(pupilId)) {
        console.log('Family payment detected for pupil:', pupilId, 'updating timestamp to:', timestamp);
        setLastPaymentTimestamp(timestamp);
      }
    };

    // Check localStorage for recent family payments
    const storedTimestamp = localStorage.getItem(`lastPaymentTimestamp_${pupilId}`);
    if (storedTimestamp) {
      const timestamp = parseInt(storedTimestamp);
      if (timestamp > lastPaymentTimestamp) {
        console.log('Found recent family payment in localStorage for pupil:', pupilId, 'updating timestamp to:', timestamp);
        setLastPaymentTimestamp(timestamp);
        // Clear the localStorage entry after using it
        localStorage.removeItem(`lastPaymentTimestamp_${pupilId}`);
      }
    }

    window.addEventListener('familyPaymentUpdate', handleFamilyPaymentUpdate as EventListener);
    
    return () => {
      window.removeEventListener('familyPaymentUpdate', handleFamilyPaymentUpdate as EventListener);
    };
  }, [pupilId, lastPaymentTimestamp]);
  
  // Historical pupil info for the selected term
  const [historicalPupilInfo, setHistoricalPupilInfo] = useState<{
    classId: string;
    className: string;
    section: string;
  } | null>(null);

  // Modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isCarryForwardPaymentModalOpen, setIsCarryForwardPaymentModalOpen] = useState(false);
  
  // Selected items
  const [selectedFee, setSelectedFee] = useState<SelectedFee | null>(null);

  // Fetch academic years with error handling
  const { data: rawAcademicYears = [], isLoading: isLoadingAcademicYears, error: academicYearsError } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      try {
        const years = await AcademicYearsService.getAllAcademicYears();
        return years;
      } catch (error) {
        handleDataLoadingError(error, 'academic years');
        throw error;
      }
    }
  });

  // Process academic years to mark current terms
  const academicYears = useMemo(() => {
    return rawAcademicYears.map(year => ({
      ...year,
      terms: year.terms.map(term => ({
        ...term,
        isCurrent: isTermActive(term)
      }))
    }));
  }, [rawAcademicYears]);

  // Fetch pupil data
  const { data: pupil, isLoading: isPupilLoading, error: pupilError } = useQuery({
    queryKey: ['pupil', pupilId],
    queryFn: async () => {
      try {
        const pupilData = await PupilsService.getPupilById(pupilId);
        return pupilData;
      } catch (error) {
        handleDataLoadingError(error, 'pupil data');
        throw error;
      }
    },
    enabled: !!pupilId
  });

  // Fetch classes data for name resolution
  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      try {
        const { ClassesService } = await import('@/lib/services/classes.service');
        return await ClassesService.getAll();
      } catch (error) {
        console.warn('Could not load classes:', error);
        return [];
      }
    }
  });

  // Get valid academic years for this pupil (filtering out years before registration)
  const validAcademicYears = useMemo(() => {
    if (!pupil?.registrationDate) return academicYears;
    return getValidAcademicYearsForPupil(academicYears, pupil.registrationDate);
  }, [academicYears, pupil?.registrationDate]);

  // Get valid terms for the selected academic year and this pupil
  const validTerms = useMemo(() => {
    if (!selectedAcademicYear || !pupil?.registrationDate) return selectedAcademicYear?.terms || [];
    return getValidTermsForPupil(selectedAcademicYear, pupil.registrationDate);
  }, [selectedAcademicYear, pupil?.registrationDate]);

  // Optimized: Set default academic year and term when data is loaded
  useEffect(() => {
    if (validAcademicYears.length > 0 && !selectedAcademicYear) {
      // Find the current active academic year from valid years
      const currentYear = validAcademicYears.find(year => year.isActive);
      if (currentYear) {
        console.log('🚀 Fast setup: Setting academic year and term immediately');
        setSelectedAcademicYear(currentYear);
        
        // Get valid terms for this pupil in the current year
        const pupilValidTerms = pupil?.registrationDate ? 
          getValidTermsForPupil(currentYear, pupil.registrationDate) : 
          currentYear.terms;
        
        // Priority: Use term marked as current first, then calculate current term
        const markedCurrentTerm = pupilValidTerms.find(term => term.isCurrent);
        if (markedCurrentTerm) {
          setSelectedTermId(markedCurrentTerm.id);
          console.log('✅ Fast setup: Using marked current term:', markedCurrentTerm.name);
        } else {
          // Fallback: Calculate current term (more expensive)
          const currentTerm = getCurrentTerm(currentYear);
          const validCurrentTerm = currentTerm && pupilValidTerms.find(t => t.id === currentTerm.id) ? currentTerm : null;
          
          if (validCurrentTerm) {
            setSelectedTermId(validCurrentTerm.id);
            console.log('✅ Fast setup: Using calculated current term:', validCurrentTerm.name);
          } else if (pupilValidTerms.length > 0) {
            // Last resort: Use first valid term
            setSelectedTermId(pupilValidTerms[0].id);
            console.log('✅ Fast setup: Using first valid term:', pupilValidTerms[0].name);
          }
        }
        
        // Silent setup - no toast notifications during initial load
        console.log('🚀 Academic year and term setup completed in single effect');
      }
    }
  }, [validAcademicYears, selectedAcademicYear, pupil?.registrationDate]);

  // Optimized: Only reset term if academic year changes (much faster)
  useEffect(() => {
    if (selectedAcademicYear && validTerms.length > 0 && selectedTermId) {
      // Only validate if term is invalid for the current academic year
      const isCurrentTermValid = validTerms.find(t => t.id === selectedTermId);
      
      if (!isCurrentTermValid) {
        console.log('⚡ Term validation: Resetting to first valid term');
        setSelectedTermId(validTerms[0].id);
      }
    } else if (selectedAcademicYear && validTerms.length === 0) {
      console.log('⚡ No valid terms: Clearing term selection');
      setSelectedTermId('');
    }
  }, [selectedAcademicYear?.id]); // Only depend on academic year ID, not validTerms or selectedTermId

  // Load historical pupil info when term/year selection changes
  // This ensures the pupil info display shows accurate class/section for the selected term
  useEffect(() => {
    const loadHistoricalPupilInfo = async () => {
      if (!pupil || !selectedTermId || !selectedAcademicYear || !classes.length) {
        setHistoricalPupilInfo(null);
        return;
      }

      try {
        // Get historical snapshot for the selected term - NO FALLBACK
        // This is critical for financial accuracy - must always use correct historical data
        const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
          pupil,
          selectedTermId,
          selectedAcademicYear
        );

        // Find class name from classes data
        const classData = classes.find(c => c.id === snapshot.classId);
        
        setHistoricalPupilInfo({
          classId: snapshot.classId,
          className: classData?.name || 'Unknown Class',
          section: snapshot.section
        });

        console.log(`📸 Historical pupil info for ${selectedTermId}:`, {
          classId: snapshot.classId,
          className: classData?.name,
          section: snapshot.section,
          currentClass: pupil.className,
          currentSection: pupil.section
        });
      } catch (error) {
        console.error('❌ Critical Error: Could not load historical pupil info:', error);
        // For this critical financial system, we must never show incorrect data
        setHistoricalPupilInfo(null);
        toast({
          variant: "destructive",
          title: "Historical Data Error",
          description: "Could not load accurate pupil information for this term. Please contact support.",
          duration: 8000,
        });
      }
    };

    loadHistoricalPupilInfo();
  }, [pupil, selectedTermId, selectedAcademicYear, classes]);

  // Use custom hooks for data fetching
  const {
    pupilFees,
    isLoading: isPupilFeesLoading,
    refetch,
    termTotals,
    error: pupilFeesError
  } = usePupilFees({
    pupilId,
    pupil: pupil || undefined,
    selectedTermId,
    selectedAcademicYear,
    lastPaymentTimestamp
  });

  // Handler functions
  const handleMakePayment = (fee: any, balance: number, totalPaid: number) => {
    const selectedFeeData: SelectedFee = {
      feeId: fee.id,
      name: fee.name,
      amount: fee.amount,
      balance,
      amountPaid: totalPaid,
      feeBreakdown: fee.feeBreakdown
    };

    setSelectedFee(selectedFeeData);

    // Check if this is a carry forward fee with multiple items
    if (fee.id === 'previous-balance' && fee.feeBreakdown && fee.feeBreakdown.length > 0) {
      setIsCarryForwardPaymentModalOpen(true);
    } else {
      setIsPaymentModalOpen(true);
    }
  };

  const handlePaymentSubmit = async (data: { amount: number }) => {
    if (!selectedFee || !pupil || !selectedAcademicYear || !user) return;

    try {
      // Import uniform integration service for uniform fee checks
      const { UniformFeesIntegrationService } = await import('@/lib/services/uniform-fees-integration.service');
      
      // Check if this is a uniform fee
      const fee = pupilFees.find(f => f.id === selectedFee.feeId);
      const isUniformFee = fee && UniformFeesIntegrationService.isUniformFee(fee);

      let paymentId: string;

      if (isUniformFee) {
        // Handle uniform payment with integration
        paymentId = await UniformFeesIntegrationService.createUniformPaymentRecord(
          fee as any, // Type assertion since we know it's a uniform fee
          data.amount,
          pupil.id,
          selectedAcademicYear.id,
          selectedTermId,
          {
            id: user.id,
            name: user.username,
            role: user.role
          }
        );
      } else {
        // Handle regular fee payment
        const paymentData = {
          pupilId: pupil.id,
          feeStructureId: selectedFee.feeId,
          academicYearId: selectedAcademicYear.id,
          termId: selectedTermId,
          amount: data.amount,
          paymentDate: new Date().toISOString(),
          paidBy: {
            id: user.id,
            name: user.username,
            role: user.role
          },
          notes: `Payment for ${selectedFee.name}`
        };

        paymentId = await PaymentsService.createPayment(paymentData);
      }

      // Create digital signature for the payment
      await signAction(
        'fee_payment',
        paymentId,
        'collected',
        {
          amount: data.amount,
          pupilName: `${pupil.firstName} ${pupil.lastName}`,
          feeName: selectedFee.name,
          academicYear: selectedAcademicYear.name,
          term: selectedTermId,
          paymentType: isUniformFee ? 'uniform' : 'regular'
        }
      );
      
      toast({
        title: "Payment Successful",
        description: `Payment of ${new Intl.NumberFormat('en-UG', { 
          style: 'currency', 
          currency: 'UGX' 
        }).format(data.amount)} has been recorded.`,
      });

      // Close modal first
      setIsPaymentModalOpen(false);
      setSelectedFee(null);
      
      // Refetch all data to update UI (non-blocking)
      refetch().catch(err => console.error('Refetch error:', err));
      setLastPaymentTimestamp(Date.now());
      
    } catch (error) {
      console.error('Payment submission error:', error);
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: "There was an error processing the payment. Please try again.",
      });
    }
  };

  const handleCarryForwardPaymentSubmit = async (data: { 
    amount: number; 
    paymentType: 'general' | 'item-specific';
    targetItem?: any;
  }) => {
    if (!selectedFee || !pupil || !selectedAcademicYear) return;

    try {
      const paymentData = {
        pupilId: pupil.id,
        currentTermId: selectedTermId,
        currentAcademicYearId: selectedAcademicYear.id,
        amount: data.amount,
        paymentType: data.paymentType,
        targetItem: data.targetItem,
        feeBreakdown: selectedFee.feeBreakdown || [],
        paidBy: {
          id: 'current-user',
          name: 'System User',
          role: 'admin'
        }
      };

      // Validate payment data
      const validation = validateCarryForwardPayment(paymentData);
      if (!validation.isValid) {
        toast({
          variant: "destructive",
          title: "Invalid Payment",
          description: validation.error,
        });
        return;
      }

      // Process the carry forward payment
      const result = await processCarryForwardPayment(paymentData);
      
      if (result.success) {
        toast({
          title: "Payment Successful",
          description: result.message,
        });

        // Close modal first
        setIsCarryForwardPaymentModalOpen(false);
        setSelectedFee(null);
        
        // Refetch all data to update UI (non-blocking)
        refetch().catch(err => console.error('Refetch error:', err));
        setLastPaymentTimestamp(Date.now());
      } else {
        toast({
          variant: "destructive",
          title: "Payment Failed",
          description: result.message,
        });
      }
      
    } catch (error) {
      console.error('Carry forward payment submission error:', error);
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: "There was an error processing the payment. Please try again.",
      });
    }
  };

  const handleRevertPayment = async (payment: PaymentRecord, fee: any) => {
    if (!user) return;

    try {
      await PaymentsService.revertPayment(payment.id, {
        id: user.id,
        name: user.username,
        role: user.role
      });

      // Create digital signature for the payment reversal
      await signAction(
        'fee_payment',
        payment.id,
        'reverted',
        {
          originalAmount: payment.amount,
          pupilId: payment.pupilId,
          feeStructureId: payment.feeStructureId,
          revertReason: 'Payment reversal requested'
        }
      );
      
      toast({
        title: "Payment Reverted",
        description: `Payment of ${new Intl.NumberFormat('en-UG', { 
          style: 'currency', 
          currency: 'UGX' 
        }).format(payment.amount)} has been reverted.`,
      });

      // Refetch all data to update UI (non-blocking)
      refetch().catch(err => console.error('Refetch error:', err));
      setLastPaymentTimestamp(Date.now());
      
    } catch (error) {
      console.error('Payment revert error:', error);
      toast({
        variant: "destructive",
        title: "Revert Failed",
        description: "There was an error reverting the payment. Please try again.",
      });
    }
  };

  const handleRefreshData = async () => {
    try {
      await refetch();
      toast({
        title: "Data Refreshed",
        description: "Fee information has been updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Could not refresh data. Please try again.",
      });
    }
  };

  const handlePrint = async (selectedFees: any[]) => {
    // Will be implemented in later phases
    console.log('Print fees:', selectedFees);
    toast({
      title: "Print Feature",
      description: "Print functionality will be implemented in later phases",
    });
  };

  // Render term fees
  const renderTermFees = (term: string) => {
    if (pupilFees.length === 0) {
      return (
        <div className="text-center py-8">
          <CurrencyCircleDollar className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No fees found</h3>
          <p className="mt-1 text-sm text-gray-500">
            There are no applicable fees configured for this term and class.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {pupilFees.map((fee: any) => (
          <FeeCard
            key={fee.id}
            fee={fee}
            pupil={pupil!}
            onPayment={handleMakePayment}
            onRevertPayment={handleRevertPayment}
            selectedTerm={selectedTermId}
            selectedAcademicYear={selectedAcademicYear}
          />
        ))}
      </div>
    );
  };

  // Optimized loading states - show content as soon as basic data is available
  if (isPupilLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading pupil information...</p>
        </div>
      </div>
    );
  }

  // Show skeleton while fees are loading but pupil data is ready
  if (isPupilFeesLoading && pupil) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-12">
        <div className="bg-white/90 border-b shadow-sm backdrop-blur-xl sticky top-0 z-10 border-b-indigo-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Link
                  href="/fees/collection"
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-2 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 transition-all duration-300 hover:scale-95 origin-center text-xs sm:text-sm"
                >
                  <ArrowCircleLeft className="w-4 h-4" weight="bold" />
                  <span className="font-medium">Back</span>
                </Link>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-indigo-900 leading-tight">
                  Fees Collection - {pupil.firstName} {pupil.lastName}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  ID: {pupil.admissionNumber} • Class: {pupil.className} • Section: {pupil.section}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading fees data...</p>
              <p className="text-xs text-gray-500 mt-1">Setting up academic year and term</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-12">
      {/* Compact Header */}
      <div className="bg-white/90 border-b shadow-sm backdrop-blur-xl sticky top-0 z-10 border-b-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {/* Mobile-First Header Layout */}
          <div className="space-y-3">
            {/* Top Row - Back button and Title */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Link
                  href="/fees/collection"
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-2 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 transition-all duration-300 hover:scale-95 origin-center text-xs sm:text-sm"
                >
                  <ArrowCircleLeft className="w-4 h-4" weight="bold" />
                  <span className="font-medium hidden sm:inline">Back to Fees</span>
                  <span className="font-medium sm:hidden">Back</span>
                </Link>
                
                {/* Mobile action buttons - only show refresh on mobile */}
                <div className="flex items-center gap-1.5 sm:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshData}
                    className="flex items-center gap-1 px-2 py-1 h-8"
                  >
                    <ArrowCounterClockwise className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-indigo-900 leading-tight">
                  <span className="block sm:inline">Fees Collection</span>
                  <span className="block sm:inline sm:ml-2">
                    {pupil ? (
                      <Link
                        href={`/pupil-detail?id=${pupil.id}`}
                        className="text-indigo-900 hover:text-indigo-700 hover:underline transition-all duration-300 hover:scale-95 inline-block origin-center"
                      >
                        {pupil.firstName} {pupil.lastName}
                      </Link>
                    ) : 'Loading...'}
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  <span className="block sm:inline">ID: {pupil?.admissionNumber || 'Loading...'}</span>
                  <span className="hidden sm:inline"> • </span>
                  <span className="block sm:inline">
                    Class: {historicalPupilInfo ? historicalPupilInfo.className : (pupil?.className || 'Loading...')}
                    {historicalPupilInfo && historicalPupilInfo.className !== pupil?.className && (
                      <span className="text-blue-600 text-xs ml-1" title={`Current class: ${pupil?.className}`}>
                        📸
                      </span>
                    )}
                  </span>
                  <span className="hidden sm:inline"> • </span>
                  <span className="block sm:inline">
                    Section: {historicalPupilInfo ? historicalPupilInfo.section : (pupil?.section || 'N/A')}
                    {historicalPupilInfo && historicalPupilInfo.section !== pupil?.section && (
                      <span className="text-blue-600 text-xs ml-1" title={`Current section: ${pupil?.section}`}>
                        📸
                      </span>
                    )}
                  </span>
                </p>
              </div>
            </div>
            
            {/* Desktop action buttons */}
            <div className="hidden sm:flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshData}
                className="flex items-center gap-1.5 h-8 px-3"
              >
                <ArrowCounterClockwise className="w-4 h-4" />
                Refresh
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('Family Accounts clicked - Pupil data:', { 
                    pupilId: pupil?.id, 
                    familyId: pupil?.familyId, 
                    firstName: pupil?.firstName,
                    lastName: pupil?.lastName 
                  });
                  
                  if (!pupil?.familyId) {
                    console.log('No familyId found for pupil:', pupil?.id);
                    toast({
                      title: "Family ID Missing",
                      description: "This pupil does not have a family ID. Please contact the administrator.",
                      variant: "destructive"
                    });

                    // Generate a family ID if none exists
                    const generatedFamilyId = `fam-${pupil?.lastName?.toLowerCase() || 'unknown'}-${Date.now()}`;
                    console.log('Generated family ID:', generatedFamilyId);
                    toast({
                      title: "Family ID Generated",
                      description: `A family ID has been generated: ${generatedFamilyId}`,
                      variant: "default"
                    });
                    router.push(`/fees/family/${generatedFamilyId}`);
                    return;
                  }
                  
                  console.log('Navigating to family page with familyId:', pupil.familyId);
                  router.push(`/fees/family/${pupil.familyId}`);
                }}
                className="flex items-center gap-1.5 text-purple-600 hover:text-purple-700 border-purple-200 hover:border-purple-300 h-8 px-3"
              >
                <Users className="w-4 h-4" />
                Family Accounts
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPrintModalOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3"
              >
                <Printer className="w-4 h-4" />
                Print
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSummaryModalOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3"
              >
                <Receipt className="w-4 h-4" />
                Summary
              </Button>
            </div>

            {/* Mobile action buttons row */}
            <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('Mobile Family clicked - Pupil data:', { 
                    pupilId: pupil?.id, 
                    familyId: pupil?.familyId, 
                    firstName: pupil?.firstName,
                    lastName: pupil?.lastName 
                  });
                  
                  if (!pupil?.familyId) {
                    console.log('No familyId found for pupil:', pupil?.id);
                    const generatedFamilyId = `fam-${pupil?.lastName?.toLowerCase() || 'unknown'}-${Date.now()}`;
                    console.log('Generated family ID:', generatedFamilyId);
                    router.push(`/fees/family/${generatedFamilyId}`);
                    return;
                  }
                  
                  console.log('Navigating to family page with familyId:', pupil.familyId);
                  router.push(`/fees/family/${pupil.familyId}`);
                }}
                className="flex items-center gap-1.5 text-purple-600 hover:text-purple-700 border-purple-200 hover:border-purple-300 whitespace-nowrap text-xs h-8 px-2.5"
              >
                <Users className="w-3.5 h-3.5" />
                Family
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPrintModalOpen(true)}
                className="flex items-center gap-1.5 whitespace-nowrap text-xs h-8 px-2.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSummaryModalOpen(true)}
                className="flex items-center gap-1.5 whitespace-nowrap text-xs h-8 px-2.5"
              >
                <Receipt className="w-3.5 h-3.5" />
                Summary
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
          {/* Compact Header Section */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100 p-4">
            {/* Academic Year Selection and Totals in one row for desktop */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Academic Year Selection - Compact */}
              <div className="flex-shrink-0">
                <select
                  value={selectedAcademicYear?.id || ''}
                  onChange={(e) => {
                    const year = validAcademicYears.find(year => year.id === e.target.value);
                    setSelectedAcademicYear(year || null);
                    // Reset term selection when academic year changes - will be handled by useEffect
                    setSelectedTermId('');
                  }}
                  className="w-full sm:w-auto sm:min-w-[240px] px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white text-gray-700 font-medium hover:border-gray-300 transition-colors text-sm shadow-sm"
                  disabled={isLoadingAcademicYears}
                >
                  <option value="">Select Academic Year</option>
                  {validAcademicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name} {year.isActive ? '(Current)' : year.isLocked ? '(Locked)' : '(Upcoming)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Compact Totals Summary - Horizontal on desktop */}
              <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
                <div className="bg-white rounded-lg px-4 py-2.5 shadow-sm border border-indigo-100 min-w-0">
                  <div className="flex items-center justify-between sm:flex-col sm:items-start lg:flex-row lg:items-center gap-2">
                    <h3 className="text-xs font-medium text-indigo-600">Total Fees</h3>
                    <p className="text-lg sm:text-xl font-bold text-indigo-900 whitespace-nowrap">
                      {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(termTotals.totalFees)}
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-lg px-4 py-2.5 shadow-sm border border-green-100 min-w-0">
                  <div className="flex items-center justify-between sm:flex-col sm:items-start lg:flex-row lg:items-center gap-2">
                    <h3 className="text-xs font-medium text-green-600">Total Paid</h3>
                    <p className="text-lg sm:text-xl font-bold text-green-900 whitespace-nowrap">
                      {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(termTotals.totalPaid)}
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-lg px-4 py-2.5 shadow-sm border border-red-100 min-w-0">
                  <div className="flex items-center justify-between sm:flex-col sm:items-start lg:flex-row lg:items-center gap-2">
                    <h3 className="text-xs font-medium text-red-600">Balance</h3>
                    <p className="text-lg sm:text-xl font-bold text-red-900 whitespace-nowrap">
                      {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(termTotals.totalBalance)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Term Tabs */}
          <div className="px-4 pt-4 pb-2">
            {selectedAcademicYear && validTerms.length > 0 && (
              <Tabs value={selectedTermId} onValueChange={setSelectedTermId}>
                <TabsList className={`grid w-full text-xs sm:text-sm h-9 ${validTerms.length === 1 ? 'grid-cols-1' : validTerms.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {validTerms.map((term) => (
                    <TabsTrigger key={term.id} value={term.id} className="text-xs sm:text-sm h-8">
                      {term.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="mt-4">
                  {validTerms.map((term) => (
                    <TabsContent key={term.id} value={term.id} className="mt-0">
                      {renderTermFees(term.name)}
                    </TabsContent>
                  ))}
                </div>
              </Tabs>
            )}
            
            {/* Show message if no valid terms */}
            {selectedAcademicYear && validTerms.length === 0 && pupil?.registrationDate && (
              <div className="text-center py-8">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 inline-block">
                  <h3 className="text-yellow-800 font-medium mb-2">No Available Terms</h3>
                  <p className="text-yellow-700 text-sm">
                    This pupil was registered after all terms in {selectedAcademicYear.name} had ended.
                    <br />
                    <span className="font-medium">Registration Date:</span> {new Date(pupil.registrationDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedFee && (
        <>
          <PaymentModal
            isOpen={isPaymentModalOpen}
            onClose={() => {
              setIsPaymentModalOpen(false);
              setSelectedFee(null);
            }}
            onSubmit={handlePaymentSubmit}
            fee={selectedFee}
          />

          <CarryForwardPaymentModal
            isOpen={isCarryForwardPaymentModalOpen}
            onClose={() => {
              setIsCarryForwardPaymentModalOpen(false);
              setSelectedFee(null);
            }}
            onSubmit={handleCarryForwardPaymentSubmit}
            fee={{
              feeId: selectedFee.feeId,
              amount: selectedFee.amount,
              name: selectedFee.name,
              balance: selectedFee.balance,
              amountPaid: selectedFee.amountPaid,
              feeBreakdown: selectedFee.feeBreakdown || []
            }}
          />
        </>
      )}

      <PrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        fees={pupilFees}
        pupil={pupil || undefined}
        selectedAcademicYear={selectedAcademicYear}
        selectedTerm={selectedTermId}
        onPrint={handlePrint}
      />

      {pupil && (
        <SummaryModal
          isOpen={isSummaryModalOpen}
          onClose={() => setIsSummaryModalOpen(false)}
          pupil={pupil}
          fees={pupilFees}
          selectedAcademicYear={selectedAcademicYear}
          selectedTerm={selectedTermId}
        />
      )}
    </div>
  );
} 