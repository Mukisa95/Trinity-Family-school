'use client';

import { useState } from 'react';
import { Bell, CalendarClock, Settings } from 'lucide-react';
import { useAndroidNotifications } from '@/lib/hooks/use-android-notifications';
import { openAndroidLessonReminders, openAndroidNotificationSettings, checkAndroidAppUpdates } from '@/lib/offline/android-notifications';
import { useAuth } from '@/lib/contexts/auth-context';
import { connectNativePush, disableNativePush, testNativePush } from '@/lib/native-push-client';

export function AndroidNotificationStatus() {
  const { isAndroid, isChecking, state } = useAndroidNotifications();
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  if (!isAndroid) return null;
  const connected = state?.remotePush && state.pushAccountId === user?.id;
  const open = async (action: () => Promise<unknown>) => {
    setError(null);
    try { await action(); } catch { setError('Update the Android app to open notification settings. Lesson reminder settings are also available from the app’s shortcut.'); }
  };
  const status = isChecking ? 'Checking Android permission…' : state?.permission === 'granted' ? 'Allowed in Android settings' : state?.permission === 'denied' ? 'Disabled in Android settings' : 'Manage permissions in Android settings';
  const configure = async (action: () => Promise<unknown>, tested = false) => {
    setBusy(true); setError(null); setConfirmation(null);
    try { await action(); if (tested) setConfirmation('Test sent through the school push service. Check your phone’s notifications.'); }
    catch { setError('School alerts could not connect. Check your internet connection, update the Android app and try again.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Android notification settings" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
    <div className="flex items-start gap-3"><Bell className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" /><div>
      <h2 className="font-semibold">Android notifications</h2><p className="mt-1" role="status">{status}</p>
      <p className="mt-2 text-slate-500 dark:text-slate-400">Timetable cards and lesson reminders use your phone’s notification settings.</p>
      <p className="mt-2 text-slate-500 dark:text-slate-400">{connected ? 'School alerts are connected and can arrive while the app is closed.' : state?.pushEnabled === false ? 'School alerts are turned off on this phone. Timetable cards and lesson reminders keep their own settings.' : 'Connecting school alerts for your signed-in account. You can also enable them below.'}</p>
    </div></div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button onClick={() => void open(openAndroidNotificationSettings)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 font-medium hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"><Settings className="h-4 w-4" aria-hidden="true" />Android settings</button>
      <button onClick={() => void open(openAndroidLessonReminders)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-3 font-medium text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><CalendarClock className="h-4 w-4" aria-hidden="true" />Lesson reminders</button>
      {user?.id && <button disabled={busy || isChecking} onClick={() => void configure(connected ? disableNativePush : () => connectNativePush(user.id, true))} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50 dark:border-slate-600">{busy ? 'Working…' : connected ? 'Turn off school alerts' : 'Enable school alerts'}</button>}
      {connected && user?.id && <button disabled={busy || state?.permission !== 'granted'} onClick={() => void configure(() => testNativePush(user.id), true)} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50 dark:border-slate-600">Send push test</button>}
      <button onClick={() => { setError(null); void checkAndroidAppUpdates().catch(() => setError('Install the latest Android app from this school’s download page to enable in-app updates.')); }} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-slate-600">Check app updates</button>
    </div>
    {error && <p className="mt-3 text-red-600 dark:text-red-400" role="alert">{error}</p>}
    {confirmation && <p className="mt-3 text-emerald-700 dark:text-emerald-400" role="status">{confirmation}</p>}
  </section>;
}
