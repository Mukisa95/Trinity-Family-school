import type { AcademicYear, FeeAdjustmentEntry, FeeStructure, FeesHoliday, PaymentRecord, Pupil, PupilTermSnapshot, UniformTracking } from '@/types';
import type { FeeReminder, FeeReminderScope } from './fee-reminders';
import { calculateFeeAmountAfterDiscounts } from '@/lib/utils/fee-discount-calculation';
import { calculateFeeAmountForAcademicYear } from '@/lib/utils/fee-adjustments';
import { isAssignmentValidForContext } from '@/lib/utils/fee-assignment-pipeline';
import { isFeeApplicableInYear } from '@/lib/utils/fee-applicability';
import { paymentMatchesReminderScope } from './reminder-engine/fee-reminder-progress';

export const CUSTOM_NOTE_CONDITIONS = {
  scheduled: 'At the chosen date and time',
  cleared: 'Selected fees cleared — immediately',
  not_cleared: 'Selected fees not cleared by the deadline',
  paid_at_least: 'Target amount paid since this note — immediately',
  paid_below: 'Target amount not paid since this note by the deadline',
  balance_above: 'Balance above an amount at the deadline',
  no_payment: 'No payment since this note by the deadline',
} as const;
export type CustomCondition = keyof typeof CUSTOM_NOTE_CONDITIONS;
export const CUSTOM_NOTE_METRICS = {
  pupil_name: 'Pupil name', class: 'Class', fee_names: 'Fee names', fees_with_balances: 'Fees with balances',
  fees: 'Total fees', paid: 'Total paid', balance: 'Balance', paid_since_note: 'Paid since note',
  remaining_to_target: 'Remaining to target', date: 'Date', time: 'Time',
} as const;
export type CustomMetric = keyof typeof CUSTOM_NOTE_METRICS;
export type NumericMetric = 'fees' | 'paid' | 'balance' | 'paid_since_note' | 'remaining_to_target';
export interface CustomCalculationTerm {
  operator: '+' | '-'; amount?: number; metric?: NumericMetric; scopeIndexes?: number[];
}
export interface CustomNoteField {
  label: string; metric?: CustomMetric; scopeIndexes?: number[]; calculation?: CustomCalculationTerm[];
}
export interface CustomNoteSpec {
  message: string; fields: CustomNoteField[]; condition: { type: CustomCondition; amount?: number };
}
export interface CreateCustomFeeNoteInput {
  kind: 'custom'; requestId: string; pupilId: string; academicYearId: string; termId: string;
  scopes: Pick<FeeReminderScope, 'feeStructureId' | 'academicYearId' | 'termId'>[];
  custom: CustomNoteSpec; scheduleDate: string; scheduleTime: string; recipientIds?: string[] | null;
}
export interface CustomFeeContext {
  pupil: Pupil; years: AcademicYear[]; fees: FeeStructure[]; adjustments: FeeAdjustmentEntry[];
  holidays: FeesHoliday[]; payments: PaymentRecord[]; tracking: UniformTracking[];
  uniforms: Array<{ id: string; name?: string; price?: number }>; className: string;
  snapshots?: PupilTermSnapshot[];
}
export interface CustomFeeRow extends FeeReminderScope { fees: number; paid: number; balance: number; paid_since_note: number }
const numeric = new Set(['fees', 'paid', 'balance', 'paid_since_note', 'remaining_to_target']);
const idIsValid = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
export const isImmediateCustomCondition = (type: CustomCondition) => type === 'cleared' || type === 'paid_at_least';

/** Validate the bounded template language; there is no executable expression input. */
export function validateCustomNoteInput(value: unknown): CreateCustomFeeNoteInput {
  const input = value as CreateCustomFeeNoteInput;
  if (!input || input.kind !== 'custom' || ![input.requestId, input.pupilId, input.academicYearId, input.termId].every(idIsValid)) throw new Error('Choose a valid pupil and academic period.');
  if (!Array.isArray(input.scopes) || input.scopes.length > 200
    || input.scopes.some(scope => !scope || ![scope.feeStructureId, scope.academicYearId, scope.termId].every(idIsValid))
    || new Set(input.scopes.map(scope => JSON.stringify([scope.feeStructureId, scope.academicYearId, scope.termId]))).size !== input.scopes.length) throw new Error('Choose unique fee items for this note.');
  const spec = input.custom;
  if (!spec || typeof spec.message !== 'string' || !spec.message.trim() || spec.message.length > 4000
    || !Array.isArray(spec.fields) || spec.fields.length > 50 || !Object.hasOwn(CUSTOM_NOTE_CONDITIONS, spec.condition?.type)) throw new Error('Enter a note and choose a supported condition.');
  if (!input.scopes.length && spec.condition.type !== 'scheduled') throw new Error('Choose fee items for this condition.');
  if (['paid_at_least', 'paid_below', 'balance_above'].includes(spec.condition.type)
    && (!Number.isSafeInteger(spec.condition.amount) || Number(spec.condition.amount) <= 0)) throw new Error('Enter a positive whole-shilling target amount.');
  const labels = new Set<string>();
  const indexesValid = (indexes?: number[]) => indexes === undefined || Array.isArray(indexes) && indexes.length > 0
    && new Set(indexes).size === indexes.length && indexes.every(index => Number.isInteger(index) && index >= 0 && index < input.scopes.length);
  for (const field of spec.fields) {
    if (!field || typeof field.label !== 'string' || !field.label.trim() || field.label.length > 120 || /[\[\]\r\n]/.test(field.label) || labels.has(field.label)) throw new Error('Each inline field needs a unique label.');
    labels.add(field.label);
    if (!input.scopes.length && (field.metric && !['pupil_name', 'class', 'date', 'time'].includes(field.metric)
      || field.calculation?.some(term => term.metric !== undefined))) throw new Error('Choose fee items before inserting fee amounts or calculations.');
    if (!indexesValid(field.scopeIndexes)) throw new Error('An inline field uses an unavailable fee item.');
    if (field.calculation !== undefined) {
      if (field.metric !== undefined || !Array.isArray(field.calculation) || !field.calculation.length || field.calculation.length > 8) throw new Error('Choose a valid addition or subtraction.');
      for (const term of field.calculation) {
        if (!term || !['+', '-'].includes(term.operator) || !indexesValid(term.scopeIndexes)
          || (term.metric !== undefined ? !numeric.has(term.metric) || term.amount !== undefined
            : !Number.isSafeInteger(term.amount) || Number(term.amount) < 0 || Number(term.amount) > 1e12)) throw new Error('Use fee amounts or whole-shilling numbers in calculations.');
      }
    } else if (!Object.hasOwn(CUSTOM_NOTE_METRICS, field.metric || '')) throw new Error('Choose a supported inline field.');
  }
  for (const match of spec.message.matchAll(/\[([^\[\]\r\n]+)\]/g)) if (!labels.has(match[1])) throw new Error(`The inline field [${match[1]}] is missing. Insert it again or remove the brackets.`);
  if (typeof input.scheduleDate !== 'string' || typeof input.scheduleTime !== 'string') throw new Error('Choose a reminder date and time.');
  // Keep only validated fields. A caller cannot inject status, charges or notification recipients.
  return { kind: 'custom', requestId: input.requestId, pupilId: input.pupilId, academicYearId: input.academicYearId,
    termId: input.termId, scopes: input.scopes.map(({feeStructureId, academicYearId, termId}) => ({feeStructureId, academicYearId, termId})),
    custom: {message: spec.message.trim(), fields: spec.fields.map(field => ({label: field.label,
      ...(field.metric ? {metric: field.metric} : {}), ...(field.scopeIndexes ? {scopeIndexes: [...field.scopeIndexes]} : {}),
      ...(field.calculation ? {calculation: field.calculation.map(term => ({operator: term.operator,
        ...(term.metric ? {metric: term.metric} : {amount: term.amount!}), ...(term.scopeIndexes ? {scopeIndexes: [...term.scopeIndexes]} : {})}))} : {})})),
      condition: {type: spec.condition.type, ...(['paid_at_least', 'paid_below', 'balance_above'].includes(spec.condition.type) ? {amount: spec.condition.amount!} : {})}},
    scheduleDate: input.scheduleDate, scheduleTime: input.scheduleTime, ...(input.recipientIds !== undefined ? {recipientIds: input.recipientIds} : {}) };
}

/** Use the same fee eligibility, discounts, holidays and adjustments as collection. */
export function customFeeRows(note: Pick<FeeReminder, 'scopes' | 'pupilId' | 'createdAt' | 'baselinePaymentIds'> & Partial<Pick<FeeReminder, 'academicYearId' | 'termId'>>, context: CustomFeeContext, cutoff: Date, strictScopes = false): CustomFeeRow[] {
  const uniquePayments = [...new Map(context.payments.map(payment => [payment.id, payment])).values()];
  return note.scopes.map(scope => {
    const year = context.years.find(item => item.id === scope.academicYearId);
    const term = year?.terms.find(item => item.id === scope.termId);
    if (!year || !term) throw new Error('The note’s academic period is unavailable.');
    let feeName: string, payable: number;
    if (scope.feeStructureId.startsWith('uniform-')) {
      const record = context.tracking.find(item => `uniform-${item.id}` === scope.feeStructureId && item.academicYearId === year.id && item.termId === term.id);
      if (!record) throw new Error('A selected uniform fee is unavailable.');
      const ids = (Array.isArray(record.uniformId) ? record.uniformId : [record.uniformId]).filter(Boolean);
      const uniforms = ids.map(id => context.uniforms.find(item => item.id === id));
      const original = record.originalAmount ?? uniforms.reduce((sum, item, index) => sum + Number(item?.price || 0) * (record.selectedQuantities?.[ids[index]] || 1), 0);
      payable = record.finalAmount ?? original;
      feeName = record.selectionMode === 'full' ? 'Full Uniform Set' : `Uniform - ${uniforms.map(item => item?.name || 'Unknown item').join(', ')}`;
    } else {
      const fee = context.fees.find(item => item.id === scope.feeStructureId);
      if (!fee || fee.category === 'Discount' || fee.amount < 0) throw new Error('A selected fee item is unavailable.');
      feeName = fee.name;
      const assigned = !fee.isAssignmentFee || context.pupil.assignedFees?.some(item => item.feeStructureId === fee.id && isAssignmentValidForContext(item, year.id, term.id, context.years));
      // Removed assignments and disabled applicability carry no current charge.
      const historical = context.snapshots?.find(item => item.academicYearId === year.id && item.termId === term.id);
      const pupil = historical ? {...context.pupil, classId: historical.classId, section: historical.section} : context.pupil;
      const feeTerm = context.years.flatMap(item => item.terms).find(item => item.id === fee.termId);
      const order = (name: string) => name.match(/\d+/)?.[0] || ['first', 'second', 'third', 'fourth'].findIndex(word => name.toLowerCase().includes(word)) + 1 || name.trim().toLowerCase();
      const applicable = assigned && isFeeApplicableInYear(fee, year.id, context.years)
        && (fee.classFeeType !== 'specific' || !fee.classIds || fee.classIds.includes(pupil.classId))
        && (fee.sectionFeeType !== 'specific' || !fee.section || fee.section === pupil.section)
        && (!fee.termId || fee.termId === term.id || feeTerm && order(feeTerm.name) === order(term.name));
      if (strictScopes && !applicable) throw new Error('A selected fee item does not apply to this pupil and period.');
      const selectedTerm = context.years.find(item => item.id === note.academicYearId)?.terms.find(item => item.id === note.termId);
      const carry = selectedTerm && Date.parse(term.startDate) < Date.parse(selectedTerm.startDate);
      payable = !applicable ? 0 : calculateFeeAmountAfterDiscounts({
        fee: {...fee, amount: carry ? fee.amount : calculateFeeAmountForAcademicYear(fee.amount, fee.id, year.id, context.years, context.adjustments)},
        assignedFees: context.pupil.assignedFees, allFeeStructures: context.fees, academicYearId: year.id,
        termId: term.id, allAcademicYears: context.years, feesHolidays: context.holidays,
      }).finalAmount;
    }
    if (!Number.isFinite(payable) || payable < 0) throw new Error('A selected fee amount is invalid.');
    const resolvedScope = {...scope, feeName, academicYearName: year.name, termName: term.name};
    const ledger = uniquePayments.filter(payment => payment.pupilId === note.pupilId && !payment.reverted && paymentMatchesReminderScope(payment, resolvedScope)
      && Number.isFinite(Date.parse(payment.paymentDate)) && Date.parse(payment.paymentDate) <= cutoff.getTime() && Number.isFinite(payment.amount) && payment.amount > 0);
    const paid = ledger.reduce((sum, item) => sum + item.amount, 0);
    const paidSince = ledger.filter(item => !note.baselinePaymentIds.includes(item.id) && Date.parse(item.paymentDate) >= Date.parse(note.createdAt)).reduce((sum, item) => sum + item.amount, 0);
    return {...scope, feeName, academicYearName: year.name, termName: term.name, fees: payable, paid, balance: Math.max(0, payable - paid), paid_since_note: paidSince};
  });
}

export function customNoteMetric(metric: CustomMetric, indexes: number[] | undefined, rows: CustomFeeRow[], note: Pick<FeeReminder, 'pupilName' | 'custom'>, className: string, asOf: Date): string | number {
  const selected = indexes ? indexes.map(index => rows[index]).filter(Boolean) : rows;
  if (metric === 'pupil_name') return note.pupilName;
  if (metric === 'class') return className || 'Class not recorded';
  if (metric === 'fee_names') return selected.map(row => row.feeName).join(', ');
  if (metric === 'fees_with_balances') return selected.map(row => `${row.feeName}: ${formatCustomAmount(row.balance)} balance`).join('; ');
  if (metric === 'date' || metric === 'time') return new Intl.DateTimeFormat('en-GB', {timeZone: 'Africa/Nairobi',
    ...(metric === 'date' ? {day: 'numeric', month: 'long', year: 'numeric'} as const : {hour: '2-digit', minute: '2-digit'} as const)}).format(asOf);
  if (metric === 'remaining_to_target') return Math.max(0, (note.custom?.condition.amount || 0) - selected.reduce((sum, row) => sum + row.paid_since_note, 0));
  return selected.reduce((sum, row) => sum + row[metric], 0);
}
export const formatCustomAmount = (amount: number) => `${amount.toLocaleString('en-UG', {maximumFractionDigits: 2})} shillings`;
export function renderCustomNote(note: Pick<FeeReminder, 'custom' | 'pupilName'>, rows: CustomFeeRow[], className: string, asOf: Date): string {
  const spec = note.custom!;
  const values = new Map(spec.fields.map(field => {
    const value = field.calculation ? field.calculation.reduce((sum, term) => sum + (term.operator === '-' ? -1 : 1) *
      (term.metric ? Number(customNoteMetric(term.metric, term.scopeIndexes, rows, note, className, asOf)) : term.amount!), 0)
      : customNoteMetric(field.metric!, field.scopeIndexes, rows, note, className, asOf);
    return [field.label, typeof value === 'number' ? formatCustomAmount(value) : value];
  }));
  const rendered = spec.message.replace(/\[([^\[\]\r\n]+)\]/g, (token, label) => values.get(label) ?? token);
  if (rendered.length > 16000) throw new Error('The inline fields make this note too long. Choose fewer fee items or a shorter message.');
  return rendered;
}
/** Keep large messages readable in the inbox without exceeding Web Push payload limits. */
export function customNotePushBody(message: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(message).length <= 2500) return message;
  let bytes = 0, result = '';
  for (const character of message) {
    bytes += encoder.encode(character).length;
    if (bytes > 2400) break;
    result += character;
  }
  return `${result}… Open Notes for the full message.`;
}
export function customConditionMet(spec: CustomNoteSpec, rows: CustomFeeRow[]): boolean {
  if (spec.condition.type === 'scheduled') return true;
  if (!rows.length) return false;
  const balance = rows.reduce((sum, row) => sum + row.balance, 0), paid = rows.reduce((sum, row) => sum + row.paid_since_note, 0);
  switch (spec.condition.type) {
    case 'cleared': return balance === 0;
    case 'not_cleared': return balance > 0;
    case 'paid_at_least': return paid >= spec.condition.amount!;
    case 'paid_below': return paid < spec.condition.amount!;
    case 'balance_above': return balance > spec.condition.amount!;
    case 'no_payment': return paid === 0;
  }
}
