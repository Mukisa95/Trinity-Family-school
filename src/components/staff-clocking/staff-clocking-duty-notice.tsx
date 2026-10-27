import { CalendarClock } from 'lucide-react';
import type { StaffClockingDutyAdjustment } from '@/lib/staff-clocking/contracts';
import { detailTime } from '@/lib/staff-clocking/details-report';
import { localTimeToSeconds } from '@/lib/staff-clocking/dates';

export function StaffClockingDutyNotice({ duty, historical = false, current = true }: { duty?: StaffClockingDutyAdjustment; historical?: boolean; current?: boolean }) {
  if (!duty?.assignments.length) return null;
  const earlier = duty.clockInBy && duty.normalClockInBy && localTimeToSeconds(duty.clockInBy) < localTimeToSeconds(duty.normalClockInBy);
  return <aside aria-label="Duty clocking schedule" className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-sm dark:border-blue-900/70 dark:bg-blue-950/30"><p className="flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-200"><CalendarClock className="h-4 w-4 shrink-0" />{historical ? 'Recorded duty schedule' : current ? 'On duty this week' : 'Assigned duty schedule'}</p><p className="leading-6">{earlier ? `${historical ? 'Earlier duty arrival' : 'Arrive earlier because you are on duty'}: ${detailTime(duty.clockInBy)}` : `Duty arrival: ${detailTime(duty.clockInBy)}`}{duty.normalClockInBy && duty.clockInBy !== duty.normalClockInBy ? ` (normally ${detailTime(duty.normalClockInBy)})` : ''}.{duty.clockOutBy ? ` Expected departure: ${detailTime(duty.clockOutBy)}${duty.normalClockOutBy && duty.clockOutBy !== duty.normalClockOutBy ? ` (normally ${detailTime(duty.normalClockOutBy)})` : ''}.` : ''}</p><ul className="space-y-1 text-xs text-muted-foreground">{duty.assignments.map(item => <li key={item.id}>{item.dutyName} · {item.startsOn} – {item.endsOn}</li>)}</ul><p className="text-xs text-muted-foreground">These times apply on your scheduled working days within the duty dates. Your normal schedule resumes afterwards.</p></aside>;
}
