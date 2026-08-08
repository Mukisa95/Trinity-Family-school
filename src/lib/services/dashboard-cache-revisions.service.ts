import { doc, increment, type Transaction, type WriteBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'school-settings';

export const dashboardRevisionKeys = {
  timetable: (yearId: string, termId: string) =>
    `${encodeURIComponent(yearId)}__${encodeURIComponent(termId)}`,
  examResults: (yearId: string, termId: string) =>
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
  (batch as WriteBatch).set(
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

/** Add a staff revision bump to the same batch as its source mutation. */
export function bumpStaffRevisionInBatch(batch: WriteBatch) {
  batch.set(
    schoolSettingsRef(),
    {
      dataRevisions: {
        staff: increment(1),
      },
    },
    { merge: true },
  );
}

/**
 * Reserve the next ordered pupil revision inside the source transaction.
 * The caller writes a matching pupilCacheChanges document in that same
 * transaction, so cache consumers can safely request only missing deltas.
 */
export async function reservePupilsRevisionInTransaction(
  transaction: Transaction,
): Promise<number> {
  const settingsRef = schoolSettingsRef();
  const settings = await transaction.get(settingsRef);
  const current = Number(settings.data()?.dataRevisions?.pupils || 0);
  const next = current + 1;

  transaction.set(
    settingsRef,
    {
      dataRevisions: {
        pupils: next,
      },
    },
    { merge: true },
  );
  return next;
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

/**
 * Exam definitions also feed the legacy calendar projection. Publish both
 * invalidation tokens in one settings write so consumers never observe a new
 * exam list with an old exam-event projection (or vice versa).
 */
export function bumpExamDefinitionRevisionsInBatch(
  batch: WriteBatch,
  options?: { affectsEvents?: boolean },
) {
  batch.set(
    schoolSettingsRef(),
    {
      dataRevisions: {
        exams: increment(1),
        ...(options?.affectsEvents === false ? {} : { events: increment(1) }),
      },
    },
    { merge: true },
  );
}

/** Publish the revision for exactly one exam-result term in the result write batch. */
export function bumpExamResultRevisionInBatch(
  batch: WriteBatch | Transaction,
  academicYearId: string,
  termId: string,
) {
  if (!academicYearId || !termId) {
    throw new Error('Exam result revisions require an academic year and term.');
  }

  const termKey = dashboardRevisionKeys.examResults(academicYearId, termId);
  (batch as WriteBatch).set(
    schoolSettingsRef(),
    {
      dataRevisions: {
        examResults: {
          [termKey]: increment(1),
        },
      },
    },
    { merge: true },
  );
}

/** Add one attendance-summary revision bump to the same publish batch. */
export function bumpAttendanceRevisionInBatch(batch: WriteBatch) {
  batch.set(
    schoolSettingsRef(),
    {
      dataRevisions: {
        attendance: increment(1),
      },
    },
    { merge: true },
  );
}

export function getDashboardRevisionDocumentRef() {
  return schoolSettingsRef();
}

/** Publish an exact attendance revision inside the summary transaction. */
export function setAttendanceRevisionInTransaction(
  transaction: Transaction,
  revision: number,
) {
  transaction.set(
    schoolSettingsRef(),
    {
      dataRevisions: {
        attendance: revision,
      },
    },
    { merge: true },
  );
}
