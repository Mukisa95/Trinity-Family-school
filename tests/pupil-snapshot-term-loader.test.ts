import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('term snapshot loader returns all active snapshots from one Firestore query', async () => {
  let reads = 0;
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/services/pupil-snapshots.service.ts'),
    'utf8',
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };

  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require(name: string) {
      if (name === '@/lib/firebase') return { db: {} };
      if (name === 'firebase/firestore') {
        return {
          collection: () => ({}), doc: () => ({}), addDoc: async () => ({ id: 'new' }),
          updateDoc: async () => {}, deleteDoc: async () => {}, getDoc: async () => ({ exists: () => false }),
          query: () => ({}), where: () => ({}), orderBy: () => ({}),
          getDocs: async () => {
            reads += 1;
            return {
              empty: false,
              docs: [{
                id: 'snapshot-1',
                data: () => ({
                  pupilId: 'pupil-1', termId: 'term-1', academicYearId: 'year-1',
                  classId: 'class-1', section: 'Day', isActive: true,
                }),
              }],
            };
          },
        };
      }
      if (name === '@/lib/utils/academic-year-utils') {
        return { getTermStatus: () => 'past', isTermEnded: () => true };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
    console: { log() {}, warn() {}, error() {} },
  }, { filename: 'pupil-snapshots.service.ts' });

  const service = module.exports.PupilSnapshotsService as {
    getActiveSnapshotsForTerm: (academicYearId: string, termId: string) => Promise<Array<{ id: string; pupilId: string }>>;
  };
  const [snapshots, repeatedSnapshots] = await Promise.all([
    service.getActiveSnapshotsForTerm('year-1', 'term-1'),
    service.getActiveSnapshotsForTerm('year-1', 'term-1'),
  ]);

  assert.equal(reads, 1);
  assert.deepEqual(snapshots.map(snapshot => [snapshot.id, snapshot.pupilId]), [['snapshot-1', 'pupil-1']]);
  assert.deepEqual(repeatedSnapshots, snapshots);
  await service.getActiveSnapshotsForTerm('year-1', 'term-1');
  assert.equal(reads, 2, 'a later refresh must observe remote snapshot recaptures');
});
