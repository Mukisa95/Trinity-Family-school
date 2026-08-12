const assert = require('assert');
const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const between = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(startIndex !== -1 && endIndex !== -1, `Could not locate contract section: ${start}`);
  return source.slice(startIndex, endIndex);
};

const cache = read('src/lib/cache/exam-cache.ts');
const bootstrap = read('src/lib/hooks/use-exam-cache-bootstrap.ts');
const hooks = read('src/lib/hooks/use-exams.ts');
const examsPage = read('src/app/exams/page.tsx');
const service = read('src/lib/services/exams.service.ts');
const revisions = read('src/lib/services/dashboard-cache-revisions.service.ts');
const events = read('src/lib/hooks/use-events-fixed.ts');
const preloader = read('src/components/providers/global-data-preloader.tsx');
const resultCache = read('src/lib/cache/exam-result-cache.ts');
const resultLease = read('src/lib/services/exam-lease.service.ts');
const resultHook = read('src/lib/hooks/use-exam-result-lease.ts');
const recordResultsView = read('src/app/exams/[examId]/record-results/RecordResultsView.tsx');
const releases = read('src/lib/services/results-release.service.ts');
const migration = read('src/scripts/migrate-exam-results-canonical.ts');

const selectorHooks = between(
  hooks,
  'export function useExams()',
  'export function useCreateExam()',
);
const examEvents = between(
  events,
  'export function useExamsAsEvents',
  '// Simplified exam integration hooks',
);

assert(
  cache.includes("role === 'Parent'") &&
    cache.includes('NEXT_PUBLIC_FIREBASE_PROJECT_ID') &&
    cache.includes('EXAM_CACHE_SCHEMA') &&
    cache.includes('normaliseExams') &&
    cache.includes('seenExamIds'),
  'Exam snapshots must be schema-versioned and scoped by project, user, role, and Parent exclusion.',
);
assert(
  bootstrap.includes('useDashboardDataRevisions') &&
    bootstrap.includes('getAllFromFirestoreCache') &&
    bootstrap.includes('getAllForCache') &&
    bootstrap.includes('refreshSharedExams') &&
    bootstrap.includes('queryClient.removeQueries') &&
    preloader.includes('useExamCacheBootstrap();'),
  'The global exam bootstrap must be the scoped cold/revision network owner.',
);
assert(
  selectorHooks.includes('enabled: false') &&
    !selectorHooks.includes("collection(db, 'exams')") &&
    !selectorHooks.includes('onSnapshot(') &&
    !selectorHooks.includes('ExamsService.getAllExams()'),
  'Ordinary exam hooks must remain cache-only selectors with no competing collection listener or query.',
);
assert(
  hooks.includes('getExamByIdForCacheRecovery') &&
    hooks.includes("enabled: !!scope && !!id && examsQuery.data !== undefined && !cachedExam") &&
    service.includes('getExamByIdForCacheRecovery'),
  'A missing single exam may recover by point-read only after the cache-owned snapshot is present.',
);
assert(
  service.includes('getDocsFromServerWithTimeout') &&
    service.includes('getAllFromFirestoreCache') &&
    service.includes('waitForSharedExams') &&
    service.includes('bumpExamDefinitionRevisionsInBatch'),
  'Exam service browser callers must share the bootstrap snapshot and source mutations must publish revisions.',
);
assert(
  revisions.includes('bumpExamDefinitionRevisionsInBatch') &&
    revisions.includes('exams: increment(1)') &&
    revisions.includes('events: increment(1)'),
  'Exam definition mutations must atomically publish both exams and calendar projection revisions.',
);
assert(
  hooks.includes('export function useConsolidateExamBatch()') &&
    hooks.includes('batch.update(doc(db, \'exams\', examId), { batchId, updatedAt: serverTimestamp() })') &&
    hooks.includes('A batch can contain at most 498 exams at once.') &&
    examsPage.includes('getExamBatchCompatibilityKey') &&
    examsPage.includes('Manage exam batch') &&
    examsPage.includes('Only exams with the same name, type, academic year, term, and assessment nature are offered.'),
  'Exam batch consolidation must be atomic, cache-aware, and limited to compatible regular exams.',
);
assert(
  examEvents.includes('const examsQuery = useExams();') &&
    examEvents.includes('examSnapshotReady') &&
    !examEvents.includes("getDocsFromServer(collection(db, 'exams'))") &&
    !examEvents.includes("getDocs(collection(db, 'exams'))"),
  'The calendar exam projection must use the shared exam snapshot and never issue a second full read.',
);
assert(
  events.includes('updatesExamDefinitions') &&
    events.includes('deletesExamDefinitions') &&
    events.includes('createsExamDefinitions') &&
    events.includes('bumpExamDefinitionRevisionsInBatch'),
  'Event-driven exam create, update, and delete flows must publish the same exam revision.',
);
assert(
  resultCache.includes("return getExamCacheScope(userId, role)") &&
    resultCache.includes('observedTermRevision') &&
    resultCache.includes('pruneExamResultCache') &&
    resultCache.includes('deletePersistentCollections'),
  'Result cache entries must remain identity-scoped, term-revisioned, and retention-prunable.',
);
assert(
  hooks.includes('readExamResultCache') &&
    hooks.includes('writeExamResultCache') &&
    hooks.includes('dashboardRevisionKeys.examResults') &&
    hooks.includes('const revisionsReady = revisionsQuery.data !== undefined') &&
    hooks.includes("revisionsQuery.data.examResults?.[termKey] ?? 0") &&
    !hooks.includes("onSnapshot(\n      examResultsQuery") &&
    service.includes("doc(db, this.EXAM_RESULTS_COLLECTION, examId)") &&
    service.includes('Legacy result fallback used') &&
    service.includes('bumpExamResultRevisionInBatch'),
  'Individual result reads must use the canonical point document with revision-aware cached fallback and atomic invalidation.',
);
assert(
  hooks.includes('options?.seed ?? current') &&
    hooks.includes('patch === null || current'),
  'A successful result save must not persist a guessed no-result cache entry.',
);
assert(
  resultLease.includes('runTransaction') &&
    resultLease.includes('leaseId') &&
    resultLease.includes('lockedByUid') &&
    resultHook.includes('RENEW_EVERY_MS') &&
    resultHook.includes('onSnapshot') &&
    service.includes('verifyForSave') &&
    service.includes('transaction.delete(ExamLeaseService.ref'),
  'Result editing must use transactional, renewable, owner-verified leases and atomically release after a save.',
);
assert(
  resultHook.includes("const hasConfirmedOtherEditor = status === 'blocked' && holder !== null") &&
    resultHook.includes('const canSave = canAttempt && !hasConfirmedOtherEditor') &&
    recordResultsView.includes('resultLease.canSave') &&
    recordResultsView.includes('resultLease.canEdit') === false,
  'A failed lease check must remain saveable; only a confirmed different editor can lock result saves.',
);
assert(
  recordResultsView.includes('needsLockedEditorAcknowledgement') &&
    recordResultsView.includes('resultLease.holder.lockedByName') &&
    recordResultsView.includes('Continue anyway') &&
    recordResultsView.includes('cannot be saved until'),
  'A user blocked by an active result lease must acknowledge the editor and save limitation before entering marks.',
);
assert(
  releases.includes('publishResultRevision') &&
    releases.includes('bumpExamResultRevisionInBatch'),
  'Release and revoke operations must invalidate their affected result term.',
);
assert(
  migration.includes("process.argv.includes('--apply')") &&
    migration.includes('FieldValue.increment') &&
    migration.includes('migratedFromLegacyId') &&
    !migration.includes('.delete()'),
  'Canonical migration must remain dry-run-first, publish result revisions, and never delete legacy data.',
);

console.log('Exam cache contract passed: scoped owners, canonical result caching, revisions, and edit leases are intact.');
