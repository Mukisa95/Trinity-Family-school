import assert from 'node:assert/strict';
import test from 'node:test';
import type { Class, ExamRecordPupilInfo, Pupil } from '../src/types/index';
import {
  assertUniqueStreams,
  deriveExamStreams,
  enrichExamPupilStreamIdentity,
  filterExamPupilsByStream,
  getActiveClassStreams,
  getClassStreamPupilStats,
  getPupilClassDisplay,
  getExamPupilDisplaySnapshot,
  snapshotExamPupilStreamIdentity,
} from '../src/lib/utils/class-streams';

const schoolClass: Class = {
  id: 'class-p1',
  name: 'Primary One',
  code: 'P.1',
  level: 'Lower Primary',
  order: 1,
  classTeacherId: 'teacher-1',
  subjectAssignments: [],
  streams: [
    { id: 'east', name: 'East', code: 'E', createdAt: '2026-01-01' },
    { id: 'west', name: 'West', code: 'W', createdAt: '2026-01-01' },
  ],
  streamConfigurations: [{
    academicYearId: 'year-2026',
    activeStreamIds: ['east', 'west'],
    enabled: true,
    version: 1,
    configuredAt: '2026-01-02',
  }],
  createdAt: '2025-01-01',
};

const pupil = {
  id: 'pupil-1',
  firstName: 'Ada',
  lastName: 'A',
  admissionNumber: 'A-1',
  gender: 'Female',
  classId: schoolClass.id,
  section: 'Day',
  status: 'Active',
  guardians: [],
  createdAt: '2026-01-01',
} satisfies Pupil;

test('current class labels resolve a stream definition by ID instead of stale copied names', () => {
  const display = getPupilClassDisplay({ ...pupil, streamId: 'east', streamName: 'West', streamCode: 'W', streamClassId: schoolClass.id }, schoolClass);
  assert.equal(display.name, 'Primary One East');
  assert.equal(display.code, 'P.1 E');
});

test('a historical stream with missing labels cannot borrow another current stream name', () => {
  const snapshot: ExamRecordPupilInfo = { pupilId: pupil.id, name: 'Ada A', admissionNumber: pupil.admissionNumber, classNameAtExam: 'Primary One', classCodeAtExam: 'P.1', streamIdAtExam: 'east' };
  const current = { ...pupil, streamId: 'west', streamName: 'West', streamCode: 'W', streamClassId: schoolClass.id, streamAcademicYearId: 'year-2026' };
  const result = enrichExamPupilStreamIdentity(snapshot, current, schoolClass, 'year-2026');
  assert.equal(result.streamIdAtExam, 'east');
  assert.equal(result.streamNameAtExam, 'East');
  assert.equal(result.streamCodeAtExam, 'E');
  const immutable = enrichExamPupilStreamIdentity({ ...snapshot, streamNameAtExam: 'Original East', streamCodeAtExam: 'OE' }, current, schoolClass, 'year-2026');
  assert.equal(immutable.streamNameAtExam, 'Original East');
});

test('pupil class display is unchanged before stream assignment', () => {
  assert.deepEqual(getPupilClassDisplay(pupil, schoolClass), {
    name: 'Primary One',
    code: 'P.1',
    baseName: 'Primary One',
    baseCode: 'P.1',
    hasStream: false,
  });
});

test('pupil class display appends stream name and code', () => {
  const display = getPupilClassDisplay({
    ...pupil,
    streamId: 'west',
    streamName: 'West',
    streamCode: 'W',
    streamClassId: schoolClass.id,
  }, schoolClass);
  assert.equal(display.name, 'Primary One West');
  assert.equal(display.code, 'P.1 W');
});

test('stale stream assignment from another class is ignored', () => {
  const display = getPupilClassDisplay({
    ...pupil,
    streamId: 'west',
    streamName: 'West',
    streamCode: 'W',
    streamClassId: 'old-class',
  }, schoolClass);
  assert.equal(display.name, 'Primary One');
  assert.equal(display.hasStream, false);
});

test('persisted pupil labels are not given the stream suffix twice', () => {
  const display = getPupilClassDisplay({
    ...pupil,
    className: 'Primary One East',
    classCode: 'P.1 E',
    streamId: 'east',
    streamName: 'East',
    streamCode: 'E',
    streamClassId: schoolClass.id,
  });
  assert.equal(display.name, 'Primary One East');
  assert.equal(display.code, 'P.1 E');
});

test('active streams follow the academic-year configuration order', () => {
  assert.deepEqual(getActiveClassStreams(schoolClass, 'year-2026').map(stream => stream.id), ['east', 'west']);
  assert.deepEqual(getActiveClassStreams(schoolClass, 'missing'), []);
});

test('class overview stream stats require every active pupil to be distributed', () => {
  const partialStats = getClassStreamPupilStats(schoolClass, [
    { classId: schoolClass.id, status: 'Active', streamId: 'east', streamClassId: schoolClass.id },
    { classId: schoolClass.id, status: 'Active' },
  ], 'year-2026');
  assert.equal(partialStats.isDistributed, false);
  assert.equal(partialStats.total, 2);

  const completeStats = getClassStreamPupilStats(schoolClass, [
    { classId: schoolClass.id, status: 'Active', streamId: 'east', streamClassId: schoolClass.id },
    { classId: schoolClass.id, status: 'Active', streamId: 'west', streamClassId: schoolClass.id },
    { classId: schoolClass.id, status: 'Active', streamId: 'west', streamClassId: schoolClass.id },
  ], 'year-2026');
  assert.equal(completeStats.isDistributed, true);
  assert.deepEqual(completeStats.streams.map(stream => [stream.name, stream.pupilCount]), [
    ['East', 1],
    ['West', 2],
  ]);
  assert.equal(completeStats.total, 3);
});

test('stream names and codes are unique without regard to case', () => {
  assert.throws(() => assertUniqueStreams([
    { id: '1', name: 'East', code: 'E' },
    { id: '2', name: ' east ', code: 'W' },
  ]), /already in use/);
});

test('exam pupil filtering uses immutable exam snapshot stream ids', () => {
  const snapshots: ExamRecordPupilInfo[] = [
    { pupilId: '1', name: 'Ada', admissionNumber: 'A', classNameAtExam: 'P1 East', streamIdAtExam: 'east' },
    { pupilId: '2', name: 'Ben', admissionNumber: 'B', classNameAtExam: 'P1 West', streamIdAtExam: 'west' },
  ];
  assert.deepEqual(filterExamPupilsByStream(snapshots, 'east').map(item => item.pupilId), ['1']);
  assert.equal(filterExamPupilsByStream(snapshots, 'all').length, 2);
});

test('legacy exam pupils inherit a current stream only while still in the exam class', () => {
  const snapshot: ExamRecordPupilInfo = {
    pupilId: pupil.id,
    name: 'Ada A',
    admissionNumber: pupil.admissionNumber,
    classNameAtExam: schoolClass.name,
    classCodeAtExam: schoolClass.code,
  };
  const enriched = enrichExamPupilStreamIdentity(snapshot, {
    ...pupil,
    className: schoolClass.name,
    classCode: schoolClass.code,
    streamId: 'east',
    streamName: 'East',
    streamCode: 'E',
    streamClassId: schoolClass.id,
    streamAcademicYearId: 'year-2026',
  }, schoolClass, 'year-2026');

  assert.equal(enriched.streamIdAtExam, 'east');
  assert.equal(enriched.classNameAtExam, 'Primary One East');
  assert.equal(enriched.classCodeAtExam, 'P.1 E');
  assert.equal(enrichExamPupilStreamIdentity(snapshot, {
    ...pupil,
    classId: 'another-class',
    streamId: 'east',
    streamName: 'East',
    streamCode: 'E',
  }, schoolClass).streamIdAtExam, undefined);
  assert.equal(enrichExamPupilStreamIdentity(snapshot, {
    ...pupil,
    streamId: 'east',
    streamName: 'East',
    streamCode: 'E',
    streamClassId: schoolClass.id,
    streamAcademicYearId: 'year-2026',
  }, schoolClass, 'year-2025').streamIdAtExam, undefined);
});

test('exam stream choices are recovered from pupil snapshots without duplicating declared streams', () => {
  const snapshots: ExamRecordPupilInfo[] = [
    { pupilId: '1', name: 'Ada', admissionNumber: 'A', classNameAtExam: 'P1 East', streamIdAtExam: 'east', streamNameAtExam: 'East', streamCodeAtExam: 'E' },
    { pupilId: '2', name: 'Ben', admissionNumber: 'B', classNameAtExam: 'P1 West', streamIdAtExam: 'west', streamNameAtExam: 'West', streamCodeAtExam: 'W' },
  ];
  assert.deepEqual(deriveExamStreams([{ id: 'east', name: 'East', code: 'E' }], snapshots), [
    { id: 'east', name: 'East', code: 'E' },
    { id: 'west', name: 'West', code: 'W' },
  ]);
});

test('corrected exam stream labels keep recorded IDs, pupils and source snapshots intact', () => {
  const snapshots: ExamRecordPupilInfo[] = [
    { pupilId: '1', name: 'Ada', admissionNumber: 'A', classNameAtExam: 'Primary One West', classCodeAtExam: 'P.1 W', streamIdAtExam: 'east', streamNameAtExam: 'West', streamCodeAtExam: 'W' },
    { pupilId: '2', name: 'Ben', admissionNumber: 'B', classNameAtExam: 'Primary One East', classCodeAtExam: 'P.1 E', streamIdAtExam: 'west', streamNameAtExam: 'East', streamCodeAtExam: 'E' },
  ];
  const declared = [{ id: 'east', name: 'West', code: 'W' }, { id: 'west', name: 'East', code: 'E' }];
  const before = structuredClone({ snapshots, declared });
  const choices = deriveExamStreams(declared, snapshots, schoolClass);
  assert.deepEqual(choices, [{ id: 'east', name: 'East', code: 'E' }, { id: 'west', name: 'West', code: 'W' }]);
  const display = snapshots.map(snapshot => getExamPupilDisplaySnapshot(snapshot, schoolClass));
  assert.equal(display[0].classNameAtExam, 'Primary One East');
  assert.equal(display[0].classCodeAtExam, 'P.1 E');
  assert.equal(display[0].streamNameAtExam, 'West', 'Raw historical label stays available in presentation copies');
  assert.deepEqual(filterExamPupilsByStream(display, 'east').map(item => item.pupilId), ['1']);
  assert.deepEqual(filterExamPupilsByStream(display, 'west').map(item => item.pupilId), ['2']);
  assert.deepEqual({ snapshots, declared }, before);
});

test('correcting labels never broadens a selected exam scope with current streams', () => {
  const declared = [{ id: 'west', name: 'Old name', code: 'OLD' }];
  assert.deepEqual(deriveExamStreams(declared, [], schoolClass), [{ id: 'west', name: 'West', code: 'W' }]);
});

test('unavailable or retired definitions preserve saved exam labels', () => {
  const snapshot: ExamRecordPupilInfo = { pupilId: '1', name: 'Ada', admissionNumber: 'A', classNameAtExam: 'Old Class North', streamIdAtExam: 'north', streamNameAtExam: 'North', streamCodeAtExam: 'N' };
  assert.strictEqual(getExamPupilDisplaySnapshot(snapshot, schoolClass), snapshot);
  assert.strictEqual(getExamPupilDisplaySnapshot(snapshot, null), snapshot);
  assert.deepEqual(deriveExamStreams([{ id: 'north', name: 'North', code: 'N' }], [snapshot], schoolClass), [{ id: 'north', name: 'North', code: 'N' }]);
});

test('new exams capture the class definition by ID rather than stale pupil labels', () => {
  const current = { ...pupil, streamId: 'east', streamName: 'Wrong West', streamCode: 'W', streamClassId: schoolClass.id };
  assert.deepEqual(snapshotExamPupilStreamIdentity(current, schoolClass), { streamIdAtExam: 'east', streamNameAtExam: 'East', streamCodeAtExam: 'E' });
  assert.deepEqual(snapshotExamPupilStreamIdentity({ ...current, streamClassId: 'other' }, schoolClass), {});
  assert.deepEqual(snapshotExamPupilStreamIdentity({ ...current, classId: 'other' }, schoolClass), {});
  assert.deepEqual(snapshotExamPupilStreamIdentity({ ...current, streamId: 'deleted' }, schoolClass), {});
});
