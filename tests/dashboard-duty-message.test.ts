import test from 'node:test';
import assert from 'node:assert/strict';
import { getDutyEndMessage } from '../src/lib/dashboard/duty-message';

test('weekly duty uses natural wording with its exact Friday or Sunday end date', () => {
  assert.equal(getDutyEndMessage('2026-10-30', '2026-10-27'), "You'll be on duty until the end of this week (Friday, 30 October).");
  assert.equal(getDutyEndMessage('2026-11-01', '2026-10-27'), "You'll be on duty until the end of this week (Sunday, 1 November).");
});

test('a duty ending today does not promise more days', () => {
  assert.equal(getDutyEndMessage('2026-10-30', '2026-10-30'), 'Today is your last day on this duty.');
});

test('shorter and longer assignments use their actual end date', () => {
  assert.equal(getDutyEndMessage('2026-10-28', '2026-10-27'), "You'll be on duty until Wednesday, 28 October.");
  assert.equal(getDutyEndMessage('2026-11-06', '2026-10-27'), "You'll be on duty until Friday, 6 November.");
});

test('past or invalid dates cannot claim an ongoing assignment', () => {
  assert.equal(getDutyEndMessage('2026-10-26', '2026-10-27'), 'This duty has ended.');
  assert.equal(getDutyEndMessage('', '2026-10-27'), '');
});
