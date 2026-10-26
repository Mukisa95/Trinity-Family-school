import { FieldValue, type Firestore, type Transaction, type WriteBatch } from 'firebase-admin/firestore';

/** Publish in the account write, including changes made in User Management. */
export function signalClockingAccountChange(db: Firestore, writer: Transaction | WriteBatch) {
  (writer as Transaction).set(db.collection('settings').doc('data-revisions-operational'), {
    staffClockingTimekeepers: FieldValue.increment(1),
  }, { merge: true });
}
