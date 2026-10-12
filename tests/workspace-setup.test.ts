import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { readWorkspaceSetup, registerWorkspaceRecovery, retryWorkspaceTasks, reportWorkspaceTask, workspaceSetupMarker, workspaceSetupScope } from '../src/lib/startup/workspace-setup';

function readyClient(role = 'Admin') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const scope = workspaceSetupScope('example', role);
  client.setQueryData(['schoolSettings', 'settings'], {});
  readWorkspaceSetup(client, scope, role).tasks.filter(task => !['settings', 'page'].includes(task.id))
    .forEach(task => reportWorkspaceTask(client, scope, task.id, 'ready'));
  return { client, scope };
}

test('background progress requires every initial task, including valid empty catalogues', () => {
  const { client, scope } = readyClient();
  reportWorkspaceTask(client, scope, 'uniforms', 'loading');
  assert.equal(readWorkspaceSetup(client, scope, 'Admin').ready, false);
  assert.ok(readWorkspaceSetup(client, scope, 'Admin').percent < 100);
  client.setQueryData(['uniforms'], []);
  reportWorkspaceTask(client, scope, 'uniforms', 'ready');
  assert.equal(readWorkspaceSetup(client, scope, 'Admin').percent, 100);
  client.clear();
});

test('parents wait for scoped payments without waiting for staff-only module tasks', () => {
  const { client, scope } = readyClient('Parent');
  const ids = readWorkspaceSetup(client, scope, 'Parent').tasks.map(task => task.id);
  assert.ok(ids.includes('payments'));
  for (const id of ['staff', 'exams', 'accessLevels', 'requirements', 'uniforms']) assert.ok(!ids.includes(id));
  reportWorkspaceTask(client, scope, 'payments', 'loading');
  assert.equal(readWorkspaceSetup(client, scope, 'Parent').ready, false);
  client.clear();
});

test('scope and completion markers cannot be reused by another account, role or version', () => {
  const { client, scope } = readyClient();
  const other = workspaceSetupScope('other', 'Admin');
  assert.notEqual(workspaceSetupMarker(scope), workspaceSetupMarker(other));
  assert.notEqual(workspaceSetupMarker(scope), workspaceSetupMarker(workspaceSetupScope('example', 'Parent')));
  assert.equal(readWorkspaceSetup(client, other, 'Admin').ready, false);
  client.clear();
});

test('pending page requests and errors remain visible in preparation progress', async () => {
  const { client, scope } = readyClient();
  let resolve!: (value: never[]) => void;
  const observer = new QueryObserver(client, { queryKey: ['timetable', 'entries', 'term'], queryFn: () => new Promise<never[]>(done => { resolve = done; }) });
  const unsubscribe = observer.subscribe(() => {});
  assert.equal(readWorkspaceSetup(client, scope, 'Admin').ready, false);
  resolve([]);
  await new Promise(done => setTimeout(done, 0));
  assert.equal(readWorkspaceSetup(client, scope, 'Admin').ready, true);
  unsubscribe();
  const failed = new QueryObserver(client, { queryKey: ['photos'], queryFn: async () => { throw new Error('Unavailable'); } });
  const unfailed = failed.subscribe(() => {});
  await new Promise(done => setTimeout(done, 0));
  assert.equal(readWorkspaceSetup(client, scope, 'Admin').failed, true);
  assert.equal(readWorkspaceSetup(client, scope, 'Admin').ready, false);
  unfailed(); client.clear();
});

test('disabled queries and optional delivery services do not leave a permanent loader', () => {
  const { client, scope } = readyClient();
  const disabled = new QueryObserver(client, { queryKey: ['timetable', 'not-selected'], enabled: false, queryFn: async () => [] });
  const unsubscribe = disabled.subscribe(() => {});
  const optional = new QueryObserver(client, { queryKey: ['notifications'], queryFn: () => new Promise(() => {}) });
  const unoptional = optional.subscribe(() => {});
  assert.equal(readWorkspaceSetup(client, scope, 'Admin').ready, true);
  unsubscribe(); unoptional(); client.clear();
});

test('reference owners report real success and errors without a second data reader', () => {
  for (const name of ['class', 'academic-year', 'staff', 'subject', 'house', 'access-level', 'exam']) {
    const source = readFileSync(`src/lib/hooks/use-${name}-cache-bootstrap.ts`, 'utf8');
    assert.match(source, /server-synced'\);\s+reportWorkspaceTask\(queryClient, scope, '[^']+', 'ready'\)/);
    assert.match(source, /if \(!disposed\) reportWorkspaceTask\(queryClient, scope, '[^']+', 'error'\)/);
  }
  const preloader = readFileSync('src/components/providers/global-data-preloader.tsx', 'utf8');
  assert.match(preloader, /scopeStatus\('ready'\);\s+report\('pupils', 'ready'\);\s+schedulePersistentPupilCacheWrite/);
  assert.doesNotMatch(preloader, /writePersistentCollection\(persistentCacheKey, pupils\)\.then/);
  assert.match(preloader, /ensureSchoolCatalogue\(queryClient, 'requirements', user!, \(\) => !disposed\)/);
  assert.match(preloader, /!snapshot.metadata.fromCache \|\| payments.length > 0/);
});


test('retry invokes only the failed owner for this account and preserves healthy downloads', async () => {
  const { client, scope } = readyClient();
  const calls: string[] = [];
  const stops = [
    registerWorkspaceRecovery(client, scope, 'pupils', () => { calls.push('pupils'); reportWorkspaceTask(client, scope, 'pupils', 'ready'); }),
    registerWorkspaceRecovery(client, scope, 'fees', () => { calls.push('fees'); }),
    registerWorkspaceRecovery(client, scope, 'uniforms', () => { calls.push('uniforms'); }),
    registerWorkspaceRecovery(client, workspaceSetupScope('other', 'Admin'), 'pupils', () => { calls.push('other'); }),
  ];
  client.setQueryData(['fees', 'structures'], [{ id: 'saved' }]);
  reportWorkspaceTask(client, scope, 'pupils', 'error');
  reportWorkspaceTask(client, scope, 'uniforms', 'loading');
  await retryWorkspaceTasks(client, scope, 'Admin');
  assert.deepEqual(calls, ['pupils']);
  assert.deepEqual(client.getQueryData(['fees', 'structures']), [{ id: 'saved' }]);
  stops.forEach(stop => stop());
  reportWorkspaceTask(client, scope, 'pupils', 'error');
  await retryWorkspaceTasks(client, scope, 'Admin');
  assert.deepEqual(calls, ['pupils'], 'Unmounted owners cannot run');
  client.clear();
});

test('shared settings recovery runs once and failed active page queries recover without cache-only reads', async () => {
  const { client, scope } = readyClient();
  client.removeQueries({ queryKey: ['schoolSettings'] });
  let settingsCalls = 0;
  const stop = registerWorkspaceRecovery(client, '*', 'settings', () => { settingsCalls++; client.setQueryData(['schoolSettings', 'settings'], {}); });
  const stopLatest = registerWorkspaceRecovery(client, '*', 'settings', () => { settingsCalls++; client.setQueryData(['schoolSettings', 'settings'], {}); });
  let pageCalls = 0, disabledCalls = 0;
  const page = new QueryObserver(client, { queryKey: ['photos'], queryFn: async () => { if (++pageCalls === 1) throw new Error('Transient'); return []; } });
  const disabled = new QueryObserver(client, { queryKey: ['classes', 'cache-only'], enabled: false, queryFn: async () => { disabledCalls++; return []; } });
  const unpage = page.subscribe(() => {}), undisabled = disabled.subscribe(() => {});
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(readWorkspaceSetup(client, scope, 'Admin').failed, true);
  await retryWorkspaceTasks(client, scope, 'Admin');
  assert.equal(settingsCalls, 1);
  assert.equal(pageCalls, 2);
  assert.equal(disabledCalls, 0);
  assert.equal(readWorkspaceSetup(client, scope, 'Admin').ready, true);
  stop(); stopLatest(); unpage(); undisabled(); client.clear();
});
