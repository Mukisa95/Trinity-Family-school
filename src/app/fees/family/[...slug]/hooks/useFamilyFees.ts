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
        staleTime: 8 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: (previousData) => previousData,
    });

    // 🚀 OPTIMIZED: Batch load ALL payments for the term in ONE query
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const pupilIds = useMemo(() => familyPupils.map(p => p.id), [familyPupils]);

    const { data: allPaymentsMap = new Map(), isLoading: isPaymentsLoading } = useQuery<Map<string, PaymentRecord[]>>({
        queryKey: ['family-payments-all', pupilIds.join(',')],
        queryFn: async () => {
            if (pupilIds.length === 0) {
                return new Map();
            }

            const paymentsMap = new Map<string, PaymentRecord[]>();
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

            return paymentsMap;
        },
        enabled: pupilIds.length > 0,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: (previousData) => previousData,
    });

    const { data: previousBalancesMap = new Map(), isLoading: isPreviousBalancesLoading } = useQuery<Map<string, any>>({
        queryKey: ['family-previous-balances', selectedAcademicYear?.id, selectedTermId, pupilIds.join(','), allPaymentsMap.size, allFeeStructures.length],
        queryFn: async () => {
            if (!selectedAcademicYear || !selectedTermId || pupilIds.length === 0) {
                return new Map();
            }

            const balancesMap = new Map<string, any>();
            await Promise.all(
                familyPupils.map(async (pupil) => {
                    try {
                        const previousBalance = await calculatePreviousTermBalances(
                            pupil.id,
                            selectedTermId,
                            selectedAcademicYear,
                            academicYears,
                            async () => allFeeStructures,
                            async () => allPaymentsMap.get(pupil.id) || [],
                            pupil
                        );
                        balancesMap.set(pupil.id, previousBalance);
                    } catch (error) {
                        console.error(`Error calculating previous balance for pupil ${pupil.id}:`, error);
                        balancesMap.set(pupil.id, null);
                    }
                })
            );

            return balancesMap;
        },
        enabled: !!selectedAcademicYear && !!selectedTermId && pupilIds.length > 0 && !isPaymentsLoading && !isAllFeeStructuresLoading,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: (previousData) => previousData,
    });

    // 🚀 OPTIMIZED: Load all snapshots, holidays, and uniform fees in parallel
    const { data: historicalPupilsMap = new Map(), isLoading: isSnapshotsLoading } = useQuery<Map<string, Pupil>>({
        queryKey: ['family-snapshots-batch', selectedTermId, selectedAcademicYear?.id, pupilIds.join(',')],
        queryFn: async () => {
            if (!selectedTermId || !selectedAcademicYear || familyPupils.length === 0) return new Map();

            const snapshotsMap = new Map<string, Pupil>();
            await Promise.all(
                familyPupils.map(async (pupil) => {
                    try {
                        const snapshot = await PupilSnapshotsService.getSnapshotForRead(pupil, selectedTermId, selectedAcademicYear);
                        const historicalPupil = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);
                        snapshotsMap.set(pupil.id, historicalPupil);
                    } catch (error) {
                        snapshotsMap.set(pupil.id, pupil);
                    }
                })
            );
            return snapshotsMap;
        },
        enabled: !!selectedTermId && !!selectedAcademicYear && familyPupils.length > 0,
        staleTime: 10 * 60 * 1000,
        gcTime: 20 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: (previousData) => previousData,
    });

    const { data: feesHolidaysMap = new Map(), isLoading: isHolidaysLoading } = useQuery<Map<string, any[]>>({
        queryKey: ['family-holidays-batch', pupilIds.join(',')],
        queryFn: async () => {
            if (pupilIds.length === 0) return new Map();
            const holidaysMap = new Map<string, any[]>();
            await Promise.all(
                pupilIds.map(async (pupilId) => {
                    try {
                        const holidays = await FeesHolidayService.getActiveFeesHolidaysByPupil(pupilId);
                        holidaysMap.set(pupilId, holidays);
                    } catch (error) {
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

    const { data: uniformFeesMap = new Map(), isLoading: isUniformFeesLoading } = useQuery<Map<string, any[]>>({
        queryKey: ['family-uniform-fees-batch', selectedTermId, selectedAcademicYear?.id, pupilIds.join(',')],
        queryFn: async () => {
            if (!selectedTermId || !selectedAcademicYear?.id || familyPupils.length === 0) return new Map();
            const uniformMap = new Map<string, any[]>();
            await Promise.all(
                familyPupils.map(async (pupil) => {
                    try {
                        const uniformFees = await UniformFeesIntegrationService.getUniformFeesForPupil(
                            pupil.id, selectedTermId, selectedAcademicYear.id
                        );
                        uniformMap.set(pupil.id, uniformFees);
                    } catch (error) {
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
        if (!selectedAcademicYear || !selectedTermId || familyPupils.length === 0) return {};
        if (isFeeStructuresLoading || isPaymentsLoading || isSnapshotsLoading || isPreviousBalancesLoading) return {};

        const result: Record<string, FeesInfo> = {};

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
                const uniformFees = uniformFeesMap.get(pupil.id) || [];

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
                            name: uniformFee.name,
                            amount: uniformFee.amount,
                            paid: uniformFee.paid,
                            balance: uniformFee.balance,
                            lastPayment: null,
                            originalAmount: uniformFee.originalAmount || uniformFee.amount,
                            termId: uniformFee.termId,
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

        return result;
    }, [
        familyId, familyPupils, selectedTermId, selectedAcademicYear, academicYears,
        feeStructures, allFeeStructures, allPaymentsMap, previousBalancesMap, historicalPupilsMap, feesHolidaysMap, uniformFeesMap,
        isFeeStructuresLoading, isPaymentsLoading, isSnapshotsLoading, isPreviousBalancesLoading
    ]);

    const isLoading = isFeeStructuresLoading || isAllFeeStructuresLoading || isPaymentsLoading || isSnapshotsLoading || isHolidaysLoading || isUniformFeesLoading || isPreviousBalancesLoading;

    return { feesInfo, isLoading, isError: false, error: null };
}
