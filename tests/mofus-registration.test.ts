import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as terms from '../src/lib/utils/fees-holiday-terms';

function fixture(failHolidayWrite = false) {
  const documents = new Map<string, any>();
  const transactions: string[][] = [];
  const reminders: any[] = [];
  let counter = 0;
  const years = [{ id: 'year', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', isLocked: false,
    terms: [{ id: 'future', name: 'Future term', startDate: '2099-01-01', endDate: '2099-04-30' }] }];
  const sdk = {
    collection: (_db: any, name: string) => ({ path: name }),
    doc: (source: any, collection?: string, id?: string) => {
      const path = collection ? `${collection}/${id}` : `${source.path}/new-${++counter}`;
      return { path, id: path.split('/').at(-1) };
    },
    Timestamp: { now: () => ({ seconds: 1 }) },
    runTransaction: async (_db: any, callback: any) => {
      const writes: [string, any][] = [];
      const result = await callback({
        get: async (ref: any) => ({ id: ref.id, exists: () => documents.has(ref.path), data: () => documents.get(ref.path) }),
        set: (ref: any, data: any) => {
          if (failHolidayWrite && ref.path.startsWith('feesHolidays/')) throw new Error('Privilege write rejected');
          writes.push([ref.path, data]);
        },
      });
      transactions.push(writes.map(([path]) => path));
      writes.forEach(([path, data]) => documents.set(path, data));
      return result;
    },
  };
  const load = (file: string, dependencies: Record<string, any>) => {
    const module = { exports: {} as any };
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(source, { module, exports: module.exports, Date, console: { error() {}, warn() {} }, require: (name: string) => {
      if ((name === 'firebase/firestore' || name === '@/lib/access/scoped-firestore')) return sdk;
      if (name === '../firebase') return { db: {} };
      if (dependencies[name]) return dependencies[name];
      return {}; // Other service methods are outside this registration fixture.
    } });
    return module.exports;
  };
  const holiday = load('src/lib/services/fees-holiday.service.ts', {
    './academic-years.service': { AcademicYearsService: { getAllAcademicYears: async () => years } }, '@/lib/utils/fees-holiday-terms': terms,
    '@/lib/fees/fee-reminder-change-client': { notifyFeeReminderChange: async (change: any) => { reminders.push(change); } },
  });
  const pupil = load('src/lib/services/pupils.service.ts', {
    './fees-holiday.service': holiday,
    '@/lib/utils/name-formatter': { formatPupilDisplayName: (pupil: any) => pupil.firstName },
    './history-log.service': { HistoryLogService: { log: async () => {} } },
    './dashboard-cache-revisions.service': { reservePupilsRevisionInTransaction: async () => 1 },
  });
  return { documents, transactions, reminders, service: pupil.PupilsService, holidayService: holiday.FeesHolidayService };
}
const pupil = { firstName: 'Joan', lastName: 'Pupil', assignedStaffId: 'staff-1', classId: 'p4', admissionNumber: 'P-123', status: 'Active' };
const privilege = { categories: ['required'], discountType: 'full', isActive: true, schedule: [{ academicYearId: 'year', termId: 'future', discountType: 'full' }] };

test('MOFUS registration commits pupil, privilege and pupil revision together', async () => {
  const f = fixture();
  const id = await f.service.createPupil(pupil, { autoAssignHouse: false, mofusPrivilege: privilege });
  const holiday = [...f.documents].find(([path]) => path.startsWith('feesHolidays/'))!;
  assert.equal(f.documents.get(`pupils/${id}`).assignedStaffId, 'staff-1');
  assert.equal(holiday[1].pupilId, id);
  assert.equal(holiday[1].schedule[0].discountType, 'full');
  assert.equal(f.transactions.length, 1);
  assert.equal(f.transactions[0].length, 3);
  assert.ok(f.transactions[0].some(path => path.startsWith('pupilCacheChanges/')));
});

test('a rejected privilege write leaves no half-registered MOFUS pupil', async () => {
  const f = fixture(true);
  await assert.rejects(f.service.createPupil(pupil, { autoAssignHouse: false, mofusPrivilege: privilege }), /Privilege write rejected/);
  assert.equal(f.documents.size, 0);
});

test('ordinary registration creates no holiday and MOFUS registration requires a staff link', async () => {
  const f = fixture();
  await f.service.createPupil(pupil, { autoAssignHouse: false });
  assert.equal([...f.documents.keys()].some(path => path.startsWith('feesHolidays/')), false);
  await assert.rejects(f.service.createPupil({ ...pupil, assignedStaffId: '' }, { autoAssignHouse: false, mofusPrivilege: privilege }), /Select the staff/);
});

test('holiday deletion preserves the record as a stopped privilege', async () => {
  const f = fixture();
  f.documents.set('feesHolidays/existing', { pupilId: 'pupil', categories: ['required'], discountType: 'full', isActive: true, createdAt: '2026-01-01' });
  await f.holidayService.deleteFeesHoliday('existing');
  assert.equal(f.documents.get('feesHolidays/existing').isActive, false);
  assert.ok(Array.isArray(f.documents.get('feesHolidays/existing').termHistory));
  assert.deepEqual(JSON.parse(JSON.stringify(f.reminders)), [{ source: { collection: 'feesHolidays', id: 'existing' }, pupilIds: ['pupil'] }]);
});

test('moving a privilege is rejected without changing historical ownership or reconciling reminders', async () => {
  const f = fixture();
  f.documents.set('feesHolidays/existing', { pupilId: 'old-pupil', categories: ['required'], discountType: 'full', isActive: true, createdAt: '2026-01-01' });
  await assert.rejects(f.holidayService.updateFeesHoliday('existing', { pupilId: 'new-pupil' }), /cannot be moved/);
  assert.equal(f.documents.get('feesHolidays/existing').pupilId, 'old-pupil');
  assert.equal(f.reminders.length, 0);
});

test('privilege creation reconciles reminders only after a successful write', async () => {
  const f = fixture();
  await f.holidayService.createFeesHoliday({ ...privilege, pupilId: 'pupil' });
  assert.deepEqual(JSON.parse(JSON.stringify(f.reminders)), [{ pupilIds: ['pupil'] }]);
  const rejected = fixture(true);
  await assert.rejects(rejected.holidayService.createFeesHoliday({ ...privilege, pupilId: 'pupil' }), /Privilege write rejected/);
  assert.equal(rejected.reminders.length, 0);
});
