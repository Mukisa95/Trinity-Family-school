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
  Printer 
} from '@phosphor-icons/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Services
import { PupilsService } from '@/lib/services/pupils.service';
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { PaymentsService } from '@/lib/services/payments.service';
import { UniformFeesIntegrationService } from '@/lib/services/uniform-fees-integration.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';

// Components
import { FamilyPaymentModal } from './components/FamilyPaymentModal';
import { FamilyPrintModal } from './components/FamilyPrintModal';

// Utilities
import { getCurrentTerm, isTermActive } from '@/lib/utils/academic-year-utils';
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
  
  const { data: settings } = useSchoolSettings();

  console.log('FamilyFeesCollection mounted with familyId:', familyId);

  // Fetch academic years
  const { data: rawAcademicYears = [], isLoading: isAcademicYearsLoading } = useQuery<AcademicYear[]>({
    queryKey: ['academic-years'],
    queryFn: async () => {
      return await AcademicYearsService.getAllAcademicYears();
    }
  });

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

  // Set initial year and term when data is loaded
  useEffect(() => {
    if (academicYears.length > 0 && !selectedAcademicYear) {
      // Find the current active academic year
      const currentYear = academicYears.find(year => year.isActive);
      if (currentYear) {
        setSelectedAcademicYear(currentYear);
        setSelectedYear(currentYear.id);
        
        // Use utility function to get current term more reliably
        const currentTerm = getCurrentTerm(currentYear);
        if (currentTerm) {
          setSelectedTermId(currentTerm.id);
          toast({
            title: "Current Term Selected",
            description: `Automatically showing fees for ${currentTerm.name} (current term)`,
            duration: 3000,
          });
        } else {
          // If no current term by date, check for term marked as current
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
    enabled: !!familyId
  });

  // Fetch fee structures
  const { data: feeStructures = [], isLoading: isFeeStructuresLoading } = useQuery<FeeStructure[]>({
    queryKey: ['fee-structures', selectedYear],
    queryFn: async () => {
      if (!selectedYear || !selectedTermId) return [];
      const selectedAcademicYear = academicYears.find(year => year.id === selectedYear);
      
      try {
        const allStructures = await FeeStructuresService.getAllFeeStructures();
        
        // Filter fee structures for the selected academic year
        const filteredStructures = allStructures.filter(structure => 
          structure.academicYearId === selectedAcademicYear?.id
        );
        
        console.log('Fee structures found:', filteredStructures.length, 'for academic year:', selectedAcademicYear?.name);
        return filteredStructures;
      } catch (error) {
        console.error('Error fetching fee structures:', error);
        return [];
      }
    },
    enabled: !!selectedYear && !!selectedTermId && !isAcademicYearsLoading
  });

  // Get fees info for family members
  const { data: feesInfo = {}, isLoading: isFeesInfoLoading } = useQuery<Record<string, FeesInfo>>({
    queryKey: ['family-fees-info', selectedYear, selectedTermId, familyId, familyPupils],
    queryFn: async () => {
      if (!familyId || !selectedYear || !selectedTermId || familyPupils.length === 0) return {};
      const selectedAcademicYear = academicYears.find(year => year.id === selectedYear);
      
      console.log('Processing fees for family:', {
        familyId,
        selectedYear,
        selectedTermId,
        familyPupilsCount: familyPupils.length,
        selectedAcademicYear: selectedAcademicYear?.name,
        feeStructuresCount: feeStructures.length
      });
      
      const result: Record<string, FeesInfo> = {};

      // Process each family member
      for (const pupil of familyPupils) {
        console.log(`Processing fees for pupil: ${pupil.firstName} ${pupil.lastName} (${pupil.id})`);
        console.log(`Pupil registration date: ${pupil.registrationDate || 'Not set'}`);
        
        try {
          const applicableFees: FeeWithPayment[] = [];
          let totalFees = 0;
          let totalPaid = 0;
          let lastPayment: FeePayment | null = null;

          // Get all payments for this pupil
          const allPayments = await PaymentsService.getPaymentsByPupil(pupil.id);
          console.log(`Payments for ${pupil.firstName}: ${allPayments.length} payments found`);

          // 🔥 CRITICAL FIX: Use the SAME fee processing logic as individual pupil fees page
          // This ensures EXACT same fees are shown in family view and individual view
          
          // Step 1: Filter fees for CURRENT TERM using historical snapshot
          let historicalPupil = pupil;
          try {
            const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
              pupil,
              selectedTermId,
              selectedAcademicYear
            );
            historicalPupil = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);
            console.log(`📸 Using historical snapshot for ${pupil.firstName}:`, {
              currentClass: pupil.classId,
              historicalClass: historicalPupil.classId,
              currentSection: pupil.section,
              historicalSection: historicalPupil.section,
              term: selectedAcademicYear?.terms.find(t => t.id === selectedTermId)?.name
            });
          } catch (snapshotError) {
            console.error(`❌ Failed to get snapshot for ${pupil.firstName}, using current data:`, snapshotError);
            // Fall back to current pupil data if snapshot fails
          }

          // Step 2: Get current term fees using filterApplicableFees (EXACT same logic as individual page)
          const currentTermFees = filterApplicableFees(
            feeStructures,
            historicalPupil,
            selectedTermId,
            selectedAcademicYear!,
            academicYears
          );
          
          console.log(`✅ Current term fees for ${pupil.firstName}:`, currentTermFees.map(f => f.name));

          // Step 3: Process fees with payment information (EXACT same logic as individual page)
          const processedFees = processPupilFees(
            currentTermFees,
            allPayments,
            feeStructures,
            historicalPupil,
            selectedTermId,
            selectedAcademicYear!,
            academicYears
          );

          // Step 4: Get previous term balances (carry forward)
          const previousBalance = await calculatePreviousTermBalances(
            pupil.id,
            selectedTermId,
            selectedAcademicYear!,
            academicYears,
            async () => feeStructures,
            async (pupilId) => allPayments,
            pupil
          );

          // Step 5: Add current term fees (already processed with payments)
          for (const fee of processedFees) {
            applicableFees.push({
              feeStructureId: fee.id,
              name: fee.name,
              amount: fee.amount,
              paid: fee.paid,
              balance: fee.balance,
              lastPayment: fee.payments && fee.payments.length > 0 ? {
                id: fee.payments[0].id,
                amount: fee.payments[0].amount,
                paymentDate: fee.payments[0].paymentDate,
                balance: fee.payments[0].balance || 0,
                paidBy: fee.payments[0].paidBy ? { name: fee.payments[0].paidBy.name } : undefined,
                term: selectedTermId,
                academicYear: selectedAcademicYear?.name || '',
                feeStructureId: fee.payments[0].feeStructureId
              } : null,
              originalAmount: fee.originalAmount || fee.amount,
              termId: fee.termId,
              isCurrentTerm: true, // These are all current term fees
              isCarryForward: false
            });

            totalFees += fee.amount;
            totalPaid += fee.paid;
            
            // Track last payment
            if (fee.payments && fee.payments.length > 0) {
              const feeLastPayment = fee.payments[0]; // Already sorted by date
              if (!lastPayment || new Date(feeLastPayment.paymentDate) > new Date(lastPayment.paymentDate)) {
              lastPayment = {
                id: feeLastPayment.id,
                amount: feeLastPayment.amount,
                paymentDate: feeLastPayment.paymentDate,
                balance: feeLastPayment.balance || 0,
                paidBy: feeLastPayment.paidBy ? { name: feeLastPayment.paidBy.name } : undefined,
                term: selectedTermId,
                academicYear: selectedAcademicYear?.name || '',
                feeStructureId: feeLastPayment.feeStructureId
              };
              }
            }
            }

          // Step 6: Add previous term balances (carry forward)
          if (previousBalance && previousBalance.breakdown) {
            for (const carryForwardItem of previousBalance.breakdown) {
            applicableFees.push({
                feeStructureId: carryForwardItem.feeStructureId,
                name: carryForwardItem.name,
                amount: carryForwardItem.amount,
                paid: carryForwardItem.paid,
                balance: carryForwardItem.balance,
                lastPayment: null,
                originalAmount: carryForwardItem.amount,
                termId: carryForwardItem.termId,
                isCurrentTerm: false,
                isCarryForward: true
              });

              totalFees += carryForwardItem.balance; // Only add balance, not full amount
              // Don't add to totalPaid - those payments are already counted in previous terms
            }
          }

          // Process uniform fees for this pupil
          console.log(`Fetching uniform fees for ${pupil.firstName} ${pupil.lastName}`);
          const uniformFees = await UniformFeesIntegrationService.getUniformFeesForPupil(
            pupil.id,
            selectedTermId,
            selectedAcademicYear?.id
          );
          
          console.log(`Found ${uniformFees.length} uniform fees for ${pupil.firstName}:`, 
            uniformFees.map(f => ({ name: f.name, amount: f.amount, balance: f.balance, termId: f.termId }))
          );

          // Add uniform fees to applicable fees
          for (const uniformFee of uniformFees) {
            // Check if uniform fee is from a valid term for this pupil
            if (pupil.registrationDate) {
              const uniformAcademicYear = academicYears.find(year => year.id === uniformFee.academicYearId);
              const uniformTerm = uniformAcademicYear?.terms.find(term => term.id === uniformFee.termId);
              
              if (uniformTerm && !isTermValidForPupil(uniformTerm, pupil.registrationDate)) {
                console.log(`⏭️ Skipping uniform fee "${uniformFee.name}" for ${pupil.firstName}: term ${uniformTerm.name} ended before pupil registration`);
                continue;
              }
            }

            const isCurrentTermUniform = uniformFee.termId === selectedTermId;
            const hasUniformBalance = uniformFee.balance > 0;

            // Only include uniforms with balance or from current term
            if (isCurrentTermUniform || hasUniformBalance) {
              applicableFees.push({
                feeStructureId: uniformFee.uniformTrackingId, // Use tracking ID as fee structure ID
                name: uniformFee.name,
                amount: uniformFee.amount,
                paid: uniformFee.paid,
                balance: uniformFee.balance,
                lastPayment: null, // Uniform fees don't have last payment in the same way
                originalAmount: uniformFee.originalAmount || uniformFee.amount,
                termId: uniformFee.termId,
                isCurrentTerm: isCurrentTermUniform,
                isCarryForward: !isCurrentTermUniform && hasUniformBalance
              });

              totalFees += uniformFee.amount;
              totalPaid += uniformFee.paid;
            }
          }

          // Sort fees: current term first, then carry-forward fees by term order
          const sortedFees = applicableFees.sort((a, b) => {
            // Current term fees first
            if (a.isCurrentTerm && !b.isCurrentTerm) return -1;
            if (!a.isCurrentTerm && b.isCurrentTerm) return 1;
            
            // If both are carry-forward, sort by term order
            if (a.isCarryForward && b.isCarryForward) {
              return a.termId.localeCompare(b.termId);
            }
            
            return 0;
          });

          console.log(`Final totals for ${pupil.firstName}: Total Fees: ${totalFees}, Total Paid: ${totalPaid}, Applicable Fees: ${sortedFees.length}`);

          result[pupil.id] = {
            type: 'total',
            totalFees,
            totalPaid,
            balance: Math.max(0, totalFees - totalPaid),
            lastPayment,
            applicableFees: sortedFees
          };
        } catch (error) {
          console.error(`Error getting fees info for pupil ${pupil.id}:`, error);
          result[pupil.id] = {
            type: 'total',
            totalFees: 0,
            totalPaid: 0,
            balance: 0,
            lastPayment: null,
            applicableFees: []
          };
        }
      }

      console.log('Family fees result:', result);
      return result;
    },
    enabled: !!familyId && !!selectedYear && !!selectedTermId && !isFeeStructuresLoading && familyPupils.length > 0
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
    }>;
    paidBy: string;
  }) => {
    try {
      console.log('Processing family payment:', {
        totalAmount: paymentData.totalAmount,
        selectedFeesCount: paymentData.selectedFees.length,
        affectedPupils: paymentData.selectedFees.map(f => `${f.pupilName} (${f.pupilId})`),
        familyId
      });

      // Process each payment individually
      const paymentPromises = paymentData.selectedFees.map(async (feePayment) => {
        // Check if this is a uniform fee (tracking ID starts with uniform-specific pattern)
        const isUniformFee = feePayment.feeStructureId.includes('uniform') || 
                           feePayment.feeStructureId.includes('tracking');

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

          return await UniformFeesIntegrationService.createUniformPaymentRecord(
            uniformFeeData as any,
            feePayment.selectedAmount,
            paymentData.paymentMethod,
            paymentData.paidBy
          );
        } else {
          // For regular fees, use the standard payment service
          const paymentRecord = {
            pupilId: feePayment.pupilId,
            feeStructureId: feePayment.feeStructureId,
            amount: feePayment.selectedAmount,
            paymentMethod: paymentData.paymentMethod,
            paymentDate: new Date().toISOString(),
            termId: selectedTermId,
            academicYearId: selectedAcademicYear?.id || '',
            paidBy: {
              name: paymentData.paidBy,
              id: 'family-payment'
            },
            notes: `Family payment for ${feePayment.pupilName} - ${feePayment.feeName}`,
            balance: Math.max(0, feePayment.maxAmount - feePayment.selectedAmount)
          };

          return await PaymentsService.createPayment(paymentRecord);
        }
      });

      await Promise.all(paymentPromises);

      toast({
        title: "Payment Successful",
        description: `Successfully processed ${paymentData.selectedFees.length} payments totaling UGX ${paymentData.totalAmount.toLocaleString()}`,
      });

      // Close modal
      setIsFamilyPaymentModalOpen(false);
      
      // Invalidate all relevant caches to trigger data refresh
      await Promise.all([
        // Invalidate family fees data
        queryClient.invalidateQueries({ queryKey: ['family-pupils', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['family-fees-info'] }),
        
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
    }
  };

  const handlePrint = () => {
    setIsFamilyPrintModalOpen(true);
  };

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
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Family ID: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{familyId}</code>
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Total Family Balance: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(
                familyPupils.reduce((sum, pupil) => {
                  const summary = feesInfo[pupil.id];
                  return sum + (summary?.balance || 0);
                }, 0)
              )}
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <button
                  onClick={() => router.back()}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-2 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 transition-all duration-300 hover:scale-95 origin-center text-xs sm:text-sm"
                >
                  <ArrowCircleLeft className="w-4 h-4" weight="bold" />
                  <span className="font-medium hidden sm:inline">Back to Pupil Fees</span>
                  <span className="font-medium sm:hidden">Back</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsFamilyPaymentModalOpen(true)}
                  disabled={familyPupils.length === 0 || isLoading}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1.5 rounded-md font-medium transition-colors text-xs sm:text-sm"
                >
                  <span>💳</span>
                  <span>Make Payment</span>
                </button>
                
                <button
                  onClick={handlePrint}
                  disabled={familyPupils.length === 0 || isLoading}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-3 py-1.5 rounded-md font-medium transition-colors text-xs sm:text-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
              </div>

              {/* Mobile-optimized selectors */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                {/* Year Selector */}
                <div className="relative inline-flex w-full sm:min-w-[160px] sm:w-auto">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      const yearId = e.target.value;
                      setSelectedYear(yearId);
                      const year = academicYears.find(y => y.id === yearId);
                      const currentTerm = year?.terms.find(t => t.isCurrent);
                      setSelectedTermId(currentTerm?.id || 'Term 1');
                      setSelectedAcademicYear(year);
                    }}
                    className="w-full pl-7 pr-7 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white text-gray-700 font-medium hover:border-gray-300 transition-colors text-xs sm:text-sm"
                  >
                    <option value="">Select Year</option>
                    {academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name} {year.isActive ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                  <CaretUpDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
                </div>

                {/* Term Selector */}
                <div className="relative inline-flex w-full sm:min-w-[140px] sm:w-auto">
                  <Clock className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <select
                    value={selectedTermId}
                    onChange={(e) => setSelectedTermId(e.target.value)}
                    className="w-full pl-7 pr-7 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white text-gray-700 font-medium hover:border-gray-300 transition-colors text-xs sm:text-sm"
                    disabled={!selectedYear}
                  >
                    {selectedYearTerms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name} {term.isCurrent ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                  <CaretUpDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
                </div>
              </div>
            </div>
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
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 truncate leading-tight">
                      {pupil.firstName} {pupil.lastName}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-500">
                      {pupil.className || 'No Class'} | {pupil.section}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400">
                      PIN: {pupil.admissionNumber}
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

                  {/* Fee Breakdown - Collapsible on mobile */}
                  {summary?.applicableFees && summary.applicableFees.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm sm:text-base font-medium text-gray-900 mb-2">Fee Breakdown</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {summary.applicableFees.map((fee) => {
                          // Get term name for display
                          const termName = academicYears
                            .find(year => year.id === selectedYear)
                            ?.terms.find(term => term.id === fee.termId)?.name || fee.termId;
                          
                          return (
                            <div key={fee.feeStructureId} className="text-sm sm:text-base">
                              <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <span className="text-gray-600 leading-tight">{fee.name}</span>
                                  {fee.feeStructureId.startsWith('uniform') && (
                                    <span className="ml-2 text-purple-600 font-medium">👕 Uniform</span>
                                  )}
                                  {fee.isCarryForward && (
                                    <span className="ml-2 text-orange-600 font-medium">(Carry Forward - {termName})</span>
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
