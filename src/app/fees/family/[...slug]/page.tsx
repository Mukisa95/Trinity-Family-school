'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  ArrowCircleLeft,
  Calendar,
  Clock,
  CaretUpDown,
  Printer,
  CaretDown,
  CaretUp,
  List,
  ListBullets,
  CurrencyCircleDollar
} from '@phosphor-icons/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Services
import { PupilsService } from '@/lib/services/pupils.service';
import { UniformFeesIntegrationService } from '@/lib/services/uniform-fees-integration.service';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { usePrint } from '@/lib/contexts/print-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useDigitalSignatureHelpers } from '@/lib/hooks/use-digital-signature';
import { HistoryLogService } from '@/lib/services/history-log.service';

// Optimized hooks for instant cache-first loading
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useClasses } from '@/lib/hooks/use-classes';

// Custom hook for family fees
import { useFamilyFees } from './hooks/useFamilyFees';

// Components
import { FamilyPaymentModal } from './components/FamilyPaymentModal';
import { FamilyPrintModal } from './components/FamilyPrintModal';

// Utilities
import { getCurrentTerm, getActiveOrMostRecentTerm, isTermActive } from '@/lib/utils/academic-year-utils';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import {
  isAcademicYearValidForPupil,
  isTermValidForPupil,
  getValidAcademicYearsForPupil,
  getValidTermsForPupil,
  filterApplicableFees,
  processPupilFees,
  calculatePreviousTermBalances
} from '../../collect/[id]/utils/feeProcessing';

// Types
import type { AcademicYear, Pupil, FeeStructure, PaymentRecord } from '@/types';

interface FeePayment {
  id: string;
  amount: number;
  paymentDate: string;
  balance: number;
  paidBy?: { name: string };
  term: string;
  academicYear: string;
  feeStructureId: string;
}

interface FeeWithPayment {
  feeStructureId: string;
  name: string;
  amount: number;
  paid: number;
  balance: number;
  lastPayment: FeePayment | null;
  originalAmount: number;
  termId: string;
  academicYearId?: string;
  isCurrentTerm: boolean;
  isCarryForward: boolean;
  discount?: {
    amount: number;
    name: string;
    type: 'fixed' | 'percentage';
  };
}

interface FeesInfo {
  type: 'total';
  totalFees: number;
  totalPaid: number;
  balance: number;
  lastPayment: FeePayment | null;
  applicableFees: Array<FeeWithPayment>;
}

export default function FamilyFeesCollection() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Extract familyId from catch-all route
  const familyId = Array.isArray(params.slug) ? params.slug.join('/') : params.slug || 'unknown';

  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<AcademicYear | null>(null);

  // State for family payment modal
  const [isFamilyPaymentModalOpen, setIsFamilyPaymentModalOpen] = useState(false);

  // State for family print modal
  const [isFamilyPrintModalOpen, setIsFamilyPrintModalOpen] = useState(false);

  // State for view toggle (Summary/Detail)
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');

  // State to track which pupils' breakdowns are expanded
  const [expandedPupils, setExpandedPupils] = useState<Set<string>>(new Set());

  // Toggle individual pupil breakdown expansion
  const togglePupilExpansion = (pupilId: string) => {
    setExpandedPupils(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pupilId)) {
        newSet.delete(pupilId);
      } else {
        newSet.add(pupilId);
      }
      return newSet;
    });
  };

  const { data: settings } = useSchoolSettings();
  const { registerPrintHandler } = usePrint();
  const { user } = useAuth();
  const { signAction } = useDigitalSignatureHelpers();

  if (process.env.NODE_ENV === 'development') {
    console.log('FamilyFeesCollection mounted with familyId:', familyId);
  }

  // 🚀 OPTIMIZED: Use optimized hook for instant cache-first loading
  const { data: rawAcademicYears = [], isLoading: isAcademicYearsLoading } = useAcademicYears();

  // 🔥 CRITICAL FIX: Process academic years to mark current terms
  // This ensures the default term selection works properly
  const academicYears = useMemo(() => {
    return rawAcademicYears.map(year => ({
      ...year,
      terms: year.terms.map(term => ({
        ...term,
        isCurrent: isTermActive(term)
      }))
    }));
  }, [rawAcademicYears]);

  // 🚀 DYNAMIC YEAR LABELS: Calculate which year is "current" based on effective term
  const currentAcademicYearId = useMemo(() => {
    if (academicYears.length === 0) return null;
    const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
    return effectiveTerm?.academicYear?.id || null;
  }, [academicYears]);

  // Set initial year and term when data is loaded
  useEffect(() => {
    if (academicYears.length > 0 && !selectedAcademicYear) {
      // Use dynamic effective term for data display
      const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
      const currentYear = effectiveTerm?.academicYear;
      if (currentYear) {
        setSelectedAcademicYear(currentYear);
        setSelectedYear(currentYear.id);

        // Use the effective term from the data display logic
        if (effectiveTerm?.term) {
          setSelectedTermId(effectiveTerm.term.id);

          // Check if we're in a holiday period
          const currentTermCheck = getCurrentTerm(currentYear);
          if (!currentTermCheck) {
            // We're in holiday - showing most recent term
            toast({
              title: "Holiday Period",
              description: `Showing fees for ${effectiveTerm.term.name} (most recent term). Holidays in progress.`,
              duration: 4000,
            });
          } else {
            toast({
              title: "Current Term Selected",
              description: `Automatically showing fees for ${effectiveTerm.term.name} (current term)`,
              duration: 3000,
            });
          }
        } else {
          // If no active or recent term, check for term marked as current
          const markedCurrentTerm = currentYear.terms.find(term => term.isCurrent);
          if (markedCurrentTerm) {
            setSelectedTermId(markedCurrentTerm.id);
            toast({
              title: "Current Term Selected",
              description: `Automatically showing fees for ${markedCurrentTerm.name} (marked as current)`,
              duration: 3000,
            });
          } else if (currentYear.terms.length > 0) {
            // Fallback to first term if no current term
            setSelectedTermId(currentYear.terms[0].id);
            toast({
              title: "Term Selected",
              description: `No current term found. Showing ${currentYear.terms[0].name}`,
              duration: 3000,
            });
          }
        }
      }
    }
  }, [academicYears, selectedAcademicYear]);

  // Get terms for selected year
  const selectedYearTerms = academicYears.find(year => year.id === selectedYear)?.terms || [];

  // Fetch family pupils
  const { data: familyPupils = [], isLoading: isFamilyPupilsLoading } = useQuery<Pupil[]>({
    queryKey: ['family-pupils', familyId],
    queryFn: async () => {
      if (!familyId) return [];

      try {
        // Use the dedicated service method to get pupils by family ID
        const familyPupils = await PupilsService.getPupilsByFamily(familyId);

        console.log('Family pupils found:', familyPupils.length, 'for familyId:', familyId);
        console.log('Family pupils:', familyPupils.map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, familyId: p.familyId })));
        return familyPupils;
      } catch (error) {
        console.error('Error fetching family pupils:', error);
        return [];
      }
    },
    enabled: !!familyId,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData, // Show cached data immediately
  });

  // 🚀 OPTIMIZED: Use custom hook for family fees with parallel loading
  const { feesInfo, isLoading: isFeesInfoLoading } = useFamilyFees({
    familyId,
    familyPupils,
    selectedTermId,
    selectedAcademicYear,
    academicYears
  });

  // Calculate loading state
  const isLoading = isFamilyPupilsLoading || isFeesInfoLoading || isAcademicYearsLoading;

  const handleFamilyPayment = async (paymentData: {
    totalAmount: number;
    paymentMethod: string;
    selectedFees: Array<{
      pupilId: string;
      pupilName: string;
      feeStructureId: string;
      feeName: string;
      maxAmount: number;
      selectedAmount: number;
      termId?: string;
      academicYearId?: string;
      isCarryForward?: boolean;
    }>;
    paidBy: string;
  }) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to process payments.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Processing family payment:', {
        totalAmount: paymentData.totalAmount,
        selectedFeesCount: paymentData.selectedFees.length,
        affectedPupils: paymentData.selectedFees.map(f => `${f.pupilName} (${f.pupilId})`),
        familyId,
        receivedBy: user.username
      });

      // Process each payment individually and create digital signatures
      const paymentResults = await Promise.all(
        paymentData.selectedFees.map(async (feePayment) => {
          // Check if this is a uniform fee (tracking ID starts with uniform-specific pattern)
          const isUniformFee = feePayment.feeStructureId.includes('uniform') ||
            feePayment.feeStructureId.includes('tracking');
          const isCarryForwardFee = feePayment.isCarryForward === true;

          // Prepare paidBy object with actual logged-in user info
          const paidByUser = {
            id: user.id,
            name: user.username,
            role: user.role
          };

          let paymentId: string;

          if (isUniformFee) {
            // For uniform fees, use the uniform payment service
            console.log(`Processing uniform payment for ${feePayment.pupilName} - ${feePayment.feeName}`);

            // Create a uniform fee-like object for the payment
            const uniformFeeData = {
              id: feePayment.feeStructureId,
              uniformTrackingId: feePayment.feeStructureId,
              name: feePayment.feeName,
              amount: feePayment.maxAmount,
              paid: feePayment.maxAmount - feePayment.selectedAmount, // Previous payments
              balance: feePayment.selectedAmount, // Amount being paid now
              termId: selectedTermId,
              academicYearId: selectedAcademicYear?.id || '',
              isUniformFee: true
            };

            // Create uniform payment - service expects paidBy object, not string
            paymentId = await UniformFeesIntegrationService.createUniformPaymentRecord(
              uniformFeeData as any,
              feePayment.selectedAmount,
              feePayment.pupilId,
              selectedAcademicYear?.id || '',
              selectedTermId,
              paidByUser
            );
          } else {
            // For regular fees, use the API route (for notifications)
            const paymentRecord = {
              pupilId: feePayment.pupilId,
              feeStructureId: isCarryForwardFee ? 'previous-balance' : feePayment.feeStructureId,
              amount: feePayment.selectedAmount,
              paymentMethod: paymentData.paymentMethod,
              paymentDate: new Date().toISOString(),
              termId: selectedTermId,
              academicYearId: selectedAcademicYear?.id || '',
              paidBy: paidByUser,
              notes: isCarryForwardFee
                ? `Family carry forward payment: ${feePayment.feeName}. Paid by: ${paymentData.paidBy}`
                : `Family payment for ${feePayment.pupilName} - ${feePayment.feeName}. Paid by: ${paymentData.paidBy}`,
              balance: Math.max(0, feePayment.maxAmount - feePayment.selectedAmount),
              ...(isCarryForwardFee ? {
                isCarryForwardPayment: true,
                originalFeeStructureId: feePayment.feeStructureId,
                originalTermId: feePayment.termId,
                originalAcademicYearId: feePayment.academicYearId,
                carryForwardItemName: feePayment.feeName,
                paymentMadeInTerm: selectedTermId,
                paymentMadeInYear: selectedAcademicYear?.id || ''
              } : {}),
              skipHistoryLog: true,
              historyContext: {
                feeName: feePayment.feeName,
                pupilName: feePayment.pupilName,
                paymentMethod: paymentData.paymentMethod,
                source: 'family_fee_payment',
                paidByName: paymentData.paidBy,
              }
            };

            // 🔔 Use API route for notifications
            const response = await fetch('/api/payments/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(paymentRecord),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to create payment');
            }

            const result = await response.json();
            paymentId = result.paymentId;
            await HistoryLogService.log({
              action: 'create',
              entity: 'payment',
              recordId: paymentId,
              label: feePayment.feeName,
              meta: {
                amount: feePayment.selectedAmount,
                feeName: feePayment.feeName,
                pupilName: feePayment.pupilName,
                method: paymentData.paymentMethod,
                source: 'family_fee_payment',
              },
              actor: {
                id: user.id,
                username: user.username,
                role: user.role,
              },
            });
          }

          // Create digital signature for the payment (who received it)
          await signAction(
            'fee_payment',
            paymentId,
            'collected',
            {
              amount: feePayment.selectedAmount,
              pupilName: feePayment.pupilName,
              feeName: feePayment.feeName,
              academicYear: selectedAcademicYear?.name || '',
              term: selectedTermId,
              paymentType: isUniformFee ? 'uniform' : isCarryForwardFee ? 'carry-forward' : 'regular',
              paymentMethod: paymentData.paymentMethod,
              paidBy: paymentData.paidBy,
              receivedBy: user.username
            }
          );

          return { paymentId, feePayment, isUniformFee };
        })
      );

      toast({
        title: "Payment Successful",
        description: `Successfully processed ${paymentResults.length} payments totaling UGX ${paymentData.totalAmount.toLocaleString()}. Digital signatures recorded.`,
      });

      // Close modal
      setIsFamilyPaymentModalOpen(false);

      // Invalidate all relevant caches to trigger data refresh
      await Promise.all([
        // Invalidate family fees data
        queryClient.invalidateQueries({ queryKey: ['family-pupils', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['family-fees-info'] }),
        queryClient.invalidateQueries({ queryKey: ['family-payments-all'] }),
        queryClient.invalidateQueries({ queryKey: ['family-previous-balances'] }),

        // Invalidate individual pupil caches for all affected pupils
        ...paymentData.selectedFees.map(feePayment => [
          queryClient.invalidateQueries({ queryKey: ['pupil-payments-all', feePayment.pupilId] }),
          queryClient.invalidateQueries({ queryKey: ['pupil-payments', feePayment.pupilId] }),
          queryClient.invalidateQueries({ queryKey: ['previous-balance', feePayment.pupilId] }),
          queryClient.invalidateQueries({ queryKey: ['uniform-fees', feePayment.pupilId] }),
          queryClient.invalidateQueries({ queryKey: ['pupil-fees', feePayment.pupilId] }),
          queryClient.invalidateQueries({ queryKey: ['uniform-tracking', feePayment.pupilId] }),
        ]).flat(),

        // Invalidate general fee and payment caches
        queryClient.invalidateQueries({ queryKey: ['fee-structures'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
      ]);

      // Trigger a custom event to notify individual pupil pages about payment updates
      // This helps with timestamp-based cache invalidation
      const paymentUpdateEvent = new CustomEvent('familyPaymentUpdate', {
        detail: {
          affectedPupilIds: paymentData.selectedFees.map(f => f.pupilId),
          timestamp: Date.now(),
          familyId: familyId
        }
      });
      window.dispatchEvent(paymentUpdateEvent);

      // Also store the timestamp in localStorage as a backup mechanism
      localStorage.setItem('lastFamilyPaymentTimestamp', Date.now().toString());
      paymentData.selectedFees.forEach(feePayment => {
        localStorage.setItem(`lastPaymentTimestamp_${feePayment.pupilId}`, Date.now().toString());
      });

      console.log('Family payment completed successfully:', {
        paymentsCreated: paymentData.selectedFees.length,
        cacheInvalidated: true,
        eventDispatched: true,
        timestampsStored: true
      });
    } catch (error) {
      console.error('Family payment error:', error);
      toast({
        title: "Payment Failed",
        description: "There was an error processing the family payment. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handlePrint = () => {
    setIsFamilyPrintModalOpen(true);
  };

  // Register print handler to open print modal
  useEffect(() => {
    const unregister = registerPrintHandler(() => {
      setIsFamilyPrintModalOpen(true);
    }, 50);
    return unregister;
  }, [registerPrintHandler]);

  if (isFamilyPupilsLoading || isFeesInfoLoading || isAcademicYearsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (familyPupils.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Family Information</h2>
            <p className="text-gray-600 mb-4">No pupils found for family ID: <code className="bg-gray-100 px-2 py-1 rounded">{familyId}</code></p>
            <Link
              href="/fees/collection"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowCircleLeft className="w-5 h-5" />
              <span>Back to Fees Collection</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-12">
      <div className="bg-white/90 border-b shadow-sm backdrop-blur-xl sticky top-0 z-10 border-b-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="space-y-3">
            <h1 className="text-lg sm:text-xl font-bold text-indigo-900 truncate">
              Family Fees Summary
            </h1>

            {/* Family Summary Card */}
            {(() => {
              const totalFees = familyPupils.reduce((sum, pupil) => {
                const summary = feesInfo[pupil.id];
                return sum + (summary?.totalFees || 0);
              }, 0);

              const totalPaid = familyPupils.reduce((sum, pupil) => {
                const summary = feesInfo[pupil.id];
                return sum + (summary?.totalPaid || 0);
              }, 0);

              const totalBalance = familyPupils.reduce((sum, pupil) => {
                const summary = feesInfo[pupil.id];
                return sum + (summary?.balance || 0);
              }, 0);

              return (
                <div className="flex flex-wrap items-center gap-3">
                  {/* Back button - icon only */}
                  <button
                    onClick={() => router.back()}
                    className="flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 hover:text-blue-700 transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0"
                    title="Back"
                  >
                    <ArrowCircleLeft className="w-5 h-5" weight="bold" />
                  </button>

                  {/* Family totals pill - compact and matching button style */}
                  <div className="bg-white rounded-full px-3 py-2 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-2 flex-1 min-w-0 h-11">
                    <div className="flex flex-col items-center justify-center gap-0">
                      <span className="text-[10px] font-medium text-indigo-600 whitespace-nowrap leading-tight">Total Amount</span>
                      <span className="text-sm font-bold text-indigo-900 whitespace-nowrap leading-tight">
                        {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(totalFees)}
                      </span>
                    </div>
                    <div className="w-px h-5 bg-gray-300"></div>
                    <div className="flex flex-col items-center justify-center gap-0">
                      <span className="text-[10px] font-medium text-green-600 whitespace-nowrap leading-tight">Total Paid</span>
                      <span className="text-sm font-bold text-green-900 whitespace-nowrap leading-tight">
                        {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(totalPaid)}
                      </span>
                    </div>
                    <div className="w-px h-5 bg-gray-300"></div>
                    <div className="flex flex-col items-center justify-center gap-0">
                      <span className="text-[10px] font-medium text-red-600 whitespace-nowrap leading-tight">Balance</span>
                      <span className="text-sm font-bold text-red-900 whitespace-nowrap leading-tight">
                        {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(totalBalance)}
                      </span>
                    </div>
                  </div>

                  {/* Desktop actions: modern round platform aligned with totals */}
                  <div className="hidden sm:flex flex-wrap items-center gap-2 flex-shrink-0">
                    {/* Academic Year & Term Selector - matching button style */}
                    <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1 h-11 flex-shrink-0">
                      <select
                        value={selectedYear}
                        onChange={(e) => {
                          const yearId = e.target.value;
                          setSelectedYear(yearId);
                          const year = academicYears.find(y => y.id === yearId);
                          setSelectedTermId(getCurrentTerm(year as any)?.id || year?.terms[0]?.id || '');
                          setSelectedAcademicYear(year || null);
                        }}
                        className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full"
                        style={{ width: 'auto', minWidth: 'fit-content' }}
                      >
                        <option value="">Select Year</option>
                        {[...academicYears].reverse().map((year) => {
                          // Dynamic label based on effective term
                          const isCurrent = year.id === currentAcademicYearId;
                          const today = new Date();
                          const yearEnd = new Date(year.endDate);
                          const hasEnded = today > yearEnd;

                          let label = '';
                          if (isCurrent) {
                            label = '(Current)';
                          } else if (year.isLocked) {
                            label = '(Locked)';
                          } else if (!hasEnded) {
                            label = '(Upcoming)';
                          }
                          // Ended years get no label

                          return (
                            <option key={year.id} value={year.id}>
                              {year.name} {label}
                            </option>
                          );
                        })}
                      </select>
                      <div className="w-px h-5 bg-gray-300"></div>
                      <select
                        value={selectedTermId}
                        onChange={(e) => setSelectedTermId(e.target.value)}
                        disabled={!selectedYear}
                        className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                        style={{ width: 'auto', minWidth: 'fit-content' }}
                      >
                        {selectedYearTerms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex flex-wrap items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setIsFamilyPaymentModalOpen(true)}
                        disabled={familyPupils.length === 0 || isLoading}
                        className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-emerald-600 border border-emerald-400 shadow-sm hover:bg-gradient-to-br hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed flex-shrink-0"
                        title="Pay for Family"
                      >
                        <CurrencyCircleDollar className="w-4 h-4 mb-0.5" weight="bold" />
                        <span className="text-[8px] font-semibold leading-tight">Pay</span>
                      </button>

                      <button
                        onClick={() => setViewMode(viewMode === 'summary' ? 'detail' : 'summary')}
                        className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-amber-600 border border-amber-400 shadow-sm hover:bg-gradient-to-br hover:from-amber-400 hover:via-orange-500 hover:to-amber-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0"
                        title={viewMode === 'summary' ? 'Switch to Detail View' : 'Switch to Summary View'}
                      >
                        {viewMode === 'summary' ? (
                          <ListBullets className="w-4 h-4 mb-0.5" weight="bold" />
                        ) : (
                          <List className="w-4 h-4 mb-0.5" weight="bold" />
                        )}
                        <span className="text-[8px] font-semibold leading-tight">{viewMode === 'summary' ? 'Detail' : 'Summary'}</span>
                      </button>

                      <button
                        onClick={handlePrint}
                        disabled={familyPupils.length === 0 || isLoading}
                        className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-rose-600 border border-rose-400 shadow-sm hover:bg-gradient-to-br hover:from-rose-400 hover:via-pink-500 hover:to-rose-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed flex-shrink-0"
                        title="Print Family Summary"
                      >
                        <Printer className="w-4 h-4 mb-0.5" weight="bold" />
                        <span className="text-[8px] font-semibold leading-tight">Print</span>
                      </button>
                    </div>
                  </div>

                  {/* Mobile actions: same round platform below totals */}
                  <div className="flex sm:hidden items-center gap-2 flex-shrink-0">
                    {/* Academic Year & Term Selector - matching button style */}
                    <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1 h-10">
                      <select
                        value={selectedYear}
                        onChange={(e) => {
                          const yearId = e.target.value;
                          setSelectedYear(yearId);
                          const year = academicYears.find(y => y.id === yearId);
                          setSelectedTermId(getCurrentTerm(year as any)?.id || year?.terms[0]?.id || '');
                          setSelectedAcademicYear(year || null);
                        }}
                        className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full"
                        style={{ width: 'auto', minWidth: 'fit-content' }}
                      >
                        <option value="">Select Year</option>
                        {[...academicYears].reverse().map((year) => (
                          <option key={year.id} value={year.id}>
                            {year.name}
                          </option>
                        ))}
                      </select>
                      <div className="w-px h-4 bg-gray-300"></div>
                      <select
                        value={selectedTermId}
                        onChange={(e) => setSelectedTermId(e.target.value)}
                        disabled={!selectedYear}
                        className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                        style={{ width: 'auto', minWidth: 'fit-content' }}
                      >
                        {selectedYearTerms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1 overflow-x-auto">
                      <button
                        onClick={() => setIsFamilyPaymentModalOpen(true)}
                        disabled={familyPupils.length === 0 || isLoading}
                        className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-white text-emerald-600 border border-emerald-400 shadow-sm hover:bg-gradient-to-br hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
                        title="Pay for Family"
                      >
                        <CurrencyCircleDollar className="w-3.5 h-3.5 mb-0.5" weight="bold" />
                        <span className="text-[7px] font-semibold leading-tight">Pay</span>
                      </button>

                      <button
                        onClick={() => setViewMode(viewMode === 'summary' ? 'detail' : 'summary')}
                        className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-white text-amber-600 border border-amber-400 shadow-sm hover:bg-gradient-to-br hover:from-amber-400 hover:via-orange-500 hover:to-amber-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0"
                        title={viewMode === 'summary' ? 'Switch to Detail View' : 'Switch to Summary View'}
                      >
                        {viewMode === 'summary' ? (
                          <ListBullets className="w-3.5 h-3.5 mb-0.5" weight="bold" />
                        ) : (
                          <List className="w-3.5 h-3.5 mb-0.5" weight="bold" />
                        )}
                        <span className="text-[7px] font-semibold leading-tight">{viewMode === 'summary' ? 'Detail' : 'Summary'}</span>
                      </button>

                      <button
                        onClick={handlePrint}
                        disabled={familyPupils.length === 0 || isLoading}
                        className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-white text-rose-600 border border-rose-400 shadow-sm hover:bg-gradient-to-br hover:from-rose-400 hover:via-pink-500 hover:to-rose-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
                        title="Print Family Summary"
                      >
                        <Printer className="w-3.5 h-3.5 mb-0.5" weight="bold" />
                        <span className="text-[7px] font-semibold leading-tight">Print</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Mobile-responsive grid - single column on mobile, 2 columns on tablet, 2 on desktop for wider cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
          {familyPupils.map((pupil) => {
            const summary = feesInfo[pupil.id];
            return (
              <div key={pupil.id} className="bg-white rounded-xl shadow-sm border border-indigo-100 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/pupil-detail?id=${pupil.id}`}
                      className="text-lg sm:text-xl font-semibold text-gray-900 hover:text-blue-600 hover:underline truncate leading-tight block transition-colors"
                    >
                      {pupil.firstName} {pupil.lastName}
                    </Link>
                    <p className="text-sm sm:text-base text-gray-500">
                      {pupil.classCode || pupil.className || 'N/A'} | {pupil.section} | {pupil.admissionNumber}
                    </p>
                  </div>
                  <Link
                    href={`/fees/collect?pupilId=${pupil.id}`}
                    className="text-sm sm:text-base text-blue-600 hover:text-blue-700 hover:underline self-start sm:self-auto whitespace-nowrap"
                  >
                    View Details
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm sm:text-base text-gray-600">Total Fees:</span>
                    <span className="font-medium text-gray-900 text-sm sm:text-base">
                      {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(summary?.totalFees || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm sm:text-base text-gray-600">Amount Paid:</span>
                    <span className="font-medium text-green-600 text-sm sm:text-base">
                      {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(summary?.totalPaid || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm sm:text-base font-medium text-gray-900">Balance:</span>
                    <span className="font-bold text-red-600 text-sm sm:text-base">
                      {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(summary?.balance || 0)}
                    </span>
                  </div>
                  {summary?.lastPayment && (
                    <p className="text-sm text-gray-500 mt-2">
                      Last Payment: {new Date(summary.lastPayment.paymentDate).toLocaleDateString()}
                    </p>
                  )}

                  {/* Fee Breakdown */}
                  {summary?.applicableFees && summary.applicableFees.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm sm:text-base font-medium text-gray-900">Fee Breakdown</h4>
                        <button
                          onClick={() => togglePupilExpansion(pupil.id)}
                          className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 via-purple-500 to-purple-600 hover:from-violet-500 hover:via-purple-600 hover:to-purple-700 text-white transition-all duration-300 hover:scale-110 shadow-xl hover:shadow-2xl backdrop-blur-lg relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/40 before:via-white/25 before:to-transparent before:opacity-0 hover:before:opacity-100 after:absolute after:inset-0 after:bg-gradient-to-tr after:from-transparent after:via-white/15 after:to-white/35 after:opacity-0 hover:after:opacity-100 border-2 border-purple-300/60"
                          title={expandedPupils.has(pupil.id) ? "Collapse" : "Expand"}
                        >
                          {expandedPupils.has(pupil.id) ? (
                            <CaretUp className="w-3.5 h-3.5 relative z-10 drop-shadow-lg" />
                          ) : (
                            <CaretDown className="w-3.5 h-3.5 relative z-10 drop-shadow-lg" />
                          )}
                        </button>
                      </div>
                      {/* Show breakdown if in detail mode OR if this specific pupil is expanded */}
                      {(viewMode === 'detail' || expandedPupils.has(pupil.id)) && (
                        <div className="space-y-2">
                          {summary.applicableFees.map((fee) => {
                            // Get term name for display
                            const feeYear = academicYears.find(year => year.id === (fee.academicYearId || selectedYear));
                            const termName = academicYears
                              .find(year => year.id === (fee.academicYearId || selectedYear))
                              ?.terms.find(term => term.id === fee.termId)?.name || fee.termId;
                            const feeKey = `${fee.isCarryForward ? 'cf' : 'current'}:${fee.feeStructureId}:${fee.academicYearId || ''}:${fee.termId}`;

                            return (
                              <div key={feeKey} className="text-sm sm:text-base">
                                <div className="flex justify-between items-start gap-3">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-gray-600 leading-tight">{fee.name}</span>
                                    {fee.feeStructureId.startsWith('uniform') && (
                                      <span className="ml-2 text-purple-600 font-medium">👕 Uniform</span>
                                    )}
                                    {fee.isCarryForward && (
                                      <span className="ml-2 text-orange-600 font-medium">(Carry Forward - {termName}{feeYear?.name ? `, ${feeYear.name}` : ''})</span>
                                    )}
                                    {fee.isCurrentTerm && (
                                      <span className="ml-2 text-blue-600 font-medium">({termName})</span>
                                    )}
                                  </div>
                                  <span className="font-medium text-gray-900 whitespace-nowrap">
                                    {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.amount)}
                                  </span>
                                </div>
                                {fee.discount && (
                                  <div className="ml-2 sm:ml-4 text-sm text-purple-600 mt-1">
                                    <div>Original: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.originalAmount)}</div>
                                    <div className="truncate">Discount: {fee.discount.name} ({fee.discount.type === 'percentage' ? `${fee.discount.amount}%` : new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.discount.amount)})</div>
                                  </div>
                                )}
                                <div className="ml-2 sm:ml-4 text-sm mt-1">
                                  <div className="text-green-600">Paid: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.paid)}</div>
                                  <div className="text-red-600">Balance: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.balance)}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Show summary when collapsed and in summary mode */}
                      {viewMode === 'summary' && !expandedPupils.has(pupil.id) && (
                        <div className="text-xs sm:text-sm text-gray-500">
                          {summary.applicableFees.length} fee{summary.applicableFees.length !== 1 ? 's' : ''} • Click "Expand" to view details
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Family Payment Modal */}
      <FamilyPaymentModal
        isOpen={isFamilyPaymentModalOpen}
        onClose={() => setIsFamilyPaymentModalOpen(false)}
        familyPupils={familyPupils}
        feesInfo={feesInfo}
        onPaymentSubmit={handleFamilyPayment}
      />

      {/* Family Print Modal */}
      <FamilyPrintModal
        isOpen={isFamilyPrintModalOpen}
        onClose={() => setIsFamilyPrintModalOpen(false)}
        familyPupils={familyPupils}
        feesInfo={feesInfo}
        selectedAcademicYear={selectedAcademicYear}
        selectedTerm={selectedYearTerms.find(t => t.id === selectedTermId)?.name}
        familyId={familyId}
      />
    </div>
  );
}
