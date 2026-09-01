import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AcademicYear,
  FeeStructure,
  PaymentRecord,
  PupilAssignedFee,
} from '../src/types';
import {
  calculateFeeAmountAfterDiscounts,
  calculateFeeBalancesAfterDiscounts,
  findDiscountAwarePaymentViolation,
} from '../src/lib/utils/fee-discount-calculation';

const academicYears = [
  {
    id: 'year-2026',
    name: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    terms: [
      { id: 'term-1', name: 'Term 1', startDate: '2026-01-01', endDate: '2026-04-30' },
      { id: 'term-2', name: 'Term 2', startDate: '2026-05-01', endDate: '2026-08-31' },
    ],
  },
] as AcademicYear[];

const schoolFees = {
  id: 'school-fees',
  name: 'School Fees',
  amount: 550_000,
  category: 'Tuition',
  isRequired: true,
  isRecurring: true,
  status: 'active',
  createdAt: '2026-01-01',
} as FeeStructure;

const meals = {
  ...schoolFees,
  id: 'meals',
  name: 'Meals',
  amount: 300_000,
} as FeeStructure;

const virtueDiscount = {
  ...schoolFees,
  id: 'virtue-discount',
  name: 'Virtue Discount',
  amount: -50_000,
  category: 'Discount',
  linkedFeeIds: [schoolFees.id],
} as FeeStructure;

const discountAssignment = {
  id: 'assignment-discount',
  feeStructureId: virtueDiscount.id,
  assignedAt: '2026-01-01',
  status: 'active',
  validityType: 'current_year',
  startAcademicYearId: academicYears[0].id,
  termApplicability: 'all_terms',
} as PupilAssignedFee;

function payment(amount: number): PaymentRecord {
  return {
    id: `payment-${amount}`,
    pupilId: 'pupil-1',
    feeStructureId: schoolFees.id,
    academicYearId: academicYears[0].id,
    termId: 'term-1',
    amount,
    paymentDate: '2026-02-01',
    paidBy: { id: 'cashier', name: 'Cashier', role: 'Bursar' },
    createdAt: '2026-02-01',
  };
}

test('discount-adjusted balance excludes a settled school fee from SchoolPay allocation', () => {
  const balances = calculateFeeBalancesAfterDiscounts({
    feeStructures: [schoolFees, meals],
    allFeeStructures: [schoolFees, meals, virtueDiscount],
    assignedFees: [discountAssignment],
    payments: [payment(440_000), payment(60_000)],
    academicYearId: academicYears[0].id,
    termId: 'term-1',
    allAcademicYears: academicYears,
  });

  const schoolFeeBalance = balances.find((fee) => fee.id === schoolFees.id);
  assert.equal(schoolFeeBalance?.payableAmount, 500_000);
  assert.equal(schoolFeeBalance?.paid, 500_000);
  assert.equal(schoolFeeBalance?.balance, 0);

  const allocationCandidates = balances.filter((fee) => fee.balance > 0);
  assert.deepEqual(allocationCandidates.map((fee) => fee.id), [meals.id]);
  assert.equal(Math.min(250_000, allocationCandidates[0].balance), 250_000);
});

test('inline pupil discount uses the same payable amount calculation', () => {
  const inlineDiscount = {
    ...discountAssignment,
    id: 'assignment-inline-discount',
    feeStructureId: 'pivot-virtue-discount',
    inlineDiscount: {
      name: 'Virtue Discount',
      amount: -50_000,
      linkedFeeIds: [schoolFees.id],
    },
  } as PupilAssignedFee;

  const result = calculateFeeAmountAfterDiscounts({
    fee: schoolFees,
    assignedFees: [inlineDiscount],
    allFeeStructures: [schoolFees],
    academicYearId: academicYears[0].id,
    termId: 'term-1',
    allAcademicYears: academicYears,
  });

  assert.equal(result.finalAmount, 500_000);
  assert.equal(result.totalDiscountAmount, 50_000);
});

test('a reverted payment does not contribute to the settled amount', () => {
  const revertedPayment = { ...payment(60_000), reverted: true };
  const balances = calculateFeeBalancesAfterDiscounts({
    feeStructures: [schoolFees],
    allFeeStructures: [schoolFees, virtueDiscount],
    assignedFees: [discountAssignment],
    payments: [payment(440_000), revertedPayment],
    academicYearId: academicYears[0].id,
    termId: 'term-1',
    allAcademicYears: academicYears,
  });

  assert.equal(balances[0].payableAmount, 500_000);
  assert.equal(balances[0].paid, 440_000);
  assert.equal(balances[0].balance, 60_000);
});

test('future-term allocation also excludes a discount-settled fee', () => {
  const futurePayments = [440_000, 60_000].map((amount) => ({
    ...payment(amount),
    id: `future-payment-${amount}`,
    termId: 'term-2',
  }));
  const balances = calculateFeeBalancesAfterDiscounts({
    feeStructures: [schoolFees],
    allFeeStructures: [schoolFees, virtueDiscount],
    assignedFees: [discountAssignment],
    payments: futurePayments,
    academicYearId: academicYears[0].id,
    termId: 'term-2',
    allAcademicYears: academicYears,
  });

  assert.equal(balances[0].payableAmount, 500_000);
  assert.equal(balances[0].paid, 500_000);
  assert.equal(balances[0].balance, 0);
});

test('family payment blocks a stale selection for a discount-settled fee', () => {
  const violation = findDiscountAwarePaymentViolation(
    [
      {
        key: 'pupil-1:school-fees',
        feeName: 'Pupil One - School Fees',
        selectedAmount: 50_000,
      },
    ],
    new Map([['pupil-1:school-fees', 0]]),
  );

  assert.equal(violation?.feeName, 'Pupil One - School Fees');
  assert.equal(violation?.currentBalance, 0);
});

test('multi-fee payment accepts amounts within current discount-adjusted balances', () => {
  const violation = findDiscountAwarePaymentViolation(
    [
      { key: 'meals', feeName: 'Meals', selectedAmount: 250_000 },
    ],
    new Map([
      ['school-fees', 0],
      ['meals', 300_000],
    ]),
  );

  assert.equal(violation, null);
});

test('multi-fee payment blocks a stale allocation after a discount settles the fee', () => {
  const violation = findDiscountAwarePaymentViolation(
    [{ key: 'school-fees', feeName: 'School Fees', selectedAmount: 50_000 }],
    new Map([['school-fees', 0]]),
  );

  assert.equal(violation?.feeName, 'School Fees');
  assert.equal(violation?.currentBalance, 0);
});
