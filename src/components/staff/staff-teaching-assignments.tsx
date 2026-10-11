"use client";

import * as React from 'react';
import Link from 'next/link';
import { GraduationCap, Plus, Pencil, Loader2 } from 'lucide-react';
import type { Class, Staff } from '@/types';
import { useClasses, useUpdateStaffClassAssignments } from '@/lib/hooks/use-classes';
import { useSubjects } from '@/lib/hooks/use-subjects';
import { useStaff } from '@/lib/hooks/use-staff';
import { useAuth } from '@/lib/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getSubjectTeacherIds, getSubjectTeachingRole, type SubjectTeachingRole, type StaffClassAssignmentChanges } from '@/lib/utils/teaching-assignments';

export function StaffTeachingAssignments({ staff }: { staff: Staff }) {
  const { data: classes = [], isLoading: classesLoading, error: classesError } = useClasses();
  const { data: subjects = [], isLoading: subjectsLoading, error: subjectsError } = useSubjects();
  const { data: allStaff = [] } = useStaff();
  const { canEdit } = useAuth();
  const { toast } = useToast();
  const mutation = useUpdateStaffClassAssignments();
  const [open, setOpen] = React.useState(false);
  const [draftClass, setDraftClass] = React.useState<Class | null>(null);
  const [classTeacher, setClassTeacher] = React.useState(false);
  const [roles, setRoles] = React.useState<Record<string, SubjectTeachingRole>>({});
  const [search, setSearch] = React.useState('');
  const loading = classesLoading || subjectsLoading;
  const canManage = canEdit('classes');
  const assignedClasses = classes.filter(classItem => classItem.classTeacherId === staff.id || classItem.coClassTeacherId === staff.id || classItem.subjectAssignments?.some(assignment => getSubjectTeacherIds(assignment).includes(staff.id)));
  const teacherName = (id?: string) => {
    const teacher = allStaff.find(item => item.id === id);
    return teacher ? `${teacher.firstName} ${teacher.lastName}` : id ? 'Unavailable teacher' : 'Not assigned';
  };
  const selectClass = (classItem: Class | undefined) => {
    setDraftClass(classItem || null);
    setClassTeacher(classItem?.classTeacherId === staff.id);
    setRoles(Object.fromEntries((classItem?.subjectAssignments || []).map(assignment => [assignment.subjectId, getSubjectTeachingRole(assignment, staff.id)])));
    setSearch('');
  };
  const edit = (classItem?: Class) => { selectClass(classItem); setOpen(true); };
  const changes: StaffClassAssignmentChanges = {
    subjects: Object.entries(roles).flatMap(([subjectId, role]) => {
      const assignment = draftClass?.subjectAssignments?.find(item => item.subjectId === subjectId);
      return role === getSubjectTeachingRole(assignment, staff.id) ? [] : [{ subjectId, role, expectedTeacherIds: getSubjectTeacherIds(assignment) }];
    }),
    ...(draftClass && classTeacher !== (draftClass.classTeacherId === staff.id)
      ? { classTeacher: { assigned: classTeacher, expectedTeacherId: draftClass.classTeacherId || '' } } : {}),
  };
  const hasChanges = !!changes.classTeacher || changes.subjects.length > 0;
  const save = async () => {
    if (!draftClass || !hasChanges || mutation.isPending) return;
    try {
      const result = await mutation.mutateAsync({ classId: draftClass.id, staff, changes });
      toast({ title: 'Teaching assignments saved', description: result.auditSaved
        ? 'The staff profile and class now share these assignments.'
        : 'Assignments were saved, but the history signature could not be recorded.' });
      setOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not save assignments', description: error instanceof Error ? error.message : 'Please try again.' });
    }
  };

  return <>
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><GraduationCap className="h-4 w-4 text-primary" />Classes & teaching assignments</h2>
        {canManage && <Button type="button" variant="outline" className="h-11" disabled={loading || !!classesError || !!subjectsError} onClick={() => edit()}><Plus className="mr-2 h-4 w-4" />Assign</Button>}
      </div>
      <CardContent className="p-4">
        {loading ? <p role="status" className="text-sm text-muted-foreground">Loading teaching assignments…</p>
          : classesError || subjectsError ? <p role="alert" className="text-sm text-destructive">Could not load class and subject assignments.</p>
          : assignedClasses.length === 0 ? <p className="text-sm text-muted-foreground">No class or subject assignments yet.</p>
          : <div className="space-y-3">{assignedClasses.map(classItem => <div key={classItem.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/class-detail?id=${classItem.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">{classItem.name}</Link>
              {canManage && <Button type="button" variant="ghost" className="h-11 w-11 p-0" aria-label={`Edit assignments for ${classItem.name}`} onClick={() => edit(classItem)}><Pencil className="h-4 w-4" /></Button>}
            </div>
            <div className="flex flex-wrap gap-2">
              {classItem.classTeacherId === staff.id && <Badge variant="secondary">Class teacher</Badge>}
              {classItem.coClassTeacherId === staff.id && <Badge variant="secondary">Co-class teacher</Badge>}
            </div>
            <ul className="mt-2 space-y-1 text-sm">{classItem.subjectAssignments?.filter(assignment => getSubjectTeacherIds(assignment).includes(staff.id)).map(assignment => <li key={assignment.subjectId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span>{subjects.find(subject => subject.id === assignment.subjectId)?.name || assignment.subjectId}</span>
              <span className="text-xs text-muted-foreground">{getSubjectTeachingRole(assignment, staff.id) === 'subjectTeacher' ? 'Subject teacher' : 'Assistant subject teacher'}</span>
            </li>)}</ul>
          </div>)}</div>}
      </CardContent>
    </Card>

    <Dialog open={open} onOpenChange={value => { if (!mutation.isPending) setOpen(value); }}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
        <DialogTitle>Assign classes & subjects</DialogTitle>
        <DialogDescription>Assign {staff.firstName} {staff.lastName} to a class. Subject teachers appear in exams; subject teachers and assistants are available in timetables.</DialogDescription>
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1">
            <label htmlFor="staff-assignment-class" className="text-xs font-medium">Class</label>
            <Select value={draftClass?.id || ''} onValueChange={id => selectClass(classes.find(item => item.id === id))} disabled={mutation.isPending}>
              <SelectTrigger id="staff-assignment-class" className="h-11"><SelectValue placeholder="Choose a class" /></SelectTrigger>
              <SelectContent>{classes.map(classItem => <SelectItem key={classItem.id} value={classItem.id}>{classItem.name}</SelectItem>)}</SelectContent>
            </Select>
            {!classes.length && <p className="text-xs text-muted-foreground">Create a class before assigning teachers.</p>}
          </div>
          {draftClass && <>
            <div className="rounded-lg border border-border p-3">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox checked={classTeacher} onCheckedChange={checked => setClassTeacher(checked === true)} disabled={mutation.isPending} />Class teacher
              </label>
              <p className="text-xs text-muted-foreground">Current class teacher: {teacherName(draftClass.classTeacherId)}</p>
              {classTeacher && draftClass.classTeacherId && draftClass.classTeacherId !== staff.id && <p className="mt-2 text-xs text-muted-foreground">Saving will replace {teacherName(draftClass.classTeacherId)} as class teacher.</p>}
            </div>
            <Input placeholder="Search subjects…" aria-label="Search assignment subjects" value={search} onChange={event => setSearch(event.target.value)} className="h-11" />
            <p className="text-xs text-muted-foreground">Choosing Subject teacher keeps the existing teachers as assistants. Removing a subject teacher promotes the first assistant.</p>
            <div className="space-y-2">{subjects.filter(subject => `${subject.name} ${subject.code}`.toLowerCase().includes(search.toLowerCase())).map(subject => {
              const assignment = draftClass.subjectAssignments?.find(item => item.subjectId === subject.id);
              const otherTeachers = getSubjectTeacherIds(assignment).filter(id => id !== staff.id);
              return <div key={subject.id} className="grid items-center gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_12rem]">
                <div className="min-w-0"><label htmlFor={`staff-subject-role-${subject.id}`} className="text-sm font-medium">{subject.name}</label><p className="mt-1 text-xs text-muted-foreground">Subject teacher: {teacherName(getSubjectTeacherIds(assignment)[0])}</p></div>
                <Select value={roles[subject.id] || 'none'} onValueChange={role => setRoles(current => ({ ...current, [subject.id]: role as SubjectTeachingRole }))} disabled={mutation.isPending}>
                  <SelectTrigger id={`staff-subject-role-${subject.id}`} className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Not assigned</SelectItem><SelectItem value="subjectTeacher">Subject teacher</SelectItem><SelectItem value="assistant" disabled={!otherTeachers.length}>Assistant subject teacher</SelectItem></SelectContent>
                </Select>
              </div>;
            })}</div>
            {!subjects.length && <p className="text-sm text-muted-foreground">Create subjects before assigning subject teachers.</p>}
          </>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" className="h-11" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" className="h-11" disabled={!draftClass || !hasChanges || mutation.isPending} onClick={save}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save assignments</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
