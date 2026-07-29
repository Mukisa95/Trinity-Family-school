import { doc, increment, type WriteBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'school-settings';

export const dashboardRevisionKeys = {
  timetable: (yearId: string, termId: string) =>
    `${encodeURIComponent(yearId)}__${encodeURIComponent(termId)}`,
};

function schoolSettingsRef() {
  return doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
}

/**
 * Add a timetable revision bump to the same batch as the source mutation.
 * Consumers receive the revision through the existing school-settings listener
 * and only reload their local timetable cache when it changes.
 */
export function bumpTimetableRevisionInBatch(
  batch: WriteBatch,
  yearId: string,
  termId: string,
) {
  const revisionKey = dashboardRevisionKeys.timetable(yearId, termId);
  batch.set(
    schoolSettingsRef(),
    {
      dataRevisions: {
        timetable: {
          [revisionKey]: increment(1),
        },
      },
    },
    { merge: true },
  );
}

/** Add a class-definition revision bump to the same batch as its mutation. */
export function bumpClassesRevisionInBatch(batch: WriteBatch) {
  batch.set(
    schoolSettingsRef(),
    {
      dataRevisions: {
        classes: increment(1),
      },
    },
    { merge: true },
  );
}

/** Add an academic-year revision bump to the same batch as its mutation. */
export function bumpAcademicYearsRevisionInBatch(batch: WriteBatch) {
  batch.set(
    schoolSettingsRef(),
    {
      dataRevisions: {
        academicYears: increment(1),
      },
    },
    { merge: true },
  );
}

/** Add an event revision bump to the same batch as its source mutation. */
export function bumpEventsRevisionInBatch(batch: WriteBatch) {
  batch.set(
    schoolSettingsRef(),
    {
      dataRevisions: {
        events: increment(1),
      },
    },
    { merge: true },
  );
}
