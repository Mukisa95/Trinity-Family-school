import assert from 'node:assert/strict';
import test from 'node:test';
import { applyFeesSMSTextCase, buildFeesSMSPreview, feesSMSSegments, formatFeesSMSPupilName, normalizeFeesSMSPhone, sendFeesSMSMessages, usesSMSCustomisation, type FeesSMSContext, type FeesSMSDelivery } from '@/lib/utils/fees-sms';
import type { SMSRequest, SMSResponse } from '@/lib/services/sms.service';

const guardian = { id: 'g', firstName: 'Jane', lastName: 'Parent', phone: '0700123456', relationship: 'Mother' };
const context = {
  pupils: [
    { id: 'alice', firstName: 'Alice', lastName: 'Test', admissionNumber: '001', classId: 'p1', guardians: [guardian, { ...guardian, phone: '+256 700 123 456' }] },
    { id: 'ben', firstName: 'Ben', lastName: 'Test', admissionNumber: '002', classId: 'p1', guardians: [guardian] },
  ],
  classes: [{ id: 'p1', name: 'Primary One' }], yearName: '2026', termName: 'Term 3',
  pupilFeesInfo: {
    alice: { totalFees: 120000, totalPaid: 60000, balance: 60000, applicableFees: [{ feeStructureId: 'transport', name: 'Transport', amount: 20000, paid: 20000, balance: 0 }] },
    ben: { totalFees: 130000, totalPaid: 100000, balance: 30000, applicableFees: [{ feeStructureId: 'transport', name: 'Transport', amount: 30000, paid: 0, balance: 30000 }] },
  },
} as unknown as FeesSMSContext;

test('replaces every automatic field using the selected period and each pupil', () => {
  const preview = buildFeesSMSPreview('{guardian_name}: {pupil_name}, {class}, {admission_number}; {fee_item}; {total_fees}/{amount_paid}/{balance}; {term} {year}', 'first', context);
  assert.deepEqual(preview.issues, []);
  assert.equal(preview.messages.length, 2);
  assert.match(preview.messages[0].message, /Jane Parent: .*Alice.*Primary One, 001; all fees; Shs\. 120,000\/Shs\. 60,000\/Shs\. 60,000; Term 3 2026/);
  assert.match(preview.messages[1].message, /Ben.*Shs\. 130,000\/Shs\. 100,000\/Shs\. 30,000/);
});

test('selected fee amounts include genuine zero balances without falling back to whole-pupil totals', () => {
  const preview = buildFeesSMSPreview('{pupil_name}: {fee_item}, {total_fees}, {amount_paid}, {balance}', 'first', { ...context, selectedFeeId: 'transport' });
  assert.deepEqual(preview.issues, []);
  assert.match(preview.messages[0].message, /Transport, Shs\. 20,000, Shs\. 20,000, Shs\. 0/);
  assert.match(preview.messages[1].message, /Transport, Shs\. 30,000, Shs\. 0, Shs\. 30,000/);
});

test('siblings sharing a number keep distinct messages; identical texts and duplicate guardian numbers send once', () => {
  const personalised = buildFeesSMSPreview('{pupil_name}: {balance}', 'both', context);
  assert.equal(personalised.messages.length, 2);
  assert.equal(new Set(personalised.messages.map(item => item.phone)).size, 1);
  const plain = buildFeesSMSPreview('School opens tomorrow.', 'both', context);
  assert.equal(plain.messages.length, 1);
  assert.equal(plain.messages[0].pupilNames.length, 2);
  assert.equal(buildFeesSMSPreview('Hello {guardian_name}', 'second', context).skipped.length, 1);
  const sharedParentPhone = { ...context, pupils: [{ ...context.pupils[0], guardians: [guardian, { ...guardian, firstName: 'John', phone: '+256700123456' }] }] };
  assert.equal(buildFeesSMSPreview('{guardian_name}: {pupil_name}', 'both', sharedParentPhone).messages.length, 1);
});

test('missing calculations, selected fees, names, unknown fields, malformed fields, and loading cannot silently become zero', () => {
  for (const modified of [
    { ...context, pupilFeesInfo: {} },
    { ...context, selectedFeeId: 'missing' },
    { ...context, isFeesLoading: true },
    { ...context, feesError: 'Failed to calculate fees' },
  ]) assert.ok(buildFeesSMSPreview('{balance}', 'first', modified).issues.length);
  assert.ok(buildFeesSMSPreview('{year}', 'first', { ...context, yearName: '' }).issues.length);
  for (const template of ['{unknown}', '{balance', '{{balance}}', '  ']) {
    assert.ok(buildFeesSMSPreview(template, 'first', context).issues.length);
  }
  assert.deepEqual(buildFeesSMSPreview('{pupil_name}', 'first', { ...context, isFeesLoading: true }).issues, []);
  assert.ok(buildFeesSMSPreview('Hello', 'first', { ...context, pupils: [] }).issues.length);
});

test('missing and invalid guardian phones are listed as skipped', () => {
  const invalid = { ...context, pupils: context.pupils.map(pupil => ({ ...pupil, guardians: [{ ...guardian, phone: 'not a phone' }] })) };
  const preview = buildFeesSMSPreview('Hello', 'first', invalid);
  assert.equal(preview.messages.length, 0);
  assert.equal(preview.skipped.length, 2);
  assert.ok(preview.issues.length);
  assert.equal(normalizeFeesSMSPhone('0700 123-456'), '+256700123456');
  assert.equal(normalizeFeesSMSPhone('256700123456'), '+256700123456');
  assert.equal(normalizeFeesSMSPhone('700123456'), '+256700123456');
  assert.equal(normalizeFeesSMSPhone('+44 7700 900123'), '+447700900123');
  assert.equal(normalizeFeesSMSPhone('123'), null);
});

test('SMS segments count final GSM, extension and Unicode text', () => {
  assert.equal(feesSMSSegments(''), 0);
  assert.equal(feesSMSSegments('a'.repeat(160)), 1);
  assert.equal(feesSMSSegments('a'.repeat(161)), 2);
  assert.equal(feesSMSSegments('a'.repeat(306)), 2);
  assert.equal(feesSMSSegments('^'.repeat(81)), 2);
  assert.equal(feesSMSSegments('中'.repeat(70)), 1);
  assert.equal(feesSMSSegments('中'.repeat(71)), 2);
  assert.equal(feesSMSSegments('😀'.repeat(36)), 2);
});

const accepted: SMSResponse = { success: true, message: 'Accepted', recipientCount: 1, messageId: 'test' };

test('bulk SMS honours the selected guardians and all their additional phone targets', () => {
  const recipients = [
    { ...guardian, firstName: 'Selected guardian', phone: '0700111222' },
    { ...guardian, firstName: 'Selected guardian', phone: '0700333444' },
    { ...guardian, firstName: 'Selected guardian', phone: '0700555666' },
  ];
  const preview = buildFeesSMSPreview('{guardian_name}: {pupil_name}', 'first', {
    ...context, pupils: [context.pupils[0]], recipientGuardians: { alice: recipients },
  });
  assert.deepEqual(preview.issues, []);
  assert.equal(preview.messages.length, 3);
  assert.ok(preview.messages.every(item => item.message.startsWith('Selected guardian Parent:')));
  assert.deepEqual(preview.messages.map(item => item.phone), ['+256700111222', '+256700333444', '+256700555666']);
});

test('manual numbers receive plain/common-field text but are excluded from pupil-specific fields and balance filters', () => {
  const manual = { ...context, pupils: [], manualNumbers: ['0700111222', '+256700111222'] };
  const plain = buildFeesSMSPreview('School opens tomorrow.', 'both', manual, { messageCase: 'upper' });
  assert.deepEqual(plain.issues, []);
  assert.equal(plain.messages.length, 1);
  assert.equal(plain.messages[0].message, 'SCHOOL OPENS TOMORROW.');
  const common = buildFeesSMSPreview('{term}, {year}: {fee_item}', 'both', manual);
  assert.equal(common.messages[0].message, 'Term 3, 2026: all fees');
  for (const template of ['Dear {pupil_name}', 'Dear {guardian_name}', '{balance}', '{class}']) {
    const result = buildFeesSMSPreview(template, 'both', manual);
    assert.equal(result.messages.length, 0);
    assert.equal(result.manualSkipped.length, 2);
    assert.ok(result.issues.length);
  }
  assert.equal(buildFeesSMSPreview('Hello', 'both', manual, { minimumBalance: '10000' }).manualSkipped.length, 2);
  const mixed = buildFeesSMSPreview('{pupil_name}', 'first', { ...context, manualNumbers: ['0700111222'] });
  assert.equal(mixed.messages.length, 2);
  assert.equal(mixed.manualSkipped.length, 1);
});

test('normal drafts retain the existing bulk-send flow; automatic fields and non-default settings require personalised review', () => {
  assert.equal(usesSMSCustomisation('Normal message.', {}), false);
  assert.equal(usesSMSCustomisation('Normal message.', { nameFormat: 'all', nameCase: 'unchanged', messageCase: 'unchanged', minimumBalance: '' }), false);
  for (const message of ['Hello {pupil_name}', '{unknown}', 'Hello {']) assert.equal(usesSMSCustomisation(message, {}), true);
  assert.equal(usesSMSCustomisation('Hello', { minimumBalance: '0' }), true);
  assert.equal(usesSMSCustomisation('Hello', { messageCase: 'upper' }), true);
});

test('balance exclusions use the selected fee and include the exact threshold', () => {
  const selected = { ...context, selectedFeeId: 'transport' };
  const preview = buildFeesSMSPreview('{pupil_name}: {balance}', 'first', selected, { minimumBalance: '10000' });
  assert.deepEqual(preview.issues, []);
  assert.equal(preview.messages.length, 1);
  assert.match(preview.messages[0].message, /Ben/);
  assert.equal(preview.excluded.length, 1);
  assert.match(preview.excluded[0], /Alice.*Shs\. 0.*Shs\. 10,000/);
  assert.equal(buildFeesSMSPreview('{pupil_name}', 'first', selected, { minimumBalance: '30000' }).messages.length, 1);
  assert.equal(buildFeesSMSPreview('{pupil_name}', 'first', selected, { minimumBalance: '30001' }).messages.length, 0);
  assert.equal(buildFeesSMSPreview('{pupil_name}', 'first', context, { minimumBalance: '10000' }).messages.length, 2);
  assert.equal(buildFeesSMSPreview('{pupil_name}', 'first', selected).excluded.length, 0);
});

test('exclusions require valid completed balances even when the message has no financial fields', () => {
  for (const changed of [
    { ...context, pupilFeesInfo: {} }, { ...context, selectedFeeId: 'missing' },
    { ...context, isFeesLoading: true }, { ...context, feesError: 'Could not load' },
  ]) assert.ok(buildFeesSMSPreview('Hello {pupil_name}', 'first', changed, { minimumBalance: '10000' }).issues.length);
  for (const threshold of ['-1', 'not a number', 'Infinity', '1.5', '100000000000000000000']) {
    assert.ok(buildFeesSMSPreview('Hello', 'first', context, { minimumBalance: threshold }).issues.length);
  }
  const credit = { ...context, pupilFeesInfo: { ...context.pupilFeesInfo, alice: { ...context.pupilFeesInfo.alice!, balance: -1000 } } };
  assert.equal(buildFeesSMSPreview('Hello {pupil_name}', 'first', credit, { minimumBalance: '0' }).excluded.length, 1);
});

test('name formats use surname, first name, both, or all available names without altering stored pupils', () => {
  const pupil = { ...context.pupils[0], firstName: 'Alice', lastName: 'Test', otherNames: 'Grace' };
  assert.equal(formatFeesSMSPupilName(pupil, 'surname'), 'Test');
  assert.equal(formatFeesSMSPupilName(pupil, 'first'), 'Alice');
  assert.equal(formatFeesSMSPupilName(pupil, 'both'), 'Test Alice');
  assert.equal(formatFeesSMSPupilName(pupil, 'all'), 'Test Alice Grace');
  const preview = buildFeesSMSPreview('Dear {pupil_name}.', 'first', { ...context, pupils: [pupil] }, { nameFormat: 'surname', nameCase: 'upper' });
  assert.equal(preview.messages[0].message, 'Dear TEST.');
  assert.equal(pupil.lastName, 'Test');
  assert.ok(buildFeesSMSPreview('{pupil_name}', 'first', { ...context, pupils: [{ ...pupil, firstName: '' }] }, { nameFormat: 'first' }).issues.length);
});

test('case conversion resolves fields first, preserves line breaks and recomputes final SMS segments', () => {
  assert.equal(applyFeesSMSTextCase('hello ALICE. HOW ARE YOU?\nPLEASE PAY!', 'sentence'), 'Hello alice. How are you?\nPlease pay!');
  assert.equal(applyFeesSMSTextCase('TEST ALICE-GRACE', 'title'), 'Test Alice-Grace');
  assert.equal(applyFeesSMSTextCase('Hello Alice', 'lower'), 'hello alice');
  assert.equal(applyFeesSMSTextCase('Dear Alice', 'unchanged'), 'Dear Alice');
  const preview = buildFeesSMSPreview('Dear {pupil_name},\nBalance: {balance}.', 'first', context, { nameFormat: 'first', messageCase: 'upper' });
  assert.equal(preview.messages[0].message, 'DEAR ALICE,\nBALANCE: SHS. 60,000.');
  assert.equal(preview.messages[0].segments, feesSMSSegments(preview.messages[0].message));
  const long = buildFeesSMSPreview('a'.repeat(159) + '{pupil_name}', 'first', { ...context, pupils: [{ ...context.pupils[0], firstName: 'ß' }] }, { nameFormat: 'first', messageCase: 'upper' });
  assert.equal(long.messages[0].message.length, 161);
  assert.equal(long.messages[0].segments, 2);
});

test('sends the exact reviewed text to each number through the existing service', async () => {
  const messages = buildFeesSMSPreview('{pupil_name} {balance}', 'first', context).messages;
  const requests: SMSRequest[] = [];
  const results: FeesSMSDelivery[] = [];
  await sendFeesSMSMessages(messages, 'Staff', async request => { requests.push(request); return accepted; }, result => results.push(result));
  assert.deepEqual(requests, messages.map(item => ({ message: item.message, recipients: [item.phone], sentBy: 'Staff' })));
  assert.deepEqual(results.map(item => item.status), ['sent', 'sent']);
});

test('stops on failure, partial success, and lost response without automatically retrying', async () => {
  const messages = buildFeesSMSPreview('{pupil_name}', 'first', context).messages;
  for (const response of [
    { ...accepted, success: false },
    { ...accepted, details: { total: 1, successful: 0, failed: 1 } },
    { ...accepted, recipientCount: 0 },
    null,
  ]) {
    let calls = 0;
    const results: FeesSMSDelivery[] = [];
    await sendFeesSMSMessages(messages, 'Staff', async () => { calls++; if (!response) throw new Error('Response lost'); return response; }, result => results.push(result));
    assert.equal(calls, 1);
    assert.equal(results[0].status, 'review');
    const pending = messages.filter(item => !results.some(result => result.id === item.id));
    assert.deepEqual(pending, [messages[1]]);
    await sendFeesSMSMessages(pending, 'Staff', async () => { calls++; return accepted; }, result => results.push(result));
    assert.equal(calls, 2);
    assert.deepEqual(results.map(item => item.status), ['review', 'sent']);
  }
});
