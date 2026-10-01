import 'server-only';

import { createHash } from 'crypto';
import { FieldValue, Timestamp, getFirestore, type DocumentSnapshot } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import type { AcademicYear, FeeAdjustmentEntry, FeeStructure, FeesHoliday, PaymentRecord, Pupil, SystemUser, UniformTracking } from '@/types';
import {
  FEE_REMINDER_COLLECTION, canReadFeeReminders, canReceiveFeeReminders, feeReminderScopeKey,
  feeReminderPromiseText, feeReminderOutcomeText, getFeeReminderProgress, getFeeReminderSettlement,
  normalizeReminderPhone, parseFeeReminderSchedule, paymentMatchesReminderScope,
  type CreateFeeReminderInput, type FeeReminder, type FeeReminderScope, type FeeReminderRecipient,
} from '@/lib/fees/fee-reminders';
import { calculateFeeAmountAfterDiscounts } from '@/lib/utils/fee-discount-calculation';
import { calculateFeeAmountForAcademicYear } from '@/lib/utils/fee-adjustments';
import { isAssignmentValidForContext } from '@/lib/utils/fee-assignment-pipeline';
import { isFeeApplicableInYear } from '@/lib/utils/fee-applicability';
import { SCHEDULED_DISPATCH_QUEUE } from '@/lib/server/scheduled-dispatch-queue';
import { getServerPushSubscriptionsForUsers, sendServerWebPush } from '@/lib/server/push-notifications';
import { reconcilePupilFeeReminders, makeFeeReminderResolution, writeFeeReminderResolution,
  deliverFeeReminderResolution, type FeeReminderResolutionDelivery } from '../../../functions/fee-reminder-lifecycle';
import { validateCustomNoteInput, customFeeRows, renderCustomNote, customNotePushBody, type CreateCustomFeeNoteInput } from '@/lib/fees/custom-fee-notes';
import { readCustomFeeContext, evaluateCustomFeeNote, reconcileCustomFeeNotes, type CustomFeeDelivery } from '../../../functions/custom-fee-notes';

export class FeeReminderError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function validateFeeReminderRecipients(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || !value.length || value.length > 500) {
    throw new FeeReminderError('Choose at least one recipient, or use all users with Fees access.');
  }
  const ids = value.map(id => recordId(id, 'recipient'));
  if (new Set(ids).size !== ids.length) throw new FeeReminderError('Choose each recipient only once.');
  return ids;
}

export async function listFeeReminderRecipients(): Promise<FeeReminderRecipient[]> {
  const snapshot = await getFirestore(getFirebaseAdminApp()).collection('system_users').where('isActive', '==', true).get();
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as SystemUser).filter(canReceiveFeeReminders)
    .map(user => ({ id: user.id, name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username, role: user.role }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function selectedRecipientNames(ids: string[] | null): Promise<string[]> {
  if (ids === null) return [];
  const eligible = await listFeeReminderRecipients();
  if (ids.some(id => !eligible.some(user => user.id === id))) {
    throw new FeeReminderError('Recipients must be active users with Fees access. Refresh the recipient list.');
  }
  return ids.map(id => eligible.find(user => user.id === id)!.name);
}

export async function reconcileFeeReminders(pupilId: string, now = new Date()): Promise<void> {
  await reconcilePupilFeeReminders({ db: getFirestore(getFirebaseAdminApp()), FieldValue, pupilId, now,
    sendDismissals: sendFeeReminderResolutionPush,
  });
  await reconcileCustomFeeNotes({db: getFirestore(getFirebaseAdminApp()), FieldValue, pupilId, now, sendAlert: sendCustomFeeNotePush});
}

export async function sendCustomFeeNotePush(delivery: CustomFeeDelivery): Promise<void> {
  const subscriptions = await getServerPushSubscriptionsForUsers(delivery.recipientIds);
  for (const canCollect of [true, false]) {
    const targets = subscriptions.filter(subscription => delivery.collectRecipientIds.includes(subscription.userId) === canCollect);
    if (!targets.length) continue;
    const sent = await sendServerWebPush(targets, {title: delivery.title, body: customNotePushBody(delivery.body), tag: feeReminderQueueId(delivery.id),
      url: canCollect ? `/fees/collect/${encodeURIComponent(delivery.pupilId)}?notes=open` : '/notifications',
      data: {type: 'FEE_REMINDER_ALERT', reminderId: delivery.id, version: String(delivery.version)},
    }, {urgency: 'high'});
    if (sent.failed > sent.expired + sent.rejected) throw new Error('Custom note delivery failed; it will retry.');
  }
}

export async function sendFeeReminderResolutionPush({ id, title, body, recipientIds, collectRecipientIds, version, pupilId }: FeeReminderResolutionDelivery): Promise<void> {
  const subscriptions = await getServerPushSubscriptionsForUsers(recipientIds);
  for (const canCollect of [true, false]) {
    const targets = subscriptions.filter(subscription => collectRecipientIds.includes(subscription.userId) === canCollect);
    if (!targets.length) continue;
    const result = await sendServerWebPush(targets, {
      title, body: customNotePushBody(body), tag: feeReminderQueueId(id),
      url: canCollect ? `/fees/collect/${encodeURIComponent(pupilId)}?notes=open` : '/notifications',
      data: { type: 'FEE_REMINDER_RESOLVED', reminderId: id, version: String(version) },
    }, { urgency: 'high' });
    if (result.failed > result.expired + result.rejected) throw new Error('Reminder dismissal delivery failed; the cancellation update will retry.');
  }
}

export async function updateFeeReminderRecipients(id: string, value: unknown, actor: SystemUser): Promise<FeeReminder> {
  recordId(id, 'reminder');
  const recipientIds = validateFeeReminderRecipients(value);
  const recipientNames = await selectedRecipientNames(recipientIds);
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection(FEE_REMINDER_COLLECTION).doc(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new FeeReminderError('The reminder was not found.', 404);
    const data = snapshot.data()!;
    if (data.createdBy !== actor.id && actor.role !== 'Admin') throw new FeeReminderError('Only the creator or an administrator can change recipients.', 403);
    if (!['scheduled', 'failed'].includes(data.reminderStatus)) throw new FeeReminderError('Only an active, unsent reminder can have its recipients changed.', 409);
    const queue = await transaction.get(db.collection(SCHEDULED_DISPATCH_QUEUE).doc(feeReminderQueueId(id)));
    if (queue.data()?.leaseUntil?.toDate?.().getTime() > Date.now() || Number(data.customLeaseUntilMs || 0) > Date.now() || data.customDeliveryPending && data.reminderStatus !== 'failed') throw new FeeReminderError('This reminder is being sent now. Its recipients cannot be changed.', 409);
    transaction.update(ref, { recipientIds, recipientNames, updatedAt: FieldValue.serverTimestamp() });
    return { ...serializeFeeReminder(snapshot), recipientIds, recipientNames };
  });
}

function recordId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) {
    throw new FeeReminderError(`Choose a valid ${label}.`);
  }
  return value;
}

function cleanText(value: unknown, label: string, max: number, required = true): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if ((required && !text) || text.length > max) throw new FeeReminderError(`Enter a valid ${label}.`);
  return text;
}

export function validateFeeReminderInput(body: unknown, now = new Date()): CreateFeeReminderInput | CreateCustomFeeNoteInput {
  if ((body as {kind?: string})?.kind === 'custom') {
    try {
      const input = validateCustomNoteInput(body);
      const candidate = new Date(`${input.scheduleDate}T${input.scheduleTime}:00+03:00`);
      parseFeeReminderSchedule(input.scheduleDate, input.scheduleTime, new Date(candidate.getTime() - 60_000));
      return {...input, recipientIds: validateFeeReminderRecipients(input.recipientIds)};
    } catch (error) { throw new FeeReminderError((error as Error).message); }
  }
  if (!body || typeof body !== 'object') throw new FeeReminderError('Enter the promise details.');
  const input = body as Record<string, unknown>;
  const promisedAmount = input.promisedAmount;
  if (typeof promisedAmount !== 'number' || !Number.isSafeInteger(promisedAmount) || promisedAmount <= 0) {
    throw new FeeReminderError('Enter a positive whole-shilling promised amount.');
  }
  const scheduleDate = cleanText(input.scheduleDate, 'promised date', 10);
  const scheduleTime = cleanText(input.scheduleTime, 'reminder time', 5);
  // Validate calendar syntax here; the transaction enforces future scheduling
  // after checking for a replay of an already committed request.
  const candidate = new Date(`${scheduleDate}T${scheduleTime}:00+03:00`);
  const validationClock = Number.isFinite(candidate.getTime()) ? new Date(candidate.getTime() - 60_000) : now;
  try { parseFeeReminderSchedule(scheduleDate, scheduleTime, validationClock); }
  catch (error) { throw new FeeReminderError((error as Error).message); }
  let phone: string;
  try { phone = normalizeReminderPhone(cleanText(input.phone, 'phone number', 40)); }
  catch (error) { throw new FeeReminderError((error as Error).message); }
  const feeId = recordId(input.feeId, 'fee item');
  let scopes: CreateFeeReminderInput['scopes'];
  if (feeId === 'previous-balance') {
    if (!Array.isArray(input.scopes) || !input.scopes.length || input.scopes.length > 200) {
      throw new FeeReminderError('Refresh the previous balance before creating this reminder.');
    }
    scopes = input.scopes.map((value: unknown) => {
      if (!value || typeof value !== 'object') throw new FeeReminderError('Choose a valid balance item.');
      const scope = value as Record<string, unknown>;
      return {
        feeStructureId: recordId(scope.feeStructureId, 'fee item'),
        academicYearId: recordId(scope.academicYearId, 'academic year'),
        termId: recordId(scope.termId, 'term'),
      };
    });
    if (new Set(scopes.map(feeReminderScopeKey)).size !== scopes.length) {
      throw new FeeReminderError('The selected balance contains duplicate fee items.');
    }
  }
  return {
    requestId: recordId(input.requestId, 'request'), pupilId: recordId(input.pupilId, 'pupil'), feeId,
    academicYearId: recordId(input.academicYearId, 'academic year'), termId: recordId(input.termId, 'term'),
    promisedAmount, promisedBy: cleanText(input.promisedBy, 'person who promised', 120), phone,
    additionalNote: cleanText(input.additionalNote, 'additional note', 1000, false),
    scheduleDate, scheduleTime, recipientIds: validateFeeReminderRecipients(input.recipientIds), ...(scopes ? { scopes } : {}),
  };
}

function isoValues(value: any): any {
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(isoValues);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, isoValues(item)]),
  );
  return value;
}

export function serializeFeeReminder(document: DocumentSnapshot): FeeReminder {
  const { requestFingerprint: _fingerprint, ...data } = document.data() || {};
  return isoValues({ ...data, id: document.id }) as FeeReminder;
}

export const feeReminderQueueId = (id: string) => `fee-reminder-${id}`;

export async function createFeeReminder(input: CreateFeeReminderInput | CreateCustomFeeNoteInput, actor: SystemUser): Promise<FeeReminder> {
  if (input.kind === 'custom') return createCustomFeeNote(input, actor);
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection(FEE_REMINDER_COLLECTION).doc(input.requestId);
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const recipientIds = validateFeeReminderRecipients(input.recipientIds);
  const recipientNames = await selectedRecipientNames(recipientIds);
  return db.runTransaction(async transaction => {
    const existing = await transaction.get(ref);
    if (existing.exists) {
      if (existing.data()?.createdBy !== actor.id || existing.data()?.requestFingerprint !== fingerprint) {
        throw new FeeReminderError('This request was already used for a different reminder.', 409);
      }
      return serializeFeeReminder(existing);
    }
    // Validate against the ledger without adding writes to the payment path.
    // Query reads belong to this transaction so concurrent payments trigger a retry.
    const [pupilDoc, yearsSnapshot, feesSnapshot, adjustmentsSnapshot, holidaysSnapshot, paymentsSnapshot, trackingSnapshot] = await Promise.all([
      transaction.get(db.collection('pupils').doc(input.pupilId)),
      transaction.get(db.collection('academicYears')),
      transaction.get(db.collection('feeStructures')),
      transaction.get(db.collection('feeAdjustments')),
      transaction.get(db.collection('feesHolidays').where('pupilId', '==', input.pupilId)),
      transaction.get(db.collection('payments').where('pupilId', '==', input.pupilId)),
      transaction.get(db.collection('uniformTracking').where('pupilId', '==', input.pupilId)),
    ]);
    if (!pupilDoc.exists) throw new FeeReminderError('This pupil no longer exists.', 404);
    const pupil = isoValues({ ...pupilDoc.data(), id: pupilDoc.id }) as Pupil;
    const years = yearsSnapshot.docs.map(doc => isoValues({ ...doc.data(), id: doc.id }) as AcademicYear);
    const selectedYear = years.find(year => year.id === input.academicYearId);
    const selectedTerm = selectedYear?.terms.find(term => term.id === input.termId);
    if (!selectedYear || !selectedTerm) throw new FeeReminderError('Choose an existing academic year and term.');
    const fees = feesSnapshot.docs.map(doc => isoValues({ ...doc.data(), id: doc.id }) as FeeStructure);
    const adjustments = adjustmentsSnapshot.docs.map(doc => isoValues({ ...doc.data(), id: doc.id }) as FeeAdjustmentEntry);
    const holidays = holidaysSnapshot.docs.map(doc => isoValues({ ...doc.data(), id: doc.id }) as FeesHoliday);
    const payments = paymentsSnapshot.docs.map(doc => isoValues({ ...doc.data(), id: doc.id }) as PaymentRecord);
    const tracking = trackingSnapshot.docs.map(doc => isoValues({ ...doc.data(), id: doc.id }) as UniformTracking);
    const requestedScopes = input.feeId === 'previous-balance' ? input.scopes! : [{
      feeStructureId: input.feeId, academicYearId: input.academicYearId, termId: input.termId,
    }];
    const scopes: FeeReminderScope[] = [];
    let balance = 0;
    for (const requested of requestedScopes) {
      const year = years.find(candidate => candidate.id === requested.academicYearId);
      const term = year?.terms.find(candidate => candidate.id === requested.termId);
      if (!year || !term) throw new FeeReminderError('The fee item has an invalid academic period.');
      const carryForward = input.feeId === 'previous-balance';
      if (carryForward && new Date(term.startDate).getTime() >= new Date(selectedTerm.startDate).getTime()) {
        throw new FeeReminderError('Previous balances must belong to earlier terms.');
      }
      let feeName: string;
      let payable: number;
      if (requested.feeStructureId.startsWith('uniform-')) {
        const record = tracking.find(item => `uniform-${item.id}` === requested.feeStructureId
          && item.academicYearId === year.id && item.termId === term.id);
        if (!record) throw new FeeReminderError('This uniform item does not belong to the pupil and period.');
        const uniformIds = (Array.isArray(record.uniformId) ? record.uniformId : [record.uniformId]).filter(Boolean);
        const uniformDocuments = await Promise.all(uniformIds.map(id => transaction.get(db.collection('uniforms').doc(id))));
        const names = uniformIds.map((id, index) => {
          const name = uniformDocuments[index].data()?.name || `Unknown uniform (${id})`;
          const quantity = record.selectedQuantities?.[id] || 1;
          return quantity > 1 ? `${quantity} x ${name}` : name;
        });
        const originalAmount = record.originalAmount ?? uniformDocuments.reduce((sum, doc, index) =>
          sum + Number(doc.data()?.price || 0) * (record.selectedQuantities?.[uniformIds[index]] || 1), 0);
        payable = record.finalAmount ?? originalAmount;
        feeName = record.selectionMode === 'full' ? 'Full Uniform Set' : record.selectionMode === 'item'
          ? `Uniform - ${names[0] || 'Unknown Item'}`
          : `Uniform Items (${names.slice(0, 3).join(', ')}${names.length > 3 ? '...' : ''})`;
      } else {
        const fee = fees.find(item => item.id === requested.feeStructureId);
        if (!fee || fee.category === 'Discount' || fee.amount < 0
          || !isFeeApplicableInYear(fee, year.id, years) || (carryForward && !fee.isRequired)) {
          throw new FeeReminderError('This fee item is not available in the selected period.');
        }
        if (fee.isAssignmentFee && !pupil.assignedFees?.some(assignment => assignment.feeStructureId === fee.id
          && isAssignmentValidForContext(assignment, year.id, term.id, years))) {
          throw new FeeReminderError('This fee item is not assigned to the pupil.');
        }
        feeName = fee.name;
        // Keep the same current-year adjustment and historical carry-forward basis as collection.
        const adjusted = carryForward ? fee.amount : calculateFeeAmountForAcademicYear(fee.amount, fee.id, year.id, years, adjustments);
        payable = calculateFeeAmountAfterDiscounts({
          fee: { ...fee, amount: adjusted }, assignedFees: pupil.assignedFees, allFeeStructures: fees,
          academicYearId: year.id, termId: term.id, allAcademicYears: years, feesHolidays: holidays,
        }).finalAmount;
      }
      const scope = { ...requested, feeName, academicYearName: year.name, termName: term.name };
      const paid = payments.filter(payment => !payment.reverted && paymentMatchesReminderScope(payment, scope))
        .reduce((sum, payment) => sum + Math.max(0, Number(payment.amount) || 0), 0);
      const outstanding = Math.max(0, payable - paid);
      if (!Number.isFinite(outstanding) || outstanding <= 0) {
        throw new FeeReminderError('A selected fee balance has changed. Refresh the fees and choose an unpaid item.', 409);
      }
      balance += outstanding;
      scopes.push(scope);
    }
    if (input.promisedAmount > balance) {
      throw new FeeReminderError(`The promised amount exceeds the current balance of ${balance.toLocaleString('en-UG')} shillings.`, 409);
    }
    const now = new Date();
    const dueAt = parseFeeReminderSchedule(input.scheduleDate, input.scheduleTime, now);
    const note: FeeReminder = {
      id: ref.id, kind: 'promise', pupilId: pupil.id,
      pupilName: `${pupil.firstName} ${pupil.lastName}`.trim(),
      feeId: input.feeId, feeName: input.feeId === 'previous-balance' ? 'Previous Term Balances' : scopes[0].feeName,
      academicYearId: selectedYear.id, termId: selectedTerm.id,
      academicYearName: selectedYear.name, termName: selectedTerm.name, scopes,
      promisedAmount: input.promisedAmount, promisedBy: input.promisedBy, phone: input.phone,
      additionalNote: input.additionalNote || '', balanceAtCreation: balance,
      baselinePaymentIds: payments.filter(payment => scopes.some(scope => paymentMatchesReminderScope(payment, scope))).map(payment => payment.id),
      createdAt: now.toISOString(), dueAt: dueAt.toISOString(),
      createdBy: actor.id, createdByName: `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.username,
      reminderStatus: 'scheduled', recipientIds, recipientNames, notificationVersion: 1,
    };
    transaction.create(ref, { ...note, createdAt: Timestamp.fromDate(now), dueAt: Timestamp.fromDate(dueAt), requestFingerprint: fingerprint });
    transaction.create(db.collection(SCHEDULED_DISPATCH_QUEUE).doc(feeReminderQueueId(ref.id)), {
      channel: 'fee_reminder', sourceId: ref.id, status: 'scheduled', dueAt: Timestamp.fromDate(dueAt),
      notificationVersion: 1,
      leaseUntil: null, attempts: 0, createdBy: actor.id,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return note;
  });
}

async function createCustomFeeNote(input: CreateCustomFeeNoteInput, actor: SystemUser): Promise<FeeReminder> {
  const db = getFirestore(getFirebaseAdminApp()), ref = db.collection(FEE_REMINDER_COLLECTION).doc(input.requestId);
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const recipientIds = validateFeeReminderRecipients(input.recipientIds), recipientNames = await selectedRecipientNames(recipientIds);
  const note = await db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.data()?.createdBy !== actor.id || existing.data()?.requestFingerprint !== fingerprint) throw new FeeReminderError('This request was already used for a different reminder.', 409);
      return serializeFeeReminder(existing);
    }
    const context = await readCustomFeeContext(db, tx, input.pupilId);
    const year = context.years.find(item => item.id === input.academicYearId), term = year?.terms.find(item => item.id === input.termId);
    if (!year || !term) throw new FeeReminderError('Choose an existing academic year and term.');
    const now = new Date(), due = parseFeeReminderSchedule(input.scheduleDate, input.scheduleTime, now);
    const scopes = input.scopes.map(scope => ({...scope, feeName: '', academicYearName: '', termName: ''}));
    // Existing receipts count toward fee balances but never toward a new payment target.
    const baselinePaymentIds = context.payments.map(payment => payment.id);
    let rows;
    try { rows = customFeeRows({scopes, pupilId: input.pupilId, academicYearId: input.academicYearId, termId: input.termId, createdAt: now.toISOString(), baselinePaymentIds}, context, now, true); }
    catch (error) { throw new FeeReminderError((error as Error).message); }
    const result: FeeReminder = {id: ref.id, kind: 'custom', pupilId: input.pupilId,
      pupilName: `${context.pupil.firstName} ${context.pupil.lastName}`.trim(), className: context.className,
      feeId: 'custom-selection', feeName: rows.map(row => row.feeName).join(', '), academicYearId: year.id, termId: term.id,
      academicYearName: year.name, termName: term.name, scopes: rows.map(({feeStructureId, academicYearId, termId, feeName, academicYearName, termName}) => ({feeStructureId, academicYearId, termId, feeName, academicYearName, termName})),
      promisedAmount: 0, promisedBy: '', phone: '', additionalNote: '', balanceAtCreation: rows.reduce((sum, row) => sum + row.balance, 0),
      baselinePaymentIds, custom: input.custom, createdAt: now.toISOString(), dueAt: due.toISOString(), createdBy: actor.id,
      createdByName: `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.username,
      recipientIds, recipientNames, reminderStatus: 'scheduled', notificationVersion: 1};
    try { renderCustomNote(result, rows, context.className, now); }
    catch (error) { throw new FeeReminderError((error as Error).message); }
    tx.create(ref, {...result, createdAt: Timestamp.fromDate(now), dueAt: Timestamp.fromDate(due), requestFingerprint: fingerprint});
    tx.create(db.collection(SCHEDULED_DISPATCH_QUEUE).doc(feeReminderQueueId(ref.id)), {channel: 'fee_reminder', sourceId: ref.id,
      status: 'scheduled', dueAt: Timestamp.fromDate(due), notificationVersion: 1, leaseUntil: null, attempts: 0,
      createdBy: actor.id, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()});
    return result;
  });
  // The creation trigger evaluates already-met conditions and retries independently.
  return note;
}

export async function withLiveCustomFeeDetails(notes: FeeReminder[], pupilId: string): Promise<FeeReminder[]> {
  if (!notes.some(note => note.kind === 'custom')) return notes;
  const db = getFirestore(getFirebaseAdminApp());
  const context = await db.runTransaction(tx => readCustomFeeContext(db, tx, pupilId));
  return notes.map(note => {
    if (note.kind !== 'custom') return note;
    try {
      const now = new Date(), liveFees = customFeeRows(note, context, now);
      const pupilName = `${context.pupil.firstName} ${context.pupil.lastName}`.trim();
      return {...note, className: context.className, liveFees,
        liveMessage: renderCustomNote({...note, pupilName}, liveFees, context.className, now)};
    } catch { return {...note, liveMessage: 'Current fee details are unavailable. Refresh after checking the selected items.'}; }
  });
}

export async function cancelFeeReminder(id: string, actor: SystemUser, reason = ''): Promise<{ updateStatus: 'sent' | 'pending' }> {
  recordId(id, 'reminder');
  const cancelReason = cleanText(reason, 'cancellation reason', 400, false);
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection(FEE_REMINDER_COLLECTION).doc(id);
  const queueRef = db.collection(SCHEDULED_DISPATCH_QUEUE).doc(feeReminderQueueId(id));
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new FeeReminderError('The reminder was not found.', 404);
    const data = snapshot.data()!;
    if (data.createdBy !== actor.id && actor.role !== 'Admin') {
      throw new FeeReminderError('Only the creator or an administrator can cancel this reminder.', 403);
    }
    if (data.reminderStatus === 'fulfilled') throw new FeeReminderError('The promised payment has already been received.', 409);
    if (data.reminderStatus === 'cancelled') return;
    const [queue, previous, users] = await Promise.all([
      transaction.get(queueRef),
      transaction.get(db.collection('notifications').doc(feeReminderQueueId(id))),
      transaction.get(db.collection('system_users').where('isActive', '==', true)),
    ]);
    if (queue.data()?.leaseUntil?.toDate?.().getTime() > Date.now() || Number(data.customLeaseUntilMs || 0) > Date.now()) {
      throw new FeeReminderError('This reminder is being sent now and can no longer be cancelled.', 409);
    }
    const note = serializeFeeReminder(snapshot);
    const cancelledByName = `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.username;
    const version = Number(note.notificationVersion || 0) + 1;
    const resolution = makeFeeReminderResolution(note, { reason: 'manual', version, cancelledByName, cancelReason,
      users: users.docs.map(user => ({ ...user.data(), id: user.id }) as SystemUser), previousRecipientIds: previous.data()?.recipientIds || [],
    });
    transaction.update(ref, { reminderStatus: 'cancelled', cancelledBy: actor.id, cancelledByName, cancelReason,
      cancelledAt: FieldValue.serverTimestamp(), notificationVersion: version, dismissalPending: true,
      resolutionNotificationId: resolution.notificationId, resolutionLeaseUntilMs: 0 });
    transaction.set(queueRef, {
      status: 'cancelled', leaseUntil: null, notificationVersion: version, updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (previous.exists) transaction.set(db.collection('notifications').doc(feeReminderQueueId(id)), {
      readBy: [...new Set([...(previous.data()?.readBy || []), ...(previous.data()?.recipientIds || [])])],
      metadata: { ...previous.data()?.metadata, resolved: true, cancellationReason: 'manual' }, description: resolution.body,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    writeFeeReminderResolution(transaction, { db, FieldValue, note, resolution });
  });
  try {
    await deliverFeeReminderResolution({ db, FieldValue, id, sendDismissals: sendFeeReminderResolutionPush });
    return { updateStatus: 'sent' };
  } catch (error) {
    console.error('Reminder cancelled; recipient update will retry:', id, error);
    return { updateStatus: 'pending' };
  }
}

/** Called only by the authenticated due-job dispatcher, independently of payment writes. */
export async function dispatchFeeReminder(id: string, now = new Date(), expectedVersion?: number) {
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection(FEE_REMINDER_COLLECTION).doc(id);
  const document = await ref.get();
  if (!document.exists || ['sent', 'cancelled', 'fulfilled'].includes(document.data()?.reminderStatus)) {
    return { terminal: true, skipped: true, reason: 'Reminder is no longer scheduled.' };
  }
  const note = serializeFeeReminder(document);
  if (note.kind === 'custom') return evaluateCustomFeeNote({db, FieldValue, id, now, mode: 'deadline', expectedVersion, sendAlert: sendCustomFeeNotePush});
  if (expectedVersion !== undefined && (note.notificationVersion || 0) !== expectedVersion) {
    return { terminal: true, skipped: true, reason: 'The reminder changed after this dispatch was claimed.' };
  }
  if (Date.parse(note.dueAt) > now.getTime()) throw new Error('The reminder is not due.');
  const [ledger, users] = await Promise.all([
    db.collection('payments').where('pupilId', '==', note.pupilId).get(),
    db.collection('system_users').where('isActive', '==', true).get(),
  ]);
  const recipients = users.docs.map(doc => ({ ...doc.data(), id: doc.id }) as SystemUser).filter(canReceiveFeeReminders)
    .filter(user => note.recipientIds == null || note.recipientIds.includes(user.id));
  const payments = ledger.docs.map(doc => isoValues({ ...doc.data(), id: doc.id }) as PaymentRecord);
  if (getFeeReminderSettlement(note, payments, now).status === 'paid') {
    await reconcileFeeReminders(note.pupilId, now);
    return { terminal: true, skipped: true, reason: 'The promised amount is already paid.' };
  }
  if (!recipients.length) throw new Error('No selected active users still have access to Fees.');
  let progress = getFeeReminderProgress(note, payments, now);
  const title = `${note.pupilName}: ${progress.status === 'paid' ? 'Payment promise fulfilled' : 'Promise reminder'}`;
  let body = `${feeReminderPromiseText(note, now)} ${feeReminderOutcomeText(note, progress)}${note.additionalNote ? ` ${note.additionalNote}` : ''}`;
  const notificationRef = db.collection('notifications').doc(feeReminderQueueId(id));
  const url = `/fees/collect/${encodeURIComponent(note.pupilId)}?notes=open`;
  const prepared = await db.runTransaction(async transaction => {
    const [latest, previous, latestPayments] = await Promise.all([
      transaction.get(ref), transaction.get(notificationRef),
      transaction.get(db.collection('payments').where('pupilId', '==', note.pupilId)),
    ]);
    if (!latest.exists || ['cancelled', 'fulfilled'].includes(latest.data()?.reminderStatus)) return false;
    if ((latest.data()?.notificationVersion || 0) !== (note.notificationVersion || 0)) return false;
    const liveLedger = latestPayments.docs.map(doc => isoValues({ ...doc.data(), id: doc.id }) as PaymentRecord);
    if (getFeeReminderSettlement(note, liveLedger, now).status === 'paid') return false;
    progress = getFeeReminderProgress(note, liveLedger, now);
    body = `${feeReminderPromiseText(note, now)} ${feeReminderOutcomeText(note, progress)}${note.additionalNote ? ` ${note.additionalNote}` : ''}`;
    transaction.set(notificationRef, {
      title, description: body, type: 'fee_reminder', priority: progress.status === 'paid' ? 'medium' : 'high',
      status: 'completed', recipientIds: recipients.map(user => user.id),
      recipients: note.recipientIds == null ? [{ id: 'fees', type: 'group', name: 'Users with Fees access' }]
        : recipients.map(user => ({ id: user.id, type: 'user', name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username })), targetGroups: [],
      createdBy: note.createdBy, senderSnapshot: { userId: note.createdBy, displayName: note.createdByName, role: 'Staff' },
      threadId: notificationRef.id, rootNotificationId: notificationRef.id, threadSubject: title,
      updatedAt: FieldValue.serverTimestamp(), sentAt: FieldValue.serverTimestamp(),
      enablePush: true, pushTitle: title, pushBody: body, pushUrl: url, actions: [],
      ...(!previous.exists ? { createdAt: FieldValue.serverTimestamp(), readBy: [] } : {}),
      metadata: { source: 'fee-reminders', reminderId: id, pupilId: note.pupilId, scheduledFor: note.dueAt,
        automaticInAppFallback: true, resolved: false, promiseStatus: progress.status, paidWithinPromise: progress.paid, shortfall: progress.remaining },
    }, { merge: true });
    return true;
  });
  if (!prepared) {
    await reconcileFeeReminders(note.pupilId, now);
    return { terminal: true, skipped: true, reason: 'Reminder cancelled or promise paid.' };
  }
  for (let start = 0; start < recipients.length; start += 450) {
    const batch = db.batch();
    recipients.slice(start, start + 450).forEach(user => {
      const deliveryRef = db.collection('notificationDeliveries').doc(`${notificationRef.id}-${user.id}`);
      batch.set(deliveryRef, {
        id: deliveryRef.id, notificationId: notificationRef.id, userId: user.id,
        method: 'in_app', status: 'sent', sentAt: FieldValue.serverTimestamp(), retryCount: 0,
      }, { merge: true });
    });
    await batch.commit();
  }
  const subscriptions = await getServerPushSubscriptionsForUsers(recipients.map(user => user.id));
  // Structure-only staff receive an inbox link instead of a restricted pupil page.
  const eligibleForPupil = new Set(recipients.filter(canReadFeeReminders).map(user => user.id));
  const result = { accepted: 0, failed: 0, expired: 0, rejected: 0 };
  for (const canOpenPupil of [true, false]) {
    const targets = subscriptions.filter(subscription => eligibleForPupil.has(subscription.userId) === canOpenPupil);
    if (!targets.length) continue;
    const sent = await sendServerWebPush(targets, {
      title, body, url: canOpenPupil ? url : '/notifications', tag: feeReminderQueueId(id),
      requireInteraction: true,
      data: { type: 'FEE_REMINDER_ALERT', reminderId: id, version: String(note.notificationVersion || 0) },
    }, { urgency: 'high' });
    result.accepted += sent.accepted; result.failed += sent.failed;
    result.expired += sent.expired; result.rejected += sent.rejected;
  }
  if (subscriptions.length && !result.accepted && result.failed) throw new Error('Push delivery failed; the reminder is available in the app inbox.');
  await db.runTransaction(async transaction => {
    const latest = await transaction.get(ref);
    if (['cancelled', 'fulfilled'].includes(latest.data()?.reminderStatus)) return;
    if ((latest.data()?.notificationVersion || 0) !== (note.notificationVersion || 0)) return;
    transaction.update(ref, { reminderStatus: 'sent', sentAt: FieldValue.serverTimestamp(), lastError: FieldValue.delete(),
      notificationId: notificationRef.id, deliveryResult: { ...result, inAppSent: recipients.length } });
  });
  // Catch a concurrent payment after preparing/sending the reminder.
  await reconcileFeeReminders(note.pupilId, now);
  return { terminal: true, result: { ...result, notificationId: notificationRef.id, inAppSent: recipients.length } };
}
