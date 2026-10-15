import type { QueryClient } from '@tanstack/react-query';

export type SetupTaskState = 'loading' | 'ready' | 'error';
export type SetupTask = { id: string; label: string; state: SetupTaskState };

// Recovery belongs to the existing data owners. Retrying setup must not reload
// the document, clear successful caches, or create another collection reader.
type Recovery = () => void | Promise<unknown>;
const recoveryOwners = new WeakMap<QueryClient, Map<string, Set<Recovery>>>();
export function registerWorkspaceRecovery(client: QueryClient, scope: string, id: string, recover: Recovery) {
  let owners = recoveryOwners.get(client);
  if (!owners) { owners = new Map(); recoveryOwners.set(client, owners); }
  const key = `${scope}/${id}`;
  const callbacks = owners.get(key) || new Set<Recovery>();
  callbacks.add(recover); owners.set(key, callbacks);
  return () => { callbacks.delete(recover); if (!callbacks.size) owners.delete(key); };
}

export async function retryWorkspaceTasks(client: QueryClient, scope: string, role: string) {
  const owners = recoveryOwners.get(client);
  const jobs: Promise<unknown>[] = [];
  for (const task of readWorkspaceSetup(client, scope, role).tasks) {
    if (task.state === 'ready' || task.id === 'page' || task.state === 'loading' && task.id !== 'settings') continue;
    const callbacks = owners?.get(`${scope}/${task.id}`) || owners?.get(`*/${task.id}`);
    const recover = callbacks ? Array.from(callbacks).at(-1) : undefined;
    if (recover) jobs.push(Promise.resolve().then(recover));
  }
  // Active destination queries already own their network requests. Refetch only
  // terminal errors; disabled/cache-only and healthy queries are left intact.
  jobs.push(client.refetchQueries({ predicate: query => query.isActive()
    && !optionalServices.has(String(query.queryKey[0]))
    && query.state.status === 'error' && query.state.data === undefined
    && query.state.fetchStatus === 'idle' }, { cancelRefetch: false }));
  await Promise.allSettled(jobs);
}

const commonTasks = [
  ['classes', 'Classes and streams'],
  ['academicYears', 'Academic years and terms'],
  ['staff', 'Staff records'],
  ['subjects', 'Subjects'],
  ['houses', 'School houses'],
  ['pupils', 'Pupil records'],
  ['fees', 'Fee structures'],
] as const;
const schoolTasks = [
  ['accessLevels', 'Workspace access'], ['exams', 'Exam definitions'],
  ['requirements', 'School requirements'], ['uniforms', 'Uniform catalogue'], ['excludedDays', 'Excluded school days'],
] as const;

export function workspaceSetupScope(userId: string, role: string) {
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return [project, userId, role].map(encodeURIComponent).join(':');
}

export function workspaceSetupMarker(scope: string) {
  return `trinity:workspace-setup:v1:${scope}`;
}

export function reportWorkspaceTask(client: QueryClient, scope: string, id: string, state: SetupTaskState) {
  if (!scope) return;
  if (client.getQueryDefaults(['workspaceSetup']).gcTime !== Infinity) {
    client.setQueryDefaults(['workspaceSetup'], { gcTime: Infinity });
  }
  const key = ['workspaceSetup', scope, id];
  if (client.getQueryData(key) !== state) client.setQueryData(key, state);
}

// Watch the destination's real data requests too, including queries that only
// become enabled after terms or pupil IDs arrive. Optional network services
// such as SMS balances and notification delivery do not gate local setup.
const optionalServices = new Set(['workspaceSetup', 'notifications', 'notification-count', 'schoolpay-inbox-badge', 'wiza-sms-balance']);

export function readWorkspaceSetup(client: QueryClient, scope: string, role: string) {
  const definitions = [...commonTasks.filter(([id]) => role !== 'Parent' || id !== 'staff'), ...(role === 'Parent'
    ? [['payments', 'Your children’s payment records']] as const : schoolTasks)];
  const tasks: SetupTask[] = definitions.map(([id, label]) => ({
    id, label, state: client.getQueryData<SetupTaskState>(['workspaceSetup', scope, id]) || 'loading',
  }));
  const settings = client.getQueryData(['schoolSettings', 'settings']);
  tasks.unshift({ id: 'settings', label: 'School profile and preferences', state: settings !== undefined ? 'ready'
    : client.getQueryData<SetupTaskState>(['workspaceSetup', '*', 'settings']) === 'error' ? 'error' : 'loading' });
  const pageQueries = client.getQueryCache().getAll().filter(query =>
    !optionalServices.has(String(query.queryKey[0])) && query.isActive());
  const failed = pageQueries.some(query => query.state.status === 'error' && query.state.data === undefined);
  const waiting = pageQueries.some(query => query.state.status === 'pending');
  tasks.push({ id: 'page', label: 'Preparing your opening page', state: failed ? 'error' : waiting ? 'loading' : 'ready' });
  const completed = tasks.filter(task => task.state === 'ready').length;
  return { tasks, completed, total: tasks.length, percent: Math.floor(completed / tasks.length * 100),
    ready: completed === tasks.length, failed: tasks.some(task => task.state === 'error') };
}
