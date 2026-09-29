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
