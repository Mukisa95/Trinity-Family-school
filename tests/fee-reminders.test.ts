import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canReadFeeReminders, canManageFeeReminders, canReceiveFeeReminders,
  feeReminderPromiseText, feeReminderOutcomeText, getFeeReminderProgress,
  normalizeReminderPhone, parseFeeReminderSchedule, paymentMatchesReminderScope,
  type FeeReminder,
} from '../src/lib/fees/fee-reminders';
import type { PaymentRecord, SystemUser } from '../src/types';

export const promiseFixture: FeeReminder = {
  id: 'promise-1', kind: 'pay_later', pupilId: 'joan', pupilName: 'Joan Kagwa',
  feeId: 'tuition', feeName: 'Tuition', academicYearId: '2026', termId: 'term3', academicYearName: '2026', termName: 'Term 3',
  scopes: [{ feeStructureId: 'tuition', academicYearId: '2026', termId: 'term3', feeName: 'Tuition', academicYearName: '2026', termName: 'Term 3' }],
  promisedAmount: 20_000, promisedBy: 'Rose Kagwa', phone: '+256700123456', additionalNote: '',
  balanceAtCreation: 40_000, baselinePaymentIds: ['old-payment'],
  createdAt: '2026-09-26T09:00:00+03:00', dueAt: '2026-10-03T09:00:00+03:00',
  createdBy: 'cashier', createdByName: 'Cashier', reminderStatus: 'scheduled',
};

function payment(id: string, amount: number, changes: Partial<PaymentRecord> = {}): PaymentRecord {
  return { id, pupilId: 'joan', feeStructureId: 'tuition', academicYearId: '2026', termId: 'term3', amount,
    paymentDate: '2026-09-30T10:00:00+03:00', createdAt: '2026-09-30T10:00:00+03:00',
    paidBy: { id: 'cashier', name: 'Cashier', role: 'Staff' }, ...changes };
}
const due = new Date('2026-10-03T09:00:00+03:00');

test('a due promise with no payment includes the parent phone and personalised dates', () => {
  const progress = getFeeReminderProgress(promiseFixture, [], due);
  assert.equal(progress.status, 'unpaid'); assert.equal(progress.remaining, 20_000); assert.equal(progress.overdue, true);
  const text = feeReminderPromiseText(promiseFixture, due);
  assert.match(text, /Rose Kagwa.*Joan Kagwa/); assert.match(text, /26 September 2026/);
  assert.match(text, /20,000 shillings/); assert.match(text, /today, 3 October 2026 at 09:00/);
  assert.match(feeReminderOutcomeText(promiseFixture, progress), /No payment.*Call Rose Kagwa on \+256700123456/);
});

test('a 15,000 payment reports the date and 5,000 shortfall', () => {
  const progress = getFeeReminderProgress(promiseFixture, [payment('one', 15_000)], due);
  assert.equal(progress.status, 'partial'); assert.equal(progress.paid, 15_000); assert.equal(progress.remaining, 5_000);
  const text = feeReminderOutcomeText(promiseFixture, progress);
  assert.match(text, /15,000 shillings/); assert.match(text, /30 September 2026/); assert.match(text, /5,000 shillings less/);
});

test('multiple payments fulfil a promise on the first date the sum reaches its amount', () => {
  const ledger = [payment('third', 3000, { paymentDate: '2026-10-02T09:00:00+03:00' }), payment('first', 15000),
    payment('second', 5000, { paymentDate: '2026-10-01T09:00:00+03:00' })];
  const progress = getFeeReminderProgress(promiseFixture, ledger, due);
  assert.equal(progress.status, 'paid'); assert.equal(progress.paid, 23_000); assert.equal(progress.remaining, 0);
  assert.equal(progress.completedAt, '2026-10-01T09:00:00+03:00');
  assert.match(feeReminderOutcomeText(promiseFixture, progress), /full promised amount was paid on 1 October 2026/);
});

test('reversing a payment updates a fulfilled promise back to partial', () => {
  const second = payment('two', 5000);
  const ledger = [payment('one', 15000), second, { ...second, reverted: true }];
  const progress = getFeeReminderProgress(promiseFixture, ledger, due);
  assert.equal(progress.paid, 15_000); assert.equal(progress.status, 'partial'); assert.equal(progress.completedAt, null);
});

test('payments from another pupil, fee, year or term cannot fulfil the promise', () => {
  const ledger = [payment('other-pupil', 20000, { pupilId: 'mary' }), payment('other-fee', 20000, { feeStructureId: 'meals' }),
    payment('other-year', 20000, { academicYearId: '2025' }), payment('other-term', 20000, { termId: 'term2' })];
  assert.equal(getFeeReminderProgress(promiseFixture, ledger, due).paid, 0);
});

test('creation and deadline are inclusive; old records, future dates and invalid amounts are excluded', () => {
  const ledger = [payment('old-payment', 20000), payment('too-early', 20000, { paymentDate: '2026-09-26T08:59:59+03:00' }),
    payment('start', 1000, { paymentDate: promiseFixture.createdAt }), payment('end', 2000, { paymentDate: promiseFixture.dueAt }),
    payment('future', 20000, { paymentDate: '2026-10-04T09:00:00+03:00' }), payment('bad-date', 20000, { paymentDate: 'invalid' }),
    payment('negative', -5000), payment('nan', Number.NaN)];
  assert.equal(getFeeReminderProgress(promiseFixture, ledger, due).paid, 3000);
  assert.equal(getFeeReminderProgress(promiseFixture, ledger, new Date('2026-09-28T09:00:00+03:00')).paid, 1000);
});

test('payments made after the deadline are shown separately and never count as on-time payment', () => {
  const late = payment('late', 20000, { paymentDate: '2026-10-03T09:01:00+03:00' });
  const progress = getFeeReminderProgress(promiseFixture, [late], new Date('2026-10-04T09:00:00+03:00'));
  assert.equal(progress.status, 'unpaid'); assert.equal(progress.paid, 0); assert.equal(progress.paidAfterDeadline, 20000);
});

test('carry-forward and uniform payments use their actual item and original academic period', () => {
  const carry = { ...payment('carry', 15000), feeStructureId: 'previous-balance', academicYearId: '2027', termId: 'term1',
    isCarryForwardPayment: true, originalFeeStructureId: 'tuition', originalAcademicYearId: '2026', originalTermId: 'term3' };
  assert.equal(getFeeReminderProgress(promiseFixture, [carry], due).paid, 15000);
  const otherPeriod = { ...carry, originalTermId: 'term2' };
  assert.equal(paymentMatchesReminderScope(otherPeriod, promiseFixture.scopes[0]), false);
  const scope = { ...promiseFixture.scopes[0], feeStructureId: 'uniform-track-1', feeName: 'Uniform' };
  const uniformPromise = { ...promiseFixture, feeId: scope.feeStructureId, scopes: [scope] };
  assert.equal(getFeeReminderProgress(uniformPromise, [payment('uniform', 20000, { feeStructureId: scope.feeStructureId })], due).status, 'paid');
});

test('legacy carry-forward names are accepted only when all three names match', () => {
  const carry = { ...payment('legacy', 15000), feeStructureId: 'previous-balance', isCarryForwardPayment: true,
    carryForwardItemName: ' Tuition ', originalYear: '2026', originalTerm: 'term 3' };
  assert.equal(paymentMatchesReminderScope(carry, promiseFixture.scopes[0]), true);
  const otherYear = { ...carry, originalYear: '2025' };
  assert.equal(paymentMatchesReminderScope(otherYear, promiseFixture.scopes[0]), false);
});

test('previous balance scopes and duplicate record IDs never double-count one payment', () => {
  const note = { ...promiseFixture, feeId: 'previous-balance', scopes: [promiseFixture.scopes[0], { ...promiseFixture.scopes[0] }] };
  const one = payment('one', 15000);
  assert.equal(getFeeReminderProgress(note, [one, one], due).paid, 15000);
});

test('a future promise reports current progress without an overdue call message', () => {
  const now = new Date('2026-10-01T09:00:00+03:00');
  const progress = getFeeReminderProgress(promiseFixture, [payment('one', 15000)], now);
  assert.equal(progress.overdue, false); assert.doesNotMatch(feeReminderOutcomeText(promiseFixture, progress), /Call/);
});

test('dates and times are validated in East Africa time, including real calendar days', () => {
  const now = new Date('2026-10-01T08:00:00+03:00');
  assert.equal(parseFeeReminderSchedule('2026-10-03', '09:15', now).toISOString(), '2026-10-03T06:15:00.000Z');
  for (const [date, time] of [['2026-02-30', '09:00'], ['2026-10-01', '07:59'], ['2026-10-03', '24:00'], ['2028-10-03', '09:00']]) {
    assert.throws(() => parseFeeReminderSchedule(date, time, now));
  }
  assert.equal(normalizeReminderPhone('+256 (700) 123-456'), '+256700123456');
  assert.throws(() => normalizeReminderPhone('not a phone'));
});

test('all active Fees users receive reminders; only fee collectors with edit authority create notes', () => {
  const base = { id: 'staff', username: 'staff', role: 'Staff', isActive: true, createdAt: '' } as SystemUser;
  const viewer = { ...base, modulePermissions: [{ module: 'fees', permission: 'view_only' }] } as SystemUser;
  const editor = { ...base, modulePermissions: [{ module: 'fees', permission: 'edit' }] } as SystemUser;
  const structureOnly = { ...base, granularPermissions: [{ moduleId: 'fees', pages: [{ pageId: 'list', canAccess: true, actions: [] }] }] } as SystemUser;
  assert.equal(canReadFeeReminders(viewer), true); assert.equal(canManageFeeReminders(viewer), false);
  assert.equal(canManageFeeReminders(editor), true); assert.equal(canReceiveFeeReminders(structureOnly), true);
  assert.equal(canReadFeeReminders(structureOnly), false); assert.equal(canReceiveFeeReminders({ ...editor, isActive: false }), false);
  assert.equal(canReceiveFeeReminders({ ...editor, role: 'Parent' }), false); assert.equal(canReceiveFeeReminders(base), false);
});
