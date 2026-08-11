/**
 * Copies verified, unique legacy examResults documents to examResults/{examId}.
 *
 * Default mode is a read-only report. Pass --apply only after reviewing that
 * report; the script never deletes legacy documents.
 */
import { createHash } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, getFirebaseAdminProjectId } from '@/lib/firebase-admin';

type PlainRecord = Record<string, unknown>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    if ('toDate' in value && typeof value.toDate === 'function') return value.toDate().toISOString();
    return Object.fromEntries(Object.entries(value as PlainRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

function digest(value: PlainRecord): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const store = getFirestore(getFirebaseAdminApp());
  const [resultsSnapshot, examsSnapshot] = await Promise.all([
    store.collection('examResults').get(),
    store.collection('exams').get(),
  ]);
  const exams = new Map(examsSnapshot.docs.map(snapshot => [snapshot.id, snapshot.data()]));
  const groups = new Map<string, typeof resultsSnapshot.docs>();
  for (const result of resultsSnapshot.docs) {
    const examId = result.get('examId');
    if (typeof examId !== 'string' || !examId) continue;
    groups.set(examId, [...(groups.get(examId) ?? []), result]);
  }

  const report = {
    projectId: getFirebaseAdminProjectId() ?? getFirebaseAdminApp().options.projectId ?? 'unknown',
    mode: apply ? 'apply' : 'dry-run',
    resultDocuments: resultsSnapshot.size,
    groupedExamIds: groups.size,
    missingExamId: resultsSnapshot.docs.filter(snapshot => !snapshot.get('examId')).map(snapshot => snapshot.id),
    missingExam: [] as string[],
    missingPeriod: [] as string[],
    duplicates: [] as Array<{ examId: string; resultIds: string[] }>,
    canonicalConflicts: [] as Array<{ examId: string; resultIds: string[] }>,
    candidates: [] as string[],
    copied: [] as string[],
    verified: [] as string[],
  };
  const copiedTermCounts = new Map<string, number>();

  for (const [examId, entries] of groups) {
    const exam = exams.get(examId) as PlainRecord | undefined;
    if (!exam) {
      report.missingExam.push(examId);
      continue;
    }
    const academicYearId = exam.academicYearId;
    const termId = exam.termId;
    if (typeof academicYearId !== 'string' || typeof termId !== 'string' || !academicYearId || !termId) {
      report.missingPeriod.push(examId);
      continue;
    }
    if (entries.length > 1) {
      report.duplicates.push({ examId, resultIds: entries.map(entry => entry.id) });
      continue;
    }

    const source = entries[0];
    const target = store.collection('examResults').doc(examId);
    const targetExists = (await target.get()).exists;
    if (targetExists && source.id !== examId) {
      report.canonicalConflicts.push({ examId, resultIds: [source.id, examId] });
      continue;
    }
    report.candidates.push(examId);
    if (!apply) continue;

    const expected: PlainRecord = {
      ...source.data(),
      examId,
      academicYearId,
      termId,
    };
    await target.set({ ...expected, migratedFromLegacyId: source.id }, { merge: false });
    const copied = await target.get();
    const copiedData = copied.data() as PlainRecord;
    const verifiedShape = Object.keys(expected).every(key => key in copiedData);
    const verifiedHash = digest(expected) === digest(Object.fromEntries(
      Object.entries(copiedData).filter(([key]) => key !== 'migratedFromLegacyId'),
    ));
    if (!verifiedShape || !verifiedHash) {
      throw new Error(`Verification failed after copying result ${source.id} to ${examId}.`);
    }
    report.copied.push(examId);
    report.verified.push(examId);
    const revisionKey = `${encodeURIComponent(academicYearId)}__${encodeURIComponent(termId)}`;
    copiedTermCounts.set(revisionKey, (copiedTermCounts.get(revisionKey) ?? 0) + 1);
  }

  if (apply && copiedTermCounts.size > 0) {
    const revisionPatch = {
      examResults: Object.fromEntries(
        [...copiedTermCounts].map(([key, count]) => [key, FieldValue.increment(count)]),
      ),
    };
    const batch = store.batch();
    batch.set(store.collection('settings').doc('data-revisions-exam-results'), revisionPatch, { merge: true });
    batch.set(store.collection('settings').doc('school-settings'), {
      dataRevisions: {
        ...revisionPatch,
      },
    }, { merge: true });
    await batch.commit();
  }

  console.log(JSON.stringify(report, null, 2));
  if (apply && (report.duplicates.length || report.missingExam.length || report.missingPeriod.length || report.canonicalConflicts.length)) {
    throw new Error('Apply completed only safe copies; review unresolved migration report entries.');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
