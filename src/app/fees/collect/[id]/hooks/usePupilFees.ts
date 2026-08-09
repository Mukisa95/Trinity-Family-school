import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import type {
  AcademicYear,
  Pupil,
  FeeStructure,
  PaymentRecord,
  FeesHoliday,
  UniformTracking,
} from '@/types';
import type { PupilFee, PreviousTermBalance } from '../types';
import type { UniformFeeData } from '@/lib/services/uniform-fees-integration.service';

// Firebase for live listener
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Services
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { UniformFeesIntegrationService } from '@/lib/services/uniform-fees-integration.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import { isTermEnded } from '@/lib/utils/academic-year-utils';

// Optimized hooks
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useFeeAdjustments } from '@/lib/hooks/use-fees';
import { useUniformTrackingByPupil } from '@/lib/hooks/use-uniform-tracking';
import { useUniforms } from '@/lib/hooks/use-uniforms';
import { calculateFeeAmountForAcademicYear } from '@/lib/utils/fee-adjustments';

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
  feesHolidays?: FeesHoliday[];
}

interface UsePupilFeesReturn {
  pupilFees: PupilFee[];
  pupilPayments: PaymentRecord[];
  uniformTrackingRecords: UniformTracking[];
  isUniformTrackingLoading: boolean;
  uniformTrackingError: Error | null;
  allFeeStructures: FeeStructure[]; // All fee structures for modals (redistribute, etc.)
  isLoading: boolean;
  isPaymentDataLoading: boolean; // True when payments or previous balance are still loading
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
  lastPaymentTimestamp,
  feesHolidays = []
}: UsePupilFeesOptions): UsePupilFeesReturn {
  const queryClient = useQueryClient();

  // 🚀 OPTIMIZED: Use the optimized useAcademicYears hook (cache-first, real-time)
  // This is instant if cached, and uses the same data as the component
  const { data: allAcademicYears = [] } = useAcademicYears();
  const { data: feeAdjustments = [] } = useFeeAdjustments();

  // 🔄 FUTURE YEARS FIXED: Fetch fees applicable to the selected year (including ongoing fees from previous years)
  // 🚀 OPTIMIZED: Don't wait for allAcademicYears - fees can load in parallel
  // If academic years aren't ready yet, we'll use a fallback or wait for them in the query function
  const {
    data: currentTermFees = [],
    isLoading: isLoadingCurrentFees,
    refetch: refetchCurrentTermFees,
  } = useQuery({
    queryKey: ['fee-structures-applicable-to-year', selectedAcademicYear?.id, selectedTermId],
    queryFn: async () => {
      if (!selectedTermId || !selectedAcademicYear?.id) {
        // Fallback to active fees if no term/year selected
        const fees = await FeeStructuresService.getActiveFeeStructures();
        if (process.env.NODE_ENV === 'development') {
          console.log('💰 Active Fee Structures (fallback):', fees.length);
        }
        return fees;
      }

      // If academic years aren't loaded yet, wait for them (they should be cached and instant)
      let academicYearsForValidation = allAcademicYears;
      if (academicYearsForValidation.length === 0) {
        // This should rarely happen since useAcademicYears is cache-first
        // But if it does, we can still proceed with just the selected year
        academicYearsForValidation = [selectedAcademicYear];
      }

      // 🔄 CRITICAL FIX: Get fees applicable to this year (not just exact year matches)
      // This includes fees created in previous years that should still apply to this year
      const fees = await FeeStructuresService.getFeeStructuresApplicableToYear(selectedAcademicYear, academicYearsForValidation);
      if (process.env.NODE_ENV === 'development') {
        console.log('💰 Fee Structures Applicable to Year:', {
          selectedYear: selectedAcademicYear.name,
          termId: selectedTermId,
          count: fees.length
        });
      }
      return fees;
    },
    // 🚀 OPTIMIZED: Enable as soon as we have term/year - don't wait for all academic years
    enabled: !!selectedTermId && !!selectedAcademicYear?.id,
    staleTime: 8 * 60 * 1000, // 8 minutes cache - slightly more frequent updates for complex logic
    refetchOnWindowFocus: false, // Cache is fast, no need to refetch
    refetchOnMount: false, // Reuse selected-year fees until explicitly refreshed
  });

  // 🔄 CARRY FORWARD FIX: Fetch ALL fee structures for carry forward calculations
  // 🚀 OPTIMIZED: Load in parallel with other queries, don't block on academic years
  const {
    data: allFeeStructures = [],
    isLoading: isLoadingAllFees,
    refetch: refetchAllFeeStructures,
  } = useQuery({
    queryKey: ['all-fee-structures-for-carryforward'],
    queryFn: async () => {
      const fees = await FeeStructuresService.getAllFeeStructures();
      if (process.env.NODE_ENV === 'development') {
        console.log('💰 ALL Fee Structures (for carry forward):', fees.length);
      }
      return fees;
    },
    // Fee structures rarely change. Keep them fresh until an edit explicitly
    // invalidates this key; the next mounted collection screen then refetches.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const isLoadingFees = isLoadingCurrentFees || isLoadingAllFees;

  // 🔴 LIVE LISTENER: Replace React Query with Firestore onSnapshot for instant updates
  // When SchoolPay records a payment, the UI updates immediately without refresh
  const [pupilPayments, setPupilPayments] = useState<PaymentRecord[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);



  useEffect(() => {
    if (!pupilId) {
      setPupilPayments([]);
      setIsLoadingPayments(false);
      return;
    }

    setIsLoadingPayments(true);
    const paymentsQuery = query(
      collection(db, 'payments'),
      where('pupilId', '==', pupilId)
    );

    const unsubscribe = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        const payments: PaymentRecord[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Handle Firestore Timestamps
          paymentDate: doc.data().paymentDate?.toDate?.()?.toISOString?.() ?? doc.data().paymentDate,
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() ?? doc.data().createdAt,
        })) as PaymentRecord[];
        setPupilPayments(
          payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
        );
        setIsLoadingPayments(false);
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔴 [Live] Payments updated for pupil ${pupilId}:`, payments.length);
        }
      },
      (error) => {
        console.error('[Live] Error listening to payments:', error);
        setIsLoadingPayments(false);
      }
    );

    return () => unsubscribe();
  }, [pupilId]);

  // Calculate previous term balances - OPTIMIZED
  const { data: previousBalance = null, isLoading: isLoadingPreviousBalance } = useQuery<PreviousTermBalance | null>({
    // Updated queryKey to include dependencies that affect the calculation
    queryKey: ['previous-balance', pupilId, selectedTermId, selectedAcademicYear?.id, pupilPayments.length, allFeeStructures.length, lastPaymentTimestamp],
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
    // Only run when we have all necessary data loaded to avoid race conditions
    // We need both payments and fee structures to be fully loaded before calculating
    enabled: !!selectedAcademicYear && !!pupil && !!selectedTermId && !isLoadingPayments && !isLoadingAllFees,
    staleTime: 8 * 60 * 1000, // 8 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes cache
  });

  // One pupil-scoped owner supplies both fee conversion and every fee card.
  // This replaces the former collection query plus one document read per card.
  const {
    data: uniformTrackingRecords = [],
    isLoading: isUniformTrackingLoading,
    error: uniformTrackingError,
  } = useUniformTrackingByPupil(pupilId);
  const { data: allUniforms = [], isLoading: isLoadingUniforms } = useUniforms();

  const uniformFees = useMemo<UniformFeeData[]>(() => {
    if (!selectedTermId || !selectedAcademicYear) return [];

    return UniformFeesIntegrationService.convertTrackingRecordsToFees(
      uniformTrackingRecords,
      allUniforms,
      selectedTermId,
      selectedAcademicYear.id
    );
  }, [uniformTrackingRecords, allUniforms, selectedTermId, selectedAcademicYear?.id]);

  // 🔥 CRITICAL FIX: Fetch historical pupil snapshot for the selected term
  // This ensures we use the pupil's class/section as it was during that term,
  // not their current class/section (which may have changed due to promotion)
  // For ended terms: MUST wait for snapshot - no placeholder data
  // For current/future terms: Can use placeholder data for faster loading
  const selectedTerm = selectedAcademicYear?.terms.find(t => t.id === selectedTermId);
  const termHasEnded = selectedTerm ? isTermEnded(selectedTerm) : false;

  const { data: historicalPupil, isLoading: isLoadingSnapshot } = useQuery<Pupil>({
    queryKey: ['pupil-snapshot', pupilId, selectedTermId, selectedAcademicYear?.id],
    queryFn: async () => {
      if (!pupil || !selectedTermId || !selectedAcademicYear) {
        return pupil!;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📸 Fetching historical snapshot for term:', {
          pupilId,
          termId: selectedTermId,
          academicYear: selectedAcademicYear.name,
          termHasEnded
        });
      }

      // Get or create snapshot for this term
      const snapshot = await PupilSnapshotsService.getSnapshotForRead(
        pupil,
        selectedTermId,
        selectedAcademicYear
      );

      // Create virtual pupil with historical data
      const virtualPupil = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);

      if (process.env.NODE_ENV === 'development') {
        console.log('📸 Historical pupil created', {
          isRealSnapshot: !snapshot.id.startsWith('virtual-'),
          snapshotId: snapshot.id
        });
      }

      return virtualPupil;
    },
    enabled: !!pupil && !!selectedTermId && !!selectedAcademicYear,
    staleTime: 10 * 60 * 1000, // 10 minutes cache for snapshots
    gcTime: 20 * 60 * 1000, // 20 minutes cache
    refetchOnWindowFocus: false, // Cache is fast, no need to refetch
    refetchOnMount: false, // Use cached data on mount
    // 🔥 CRITICAL: For ended terms, don't use placeholder data - must wait for snapshot
    // For current/future terms, can use placeholder for faster loading
    placeholderData: (termHasEnded || !pupil) ? undefined : (pupil ? pupil : undefined),
  });

  // Process pupil fees - OPTIMIZED
  const pupilFees = useMemo(() => {
    // Fast early returns
    if (!selectedAcademicYear || !pupil || !selectedTermId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚡ Early return: Missing required data');
      }
      return [];
    }

    if (currentTermFees.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚡ Early return: No fee structures loaded yet');
      }
      return [];
    }

    // 🚀 OPTIMIZED: Use historical pupil if available, otherwise use current pupil
    // This allows fees to display immediately while snapshot loads in background
    const pupilForFees = historicalPupil || pupil;

    if (!pupilForFees) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚡ Early return: No pupil data available');
      }
      return [];
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Processing fees for:', pupil.firstName, pupil.lastName, {
        usingHistoricalData: historicalPupil && pupil.classId !== historicalPupil.classId
      });
    }

    // 🔥 CRITICAL FIX: Use historical pupil data for fee filtering if available
    // This ensures fees are filtered based on the pupil's class/section during that term
    // Falls back to current pupil if snapshot is still loading
    const applicableFees = filterApplicableFees(
      currentTermFees,
      pupilForFees, // ✅ Use historical pupil if available, otherwise current pupil
      selectedTermId,
      selectedAcademicYear,
      allAcademicYears
    );

    if (process.env.NODE_ENV === 'development') {
      console.log('⚡ Filtered fees:', applicableFees.length);
    }

    // Adjust a copy for the selected academic year. The stored fee structure
    // remains unchanged, so earlier-year balances retain their original rate.
    const adjustedApplicableFees = applicableFees.map(fee => ({
      ...fee,
      amount: calculateFeeAmountForAcademicYear(
        fee.amount,
        fee.id,
        selectedAcademicYear.id,
        allAcademicYears,
        feeAdjustments
      )
    }));

    // Process fees with payment information and fees holidays
    const processedFees = processPupilFees(
      adjustedApplicableFees,
      pupilPayments,
      allFeeStructures,
      pupilForFees, // ✅ Use historical pupil if available, otherwise current pupil
      selectedTermId,
      selectedAcademicYear,
      allAcademicYears,
      feesHolidays // Pass fees holidays to apply discounts
    );

    // Combine all fees efficiently
    const allFees = [...processedFees];

    // Add previous balance if exists
    if (previousBalance && (previousBalance as PreviousTermBalance).amount > 0) {
      // 🔥 CRITICAL FIX: Pass current academic year and term to filter carry forward payments correctly
      // This ensures payments made to carry forward in previous years are not counted when viewing current year
      const previousBalanceFee = createPreviousBalanceFee(
        previousBalance as PreviousTermBalance,
        pupilPayments,
        selectedAcademicYear?.id,
        selectedTermId
      );
      allFees.unshift(previousBalanceFee);
      console.log('⚡ Added previous balance:', (previousBalance as PreviousTermBalance).amount);
    }

    // Add uniform fees — hydrate their payments from the live listener
    if (uniformFees.length > 0) {
      const hydratedUniformFees = uniformFees.map(uf => {
        // Payments are saved with feeStructureId === uf.id (e.g. 'uniform-<trackingId>')
        const matchingPayments = pupilPayments.filter(
          p => p.feeStructureId === uf.id ||
               (p as any).uniformTrackingId === uf.uniformTrackingId
        );
        const totalPaid = matchingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const balance = Math.max(0, uf.amount - totalPaid);
        return {
          ...uf,
          payments: matchingPayments,
          paid: totalPaid,
          balance,
        };
      });
      allFees.push(...hydratedUniformFees);
      console.log('⚡ Added uniform fees:', hydratedUniformFees.length, 'with payments hydrated');
    }


    console.log('✅ Total fees ready:', allFees.length);
    return allFees;
  }, [
    selectedAcademicYear,
    pupil,
    selectedTermId,
    historicalPupil,    // 🔥 CRITICAL: Use historical pupil for correct class-based fee filtering
    currentTermFees,    // 🔄 Updated: use current term fees for regular processing
    feeAdjustments,
    allFeeStructures,   // 🔄 Keep all fees for carry forward calculations
    pupilPayments,
    previousBalance,
    allAcademicYears,
    uniformFees,
    feesHolidays
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

  // 🚀 OPTIMIZED: Don't block on snapshot loading - fees can show with current pupil data
  // Snapshot will update fees when it loads, but we don't need to wait for it
  const isLoading =
    isLoadingFees ||
    isLoadingPayments ||
    isLoadingPreviousBalance ||
    isUniformTrackingLoading ||
    isLoadingUniforms;

  // Track specifically whether payment-related data is loading
  // This is used to disable payment buttons and prevent duplicate payments
  const isPaymentDataLoading = isLoadingPayments || isLoadingPreviousBalance;

  const isError = false; // TODO: Add proper error handling
  const error = null; // TODO: Add proper error handling

  // Refetch function to invalidate all related queries
  const refetch = async () => {
    return await Promise.all([
      refetchCurrentTermFees(),
      refetchAllFeeStructures(),
      queryClient.invalidateQueries({ queryKey: ['pupil-payments', pupilId] }),
      queryClient.invalidateQueries({ queryKey: ['previous-balance', pupilId] }),
      queryClient.invalidateQueries({ queryKey: ['uniformTracking', 'pupil', pupilId] }),
      queryClient.invalidateQueries({ queryKey: ['pupil-snapshot', pupilId] }),
    ]);
  };

  return {
    pupilFees,
    pupilPayments,
    uniformTrackingRecords,
    isUniformTrackingLoading,
    uniformTrackingError,
    allFeeStructures,
    isLoading,
    isPaymentDataLoading,
    isError,
    error,
    refetch,
    previousBalance,
    termTotals,
  };
}
