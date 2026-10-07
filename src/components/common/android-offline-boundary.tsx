'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { androidOfflineRequest, hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { canOpenAndroidOfflineRoute, isAndroidOffline } from '@/lib/offline/android-app-shell';
import type { AndroidOfflineSession } from '@/lib/offline/android-contracts';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

function subscribe(listener: () => void) {
  window.addEventListener('online', listener); window.addEventListener('offline', listener);
  window.addEventListener('trinity-android-connectivity', listener);
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); window.removeEventListener('trinity-android-connectivity', listener); };
}

/** Only the unavailable section changes; the existing header/layout/pages stay intact. */
export function AndroidOfflineBoundary({ children }: { children: ReactNode }) {
  const offline = useSyncExternalStore(subscribe, isAndroidOffline, () => false);
  const { user } = useAuth();
  const path = usePathname() || '/';
  const [access, setAccess] = useState<{ accountId: string; session: AndroidOfflineSession | null } | null>(null);
  useEffect(() => {
    if (!hasAndroidOfflineBridge() || !user) return;
    let disposed = false;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    void androidOfflineRequest('status').then(reply => {
      if (disposed) return;
      const session = reply.session?.accountId === user.id && reply.session.role === user.role ? reply.session : null;
      setAccess({ accountId: user.id, session });
      if (session) expiry = setTimeout(() => setAccess({ accountId: user.id, session: null }), Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    }).catch(() => { if (!disposed) setAccess({ accountId: user.id, session: null }); });
    return () => { disposed = true; if (expiry) clearTimeout(expiry); };
  }, [offline, user?.id, user?.role]);

  useEffect(() => {
    if (!offline || !hasAndroidOfflineBridge()) return;
    const prevent = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('button, [role="menuitem"]');
      const label = button?.getAttribute('aria-label') || button?.textContent || '';
      // Existing editing controls keep their design; invocation is unavailable.
      if (event.type === 'submit' || (button && /\b(edit|save|delete|remove|collect|pay|add|create|register|upload|capture|promote|transfer|withdraw|assign|generate|publish|send)\b/i.test(label))) {
        event.preventDefault(); event.stopImmediatePropagation();
        toast({ title: 'Connection needed', description: 'Connect to make changes.' });
      }
    };
    document.addEventListener('click', prevent, true); document.addEventListener('submit', prevent, true);
    return () => { document.removeEventListener('click', prevent, true); document.removeEventListener('submit', prevent, true); };
  }, [offline]);

  if (!offline || !user || path === '/login') return <>{children}</>;
  if (!access || access.accountId !== user.id) return null;
  if (!access.session || Date.parse(access.session.expiresAt) <= Date.now() || !canOpenAndroidOfflineRoute(path, access.session)) {
    return <div className="py-8 text-center space-y-3">
      <p className="text-muted-foreground">{access.session ? 'This section is available when connected.' : 'Connect to renew your secure session.'}</p>
      {access.session && <Button variant="outline" asChild><a href={user.role === 'Parent' ? '/parent' : access.session.grants.dashboard ? '/' : access.session.grants.pupils ? '/pupils' : '/timetable'}>Back to your workspace</a></Button>}
    </div>;
  }
  return <>{children}</>;
}
