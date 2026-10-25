import assert from 'node:assert/strict';
import test from 'node:test';
import type { Class, GeneratedPeriod, Staff, TimetableEntry } from '../src/types';
import { getSelectableTimetableCells, planTimetableSelectionEdit, resolveTimetableSelection, timetableCellKey, timetableRowKey, timetableSelectionFingerprint, type SelectionData, type TimetableSelectionEdit } from '../src/lib/utils/timetable-selection';
import { getTimetableEntryRenderSegment } from '../src/lib/utils/timetable-streams';
import { buildTimetablePrintDayCells } from '../src/lib/utils/timetable-print-layout';

const periods = [1, 2].flatMap(dayOfWeek => [
  { id: `${dayOfWeek}a`, dayOfWeek, periodNumber: 1, startTime: '08:00', endTime: '09:00', type: 'lesson' },
  { id: `${dayOfWeek}b`, dayOfWeek, periodNumber: 2, startTime: '09:00', endTime: '10:00', type: 'lesson' },
  { id: `${dayOfWeek}break`, dayOfWeek, periodNumber: 0, startTime: '10:00', endTime: '10:30', type: 'break' },
  { id: `${dayOfWeek}c`, dayOfWeek, periodNumber: 3, startTime: '10:30', endTime: '11:30', type: 'lesson' },
]) as GeneratedPeriod[];
const cls = (id: string, ids: string[]) => ({ id, name: id, subjectAssignments: [{ subjectId: 'math', teacherIds: ids }] }) as Class;
const data = (extra: Partial<SelectionData> = {}): SelectionData => ({
  classes: [cls('p1', ['t1', 'assistant']), cls('p2', ['t2'])],
  staff: ['t1', 't2', 'assistant'].map(id => ({ id, firstName: id, lastName: 'Teacher' })) as Staff[],
  periods, entries: [], yearId: '2026', ...extra,
});
const cell = (classId: string, periodId: string, streamId?: string) => ({ classId, periodId, ...(streamId ? { streamId } : {}) });
const entry = (extra: Partial<TimetableEntry> = {}) => ({ id: 'old', classId: 'p1', periodId: '1a', subjectId: 'math', teacherId: 't1', createdAt: 'now', ...extra });
const edit = (extra: Partial<TimetableSelectionEdit> = {}): TimetableSelectionEdit => ({ cells: [cell('p1', '1a'), cell('p2', '2b')], kind: 'subject', subjectId: 'math', ...extra });

test('a multi-class multi-day assignment resolves the subject teacher separately per class', () => {
  const plan = planTimetableSelectionEdit(edit(), data());
  assert.deepEqual(plan.writes.map(e => [e.classId, e.periodId, e.teacherId]), [['p1', '1a', 't1'], ['p2', '2b', 't2']]);
  assert.equal(plan.warnings.length, 0);
});

test('preserves a valid existing assistant and supports legacy teacherId assignments', () => {
  const d = data({ classes: [cls('p1', ['t1', 'assistant']), { ...cls('p2', []), subjectAssignments: [{ subjectId: 'math', teacherId: 't2', teacherIds: [] }] }], entries: [entry({ teacherId: 'assistant' })] });
  assert.deepEqual(resolveTimetableSelection(edit(), d).map(r => r.teacherId), ['assistant', 't2']);
  assert.deepEqual(resolveTimetableSelection(edit({ teachers: { [timetableRowKey(cell('p1', '1a'))]: 't1' } }), d).map(r => r.teacherId), ['t1', 't2']);
});

test('never borrows another class teacher and requires acknowledgement of unassigned teachers', () => {
  assert.throws(() => planTimetableSelectionEdit(edit({ teachers: { [timetableRowKey(cell('p1', '1a'))]: 't2' } }), data()), /Choose an available teacher/);
  const d = data({ classes: [cls('p1', [])] });
  const e = edit({ cells: [cell('p1', '1a')] });
  assert.throws(() => planTimetableSelectionEdit(e, d), /No teacher assigned/);
  assert.equal(planTimetableSelectionEdit({ ...e, teachers: { [timetableRowKey(e.cells[0])]: 'UNASSIGNED' } }, d).writes[0].teacherId, 'UNASSIGNED');
  assert.throws(() => planTimetableSelectionEdit(edit({ subjectId: 'english' }), data()), /Subject is not assigned/);
});

test('select week deduplicates cells and excludes breaks and unrelated classes', () => {
  const cells = getSelectableTimetableCells(data(), ['p1'], [1, 2]);
  assert.equal(cells.length, 6);
  assert.equal(new Set(cells.map(timetableCellKey)).size, 6);
  assert(cells.every(c => c.classId === 'p1' && !c.periodId.includes('break')));
  assert.equal(planTimetableSelectionEdit(edit({ cells: [cells[0], cells[0]] }), data()).writes.length, 1);
});

test('merge stays in each class/day and never covers a break or omitted lesson', () => {
  const cells = getSelectableTimetableCells(data(), ['p1', 'p2'], [1, 2]);
  const plan = planTimetableSelectionEdit(edit({ cells, merge: true }), data());
  assert.equal(plan.writes.length, 4);
  for (const write of plan.writes) {
    assert.equal(write.periodIds?.length, 3);
    assert.equal(new Set(write.periodIds!.map(id => periods.find(p => p.id === id)!.dayOfWeek)).size, 1);
  }
  const sparse = planTimetableSelectionEdit(edit({ cells: [cell('p1', '1a'), cell('p1', '1c')], merge: true }), data());
  assert.equal(sparse.writes.length, 2);
  const day = periods.filter(p => p.dayOfWeek === 1);
  const merged = plan.writes[0] as TimetableEntry;
  assert.equal(getTimetableEntryRenderSegment(merged, day, 0).span, 2);
  assert.equal(getTimetableEntryRenderSegment(merged, day, 3).span, 1);
});

test('unmerged explicit periods render every selected cell', () => {
  const e = entry({ periodIds: ['1a', '1b'], mergePeriods: false });
  assert.deepEqual(getTimetableEntryRenderSegment(e, periods.filter(p => p.dayOfWeek === 1), 1), { shouldRender: true, span: 1 });
});

test('partial edit retains unselected portions of an existing merged activity', () => {
  const d = data({ entries: [entry({ entryType: 'activity', subjectId: 'ACTIVITY', activityName: 'Test', periodIds: ['1a', '1b', '1c'], mergePeriods: true })] });
  const plan = planTimetableSelectionEdit(edit({ cells: [cell('p1', '1b')] }), d);
  assert.deepEqual(plan.removals, ['old']);
  const activities = plan.writes.filter(e => e.entryType === 'activity');
  assert.deepEqual(activities.flatMap(e => e.periodIds), ['1a', '1c']);
  assert.equal(plan.writes.find(e => e.periodId === '1b')?.teacherId, 't1');
});

test('editing a grouped activity unlinks only that class and period from peer rows', () => {
  const d = data({ entries: ['p1', 'p2'].map(id => entry({ id, classId: id, entryType: 'activity', subjectId: 'ACTIVITY', activityName: 'Test', linkedClassIds: [id === 'p1' ? 'p2' : 'p1'], periodIds: ['1a', '1b'], mergePeriods: true })) });
  const plan = planTimetableSelectionEdit(edit({ cells: [cell('p1', '1a')] }), d);
  assert.deepEqual(plan.removals, ['p1', 'p2']);
  assert.deepEqual(plan.writes.find(e => e.classId === 'p2' && e.periodId === '1a')?.linkedClassIds, []);
  assert.deepEqual(plan.writes.find(e => e.classId === 'p2' && e.periodId === '1b')?.linkedClassIds, ['p1']);
});

test('clear removes only selected cells and retains all other days', () => {
  const e = entry({ periodIds: ['1a', '1b'], mergePeriods: true });
  const plan = planTimetableSelectionEdit(edit({ kind: 'clear', cells: [cell('p1', '1a')] }), data({ entries: [e, entry({ id: 'tomorrow', periodId: '2a' })] }));
  assert.deepEqual(plan.removals, ['old']);
  assert.deepEqual(plan.writes.flatMap(e => e.periodIds), ['1b']);
});

test('stream identity is validated and automatic resolution preserves stream-specific teachers', () => {
  const c = { ...cls('p1', ['t1', 'assistant']), streams: [{ id: 'a', name: 'Alpha', code: 'A', createdAt: 'now' }, { id: 'b', name: 'Beta', code: 'B', createdAt: 'now' }], streamConfigurations: [{ academicYearId: '2026', enabled: true, activeStreamIds: ['a', 'b'], version: 1, configuredAt: 'now' }] };
  const d = data({ classes: [c], profile: { classIds: ['p1'], streamLayouts: { p1: { defaultMode: 'separate' } } } as unknown as SelectionData['profile'], entries: [entry({ streamId: 'b', teacherId: 'assistant' })] });
  const cells = getSelectableTimetableCells(d, ['p1'], [1]);
  assert.equal(cells.length, 6);
  const plan = planTimetableSelectionEdit(edit({ cells: [cell('p1', '1a', 'a'), cell('p1', '1a', 'b')] }), d);
  assert.deepEqual(plan.writes.map(e => [e.streamId, e.teacherId]), [['a', 't1'], ['b', 'assistant']]);
  assert.throws(() => planTimetableSelectionEdit(edit({ cells: [cell('p1', '1a')] }), d), /stream layout/);
});

test('warns about actual overlapping times and alternative teachers, including new assignments', () => {
  const d = data({ classes: [cls('p1', ['t1']), cls('p2', ['t1'])] });
  assert(planTimetableSelectionEdit(edit({ cells: [cell('p1', '1a'), cell('p2', '1a')] }), d).warnings.length > 0);
  const alt = data({ entries: [entry({ classId: 'p2', teacherId: 't2', optionalTeacherId: 't1', periodIds: ['1a', '1b'], mergePeriods: true })] });
  assert(planTimetableSelectionEdit(edit({ cells: [cell('p1', '1b')] }), alt).warnings.length > 0);
});

test('preview fingerprint detects changed teacher assignments and ignores metadata encoding', () => {
  const a = planTimetableSelectionEdit(edit(), data());
  const b = planTimetableSelectionEdit(edit(), data({ classes: [cls('p1', ['assistant']), cls('p2', ['t2'])] }));
  assert.notEqual(timetableSelectionFingerprint(a), timetableSelectionFingerprint(b));
  assert.equal(timetableSelectionFingerprint(a), timetableSelectionFingerprint({ ...a, writes: a.writes.map(e => ({ ...e, createdAt: 'later' })) }));
});

test('PDF planning preserves class teachers and break boundaries after a full-week merge', () => {
  const d = data();
  const cells = getSelectableTimetableCells(d, ['p1', 'p2'], [1, 2]);
  const plan = planTimetableSelectionEdit(edit({ cells, merge: true }), d);
  const rows = d.classes.map(classItem => ({ classItem, streamIndex: 0, streamCount: 1 }));
  for (const day of [1, 2]) {
    const printed = buildTimetablePrintDayCells(rows, periods.filter(p => p.dayOfWeek === day), periods, plan.writes as TimetableEntry[], day);
    assert.deepEqual(printed.map(row => row.map(c => [c.colSpan, c.entry?.teacherId])), [[[2, 't1'], [1, 't1']], [[2, 't2'], [1, 't2']]]);
  }
});
