import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { AcademicYear, Pupil, FeeStructure, PaymentRecord } from '@/types';
import type { PupilFee, PreviousTermBalance } from '../types';
import type { UniformFeeData } from '@/lib/services/uniform-fees-integration.service';

// Services
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { PaymentsService } from '@/lib/services/payments.service';
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { UniformFeesIntegrationService } from '@/lib/services/uniform-fees-integration.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';

// Utilities
import {
  filterApplicableFees,
  processPupilFees,
  calculatePreviousTermBalances,
  createPreviousBalanceFee,
  isValidTermForAcademicYear
} from '../utils/feeProcessing';

interface UsePupilFeesOptions {
  pupilId: string;
  pupil: Pupil | undefined;
  selectedTermId: string;
  selectedAcademicYear: AcademicYear | null;
  lastPaymentTimestamp: number;
}

interface UsePupilFeesReturn {
  pupilFees: PupilFee[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<any>;
  previousBalance: PreviousTermBalance | null;
  termTotals: {
    totalFees: number;
    totalPaid: number;
    totalBalance: number;
  };
}

export function usePupilFees({
  pupilId,
  pupil,
  selectedTermId,
  selectedAcademicYear,
  lastPaymentTimestamp
}: UsePupilFeesOptions): UsePupilFeesReturn {
  const queryClient = useQueryClient();

  // Fetch all academic years FIRST (needed for fee year validation) - OPTIMIZED
  const { data: allAcademicYears = [] } = useQuery<AcademicYear[]>({
    queryKey: ['academic-years'],
    queryFn: async (): Promise<AcademicYear[]> => {
      console.log('📅 Fetching academic years...');
      const years = await AcademicYearsService.getAllAcademicYears();
      console.log('✅ Academic years loaded:', years.length);
      return years;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - longer cache for academic years
    gcTime: 30 * 60 * 1000, // 30 minutes cache (renamed from cacheTime in v5)
  });

  // 🔄 FUTURE YEARS FIXED: Fetch fees applicable to the selected year (including ongoing fees from previous years)
  const { data: currentTermFees = [], isLoading: isLoadingCurrentFees } = useQuery({
    queryKey: ['fee-structures-applicable-to-year', selectedAcademicYear?.id, selectedTermId],
    queryFn: async () => {
      if (!selectedTermId || !selectedAcademicYear?.id) {
        // Fallback to active fees if no term/year selected
        const fees = await FeeStructuresService.getActiveFeeStructures();
        console.log('💰 Active Fee Structures (fallback):', fees.length);
        return fees;
      }
      
      // 🔄 CRITICAL FIX: Get fees applicable to this year (not just exact year matches)
      // This includes fees created in previous years that should still apply to this year
      const fees = await FeeStructuresService.getFeeStructuresApplicableToYear(selectedAcademicYear, allAcademicYears);
      console.log('💰 Fee Structures Applicable to Year:', {
        selectedYear: selectedAcademicYear.name,
        termId: selectedTermId,
        count: fees.length,
        byCategory: fees.reduce((acc: any, f) => {
          acc[f.category] = (acc[f.category] || 0) + 1;
          return acc;
        }, {})
      });
      return fees;
    },
    enabled: !!selectedTermId && !!selectedAcademicYear?.id && allAcademicYears.length > 0,
    staleTime: 8 * 60 * 1000, // 8 minutes cache - slightly more frequent updates for complex logic
  });

  // 🔄 CARRY FORWARD FIX: Fetch ALL fee structures for carry forward calculations
  const { data: allFeeStructures = [], isLoading: isLoadingAllFees } = useQuery({
    queryKey: ['all-fee-structures-for-carryforward'],
    queryFn: async () => {
      const fees = await FeeStructuresService.getAllFeeStructures();
      console.log('💰 ALL Fee Structures (for carry forward):', fees.length);
      return fees;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes cache - needed less frequently
  });

  const isLoadingFees = isLoadingCurrentFees || isLoadingAllFees;

  // 🚀 OPTIMIZED: Fetch payments for pupil - single query with longer cache
  const { data: pupilPayments = [], isLoading: isLoadingPayments } = useQuery<PaymentRecord[]>({
    queryKey: ['pupil-payments-all', pupilId, lastPaymentTimestamp],
    queryFn: async (): Promise<PaymentRecord[]> => {
      console.log('💳 Fetching payments for pupil:', pupilId);
      const payments = await PaymentsService.getPaymentsByPupil(pupilId);
      console.log('✅ Payments loaded:', payments.length);
      return payments;
    },
    enabled: !!pupilId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache - balance between freshness and performance
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });

  // Calculate previous term balances - OPTIMIZED
  const { data: previousBalance = null, isLoading: isLoadingPreviousBalance } = useQuery<PreviousTermBalance | null>({
    queryKey: ['previous-balance', pupilId, selectedTermId, selectedAcademicYear?.id],
    queryFn: async (): Promise<PreviousTermBalance | null> => {
      if (!selectedAcademicYear || !pupil) {
        console.log('⚡ Previous balance: Early return - missing data');
        return null;
      }
      
      console.log('💰 Calculating previous term balances...');
      const result = await calculatePreviousTermBalances(
        pupilId,
        selectedTermId,
        selectedAcademicYear,
        allAcademicYears,
        async () => allFeeStructures,
        async (pupilId: string) => pupilPayments,
        pupil
      );
      console.log('✅ Previous balance calculated:', result?.amount || 0);
      return result;
    },
    enabled: !!selectedAcademicYear && !!pupil && !!selectedTermId && allFeeStructures.length >= 0,
    staleTime: 8 * 60 * 1000, // 8 minutes cache - carry forward changes less frequently
    gcTime: 15 * 60 * 1000, // 15 minutes cache
  });

  // Fetch uniform fees for the pupil - OPTIMIZED
  const { data: uniformFees = [], isLoading: isLoadingUniformFees } = useQuery<UniformFeeData[]>({
    queryKey: ['uniform-fees', pupilId, selectedTermId, selectedAcademicYear?.id, lastPaymentTimestamp],
    queryFn: async (): Promise<UniformFeeData[]> => {
      if (!pupilId || !selectedTermId || !selectedAcademicYear) {
        console.log('⚡ Uniform fees: Early return - missing data');
        return [];
      }
      
      console.log('👕 Fetching uniform fees...');
      const fees = await UniformFeesIntegrationService.getUniformFeesForPupil(
        pupilId, 
        selectedTermId, 
        selectedAcademicYear.id
      );
      console.log('✅ Uniform fees loaded:', fees.length);
      return fees;
    },
    enabled: !!pupilId && !!selectedTermId && !!selectedAcademicYear,
    staleTime: 7 * 60 * 1000, // 7 minutes cache for uniform fees
    gcTime: 12 * 60 * 1000, // 12 minutes cache
  });

  // 🔥 CRITICAL FIX: Fetch historical pupil snapshot for the selected term
  // This ensures we use the pupil's class/section as it was during that term,
  // not their current class/section (which may have changed due to promotion)
  const { data: historicalPupil, isLoading: isLoadingSnapshot } = useQuery<Pupil>({
    queryKey: ['pupil-snapshot', pupilId, selectedTermId, selectedAcademicYear?.id],
    queryFn: async () => {
      if (!pupil || !selectedTermId || !selectedAcademicYear) {
        return pupil!;
      }
      
      console.log('📸 Fetching historical snapshot for term:', {
        pupilId,
        termId: selectedTermId,
        academicYear: selectedAcademicYear.name,
        currentClass: pupil.classId,
        currentSection: pupil.section
      });
      
      // Get or create snapshot for this term
      const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
        pupil,
        selectedTermId,
        selectedAcademicYear
      );
      
      // Create virtual pupil with historical data
      const virtualPupil = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);
      
      console.log('📸 Historical pupil created:', {
        snapshotClass: snapshot.classId,
        snapshotSection: snapshot.section,
        virtualPupilClass: virtualPupil.classId,
        virtualPupilSection: virtualPupil.section
      });
      
      return virtualPupil;
    },
    enabled: !!pupil && !!selectedTermId && !!selectedAcademicYear,
    staleTime: 10 * 60 * 1000, // 10 minutes cache for snapshots
    gcTime: 20 * 60 * 1000, // 20 minutes cache
  });

  // Process pupil fees - OPTIMIZED
  const pupilFees = useMemo(() => {
    // Fast early returns
    if (!selectedAcademicYear || !pupil || !selectedTermId) {
      console.log('⚡ Early return: Missing required data');
      return [];
    }

    if (currentTermFees.length === 0) {
      console.log('⚡ Early return: No fee structures loaded yet');
      return [];
    }

    // Wait for historical pupil to load
    if (!historicalPupil) {
      console.log('⚡ Early return: Waiting for historical snapshot...');
      return [];
    }

    console.log('🚀 Processing fees for:', pupil.firstName, pupil.lastName, {
      currentClass: pupil.classId,
      historicalClass: historicalPupil.classId,
      usingHistoricalData: pupil.classId !== historicalPupil.classId
    });

    // 🔥 CRITICAL FIX: Use historical pupil data for fee filtering
    // This ensures fees are filtered based on the pupil's class/section during that term
    const applicableFees = filterApplicableFees(
      currentTermFees,
      historicalPupil, // ✅ Use historical pupil instead of current pupil
      selectedTermId,
      selectedAcademicYear,
      allAcademicYears
    );

    console.log('⚡ Filtered fees:', applicableFees.length);

    // Process fees with payment information
    const processedFees = processPupilFees(
      applicableFees,
      pupilPayments,
      allFeeStructures,
      historicalPupil, // ✅ Use historical pupil instead of current pupil
      selectedTermId,
      selectedAcademicYear,
      allAcademicYears
    );

    console.log('⚡ Processed fees:', processedFees.length);

    // Combine all fees efficiently
    const allFees = [...processedFees];
    
    // Add previous balance if exists
    if (previousBalance && (previousBalance as PreviousTermBalance).amount > 0) {
      const previousBalanceFee = createPreviousBalanceFee(previousBalance as PreviousTermBalance, pupilPayments);
      allFees.unshift(previousBalanceFee);
      console.log('⚡ Added previous balance:', (previousBalance as PreviousTermBalance).amount);
    }

    // Add uniform fees
    if (uniformFees.length > 0) {
      allFees.push(...uniformFees);
      console.log('⚡ Added uniform fees:', uniformFees.length);
    }

    console.log('✅ Total fees ready:', allFees.length);
    return allFees;
  }, [
    selectedAcademicYear,
    pupil,
    selectedTermId,
    historicalPupil,    // 🔥 CRITICAL: Use historical pupil for correct class-based fee filtering
    currentTermFees,    // 🔄 Updated: use current term fees for regular processing
    allFeeStructures,   // 🔄 Keep all fees for carry forward calculations
    pupilPayments,
    previousBalance,
    allAcademicYears,
    uniformFees
  ]);

  // Calculate term totals
  const termTotals = useMemo(() => {
    const totalFees = pupilFees.reduce((total, fee) => total + (fee.amount || 0), 0);
    const totalPaid = pupilFees.reduce((total, fee) => total + (fee.paid || 0), 0);
    const totalBalance = pupilFees.reduce((total, fee) => total + (fee.balance || 0), 0);

    return {
      totalFees,
      totalPaid,
      totalBalance
    };
  }, [pupilFees]);

  const isLoading = isLoadingFees || isLoadingPayments || isLoadingPreviousBalance || isLoadingUniformFees || isLoadingSnapshot;
  const isError = false; // TODO: Add proper error handling
  const error = null; // TODO: Add proper error handling

  // Refetch function to invalidate all related queries
  const refetch = async () => {
    return await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] }),
      queryClient.invalidateQueries({ queryKey: ['pupil-payments', pupilId] }),
      queryClient.invalidateQueries({ queryKey: ['previous-balance', pupilId] }),
      queryClient.invalidateQueries({ queryKey: ['uniform-fees', pupilId] }),
      queryClient.invalidateQueries({ queryKey: ['pupil-snapshot', pupilId] }),
    ]);
  };

  return {
    pupilFees,
    isLoading,
    isError,
    error,
    refetch,
    previousBalance,
    termTotals,
  };
}