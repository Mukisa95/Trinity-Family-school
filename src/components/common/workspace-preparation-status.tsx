'use client';

import { useWorkspacePreparation } from '@/lib/hooks/use-workspace-preparation';

export function WorkspacePreparationStatus({ scope, role }: { scope: string; role: string }) {
  const { tasks, completed, online, retry } = useWorkspacePreparation(scope, role);
  if (!tasks.length || completed === tasks.length) return null;
  const failed = tasks.some(task => task.state === 'error');
  return <details className="my-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground print:hidden">
    <summary className="cursor-pointer">Background downloads: {completed} of {tasks.length} ready</summary>
    <p role="status" className="mt-2">{!online ? 'Downloads resume when you reconnect.' : failed ? 'Some records are awaiting a retry. You can keep using the workspace.' : 'You can keep using the workspace while records download.'}</p>
    <p className="mt-2">Offline access uses the records already saved on this device.</p>
    <ul className="mt-2 space-y-1">{tasks.filter(task => task.state !== 'ready').map(task => <li key={task.id}>{task.label}: {task.state === 'error' ? 'awaiting retry' : 'loading'}</li>)}</ul>
    {failed && online && <button type="button" className="mt-2 min-h-10 underline" onClick={() => void retry()}>Retry unfinished downloads</button>}
  </details>;
}
