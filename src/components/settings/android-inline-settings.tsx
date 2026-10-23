'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { androidOfflineRequest } from '@/lib/offline/android-bridge';
import { rememberWidgetOrder, requestAndroidAppSettings, type AndroidAppSettings, type AppSettingsAction, type LessonReminderSettings, type ReminderFilter, type SettingsChoice, type SurfaceSettings } from '@/lib/offline/android-app-settings';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { SettingsRow, SettingsRows, SettingsSelect, SettingsToggle, settingsButtonClass } from './settings-controls';

function useNativeSettings() {
  const { user, isLocked } = useAuth();
  const account = user?.id;
  const [data, setData] = useState<AndroidAppSettings | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const version = useRef(0);
  const scope = useRef(account); scope.current = account;
  const request = useCallback(async (action: AppSettingsAction = 'readAppSettings', input: Record<string, unknown> = {}, confirmation = '') => {
    if (!account || isLocked) return null;
    const current = ++version.current;
    setBusy(true); setError(''); setMessage('');
    try {
      const value = await requestAndroidAppSettings(action, account, input);
      if (current !== version.current || scope.current !== account) return null;
      setData(value); setMessage(confirmation); return value;
    } catch (cause) {
      if (current === version.current && scope.current === account) setError(cause instanceof Error ? cause.message : 'Could not update settings. Try again.');
      return null;
    } finally { if (current === version.current) { setBusy(false); setLoading(false); } }
  }, [account, isLocked]);
  useEffect(() => {
    setData(null); setLoading(true); void request();
    const refresh = () => { if (document.visibilityState === 'visible') void request(); };
    window.addEventListener('focus', refresh);
    return () => { version.current++; window.removeEventListener('focus', refresh); };
  }, [request]);
  const system = async (action: string, input: Record<string, unknown> = {}) => {
    setError('');
    try { await androidOfflineRequest(action, input); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Android settings could not open.'); }
  };
  return { data: !isLocked && data?.accountId === account ? data : null, busy, loading, error, message, request, system };
}
type NativeSettings = ReturnType<typeof useNativeSettings>;

function Status({ settings, children }: { settings: NativeSettings; children?: ReactNode }) {
  return <div className="space-y-3" data-native-settings>
    {settings.loading && <p role="status" className="text-xs text-muted-foreground">Loading saved settings…</p>}
    {settings.error && <div role="alert" className="space-y-2 text-xs text-destructive"><p>{settings.error}</p><div className="flex gap-2"><button type="button" className={settingsButtonClass} disabled={settings.busy} onClick={() => void settings.request()}>Retry</button>{/Update the Android/.test(settings.error) ? <button type="button" className={settingsButtonClass} onClick={() => void settings.system('checkAppUpdate')}>Check update</button> : <Link href="/timetable" className={settingsButtonClass}>Timetable</Link>}</div></div>}
    {settings.data && children}
    {settings.message && <p role="status" className="text-xs text-muted-foreground">{settings.message}</p>}
  </div>;
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-2" aria-label={title}><h3 className="px-1 text-xs font-medium text-muted-foreground">{title}</h3><SettingsRows>{children}</SettingsRows></section>;
}
function Toggle({ label, value, disabled, onChange }: { label: string; value: boolean; disabled?: boolean; onChange: (enabled: boolean) => void }) {
  const id = `inline-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return <SettingsRow label={label} htmlFor={id}><SettingsToggle id={id} value={value} disabled={disabled} onCheckedChange={onChange} /></SettingsRow>;
}
function MultiChoice({ label, options, value, disabled, onChange }: { label: string; options: SettingsChoice[]; value: string[] | null; disabled?: boolean; onChange: (value: string[] | null) => void }) {
  const summary = value === null ? 'All' : value.length ? `${value.length} selected` : 'None';
  return <SettingsRow label={label}><DropdownMenu modal={false}><DropdownMenuTrigger asChild><button type="button" disabled={disabled} className={settingsButtonClass} aria-label={`${label}: ${summary}`}>{summary}<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="max-h-72 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto">
      <DropdownMenuItem onSelect={() => onChange(null)}>All</DropdownMenuItem><DropdownMenuItem onSelect={() => onChange([])}>None</DropdownMenuItem><DropdownMenuSeparator />
      {options.map(option => <DropdownMenuCheckboxItem key={option.id} checked={value === null || value.includes(option.id)} onSelect={event => event.preventDefault()} onCheckedChange={enabled => {
        const chosen = value === null ? options.map(item => item.id) : value;
        onChange(enabled ? [...new Set([...chosen, option.id])] : chosen.filter(id => id !== option.id));
      }} className="text-xs">{option.label}</DropdownMenuCheckboxItem>)}
      {!options.length && <div className="px-3 py-2 text-xs text-muted-foreground">No matching choices</div>}
    </DropdownMenuContent></DropdownMenu></SettingsRow>;
}
function Timing({ settings }: { settings: NativeSettings }) {
  const data = settings.data!;
  return <Group title="Device permissions">
    <SettingsRow label="Notifications"><span className="text-xs text-muted-foreground">{data.notificationsAllowed ? 'Allowed' : 'Blocked'}</span>{!data.notificationsAllowed && <button type="button" className={settingsButtonClass} onClick={() => void settings.system('openNotificationSettings')}>Allow</button>}</SettingsRow>
    <SettingsRow label="Accurate timing"><span className="text-xs text-muted-foreground">{data.exactAllowed ? 'Allowed' : 'Approximate'}</span>{!data.exactAllowed && <button type="button" className={settingsButtonClass} onClick={() => void settings.system('openAccurateTimingSettings')}>Allow</button>}</SettingsRow>
  </Group>;
}

export function LiveTrackingSettings({ notificationCard }: { notificationCard?: boolean }) {
  const settings = useNativeSettings(), data = settings.data;
  const change = async (patch: Record<string, unknown>) => {
    const next = await settings.request('saveCardSettings', { settings: patch }, 'Saved');
    if (next) window.dispatchEvent(new Event('trinity-android-notifications-change'));
  };
  return <div className="space-y-3" data-native-settings>{!data && typeof notificationCard === 'boolean' && <SettingsRows><Toggle label="Timetable notification" value={notificationCard} disabled={settings.busy} onChange={enabled => {
    void settings.system('selectTimetable', { notificationCard: enabled }).then(() => window.dispatchEvent(new Event('trinity-android-notifications-change')));
  }} /></SettingsRows>}<Status settings={settings}>{data && <div className="space-y-4">
    <Group title="Notification card">
      <Toggle label="Timetable notification" value={data.card.notificationCard} disabled={settings.busy} onChange={notificationCard => void change({ notificationCard })} />
      {data.timetableAllowed && <><MultiChoice label="Visible timetables" options={data.timetables} value={data.timetables.filter(table => !data.card.hiddenTables.includes(table.id)).map(table => table.id)} disabled={settings.busy} onChange={chosen => void change({ hiddenTables: [...data.card.hiddenTables.filter(id => !data.timetables.some(table => table.id === id)), ...data.timetables.filter(table => chosen !== null && !chosen.includes(table.id)).map(table => table.id)] })} />
        <Toggle label="Lesson progress" value={data.card.progress} disabled={settings.busy} onChange={progress => void change({ progress })} /></>}
    </Group>
    {data.eventsAllowed && <Group title="Calendar events"><Toggle label="All upcoming events" value={data.card.events} disabled={settings.busy} onChange={events => void change({ events })} /><Toggle label="Event reminder alerts" value={data.card.eventReminders} disabled={settings.busy} onChange={eventReminders => void change({ eventReminders })} /></Group>}
    <Timing settings={settings} />
  </div>}</Status></div>;
}

export function InlineLessonReminders() {
  const settings = useNativeSettings(), data = settings.data;
  const [draft, setDraft] = useState<LessonReminderSettings | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const draftVersion = useRef(0);
  const changedFilter = useRef<ReminderFilter | undefined>(undefined);
  const pending = useRef(false);
  useEffect(() => { if (data && !draft) setDraft(data.reminders); }, [data, draft]);
  const change = (patch: Partial<LessonReminderSettings>, filter?: ReminderFilter) => { draftVersion.current++; changedFilter.current = filter; pending.current = true; setPreviewing(true); setDraft(current => current ? { ...current, ...patch } : current); };
  useEffect(() => {
    if (!draft || !pending.current) return;
    const version = draftVersion.current;
    const timer = setTimeout(() => { pending.current = false; void settings.request('previewLessonReminders', { reminderDraft: draft, changedFilter: changedFilter.current }).then(value => { if (draftVersion.current !== version) return; if (value) setDraft(value.reminders); setPreviewing(false); }); }, 250);
    return () => clearTimeout(timer);
  }, [draft, settings.request]);
  const save = async () => { if (!draft) return; pending.current = false; await settings.request('saveLessonReminders', { settings: draft }, 'Reminder settings saved'); };
  const filters: [ReminderFilter, keyof Pick<LessonReminderSettings, 'tables' | 'classes' | 'subjects' | 'teachers' | 'periods'>, string][] = [['timetables','tables','Timetables'],['classes','classes','Classes'],['subjects','subjects','Subjects'],['teachers','teachers','Teachers'],['periods','periods','Lesson periods']];
  const minuteOptions = [0,1,2,3,5,10,15,20,30,45,60];
  return <Status settings={settings}>{data && draft && (data.timetableAllowed ? <div className="space-y-4">
    <Group title="Reminders"><Toggle label="Lesson reminders" value={draft.enabled} onChange={enabled => change({ enabled })} />
      <SettingsRow label="School time zone"><span className="text-xs text-muted-foreground">{data.timeZone}</span></SettingsRow>
    </Group>
    <Group title="When to remind"><Toggle label="At lesson start" value={draft.starts} onChange={starts => change({ starts })} /><Toggle label="At lesson end" value={draft.ends} onChange={ends => change({ ends })} />
      {(['beforeStart','beforeEnd'] as const).map(key => <SettingsRow key={key} label={key === 'beforeStart' ? 'Before lesson start' : 'Before lesson end'} htmlFor={`reminder-${key}`}><SettingsSelect id={`reminder-${key}`} value={draft[key]} onChange={event => change({ [key]: Number(event.target.value) })}>{[...new Set([...minuteOptions,draft[key]])].sort((a,b)=>a-b).map(minutes => <option key={minutes} value={minutes}>{minutes ? `${minutes} min before` : 'Off'}</option>)}</SettingsSelect></SettingsRow>)}
      <Toggle label="Scheduled activities" value={draft.activities} onChange={activities => change({ activities })} /><Toggle label="Breaks and lunch" value={draft.breaks} onChange={breaks => change({ breaks })} />
    </Group>
    <Group title="Which lessons">{filters.map(([filter,key,label]) => <MultiChoice key={key} label={label} options={data.reminderChoices[filter]} value={draft[key]} onChange={value => change({ [key]: value }, filter)} />)}</Group>
    <Group title="Days and quiet hours"><MultiChoice label="Reminder days" options={['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((label,index)=>({id:String(index),label}))} value={Array.from({length:7},(_,index)=>index).filter(index=>draft.days & (1<<index)).map(String)} onChange={days => change({ days: days === null ? 127 : days.reduce((mask,day)=>mask | 1<<Number(day),0) })} />
      <Toggle label="Quiet hours" value={draft.quiet} onChange={quiet => change({ quiet })} />
      {draft.quiet && (['quietStart','quietEnd'] as const).map(key => <SettingsRow key={key} label={key === 'quietStart' ? 'Quiet from' : 'Quiet until'} htmlFor={`reminder-${key}`}><input id={`reminder-${key}`} type="time" value={draft[key]} onChange={event => { if(event.target.value) change({[key]:event.target.value}); }} className="h-10 max-w-36 rounded-full border border-input bg-background px-3 text-base sm:h-8 sm:text-sm" /></SettingsRow>)}
    </Group>
    <Group title="Alert style"><SettingsRow label="Sound and vibration" htmlFor="reminder-alert"><SettingsSelect id="reminder-alert" value={draft.alert} onChange={event=>change({alert:event.target.value as LessonReminderSettings['alert']})}><option value="sound">Sound & vibration</option><option value="vibrate">Vibration only</option><option value="silent">Silent</option></SettingsSelect></SettingsRow>
      <SettingsRow label="Snooze" htmlFor="reminder-snooze"><SettingsSelect id="reminder-snooze" value={draft.snooze} onChange={event=>change({snooze:Number(event.target.value)})}>{[...new Set([1,5,10,15,30,draft.snooze])].sort((a,b)=>a-b).map(value=><option key={value} value={value}>{value} min</option>)}</SettingsSelect></SettingsRow>
      <SettingsRow label="Android notification tone"><button type="button" className={settingsButtonClass} onClick={()=>void settings.system('openLessonNotificationChannel',{alert:draft.alert})}>Choose tone</button></SettingsRow>
    </Group>
    <Timing settings={settings} />
    <Group title="Upcoming reminders">{data.upcoming.length ? data.upcoming.map(event=><SettingsRow key={event.at} label={event.label} hint={new Intl.DateTimeFormat(undefined,{timeZone:data.timeZone,weekday:'short',hour:'numeric',minute:'2-digit'}).format(event.at)} />) : <SettingsRow label={draft.enabled ? 'No matching reminders this week' : 'Reminders are off'} />}</Group>
    <div className="flex items-center justify-end gap-2"><button type="button" className={settingsButtonClass} disabled={settings.busy || previewing} onClick={()=>void settings.request('testLessonReminders',{settings:draft},'Test notification sent')}>Send test</button><button type="button" className={settingsButtonClass} disabled={settings.busy || previewing} onClick={()=>void save()}>Save reminders</button></div>
  </div> : <p className="text-xs text-muted-foreground">Your account does not have timetable access.</p>)}</Status>;
}

export function InlineWidgetSettings() {
  const settings = useNativeSettings(), data = settings.data;
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<SurfaceSettings | null>(null);
  const [classId, setClassId] = useState('all');
  useEffect(() => {
    if (!data) return;
    const widget = data.widgets.find(widget=>widget.id===selected) || data.widgets[0];
    if (widget && (widget.id !== selected || !draft)) { setSelected(widget.id); setDraft(widget); }
    if (!widget) { setSelected(null); setDraft(null); }
  }, [data, selected, draft]);
  const change = (patch: Partial<SurfaceSettings>) => setDraft(value=>value ? {...value,...patch} : value);
  const classes = [...new Map((data?.subjects || []).map(subject=>[subject.classId!,subject.classLabel!])).entries()];
  const subjects = (data?.subjects || []).filter(subject=>classId==='all'||subject.classId===classId);
  const cards: SettingsChoice[] = !data || !draft ? [] : [
    ...(data.eventsAllowed ? data.eventCards.filter(event=>Date.now()>=(event.spotlight||0)) : []),
    ...(!draft.tracking || draft.trackingWithTables ? data.timetables.filter(table=>!draft.hiddenTables.includes(table.id)).map(table=>({...table,id:`timetable:${table.id}`})) : []),
    ...(draft.tracking ? data.subjects.filter(subject=>draft.trackedSubjects.includes(subject.id)).map(subject=>({...subject,id:`subject:${subject.id}`})) : []),
    ...(data.eventsAllowed && draft.events ? data.eventCards.filter(event=>Date.now()<(event.spotlight||0)) : []),
  ];
  const ordered = [...new Set([...(draft?.rowOrder || []).filter(id=>cards.some(card=>card.id===id)),...cards.map(card=>card.id)])];
  const save = async () => { if (!draft) return; const result = await settings.request('saveWidgetSettings',{widgetId:draft.id,settings:{progress:draft.progress,events:draft.events,...(data?.timetableAllowed ? {hiddenTables:draft.hiddenTables,tracking:draft.tracking,trackedSubjects:draft.trackedSubjects,trackingWithTables:draft.trackingWithTables} : {}),rowOrder:draft.rowOrder}},'Widget settings saved'); if(result)setDraft(result.widgets.find(widget=>widget.id===draft.id)||null); };
  return <Status settings={settings}>{data && <fieldset disabled={settings.busy} className="space-y-4">
    <Group title="Home screen widgets"><SettingsRow label="Installed widgets"><span className="text-xs text-muted-foreground">{data.widgets.length}</span></SettingsRow>
      {draft && <SettingsRow label="Widget" htmlFor="settings-widget"><SettingsSelect id="settings-widget" value={selected ?? ''} onChange={event=>{const widget=data.widgets.find(widget=>widget.id===Number(event.target.value));if(widget){setSelected(widget.id);setDraft(widget);setClassId('all');}}}>{data.widgets.map(widget=><option key={widget.id} value={widget.id}>{widget.label}</option>)}</SettingsSelect></SettingsRow>}
    </Group>
    {!draft && <p className="px-1 text-xs text-muted-foreground">Add a school widget from your home screen to see its settings here.</p>}
    {draft && <>
      <Group title="Display">{data.timetableAllowed && <><SettingsRow label="Show" htmlFor="widget-mode"><SettingsSelect id="widget-mode" value={draft.tracking?'subjects':'timetables'} onChange={event=>change({tracking:event.target.value==='subjects'})}><option value="timetables">Timetables</option><option value="subjects">Subjects</option></SettingsSelect></SettingsRow>
        <Toggle label="Lesson progress" value={draft.progress} onChange={progress=>change({progress})} />
        {draft.tracking && <Toggle label="Include timetable cards" value={draft.trackingWithTables} onChange={trackingWithTables=>change({trackingWithTables})} />}
        {(!draft.tracking||draft.trackingWithTables) && <MultiChoice label="Widget timetables" options={data.timetables} value={data.timetables.filter(table=>!draft.hiddenTables.includes(table.id)).map(table=>table.id)} onChange={chosen=>change({hiddenTables:[...draft.hiddenTables.filter(id=>!data.timetables.some(table=>table.id===id)),...data.timetables.filter(table=>chosen!==null&&!chosen.includes(table.id)).map(table=>table.id)]})} />}
      </>}{data.eventsAllowed && <Toggle label="All upcoming events" value={draft.events} onChange={events=>change({events})} />}</Group>
      {draft.tracking && data.timetableAllowed && <Group title="Tracked subjects"><SettingsRow label="Class" htmlFor="widget-class"><SettingsSelect id="widget-class" value={classId} onChange={event=>setClassId(event.target.value)}><option value="all">All classes</option>{classes.map(([id,name])=><option key={id} value={id}>{name}</option>)}</SettingsSelect></SettingsRow>
        <MultiChoice label="Subjects to track" options={subjects} value={draft.trackedSubjects.filter(id=>subjects.some(subject=>subject.id===id))} onChange={chosen=>change({trackedSubjects:[...draft.trackedSubjects.filter(id=>!subjects.some(subject=>subject.id===id)),...(chosen===null ? subjects.map(subject=>subject.id) : chosen)]})} />
      </Group>}
      <Group title="Card order">{ordered.length ? ordered.map((id,index)=><SettingsRow key={id} label={cards.find(card=>card.id===id)!.label} htmlFor={`widget-order-${index}`}><SettingsSelect id={`widget-order-${index}`} value={index} aria-label={`Position of ${cards.find(card=>card.id===id)!.label}`} onChange={event=>{const next=[...ordered];next.splice(index,1);next.splice(Number(event.target.value),0,id);change({rowOrder:rememberWidgetOrder(draft.rowOrder,next)});}}>{ordered.map((_,position)=><option key={position} value={position}>{position+1}</option>)}</SettingsSelect></SettingsRow>) : <SettingsRow label="No cards selected" />}</Group>
      {draft.tracking && !draft.trackedSubjects.length && <p role="status" className="text-xs text-muted-foreground">Choose at least one subject.</p>}
      <div className="flex justify-end"><button type="button" className={settingsButtonClass} disabled={settings.busy || draft.tracking&&!draft.trackedSubjects.length} onClick={()=>void save()}>Save widget</button></div>
    </>}
  </fieldset>}</Status>;
}
