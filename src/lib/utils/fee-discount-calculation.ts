import type {
  AcademicYear,
  FeeStructure,
  FeesHoliday,
  PaymentRecord,
  PupilAssignedFee,
} from '@/types';
import { isAssignmentValidForContext } from '@/lib/utils/fee-assignment-pipeline';

export interface AppliedFeeDiscount {
  assignment: PupilAssignedFee;
  id: string;
  name: string;
  amount: number;
  type: 'fixed' | 'percentage';
}

export interface FeeDiscountCalculation {
  finalAmount: number;
  totalDiscountAmount: number;
  feesHoliday?: {
    holiday: FeesHoliday;
    categories: string[];
    amount: number;
  };
  appliedDiscounts: AppliedFeeDiscount[];
}

interface CalculateFeeDiscountInput {
  fee: FeeStructure;
  assignedFees?: PupilAssignedFee[];
  allFeeStructures: FeeStructure[];
  academicYearId: string;
  termId: string;
  allAcademicYears: AcademicYear[];
  feesHolidays?: FeesHoliday[];
}

function getHolidayCategories(holiday: FeesHoliday): string[] {
  if (Array.isArray(holiday.categories)) return holiday.categories;

  const legacyCategory = (holiday as FeesHoliday & { category?: string }).category;
  return legacyCategory ? [legacyCategory] : [];
}

function calculateHolidayDiscount(fee: FeeStructure, holiday: FeesHoliday): number {
  switch (holiday.discountType) {
    case 'full':
      return fee.amount;
    case 'half':
      return fee.amount * 0.5;
    case 'quarter':
      return fee.amount * 0.25;
    case 'percentage':
      return holiday.discountValue === undefined
        ? 0
        : fee.amount * (holiday.discountValue / 100);
    default:
      return 0;
  }
}

/**
 * Canonical payable amount for one pupil fee after every valid discount.
 * Manual collection and automatic SchoolPay allocation must both use this
 * calculation so a waived amount can never be treated as an outstanding debt.
 */
export function calculateFeeAmountAfterDiscounts({
  fee,
  assignedFees = [],
  allFeeStructures,
  academicYearId,
  termId,
  allAcademicYears,
  feesHolidays = [],
}: CalculateFeeDiscountInput): FeeDiscountCalculation {
  const applicableHoliday = feesHolidays
    .filter((holiday) => holiday.isActive)
    .find((holiday) => {
      const categories = getHolidayCategories(holiday);
      return categories.some((category) =>
        category === 'required' ? fee.isRequired === true :
          category === 'non-required' ? fee.isRequired !== true : false,
      );
    });

  const holidayAmount = applicableHoliday
    ? calculateHolidayDiscount(fee, applicableHoliday)
    : 0;
  const amountAfterHoliday = Math.max(0, fee.amount - holidayAmount);

  const appliedDiscounts: AppliedFeeDiscount[] = [];

  for (const assignment of assignedFees) {
    if (!isAssignmentValidForContext(
      assignment,
      academicYearId,
      termId,
      allAcademicYears,
    )) {
      continue;
    }

    if (assignment.feeStructureId.startsWith('pivot-') && assignment.inlineDiscount) {
      if (!assignment.inlineDiscount.linkedFeeIds?.includes(fee.id)) continue;

      appliedDiscounts.push({
        assignment,
        id: assignment.feeStructureId,
        name: assignment.inlineDiscount.name,
        amount: Math.abs(assignment.inlineDiscount.amount),
        type: 'fixed',
      });
      continue;
    }

    const discountStructure = allFeeStructures.find(
      (candidate) => candidate.id === assignment.feeStructureId,
    );
    const isDiscount = discountStructure && (
      discountStructure.category === 'Discount' || discountStructure.amount < 0
    );
    const isLinked = discountStructure && (
      discountStructure.linkedFeeIds?.includes(fee.id) ||
      discountStructure.linkedFeeId === fee.id
    );

    if (!discountStructure || !isDiscount || !isLinked) continue;

    appliedDiscounts.push({
      assignment,
      id: discountStructure.id,
      name: discountStructure.name,
      amount: discountStructure.amount < 0
        ? Math.abs(discountStructure.amount)
        : amountAfterHoliday * (discountStructure.amount / 100),
      type: discountStructure.amount < 0 ? 'fixed' : 'percentage',
    });
  }

  const totalDiscountAmount = holidayAmount + appliedDiscounts.reduce(
    (sum, discount) => sum + discount.amount,
    0,
  );

  return {
    finalAmount: Math.max(0, fee.amount - totalDiscountAmount),
    totalDiscountAmount,
    feesHoliday: applicableHoliday
      ? {
          holiday: applicableHoliday,
          categories: getHolidayCategories(applicableHoliday),
          amount: holidayAmount,
        }
      : undefined,
    appliedDiscounts,
  };
}

type BalancePayment = Pick<
  PaymentRecord,
  'feeStructureId' | 'academicYearId' | 'termId' | 'amount' | 'reverted'
>;

interface CalculateFeeBalancesInput {
  feeStructures: FeeStructure[];
  allFeeStructures: FeeStructure[];
  assignedFees?: PupilAssignedFee[];
  payments: BalancePayment[];
  academicYearId: string;
  termId: string;
  allAcademicYears: AcademicYear[];
  feesHolidays?: FeesHoliday[];
}

export type DiscountAwareFeeBalance = FeeStructure & {
  payableAmount: number;
  paid: number;
  balance: number;
};

export interface BalanceBoundPaymentSelection {
  key: string;
  feeName: string;
  selectedAmount: number;
}

export interface PaymentBalanceViolation extends BalanceBoundPaymentSelection {
  currentBalance: number | null;
}

/**
 * Final client-side guard for payment modals whose balances can refresh while
 * they remain open. The supplied balances must already be discount-adjusted.
 */
export function findDiscountAwarePaymentViolation(
  selections: BalanceBoundPaymentSelection[],
  currentBalances: ReadonlyMap<string, number>,
): PaymentBalanceViolation | null {
  for (const selection of selections) {
    const currentBalance = currentBalances.get(selection.key);
    if (
      currentBalance === undefined ||
      !Number.isFinite(currentBalance) ||
      !Number.isFinite(selection.selectedAmount) ||
      selection.selectedAmount < 0 ||
      selection.selectedAmount > Math.max(0, currentBalance)
    ) {
      return {
        ...selection,
        currentBalance: currentBalance ?? null,
      };
    }
  }

  return null;
}

/** Builds allocation candidates from the discounted payable amount, not gross fees. */
export function calculateFeeBalancesAfterDiscounts({
  feeStructures,
  allFeeStructures,
  assignedFees,
  payments,
  academicYearId,
  termId,
  allAcademicYears,
  feesHolidays = [],
}: CalculateFeeBalancesInput): DiscountAwareFeeBalance[] {
  return feeStructures.map((fee) => {
    const payableAmount = calculateFeeAmountAfterDiscounts({
      fee,
      assignedFees,
      allFeeStructures,
      academicYearId,
      termId,
      allAcademicYears,
      feesHolidays,
    }).finalAmount;

    const paid = payments
      .filter((payment) =>
        payment.feeStructureId === fee.id &&
        payment.academicYearId === academicYearId &&
        payment.termId === termId &&
        !payment.reverted,
      )
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    return {
      ...fee,
      payableAmount,
      paid,
      balance: Math.max(0, payableAmount - paid),
    };
  });
}
