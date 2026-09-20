import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAttendanceDateRangeBounds,
  mergeAttendanceDateResults,
} from '../src/lib/utils/attendance-date-range';

test('attendance day bounds include local midnight and exclude the next day', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'Africa/Kampala';
  try {
    const bounds = getAttendanceDateRangeBounds('2026-03-02', '2026-03-02');
    assert.equal(bounds.start.toISOString(), '2026-03-01T21:00:00.000Z');
    assert.equal(bounds.endExclusive.toISOString(), '2026-03-02T21:00:00.000Z');
    assert.equal(bounds.legacyStart, '2026-03-02');
    assert.equal(bounds.legacyEndExclusive, '2026-03-03');

    const leap = getAttendanceDateRangeBounds('2024-02-29', '2024-02-29');
    assert.equal(leap.legacyEndExclusive, '2024-03-01');
    assert.throws(() => getAttendanceDateRangeBounds('2026-02-30', '2026-03-02'));
    assert.throws(() => getAttendanceDateRangeBounds('2026-03-03', '2026-03-02'));
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('mixed timestamp and legacy date results retain all records in date/recording order', () => {
  const timestampRecords = [
    { id: 'timestamp', date: '2026-03-02T00:00:00', recordedAt: '2026-03-02T09:00:00Z' },
    { id: 'previous', date: '2026-03-01T00:00:00', recordedAt: '2026-03-01T09:00:00Z' },
  ];
  const legacyRecords = [
    { id: 'legacy', date: '2026-03-02', recordedAt: '2026-03-02T10:00:00Z' },
    { id: 'timestamp', date: '2026-03-02', recordedAt: '2026-03-02T08:00:00Z' },
  ];
  assert.deepEqual(
    mergeAttendanceDateResults(timestampRecords, legacyRecords).map(record => record.id),
    ['legacy', 'timestamp', 'previous'],
  );
  assert.deepEqual(mergeAttendanceDateResults([], []), []);
});
