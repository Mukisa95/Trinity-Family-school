const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export function isIsoLocalDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function assertIsoLocalDate(value: string): void {
  if (!isIsoLocalDate(value)) {
    throw new Error(`Expected an ISO local date, received "${value}".`);
  }
}

export function weekdayForLocalDate(value: string): number {
  assertIsoLocalDate(value);
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isDateInRange(value: string, startsOn?: string, endsOn?: string): boolean {
  assertIsoLocalDate(value);
  if (startsOn) assertIsoLocalDate(startsOn);
  if (endsOn) assertIsoLocalDate(endsOn);
  return (!startsOn || value >= startsOn) && (!endsOn || value <= endsOn);
}

export function localTimeToSeconds(value: string): number {
  if (!LOCAL_TIME.test(value)) {
    throw new Error(`Expected a 24-hour local time, received "${value}".`);
  }
  const [hours, minutes, seconds = '0'] = value.split(':');
  return Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds);
}
