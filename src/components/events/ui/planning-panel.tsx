'use client';

import { useState } from 'react';
import { isValid, parseISO } from 'date-fns';
import Link from 'next/link';
import { Bell, CalendarDays, Clock, Copy, Edit, ExternalLink, MapPin, Paperclip, Users, X, AlertTriangle } from 'lucide-react';
import type { Event } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calendarDateLabel, calendarTone, eventOccursOn, eventTimeLabel, examSourceIds, findCalendarConflicts } from '@/lib/utils/calendar-planning';
import { getComputedEventStatus } from '@/lib/utils/event-status-utils';

export function PlanningEventButton({ event, onSelect }: { event: Event; onSelect: (event: Event) => void }) {
  const date = parseISO(event.startDate);
  const holiday = event.type === 'Holiday' || !!event.customFields?.isUgandaPublicHoliday;
  const redDate = holiday || (isValid(date) && date.getDay() === 0);
  return <button type="button" onClick={() => onSelect(event)} className="flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <span aria-hidden="true" className={`planning-event-icon calendar-tone-${calendarTone(event)}`}><CalendarDays className="h-4 w-4" /></span>
    <span className="min-w-0 flex-1"><span className={`block text-[0.8125rem] font-semibold leading-snug${holiday ? ' calendar-event-red-date' : ''}`}>{event.title}</span>
      <span className="mt-1 block text-xs text-muted-foreground"><span className={redDate ? 'calendar-event-red-date' : undefined}>{calendarDateLabel(event.startDate, 'EEE, d MMM')}</span> · {eventTimeLabel(event)}</span>
      {event.location && <span className="mt-1 block truncate text-xs text-muted-foreground">{event.location}</span>}
    </span>
  </button>;
}

export function UpcomingPanel({ events, today, nextWeek, onSelect, onAgenda, loading }: {
  events: Event[]; today: string; nextWeek: string; onSelect: (event: Event) => void; onAgenda: () => void; loading: boolean;
}) {
  const [tab, setTab] = useState<'today' | 'week' | 'attention'>('today');
  const upcoming = events.filter(event => !['Cancelled', 'Draft'].includes(event.status) && (event.endDate || event.startDate) >= today && event.startDate <= nextWeek)
    .sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`));
  const todayEvents = upcoming.filter(event => eventOccursOn(event, today));
  const attention = events.filter(event => event.status === 'Draft' || (event.requiresApproval && (!event.approvalStatus || event.approvalStatus === 'Pending')));
  const clashes = upcoming.flatMap((event, index) => findCalendarConflicts(event, upcoming.slice(index + 1)).map(conflict => ({ event, conflict })));
  const shown = tab === 'today' ? todayEvents : tab === 'week' ? upcoming : attention;
  return <section aria-label="Upcoming and attention" className="rounded-2xl border bg-card p-3 shadow-sm">
    <h2 className="flex items-center gap-2 px-1 text-sm font-semibold"><Bell className="h-4 w-4 text-brand-ink-600 dark:text-brand-ink-400" />Upcoming & Attention</h2>
    <div role="group" aria-label="Upcoming event period" className="my-3 grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1">
      {([['today', 'Today', todayEvents.length], ['week', '7 days', upcoming.length], ['attention', 'Attention', attention.length + clashes.length]] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`min-h-11 rounded-md sm:min-h-10 px-1 text-xs font-medium ${tab === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label} <span className="tabular-nums">{count}</span></button>)}
    </div>
    {loading ? <p role="status" className="px-2 py-4 text-xs text-muted-foreground">Loading school schedule...</p> : <>
      {tab === 'attention' && clashes.slice(0, 4).map(({ event, conflict }) => <button key={`${event.id}:${conflict.eventId}`} type="button" onClick={() => onSelect(event)} className="mb-2 flex w-full gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" /><span><strong>Possible scheduling conflict</strong><span className="mt-1 block">{event.title} / {conflict.title}</span><span className="mt-1 block">{conflict.reasons.join(' · ')}</span></span></button>)}
      {shown.slice(0, 6).map(event => <PlanningEventButton key={event.id} event={event} onSelect={onSelect} />)}
      {!shown.length && !(tab === 'attention' && clashes.length) && <p className="px-2 py-4 text-xs text-muted-foreground">{tab === 'today' ? 'No activities scheduled for today.' : tab === 'week' ? 'No activities in the next seven days.' : 'No drafts, pending approvals or conflicts this week.'}</p>}
      {tab === 'today' && upcoming.some(event => !eventOccursOn(event, today)) && <div className="mt-2 border-t pt-3"><h3 className="px-2 pb-1 text-xs font-semibold text-muted-foreground">Coming up</h3>{upcoming.filter(event => !eventOccursOn(event, today)).slice(0, 3).map(event => <PlanningEventButton key={event.id} event={event} onSelect={onSelect} />)}</div>}
    </>}
    <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={onAgenda}>Open agenda</Button>
  </section>;
}

export function EventPlanningDetails({ event, events, canEdit, canCreate, canDelete, canViewAttendance, onClose, onEdit, onDuplicate, onStatus, onDelete, busy,canApprove,onApproval }: {
  event: Event; events: Event[]; canEdit: boolean; canCreate: boolean; canDelete: boolean; canViewAttendance: boolean;
  onClose: () => void; onEdit: () => void; onDuplicate: () => void; onStatus: (status: Event['status']) => void; onDelete: () => void; busy: boolean;
  canApprove?:boolean;onApproval?:(status:'Approved'|'Rejected')=>void;
}) {
  const conflicts = findCalendarConflicts(event, events);
  const sourceIds = examSourceIds(event);
  const status = getComputedEventStatus(event);
  const safeUrl = (url: string) => /^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url);
  return <section tabIndex={-1} id="calendar-event-details" aria-label="Event details" className="scroll-mt-36 rounded-2xl border bg-card p-4 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event details</h2><Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Close event details" onClick={onClose}><X className="h-4 w-4" /></Button></div>
    <div className="mt-2 flex items-start gap-2"><span aria-hidden="true" className={`planning-event-icon calendar-tone-${calendarTone(event)}`}><CalendarDays className="h-4 w-4" /></span><h3 className="min-w-0 break-words text-base font-semibold leading-snug">{event.title}</h3></div>
    <div className="mt-3 flex flex-wrap gap-1.5"><Badge variant="secondary">{event.isExamEvent ? 'Examination' : event.planning?.kind==='staff'?'Staff event':event.planning?.kind==='parent'?'Parent event':event.type}</Badge><Badge variant="outline">{status}</Badge>{event.requiresApproval && <Badge variant="outline">Approval: {event.approvalStatus || 'Pending'}</Badge>}{event.priority === 'Urgent' && <Badge variant="destructive">Urgent</Badge>}</div>
    <dl className="mt-4 space-y-3 text-[0.8125rem]">
      <div className="flex gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="sr-only">Date</dt><dd>{calendarDateLabel(event.startDate)}{event.endDate && event.endDate !== event.startDate && ` – ${calendarDateLabel(event.endDate)}`}</dd></div></div>
      <div className="flex gap-2"><Clock className="h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="sr-only">Time</dt><dd>{eventTimeLabel(event)}</dd></div></div>
      {event.location && <div className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="sr-only">Venue</dt><dd>{event.location}</dd></div></div>}
      {!!event.classNames?.length && <div className="flex gap-2"><Users className="h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Classes</dt><dd>{event.classNames.join(', ')}</dd></div></div>}
      <div><dt className="text-xs text-muted-foreground">Organiser / created by</dt><dd>{event.customFields?.organiserName || event.createdByName || 'Not recorded'}</dd></div>
      {!!event.targetAudience?.length && <div><dt className="text-xs text-muted-foreground">Audience</dt><dd>{event.targetAudience.join(', ')}</dd></div>}
      <div><dt className="text-xs text-muted-foreground">Visibility</dt><dd>{event.isPublic ? 'Public school event' : 'Restricted school event'}</dd></div>
      {event.expectedAttendees?.length ? <div><dt className="text-xs text-muted-foreground">Participants</dt><dd>{event.actualAttendees?.length || 0} recorded / {event.expectedAttendees.length} expected</dd></div> : null}
    </dl>
    {event.description && <p className="mt-4 whitespace-pre-wrap break-words border-t pt-3 text-[0.8125rem] leading-relaxed text-muted-foreground">{event.description}</p>}
    {conflicts.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><h4 className="font-semibold">Possible conflicts ({conflicts.length})</h4>{conflicts.map(conflict => <p key={conflict.eventId} className="mt-2">{conflict.title}: {conflict.reasons.join(' · ')}</p>)}</div>}
    {!!event.attachments?.length && <div className="mt-4 space-y-2 border-t pt-3"><h4 className="text-xs font-semibold">Attachments</h4>{event.attachments.map(attachment => safeUrl(attachment.url) && <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 break-all text-xs text-link underline"><Paperclip className="h-3.5 w-3.5 shrink-0" />{attachment.name}</a>)}</div>}
    <div className="mt-4 border-t pt-3 text-xs text-muted-foreground"><p>{event.sendReminders ? `${event.planning?.times.length||event.reminders?.filter(reminder => reminder.enabled).length || 0} reminder settings configured` : 'Reminders off'}</p><p className="mt-1">{event.notificationsSent?.length || 0} notification delivery records</p>
      {!!event.notificationsSent?.length && <details className="mt-2"><summary className="cursor-pointer">Delivery history</summary><ul className="mt-2 space-y-2">{event.notificationsSent.map((record, index) => <li key={`${record.sentAt}:${index}`}>{record.deliveryStatus || 'Status not recorded'} · {record.recipients.length} recipients · {calendarDateLabel(record.sentAt)}</li>)}</ul></details>}
    </div>
    {sourceIds.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{sourceIds.map((id, index) => <Button key={id} size="sm" variant="outline" asChild><Link href={`/exams/${encodeURIComponent(id)}/view-results${event.classIds?.length === 1 ? `?classId=${encodeURIComponent(event.classIds[0])}` : ''}`}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open exam{sourceIds.length > 1 ? ` ${index + 1}` : ''}</Link></Button>)}</div>}
    {event.requiresAttendance && canEdit && <Button asChild variant="outline" size="sm" className="mr-2 mt-3"><Link href={`/events/${encodeURIComponent(event.id)}/attendance`}>Record attendance</Link></Button>}
    {event.requiresAttendance && canViewAttendance && <Button asChild variant="outline" size="sm" className="mt-3"><Link href={`/events/${encodeURIComponent(event.id)}/view-attendance`}>View attendance</Link></Button>}
    <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
      {canApprove&&event.requiresApproval&&event.approvalStatus!=='Approved'&&<><Button type="button" size="sm" disabled={busy} onClick={()=>onApproval?.('Approved')}>Approve event</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>onApproval?.('Rejected')}>Reject event</Button></>}
      {canEdit && <Button type="button" size="sm" disabled={busy} onClick={onEdit}><Edit className="mr-1.5 h-3.5 w-3.5" />Edit / reschedule</Button>}
      {canCreate && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onDuplicate}><Copy className="mr-1.5 h-3.5 w-3.5" />Duplicate</Button>}
      {canEdit && event.status === 'Draft' && (!event.requiresApproval || event.approvalStatus === 'Approved') && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onStatus('Scheduled')}>Publish</Button>}
      {canEdit && !['Cancelled', 'Completed'].includes(status) && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onStatus('Cancelled')}>Cancel event</Button>}
      {canDelete && <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={onDelete}>Delete</Button>}
    </div>
  </section>;
}
