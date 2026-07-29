import { doc, increment, setDoc, type Firestore } from 'firebase/firestore';

async function publishRevision(
  db: Firestore,
  field: 'classes' | 'academicYears',
): Promise<void> {
  await setDoc(
    doc(db, 'settings', 'school-settings'),
    {
      dataRevisions: {
        [field]: increment(1),
      },
    },
    { merge: true },
  );
}

export const publishClassesRevision = (db: Firestore) =>
  publishRevision(db, 'classes');

export const publishAcademicYearsRevision = (db: Firestore) =>
  publishRevision(db, 'academicYears');
