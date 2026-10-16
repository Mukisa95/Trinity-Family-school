import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import type { Event } from '../src/types';
import { filterActiveStaff } from '../src/lib/utils/staff-status';
import {
  getDashboardEventBriefing, getEventEndNotice, formatBriefingEventDate,
} from '../src/lib/utils/dashboard-event-briefing';

const now = new Date(2026, 9, 16, 10, 0); // Friday in the local calendar.
const event = (id: string, changes: Partial<Event> = {}): Event => ({
  id, title: id, startDate: '2026-10-16', endDate: '2026-10-16',
  isAllDay: true, status: 'Scheduled', ...changes,
} as Event);
const ids = (events: Event[]) => events.map(item => item.id);

test('active staff includes legacy profiles and excludes inactive, suspended and on leave', () => {
  const members = [
    { id: 'active', status: 'active' as const }, { id: 'legacy' },
    { id: 'inactive', status: 'inactive' as const },
    { id: 'suspended', status: 'suspended' as const }, { id: 'leave', status: 'onLeave' as const },
  ];
  assert.deepEqual(filterActiveStaff(members).map(item => item.id), ['active', 'legacy']);
  assert.equal(members.length, 5, 'Shared cache is not mutated');
});

const requireReal = createRequire(import.meta.url);
function dashboardHook(file: string, members: unknown[]) {
  const module = { exports: {} as Record<string, (...args: unknown[]) => any> };
  const data = (value: unknown) => ({ data: value, isLoading: false, error: null, refetch: async () => {} });
  const hooks: Record<string, unknown> = {
    './use-staff': { useStaff: () => data(members) },
    './use-pupils': { usePupils: () => data([]) },
    './use-classes': { useClasses: () => data([]) },
    './use-subjects': { useSubjects: () => data([]) },
    './use-school-settings': { useSchoolSettings: () => data({}) },
    './use-photos': { usePhotos: () => data([]) },
    './use-attendance-summary': { useAttendanceSummary: () => data({ records: [], byClass: [] }) },
    '@/lib/utils/staff-status': { filterActiveStaff },
    react: { useMemo: (callback: () => unknown) => callback() },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, {
    module, exports: module.exports,
    require: (name: string) => {
      if (name === 'date-fns') return requireReal(name);
      if (name in hooks) return hooks[name];
      throw new Error(`Unexpected dashboard dependency: ${name}`);
    },
    process: { env: { NODE_ENV: 'test' } }, console,
  });
  return module.exports;
}

for (const [file, name] of [
  ['src/lib/hooks/use-dashboard-data.ts', 'useDashboardData'],
  ['src/lib/hooks/use-progressive-dashboard.ts', 'useProgressiveDashboard'],
]) {
  test(`${name} returns an active-only count and matching expanded staff list`, () => {
    const members = [{ id: 'a', status: 'active' }, { id: 'b', status: 'inactive' }, { id: 'legacy' }];
    const hook = dashboardHook(file, members)[name];
    let result = hook();
    assert.equal(result.stats.totalStaff, 2);
    assert.equal(result.staff.map((item: { id: string }) => item.id).join(','), 'a,legacy');
    members[0] = { id: 'a', status: 'suspended' };
    result = hook();
    assert.equal(result.stats.totalStaff, 1, 'A status change updates the count without a size change');
    assert.equal(result.staff[0].id, 'legacy');
  });
}

test('today includes continuing and later-today events but excludes finished timed events', () => {
  const result = getDashboardEventBriefing([
    event('afternoon', { isAllDay: false, startTime: '14:00', endTime: '15:00' }),
    event('finished', { isAllDay: false, startTime: '08:00', endTime: '09:00' }),
    event('continuing', { startDate: '2026-10-14', endDate: '2026-10-19' }),
    event('all-day'),
  ], now);
  assert.deepEqual(ids(result.today), ['continuing', 'all-day', 'afternoon']);
  assert.deepEqual(ids(result.laterThisWeek), []);
});

test('other events this week means remaining Monday to Sunday dates excluding today', () => {
  const result = getDashboardEventBriefing([
    event('today'), event('saturday', { startDate: '2026-10-17', endDate: '2026-10-17' }),
    event('sunday', { startDate: '2026-10-18', endDate: '2026-10-20' }),
    event('next-week', { startDate: '2026-10-19', endDate: '2026-10-19' }),
    event('past', { startDate: '2026-10-12', endDate: '2026-10-13' }),
  ], now);
  assert.deepEqual(ids(result.today), ['today']);
  assert.deepEqual(ids(result.laterThisWeek), ['saturday', 'sunday']);
});

test('drafts cancellations completed rejected unapproved and malformed events stay out', () => {
  const result = getDashboardEventBriefing([
    event('draft', { status: 'Draft' }), event('cancelled', { status: 'Cancelled' }),
    event('complete', { status: 'Completed' }), event('rejected', { approvalStatus: 'Rejected' }),
    event('pending', { requiresApproval: true, approvalStatus: 'Pending' }),
    event('invalid', { startDate: 'bad' }), event('reversed', { endDate: '2026-10-15' }),
    event('blank', { title: ' ' }), event('invalid-time', { isAllDay: false, startTime: '29:00' }),
    event('approved', { requiresApproval: true, approvalStatus: 'Approved' }),
  ], now);
  assert.deepEqual(ids(result.today), ['approved']);
});

test('duplicate cached events and linked exam projections appear once', () => {
  const result = getDashboardEventBriefing([
    event('canonical', { linkedExamId: 'exam-1' }), event('canonical'),
    event('legacy', { linkedExamId: 'exam-1' }), event('other'),
  ], now);
  assert.deepEqual(ids(result.today), ['canonical', 'other']);
});

test('inclusive all-day boundaries use the local calendar and roll over at midnight', () => {
  const midnight = new Date(2026, 9, 17, 0, 0);
  const before = getDashboardEventBriefing([event('friday'), event('saturday', { startDate: '2026-10-17', endDate: '2026-10-17' })], new Date(2026, 9, 16, 23, 59, 59));
  assert.deepEqual(ids(before.today), ['friday']);
  const after = getDashboardEventBriefing([event('friday'), event('saturday', { startDate: '2026-10-17', endDate: '2026-10-17' })], midnight);
  assert.deepEqual(ids(after.today), ['saturday']);
});

test('end notices appear only beyond today and popup dates include time or all-day status', () => {
  assert.equal(getEventEndNotice(event('one-day'), now), null);
  assert.equal(getEventEndNotice(event('multi', { endDate: '2026-10-19' }), now), 'It will end on Monday, 19 October.');
  assert.match(getEventEndNotice(event('year', { endDate: '2027-01-04' }), now)!, /2027/);
  assert.match(formatBriefingEventDate(event('all')), /All day/);
  assert.match(formatBriefingEventDate(event('timed', { isAllDay: false, startTime: '14:00' })), /2:00 PM/);
  assert.equal(formatBriefingEventDate(event('invalid', { startDate: 'invalid' })), '');
});
