'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { connectNativePush, disableNativePush, testNativePush } from '@/lib/native-push-client';
import { disablePushSubscription, enablePushSubscription, getConfirmedBrowserPushSubscription, supportsWebPush } from '@/lib/push-subscription-client';
import { openAndroidNotificationSettings, type AndroidNotificationState } from '@/lib/offline/android-notifications';
import { SettingsRow, SettingsRows, SettingsToggle, settingsButtonClass } from '@/components/settings/settings-controls';

export function AppPushSettings({ android, state, checking }: { android: boolean; state: AndroidNotificationState | null; checking: boolean }) {
  const { user } = useAuth();
  const [browserState, setBrowserState] = useState<{ supported: boolean; connected: boolean; permission: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const refresh = async () => {
    if (android || !user) return;
    const supported = supportsWebPush();
    const connected = supported && Boolean(await getConfirmedBrowserPushSubscription(user.id));
    setBrowserState({ supported, connected, permission: typeof Notification === 'undefined' ? 'unavailable' : Notification.permission });
  };
  useEffect(() => {
    let disposed = false;
    const update = () => { if (!disposed) void refresh().catch(() => { if (!disposed) setError('Could not check push notifications. Try again.'); }); };
    update(); window.addEventListener('focus', update);
    return () => { disposed = true; window.removeEventListener('focus', update); };
  }, [android, user?.id]);
  const connected = android ? Boolean(state?.remotePush && state.pushEnabled && state.pushAccountId === user?.id) : browserState?.connected;
  const permission = android ? state?.permission : browserState?.permission;
  const run = async (action: () => Promise<unknown>, confirmation?: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await refresh(); if (confirmation) setMessage(confirmation); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not update notifications. Check your connection and try again.'); }
    finally { setBusy(false); }
  };
  const toggle = async () => {
    if (!user) return;
    if (android) { await (connected ? disableNativePush() : connectNativePush(user.id, true)); return; }
    if (connected) { await disablePushSubscription(user.id); return; }
    const result = await enablePushSubscription(user.id);
    if (!result.active) throw new Error(result.reason === 'permission-denied' ? 'Allow notifications in your browser’s site settings, then try again.' : 'Notifications were not enabled. Check your browser permission and internet connection.');
  };
  const loading = android ? checking : !browserState;
  const unavailable = browserState?.supported === false && !android;
  const hint = loading ? 'Checking…' : android && !state ? 'Reopen or update the app for status.' : unavailable ? 'Unavailable in this browser.' : permission === 'denied' ? `Blocked in ${android ? 'Android' : 'browser'} settings.` : undefined;
  return <div className="space-y-3">
    <SettingsRows>
      <SettingsRow label="School alerts" htmlFor="settings-school-alerts" hint={hint}>
        <SettingsToggle id="settings-school-alerts" value={loading || unavailable || (android && !state) ? undefined : connected === true} disabled={busy || !user} onCheckedChange={() => void run(toggle)} />
      </SettingsRow>
      {android && <SettingsRow label="Android permissions"><button type="button" className={settingsButtonClass} disabled={busy} onClick={() => void run(openAndroidNotificationSettings)}>Open settings</button></SettingsRow>}
      {android && connected && user && <SettingsRow label="Test notification"><button type="button" className={settingsButtonClass} disabled={busy || permission !== 'granted'} onClick={() => void run(() => testNativePush(user.id), 'Test sent.')}>Send test</button></SettingsRow>}
    </SettingsRows>
    {error && <p role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
  </div>;
}
