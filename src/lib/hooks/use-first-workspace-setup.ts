'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { readWorkspaceSetup, retryWorkspaceTasks, workspaceSetupMarker, workspaceSetupScope } from '@/lib/startup/workspace-setup';

export function useFirstWorkspaceSetup({ enabled, userId, role, accessReady = false, awaitPersonalization = false }: { enabled: boolean; userId?: string; role?: string; accessReady?: boolean; awaitPersonalization?: boolean }) {
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
  const [personalizedScope, setPersonalizedScope] = useState('');
  const personalized = !awaitPersonalization || personalizedScope === scope;
  const recoveringScope = useRef('');
  const [recovering, setRecovering] = useState('');
  const retry = useCallback(async () => {
    if (!enabled || !scope || !role || !navigator.onLine || recoveringScope.current === scope) return;
    recoveringScope.current = scope;
    setRecovering(scope);
    try { await retryWorkspaceTasks(client, scope, role); }
    finally {
      if (recoveringScope.current === scope) recoveringScope.current = '';
      setRecovering(previous => previous === scope ? '' : previous);
    }
  }, [client, enabled, role, scope]);

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
    const connection = () => { setOnline(navigator.onLine); if (navigator.onLine) void retry(); };
    setOnline(navigator.onLine);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
    let recoveryAttempts = 0;
    // Coalesce cache events; rendering this screen must not become another
    // subscriber that repeatedly redraws during large collection hydration.
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (finished) return;
      const next = readWorkspaceSetup(client, scope, role);
      const scopedProgress = { scope, ...next };
      setProgress(previous => JSON.stringify(previous) === JSON.stringify(scopedProgress) ? previous : scopedProgress);
      if (next.failed && navigator.onLine && recoveryAttempts < 3 && !recoveryTimer) {
        recoveryTimer = setTimeout(() => {
          recoveryTimer = undefined;
          if (navigator.onLine && readWorkspaceSetup(client, scope, role).failed) {
            recoveryAttempts += 1;
            void retry().then(update);
          }
        }, 2000 * 2 ** recoveryAttempts);
      }
      if (!accessReady || !personalized) {
        if (completionTimer) clearTimeout(completionTimer);
        completionTimer = undefined;
        return;
      }
      if (completionTimer) return;
      // Welcome completion records access and preferences, never download
      // completion. Pages and offline preparation remain independent owners.
      completionTimer = setTimeout(() => {
        completionTimer = undefined;
        finished = true;
        try { localStorage.setItem(workspaceSetupMarker(scope), 'complete'); } catch { /* Never block a ready workspace on storage. */ }
        setSession({ scope, phase: 'fading' });
        fadeTimer = setTimeout(() => setSession({ scope, phase: 'complete' }), 300);
      }, 0);
    };
    update();
    const unsubscribe = client.getQueryCache().subscribe(() => {
      if (!updateTimer) updateTimer = setTimeout(() => { updateTimer = undefined; update(); }, 80);
    });
    const slowTimer = setTimeout(() => setSlow(true), 25000);
    return () => {
      finished = true;
      unsubscribe();
      clearTimeout(updateTimer); clearTimeout(completionTimer); clearTimeout(fadeTimer); clearTimeout(slowTimer); clearTimeout(recoveryTimer);
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection);
    };
  }, [accessReady, client, enabled, personalized, retry, role, scope]);

  return { ...(progress.scope === scope ? progress : readWorkspaceSetup(client, scope, role || 'Parent')), online, slow,
    required: enabled && Boolean(scope) && !completedBefore && (session.scope !== scope || session.phase !== 'complete'),
    fading: session.scope === scope && session.phase === 'fading',
    scope, canEnter: accessReady,
    finishPersonalization: () => setPersonalizedScope(scope),
    recovering: recovering === scope, retry,
  };
}
