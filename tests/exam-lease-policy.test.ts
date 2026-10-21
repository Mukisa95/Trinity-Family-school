import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/lib/utils/exam-lease-policy';

function serviceFixture() {
  let stored: any;
  const transaction = { get: async () => ({ exists: () => !!stored, data: () => stored }), set: (_ref: unknown, value: unknown) => { stored = value; }, delete: () => { stored = undefined; } };
  const stamp = (ms: number) => ({ toDate: () => new Date(ms), toMillis: () => ms });
  const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/services/exam-lease.service.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, Date, console,
    require(name: string) {
      if (name === '@/lib/access/scoped-firestore') return { doc: () => ({}), Timestamp: { now: () => stamp(Date.now()), fromMillis: stamp }, runTransaction: async (_db: unknown, action: (transaction: unknown) => unknown) => action(transaction) };
      if (name === '@/lib/firebase') return { db: {}, auth: {} };
      if (name === '@/lib/utils/exam-lease-policy') return policy;
      throw Error(name);
    },
  });
  return { service: module.exports.ExamLeaseService, transaction, set(value: unknown) { stored = value; }, get stored() { return stored; } };
}

test('same page can recover its previous token while old cleanup cannot remove the replacement', async () => {
  const fixture = serviceFixture(), user = { id: 'a', name: 'Alice' };
  await fixture.service.acquire('exam', user, 'old-token', 'page-a');
  const next = await fixture.service.acquire('exam', user, 'new-token', 'page-a');
  assert.equal(next.acquired, true);
  await fixture.service.release('exam', { lockedByUid: 'a', leaseId: 'old-token' });
  assert.equal(fixture.stored.leaseId, 'new-token');
  await assert.rejects(() => fixture.service.verifyForSave('exam', { lockedByUid: 'a', leaseId: 'old-token' }, fixture.transaction), /Another editor/);
  await fixture.service.verifyForSave('exam', { lockedByUid: 'a', leaseId: 'new-token' }, fixture.transaction);
});

test('another page on the same account and another user remain protected', async () => {
  const fixture = serviceFixture(); await fixture.service.acquire('exam', { id: 'a', name: 'Alice' }, 'token', 'page-a');
  assert.equal((await fixture.service.acquire('exam', { id: 'a', name: 'Alice' }, 'another-token', 'page-b')).acquired, false);
  assert.equal((await fixture.service.acquire('exam', { id: 'b', name: 'Bob' }, 'token', 'page-a')).acquired, false);
  assert.equal(fixture.stored.lockedByUid, 'a');
});

test('legacy long locks expire by their last heartbeat and replacement leases have a short deadline', async () => {
  const fixture = serviceFixture(), now = Date.now();
  fixture.set({ lockedByUid: 'old', leaseId: 'old-token', renewedAt: new Date(now - 180_000).toISOString(), expiresAt: new Date(now + 600_000).toISOString() });
  await assert.rejects(() => fixture.service.verifyForSave('exam', { lockedByUid: 'old', leaseId: 'old-token' }, fixture.transaction), /Another editor/);
  const next = await fixture.service.acquire('exam', { id: 'new', name: 'New editor' }, 'new-token', 'page-new');
  assert.equal(next.acquired, true);
  assert.ok(Date.parse(next.lease.expiresAt) <= Date.now() + policy.EXAM_LEASE_DURATION_MS);
});

test('invalid and expired lock dates are never positive evidence of an active editor', () => {
  assert.equal(policy.isExamLeaseExpired({ expiresAt: 'bad date' }), true);
  assert.equal(policy.isExamLeaseExpired({ expiresAt: new Date(Date.now() - 60_000).toISOString() }), true);
  assert.equal(policy.isExamLeaseExpired({ renewedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }), false);
});
