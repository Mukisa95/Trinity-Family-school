import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { recoverFailedConnectionRead, retryConnectionRead } from '../src/lib/query/connection-recovery';
import { isAndroidSavedCacheKey } from '../src/lib/offline/android-sync-policy';
import type { AndroidOfflineSession } from '../src/lib/offline/android-contracts';

function loadModule(file: string, imports: Record<string, unknown> = {}, globals: Record<string, unknown> = {}) {
  const module = { exports: {} as any };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(output, {
    module, exports: module.exports, console, setTimeout, clearTimeout, DOMException,
    process: { env: {} }, ...globals,
    require(name: string) {
      if (!(name in imports)) throw new Error(`Unexpected import ${name} in ${file}`);
      return imports[name];
    },
  }, { filename: file });
  return module.exports;
}
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const unavailable = Object.assign(new Error('Connection unavailable'), { code: 'unavailable' });

test('failed reads with retained Infinity-fresh data recover on reconnect, successful reads stay cached', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let reads = 0;
  const key = ['fixture'];
  client.setQueryData(key, [{ id: 'old' }]);
  const observer = new QueryObserver(client, {
    queryKey: key, staleTime: Infinity, refetchOnMount: recoverFailedConnectionRead,
    refetchOnReconnect: recoverFailedConnectionRead,
    queryFn: async () => { if (++reads === 1) throw unavailable; return [{ id: 'new' }]; },
  });
  client.mount();
  const unsubscribe = observer.subscribe(() => {});
  try {
    await tick(); assert.equal(reads, 0);
    await observer.refetch();
    assert.equal(client.getQueryState(key)?.status, 'error');
    assert.deepEqual(client.getQueryData(key), [{ id: 'old' }]);
    onlineManager.setOnline(false); onlineManager.setOnline(true);
    await tick();
    assert.equal(reads, 2);
    assert.deepEqual(client.getQueryData(key), [{ id: 'new' }]);
    onlineManager.setOnline(false); onlineManager.setOnline(true);
    await tick(); assert.equal(reads, 2);
  } finally { unsubscribe(); client.unmount(); client.clear(); onlineManager.setOnline(true); }
});

test('recovery does not retry authorization failures and connection retries are bounded', () => {
  assert.equal(recoverFailedConnectionRead({ state: { status: 'error', error: { code: 'permission-denied' } } }), false);
  assert.equal(recoverFailedConnectionRead({ state: { status: 'success', error: null } }), false);
  assert.equal(retryConnectionRead(0, unavailable), true);
  assert.equal(retryConnectionRead(1, unavailable), false);
  assert.equal(retryConnectionRead(0, { code: 'unauthenticated' }), false);
});

test('attendance keeps a mismatched saved revision out of the new query and recovers its failed read', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const effects: (() => unknown)[] = [];
  const saved = { schema: 1, date: '2026-10-13', revision: 5, records: [{ pupilId: 'fixture-pupil' }] };
  let reads = 0, writes = 0;
  let options: any;
  const captureImports: Record<string, unknown> = {
    react: { useEffect: (effect: () => unknown) => effects.push(effect), useMemo: (fn: () => unknown) => fn() },
    '@tanstack/react-query': { useQuery: (value: unknown) => { options = value; return { isPending: true, refetch: () => {} }; }, useQueryClient: () => client },
    '@/lib/services/attendance-summary.service': { getDailyAttendanceSummary: async () => { if (++reads === 1) throw unavailable; return { ...saved, revision: 6 }; }, buildDashboardAttendanceData: () => ({}), toAttendanceSummaryEntry: (record: unknown) => record },
    '@/lib/services/attendance.service': { AttendanceService: {} },
    '@/lib/cache/attendance-summary-cache': { getAttendanceCacheScope: () => 'fixture-scope', readAttendanceSummaryCache: () => saved, writeAttendanceSummaryCache: () => { writes++; } },
    './use-school-settings': { useDashboardDataRevisions: () => ({ data: { attendance: 6 } }) },
    '@/lib/services/attendance-summary-outbox': { flushDueAttendanceSummaryOutbox: async () => {} },
    '@/lib/contexts/auth-context': { useAuth: () => ({ user: { id: 'fixture-user', role: 'Admin' }, isAuthenticated: true }) },
    '@/lib/query/connection-recovery': { recoverFailedConnectionRead, retryConnectionRead: () => false },
  };
  const hook = loadModule('src/lib/hooks/use-attendance-summary.ts', captureImports, { window: new EventTarget() });
  hook.useAttendanceSummary(saved.date);
  const observer = new QueryObserver(client, options);
  client.mount(); const unsubscribe = observer.subscribe(() => {});
  const cleanups = effects.map(effect => effect());
  try {
    await tick();
    assert.equal(client.getQueryData(options.queryKey), undefined);
    assert.equal(client.getQueryState(options.queryKey)?.status, 'error');
    assert.equal(writes, 0);
    onlineManager.setOnline(false); onlineManager.setOnline(true); await tick();
    assert.equal(reads, 2); assert.equal(writes, 1);
    assert.equal((client.getQueryData(options.queryKey) as any).revision, 6);
  } finally { cleanups.forEach(cleanup => { if (typeof cleanup === 'function') cleanup(); }); unsubscribe(); client.unmount(); client.clear(); onlineManager.setOnline(true); }
});

function schedulerFixture() {
  let now = 0, allowed = true, calls = 0, fail = false, errors = 0;
  let pendingRun: Promise<void> | undefined;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const { createAndroidSnapshotScheduler } = loadModule('src/lib/offline/android-snapshot-scheduler.ts', {}, {
    Date: { now: () => now },
    setTimeout: (fn: () => void, delay: number) => { timers.set(++id, { at: now + delay, fn }); return id; },
    clearTimeout: (timer: number) => timers.delete(timer),
  });
  const scheduler = createAndroidSnapshotScheduler(async () => {
    calls++; if (pendingRun) await pendingRun; if (fail) throw new Error('Native save failed');
  }, () => allowed, () => { errors++; });
  return {
    scheduler, timers, get calls() { return calls; }, get errors() { return errors; },
    allow(value: boolean) { allowed = value; }, fail(value: boolean) { fail = value; },
    waitFor(value: Promise<void>) { pendingRun = value; },
    async advance(value: number) {
      now += value;
      for (const [timerId, timer] of [...timers]) if (timer.at <= now) { timers.delete(timerId); timer.fn(); }
      await settle();
    },
  };
}

test('busy cache streams do not postpone snapshots forever or overlap exports', async () => {
  const fixture = schedulerFixture();
  fixture.scheduler.request(); await fixture.advance(1000); fixture.scheduler.request();
  await fixture.advance(500); assert.equal(fixture.calls, 1);
  let finish!: () => void;
  fixture.waitFor(new Promise<void>(resolve => { finish = resolve; }));
  fixture.scheduler.request(); await fixture.advance(15_000); assert.equal(fixture.calls, 2);
  fixture.scheduler.request(); await fixture.advance(30_000); assert.equal(fixture.calls, 2);
  finish(); await settle(); await fixture.advance(1500); assert.equal(fixture.calls, 3);
  fixture.scheduler.dispose();
});

test('snapshot failures retry without another cache event, then stop after disposal', async () => {
  const fixture = schedulerFixture(); fixture.fail(true); fixture.scheduler.request();
  await fixture.advance(1500); assert.equal(fixture.errors, 1);
  fixture.fail(false); await fixture.advance(15_000); assert.equal(fixture.calls, 2);
  fixture.scheduler.request(); fixture.scheduler.dispose(); await fixture.advance(60_000);
  assert.equal(fixture.calls, 2); assert.equal(fixture.timers.size, 0);
});

test('hidden/navigation-paused snapshots wait for resume without losing dirty work', async () => {
  const fixture = schedulerFixture(); fixture.allow(false); fixture.scheduler.request();
  assert.equal(fixture.timers.size, 0);
  fixture.allow(true); fixture.scheduler.resume(); fixture.allow(false);
  await fixture.advance(1500); assert.equal(fixture.calls, 0);
  fixture.allow(true); fixture.scheduler.resume(); await fixture.advance(1500);
  assert.equal(fixture.calls, 1); fixture.scheduler.dispose();
});

test('native saved-data triggers ignore unrelated modules and other accounts', () => {
  const session = { accountId: 'fixture-account', role: 'Admin', grants: { pupils: true, dashboard: true, timetable: true } } as AndroidOfflineSession;
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  const scope = [project, session.accountId, session.role].map(encodeURIComponent).join(':');
  assert.equal(isAndroidSavedCacheKey(`${project}::pupils::user:fixture-account`, session), true);
  assert.equal(isAndroidSavedCacheKey(`classes:${scope}`, session), true);
  assert.equal(isAndroidSavedCacheKey(`${project}::pupils::user:other-account`, session), false);
  assert.equal(isAndroidSavedCacheKey(`attendance-summary:${scope}:2026-10-13`, session), false);
  assert.equal(isAndroidSavedCacheKey(`${project}::android-photo-thumbnails-v1::user:fixture-account`, session), false);
  assert.equal(isAndroidSavedCacheKey(undefined, session), false);
});

test('96px thumbnails bypass delayed toBlob callbacks, reuse photos, and stay account scoped', async () => {
  let encodes = 0, decodes = 0, closes = 0;
  const photo = 'data:image/jpeg;base64,' + 'A'.repeat(12_000);
  const thumbnail = 'data:image/jpeg;base64,fixture';
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob: () => { throw new Error('Deferred canvas callback must not run'); },
    toDataURL: (type: string, quality: number) => {
      encodes++; assert.equal(type, 'image/jpeg'); assert.equal(canvas.width, 96); assert.equal(canvas.height, 96);
      return quality === 0.65 ? 'data:image/jpeg;base64,' + 'A'.repeat(9000) : thumbnail;
    },
  };
  const subject = loadModule('src/lib/offline/android-photo-projection.ts', {
    '@/lib/cache/persistent-collection-cache': { persistentCollectionCacheKey: (...values: string[]) => values.join(':'), readPersistentCollection: async () => [], writePersistentCollection: async () => {} },
    '@/lib/startup/workspace-timing': { measureWorkspaceOperation: (_: string, fn: () => unknown) => fn() },
    './android-preparation-work': { yieldAndroidPreparation: async (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); } },
  }, {
    crypto: webcrypto, TextEncoder, document: { createElement: () => canvas },
    fetch: async () => ({ blob: async () => new Blob(['fixture']) }),
    createImageBitmap: async () => { decodes++; return { width: 500, height: 400, close: () => { closes++; } }; },
  });
  assert.equal(await subject.offlinePupilPhoto('account-a', photo), thumbnail);
  assert.equal(await subject.offlinePupilPhoto('account-a', photo), thumbnail);
  assert.equal(encodes, 2); assert.equal(decodes, 1); assert.equal(closes, 1);
  assert.equal(await subject.offlinePupilPhoto('account-b', photo), thumbnail);
  assert.equal(encodes, 4); assert.equal(decodes, 2);
  const original = [{ id: 'pupil', photo }];
  const projected = await subject.projectOfflinePhotos('account-b', original);
  assert.equal(original[0].photo, photo); assert.equal(projected[0].photo, thumbnail);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(subject.offlinePupilPhoto('account-b', photo, aborted.signal), { name: 'AbortError' });
});

test('native connectivity updates React Query even when navigator stays online', () => {
  const target = new EventTarget(); let nativeOffline = true;
  const states: boolean[] = [];
  const subject = loadModule('src/lib/query/native-connectivity.ts', {
    '@tanstack/react-query': { onlineManager: { setOnline: (value: boolean) => states.push(value) } },
    '@/lib/offline/android-app-shell': { isAndroidOffline: () => nativeOffline },
  }, { window: target, navigator: { onLine: true } });
  const cleanup = subject.subscribeQueryConnectivity();
  nativeOffline = false; target.dispatchEvent(new Event('trinity-android-connectivity'));
  assert.deepEqual(states, [false, true]); cleanup();
  target.dispatchEvent(new Event('trinity-android-connectivity')); assert.equal(states.length, 2);
});
