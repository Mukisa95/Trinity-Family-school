'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { connectNativePush, disableNativePush, testNativePush } from '@/lib/native-push-client';
import { disablePushSubscription, enablePushSubscription, getConfirmedBrowserPushSubscription, supportsWebPush } from '@/lib/push-subscription-client';
import { openAndroidNotificationSettings, type AndroidNotificationState } from '@/lib/offline/android-notifications';
import { Button } from '@/components/ui/button';

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
  const connected = android ? Boolean(state?.remotePush && state.pushAccountId === user?.id) : browserState?.connected;
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
  return <div className="space-y-3">
    <p className="text-sm font-medium" role="status">{loading ? 'Checking notifications…' : android && !state ? 'Notification status unavailable. Update or reopen the Android app.' : connected ? 'School alerts are connected.' : 'School alerts are off on this device.'}</p>
    {permission === 'denied' && <p className="text-sm text-muted-foreground">Notifications are blocked in {android ? 'Android' : 'your browser'} settings. Allow them there to receive alerts.</p>}
    {browserState?.supported === false && !android ? <p className="text-sm text-muted-foreground">This browser does not support push notifications. On iPhone or iPad, add the app to your home screen and open it there.</p> : <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="min-h-11" disabled={busy || loading || !user || (android && !state)} onClick={() => void run(toggle)}>{busy ? 'Working…' : connected ? 'Turn off school alerts' : 'Enable school alerts'}</Button>
      {android && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => void run(openAndroidNotificationSettings)}>Android notification permissions</Button>}
      {android && connected && user && <Button variant="outline" className="min-h-11" disabled={busy || permission !== 'granted'} onClick={() => void run(() => testNativePush(user.id), 'Test sent. Check your phone’s notifications.')}>Send push test</Button>}
    </div>}
    <p className="text-xs leading-5 text-muted-foreground">This affects alerts sent to this device. Live timetable cards and lesson reminders have their own controls.</p>
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
