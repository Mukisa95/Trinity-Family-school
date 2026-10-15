"use client";

import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import type { EventDropArg, EventInput } from '@fullcalendar/core';
import { addDays, format, isValid, parseISO } from 'date-fns';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Filter, Loader2, PanelRightClose, PanelRightOpen, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from '@/components/common/glass-page-top-bar';
import { CatalogueDataNotice } from '@/components/common/catalogue-data-notice';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, useExamsAsEvents, useAcademicYearsForEvents, useCurrentTerm } from '@/lib/hooks/use-events-fixed';
import { useUgandaHolidays } from '@/lib/hooks/use-uganda-holidays';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSubjects } from '@/lib/hooks/use-subjects';
import { useAuth } from '@/lib/contexts/auth-context';
import { useAndroidOfflineStatus } from '@/lib/hooks/use-android-offline-status';
import { hasAndroidOfflineBridge, androidOfflineRequest } from '@/lib/offline/android-bridge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { activeCalendarFilterCount, calendarCustomColours, calendarDateLabel, calendarMovePatch, calendarTone, eventOccursOn, filterCalendarEvents, findCalendarConflicts, fullCalendarDates, isGeneratedCalendarEvent, isPersonalCalendarEvent, mergeCalendarEvents } from '@/lib/utils/calendar-planning';
import { getComputedEventStatus } from '@/lib/utils/event-status-utils';
import type { CalendarConflict } from '@/lib/utils/calendar-planning';
import type { CalendarViewType, CreateEventData, Event, EventFilters, UpdateEventData } from '@/types';
import { PlanningFilters } from '../ui/planning-filters';
import { EventPlanningDetails, PlanningEventButton, UpcomingPanel } from '../ui/planning-panel';
import { TermPlanner } from './term-planner';
import './planning-calendar.css';

const EventForm = lazy(() => import('../forms/event-form').then(module => ({ default: module.EventForm })));
const views = ['month', 'week', 'day', 'agenda', 'term'] as const;
type PlanningView = typeof views[number];
const calendarViews = { month: 'dayGridMonth', week: 'timeGridWeek', day: 'timeGridDay', agenda: 'listWeek' };
type Confirmation = { title: string; description: string; conflicts?: CalendarConflict[]; apply: () => Promise<void>; cancel?: () => void };

interface CalendarWrapperProps {
  className?: string; defaultView?: CalendarViewType; showFilters?: boolean; showLegend?: boolean; height?: string | number;
}

export function CalendarWrapper({ className = '', defaultView = 'month', showFilters = true, showLegend = true, height = 'auto' }: CalendarWrapperProps) {
  const auth = useAuth();
  const { user } = auth;
  const offline = useAndroidOfflineStatus();
  // The hook remains the one revision-scoped owner. Filters are applied only
  // after combining its authoritative data with exams and public holidays.
  const eventsQuery = useEvents();
  const examsQuery = useExamsAsEvents();
  const createMutation = useCreateEvent();
  const updateMutation = useUpdateEvent();
  const deleteMutation = useDeleteEvent();
  const { data: years = [] } = useAcademicYearsForEvents();
  const currentTerm = useCurrentTerm(years);
  const { data: classes = [] } = useClasses();
  const { data: subjects = [] } = useSubjects();
  const [currentDate, setCurrentDate] = useState(new Date());
  const holidays = useUgandaHolidays(currentDate);
  const [currentView, setCurrentView] = useState<PlanningView>(defaultView);
  const [title, setTitle] = useState(format(new Date(), 'MMMM yyyy'));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [wideScreen, setWideScreen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [filters, setFilters] = useState<EventFilters>({});
  const [personal, setPersonal] = useState(user?.role === 'Staff');
  const [selectedId, setSelectedId] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [formEvent, setFormEvent] = useState<Event | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const completedCreates = useRef(new Set<string>());
  const calendarRef = useRef<FullCalendar>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const calendarHost = useRef<HTMLDivElement>(null);
  const [today, setToday] = useState(format(new Date(), 'yyyy-MM-dd'));

  const allowed = (action: string) => !offline && (auth.canPerformAction ? auth.canPerformAction('events', 'calendar', action) : user?.role === 'Admin');
  const canCreate = allowed('create_event');
  const canEdit = (event: Event) => allowed('edit_event') && !isGeneratedCalendarEvent(event);
  const canDelete = (event: Event) => allowed('delete_event') && !isGeneratedCalendarEvent(event);
  const canOverrideConflicts = user?.role === 'Admin' && allowed('edit_event');
  const allSources = useMemo(() => mergeCalendarEvents(eventsQuery.data || [], examsQuery.data || [], holidays.data || []).map(event => ({
    ...event,
    createdByName: event.createdByName || (event.createdBy === user?.id ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username : ''),
    classNames: event.classIds?.length ? event.classIds.map(id => classes.find(item => item.id === id)?.name || event.classNames?.[event.classIds!.indexOf(id)] || id) : event.classNames,
    subjectNames: event.subjectIds?.map(id => subjects.find(item => item.id === id)?.name || id),
  })), [eventsQuery.data, examsQuery.data, holidays.data, classes, subjects, user]);
  const allEvents = useMemo(() => filterCalendarEvents(allSources, filters, years).filter(event => !personal || !!user && isPersonalCalendarEvent(event, user, classes)), [allSources, filters, years, personal, user, classes]);
  const selected = allSources.find(event => event.id === selectedId);
  const nextWeek = format(addDays(parseISO(today), 7), 'yyyy-MM-dd');
  const upcoming = allEvents.filter(event => !['Cancelled', 'Draft'].includes(event.status) && (event.endDate || event.startDate) >= today && event.startDate <= nextWeek);
  const filterCount = activeCalendarFilterCount(filters);
  const loadingEvents = eventsQuery.data === undefined && !eventsQuery.error;

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1536px)');
    const update = () => setWideScreen(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    setFilters({}); setSelectedId(''); setSelectedDay(''); setFormOpen(false); setFormEvent(null); setPersonal(user?.role === 'Staff');
  }, [user?.id, user?.role]);
  useEffect(() => {
    const refresh = () => setToday(format(new Date(), 'yyyy-MM-dd'));
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    if (yearId || !years.length) return;
    const year = currentTerm?.year || years.find(item => item.isActive) || years[0];
    setYearId(year.id); setTermId(currentTerm?.term.id || year.terms[0]?.id || '');
  }, [years, currentTerm, yearId]);
  useEffect(() => {
    if (currentView !== 'term') calendarRef.current?.getApi().changeView(calendarViews[currentView]);
  }, [currentView]);
  useEffect(() => {
    const host = calendarHost.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const resize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => calendarRef.current?.getApi().updateSize?.()); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [currentView, filtersOpen, panelOpen]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target instanceof HTMLElement && (event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')))) {
        event.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, []);

  const selectEvent = (event: Event) => {
    setSelectedId(event.id); setSelectedDay(''); setPanelOpen(true);
    requestAnimationFrame(() => {
      const panel = document.getElementById('calendar-event-details');
      panel?.focus({ preventScroll: true });
      if (window.innerWidth < 1280) panel?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  };
  const selectDay = (date: string) => { setSelectedId(''); setSelectedDay(date); setPanelOpen(true); };
  const newEvent = (startDate = selectedDay || today, endDate = startDate, time?: { startTime: string; endTime: string }) => {
    if (!canCreate) return;
    completedCreates.current.clear();
    setFormEvent({ id: '', title: '', type: 'Academic', priority: 'Medium', status: 'Scheduled', startDate, endDate,
      isAllDay: !time, ...time, targetAudience: [], recurrence: { frequency: 'None' }, isExamEvent: false, isRecurringInstance: false,
      reminders: [], notificationsSent: [], sendReminders: true, colorCode: '#3b82f6', requiresApproval: false,
      requiresAttendance: false, isPublic: true, createdBy: user?.id || '', createdAt: new Date().toISOString() });
    setFormOpen(true);
  };
  const requestConfirmation = (value: Confirmation) => { setConfirmError(''); setConfirmation(value); };
  const cancelConfirmation = () => { if (!confirmBusy) { confirmation?.cancel?.(); setConfirmation(null); setConfirmError(''); } };
  const confirm = async () => {
    if (!confirmation || confirmBusy) return;
    setConfirmBusy(true); setConfirmError('');
    try { await confirmation.apply(); setConfirmation(null); }
    catch (error) { setConfirmError(error instanceof Error ? error.message : 'Changes could not be saved. Try again.'); }
    finally { setConfirmBusy(false); }
  };
  const save = async (value: CreateEventData | UpdateEventData | CreateEventData[]) => {
    if (!canCreate && !formEvent?.id || formEvent?.id && !canEdit(formEvent)) throw new Error('You do not have permission to save this event.');
    const items = Array.isArray(value) ? value : [value];
    const createData = (item: UpdateEventData) => ({ ...item, createdBy: user?.id || '', requiresAttendance: item.requiresAttendance ?? false, sendReminders: item.sendReminders ?? true }) as CreateEventData;
    const candidates = items.filter(item => formEvent?.id || !completedCreates.current.has(JSON.stringify(createData(item))))
      .map(item => ({ ...formEvent, ...item, id: formEvent?.id || '' }));
    const conflicts = candidates.flatMap(item => findCalendarConflicts(item, allSources));
    const write = async () => {
      if (formEvent?.id) {
        if (Array.isArray(value)) throw new Error('Edit one event at a time. Use Duplicate to create additional dates.');
        const { id: _id, createdAt: _createdAt, createdBy: _createdBy, createdByName: _createdByName, notificationsSent: _notificationsSent, ...data } = value as Partial<Event>;
        await updateMutation.mutateAsync({ eventId: formEvent.id, data });
      } else {
        for (const item of items) {
          const data = createData(item);
          const key = JSON.stringify(data);
          if (completedCreates.current.has(key)) continue;
          await createMutation.mutateAsync(data); completedCreates.current.add(key);
        }
      }
      setFormOpen(false); setFormEvent(null);
    };
    if (conflicts.length) {
      if (!canOverrideConflicts) throw new Error(`Resolve the scheduling conflict with ${conflicts[0].title}, or ask an administrator to review it.`);
      await new Promise<void>((resolve, reject) => requestConfirmation({ title: 'Review scheduling conflicts', description: 'These activities overlap in the currently loaded school schedule. Review the shared resources before saving.', conflicts,
        apply: async () => { await write(); resolve(); }, cancel: () => reject(new Error('Save cancelled. Your changes are still here.')) }));
    } else await write();
  };
  const moveEvent = (change: Pick<EventDropArg, 'event' | 'revert'>) => {
    const event = allSources.find(item => item.id === change.event.id);
    const start = change.event.start, end = change.event.end, allDay = change.event.allDay;
    change.revert();
    if (!event || !start || !canEdit(event)) return;
    const data = calendarMovePatch(start, end, allDay);
    const conflicts = findCalendarConflicts({ ...event, ...data }, allSources);
    if (conflicts.length && !canOverrideConflicts) { toast({ title: 'Scheduling conflict', description: `Resolve the conflict with ${conflicts[0].title} before rescheduling.`, variant: 'destructive' }); return; }
    requestConfirmation({ title: 'Reschedule event?', description: `${event.title}: ${calendarDateLabel(event.startDate)} to ${calendarDateLabel(data.startDate!)}${data.endDate !== data.startDate ? ` – ${calendarDateLabel(data.endDate!)}` : ''}.`, conflicts,
      apply: async () => { if (!canEdit(event)) throw new Error('You no longer have permission to edit this event.'); await updateMutation.mutateAsync({ eventId: event.id, data }); } });
  };
  const updateStatus = (event: Event, status: Event['status']) => requestConfirmation({ title: status === 'Cancelled' ? 'Cancel event?' : 'Publish event?', description: `${event.title} will be marked ${status.toLowerCase()}.`,
    apply: async () => { if (!canEdit(event)) throw new Error('You do not have permission to edit this event.'); await updateMutation.mutateAsync({ eventId: event.id, data: { status } }); } });
  const calendarEvents: EventInput[] = useMemo(() => allEvents.filter(event => isValid(parseISO(event.startDate))).map(event => ({
    id: event.id, title: event.title, ...fullCalendarDates(event), ...calendarCustomColours(event), interactive: true,
    editable: canEdit(event), classNames: [`calendar-tone-${calendarTone(event)}`, `calendar-status-${getComputedEventStatus(event).toLowerCase()}`, event.id === selectedId ? 'calendar-event-selected' : ''],
    extendedProps: { schoolEvent: event, calendarStatus: getComputedEventStatus(event) },
  })), [allEvents, offline, selectedId, user, auth.canPerformAction]);
  const navigate = (direction: 'prev' | 'next' | 'today') => {
    const api = calendarRef.current?.getApi();
    if (api) api[direction]();
  };
  const filtersContent = <PlanningFilters key={`${user?.id}:${user?.role}`} filters={filters} onChange={setFilters} years={years} classes={classes} subjects={subjects} accountId={`${user?.id || ''}:${user?.role || ''}`} />;
  const failedColdRead = !!eventsQuery.error && eventsQuery.data === undefined;

  if (!user) return <p className="p-6 text-sm text-muted-foreground">Please log in to view the calendar.</p>;
  return <div className={cn('school-calendar min-w-0', className)}>
    {offline && eventsQuery.data === undefined && <p role="status" className="p-4 text-muted-foreground">Connect once to download your calendar events for offline viewing.</p>}
    <GlassPageTopBar title="Events & Calendar" backHref="/dashboard" backLabel="Dashboard"
      meta={<div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border bg-card px-2.5 py-1"><strong>{loadingEvents ? '…' : upcoming.length}</strong> next 7 days</span><span className="rounded-full border bg-card px-2.5 py-1"><strong>{loadingEvents ? '…' : upcoming.filter(event => event.isExamEvent).length}</strong> exams</span><span className="rounded-full border bg-card px-2.5 py-1"><strong>{loadingEvents ? '…' : upcoming.filter(event => event.type === 'Holiday').length}</strong> holidays</span></div>}
      actions={<GlassActionDock className="!w-auto gap-1 px-2">
        {hasAndroidOfflineBridge() && <GlassActionButton label="Widgets & reminders" icon={<CalendarDays className="h-4 w-4" />} onClick={() => void androidOfflineRequest('openTimetableSettings').catch(error => toast({ title: 'Widgets & reminders', description: error instanceof Error ? error.message : 'Reopen the app to change reminders.' }))} />}
        {showFilters && <Button type="button" variant="outline" aria-label={`Filters (${filterCount} active)`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)} className="min-h-11 gap-2"><Filter className="h-4 w-4" />Filters{filterCount > 0 && <span className="rounded-full bg-muted px-1.5 text-xs">{filterCount}</span>}</Button>}
        <Button type="button" variant="outline" aria-pressed={panelOpen} aria-label={panelOpen ? 'Hide planning panel' : 'Show planning panel'} onClick={() => setPanelOpen(value => !value)} className="min-h-11 gap-2">{panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}<span className="hidden sm:inline">Planning</span></Button>
        {canCreate && <Button type="button" onClick={() => newEvent()} className="min-h-11 gap-2 bg-brand-surface-600 text-white hover:bg-brand-surface-700"><Plus className="h-4 w-4" />New Event</Button>}
      </GlassActionDock>} />
    <div className="space-y-4 px-3 pb-10 sm:px-5 lg:px-6">
      <CatalogueDataNotice label="calendar events" hasData={eventsQuery.data !== undefined} refreshing={eventsQuery.isFetching} error={eventsQuery.error} retry={() => eventsQuery.refetch()} />
      {examsQuery.error && <CatalogueDataNotice label="exam dates" hasData={examsQuery.data !== undefined} refreshing={examsQuery.isFetching} error={examsQuery.error} retry={() => examsQuery.refetch()} />}
      {failedColdRead ? <section role="alert" className="rounded-2xl border bg-card p-8 text-center"><h2 className="text-lg font-semibold">Unable to Load Events</h2><p className="my-3 text-sm text-muted-foreground">Your school schedule could not be loaded.</p><Button type="button" disabled={eventsQuery.isFetching} onClick={() => void eventsQuery.refetch()}>Try Again</Button></section> : <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input ref={searchRef} aria-label="Search calendar events" placeholder="Search events, classes, organisers..." value={filters.searchTerm || ''} onChange={event => setFilters(current => ({ ...current, searchTerm: event.target.value }))} onKeyDown={event => { if (event.key === 'Escape') setFilters(current => ({ ...current, searchTerm: '' })); }} className="h-10 pl-9 pr-9" />{filters.searchTerm && <button type="button" aria-label="Clear event search" className="absolute right-0 top-0 flex h-10 w-9 items-center justify-center" onClick={() => setFilters(current => ({ ...current, searchTerm: '' }))}><X className="h-4 w-4" /></button>}</div>
        <div role="group" aria-label="Calendar scope" className="flex rounded-lg border bg-card p-1">{[false, true].map(value => <button key={String(value)} type="button" aria-pressed={personal === value} onClick={() => setPersonal(value)} className={cn('min-h-9 rounded-md px-3 text-xs font-medium', personal === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>{value ? 'My calendar' : 'School calendar'}</button>)}</div>
        {currentTerm && <Button type="button" size="sm" variant="outline" onClick={() => setFilters(current => ({ ...current, academicYearIds: [currentTerm.year.id], termIds: [currentTerm.term.id] }))}>This term</Button>}
        {filterCount > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => setFilters({})}>Reset filters ({filterCount})</Button>}
      </div>
      <div className={cn('grid min-w-0 items-start gap-4', panelOpen && 'xl:grid-cols-[minmax(0,1fr)_19rem]', filtersOpen && showFilters && (panelOpen ? '2xl:grid-cols-[15rem_minmax(0,1fr)_19rem]' : '2xl:grid-cols-[15rem_minmax(0,1fr)]'))}>
        {showFilters && filtersOpen && <aside aria-label="Calendar filters" className="hidden min-w-0 rounded-2xl border bg-card shadow-sm 2xl:block">{filtersContent}</aside>}
        <section role="region" ref={calendarHost} className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm" aria-label="School planning calendar">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 sm:p-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {currentView !== 'term' && <><Button type="button" variant="outline" size="icon" aria-label="Previous calendar period" onClick={() => navigate('prev')} className="h-11 w-11 sm:h-10 sm:w-10"><ChevronLeft className="h-4 w-4" /></Button><Button type="button" variant="outline" size="icon" aria-label="Next calendar period" onClick={() => navigate('next')} className="h-11 w-11 sm:h-10 sm:w-10"><ChevronRight className="h-4 w-4" /></Button><Button type="button" variant="outline" size="sm" className="h-10" onClick={() => navigate('today')}>Today</Button></>}
              <h2 aria-live="polite" className="ml-1 text-lg font-semibold tracking-tight">{currentView === 'term' ? 'Term planner' : title}</h2>
            </div>
            <div role="group" aria-label="Calendar view" className="flex max-w-full rounded-lg border bg-muted/40 p-1">{views.map(view => <button key={view} type="button" aria-pressed={currentView === view} onClick={() => setCurrentView(view)} className={cn('min-h-11 rounded-md px-2.5 sm:min-h-9 text-xs font-medium capitalize sm:px-3', currentView === view ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted')}>{view.charAt(0).toUpperCase() + view.slice(1)}</button>)}</div>
          </div>
          {currentView === 'term' ? <TermPlanner years={years} yearId={yearId} termId={termId} onYear={id => { setYearId(id); setTermId(years.find(year => year.id === id)?.terms[0]?.id || ''); }} onTerm={setTermId} events={allEvents} onSelect={selectEvent} /> : <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3 text-xs text-muted-foreground"><label className="flex items-center gap-2">Go to date<Input type="date" aria-label="Go to calendar date" value={format(currentDate, 'yyyy-MM-dd')} onChange={event => { const date = parseISO(event.target.value); if (isValid(date)) calendarRef.current?.getApi().gotoDate(date); }} className="h-9 w-36 text-xs" /></label><span role={loadingEvents ? 'status' : undefined}>{loadingEvents ? 'Loading school activities...' : `${allEvents.length} matching activities`}</span></div>
            <div className="p-1 sm:p-3" onDoubleClick={event => { const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-date]'); if (cell?.dataset.date && !(event.target as HTMLElement).closest('.fc-event')) newEvent(cell.dataset.date); }}>
              <FullCalendar ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]} timeZone="local" headerToolbar={false} initialView={calendarViews[currentView]} initialDate={currentDate} height={height} events={calendarEvents}
                editable={allowed('edit_event')} selectable={canCreate} selectMirror dayMaxEvents={3} moreLinkClick={info => { selectDay(format(info.date, 'yyyy-MM-dd')); return 'popover'; }} weekends fixedWeekCount={false}
                eventClick={info => { const event = allSources.find(item => item.id === info.event.id); if (event) selectEvent(event); }} dateClick={info => selectDay(info.dateStr.slice(0, 10))}
                select={info => {
                  const start = format(info.start, 'yyyy-MM-dd');
                  const end = format(info.allDay ? addDays(info.end, -1) : info.end, 'yyyy-MM-dd');
                  if (info.allDay && start === end) selectDay(start);
                  else newEvent(start, end, info.allDay ? undefined : { startTime: format(info.start, 'HH:mm'), endTime: format(info.end, 'HH:mm') });
                  info.view.calendar.unselect();
                }}
                eventDrop={moveEvent} eventResize={moveEvent} eventLongPressDelay={500} selectLongPressDelay={500} eventDisplay="block" displayEventTime allDaySlot slotMinTime="06:00:00" slotMaxTime="22:00:00" nowIndicator
                eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
                eventContent={info => <div className="planning-event-content" title={`${info.timeText ? info.timeText + ' · ' : ''}${info.event.title} · ${info.event.extendedProps.calendarStatus}`}><span className="planning-event-time">{info.timeText}</span><span className="planning-event-title">{info.event.title}</span>{info.event.extendedProps.calendarStatus === 'Completed' && <Check role="img" aria-label="Completed" className="h-3 w-3 shrink-0" />}{['Cancelled', 'Draft'].includes(info.event.extendedProps.schoolEvent?.status) && <span className="planning-event-status">{info.event.extendedProps.schoolEvent.status}</span>}</div>}
                dayCellClassNames={info => format(info.date, 'yyyy-MM-dd') === selectedDay ? ['planning-selected-day'] : []}
                dayCellDidMount={info => { const date = format(info.date, 'yyyy-MM-dd'); const target = info.el.querySelector<HTMLElement>('.fc-daygrid-day-number'); if (target) { target.tabIndex = 0; target.setAttribute('role', 'button'); target.setAttribute('aria-label', `View schedule for ${calendarDateLabel(date)}`); target.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectDay(date); } }; } }}
                datesSet={info => { const date = info.view.calendar.getDate(); setCurrentDate(previous => previous.getTime() === date.getTime() ? previous : date); setTitle(info.view.title); }} />
            </div>
          </>}
          {showLegend && <div aria-label="Event colour legend" className="flex flex-wrap gap-3 border-t px-4 py-3 text-xs text-muted-foreground">{[['exam', 'Exams'], ['holiday', 'Holidays'], ['academic', 'Academic'], ['meeting', 'Meetings'], ['activity', 'Activities']].map(([tone, label]) => <span key={tone} className="flex items-center gap-1.5"><span aria-hidden="true" className={`planning-legend-dot calendar-tone-${tone}`} />{label}</span>)}</div>}
        </section>
        {panelOpen && <aside aria-label="School planning panel" className="min-w-0 space-y-4">
          {selected && <EventPlanningDetails event={selected} events={allSources} canEdit={canEdit(selected)} canCreate={canCreate} canDelete={canDelete(selected)} canViewAttendance={allowed('view_attendance') && !isGeneratedCalendarEvent(selected)} busy={!!updateMutation.isPending || !!deleteMutation.isPending} onClose={() => setSelectedId('')} onEdit={() => { if (canEdit(selected)) { setFormEvent(selected); setFormOpen(true); } }} onDuplicate={() => { if (!canCreate) return; completedCreates.current.clear(); setFormEvent({ ...selected, id: '', title: `${selected.title} (copy)`, status: 'Draft', isExamEvent: false, linkedExamId: undefined, examIntegration: undefined, createdBy: user.id, createdByName: '', expectedAttendees: [], actualAttendees: [], notificationsSent: [], customFields: {} }); setFormOpen(true); }} onStatus={status => updateStatus(selected, status)} onDelete={() => requestConfirmation({ title: 'Delete event?', description: `${selected.title} will be permanently deleted.`, apply: async () => { if (!canDelete(selected)) throw new Error('You do not have permission to delete this event.'); await deleteMutation.mutateAsync(selected.id); setSelectedId(''); } })} />}
          {selectedDay && <section aria-label="Selected day schedule" className="rounded-2xl border bg-card p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{calendarDateLabel(selectedDay, 'EEE, d MMM')}</h2><Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Close day schedule" onClick={() => setSelectedDay('')}><X className="h-4 w-4" /></Button></div>{allEvents.filter(event => eventOccursOn(event, selectedDay)).map(event => <PlanningEventButton key={event.id} event={event} onSelect={selectEvent} />)}{!allEvents.some(event => eventOccursOn(event, selectedDay)) && <p className="py-4 text-xs text-muted-foreground">No activities match this date.</p>}{canCreate && <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={() => newEvent(selectedDay)}><Plus className="mr-1.5 h-4 w-4" />Add event on this date</Button>}</section>}
          <UpcomingPanel events={allEvents} today={today} nextWeek={nextWeek} onSelect={selectEvent} loading={loadingEvents} onAgenda={() => { setCurrentView('agenda'); requestAnimationFrame(() => calendarRef.current?.getApi().today()); }} />
        </aside>}
      </div>
      </>}
    </div>
    <Sheet open={showFilters && filtersOpen && !wideScreen} onOpenChange={setFiltersOpen}>
      <SheetContent side="left" className="z-[100001] w-[min(90vw,22rem)] overflow-y-auto p-0 2xl:hidden" onOpenAutoFocus={event => { if (window.innerWidth >= 1536) event.preventDefault(); }} onInteractOutside={event => { if (window.innerWidth >= 1536) event.preventDefault(); }}>
        <SheetHeader className="px-4 pb-1 pt-5"><SheetTitle>Calendar filters</SheetTitle><SheetDescription>Combine classes, terms and activity types.</SheetDescription></SheetHeader>{filtersContent}
      </SheetContent>
    </Sheet>
    {formOpen && <Suspense fallback={<p role="status" className="fixed bottom-4 right-4 rounded-xl border bg-card p-4 shadow-lg"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Opening event editor...</p>}><EventForm event={formEvent} isOpen={formOpen} onClose={() => { if (!confirmation) { setFormOpen(false); setFormEvent(null); } }} onSave={save} onReviewSchedule={async candidate => {
      const conflicts = findCalendarConflicts(candidate, allSources);
      if (!conflicts.length) return;
      if (!canOverrideConflicts) throw new Error(`Resolve the scheduling conflict with ${conflicts[0].title} before scheduling this examination.`);
      await new Promise<void>((resolve, reject) => requestConfirmation({ title: 'Review examination conflicts', description: 'Review overlapping school activities before scheduling these exams.', conflicts,
        apply: async () => resolve(), cancel: () => reject(new Error('Scheduling cancelled. Your changes are still here.')) }));
    }} /></Suspense>}
    <AlertDialog open={!!confirmation} onOpenChange={open => { if (!open) cancelConfirmation(); }}>
      <AlertDialogContent className="z-[200001] max-h-[85dvh] overflow-y-auto"><AlertDialogHeader><AlertDialogTitle>{confirmation?.title}</AlertDialogTitle><AlertDialogDescription>{confirmation?.description}</AlertDialogDescription></AlertDialogHeader>
        {!!confirmation?.conflicts?.length && <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">{confirmation.conflicts.map((conflict, index) => <p key={`${conflict.eventId}:${index}`}><strong>{conflict.title}</strong><span className="block text-xs">{conflict.reasons.join(' · ')}</span></p>)}</div>}
        {confirmError && <p role="alert" className="text-sm text-destructive">{confirmError}</p>}
        <AlertDialogFooter><Button type="button" variant="outline" disabled={confirmBusy} onClick={cancelConfirmation}>Continue editing</Button><Button type="button" disabled={confirmBusy} onClick={() => void confirm()}>{confirmBusy ? 'Saving...' : confirmation?.conflicts?.length ? 'Save despite conflicts' : 'Confirm'}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
