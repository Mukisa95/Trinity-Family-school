import assert from 'node:assert/strict';
import test from 'node:test';
import { groupHistoryLogs, historyDay } from '../src/lib/utils/history-log-groups';
import { getHistoryLogRoute, getHistoryPupilId, normaliseHistoryRoute, uniquePupilNameLookup } from '../src/lib/utils/history-log-navigation';
import type { HistoryLogRecord } from '../src/lib/services/history-log.service';

const entry = (id: string, overrides: Partial<HistoryLogRecord> = {}): HistoryLogRecord => ({
  id, a: 'update', e: 'pupil', rid: 'pupil-a', ts: '2026-10-14T12:00:00Z', ...overrides,
});

test('same pupil/day stacks across modules without losing records or newest-first order', () => {
  const rows = [entry('new'), entry('other', { rid: 'pupil-b', rl: 'Same Name' }),
    entry('payment', { e: 'payment', rid: 'payment-id', m: { pupilId: 'pupil-a', amount: 5000 } }),
    entry('old', { ts: '2026-10-13T21:30:00Z' }), entry('yesterday', { ts: '2026-10-13T18:00:00Z' }),
    entry('unrelated', { e: 'user', rid: 'user-a' })];
  const groups = groupHistoryLogs(rows);
  assert.equal(groups.length, 4);
  assert.deepEqual(groups[0].logs.map(log => log.id), ['new', 'payment', 'old']);
  assert.equal(groups[0].day, '2026-10-14');
  assert.equal(groups.flatMap(group => group.logs).length, rows.length);
  assert.ok(groups[0].logs.every(log => rows.includes(log)), 'Original full records are retained');
  assert.deepEqual(rows.map(log => log.id), ['new', 'other', 'payment', 'old', 'yesterday', 'unrelated']);
});

test('school-local midnight defines a day; unknown timestamps never form a stack', () => {
  assert.equal(historyDay('2026-10-14T20:59:59Z'), '2026-10-14');
  assert.equal(historyDay('2026-10-14T21:00:00Z'), '2026-10-15');
  assert.equal(groupHistoryLogs([entry('a', { ts: undefined }), entry('b', { ts: 'invalid' })]).length, 2);
});

test('legacy pupil names only resolve when unique, while explicit IDs take priority', () => {
  const names = uniquePupilNameLookup({ a: 'Unique Name', b: 'Same Name', c: ' same   name ' });
  assert.equal(getHistoryPupilId(entry('1', { e: 'payment', m: { pupilName: 'UNIQUE NAME' } }), names), 'a');
  assert.equal(getHistoryPupilId(entry('2', { e: 'payment', m: { pupilName: 'Same Name' } }), names), undefined);
  assert.equal(getHistoryPupilId(entry('3', { e: 'payment', m: { pupilID: 'b', pupilName: 'Unique Name' } }), names), 'b');
  assert.equal(groupHistoryLogs([entry('a', { rid: 'b', rl: 'Same Name' }), entry('b', { rid: 'c', rl: 'Same Name' })], names).length, 2);
});

test('filtering actions before grouping preserves the matching count and all matching content', () => {
  const logs = [entry('1', { a: 'create' }), entry('2'), entry('3')];
  const filtered = logs.filter(log => log.a === 'update');
  assert.deepEqual(groupHistoryLogs(filtered)[0].logs.map(log => log.id), ['2', '3']);
});

test('new routes preserve useful context and exclude credential/redirect parameters', () => {
  assert.equal(normaliseHistoryRoute('/pupil-detail?id=a&token=secret&returnTo=https://other.test#private'), '/pupil-detail?id=a');
  assert.equal(normaliseHistoryRoute('/fees?tab=requirements'), '/fees?tab=requirements');
  for (const value of ['https://other.test', '//other.test', '/\\other.test', 'javascript:alert(1)', '/api/delete', '/_next/file', '/\nother']) {
    assert.equal(normaliseHistoryRoute(value), undefined, value);
  }
});

test('stored action page wins; legacy payments/banking/pupils resolve real page contracts', () => {
  assert.equal(getHistoryLogRoute(entry('1', { rp: '/pupils/edit?id=pupil-a' })), '/pupils/edit?id=pupil-a');
  assert.equal(getHistoryLogRoute(entry('2', { e: 'payment', rid: 'payment-id', m: { pupilId: 'id/with space' } })), '/fees/collect/id%2Fwith%20space');
  assert.equal(getHistoryLogRoute(entry('3', { e: 'bank_loan', m: { pupilId: 'pupil-a' } })), '/banking/pupil-banking-details?pupilId=pupil-a');
  assert.equal(getHistoryLogRoute(entry('4')), '/pupil-detail?id=pupil-a');
  assert.equal(getHistoryLogRoute(entry('5', { a: 'delete' })), '/pupils');
  assert.equal(getHistoryLogRoute(entry('6', { e: 'unknown', rp: '//other.test' })), undefined);
  assert.equal(getHistoryPupilId(entry('7', { e: 'bank_account', rp: '/banking/pupil-banking-details?pupilId=a' })), 'a');
});
