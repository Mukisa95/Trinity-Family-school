import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Class, GeneratedPeriod, TimetableEntry, TimetableProfile } from '../src/types';
import {
  buildTimetableClassRowsForDay,
  classUsesStreamRowsForDay,
  findTimetableEntryForRow,
  getTimetableBreakLabelFontSize,
  getTimetableClassColumnWidth,
  getTimetableRenderedPeriodSpan,
  getTimetableStreamInitial,
  getTimetableStreamMode,
} from '../src/lib/utils/timetable-streams';

const schoolClass = {
  id: 'p1', name: 'Primary 1', code: 'P1', level: 'Lower Primary', order: 1,
  classTeacherId: '', subjectAssignments: [], createdAt: '',
  streams: [
    { id: 'east', name: 'East', code: 'E', createdAt: '' },
    { id: 'west', name: 'West', code: 'W', createdAt: '' },
  ],
  streamConfigurations: [{ academicYearId: '2026', activeStreamIds: ['east', 'west'], enabled: true, version: 1, configuredAt: '' }],
} satisfies Class;

const periods = [
  { id: 'mon-1', dayOfWeek: 1, periodNumber: 1, startTime: '08:00', endTime: '09:00', type: 'lesson' },
  { id: 'tue-1', dayOfWeek: 2, periodNumber: 1, startTime: '08:00', endTime: '09:00', type: 'lesson' },
  { id: 'fri-1', dayOfWeek: 5, periodNumber: 1, startTime: '08:00', endTime: '09:00', type: 'lesson' },
] satisfies GeneratedPeriod[];

const profile = {
  streamLayouts: {
    p1: {
      defaultMode: 'consolidated',
      dayModes: { '1': 'separate' },
      periodModes: { 'tue-1': 'separate' },
    },
  },
} as Pick<TimetableProfile, 'streamLayouts'>;

test('period overrides day and class stream defaults', () => {
  assert.equal(getTimetableStreamMode(profile, 'p1', 1, 'mon-1'), 'separate');
  assert.equal(getTimetableStreamMode(profile, 'p1', 2, 'tue-1'), 'separate');
  assert.equal(getTimetableStreamMode(profile, 'p1', 3, 'missing'), 'consolidated');
  assert.equal(getTimetableStreamMode(undefined, 'p1', 1, 'mon-1'), 'consolidated');
});

test('a separated day expands one class into ordered stream sub-rows', () => {
  const mondayRows = buildTimetableClassRowsForDay([schoolClass], profile, '2026', 1, periods);
  assert.deepEqual(mondayRows.map(row => row.stream?.id), ['east', 'west']);
  assert.equal(mondayRows[0].streamCount, 2);

  const legacyRows = buildTimetableClassRowsForDay([schoolClass], undefined, '2026', 1, periods);
  assert.equal(legacyRows.length, 1);
});

test('a fully consolidated day keeps one class row and hides stream labels', () => {
  assert.equal(classUsesStreamRowsForDay(schoolClass, profile, '2026', 5, periods), false);
  const fridayRows = buildTimetableClassRowsForDay([schoolClass], profile, '2026', 5, periods);
  assert.equal(fridayRows.length, 1);
  assert.equal(fridayRows[0].stream, undefined);
});

test('entry lookup keeps consolidated and stream lessons distinct', () => {
  const entries = [
    { id: 'all', classId: 'p1', periodId: 'mon-1', subjectId: 'math', teacherId: 't1', createdAt: '' },
    { id: 'east', classId: 'p1', periodId: 'tue-1', streamId: 'east', subjectId: 'eng', teacherId: 't2', createdAt: '' },
  ] satisfies TimetableEntry[];
  assert.equal(findTimetableEntryForRow(entries, 'p1', 'mon-1', 'consolidated')?.id, 'all');
  assert.equal(findTimetableEntryForRow(entries, 'p1', 'tue-1', 'separate', 'east')?.id, 'east');
  assert.equal(findTimetableEntryForRow(entries, 'p1', 'tue-1', 'separate', 'west'), undefined);
});

test('dashboard lessons identify stream entries with a compact initial', () => {
  assert.equal(getTimetableStreamInitial({ streamId: 'east', streamCode: 'E' }, schoolClass), 'E');
  assert.equal(getTimetableStreamInitial({ streamId: 'west' }, schoolClass), 'W');
  assert.equal(getTimetableStreamInitial({ streamId: 'north', streamName: 'Stream North' }), 'N');
  assert.equal(getTimetableStreamInitial({}, schoolClass), '');

  const dashboard = readFileSync('src/components/dashboard/DashboardLiveTracker.tsx', 'utf8');
  assert.match(dashboard, /const streamInitial = getTimetableStreamInitial\(e, cls\)/);
  assert.match(dashboard, /if \(streamInitial\) classCode = `\$\{classCode\} \$\{streamInitial\}`/);
});

test('separated stream cells render saved alternative subjects', () => {
  const source = readFileSync('src/components/timetable/TimetableGrid.tsx', 'utf8');

  assert.match(source, /const optionalSubject = entry\?\.optionalSubjectId/);
  assert.match(source, /const isSplitSubject = Boolean\(entry && entry\.entryType !== 'activity' && optionalSubject\)/);
  assert.match(source, /\{optionalSubject\?\.code \|\| optionalSubject\?\.name \|\| '\?'\}/);
  assert.match(source, /\{optionalTeacher \? `\$\{optionalTeacher\.firstName\[0\]\}\. \$\{optionalTeacher\.lastName\}` : ''\}/);
});

test('removing an alternative deletes persisted optional fields and supports clearing the timetable', () => {
  const service = readFileSync('src/lib/services/timetable.service.ts', 'utf8');
  const hooks = readFileSync('src/lib/hooks/use-timetable.ts', 'utf8');
  const page = readFileSync('src/app/timetable/page.tsx', 'utf8');

  assert.match(service, /cleanedEntryData\.optionalSubjectId = deleteField\(\)/);
  assert.match(service, /cleanedEntryData\.optionalTeacherId = deleteField\(\)/);
  assert.match(service, /static async clearOptionalSubjects/);
  assert.match(service, /optionalSubjectId: deleteField\(\)/);
  assert.match(service, /coOptionalTeacherId: deleteField\(\)/);
  assert.match(hooks, /export function useClearTimetableOptionalSubjects/);
  assert.match(hooks, /current\?\.map\(withoutAlternativeFields\)/);
  assert.match(page, /Clear all alternatives/);
  assert.match(page, /clearOptionalSubjectsMutation\.isPending/);
});

test('printable stream labels use a capture-safe layout without text ellipsis', () => {
  const source = readFileSync('src/components/timetable/PrintableTimetable.tsx', 'utf8');

  assert.doesNotMatch(source, /gridTemplateColumns: "1\.05fr 0\.8fr"/);
  assert.match(source, /const CLASS_COLUMN_WIDTH = 118/);
  assert.match(source, /flex: "0 0 67%"/);
  assert.match(source, /overflowWrap: "anywhere"/);
});

test('printable headers and break labels keep balanced spacing', () => {
  const source = readFileSync('src/components/timetable/PrintableTimetable.tsx', 'utf8');

  assert.match(source, /const headerHeight = clamp/);
  assert.match(source, /data-printable-time-cell="start"/);
  assert.match(source, /data-printable-time-cell="end"/);
  assert.match(source, /rowSpan=\{2\}/);
  assert.doesNotMatch(source, /flex: "1 1 50%"/);
  assert.match(source, /justifyContent: "space-evenly"/);
  assert.match(source, /data-printable-break-cell="true"/);
  assert.match(source, /data-printable-break-label="true"/);
  assert.match(source, /position: "absolute"/);
  assert.match(source, /inset: 0/);
  assert.doesNotMatch(source, /letterSpacing: breakLs/);
});

test('printable period spans stop at breaks and never create a trailing column', () => {
  const printablePeriods = [
    { id: 'lesson-1', dayOfWeek: 1, periodNumber: 1, startTime: '08:00', endTime: '09:00', type: 'lesson' },
    { id: 'break', dayOfWeek: 1, periodNumber: 2, startTime: '09:00', endTime: '09:30', type: 'break' },
    { id: 'lesson-2', dayOfWeek: 1, periodNumber: 3, startTime: '09:30', endTime: '10:30', type: 'lesson' },
    { id: 'lesson-3', dayOfWeek: 1, periodNumber: 4, startTime: '10:30', endTime: '11:30', type: 'lesson' },
  ] satisfies GeneratedPeriod[];

  assert.equal(getTimetableRenderedPeriodSpan(printablePeriods, 0, 2), 1);
  assert.equal(getTimetableRenderedPeriodSpan(printablePeriods, 2, 2), 2);
  assert.equal(getTimetableRenderedPeriodSpan(printablePeriods, 3, 2), 1);
});

test('printable break labels resize with the number of visible days', () => {
  const threeDaySize = getTimetableBreakLabelFontSize(3);
  const fiveDaySize = getTimetableBreakLabelFontSize(5);
  const sevenDaySize = getTimetableBreakLabelFontSize(7);

  assert.ok(threeDaySize > fiveDaySize);
  assert.ok(fiveDaySize > sevenDaySize);
  assert.equal(getTimetableBreakLabelFontSize(0), getTimetableBreakLabelFontSize(1));
});

test('screen class column expands only for visible stream sub-rows', () => {
  assert.equal(getTimetableClassColumnWidth(false), 64);
  assert.equal(getTimetableClassColumnWidth(true), 104);
});

test('screen timetable views use dynamic class widths and floating mobile header selectors', () => {
  const dayGrid = readFileSync('src/components/timetable/TimetableGrid.tsx', 'utf8');
  const weekGrid = readFileSync('src/components/timetable/TimetableViewPanel.tsx', 'utf8');
  const page = readFileSync('src/app/timetable/page.tsx', 'utf8');

  assert.match(dayGrid, /getTimetableClassColumnWidth\(hasVisibleStreamRows\)/);
  assert.match(weekGrid, /getTimetableClassColumnWidth\(hasVisibleStreamRows\)/);
  assert.match(page, /meta=\{desktopHeaderSelectors\}/);
  assert.match(page, /actionsLeading=\{mobileHeaderSelectors\}/);
  assert.doesNotMatch(page, /titleControls=\{/);
  assert.match(page, /max-w-\[31vw\]/);
  assert.match(page, /max-w-\[26vw\]/);
  assert.match(page, /id="timetable-mobile-view-control"/);
  assert.match(page, /id="timetable-mobile-filter-control"/);
  assert.match(page, /id="timetable-mobile-filter-value-control"/);
});

test('mobile view and filter controls live in the action island while weekdays remain a visible bar', () => {
  const source = readFileSync('src/components/timetable/TimetableViewPanel.tsx', 'utf8');

  assert.match(source, /createPortal/);
  assert.match(source, /timetable-mobile-view-control/);
  assert.match(source, /timetable-mobile-filter-control/);
  assert.match(source, /timetable-mobile-filter-value-control/);
  assert.match(source, /<option value="day">Day<\/option>/);
  assert.match(source, /<option value="week">Week<\/option>/);
  assert.match(source, /mobileLabel: "Classes"/);
  assert.match(source, /mobileLabel: "Class"/);
  assert.match(source, /mobileLabel: "Tr"/);
  assert.match(source, /mobileLabel: "Sub"/);
  assert.match(source, /aria-label=\{`Show \$\{dayName\}`\}/);
  assert.match(source, /aria-pressed=\{selectedDay === dayId\}/);
  assert.match(source, /justify-between/);
  assert.doesNotMatch(source, /aria-label="Select day of the week"/);
});

test('ordinary printable class labels avoid percentage-height wrappers that html2canvas clips', () => {
  const source = readFileSync('src/components/timetable/PrintableTimetable.tsx', 'utf8');

  assert.match(source, /data-printable-class-label="true"/);
  assert.match(source, /lineHeight: 1\.25/);
  assert.match(source, /padding: row\.stream \? 0 : "2px 3px"/);
});
