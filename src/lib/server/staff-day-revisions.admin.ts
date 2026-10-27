import { FieldValue, type Firestore, type Transaction, type WriteBatch } from 'firebase-admin/firestore';

type Writer = Pick<Transaction, 'set'> | Pick<WriteBatch, 'set'>;

// This is a new consumer, so no large legacy school-profile compatibility write
// is needed. Existing authenticated operational-revision listeners carry it.
export function bumpStaffClockingPolicyRevision(db: Firestore, writer: Writer, options: { enabled?: boolean; affectsEvents?: boolean } = {}) {
  (writer as Transaction).set(db.collection('settings').doc('data-revisions-operational'), {
    staffClockingPolicy: FieldValue.increment(1),
    ...(options.enabled === undefined ? {} : { staffClockingEnabled: options.enabled }),
    ...(options.affectsEvents ? { events: FieldValue.increment(1) } : {}),
  }, { merge: true });
}

export function bumpStaffClockingRecordRevision(db: Firestore, writer: Writer, staffIds: string[]) {
  if (!staffIds.length) return;
  (writer as Transaction).set(db.collection('settings').doc('data-revisions-operational'), {
    dashboardStaffClockingRecords: FieldValue.increment(1),
    staffClockingStaff: Object.fromEntries([...new Set(staffIds)].map(id => [id, FieldValue.increment(1)])),
  }, { merge: true });
}
