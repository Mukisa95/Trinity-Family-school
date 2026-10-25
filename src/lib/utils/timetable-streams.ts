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

// Four-character class codes, plus a narrow stream label strip when needed.
export const COMPACT_TIMETABLE_CLASS_COLUMN_WIDTH = 40;
export const STREAMED_TIMETABLE_CLASS_COLUMN_WIDTH = 64;

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

export function getOrderedTimetableStreams(
  schoolClass: Class,
  profile: Pick<TimetableProfile, 'streamLayouts'> | null | undefined,
  academicYearId: string,
): ClassStream[] {
  const activeStreams = getActiveClassStreams(schoolClass, academicYearId);
  const byId = new Map(activeStreams.map(stream => [stream.id, stream]));
  const ordered: ClassStream[] = [];
  for (const id of profile?.streamLayouts?.[schoolClass.id]?.streamOrder || []) {
    const stream = byId.get(id);
    if (stream) {
      ordered.push(stream);
      byId.delete(id);
    }
  }
  // Newly enabled streams append in their configured order; disabled/deleted
  // IDs and duplicate saved IDs never produce phantom or repeated rows.
  return [...ordered, ...byId.values()];
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
    const streams = getOrderedTimetableStreams(classItem, profile, academicYearId);
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

function isTimetableBreak(period: GeneratedPeriod | undefined): boolean {
  return period?.type === 'break' || period?.type === 'lunch' || period?.type === 'assembly';
}

/**
 * Returns the cells owned by an entry. Older entries keep their periodSpan
 * behaviour; newer marked entries name every selected lesson explicitly.
 */
export function getTimetableEntryPeriodIds(entry: TimetableEntry, periods: GeneratedPeriod[]): string[] {
  if (entry.periodIds?.length) return entry.periodIds;
  const startIndex = periods.findIndex(period => period.id === entry.periodId);
  if (startIndex < 0) return [entry.periodId];
  const span = getTimetableRenderedPeriodSpan(periods, startIndex, entry.periodSpan);
  return periods.slice(startIndex, startIndex + span).map(period => period.id);
}

export function entryCoversTimetablePeriod(
  entry: TimetableEntry,
  periodId: string,
  periods: GeneratedPeriod[],
): boolean {
  return getTimetableEntryPeriodIds(entry, periods).includes(periodId);
}

/**
 * A table cannot span over a break column. This returns a separate render run
 * on either side of a break, preserving one logical marked assignment.
 */
export function getTimetableEntryRenderSegment(
  entry: TimetableEntry,
  periods: GeneratedPeriod[],
  periodIndex: number,
): { shouldRender: boolean; span: number } {
  const period = periods[periodIndex];
  if (!period || !entryCoversTimetablePeriod(entry, period.id, periods)) return { shouldRender: true, span: 1 };
  const selected = new Set(getTimetableEntryPeriodIds(entry, periods));
  const previous = periods[periodIndex - 1];
  if ((entry.mergePeriods || !entry.periodIds?.length) && previous && !isTimetableBreak(previous) && selected.has(previous.id)) return { shouldRender: false, span: 0 };
  if (!entry.mergePeriods) {
    return {
      shouldRender: true,
      span: entry.periodIds?.length ? 1 : getTimetableRenderedPeriodSpan(periods, periodIndex, entry.periodSpan),
    };
  }

  let span = 1;
  while (periodIndex + span < periods.length) {
    const next = periods[periodIndex + span];
    if (isTimetableBreak(next) || !selected.has(next.id)) break;
    span += 1;
  }
  return { shouldRender: true, span };
}

export function getTimetableBreakLabelFontSize(dayCount: number, columnWidth = 64): number {
  const visibleDayCount = Math.max(1, Math.min(7, dayCount || 1));
  const widthLimit = Math.round(columnWidth * 0.6);
  const dayScaledSize = Math.round(40 - ((visibleDayCount - 1) * 1.6));
  return Math.max(24, Math.min(38, widthLimit, dayScaledSize));
}
