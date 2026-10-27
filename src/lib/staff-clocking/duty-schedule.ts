import type { ResolvedStaffClockingSchedule, StaffClockingDutyAssignment } from './contracts';
import { isIsoLocalDate, localTimeToSeconds } from './dates';

/** Duty timelines store both local dates and ISO instants; compare them in school time. */
export function dutyLocalDate(value: unknown): string | undefined {
  if (typeof value === 'string' && isIsoLocalDate(value)) return value;
  const converted = value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate() : value;
  if (typeof converted === 'string' && (!isIsoLocalDate(converted.slice(0,10)) || !/(Z|[+-]\d{2}:\d{2})$/.test(converted))) return undefined;
  const date = converted instanceof Date ? converted : typeof converted === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(converted) ? new Date(converted) : undefined;
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : undefined;
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Rota forms accept either time independently; empty strings explicitly clear an override. */
export function dutyClockingTimeError(arrival?: string, departure?: string): string | undefined {
  if (arrival && !timePattern.test(arrival) || departure && !timePattern.test(departure)) return 'Use a valid 24-hour duty time.';
  if (arrival && departure && arrival >= departure) return 'Duty departure must be later than duty arrival.';
}

export function applyStaffClockingDuty(schedule: ResolvedStaffClockingSchedule, staffId: string, duties: StaffClockingDutyAssignment[]): ResolvedStaffClockingSchedule {
  // A weekly rota changes timing, not the working calendar or an approved closure.
  if (schedule.kind !== 'scheduled') return schedule;
  const active = duties.filter(duty => duty.staffId === staffId && isIsoLocalDate(duty.startsOn) && isIsoLocalDate(duty.endsOn) && duty.startsOn <= schedule.localDate && duty.endsOn >= schedule.localDate && (duty.clockInBy || duty.clockOutBy));
  if (!active.length) return schedule;
  if (active.some(duty => dutyClockingTimeError(duty.clockInBy, duty.clockOutBy))) return { kind: 'conflict', localDate: schedule.localDate, reason: 'An assigned duty rota has invalid clocking times. Ask the duty manager to correct it.' };
  // Multiple concurrent duties use the earliest required arrival and latest departure.
  const arrivals = active.flatMap(duty => duty.clockInBy ? [duty.clockInBy] : []).sort();
  const departures = active.flatMap(duty => duty.clockOutBy ? [duty.clockOutBy] : []).sort();
  const clockInBy = arrivals[0] || schedule.clockInBy, clockOutBy = departures.at(-1) || schedule.clockOutBy;
  if (clockInBy && clockOutBy && localTimeToSeconds(clockInBy) >= localTimeToSeconds(clockOutBy)) return { kind: 'conflict', localDate: schedule.localDate, reason: 'Duty times conflict with the normal work schedule. Ask the duty manager to correct them.' };
  return { ...schedule, clockInBy, clockOutBy, duty: {
    assignments: [...active].sort((a,b) => a.id.localeCompare(b.id)).map(({ id, rotaId, dutyName, startsOn, endsOn }) => ({ id, rotaId, dutyName, startsOn, endsOn })),
    normalClockInBy: schedule.clockInBy, normalClockOutBy: schedule.clockOutBy, clockInBy, clockOutBy,
  } };
}
