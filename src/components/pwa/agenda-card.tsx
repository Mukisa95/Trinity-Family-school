'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Settings2 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { useHomeScreenWorkspace } from '@/lib/pwa/use-workspace';
import { hasBrowserOfflineWorkspace, formatDeviceTime } from '@/lib/pwa/platform';
import { useVisibleClock } from '@/lib/hooks/use-visible-clock';
import { activeTimetableFeed } from '@/lib/offline/timetable-feed';
import { agendaEvents, DEFAULT_AGENDA, readAgendaPreferences, trackedLesson, trackingOptions, type AgendaPreferences } from '@/lib/pwa/agenda';

function SavedAgenda() {
  const { user, isLocked } = useAuth();
  const { workspace } = useHomeScreenWorkspace();
  const now = useVisibleClock(30_000);
  const [settings, setSettings] = useState(false);
  const [classId, setClassId] = useState('');
  const [stored, setStored] = useState<{ key: string; prefs: AgendaPreferences } | null>(null);
  const [error, setError] = useState('');
  const key = `trinity-pwa-agenda:${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools'}:${user?.id || ''}`;
  useEffect(() => {
    try { setStored({ key, prefs: readAgendaPreferences(JSON.parse(localStorage.getItem(key) || 'null')) }); }
    catch { setStored({ key, prefs: DEFAULT_AGENDA }); }
  }, [key]);
  const prefs = stored?.key === key ? stored.prefs : DEFAULT_AGENDA;
  const change = (next: AgendaPreferences) => {
    setStored({ key, prefs: next });
    try { localStorage.setItem(key, JSON.stringify(next)); setError(''); }
    catch { setError('Your choices work now, but could not be saved. Check available phone storage.'); }
  };
  if (!workspace?.snapshot || !user || user.role === 'Parent' || isLocked) return null;
  const { snapshot, session } = workspace;
  if (!session.grants.timetable && !session.grants.events) return null;
  const options = session.grants.timetable ? trackingOptions(snapshot, now) : [];
  const chosen = prefs.tracked.map(key => options.find(option => option.key === key)).filter((item): item is NonNullable<typeof item> => !!item);
  const classes = [...new Map(options.map(option => [option.classId, { id: option.classId, label: String(snapshot.datasets.classes?.data.find(item => item.id === option.classId)?.code || snapshot.datasets.classes?.data.find(item => item.id === option.classId)?.name || option.classId) }])).values()];
  const selectedClass = classes.some(item => item.id === classId) ? classId : classes[0]?.id || '';
  const events = session.grants.events ? agendaEvents(snapshot, session, prefs.events, now) : [];
  const periods = session.grants.timetable && prefs.periods ? activeTimetableFeed(snapshot, session.timeZone, now) : [];
  const label = { periods: 'Period times', tracked: 'Tracked subjects', events: 'Events' };
  return <section aria-label="My school day" className="my-4 rounded-2xl border bg-card p-4 text-card-foreground sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">My school day</h2><Button variant="ghost" className="min-h-11 gap-2" aria-expanded={settings} aria-controls="pwa-agenda-options" onClick={() => setSettings(!settings)}><Settings2 className="h-4 w-4" aria-hidden="true" />Customize</Button></div>
    {prefs.order.map(section => <div key={section} className="space-y-2">
      {section === 'periods' && periods.map(period => <Link key={period.id} href="/timetable" className="mt-2 flex min-h-11 flex-wrap items-center justify-between gap-x-3 rounded-xl bg-muted p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span>{period.name} · {period.title}</span><span className="font-medium tabular-nums">{period.time.split(' – ').map(formatDeviceTime).join(' – ')}</span></Link>)}
      {section === 'tracked' && chosen.map(item => { const lesson = trackedLesson(snapshot, item, session, now); return <Link key={item.key} href="/timetable" className="mt-2 flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="font-semibold">{item.classCode} · {item.subjectCode}</span><span className="tabular-nums text-muted-foreground">{lesson.status}{lesson.start && ` · ${formatDeviceTime(lesson.start)}–${formatDeviceTime(lesson.end!)}`}</span></Link>; })}
      {section === 'events' && events.length > 0 && <ul aria-label="Upcoming school events" className="mt-3 max-h-64 space-y-2 overflow-y-auto overscroll-contain">{events.map(event => <li key={event.id}><Link href="/events" className="block min-h-11 rounded-xl border p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block font-medium">{event.title}</span><span className="mt-1 block text-muted-foreground">{event.startDate.slice(0, 10)}{event.isAllDay ? ' · All day' : event.startTime ? ` · ${formatDeviceTime(event.startTime)}` : ''}{event.location ? ` · ${event.location}` : ''}</span></Link></li>)}</ul>}
    </div>)}
    {!periods.length && !chosen.length && !events.length && <p className="py-3 text-sm text-muted-foreground">Choose subjects to track, or open your timetable and events while connected to save them.</p>}
    {settings && <div id="pwa-agenda-options" className="mt-4 space-y-4 border-t pt-4">
      <p className="text-sm text-muted-foreground">Lesson tracking shows today only, using the school’s time zone and this phone’s time display. Choices are saved for this account on this device.</p>
      <div className="space-y-2">{prefs.order.map((section, index) => <div key={section} className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">{label[section]}</span><div className="flex gap-1">{[-1, 1].map(direction => <Button key={direction} size="icon" variant="outline" className="h-11 w-11" aria-label={`Move ${label[section].toLowerCase()} ${direction < 0 ? 'up' : 'down'}`} disabled={index + direction < 0 || index + direction >= prefs.order.length} onClick={() => { const order = [...prefs.order]; [order[index], order[index + direction]] = [order[index + direction], order[index]]; change({ ...prefs, order }); }}>{direction < 0 ? <ArrowUp className="h-4 w-4" aria-hidden="true" /> : <ArrowDown className="h-4 w-4" aria-hidden="true" />}</Button>)}</div>
      </div>)}</div>
      {session.grants.timetable && <><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={prefs.periods} onChange={event => change({ ...prefs, periods: event.target.checked })} className="h-5 w-5 accent-primary" />Show period times alongside tracked subjects</label>
        <div className="space-y-2 text-sm"><label htmlFor="pwa-tracking-class">Class to customize</label><select id="pwa-tracking-class" value={selectedClass} onChange={event => setClassId(event.target.value)} className="min-h-11 w-full rounded-lg border bg-background px-3 text-base">{classes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
        <div className="max-h-64 overflow-y-auto rounded-lg border p-2">{options.filter(item => item.classId === selectedClass).map(item => <label key={item.key} className="flex min-h-11 items-center gap-3 px-2 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0 accent-primary" checked={prefs.tracked.includes(item.key)} onChange={event => change({ ...prefs, tracked: event.target.checked ? [...prefs.tracked, item.key] : prefs.tracked.filter(key => key !== item.key) })} />{item.classCode} · {item.subjectCode}</label>)}{!options.length && <p className="p-2 text-sm text-muted-foreground">The current timetable has not finished saving.</p>}</div>
        {chosen.length > 0 && <ol className="space-y-2">{chosen.map((item, index) => <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{item.classCode} · {item.subjectCode}</span><div className="flex gap-1"><Button variant="outline" className="min-h-11" disabled={index === 0} aria-label={`Move ${item.classCode} ${item.subjectCode} earlier`} onClick={() => { const tracked = chosen.map(value => value.key); [tracked[index - 1], tracked[index]] = [tracked[index], tracked[index - 1]]; change({ ...prefs, tracked }); }}>Move up</Button><Button variant="ghost" className="min-h-11" aria-label={`Stop tracking ${item.classCode} ${item.subjectCode}`} onClick={() => change({ ...prefs, tracked: prefs.tracked.filter(key => key !== item.key) })}>Stop tracking</Button></div></li>)}</ol>}
      </>}
      {session.grants.events && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-primary" checked={prefs.events} onChange={event => change({ ...prefs, events: event.target.checked })} />Show upcoming events</label>}
      <p className="text-xs text-muted-foreground">An event due tomorrow stays visible until it ends, even when upcoming events are hidden.</p>
      {error && <p role="status" className="text-sm text-muted-foreground">{error}</p>}
    </div>}
  </section>;
}

export function HomeScreenAgenda() {
  const [installed, setInstalled] = useState(false);
  useEffect(() => { setInstalled(!window.TrinityOffline && hasBrowserOfflineWorkspace()); }, []);
  return installed ? <SavedAgenda /> : null;
}
