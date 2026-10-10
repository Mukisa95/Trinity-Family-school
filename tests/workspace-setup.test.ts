import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { readWorkspaceSetup, reportWorkspaceTask, workspaceSetupMarker, workspaceSetupScope } from '../src/lib/startup/workspace-setup';

function readyClient(role = 'Admin') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const scope = workspaceSetupScope('example', role);
  client.setQueryData(['schoolSettings', 'settings'], {});
  readWorkspaceSetup(client, scope, role).tasks.filter(task => !['settings', 'page'].includes(task.id))
    .forEach(task => reportWorkspaceTask(client, scope, task.id, 'ready'));
  return { client, scope };
}

test('progress requires every initial task, including valid empty catalogues', () => {
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

test('dependent opening-page requests keep setup open and errors do not claim completion', async () => {
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
  assert.match(preloader, /writePersistentCollection\(persistentCacheKey, pupils\)\.then\(\(\) => \{\s+if \(!pupilLoadFailed\) report\('pupils', 'ready'\)/);
  assert.match(preloader, /queryClient\.setQueryData\(\['requirements'\], requirements\);\s+report\('requirements', 'ready'\)/);
  assert.match(preloader, /!snapshot.metadata.fromCache \|\| payments.length > 0/);
});
