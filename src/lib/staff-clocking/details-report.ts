import type { StaffClockingDailyRecord } from './contracts';
import type { DetailPeriod, DetailRange, StaffClockingDetailPlan, StaffClockingDetailRow } from './details-contracts';
import { detailStatusLabels } from './details-contracts';
import { isIsoLocalDate, localTimeToSeconds } from './dates';
import { resolveStaffClockingSchedule } from './schedule-resolver';
import { isUgandaPublicHoliday } from '@/lib/utils/uganda-holidays';

export function clockingSchoolDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function detailDates(range: DetailRange): string[] {
  if (!isIsoLocalDate(range.from) || !isIsoLocalDate(range.to) || range.to < range.from) return [];
  const result: string[] = [];
  for (const date = new Date(`${range.from}T12:00:00Z`); date.toISOString().slice(0, 10) <= range.to; date.setUTCDate(date.getUTCDate() + 1)) {
    if (result.length === 366) return [];
    result.push(date.toISOString().slice(0, 10));
  }
  return result;
}
export function detailPeriodRange(period: DetailPeriod, anchor: string, term?: DetailRange, custom?: DetailRange): DetailRange {
  if (period === 'term' && term) return term;
  if (period === 'custom' && custom) return custom;
  if (!isIsoLocalDate(anchor)) return { from: anchor, to: anchor };
  if (period === 'day') return { from: anchor, to: anchor };
  const date = new Date(`${anchor}T12:00:00Z`);
  if (period === 'week') {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const from = date.toISOString().slice(0, 10); date.setUTCDate(date.getUTCDate() + 6);
    return { from, to: date.toISOString().slice(0, 10) };
  }
  return { from: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10), to: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) };
}
export function detailMonths(range: DetailRange): DetailRange[] {
  if (!detailDates(range).length) return [];
  const first = new Date(`${range.from.slice(0, 7)}-01T12:00:00Z`), result: DetailRange[] = [];
  while (first.toISOString().slice(0, 10) <= range.to) {
    result.push(detailPeriodRange('month', first.toISOString().slice(0, 10)));
    first.setUTCMonth(first.getUTCMonth() + 1);
  }
  return result;
}
export function detailTime(value?: string) {
  if (!value) return '—';
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute || 0).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
export function detailElapsed(record?: StaffClockingDailyRecord, now = new Date()) {
  if (!record?.clockInAt) return undefined;
  const start = Date.parse(record.clockInAt), end = record.clockOutAt ? Date.parse(record.clockOutAt) : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  const minutes = Math.floor((end - start) / 60_000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
export function buildStaffDetailRows(range: DetailRange, records: StaffClockingDailyRecord[], plan: StaffClockingDetailPlan, today = clockingSchoolDate()): StaffClockingDetailRow[] {
  const byDate = new Map(records.map(record => [record.localDate, record]));
  return detailDates(range).map(date => {
    const record = byDate.get(date);
    if (record) {
      const snapshot = record.scheduleSnapshot;
      const arrived = !!(record.effectiveClockInTime || record.clockInTime);
      return { date, record, scheduled: arrived || !!record.clockInBy || !!snapshot || record.reviewStatus === 'exempted',
        status: arrived ? record.arrivalStatus || 'unresolved' : record.reviewStatus === 'exempted' ? 'exempt' : 'unresolved',
        expectedIn: snapshot?.clockInBy || record.clockInBy, expectedOut: snapshot?.clockOutBy || record.clockOutBy, graceMinutes: snapshot?.graceMinutes ?? record.graceMinutes, duty: snapshot?.duty,
        dayType: snapshot?.kind === 'date_override' ? 'special' : snapshot ? 'normal' : 'unknown', source: snapshot?.scope || record.scheduleScope,
        recordedGroup: snapshot?.groups.join(', '), warning: snapshot ? undefined : 'Only the timing rules stored on this record are shown. Missing historical fields are not inferred.' };
    }
    if (plan.joinedOn && date < plan.joinedOn) return { date, scheduled: false, status: 'off', dayType: 'off', warning: 'Before recorded employment start.' };
    if (date < today && (date < plan.stableSince || plan.schedules.some(rule => rule.availableFrom > date) || plan.duties?.some(duty => duty.startsOn <= date && duty.endsOn >= date && duty.availableFrom > date))) {
      return { date, scheduled: false, status: 'unresolved', dayType: 'unknown', warning: 'Historical schedule or staff-group membership was not captured for this date.' };
    }
    const closure = plan.closures.find(item => item.from <= date && item.to >= date);
    const holiday = isUgandaPublicHoliday(date);
    const result = resolveStaffClockingSchedule({ staffId: plan.staffId, groupIds: plan.groups, localDate: date, schedules: plan.schedules, duties: plan.duties,
      calendarDay: closure || holiday ? { localDate: date, isClosed: true, label: closure?.title || holiday?.title } : undefined });
    const rule = plan.schedules.find(item => item.id === result.sourceScheduleId);
    return { date, scheduled: result.kind === 'scheduled', status: result.kind === 'conflict' ? 'unresolved' : result.kind !== 'scheduled' ? closure || holiday ? 'holiday' : 'off' : date < today ? 'absent' : 'scheduled',
      dayType: result.kind === 'conflict' ? 'unknown' : rule?.kind === 'date_override' ? 'special' : closure || holiday ? 'holiday' : result.kind === 'scheduled' ? 'normal' : 'off',
      expectedIn: result.clockInBy, expectedOut: result.clockOutBy, graceMinutes: result.graceMinutes, source: result.sourceScope, warning: result.reason, duty: result.duty };
  });
}
export function summarizeStaffDetail(rows: StaffClockingDetailRow[]) {
  const arrived = rows.filter(row => !!(row.record?.effectiveClockInTime || row.record?.clockInTime));
  return { scheduled: rows.filter(row => row.scheduled).length, attended: arrived.length, onTime: arrived.filter(row => row.record?.arrivalStatus === 'on_time').length,
    grace: arrived.filter(row => row.record?.arrivalStatus === 'grace').length, late: arrived.filter(row => row.record?.arrivalStatus === 'late').length,
    exempt: rows.filter(row => row.status === 'exempt').length, absent: rows.filter(row => row.status === 'absent').length,
    unresolved: rows.filter(row => row.status === 'unresolved').length, missingOut: rows.filter(row => row.record?.status === 'missing_clock_out').length };
}
export function departureStatus(row: StaffClockingDetailRow) {
  const out = row.record?.effectiveClockOutTime || row.record?.clockOutTime;
  if (!out) return row.record?.status === 'missing_clock_out' ? 'missing' : 'pending';
  if (!row.expectedOut) return 'unknown';
  return localTimeToSeconds(out) < localTimeToSeconds(row.expectedOut) ? 'early' : 'normal';
}
export function individualCsv(name: string, staffId: string, rows: StaffClockingDetailRow[]) {
  const cell = (value: unknown) => { const text = String(value ?? ''); return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`; };
  return [['Staff', 'Staff ID', 'Date', 'Day type', 'Expected in', 'Actual in', 'Expected out', 'Actual out', 'Status', 'Grace minutes', 'Historical group'],
    ...rows.map(row => [name, staffId, row.date, row.dayType, row.expectedIn, row.record?.effectiveClockInTime || row.record?.clockInTime, row.expectedOut, row.record?.effectiveClockOutTime || row.record?.clockOutTime, detailStatusLabels[row.status], row.graceMinutes, row.recordedGroup])]
    .map(row => row.map(cell).join(',')).join('\r\n');
}
