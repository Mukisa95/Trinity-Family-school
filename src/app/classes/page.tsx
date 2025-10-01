"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Edit, Trash2, Book, Users, GraduationCap, Baby, School } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from "@/components/ui/modern-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Class, ClassLevel, Staff, Subject, SubjectAssignment } from "@/types";
import { CLASS_LEVELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSubjects } from "@/lib/hooks/use-subjects";
import { usePupils } from "@/lib/hooks/use-pupils";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useClasses, useCreateClass, useUpdateClass, useDeleteClass } from "@/lib/hooks/use-classes";
import { useStaff } from "@/lib/hooks/use-staff";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";

const NONE_TEACHER_VALUE = "_NONE_";

// Level icons mapping
const LEVEL_ICONS = {
  'Nursery': Baby,
  'Lower Primary': School,
  'Upper Primary': Book,
  'Secondary': GraduationCap,
  'Other': Book
} as const;

// Level colors mapping
const LEVEL_COLORS = {
  'Nursery': 'bg-pink-50 border-pink-200 hover:bg-pink-100',
  'Lower Primary': 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  'Upper Primary': 'bg-green-50 border-green-200 hover:bg-green-100',
  'Secondary': 'bg-purple-50 border-purple-200 hover:bg-purple-100',
  'Other': 'bg-gray-50 border-gray-200 hover:bg-gray-100'
} as const;

export default function ClassesPage() {
  const { toast } = useToast();
  
  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  
  // Firebase hooks
  const { data: classes = [], isLoading, error } = useClasses();
  const { data: staffList = [] } = useStaff();
  const { data: subjects = [] } = useSubjects();
  const { data: pupils = [] } = usePupils();
  const createClassMutation = useCreateClass();
  const updateClassMutation = useUpdateClass();
  const deleteClassMutation = useDeleteClass();
  
  // Filter staff who have Teaching department or teaching roles
  const teachingStaff: Staff[] = staffList.filter((s: Staff) => {
    // Check if staff has Teaching department (handles both old string and new array format)
    const hasTeachingDepartment = Array.isArray(s.department) 
      ? s.department.includes('Teaching')
      : s.department === 'Teaching';
    
    // Check if staff has teaching roles
    const hasTeachingRoles = Array.isArray(s.role) && s.role.some(role => 
      ['TEACHER', 'HEAD TEACHER', 'DEPUTY HEAD TEACHER', 'DIRECTOR OF STUDIES', 
       'HEAD OF DEPARTMENT', 'SENIOR TEACHER', 'TEACHING ASSISTANT'].includes(role)
    );
    
    return hasTeachingDepartment || hasTeachingRoles;
  });
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingClass, setEditingClass] = React.useState<Class | null>(null);

  // Form state
  const [className, setClassName] = React.useState("");
  const [classCode, setClassCode] = React.useState("");
  const [level, setLevel] = React.useState<ClassLevel>("Lower Primary");
  const [classOrder, setClassOrder] = React.useState<string>("");
  const [classTeacherId, setClassTeacherId] = React.useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<string[]>([]);
  const [subjectTeacherAssignments, setSubjectTeacherAssignments] = React.useState<Record<string, string | null>>({});

  // Calculate pupil counts by class
  const pupilCountsByClass = React.useMemo(() => {
    const counts: Record<string, number> = {};
    pupils.forEach(pupil => {
      if (pupil.classId && pupil.status === 'Active') {
        counts[pupil.classId] = (counts[pupil.classId] || 0) + 1;
      }
    });
    return counts;
  }, [pupils]);

  // Group classes by level
  const classesByLevel = React.useMemo(() => {
    const grouped = classes.reduce((acc, classItem) => {
      if (!acc[classItem.level]) {
        acc[classItem.level] = [];
      }
      acc[classItem.level].push(classItem);
      return acc;
    }, {} as Record<ClassLevel, Class[]>);

    // Sort classes within each level by order
    Object.keys(grouped).forEach(level => {
      grouped[level as ClassLevel].sort((a, b) => a.order - b.order);
    });

    return grouped;
  }, [classes]);

  const handleAddClass = () => {
    setEditingClass(null);
    setClassName("");
    setClassCode("");
    setLevel("Lower Primary");
    setClassOrder("");
    setClassTeacherId("");
    setSelectedSubjectIds([]);
    setSubjectTeacherAssignments({});
    setIsDialogOpen(true);
  };

  const handleEditClass = (classItem: Class) => {
    setEditingClass(classItem);
    setClassName(classItem.name);
    setClassCode(classItem.code);
    setLevel(classItem.level);
    setClassOrder(classItem.order.toString());
    setClassTeacherId(classItem.classTeacherId);

    const initialAssignments: Record<string, string | null> = {};
    const initialSelectedSubjects: string[] = [];
    classItem.subjectAssignments?.forEach(sa => {
      initialSelectedSubjects.push(sa.subjectId);
      initialAssignments[sa.subjectId] = sa.teacherId;
    });
    setSelectedSubjectIds(initialSelectedSubjects);
    setSubjectTeacherAssignments(initialAssignments);

    setIsDialogOpen(true);
  };

  const handleDeleteClass = async (classId: string) => {
    try {
      await deleteClassMutation.mutateAsync(classId);
      toast({ 
        title: "Class Deleted", 
        description: "Class has been successfully deleted."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete class. Please try again.",
      });
    }
  };

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
      setSubjectTeacherAssignments(prev => ({ ...prev, [subjectId]: null }));
    }
  };

  const handleSubjectTeacherChange = (subjectId: string, teacherId: string | null) => {
    setSubjectTeacherAssignments(prev => ({
      ...prev,
      [subjectId]: teacherId,
    }));
  };

  const handleSubmit = async () => {
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
      teacherId: subjectTeacherAssignments[subjectId] || null,
    }));

    const classData = {
      name: className.trim(),
      code: classCode.trim(),
      level,
      order: orderNumber,
      classTeacherId,
      classTeacherName,
      subjectAssignments: finalSubjectAssignments,
    };

    try {
      if (editingClass) {
        await updateClassMutation.mutateAsync({ id: editingClass.id, data: classData });
        toast({ title: "Class Updated", description: "Class has been successfully updated." });
      } else {
        await createClassMutation.mutateAsync(classData);
        toast({ title: "Class Created", description: "Class has been successfully created." });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${editingClass ? 'update' : 'create'} class. Please try again.`,
      });
    }
  };

  const ClassCard = ({ classItem }: { classItem: Class }) => {
    const teacher = staffList.find((s: Staff) => s.id === classItem.classTeacherId);
    const LevelIcon = LEVEL_ICONS[classItem.level] || Book;
    const pupilCount = pupilCountsByClass[classItem.id] || 0;
    
    // Check if this class has any graduated pupils
    const hasGraduates = React.useMemo(() => {
      return pupils.some((pupil: any) => 
        pupil.status === 'Graduated' && 
        pupil.graduationClassId === classItem.id
      );
    }, [pupils, classItem.id]);
    
    return (
      <Card className={`transition-all duration-200 hover:shadow-md ${LEVEL_COLORS[classItem.level]} border`}>
        <CardHeader className="pb-1 px-3 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <div className="p-1 rounded bg-white/50 flex-shrink-0">
                <LevelIcon className="h-3 w-3 text-gray-700" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm font-semibold leading-tight">
                  <Link href={`/class-detail?id=${classItem.id}`} className="hover:underline text-primary truncate block">
                    {classItem.name}
                  </Link>
                </CardTitle>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-6 w-6 p-0 flex-shrink-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleEditClass(classItem)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/class-detail?id=${classItem.id}`}>
                    <Book className="mr-2 h-4 w-4" /> View Details
                  </Link>
                </DropdownMenuItem>
                {hasGraduates && (
                  <DropdownMenuItem asChild>
                    <Link href={`/classes/graduates/${classItem.id}`}>
                      <GraduationCap className="mr-2 h-4 w-4" /> View Graduates
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => handleDeleteClass(classItem.id)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  disabled={deleteClassMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-2 px-3">
          <div className="space-y-1.5">
            {/* Pupil Count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Users className="h-3 w-3 text-gray-600" />
                <span className="text-xs font-medium text-gray-900">
                  {pupilCount} pupil{pupilCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Book className="h-3 w-3 text-gray-600" />
                <span className="text-xs text-gray-600">
                  {classItem.subjects?.length || 0} subject{(classItem.subjects?.length || 0) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Class Teacher */}
            <div className="flex items-center space-x-1.5">
              <Avatar className="h-4 w-4 flex-shrink-0">
                <AvatarFallback className="text-xs bg-white/70 text-gray-600">
                  {teacher ? `${teacher.firstName[0]}${teacher.lastName[0]}` : 'NA'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {teacher ? `${teacher.firstName} ${teacher.lastName}` : 'No teacher assigned'}
                </p>
              </div>
            </div>

            {/* Graduate Class Button - Shows only if class has graduates */}
            {hasGraduates && (
              <div className="pt-1">
                <Button 
                  asChild 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-6 text-xs border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                >
                  <Link href={`/classes/graduates/${classItem.id}`}>
                    <GraduationCap className="mr-1 h-3 w-3" />
                    View Graduates
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const LevelSection = ({ level, classes: levelClasses }: { level: ClassLevel; classes: Class[] }) => {
    const LevelIcon = LEVEL_ICONS[level] || Book;
    const totalPupils = levelClasses.reduce((sum, classItem) => sum + (pupilCountsByClass[classItem.id] || 0), 0);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2 pb-1 border-b">
          <div className="p-1 rounded bg-primary/10 flex-shrink-0">
            <LevelIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{level}</h2>
            <p className="text-xs text-gray-500">
              {levelClasses.length} class{levelClasses.length !== 1 ? 'es' : ''} • {totalPupils} pupil{totalPupils !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="grid gap-2">
          {levelClasses.map((classItem) => (
            <ClassCard key={classItem.id} classItem={classItem} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Class Management"
        description="Manage school classes, assign teachers, and organize subjects by academic levels."
        actions={
          <Button onClick={handleAddClass}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Class
          </Button>
        }
      />
      
      {/* Show recess status banner if in recess mode */}
      <RecessStatusBanner />
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading classes...</span>
        </div>
      ) : error ? (
        <div className="text-center text-destructive py-12">
          <p>Error loading classes data. Please try again.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {CLASS_LEVELS.filter(level => classesByLevel[level] && classesByLevel[level].length > 0).map((level) => (
            <LevelSection 
              key={level} 
              level={level} 
              classes={classesByLevel[level]} 
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <ModernDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <ModernDialogContent 
          size="xl" 
          className="w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden" 
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        >
          <ModernDialogHeader className="p-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <School className="h-5 w-5 text-white" />
              </div>
              <div>
                <ModernDialogTitle className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {editingClass ? "Edit Class" : "Create New Class"}
                </ModernDialogTitle>
                <ModernDialogDescription className="text-xs text-gray-600">
                  {editingClass ? "Update class details, subjects and teacher assignments." : "Fill in the details for the new class."}
                </ModernDialogDescription>
              </div>
            </div>
          </ModernDialogHeader>
          
          {/* Academic Context Banner */}
          <div className={`mx-4 mb-4 p-3 border rounded-xl ${editingClass ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200' : 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200'}`}>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-1.5">
                <div className="p-1 bg-white/80 rounded-md">
                  <School className="h-3 w-3 text-gray-600" />
                </div>
                <span className="font-medium text-sm text-gray-700">Class Management</span>
              </div>
              <div className="text-xs text-gray-600">
                <strong>Date:</strong> {format(new Date(), "MMM dd, yyyy")}
              </div>
              <div className={`text-xs px-2 py-1 rounded-full font-medium ml-auto ${editingClass ? 'text-amber-700 bg-amber-100 border border-amber-200' : 'text-purple-700 bg-purple-100 border border-purple-200'}`}>
                {editingClass ? 'Edit Mode' : 'Create Mode'}
              </div>
            </div>
          </div>
          
          <ScrollArea className="flex-grow min-h-0 overflow-y-auto px-4">
            <div className="space-y-4 pb-4">
              {/* Basic Information Section */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1 bg-blue-100 rounded-md">
                    <Book className="h-3 w-3 text-blue-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Basic Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="className" className="text-xs font-medium text-gray-700">
                      Class Name <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      id="className" 
                      value={className} 
                      onChange={(e) => setClassName(e.target.value.toUpperCase())} 
                      placeholder="e.g., PRIMARY ONE"
                      className="h-8 rounded-xl border-2 border-gray-300 bg-white/90 hover:border-gray-400 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 backdrop-blur-sm text-sm" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="classCode" className="text-xs font-medium text-gray-700">
                      Class Code <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      id="classCode" 
                      value={classCode} 
                      onChange={(e) => setClassCode(e.target.value.toUpperCase())} 
                      placeholder="e.g., P.1"
                      className="h-8 rounded-xl border-2 border-gray-300 bg-white/90 hover:border-gray-400 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 backdrop-blur-sm text-sm" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="order" className="text-xs font-medium text-gray-700">
                      Order <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      id="order" 
                      type="number" 
                      value={classOrder} 
                      onChange={(e) => setClassOrder(e.target.value)} 
                      placeholder="1"
                      className="h-8 rounded-xl border-2 border-gray-300 bg-white/90 hover:border-gray-400 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 backdrop-blur-sm text-sm" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="level" className="text-xs font-medium text-gray-700">
                      Level <span className="text-red-500">*</span>
                    </Label>
                    <Select value={level} onValueChange={(value) => setLevel(value as ClassLevel)}>
                      <SelectTrigger className="h-8 rounded-xl border-2 border-gray-300 bg-white/90 hover:border-gray-400 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 backdrop-blur-sm text-sm">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent 
                        position="popper" 
                        side="bottom" 
                        align="start"
                        sideOffset={4}
                        avoidCollisions={true}
                        className="z-50"
                      >
                        {CLASS_LEVELS.map(lvl => (
                          <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Class Teacher Section */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1 bg-green-100 rounded-md">
                    <Users className="h-3 w-3 text-green-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Class Teacher</h3>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="classTeacherId" className="text-xs font-medium text-gray-700">
                    Assign Class Teacher <span className="text-red-500">*</span>
                  </Label>
                  <Select value={classTeacherId} onValueChange={setClassTeacherId}>
                    <SelectTrigger className="h-8 rounded-xl border-2 border-gray-300 bg-white/90 hover:border-gray-400 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 backdrop-blur-sm text-sm">
                      <SelectValue placeholder="Select class teacher" />
                    </SelectTrigger>
                    <SelectContent 
                      position="popper" 
                      side="bottom" 
                      align="start"
                      sideOffset={4}
                      avoidCollisions={true}
                      className="z-50 max-h-60"
                    >
                      {teachingStaff.length === 0 && <SelectItem value="no-teachers" disabled>No teaching staff available</SelectItem>}
                      {teachingStaff.map(teacher => {
                        const departments = Array.isArray(teacher.department) ? teacher.department.join(', ') : teacher.department;
                        const roles = Array.isArray(teacher.role) ? teacher.role.join(', ') : teacher.role;
                        return (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{teacher.firstName} {teacher.lastName}</span>
                              <span className="text-xs text-muted-foreground">
                                {departments} • {roles}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Subjects Assignment Section */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1 bg-purple-100 rounded-md">
                    <GraduationCap className="h-3 w-3 text-purple-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Subject Assignments</h3>
                </div>
                
                <div className="border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm overflow-hidden">
                  <ScrollArea className="h-48">
                    <div className="p-3 space-y-2">
                      {subjects.length === 0 && (
                        <div className="text-center text-gray-500 py-6">
                          <Book className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                          <p className="text-sm">No subjects available.</p>
                        </div>
                      )}
                      {subjects.map(subject => (
                        <div key={subject.id} className="rounded-lg p-3 hover:bg-gray-50/80 border border-gray-100 transition-all duration-200">
                          <div className="flex items-center justify-between mb-2">
                            <Label htmlFor={`subject-${subject.id}`} className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                              <div className="p-0.5 bg-blue-100 rounded-md">
                                <Book className="h-2.5 w-2.5 text-blue-600" />
                              </div>
                              <span className="font-medium">{subject.name}</span>
                              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">({subject.code})</span>
                            </Label>
                            <Checkbox
                              id={`subject-${subject.id}`}
                              checked={selectedSubjectIds.includes(subject.id)}
                              onCheckedChange={() => handleSubjectToggle(subject.id)}
                              className="h-3.5 w-3.5 rounded-md"
                            />
                          </div>
                          {selectedSubjectIds.includes(subject.id) && (
                            <div className="ml-4 mt-2 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`teacher-${subject.id}`} className="text-xs font-medium text-gray-700 min-w-12">
                                  Teacher:
                                </Label>
                                <Select
                                  value={subjectTeacherAssignments[subject.id] || NONE_TEACHER_VALUE}
                                  onValueChange={(value) => handleSubjectTeacherChange(subject.id, value === NONE_TEACHER_VALUE ? null : value)}
                                >
                                  <SelectTrigger className="flex-1 h-7 rounded-lg border-2 border-gray-300 bg-white/90 hover:border-gray-400 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 backdrop-blur-sm text-xs">
                                    <SelectValue placeholder="Select teacher" />
                                  </SelectTrigger>
                                  <SelectContent 
                                    position="popper" 
                                    side="bottom" 
                                    align="start"
                                    sideOffset={4}
                                    avoidCollisions={true}
                                    className="z-50 max-h-60"
                                  >
                                    <SelectItem value={NONE_TEACHER_VALUE} className="italic">None</SelectItem>
                                    {teachingStaff.map(teacher => {
                                      const departments = Array.isArray(teacher.department) ? teacher.department.join(', ') : teacher.department;
                                      const roles = Array.isArray(teacher.role) ? teacher.role.join(', ') : teacher.role;
                                      return (
                                        <SelectItem key={teacher.id} value={teacher.id}>
                                          <div className="flex flex-col">
                                            <span className="font-medium">{teacher.firstName} {teacher.lastName}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {departments} • {roles}
                                            </span>
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                    {teachingStaff.length === 0 && <SelectItem value="no-subject-teachers" disabled>No teaching staff</SelectItem>}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </ScrollArea>

          <ModernDialogFooter className="flex-shrink-0 p-4 pt-3 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)} 
                className="flex-1 sm:flex-none rounded-xl border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 h-9"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={handleSubmit} 
                className="flex-1 sm:flex-none rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 h-9"
              >
                {editingClass ? 'Update Class' : 'Create Class'}
              </Button>
            </div>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>
    </>
  );
}
