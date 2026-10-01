const engine = require('./fee-custom-engine');
const {canReceiveFeeReminders, canAccessFeeReminderPage} = require('./fee-reminder-progress');
const iso = value => typeof value?.toDate === 'function' ? value.toDate().toISOString() : value instanceof Date ? value.toISOString()
  : Array.isArray(value) ? value.map(iso) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, iso(item)])) : value;
const rows = snapshot => snapshot.docs.map(doc => iso({...doc.data(), id: doc.id}));

async function readCustomFeeContext(db, transaction, pupilId) {
  const [pupil, years, fees, adjustments, holidays, payments, tracking, uniforms, snapshots] = await Promise.all([
    transaction.get(db.collection('pupils').doc(pupilId)), transaction.get(db.collection('academicYears')),
    transaction.get(db.collection('feeStructures')), transaction.get(db.collection('feeAdjustments')),
    transaction.get(db.collection('feesHolidays').where('pupilId', '==', pupilId)),
    transaction.get(db.collection('payments').where('pupilId', '==', pupilId)),
    transaction.get(db.collection('uniformTracking').where('pupilId', '==', pupilId)), transaction.get(db.collection('uniforms')),
    transaction.get(db.collection('pupilTermSnapshots').where('pupilId', '==', pupilId)),
  ]);
  if (!pupil.exists) throw new Error('The pupil is unavailable.');
  const data = iso({...pupil.data(), id: pupil.id});
  const classDoc = data.classId ? await transaction.get(db.collection('classes').doc(data.classId)) : null;
  return {pupil: data, years: rows(years), fees: rows(fees), adjustments: rows(adjustments), holidays: rows(holidays),
    payments: rows(payments), tracking: rows(tracking), uniforms: rows(uniforms), snapshots: rows(snapshots), className: classDoc?.data()?.name || data.className || ''};
}

async function deliverCustomFeeNote({db, FieldValue, id, sendAlert}) {
  const ref = db.collection('feeReminders').doc(id);
  const claimed = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), note = snapshot.data();
    if (!note || note.kind !== 'custom' || !note.customDeliveryPending || ['cancelled', 'sent'].includes(note.reminderStatus)) return null;
    if (Number(note.customLeaseUntilMs || 0) > Date.now()) throw new Error('The custom note is being delivered; retry later.');
    const [notification, users] = await Promise.all([tx.get(db.collection('notifications').doc(`fee-reminder-${id}`)),
      tx.get(db.collection('system_users').where('isActive', '==', true))]);
    if (!notification.exists) throw new Error('The custom note notification is unavailable.');
    const eligible = rows(users).filter(canReceiveFeeReminders).filter(user => note.recipientIds == null || note.recipientIds.includes(user.id));
    if (!eligible.length) {
      const error = 'No selected active users still have Fees access. Choose new recipients.';
      tx.update(ref, {reminderStatus: 'failed', customLeaseUntilMs: 0, lastError: error});
      return {error};
    }
    const recipientIds = eligible.map(user => user.id);
    tx.update(ref, {customLeaseUntilMs: Date.now() + 120_000,
      customAttemptedRecipientIds: [...new Set([...(note.customAttemptedRecipientIds || []), ...recipientIds])]});
    tx.set(db.collection('notifications').doc(notification.id), {recipientIds}, {merge: true});
    return {id, version: Number(note.notificationVersion || 0), notificationId: notification.id,
      title: notification.data().title, body: notification.data().description, pupilId: note.pupilId, recipientIds,
      collectRecipientIds: eligible.filter(user => canAccessFeeReminderPage(user, 'collect')).map(user => user.id), type: 'FEE_REMINDER_ALERT'};
  });
  if (!claimed) return false;
  if (claimed.error) throw new Error(claimed.error);
  try {
    for (let start = 0; start < claimed.recipientIds.length; start += 400) {
      const ids = claimed.recipientIds.slice(start, start + 400);
      const refs = ids.map(userId => db.collection('notificationDeliveries').doc(`${claimed.notificationId}-${userId}`));
      const existing = await db.getAll(...refs), batch = db.batch();
      refs.forEach((ref, index) => { if (!existing[index].exists) batch.set(ref, {id: ref.id, notificationId: claimed.notificationId,
        userId: ids[index], method: 'in_app', status: 'sent', sentAt: FieldValue.serverTimestamp(), retryCount: 0}); });
      await batch.commit();
    }
    // A cancellation wins over a pending alert. The service worker also rejects its older version.
    const latest = (await ref.get()).data();
    if (latest?.notificationVersion !== claimed.version || latest?.reminderStatus === 'cancelled') return false;
    await sendAlert(claimed);
    await db.runTransaction(async tx => {
      const latest = await tx.get(ref);
      if (latest.data()?.notificationVersion !== claimed.version || latest.data()?.reminderStatus === 'cancelled') return;
      tx.update(ref, {reminderStatus: 'sent', customDeliveryPending: false, customLeaseUntilMs: 0, lastError: null,
        sentAt: FieldValue.serverTimestamp(), lastOutcome: 'Condition met; notification sent'});
      tx.set(db.collection('scheduledDispatchQueue').doc(`fee-reminder-${id}`), {status: 'completed', leaseUntil: null,
        updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    });
    return true;
  } catch (error) {
    await db.runTransaction(async tx => {
      const latest = await tx.get(ref);
      if (latest.data()?.notificationVersion === claimed.version && latest.data()?.reminderStatus !== 'cancelled') tx.update(ref, {
        customLeaseUntilMs: 0, reminderStatus: 'failed', lastError: String(error.message || 'Delivery failed').slice(0, 300)});
    });
    throw error;
  }
}

/** Date conditions use their deadline as the ledger cutoff, even if a job runs late. */
async function evaluateCustomFeeNote({db, FieldValue, id, now = new Date(), mode = 'live', sendAlert, expectedVersion}) {
  const ref = db.collection('feeReminders').doc(id);
  const prepared = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return false;
    const note = iso({...snapshot.data(), id});
    if (note.kind !== 'custom' || ['cancelled', 'sent', 'not_triggered'].includes(note.reminderStatus)
      || expectedVersion !== undefined && expectedVersion !== Number(note.notificationVersion || 0)) return false;
    if (note.customDeliveryPending) return true;
    const due = new Date(note.dueAt), immediate = engine.isImmediateCustomCondition(note.custom.condition.type);
    if (mode === 'live' && (!immediate || now > due)) return false;
    if (mode === 'deadline' && now < due) throw new Error('The custom note is not due.');
    const context = await readCustomFeeContext(db, tx, note.pupilId);
    const asOf = mode === 'deadline' ? due : now;
    const fees = engine.customFeeRows(note, context, asOf);
    const met = engine.customConditionMet(note.custom, fees);
    if (!met) {
      if (mode === 'deadline') tx.update(ref, {reminderStatus: 'not_triggered', evaluatedAt: asOf.toISOString(), evaluatedFees: fees,
        lastOutcome: 'Condition was not met by the deadline; no notification sent'});
      return false;
    }
    const pupilName = `${context.pupil.firstName} ${context.pupil.lastName}`.trim();
    const body = engine.renderCustomNote({...note, pupilName}, fees, context.className, asOf);
    const title = `${pupilName}: custom Fees note`;
    const notification = db.collection('notifications').doc(`fee-reminder-${id}`);
    tx.create(notification, {title, description: body, type: 'fee_reminder', priority: 'high', status: 'completed',
      recipientIds: [], recipients: [], targetGroups: [], readBy: [], createdBy: note.createdBy,
      senderSnapshot: {userId: note.createdBy, displayName: note.createdByName, role: 'Staff'}, threadId: notification.id,
      rootNotificationId: notification.id, threadSubject: title, createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(), sentAt: FieldValue.serverTimestamp(), enablePush: true, pushTitle: title,
      pushBody: body, pushUrl: `/fees/collect/${encodeURIComponent(note.pupilId)}?notes=open`, actions: [],
      metadata: {source: 'custom-fee-notes', reminderId: id, pupilId: note.pupilId, condition: note.custom.condition,
        evaluatedAt: asOf.toISOString(), evaluatedFees: fees, automaticInAppFallback: true, resolved: false}});
    tx.update(ref, {customDeliveryPending: true, customLeaseUntilMs: 0, renderedMessage: body,
      evaluatedAt: asOf.toISOString(), evaluatedFees: fees, className: context.className, pupilName});
    return true;
  });
  if (prepared && sendAlert) await deliverCustomFeeNote({db, FieldValue, id, sendAlert});
  return {terminal: true, skipped: !prepared};
}

async function reconcileCustomFeeNotes({db, FieldValue, pupilId, now = new Date(), sendAlert}) {
  const notes = await db.collection('feeReminders').where('pupilId', '==', pupilId).get();
  for (const note of notes.docs) if (note.data()?.kind === 'custom') {
    await evaluateCustomFeeNote({db, FieldValue, id: note.id, now, mode: 'live', sendAlert});
  }
}
module.exports = {readCustomFeeContext, evaluateCustomFeeNote, reconcileCustomFeeNotes, deliverCustomFeeNote};
