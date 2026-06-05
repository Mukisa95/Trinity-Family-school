import type {
  AcademicYear,
  Account,
  FeeStructure,
  Loan,
  PaymentRecord,
  Pupil,
  RequirementItem,
  RequirementTracking,
  Transaction,
} from '@/types';
import { FeeStructuresService } from './fee-structures.service';
import { PaymentsService } from './payments.service';
import { PupilsService } from './pupils.service';
import { UniformFeesIntegrationService, type UniformFeeData } from './uniform-fees-integration.service';
import { RequirementTrackingService } from './requirement-tracking.service';
import { RequirementsService } from './requirements.service';
import { BankingService } from './banking.service';
import {
  calculatePreviousTermBalances,
  filterApplicableFees,
  processPupilFees,
} from '@/app/fees/collect/[id]/utils/feeProcessing';

export type FinanceSourceType =
  | 'school_fee'
  | 'carry_forward'
  | 'uniform'
  | 'requirement'
  | 'banking'
  | 'schoolpay'
  | 'unknown';

export interface NormalizedFinanceRecord {
  id: string;
  pupilId: string;
  sourceType: FinanceSourceType;
  sourceRecordId: string;
  amount: number;
  date?: string;
  label: string;
  status?: string;
  reversed?: boolean;
  raw: unknown;
}

export interface FinanceBucket<TRecord = unknown> {
  totalDue: number;
  totalPaid: number;
  totalBalance: number;
  records: TRecord[];
}

export interface FinanceWarning {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  sourceRecordIds?: string[];
}

export interface PupilFinanceSummary {
  pupilId: string;
  academicYearId?: string;
  termId?: string;
  schoolFees: FinanceBucket;
  carryForward: FinanceBucket;
  uniforms: FinanceBucket<UniformFeeData>;
  requirements: FinanceBucket<RequirementTracking>;
  banking: {
    account: Account | null;
    transactions: Transaction[];
    loans: Loan[];
    accountBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalLoanDisbursements: number;
    totalLoanRepayments: number;
    outstandingLoans: number;
    availableBalance: number;
  };
  totals: {
    totalDue: number;
    totalPaid: number;
    totalBalance: number;
  };
  normalizedRecords: NormalizedFinanceRecord[];
  warnings: FinanceWarning[];
  sourceRecords: {
    payments: PaymentRecord[];
    feeStructures: FeeStructure[];
    uniformFees: UniformFeeData[];
    requirementTracking: RequirementTracking[];
    requirements: RequirementItem[];
    bankingAccount: Account | null;
    bankingTransactions: Transaction[];
    bankingLoans: Loan[];
  };
}

export interface FamilyFinanceSummary {
  familyId: string;
  academicYearId?: string;
  termId?: string;
  pupils: Pupil[];
  pupilSummaries: PupilFinanceSummary[];
  totals: {
    totalDue: number;
    totalPaid: number;
    totalBalance: number;
    bankingAvailableBalance: number;
    outstandingLoans: number;
  };
  warnings: FinanceWarning[];
}

function sumAmounts<T>(items: T[], selector: (item: T) => number | undefined | null): number {
  return items.reduce((sum, item) => sum + (Number(selector(item)) || 0), 0);
}

function requirementAmount(record: RequirementTracking, requirements: RequirementItem[]): number {
  const ids = Array.isArray(record.requirementId) ? record.requirementId : [record.requirementId];
  return ids.reduce((sum, id) => {
    const requirement = requirements.find(item => item.id === id);
    return sum + (requirement?.price || 0);
  }, 0);
}

function normalizePaymentSource(payment: PaymentRecord): FinanceSourceType {
  const paymentAny = payment as PaymentRecord & Record<string, unknown>;
  if (paymentAny.source === 'schoolpay') return 'schoolpay';
  if (payment.feeStructureId === 'previous-balance' || paymentAny.isCarryForwardPayment) return 'carry_forward';
  if (paymentAny.isUniformPayment || payment.feeStructureId?.startsWith('uniform-')) return 'uniform';
  return 'school_fee';
}

function buildPaymentDedupeKey(payment: PaymentRecord): string {
  const paymentAny = payment as PaymentRecord & Record<string, unknown>;
  const externalRef =
    paymentAny.schoolpayReceiptNumber ||
    paymentAny.receiptNumber ||
    paymentAny.sourceChannelTransactionId ||
    paymentAny.uniformTrackingId ||
    paymentAny.originalFeeStructureId ||
    payment.id;

  return [
    payment.pupilId,
    normalizePaymentSource(payment),
    payment.feeStructureId,
    externalRef,
    payment.amount,
    payment.paymentDate,
  ].join('|');
}

export class FinanceCalculationService {
  static financeQueryKey = 'finance-summary';

  static async getPupilFinanceSummary(
    pupilId: string,
    academicYearId?: string,
    termId?: string,
    options?: {
      pupil?: Pupil;
      academicYear?: AcademicYear;
      allAcademicYears?: AcademicYear[];
      feesHolidays?: any[];
    }
  ): Promise<PupilFinanceSummary> {
    const pupil = options?.pupil || await PupilsService.getPupilById(pupilId);
    if (!pupil) {
      throw new Error(`Pupil ${pupilId} was not found`);
    }

    const [payments, allFeeStructures, requirements, requirementTracking, uniformFees, account, transactions, loans] = await Promise.all([
      PaymentsService.getPaymentsByPupil(pupilId),
      FeeStructuresService.getAllFeeStructures(),
      RequirementsService.getAllRequirements(),
      RequirementTrackingService.getTrackingRecordsByPupil(pupilId),
      termId && academicYearId
        ? UniformFeesIntegrationService.getUniformFeesForPupil(pupilId, termId, academicYearId)
        : UniformFeesIntegrationService.getAllUniformFeesForPupil(pupilId),
      BankingService.getAccountByPupilId(pupilId).catch(() => null),
      BankingService.getTransactionsByPupilId(pupilId).catch(() => []),
      BankingService.getLoansByPupilId(pupilId).catch(() => []),
    ]);

    const academicYear = options?.academicYear;
    const allAcademicYears = options?.allAcademicYears || (academicYear ? [academicYear] : []);
    let processedFees: any[] = [];
    let previousBalance: any | null = null;

    if (academicYear && termId) {
      const applicableFees = filterApplicableFees(
        allFeeStructures,
        pupil,
        termId,
        academicYear,
        allAcademicYears
      );

      processedFees = processPupilFees(
        applicableFees,
        payments,
        allFeeStructures,
        pupil,
        termId,
        academicYear,
        allAcademicYears,
        options?.feesHolidays || []
      );

      previousBalance = await calculatePreviousTermBalances(
        pupilId,
        termId,
        academicYear,
        allAcademicYears,
        async () => allFeeStructures,
        async () => payments,
        pupil
      );
    }

    const activePayments = payments.filter(payment => !payment.reverted);
    const carryForwardPayments = activePayments.filter(payment => normalizePaymentSource(payment) === 'carry_forward');
    const directUniformPayments = activePayments.filter(payment => normalizePaymentSource(payment) === 'uniform');

    const schoolFeeRecords = processedFees.filter(fee => !(fee as any).isUniformFee && !(fee as any).isCarryForward);
    const schoolFees = {
      totalDue: sumAmounts(schoolFeeRecords, fee => fee.amount),
      totalPaid: sumAmounts(schoolFeeRecords, fee => fee.paid ?? fee.amountPaid),
      totalBalance: sumAmounts(schoolFeeRecords, fee => fee.balance),
      records: schoolFeeRecords,
    };

    const carryForward = {
      totalDue: previousBalance?.amount || 0,
      totalPaid: sumAmounts(carryForwardPayments, payment => payment.amount),
      totalBalance: previousBalance?.amount || 0,
      records: previousBalance?.breakdown || [],
    };

    const uniforms = {
      totalDue: sumAmounts(uniformFees, fee => fee.amount),
      totalPaid: sumAmounts(uniformFees, fee => fee.paid),
      totalBalance: sumAmounts(uniformFees, fee => fee.balance),
      records: uniformFees,
    };

    const filteredRequirementTracking = requirementTracking.filter(record => {
      if (academicYearId && record.academicYearId !== academicYearId) return false;
      if (termId && record.termId && record.termId !== termId) return false;
      return true;
    });

    const requirementsBucket = {
      totalDue: sumAmounts(filteredRequirementTracking, record => requirementAmount(record, requirements)),
      totalPaid: sumAmounts(filteredRequirementTracking, record => record.paidAmount),
      totalBalance: sumAmounts(filteredRequirementTracking, record => Math.max(0, requirementAmount(record, requirements) - (record.paidAmount || 0))),
      records: filteredRequirementTracking,
    };

    const nonRevertedTransactions = transactions.filter(transaction => !transaction.isReverted);
    const totalDeposits = sumAmounts(nonRevertedTransactions.filter(tx => tx.type === 'DEPOSIT'), tx => tx.amount);
    const totalWithdrawals = sumAmounts(nonRevertedTransactions.filter(tx => tx.type === 'WITHDRAWAL'), tx => tx.amount);
    const totalLoanDisbursements = sumAmounts(nonRevertedTransactions.filter(tx => tx.type === 'LOAN_DISBURSEMENT'), tx => tx.amount);
    const totalLoanRepayments = sumAmounts(nonRevertedTransactions.filter(tx => tx.type === 'LOAN_REPAYMENT'), tx => tx.amount);
    const outstandingLoans = sumAmounts(loans.filter(loan => loan.status === 'ACTIVE'), loan => Math.max(0, loan.amount - loan.amountRepaid));
    const accountBalance = account?.balance || 0;

    const normalizedRecords = this.normalizeRecords({
      payments,
      requirementTracking: filteredRequirementTracking,
      uniformFees,
      transactions,
      pupilId,
      requirements,
    });

    const warnings = this.buildWarnings({
      payments,
      uniformFees,
      directUniformPayments,
      requirementTracking: filteredRequirementTracking,
      requirements,
      normalizedRecords,
      account,
      transactions: nonRevertedTransactions,
      loans,
      accountBalance,
    });

    const totalDue = schoolFees.totalDue + carryForward.totalDue + uniforms.totalDue + requirementsBucket.totalDue;
    const totalPaid = schoolFees.totalPaid + carryForward.totalPaid + uniforms.totalPaid + requirementsBucket.totalPaid;
    const totalBalance = schoolFees.totalBalance + carryForward.totalBalance + uniforms.totalBalance + requirementsBucket.totalBalance;

    return {
      pupilId,
      academicYearId,
      termId,
      schoolFees,
      carryForward,
      uniforms,
      requirements: requirementsBucket,
      banking: {
        account,
        transactions,
        loans,
        accountBalance,
        totalDeposits,
        totalWithdrawals,
        totalLoanDisbursements,
        totalLoanRepayments,
        outstandingLoans,
        availableBalance: Math.max(0, accountBalance - outstandingLoans),
      },
      totals: {
        totalDue,
        totalPaid,
        totalBalance,
      },
      normalizedRecords,
      warnings,
      sourceRecords: {
        payments,
        feeStructures: allFeeStructures,
        uniformFees,
        requirementTracking: filteredRequirementTracking,
        requirements,
        bankingAccount: account,
        bankingTransactions: transactions,
        bankingLoans: loans,
      },
    };
  }

  static async getFamilyFinanceSummary(
    familyId: string,
    academicYearId?: string,
    termId?: string,
    options?: {
      academicYear?: AcademicYear;
      allAcademicYears?: AcademicYear[];
      feesHolidaysByPupil?: Record<string, any[]>;
    }
  ): Promise<FamilyFinanceSummary> {
    const pupils = await PupilsService.getPupilsByFamily(familyId);
    const pupilSummaries = await Promise.all(
      pupils.map(pupil =>
        this.getPupilFinanceSummary(pupil.id, academicYearId, termId, {
          pupil,
          academicYear: options?.academicYear,
          allAcademicYears: options?.allAcademicYears,
          feesHolidays: options?.feesHolidaysByPupil?.[pupil.id] || [],
        })
      )
    );

    return {
      familyId,
      academicYearId,
      termId,
      pupils,
      pupilSummaries,
      totals: {
        totalDue: sumAmounts(pupilSummaries, summary => summary.totals.totalDue),
        totalPaid: sumAmounts(pupilSummaries, summary => summary.totals.totalPaid),
        totalBalance: sumAmounts(pupilSummaries, summary => summary.totals.totalBalance),
        bankingAvailableBalance: sumAmounts(pupilSummaries, summary => summary.banking.availableBalance),
        outstandingLoans: sumAmounts(pupilSummaries, summary => summary.banking.outstandingLoans),
      },
      warnings: pupilSummaries.flatMap(summary => summary.warnings),
    };
  }

  private static normalizeRecords(data: {
    payments: PaymentRecord[];
    requirementTracking: RequirementTracking[];
    uniformFees: UniformFeeData[];
    transactions: Transaction[];
    pupilId: string;
    requirements: RequirementItem[];
  }): NormalizedFinanceRecord[] {
    const paymentRecords = data.payments.map(payment => ({
      id: `payment:${payment.id}`,
      pupilId: payment.pupilId,
      sourceType: normalizePaymentSource(payment),
      sourceRecordId: payment.id,
      amount: payment.amount,
      date: payment.paymentDate,
      label: payment.notes || payment.feeStructureId,
      status: payment.reverted ? 'reverted' : 'posted',
      reversed: payment.reverted,
      raw: payment,
    }));

    const requirementRecords = data.requirementTracking.map(record => ({
      id: `requirement:${record.id}`,
      pupilId: record.pupilId,
      sourceType: 'requirement' as const,
      sourceRecordId: record.id,
      amount: record.paidAmount || 0,
      date: record.paymentDate,
      label: 'Requirement payment/tracking',
      status: record.paymentStatus,
      raw: record,
    }));

    const uniformRecords = data.uniformFees.map(fee => ({
      id: `uniform:${fee.uniformTrackingId}`,
      pupilId: data.pupilId,
      sourceType: 'uniform' as const,
      sourceRecordId: fee.uniformTrackingId,
      amount: fee.paid || 0,
      label: fee.name,
      status: fee.balance <= 0 ? 'paid' : fee.paid > 0 ? 'partial' : 'pending',
      raw: fee,
    }));

    const bankingRecords = data.transactions.map(transaction => ({
      id: `banking:${transaction.id}`,
      pupilId: transaction.pupilId,
      sourceType: 'banking' as const,
      sourceRecordId: transaction.id,
      amount: transaction.amount,
      date: transaction.transactionDate,
      label: transaction.description,
      status: transaction.isReverted ? 'reverted' : transaction.type,
      reversed: transaction.isReverted,
      raw: transaction,
    }));

    return [...paymentRecords, ...requirementRecords, ...uniformRecords, ...bankingRecords];
  }

  private static buildWarnings(data: {
    payments: PaymentRecord[];
    uniformFees: UniformFeeData[];
    directUniformPayments: PaymentRecord[];
    requirementTracking: RequirementTracking[];
    requirements: RequirementItem[];
    normalizedRecords: NormalizedFinanceRecord[];
    account: Account | null;
    transactions: Transaction[];
    loans: Loan[];
    accountBalance: number;
  }): FinanceWarning[] {
    const warnings: FinanceWarning[] = [];
    const dedupeMap = new Map<string, PaymentRecord[]>();

    data.payments.forEach(payment => {
      const key = buildPaymentDedupeKey(payment);
      const existing = dedupeMap.get(key) || [];
      existing.push(payment);
      dedupeMap.set(key, existing);
    });

    dedupeMap.forEach(records => {
      const activeRecords = records.filter(record => !record.reverted);
      if (activeRecords.length > 1) {
        warnings.push({
          code: 'duplicate-payment-candidate',
          severity: 'warning',
          message: `Possible duplicate payment records detected for ${activeRecords[0].feeStructureId}.`,
          sourceRecordIds: activeRecords.map(record => record.id),
        });
      }
    });

    data.uniformFees.forEach(uniformFee => {
      const paymentTotal = sumAmounts(
        data.directUniformPayments.filter(payment => (payment as any).uniformTrackingId === uniformFee.uniformTrackingId || payment.feeStructureId === uniformFee.id),
        payment => payment.amount
      );

      if (paymentTotal > 0 && Math.abs(paymentTotal - (uniformFee.paid || 0)) > 1) {
        warnings.push({
          code: 'uniform-payment-mismatch',
          severity: 'critical',
          message: `Uniform payment records total ${paymentTotal}, but tracking paid amount is ${uniformFee.paid || 0} for ${uniformFee.name}.`,
          sourceRecordIds: [uniformFee.uniformTrackingId],
        });
      }
    });

    data.requirementTracking.forEach(record => {
      const due = requirementAmount(record, data.requirements);
      if ((record.paidAmount || 0) > due && due > 0) {
        warnings.push({
          code: 'requirement-overpayment',
          severity: 'warning',
          message: `Requirement tracking record ${record.id} has paid amount greater than calculated due amount.`,
          sourceRecordIds: [record.id],
        });
      }
    });

    if (data.account) {
      const transactionBalance = data.transactions.reduce((balance, transaction) => {
        if (transaction.type === 'DEPOSIT' || transaction.type === 'LOAN_DISBURSEMENT') {
          return balance + transaction.amount;
        }
        return balance - transaction.amount;
      }, 0);

      if (Math.abs(transactionBalance - data.accountBalance) > 1) {
        warnings.push({
          code: 'banking-balance-mismatch',
          severity: 'critical',
          message: `Bank account balance ${data.accountBalance} does not match transaction-derived balance ${transactionBalance}.`,
          sourceRecordIds: [data.account.id],
        });
      }
    }

    return warnings;
  }
}
