"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useEditTimetableSelection } from '@/lib/hooks/use-timetable';
import { useToast } from '@/hooks/use-toast';
import type { Subject } from '@/types';
import { getSelectableTimetableCells, planTimetableSelectionEdit, resolveTimetableSelection, timetableCellKey, timetableRowKey, timetableSelectionFingerprint, type SelectionData, type TimetableCellTarget, type TimetableSelectionEdit } from '@/lib/utils/timetable-selection';

export type TimetableSelectionController = {
  marking: boolean; cells: TimetableCellTarget[];
  begin: (cell: TimetableCellTarget) => void;
  toggle: (cell: TimetableCellTarget) => void;
  selectDay: (day: number) => void;
};
export const TimetableSelectionContext = React.createContext<TimetableSelectionController | null>(null);
const selectStyle = 'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground';

export function TimetableSelectionEditor({ children, enabled, data, subjects, termId, profileId, classFilter, onClassFilter, viewMode, onViewMode, selectedDay }: {
  children: React.ReactNode; enabled: boolean; data: SelectionData; subjects: Subject[]; termId: string; profileId: string;
  classFilter: string; onClassFilter: (id: string) => void; viewMode: 'day' | 'week'; onViewMode: (mode: 'day' | 'week') => void; selectedDay: number;
}) {
  const [cells, setCells] = React.useState<TimetableCellTarget[]>([]);
  const [marking, setMarking] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<TimetableSelectionEdit['kind']>('subject');
  const [subjectId, setSubjectId] = React.useState('');
  const [activityName, setActivityName] = React.useState('');
  const [activityTeacherId, setActivityTeacherId] = React.useState('UNASSIGNED');
  const [teachers, setTeachers] = React.useState<Record<string, string>>({});
  const [merge, setMerge] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [error, setError] = React.useState('');
  const mutation = useEditTimetableSelection();
  const { toast } = useToast();
  const clear = React.useCallback(() => { setOpen(false); setCells([]); setMarking(false); setError(''); }, []);
  React.useEffect(() => { if (!enabled) clear(); }, [enabled, clear]);
  const profileClasses = data.classes.filter(c => !data.profile?.classIds?.length || data.profile.classIds.includes(c.id));
  const visibleClassIds = profileClasses.filter(c => !classFilter || c.id === classFilter).map(c => c.id);
  const days = [...new Set(data.periods.map(p => p.dayOfWeek))].sort();
  const addScope = (dayIds: number[]) => {
    const next = getSelectableTimetableCells(data, visibleClassIds, dayIds);
    setCells(previous => [...new Map([...previous, ...next].map(c => [timetableCellKey(c), c])).values()]);
    setMarking(true);
  };
  const controller: TimetableSelectionController = {
    marking, cells,
    begin: cell => { setMarking(true); setCells([cell]); },
    toggle: cell => setCells(previous => previous.some(c => timetableCellKey(c) === timetableCellKey(cell))
      ? previous.filter(c => timetableCellKey(c) !== timetableCellKey(cell)) : [...previous, cell]),
    selectDay: day => addScope([day]),
  };
  const edit: TimetableSelectionEdit = { cells, kind, subjectId, activityName, activityTeacherId, teachers, merge };
  const resolved = React.useMemo(() => resolveTimetableSelection(edit, data), [cells, kind, subjectId, activityName, activityTeacherId, teachers, merge, data]);
  const rows = [...new Map(resolved.map(r => [timetableRowKey(r.cell), r])).values()];
  const chosenSubjects = subjects.filter(s => rows.some(r => r.cls?.subjectAssignments?.some(a => a.subjectId === s.id)));
  let plan: ReturnType<typeof planTimetableSelectionEdit> | undefined;
  let validation = '';
  try { if (open) plan = planTimetableSelectionEdit(edit, data); } catch (e) { validation = e instanceof Error ? e.message : 'Review the selection.'; }
  const warnings = plan?.warnings || [];
  const warningsKey = warnings.join('|');
  React.useEffect(() => { setAcknowledged(false); }, [warningsKey, cells, subjectId, teachers]);
  const openEditor = () => {
    setKind('subject'); setSubjectId(''); setTeachers({}); setActivityName(''); setMerge(false); setError(''); setOpen(true);
  };
  const save = async () => {
    if (!plan || mutation.isPending) return;
    try {
      await mutation.mutateAsync({ yearId: data.yearId, termId, timetableId: profileId, edit, fingerprint: timetableSelectionFingerprint(plan) });
      toast({ title: kind === 'clear' ? 'Selected periods cleared' : 'Timetable updated', description: `${cells.length} periods updated across ${new Set(cells.map(c => c.classId)).size} classes.` });
      clear();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your selection is still available.'); }
  };
  const teacherName = (id: string) => { const t = data.staff.find(t => t.id === id); return t ? `${t.firstName} ${t.lastName}` : id === 'UNASSIGNED' ? 'Unassigned' : 'Choose a teacher'; };
  return <TimetableSelectionContext.Provider value={enabled ? controller : null}>
    {enabled && <div className="mb-3 shrink-0 space-y-2 rounded-xl border bg-muted/40 p-3" data-timetable-edit-controls>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold">Edit class
          <select aria-label="Edit class" className={selectStyle} value={classFilter} onChange={e => onClassFilter(e.target.value)}>
            <option value="">All classes</option>{profileClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">Editing view
          <select aria-label="Editing view" className={selectStyle} value={viewMode} onChange={e => onViewMode(e.target.value as 'day' | 'week')}><option value="day">One day</option><option value="week">Full week</option></select>
        </label>
        <Button size="sm" variant={marking ? 'default' : 'outline'} aria-pressed={marking} onClick={() => setMarking(true)}>Mark periods</Button>
        {viewMode === 'day' && <Button size="sm" variant="outline" onClick={() => addScope([selectedDay])}>Select day</Button>}
        <Button size="sm" variant="outline" onClick={() => addScope(days)}>Select week</Button>
      </div>
      {marking ? <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs" role="status">{cells.length} periods marked · {new Set(cells.map(c => c.classId)).size} classes · {new Set(resolved.map(r => r.period?.dayOfWeek)).size} days. Tap a marked cell to deselect it.</p>
        <Button size="sm" variant="outline" onClick={clear}>Clear selection</Button>
        <Button size="sm" disabled={!cells.length} onClick={openEditor}>Edit {cells.length} marked</Button>
      </div> : <p className="text-xs text-muted-foreground">Choose a class or mark periods across classes and days. Select day/week adds all lesson periods for the displayed classes.</p>}
    </div>}
    {children}
    <Dialog open={open} onOpenChange={value => { if (!value && !mutation.isPending) clear(); }}>
      <DialogContent className="flex max-w-2xl flex-col overflow-hidden" onEscapeKeyDown={e => { if (mutation.isPending) e.preventDefault(); }} onInteractOutside={e => { if (mutation.isPending) e.preventDefault(); }}>
        <DialogTitle>Edit {cells.length} selected periods</DialogTitle>
        <DialogDescription>Teachers are matched separately for each class and stream. Review the assignments before applying them.</DialogDescription>
        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain" data-selection-dialog-fields>
        <label className="flex flex-col gap-1 text-sm">Assign
          <select aria-label="Assignment type" className={selectStyle} value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="subject">Subject</option><option value="activity">Co-curricular activity</option><option value="clear">Clear selected periods</option></select>
        </label>
        {kind === 'subject' && <>
          <label className="flex flex-col gap-1 text-sm">Subject
            <select aria-label="Subject for selected periods" className={selectStyle} value={subjectId} onChange={e => { setSubjectId(e.target.value); setTeachers({}); }}>
              <option value="">Choose a subject</option>{chosenSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="space-y-2">
            {rows.map(row => {
              const key = timetableRowKey(row.cell);
              const matching = resolved.filter(r => timetableRowKey(r.cell) === key);
              const ids = [...new Set(matching.map(r => r.teacherId))];
              const stream = row.cls?.streams?.find(s => s.id === row.cell.streamId);
              const label = `${row.cls?.name || row.cell.classId}${stream ? ` · ${stream.name}` : ''}`;
              return <div key={key} className="rounded-lg border p-3" data-teacher-preview={row.cell.classId}>
                <p className="text-sm font-semibold">{label} <span className="font-normal text-muted-foreground">· {matching.length} periods</span></p>
                {subjectId && <><p className="my-1 text-xs">{ids.map(teacherName).join(' / ')}{!teachers[key] && ' (automatic)'}</p>
                  <select aria-label={`Teacher for ${label}`} className={`${selectStyle} w-full`} value={teachers[key] || ''} onChange={e => setTeachers(previous => ({ ...previous, [key]: e.target.value }))}>
                    <option value="">Automatic: keep assigned lesson teacher, otherwise subject teacher</option>
                    {row.teacherIds.map((id, index) => <option key={id} value={id}>{teacherName(id)} · {index === 0 ? 'Subject teacher' : 'Assistant'}</option>)}
                    {!row.teacherIds.length && <option value="UNASSIGNED">Leave unassigned</option>}
                  </select>
                  {row.error && <p className="mt-1 text-xs text-destructive">{row.error}</p>}
                </>}
              </div>;
            })}
          </div>
        </>}
        {kind === 'activity' && <>
          <label className="flex flex-col gap-1 text-sm">Activity name<input aria-label="Activity name" value={activityName} onChange={e => setActivityName(e.target.value)} className={selectStyle} /></label>
          <label className="flex flex-col gap-1 text-sm">Teacher (optional)<select aria-label="Activity teacher" value={activityTeacherId} onChange={e => setActivityTeacherId(e.target.value)} className={selectStyle}><option value="UNASSIGNED">Unassigned</option>{data.staff.map(t => <option key={t.id} value={t.id}>{teacherName(t.id)}</option>)}</select></label>
        </>}
        {kind !== 'clear' && cells.length > 1 && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={merge} onChange={e => setMerge(e.target.checked)} className="mt-1" />Merge consecutive periods within each class and day. Breaks remain visible.</label>}
        {kind === 'clear' && <p className="text-sm">Only the selected lesson periods will be cleared. Unselected parts of merged lessons will be kept.</p>}
        {warnings.length > 0 && <div className="rounded-lg border border-amber-400 p-3 text-sm"><p className="font-semibold">Teacher overlaps</p><ul className="mt-2 list-disc space-y-1 pl-4">{warnings.map(w => <li key={w}>{w}</li>)}</ul><label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />I have reviewed these overlaps. Save these assignments.</label></div>}
        {(error || (validation && (subjectId || kind !== 'subject'))) && <p role="alert" className="text-sm text-destructive">{error || validation}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-popover pt-3">
          <Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Back to marks</Button>
          <Button variant="outline" disabled={mutation.isPending} onClick={clear}>Cancel and clear</Button>
          <Button disabled={!plan || mutation.isPending || (warnings.length > 0 && !acknowledged)} onClick={save}>{mutation.isPending ? 'Saving…' : kind === 'clear' ? 'Clear selected periods' : 'Apply to selected periods'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </TimetableSelectionContext.Provider>;
}

export function TimetableWeekEditHeading({ day, label }: { day: number; label: string }) {
  const selection = React.useContext(TimetableSelectionContext);
  return <div className="sticky top-0 z-20 mb-2 flex items-center justify-between bg-background py-2">
    <h3 className="text-sm font-bold">{label}</h3>
    <Button size="sm" variant="outline" onClick={() => selection?.selectDay(day)}>Select {label}</Button>
  </div>;
}
