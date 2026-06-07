"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Edit, Trash2, Book, Users, GraduationCap, Baby, School, Crown, Award, Clock, ChevronDown, Save, History, User } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
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

// Searchable Pupil Selector Component
function SearchablePupilSelector({
  value,
  onValueChange,
  pupils,
  editingClass,
  disabledIds = [],
  icon: Icon,
  iconClassName,
  buttonClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  pupils: any[];
  editingClass: Class | null;
  disabledIds?: string[];
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  
  const availablePupils = editingClass 
    ? pupils.filter((pupil: any) => pupil.classId === editingClass.id && pupil.status === 'Active' && !disabledIds.includes(pupil.id))
    : pupils.filter((pupil: any) => pupil.status === 'Active' && !disabledIds.includes(pupil.id));
  
  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn("h-8 w-8 p-0 rounded-lg border-2 border-amber-300 bg-white hover:border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200 flex-shrink-0", buttonClassName)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <Icon className={cn("h-4 w-4 text-amber-600", iconClassName)} />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[300px] p-0 !z-[100000]" 
        align="end" 
        side="bottom" 
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Prevent closing when clicking inside the dialog
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]')) {
            e.preventDefault();
          }
        }}
      >
        <Command>
          <CommandInput placeholder="Search pupil..." />
          <CommandList>
            <CommandEmpty>No pupils found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={(currentValue) => {
                  if (currentValue === "none") {
                    onValueChange("");
                    setOpen(false);
                  }
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                None
              </CommandItem>
              {availablePupils.map((pupil: any) => {
                const searchValue = `${pupil.firstName} ${pupil.lastName} ${pupil.admissionNumber} ${pupil.className || ''}`;
                const label = editingClass 
                  ? `${pupil.firstName} ${pupil.lastName} (${pupil.admissionNumber})`
                  : `${pupil.firstName} ${pupil.lastName} (${pupil.admissionNumber}) - ${pupil.className || 'Unassigned'}`;
                return (
                  <CommandItem
                    key={pupil.id}
                    value={searchValue}
                    onSelect={() => {
                      onValueChange(pupil.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === pupil.id ? "opacity-100" : "opacity-0")} />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Searchable Teacher Selector Component
function SearchableTeacherSelector({
  value,
  onValueChange,
  teachers,
  disabledIds = [],
  allowNone = false,
  icon: Icon,
  iconClassName,
  buttonClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  teachers: any[];
  disabledIds?: string[];
  allowNone?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  
  const availableTeachers = teachers.filter((teacher: any) => !disabledIds.includes(teacher.id));
  
  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn("h-8 w-8 p-0 rounded-lg border-2 border-green-300 bg-white hover:border-green-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-200 flex-shrink-0", buttonClassName)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <Icon className={cn("h-4 w-4 text-green-600", iconClassName)} />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[300px] p-0 !z-[100000]" 
        align="end" 
        side="bottom" 
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Prevent closing when clicking inside the dialog
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]')) {
            e.preventDefault();
          }
        }}
      >
        <Command>
          <CommandInput placeholder="Search teacher..." />
          <CommandList>
            <CommandEmpty>No teachers found.</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="none"
                  onSelect={(currentValue) => {
                    if (currentValue === "none") {
                      onValueChange("");
                      setOpen(false);
                    }
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  None
                </CommandItem>
              )}
              {availableTeachers.length === 0 && (
                <CommandItem value="no-teachers" disabled>
                  No teaching staff available
                </CommandItem>
              )}
              {availableTeachers.map((teacher: any) => {
                const searchValue = `${teacher.firstName} ${teacher.lastName}`;
                const label = `${teacher.firstName} ${teacher.lastName}`;
                return (
                  <CommandItem
                    key={teacher.id}
                    value={searchValue}
                    onSelect={() => {
                      onValueChange(teacher.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === teacher.id ? "opacity-100" : "opacity-0")} />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Searchable Subject-Teacher Selector Component
function SearchableSubjectTeacherSelector({
  subjectId,
  assignedTeacherIds = [],
  onTeacherToggle,
  teachers,
  buttonClassName,
}: {
  subjectId: string;
  assignedTeacherIds: string[];
  onTeacherToggle: (subjectId: string, teacherId: string, isChecked: boolean) => void;
  teachers: any[];
  buttonClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-7 w-7 p-0 rounded-lg border border-purple-200 bg-white hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 flex-shrink-0", buttonClassName)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <User className="h-3.5 w-3.5 text-purple-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[260px] p-0 !z-[100000]"
        align="end"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]')) {
            e.preventDefault();
          }
        }}
      >
        <Command className="rounded-xl">
          <CommandInput placeholder="Search teacher..." className="h-8 text-xs" />
          <CommandList className="max-h-48">
            <CommandEmpty className="py-2 text-xs text-center text-gray-500">No teachers found.</CommandEmpty>
            <CommandGroup>
              {teachers.length === 0 && (
                <CommandItem value="no-teachers" disabled className="text-xs text-gray-500">
                  No teaching staff available
                </CommandItem>
              )}
              {teachers.map((teacher: any) => {
                const isChecked = assignedTeacherIds.includes(teacher.id);
                const name = `${teacher.firstName} ${teacher.lastName}`;
                return (
                  <CommandItem
                    key={teacher.id}
                    value={name}
                    onSelect={() => {
                      onTeacherToggle(subjectId, teacher.id, !isChecked);
                    }}
                    className="flex items-center gap-2 py-1.5 px-2 text-xs"
                  >
                    <Checkbox
                      checked={isChecked}
                      className="h-3.5 w-3.5 rounded-sm"
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={(checked) => {
                        onTeacherToggle(subjectId, teacher.id, checked === true);
                      }}
                    />
                    <span className="font-medium text-gray-700">{name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
  
  // Firebase hooks - these will use cached data immediately if available
  const { data: classes = [], isLoading: classesLoading, error: classesError } = useClasses();
  const { data: staffList = [], isLoading: staffLoading } = useStaff();
  const { data: subjects = [], isLoading: subjectsLoading } = useSubjects();
  const { data: pupils = [], isLoading: pupilsLoading } = usePupils();
  
  // 🚀 CRITICAL: Only show loading if we don't have cached data
  // If we have cached data (even if stale), show it immediately
  const hasCachedData = (classes.length > 0 || staffList.length > 0 || subjects.length > 0 || pupils.length > 0);
  const isLoading = !hasCachedData && (classesLoading || staffLoading || subjectsLoading || pupilsLoading);
  const error = classesError;
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
  const [coClassTeacherId, setCoClassTeacherId] = React.useState("");
  const [classCaptainId, setClassCaptainId] = React.useState("");
  const [assistantClassCaptainId, setAssistantClassCaptainId] = React.useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<string[]>([]);
  const [subjectTeacherAssignments, setSubjectTeacherAssignments] = React.useState<Record<string, string[]>>({});
  const [expandedSubjects, setExpandedSubjects] = React.useState<Set<string>>(new Set());
  const [isSubjectAssignmentsOpen, setIsSubjectAssignmentsOpen] = React.useState(false);

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
    setCoClassTeacherId("");
    setClassCaptainId("");
    setAssistantClassCaptainId("");
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
    setCoClassTeacherId((classItem as any).coClassTeacherId || "");
    setClassCaptainId(classItem.classCaptainId || "");
    setAssistantClassCaptainId(classItem.assistantClassCaptainId || "");

    const initialAssignments: Record<string, string[]> = {};
    const initialSelectedSubjects: string[] = [];
    classItem.subjectAssignments?.forEach(sa => {
      initialSelectedSubjects.push(sa.subjectId);
      // Support both old format (teacherId) and new format (teacherIds)
      if (Array.isArray(sa.teacherIds)) {
        initialAssignments[sa.subjectId] = sa.teacherIds;
      } else if ('teacherId' in sa && sa.teacherId) {
        // Migration: convert old single teacherId to array
        initialAssignments[sa.subjectId] = [sa.teacherId];
      } else {
        initialAssignments[sa.subjectId] = [];
      }
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
      setSubjectTeacherAssignments(prev => ({ ...prev, [subjectId]: [] }));
    }
  };

  const handleSubjectTeacherChange = (subjectId: string, teacherId: string, isChecked: boolean) => {
    setSubjectTeacherAssignments(prev => {
      const currentTeachers = prev[subjectId] || [];
      if (isChecked) {
        // Add teacher if not already in the array
        return {
          ...prev,
          [subjectId]: currentTeachers.includes(teacherId) ? currentTeachers : [...currentTeachers, teacherId],
        };
      } else {
        // Remove teacher from array
        return {
          ...prev,
          [subjectId]: currentTeachers.filter(id => id !== teacherId),
        };
      }
    });
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
    
    const coTeacher = teachingStaff.find(s => s.id === coClassTeacherId);
    const coClassTeacherName = coTeacher ? `${coTeacher.firstName} ${coTeacher.lastName}` : undefined;

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
      coClassTeacherId: coClassTeacherId || undefined,
      coClassTeacherName: coClassTeacherName || undefined,
      classCaptainId: classCaptainId || undefined,
      assistantClassCaptainId: assistantClassCaptainId || undefined,
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
                <DropdownMenuItem asChild>
                  <Link href={`/classes/history/${classItem.id}`}>
                    <History className="mr-2 h-4 w-4" /> Class History
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
          <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1">
            <Link href="/classes/pending">
              <button
                className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-amber-600 border border-amber-400 shadow-sm hover:bg-gradient-to-br hover:from-amber-400 hover:via-orange-500 hover:to-amber-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <Clock className="w-4 h-4 mb-0.5" />
                <span className="text-[8px] font-semibold leading-tight">Pending</span>
              </button>
            </Link>
            <button 
              onClick={handleAddClass}
              className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-blue-600 border border-blue-400 shadow-sm hover:bg-gradient-to-br hover:from-blue-400 hover:via-indigo-500 hover:to-blue-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <PlusCircle className="w-4 h-4 mb-0.5" />
              <span className="text-[8px] font-semibold leading-tight">Add</span>
            </button>
          </div>
        }
      />
      
      {/* Show recess status banner if in recess mode */}
      <RecessStatusBanner />
      
      {/* 🚀 CRITICAL: Show content immediately if we have cached data, even if still loading fresh data */}
      {isLoading && !hasCachedData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading classes...</span>
        </div>
      ) : error && !hasCachedData ? (
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
          className="w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden relative"
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        >
          {/* Floating Save/Update Button */}
          <Button
            type="button"
            onClick={handleSubmit}
            className="absolute right-12 top-2 sm:right-16 sm:top-4 rounded-full w-10 h-10 p-0 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 border-2 border-white/30 backdrop-blur-md z-50 flex items-center justify-center group overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.95) 0%, rgba(147, 51, 234, 0.95) 50%, rgba(79, 70, 229, 0.95) 100%)',
              boxShadow: '0 8px 32px rgba(37, 99, 235, 0.5), 0 4px 16px rgba(147, 51, 234, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 -1px 0 rgba(0, 0, 0, 0.15)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(37, 99, 235, 0.6), 0 6px 20px rgba(147, 51, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(37, 99, 235, 0.5), 0 4px 16px rgba(147, 51, 234, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 -1px 0 rgba(0, 0, 0, 0.15)';
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>
            <Save className="h-5 w-5 relative z-10 group-hover:scale-110 transition-transform duration-300" />
            <span className="sr-only">{editingClass ? 'Update Class' : 'Create Class'}</span>
          </Button>
          <ModernDialogHeader className="p-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <School className="h-4 w-4 text-white" />
              </div>
              <div>
                <ModernDialogTitle className="text-base font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {editingClass ? "Edit Class" : "Create New Class"}
                </ModernDialogTitle>
                <ModernDialogDescription className="text-xs text-gray-600 hidden">
                  {editingClass ? "Update class details, subjects and teacher assignments." : "Fill in the details for the new class."}
                </ModernDialogDescription>
              </div>
            </div>
          </ModernDialogHeader>
          
          {/* Academic Context Banner - Hidden */}
          {/* <div className={`mx-4 mb-4 p-3 border rounded-xl ${editingClass ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200' : 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200'}`}>
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
          </div> */}
          
          <ScrollArea className="flex-grow min-h-0 overflow-y-auto px-3">
            <div className="space-y-3 pb-3">
              {/* Basic Information Section */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-3 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
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
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex-shrink-0">
                    <Users className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Label htmlFor="classTeacherId" className="text-sm font-semibold text-green-900 flex items-center gap-2 flex-shrink-0">
                      Class Teacher
                      <span className="text-red-500">*</span>
                    </Label>
                    {classTeacherId && (() => {
                      const selectedTeacher = teachingStaff.find(t => t.id === classTeacherId);
                      if (selectedTeacher) {
                        return (
                          <>
                            <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                            <span className="text-sm text-green-700 font-medium truncate">{selectedTeacher.firstName} {selectedTeacher.lastName}</span>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <SearchableTeacherSelector
                    value={classTeacherId}
                    onValueChange={setClassTeacherId}
                    teachers={teachingStaff}
                    allowNone={false}
                    icon={Users}
                  />
                </div>
              </div>

              {/* Co-Class Teacher Section */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex-shrink-0">
                    <Users className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Label htmlFor="coClassTeacherId" className="text-sm font-semibold text-green-900 flex items-center gap-2 flex-shrink-0">
                      Co-Class Teacher
                    </Label>
                    {coClassTeacherId && (() => {
                      const selectedTeacher = teachingStaff.find(t => t.id === coClassTeacherId);
                      if (selectedTeacher) {
                        return (
                          <>
                            <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                            <span className="text-sm text-green-700 font-medium truncate">{selectedTeacher.firstName} {selectedTeacher.lastName}</span>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <SearchableTeacherSelector
                    value={coClassTeacherId}
                    onValueChange={setCoClassTeacherId}
                    teachers={teachingStaff}
                    allowNone={true}
                    icon={Users}
                  />
                </div>
              </div>

              {/* Class Captains Section */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex-shrink-0">
                    <Crown className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Class Leadership</h3>
                </div>
                
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Class Captain */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="p-1 bg-amber-100 rounded-md flex-shrink-0">
                      <Crown className="h-3 w-3 text-amber-600" />
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Label htmlFor="classCaptainId" className="text-sm font-semibold text-amber-900 flex-shrink-0">
                        Class Captain
                      </Label>
                      {classCaptainId ? (() => {
                        const selectedPupil = pupils.find((p: any) => p.id === classCaptainId);
                        if (selectedPupil) {
                          return (
                            <>
                              <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                              <span className="text-sm text-amber-700 font-medium truncate">{selectedPupil.firstName} {selectedPupil.lastName}</span>
                            </>
                          );
                        }
                        return null;
                      })() : (
                        <>
                          <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                          <span className="text-sm text-gray-500 italic">None</span>
                        </>
                      )}
                    </div>
                    <SearchablePupilSelector
                      value={classCaptainId}
                      onValueChange={(value) => setClassCaptainId(value)}
                      pupils={pupils}
                      editingClass={editingClass}
                      disabledIds={assistantClassCaptainId ? [assistantClassCaptainId] : []}
                      icon={Crown}
                    />
                  </div>
                  
                  {/* Assistant Class Captain */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="p-1 bg-amber-100 rounded-md flex-shrink-0">
                      <Award className="h-3 w-3 text-amber-600" />
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Label htmlFor="assistantClassCaptainId" className="text-sm font-semibold text-amber-900 flex-shrink-0">
                        Assistant
                      </Label>
                      {assistantClassCaptainId ? (() => {
                        const selectedPupil = pupils.find((p: any) => p.id === assistantClassCaptainId);
                        if (selectedPupil) {
                          return (
                            <>
                              <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                              <span className="text-sm text-amber-700 font-medium truncate">{selectedPupil.firstName} {selectedPupil.lastName}</span>
                            </>
                          );
                        }
                        return null;
                      })() : (
                        <>
                          <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                          <span className="text-sm text-gray-500 italic">None</span>
                        </>
                      )}
                    </div>
                    <SearchablePupilSelector
                      value={assistantClassCaptainId}
                      onValueChange={(value) => setAssistantClassCaptainId(value)}
                      pupils={pupils}
                      editingClass={editingClass}
                      disabledIds={classCaptainId ? [classCaptainId] : []}
                      icon={Award}
                    />
                  </div>
                </div>
                {(classCaptainId || assistantClassCaptainId) && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Note:</span> A pupil cannot be both Class Captain and Assistant Class Captain.
                    </p>
                  </div>
                )}
              </div>

              {/* Subjects Assignment Section */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-200">
                {/* Header with expand/collapse trigger */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex-shrink-0">
                      <GraduationCap className="h-3.5 w-3.5 text-white" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-800">Subject Assignments</h3>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-purple-600 hover:bg-purple-100/50 rounded-lg"
                    onClick={() => setIsSubjectAssignmentsOpen(!isSubjectAssignmentsOpen)}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isSubjectAssignmentsOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </div>

                {/* Always visible collapsed view: Selected Subjects & Teachers list */}
                {!isSubjectAssignmentsOpen && (
                  <div className="mt-3">
                    {selectedSubjectIds.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedSubjectIds.map(subjectId => {
                          const subject = subjects.find(s => s.id === subjectId);
                          if (!subject) return null;
                          const assignedTeachers = (subjectTeacherAssignments[subjectId] || []);
                          const teacherNames = assignedTeachers
                            .map(teacherId => {
                              const teacher = teachingStaff.find(t => t.id === teacherId);
                              return teacher ? `${teacher.firstName} ${teacher.lastName}` : null;
                            })
                            .filter(Boolean)
                            .join(', ');
                          return (
                            <div key={subjectId} className="flex items-center justify-between gap-2 p-2 bg-white/80 hover:bg-white border border-purple-100 rounded-lg shadow-sm transition-all">
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-xs text-purple-900 block truncate">{subject.name}</span>
                                <span className="text-[10px] text-gray-500 block truncate">
                                  {teacherNames || 'No teacher assigned'}
                                </span>
                              </div>
                              <SearchableSubjectTeacherSelector
                                subjectId={subjectId}
                                assignedTeacherIds={assignedTeachers}
                                onTeacherToggle={handleSubjectTeacherChange}
                                teachers={teachingStaff}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic mt-1 pl-8">No subjects selected. Click expand to assign subjects.</p>
                    )}
                  </div>
                )}

                {/* Expanded view: Subject Selection Checklist */}
                {isSubjectAssignmentsOpen && (
                  <div className="mt-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
                    <ScrollArea className="h-64">
                      <div className="p-3">
                        {subjects.length === 0 ? (
                          <div className="text-center text-gray-500 py-6">
                            <Book className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                            <p className="text-sm">No subjects available.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {subjects.map(subject => {
                              const isSelected = selectedSubjectIds.includes(subject.id);

                              return (
                                <div
                                  key={subject.id}
                                  className={`rounded-lg p-2.5 border transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer ${
                                    isSelected
                                      ? 'border-purple-300 bg-purple-50/60 shadow-sm'
                                      : 'border-gray-200 hover:bg-gray-50/80 bg-white'
                                  }`}
                                  onClick={() => handleSubjectToggle(subject.id)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`p-1 rounded-md flex-shrink-0 ${
                                      isSelected ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                      <Book className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-xs font-semibold text-gray-900 block truncate">{subject.name}</span>
                                      <span className="text-[10px] text-gray-400 block font-mono">{subject.code}</span>
                                    </div>
                                  </div>
                                  <Checkbox
                                    id={`subject-${subject.id}`}
                                    checked={isSelected}
                                    onCheckedChange={() => handleSubjectToggle(subject.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-3.5 w-3.5 rounded-sm flex-shrink-0"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

        </ModernDialogContent>
      </ModernDialog>
    </>
  );
}
