import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import type {
  AcademicYear,
  Pupil,
  FeeStructure,
  PaymentRecord,
  FeesHoliday,
  UniformTracking,
  PupilTermSnapshot,
} from '@/types';
import type { PupilFee, PreviousTermBalance } from '../types';
import type { UniformFeeData } from '@/lib/services/uniform-fees-integration.service';

// Firebase for live listener
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';

// Services
import { UniformFeesIntegrationService } from '@/lib/services/uniform-fees-integration.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import { isTermEnded } from '@/lib/utils/academic-year-utils';
import { getActiveParentAccountId } from '@/lib/users/parent-account-families';

// Optimized hooks
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useFeeAdjustments, useFeeStructures } from '@/lib/hooks/use-fees';
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
  isFeesHolidaysLoading?: boolean;
  feesHolidaysError?: Error | null;
  pupilDataUpdatedAt?: number;
  feesHolidaysUpdatedAt?: number;
}

interface UsePupilFeesReturn {
  pupilFees: PupilFee[];
  pupilPayments: PaymentRecord[];
  uniformTrackingRecords: UniformTracking[];
  isUniformTrackingLoading: boolean;
  uniformTrackingError: Error | null;
  allFeeStructures: FeeStructure[]; // All fee structures for modals (redistribute, etc.)
  isLoading: boolean;
  isOfflineSnapshotComplete: boolean;
  isPaymentDataLoading: boolean; // True when payments or previous balance are still loading
  isError: boolean;
  error: Error | null;
  addPupilPayments: (payments: PaymentRecord[]) => void;
  refetch: () => Promise<any>;
  previousBalance: PreviousTermBalance | null;
  termTotals: {
    totalFees: number;
    totalPaid: number;
    totalBalance: number;
  };
  activeParentAccountId: string | null;
}

export function mergePupilPayments(
  currentPayments: PaymentRecord[],
  newPayments: PaymentRecord[],
): PaymentRecord[] {
  const paymentsById = new Map(currentPayments.map(payment => [payment.id, payment]));
  newPayments.forEach(payment => paymentsById.set(payment.id, payment));
  return [...paymentsById.values()].sort(
    (left, right) => new Date(right.paymentDate).getTime() - new Date(left.paymentDate).getTime(),
  );
}

export function usePupilFees({
  pupilId,
  pupil,
  selectedTermId,
  selectedAcademicYear,
  lastPaymentTimestamp,
  feesHolidays = [],
  isFeesHolidaysLoading = false,
  feesHolidaysError = null,
  pupilDataUpdatedAt = 0,
  feesHolidaysUpdatedAt = 0,
}: UsePupilFeesOptions): UsePupilFeesReturn {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const paymentCacheKey = useMemo(
    () => ['pupil-payments-live', user?.id || 'anonymous', pupilId] as const,
    [user?.id, pupilId],
  );

  // 🚀 OPTIMIZED: Use the optimized useAcademicYears hook (cache-first, real-time)
  // This is instant if cached, and uses the same data as the component
  const { data: allAcademicYears = [], isLoading: isLoadingYears, isSuccess: hasYears, dataUpdatedAt: yearsUpdatedAt } = useAcademicYears();
  const { data: feeAdjustments = [], isLoading: isLoadingAdjustments, isSuccess: hasFeeAdjustments, error: feeAdjustmentsError } = useFeeAdjustments();

  // One shared catalogue is already owned by the global preloader and Fees
  // Management. Year and term applicability are calculated locally below.
  const {
    data: allFeeStructures = [],
    isLoading: isLoadingAllFees,
    isSuccess: hasAllFees,
    error: feeStructuresError,
    dataUpdatedAt: feeStructuresUpdatedAt,
  } = useFeeStructures();
  const currentTermFees = useMemo(
    () => allFeeStructures.filter(fee => fee.status === 'active'),
    [allFeeStructures],
  );
  const isLoadingFees = isLoadingAllFees;

  // 🔴 LIVE LISTENER: Replace React Query with Firestore onSnapshot for instant updates
  // When SchoolPay records a payment, the UI updates immediately without refresh
  const [pupilPayments, setPupilPayments] = useState<PaymentRecord[]>(
    () => queryClient.getQueryData<PaymentRecord[]>(paymentCacheKey) ?? [],
  );
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [paymentRevision, setPaymentRevision] = useState(0);
  const [paymentListenerError, setPaymentListenerError] = useState<Error | null>(null);
  const [hasServerPaymentSnapshot, setHasServerPaymentSnapshot] = useState(false);
  const locallyCommittedPayments = useRef(new Map<string, PaymentRecord>());
  const confirmedPaymentIds = useRef(new Set<string>());

  const syncFamilyPaymentCache = useCallback((payments: PaymentRecord[], replace: boolean) => {
    queryClient.setQueriesData<Map<string, PaymentRecord[]>>(
      { queryKey: ['family-payments-all'] },
      current => {
        if (!current?.has(pupilId)) return current;
        const next = new Map(current);
        next.set(pupilId, replace
          ? payments
          : mergePupilPayments(current.get(pupilId) ?? [], payments));
        return next;
      },
    );
  }, [pupilId, queryClient]);

  // The Firestore listener owns the payment list displayed by this page. Keep
  // locally committed records in that same owner until the listener confirms
  // them, rather than writing to an unrelated React Query key.
  const addPupilPayments = useCallback((payments: PaymentRecord[]) => {
    const scopedPayments = payments.filter(payment => payment.pupilId === pupilId);
    scopedPayments.forEach(payment => {
      if (!confirmedPaymentIds.current.has(payment.id)) {
        locallyCommittedPayments.current.set(payment.id, payment);
      }
    });
    if (locallyCommittedPayments.current.size > 0) setIsLoadingPayments(true);
    if (scopedPayments.length > 0) setPaymentRevision(revision => revision + 1);
    if (scopedPayments.length > 0) syncFamilyPaymentCache(scopedPayments, false);
    queryClient.setQueryData(paymentCacheKey, mergePupilPayments(
      queryClient.getQueryData<PaymentRecord[]>(paymentCacheKey) ?? [], scopedPayments,
    ));
    setPupilPayments(currentPayments => {
      // A listener may arrive before the HTTP response; preserve its canonical
      // record (including reversals and receipt metadata) over the local copy.
      const knownIds = new Set(currentPayments.map(payment => payment.id));
      return mergePupilPayments(currentPayments, scopedPayments.filter(payment => !knownIds.has(payment.id)));
    });
  }, [pupilId, paymentCacheKey, queryClient, syncFamilyPaymentCache]);

  const sortPupilPayments = useCallback((payments: PaymentRecord[]) => (
    [...payments].sort(
      (left, right) => new Date(right.paymentDate).getTime() - new Date(left.paymentDate).getTime(),
    )
  ), []);



  useEffect(() => {
    locallyCommittedPayments.current.clear();
    confirmedPaymentIds.current.clear();
    setHasServerPaymentSnapshot(false);
    setPupilPayments(queryClient.getQueryData<PaymentRecord[]>(paymentCacheKey) ?? []);
    if (!pupilId) {
      setPupilPayments([]);
      setIsLoadingPayments(false);
      return;
    }

    setIsLoadingPayments(true);
    setPaymentListenerError(null);
    const paymentsQuery = query(
      collection(db, 'payments'),
      where('pupilId', '==', pupilId)
    );

    const unsubscribe = onSnapshot(
      paymentsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const payments: PaymentRecord[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Handle Firestore Timestamps
          paymentDate: doc.data().paymentDate?.toDate?.()?.toISOString?.() ?? doc.data().paymentDate,
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() ?? doc.data().createdAt,
        })) as PaymentRecord[];
        if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
          setHasServerPaymentSnapshot(true);
          confirmedPaymentIds.current = new Set(payments.map(payment => payment.id));
          payments.forEach(payment => locallyCommittedPayments.current.delete(payment.id));
          syncFamilyPaymentCache(payments, true);
        }
        const merged = sortPupilPayments(mergePupilPayments(
          [...locallyCommittedPayments.current.values()], payments,
        ));
        queryClient.setQueryData(paymentCacheKey, merged);
        setPupilPayments(merged);
        if (snapshot.docChanges().length > 0) setPaymentRevision(revision => revision + 1);
        setIsLoadingPayments(
          snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites ||
          locallyCommittedPayments.current.size > 0,
        );
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔴 [Live] Payments updated for pupil ${pupilId}:`, payments.length);
        }
      },
      (error) => {
        console.error('[Live] Error listening to payments:', error);
        setPaymentListenerError(error);
        setIsLoadingPayments(false);
      }
    );

    return () => unsubscribe();
  }, [pupilId, paymentCacheKey, queryClient, sortPupilPayments, syncFamilyPaymentCache]);

  // One pupil-scoped owner supplies both fee conversion and every fee card.
  // This replaces the former collection query plus one document read per card.
  const {
    data: uniformTrackingRecords = [],
    isLoading: isUniformTrackingLoading,
    isSuccess: hasUniformTracking,
    error: uniformTrackingError,
    dataUpdatedAt: uniformTrackingUpdatedAt,
  } = useUniformTrackingByPupil(pupilId);
  const {
    data: allUniforms = [], isLoading: isLoadingUniforms, isSuccess: hasUniforms,
    error: uniformsError, dataUpdatedAt: uniformsUpdatedAt,
  } = useUniforms();

  const allUniformFees = useMemo<UniformFeeData[]>(
    () => UniformFeesIntegrationService.convertTrackingRecordsToFees(uniformTrackingRecords, allUniforms),
    [uniformTrackingRecords, allUniforms],
  );

  const uniformFees = useMemo<UniformFeeData[]>(() => {
    if (!selectedTermId || !selectedAcademicYear) return [];
    return allUniformFees.filter(fee =>
      fee.uniformTrackingRecord.termId === selectedTermId &&
      fee.uniformTrackingRecord.academicYearId === selectedAcademicYear.id
    );
  }, [allUniformFees, selectedTermId, selectedAcademicYear?.id]);

  const getHistoricalSnapshot = useCallback((
    targetPupil: Pupil,
    termId: string,
    academicYear: AcademicYear,
  ): Promise<PupilTermSnapshot> => queryClient.fetchQuery({
    queryKey: [
      'pupil-snapshot', targetPupil.id, termId, academicYear.id, 'raw',
      ...(academicYear.terms.some(term => term.id === termId && isTermEnded(term))
        ? [] : [targetPupil.classId, targetPupil.section]),
    ],
    queryFn: async () => {
      const snapshot = await PupilSnapshotsService.getSnapshotForRead(targetPupil, termId, academicYear);
      if (snapshot.id.startsWith('virtual-missing-history')) {
        throw new Error(`Historical class information for ${academicYear.name} ${termId} needs review.`);
      }
      return snapshot;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  }), [queryClient]);

  // Carry forward reuses the page's holidays, uniform tracking and uniform
  // catalogue. Its only possible network reads are uncached historical terms.
  const {
    data: previousBalance = null,
    isLoading: isLoadingPreviousBalance,
    isSuccess: hasPreviousBalance,
    error: previousBalanceError,
  } = useQuery<PreviousTermBalance | null>({
    queryKey: [
      'previous-balance', pupilId, selectedTermId, selectedAcademicYear?.id,
      paymentRevision, feeStructuresUpdatedAt, pupilDataUpdatedAt,
      yearsUpdatedAt, feesHolidaysUpdatedAt, uniformTrackingUpdatedAt,
      uniformsUpdatedAt, lastPaymentTimestamp,
    ],
    queryFn: async (): Promise<PreviousTermBalance | null> => {
      if (!selectedAcademicYear || !pupil) return null;
      return calculatePreviousTermBalances(
        pupilId,
        selectedTermId,
        selectedAcademicYear,
        allAcademicYears,
        async () => allFeeStructures,
        async () => pupilPayments,
        pupil,
        { feesHolidays, uniformFees: allUniformFees, getHistoricalSnapshot, throwOnError: true },
      );
    },
    enabled: !!selectedAcademicYear && !!pupil && !!selectedTermId &&
      !isLoadingPayments && !isLoadingAllFees && !isLoadingUniforms &&
      !isUniformTrackingLoading && !isFeesHolidaysLoading && !feesHolidaysError,
    staleTime: 8 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // 🔥 CRITICAL FIX: Fetch historical pupil snapshot for the selected term
  // This ensures we use the pupil's class/section as it was during that term,
  // not their current class/section (which may have changed due to promotion)
  // For ended terms: MUST wait for snapshot - no placeholder data
  // For current/future terms: Can use placeholder data for faster loading
  const selectedTerm = selectedAcademicYear?.terms.find(t => t.id === selectedTermId);
  const termHasEnded = selectedTerm ? isTermEnded(selectedTerm) : false;

  const {
    data: historicalPupil,
    isLoading: isLoadingSnapshot,
    isSuccess: hasHistoricalPupil,
    isPlaceholderData: isSnapshotPlaceholder,
    error: snapshotError,
  } = useQuery<Pupil>({
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
      const snapshot = await getHistoricalSnapshot(
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

    // The page waits for its required inputs before showing totals. Do not
    // suppress uniforms or carry-forward when there are no regular school fees.
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
    // The current pupil is only used as a placeholder for an unended term.
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
    isLoadingYears ||
    isLoadingFees ||
    isLoadingAdjustments ||
    isLoadingPayments ||
    isLoadingPreviousBalance ||
    isLoadingSnapshot ||
    isUniformTrackingLoading ||
    isLoadingUniforms ||
    isFeesHolidaysLoading;

  // Track specifically whether payment-related data is loading
  // This is used to disable payment buttons and prevent duplicate payments
  const isPaymentDataLoading = isLoading || !!paymentListenerError || !!previousBalanceError;

  // Offline snapshots require a confirmed server ledger and every input to be
  // complete; an in-memory placeholder must never become a saved balance.
  const isOfflineSnapshotComplete = Boolean(pupil) && hasYears && hasAllFees &&
    hasFeeAdjustments && hasServerPaymentSnapshot && hasPreviousBalance &&
    hasUniformTracking && hasUniforms && hasHistoricalPupil &&
    !isSnapshotPlaceholder && !isLoading && !paymentListenerError &&
    !previousBalanceError && !feesHolidaysError && !feeStructuresError &&
    !uniformTrackingError && !uniformsError;

  const error = paymentListenerError || feeStructuresError || feeAdjustmentsError ||
    previousBalanceError || snapshotError || uniformTrackingError || uniformsError ||
    feesHolidaysError || null;
  const isError = !!error;
  // The pupil record is already loaded when this page mounts. Reading this
  // marker locally avoids a parent-account lookup or listener for pupils that
  // do not have an active account.
  const activeParentAccountId = pupil ? getActiveParentAccountId(pupil) : null;

  // Reserved for explicit changes to fee definitions, assignments, or history.
  // Payment writes are already reflected by the live listener.
  const refetch = async () => {
    return await Promise.all([
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
    isOfflineSnapshotComplete,
    isPaymentDataLoading,
    isError,
    error,
    addPupilPayments,
    refetch,
    previousBalance,
    termTotals,
    activeParentAccountId,
  };
}
