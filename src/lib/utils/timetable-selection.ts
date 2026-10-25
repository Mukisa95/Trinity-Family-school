import type { Class, GeneratedPeriod, Staff, TimetableEntry, TimetableProfile } from '@/types';
import { getSubjectTeacherIds } from './teaching-assignments';
import { getOrderedTimetableStreams, getTimetableEntryPeriodIds, getTimetableStreamMode } from './timetable-streams';

export type TimetableCellTarget = { classId: string; periodId: string; streamId?: string };
export const timetableRowKey = (cell: Pick<TimetableCellTarget, 'classId' | 'streamId'>) => JSON.stringify([cell.classId, cell.streamId || '']);
export const timetableCellKey = (cell: TimetableCellTarget) => JSON.stringify([cell.classId, cell.streamId || '', cell.periodId]);
export type TimetableSelectionEdit = {
  cells: TimetableCellTarget[];
  kind: 'subject' | 'activity' | 'clear';
  subjectId?: string;
  activityName?: string;
  activityTeacherId?: string;
  /** Overrides belong to a class/stream row, never to all selected classes. */
  teachers?: Record<string, string>;
  merge?: boolean;
};
export type SelectionData = {
  classes: Class[]; staff: Staff[]; periods: GeneratedPeriod[]; entries: TimetableEntry[];
  profile?: TimetableProfile; yearId: string;
};

export function getSelectableTimetableCells(data: SelectionData, classIds: string[], dayIds: number[]) {
  return data.classes.filter(c => classIds.includes(c.id)).flatMap(c =>
    data.periods.filter(p => p.type === 'lesson' && dayIds.includes(p.dayOfWeek)).flatMap(p => {
      const streams = getOrderedTimetableStreams(c, data.profile, data.yearId);
      return getTimetableStreamMode(data.profile, c.id, p.dayOfWeek, p.id) === 'separate' && streams.length > 1
        ? streams.map(s => ({ classId: c.id, periodId: p.id, streamId: s.id }))
        : [{ classId: c.id, periodId: p.id }];
    }));
}

export function resolveTimetableSelection(edit: TimetableSelectionEdit, data: SelectionData) {
  const unique = [...new Map(edit.cells.map(c => [timetableCellKey(c), c])).values()];
  return unique.map(cell => {
    const cls = data.classes.find(c => c.id === cell.classId);
    const period = data.periods.find(p => p.id === cell.periodId);
    const streams = cls ? getOrderedTimetableStreams(cls, data.profile, data.yearId) : [];
    const separate = !!period && getTimetableStreamMode(data.profile, cell.classId, period.dayOfWeek, cell.periodId) === 'separate' && streams.length > 1;
    const current = data.entries.find(e => timetableRowKey(e) === timetableRowKey(cell) && getTimetableEntryPeriodIds(e, sortedDay(data.periods, period?.dayOfWeek)).includes(cell.periodId));
    const assignment = cls?.subjectAssignments?.find(a => a.subjectId === edit.subjectId);
    const teacherIds = getSubjectTeacherIds(assignment);
    const assignedIds = teacherIds.filter(id => data.staff.some(s => s.id === id));
    const existingTeacher = current && current.subjectId === edit.subjectId && assignedIds.includes(current.teacherId) ? current.teacherId : undefined;
    const teacherId = edit.kind === 'activity' ? edit.activityTeacherId || 'UNASSIGNED'
      : edit.teachers?.[timetableRowKey(cell)] || existingTeacher || teacherIds[0] || '';
    let error = !cls || (data.profile?.classIds?.length && !data.profile.classIds.includes(cell.classId)) ? 'Class is not in this timetable.'
      : !period || period.type !== 'lesson' ? 'This period is no longer a lesson.'
      : (separate ? !streams.some(s => s.id === cell.streamId) : !!cell.streamId) ? 'The stream layout changed. Select the periods again.'
      : '';
    if (!error && edit.kind === 'subject') {
      if (!assignment) error = 'Subject is not assigned to this class.';
      else if (teacherId === 'UNASSIGNED' && !teacherIds.length) { /* Explicit acknowledgement. */ }
      else if (!assignedIds.includes(teacherId)) error = teacherIds.length ? 'Choose an available teacher assigned to this subject.' : 'No teacher assigned. Choose “Leave unassigned” to continue.';
    }
    if (!error && edit.kind === 'activity' && !edit.activityName?.trim()) error = 'Enter an activity name.';
    if (!error && edit.kind === 'activity' && teacherId !== 'UNASSIGNED' && !data.staff.some(s => s.id === teacherId)) error = 'Activity teacher is unavailable.';
    return { cell, cls, period, teacherId, teacherIds: assignedIds, error };
  });
}

const sortedDay = (periods: GeneratedPeriod[], day?: number) => periods.filter(p => p.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));

/** Split at omitted lessons and day boundaries; breaks never become lesson cells. */
function runs(ids: string[], periods: GeneratedPeriod[], merge: boolean): string[][] {
  if (!merge) return ids.map(id => [id]);
  const chosen = new Set(ids);
  const result: string[][] = [];
  for (const day of [...new Set(periods.map(p => p.dayOfWeek))].sort()) {
    let run: string[] = [];
    for (const p of sortedDay(periods, day)) {
      if (p.type !== 'lesson') continue;
      if (chosen.has(p.id)) run.push(p.id);
      else if (run.length) { result.push(run); run = []; }
    }
    if (run.length) result.push(run);
  }
  return result;
}

export function planTimetableSelectionEdit(edit: TimetableSelectionEdit, data: SelectionData) {
  const resolved = resolveTimetableSelection(edit, data);
  if (!resolved.length) throw new Error('Select at least one lesson.');
  const invalid = resolved.find(r => r.error);
  if (invalid) throw new Error(`${invalid.cls?.name || 'Selection'}: ${invalid.error}`);
  const selected = new Set(resolved.map(r => timetableCellKey(r.cell)));
  const removals: string[] = [];
  const writes: Partial<TimetableEntry>[] = [];
  const remaining: TimetableEntry[] = [];
  for (const entry of data.entries) {
    const day = data.periods.find(p => p.id === entry.periodId)?.dayOfWeek;
    const ids = getTimetableEntryPeriodIds(entry, sortedDay(data.periods, day));
    const touched = ids.some(periodId => selected.has(timetableCellKey({ ...entry, periodId })) ||
      (!entry.streamId && entry.linkedClassIds?.some(classId => selected.has(timetableCellKey({ classId, periodId })))));
    if (!touched) { remaining.push(entry); continue; }
    removals.push(entry.id);
    // Keep untouched portions and unlink only the classes actually edited in that period.
    const groups = new Map<string, { ids: string[]; links: string[] }>();
    for (const periodId of ids) {
      if (selected.has(timetableCellKey({ ...entry, periodId }))) continue;
      const links = (entry.linkedClassIds || []).filter(classId => !selected.has(timetableCellKey({ classId, periodId })));
      const key = JSON.stringify(links);
      const group = groups.get(key) || { ids: [], links };
      group.ids.push(periodId); groups.set(key, group);
    }
    const { id: _id, ...rest } = entry;
    for (const group of groups.values()) for (const periodIds of runs(group.ids, data.periods, !!entry.mergePeriods || (entry.periodSpan || 1) > 1)) {
      const kept = { ...rest, periodId: periodIds[0], periodIds, periodSpan: 1, mergePeriods: periodIds.length > 1, linkedClassIds: group.links };
      writes.push(kept); remaining.push({ ...kept, id: entry.id });
    }
  }
  const additions: Partial<TimetableEntry>[] = [];
  if (edit.kind !== 'clear') {
    const groups = new Map<string, typeof resolved>();
    for (const row of resolved) {
      const key = JSON.stringify([timetableRowKey(row.cell), row.teacherId]);
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    for (const group of groups.values()) {
      const first = group[0];
      const stream = first.cls?.streams?.find(s => s.id === first.cell.streamId);
      for (const periodIds of runs(group.map(r => r.cell.periodId), data.periods, !!edit.merge)) {
        additions.push({ classId: first.cell.classId, ...(stream ? { streamId: stream.id, streamName: stream.name, streamCode: stream.code } : {}),
          periodId: periodIds[0], periodIds, periodSpan: 1, mergePeriods: !!edit.merge && periodIds.length > 1,
          entryType: edit.kind, subjectId: edit.kind === 'activity' ? 'ACTIVITY' : edit.subjectId!,
          teacherId: first.teacherId, ...(edit.kind === 'activity' ? { activityName: edit.activityName!.trim() } : {}),
        });
      }
    }
  }
  // Include alternatives and actual time overlaps, including conflicts within this selection.
  const warnings = new Set<string>();
  const proposed = [...remaining, ...additions];
  for (const added of additions) for (const id of added.periodIds || []) {
    const p = data.periods.find(p => p.id === id)!;
    if (!added.teacherId || added.teacherId === 'UNASSIGNED') continue;
    for (const other of proposed) {
      if (other === added || timetableRowKey(other as TimetableEntry) === timetableRowKey(added as TimetableEntry)) continue;
      if (![other.teacherId, other.coTeacherId, other.optionalTeacherId, other.coOptionalTeacherId].includes(added.teacherId)) continue;
      const otherDay = data.periods.find(p => p.id === other.periodId)?.dayOfWeek;
      const overlap = getTimetableEntryPeriodIds(other as TimetableEntry, sortedDay(data.periods, otherDay)).some(otherId => {
        const o = data.periods.find(p => p.id === otherId);
        return o && o.dayOfWeek === p.dayOfWeek && o.startTime < p.endTime && p.startTime < o.endTime;
      });
      if (overlap) {
        const teacher = data.staff.find(s => s.id === added.teacherId);
        const otherClass = data.classes.find(c => c.id === other.classId);
        warnings.add(`${teacher ? `${teacher.firstName} ${teacher.lastName}` : added.teacherId} also teaches ${otherClass?.name || other.classId}${other.streamName ? ` · ${other.streamName}` : ''}, day ${p.dayOfWeek}, ${p.startTime}–${p.endTime}.`);
      }
    }
  }
  if (removals.length + writes.length + additions.length > 498) throw new Error('This selection is too large to save together. Select fewer classes or days.');
  return { removals, writes: [...writes, ...additions], warnings: [...warnings], resolved };
}

/** The server re-plans against fresh data and rejects a changed preview. */
export function timetableSelectionFingerprint(plan: ReturnType<typeof planTimetableSelectionEdit>) {
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([k, v]) => v !== undefined && k !== 'createdAt' && k !== 'updatedAt').sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : value;
  return JSON.stringify(stable({ removals: [...plan.removals].sort(), writes: plan.writes.map(stable).map(v => JSON.stringify(v)).sort(), warnings: [...plan.warnings].sort() }));
}
