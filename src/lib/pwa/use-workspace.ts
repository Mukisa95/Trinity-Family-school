'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { androidSessionMatchesUser, isAndroidOfflineSnapshot } from '@/lib/offline/android-contracts';
import { androidRouteBuildId } from '@/lib/offline/android-route-cache';
import { browserOfflineReadiness } from './readiness';
import { hasBrowserOfflineWorkspace } from './platform';

export function useHomeScreenWorkspace() {
  const { user, isLocked } = useAuth();
  const [value, setValue] = useState<Awaited<ReturnType<typeof browserOfflineReadiness>>>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!hasBrowserOfflineWorkspace() || !user || isLocked) { setValue(null); return; }
    let disposed = false;
    let request = 0;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      const current = ++request;
      try {
        const saved = await browserOfflineReadiness(androidRouteBuildId());
        if (disposed || current !== request) return;
        if (expiry) clearTimeout(expiry);
        setError('');
        const valid = saved && androidSessionMatchesUser(saved.session, user)
          && (!saved.snapshot || isAndroidOfflineSnapshot(saved.snapshot, saved.session));
        setValue(valid ? saved : null);
        if (valid) expiry = setTimeout(() => setValue(null), Math.max(0, Date.parse(saved.session.expiresAt) - Date.now()));
      } catch {
        if (!disposed && current === request) { setValue(null); setError('Saved storage is unavailable. Check your iPhone storage, then reopen the app online.'); }
      }
    };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    window.addEventListener('trinity-pwa-offline-changed', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; if (expiry) clearTimeout(expiry); window.removeEventListener('trinity-pwa-offline-changed', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [user, isLocked]);
  // Prevent one render of a previous account's records during account switches.
  return { workspace: !isLocked && user && value && androidSessionMatchesUser(value.session, user) ? value : null, error };
}
