import type { QueryClient } from '@tanstack/react-query';

export type SetupTaskState = 'loading' | 'ready' | 'error';
export type SetupTask = { id: string; label: string; state: SetupTaskState };

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
  ['requirements', 'School requirements'], ['uniforms', 'Uniform catalogue'],
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
  tasks.unshift({ id: 'settings', label: 'School profile and preferences', state: settings !== undefined ? 'ready' : 'loading' });
  const pageQueries = client.getQueryCache().getAll().filter(query =>
    !optionalServices.has(String(query.queryKey[0])) && query.isActive());
  const failed = pageQueries.some(query => query.state.status === 'error' && query.state.data === undefined);
  const waiting = pageQueries.some(query => query.state.status === 'pending');
  tasks.push({ id: 'page', label: 'Preparing your opening page', state: failed ? 'error' : waiting ? 'loading' : 'ready' });
  const completed = tasks.filter(task => task.state === 'ready').length;
  return { tasks, completed, total: tasks.length, percent: Math.floor(completed / tasks.length * 100),
    ready: completed === tasks.length, failed: tasks.some(task => task.state === 'error') };
}
