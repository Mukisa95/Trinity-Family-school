"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Save, School, Users, Book, Crown, Award, GraduationCap, Loader2, Sparkles, Info, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Class, ClassLevel, Staff, Subject, SubjectAssignment } from "@/types";
import { CLASS_LEVELS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useClassDetail } from "@/lib/hooks/use-class-detail";
import { useUpdateClass } from "@/lib/hooks/use-classes";
import { useStaff } from "@/lib/hooks/use-staff";
import { useSubjects } from "@/lib/hooks/use-subjects";
import { usePupils } from "@/lib/hooks/use-pupils";

function EditClassContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Get class ID from URL
  const classId = searchParams?.get('id') || null;

  // Firebase hooks
  const { data: classDetail, isLoading: classLoading, error: classError } = useClassDetail(classId || '');
  const { data: staffList = [] } = useStaff();
  const { data: subjects = [] } = useSubjects();
  const { data: pupils = [] } = usePupils();
  const updateClassMutation = useUpdateClass();

  // Filter staff who have Teaching department or teaching roles
  const teachingStaff: Staff[] = staffList.filter((s: Staff) => {
    const hasTeachingDepartment = Array.isArray(s.department) 
      ? s.department.includes('Teaching')
      : s.department === 'Teaching';
    
    const hasTeachingRoles = Array.isArray(s.role) && s.role.some(role => 
      ['TEACHER', 'HEAD TEACHER', 'DEPUTY HEAD TEACHER', 'DIRECTOR OF STUDIES', 
       'HEAD OF DEPARTMENT', 'SENIOR TEACHER', 'TEACHING ASSISTANT'].includes(role)
    );
    
    return hasTeachingDepartment || hasTeachingRoles;
  });

  // Form state
  const [className, setClassName] = React.useState("");
  const [classCode, setClassCode] = React.useState("");
  const [level, setLevel] = React.useState<ClassLevel>("Lower Primary");
  const [classOrder, setClassOrder] = React.useState<string>("");
  const [classTeacherId, setClassTeacherId] = React.useState("");
  const [classCaptainId, setClassCaptainId] = React.useState("");
  const [assistantClassCaptainId, setAssistantClassCaptainId] = React.useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<string[]>([]);
  const [subjectTeacherAssignments, setSubjectTeacherAssignments] = React.useState<Record<string, string[]>>({});
  const [expandedSubjects, setExpandedSubjects] = React.useState<Set<string>>(new Set());

  // Initialize form when class data loads
  React.useEffect(() => {
    if (classDetail) {
      setClassName(classDetail.name);
      setClassCode(classDetail.code);
      setLevel(classDetail.level);
      setClassOrder(classDetail.order.toString());
      setClassTeacherId(classDetail.classTeacherId);
      setClassCaptainId(classDetail.classCaptainId || "");
      setAssistantClassCaptainId(classDetail.assistantClassCaptainId || "");

      const initialAssignments: Record<string, string[]> = {};
      const initialSelectedSubjects: string[] = [];
      classDetail.subjectAssignments?.forEach(sa => {
        initialSelectedSubjects.push(sa.subjectId);
        if (Array.isArray(sa.teacherIds)) {
          initialAssignments[sa.subjectId] = sa.teacherIds;
        } else if ('teacherId' in sa && sa.teacherId) {
          initialAssignments[sa.subjectId] = [sa.teacherId];
        } else {
          initialAssignments[sa.subjectId] = [];
        }
      });
      setSelectedSubjectIds(initialSelectedSubjects);
      setSubjectTeacherAssignments(initialAssignments);
    }
  }, [classDetail]);

  const handleSubjectToggle = (subjectId: string) => {
    const isSelected = selectedSubjectIds.includes(subjectId);
    if (isSelected) {
      setSelectedSubjectIds(prev => prev.filter(id => id !== subjectId));
      setSubjectTeacherAssignments(prev => {
        const newState = { ...prev };
        delete newState[subjectId];
        return newState;
      });
    } else {
      setSelectedSubjectIds(prev => [...prev, subjectId]);
      setSubjectTeacherAssignments(prev => ({ ...prev, [subjectId]: [] }));
    }
  };

  const handleSubjectTeacherChange = (subjectId: string, teacherId: string, isChecked: boolean) => {
    setSubjectTeacherAssignments(prev => {
      const currentTeachers = prev[subjectId] || [];
      if (isChecked) {
        return {
          ...prev,
          [subjectId]: currentTeachers.includes(teacherId) ? currentTeachers : [...currentTeachers, teacherId],
        };
      } else {
        return {
          ...prev,
          [subjectId]: currentTeachers.filter(id => id !== teacherId),
        };
      }
    });
  };

  const handleSubmit = async () => {
    if (!classId) {
      toast({ variant: "destructive", title: "Error", description: "Class ID is missing." });
      return;
    }

    const orderNumber = parseInt(classOrder, 10);
    if (classOrder.trim() === "" || isNaN(orderNumber)) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Order number is compulsory and must be a valid number." });
      return;
    }
    if (!className.trim()) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Class Name is compulsory." });
      return;
    }
    if (!classCode.trim()) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Class Code is compulsory." });
      return;
    }
    if (!classTeacherId) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Class Teacher is compulsory." });
      return;
    }

    const teacher = teachingStaff.find(s => s.id === classTeacherId);
    const classTeacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : undefined;

    const finalSubjectAssignments: SubjectAssignment[] = selectedSubjectIds.map(subjectId => ({
      subjectId,
      teacherIds: subjectTeacherAssignments[subjectId] || [],
    }));

    const classData = {
      name: className.trim(),
      code: classCode.trim(),
      level,
      order: orderNumber,
      classTeacherId,
      classTeacherName,
      classCaptainId: classCaptainId || undefined,
      assistantClassCaptainId: assistantClassCaptainId || undefined,
      subjectAssignments: finalSubjectAssignments,
    };

    try {
      await updateClassMutation.mutateAsync({ id: classId, data: classData });
      toast({ title: "Class Updated", description: "Class has been successfully updated." });
      router.push(`/class-detail?id=${classId}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update class. Please try again.",
      });
    }
  };

  if (!classId) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <PageHeader title="Edit Class" />
        <div className="py-8">
          <p className="text-muted-foreground mb-4">Class ID is missing.</p>
          <Button asChild>
            <Link href="/classes">Back to Classes</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (classLoading) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Edit Class" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading class details...</span>
        </div>
      </div>
    );
  }

  if (classError || !classDetail) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <PageHeader title="Edit Class" />
        <div className="py-8">
          <p className="text-muted-foreground mb-4">Class not found or error loading class.</p>
          <Button asChild>
            <Link href="/classes">Back to Classes</Link>
          </Button>
        </div>
      </div>
    );
  }

  const selectedSubjectsCount = selectedSubjectIds.length;
  const totalTeachersAssigned = Object.values(subjectTeacherAssignments).reduce((sum, teachers) => sum + teachers.length, 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <School className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Edit Class
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Updating: <span className="font-semibold text-foreground">{classDetail.name}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-xl border-2 hover:bg-muted/50">
            <Link href={`/class-detail?id=${classId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
            </Link>
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={updateClassMutation.isPending}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {updateClassMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-700 mb-1">Selected Subjects</p>
                <p className="text-2xl font-bold text-blue-900">{selectedSubjectsCount}</p>
              </div>
              <Book className="h-8 w-8 text-blue-600 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-700 mb-1">Teachers Assigned</p>
                <p className="text-2xl font-bold text-purple-900">{totalTeachersAssigned}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-700 mb-1">Class Level</p>
                <p className="text-lg font-bold text-amber-900">{level}</p>
              </div>
              <GraduationCap className="h-8 w-8 text-amber-600 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-700 mb-1">Active Pupils</p>
                <p className="text-2xl font-bold text-green-900">
                  {pupils.filter((p: any) => p.classId === classId && p.status === 'Active').length}
                </p>
              </div>
              <Users className="h-8 w-8 text-green-600 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Basic Information Card */}
      <Card className="shadow-xl border-2 border-primary/10 bg-gradient-to-br from-card via-card to-muted/5 rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 border-b-2 border-primary/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <School className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Basic Information</CardTitle>
              <CardDescription className="text-sm mt-1">
                Core class details and identification
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label htmlFor="className" className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Class Name <span className="text-red-500">*</span>
              </Label>
              <Input 
                id="className" 
                value={className} 
                onChange={(e) => setClassName(e.target.value.toUpperCase())} 
                placeholder="e.g., PRIMARY ONE"
                className="h-11 rounded-xl border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classCode" className="text-sm font-semibold flex items-center gap-2">
                <Book className="h-4 w-4 text-purple-600" />
                Class Code <span className="text-red-500">*</span>
              </Label>
              <Input 
                id="classCode" 
                value={classCode} 
                onChange={(e) => setClassCode(e.target.value.toUpperCase())} 
                placeholder="e.g., P.1"
                className="h-11 rounded-xl border-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order" className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 text-amber-600" />
                Order <span className="text-red-500">*</span>
              </Label>
              <Input 
                id="order" 
                type="number" 
                value={classOrder} 
                onChange={(e) => setClassOrder(e.target.value)} 
                placeholder="1"
                className="h-11 rounded-xl border-2 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level" className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-green-600" />
                Level <span className="text-red-500">*</span>
              </Label>
              <Select value={level} onValueChange={(value) => setLevel(value as ClassLevel)}>
                <SelectTrigger className="h-11 rounded-xl border-2 focus:border-green-500 focus:ring-2 focus:ring-green-500/20">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {CLASS_LEVELS.map(lvl => (
                    <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Class Teacher Card - Compact */}
      <Card className="shadow-lg border-2 border-green-200 bg-gradient-to-br from-green-50/50 to-emerald-50/30 rounded-xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex-shrink-0">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="classTeacherId" className="text-sm font-semibold text-green-900">
                  Class Teacher
                </Label>
                <span className="text-red-500 text-sm">*</span>
              </div>
              <Select value={classTeacherId} onValueChange={setClassTeacherId}>
                <SelectTrigger className="h-10 rounded-lg border-2 border-green-300 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 bg-white">
                  <SelectValue placeholder="Select class teacher" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  {teachingStaff.length === 0 && <SelectItem value="no-teachers" disabled>No teaching staff available</SelectItem>}
                  {teachingStaff.map(teacher => {
                    const departments = Array.isArray(teacher.department) ? teacher.department.join(', ') : teacher.department;
                    const roles = Array.isArray(teacher.role) ? teacher.role.join(', ') : teacher.role;
                    return (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        <div className="flex flex-col py-0.5">
                          <span className="font-medium text-sm">{teacher.firstName} {teacher.lastName}</span>
                          {(departments || roles) && (
                            <span className="text-xs text-muted-foreground">
                              {departments && roles ? `${departments} • ${roles}` : (departments || roles)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {classTeacherId && (() => {
                const selectedTeacher = teachingStaff.find(t => t.id === classTeacherId);
                if (selectedTeacher) {
                  const departments = Array.isArray(selectedTeacher.department) ? selectedTeacher.department.join(', ') : selectedTeacher.department;
                  const roles = Array.isArray(selectedTeacher.role) ? selectedTeacher.role.join(', ') : selectedTeacher.role;
                  return (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {departments && roles ? `${departments} • ${roles}` : (departments || roles)}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Class Leadership Card */}
      <Card className="shadow-xl border-2 border-primary/10 bg-gradient-to-br from-card via-card to-muted/5 rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b-2 border-primary/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
              <Crown className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Class Leadership</CardTitle>
              <CardDescription className="text-sm mt-1">
                Assign class captains from active pupils
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label htmlFor="classCaptainId" className="text-sm font-semibold flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-600" />
                Class Captain
              </Label>
              <Select 
                value={classCaptainId || "none"} 
                onValueChange={(value) => setClassCaptainId(value === "none" ? "" : value)}
              >
                <SelectTrigger className="h-11 rounded-xl border-2 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20">
                  <SelectValue placeholder="Select class captain" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  <SelectItem value="none">None</SelectItem>
                  {pupils
                    .filter((pupil: any) => pupil.classId === classId && pupil.status === 'Active')
                    .map(pupil => (
                      <SelectItem key={pupil.id} value={pupil.id} disabled={pupil.id === assistantClassCaptainId}>
                        {pupil.firstName} {pupil.lastName} ({pupil.admissionNumber})
                      </SelectItem>
                    ))}
                  {pupils.filter((p: any) => p.classId === classId && p.status === 'Active').length === 0 && (
                    <SelectItem value="no-pupils" disabled>No active pupils available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="assistantClassCaptainId" className="text-sm font-semibold flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-600" />
                Assistant Class Captain
              </Label>
              <Select 
                value={assistantClassCaptainId || "none"} 
                onValueChange={(value) => setAssistantClassCaptainId(value === "none" ? "" : value)}
              >
                <SelectTrigger className="h-11 rounded-xl border-2 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20">
                  <SelectValue placeholder="Select assistant captain" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  <SelectItem value="none">None</SelectItem>
                  {pupils
                    .filter((pupil: any) => pupil.classId === classId && pupil.status === 'Active')
                    .map(pupil => (
                      <SelectItem key={pupil.id} value={pupil.id} disabled={pupil.id === classCaptainId}>
                        {pupil.firstName} {pupil.lastName} ({pupil.admissionNumber})
                      </SelectItem>
                    ))}
                  {pupils.filter((p: any) => p.classId === classId && p.status === 'Active').length === 0 && (
                    <SelectItem value="no-pupils" disabled>No active pupils available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(classCaptainId || assistantClassCaptainId) && (
            <Alert className="mt-6 border-amber-200 bg-amber-50/50">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-800">
                <span className="font-semibold">Note:</span> A pupil cannot be both Class Captain and Assistant Class Captain.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Subject Assignments Card */}
      <Card className="shadow-xl border-2 border-primary/10 bg-gradient-to-br from-card via-card to-muted/5 rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10 border-b-2 border-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Subject Assignments</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Select subjects and assign teachers for this class
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {selectedSubjectsCount} selected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {subjects.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  <Book className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-base">No subjects available.</p>
                  <p className="text-sm mt-1">Please create subjects first.</p>
                </div>
              )}
              {subjects.map(subject => {
                const isSelected = selectedSubjectIds.includes(subject.id);
                const assignedTeachers = subjectTeacherAssignments[subject.id] || [];
                const selectedTeacherNames = assignedTeachers
                  .map(teacherId => {
                    const teacher = teachingStaff.find(t => t.id === teacherId);
                    return teacher ? `${teacher.firstName} ${teacher.lastName}` : null;
                  })
                  .filter(Boolean)
                  .join(', ');
                
                return (
                  <Card 
                    key={subject.id} 
                    className={`border-2 transition-all duration-200 ${
                      isSelected 
                        ? 'border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50/50 shadow-md' 
                        : 'border-gray-200 bg-card hover:border-gray-300'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Label 
                            htmlFor={`subject-${subject.id}`} 
                            className="text-base font-semibold flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                          >
                            <div className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                              isSelected 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                              <Book className="h-4 w-4" />
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-foreground flex-shrink-0">{subject.name}</span>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {subject.code}
                              </Badge>
                              {isSelected && selectedTeacherNames && (
                                <>
                                  <span className="text-sm text-gray-400 mx-1 flex-shrink-0">-</span>
                                  <span className="text-sm text-purple-600 font-medium truncate">{selectedTeacherNames}</span>
                                </>
                              )}
                            </div>
                          </Label>
                          {isSelected && (
                            <Collapsible
                              open={expandedSubjects.has(subject.id)}
                              onOpenChange={(open) => {
                                setExpandedSubjects(prev => {
                                  const newSet = new Set(prev);
                                  if (open) {
                                    newSet.add(subject.id);
                                  } else {
                                    newSet.delete(subject.id);
                                  }
                                  return newSet;
                                });
                              }}
                            >
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 flex-shrink-0 hover:bg-purple-100"
                                >
                                  <ChevronDown className={`h-4 w-4 text-purple-600 transition-transform duration-200 ${expandedSubjects.has(subject.id) ? 'rotate-180' : ''}`} />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="ml-12 mt-3 p-4 bg-white/80 rounded-xl border-2 border-purple-200 shadow-sm">
                                  <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {teachingStaff.length === 0 ? (
                                      <p className="text-sm text-muted-foreground italic">No teaching staff available</p>
                                    ) : (
                                      teachingStaff.map(teacher => {
                                        const isTeacherSelected = assignedTeachers.includes(teacher.id);
                                        return (
                                          <div 
                                            key={teacher.id} 
                                            className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                                              isTeacherSelected 
                                                ? 'bg-purple-100 border-2 border-purple-300' 
                                                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                            }`}
                                          >
                                            <Checkbox
                                              id={`teacher-${subject.id}-${teacher.id}`}
                                              checked={isTeacherSelected}
                                              onCheckedChange={(checked) => handleSubjectTeacherChange(subject.id, teacher.id, checked === true)}
                                            />
                                            <Label 
                                              htmlFor={`teacher-${subject.id}-${teacher.id}`}
                                              className="flex-1 cursor-pointer"
                                            >
                                              <div className="font-medium text-foreground text-sm">{teacher.firstName} {teacher.lastName}</div>
                                            </Label>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                        <Checkbox
                          id={`subject-${subject.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleSubjectToggle(subject.id)}
                          className="h-5 w-5 flex-shrink-0"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t-2 border-primary/10">
        <Button 
          asChild 
          variant="outline" 
          className="rounded-xl border-2 hover:bg-muted/50 h-11"
        >
          <Link href={`/class-detail?id=${classId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Link>
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={updateClassMutation.isPending}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 h-11 min-w-[140px]"
        >
          {updateClassMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function EditClassPage() {
  return (
    <Suspense fallback={
      <div className="p-4 sm:p-6">
        <PageHeader title="Edit Class" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    }>
      <EditClassContent />
    </Suspense>
  );
}
