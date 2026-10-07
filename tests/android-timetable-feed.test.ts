import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeTimetableFeed, getDashboardTimetableTerm } from '../src/lib/offline/timetable-feed';
import type { AndroidOfflineSnapshot } from '../src/lib/offline/android-contracts';

test('all profiles, classes and stream lessons appear in school time without a selection', () => {
  const dataset = (data: unknown) => ({ preparedAt: '2026-10-07T06:00:00.000Z', data });
  const periods = [{ id: 'one', dayOfWeek: 3, periodNumber: 1, startTime: '08:00', endTime: '09:00', type: 'lesson' }, { id: 'two', dayOfWeek: 3, periodNumber: 2, startTime: '09:00', endTime: '10:00', type: 'lesson' }];
  const profile = { id: 'upper', name: 'Upper Primary', academicYearId: 'year', termId: 'term', classIds: ['p4', 'p5'] };
  const tables = [{ complete: true, profile, periods, entries: [{ classId: 'p4', periodId: 'one', periodSpan: 2, subjectId: 'english' }, { classId: 'p5', periodId: 'two', subjectId: 'math' }] },
    { complete: true, profile: { ...profile, id: 'lower', name: 'Lower Primary', classIds: ['p1'], streamLayouts: { p1: { defaultMode: 'separate' } } }, periods, entries: [{ classId: 'p1', periodId: 'two', streamId: 'north', subjectId: 'english' }, { classId: 'p1', periodId: 'two', streamId: 'south', subjectId: 'math' }] },
    { complete: true, profile: { ...profile, id: 'old', termId: 'old-term' }, periods, entries: [] }];
  const snapshot = { datasets: { academicYears: dataset([{ id: 'year', startDate: '2026-01-01', endDate: '2026-12-31', terms: [{ id: 'term', startDate: '2026-09-01', endDate: '2026-12-01' }] }]),
    timetables: dataset(tables), classes: dataset([{ id: 'p4', code: 'P4' }, { id: 'p5', code: 'P5' }, { id: 'p1', code: 'P1', streams: [{ id: 'north', name: 'North' }, { id: 'south', name: 'South' }] }]), subjects: dataset([{ id: 'english', name: 'English' }, { id: 'math', name: 'Mathematics' }]) } } as unknown as AndroidOfflineSnapshot;
  const feed = activeTimetableFeed(snapshot, 'Africa/Kampala', new Date('2026-10-07T06:30:00Z'));
  assert.deepEqual(feed.map(row => row.name), ['Upper Primary', 'Lower Primary']);
  assert.deepEqual(feed[0].rows, [{ className: 'P4', subject: 'English' }, { className: 'P5', subject: 'Mathematics' }]);
  assert.deepEqual(feed[1].rows.map(row => row.className), ['P1 · North', 'P1 · South']);
  assert.equal(feed[0].progress, 50); assert.equal(feed[0].remaining, 30);
  assert.equal(activeTimetableFeed(snapshot, 'Africa/Kampala', new Date('2026-10-07T07:00:00Z'))[0].active, false);
});

test('preparation uses the dashboard fallback when no year has isActive', () => {
  const years = [{ id: 'year', startDate: '2026-01-01', endDate: '2026-12-31', terms: [{ id: 'term', startDate: '2026-09-01', endDate: '2026-12-01' }] }] as Parameters<typeof getDashboardTimetableTerm>[0];
  assert.equal(getDashboardTimetableTerm(years, new Date('2026-10-07T09:00:00Z')).term?.id, 'term');
});
