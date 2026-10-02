const {getFeeReminderProgress, canReceiveFeeReminders, canAccessFeeReminderPage} = require('./fee-reminder-progress');

const iso = value => typeof value?.toDate === 'function' ? value.toDate().toISOString() : value;

function makeFeeReminderResolution(note, {reason, version, now = new Date(), settlement, users, previousRecipientIds = [], cancelledByName = '', cancelReason = ''}) {
  const selected = note.recipientIds == null ? null : new Set([...note.recipientIds, ...previousRecipientIds, ...(note.customAttemptedRecipientIds || [])]);
  const eligible = users.filter(canReceiveFeeReminders).filter(user => selected === null || selected.has(user.id));
  const dateTime = value => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso(value)));
  const amount = `${Number(note.promisedAmount).toLocaleString('en-UG')} shillings`;
  const fee = note.feeName || note.scopes?.[0]?.feeName || 'fees';
  const due = dateTime(note.dueAt);
  const title = reason === 'paid' ? `${note.pupilName}: promise paid — reminder cancelled` : `${note.pupilName}: fees reminder cancelled`;
  const body = note.kind === 'custom'
    ? `The custom Fees note for ${note.pupilName}, scheduled for ${due}, was cancelled by ${cancelledByName} on ${dateTime(now)}.${cancelReason ? ` Reason: ${cancelReason}.` : ''} Note: ${note.custom?.message || ''}. Do not follow up based on this cancelled note. Cancellation does not confirm payment; check the latest Fees balance.`
    : reason === 'paid'
    ? `${note.promisedBy || 'The parent/guardian'}'s promise to pay ${amount} towards ${fee} by ${due} has been fulfilled. Full payment was recorded on ${dateTime(settlement.completedAt)}. The scheduled reminder is cancelled. No follow-up call is needed for this promise. Check the current Fees balance before discussing other payments.`
    : `The reminder for ${note.pupilName}'s ${amount} promise towards ${fee}, due ${due}, was cancelled by ${cancelledByName} on ${dateTime(now)}.${cancelReason ? ` Reason: ${cancelReason}.` : ''} Do not contact the parent based on this cancelled reminder. Cancellation does not confirm payment; check the latest Fees note and balance before any follow-up.`;
  return {id: note.id, version, reason, pupilId: note.pupilId,
    notificationId: `fee-reminder-update-${note.id}-v${version}`, title, body,
    recipientIds: eligible.map(user => user.id),
    collectRecipientIds: eligible.filter(user => canAccessFeeReminderPage(user, 'collect')).map(user => user.id),
    settledAt: settlement?.completedAt || null, paidTotal: settlement?.paid || 0,
    cancelledByName, cancelReason,
  };
}

function writeFeeReminderResolution(transaction, {db, FieldValue, note, resolution}) {
  const ref = db.collection('notifications').doc(resolution.notificationId);
  transaction.create(ref, {
    title: resolution.title, description: resolution.body, type: 'fee_reminder', priority: 'high', status: 'completed',
    recipientIds: resolution.recipientIds, recipients: [], targetGroups: [], readBy: [],
    createdBy: note.createdBy || 'system', senderSnapshot: {userId: note.createdBy || 'system', displayName: note.createdByName || 'Fees team', role: 'Staff'},
    threadId: ref.id, rootNotificationId: ref.id, threadSubject: resolution.title,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), sentAt: FieldValue.serverTimestamp(),
    enablePush: true, pushTitle: resolution.title, pushBody: resolution.body, pushUrl: '/notifications', actions: [],
    metadata: {source: 'fee-reminder-resolution', reminderId: note.id, pupilId: note.pupilId, reason: resolution.reason,
      notificationVersion: resolution.version, promisedAmount: note.promisedAmount, feeName: note.feeName || '',
      dueAt: iso(note.dueAt), settledAt: resolution.settledAt, paidTotal: resolution.paidTotal,
      cancelledByName: resolution.cancelledByName, cancelReason: resolution.cancelReason,
      collectRecipientIds: resolution.collectRecipientIds, automaticInAppFallback: true},
  });
}

async function ensureResolutionInbox({db, FieldValue, update}) {
  // The inbox listens to delivery records, so both the new explanation and old
  // follow-up need delivery changes. Preserve existing read states on retries.
  for (let start = 0; start < update.recipientIds.length; start += 200) {
    const users = update.recipientIds.slice(start, start + 200);
    const newRefs = users.map(userId => db.collection('notificationDeliveries').doc(`${update.notificationId}-${userId}`));
    const oldRefs = users.map(userId => db.collection('notificationDeliveries').doc(`fee-reminder-${update.id}-${userId}`));
    const records = await db.getAll(...newRefs, ...oldRefs);
    const batch = db.batch();
    let writes = 0;
    users.forEach((userId, index) => {
      if (!records[index].exists) {
        batch.set(newRefs[index], {id: newRefs[index].id, notificationId: update.notificationId, userId,
          method: 'in_app', status: 'sent', sentAt: FieldValue.serverTimestamp(), retryCount: 0});
        writes++;
      }
      const old = records[index + users.length];
      if (old.exists && old.data()?.status !== 'read') {
        batch.set(oldRefs[index], {status: 'read', readAt: FieldValue.serverTimestamp()}, {merge: true});
        writes++;
      }
    });
    if (writes) await batch.commit();
  }
}

/** One durable visible update per status/version; API requests and trigger retries share the lease. */
async function deliverFeeReminderResolution({db, FieldValue, id, sendDismissals}) {
  const ref = db.collection('feeReminders').doc(id);
  const claimed = await db.runTransaction(async transaction => {
    const note = await transaction.get(ref);
    const data = note.data();
    if (!data || !['fulfilled', 'cancelled'].includes(data.reminderStatus) || !data.dismissalPending || !data.resolutionNotificationId) return null;
    const [notification, users] = await Promise.all([
      transaction.get(db.collection('notifications').doc(data.resolutionNotificationId)),
      transaction.get(db.collection('system_users').where('isActive', '==', true)),
    ]);
    if (!notification.exists) throw new Error('The cancellation update is unavailable; delivery will retry.');
    if (Number(data.resolutionLeaseUntilMs || 0) > Date.now()) throw new Error('The cancellation update is already being delivered; retry later.');
    const update = notification.data();
    const eligible = users.docs.map(user => ({...user.data(), id: user.id})).filter(canReceiveFeeReminders)
      .filter(user => (update.recipientIds || []).includes(user.id));
    const recipientIds = eligible.map(user => user.id);
    transaction.update(ref, {resolutionLeaseUntilMs: Date.now() + 120_000});
    transaction.set(db.collection('notifications').doc(notification.id), {recipientIds}, {merge: true});
    return {id, version: Number(data.notificationVersion || 0), notificationId: notification.id,
      title: update.title, body: update.description, pupilId: data.pupilId,
      recipientIds, collectRecipientIds: eligible.filter(user => canAccessFeeReminderPage(user, 'collect')).map(user => user.id),
    };
  });
  if (!claimed) return false;
  try {
    await ensureResolutionInbox({db, FieldValue, update: claimed});
    await sendDismissals(claimed);
    await db.runTransaction(async transaction => {
      const latest = await transaction.get(ref);
      if (latest.data()?.notificationVersion !== claimed.version || latest.data()?.resolutionNotificationId !== claimed.notificationId) return;
      transaction.update(ref, {dismissalPending: false, resolutionLeaseUntilMs: 0});
      transaction.set(db.collection('notifications').doc(claimed.notificationId), {
        pushDeliveryStatus: 'sent', pushSentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
    });
    return true;
  } catch (error) {
    await db.runTransaction(async transaction => {
      const latest = await transaction.get(ref);
      if (latest.data()?.notificationVersion === claimed.version) transaction.update(ref, {resolutionLeaseUntilMs: 0});
    });
    throw error;
  }
}

/** Financial writes stay independent. Re-read the ledger in a transaction for every affected note. */
async function reconcilePupilFeeReminders({db, FieldValue, pupilId, now = new Date(), sendDismissals, noteSnapshots}) {
  const notes = noteSnapshots ? {docs: noteSnapshots} : await db.collection('feeReminders').where('pupilId', '==', pupilId).get();
  for (const document of notes.docs) {
    if (!document.exists || document.data()?.kind === 'custom' || document.data()?.reminderStatus === 'cancelled') continue;
    const ref = db.collection('feeReminders').doc(document.id);
    const queue = db.collection('scheduledDispatchQueue').doc(`fee-reminder-${document.id}`);
    const inbox = db.collection('notifications').doc(`fee-reminder-${document.id}`);
    const result = await db.runTransaction(async transaction => {
      const [current, payments, notification, users] = await Promise.all([
        transaction.get(ref),
        transaction.get(db.collection('payments').where('pupilId', '==', pupilId)),
        transaction.get(inbox),
        transaction.get(db.collection('system_users').where('isActive', '==', true)),
      ]);
      if (!current.exists) return null;
      const data = current.data();
      if (data.reminderStatus === 'cancelled' || data.kind === 'custom') return null;
      const note = {...data, id: current.id, createdAt: iso(data.createdAt), dueAt: iso(data.dueAt)};
      const ledger = payments.docs.map(payment => ({...payment.data(), id: payment.id, paymentDate: iso(payment.data().paymentDate)}));
      const settlement = getFeeReminderProgress({...note,
        dueAt: new Date(Math.max(Date.parse(note.dueAt), now.getTime())).toISOString()}, ledger, now);
      const notificationVersion = Number(data.notificationVersion || 0) + 1;
      if (settlement.status !== 'paid') {
        // A deletion or reversal restores the reminder using the current ledger.
        if (data.reminderStatus === 'fulfilled') {
          transaction.update(ref, {reminderStatus: 'scheduled', settledAt: null, dismissalPending: false,
            notificationVersion, resolutionLeaseUntilMs: 0, updatedAt: FieldValue.serverTimestamp()});
          transaction.set(queue, {channel: 'fee_reminder', sourceId: document.id, pupilId, status: 'scheduled',
            dueAt: data.dueAt, leaseUntil: null, attempts: 0, notificationVersion, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
        }
        return null;
      }
      const alreadyFulfilled = data.reminderStatus === 'fulfilled';
      if (alreadyFulfilled && !data.dismissalPending) return null;
      const version = alreadyFulfilled ? Number(data.notificationVersion || 0) : notificationVersion;
      const resolution = makeFeeReminderResolution(note, {
        reason: 'paid', version, now, settlement,
        users: users.docs.map(user => ({...user.data(), id: user.id})),
        previousRecipientIds: notification.data()?.recipientIds || [],
      });
      if (!alreadyFulfilled) {
        transaction.update(ref, {reminderStatus: 'fulfilled', settledAt: settlement.completedAt,
          notificationVersion: version, dismissalPending: true, resolutionNotificationId: resolution.notificationId,
          updatedAt: FieldValue.serverTimestamp()});
        transaction.set(queue, {status: 'cancelled', leaseUntil: null, notificationVersion: version, lastOutcome: 'Promise paid',
          updatedAt: FieldValue.serverTimestamp()}, {merge: true});
        if (notification.exists) transaction.set(inbox, {
          readBy: [...new Set([...(notification.data().readBy || []), ...(notification.data().recipientIds || [])])],
          metadata: {...notification.data().metadata, resolved: true, promiseStatus: 'paid',
            settledAt: settlement.completedAt, paidTotal: settlement.paid, shortfall: 0},
          description: resolution.body,
          updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
      }
      if (!alreadyFulfilled) writeFeeReminderResolution(transaction, {db, FieldValue, note, resolution});
      return {id: document.id};
    });
    if (result && sendDismissals) {
      await deliverFeeReminderResolution({db, FieldValue, id: result.id, sendDismissals});
    }
  }
}

module.exports = {reconcilePupilFeeReminders, makeFeeReminderResolution, writeFeeReminderResolution, deliverFeeReminderResolution};
