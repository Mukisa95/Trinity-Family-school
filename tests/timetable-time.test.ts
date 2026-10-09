import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTimetableCountdown } from '../src/lib/utils/timetable-time';

test('long countdowns split hours, minutes and seconds', () => {
    assert.equal(formatTimetableCountdown(7384), '2h 03m 04s');
    assert.equal(formatTimetableCountdown(3600), '1h 00m 00s');
});
test('short countdowns retain all units and stop at zero', () => {
    assert.equal(formatTimetableCountdown(59), '0h 00m 59s');
    assert.equal(formatTimetableCountdown(0), '0h 00m 00s');
    assert.equal(formatTimetableCountdown(-10), '0h 00m 00s');
});
