'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { workspaceOfflineRequest as androidOfflineRequest, hasOfflineWorkspace as hasAndroidOfflineBridge } from '@/lib/offline/workspace-bridge';
import { canOpenAndroidOfflineRoute, isAndroidOffline } from '@/lib/offline/android-app-shell';
import type { AndroidOfflineSession } from '@/lib/offline/android-contracts';
import { androidSessionMatchesUser } from '@/lib/offline/android-contracts';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { recordAppDiagnostic } from '@/lib/utils/app-diagnostics';
import { BrandedAuthScreen } from '@/components/common/premium-splash-loader';

function subscribe(listener: () => void) {
  window.addEventListener('online', listener); window.addEventListener('offline', listener);
  window.addEventListener('trinity-android-connectivity', listener);
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); window.removeEventListener('trinity-android-connectivity', listener); };
}

/** Only the unavailable section changes; the existing header/layout/pages stay intact. */
export function AndroidOfflineBoundary({ children }: { children: ReactNode }) {
  const offline = useSyncExternalStore(subscribe, isAndroidOffline, () => false);
  const { user, isSavedWorkspaceView } = useAuth();
  const path = usePathname() || '/';
  const [access, setAccess] = useState<{ accountId: string; session: AndroidOfflineSession | null } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const update = () => setRevision(value => value + 1);
    window.addEventListener('trinity-android-session-updated', update);
    window.addEventListener('trinity-pwa-offline-changed', update);
    return () => { window.removeEventListener('trinity-android-session-updated', update); window.removeEventListener('trinity-pwa-offline-changed', update); };
  }, []);
  useEffect(() => {
    if (!hasAndroidOfflineBridge() || !user) return;
    let disposed = false;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    void androidOfflineRequest('status', {}, 8000).then(reply => {
      if (disposed) return;
      const session = androidSessionMatchesUser(reply.session, user) ? reply.session! : null;
      setAccess({ accountId: user.id, session });
      if (session) expiry = setTimeout(() => setAccess({ accountId: user.id, session: null }), Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    }).catch(() => { recordAppDiagnostic('offline_status_failed'); if (!disposed) setAccess({ accountId: user.id, session: null }); });
    return () => { disposed = true; if (expiry) clearTimeout(expiry); };
  }, [offline, user?.id, user?.role, user?.circumference, revision]);

  useEffect(() => {
    if ((!offline || !hasAndroidOfflineBridge()) && !isSavedWorkspaceView) return;
    const prevent = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      // These controls edit device preferences through the account-checked
      // native bridge; they do not submit school record changes to the server.
      if (target?.closest('[data-native-settings]')) return;
      const button = target?.closest('button, [role="menuitem"]');
      const label = button?.getAttribute('aria-label') || button?.textContent || '';
      // Existing editing controls keep their design; invocation is unavailable.
      if (event.type === 'submit' || (button && /\b(edit|update|save|delete|remove|collect|pay|add|create|register|upload|capture|promote|transfer|withdraw|assign|generate|publish|send)\b/i.test(label))) {
        event.preventDefault(); event.stopImmediatePropagation();
        toast({ title: isSavedWorkspaceView ? 'Verification pending' : 'Connection needed', description: isSavedWorkspaceView ? 'Saved data is available. Changes will be available after your secure session is verified.' : 'Connect to make changes.' });
      }
    };
    document.addEventListener('click', prevent, true); document.addEventListener('submit', prevent, true);
    return () => { document.removeEventListener('click', prevent, true); document.removeEventListener('submit', prevent, true); };
  }, [offline, isSavedWorkspaceView]);

  useEffect(() => {
    if (!offline || !user || !access || access.accountId !== user.id) return;
    recordAppDiagnostic(!access.session ? 'offline_access_missing'
      : Date.parse(access.session.expiresAt) <= Date.now() ? 'offline_access_expired'
      : !canOpenAndroidOfflineRoute(path, access.session) ? 'offline_section_requires_connection' : 'offline_section_authorized');
  }, [offline, access, path, user?.id]);

  if (!offline || !user || path === '/login') return <>{children}</>;
  if (!access || access.accountId !== user.id) return <div data-startup-access-pending="true">
    <BrandedAuthScreen message="Opening your school workspace…" />
  </div>;
  if (!access.session || Date.parse(access.session.expiresAt) <= Date.now() || !canOpenAndroidOfflineRoute(path, access.session)) {
    return <div className="py-8 text-center space-y-3">
      <p className="text-muted-foreground">{access.session ? 'This section is available when connected.' : 'Connect to renew your secure session.'}</p>
      {access.session && <Button variant="outline" asChild><a href={user.role === 'Parent' ? '/parent' : access.session.grants.dashboard ? '/' : access.session.grants.pupils ? '/pupils' : '/timetable'}>Back to your workspace</a></Button>}
    </div>;
  }
  return <>{children}</>;
}
