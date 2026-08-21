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
