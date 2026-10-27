import { format, getDay, isSameWeek, isValid, parseISO } from 'date-fns';

export function getDutyEndMessage(endDate: string, today: string): string {
  const end = parseISO(endDate);
  const current = parseISO(today);
  if (!isValid(end) || !isValid(current)) return '';
  if (endDate < today) return 'This duty has ended.';
  if (endDate === today) return 'Today is your last day on this duty.';
  const label = format(end, 'EEEE, d MMMM');
  if (isSameWeek(end, current, { weekStartsOn: 1 }) && [5, 0].includes(getDay(end))) {
    return `You'll be on duty until the end of this week (${label}).`;
  }
  return `You'll be on duty until ${label}.`;
}
