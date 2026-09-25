import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { AcademicYear, Pupil, PaymentRecord } from '@/types';
import { useFeeStructures } from '@/lib/hooks/use-fees';
import { useUniforms } from '@/lib/hooks/use-uniforms';

// Services
import { PaymentsService } from '@/lib/services/payments.service';
import { UniformFeesIntegrationService, type UniformFeeData } from '@/lib/services/uniform-fees-integration.service';
import { UniformTrackingService } from '@/lib/services/uniform-tracking.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import { FeesHolidayService } from '@/lib/services/fees-holiday.service';
import { isTermEnded } from '@/lib/utils/academic-year-utils';

// Utilities
import {
    filterApplicableFees,
    isPupilFeesActiveForTerm,
    processPupilFees,
    calculatePreviousTermBalances
} from '../../../collect/[id]/utils/feeProcessing';
import { isTermValidForPupil } from '../../../collect/[id]/utils/feeProcessing';

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
    uniformTrackingId?: string;
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
    academicYearsUpdatedAt: number;
    familyPupilsUpdatedAt: number;
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
    academicYears,
    academicYearsUpdatedAt,
    familyPupilsUpdatedAt,
}: UseFamilyFeesOptions): UseFamilyFeesReturn {
    const queryClient = useQueryClient();

    // Reuse the shared fee-structure cache used by Fees Management. The
    // previous two local queries both read the complete collection, making a
    // family page cold start wait for duplicate work.
    const { data: allFeeStructures = [], isLoading: isAllFeeStructuresLoading, error: feeStructuresError, dataUpdatedAt: feesUpdatedAt } = useFeeStructures();
    const { data: allUniforms = [], isLoading: isAllUniformsLoading, error: uniformsError, dataUpdatedAt: uniformsUpdatedAt } = useUniforms();

    // 🚀 OPTIMIZED: Batch load ALL payments for the term in ONE query
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const pupilIds = useMemo(() => familyPupils.map(p => p.id), [familyPupils]);

    const { data: allPaymentsMap = new Map(), isLoading: isPaymentsLoading, error: paymentError, dataUpdatedAt: paymentsUpdatedAt } = useQuery<Map<string, PaymentRecord[]>>({
        queryKey: ['family-payments-all', pupilIds.join(',')],
        queryFn: async () => {
            if (pupilIds.length === 0) {
                return new Map();
            }

            return PaymentsService.getPaymentsByPupilIds(pupilIds);
        },
        enabled: pupilIds.length > 0,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });

    // 🚀 OPTIMIZED: Load all snapshots, holidays, and uniform fees in parallel
    const { data: historicalPupilsMap = new Map(), isLoading: isSnapshotsLoading, error: snapshotsError } = useQuery<Map<string, Pupil>>({
        queryKey: ['family-snapshots-batch', selectedTermId, selectedAcademicYear?.id, pupilIds.join(',')],
        queryFn: async () => {
            if (!selectedTermId || !selectedAcademicYear || familyPupils.length === 0) return new Map();

            const snapshotsMap = new Map<string, Pupil>();
            await Promise.all(
                familyPupils.map(async (pupil) => {
                    const selectedTerm = selectedAcademicYear.terms.find(term => term.id === selectedTermId);
                    const snapshot = await queryClient.fetchQuery({
                        queryKey: ['pupil-snapshot', pupil.id, selectedTermId, selectedAcademicYear.id, 'raw',
                            ...(selectedTerm && isTermEnded(selectedTerm) ? [] : [pupil.classId, pupil.section])],
                        queryFn: async () => {
                            const result = await PupilSnapshotsService.getSnapshotForRead(pupil, selectedTermId, selectedAcademicYear);
                            if (result.id.startsWith('virtual-missing-history')) {
                                throw new Error(`Historical class information for ${pupil.firstName} needs review.`);
                            }
                            return result;
                        },
                        staleTime: 10 * 60 * 1000,
                    });
                    snapshotsMap.set(pupil.id, PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot));
                })
            );
            return snapshotsMap;
        },
        enabled: !!selectedTermId && !!selectedAcademicYear && familyPupils.length > 0,
        staleTime: 10 * 60 * 1000,
        gcTime: 20 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });

    const { data: feesHolidaysMap = new Map(), isLoading: isHolidaysLoading, error: holidaysError, dataUpdatedAt: holidaysUpdatedAt } = useQuery<Map<string, any[]>>({
        queryKey: ['family-holidays-batch', pupilIds.join(',')],
        queryFn: async () => {
            if (pupilIds.length === 0) return new Map();
            const holidaysMap = new Map<string, any[]>();
            await Promise.all(
                pupilIds.map(async (pupilId) => {
                    const holidays = await FeesHolidayService.getActiveFeesHolidaysByPupil(pupilId);
                    holidaysMap.set(pupilId, holidays);
                })
            );
            return holidaysMap;
        },
        enabled: pupilIds.length > 0,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });

    const { data: uniformFeesMap = new Map<string, UniformFeeData[]>(), isLoading: isUniformFeesLoading, error: uniformFeesError, dataUpdatedAt: uniformFeesUpdatedAt } = useQuery<Map<string, UniformFeeData[]>>({
        queryKey: ['family-uniform-fees-batch', pupilIds.join(','), uniformsUpdatedAt],
        queryFn: async () => {
            if (familyPupils.length === 0) return new Map();
            const uniformMap = new Map<string, UniformFeeData[]>();
            await Promise.all(
                familyPupils.map(async (pupil) => {
                    const records = await UniformTrackingService.getTrackingRecordsByPupil(pupil.id);
                    uniformMap.set(pupil.id, UniformFeesIntegrationService.convertTrackingRecordsToFees(records, allUniforms));
                })
            );
            return uniformMap;
        },
        enabled: familyPupils.length > 0 && !isAllUniformsLoading && !uniformsError,
        staleTime: 7 * 60 * 1000,
        gcTime: 12 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });

    // Reuse the data already fetched for the family cards. Historical snapshots
    // share the pupil page's cache; switching terms need not reread holidays,
    // uniform tracking or the uniform catalogue.
    const { data: previousBalancesMap = new Map(), isLoading: isPreviousBalancesLoading, error: previousBalancesError } = useQuery<Map<string, any>>({
        queryKey: ['family-previous-balances', selectedAcademicYear?.id, selectedTermId,
            pupilIds.join(','), paymentsUpdatedAt, feesUpdatedAt, holidaysUpdatedAt,
            uniformFeesUpdatedAt, familyPupilsUpdatedAt, academicYearsUpdatedAt],
        queryFn: async () => {
            if (!selectedAcademicYear || !selectedTermId) return new Map();
            const balances = await Promise.all(familyPupils.map(async pupil => {
                const balance = await calculatePreviousTermBalances(
                    pupil.id, selectedTermId, selectedAcademicYear, academicYears,
                    async () => allFeeStructures,
                    async () => allPaymentsMap.get(pupil.id) || [],
                    pupil,
                    {
                        feesHolidays: feesHolidaysMap.get(pupil.id) || [],
                        uniformFees: uniformFeesMap.get(pupil.id) || [],
                        throwOnError: true,
                        getHistoricalSnapshot: (targetPupil, termId, academicYear) => queryClient.fetchQuery({
                            queryKey: ['pupil-snapshot', targetPupil.id, termId, academicYear.id, 'raw',
                                ...(academicYear.terms.some(term => term.id === termId && isTermEnded(term))
                                    ? [] : [targetPupil.classId, targetPupil.section])],
                            queryFn: async () => {
                                const snapshot = await PupilSnapshotsService.getSnapshotForRead(targetPupil, termId, academicYear);
                                if (snapshot.id.startsWith('virtual-missing-history')) {
                                    throw new Error(`Historical class information for ${targetPupil.firstName} needs review.`);
                                }
                                return snapshot;
                            },
                            staleTime: 10 * 60 * 1000,
                        }),
                    },
                );
                return [pupil.id, balance] as const;
            }));
            return new Map(balances);
        },
        enabled: !!selectedAcademicYear && !!selectedTermId && pupilIds.length > 0 &&
            !isPaymentsLoading && !paymentError && !isAllFeeStructuresLoading && !feeStructuresError &&
            !isHolidaysLoading && !holidaysError && !isUniformFeesLoading && !uniformFeesError,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });

    // Process fees info for all pupils
    const { feesInfo, processingError } = useMemo<{ feesInfo: Record<string, FeesInfo>; processingError: Error | null }>(() => {
        if (!selectedAcademicYear || !selectedTermId || familyPupils.length === 0) return { feesInfo: {}, processingError: null };
        // Current-term fees can be shown as soon as their direct inputs are
        // ready. Carry-forward balances are added when their slower historical
        // calculation completes instead of holding the whole family page back.
        if (isAllFeeStructuresLoading || isPaymentsLoading || isSnapshotsLoading ||
            isHolidaysLoading || isUniformFeesLoading || isPreviousBalancesLoading ||
            paymentError || feeStructuresError || snapshotsError || holidaysError ||
            uniformsError || uniformFeesError || previousBalancesError) return { feesInfo: {}, processingError: null };

        const result: Record<string, FeesInfo> = {};
        let processingError: Error | null = null;

        for (const pupil of familyPupils) {
            try {
                const applicableFees: FeeWithPayment[] = [];
                let totalFees = 0;
                let totalPaid = 0;
                let lastPayment: FeePayment | null = null;
                const selectedTerm = selectedAcademicYear.terms.find(t => t.id === selectedTermId);

                if (selectedTerm && !isPupilFeesActiveForTerm(pupil, selectedTerm)) {
                    result[pupil.id] = {
                        type: 'total',
                        totalFees: 0,
                        totalPaid: 0,
                        balance: 0,
                        lastPayment: null,
                        applicableFees: []
                    };
                    continue;
                }

                const allPayments = allPaymentsMap.get(pupil.id) || [];
                const historicalPupil = historicalPupilsMap.get(pupil.id) || pupil;
                const activeFeesHolidays = feesHolidaysMap.get(pupil.id) || [];
                const uniformFees = (uniformFeesMap.get(pupil.id) || []).filter(
                    fee => fee.termId === selectedTermId && fee.academicYearId === selectedAcademicYear.id
                );

                // Use allFeeStructures (full set) not feeStructures (year-filtered).
                // feeStructures excludes universal/assignment fees with no academicYearId.
                // filterApplicableFees handles year/term filtering internally.
                const currentTermFees = filterApplicableFees(
                    allFeeStructures, historicalPupil, selectedTermId, selectedAcademicYear, academicYears
                );

                const processedFees = processPupilFees(
                    currentTermFees, allPayments, allFeeStructures, historicalPupil,
                    selectedTermId, selectedAcademicYear, academicYears, activeFeesHolidays
                );

                // Process current term fees
                for (const fee of processedFees) {
                    applicableFees.push({
                        feeStructureId: fee.id,
                        name: fee.name,
                        amount: fee.amount,
                        paid: fee.paid,
                        balance: fee.balance,
                        lastPayment: fee.payments?.[0] ? {
                            id: fee.payments[0].id,
                            amount: fee.payments[0].amount,
                            paymentDate: fee.payments[0].paymentDate,
                            balance: fee.payments[0].balance || 0,
                            paidBy: fee.payments[0].paidBy ? { name: fee.payments[0].paidBy.name } : undefined,
                            term: selectedTermId,
                            academicYear: selectedAcademicYear.name || '',
                            feeStructureId: fee.payments[0].feeStructureId
                        } : null,
                        originalAmount: fee.originalAmount || fee.amount,
                        termId: fee.termId ?? '',
                        academicYearId: fee.academicYearId,
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

                    if (fee.payments?.[0]) {
                        const feeLastPayment = fee.payments[0];
                        if (!lastPayment || new Date(feeLastPayment.paymentDate) > new Date(lastPayment.paymentDate)) {
                            lastPayment = {
                                id: feeLastPayment.id,
                                amount: feeLastPayment.amount,
                                paymentDate: feeLastPayment.paymentDate,
                                balance: feeLastPayment.balance || 0,
                                paidBy: feeLastPayment.paidBy ? { name: feeLastPayment.paidBy.name } : undefined,
                                term: selectedTermId,
                                academicYear: selectedAcademicYear.name || '',
                                feeStructureId: feeLastPayment.feeStructureId
                            };
                        }
                    }
                }

                const previousBalance = previousBalancesMap.get(pupil.id);
                if (previousBalance?.breakdown) {
                    for (const item of previousBalance.breakdown) {
                        const exists = applicableFees.find(f =>
                            f.feeStructureId === item.feeStructureId &&
                            f.termId === item.termId &&
                            f.academicYearId === item.academicYearId
                        );
                        if (!exists) {
                            applicableFees.push({
                                feeStructureId: item.feeStructureId,
                                name: item.name,
                                amount: item.amount,
                                paid: item.paid,
                                balance: item.balance,
                                lastPayment: null,
                                originalAmount: item.amount,
                                termId: item.termId,
                                academicYearId: item.academicYearId,
                                isCurrentTerm: false,
                                isCarryForward: true
                            });
                            totalFees += item.amount;
                            totalPaid += item.paid;
                        }
                    }
                }

                // Process uniform fees
                for (const uniformFee of uniformFees) {
                    if (pupil.registrationDate) {
                        const uniformYear = academicYears.find(y => y.id === uniformFee.academicYearId);
                        const uniformTerm = uniformYear?.terms.find(t => t.id === uniformFee.termId);
                        if (uniformTerm && !isTermValidForPupil(uniformTerm, pupil.registrationDate)) continue;
                    }

                    const isCurrentTermUniform = uniformFee.termId === selectedTermId;
                    const hasBalance = uniformFee.balance > 0;

                    if (isCurrentTermUniform || hasBalance) {
                        applicableFees.push({
                            feeStructureId: uniformFee.uniformTrackingId,
                            uniformTrackingId: uniformFee.uniformTrackingId,
                            name: uniformFee.name,
                            amount: uniformFee.amount,
                            paid: uniformFee.paid,
                            balance: uniformFee.balance,
                            lastPayment: null,
                            originalAmount: uniformFee.originalAmount || uniformFee.amount,
                            termId: uniformFee.termId ?? selectedTermId,
                            academicYearId: uniformFee.academicYearId,
                            isCurrentTerm: isCurrentTermUniform,
                            isCarryForward: !isCurrentTermUniform && hasBalance
                        });
                        totalFees += uniformFee.amount;
                        totalPaid += uniformFee.paid;
                    }
                }

                const sortedFees = applicableFees.sort((a, b) => {
                    if (a.isCurrentTerm && !b.isCurrentTerm) return -1;
                    if (!a.isCurrentTerm && b.isCurrentTerm) return 1;
                    if (a.isCarryForward && b.isCarryForward) return a.termId.localeCompare(b.termId);
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
                console.error(`Error processing fees for pupil ${pupil.id}:`, error);
                processingError = error instanceof Error ? error : new Error(String(error));
            }
        }

        return { feesInfo: processingError ? {} : result, processingError };
    }, [
        familyId, familyPupils, selectedTermId, selectedAcademicYear, academicYears,
        allFeeStructures, allPaymentsMap, previousBalancesMap, historicalPupilsMap, feesHolidaysMap, uniformFeesMap,
        isAllFeeStructuresLoading, isPaymentsLoading, paymentError, isSnapshotsLoading,
        isHolidaysLoading, isUniformFeesLoading, isPreviousBalancesLoading,
        feeStructuresError, snapshotsError, holidaysError, uniformsError,
        uniformFeesError, previousBalancesError,
    ]);

    const isLoading = !selectedAcademicYear || !selectedTermId ||
        isAllFeeStructuresLoading || isPaymentsLoading || isSnapshotsLoading ||
        isHolidaysLoading || isUniformFeesLoading || isPreviousBalancesLoading;
    const error = paymentError || feeStructuresError || snapshotsError || holidaysError ||
        uniformsError || uniformFeesError || previousBalancesError || processingError;

    return { feesInfo, isLoading, isError: !!error, error };
}
