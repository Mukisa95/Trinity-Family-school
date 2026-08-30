import { increment, type Transaction, type WriteBatch } from 'firebase/firestore';
import {
  dashboardRevisionDocumentRef,
  schoolSettingsDocumentRef,
} from './dashboard-revision-documents';

export const dashboardRevisionKeys = {
  timetable: (yearId: string, termId: string) =>
    `${encodeURIComponent(yearId)}__${encodeURIComponent(termId)}`,
  examResults: (yearId: string, termId: string) =>
    `${encodeURIComponent(yearId)}__${encodeURIComponent(termId)}`,
};

/**
 * New revision documents are deliberately tiny and separate from the school
 * profile. The legacy write is temporary rollout compatibility: browsers that
 * have not refreshed yet still listen to settings/school-settings. Remove it
 * only in the follow-up release once those clients have aged out.
 */
function writeRevision(
  batch: WriteBatch | Transaction,
  kind: 'reference' | 'operational' | 'timetable' | 'examResults',
  changes: Record<string, unknown>,
) {
  (batch as WriteBatch).set(dashboardRevisionDocumentRef(kind), changes, { merge: true });
  (batch as WriteBatch).set(
    schoolSettingsDocumentRef(),
    { dataRevisions: changes },
    { merge: true },
  );
}

/** Add a timetable revision bump to the same batch as its source mutation. */
export function bumpTimetableRevisionInBatch(
  batch: WriteBatch,
  yearId: string,
  termId: string,
) {
  const revisionKey = dashboardRevisionKeys.timetable(yearId, termId);
  writeRevision(batch, 'timetable', {
    timetable: { [revisionKey]: increment(1) },
  });
}

/** Add a class-definition revision bump to the same batch as its mutation. */
export function bumpClassesRevisionInBatch(batch: WriteBatch) {
  writeRevision(batch, 'reference', { classes: increment(1) });
}

/** Add an academic-year revision bump to the same batch as its mutation. */
export function bumpAcademicYearsRevisionInBatch(batch: WriteBatch) {
  writeRevision(batch, 'reference', { academicYears: increment(1) });
}

/** Add a staff revision bump to the same batch as its mutation. */
export function bumpStaffRevisionInBatch(batch: WriteBatch) {
  writeRevision(batch, 'reference', { staff: increment(1) });
}

/** Add a subject revision bump to the same batch as its mutation. */
export function bumpSubjectsRevisionInBatch(batch: WriteBatch) {
  writeRevision(batch, 'reference', { subjects: increment(1) });
}

/** Add a house-definition revision bump to the same batch as its mutation. */
export function bumpHousesRevisionInBatch(batch: WriteBatch) {
  writeRevision(batch, 'reference', { houses: increment(1) });
}

/** Add an access-level revision bump to the same batch as its mutation. */
export function bumpAccessLevelsRevisionInBatch(batch: WriteBatch) {
  writeRevision(batch, 'reference', { accessLevels: increment(1) });
}

/**
 * Reserve the next ordered pupil revision inside the source transaction.
 * The modern operational document is small. Reading the legacy profile is
 * temporary only, allowing old browser bundles to continue publishing pupil
 * revisions during the migration window without creating duplicate deltas.
 */
export async function reservePupilsRevisionInTransaction(
  transaction: Transaction,
): Promise<number> {
  const range = await reservePupilsRevisionRangeInTransaction(transaction, 1);
  return range.first;
}

/**
 * Reserve a contiguous range of ordered pupil revisions for a multi-pupil
 * transaction. Updating the shared revision documents once per group avoids
 * making every pupil in the group contend on the same two documents.
 */
export async function reservePupilsRevisionRangeInTransaction(
  transaction: Transaction,
  count: number,
): Promise<{ first: number; last: number }> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Pupil revision range count must be a positive integer.');
  }

  const [operational, legacySettings] = await Promise.all([
    transaction.get(dashboardRevisionDocumentRef('operational')),
    transaction.get(schoolSettingsDocumentRef()),
  ]);
  const current = Math.max(
    Number(operational.data()?.pupils || 0),
    Number(legacySettings.data()?.dataRevisions?.pupils || 0),
  );
  const first = current + 1;
  const last = current + count;

  writeRevision(transaction, 'operational', { pupils: last });
  return { first, last };
}

/** Add an event revision bump to the same batch as its source mutation. */
export function bumpEventsRevisionInBatch(batch: WriteBatch) {
  writeRevision(batch, 'operational', { events: increment(1) });
}

/** Publish exam-definition and optionally event revisions in one source batch. */
export function bumpExamDefinitionRevisionsInBatch(
  batch: WriteBatch,
  options?: { affectsEvents?: boolean },
) {
  (batch as WriteBatch).set(
    dashboardRevisionDocumentRef('reference'),
    { exams: increment(1) },
    { merge: true },
  );
  const legacyChanges: Record<string, unknown> = { exams: increment(1) };
  if (options?.affectsEvents !== false) {
    (batch as WriteBatch).set(
      dashboardRevisionDocumentRef('operational'),
      { events: increment(1) },
      { merge: true },
    );
    legacyChanges.events = increment(1);
  }
  (batch as WriteBatch).set(
    schoolSettingsDocumentRef(),
    { dataRevisions: legacyChanges },
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
  writeRevision(batch, 'examResults', {
    examResults: { [termKey]: increment(1) },
  });
}

/** Add one attendance-summary revision bump to the same publish batch. */
export function bumpAttendanceRevisionInBatch(batch: WriteBatch) {
  writeRevision(batch, 'operational', { attendance: increment(1) });
}

export function getDashboardRevisionDocumentRef() {
  return dashboardRevisionDocumentRef('operational');
}

/** Publish an exact attendance revision inside the summary transaction. */
export function setAttendanceRevisionInTransaction(
  transaction: Transaction,
  revision: number,
) {
  writeRevision(transaction, 'operational', { attendance: revision });
}
