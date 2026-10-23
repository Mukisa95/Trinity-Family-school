'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Bell, CalendarClock, HardDrive, Info, LayoutGrid, Palette, Radio, Search, Settings, Shield, User, X } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useAppearance, type ThemePreference } from '@/components/providers/theme-provider';
import { useAndroidNotifications } from '@/lib/hooks/use-android-notifications';
import { setAndroidEventPreference, checkAndroidAppUpdates, openAndroidLessonReminders, openAndroidTimetableSettings, openAndroidWidgetSettings, setAndroidTimetableNotification } from '@/lib/offline/android-notifications';
import { APP_SETTING_SECTIONS, filterAppSettings, type AppSettingSection } from '@/lib/app-settings';
import { GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { AutoLockSettings } from '@/components/settings/auto-lock-settings';
import { PasskeySettings } from '@/components/settings/passkey-settings';
import { HomeScreenSettings } from '@/components/pwa/home-screen-settings';
import { AppPushSettings } from './app-push-settings';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AboutApp } from './about-app';
import { useAppPlatform } from '@/lib/hooks/use-app-platform';

const icons = { appearance: Palette, account: User, security: Shield, tracking: Radio, push: Bell, lessons: CalendarClock, widgets: LayoutGrid, storage: HardDrive, about: Info };

export function AppSettings() {
  const { user } = useAuth();
  const platform = useAppPlatform();
  const { ready, preference, changing, changeTheme } = useAppearance();
  const { isAndroid, isChecking, state } = useAndroidNotifications();
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<AppSettingSection>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const parent = user?.role === 'Parent';
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (error) { setError(error instanceof Error && !/Unsupported (?:preparation )?action/i.test(error.message) ? error.message : 'Update the Android app to use this setting.'); }
    finally { setBusy(false); }
  };
  const link = (href: string, title: string) => <Button asChild variant="outline" className="min-h-11"><Link href={href}>{title}<ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button>;
  const nativeButton = (label: string, action: () => Promise<unknown>) => <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => void run(action)}>{label}</Button>;
  const content = (id: string) => {
    switch (id) {
      case 'look-and-feel': return link(parent ? '/parent/settings/look-and-feel' : '/settings/look-and-feel', 'Customise look and feel');
      case 'home-screen': return <HomeScreenSettings />;
      case 'theme': return <div role="group" aria-label="Theme" className="grid grid-cols-3 gap-2">{(['light', 'dark', 'system'] as ThemePreference[]).map(value => <Button key={value} aria-pressed={preference === value} disabled={!ready || changing} variant={preference === value ? 'default' : 'outline'} className="min-h-11 px-2" onClick={event => void changeTheme(value, event.currentTarget)}>{value === 'system' ? 'Device' : value === 'dark' ? 'Dark' : 'Light'}</Button>)}</div>;
      case 'profile': return link(parent ? '/parent/settings/account#profile' : '/profile', 'View my profile');
      case 'account': return link(parent ? '/parent/settings/account' : '/settings/account', 'Open account settings');
      case 'autolock': return <AutoLockSettings />;
      case 'biometrics': return <PasskeySettings />;
      case 'timetable': return <div className="space-y-3">{typeof state?.notificationCard === 'boolean' ? <div className="flex min-h-11 items-center justify-between gap-3"><label htmlFor="settings-live-timetable" className="text-sm font-medium">Show timetable notification</label><Switch id="settings-live-timetable" disabled={busy || isChecking} checked={state.notificationCard} onCheckedChange={enabled => void run(async () => {
        const result = await setAndroidTimetableNotification(enabled);
        setMessage(result === 'settings' ? 'Turn Show notification card on or off in the native settings, then save.' : enabled ? 'Timetable notification enabled.' : 'Timetable notification turned off.');
      })} /></div> : <div className="flex flex-wrap gap-2">{nativeButton('Turn off timetable notification', async () => { const result = await setAndroidTimetableNotification(false); setMessage(result === 'settings' ? 'Turn Show notification card off, then save.' : 'Timetable notification turned off.'); })}{nativeButton('Turn on timetable notification', async () => { const result = await setAndroidTimetableNotification(true); setMessage(result === 'settings' ? 'Turn Show notification card on, then save.' : 'Timetable notification enabled.'); })}</div>}
      {state?.permission === 'denied' && <p className="text-xs text-muted-foreground">Android notification permission is blocked. Allow it under Push notifications to show the card.</p>}<p className="text-xs leading-5 text-muted-foreground">Calendar event announcements and other school alerts are controlled under Push notifications.</p></div>;
      case 'live-events': return <div className="space-y-3">{([{ key: 'events', title: 'Show calendar events in the card', value: state?.liveEvents }, { key: 'eventReminders', title: 'Event reminder alerts', value: state?.eventReminders }] as const).map(item => typeof item.value === 'boolean' ? <div key={item.key} className="flex min-h-11 items-center justify-between gap-3"><label htmlFor={'settings-' + item.key} className="text-sm font-medium">{item.title}</label><Switch id={'settings-' + item.key} checked={item.value} disabled={busy || isChecking} onCheckedChange={enabled => void run(() => setAndroidEventPreference(item.key, enabled))} /></div> : <div key={item.key}>{nativeButton(item.title + ' settings', openAndroidTimetableSettings)}</div>)}{state?.notificationCard === false && <p className="text-xs text-muted-foreground">Turn on the timetable notification above to show events in the card. Event reminder alerts are separate.</p>}</div>;
      case 'timetable-display': return nativeButton('Choose timetable display', openAndroidTimetableSettings);
      case 'push': return <AppPushSettings android={isAndroid} state={state} checking={isChecking} />;
      case 'lesson-reminders': return nativeButton('Manage lesson reminders', openAndroidLessonReminders);
      case 'widgets': return nativeButton('Manage home screen widgets', openAndroidWidgetSettings);
      case 'offline': return parent ? <p className="text-sm leading-6 text-muted-foreground">Your permitted family information is saved automatically while you use the parent portal. Signing out removes the saved information for your account from this device.</p> : link('/settings/offline', 'Manage offline access');
      case 'updates': return nativeButton('Check for Android updates', checkAndroidAppUpdates);
      case 'about-app': return <AboutApp android={isAndroid} state={state} />;
    }
  };
  const items = filterAppSettings(query, isAndroid, section).filter(item => item.id !== 'home-screen' || platform?.os === 'ios');
  const groups = APP_SETTING_SECTIONS.filter(group => items.some(item => item.section === group.id));
  const availableSections = APP_SETTING_SECTIONS.filter(group => filterAppSettings('', isAndroid, group.id).length > 0);
  return <div className="min-h-full pb-28">
    <GlassPageTopBar className="mx-0 sm:mx-0" title="App Settings" backHref={parent ? '/parent' : '/'} backLabel="Back to dashboard" recordDetails={user ? `@${user.username} · ${user.role}` : undefined} />
    <div className="mx-auto max-w-5xl space-y-5 px-3 sm:px-5">
      <div className="space-y-2"><label htmlFor="app-settings-search" className="text-sm font-medium">Search settings</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /><input id="app-settings-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try biometrics, notifications or theme" className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-12 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear settings search" className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" /></button>}</div><p className="text-xs text-muted-foreground" role="status">{query.trim() ? `${items.length} matching ${items.length === 1 ? 'setting' : 'settings'}` : 'Your preferences, organised in one place.'}</p></div>
      <div className="space-y-2 md:hidden"><label htmlFor="settings-section" className="text-sm font-medium">Settings section</label><select id="settings-section" value={section || ''} onChange={event => { setSection((event.target.value || undefined) as AppSettingSection | undefined); setQuery(''); }} className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">All settings</option>{availableSections.map(group => <option key={group.id} value={group.id}>{group.title}</option>)}</select></div>
      <div className="grid items-start gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden gap-2 md:sticky md:top-4 md:flex md:flex-col">
          <Button variant={!section ? 'secondary' : 'ghost'} aria-pressed={!section} className="min-h-11 justify-start rounded-lg" onClick={() => { setSection(undefined); setQuery(''); }}><Settings className="mr-2 h-4 w-4" aria-hidden="true" />All settings</Button>
          {availableSections.map(group => { const Icon = icons[group.id]; return <Button key={group.id} variant={section === group.id ? 'secondary' : 'ghost'} aria-pressed={section === group.id} className="min-h-11 justify-start whitespace-normal rounded-lg text-left" onClick={() => { setSection(group.id); setQuery(''); }}><Icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />{group.title}</Button>; })}
        </nav>
        <div className="min-w-0 space-y-5">
          {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-card p-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">{message}</p>}
          {groups.map(group => { const Icon = icons[group.id]; return <section key={group.id} id={group.id} aria-labelledby={`section-${group.id}`} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-start gap-3 border-b border-border bg-muted/30 p-4 sm:p-5"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><div><h2 id={`section-${group.id}`} className="text-base font-semibold">{group.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{group.description}</p></div></div>
            <div className="divide-y divide-border">{items.filter(item => item.section === group.id).map(item => <div key={item.id} id={`setting-${item.id}`} className="space-y-3 p-4 sm:p-5"><div><h3 className="text-sm font-semibold">{item.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p></div>{content(item.id)}</div>)}</div>
          </section>; })}
          {!items.length && <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><Search className="mx-auto mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" /><p className="font-medium">No settings found</p><p className="mt-2 text-sm text-muted-foreground">Try a different word, such as theme, password or notifications.</p><Button variant="outline" onClick={() => { setQuery(''); setSection(undefined); }} className="mt-4 min-h-11">Show all settings</Button></div>}
        </div>
      </div>
    </div>
  </div>;
}
