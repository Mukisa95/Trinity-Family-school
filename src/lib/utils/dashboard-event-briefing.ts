import { addDays, endOfDay, format, isValid, parseISO, startOfDay, startOfWeek } from 'date-fns';
import type { Event } from '@/types';

export const DASHBOARD_GREETING_MS = 5000;
export const DASHBOARD_BRIEFING_MS = 60_000;

function eventWindow(event: Event): { start: Date; end: Date } | null {
  const startDay = parseISO(event.startDate);
  const endDay = parseISO(event.endDate || event.startDate);
  if (!isValid(startDay) || !isValid(endDay)) return null;
  const start = event.isAllDay ? startOfDay(startDay)
    : parseISO(`${format(startDay, 'yyyy-MM-dd')}T${event.startTime || '00:00'}`);
  const end = event.isAllDay ? endOfDay(endDay)
    : parseISO(`${format(endDay, 'yyyy-MM-dd')}T${event.endTime || '23:59'}:59.999`);
  if (!isValid(start) || !isValid(end) || end < start) return null;
  return { start, end };
}

/** Projection only: inputs already come from the authorised calendar cache. */
export function getDashboardEventBriefing(events: readonly Event[], now: Date) {
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(startOfWeek(now, { weekStartsOn: 1 }), 6));
  const seenIds = new Set<string>();
  const seenExams = new Set<string>();
  const entries = events.flatMap(event => {
    if (seenIds.has(event.id) || !event.title.trim()
      || ['Draft', 'Cancelled', 'Completed'].includes(event.status)
      || event.approvalStatus === 'Rejected'
      || (event.requiresApproval && event.approvalStatus !== 'Approved' && !event.approvedBy)) return [];
    const window = eventWindow(event);
    if (!window || window.end < now || window.start > weekEnd) return [];
    const examId = event.linkedExamId;
    if (examId && seenExams.has(examId)) return [];
    seenIds.add(event.id);
    if (examId) seenExams.add(examId);
    return [{ event, ...window }];
  }).sort((a, b) => a.start.getTime() - b.start.getTime()
    || a.event.title.localeCompare(b.event.title) || a.event.id.localeCompare(b.event.id));

  return {
    weekEnd,
    today: entries.filter(item => item.start <= todayEnd).map(item => item.event),
    laterThisWeek: entries.filter(item => item.start > todayEnd).map(item => item.event),
  };
}

export function getEventEndNotice(event: Event, now: Date): string | null {
  const window = eventWindow(event);
  if (!window || window.end <= endOfDay(now)) return null;
  const pattern = window.end.getFullYear() === now.getFullYear() ? 'EEEE, d MMMM' : 'EEEE, d MMMM yyyy';
  return `It will end on ${format(window.end, pattern)}.`;
}

export function formatBriefingEventDate(event: Event): string {
  const window = eventWindow(event);
  if (!window) return '';
  const start = format(window.start, 'EEE, d MMM');
  const end = format(window.end, 'EEE, d MMM');
  const dates = start === end ? start : `${start} – ${end}`;
  return event.isAllDay ? `${dates} · All day` : `${dates} · ${format(window.start, 'h:mm a')}`;
}
