import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { AcademicYear, Pupil, FeeStructure, PaymentRecord } from '@/types';

// Services
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { PaymentsService } from '@/lib/services/payments.service';
import { UniformFeesIntegrationService } from '@/lib/services/uniform-fees-integration.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import { FeesHolidayService } from '@/lib/services/fees-holiday.service';

// Utilities
import {
  filterApplicableFees,
  processPupilFees,
  calculatePreviousTermBalances
} from '../../collect/[id]/utils/feeProcessing';
import { isTermValidForPupil } from '../../collect/[id]/utils/feeProcessing';

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

interface UseFamilyFeesOptions {
  familyId: string;
  familyPupils: Pupil[];
  selectedTermId: string;
  selectedAcademicYear: AcademicYear | null;
  academicYears: AcademicYear[];
}

interface UseFamilyFeesReturn {
  feesInfo: Record<string, FeesInfo>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useFamilyFees({
  familyId,
  familyPupils,
  selectedTermId,
  selectedAcademicYear,
  academicYears
}: UseFamilyFeesOptions): UseFamilyFeesReturn {

  // 🚀 Fetch ALL fee structures (unfiltered) — needed for discount lookups in processPupilFees
  const { data: allFeeStructures = [], isLoading: isAllFeeStructuresLoading } = useQuery<FeeStructure[]>({
    queryKey: ['fee-structures-all'],
    queryFn: async () => {
      try {
        return await FeeStructuresService.getAllFeeStructures();
      } catch (error) {
        console.error('Error fetching all fee structures:', error);
        return [];
      }
    },
    staleTime: 8 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  // 🚀 Fetch fee structures filtered by selected academic year (for filterApplicableFees)
  // Fetches independently (not derived from allFeeStructures) to avoid stale-closure issues
  const { data: feeStructures = [], isLoading: isFeeStructuresLoading } = useQuery<FeeStructure[]>({
    queryKey: ['fee-structures', selectedAcademicYear?.id],
    queryFn: async () => {
      if (!selectedAcademicYear?.id) return [];
      try {
        const allStructures = await FeeStructuresService.getAllFeeStructures();
        const filteredStructures = allStructures.filter(structure =>
          structure.academicYearId === selectedAcademicYear?.id
        );
        if (process.env.NODE_ENV === 'development') {
          console.log('Fee structures found:', filteredStructures.length, 'for academic year:', selectedAcademicYear?.name);
        }
        return filteredStructures;
      } catch (error) {
        console.error('Error fetching fee structures:', error);
        return [];
      }
    },
    enabled: !!selectedAcademicYear?.id,
    staleTime: 8 * 60 * 1000, // 8 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  // 🚀 OPTIMIZED: Batch load ALL payments for the term in ONE query
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pupilIds = useMemo(() => familyPupils.map(p => p.id), [familyPupils]);
  const { data: allPaymentsMap = new Map(), isLoading: isPaymentsLoading } = useQuery<Map<string, PaymentRecord[]>>({
    queryKey: ['family-payments-batch', selectedAcademicYear?.id, selectedTermId, pupilIds.join(',')],
    queryFn: async () => {
      if (!selectedAcademicYear?.id || !selectedTermId || pupilIds.length === 0) {
        return new Map();
      }

      const paymentsMap = new Map<string, PaymentRecord[]>();

      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('⚡ BATCH LOADING: Loading ALL payments for term in ONE query...');
        }

        // Load all payments for the term in one batch query
        const allTermPayments = await PaymentsService.getAllPaymentsByTerm(selectedAcademicYear.id, selectedTermId);

        // Group payments by pupilId in memory (instant lookup, no more queries!)
        const paymentsGrouped = PaymentsService.groupPaymentsByPupil(allTermPayments);

        // Filter to only include payments for family pupils
        pupilIds.forEach(pupilId => {
          paymentsMap.set(pupilId, paymentsGrouped.get(pupilId) || []);
        });

        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ BATCH LOADED: ${allTermPayments.length} payments for ${pupilIds.length} pupils in ONE query`);
        }
      } catch (error) {
        console.error('Error batch loading payments, falling back to individual queries:', error);
        // Fallback to individual queries if batch loading fails
        await Promise.all(
          pupilIds.map(async (pupilId) => {
            try {
              const payments = await PaymentsService.getPaymentsByPupil(pupilId);
              paymentsMap.set(pupilId, payments);
            } catch (err) {
              console.error(`Error loading payments for pupil ${pupilId}:`, err);
              paymentsMap.set(pupilId, []);
            }
          })
        );
      }

      return paymentsMap;
    },
    enabled: !!selectedAcademicYear?.id && !!selectedTermId && pupilIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  // 🚀 OPTIMIZED: Load all snapshots in parallel
  const { data: historicalPupilsMap = new Map(), isLoading: isSnapshotsLoading } = useQuery<Map<string, Pupil>>({
    queryKey: ['family-snapshots-batch', selectedTermId, selectedAcademicYear?.id, pupilIds.join(',')],
    queryFn: async () => {
      if (!selectedTermId || !selectedAcademicYear || familyPupils.length === 0) {
        return new Map();
      }

      const snapshotsMap = new Map<string, Pupil>();

      if (process.env.NODE_ENV === 'development') {
        console.log('⚡ Loading snapshots for all pupils in parallel...');
      }

      await Promise.all(
        familyPupils.map(async (pupil) => {
          try {
            const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
              pupil,
              selectedTermId,
              selectedAcademicYear
            );
            const historicalPupil = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);
            snapshotsMap.set(pupil.id, historicalPupil);
          } catch (error) {
            // Fall back to current pupil data if snapshot fails
            snapshotsMap.set(pupil.id, pupil);
          }
        })
      );

      return snapshotsMap;
    },
    enabled: !!selectedTermId && !!selectedAcademicYear && familyPupils.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  // 🚀 OPTIMIZED: Load all fees holidays in parallel
  const { data: feesHolidaysMap = new Map(), isLoading: isHolidaysLoading } = useQuery<Map<string, any[]>>({
    queryKey: ['family-holidays-batch', pupilIds.join(',')],
    queryFn: async () => {
      if (pupilIds.length === 0) {
        return new Map();
      }

      const holidaysMap = new Map<string, any[]>();

      if (process.env.NODE_ENV === 'development') {
        console.log('⚡ Loading fees holidays for all pupils in parallel...');
      }

      await Promise.all(
        pupilIds.map(async (pupilId) => {
          try {
            const holidays = await FeesHolidayService.getActiveFeesHolidaysByPupil(pupilId);
            holidaysMap.set(pupilId, holidays);
          } catch (error) {
            console.error(`Error loading fees holidays for pupil ${pupilId}:`, error);
            holidaysMap.set(pupilId, []);
          }
        })
      );

      return holidaysMap;
    },
    enabled: pupilIds.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  // 🚀 OPTIMIZED: Load all uniform fees in parallel
  const { data: uniformFeesMap = new Map(), isLoading: isUniformFeesLoading } = useQuery<Map<string, any[]>>({
    queryKey: ['family-uniform-fees-batch', selectedTermId, selectedAcademicYear?.id, pupilIds.join(',')],
    queryFn: async () => {
      if (!selectedTermId || !selectedAcademicYear?.id || familyPupils.length === 0) {
        return new Map();
      }

      const uniformMap = new Map<string, any[]>();

      if (process.env.NODE_ENV === 'development') {
        console.log('⚡ Loading uniform fees for all pupils in parallel...');
      }

      await Promise.all(
        familyPupils.map(async (pupil) => {
          try {
            const uniformFees = await UniformFeesIntegrationService.getUniformFeesForPupil(
              pupil.id,
              selectedTermId,
              selectedAcademicYear.id
            );
            uniformMap.set(pupil.id, uniformFees);
          } catch (error) {
            console.error(`Error loading uniform fees for pupil ${pupil.id}:`, error);
            uniformMap.set(pupil.id, []);
          }
        })
      );

      return uniformMap;
    },
    enabled: !!selectedTermId && !!selectedAcademicYear?.id && familyPupils.length > 0,
    staleTime: 7 * 60 * 1000,
    gcTime: 12 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  // Process fees info for all pupils
  const feesInfo = useMemo(() => {
    if (!selectedAcademicYear || !selectedTermId || familyPupils.length === 0) {
      return {};
    }

    // Wait for essential data to load
    if (isFeeStructuresLoading || isPaymentsLoading || isSnapshotsLoading) {
      return {};
    }

    const result: Record<string, FeesInfo> = {};
    const startTime = performance.now();

    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Processing fees for family (OPTIMIZED):', {
        familyId,
        selectedYear: selectedAcademicYear.id,
        selectedTermId,
        familyPupilsCount: familyPupils.length,
        feeStructuresCount: feeStructures.length
      });
    }

    // Process fees for each pupil using pre-loaded data
    for (const pupil of familyPupils) {
      try {
        const applicableFees: FeeWithPayment[] = [];
        let totalFees = 0;
        let totalPaid = 0;
        let lastPayment: FeePayment | null = null;

        // Get pre-loaded data
        const allPayments = allPaymentsMap.get(pupil.id) || [];
        const historicalPupil = historicalPupilsMap.get(pupil.id) || pupil;
        const activeFeesHolidays = feesHolidaysMap.get(pupil.id) || [];
        const uniformFees = uniformFeesMap.get(pupil.id) || [];

        // Get current term fees using filterApplicableFees
        // Use allFeeStructures (full 37) not feeStructures (year-filtered 27).
        // feeStructures excludes universal/assignment fees with no academicYearId.
        // filterApplicableFees handles year/term filtering internally.
        const currentTermFees = filterApplicableFees(
          allFeeStructures,
          historicalPupil,
          selectedTermId,
          selectedAcademicYear,
          academicYears
        );

        // Process fees with payment information
        const processedFees = processPupilFees(
          currentTermFees,
          allPayments,
          allFeeStructures, // Use ALL fee structures for discount lookups
          historicalPupil,
          selectedTermId,
          selectedAcademicYear,
          academicYears,
          activeFeesHolidays
        );

        // Get previous term balances (carry forward) - async operation
        calculatePreviousTermBalances(
          pupil.id,
          selectedTermId,
          selectedAcademicYear,
          academicYears,
          async () => allFeeStructures, // Use ALL fee structures for carry-forward accuracy
          async (pupilId) => allPayments,
          pupil
        ).then(previousBalance => {
          // Add previous term balances if they exist
          if (previousBalance && previousBalance.breakdown) {
            for (const carryForwardItem of previousBalance.breakdown) {
              applicableFees.push({
                feeStructureId: carryForwardItem.feeStructureId ?? '',
                name: carryForwardItem.name,
                amount: carryForwardItem.amount,
                paid: carryForwardItem.paid,
                balance: carryForwardItem.balance,
                lastPayment: null,
                originalAmount: carryForwardItem.amount,
                termId: carryForwardItem.termId ?? '',
                isCurrentTerm: false,
                isCarryForward: true
              });

              totalFees += carryForwardItem.balance;
            }
          }
        });

        // Add current term fees
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
            termId: fee.termId ?? '',
            isCurrentTerm: true,
            isCarryForward: false,
            discount: fee.discount ? {
              amount: fee.discount.amount,
              name: fee.discount.name,
              type: fee.discount.type === 'fees-holiday' ? 'fixed' : fee.discount.type
            } : undefined
          });

          totalFees += fee.amount;
          totalPaid += fee.paid;

          // Track last payment
          if (fee.payments && fee.payments.length > 0) {
            const feeLastPayment = fee.payments[0];
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

        // Process uniform fees
        for (const uniformFee of uniformFees) {
          // Check if uniform fee is from a valid term for this pupil
          if (pupil.registrationDate) {
            const uniformAcademicYear = academicYears.find(year => year.id === uniformFee.academicYearId);
            const uniformTerm = uniformAcademicYear?.terms.find(term => term.id === uniformFee.termId);

            if (uniformTerm && !isTermValidForPupil(uniformTerm, pupil.registrationDate)) {
              continue;
            }
          }

          const isCurrentTermUniform = uniformFee.termId === selectedTermId;
          const hasUniformBalance = uniformFee.balance > 0;

          // Only include uniforms with balance or from current term
          if (isCurrentTermUniform || hasUniformBalance) {
            applicableFees.push({
              feeStructureId: uniformFee.uniformTrackingId,
              name: uniformFee.name,
              amount: uniformFee.amount,
              paid: uniformFee.paid,
              balance: uniformFee.balance,
              lastPayment: null,
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
          if (a.isCurrentTerm && !b.isCurrentTerm) return -1;
          if (!a.isCurrentTerm && b.isCurrentTerm) return 1;
          if (a.isCarryForward && b.isCarryForward) {
            return a.termId.localeCompare(b.termId);
          }
          return 0;
        });

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

    if (process.env.NODE_ENV === 'development') {
      const endTime = performance.now();
      console.log(`✅ Family fees processing complete in ${(endTime - startTime).toFixed(2)}ms:`, Object.keys(result).length, 'pupils processed');
    }

    return result;
  }, [
    familyId,
    familyPupils,
    selectedTermId,
    selectedAcademicYear,
    academicYears,
    feeStructures,
    allFeeStructures,
    allPaymentsMap,
    historicalPupilsMap,
    feesHolidaysMap,
    uniformFeesMap,
    isFeeStructuresLoading,
    isAllFeeStructuresLoading,
    isPaymentsLoading,
    isSnapshotsLoading
  ]);

  const isLoading = isFeeStructuresLoading || isAllFeeStructuresLoading || isPaymentsLoading || isSnapshotsLoading || isHolidaysLoading || isUniformFeesLoading;
  const isError = false;
  const error = null;

  return {
    feesInfo,
    isLoading,
    isError,
    error
  };
}
