import 'server-only';
import {randomUUID} from 'crypto';
import {FieldValue, getFirestore, Timestamp} from 'firebase-admin/firestore';
import {getFirebaseAdminApp} from '@/lib/firebase-admin';
import {publishFeeNotesSwitch} from '@/lib/server/fee-notes-gate';
import {updatePupilWithCacheRevision} from '@/lib/server/pupil-cache-revisions.admin';
import {FEE_REMINDER_COLLECTION, canReadFeeReminders, canReceiveFeeReminders} from '@/lib/fees/fee-reminders';
import {serializeFeeReminder, sendFeeReminderResolutionPush, reconcileFeeReminders, FEE_REMINDER_TARGETS} from '@/lib/server/fee-reminders';
import {SCHEDULED_DISPATCH_QUEUE} from '@/lib/server/scheduled-dispatch-queue';
import type {SystemUser} from '@/types';

export async function setPupilFeeNotesSwitch(pupilId: string, enabled: boolean, actor: SystemUser) {
  const db = getFirestore(getFirebaseAdminApp()), ref = db.collection('pupils').doc(pupilId), owner = randomUUID();
  await db.runTransaction(async tx => {
    const pupil = await tx.get(ref);
    if (!pupil.exists) throw new Error('PUPIL_NOT_FOUND');
    if (Number(pupil.data()?.feeNotesSwitchLease?.until || 0) > Date.now()) throw new Error('SWITCH_BUSY');
    tx.update(ref, {feeNotesSwitchLease: {owner, until: Date.now() + 120_000}});
  });
  try {return await applyPupilFeeNotesSwitch(pupilId, enabled, actor);}
  finally {
    await db.runTransaction(async tx => {
      const pupil = await tx.get(ref);
      if (pupil.data()?.feeNotesSwitchLease?.owner === owner) tx.update(ref, {feeNotesSwitchLease: FieldValue.delete()});
    });
  }
}

async function applyPupilFeeNotesSwitch(pupilId: string, enabled: boolean, actor: SystemUser) {
  const db = getFirestore(getFirebaseAdminApp()), pupilRef = db.collection('pupils').doc(pupilId);
  // Disable the external gate first. A failed cleanup can never leave the
  // feature running after a successful switch-off.
  if (!enabled) await publishFeeNotesSwitch(pupilId, false);
  await updatePupilWithCacheRevision(db, pupilRef, {feeNotesEnabled: enabled, updatedAt: FieldValue.serverTimestamp()});
  if (enabled) {
    try {await publishFeeNotesSwitch(pupilId, true);}
    catch (error) {await updatePupilWithCacheRevision(db, pupilRef, {feeNotesEnabled: false}); throw error;}
  }
  const notes = await db.collection(FEE_REMINDER_COLLECTION).where('pupilId', '==', pupilId).get();
  const queued = await db.collection(SCHEDULED_DISPATCH_QUEUE).where('sourceId', '==', pupilId).get();
  const active = notes.docs.filter(doc => !['cancelled', 'fulfilled', 'not_triggered'].includes(doc.data().reminderStatus)
    && (doc.data().kind !== 'custom' || doc.data().reminderStatus !== 'sent' || doc.data().customDeliveryPending));
  const writes: Array<(batch: ReturnType<typeof db.batch>) => void> = [];
  for (const document of active) {
    const note = document.data(), version = Number(note.notificationVersion || 0) + 1;
    writes.push(batch => batch.update(document.ref, {featurePaused: !enabled, notificationVersion: version, updatedAt: FieldValue.serverTimestamp()}));
    writes.push(batch => batch.set(db.collection(SCHEDULED_DISPATCH_QUEUE).doc(`fee-reminder-${document.id}`), {
      channel: 'fee_reminder', sourceId: document.id, pupilId, status: enabled ? 'scheduled' : 'cancelled',
      dueAt: note.dueAt, notificationVersion: version, leaseUntil: null, attempts: 0, updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true}));
  }
  for (const job of queued.docs) if (job.data().channel === 'fee_reconcile') writes.push(batch => batch.set(job.ref,
    {status: 'cancelled', leaseUntil: null, updatedAt: FieldValue.serverTimestamp()}, {merge: true}));
  if (!enabled) writes.push(batch => batch.set(db.collection(FEE_REMINDER_TARGETS).doc(pupilId),
    {entries: {}, feeIds: [], updatedAt: FieldValue.serverTimestamp()}));
  const resumeJob = enabled && active.length ? db.collection(SCHEDULED_DISPATCH_QUEUE).doc(`fee-reconcile-enabled-${pupilId}-${randomUUID()}`) : null;
  if (resumeJob) writes.push(batch => batch.set(resumeJob, {channel: 'fee_reconcile', sourceId: pupilId, pupilId,
    reminderIds: active.map(note => note.id), status: 'scheduled', dueAt: Timestamp.now(), leaseUntil: null, attempts: 0,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()}));
  for (let start = 0; start < writes.length; start += 400) {
    const batch = db.batch(); writes.slice(start, start + 400).forEach(write => write(batch)); await batch.commit();
  }
  if (!enabled && active.length) {
    const users = (await db.collection('system_users').where('isActive', '==', true).get()).docs
      .map(doc => ({...doc.data(), id: doc.id}) as SystemUser).filter(canReceiveFeeReminders);
    for (const document of active) {
      const note = serializeFeeReminder(document);
      const previousRef = db.collection('notifications').doc(`fee-reminder-${note.id}`), previous = await previousRef.get();
      const recipients = users.filter(user => note.recipientIds == null || note.recipientIds.includes(user.id) || previous.data()?.recipientIds?.includes(user.id));
      const version = Number(note.notificationVersion || 0) + 1;
      const title = `${note.pupilName}: Notes switched off`;
      const body = `${actor.firstName || actor.username} switched off Notes for ${note.pupilName}. This reminder is paused; do not use it for a parent follow-up. This does not confirm that fees were paid.`;
      const notificationId = `fee-notes-paused-${note.id}-v${version}`;
      if (previous.exists) await previousRef.set({description: body,
        readBy: [...new Set([...(previous.data()?.readBy || []), ...(previous.data()?.recipientIds || [])])],
        metadata: {...previous.data()?.metadata, resolved: true, featureDisabled: true}, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
      await db.collection('notifications').doc(notificationId).set({
        title, description: body, type: 'fee_reminder', status: 'completed', priority: 'medium',
        recipientIds: recipients.map(user => user.id), createdBy: actor.id, readBy: [],
        createdAt: Timestamp.now(), sentAt: Timestamp.now(), metadata: {source: 'fee-reminders', reminderId: note.id, pupilId, resolved: true, featureDisabled: true},
      });
      // This explicit switch action may send its explanation. No retry job is
      // left behind to read this pupil's notes while the switch remains off.
      try {await sendFeeReminderResolutionPush({id: note.id, notificationId, title, body, pupilId, version, allowWhileDisabled: true,
        recipientIds: recipients.map(user => user.id), collectRecipientIds: recipients.filter(canReadFeeReminders).map(user => user.id)});}
      catch (error) {console.error('Notes switched off; explanation remains in the inbox:', error);}
    }
  }
  if (enabled) {
    try {
      await reconcileFeeReminders(pupilId);
      if (resumeJob) await resumeJob.set({status: 'completed', completedAt: FieldValue.serverTimestamp()}, {merge: true});
    }
    catch (error) {console.error('Notes enabled; queued jobs will retry reconciliation:', error);}
  }
  return {enabled};
}
