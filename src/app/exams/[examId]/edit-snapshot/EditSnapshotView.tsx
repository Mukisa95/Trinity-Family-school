"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Camera, ArrowLeft, Save, Loader2, Plus, X, User, BookOpen, Calendar, UserCheck } from 'lucide-react';
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
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/common/page-header';

export default function EditSnapshotView() {
  const params = useParams();
  const router = useRouter();
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
          const teacher = teacherId ? teachingStaff.find(t => t.id === teacherId) : null;
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
      teacherId: null
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

      router.back();
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

  if (examLoading || resultLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!exam || !examResult) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Edit Snapshot Data"
          description="Exam or exam result not found"
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <PageHeader
            title="Edit Snapshot Data"
            description={`Edit snapshot data for ${exam.name}`}
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving || !resultLease.canSave}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Exam Dates Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Exam Dates
          </CardTitle>
          <CardDescription>
            Update the start and end dates for this exam
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <ModernDatePicker
                date={startDate ?? undefined}
                setDate={date => setStartDate(date ?? null)}
                placeholder="Select start date"
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <ModernDatePicker
                date={endDate ?? undefined}
                setDate={date => setEndDate(date ?? null)}
                placeholder="Select end date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Class Teacher Section */}
      {editedClassSnapshot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Class Teacher
            </CardTitle>
            <CardDescription>
              Update the class teacher for this exam (used when generating PDF reports)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Class: {editedClassSnapshot.name}</p>
                <p className="text-sm text-muted-foreground">Code: {editedClassSnapshot.code}</p>
              </div>
              <Select
                value={editedClassSnapshot.classTeacherId || 'none'}
                onValueChange={(value) => handleClassTeacherChange(value === 'none' ? null : value)}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select class teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Class Teacher</SelectItem>
                  {teachingStaff.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                      {teacher.employeeId && ` (${teacher.employeeId})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editedClassSnapshot.classTeacherName && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Current Class Teacher: </span>
                  <span className="text-muted-foreground">{editedClassSnapshot.classTeacherName}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Subject Teachers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Subjects in Snapshot
              </CardTitle>
              <CardDescription>
                Manage subjects and teacher assignments for this exam snapshot ({editedSubjectSnapshots.length} subjects)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddSubjectDialog(true)}
              disabled={availableSubjects.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Subject
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editedSubjectSnapshots.map((subject) => (
            <div key={subject.subjectId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3 hover:bg-muted/50">
              <div className="flex-1">
                <p className="font-medium">{subject.name}</p>
                <p className="text-sm text-muted-foreground">Code: {subject.code}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={subject.teacherId || 'none'}
                  onValueChange={(value) => handleSubjectTeacherChange(subject.subjectId, value === 'none' ? null : value)}
                >
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Teacher</SelectItem>
                    {teachingStaff.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.firstName} {teacher.lastName}
                        {teacher.employeeId && ` (${teacher.employeeId})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveSubject(subject.subjectId)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Remove subject"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {editedSubjectSnapshots.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No subjects in snapshot. Click "Add Subject" to add subjects.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pupils Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Pupils in Snapshot
              </CardTitle>
              <CardDescription>
                Manage pupils included in this exam snapshot ({editedPupilSnapshots.length} pupils)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddPupilDialog(true)}
              disabled={availablePupils.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Pupil
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {editedPupilSnapshots.map((pupil) => (
              <div
                key={pupil.pupilId}
                className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50 bg-background shadow-sm"
              >
                <p className="font-medium text-sm truncate pr-2" title={pupil.name}>{pupil.name}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePupil(pupil.pupilId)}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  title="Remove pupil"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {editedPupilSnapshots.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No pupils in snapshot. Click "Add Pupil" to add pupils.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Pupil Dialog */}
      <Dialog open={showAddPupilDialog} onOpenChange={setShowAddPupilDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Pupil to Snapshot</DialogTitle>
            <DialogDescription>
              Select a pupil to add to this exam snapshot
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Pupil</Label>
              <Select value={selectedPupilId} onValueChange={setSelectedPupilId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a pupil" />
                </SelectTrigger>
                <SelectContent>
                  {availablePupils.map((pupil) => (
                    <SelectItem key={pupil.id} value={pupil.id}>
                      {formatPupilDisplayName(pupil)} - {pupil.admissionNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddPupilDialog(false);
                setSelectedPupilId('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddPupil} disabled={!selectedPupilId}>
              Add Pupil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add Subject Dialog */}
      <Dialog open={showAddSubjectDialog} onOpenChange={setShowAddSubjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subject to Snapshot</DialogTitle>
            <DialogDescription>
              Select a subject to add to this exam snapshot
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Subject</Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name} ({subject.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddSubjectDialog(false);
                setSelectedSubjectId('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddSubject} disabled={!selectedSubjectId}>
              Add Subject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
