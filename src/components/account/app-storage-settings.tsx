'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useAppPlatform } from '@/lib/hooks/use-app-platform';
import { useAndroidOfflineStatus } from '@/lib/hooks/use-android-offline-status';
import { androidOfflineRequest } from '@/lib/offline/android-bridge';
import { androidSessionMatchesUser, type AndroidOfflineSession } from '@/lib/offline/android-contracts';
import { HomeScreenSettings } from '@/components/pwa/home-screen-settings';
import { SettingsRow, SettingsRows, settingsButtonClass } from '@/components/settings/settings-controls';

const storageSize = (bytes: number) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;

/** Storage controls stay in settings; they never clear an active session or reload it. */
export function AppStorageSettings() {
  const { user, isLocked } = useAuth();
  const platform = useAppPlatform();
  const offline = useAndroidOfflineStatus();
  const [usage, setUsage] = useState('Checking…');
  const [session, setSession] = useState<AndroidOfflineSession | null>(null);
  const [checking, setChecking] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!platform || !user || isLocked) return;
    let disposed = false;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      setChecking(true);
      setError('');
      const results = await Promise.allSettled([
        Promise.resolve().then(() => navigator.storage?.estimate?.()),
        platform.nativeAndroid ? androidOfflineRequest('status') : Promise.resolve(null),
      ]);
      if (disposed || request !== current) return;
      const estimate = results[0];
      setUsage(estimate.status === 'fulfilled' && typeof estimate.value?.usage === 'number'
        ? storageSize(estimate.value.usage) : 'Managed by this device');
      const native = results[1];
      if (native.status === 'fulfilled') setSession(native.value?.session && androidSessionMatchesUser(native.value.session, user) ? native.value.session : null);
      else { setSession(null); setError('Could not check saved access. Try again.'); }
      setChecking(false);
    };
    void refresh();
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('trinity-android-session-updated', refresh);
    window.addEventListener('trinity-pwa-offline-changed', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; window.removeEventListener('trinity-android-session-updated', refresh); window.removeEventListener('trinity-pwa-offline-changed', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [platform, user?.id, user?.role, user?.circumference, isLocked, revision]);

  if (!user || isLocked) return null;
  const validSession = session && androidSessionMatchesUser(session, user) && Date.parse(session.expiresAt) > Date.now();
  return <div className="space-y-3">
    <SettingsRows>
      <SettingsRow label="Site storage" hint="Saved files and browser data"><span className="text-xs text-muted-foreground">{usage}</span><button type="button" className={settingsButtonClass} disabled={checking || !platform} onClick={() => setRevision(value => value + 1)}>Refresh</button></SettingsRow>
      {platform?.nativeAndroid && <SettingsRow label="Offline access" hint={checking ? 'Checking…' : validSession ? `Saved access expires ${new Date(session.expiresAt).toLocaleString()}` : 'Connect to prepare saved access.'}>
        <button type="button" className={settingsButtonClass} disabled={offline || checking} onClick={() => { window.dispatchEvent(new Event('trinity-pwa-prepare')); setMessage('Preparation requested. Saved access updates here when ready.'); }}>Prepare</button>
      </SettingsRow>}
      {platform && !platform.nativeAndroid && platform.os !== 'ios' && <SettingsRow label="Offline access" hint={user.role === 'Parent' ? 'School information saves automatically as you use the parent portal.' : 'Install the school app to prepare saved pages.'}><span className="text-xs text-muted-foreground">{user.role === 'Parent' ? 'Automatic' : 'App required'}</span></SettingsRow>}
    </SettingsRows>
    {platform?.os === 'ios' && <HomeScreenSettings compact />}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
  </div>;
}
