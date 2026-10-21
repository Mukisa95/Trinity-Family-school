import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { transformSync } from 'esbuild';
import type { Exam, ExamResult, GradingScaleItem } from '../src/types';
import { DEFAULT_GRADING_SCALE } from '../src/lib/constants';
import * as policy from '../src/lib/utils/stack-grading-scale';
import { normaliseExams } from '../src/lib/cache/exam-cache';

const scale = (minimum: number): GradingScaleItem[] => DEFAULT_GRADING_SCALE.map((band, index) => index === 0 ? { ...band, minMark: minimum } : index === 1 ? { ...band, maxMark: minimum - 1 } : { ...band });
const independent: GradingScaleItem[] = [{ minMark: 50, maxMark: 100, grade: 'A', aggregates: 1 }, { minMark: 0, maxMark: 49, grade: 'F', aggregates: 9 }];
const exam = (id: string): Exam => ({ id, name: 'PRE-PLE - SIPRO - SET 1', baseName: 'PRE-PLE', examTypeId: 'et_cat', classId: id, academicYearId: '2026', termId: 't3', maxMarks: 100, passingMarks: 50, startDate: '2026-10-10', endDate: '2026-10-11', status: 'Scheduled', createdAt: '2026-10-01' });
const result = (id: string): ExamResult => ({ id, examId: id, classId: id, academicYearId: '2026', termId: 't3', pupilSnapshots: [], subjectSnapshots: [], results: { pupil: { eng: { subjectId: 'eng', marks: 80, grade: 'D1', aggregates: 1 }, blank: { subjectId: 'blank', grade: '-' }, missed: { subjectId: 'missed', marks: 0, status: 'missed', grade: 'F9', aggregates: 9 } } }, gradingScale: DEFAULT_GRADING_SCALE, recordedAt: '2026-10-10' });
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function harness() {
  const docs = new Map<string, any>(), locks = new Map<string, string>();let next = 0, failLease = '', beforeTransaction: (() => void) | undefined;
  for (const id of ['p1', 'p2', 'p3']) { docs.set(`exams/${id}`, copy(exam(id)));docs.set(`examResults/${id}`, copy(result(id))); }
  const reference = (...args: any[]) => {
    let name: string, id: string;
    if (typeof args[1] === 'string' && args.length >= 3) { name = args[1];id = args[2]; }
    else { name = args[0].name;id = args[1] || `new-${++next}`; }
    return { path: `${name}/${id}`, id };
  };
  const read = (ref: any) => ({ id: ref.id, exists: () => docs.has(ref.path), data: () => copy(docs.get(ref.path)) });
  const writer = () => {
    const operations: (() => void)[] = [];let writing = false;
    return {
      async get(ref: any) { assert.equal(writing, false, 'All transaction reads must precede writes');return read(ref); },
      set(ref: any, value: any, options?: any) { writing = true;operations.push(() => docs.set(ref.path, options?.merge ? { ...docs.get(ref.path), ...copy(value) } : copy(value))); },
      update(ref: any, value: any) { writing = true;assert.ok(docs.has(ref.path), ref.path);operations.push(() => docs.set(ref.path, { ...docs.get(ref.path), ...copy(value) })); },
      delete(ref: any) { writing = true;operations.push(() => docs.delete(ref.path)); },
      async commit() { for (const apply of operations) apply(); },
    };
  };
  const firestore = {
    collection: (_db: any, name: string) => ({ name }),doc: reference,getDoc: async (ref: any) => read(ref),writeBatch: writer,
    query: (collection: any, ...conditions: any[]) => ({ ...collection, conditions }),where: (field: string, _operator: string, value: any) => ({ field, value }),orderBy: () => null,
    getDocs: async (query: any) => { const rows = [...docs].filter(([key, data]) => key.startsWith(`${query.name}/`) && query.conditions.filter(Boolean).every((condition: any) => data[condition.field] === condition.value)).map(([path]) => read({ path, id: path.split('/')[1] }));return { docs: rows, empty: !rows.length }; },
    Timestamp: { now: () => '2026-10-21T10:00:00.000Z' },
    runTransaction: async (_db: any, run: any) => { beforeTransaction?.();beforeTransaction = undefined;const transaction = writer();const value = await run(transaction);await transaction.commit();return value; },
  };
  const lease = {
    ref: (id: string) => reference({}, 'examLocks', id),
    acquire: async (id: string, _actor: any, leaseId: string) => { if (id === failLease || locks.has(id)) return { acquired: false, holder: { lockedByName: 'Other editor' } };locks.set(id, leaseId);return { acquired: true }; },
    verifyForSave: async (id: string, token: any) => assert.equal(locks.get(id), token.leaseId),
    release: async (id: string, token: any) => { if (locks.get(id) === token.leaseId) locks.delete(id); },notifyUnlockWaiters() {},
  };
  let examsService: any;
  const load = (filename: string) => {
    const module = { exports: {} as any };
    runInNewContext(transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' }).code, { module, exports: module.exports, crypto: { randomUUID }, console: { log() {}, error() {}, info() {} }, require(name: string) {
      if (name.endsWith('/scoped-firestore')) return firestore;
      if (name.endsWith('/firebase')) return { db: {} };
      if (name.endsWith('/exam-cache')) return { normaliseExams };
      if (name.endsWith('/stack-grading-scale')) return policy;
      if (name.endsWith('/exam-lease.service')) return { ExamLeaseService: lease };
      if (name.endsWith('/dashboard-cache-revisions.service')) return { bumpExamDefinitionRevisionsInBatch() {}, bumpExamResultRevisionInBatch() {} };
      if (name.endsWith('/exams.service')) return { ExamsService: examsService };
      if (name.endsWith('/firestore-helpers')) return {};
      throw new Error(`Unexpected service dependency ${name}`);
    } });return module.exports;
  };
  examsService = load('src/lib/services/exams.service.ts').ExamsService;
  const service = load('src/lib/services/exam-stack-grading.service.ts').ExamStackGradingService;
  const definitions = () => [...docs].filter(([key]) => key.startsWith('exams/')).map(([key, value]) => ({ ...copy(value), id: key.split('/')[1] } as Exam));
  return { docs, locks, service, examsService, definitions, lock(id: string) { failLease = id; }, before(run: () => void) { beforeTransaction = run; } };
}
const actor = { id: 'teacher', name: 'Teacher' };

test('shared edits preserve independent exams; later CAT sets inherit the shared default even if every existing exam is independent', async () => {
  const h = harness();let snapshot = await h.service.load(h.definitions());
  await h.service.save({ snapshot, mode: 'stack', scale: scale(85), actor });
  assert.equal(h.docs.get('examResults/p2').results.pupil.eng.grade, 'D2');
  snapshot = await h.service.load(h.definitions());await h.service.save({ snapshot, mode: 'independent', examId: 'p1', scale: independent, actor });
  snapshot = await h.service.load(h.definitions());await h.service.save({ snapshot, mode: 'stack', scale: scale(90), actor });
  assert.equal(h.docs.get('examResults/p1').results.pupil.eng.grade, 'A');
  assert.deepEqual(h.docs.get('examResults/p1').gradingScale, independent);
  assert.equal(h.docs.get('examResults/p2').results.pupil.blank.grade, '-');
  for (const id of ['p2', 'p3']) { snapshot = await h.service.load(h.definitions());await h.service.save({ snapshot, mode: 'independent', examId: id, scale: independent, actor }); }
  snapshot = await h.service.load(h.definitions());await h.service.save({ snapshot, mode: 'stack', scale: scale(95), actor });
  assert.equal(h.docs.get('examResults/p1').results.pupil.eng.grade, 'A');
  const stale = h.definitions().map(item => ({ ...item, stackGradingPolicy: { ...item.stackGradingPolicy!, scale: scale(85) } }));
  h.examsService.hydrateSharedExams(stale);
  const ids = await h.examsService.createMultipleExams([{ ...exam('future'), id: undefined, name: 'PRE-PLE - SIPRO - SET 2' }]);
  const futureId = ids[0];await h.examsService.createExamResult({ ...result(futureId), gradingScale: undefined });
  assert.deepEqual(h.docs.get(`examResults/${futureId}`).gradingScale, scale(95));
  assert.equal(h.docs.get(`examResults/${futureId}`).gradingScaleSource, 'stack');
  assert.equal(h.docs.get('exams/p1').stackGradingPolicy.scale[0].minMark, 95);
  assert.equal(h.locks.size, 0);
});

test('returning one exam to the stack leaves other independent exams and the future default unchanged', async () => {
  const h = harness();let snapshot = await h.service.load(h.definitions());await h.service.save({ snapshot, mode: 'stack', scale: scale(90), actor });
  for (const id of ['p1', 'p2']) { snapshot = await h.service.load(h.definitions());await h.service.save({ snapshot, mode: 'independent', examId: id, scale: independent, actor }); }
  const revision = h.docs.get('exams/p1').stackGradingPolicy.revision;
  snapshot = await h.service.load(h.definitions());await h.service.save({ snapshot, mode: 'inherit', examId: 'p1', scale: snapshot.scale, actor });
  assert.equal(h.docs.get('exams/p1').gradingScaleOverride, null);
  assert.equal(h.docs.get('examResults/p1').gradingScaleSource, 'stack');
  assert.deepEqual(h.docs.get('examResults/p1').gradingScale, scale(90));
  assert.deepEqual(h.docs.get('examResults/p2').gradingScale, independent);
  assert.equal(h.docs.get('exams/p2').stackGradingPolicy.revision, revision);
});

test('the record-results scale save marks only that exam independent without changing its stack policy', async () => {
  const h = harness();const snapshot = await h.service.load(h.definitions());await h.service.save({ snapshot, mode: 'stack', scale: scale(90), actor });
  const revision = h.docs.get('exams/p1').stackGradingPolicy.revision;
  h.locks.set('p1', 'record-editor');
  await h.examsService.updateExamResult('p1', { examId: 'p1', academicYearId: '2026', termId: 't3', gradingScale: independent, gradingScaleSource: 'independent' }, { lease: { lockedByUid: actor.id, leaseId: 'record-editor' } });
  assert.deepEqual(h.docs.get('exams/p1').gradingScaleOverride, independent);
  assert.equal(h.docs.get('exams/p1').stackGradingPolicy.revision, revision);
  assert.deepEqual(h.docs.get('examResults/p2').gradingScale, scale(90));
});

test('membership changes are shown on reload and block a stale shared save', async () => {
  const h = harness();h.examsService.hydrateSharedExams(h.definitions());const snapshot = await h.service.load([h.definitions()[0]]);
  assert.equal(snapshot.exams.length, 3, 'A filtered page still loads the entire authorized stack');
  h.docs.set('exams/new', exam('new'));h.docs.set('examResults/new', result('new'));h.examsService.hydrateSharedExams(h.definitions());
  await assert.rejects(h.service.save({ snapshot, mode: 'stack', scale: scale(90), actor }), /exams in this stack changed/);
  assert.equal((await h.service.load(snapshot.exams)).exams.length, 4);
});

test('an exam can override its scale before a result shell exists', async () => {
  const h = harness();h.docs.delete('examResults/p1');const snapshot = await h.service.load(h.definitions());
  await h.service.save({ snapshot, mode: 'independent', examId: 'p1', scale: independent, actor });
  await h.examsService.createExamResult({ ...result('p1'), gradingScale: undefined });
  assert.deepEqual(h.docs.get('examResults/p1').gradingScale, independent);
  assert.equal(h.docs.get('examResults/p1').gradingScaleSource, 'independent');
});

test('the first individual edit freezes the inferred legacy stack default instead of letting overrides replace it', async () => {
  const h = harness();
  for (const id of ['p1', 'p2', 'p3']) h.docs.get(`examResults/${id}`).gradingScale = scale(85);
  for (const id of ['p1', 'p2', 'p3']) {
    const snapshot = await h.service.load(h.definitions());
    await h.service.save({ snapshot, mode: 'independent', examId: id, scale: independent, actor });
  }
  assert.deepEqual(h.docs.get('exams/p3').stackGradingPolicy.scale, scale(85));
  h.examsService.hydrateSharedExams(h.definitions());
  const next = await h.examsService.createExam({ ...exam('later'), name: 'PRE-PLE - SET 4' });
  await h.examsService.createExamResult({ ...result(next), gradingScale: undefined });
  assert.deepEqual(h.docs.get(`examResults/${next}`).gradingScale, scale(85));
});

test('locks and stale grading views reject the whole save without partial writes and release acquired leases', async () => {
  const h = harness();const before = copy([...h.docs]);const snapshot = await h.service.load(h.definitions());h.lock('p2');
  await assert.rejects(h.service.save({ snapshot, mode: 'stack', scale: scale(90), actor }), /Other editor/);
  assert.deepEqual([...h.docs], before);assert.equal(h.locks.size, 0);
  h.lock('');h.before(() => h.docs.get('examResults/p3').gradingScaleSource = 'independent');
  await assert.rejects(h.service.save({ snapshot, mode: 'stack', scale: scale(90), actor }), /changed while this view was open/);
  assert.equal(h.docs.get('exams/p1').stackGradingPolicy, undefined);assert.equal(h.locks.size, 0);
});

test('scale saves regrade the latest marks and preserve explicit overrides even when they initially match the stack', async () => {
  const h = harness();let snapshot = await h.service.load(h.definitions());
  await h.service.save({ snapshot, mode: 'independent', examId: 'p1', scale: DEFAULT_GRADING_SCALE, actor });
  snapshot = await h.service.load(h.definitions());
  h.before(() => { h.docs.get('examResults/p2').results.pupil.eng.marks = 95; });
  await h.service.save({ snapshot, mode: 'stack', scale: scale(90), actor });
  assert.deepEqual(h.docs.get('examResults/p1').gradingScale, DEFAULT_GRADING_SCALE);
  assert.equal(h.docs.get('examResults/p2').results.pupil.eng.marks, 95);
  assert.equal(h.docs.get('examResults/p2').results.pupil.eng.grade, 'D1');
});

test('legacy differences remain visible and separate stacks and academic periods never share a default', () => {
  const exams = ['p1', 'p2', 'p3'].map(exam), results = ['p1', 'p2', 'p3'].map(result);results[0].gradingScale = independent;
  const defaultScale = policy.resolveStackScale(exams, results);
  assert.equal(policy.scaleSignature(defaultScale), policy.scaleSignature(DEFAULT_GRADING_SCALE));
  assert.equal(policy.isIndependentScale(exams[0], results[0], defaultScale), true);
  exams[0].stackGradingPolicy = { key: policy.examStackKey(exams[0]), revision: 'saved', updatedAt: '2026-10-20', scale: scale(90) };
  assert.equal(policy.inheritStackGradingPolicy({ ...exam('next'), termId: 't2' }, exams).stackGradingPolicy, undefined);
  assert.equal(policy.inheritStackGradingPolicy({ ...exam('next'), baseName: 'STEAM' }, exams).stackGradingPolicy, undefined);
  assert.throws(() => policy.validateGradingScale([{ minMark: NaN, maxMark: 100, grade: 'A' }]), /valid range/);
  assert.throws(() => policy.validateGradingScale([{ minMark: 0, maxMark: 70, grade: 'A' }, { minMark: 60, maxMark: 100, grade: 'B' }]), /overlap/);
});
