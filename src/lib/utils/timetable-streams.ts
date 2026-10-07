import type {
  Class,
  ClassStream,
  GeneratedPeriod,
  TimetableEntry,
  TimetableProfile,
} from '@/types';
import { getActiveClassStreams } from '@/lib/utils/class-streams';

export type TimetableStreamMode = 'consolidated' | 'separate';

export type TimetableClassRow = {
  classItem: Class;
  stream?: ClassStream;
  streamIndex: number;
  streamCount: number;
};

export const COMPACT_TIMETABLE_CLASS_COLUMN_WIDTH = 64;
export const STREAMED_TIMETABLE_CLASS_COLUMN_WIDTH = 104;

export function getTimetableClassColumnWidth(hasVisibleStreamRows: boolean): number {
  return hasVisibleStreamRows
    ? STREAMED_TIMETABLE_CLASS_COLUMN_WIDTH
    : COMPACT_TIMETABLE_CLASS_COLUMN_WIDTH;
}

export function getTimetableStreamMode(
  profile: Pick<TimetableProfile, 'streamLayouts'> | null | undefined,
  classId: string,
  dayId?: number,
  periodId?: string,
): TimetableStreamMode {
  const layout = profile?.streamLayouts?.[classId];
  if (periodId && layout?.periodModes?.[periodId]) return layout.periodModes[periodId];
  if (dayId !== undefined && layout?.dayModes?.[String(dayId)]) return layout.dayModes[String(dayId)];
  return layout?.defaultMode || 'consolidated';
}

export function classUsesStreamRowsForDay(
  schoolClass: Class,
  profile: Pick<TimetableProfile, 'streamLayouts'> | null | undefined,
  academicYearId: string,
  dayId: number,
  periods: GeneratedPeriod[],
): boolean {
  if (getActiveClassStreams(schoolClass, academicYearId).length < 2) return false;
  const dayPeriods = periods.filter(period => period.dayOfWeek === dayId && period.type === 'lesson');
  return dayPeriods.some(period => getTimetableStreamMode(profile, schoolClass.id, dayId, period.id) === 'separate');
}

export function buildTimetableClassRowsForDay(
  classes: Class[],
  profile: Pick<TimetableProfile, 'streamLayouts'> | null | undefined,
  academicYearId: string,
  dayId: number,
  periods: GeneratedPeriod[],
): TimetableClassRow[] {
  return classes.flatMap(classItem => {
    const streams = getActiveClassStreams(classItem, academicYearId);
    if (!classUsesStreamRowsForDay(classItem, profile, academicYearId, dayId, periods)) {
      return [{ classItem, streamIndex: 0, streamCount: 1 }];
    }
    return streams.map((stream, streamIndex) => ({
      classItem,
      stream,
      streamIndex,
      streamCount: streams.length,
    }));
  });
}

export function findTimetableEntryForRow(
  entries: TimetableEntry[],
  classId: string,
  periodId: string,
  mode: TimetableStreamMode,
  streamId?: string,
): TimetableEntry | undefined {
  return entries.find(entry => (
    entry.classId === classId
    && entry.periodId === periodId
    && (mode === 'separate' ? entry.streamId === streamId : !entry.streamId)
  ));
}

export function entryMatchesTimetableRow(entry: TimetableEntry, streamId?: string): boolean {
  return streamId ? entry.streamId === streamId : !entry.streamId;
}

export function getTimetableStreamInitial(
  entry: Pick<TimetableEntry, 'streamId' | 'streamCode' | 'streamName'>,
  schoolClass?: Pick<Class, 'streams'>,
): string {
  if (!entry.streamId) return '';
  const configuredStream = schoolClass?.streams?.find(stream => stream.id === entry.streamId);
  const label = entry.streamCode
    || configuredStream?.code
    || entry.streamName
    || configuredStream?.name
    || '';
  const finalWord = label.trim().split(/\s+/).filter(Boolean).at(-1) || '';
  return finalWord.charAt(0).toUpperCase();
}

export function getTimetableRenderedPeriodSpan(
  periods: GeneratedPeriod[],
  startIndex: number,
  requestedSpan?: number,
): number {
  const desiredSpan = Math.max(1, requestedSpan || 1);
  if (startIndex < 0 || startIndex >= periods.length || desiredSpan === 1) return 1;

  let renderedSpan = 1;
  while (renderedSpan < desiredSpan && startIndex + renderedSpan < periods.length) {
    const nextPeriod = periods[startIndex + renderedSpan];
    if (nextPeriod.type === 'break' || nextPeriod.type === 'lunch' || nextPeriod.type === 'assembly') break;
    renderedSpan += 1;
  }
  return renderedSpan;
}

export function getTimetableBreakLabelFontSize(dayCount: number, columnWidth = 64): number {
  const visibleDayCount = Math.max(1, Math.min(7, dayCount || 1));
  const widthLimit = Math.round(columnWidth * 0.6);
  const dayScaledSize = Math.round(40 - ((visibleDayCount - 1) * 1.6));
  return Math.max(24, Math.min(38, widthLimit, dayScaledSize));
}
