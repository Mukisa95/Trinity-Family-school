"use client";

import * as React from 'react';
import { ArrowUp, ArrowDown, Users, X } from 'lucide-react';
import type { Staff } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getSubjectTeacherRoleLabel } from '@/lib/utils/teaching-assignments';
import { cn } from '@/lib/utils';

export function SubjectTeacherSelector({ subjectId, assignedTeacherIds, onTeacherToggle, onTeacherOrderChange, teachers, buttonClassName }: {
  subjectId: string;
  assignedTeacherIds: string[];
  onTeacherToggle: (subjectId: string, teacherId: string, selected: boolean) => void;
  onTeacherOrderChange: (subjectId: string, teacherIds: string[]) => void;
  teachers: Staff[];
  buttonClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const move = (index: number, direction: -1 | 1) => {
    const next = [...assignedTeacherIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onTeacherOrderChange(subjectId, next);
  };

  return <Popover open={open} onOpenChange={setOpen} modal>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className={cn('h-11 w-11 shrink-0 p-0', buttonClassName)} aria-label="Manage subject teachers" onClick={event => event.stopPropagation()}>
        <Users className="h-4 w-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="z-[100000] w-80 max-w-[calc(100vw-2rem)] p-3" onClick={event => event.stopPropagation()}>
      <p className="text-sm font-semibold">Subject teacher & assistants</p>
      <p className="mt-1 text-xs text-muted-foreground">The first teacher is used for exams. Move a teacher up or down to change the order.</p>
      <ol className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {assignedTeacherIds.map((id, index) => {
          const teacher = teachers.find(item => item.id === id);
          const name = teacher ? `${teacher.firstName} ${teacher.lastName}` : `Unavailable teacher (${id})`;
          return <li key={id} className="flex items-center gap-1 rounded-lg border border-border p-2">
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{name}</p><p className="text-xs text-muted-foreground">{getSubjectTeacherRoleLabel(index)}</p></div>
            <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 p-0" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${name} up`}><ArrowUp className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 p-0" disabled={index === assignedTeacherIds.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${name} down`}><ArrowDown className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 p-0" onClick={() => onTeacherToggle(subjectId, id, false)} aria-label={`Remove ${name}`}><X className="h-4 w-4" /></Button>
          </li>;
        })}
      </ol>
      {!assignedTeacherIds.length && <p className="my-3 text-xs text-muted-foreground">Add the subject teacher first, then any assistants.</p>}
      <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search staff…" aria-label="Search subject teachers" className="mt-3 h-11" />
      <div className="mt-2 max-h-48 overflow-y-auto">
        {teachers.filter(teacher => `${teacher.firstName} ${teacher.lastName}`.toLowerCase().includes(search.toLowerCase())).map(teacher => <label key={teacher.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
          <Checkbox checked={assignedTeacherIds.includes(teacher.id)} onCheckedChange={checked => onTeacherToggle(subjectId, teacher.id, checked === true)} />
          <span>{teacher.firstName} {teacher.lastName}</span>
        </label>)}
        {!teachers.length && <p className="py-2 text-xs text-muted-foreground">No teaching staff available.</p>}
      </div>
    </PopoverContent>
  </Popover>;
}
