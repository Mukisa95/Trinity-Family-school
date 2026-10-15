import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

/** Render the real hook with deterministic effects and a transactional lock fixture. */
function editorFixture(online = true) {
  const window = Object.assign(new EventTarget(), {
    setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
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
    isExpired: (lease: any) => new Date(lease.expiresAt).getTime() <= Date.now(),
    acquire: async (requestedExam: string, user: { id: string; name: string }, leaseId: string) => {
      acquisitions++; if (gate) await gate;
      if (remote && remote.examId === requestedExam && remote.leaseId !== leaseId) return { acquired: false, holder: remote };
      remote = { examId: requestedExam, lockedByUid: user.id, lockedByName: user.name, leaseId, expiresAt: new Date(Date.now() + 600_000).toISOString() };
      return { acquired: true, lease: remote };
    },
    release: async (_: string, token: any) => { releases++; if (remote?.leaseId === token.leaseId) remote = null; },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/hooks/use-exam-result-lease.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, exports: module.exports, window, document, navigator, crypto: webcrypto, console,
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
      if (name === 'firebase/firestore') return { onSnapshot: (_: unknown, listener: (snapshot: unknown) => void) => { observe = listener; return () => { if (observe === listener) observe = undefined; }; } };
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
    render, window, navigator, get acquisitions() { return acquisitions; }, get releases() { return releases; },
    loseLock() { remote = null; },
    block() { remote = { examId, lockedByUid: 'other-user', lockedByName: 'Another editor', leaseId: 'other-lease' }; },
    delay(value: Promise<void>) { gate = value; },
    freshIdentity() { identity = { ...identity }; },
    switchExam(value: string) { examId = value; },
    replayEffects() { effects.forEach(effect => effect?.cleanup?.()); effects.forEach(effect => { if (effect) effect.cleanup = effect.fn(); }); },
    get hasRemote() { return remote !== null; },
    notifyMissing() { observe?.({ exists: () => false }); },
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
