import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { customFeeRows, type CustomFeeContext } from '../src/lib/fees/custom-fee-notes';
import type { AcademicYear, FeeStructure, FeesHoliday } from '../src/types';
import { currentHolidayTerm, holidayTerms, prepareFeesHolidayWrite, resolveFeesHoliday, schoolDate } from '../src/lib/utils/fees-holiday-terms';
import { calculateFeeAmountAfterDiscounts } from '../src/lib/utils/fee-discount-calculation';

const years: AcademicYear[] = [2026, 2027].map(year => ({ id: String(year), name: String(year), startDate: `${year}-01-01`, endDate: `${year}-12-31`, isLocked: false, terms: [
  { id: 't1', name: 'Term 1', startDate: `${year}-01-01`, endDate: `${year}-04-30` },
  { id: 't2', name: 'Term 2', startDate: `${year}-05-01`, endDate: `${year}-08-31` },
  { id: 't3', name: 'Term 3', startDate: `${year}-09-01`, endDate: `${year}-12-31` },
] }));
const now = new Date('2026-10-11T06:00:00Z');
const legacy: FeesHoliday = { id: 'holiday', pupilId: 'pupil', categories: ['required'], discountType: 'full', isActive: true, createdAt: '2026-01-01' };
const scheduled: FeesHoliday = { ...legacy, schedule: [
  { academicYearId: '2026', termId: 't1', discountType: 'full' },
  { academicYearId: '2027', termId: 't1', discountType: 'half' },
  { academicYearId: '2027', termId: 't3', discountType: 'off' },
] };
const fee = { id: 'tuition', amount: 100000, isRequired: true } as FeeStructure;
function payable(holiday: FeesHoliday, year: string, term: string, isRequired = true) {
  return calculateFeeAmountAfterDiscounts({ fee: { ...fee, isRequired }, allFeeStructures: [fee], academicYearId: year, termId: term, allAcademicYears: years, feesHolidays: [holiday] }).finalAmount;
}

test('full-year privileges change to half in the following year and expire by term', () => {
  for (const term of ['t1', 't2', 't3']) assert.equal(payable(scheduled, '2026', term), 0);
  for (const term of ['t1', 't2']) assert.equal(payable(scheduled, '2027', term), 50000);
  assert.equal(payable(scheduled, '2027', 't3'), 100000);
});

test('a new MOFUS privilege never changes already ended terms', () => {
  const data = prepareFeesHolidayWrite(null, { ...legacy, schedule: [{ academicYearId: '2026', termId: 't3', discountType: 'full' }] }, years, now);
  const created = { ...data, id: 'new' };
  assert.equal(payable(created, '2026', 't1'), 100000);
  assert.equal(payable(created, '2026', 't2'), 100000);
  assert.equal(payable(created, '2026', 't3'), 0);
});

test('editing a legacy discount preserves past percentage, categories and enabled state', () => {
  const old = { ...legacy, discountType: 'percentage' as const, discountValue: 75 };
  const edited = { ...prepareFeesHolidayWrite(old, { categories: ['non-required'], discountType: 'half', discountValue: undefined }, years, now), id: old.id };
  assert.equal(payable(edited, '2026', 't1'), 25000);
  assert.equal(payable(edited, '2026', 't2', false), 100000);
  assert.equal(payable(edited, '2026', 't3'), 100000);
  assert.equal(payable(edited, '2026', 't3', false), 50000);
});

test('stopping a holiday keeps waived historical balances and stops current benefits', () => {
  const stopped = { ...prepareFeesHolidayWrite(legacy, { isActive: false }, years, now), id: legacy.id };
  assert.equal(stopped.isActive, false);
  assert.equal(payable(stopped, '2026', 't1'), 0);
  assert.equal(payable(stopped, '2026', 't2'), 0);
  assert.equal(payable(stopped, '2026', 't3'), 100000);
});

test('subsequent edits and attempted forged history cannot rewrite frozen terms', () => {
  const stopped = { ...prepareFeesHolidayWrite(legacy, { isActive: false }, years, now), id: legacy.id };
  const edited = { ...prepareFeesHolidayWrite(stopped, { isActive: true, discountType: 'quarter', termHistory: [] }, years, now), id: legacy.id };
  assert.equal(payable(edited, '2026', 't1'), 0);
  assert.equal(payable(edited, '2026', 't3'), 75000);
});

test('the next edit freezes newly ended terms using their previous scheduled benefit', () => {
  const saved = { ...prepareFeesHolidayWrite(scheduled, { categories: ['required'] }, years, now), id: legacy.id };
  const edited = { ...prepareFeesHolidayWrite(saved, { isActive: false }, years, new Date('2027-06-01T06:00:00Z')), id: legacy.id };
  assert.equal(payable(edited, '2026', 't3'), 0);
  assert.equal(payable(edited, '2027', 't1'), 50000);
  assert.equal(payable(edited, '2027', 't2'), 100000);
});

test('ended-phase editing, duplicate terms and invalid percentages are rejected', () => {
  assert.throws(() => prepareFeesHolidayWrite(scheduled, { schedule: [{ academicYearId: '2026', termId: 't1', discountType: 'half' }] }, years, now), /Ended terms/);
  assert.throws(() => prepareFeesHolidayWrite(null, { ...legacy, schedule: [{ academicYearId: '2026', termId: 't1', discountType: 'full' }] }, years, now), /Ended terms/);
  assert.throws(() => prepareFeesHolidayWrite(null, { ...legacy, schedule: [{ academicYearId: '2026', termId: 't3', discountType: 'full' }, { academicYearId: '2026', termId: 't3', discountType: 'off' }] }, years, now), /Only one/);
  assert.throws(() => prepareFeesHolidayWrite(null, { ...legacy, discountType: 'percentage', discountValue: 101 }, years, now), /Percentage/);
  assert.throws(() => prepareFeesHolidayWrite(null, { ...legacy, schedule: [{ academicYearId: 'missing', termId: 't3', discountType: 'full' }] }, years, now), /no longer exists/);
  assert.throws(() => prepareFeesHolidayWrite(legacy, { pupilId: 'other' }, years, now), /another pupil/);
});

test('zero percent is valid and unknown scheduled terms fail closed', () => {
  const saved = { ...prepareFeesHolidayWrite(null, { ...legacy, schedule: [{ academicYearId: '2026', termId: 't3', discountType: 'percentage', discountValue: 0 }] }, years, now), id: 'new' };
  assert.equal(payable(saved, '2026', 't3'), 100000);
  assert.equal(resolveFeesHoliday(saved, 'unknown', 't3', years).isActive, false);
});

test('a stored calendar anchor preserves cross-year benefits with only the selected year loaded', () => {
  const saved = { ...prepareFeesHolidayWrite(null, { ...legacy, schedule: [
    { academicYearId: '2026', termId: 't3', discountType: 'full' },
    { academicYearId: '2027', termId: 't3', discountType: 'off' },
  ] }, years, now), id: 'new' };
  const selectedYear = years.filter(year => year.id === '2027');
  assert.equal(resolveFeesHoliday(saved, '2027', 't1', selectedYear).discountType, 'full');
  assert.equal(resolveFeesHoliday(saved, '2027', 't1', selectedYear).isActive, true);
  assert.equal(resolveFeesHoliday(saved, '2027', 't3', selectedYear).isActive, false);
});

test('term expiry respects the entire final school day in Nairobi', () => {
  assert.equal(schoolDate(new Date('2026-08-31T20:59:59Z')), '2026-08-31');
  assert.equal(holidayTerms(years, new Date('2026-08-31T20:59:59Z'))[1].ended, false);
  assert.equal(holidayTerms(years, new Date('2026-08-31T21:00:00Z'))[1].ended, true);
  assert.equal(currentHolidayTerm(years, now)?.termId, 't3');
});

test('Firebase reminder bundle and application agree on ended and current term balances', () => {
  const stopped = { ...prepareFeesHolidayWrite(legacy, { isActive: false }, years, now), id: legacy.id };
  const context: CustomFeeContext = { pupil: { id: 'pupil', classId: 'p4', section: 'Day', assignedFees: [] } as any,
    years, fees: [{ ...fee, name: 'Tuition', category: 'Tuition Fee', status: 'active' } as FeeStructure], holidays: [stopped],
    adjustments: [], payments: [], tracking: [], uniforms: [], className: 'Primary 4' };
  const note = { pupilId: 'pupil', createdAt: '2026-10-01', baselinePaymentIds: [], scopes: ['t1', 't3'].map(termId => ({ feeStructureId: fee.id, academicYearId: '2026', termId, feeName: 'Tuition', academicYearName: '2026', termName: termId })) };
  const rows = customFeeRows(note, context, now);
  assert.deepEqual(rows.map(row => row.balance), [0, 100000]);
  const bundled = createRequire(import.meta.url)('../src/lib/fees/reminder-engine/fee-custom-engine');
  assert.deepEqual(bundled.customFeeRows(note, context, now), rows);
});
