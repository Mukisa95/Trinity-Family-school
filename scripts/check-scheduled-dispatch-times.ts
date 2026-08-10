import assert from 'node:assert/strict';
import {
  nextAttendanceRunAt,
  nextSmsRunAt,
  parseKampalaDateTime,
} from '../src/lib/scheduler/schedule-times';

assert.equal(
  parseKampalaDateTime('2026-08-10T08:30').toISOString(),
  '2026-08-10T05:30:00.000Z',
);

assert.equal(
  nextSmsRunAt('once', { dateTime: '2026-08-10T08:30' }, new Date('2026-08-10T05:00:00Z'))?.toISOString(),
  '2026-08-10T05:30:00.000Z',
);

assert.equal(
  nextSmsRunAt('dates', {
    entries: [
      { date: '2026-08-10', time: '08:00' },
      { date: '2026-08-11', time: '09:15' },
    ],
  }, new Date('2026-08-10T06:00:00Z'))?.toISOString(),
  '2026-08-11T06:15:00.000Z',
);

assert.equal(
  nextSmsRunAt('weekly', {
    days: ['Monday'],
    times: { Monday: '08:30' },
    startDate: '2026-08-01',
    endDate: '2026-08-31',
  }, new Date('2026-08-10T05:00:00Z'))?.toISOString(),
  '2026-08-10T05:30:00.000Z',
);

assert.equal(
  nextAttendanceRunAt('08:30', new Date('2026-08-14T06:00:00Z'), true).toISOString(),
  '2026-08-17T05:30:00.000Z',
);

console.log('Scheduled dispatch time calculations passed.');
