import type {
  ResolvedStaffClockingSchedule,
  StaffClockingArrival,
  StaffClockingSchedule,
  StaffClockingScheduleRequest,
} from './contracts';
import { isDateInRange, localTimeToSeconds, weekdayForLocalDate } from './dates';

const SCOPE_WEIGHT: Record<StaffClockingSchedule['scope'], number> = {
  school: 1,
  group: 2,
  staff: 3,
};

function appliesToRequest(schedule: StaffClockingSchedule, request: StaffClockingScheduleRequest): boolean {
  if (!schedule.isActive || !isDateInRange(request.localDate, schedule.startsOn, schedule.endsOn)) return false;
  if (schedule.scope === 'school') return true;
  if (schedule.scope === 'staff') return schedule.subjectId === request.staffId;
  return Boolean(schedule.subjectId && request.groupIds.includes(schedule.subjectId));
}

function appliesOnDate(schedule: StaffClockingSchedule, request: StaffClockingScheduleRequest): boolean {
  if (schedule.kind === 'date_override') return schedule.workDate === request.localDate;
  return schedule.weekdays?.includes(weekdayForLocalDate(request.localDate)) ?? false;
}

function sameShift(left: StaffClockingSchedule, right: StaffClockingSchedule): boolean {
  return left.clockInBy === right.clockInBy && left.graceMinutes === right.graceMinutes;
}

function sortSchedules(left: StaffClockingSchedule, right: StaffClockingSchedule): number {
  const scope = SCOPE_WEIGHT[right.scope] - SCOPE_WEIGHT[left.scope];
  if (scope !== 0) return scope;
  const priority = (right.priority ?? 0) - (left.priority ?? 0);
  if (priority !== 0) return priority;
  return left.id.localeCompare(right.id);
}

function resolutionFromSchedule(schedule: StaffClockingSchedule, localDate: string): ResolvedStaffClockingSchedule {
  return {
    kind: 'scheduled',
    localDate,
    sourceScheduleId: schedule.id,
    sourceScope: schedule.scope,
    clockInBy: schedule.clockInBy,
    graceMinutes: schedule.graceMinutes,
  };
}

function resolveCandidates(candidates: StaffClockingSchedule[], localDate: string): ResolvedStaffClockingSchedule | undefined {
  if (candidates.length === 0) return undefined;
  const ranked = [...candidates].sort(sortSchedules);
  const winner = ranked[0];
  const runnerUp = ranked[1];

  if (
    runnerUp
    && SCOPE_WEIGHT[winner.scope] === SCOPE_WEIGHT[runnerUp.scope]
    && (winner.priority ?? 0) === (runnerUp.priority ?? 0)
    && !sameShift(winner, runnerUp)
  ) {
    return {
      kind: 'conflict',
      localDate,
      reason: `Schedules ${winner.id} and ${runnerUp.id} have the same precedence.`,
    };
  }

  return resolutionFromSchedule(winner, localDate);
}

/**
 * Resolve an employee's work rule for one school-local date.
 *
 * An approved date override has the highest precedence, including over a
 * closure. A closure prevents recurring schedules from automatically creating
 * a working day. Staff overrides then outrank group policies, which outrank
 * the school default.
 */
export function resolveStaffClockingSchedule(request: StaffClockingScheduleRequest): ResolvedStaffClockingSchedule {
  const applicable = request.schedules.filter((schedule) => appliesToRequest(schedule, request));
  const dateOverrides = applicable.filter((schedule) => schedule.kind === 'date_override' && appliesOnDate(schedule, request));
  const dateOverrideResolution = resolveCandidates(dateOverrides, request.localDate);
  if (dateOverrideResolution) return dateOverrideResolution;

  if (request.calendarDay?.isClosed) {
    return {
      kind: 'non_working_day',
      localDate: request.localDate,
      reason: request.calendarDay.label || 'School closure',
    };
  }

  const recurring = applicable.filter((schedule) => schedule.kind === 'recurring' && appliesOnDate(schedule, request));
  return resolveCandidates(recurring, request.localDate) ?? {
    kind: 'non_working_day',
    localDate: request.localDate,
    reason: 'No active schedule applies.',
  };
}

/** Classify a clock-in against an already-resolved authoritative shift. */
export function classifyStaffClockIn(clockInTime: string, schedule: Pick<ResolvedStaffClockingSchedule, 'kind' | 'clockInBy' | 'graceMinutes'>): StaffClockingArrival {
  if (schedule.kind !== 'scheduled' || !schedule.clockInBy || schedule.graceMinutes === undefined) {
    throw new Error('A scheduled shift is required to classify a clock-in.');
  }
  if (!Number.isInteger(schedule.graceMinutes) || schedule.graceMinutes < 0) {
    throw new Error('Grace minutes must be a non-negative integer.');
  }

  const secondsLate = Math.max(0, localTimeToSeconds(clockInTime) - localTimeToSeconds(schedule.clockInBy));
  if (secondsLate === 0) return { status: 'on_time', secondsLate };
  if (secondsLate <= schedule.graceMinutes * 60) return { status: 'grace', secondsLate };
  return { status: 'late', secondsLate };
}
