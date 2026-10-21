import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import { examLeaseDeadline, isExamLeaseExpired, EXAM_LEASE_DURATION_MS, EXAM_LEASE_RENEW_MS, EXAM_LEASE_CLOCK_SKEW_MS } from '../src/lib/utils/exam-lease-policy';

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

/** Render the real hook with deterministic effects and a transactional lock fixture. */
function editorFixture(online = true) {
  let clock = Date.now(), timerId = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  const intervals = new Map<number, () => void>();
  const window = Object.assign(new EventTarget(), {
    setInterval: (fn: () => void) => { const id = ++timerId; intervals.set(id, fn); return id; }, clearInterval: (id: number) => { intervals.delete(id); },
    setTimeout: (fn: () => void, delay: number) => { const id = ++timerId; timers.set(id, { fn, at: clock + delay }); return id; }, clearTimeout: (id: number) => { timers.delete(id); },
  });
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const navigator = { onLine: online };
  let identity = { id: 'fixture-user', firstName: 'Editor', username: 'editor', role: 'Admin' };
  let examId = 'fixture-exam', acquisitions = 0, releases = 0;
  let remote: any = null;
  let gate: Promise<void> | undefined;
  let observe: ((snapshot: unknown) => void) | undefined;
  const state: any[] = [], refs: any[] = [], memos: any[] = [], effects: any[] = [];
  let stateIndex = 0, refIndex = 0, memoIndex = 0, effectIndex = 0;
  const pendingEffects: (() => void)[] = [];
  const changed = (before: unknown[] | undefined, after: unknown[]) => !before || before.some((value, index) => value !== after[index]);
  const memo = (fn: () => unknown, deps: unknown[]) => {
    const index = memoIndex++;
    if (!memos[index] || changed(memos[index].deps, deps)) memos[index] = { value: fn(), deps };
    return memos[index].value;
  };
  const service = {
    ref: () => ({}), normalize: (_: string, data: unknown) => data,
    deadline: examLeaseDeadline,
    isExpired: (lease: any) => isExamLeaseExpired(lease, clock),
    acquire: async (requestedExam: string, user: { id: string; name: string }, leaseId: string, clientId: string) => {
      acquisitions++; if (gate) await gate;
      if (remote && remote.examId === requestedExam && !isExamLeaseExpired(remote, clock) && remote.leaseId !== leaseId && !(remote.clientId === clientId && remote.lockedByUid === user.id)) return { acquired: false, holder: remote };
      remote = { examId: requestedExam, lockedByUid: user.id, lockedByName: user.name, leaseId, clientId, renewedAt: new Date(clock).toISOString(), expiresAt: new Date(clock + EXAM_LEASE_DURATION_MS).toISOString() };
      return { acquired: true, lease: remote };
    },
    release: async (_: string, token: any) => { releases++; if (remote?.leaseId === token.leaseId) remote = null; },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/hooks/use-exam-result-lease.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, exports: module.exports, window, document, navigator, crypto: webcrypto, console, Date: class extends Date { static now() { return clock; } },
    require(name: string) {
      if (name === 'react') return {
        useState: (initial: unknown) => { const index = stateIndex++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = value; }]; },
        useRef: (initial: unknown) => refs[refIndex++] ||= { current: initial },
        useMemo: memo, useCallback: (fn: () => unknown, deps: unknown[]) => memo(() => fn, deps),
        useEffect: (fn: () => unknown, deps: unknown[]) => {
          const index = effectIndex++;
          if (!effects[index] || changed(effects[index].deps, deps)) pendingEffects.push(() => {
            effects[index]?.cleanup?.(); effects[index] = { deps, fn, cleanup: fn() };
          });
        },
      };
      if (name === '@/lib/access/scoped-firestore') return { onSnapshot: (_: unknown, _options: unknown, listener: (snapshot: unknown) => void) => { observe = listener; return () => { if (observe === listener) observe = undefined; }; } };
      if (name === '@/lib/utils/exam-lease-policy') return { EXAM_LEASE_RENEW_MS, EXAM_LEASE_CLOCK_SKEW_MS };
      if (name === '@/lib/contexts/auth-context') return { useAuth: () => ({ user: identity, isAuthenticated: true }) };
      if (name === '@/lib/services/exam-lease.service') return { ExamLeaseService: service };
      if (name === '@/lib/offline/android-app-shell') return { isAndroidOffline: () => !navigator.onLine };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const render = () => {
    stateIndex = refIndex = memoIndex = effectIndex = 0;
    const result = module.exports.useExamResultLease(examId);
    pendingEffects.splice(0).forEach(effect => effect());
    return result;
  };
  return {
    render, window, navigator, document, get acquisitions() { return acquisitions; }, get releases() { return releases; },
    loseLock() { remote = null; },
    block(sameAccount = false) { remote = { examId, lockedByUid: sameAccount ? identity.id : 'other-user', lockedByName: sameAccount ? 'Editor' : 'Another editor', leaseId: 'other-lease', renewedAt: new Date(clock).toISOString(), expiresAt: new Date(clock + EXAM_LEASE_DURATION_MS).toISOString() }; },
    delay(value: Promise<void>) { gate = value; },
    freshIdentity() { identity = { ...identity }; },
    switchExam(value: string) { examId = value; },
    replayEffects() { effects.forEach(effect => effect?.cleanup?.()); effects.forEach(effect => { if (effect) effect.cleanup = effect.fn(); }); },
    get hasRemote() { return remote !== null; },
    notifyMissing() { observe?.({ exists: () => false, metadata: { fromCache: false, hasPendingWrites: false } }); },
    notify(fromCache = false) { const value = remote; observe?.({ exists: () => !!value, data: () => value, metadata: { fromCache, hasPendingWrites: false } }); },
    advance(ms: number) { clock += ms; for (const [id, timer] of timers) if (timer.at <= clock) { timers.delete(id); timer.fn(); } },
    renew() { intervals.forEach(fn => fn()); },
    rename() { identity = { ...identity, firstName: 'Renamed editor' }; },
    previousPageToken() { remote = { ...remote, leaseId: 'previous-page-token' }; },
    dispose() { effects.forEach(effect => effect?.cleanup?.()); },
  };
}

test('an editor opened offline acquires its lock on reconnect and rechecks after a save released it', async () => {
  const fixture = editorFixture(false); fixture.render(); await settle();
  assert.equal(fixture.render().status, 'offline'); assert.equal(fixture.acquisitions, 0);
  fixture.navigator.onLine = true; fixture.window.dispatchEvent(new Event('online')); await settle();
  const editor = fixture.render(); assert.equal(editor.canEdit, true); assert.equal(fixture.acquisitions, 1);
  fixture.loseLock();
  const token = await editor.ensureLease();
  assert.equal(token.lockedByUid, 'fixture-user'); assert.equal(fixture.acquisitions, 2);
  fixture.dispose(); await assert.rejects(editor.ensureLease(), /unavailable/);
});

test('save preflight cannot take another editor lock or hide the conflict', async () => {
  const fixture = editorFixture(); fixture.render(); await settle();
  fixture.block(); await assert.rejects(fixture.render().ensureLease(), /Another editor/);
  const blocked = fixture.render(); assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.canSave, false); assert.equal(blocked.canOverride, true);
  fixture.dispose();
});

test('listener, reconnect and save checks share one pending acquisition', async () => {
  const fixture = editorFixture(); let finish!: () => void;
  fixture.delay(new Promise<void>(resolve => { finish = resolve; }));
  const editor = fixture.render(); fixture.notifyMissing();
  fixture.window.dispatchEvent(new Event('online'));
  const first = editor.ensureLease(), second = editor.ensureLease();
  assert.equal(fixture.acquisitions, 1);
  finish(); await Promise.all([first, second]); assert.equal(fixture.acquisitions, 1);
  fixture.freshIdentity(); fixture.render(); await settle();
  assert.equal(fixture.releases, 0); assert.equal(fixture.acquisitions, 1);
  fixture.dispose();
});

test('exam switches never expose the previous exam token', async () => {
  const fixture = editorFixture(); fixture.render(); await settle();
  assert.equal(fixture.render().canEdit, true);
  fixture.switchExam('second-exam'); const switching = fixture.render();
  assert.equal(switching.token, undefined);
  await settle(); assert.equal(fixture.render().canEdit, true); fixture.dispose();
});

test('Strict Mode replay keeps a replacement lock and unmount releases a late acquisition', async () => {
  const fixture = editorFixture(); let finish!: () => void;
  fixture.delay(new Promise<void>(resolve => { finish = resolve; }));
  fixture.render(); fixture.replayEffects(); finish(); await settle();
  assert.equal(fixture.render().canEdit, true); assert.equal(fixture.hasRemote, true);
  assert.equal(fixture.releases, 1); fixture.dispose(); await settle(); assert.equal(fixture.hasRemote, false);

  const abandoned = editorFixture(); let complete!: () => void;
  abandoned.delay(new Promise<void>(resolve => { complete = resolve; }));
  abandoned.render(); abandoned.dispose(); complete(); await settle();
  assert.equal(abandoned.hasRemote, false);
});

test('a cached lock cannot announce an editor; a current server lock can', async () => {
  const fixture = editorFixture(); fixture.render(); await settle(); fixture.render();
  fixture.block(); fixture.notify(true);
  assert.equal(fixture.render().holder, null);
  fixture.notify(); const blocked = fixture.render();
  assert.equal(blocked.canOverride, true); assert.equal(blocked.isSameAccount, false);
});

test('an expired holder clears without waiting for another Firestore snapshot', async () => {
  const fixture = editorFixture(); fixture.block(); fixture.render(); await settle();
  assert.equal(fixture.render().canOverride, true);
  fixture.advance(EXAM_LEASE_DURATION_MS + EXAM_LEASE_CLOCK_SKEW_MS + 1); await settle();
  const ready = fixture.render(); assert.equal(ready.holder, null); assert.equal(ready.canEdit, true);
});

test('another active session on the same account is identified accurately and cannot silently overwrite', async () => {
  const fixture = editorFixture(); fixture.block(true); fixture.render(); await settle();
  const blocked = fixture.render(); assert.equal(blocked.isSameAccount, true); assert.equal(blocked.canSave, false);
  await assert.rejects(() => blocked.ensureLease(), /being edited/);
});

test('profile-name refresh does not rotate the editing token or announce the user as another editor', async () => {
  const fixture = editorFixture(); fixture.render(); await settle(); const before = fixture.render().token;
  fixture.rename(); fixture.render(); await settle(); const after = fixture.render();
  assert.deepEqual(after.token, before); assert.equal(fixture.acquisitions, 1); assert.equal(after.holder, null);
});

test('a previous token from this page never flashes a self-conflict banner', async () => {
  const fixture = editorFixture(); fixture.render(); await settle(); fixture.render();
  fixture.previousPageToken(); fixture.notify();
  assert.equal(fixture.render().holder, null); await settle(); assert.equal(fixture.render().canEdit, true);
});

test('hidden pages do not renew or reclaim expired locks; returning to the page reacquires', async () => {
  const fixture = editorFixture(); fixture.render(); await settle(); fixture.render();
  const count = fixture.acquisitions; fixture.document.visibilityState = 'hidden'; fixture.renew();
  fixture.advance(EXAM_LEASE_DURATION_MS + EXAM_LEASE_CLOCK_SKEW_MS + 1); await settle();
  assert.equal(fixture.render().canEdit, false); assert.equal(fixture.acquisitions, count);
  fixture.document.visibilityState = 'visible'; fixture.document.dispatchEvent(new Event('visibilitychange')); await settle();
  assert.equal(fixture.render().canEdit, true);
});

test('leaving the page releases the lock and page restoration reacquires it', async () => {
  const fixture = editorFixture(); fixture.render(); await settle(); fixture.render();
  fixture.window.dispatchEvent(new Event('pagehide')); await settle();
  assert.equal(fixture.hasRemote, false); assert.equal(fixture.render().holder, null);
  const count = fixture.acquisitions; fixture.renew(); await settle(); assert.equal(fixture.acquisitions, count);
  fixture.window.dispatchEvent(new Event('pageshow')); await settle(); assert.equal(fixture.render().canEdit, true);
});
