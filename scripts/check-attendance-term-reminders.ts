import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findAcademicYearForTermDate } from '../src/lib/scheduler/academic-term-status';

const years = [{
  id: '2026',
  isActive: true,
  startDate: '2026-02-02',
  endDate: '2026-12-04',
  terms: [
    { id: 'term-2', startDate: '2026-05-18', endDate: '2026-08-21' },
    { id: 'term-3', startDate: '2026-09-14', endDate: '2026-12-04' },
  ],
}];

assert.equal(findAcademicYearForTermDate(years, '2026-08-21')?.id, '2026');
assert.equal(findAcademicYearForTermDate(years, '2026-08-22'), null);
assert.equal(findAcademicYearForTermDate(years, '2026-09-13'), null);
assert.equal(findAcademicYearForTermDate(years, '2026-09-14')?.id, '2026');

const route = readFileSync('src/app/api/cron/send-scheduled-sms/route.ts', 'utf8');
assert.ok(route.includes('const academicYear = findAcademicYearForTermDate(years, date);'));
assert.ok(route.includes("reason: 'Not within an active academic term.'"));
assert.ok(route.includes('if (isExcludedDate(date, academicYear, excluded))'));
assert.ok(!route.includes('if (settings.attendanceReminders.schoolDaysOnly) {'));

const firebaseFunctions = readFileSync('functions/index.js', 'utf8');
assert.ok(firebaseFunctions.includes('const academicYear = academicYearForTermDate(years, date);'));
assert.ok(firebaseFunctions.includes('if (!academicYear || isExcludedDate(date, academicYear, excludedDays))'));
assert.ok(firebaseFunctions.includes('if (!academicYear || isExcludedDate(clock.date, academicYear, excludedDays))'));
assert.ok(firebaseFunctions.includes('if (!liveAcademicYear || isExcludedDate(date, liveAcademicYear, liveExcludedDays))'));

console.log('Attendance reminders are restricted to active, non-excluded term dates.');
