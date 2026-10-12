'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { readWorkspaceSetup, retryWorkspaceTasks } from '@/lib/startup/workspace-setup';

/** Background record progress never makes the workspace inert. */
export function useWorkspacePreparation(scope: string, role: string) {
  const client = useQueryClient();
  const [epoch, setEpoch] = useState(0);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined, attempts = 0, running = false;
    const recover = async () => {
      if (disposed || running || !navigator.onLine) return;
      running = true;
      try { await retryWorkspaceTasks(client, scope, role); } finally { running = false; }
    };
    const update = () => {
      if (disposed) return;
      setEpoch(value => value + 1);
      if (readWorkspaceSetup(client, scope, role).failed && navigator.onLine && attempts < 3 && !retryTimer) {
        retryTimer = setTimeout(() => { retryTimer = undefined; attempts++; void recover(); }, 2000 * 2 ** attempts);
      }
    };
    const unsubscribe = client.getQueryCache().subscribe(() => {
      if (!timer) timer = setTimeout(() => { timer = undefined; update(); }, 100);
    });
    const connection = () => { setOnline(navigator.onLine); if (navigator.onLine) { attempts = 0; void recover(); } };
    connection(); update();
    window.addEventListener('online', connection); window.addEventListener('offline', connection);
    return () => { disposed = true; unsubscribe(); clearTimeout(timer); clearTimeout(retryTimer);
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection); };
  }, [client, role, scope]);
  void epoch;
  const tasks = readWorkspaceSetup(client, scope, role).tasks.filter(task => task.id !== 'page');
  return { tasks, completed: tasks.filter(task => task.state === 'ready').length, online,
    retry: () => retryWorkspaceTasks(client, scope, role) };
}
