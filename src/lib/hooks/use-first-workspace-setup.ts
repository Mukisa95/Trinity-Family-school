'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { readWorkspaceSetup, workspaceSetupMarker, workspaceSetupScope } from '@/lib/startup/workspace-setup';

export function useFirstWorkspaceSetup({ enabled, userId, role }: { enabled: boolean; userId?: string; role?: string }) {
  const client = useQueryClient();
  const scope = userId && role ? workspaceSetupScope(userId, role) : '';
  const completedBefore = useMemo(() => {
    if (!enabled || !scope) return false;
    try { return localStorage.getItem(workspaceSetupMarker(scope)) === 'complete'; } catch { return false; }
  }, [enabled, scope]);
  const [session, setSession] = useState({ scope: '', phase: 'checking' as 'checking' | 'loading' | 'fading' | 'complete' });
  const [progress, setProgress] = useState(() => ({ scope: '', ...readWorkspaceSetup(client, '', 'Parent') }));
  const [online, setOnline] = useState(true);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!enabled || !scope || !role) {
      setSession({ scope: '', phase: 'checking' });
      return;
    }
    let saved = false;
    try { saved = localStorage.getItem(workspaceSetupMarker(scope)) === 'complete'; } catch { /* Storage may be unavailable. */ }
    setSession({ scope, phase: saved ? 'complete' : 'loading' });
    if (saved) return;
    setSlow(false);
    const connection = () => setOnline(navigator.onLine);
    connection();
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    // Coalesce cache events; rendering this screen must not become another
    // subscriber that repeatedly redraws during large collection hydration.
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (finished) return;
      const next = readWorkspaceSetup(client, scope, role);
      const scopedProgress = { scope, ...next };
      setProgress(previous => JSON.stringify(previous) === JSON.stringify(scopedProgress) ? previous : scopedProgress);
      if (!next.ready) {
        if (completionTimer) clearTimeout(completionTimer);
        completionTimer = undefined;
        return;
      }
      if (completionTimer) return;
      // Allow dependent page queries to mount before declaring setup complete.
      completionTimer = setTimeout(() => {
        completionTimer = undefined;
        if (!readWorkspaceSetup(client, scope, role).ready) return;
        finished = true;
        try { localStorage.setItem(workspaceSetupMarker(scope), 'complete'); } catch { /* Never block a ready workspace on storage. */ }
        setSession({ scope, phase: 'fading' });
        fadeTimer = setTimeout(() => setSession({ scope, phase: 'complete' }), 300);
      }, 750);
    };
    update();
    const unsubscribe = client.getQueryCache().subscribe(() => {
      if (!updateTimer) updateTimer = setTimeout(() => { updateTimer = undefined; update(); }, 80);
    });
    const slowTimer = setTimeout(() => setSlow(true), 25000);
    return () => {
      unsubscribe();
      clearTimeout(updateTimer); clearTimeout(completionTimer); clearTimeout(fadeTimer); clearTimeout(slowTimer);
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection);
    };
  }, [client, enabled, role, scope]);

  return { ...(progress.scope === scope ? progress : readWorkspaceSetup(client, scope, role || 'Parent')), online, slow,
    required: enabled && Boolean(scope) && !completedBefore && (session.scope !== scope || session.phase !== 'complete'),
    fading: session.scope === scope && session.phase === 'fading',
    retry: () => window.location.reload(),
  };
}
