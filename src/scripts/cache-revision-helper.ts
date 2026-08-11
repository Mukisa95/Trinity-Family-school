import { doc, increment, writeBatch, type Firestore } from 'firebase/firestore';

async function publishRevision(
  db: Firestore,
  field: 'classes' | 'academicYears',
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'settings', 'data-revisions-reference'), {
    [field]: increment(1),
  }, { merge: true });
  // Temporary bridge for live browser sessions still using the old location.
  batch.set(doc(db, 'settings', 'school-settings'), {
    dataRevisions: { [field]: increment(1) },
  }, { merge: true });
  await batch.commit();
}

export const publishClassesRevision = (db: Firestore) =>
  publishRevision(db, 'classes');

export const publishAcademicYearsRevision = (db: Firestore) =>
  publishRevision(db, 'academicYears');
