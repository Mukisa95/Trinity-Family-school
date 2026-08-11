import {
  Timestamp,
  type DocumentReference,
  type Firestore,
  type UpdateData,
} from 'firebase-admin/firestore';

/**
 * Publish an Admin-SDK pupil update and its ordered browser-cache delta in one
 * transaction. This keeps server-owned fee/SchoolPay writes visible to the
 * same revision cache used by browser-owned pupil edits.
 */
export async function updatePupilWithCacheRevision(
  db: Firestore,
  pupilRef: DocumentReference,
  data: UpdateData<Record<string, unknown>>,
): Promise<number> {
  return db.runTransaction(async transaction => {
    const settingsRef = db.collection('settings').doc('school-settings');
    const operationalRef = db.collection('settings').doc('data-revisions-operational');
    const [operational, legacySettings] = await Promise.all([
      transaction.get(operationalRef),
      transaction.get(settingsRef),
    ]);
    const revision = Math.max(
      Number(operational.data()?.pupils || 0),
      Number(legacySettings.data()?.dataRevisions?.pupils || 0),
    ) + 1;

    transaction.update(pupilRef, data);
    transaction.set(operationalRef, { pupils: revision }, { merge: true });
    // Compatibility bridge for browser bundles still subscribed to the old
    // settings document. This is removed with the legacy listener release.
    transaction.set(settingsRef, {
      dataRevisions: {
        pupils: revision,
      },
    }, { merge: true });
    transaction.set(
      db.collection('pupilCacheChanges').doc(String(revision).padStart(16, '0')),
      {
        revision,
        pupilId: pupilRef.id,
        operation: 'upsert',
        changedAt: Timestamp.now(),
      },
    );
    return revision;
  });
}
