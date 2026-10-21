import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { Event, Exam } from '../src/types';
import { groupExamCalendarEvents } from '../src/lib/utils/exam-calendar-events';
import { examSourceIds, filterCalendarEvents, isGeneratedCalendarEvent, mergeCalendarEvents } from '../src/lib/utils/calendar-planning';
import { getLegacyExamEventCacheKey, readEventCache, readLegacyExamEventCache, writeEventCache, writeLegacyExamEventCache } from '../src/lib/cache/event-cache';
import { liteWrite, LITE_TTL } from '../src/lib/cache/lite-cache';

const exams = Array.from({ length: 6 }, (_, index) => ({
  id: `mid-p${index + 1}`, classId: `p${index + 1}`, batchId: 'mid', name: 'MID TERM', baseName: 'MID TERM',
  examTypeId: 'et_mid', academicYearId: '2026', termId: 't3',
} as Exam));
const events = exams.map((exam, index) => ({
  id: `exam-${exam.id}`, title: exam.name, isExamEvent: true, startDate: '2026-10-19', endDate: '2026-10-21',
  isAllDay: true, status: 'Scheduled', classIds: [exam.classId], subjectIds: [`subject-${index}`],
  targetAudience: [`Primary ${index + 1}`], tags: ['exam'],
  academicYearId: '2026', termId: 't3',
  type: 'Academic', priority: 'High', recurrence: { frequency: 'None' }, isRecurringInstance: false,
  reminders: [], notificationsSent: [], sendReminders: false, colorCode: '#dc2626',
  requiresApproval: false, requiresAttendance: false, isPublic: true, createdBy: 'system', createdAt: '2026-10-01',
  customFields: { originalExamId: exam.id, classDetails: [{ id: exam.classId, name: `Primary ${index + 1}` }], subjectDetails: [{ id: `subject-${index}`, name: `Subject ${index}` }] },
} satisfies Event));

test('six class exam records become one searchable event with all original exam links', () => {
  const originals = JSON.stringify({ events, exams });
  const grouped = groupExamCalendarEvents(events, exams);
  assert.equal(grouped.length, 1);
  const event = grouped[0];
  assert.equal(event.title, 'MID TERM');
  assert.deepEqual(event.classIds, exams.map(exam => exam.classId));
  assert.deepEqual(event.classNames, events.map(event => event.targetAudience[0]));
  assert.equal(event.subjectIds?.length, 6);
  assert.equal(event.customFields?.classExamDetails.length, 6);
  assert.deepEqual(examSourceIds(event), exams.map(exam => exam.id));
  assert.equal(isGeneratedCalendarEvent(event), true);
  assert.equal(filterCalendarEvents(grouped, { classIds: ['p6'], searchTerm: 'Primary 6' }).length, 1);
  assert.equal(JSON.stringify({ events, exams }), originals);
  assert.deepEqual(groupExamCalendarEvents([...events].reverse(), [...exams].reverse()), grouped);
});

test('each class keeps its own dates, times and venue inside the batch date range', () => {
  const changed = events.map((event, index) => ({ ...event, startDate: index ? '2026-10-20' : '2026-10-18', endDate: index ? '2026-10-23' : '2026-10-19', isAllDay: false, startTime: index ? '10:00' : '09:00', endTime: '12:00', location: `Room ${index}` }));
  const event = groupExamCalendarEvents(changed, exams)[0];
  assert.equal(event.startDate, '2026-10-18');
  assert.equal(event.endDate, '2026-10-23');
  assert.equal(event.customFields?.classTimesVary, true);
  assert.equal(event.location, '');
  assert.equal(event.customFields?.classExamDetails[0].startTime, '09:00');
  assert.equal(event.customFields?.classExamDetails[5].location, 'Room 5');
});

test('same name/date is insufficient to merge unrelated exams', () => {
  assert.equal(groupExamCalendarEvents(events, exams.map(exam => ({ ...exam, batchId: undefined }))).length, 6);
  assert.equal(groupExamCalendarEvents(events, exams.map((exam, index) => ({ ...exam, batchId: `batch-${index}` }))).length, 6);
  assert.equal(groupExamCalendarEvents(events.slice(0, 1), exams)[0], events[0]);
});

test('different terms, years and CAT sets remain separate', () => {
  assert.equal(groupExamCalendarEvents(events, exams.map((exam, index) => ({ ...exam, termId: index < 3 ? 't2' : 't3' }))).length, 2);
  assert.equal(groupExamCalendarEvents(events, exams.map((exam, index) => ({ ...exam, academicYearId: index < 3 ? '2025' : '2026' }))).length, 2);
  const sets = exams.map((exam, index) => ({ ...exam, examTypeId: 'et_cat', name: `PRE-PLE - SET ${index < 3 ? 1 : 2}` }));
  const projectedSets = events.map((event, index) => ({ ...event, title: sets[index].name }));
  assert.deepEqual(groupExamCalendarEvents(projectedSets, sets).map(event => event.title), ['PRE-PLE - SET 1', 'PRE-PLE - SET 2']);
});

test('a canonical batch event supersedes its grouped projection', () => {
  const grouped = groupExamCalendarEvents(events, exams);
  const canonical: Event = { ...events[0], id: 'canonical', customFields: {}, examIntegration: { examIds: exams.map(exam => exam.id), examName: 'MID TERM', maxMarks: 100, passingMarks: 50, classIds: exams.map(exam => exam.classId) } };
  assert.deepEqual(mergeCalendarEvents([canonical], grouped).map(event => event.id), ['canonical']);
});

test('the real legacy projection mapper supplies all six classes to the grouping helper', () => {
  const source = readFileSync('src/lib/hooks/use-events-fixed.ts', 'utf8');
  const ast = ts.createSourceFile('events.ts', source, ts.ScriptTarget.Latest, true);
  let mapper = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'examEvents') mapper = node.parent.parent.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(mapper);
  const code = ts.transpileModule(mapper, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const project = new Function('exams', 'classes', 'subjects', 'academicYears', 'console', code + ';return examEvents;');
  const realExams = exams.map(exam => ({ ...exam, startDate: '2026-10-19', endDate: '2026-10-21', maxMarks: 100, passingMarks: 50 }));
  const classes = exams.map((exam, index) => ({ id: exam.classId, name: `Primary ${index + 1}`, code: `P.${index + 1}` }));
  const projected = project(realExams, classes, [], [], { log() {}, warn() {} });
  const grouped = groupExamCalendarEvents(projected, realExams);
  assert.equal(grouped.length, 1);
  assert.deepEqual(grouped[0].classNames, classes.map(item => item.name));
  assert.equal(grouped[0].customFields?.classExamDetails.length, 6);
});

test('old projection caches are rejected while regular events and exam revisions are preserved', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  try {
    writeEventCache('batch-test', 4, events);
    liteWrite(getLegacyExamEventCacheKey('batch-test'), { schema: 2, revision: 4, data: events }, LITE_TTL.events);
    assert.equal(readLegacyExamEventCache('batch-test'), null);
    assert.equal(readEventCache('batch-test')?.data.length, 6);
    writeLegacyExamEventCache('batch-test', 4, groupExamCalendarEvents(events, exams), 7);
    assert.equal(readLegacyExamEventCache('batch-test')?.data.length, 1);
    assert.equal(readLegacyExamEventCache('batch-test')?.examRevision, 7);
    assert.equal(readLegacyExamEventCache('other-user'), null);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('one cancelled class does not mark the entire batch cancelled', () => {
  assert.equal(groupExamCalendarEvents(events.map((event, index) => ({ ...event, status: index ? 'Scheduled' : 'Cancelled' })), exams)[0].status, 'Scheduled');
  assert.equal(groupExamCalendarEvents(events.map(event => ({ ...event, status: 'Cancelled' })), exams)[0].status, 'Cancelled');
});
