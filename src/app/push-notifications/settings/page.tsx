"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BellRing, CalendarClock, CheckCircle2, Clock3, CreditCard, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { GlassActionButton, GlassActionDock, GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/contexts/auth-context';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_NOTIFICATION_AUTOMATION_SETTINGS,
  type NotificationAutomationSettings,
} from '@/lib/notifications/automation-settings';

type SaveState = 'idle' | 'saving' | 'saved';

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  icon,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  icon: ReactNode;
}) {
  return (
    <label className={`flex items-center gap-3 rounded-2xl border p-4 transition ${disabled ? 'border-slate-100 bg-slate-50 opacity-65' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30'}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-800">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={title} />
    </label>
  );
}

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationAutomationSettings>(DEFAULT_NOTIFICATION_AUTOMATION_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const load = useCallback(async () => {
    if (!user?.id || !auth.currentUser || auth.currentUser.uid !== user.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/notifications/settings', {
        headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load notification settings.');
      setSettings(result.settings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notification settings.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const nextReminder = useMemo(() => {
    const times = settings.attendanceReminders.times;
    return times.length ? `Every school day at ${times.join(', ')}` : 'No reminder times set';
  }, [settings.attendanceReminders.times]);

  const update = (updater: (current: NotificationAutomationSettings) => NotificationAutomationSettings) => {
    setSettings(current => updater(current));
    setSaveState('idle');
  };

  const updateTime = (index: number, time: string) => update(current => ({
    ...current,
    attendanceReminders: {
      ...current.attendanceReminders,
      times: current.attendanceReminders.times.map((value, timeIndex) => timeIndex === index ? time : value).sort(),
    },
  }));

  const removeTime = (index: number) => update(current => ({
    ...current,
    attendanceReminders: {
      ...current.attendanceReminders,
      times: current.attendanceReminders.times.filter((_, timeIndex) => timeIndex !== index),
    },
  }));

  const addTime = () => update(current => ({
    ...current,
    attendanceReminders: {
      ...current.attendanceReminders,
      times: [...current.attendanceReminders.times, '16:00'].sort(),
    },
  }));

  const save = async () => {
    if (!user?.id || !auth.currentUser || auth.currentUser.uid !== user.id) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Please sign in again before saving settings.' });
      return;
    }
    if (!settings.attendanceReminders.times.length) {
      toast({ variant: 'destructive', title: 'Add a reminder time', description: 'At least one attendance reminder time is required.' });
      return;
    }
    if (new Set(settings.attendanceReminders.times).size !== settings.attendanceReminders.times.length) {
      toast({ variant: 'destructive', title: 'Duplicate reminder time', description: 'Each reminder time must be different.' });
      return;
    }
    setSaveState('saving');
    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
        },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save notification settings.');
      setSettings(result.settings);
      setSaveState('saved');
      toast({ title: 'Notification settings saved', description: 'Future automated pushes will follow these choices.' });
    } catch (saveError) {
      setSaveState('idle');
      toast({ variant: 'destructive', title: 'Unable to save settings', description: saveError instanceof Error ? saveError.message : 'Please try again.' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-10">
      <GlassPageTopBar
        title="Notification settings"
        subtitle="Control automated push alerts for the whole school."
        backHref="/push-notifications"
        backLabel="Notifications"
        inlineActions
        actions={<GlassActionDock><GlassActionButton label="Save" icon={saveState === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : saveState === 'saved' ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />} onClick={save} disabled={isLoading || Boolean(error) || saveState === 'saving'} tone={saveState === 'saved' ? 'emerald' : 'blue'} /></GlassActionDock>}
      />

      <main className="mx-auto w-full max-w-3xl px-3 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="mt-6 space-y-4">{[1, 2, 3].map(item => <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <p className="font-bold">Notification settings are unavailable</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200"><BellRing className="h-5 w-5" /></span>
                <div>
                  <h2 className="font-bold text-slate-900">Automated alerts</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">These controls affect new pushes only. Manual notifications still work normally, and automated alerts do not appear in the notification inbox.</p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="px-1"><h2 className="text-sm font-bold text-slate-800">SchoolPay</h2><p className="mt-1 text-xs text-slate-500">Payment pushes to users with fee access.</p></div>
              <ToggleRow title="SchoolPay payment alerts" description="Notify eligible subscribed users when a real-time SchoolPay payment is received." checked={settings.categories.schoolPay} onCheckedChange={value => update(current => ({ ...current, categories: { ...current.categories, schoolPay: value } }))} icon={<CreditCard className="h-5 w-5" />} />
            </section>

            <section className="space-y-3">
              <div className="px-1"><h2 className="text-sm font-bold text-slate-800">Attendance</h2><p className="mt-1 text-xs text-slate-500">The same subscribed dashboard users receive these operational alerts.</p></div>
              <ToggleRow title="Attendance notifications" description="Master switch for all attendance push notifications." checked={settings.categories.attendance.enabled} onCheckedChange={value => update(current => ({ ...current, categories: { ...current.categories, attendance: { ...current.categories.attendance, enabled: value } } }))} icon={<BellRing className="h-5 w-5" />} />
              <ToggleRow title="Recorded attendance" description="Send a push when a class attendance record is explicitly saved." checked={settings.categories.attendance.recorded} onCheckedChange={value => update(current => ({ ...current, categories: { ...current.categories, attendance: { ...current.categories.attendance, recorded: value } } }))} disabled={!settings.categories.attendance.enabled} icon={<CheckCircle2 className="h-5 w-5" />} />
              <ToggleRow title="Unrecorded attendance reminders" description="Remind staff about classes that still have no completed attendance record." checked={settings.categories.attendance.missingReminders} onCheckedChange={value => update(current => ({ ...current, categories: { ...current.categories, attendance: { ...current.categories.attendance, missingReminders: value } } }))} disabled={!settings.categories.attendance.enabled} icon={<CalendarClock className="h-5 w-5" />} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Clock3 className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><h2 className="font-bold text-slate-900">Attendance reminder times</h2><p className="mt-1 text-sm text-slate-500">{nextReminder} · {settings.attendanceReminders.timezone}</p></div>
              </div>

              <div className="mt-5 space-y-2">
                {settings.attendanceReminders.times.map((time, index) => (
                  <div key={`${time}-${index}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <input type="time" value={time} onChange={event => updateTime(index, event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                    <button type="button" onClick={() => removeTime(index)} disabled={settings.attendanceReminders.times.length === 1} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35" title="Remove reminder time" aria-label={`Remove ${time} reminder`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addTime} disabled={settings.attendanceReminders.times.length >= 8} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Add reminder time</button>
              <div className="mt-5 border-t border-slate-100 pt-4"><ToggleRow title="School days only" description="Skip reminders on excluded dates and outside the active academic year." checked={settings.attendanceReminders.schoolDaysOnly} onCheckedChange={value => update(current => ({ ...current, attendanceReminders: { ...current.attendanceReminders, schoolDaysOnly: value } }))} icon={<CalendarClock className="h-5 w-5" />} /></div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
