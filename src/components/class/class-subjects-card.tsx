'use client';

import { useRef, useState } from 'react';
import { BookOpen, Edit, Loader2, Save } from 'lucide-react';
import type { Staff } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SubjectTeacherSelector } from './subject-teacher-selector';
import { getSubjectTeacherRoleLabel } from '@/lib/utils/teaching-assignments';

type SubjectTeachers = { id: string; name: string; teacherIds: string[] };

export function ClassSubjectsCard({ subjects, teachers, isLoading, onSave }: {
  subjects: SubjectTeachers[];
  teachers: Staff[];
  isLoading: boolean;
  onSave: (assignments: Record<string, string[]>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, string[]> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const editing = draft !== null;

  const save = async () => {
    if (!draft || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
      setDraft(null);
    } catch {
      setError('Subject teachers could not be saved. Your changes are still here. Try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Card role="region" aria-label="Subjects and teachers" className="overflow-hidden rounded-2xl border-2 border-primary/10 bg-gradient-to-br from-card via-card to-muted/5 shadow-xl backdrop-blur-sm">
      <CardContent className="space-y-3 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-link" /> Subjects & Teachers
          </h2>
          {!editing && <Button type="button" variant="ghost" size="sm" disabled={isLoading || !subjects.length}
            aria-label="Edit subject teachers" className="min-h-9 shrink-0 gap-1.5"
            onClick={() => { setDraft(Object.fromEntries(subjects.map(subject => [subject.id, [...subject.teacherIds]]))); setError(''); }}>
            <Edit className="h-3.5 w-3.5" /> Edit
          </Button>}
        </div>
        {isLoading ? <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading subjects...</div>
          : !subjects.length ? <p className="rounded-xl border border-dashed bg-muted/20 py-4 text-center text-xs text-muted-foreground">No subjects assigned to this class</p>
          : <fieldset disabled={saving} aria-label="Subject teacher assignments" className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {subjects.map(subject => {
              const ids = draft?.[subject.id] ?? subject.teacherIds;
              return <div key={subject.id} role="group" aria-label={subject.name} className="rounded-xl border-2 border-primary/10 bg-gradient-to-br from-card to-muted/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[0.875rem] font-semibold text-foreground">{subject.name}</h3>
                  {editing && <SubjectTeacherSelector subjectId={subject.id} assignedTeacherIds={ids} teachers={teachers} buttonClassName="h-9 w-9"
                    onTeacherOrderChange={(id, orderedIds) => setDraft(current => current && ({ ...current, [id]: orderedIds }))}
                    onTeacherToggle={(id, teacherId, selected) => setDraft(current => {
                      if (!current) return current;
                      const previous = current[id] ?? ids;
                      return { ...current, [id]: selected ? [...new Set([...previous, teacherId])] : previous.filter(value => value !== teacherId) };
                    })} />}
                </div>
                <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">
                  {ids.length ? ids.map((id, index) => {
                    const teacher = teachers.find(item => item.id === id);
                    return `${getSubjectTeacherRoleLabel(index)}: ${teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unavailable teacher'}`;
                  }).join('; ') : 'Not assigned'}
                </p>
              </div>;
            })}
          </fieldset>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {editing && <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => { setDraft(null); setError(''); }}>Cancel</Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => { void save(); }}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} {saving ? 'Saving...' : 'Save teachers'}
          </Button>
        </div>}
      </CardContent>
    </Card>
  );
}
