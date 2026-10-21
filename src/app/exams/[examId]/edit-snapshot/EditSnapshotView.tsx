"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useNavigation } from '@/lib/contexts/navigation-context';
import { Save, Loader2, X, User, UserPlus, BookOpen, BookPlus, Calendar, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ModernDatePicker } from '@/components/common/modern-date-picker';
import { useExam, useExamResultByExamId, useUpdateExamResult, useUpdateExam } from '@/lib/hooks/use-exams';
import { useExamResultLease } from '@/lib/hooks/use-exam-result-lease';
import { useStaff } from '@/lib/hooks/use-staff';
import { useActivePupils } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSubjects } from '@/lib/hooks/use-subjects';
import type { Exam, ExamResult, ExamRecordPupilInfo, ExamRecordSubjectInfo, ExamClassInfoSnapshot } from '@/types';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { getExamTeacherIds, getSubjectTeacherId } from '@/lib/utils/teaching-assignments';
import { format, parseISO } from 'date-fns';
import { GlassPageTopBar, GlassActionDock, GlassActionButton, GlassPageSearchInput } from '@/components/common/glass-page-top-bar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const snapshotPanelClass = 'overflow-hidden rounded-3xl border border-brand-100/80 bg-white/80 shadow-[0_14px_38px_-28px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/80';

export default function EditSnapshotView() {
  const params = useParams();
  const { goBack } = useNavigation();
  const { toast } = useToast();
  const examId = params.examId as string;

  const { data: exam, isLoading: examLoading } = useExam(examId);
  const { data: examResult, isLoading: resultLoading } = useExamResultByExamId(examId);
  const { data: staff = [] } = useStaff();
  const { data: pupils = [] } = useActivePupils();
  const { data: classes = [] } = useClasses();
  
  const updateExamResultMutation = useUpdateExamResult();
  const updateExamMutation = useUpdateExam();
  const resultLease = useExamResultLease(examId);

  const [editedPupilSnapshots, setEditedPupilSnapshots] = useState<ExamRecordPupilInfo[]>([]);
  const [editedSubjectSnapshots, setEditedSubjectSnapshots] = useState<ExamRecordSubjectInfo[]>([]);
  const [editedClassSnapshot, setEditedClassSnapshot] = useState<ExamClassInfoSnapshot | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pupils');
  const [showAddPupilDialog, setShowAddPupilDialog] = useState(false);
  const [selectedPupilId, setSelectedPupilId] = useState<string>('');
  const [showAddSubjectDialog, setShowAddSubjectDialog] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  
  const { data: allSubjects = [] } = useSubjects();

  // Initialize state from exam and exam result
  useEffect(() => {
    if (exam) {
      if (exam.startDate) {
        try {
          // 🚀 CRITICAL: Handle both string and array date formats
          const dateString = Array.isArray(exam.startDate) ? exam.startDate[0] : exam.startDate;
          if (typeof dateString === 'string') {
            const start = parseISO(dateString);
            setStartDate(isNaN(start.getTime()) ? null : start);
          }
        } catch (error) {
          console.error('Error parsing start date:', error);
          setStartDate(null);
        }
      }
      if (exam.endDate) {
        try {
          // 🚀 CRITICAL: Handle both string and array date formats
          const dateString = Array.isArray(exam.endDate) ? exam.endDate[0] : exam.endDate;
          if (typeof dateString === 'string') {
            const end = parseISO(dateString);
            setEndDate(isNaN(end.getTime()) ? null : end);
          }
        } catch (error) {
          console.error('Error parsing end date:', error);
          setEndDate(null);
        }
      }
    }
  }, [exam]);

  useEffect(() => {
    if (examResult) {
      setEditedPupilSnapshots([...examResult.pupilSnapshots]);
      setEditedSubjectSnapshots([...examResult.subjectSnapshots]);
      if (examResult.classSnapshot) {
        setEditedClassSnapshot({ ...examResult.classSnapshot });
      }
    }
  }, [examResult]);

  const examClass = useMemo(() => {
    if (!exam || !classes.length) return null;
    return classes.find(c => c.id === exam.classId);
  }, [exam, classes]);

  // Get available pupils that are not already in the snapshot
  const availablePupils = useMemo(() => {
    if (!examClass || !pupils.length) return [];
    const existingPupilIds = new Set(editedPupilSnapshots.map(p => p.pupilId));
    return pupils.filter(p => 
      p.classId === examClass.id && 
      !existingPupilIds.has(p.id) &&
      p.status === 'Active'
    );
  }, [pupils, examClass, editedPupilSnapshots]);

  // Get available subjects that are not already in the snapshot
  const availableSubjects = useMemo(() => {
    if (!allSubjects.length) return [];
    const existingSubjectIds = new Set(editedSubjectSnapshots.map(s => s.subjectId));
    return allSubjects.filter(s => !existingSubjectIds.has(s.id));
  }, [allSubjects, editedSubjectSnapshots]);

  // Get staff members for teacher selection
  const teachingStaff = useMemo(() => {
    return staff.filter(s => 
      s.status === 'active' && 
      (s.department?.includes('Teaching') || s.role?.includes('TEACHER'))
    );
  }, [staff]);

  const handleSubjectTeacherChange = (subjectId: string, teacherId: string | null) => {
    setEditedSubjectSnapshots(prev => 
      prev.map(subject => {
        if (subject.subjectId === subjectId) {
          const teacher = teacherId ? staff.find(t => t.id === teacherId) : null;
          return {
            ...subject,
            teacherId: teacherId || null,
            teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : undefined
          };
        }
        return subject;
      })
    );
  };

  const handleClassTeacherChange = (teacherId: string | null) => {
    if (!editedClassSnapshot) return;
    
    const teacher = teacherId ? teachingStaff.find(t => t.id === teacherId) : null;
    setEditedClassSnapshot({
      ...editedClassSnapshot,
      classTeacherId: teacherId || undefined,
      classTeacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : undefined
    });
  };

  const handleAddPupil = () => {
    if (!selectedPupilId) return;

    const pupil = pupils.find(p => p.id === selectedPupilId);
    if (!pupil || !examClass) return;

    // 🚀 CRITICAL: Safely calculate age handling potential array date formats
    let ageAtExam: number | undefined;
    if (exam?.startDate && pupil.dateOfBirth) {
      try {
        const examDateString = Array.isArray(exam.startDate) ? exam.startDate[0] : exam.startDate;
        const dobString = Array.isArray(pupil.dateOfBirth) ? pupil.dateOfBirth[0] : pupil.dateOfBirth;
        if (typeof examDateString === 'string' && typeof dobString === 'string') {
          ageAtExam = parseISO(examDateString).getFullYear() - parseISO(dobString).getFullYear();
        }
      } catch (error) {
        console.error('Error calculating age:', error);
      }
    }

    const newPupilSnapshot: ExamRecordPupilInfo = {
      pupilId: pupil.id,
      name: formatPupilDisplayName(pupil),
      admissionNumber: pupil.admissionNumber || '',
      classNameAtExam: examClass.name,
      classCodeAtExam: examClass.code,
      section: pupil.section,
      status: pupil.status,
      gender: pupil.gender,
      dateOfBirth: pupil.dateOfBirth,
      ageAtExam
    };

    setEditedPupilSnapshots(prev => [...prev, newPupilSnapshot]);
    setSelectedPupilId('');
    setShowAddPupilDialog(false);
    toast({
      title: "Pupil Added",
      description: `${newPupilSnapshot.name} has been added to the snapshot.`,
    });
  };

  const handleRemovePupil = (pupilId: string) => {
    setEditedPupilSnapshots(prev => prev.filter(p => p.pupilId !== pupilId));
    toast({
      title: "Pupil Removed",
      description: "Pupil has been removed from the snapshot.",
    });
  };

  const handleAddSubject = () => {
    if (!selectedSubjectId) return;

    const subject = allSubjects.find(s => s.id === selectedSubjectId);
    if (!subject) return;

    const newSubjectSnapshot: ExamRecordSubjectInfo = {
      subjectId: subject.id,
      name: subject.name,
      code: subject.code,
      maxMarks: exam?.maxMarks || 100,
      passingMarks: exam?.passingMarks || 0,
      teacherId: getSubjectTeacherId(examClass?.subjectAssignments?.find(assignment => assignment.subjectId === subject.id))
    };

    setEditedSubjectSnapshots(prev => [...prev, newSubjectSnapshot]);
    setSelectedSubjectId('');
    setShowAddSubjectDialog(false);
    toast({
      title: "Subject Added",
      description: `${subject.name} has been added to the snapshot.`,
    });
  };

  const handleRemoveSubject = (subjectId: string) => {
    setEditedSubjectSnapshots(prev => prev.filter(s => s.subjectId !== subjectId));
    toast({
      title: "Subject Removed",
      description: "Subject has been removed from the snapshot.",
    });
  };

  const handleSave = async () => {
    if (!exam || !examResult) return;
    if (!resultLease.canSave) {
      toast({
        title: 'Editing is unavailable',
        description: resultLease.holder
          ? `This result is being edited by ${resultLease.holder.lockedByName}.`
          : 'This result is currently being edited by another user.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Update exam dates and subjectIds if changed
      const examUpdates: any = {};
      if (startDate && exam.startDate !== format(startDate, 'yyyy-MM-dd')) {
        examUpdates.startDate = format(startDate, 'yyyy-MM-dd');
      }
      if (endDate && exam.endDate !== format(endDate, 'yyyy-MM-dd')) {
        examUpdates.endDate = format(endDate, 'yyyy-MM-dd');
      }

      if (exam.examNature === 'Subject based') {
        const newSubjectIds = editedSubjectSnapshots.map(s => s.subjectId);
        // Basic array comparison
        if (JSON.stringify(newSubjectIds) !== JSON.stringify(exam.subjectIds || [])) {
          examUpdates.subjectIds = newSubjectIds;
        }
      }

      if (Object.keys(examUpdates).length > 0) {
        await updateExamMutation.mutateAsync({ id: examId, data: examUpdates });
      }

      // Initialize results for new pupils and new subjects
      const existingPupilIds = new Set(Object.keys(examResult.results || {}));
      const newPupilIds = editedPupilSnapshots
        .map(p => p.pupilId)
        .filter(id => !existingPupilIds.has(id));

      const updatedResults = { ...examResult.results };
      
      // Initialize empty result objects for new pupils
      newPupilIds.forEach(pupilId => {
        updatedResults[pupilId] = {};
      });

      // Ensure every pupil has a result object for every subject currently in the snapshot
      const currentPupilIds = new Set(editedPupilSnapshots.map(p => p.pupilId));
      currentPupilIds.forEach(pupilId => {
        if (!updatedResults[pupilId]) {
          updatedResults[pupilId] = {};
        }
        editedSubjectSnapshots.forEach(subject => {
          if (!updatedResults[pupilId][subject.subjectId]) {
            updatedResults[pupilId][subject.subjectId] = {
              subjectId: subject.subjectId,
              marks: undefined,
              grade: '-',
              aggregates: undefined,
              comment: 'N/A'
            };
          }
        });
      });

      // Remove results for pupils that were removed from snapshot
      Object.keys(updatedResults).forEach(pupilId => {
        if (!currentPupilIds.has(pupilId)) {
          delete updatedResults[pupilId];
        }
      });

      // Update exam result snapshot data
      const resultUpdates: Partial<ExamResult> = {
        pupilSnapshots: editedPupilSnapshots,
        subjectSnapshots: editedSubjectSnapshots,
        results: updatedResults,
      };

      // If class snapshot exists, update it too
      if (editedClassSnapshot) {
        resultUpdates.classSnapshot = {
          ...editedClassSnapshot,
          subjectsTaught: editedSubjectSnapshots.map(subject => ({
            subjectId: subject.subjectId,
            subjectName: subject.name,
            subjectCode: subject.code,
            teacherId: subject.teacherId || null,
            teacherName: subject.teacherName
          })),
          pupilsInClassAtExamCreation: editedPupilSnapshots.map(pupil => ({
            pupilId: pupil.pupilId,
            name: pupil.name,
            admissionNumber: pupil.admissionNumber
          }))
        };
      }

      await updateExamResultMutation.mutateAsync({
        id: examResult.id,
        lease: resultLease.token,
        data: {
          ...resultUpdates,
          examId: examResult.examId,
          academicYearId: exam.academicYearId,
          termId: exam.termId,
        }
      });

      toast({
        title: "Success",
        description: "Snapshot data has been updated successfully.",
      });

      goBack('/exams');
    } catch (error) {
      console.error('Error saving snapshot data:', error);
      toast({
        title: "Error",
        description: "Failed to save snapshot data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const query = searchTerm.trim().toLocaleLowerCase();
  const visiblePupils = editedPupilSnapshots.filter(pupil =>
    !query || `${pupil.name} ${pupil.admissionNumber}`.toLocaleLowerCase().includes(query));
  const visibleSubjects = editedSubjectSnapshots.filter(subject =>
    !query || `${subject.name} ${subject.code} ${subject.teacherName || ''}`.toLocaleLowerCase().includes(query));

  if (examLoading || resultLoading) {
    return <div className="min-h-screen">
      <GlassPageTopBar title="Edit snapshot" backHref="/exams" />
      <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />Loading exam snapshot…
      </div>
    </div>;
  }

  if (!exam || !examResult) {
    return <div className="min-h-screen">
      <GlassPageTopBar title="Edit snapshot" backHref="/exams" />
      <div className="mx-auto max-w-3xl p-4 sm:p-6"><Card className={snapshotPanelClass}>
        <CardHeader><CardTitle>Snapshot unavailable</CardTitle><CardDescription>The exam or its saved snapshot could not be found.</CardDescription></CardHeader>
        <CardContent><Button variant="outline" className="rounded-full" onClick={() => goBack('/exams')}>Back to exams</Button></CardContent>
      </Card></div>
    </div>;
  }

  return (
    <div className="min-h-screen pb-28 sm:pb-8">
      <GlassPageTopBar title="Edit snapshot" backHref="/exams"
        recordDetails={`${exam.name} · ${editedClassSnapshot?.code || editedClassSnapshot?.name || examClass?.name || 'Exam class'}`}
        meta={<span className="rounded-full border border-brand-200/70 bg-brand-surface-50/80 px-2.5 py-1 text-xs font-semibold text-brand-ink-700 dark:border-brand-800/60 dark:bg-brand-surface-950/60 dark:text-brand-ink-300">{editedPupilSnapshots.length} pupils · {editedSubjectSnapshots.length} subjects</span>}
        actionsLeading={<GlassPageSearchInput placeholder="Search snapshot…" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />}
        actions={<GlassActionDock>
          <GlassActionButton label="Pupil" aria-label="Add pupil to snapshot" icon={<UserPlus className="h-4 w-4" />} tone="emerald" title="Add pupil to snapshot" onClick={() => setShowAddPupilDialog(true)} disabled={availablePupils.length === 0 || isSaving} />
          <GlassActionButton label="Subject" aria-label="Add subject to snapshot" icon={<BookPlus className="h-4 w-4" />} tone="violet" title="Add subject to snapshot" onClick={() => setShowAddSubjectDialog(true)} disabled={availableSubjects.length === 0 || isSaving} />
          <GlassActionButton label={isSaving ? 'Saving' : 'Save'} icon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} tone="blue" title="Save snapshot changes" onClick={() => { void handleSave(); }} disabled={isSaving || !resultLease.canSave} />
        </GlassActionDock>}
      />

      <div className="mx-auto max-w-7xl space-y-5 px-3 pt-4 sm:px-6 lg:px-8">
        {!resultLease.canSave && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
          {resultLease.holder ? `${resultLease.holder.lockedByName} is editing this result. Saving will be available when the editing lock is released.` : 'Waiting for the editing lock before saving changes.'}
        </div>}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className={snapshotPanelClass}>
            <CardHeader className="space-y-1 px-4 pb-4 pt-5 sm:px-5">
              <CardTitle className="flex items-center gap-2.5 text-base"><span className="rounded-xl bg-brand-surface-50 p-2 text-brand-ink-700 dark:bg-brand-surface-950/60 dark:text-brand-ink-300"><Calendar className="h-4 w-4" /></span>Exam dates</CardTitle>
              <CardDescription>Set the dates shown on this exam and its reports.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-4 pb-5 sm:grid-cols-2 sm:px-5">
              <div className="min-w-0 space-y-2"><Label>Start date</Label><ModernDatePicker date={startDate ?? undefined} setDate={date => setStartDate(date ?? null)} placeholder="Select start date" /></div>
              <div className="min-w-0 space-y-2"><Label>End date</Label><ModernDatePicker date={endDate ?? undefined} setDate={date => setEndDate(date ?? null)} placeholder="Select end date" /></div>
            </CardContent>
          </Card>

          {editedClassSnapshot && <Card className={snapshotPanelClass}>
            <CardHeader className="space-y-1 px-4 pb-4 pt-5 sm:px-5">
              <CardTitle className="flex items-center gap-2.5 text-base"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><UserCheck className="h-4 w-4" /></span>Class teacher</CardTitle>
              <CardDescription>{editedClassSnapshot.name} · {editedClassSnapshot.code}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-5 sm:px-5">
              <Label htmlFor="snapshot-class-teacher">Teacher shown on reports</Label>
              <Select value={editedClassSnapshot.classTeacherId || 'none'} onValueChange={value => handleClassTeacherChange(value === 'none' ? null : value)}>
                <SelectTrigger id="snapshot-class-teacher" className="h-11 w-full rounded-2xl border-brand-100 bg-white/70 dark:border-slate-700 dark:bg-slate-950/40"><SelectValue placeholder="Select class teacher" /></SelectTrigger>
                <SelectContent><SelectItem value="none">No class teacher</SelectItem>{teachingStaff.map(teacher => <SelectItem key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}{teacher.employeeId && ` (${teacher.employeeId})`}</SelectItem>)}</SelectContent>
              </Select>
              {editedClassSnapshot.classTeacherName && <p className="text-xs text-muted-foreground">Current teacher: {editedClassSnapshot.classTeacherName}</p>}
            </CardContent>
          </Card>}
        </div>

        <Card className={snapshotPanelClass}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="gap-4 border-b border-brand-100/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:px-5 dark:border-slate-700">
              <div className="space-y-1"><CardTitle className="text-base">Exam snapshot</CardTitle><CardDescription>Manage the pupils, subjects and teachers saved for this exam.</CardDescription></div>
              <TabsList aria-label="Snapshot sections" className="h-auto w-fit max-w-full shrink-0 rounded-full border border-brand-200/70 bg-brand-surface-50/70 p-1 dark:border-brand-800/60 dark:bg-slate-950/60">
                <TabsTrigger value="pupils" className="gap-1.5 rounded-full px-3 py-2 text-xs data-[state=active]:bg-brand-surface-600 data-[state=active]:text-white"><User className="h-3.5 w-3.5" />Pupils <span className="opacity-75">{editedPupilSnapshots.length}</span></TabsTrigger>
                <TabsTrigger value="subjects" className="gap-1.5 rounded-full px-3 py-2 text-xs data-[state=active]:bg-brand-surface-600 data-[state=active]:text-white"><BookOpen className="h-3.5 w-3.5" />Subjects <span className="opacity-75">{editedSubjectSnapshots.length}</span></TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="px-3 pb-4 pt-3 sm:px-5 sm:pb-5">
              <TabsContent value="pupils" className="mt-0 space-y-3">
                <p className="text-xs text-muted-foreground">{visiblePupils.length} of {editedPupilSnapshots.length} pupils</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {visiblePupils.map(pupil => <div key={pupil.pupilId} className="flex min-w-0 items-center gap-3 rounded-2xl border border-brand-100/70 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                    <span className="shrink-0 rounded-full bg-brand-surface-50 p-2.5 text-brand-ink-600 dark:bg-brand-surface-950/60 dark:text-brand-ink-300"><User className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{pupil.name}</p><p className="text-xs text-muted-foreground">{pupil.admissionNumber}</p></div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemovePupil(pupil.pupilId)} disabled={isSaving} aria-label={`Remove ${pupil.name} from snapshot`} className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"><X className="h-4 w-4" /></Button>
                  </div>)}
                </div>
                {!visiblePupils.length && <p className="py-10 text-center text-sm text-muted-foreground">{query ? 'No pupils match your search.' : 'No pupils in this snapshot. Use Add pupil to include pupils.'}</p>}
              </TabsContent>
              <TabsContent value="subjects" className="mt-0 space-y-3">
                <p className="text-xs text-muted-foreground">{visibleSubjects.length} of {editedSubjectSnapshots.length} subjects</p>
                <div className="grid gap-3 xl:grid-cols-2">
                  {visibleSubjects.map(subject => <div key={subject.subjectId} className="min-w-0 space-y-3 rounded-2xl border border-brand-100/70 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                    <div className="flex items-start gap-2.5"><span className="shrink-0 rounded-xl bg-brand-secondary-surface-50 p-2 text-brand-secondary-ink-700 dark:bg-brand-secondary-surface-950/50 dark:text-brand-secondary-ink-300"><BookOpen className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{subject.name}</p><p className="text-xs text-muted-foreground">{subject.code}</p></div>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveSubject(subject.subjectId)} disabled={isSaving} aria-label={`Remove ${subject.name} from snapshot`} className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"><X className="h-4 w-4" /></Button>
                    </div>
                    <Label htmlFor={`snapshot-teacher-${subject.subjectId}`} className="sr-only">Teacher for {subject.name}</Label>
                    <Select value={subject.teacherId || 'none'} onValueChange={value => handleSubjectTeacherChange(subject.subjectId, value === 'none' ? null : value)}>
                      <SelectTrigger id={`snapshot-teacher-${subject.subjectId}`} className="h-11 w-full rounded-xl border-brand-100 dark:border-slate-700"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">No teacher</SelectItem>{staff.filter(teacher => getExamTeacherIds(examClass?.subjectAssignments, subject.teacherId).includes(teacher.id)).map(teacher => <SelectItem key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}{teacher.employeeId && ` (${teacher.employeeId})`}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>)}
                </div>
                {!visibleSubjects.length && <p className="py-10 text-center text-sm text-muted-foreground">{query ? 'No subjects match your search.' : 'No subjects in this snapshot. Use Add subject to include subjects.'}</p>}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      <Dialog open={showAddPupilDialog} onOpenChange={setShowAddPupilDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] rounded-3xl border-brand-100 sm:max-w-md dark:border-slate-700">
          <DialogHeader><DialogTitle>Add pupil to snapshot</DialogTitle><DialogDescription>{exam.name} · {examClass?.name}</DialogDescription></DialogHeader>
          <div className="space-y-2 py-2"><Label htmlFor="snapshot-add-pupil">Pupil</Label>
            <Select value={selectedPupilId} onValueChange={setSelectedPupilId}><SelectTrigger id="snapshot-add-pupil" className="h-11 rounded-xl"><SelectValue placeholder="Choose a pupil" /></SelectTrigger>
              <SelectContent>{availablePupils.map(pupil => <SelectItem key={pupil.id} value={pupil.id}>{formatPupilDisplayName(pupil)} - {pupil.admissionNumber}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter><Button variant="outline" className="rounded-full" onClick={() => { setShowAddPupilDialog(false); setSelectedPupilId(''); }}>Cancel</Button><Button className="rounded-full" onClick={() => { handleAddPupil(); setActiveTab('pupils'); }} disabled={!selectedPupilId}>Add pupil</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showAddSubjectDialog} onOpenChange={setShowAddSubjectDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] rounded-3xl border-brand-100 sm:max-w-md dark:border-slate-700">
          <DialogHeader><DialogTitle>Add subject to snapshot</DialogTitle><DialogDescription>{exam.name}</DialogDescription></DialogHeader>
          <div className="space-y-2 py-2"><Label htmlFor="snapshot-add-subject">Subject</Label>
            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}><SelectTrigger id="snapshot-add-subject" className="h-11 rounded-xl"><SelectValue placeholder="Choose a subject" /></SelectTrigger>
              <SelectContent>{availableSubjects.map(subject => <SelectItem key={subject.id} value={subject.id}>{subject.name} ({subject.code})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter><Button variant="outline" className="rounded-full" onClick={() => { setShowAddSubjectDialog(false); setSelectedSubjectId(''); }}>Cancel</Button><Button className="rounded-full" onClick={() => { handleAddSubject(); setActiveTab('subjects'); }} disabled={!selectedSubjectId}>Add subject</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
