import { FieldValue, type Firestore, type Transaction, type WriteBatch } from 'firebase-admin/firestore';

import type { DomainRevisionKey } from '@/lib/cache/domain-revisions';

type AdminWriter = Pick<Transaction, 'set'> | Pick<WriteBatch, 'set'>;

/** Add cache revision changes to the same Admin SDK write as the source mutation. */
export function bumpDomainRevisionsAdmin(
  db: Firestore,
  writer: AdminWriter,
  keys: readonly DomainRevisionKey[],
) {
  const changes = Object.fromEntries(keys.map(key => [key, FieldValue.increment(1)]));
  (writer as Transaction).set(
    db.collection('settings').doc('data-revisions-operational'),
    changes,
    { merge: true },
  );
  (writer as Transaction).set(
    db.collection('settings').doc('school-settings'),
    { dataRevisions: changes },
    { merge: true },
  );
}
