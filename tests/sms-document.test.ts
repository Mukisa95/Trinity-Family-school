import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFeesSMSPreview, usesSMSCustomisation, type FeesSMSContext } from '@/lib/utils/fees-sms';
import { SMS_DOCUMENT_PREFIX, readSMSDocument, writeSMSDocument, smsDocumentText, formatSMSTerm, type SMSField, type SMSFieldFormat, type SMSPart } from '@/lib/utils/sms-document';

let id = 0;
const field = (name: SMSField, format: SMSFieldFormat = {}): SMSPart => ({ type: 'field', id: `field-${++id}`, field: name, format });
const text = (value: string): SMSPart => ({ type: 'text', text: value });
const context = {
  pupils: [
    { id: 'paid', firstName: 'Alice', lastName: 'TEST', otherNames: 'Grace', payCode: '001234', admissionNumber: '001', classId: 'p1', guardians: [{ firstName: 'Jane', lastName: 'DOE', phone: '0700123456' }] },
    { id: 'owes', firstName: 'Ben', lastName: 'TEST', payCode: '009876', admissionNumber: '002', classId: 'p1', guardians: [{ firstName: 'John', lastName: 'DOE', phone: '0700654321' }] },
  ],
  classes: [{ id: 'p1', name: 'Primary One', code: 'P.1' }], termName: 'Term One', termNumber: 1, yearName: 'Academic Year 2026',
  selectedFeeId: 'transport', feeItemName: 'Transport', pupilFeesInfo: {
    paid: { balance: 20000, applicableFees: [{ feeStructureId: 'transport', balance: 0, amount: 30000, paid: 30000 }] },
    owes: { balance: 50000, applicableFees: [{ feeStructureId: 'transport', balance: 12000, amount: 30000, paid: 18000 }] },
  },
} as unknown as FeesSMSContext;
const preview = (parts: SMSPart[], changes: Partial<FeesSMSContext> = {}) => buildFeesSMSPreview(writeSMSDocument(parts), 'first', { ...context, ...changes });

test('plain drafts remain ordinary text while structured drafts round-trip with human labels', () => {
  assert.equal(writeSMSDocument([text('Hello '), text('everyone')]), 'Hello everyone');
  const parts = [text('Hello '), field('pupil_name'), text(', code '), field('schoolpay_code')];
  const saved = writeSMSDocument(parts);
  assert.deepEqual(readSMSDocument(saved), { parts, issues: [] });
  assert.equal(smsDocumentText(saved), 'Hello Pupil name, code SchoolPay code');
  assert.equal(usesSMSCustomisation(saved, {}), true);
  assert.equal(readSMSDocument('Dear {pupil_name}').parts[1].type, 'field');
});

test('each field occurrence keeps its own name format and case', () => {
  const result = preview([field('pupil_name', { name: 'first', textCase: 'upper' }), text(' / '), field('pupil_name', { name: 'surname', textCase: 'title' }), text(' / '), field('guardian_name', { name: 'surname', textCase: 'lower' })]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.messages[0].message, 'ALICE / Test / doe');
  assert.equal(context.pupils[0].lastName, 'TEST');
});

test('class, term, year, amounts and SchoolPay identifier use field-specific choices', () => {
  const result = preview([field('class', { class: 'code' }), text(' / '), field('class', { class: 'both', textCase: 'upper' }), text(' / '), field('term', { term: 'short' }), text(' / '), field('term', { term: 'number' }), text(' / '), field('term', { term: 'words', textCase: 'upper' }), text(' / '), field('year', { year: 'numbers' }), text(' / '), field('balance', { amount: 'plain' }), text(' / '), field('total_fees', { amount: 'number' }), text(' / '), field('schoolpay_code', { label: true })]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.messages[0].message, 'P.1 / PRIMARY ONE (P.1) / T 1 / Term 1 / TERM ONE / 2026 / 0 / 30,000 / SchoolPay code: 001234');
  assert.equal(formatSMSTerm('Term Three', 'number'), 'Term 3');
  assert.equal(formatSMSTerm('Second session', 'short', 2), 'T 2');
  assert.equal(formatSMSTerm('Summer', 'words'), 'Summer');
});

test('conditional sections omit only selected content for zero/credit balances in the selected fee', () => {
  const parts: SMSPart[] = [text('Dear '), field('pupil_name', { name: 'first' }), text('.\n'), { type: 'balance', id: 'condition', children: [text('Please pay '), field('balance'), text('. SchoolPay: '), field('schoolpay_code'), text('\n')] }, text('School opens Monday.')];
  const result = preview(parts);
  assert.deepEqual(result.issues, []);
  assert.equal(result.messages.length, 2);
  assert.equal(result.excluded.length, 0);
  assert.equal(result.messages[0].message, 'Dear Alice.\nSchool opens Monday.');
  assert.equal(result.messages[1].message, 'Dear Ben.\nPlease pay Shs. 12,000. SchoolPay: 009876\nSchool opens Monday.');
  const credit = preview(parts, { pupilFeesInfo: { ...context.pupilFeesInfo, paid: { ...context.pupilFeesInfo.paid!, applicableFees: [{ ...context.pupilFeesInfo.paid!.applicableFees[0], balance: -100 }] } } });
  assert.equal(credit.messages[0].message, result.messages[0].message);
  assert.equal(preview(parts, { pupilFeesInfo: {} }).messages.length, 0);
  assert.ok(preview(parts, { pupilFeesInfo: {} }).issues.some(issue => issue.includes('unavailable')));
  assert.ok(preview(parts, { isFeesLoading: true }).issues.length);
});

test('missing fields block sending unless explicitly omitted; hidden conditional fields are not required', () => {
  const missing = { pupils: [{ ...context.pupils[0], payCode: undefined }] };
  assert.match(preview([field('schoolpay_code')], missing).issues.join(), /missing SchoolPay code/);
  assert.equal(preview([text('Hello'), field('schoolpay_code', { omitIfMissing: true })], missing).messages[0].message, 'Hello');
  const conditional: SMSPart[] = [text('Hello'), { type: 'balance', id: 'condition', children: [field('schoolpay_code')] }];
  assert.deepEqual(preview(conditional, missing).issues, []);
  assert.ok(preview([field('class', { class: 'code' })], { classes: [] }).issues.length);
});

test('main bulk SMS rejects every financial field and condition, including restored legacy templates', () => {
  for (const name of ['balance', 'fee_item', 'total_fees', 'amount_paid'] as SMSField[]) {
    assert.ok(preview([field(name)], { allowFees: false }).issues.some(issue => issue.includes('only on Fees Collection')));
    assert.equal(buildFeesSMSPreview(`{${name}}`, 'first', { ...context, allowFees: false }).messages.length, 0);
  }
  assert.ok(preview([{ type: 'balance', id: 'condition', children: [text('Pay now')] }], { allowFees: false }).issues.length);
  assert.ok(buildFeesSMSPreview('Hello', 'first', { ...context, allowFees: false }, { minimumBalance: '0' }).issues.length);
  const allowed = preview([field('pupil_name'), text(' '), field('schoolpay_code'), text(' '), field('term')], { allowFees: false, pupilFeesInfo: {}, isFeesLoading: true });
  assert.deepEqual(allowed.issues, []);
  assert.ok(!allowed.scope.includes('fees'));
});

test('malformed or duplicate document fields never reach SMS sending', () => {
  const f = field('pupil_name');
  for (const raw of ['invalid json', JSON.stringify([{ ...f, field: 'unknown' }]), JSON.stringify([f, f]), JSON.stringify([{ ...f, format: { textCase: 'bad' } }]), JSON.stringify([{ type: 'balance', id: 'broken', children: null }])]) {
    const value = SMS_DOCUMENT_PREFIX + raw;
    assert.ok(readSMSDocument(value).issues.length);
    const result = buildFeesSMSPreview(value, 'first', context);
    assert.equal(result.messages.length, 0);
    assert.ok(result.issues.length);
  }
  assert.ok(preview([field('pupil_name'), text(' {unknown}')]).issues.length);
  assert.ok(preview([field('pupil_name'), text(' {balance}')]).issues.length);
});

test('manual numbers can use common chip formats but never pupil codes or conditional sections', () => {
  const manual = { ...context, pupils: [], manualNumbers: ['0700111222'], allowFees: false };
  const result = buildFeesSMSPreview(writeSMSDocument([field('term', { term: 'short', textCase: 'upper' }), text(' '), field('year', { year: 'numbers' })]), 'both', manual);
  assert.equal(result.messages[0].message, 'T 1 2026');
  const code = buildFeesSMSPreview(writeSMSDocument([field('schoolpay_code')]), 'both', manual);
  assert.equal(code.messages.length, 0);
  assert.equal(code.manualSkipped.length, 1);
});
