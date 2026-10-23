'use client';

import { lazy, Suspense, useContext, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Bell, CalendarClock, ChevronRight, HardDrive, Info, LayoutGrid, Palette, Radio, Shield, User } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useAndroidNotifications } from '@/lib/hooks/use-android-notifications';
import { useAppPlatform } from '@/lib/hooks/use-app-platform';
import { useSettingsSidebar } from '@/lib/hooks/use-settings-sidebar';
import { setAndroidEventPreference, checkAndroidAppUpdates, openAndroidLessonReminders, openAndroidTimetableSettings, openAndroidWidgetSettings, setAndroidTimetableNotification } from '@/lib/offline/android-notifications';
import { APP_SETTING_SECTIONS, APP_SETTINGS, filterAppSettings, type AppSettingSection } from '@/lib/app-settings';
import { GlassPageTopBar, GlassPageSearchInput } from '@/components/common/glass-page-top-bar';
import { SidebarContext } from '@/components/ui/sidebar';
import { AutoLockSettings } from '@/components/settings/auto-lock-settings';
import { PasskeySettings } from '@/components/settings/passkey-settings';
import { LookAndFeelSettings } from '@/components/settings/look-and-feel-settings';
import { SettingsDisclosure, SettingsRow, SettingsRows, SettingsToggle, settingsButtonClass } from '@/components/settings/settings-controls';
import { AppStorageSettings } from './app-storage-settings';
import { AppPushSettings } from './app-push-settings';
import { AboutApp } from './about-app';

const icons = { appearance: Palette, account: User, security: Shield, tracking: Radio, push: Bell, lessons: CalendarClock, widgets: LayoutGrid, storage: HardDrive, about: Info };
const MyProfile = lazy(() => import('./my-profile').then(module => ({ default: module.MyProfile })));
const AccountSettings = lazy(() => import('./account-settings').then(module => ({ default: module.AccountSettings })));
const ParentAccountSettings = lazy(() => import('./parent-account-settings').then(module => ({ default: module.ParentAccountSettings })));

export function AppSettings() {
  const { user } = useAuth();
  const platform = useAppPlatform();
  const android = useAndroidNotifications();
  const sidebar = useContext(SidebarContext);
  useSettingsSidebar(Boolean(sidebar), sidebar?.open ?? false, sidebar?.setOpen);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<AppSettingSection>('appearance');
  const [verticalTabs, setVerticalTabs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState<'profile' | 'account' | null>(null);
  const pendingSetting = useRef<string | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);
  const parent = user?.role === 'Parent';
  const { state, isAndroid, isChecking } = android;
  const visible = (item: typeof APP_SETTINGS[number]) => (item.id !== 'home-screen' || platform?.os === 'ios') && (item.id !== 'offline' || platform?.os !== 'ios');
  const availableSections = APP_SETTING_SECTIONS.filter(group => filterAppSettings('', isAndroid, group.id).some(visible));
  const activeSection = availableSections.find(group => group.id === section) || availableSections[0];
  const items = filterAppSettings('', isAndroid, activeSection.id).filter(visible);
  const matches = filterAppSettings(query, isAndroid).filter(visible);

  useEffect(() => {
    const readHash = () => {
      setDetail(null);
      const hash = window.location.hash.slice(1);
      const item = APP_SETTINGS.find(item => `setting-${item.id}` === hash);
      const group = APP_SETTING_SECTIONS.find(group => group.id === hash);
      if (item) { setSection(item.section); pendingSetting.current = item.id; }
      else if (group) setSection(group.id);
    };
    const media = window.matchMedia('(min-width: 768px)');
    const resize = () => setVerticalTabs(media.matches);
    readHash(); resize();
    window.addEventListener('hashchange', readHash);
    media.addEventListener('change', resize);
    return () => { window.removeEventListener('hashchange', readHash); media.removeEventListener('change', resize); };
  }, []);

  useEffect(() => {
    const setting = pendingSetting.current;
    if (!setting || query.trim()) return;
    const target = contentRef.current?.querySelector<HTMLElement>(`#setting-${setting}`);
    if (!target) return;
    pendingSetting.current = undefined;
    const disclosure = target.querySelector('details');
    if (disclosure) disclosure.open = true;
    target.scrollIntoView({ block: 'nearest' });
    target.focus({ preventScroll: true });
  }, [section, query, isAndroid]);

  useEffect(() => {
    if (detail) contentRef.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, [detail]);

  const selectSection = (next: AppSettingSection, setting?: string) => {
    pendingSetting.current = setting;
    setSection(next); setQuery(''); setError(''); setMessage(''); setDetail(null);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${setting ? `setting-${setting}` : next}`);
  };
  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = verticalTabs ? 'ArrowDown' : 'ArrowRight';
    const backward = verticalTabs ? 'ArrowUp' : 'ArrowLeft';
    if (![forward, backward, 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? availableSections.length - 1 : (index + (event.key === forward ? 1 : -1) + availableSections.length) % availableSections.length;
    const next = availableSections[nextIndex];
    selectSection(next.id);
    document.getElementById(`settings-tab-${next.id}`)?.focus();
  };
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (error) { setError(error instanceof Error && !/Unsupported (?:preparation )?action/i.test(error.message) ? error.message : 'Update the Android app to use this control.'); }
    finally { setBusy(false); }
  };
  const actionButton = (label: string, action: () => Promise<unknown>, name = label) => <button type="button" className={settingsButtonClass} aria-label={name} disabled={busy} onClick={() => void run(action)}>{label}<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></button>;
  const openDetail = (next: 'profile' | 'account', name: string) => <button type="button" onClick={() => setDetail(next)} className={settingsButtonClass} aria-label={name}>Open<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></button>;
  const toggle = (id: string, label: string, value: boolean | undefined, action: (value: boolean) => Promise<unknown>) => <SettingsRow label={label} htmlFor={`settings-${id}`}><SettingsToggle id={`settings-${id}`} value={value} disabled={busy || isChecking} onCheckedChange={enabled => void run(() => action(enabled))} /></SettingsRow>;
  const content = (id: string) => {
    switch (id) {
      case 'theme': return <LookAndFeelSettings compact />;
      case 'profile': return <SettingsRow label="My profile">{openDetail('profile', 'View my profile')}</SettingsRow>;
      case 'account': return <SettingsRow label={parent ? 'Password' : 'Username and password'}>{openDetail('account', 'Open account settings')}</SettingsRow>;
      case 'autolock': return <AutoLockSettings compact />;
      case 'biometrics': return <SettingsDisclosure title="Biometrics and passkeys"><PasskeySettings compact /></SettingsDisclosure>;
      case 'timetable': return toggle('live-timetable', 'Timetable notification', state?.notificationCard, async enabled => {
        if (await setAndroidTimetableNotification(enabled) === 'settings') setMessage('Change the notification card in Android settings, then save.');
      });
      case 'live-events': return <>{toggle('live-events', 'Calendar events in the card', state?.liveEvents, enabled => setAndroidEventPreference('events', enabled))}{toggle('event-reminders', 'Event reminder alerts', state?.eventReminders, enabled => setAndroidEventPreference('eventReminders', enabled))}</>;
      case 'timetable-display': return <SettingsRow label="Card display">{actionButton('Configure', openAndroidTimetableSettings, 'Configure timetable card')}</SettingsRow>;
      case 'push': return <AppPushSettings android={isAndroid} state={state} checking={isChecking} />;
      case 'lesson-reminders': return <SettingsRow label="Lesson reminders">{actionButton('Manage', openAndroidLessonReminders, 'Manage lesson reminders')}</SettingsRow>;
      case 'widgets': return <SettingsRow label="Home screen widgets">{actionButton('Manage', openAndroidWidgetSettings, 'Manage home screen widgets')}</SettingsRow>;
      case 'offline':
      case 'home-screen': return <AppStorageSettings />;
      case 'updates': return <SettingsRow label="App updates">{actionButton('Check', checkAndroidAppUpdates, 'Check for Android updates')}</SettingsRow>;
      case 'about-app': return <AboutApp android={isAndroid} state={state} />;
    }
  };
  const search = <GlassPageSearchInput aria-label="Search settings" placeholder="Search…" value={query} onChange={event => setQuery(event.currentTarget.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }} />;
  const plainRows = ['account', 'tracking', 'lessons', 'widgets'].includes(activeSection.id);
  const controls = items.map(item => <div key={item.id} id={`setting-${item.id}`} tabIndex={-1} className="scroll-mt-28 divide-y divide-border/60 outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring">{content(item.id)}</div>);

  return <div className="min-h-full pb-6" data-app-settings>
    <GlassPageTopBar className="mx-0 mb-3 sm:mx-0 md:mx-0" title="App Settings" backHref={parent ? '/parent' : '/'} backLabel="Back to dashboard" inlineActions
      center={search} actionsLeading={<div className="lg:hidden">{search}</div>} />
    <div className="grid w-full items-start gap-4 px-1 sm:px-3 md:grid-cols-[200px_minmax(0,1fr)] md:gap-6 lg:gap-8">
      <nav role="tablist" aria-label="Settings sections" aria-orientation={verticalTabs ? 'vertical' : 'horizontal'} onTouchStart={event => event.stopPropagation()} className="flex min-w-0 max-w-full gap-1.5 overflow-x-auto pb-1 touch-pan-x touch-pinch-zoom md:sticky md:top-3 md:flex-col md:overflow-visible md:pb-0">
        {availableSections.map((group, index) => { const Icon = icons[group.id]; const active = activeSection.id === group.id; return <button key={group.id} id={`settings-tab-${group.id}`} type="button" role="tab" aria-selected={active} aria-controls="settings-panel" tabIndex={active ? 0 : -1} onClick={() => selectSection(group.id)} onKeyDown={event => moveTab(event, index)}
          className={`flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9 md:rounded-xl md:text-left ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{group.title}</button>; })}
      </nav>
      <div ref={contentRef} className="min-w-0 w-full md:max-w-3xl md:justify-self-center">
        {query.trim() ? <section id="settings-panel" role="tabpanel" aria-label="Settings search results" className="space-y-3">
          <div className="flex min-h-9 items-center justify-between gap-3"><h2 className="text-base font-semibold">Search results</h2><span role="status" className="text-xs text-muted-foreground">{matches.length} found</span></div>
          {matches.length > 0 && <SettingsRows>{matches.map(item => {
            const groupTitle = APP_SETTING_SECTIONS.find(group => group.id === item.section)?.title;
            return <button key={item.id} type="button" onClick={() => selectSection(item.section, item.id)} className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="min-w-0"><span className="block text-[13px] font-medium">{item.title}</span>{groupTitle !== item.title && <span className="text-xs text-muted-foreground">{groupTitle}</span>}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></button>;
          })}</SettingsRows>}
          {!matches.length && <p className="py-4 text-sm text-muted-foreground">No settings found.</p>}
          <button type="button" className={settingsButtonClass} onClick={() => setQuery('')}>Clear search</button>
        </section> : <section id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeSection.id}`} className="space-y-3" tabIndex={-1}>
          <h2 tabIndex={-1} className="pb-1 pt-1 text-base font-semibold outline-none sm:text-lg">{activeSection.id === 'account' && detail ? detail === 'profile' ? 'My profile' : 'Account settings' : activeSection.title}</h2>
          {error && <p role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
          {message && <p role="status" className="text-xs leading-5 text-muted-foreground">{message}</p>}
          {activeSection.id === 'account' && detail ? <>
            <button type="button" className={settingsButtonClass} onClick={() => setDetail(null)}>Back to my account</button>
            <Suspense fallback={<p role="status" className="text-xs text-muted-foreground">Loading details…</p>}>
              {detail === 'profile' ? <MyProfile embedded /> : parent ? <ParentAccountSettings embedded /> : <AccountSettings embedded />}
            </Suspense>
          </> : plainRows ? <SettingsRows>{controls}</SettingsRows> : <div className="space-y-3">{controls}</div>}
          {activeSection.id === 'tracking' && !isChecking && typeof state?.notificationCard !== 'boolean' && <p className="text-xs leading-5 text-muted-foreground">Update the Android app for live status. Card display opens the existing controls.</p>}
          {activeSection.id === 'tracking' && state?.permission === 'denied' && <p className="text-xs leading-5 text-muted-foreground">Allow Android notifications under Push notifications.</p>}
        </section>}
      </div>
    </div>
  </div>;
}
