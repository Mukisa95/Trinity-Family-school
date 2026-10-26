import type { DetailPeriod, DetailRange } from './details-contracts';
import { detailPeriodRange } from './details-report';

export type DetailView = Exclude<DetailPeriod, 'day'>;

export function detailRangeLabel(range: DetailRange, compact = false) {
  const year = compact && range.from.slice(0, 4) === range.to.slice(0, 4) ? undefined : 'numeric';
  const format = (date: string) => new Intl.DateTimeFormat('en-UG', { day: 'numeric', month: 'short', year, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  return `${format(range.from)} – ${format(range.to)}`;
}

export function detailWeeks(year: number): DetailRange[] {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return [];
  const first = detailPeriodRange('week', `${year}-01-01`);
  const date = new Date(`${first.from}T12:00:00Z`), result: DetailRange[] = [];
  while (date.toISOString().slice(0, 10) <= `${year}-12-31`) {
    result.push(detailPeriodRange('week', date.toISOString().slice(0, 10)));
    date.setUTCDate(date.getUTCDate() + 7);
  }
  return result;
}
