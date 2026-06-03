"use client";

import * as React from "react";
import ReactDOM from "react-dom";
import { PlusCircle, Plus, MoreHorizontal, Edit, Trash2, BookOpen, CornerDownRight, Indent, FilePenLine, Eye, Calendar, Search, X, Filter, ChevronDown, ChevronUp, User, School, Type, CalendarIcon, InfoIcon, LayoutList, LayoutGrid, RefreshCw, GraduationCap, Users, Target, Clock, PlayCircle, CheckCircle, Camera, CalendarClock, Sparkles, Info, Loader2, Printer } from "lucide-react"; // Added more icons
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator, // Added
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ModernDatePicker } from "@/components/common/modern-date-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MultiSelect } from "@/components/ui/multi-select";
import { useToast } from "@/hooks/use-toast";
import type { Exam, ExamStatus, ExamNature, Class, Subject, AcademicYear, Term, ExamResult, ExamRecordPupilInfo, ExamRecordSubjectInfo, PupilSubjectResult, ExamClassInfoSnapshot, GradingScaleItem } from "@/types";
import {
  sampleExamTypes
} from "@/lib/sample-data";
import { useClasses } from "@/lib/hooks/use-classes";
import { useActivePupils } from "@/lib/hooks/use-pupils";
import { useSubjects } from "@/lib/hooks/use-subjects";
import { useExams, useExamsOptimized, useCreateExam, useCreateMultipleExams, useUpdateExam, useDeleteExam, useCreateExamResult, useUpdateExamResult } from "@/lib/hooks/use-exams";
import { useAcademicYears, useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
import { useCreateExamFromEvent } from "@/lib/hooks/use-events-fixed";
import { useActivePupilsOptimized } from "@/lib/hooks/use-pupils";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { getEffectiveTermForDataDisplay } from "@/lib/utils/term-status-utils";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";
import { useRecordSignatures } from "@/lib/hooks/use-digital-signature";
import { DigitalSignatureDisplay } from "@/components/common/digital-signature-display";
import { ExamSignatureDisplay } from "@/components/exam/ExamSignatureDisplay";
import { formatPupilDisplayName } from "@/lib/utils/name-formatter";
import { ExamsService } from "@/lib/services/exams.service";

import { DEFAULT_GRADING_SCALE, EXAM_NATURES, OTHER_EXAM_TYPE_ID } from "@/lib/constants"; // Ensure OTHER_EXAM_TYPE_ID is exported
import { format, parseISO, isValid, startOfDay, getYear as getYearFromDateFns, isWithinInterval } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";

// Safe date parsing utility
const safeParseDateString = (dateString: string | undefined | null): Date | null => {
  if (!dateString) return null;
  try {
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

// Smart date range formatting utility
const formatDateRange = (startDate: string | undefined | null, endDate: string | undefined | null): string => {
  const start = safeParseDateString(startDate);
  const end = safeParseDateString(endDate);

  if (!start && !end) return 'N/A';
  if (!start) return end ? format(end, "MMM dd, yyyy") : 'N/A';
  if (!end) return format(start, "MMM dd, yyyy");

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const startMonth = start.getMonth();
  const endMonth = end.getMonth();
  const startDay = start.getDate();
  const endDay = end.getDate();

  // Same day
  if (start.getTime() === end.getTime()) {
    return format(start, "MMM dd, yyyy");
  }

  // Same year and month
  if (startYear === endYear && startMonth === endMonth) {
    return `${startDay} - ${endDay}, ${format(start, "MMM yyyy")}`;
  }

  // Same year, different months
  if (startYear === endYear) {
    return `${format(start, "MMM dd")} - ${format(end, "MMM dd")}, ${startYear}`;
  }

  // Different years
  return `${format(start, "MMM dd, yyyy")} - ${format(end, "MMM dd, yyyy")}`;
};

const cloneDefaultGradingScale = (): GradingScaleItem[] =>
  DEFAULT_GRADING_SCALE.map((item) => ({
    minMark: item.minMark,
    maxMark: item.maxMark,
    grade: item.grade,
    aggregates: item.aggregates,
    comment: item.comment,
  }));

const normalizeGradingScale = (gradingScale?: GradingScaleItem[]): GradingScaleItem[] => {
  if (!gradingScale || gradingScale.length === 0) {
    return cloneDefaultGradingScale();
  }

  return gradingScale.map((item, index) => ({
    minMark: Number(item.minMark ?? 0),
    maxMark: Number(item.maxMark ?? 0),
    grade: item.grade || DEFAULT_GRADING_SCALE[index]?.grade || '',
    aggregates: Number(item.aggregates ?? DEFAULT_GRADING_SCALE[index]?.aggregates ?? 0),
    comment: item.comment,
  }));
};

// Exam status utility
const getExamStatus = (startDate: string | undefined | null, endDate: string | undefined | null) => {
  const start = safeParseDateString(startDate);
  const end = safeParseDateString(endDate);
  const now = new Date();

  if (!start || !end) return { status: 'scheduled', text: 'Scheduled', icon: Calendar, color: 'text-gray-600' };

  if (now < start) {
    const daysUntil = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil === 0) return { status: 'today', text: 'Starts Today', icon: PlayCircle, color: 'text-orange-600' };
    if (daysUntil === 1) return { status: 'tomorrow', text: 'Starts Tomorrow', icon: Clock, color: 'text-blue-600' };
    return { status: 'upcoming', text: `Starts in ${daysUntil} days`, icon: Clock, color: 'text-blue-600' };
  }

  if (now > end) {
    const daysAgo = Math.ceil((now.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) return { status: 'ended_today', text: 'Ended Today', icon: CheckCircle, color: 'text-green-600' };
    if (daysAgo === 1) return { status: 'ended_yesterday', text: 'Ended Yesterday', icon: CheckCircle, color: 'text-green-600' };
    return { status: 'ended', text: 'Ended', icon: CheckCircle, color: 'text-green-600' };
  }

  // Ongoing
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const currentDay = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (totalDays === 1) return { status: 'ongoing_single', text: 'Ongoing Today', icon: PlayCircle, color: 'text-orange-600' };
  return { status: 'ongoing', text: `Ongoing: Day ${currentDay}/${totalDays}`, icon: PlayCircle, color: 'text-orange-600' };
};

export default function ExamsPage() {
  const { toast } = useToast();
  const router = useRouter();

  // Add mounted state to prevent hydration mismatches
  const [mounted, setMounted] = React.useState(false);

  // Firebase hooks - Progressive loading approach
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  const { data: subjects = [], isLoading: subjectsLoading } = useSubjects();
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();

  // 🚀 CRITICAL: Get term status early, before initializing filters
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();

  // 🚀 OPTIMIZED: Only load pupils when exam creation dialog is open
  const [pupilsLoaded, setPupilsLoaded] = React.useState(false);
  const { data: pupils = [], isLoading: pupilsLoading } = useActivePupilsOptimized({ enabled: pupilsLoaded });

  // 🚀 OPTIMIZED: Load exams with current academic year filter by default
  const [examsFilters, setExamsFilters] = React.useState<{
    academicYearId: string | undefined;
    termId: string | undefined;
    includeAll: boolean;
  }>({
    academicYearId: undefined,
    termId: undefined,
    includeAll: false
  });

  // 🚀 CRITICAL: Track if filters have been initialized with effective term
  const [filtersInitialized, setFiltersInitialized] = React.useState(false);

  const { data: exams = [], isLoading: examsLoading, error: examsError } = useExamsOptimized({
    academicYearId: examsFilters.academicYearId,
    termId: examsFilters.termId,
    includeAll: examsFilters.includeAll,
    enabled: filtersInitialized && (!!examsFilters.academicYearId || examsFilters.includeAll)
  });

  // Add state for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [examToDelete, setExamToDelete] = React.useState<Exam | null>(null);
  const [examStackToDelete, setExamStackToDelete] = React.useState<{ examIds: string[]; label: string } | null>(null);
  const [adminPassword, setAdminPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState(false);

  // List page filters state for academic year and term
  const [listFilters, setListFilters] = React.useState<{
    academicYearId: string;
    termId: string;
    classId: string;
    examTypeId: string;
    searchTerm: string;
  }>({
    academicYearId: 'all',
    termId: 'all',
    classId: 'all',
    examTypeId: 'all',
    searchTerm: ''
  });

  // Find the current term within the active academic year (fallback for backward compatibility)
  const getCurrentTerm = React.useCallback(() => {
    if (!activeAcademicYear || !mounted) return null;

    // Use the effective term from the new system
    if (effectiveTerm.term) {
      return effectiveTerm.term;
    }

    // Fallback to old logic - ensure activeAcademicYear has terms
    if (!activeAcademicYear.terms || activeAcademicYear.terms.length === 0) {
      return null;
    }

    const currentDate = new Date();
    const currentTerm = activeAcademicYear.terms.find(term => {
      const termStart = new Date(term.startDate);
      const termEnd = new Date(term.endDate);
      return currentDate >= termStart && currentDate <= termEnd;
    });

    return currentTerm || activeAcademicYear.terms[0] || null;
  }, [activeAcademicYear, mounted, effectiveTerm]);

  // Get current term date range for exam scheduling
  const getCurrentTermDateRange = React.useCallback(() => {
    const currentTerm = getCurrentTerm();
    if (!currentTerm) return { minDate: undefined, maxDate: undefined };

    return {
      minDate: new Date(currentTerm.startDate),
      maxDate: new Date(currentTerm.endDate)
    };
  }, [getCurrentTerm]);

  // Mount effect to prevent hydration mismatches
  React.useEffect(() => {
    setMounted(true);
    // Set creation date only on client side to prevent hydration mismatch
    setCreationDate(format(new Date(), "yyyy-MM-dd"));
  }, []);

  // Update list filters when active year changes (only after mounting)
  React.useEffect(() => {
    const currentYear = effectiveTerm?.academicYear;
    if (currentYear && mounted && !filtersInitialized) {
      const termIdValue = effectiveTerm.term?.id || 'all';

      console.log('🔍 Effective Term Debug:', {
        termId: effectiveTerm.term?.id,
        termName: effectiveTerm.term?.name,
        reason: effectiveTerm.reason,
        academicYearId: currentYear.id
      });

      setListFilters(prev => ({
        ...prev,
        academicYearId: currentYear.id,
        termId: termIdValue
      }));

      // 🚀 CRITICAL: Also update examsFilters to ensure exams are fetched with the correct term
      setExamsFilters(prev => ({
        ...prev,
        academicYearId: currentYear.id,
        termId: termIdValue === 'all' ? undefined : termIdValue,
        includeAll: termIdValue === 'all'
      }));

      // 🚀 CRITICAL: Mark filters as initialized to enable the query
      setFiltersInitialized(true);
    }
  }, [effectiveTerm, mounted, filtersInitialized]);

  // Handle list filter change
  const handleListFilterChange = (key: 'academicYearId' | 'termId' | 'classId' | 'examTypeId' | 'searchTerm', value: string) => {
    setListFilters(prev => ({ ...prev, [key]: value }));

    // 🚀 OPTIMIZED: Update exams query filters when academic year or term changes
    if (key === 'academicYearId' || key === 'termId') {
      setExamsFilters(prev => ({
        ...prev,
        academicYearId: key === 'academicYearId' ? value : prev.academicYearId,
        termId: key === 'termId' ? value : prev.termId,
        includeAll: value === 'all'
      }));

      // 🚀 CRITICAL: Mark filters as initialized when user manually changes filters
      setFiltersInitialized(true);
    }
  };

  // Mutations
  const createExamMutation = useCreateExam();
  const createMultipleExamsMutation = useCreateMultipleExams();
  const updateExamMutation = useUpdateExam();
  const deleteExamMutation = useDeleteExam();
  const createExamResultMutation = useCreateExamResult();
  const updateExamResultMutation = useUpdateExamResult();
  const createExamFromEventMutation = useCreateExamFromEvent();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingExam, setEditingExam] = React.useState<Exam | null>(null);

  // Form state
  const [examName, setExamName] = React.useState("");
  const [assessmentName, setAssessmentName] = React.useState(""); // New field for CAT
  const [setNumber, setSetNumber] = React.useState(""); // Auto-generated set number for CAT
  const [examTypeId, setExamTypeId] = React.useState("");
  const [customExamTypeName, setCustomExamTypeName] = React.useState("");
  const [examNature, setExamNature] = React.useState<ExamNature>("");

  const [selectedClassIdsForm, setSelectedClassIdsForm] = React.useState<string[]>([]);
  const [perClassExamNatures, setPerClassExamNatures] = React.useState<Record<string, ExamNature>>({});
  const [perClassSelectedSubjects, setPerClassSelectedSubjects] = React.useState<Record<string, string[]>>({});


  const [startDate, setStartDate] = React.useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = React.useState("");
  const [endDate, setEndDate] = React.useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = React.useState("");

  const [maxMarks, setMaxMarks] = React.useState<number | string>(100);
  const [passingMarks, setPassingMarks] = React.useState<number | string>(40);
  const [instructions, setInstructions] = React.useState("");

  // Mark as Event state
  const [markAsEvent, setMarkAsEvent] = React.useState(false);

  // Continuous Assessment states
  const [isAddingSet, setIsAddingSet] = React.useState(false);
  const [baseExamForSet, setBaseExamForSet] = React.useState<Exam | null>(null);

  // Auto-detected academic context (not editable by user)
  const [academicYearId, setAcademicYearId] = React.useState<string | undefined>(undefined);
  const [termId, setTermId] = React.useState<string | undefined>(undefined);
  const [creationDate, setCreationDate] = React.useState<string>("");
  const [availableTerms, setAvailableTerms] = React.useState<Term[]>([]);
  const [stackGradingScaleDialogOpen, setStackGradingScaleDialogOpen] = React.useState(false);
  const [stackGradingScaleTarget, setStackGradingScaleTarget] = React.useState<{ label: string; examIds: string[] } | null>(null);
  const [stackGradingScaleDraft, setStackGradingScaleDraft] = React.useState<GradingScaleItem[]>(cloneDefaultGradingScale());
  const [isSavingStackGradingScale, setIsSavingStackGradingScale] = React.useState(false);

  // 🚀 DYNAMIC YEAR LABELS
  const currentAcademicYearId = React.useMemo(() => {
    if (academicYears.length === 0) return null;
    const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
    return effectiveTerm?.academicYear?.id || null;
  }, [academicYears]);

  React.useEffect(() => {
    if (academicYears.length > 0) {
      const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
      const detectedYearId = effectiveTerm?.academicYear?.id;
      const detectedTermId = effectiveTerm?.term?.id;

      if (academicYearId !== detectedYearId) {
        setAcademicYearId(detectedYearId);
      }
      if (termId !== detectedTermId) {
        setTermId(detectedTermId);
      }

      // 🚀 REMOVED: Don't update examsFilters here - let the effectiveTerm useEffect handle it
      // This prevents double initialization with potentially wrong term
    } else {
      // No academic years available
      if (academicYearId !== undefined) setAcademicYearId(undefined);
      if (termId !== undefined) setTermId(undefined);
    }
  }, [academicYears, academicYearId, termId]);

  React.useEffect(() => {
    if (academicYearId) {
      const selectedYearData = academicYears.find(ay => ay.id === academicYearId);
      const newTerms = selectedYearData?.terms || [];

      setAvailableTerms(currentTerms => {
        if (currentTerms.length === newTerms.length && currentTerms.every((term, index) => term.id === newTerms[index]?.id)) {
          return currentTerms; // Avoid update if content is the same
        }
        return newTerms;
      });

      const currentTermIsValidInNewList = newTerms.some(t => t.id === termId);
      if (!currentTermIsValidInNewList && newTerms.length > 0) {
        setTermId(newTerms[0].id);
      } else if (newTerms.length === 0 && termId !== undefined) { // Only set to undefined if it's not already undefined
        setTermId(undefined);
      }
      // If termId is valid, or newTerms is empty and termId is already undefined, no change to termId here.
    } else {
      setAvailableTerms(currentTerms => {
        if (currentTerms.length === 0) {
          return currentTerms; // Avoid update if already empty
        }
        return [];
      });
      if (termId !== undefined) { // Only set to undefined if it's not already undefined
        setTermId(undefined);
      }
    }
  }, [academicYearId, academicYears, termId]);


  const getSubjectsForClass = React.useCallback((classId: string): Subject[] => {
    const cls = allClasses.find(c => c.id === classId);
    if (!cls || !cls.subjectAssignments) return [];
    return cls.subjectAssignments
      .map(sa => subjects.find((s: Subject) => s.id === sa.subjectId))
      .filter(Boolean) as Subject[];
  }, [allClasses, subjects]);

  const getExamNatureForClass = React.useCallback((classId: string): ExamNature => {
    if (editingExam || isAddingSet) {
      return examNature;
    }

    return perClassExamNatures[classId] || examNature;
  }, [editingExam, isAddingSet, perClassExamNatures, examNature]);

  const availableSubjectsForSelection = React.useMemo(() => {
    if (examNature !== 'Subject based' || selectedClassIdsForm.length === 0) {
      return [];
    }
    const allSubjectIds = new Set<string>();
    selectedClassIdsForm.forEach(classId => {
      const cls = allClasses.find(c => c.id === classId);
      if (cls && cls.subjectAssignments) {
        cls.subjectAssignments.forEach(sa => {
          const subject = subjects.find((s: Subject) => s.id === sa.subjectId);
          if (subject) {
            allSubjectIds.add(subject.id);
          }
        });
      }
    });
    return subjects.filter((sub: Subject) => allSubjectIds.has(sub.id));
  }, [selectedClassIdsForm, examNature, allClasses, subjects]);


  React.useEffect(() => {
    setPerClassExamNatures(prev => {
      const next = { ...prev };
      let changed = false;

      selectedClassIdsForm.forEach(classId => {
        if (!next[classId] && examNature) {
          next[classId] = examNature;
          changed = true;
        }
      });

      Object.keys(next).forEach(classId => {
        if (!selectedClassIdsForm.includes(classId)) {
          delete next[classId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [selectedClassIdsForm, examNature]);

  React.useEffect(() => {
    const selectedSubjectBasedClasses = new Set(
      selectedClassIdsForm.filter(classId => getExamNatureForClass(classId) === 'Subject based')
    );

    setPerClassSelectedSubjects(prev => {
      const next = { ...prev };
      let changed = false;

      Object.keys(next).forEach(classId => {
        if (!selectedSubjectBasedClasses.has(classId)) {
          delete next[classId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [selectedClassIdsForm, getExamNatureForClass]);

  React.useEffect(() => {
    // Only run this effect when classes or exam nature changes, not when perClassSelectedSubjects changes
    setPerClassSelectedSubjects(prev => {
      const newPerClassSelections = { ...prev };
      let changed = false;

      // Filter subjects for newly added classes or existing classes
      selectedClassIdsForm.forEach(classId => {
        if (getExamNatureForClass(classId) !== 'Subject based') {
          if (newPerClassSelections[classId]) {
            delete newPerClassSelections[classId];
            changed = true;
          }
          return;
        }

        const cls = allClasses.find(c => c.id === classId);
        const subjectsForThisClass = cls && cls.subjectAssignments
          ? cls.subjectAssignments
            .map(sa => subjects.find((s: Subject) => s.id === sa.subjectId))
            .filter(Boolean)
            .map(s => s!.id)
          : [];

        const currentSelectionForClass = newPerClassSelections[classId] || [];
        const validSelectionForClass = currentSelectionForClass.filter(subId => subjectsForThisClass.includes(subId));

        if (!newPerClassSelections[classId] || JSON.stringify(validSelectionForClass) !== JSON.stringify(currentSelectionForClass)) {
          newPerClassSelections[classId] = validSelectionForClass;
          changed = true;
        }
      });

      // Remove selections for classes that were deselected
      Object.keys(newPerClassSelections).forEach(classId => {
        if (!selectedClassIdsForm.includes(classId)) {
          delete newPerClassSelections[classId];
          changed = true;
        }
      });

      return changed ? newPerClassSelections : prev;
    });
  }, [selectedClassIdsForm, examNature, perClassExamNatures, allClasses, subjects, getExamNatureForClass]);


  const resetForm = () => {
    setExamName("");
    setAssessmentName(""); // Reset assessment name
    setSetNumber(""); // Reset set number
    setExamTypeId("");
    setCustomExamTypeName("");
    setExamNature("");
    setSelectedClassIdsForm([]);
    setPerClassExamNatures({});
    setPerClassSelectedSubjects({});
    setStartDate(undefined);
    setEndDate(undefined);
    setMaxMarks(100);
    setPassingMarks(40);
    setInstructions("");
    setMarkAsEvent(false); // Reset mark as event
    setEditingExam(null);
    setIsAddingSet(false);
    setBaseExamForSet(null);

    // Academic year and term are auto-detected and not reset by user action
    // They remain as detected by the system
  };

  const handleAddExam = () => {
    // Opens the exam creation dialog - button working properly
    resetForm();
    setIsAddingSet(false);
    setBaseExamForSet(null);
    setIsDialogOpen(true);
  };

  const handleAddSet = (baseExam: Exam) => {
    // Find the highest set number for this exam series
    const relatedExams = exams.filter(exam =>
      exam.examTypeId === 'et_cat' &&
      exam.baseName === baseExam.baseName &&
      exam.academicYearId === baseExam.academicYearId &&
      exam.termId === baseExam.termId
    );

    const setNumbers = relatedExams.map(exam => {
      const match = exam.name.match(/SET (\d+)$/i);
      return match ? parseInt(match[1]) : 1;
    });

    const nextSetNumber = Math.max(...setNumbers, 0) + 1;

    // Pre-populate form with base exam data
    setBaseExamForSet(baseExam);
    setIsAddingSet(true);
    setEditingExam(null);

    // Extract assessment name from base exam name (remove " - EXAM NAME - SET X" part)
    const baseAssessmentName = baseExam.baseName || baseExam.name.split(' - ')[0];

    // Set form values from base exam
    setExamName(""); // User can enter their own exam name for this set
    setAssessmentName(baseAssessmentName); // This is the assessment name (inherited)
    setSetNumber(`SET ${nextSetNumber}`); // Auto-generated set number (non-editable)
    setExamTypeId(baseExam.examTypeId);
    setCustomExamTypeName(baseExam.customExamTypeName || "");
    setExamNature(baseExam.examNature || "");
    setSelectedClassIdsForm([baseExam.classId]);
    setPerClassExamNatures({ [baseExam.classId]: baseExam.examNature || "" });
    setMaxMarks(baseExam.maxMarks);
    setPassingMarks(baseExam.passingMarks);
    setInstructions(baseExam.instructions || "");

    // Copy subject selections if subject-based
    if (baseExam.examNature === 'Subject based' && baseExam.subjectIds) {
      setPerClassSelectedSubjects({
        [baseExam.classId]: baseExam.subjectIds
      });
    }

    // Reset dates and times to be filled by user
    setStartDate(undefined);
    setEndDate(undefined);
    setStartTime("");
    setEndTime("");

    setIsDialogOpen(true);
  };

  const handleEditExam = (examToEdit: Exam) => {
    setEditingExam(examToEdit);

    // For CAT exams, separate assessment name, exam name, and set number
    if (examToEdit.examTypeId === 'et_cat') {
      const setMatch = examToEdit.name.match(/SET (\d+)$/i);
      if (setMatch) {
        setSetNumber(`SET ${setMatch[1]}`);
        // Parse: "Assessment Name - Exam Name - SET X"
        const nameParts = examToEdit.name.replace(/ - SET \d+$/i, '').split(' - ');
        if (nameParts.length >= 2) {
          setAssessmentName(nameParts[0]);
          setExamName(nameParts.slice(1).join(' - ')); // In case exam name has dashes
        } else {
          setAssessmentName(examToEdit.baseName || nameParts[0]);
          setExamName("");
        }
      } else {
        setExamName(examToEdit.name);
        setAssessmentName(examToEdit.baseName || "");
        setSetNumber("");
      }
    } else {
      setExamName(examToEdit.baseName || examToEdit.name);
      setAssessmentName("");
      setSetNumber("");
    }

    setExamTypeId(examToEdit.examTypeId);
    setCustomExamTypeName(examToEdit.customExamTypeName || "");
    setExamNature(examToEdit.examNature || "");
    setSelectedClassIdsForm([examToEdit.classId]);
    setPerClassExamNatures({ [examToEdit.classId]: examToEdit.examNature || "" });

    const currentPerClassSubjects: Record<string, string[]> = {};
    if (examToEdit.examNature === 'Subject based' && examToEdit.subjectIds) {
      currentPerClassSubjects[examToEdit.classId] = examToEdit.subjectIds;
    }
    setPerClassSelectedSubjects(currentPerClassSubjects);

    setStartDate(safeParseDateString(examToEdit.startDate) || undefined);
    setEndDate(safeParseDateString(examToEdit.endDate) || undefined);
    setMaxMarks(examToEdit.maxMarks);
    setPassingMarks(examToEdit.passingMarks);
    setInstructions(examToEdit.instructions || "");

    // For existing exams, preserve their original academic context
    // This ensures historical accuracy and prevents accidental changes
    setAcademicYearId(examToEdit.academicYearId);
    setTermId(examToEdit.termId);

    setIsDialogOpen(true);
  };

  const handleDeleteExam = async (examId: string) => {
    const examToDelete = exams.find(ex => ex.id === examId);
    if (!examToDelete) return;

    // Instead of directly deleting, set the exam to delete and open the dialog
    setExamToDelete(examToDelete);
    setExamStackToDelete(null);
    setAdminPassword("");
    setPasswordError(false);
    setDeleteDialogOpen(true);
  };

  const handleDeleteExamStack = React.useCallback((examIds: string[], label: string) => {
    if (!examIds.length) return;
    setExamToDelete(null);
    setExamStackToDelete({ examIds, label });
    setAdminPassword("");
    setPasswordError(false);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = async () => {
    // Simple password validation - in a real app, this would be more secure
    // Use a hardcoded password for demo purposes
    const correctPassword = "admin123"; // In a real app, this would be verified server-side

    if (adminPassword !== correctPassword) {
      setPasswordError(true);
      return;
    }

    if (!examToDelete && !examStackToDelete) return;

    try {
      if (examStackToDelete) {
        for (const examId of examStackToDelete.examIds) {
          await deleteExamMutation.mutateAsync(examId);
        }
      } else if (examToDelete) {
        await deleteExamMutation.mutateAsync(examToDelete.id);
      }
      toast({
        title: examStackToDelete ? "Exam Stack Deleted" : "Exam Deleted",
        description: examStackToDelete
          ? `The stack "${examStackToDelete.label}" has been removed.`
          : `Exam "${examToDelete?.baseName || examToDelete?.name}" has been removed.`
      });
      setDeleteDialogOpen(false);
      setExamToDelete(null);
      setExamStackToDelete(null);
      setAdminPassword("");
    } catch (error) {
      console.error('Error deleting exam:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: examStackToDelete ? "Failed to delete exam stack. Please try again." : "Failed to delete exam. Please try again."
      });
    }
  };

  const handleClassIdCheckboxChange = (classId: string, checked: boolean | string) => {
    setSelectedClassIdsForm(prev =>
      checked ? [...prev, classId] : prev.filter(id => id !== classId)
    );
    if (!checked) {
      setPerClassSelectedSubjects(prev => {
        const newState = { ...prev };
        delete newState[classId];
        return newState;
      });
    }
  };

  const handlePerClassSubjectIdChange = (classId: string, subjectId: string, checked: boolean | string) => {
    setPerClassSelectedSubjects(prev => {
      const updatedForClass = checked
        ? [...(prev[classId] || []), subjectId]
        : (prev[classId] || []).filter(id => id !== subjectId);
      return { ...prev, [classId]: updatedForClass };
    });
  };

  const handlePerClassExamNatureChange = React.useCallback((classId: string, nature: ExamNature) => {
    setPerClassExamNatures(prev => ({ ...prev, [classId]: nature }));

    if (nature === 'Set based') {
      setPerClassSelectedSubjects(prev => {
        if (!prev[classId]) return prev;
        const next = { ...prev };
        delete next[classId];
        return next;
      });
    }
  }, []);

  const handleOpenStackGradingScaleDialog = React.useCallback(async (stackExams: Exam[], label: string) => {
    try {
      let initialScale = cloneDefaultGradingScale();

      for (const exam of stackExams) {
        const examResult = await ExamsService.getExamResultByExamId(exam.id);
        if (examResult?.gradingScale && examResult.gradingScale.length > 0) {
          initialScale = normalizeGradingScale(examResult.gradingScale);
          break;
        }
      }

      setStackGradingScaleTarget({
        label,
        examIds: stackExams.map(exam => exam.id),
      });
      setStackGradingScaleDraft(initialScale);
      setStackGradingScaleDialogOpen(true);
    } catch (error) {
      console.error('Error loading stack grading scale:', error);
      toast({
        variant: "destructive",
        title: "Unable to load grading scale",
        description: "Please try again."
      });
    }
  }, [toast]);

  const handleSaveStackGradingScale = React.useCallback(async () => {
    if (!stackGradingScaleTarget) return;

    const cleanedScale = stackGradingScaleDraft.map((item) => ({
      minMark: Number(item.minMark),
      maxMark: Number(item.maxMark),
      grade: item.grade.trim(),
      aggregates: Number(item.aggregates ?? 0),
      comment: item.comment,
    }));

    const hasInvalidScale = cleanedScale.some((item) =>
      Number.isNaN(item.minMark) ||
      Number.isNaN(item.maxMark) ||
      item.grade.length === 0 ||
      item.minMark > item.maxMark
    );

    if (hasInvalidScale) {
      toast({
        variant: "destructive",
        title: "Invalid grading scale",
        description: "Each row needs a valid mark range and grade."
      });
      return;
    }

    setIsSavingStackGradingScale(true);

    try {
      await Promise.all(
        stackGradingScaleTarget.examIds.map(async (examId) => {
          const examResult = await ExamsService.getExamResultByExamId(examId);
          if (!examResult) return;

          await updateExamResultMutation.mutateAsync({
            id: examResult.id,
            data: {
              examId,
              gradingScale: cleanedScale,
            }
          });
        })
      );

      toast({
        title: "Stack grading scale updated",
        description: `Applied to ${stackGradingScaleTarget.examIds.length} class report${stackGradingScaleTarget.examIds.length === 1 ? '' : 's'}.`
      });
      setStackGradingScaleDialogOpen(false);
      setStackGradingScaleTarget(null);
    } catch (error) {
      console.error('Error saving stack grading scale:', error);
      toast({
        variant: "destructive",
        title: "Failed to save grading scale",
        description: "Please try again."
      });
    } finally {
      setIsSavingStackGradingScale(false);
    }
  }, [stackGradingScaleTarget, stackGradingScaleDraft, toast, updateExamResultMutation]);

  const handleSubmit = async () => {
    // For CAT exams, also require assessment name and exam name
    const isCATExam = examTypeId === 'et_cat';
    if (!examTypeId || !startDate || !endDate || selectedClassIdsForm.length === 0 || !maxMarks || !passingMarks || !academicYearId || !termId || !examNature || (isCATExam && (!assessmentName || !examName)) || (!isCATExam && !examName)) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill all required fields (*)." });
      return;
    }
    if (examTypeId === OTHER_EXAM_TYPE_ID && !customExamTypeName.trim()) {
      toast({ variant: "destructive", title: "Missing Custom Name", description: "Please provide a name for the 'Other' exam type." });
      return;
    }
    const perClassNatures = selectedClassIdsForm.reduce<Record<string, ExamNature>>((acc, classId) => {
      acc[classId] = getExamNatureForClass(classId);
      return acc;
    }, {});

    if (selectedClassIdsForm.some(classId => !perClassNatures[classId])) {
      toast({ variant: "destructive", title: "Missing Exam Nature", description: "Please choose the exam nature for each selected class." });
      return;
    }

    if (selectedClassIdsForm.some(classId => perClassNatures[classId] === 'Subject based' && (!perClassSelectedSubjects[classId] || perClassSelectedSubjects[classId].length === 0))) {
      toast({ variant: "destructive", title: "Missing Subjects", description: "Each subject-based class needs at least one selected subject." });
      return;
    }

    const marks = Number(maxMarks);
    const pMarks = Number(passingMarks);
    if (isNaN(marks) || marks <= 0 || isNaN(pMarks) || pMarks < 0 || pMarks > marks) {
      toast({ variant: "destructive", title: "Invalid Marks", description: "Max marks must be positive. Passing marks must be between 0 and max marks." });
      return;
    }
    if (endDate < startDate) {
      toast({ variant: "destructive", title: "Invalid Dates", description: "End date cannot be before start date." });
      return;
    }

    let determinedStatus: ExamStatus;
    const today = startOfDay(new Date());
    const normalizedStartDate = startOfDay(startDate);
    const normalizedEndDate = startOfDay(endDate);

    if (today < normalizedStartDate) {
      determinedStatus = "Scheduled";
    } else if (today >= normalizedStartDate && today <= normalizedEndDate) {
      determinedStatus = "Ongoing";
    } else {
      determinedStatus = "Completed";
    }

    try {
      if (editingExam) {
        // Construct proper name for editing
        const finalExamName = isCATExam ? `${assessmentName} - ${examName} - ${setNumber}` : examName;
        const finalBaseName = isCATExam ? assessmentName : examName;

        await updateExamMutation.mutateAsync({
          id: editingExam.id, data: {
            name: finalExamName,
            baseName: finalBaseName,
            examTypeId,
            examTypeName: sampleExamTypes.find(et => et.id === examTypeId)?.name,
            customExamTypeName: examTypeId === OTHER_EXAM_TYPE_ID ? customExamTypeName : undefined,
            examNature: examNature,
            subjectIds: examNature === 'Subject based' ? perClassSelectedSubjects[editingExam.classId] : undefined,
            startDate: format(startDate, "yyyy-MM-dd"),
            startTime: "",
            endDate: format(endDate, "yyyy-MM-dd"),
            endTime: "",
            maxMarks: marks,
            passingMarks: pMarks,
            status: determinedStatus,
            instructions,
          }
        });
        toast({ title: "Exam Updated", description: "The exam has been successfully updated." });
      } else {
        const currentBatchId = isAddingSet && baseExamForSet?.batchId ? baseExamForSet.batchId : `batch-${Date.now()}`;
        const baseName = isAddingSet && baseExamForSet?.baseName ? baseExamForSet.baseName : (isCATExam ? assessmentName : examName);

        const newExamsData = selectedClassIdsForm.map((classId) => {
          const classExamNature = perClassNatures[classId];
          // Generate unique examResultId for each exam
          const examResultId = `er-${currentBatchId}-${classId}`;

          // Construct proper exam name
          const finalExamName = isCATExam ? `${assessmentName} - ${examName} - ${setNumber || "SET 1"}` : examName;

          return {
            name: finalExamName,
            baseName: baseName,
            batchId: currentBatchId,
            examTypeId,
            examTypeName: sampleExamTypes.find(et => et.id === examTypeId)?.name,
            customExamTypeName: examTypeId === OTHER_EXAM_TYPE_ID ? customExamTypeName : undefined,
            examNature: classExamNature,
            classId: classId,
            subjectIds: classExamNature === 'Subject based' ? perClassSelectedSubjects[classId] : undefined,
            academicYearId,
            termId,
            startDate: format(startDate, "yyyy-MM-dd"),
            startTime: "",
            endDate: format(endDate, "yyyy-MM-dd"),
            endTime: "",
            maxMarks: marks,
            passingMarks: pMarks,
            status: determinedStatus,
            instructions,
            examResultId: examResultId, // Add examResultId to each exam
          };
        });

        // Create the exams first
        const createdExamIds = await createMultipleExamsMutation.mutateAsync(newExamsData);

        // Create exam result shells for each exam
        const examResultShellsPromises = newExamsData.map(async (examData, index) => {
          const targetClass = allClasses.find(c => c.id === examData.classId);
          const pupilsInClass = pupils.filter(p => p.classId === examData.classId);

          // Create Class Snapshot
          let classSnapshotData: ExamClassInfoSnapshot | undefined = undefined;
          if (targetClass) {
            const classSubjectsTaught = targetClass.subjectAssignments?.map(sa => {
              const subjectDetail = subjects.find(s => s.id === sa.subjectId);
              return {
                subjectId: sa.subjectId,
                subjectName: subjectDetail?.name || 'N/A',
                subjectCode: subjectDetail?.code || 'N/A',
                teacherIds: sa.teacherIds || []
              };
            }) || [];

            const pupilsInClassSnapshot = pupilsInClass.map(p => ({
              pupilId: p.id,
              name: formatPupilDisplayName(p),
              admissionNumber: p.admissionNumber,
            }));

            classSnapshotData = {
              classId: targetClass.id,
              name: targetClass.name,
              code: targetClass.code,
              level: targetClass.level,
              classTeacherId: targetClass.classTeacherId,
              classTeacherName: targetClass.classTeacherName,
              subjectsTaught: classSubjectsTaught,
              pupilsInClassAtExamCreation: pupilsInClassSnapshot,
            };
          }

          const pupilSnapshots = pupilsInClass.map(p => ({
            pupilId: p.id,
            name: formatPupilDisplayName(p),
            admissionNumber: p.admissionNumber,
            classNameAtExam: targetClass?.name || 'N/A',
            classCodeAtExam: targetClass?.code || undefined,
            section: p.section,
            status: p.status,
            gender: p.gender,
            dateOfBirth: p.dateOfBirth, // Include date of birth in snapshot
            ageAtExam: examData.startDate && p.dateOfBirth ?
              safeParseDateString(examData.startDate)?.getFullYear()! - safeParseDateString(p.dateOfBirth)?.getFullYear()! : undefined
          }));

          let subjectSnapshots: ExamRecordSubjectInfo[] = [];
          if (examData.examNature === 'Set based' && targetClass) {
            const classAssignments = targetClass.subjectAssignments || [];
            subjectSnapshots = classAssignments.map(sa => {
              const subj = subjects.find(s => s.id === sa.subjectId);
              if (!subj) return null;

              // Handle both new array format and legacy string format for teacher ID
              const teacherId = (sa as any).teacherIds?.[0] || (sa as any).teacherId || null;

              return {
                subjectId: subj.id,
                name: subj.name,
                code: subj.code,
                maxMarks: examData.maxMarks,
                passingMarks: examData.passingMarks,
                teacherId: teacherId,
              };
            }).filter(Boolean) as ExamRecordSubjectInfo[];
          } else if (examData.examNature === 'Subject based' && examData.subjectIds) {
            subjectSnapshots = examData.subjectIds
              .map(subId => {
                const subj = subjects.find(s => s.id === subId);
                if (!subj) return null;
                const assignment = targetClass?.subjectAssignments?.find(sa => sa.subjectId === subId);
                return {
                  subjectId: subId,
                  name: subj.name,
                  code: subj.code,
                  maxMarks: examData.maxMarks,
                  passingMarks: examData.passingMarks,
                  teacherId: assignment ? (assignment.teacherIds?.[0] || (assignment as any).teacherId || null) : null,
                };
              })
              .filter(Boolean) as ExamRecordSubjectInfo[];
          }

          const initialResultsForPupils: Record<string, Record<string, PupilSubjectResult>> = {};
          pupilSnapshots.forEach(pupil => {
            initialResultsForPupils[pupil.pupilId] = {};
            subjectSnapshots.forEach(subject => {
              initialResultsForPupils[pupil.pupilId][subject.subjectId] = {
                subjectId: subject.subjectId,
                marks: undefined,
                grade: '-',
                aggregates: undefined,
                comment: 'N/A'
              };
            });
          });

          const examResultShell: Omit<ExamResult, 'id'> = {
            examId: createdExamIds[index],
            classId: examData.classId,
            classSnapshot: classSnapshotData,
            pupilSnapshots,
            subjectSnapshots,
            results: initialResultsForPupils,
            recordedAt: new Date().toISOString(),
            isPublished: false,
          };
          // This is where we ensure the examResultId from the exam is used for the ExamResult document ID
          // The useCreateExamResult hook might generate its own ID if we don't provide one.
          // For now, let's assume createExamResultMutation can take the full shell including an ID if needed,
          // or the backend service handles ID generation.
          // The examData.examResultId was intended for this.
          // Let's adjust to pass an object that can be used by createExamResult service, which might expect specific data structure.
          // The hook `useCreateExamResult` likely takes the data part, and the service generates the ID.
          return createExamResultMutation.mutateAsync(examResultShell);
        });

        // Wait for all exam result shells to be created
        await Promise.all(examResultShellsPromises);

        console.log('All exam result shells have been processed.');

        // Create event if markAsEvent is true
        if (markAsEvent) {
          try {
            const finalExamName = isCATExam ? `${assessmentName} - ${examName} - ${setNumber || "SET 1"}` : examName;

            await createExamFromEventMutation.mutateAsync({
              title: finalExamName,
              description: instructions || `Exam scheduled for ${selectedClassIdsForm.length} class(es)`,
              startDate: format(startDate, "yyyy-MM-dd"),
              endDate: format(endDate, "yyyy-MM-dd"),
              startTime: "",
              endTime: "",
              location: "",
              academicYearId: academicYearId!,
              termId: termId!,
              examTypeId: examTypeId,
              examNature: examNature,
              selectedClassIds: selectedClassIdsForm,
              perClassSelectedSubjects: perClassSelectedSubjects,
              maxMarks: marks,
              passingMarks: pMarks,
              instructions: instructions || "",
            });

            toast({
              title: "Exam Event Created",
              description: `Exam(s) scheduled and event created in Events & Calendar component.`
            });
          } catch (eventError) {
            console.error('Error creating exam event:', eventError);
            toast({
              variant: "destructive",
              title: "Event Creation Failed",
              description: "Exam(s) were created but event creation failed. You can manually create an event later."
            });
          }
        } else {
          toast({ title: "Exam(s) Scheduled", description: `${newExamsData.length} exam instance(s) have been added with status: ${determinedStatus}. Result recording is now available.` });
        }
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving exam:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save exam. Please try again."
      });
    }
  };

  const getStatusBadgeVariant = (examStatus: ExamStatus) => {
    switch (examStatus) {
      case 'Scheduled': return 'default';
      case 'Ongoing': return 'secondary';
      case 'Completed': return 'outline';
      case 'Graded': return 'default';
      case 'Cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const groupedAndSortedExams = React.useMemo(() => {
    const sorted = [...exams].sort((a, b) => {
      const dateA = safeParseDateString(a.startDate);
      const dateB = safeParseDateString(b.startDate);

      // Handle null dates by putting them at the end
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      const dateComparison = dateB.getTime() - dateA.getTime();
      if (dateComparison !== 0) return dateComparison;
      return (a.baseName || a.name).localeCompare(b.baseName || b.name);
    });

    // Filter exams by all filter criteria
    const filtered = sorted.filter(exam => {
      let matchesFilters = true;

      // Academic year filter
      if (listFilters.academicYearId !== 'all') {
        matchesFilters = matchesFilters && exam.academicYearId === listFilters.academicYearId;
      }

      // Term filter
      if (listFilters.termId !== 'all') {
        matchesFilters = matchesFilters && exam.termId === listFilters.termId;
      }

      // Class filter
      if (listFilters.classId !== 'all') {
        matchesFilters = matchesFilters && exam.classId === listFilters.classId;
      }

      // Exam type filter
      if (listFilters.examTypeId !== 'all') {
        matchesFilters = matchesFilters && exam.examTypeId === listFilters.examTypeId;
      }

      // Search term filter
      if (listFilters.searchTerm.trim() !== '') {
        const searchLower = listFilters.searchTerm.toLowerCase().trim();
        const nameMatch = (exam.name || '').toLowerCase().includes(searchLower);
        const baseNameMatch = (exam.baseName || '').toLowerCase().includes(searchLower);
        const customTypeMatch = (exam.customExamTypeName || '').toLowerCase().includes(searchLower);
        matchesFilters = matchesFilters && (nameMatch || baseNameMatch || customTypeMatch);
      }

      return matchesFilters;
    });

    // Group differently for CAT vs regular exams
    const grouped: Record<string, Exam[]> = {};
    filtered.forEach(exam => {
      let key: string;

      if (exam.examTypeId === 'et_cat') {
        // For CAT exams, group by assessment name (baseName) + academic context
        key = `cat_${exam.baseName || exam.name.split(' - ')[0]}_${exam.academicYearId}_${exam.termId}`;
      } else {
        // For regular exams, group by batchId as before
        key = exam.batchId || exam.id;
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(exam);
    });

    return Object.values(grouped).flatMap((group) =>
      group.map((exam, examIndex) => ({
        ...exam,
        isFirstInBatch: examIndex === 0,
      }))
    );
  }, [exams, listFilters]);

  // Add mobile view state
  const [filtersExpanded, setFiltersExpanded] = React.useState(false);
  const [viewType, setViewType] = React.useState<'table' | 'cards'>('cards');

  // State for batch exam expansion
  const [expandedBatches, setExpandedBatches] = React.useState<Record<string, boolean>>({});
  const [selectedCollapsedBatchExams, setSelectedCollapsedBatchExams] = React.useState<Record<string, string>>({});

  const getClassMeta = React.useCallback((classId?: string | null) => {
    const classItem = allClasses.find(c => c.id === classId);
    return {
      name: classItem?.name || 'Unknown Class',
      code: classItem?.code || 'N/A',
    };
  }, [allClasses]);

  const openExamPrintOptions = React.useCallback((exam: Exam) => {
    router.push(`/exams/${exam.id}/view-results?classId=${exam.classId}&openPrint=1`);
  }, [router]);

  // Function to detect screen size on mount
  React.useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 768) {
        setViewType('cards');
      }
    };

    // Check on mount
    checkScreenSize();

    // Set up listener for window resize
    window.addEventListener('resize', checkScreenSize);

    // Clean up
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // 🚀 OPTIMIZED: Progressive loading - show page as soon as core data is loaded
  const coreDataLoading = classesLoading || examsLoading || academicYearsLoading;
  const isPageReady = !coreDataLoading && mounted;

  // Load pupils when user opens exam creation dialog
  React.useEffect(() => {
    if (isDialogOpen && !pupilsLoaded) {
      setPupilsLoaded(true);
    }
  }, [isDialogOpen, pupilsLoaded]);

  // Detect offline state
  const [isOffline, setIsOffline] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    // Check initial state
    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 🚀 ENHANCED: Keep loader until page is truly ready
  if (coreDataLoading || !mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-800">Loading Exam Management</h2>
            <p className="text-sm text-gray-600">Fetching exam data and preparing interface...</p>
            {coreDataLoading && (
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Loading core data...</span>
              </div>
            )}
            {!mounted && (
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Initializing application...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 🚀 ENHANCED: Show error state with better UX
  if (examsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <X className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-800">Unable to Load Exams</h2>
            <p className="text-sm text-gray-600">There was an error fetching exam data. Please check your connection and try again.</p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto p-4 space-y-6 animate-in slide-in-from-bottom-4 duration-700">
        <PageHeader
          title="Exam Management"
          description="Schedule, track, and manage all school examinations."
          actions={
            <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setViewType(viewType === 'table' ? 'cards' : 'table');
                }}
                type="button"
                className="hidden sm:flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-gray-600 border border-gray-400 shadow-sm hover:bg-gradient-to-br hover:from-gray-400 hover:via-gray-500 hover:to-gray-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                title={viewType === 'table' ? 'Switch to Card View' : 'Switch to Table View'}
              >
                {viewType === 'table' ? <LayoutGrid className="w-4 h-4 mb-0.5" /> : <LayoutList className="w-4 h-4 mb-0.5" />}
                <span className="text-[8px] font-semibold leading-tight">View</span>
              </button>

              <button
                onClick={() => router.push('/remark-report')}
                type="button"
                className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-indigo-600 border border-indigo-400 shadow-sm hover:bg-gradient-to-br hover:from-indigo-400 hover:via-purple-500 hover:to-indigo-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <GraduationCap className="w-4 h-4 mb-0.5" />
                <span className="text-[8px] font-semibold leading-tight">Nursery</span>
              </button>

              <button
                onClick={() => router.push('/exams/ple-results')}
                type="button"
                className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-purple-600 border border-purple-400 shadow-sm hover:bg-gradient-to-br hover:from-purple-400 hover:via-violet-500 hover:to-purple-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <BookOpen className="w-4 h-4 mb-0.5" />
                <span className="text-[8px] font-semibold leading-tight">PLE</span>
              </button>

              <button
                onClick={handleAddExam}
                type="button"
                className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-blue-600 border border-blue-400 shadow-sm hover:bg-gradient-to-br hover:from-blue-400 hover:via-indigo-500 hover:to-blue-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <PlusCircle className="w-4 h-4 mb-0.5" />
                <span className="text-[8px] font-semibold leading-tight">Add</span>
              </button>
            </div>
          }
        />

        {/* Offline Indicator */}
        {isOffline && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-amber-800">Working Offline</p>
              <p className="text-xs text-amber-700">You're viewing cached data. Some features may be limited.</p>
            </div>
          </div>
        )}

        {/* Show recess status banner if in recess mode */}
        <RecessStatusBanner />

        {/* Responsive filters section */}
        <div className="rounded-lg border shadow-sm mb-4">
          <div
            className="p-3 border-b bg-muted/30 flex items-center justify-between cursor-pointer"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Filters</h3>
              {(listFilters.academicYearId !== 'all' ||
                listFilters.termId !== 'all' ||
                listFilters.classId !== 'all' ||
                listFilters.examTypeId !== 'all' ||
                listFilters.searchTerm.trim() !== '') && (
                  <Badge variant="secondary" className="text-xs">Active</Badge>
                )}
            </div>
            {filtersExpanded ?
              <ChevronUp className="h-4 w-4 text-muted-foreground" /> :
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </div>

          {filtersExpanded && (
            <div className="p-3">
              {/* Search bar */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search exams..."
                    value={listFilters.searchTerm}
                    onChange={(e) => handleListFilterChange('searchTerm', e.target.value)}
                    className="pl-8 h-9"
                  />
                  {listFilters.searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 rounded-full hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                      onClick={() => handleListFilterChange('searchTerm', '')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs font-medium">Academic Year</Label>
                  </div>
                  <Select
                    value={listFilters.academicYearId}
                    onValueChange={(value) => handleListFilterChange('academicYearId', value)}
                    disabled={academicYearsLoading}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">All Academic Years</SelectItem>
                      {academicYears.map(year => {
                        const isCurrent = year.id === currentAcademicYearId;
                        const today = new Date();
                        const yearEnd = new Date(year.endDate);
                        const hasEnded = today > yearEnd;

                        let label = '';
                        if (isCurrent) {
                          label = ' (Current)';
                        } else if (year.isLocked) {
                          label = ' (Locked)';
                        } else if (!hasEnded) {
                          label = ' (Upcoming)';
                        }

                        return (
                          <SelectItem key={year.id} value={year.id}>
                            {year.name}{label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <InfoIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs font-medium">Term</Label>
                  </div>
                  <Select
                    value={listFilters.termId}
                    onValueChange={(value) => handleListFilterChange('termId', value)}
                    disabled={academicYearsLoading || listFilters.academicYearId === 'all'}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Term" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">All Terms</SelectItem>
                      {listFilters.academicYearId !== 'all' &&
                        academicYears.find(ay => ay.id === listFilters.academicYearId)?.terms.map(term => (
                          <SelectItem key={term.id} value={term.id}>
                            {term.name}{term.isCurrent ? ' (Current)' : ''}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <School className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs font-medium">Class</Label>
                  </div>
                  <Select
                    value={listFilters.classId}
                    onValueChange={(value) => handleListFilterChange('classId', value)}
                    disabled={classesLoading}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">All Classes</SelectItem>
                      {allClasses.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Type className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs font-medium">Exam Type</Label>
                  </div>
                  <Select
                    value={listFilters.examTypeId}
                    onValueChange={(value) => handleListFilterChange('examTypeId', value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">All Types</SelectItem>
                      {sampleExamTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-2 border-gray-300 hover:border-red-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200 shadow-sm hover:shadow-md h-8 px-4"
                  onClick={() => {
                    const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
                    setListFilters({
                      academicYearId: effectiveTerm?.academicYear?.id || 'all',
                      termId: effectiveTerm?.term?.id || 'all',
                      classId: 'all',
                      examTypeId: 'all',
                      searchTerm: ''
                    });
                  }}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  <span className="font-medium text-xs">Reset Filters</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Show either table or card view based on viewType */}
        {viewType === 'table' ? (
          // Table view - Modern Batch Design
          <div className="space-y-4">
            {groupedAndSortedExams.length === 0 && (
              <div className="text-center p-8 border rounded-lg">
                <p className="text-muted-foreground">No exams scheduled.</p>
                <Button onClick={handleAddExam} className="mt-4">
                  <PlusCircle className="mr-2 h-4 w-4" /> Schedule New Exam
                </Button>
              </div>
            )}

            {/* Group exams by batch - Table Version */}
            {(() => {
              const batchGrouped: Record<string, Exam[]> = {};
              groupedAndSortedExams.forEach(exam => {
                let batchKey: string;

                if (exam.examTypeId === 'et_cat') {
                  // For CAT exams, group by assessment name + academic context
                  batchKey = `cat_${exam.baseName || exam.name.split(' - ')[0]}_${exam.academicYearId}_${exam.termId}`;
                } else {
                  // For regular exams, group by batchId as before
                  batchKey = exam.batchId || exam.id;
                }

                if (!batchGrouped[batchKey]) {
                  batchGrouped[batchKey] = [];
                }
                batchGrouped[batchKey].push(exam);
              });

              return Object.entries(batchGrouped).map(([batchId, exams]) => {
                const firstExam = exams[0];
                const isExpanded = expandedBatches[batchId] || false;
                const isCATExam = firstExam.examTypeId === 'et_cat';
                const showBatchHeader = exams.length > 1;
                const selectedCollapsedExam = exams.find(exam => exam.id === selectedCollapsedBatchExams[batchId]) || exams[0];

                return (
                  <div
                    key={batchId}
                    className={
                      showBatchHeader
                        ? "overflow-hidden rounded-[24px] border border-blue-100 bg-white shadow-[0_18px_42px_-28px_rgba(59,130,246,0.35)] transition-all duration-300 hover:shadow-[0_24px_56px_-30px_rgba(59,130,246,0.28)]"
                        : "overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_42px_-30px_rgba(15,23,42,0.16)] transition-all duration-300 hover:border-slate-300 hover:shadow-[0_24px_54px_-32px_rgba(15,23,42,0.18)]"
                    }
                  >
                    {showBatchHeader && (
                      <div className={`px-3 py-2.5 ${isCATExam ? 'bg-gradient-to-r from-purple-500 to-indigo-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                          <h3 className="text-white font-semibold text-sm">
                            {isCATExam ? (firstExam.baseName || firstExam.name.split(' - ')[0]) : (firstExam.baseName || firstExam.name)}
                            {firstExam.customExamTypeName && (
                              <span className="text-blue-100 font-normal"> ({firstExam.customExamTypeName})</span>
                            )}
                          </h3>
                          <Badge variant="secondary" className="border-white/30 bg-white/15 text-white text-xs font-medium">
                            {isCATExam ? 'Continuous Assessment' : getExamStatus(firstExam.startDate, firstExam.endDate).text.replace(/^Ongoing: Day \d+\/\d+$/, 'Ongoing')}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          {isCATExam ? (
                            // For CAT exams, show classes in header
                            <div className="flex items-center gap-1">
                              <span className="text-white/90 text-xs mr-1">Classes:</span>
                              {Array.from(new Set(exams.map(e => e.classId))).map((classId, idx) => {
                                const classCode = allClasses.find(c => c.id === classId)?.code || 'N/A';
                                const uniqueClassIds = Array.from(new Set(exams.map(e => e.classId)));
                                return (
                                  <span key={classId} className="inline-flex items-center">
                                    <div className="w-5 h-5 bg-white/20 rounded-md flex items-center justify-center">
                                      <span className="text-white font-bold text-xs">
                                        {classCode}
                                      </span>
                                    </div>
                                    {idx < uniqueClassIds.length - 1 && <span className="text-white/60 text-xs mx-1">•</span>}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-white/90 text-xs">
                              {exams.length} class{exams.length !== 1 ? 'es' : ''}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStackGradingScaleDialog(exams, firstExam.baseName || firstExam.name)}
                            className="h-7 w-7 rounded-full border border-white/20 p-0 hover:bg-white/20 transition-colors"
                            title="Edit grading scale for this stack"
                          >
                            <GraduationCap className="h-3 w-3 text-white" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExamStack(exams.map(exam => exam.id), firstExam.baseName || firstExam.name)}
                            className="h-7 w-7 rounded-full border border-white/20 p-0 hover:bg-white/20 transition-colors"
                            title="Delete entire stack"
                          >
                            <Trash2 className="h-3 w-3 text-white" />
                          </Button>
                          {(() => {
                            if (isCATExam) {
                              // For CAT exams, check if there are multiple sets
                              const setGroups: Record<string, Exam[]> = {};
                              exams.forEach(exam => {
                                const setMatch = exam.name.match(/SET (\d+)$/i);
                                const setNumber = setMatch ? setMatch[1] : '1';
                                const setKey = `SET ${setNumber}`;

                                if (!setGroups[setKey]) {
                                  setGroups[setKey] = [];
                                }
                                setGroups[setKey].push(exam);
                              });

                              const setCount = Object.keys(setGroups).length;
                              return setCount > 1;
                            } else {
                              // For regular exams, check if there are multiple classes
                              return exams.length > 1;
                            }
                          })() && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedBatches(prev => ({ ...prev, [batchId]: !isExpanded }))}
                                className="h-7 w-7 rounded-full border border-white/20 p-0 hover:bg-white/20 transition-colors"
                              >
                                <ChevronDown className={`h-3 w-3 text-white transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </Button>
                            )}
                        </div>
                      </div>
                      </div>
                    )}

                    {/* Table Content */}
                    <div className="overflow-hidden">
                      <Table>
                        <TableBody>
                          {isCATExam ? (
                            // CAT Exam rendering - group by sets and show exam names
                            (() => {
                              // Group exams by set number for CAT exams
                              const setGroups: Record<string, Exam[]> = {};
                              exams.forEach(exam => {
                                const setMatch = exam.name.match(/SET (\d+)$/i);
                                const setNumber = setMatch ? setMatch[1] : '1';
                                const setKey = `SET ${setNumber}`;

                                if (!setGroups[setKey]) {
                                  setGroups[setKey] = [];
                                }
                                setGroups[setKey].push(exam);
                              });

                              // Sort sets by number
                              const sortedSets = Object.entries(setGroups).sort(([a], [b]) => {
                                const numA = parseInt(a.split(' ')[1]);
                                const numB = parseInt(b.split(' ')[1]);
                                return numA - numB;
                              });

                              // For CAT exams, respect the main batch collapse/expand state
                              const setsToShow = isExpanded ? sortedSets : sortedSets.slice(0, 1);

                              return (
                                <>
                                  {setsToShow.map(([setName, setExams], setIndex) => {
                                    const firstSetExam = setExams[0];
                                    const isSetExpanded = expandedBatches[`${batchId}_${setName}`] || false;

                                    return (
                                      <React.Fragment key={setName}>
                                        {/* Set header row */}
                                        <TableRow className="border-b border-gray-100">
                                          <TableCell className="font-medium text-sm">
                                            <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-md flex items-center justify-center">
                                                <span className="text-white font-bold text-xs">
                                                  {setName.split(' ')[1]}
                                                </span>
                                              </div>
                                              <span className="font-semibold">{setName}</span>
                                              {setExams.length > 1 && (
                                                <Badge variant="secondary" className="text-xs">
                                                  {setExams.length} exam{setExams.length !== 1 ? 's' : ''}
                                                </Badge>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell className="hidden md:table-cell text-xs text-gray-600">
                                            {setExams.length === 1 || isSetExpanded ? (
                                              // Extract exam name (remove assessment name and set number)
                                              firstSetExam.name.replace(new RegExp(`^${firstSetExam.baseName} - `), '').replace(/ - SET \d+$/i, '')
                                            ) : (
                                              <span className="text-gray-500">{setExams.length} different exams</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="hidden lg:table-cell text-xs text-gray-600">
                                            {firstSetExam.examNature === 'Subject based'
                                              ? (firstSetExam.subjectIds && firstSetExam.subjectIds.length > 0
                                                ? `${firstSetExam.subjectIds.length} Subject${firstSetExam.subjectIds.length !== 1 ? 's' : ''}`
                                                : 'No Subjects')
                                              : 'All Subjects'
                                            }
                                          </TableCell>
                                          <TableCell className="hidden sm:table-cell text-xs">
                                            <div className="space-y-1">
                                              <div className="text-gray-800 font-medium">
                                                {formatDateRange(firstSetExam.startDate, firstSetExam.endDate)}
                                              </div>
                                              {(() => {
                                                const status = getExamStatus(firstSetExam.startDate, firstSetExam.endDate);
                                                const IconComponent = status.icon;
                                                return (
                                                  <div className={`flex items-center gap-1 ${status.color}`}>
                                                    <IconComponent className="h-3 w-3" />
                                                    <span className="text-xs">{status.text}</span>
                                                  </div>
                                                );
                                              })()}
                                              {/* Digital Signature Display */}
                                              <ExamSignatureDisplay
                                                exam={firstSetExam}
                                                variant="inline"
                                                className="mt-1"
                                              />
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <div className="flex gap-1 justify-end">
                                              {setExams.length === 1 || isSetExpanded ? (
                                                <>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                    className="h-8 w-8 p-0 rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                                    title="Record Results"
                                                  >
                                                    <Link href={`/exams/${firstSetExam.id}/record-results?classId=${firstSetExam.classId}`}>
                                                      <FilePenLine className="h-4 w-4" />
                                                    </Link>
                                                  </Button>

                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openExamPrintOptions(firstSetExam)}
                                                    className="h-8 w-8 p-0 rounded-full border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                                    title="Print Reports"
                                                  >
                                                    <Printer className="h-4 w-4" />
                                                  </Button>

                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                    className="h-8 w-8 p-0 rounded-full border-2 border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                                    title="View Results"
                                                  >
                                                    <Link href={`/exams/${firstSetExam.id}/view-results?classId=${firstSetExam.classId}`}>
                                                      <Eye className="h-4 w-4" />
                                                    </Link>
                                                  </Button>

                                                  {/* Edit Snapshot button */}
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                    className="h-8 w-8 p-0 rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                                    title="Edit Snapshot Data"
                                                  >
                                                    <Link href={`/exams/${firstSetExam.id}/edit-snapshot`}>
                                                      <Camera className="h-4 w-4" />
                                                    </Link>
                                                  </Button>
                                                </>
                                              ) : null}

                                              {/* Add Set button for the latest set */}
                                              {sortedSets.findIndex(([name]) => name === setName) === sortedSets.length - 1 && (
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => handleAddSet(firstSetExam)}
                                                  className="h-8 w-8 p-0 rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                                  title="Add Set"
                                                >
                                                  <Plus className="h-4 w-4" />
                                                </Button>
                                              )}

                                              {/* Delete Set button */}
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  // Delete all exams in this set
                                                  const examIds = setExams.map(exam => exam.id);
                                                  handleDeleteExamStack(examIds, `${firstSetExam.baseName || firstSetExam.name} ${setName}`);
                                                }}
                                                className="h-8 w-8 p-0 rounded-full border-2 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                                title="Delete Set"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>

                                              {setExams.length > 1 && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => setExpandedBatches(prev => ({ ...prev, [`${batchId}_${setName}`]: !isSetExpanded }))}
                                                  className="h-8 w-8 p-0 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md"
                                                >
                                                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isSetExpanded ? 'rotate-180' : ''}`} />
                                                </Button>
                                              )}
                                            </div>
                                          </TableCell>
                                        </TableRow>

                                        {/* Show individual exam names when expanded */}
                                        {isSetExpanded && setExams.slice(1).map((exam) => {
                                          const examName = exam.name.replace(new RegExp(`^${exam.baseName} - `), '').replace(/ - SET \d+$/i, '');

                                          return (
                                            <TableRow key={exam.id} className="border-b border-gray-100 bg-gray-50/30">
                                              <TableCell className="font-medium text-sm">
                                                <div className="flex items-center gap-2 pl-6">
                                                  <CornerDownRight className="h-3 w-3 text-gray-400" />
                                                  <span className="text-gray-600 text-xs">Class: {allClasses.find(c => c.id === exam.classId)?.name || 'Unknown'}</span>
                                                </div>
                                              </TableCell>
                                              <TableCell className="hidden md:table-cell text-xs text-gray-600">
                                                {examName}
                                              </TableCell>
                                              <TableCell className="hidden lg:table-cell text-xs text-gray-600">
                                                {exam.examNature === 'Subject based'
                                                  ? (exam.subjectIds && exam.subjectIds.length > 0
                                                    ? `${exam.subjectIds.length} Subject${exam.subjectIds.length !== 1 ? 's' : ''}`
                                                    : 'No Subjects')
                                                  : 'All Subjects'
                                                }
                                              </TableCell>
                                              <TableCell className="hidden sm:table-cell text-xs">
                                                <div className="space-y-1">
                                                  <div className="text-gray-800 font-medium">
                                                    {formatDateRange(exam.startDate, exam.endDate)}
                                                  </div>
                                                  {(() => {
                                                    const status = getExamStatus(exam.startDate, exam.endDate);
                                                    const IconComponent = status.icon;
                                                    return (
                                                      <div className={`flex items-center gap-1 ${status.color}`}>
                                                        <IconComponent className="h-3 w-3" />
                                                        <span className="text-xs">{status.text}</span>
                                                      </div>
                                                    );
                                                  })()}
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                <div className="flex gap-1 justify-end">
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                    className="h-7 w-7 p-0 rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                                    title="Record Results"
                                                  >
                                                    <Link href={`/exams/${exam.id}/record-results?classId=${exam.classId}`}>
                                                      <FilePenLine className="h-3 w-3" />
                                                    </Link>
                                                  </Button>

                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                    className="h-7 w-7 p-0 rounded-full border-2 border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                                    title="View Results"
                                                  >
                                                    <Link href={`/exams/${exam.id}/view-results?classId=${exam.classId}`}>
                                                      <Eye className="h-3 w-3" />
                                                    </Link>
                                                  </Button>

                                                  {/* Edit Snapshot button */}
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                    className="h-7 w-7 p-0 rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                                    title="Edit Snapshot Data"
                                                  >
                                                    <Link href={`/exams/${exam.id}/edit-snapshot`}>
                                                      <Camera className="h-3 w-3" />
                                                    </Link>
                                                  </Button>

                                                  {/* Delete button for individual CAT exam */}
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDeleteExam(exam.id)}
                                                    className="h-7 w-7 p-0 rounded-full border-2 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                                    title="Delete Exam"
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </React.Fragment>
                                    );
                                  })}

                                  {/* Show collapse indicator when there are multiple sets and collapsed */}
                                  {!isExpanded && sortedSets.length > 1 && (
                                    <TableRow className="border-b border-gray-100 bg-purple-50/30">
                                      <TableCell colSpan={5} className="text-center py-3">
                                        <div className="flex items-center justify-center gap-2 text-purple-700">
                                          <ChevronDown className="h-4 w-4" />
                                          <span className="text-sm">
                                            {sortedSets.length - 1} more set{sortedSets.length - 1 !== 1 ? 's' : ''} • Click expand to view all
                                          </span>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </>
                              );
                            })()
                          ) : (
                            // Regular exam rendering (existing logic)
                            <>
                              {/* Show first class or all classes when collapsed */}
                              <TableRow className="border-b border-gray-100">
                                <TableCell className="font-medium text-sm">
                                  {exams.length === 1 || isExpanded ? (
                                    // Single class OR expanded - show first class avatar only
                                    <div className="flex items-center gap-3">
                                      <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                                        <span className="text-white font-bold text-xs">
                                          {allClasses.find(c => c.id === firstExam.classId)?.code || 'N/A'}
                                        </span>
                                      </div>
                                      {exams.length === 1 && (
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-semibold text-gray-900">
                                            {firstExam.baseName || firstExam.name}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {firstExam.examTypeName || firstExam.examTypeId}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    // Multiple classes collapsed - show clickable class codes
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {exams.map((exam) => {
                                          const classMeta = getClassMeta(exam.classId);
                                          const isSelectedClass = selectedCollapsedExam.id === exam.id;
                                          return (
                                            <button
                                              key={exam.id}
                                              type="button"
                                              onClick={() => setSelectedCollapsedBatchExams(prev => ({ ...prev, [batchId]: exam.id }))}
                                              className={`inline-flex items-center justify-center w-7 h-7 rounded-md border text-xs font-bold transition-all ${
                                                isSelectedClass
                                                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                  : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50'
                                              }`}
                                              title={`Show actions for ${classMeta.name}`}
                                            >
                                              {classMeta.code}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {exams.length} classes • Click a class to reveal its actions
                                      </div>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-xs text-gray-600">
                                  {exams.length === 1 || isExpanded ? (
                                    firstExam.examTypeName || firstExam.examTypeId
                                  ) : (
                                    <span className="text-gray-500">Multiple classes</span>
                                  )}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-xs text-gray-600">
                                  {exams.length === 1 || isExpanded ? (
                                    firstExam.examNature === 'Subject based'
                                      ? (firstExam.subjectIds && firstExam.subjectIds.length > 0
                                        ? `${firstExam.subjectIds.length} Subject${firstExam.subjectIds.length !== 1 ? 's' : ''}`
                                        : 'No Subjects')
                                      : 'All Subjects'
                                  ) : (
                                    <span className="text-gray-500">Varies by class</span>
                                  )}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-xs">
                                  {exams.length === 1 || isExpanded ? (
                                    <div className="space-y-1">
                                      <div className="text-gray-800 font-medium">
                                        {formatDateRange(firstExam.startDate, firstExam.endDate)}
                                      </div>
                                      {(() => {
                                        const status = getExamStatus(firstExam.startDate, firstExam.endDate);
                                        const IconComponent = status.icon;
                                        return (
                                          <div className={`flex items-center gap-1 ${status.color}`}>
                                            <IconComponent className="h-3 w-3" />
                                            <span className="text-xs">{status.text}</span>
                                          </div>
                                        );
                                      })()}
                                      {/* Digital Signature Display */}
                                      <ExamSignatureDisplay
                                        exam={firstExam}
                                        variant="inline"
                                        className="mt-1"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-gray-500">Same date</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {exams.length === 1 || isExpanded ? (
                                    // Single class OR expanded - show action buttons for first class
                                    <div className="flex gap-1 justify-end">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                        className="h-7 w-7 p-0 rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                        title="Record Results"
                                      >
                                        <Link href={`/exams/${firstExam.id}/record-results?classId=${firstExam.classId}`}>
                                          <FilePenLine className="h-3 w-3" />
                                        </Link>
                                      </Button>

                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openExamPrintOptions(firstExam)}
                                        className="h-7 w-7 p-0 rounded-full border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                        title="Print Reports"
                                      >
                                        <Printer className="h-3 w-3" />
                                      </Button>

                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                        className="h-7 w-7 p-0 rounded-full border-2 border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                        title="View Results"
                                      >
                                        <Link href={`/exams/${firstExam.id}/view-results?classId=${firstExam.classId}`}>
                                          <Eye className="h-3 w-3" />
                                        </Link>
                                      </Button>

                                      {/* Edit Snapshot button */}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                        className="h-7 w-7 p-0 rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                        title="Edit Snapshot Data"
                                      >
                                        <Link href={`/exams/${firstExam.id}/edit-snapshot`}>
                                          <Camera className="h-3 w-3" />
                                        </Link>
                                      </Button>

                                      {/* Delete button for regular exams */}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteExam(firstExam.id)}
                                        className="h-7 w-7 p-0 rounded-full border-2 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                        title="Delete Exam"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>

                                      {/* Show collapse button when expanded and there are multiple classes */}
                                      {exams.length > 1 && isExpanded && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setExpandedBatches(prev => ({ ...prev, [batchId]: !isExpanded }))}
                                          className="h-7 px-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors ml-1"
                                        >
                                          <ChevronDown className="h-3 w-3 rotate-180" />
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    // Multiple classes collapsed - show selected class actions plus stack controls
                                    <div className="flex items-center justify-end gap-1">
                                      <div className="hidden xl:flex items-center mr-2 text-xs text-gray-500">
                                        {getClassMeta(selectedCollapsedExam.classId).code}
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                        className="h-7 w-7 p-0 rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                        title="Record Results"
                                      >
                                        <Link href={`/exams/${selectedCollapsedExam.id}/record-results?classId=${selectedCollapsedExam.classId}`}>
                                          <FilePenLine className="h-3 w-3" />
                                        </Link>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openExamPrintOptions(selectedCollapsedExam)}
                                        className="h-7 w-7 p-0 rounded-full border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                        title="Print Reports"
                                      >
                                        <Printer className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                        className="h-7 w-7 p-0 rounded-full border-2 border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                        title="View Results"
                                      >
                                        <Link href={`/exams/${selectedCollapsedExam.id}/view-results?classId=${selectedCollapsedExam.classId}`}>
                                          <Eye className="h-3 w-3" />
                                        </Link>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                        className="h-7 w-7 p-0 rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                        title="Edit Snapshot Data"
                                      >
                                        <Link href={`/exams/${selectedCollapsedExam.id}/edit-snapshot`}>
                                          <Camera className="h-3 w-3" />
                                        </Link>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteExam(selectedCollapsedExam.id)}
                                        className="h-7 w-7 p-0 rounded-full border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all duration-200 shadow-sm hover:shadow-md"
                                        title="Delete This Class Exam"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setExpandedBatches(prev => ({ ...prev, [batchId]: !isExpanded }))}
                                        className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                                      >
                                        <ChevronDown className="h-3 w-3 mr-1" />
                                        Expand
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>

                              {/* Show additional classes when expanded */}
                              {isExpanded && exams.slice(1).map((exam, index) => {
                                const className = allClasses.find(c => c.id === exam.classId)?.name || 'Unknown';

                                return (
                                  <TableRow key={exam.id} className="border-b border-gray-100 bg-gray-50/30">
                                    <TableCell className="font-medium text-sm">
                                      <div className="flex items-center gap-2 pl-4">
                                        <CornerDownRight className="h-3 w-3 text-gray-400" />
                                        <div className="w-6 h-6 bg-gradient-to-br from-gray-400 to-gray-500 rounded-md flex items-center justify-center">
                                          <span className="text-white font-bold text-xs">
                                            {allClasses.find(c => c.id === exam.classId)?.code || 'N/A'}
                                          </span>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-xs text-gray-500">
                                      {/* Empty for additional rows */}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell text-xs text-gray-600">
                                      {exam.examNature === 'Subject based' && exam.subjectIds
                                        ? `${exam.subjectIds.length} subject${exam.subjectIds.length !== 1 ? 's' : ''}`
                                        : 'All subjects'
                                      }
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-xs text-gray-500">
                                      {/* Empty for additional rows */}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex gap-1 justify-end">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          asChild
                                          className="h-7 w-7 p-0 rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                          title="Record Results"
                                        >
                                          <Link href={`/exams/${exam.id}/record-results?classId=${exam.classId}`}>
                                            <FilePenLine className="h-3 w-3" />
                                          </Link>
                                        </Button>

                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openExamPrintOptions(exam)}
                                          className="h-7 w-7 p-0 rounded-full border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                          title="Print Reports"
                                        >
                                          <Printer className="h-3 w-3" />
                                        </Button>

                                        <Button
                                          variant="outline"
                                          size="sm"
                                          asChild
                                          className="h-7 w-7 p-0 rounded-full border-2 border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                          title="View Results"
                                        >
                                          <Link href={`/exams/${exam.id}/view-results?classId=${exam.classId}`}>
                                            <Eye className="h-3 w-3" />
                                          </Link>
                                        </Button>

                                        {/* Edit Snapshot button */}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          asChild
                                          className="h-7 w-7 p-0 rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                          title="Edit Snapshot Data"
                                        >
                                          <Link href={`/exams/${exam.id}/edit-snapshot`}>
                                            <Camera className="h-3 w-3" />
                                          </Link>
                                        </Button>

                                        {/* Add Set button for CAT exams */}
                                        {exam.examTypeId === 'et_cat' && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleAddSet(exam)}
                                            className="h-7 w-7 p-0 rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                            title="Add Set"
                                          >
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                        )}

                                        {/* Delete button for individual exam */}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDeleteExam(exam.id)}
                                          className="h-7 w-7 p-0 rounded-full border-2 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                          title="Delete Exam"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </>
                          )}
                        </TableBody>
                      </Table>
                    </div>


                  </div>
                );
              });
            })()}
          </div>
        ) : (
          // Card view for mobile
          <div className="space-y-4">
            {groupedAndSortedExams.length === 0 && (
              <div className="text-center p-8 border rounded-lg">
                <p className="text-muted-foreground">No exams scheduled.</p>
                <Button onClick={handleAddExam} className="mt-4">
                  <PlusCircle className="mr-2 h-4 w-4" /> Schedule New Exam
                </Button>
              </div>
            )}

            {/* Group exams by batch - Modern Collapsible Design */}
            {(() => {
              const batchGrouped: Record<string, Exam[]> = {};
              groupedAndSortedExams.forEach(exam => {
                let batchKey: string;

                if (exam.examTypeId === 'et_cat') {
                  // For CAT exams, group by assessment name + academic context
                  batchKey = `cat_${exam.baseName || exam.name.split(' - ')[0]}_${exam.academicYearId}_${exam.termId}`;
                } else {
                  // For regular exams, group by batchId as before
                  batchKey = exam.batchId || exam.id;
                }

                if (!batchGrouped[batchKey]) {
                  batchGrouped[batchKey] = [];
                }
                batchGrouped[batchKey].push(exam);
              });

              return Object.entries(batchGrouped).map(([batchId, exams]) => {
                const firstExam = exams[0];
                const isExpanded = expandedBatches[batchId] || false;
                const isCATExam = firstExam.examTypeId === 'et_cat';
                const showBatchHeader = exams.length > 1;
                const selectedCollapsedExam = exams.find(exam => exam.id === selectedCollapsedBatchExams[batchId]) || exams[0];

                return (
                  <div
                    key={batchId}
                    className={
                      showBatchHeader
                        ? "overflow-hidden rounded-[24px] border border-blue-100 bg-white shadow-[0_18px_42px_-28px_rgba(59,130,246,0.35)] transition-all duration-300 hover:shadow-[0_24px_56px_-30px_rgba(59,130,246,0.28)]"
                        : "overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_42px_-30px_rgba(15,23,42,0.16)] transition-all duration-300 hover:border-slate-300 hover:shadow-[0_24px_54px_-32px_rgba(15,23,42,0.18)]"
                    }
                  >
                    {showBatchHeader && (
                      <div className={`relative px-4 py-3 ${isCATExam ? 'bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700' : 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700'}`}>
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></div>
                            <h3 className="truncate text-base font-bold text-white">
                              {isCATExam ? (firstExam.baseName || firstExam.name.split(' - ')[0]) : (firstExam.baseName || firstExam.name)}
                              {firstExam.customExamTypeName && (
                                <span className="text-blue-100 font-normal"> ({firstExam.customExamTypeName})</span>
                              )}
                            </h3>
                            <div className="hidden min-w-0 items-center gap-2 text-xs text-white/80 md:flex">
                              <span>•</span>
                              <span className="truncate">Created by {String(('createdBy' in firstExam ? firstExam.createdBy : undefined) || 'admin')}</span>
                            </div>
                          </div>

                          {false && isCATExam && (
                            <div className="mb-1.5 flex items-center gap-1">
                              <span className="mr-1 text-xs text-white/90">Classes:</span>
                              {Array.from(new Set(exams.map(e => e.classId))).map((classId, idx) => {
                                const classCode = allClasses.find(c => c.id === classId)?.code || 'N/A';
                                const uniqueClassIds = Array.from(new Set(exams.map(e => e.classId)));
                                return (
                                  <span key={classId} className="inline-flex items-center">
                                    <div className="flex h-4.5 w-4.5 items-center justify-center rounded-md bg-white/20">
                                      <span className="text-[10px] font-bold text-white">
                                        {classCode}
                                      </span>
                                    </div>
                                    {idx < uniqueClassIds.length - 1 && <span className="text-white/60 text-xs mx-1">•</span>}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          <div className="hidden items-center gap-3 text-xs text-white/90">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="h-3.5 w-3.5" />
                              <span>
                                {formatDateRange(firstExam.startDate, firstExam.endDate)}
                              </span>
                            </div>

                            {(() => {
                              const status = getExamStatus(firstExam.startDate, firstExam.endDate);
                              const IconComponent = status.icon;
                              return (
                                <div className={`flex items-center gap-1 ${status.color.replace('text-', 'text-white/').replace('-600', '/90').replace('-700', '/90')}`}>
                                  <IconComponent className="h-3.5 w-3.5" />
                                  <span>{status.text}</span>
                                </div>
                              );
                            })()}

                            <div className="flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5" />
                              <span className="truncate">
                                {firstExam.examNature === 'Subject based'
                                  ? (firstExam.subjectIds && firstExam.subjectIds.length > 0
                                    ? `${firstExam.subjectIds.length} Subject${firstExam.subjectIds.length !== 1 ? 's' : ''}`
                                    : 'No Subjects')
                                  : 'All Subjects'}
                              </span>
                            </div>
                          </div>

                          {/* Digital Signature Display */}
                          <div className="hidden mt-1.5">
                            <ExamSignatureDisplay
                              exam={firstExam}
                              variant="inline"
                              className="text-white/80"
                            />
                          </div>

                        <div className="flex items-center gap-1.5">
                          <span className="hidden text-sm font-medium text-white/90 md:inline">
                            {exams.length} class{exams.length !== 1 ? 'es' : ''}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStackGradingScaleDialog(exams, firstExam.baseName || firstExam.name)}
                            className="h-7 w-7 rounded-full border border-white/20 p-0 transition-colors hover:bg-white/20"
                            title="Edit grading scale for this stack"
                          >
                            <GraduationCap className="h-3.5 w-3.5 text-white" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExamStack(exams.map(exam => exam.id), firstExam.baseName || firstExam.name)}
                            className="h-7 w-7 rounded-full border border-white/20 p-0 transition-colors hover:bg-white/20"
                            title="Delete entire stack"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-white" />
                          </Button>
                          {(() => {
                            if (isCATExam) {
                              const setGroups: Record<string, Exam[]> = {};
                              exams.forEach(exam => {
                                const setMatch = exam.name.match(/SET (\d+)$/i);
                                const setNumber = setMatch ? setMatch[1] : '1';
                                const setKey = `SET ${setNumber}`;

                                if (!setGroups[setKey]) {
                                  setGroups[setKey] = [];
                                }
                                setGroups[setKey].push(exam);
                              });

                              return Object.keys(setGroups).length > 1;
                            }

                            return exams.length > 1;
                          })() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedBatches(prev => ({ ...prev, [batchId]: !isExpanded }))}
                              className="h-7 w-7 rounded-full border border-white/20 p-0 transition-colors hover:bg-white/20"
                              title={isExpanded ? "Collapse stack" : "Expand stack"}
                            >
                              <ChevronDown className={`h-3.5 w-3.5 text-white transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </Button>
                          )}
                        </div>

                      </div>
                      </div>
                    )}

                    {/* Collapsed Summary View */}
                    <div className={`${showBatchHeader ? 'p-2.5 lg:p-3' : 'p-0'}`}>
                      {!showBatchHeader && (
                        <div className="bg-white px-4 py-4 sm:px-5">
                          <div className="grid gap-3 md:grid-cols-2 md:gap-x-5 md:gap-y-3 xl:grid-cols-[minmax(260px,1.22fr)_minmax(150px,0.72fr)_minmax(150px,0.72fr)_minmax(240px,1fr)_auto] xl:items-center xl:gap-x-0 xl:gap-y-0">
                            <div className="flex min-w-0 items-center gap-3 xl:pr-5">
                              <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">
                                {allClasses.find(c => c.id === firstExam.classId)?.code || 'N/A'}
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate text-[1.15rem] font-semibold tracking-tight text-slate-950">
                                  {isCATExam ? (firstExam.baseName || firstExam.name.split(' - ')[0]) : (firstExam.baseName || firstExam.name)}
                                </h3>
                                <p className="mt-0.5 text-sm leading-none text-slate-500">
                                  {firstExam.customExamTypeName || firstExam.examTypeName || firstExam.examTypeId}
                                </p>
                              </div>
                            </div>

                            <div className="text-sm text-slate-700 xl:border-l xl:border-slate-100 xl:px-5">
                              <p className="font-medium text-slate-900">{firstExam.examTypeName || firstExam.examTypeId}</p>
                            </div>

                            <div className="text-sm text-slate-700 xl:border-l xl:border-slate-100 xl:px-5">
                              <p className="font-medium text-slate-900">
                                {firstExam.examNature === 'Subject based'
                                  ? (firstExam.subjectIds && firstExam.subjectIds.length > 0
                                    ? `${firstExam.subjectIds.length} Subject${firstExam.subjectIds.length !== 1 ? 's' : ''}`
                                    : 'No Subjects')
                                  : 'All Subjects'}
                              </p>
                            </div>

                            <div className="text-sm text-slate-700 xl:border-l xl:border-slate-100 xl:px-5">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <p className="font-medium text-slate-900">{formatDateRange(firstExam.startDate, firstExam.endDate)}</p>
                                {(() => {
                                  const status = getExamStatus(firstExam.startDate, firstExam.endDate);
                                  const IconComponent = status.icon;
                                  return (
                                    <div className={`flex items-center gap-1 ${status.color}`}>
                                      <IconComponent className="h-3.5 w-3.5" />
                                      <span>{status.text}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                                <ExamSignatureDisplay exam={firstExam} variant="inline" />
                                <p>Created {safeParseDateString(firstExam.createdAt) ? format(safeParseDateString(firstExam.createdAt)!, "MMM dd, yyyy HH:mm") : 'Unknown'}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 md:col-span-2 xl:col-span-1 xl:justify-end xl:border-l xl:border-slate-100 xl:pl-5">
                              <Button variant="outline" size="sm" asChild className="h-9 w-9 rounded-full border-2 border-blue-300 p-0 text-blue-700 shadow-sm transition-all duration-200 hover:border-blue-500 hover:bg-blue-50">
                                <Link href={`/exams/${firstExam.id}/record-results?classId=${firstExam.classId}`}>
                                  <FilePenLine className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openExamPrintOptions(firstExam)} className="h-9 w-9 rounded-full border-2 border-amber-300 p-0 text-amber-700 shadow-sm transition-all duration-200 hover:border-amber-500 hover:bg-amber-50">
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" asChild className="h-9 w-9 rounded-full border-2 border-green-300 p-0 text-green-700 shadow-sm transition-all duration-200 hover:border-green-500 hover:bg-green-50">
                                <Link href={`/exams/${firstExam.id}/view-results?classId=${firstExam.classId}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button variant="outline" size="sm" asChild className="h-9 w-9 rounded-full border-2 border-purple-300 p-0 text-purple-700 shadow-sm transition-all duration-200 hover:border-purple-500 hover:bg-purple-50">
                                <Link href={`/exams/${firstExam.id}/edit-snapshot`}>
                                  <Camera className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteExam(firstExam.id)} className="h-9 w-9 rounded-full border-2 border-red-300 p-0 text-red-700 shadow-sm transition-all duration-200 hover:border-red-500 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      {showBatchHeader && (
                      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start md:gap-x-4 xl:grid-cols-[minmax(420px,1fr)_auto] xl:items-center">
                        <div className="flex flex-col gap-2">
                          {isCATExam ? (
                            // CAT Exam - Show Sets Count Badge
                            <>
                              <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg px-3 py-2 border border-purple-100">
                                <BookOpen className="h-4 w-4 text-purple-600" />
                                <span className="font-semibold text-purple-900">
                                  {(() => {
                                    const setGroups: Record<string, Exam[]> = {};
                                    exams.forEach(exam => {
                                      const setMatch = exam.name.match(/SET (\d+)$/i);
                                      const setNumber = setMatch ? setMatch[1] : '1';
                                      const setKey = `SET ${setNumber}`;

                                      if (!setGroups[setKey]) {
                                        setGroups[setKey] = [];
                                      }
                                      setGroups[setKey].push(exam);
                                    });

                                    const setCount = Object.keys(setGroups).length;
                                    return `${setCount} Set${setCount !== 1 ? 's' : ''}`;
                                  })()}
                                </span>
                              </div>

                              {/* Sets Preview */}
                              <div className="flex items-center gap-1">
                                <div className="flex -space-x-1">
                                  {(() => {
                                    const setGroups: Record<string, Exam[]> = {};
                                    exams.forEach(exam => {
                                      const setMatch = exam.name.match(/SET (\d+)$/i);
                                      const setNumber = setMatch ? setMatch[1] : '1';
                                      const setKey = `SET ${setNumber}`;

                                      if (!setGroups[setKey]) {
                                        setGroups[setKey] = [];
                                      }
                                      setGroups[setKey].push(exam);
                                    });

                                    const sortedSets = Object.entries(setGroups).sort(([a], [b]) => {
                                      const numA = parseInt(a.split(' ')[1]);
                                      const numB = parseInt(b.split(' ')[1]);
                                      return numA - numB;
                                    });

                                    return sortedSets.slice(0, 3).map(([setName, setExams], index) => (
                                      <div
                                        key={setName}
                                        className="w-8 h-8 bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-white rounded-lg flex items-center justify-center text-xs font-bold text-purple-700 shadow-sm"
                                        title={`${setName} (${setExams.length} exam${setExams.length !== 1 ? 's' : ''})`}
                                      >
                                        {setName.split(' ')[1]}
                                      </div>
                                    ));
                                  })()}
                                  {(() => {
                                    const setCount = (() => {
                                      const setGroups: Record<string, Exam[]> = {};
                                      exams.forEach(exam => {
                                        const setMatch = exam.name.match(/SET (\d+)$/i);
                                        const setNumber = setMatch ? setMatch[1] : '1';
                                        const setKey = `SET ${setNumber}`;

                                        if (!setGroups[setKey]) {
                                          setGroups[setKey] = [];
                                        }
                                        setGroups[setKey].push(exam);
                                      });

                                      return Object.keys(setGroups).length;
                                    })();

                                    return setCount > 3 ? (
                                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-indigo-200 border-2 border-white rounded-lg flex items-center justify-center text-xs font-bold text-indigo-700 shadow-sm">
                                        +{setCount - 3}
                                      </div>
                                    ) : null;
                                  })()}
                                </div>
                              </div>
                            </>
                          ) : (
                            // Regular Exam - Show Classes Preview Only
                            <>
                              {/* Classes Preview */}
                              <div className="flex items-center gap-1">
                                <div className="flex -space-x-1">
                                  {exams.map((exam) => {
                                    const classMeta = getClassMeta(exam.classId);
                                    const isSelectedClass = selectedCollapsedExam.id === exam.id;
                                    return (
                                      <button
                                        key={exam.id}
                                        type="button"
                                        onClick={() => setSelectedCollapsedBatchExams(prev => ({ ...prev, [batchId]: exam.id }))}
                                        className={`w-8 h-8 border-2 border-white rounded-lg flex items-center justify-center text-xs font-bold shadow-sm transition-all ${
                                          isSelectedClass
                                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                                            : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 hover:from-blue-100 hover:to-indigo-100'
                                        }`}
                                        title={`Show actions for ${classMeta.name}`}
                                      >
                                        {classMeta.code}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <p className="text-sm font-medium text-slate-600">
                                {exams.length} classes <span className="text-slate-400">•</span> Click a class to reveal its actions
                              </p>
                            </>
                          )}
                        </div>

                        <div className="hidden text-sm text-slate-700 xl:border-r xl:border-slate-100 xl:px-5">
                          <div className="text-[11px] font-semibold text-slate-800">Multiple classes</div>
                          <div className="text-[11px] text-slate-500">Exam set for multiple classes</div>
                        </div>

                        <div className="hidden text-sm text-slate-700 xl:border-r xl:border-slate-100 xl:px-5">
                          <div className="text-[11px] font-semibold text-slate-800">Varies by class</div>
                          <div className="text-[11px] text-slate-500">Dates and details vary by class</div>
                        </div>

                        <div className="hidden text-sm text-slate-700 xl:border-r xl:border-slate-100 xl:px-5">
                          <div className="text-[11px] font-semibold text-slate-800">Same date</div>
                          <div className="text-[11px] text-slate-500">Exams held on the same day</div>
                        </div>

                        <div className="flex items-center justify-between gap-3 md:col-span-2 xl:col-span-1 xl:justify-end xl:pl-5">
                          {/* Quick Actions - Always show for single items, and for regular exams */}
                          {(() => {
                            if (isCATExam) {
                              // For CAT exams, only show quick actions if there's one set
                              const setGroups: Record<string, Exam[]> = {};
                              exams.forEach(exam => {
                                const setMatch = exam.name.match(/SET (\d+)$/i);
                                const setNumber = setMatch ? setMatch[1] : '1';
                                const setKey = `SET ${setNumber}`;

                                if (!setGroups[setKey]) {
                                  setGroups[setKey] = [];
                                }
                                setGroups[setKey].push(exam);
                              });

                              const setCount = Object.keys(setGroups).length;
                              return setCount === 1;
                            }

                            return true;
                          })() && (
                              <div className="flex w-full items-center justify-between gap-3 xl:justify-end">
                                {!isCATExam && !isExpanded && exams.length > 1 && (
                                  <div className="min-w-0 items-center gap-2 pr-2 hidden md:flex">
                                    <span className="truncate text-sm font-semibold text-slate-700">
                                      {getClassMeta(selectedCollapsedExam.classId).code}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="h-9 w-9 p-0 rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                  title="Record Results"
                                >
                                  <Link href={`/exams/${(!isCATExam && !isExpanded && exams.length > 1 ? selectedCollapsedExam.id : firstExam.id)}/record-results?classId=${(!isCATExam && !isExpanded && exams.length > 1 ? selectedCollapsedExam.classId : firstExam.classId)}`}>
                                    <FilePenLine className="h-4 w-4" />
                                  </Link>
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openExamPrintOptions(!isCATExam && !isExpanded && exams.length > 1 ? selectedCollapsedExam : firstExam)}
                                  className="h-9 w-9 p-0 rounded-full border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                  title="Print Reports"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="h-9 w-9 p-0 rounded-full border-2 border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                  title="View Results"
                                >
                                  <Link href={`/exams/${(!isCATExam && !isExpanded && exams.length > 1 ? selectedCollapsedExam.id : firstExam.id)}/view-results?classId=${(!isCATExam && !isExpanded && exams.length > 1 ? selectedCollapsedExam.classId : firstExam.classId)}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>

                                {/* Add Set button for CAT exams */}
                                {firstExam.examTypeId === 'et_cat' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddSet(firstExam)}
                                    className="h-9 w-9 p-0 rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                    title="Add Set"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}

                                {/* Delete button */}
                                {(!showBatchHeader || !isCATExam) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteExam(!isCATExam && !isExpanded && exams.length > 1 ? selectedCollapsedExam.id : firstExam.id)}
                                    className="h-9 w-9 p-0 rounded-full border-2 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                    title="Delete Exam"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {!isCATExam && !isExpanded && exams.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setExpandedBatches(prev => ({ ...prev, [batchId]: true }))}
                                    className="h-9 gap-1 px-2 text-sm font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                    Expand
                                  </Button>
                                )}
                              </div>
                              </div>
                          )}
                        </div>
                      </div>
                      )}

                      {/* Expandable Sets/Classes Detail */}
                      {isExpanded && (() => {
                        if (isCATExam) {
                          // For CAT exams, check if there are multiple sets
                          const setGroups: Record<string, Exam[]> = {};
                          exams.forEach(exam => {
                            const setMatch = exam.name.match(/SET (\d+)$/i);
                            const setNumber = setMatch ? setMatch[1] : '1';
                            const setKey = `SET ${setNumber}`;

                            if (!setGroups[setKey]) {
                              setGroups[setKey] = [];
                            }
                            setGroups[setKey].push(exam);
                          });

                          const setCount = Object.keys(setGroups).length;
                          return setCount > 1;
                        } else {
                          // For regular exams, check if there are multiple classes
                          return exams.length > 1;
                        }
                      })() && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                              {isCATExam ? (
                                <>
                                  <BookOpen className="h-4 w-4 text-purple-600" />
                                  Set Actions
                                </>
                              ) : (
                                <>
                                  <Users className="h-4 w-4 text-blue-600" />
                                  Class Actions
                                </>
                              )}
                            </h4>

                            <div className="grid grid-cols-1 gap-3">
                              {isCATExam ? (
                                // CAT Exam - Show sets
                                (() => {
                                  const setGroups: Record<string, Exam[]> = {};
                                  exams.forEach(exam => {
                                    const setMatch = exam.name.match(/SET (\d+)$/i);
                                    const setNumber = setMatch ? setMatch[1] : '1';
                                    const setKey = `SET ${setNumber}`;

                                    if (!setGroups[setKey]) {
                                      setGroups[setKey] = [];
                                    }
                                    setGroups[setKey].push(exam);
                                  });

                                  const sortedSets = Object.entries(setGroups).sort(([a], [b]) => {
                                    const numA = parseInt(a.split(' ')[1]);
                                    const numB = parseInt(b.split(' ')[1]);
                                    return numA - numB;
                                  });

                                  return sortedSets.map(([setName, setExams], setIndex) => {
                                    const firstSetExam = setExams[0];

                                    return (
                                      <div
                                        key={setName}
                                        className="bg-gradient-to-r from-purple-50 to-indigo-50/50 rounded-xl p-3 border border-purple-200 hover:border-purple-300 hover:shadow-sm transition-all duration-200"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                                              <span className="text-white font-bold text-sm">
                                                {setName.split(' ')[1]}
                                              </span>
                                            </div>

                                            <div>
                                              <p className="font-semibold text-gray-900 text-sm">{setName}</p>
                                              <p className="text-xs text-gray-500">
                                                {setExams.length} exam{setExams.length !== 1 ? 's' : ''} • {safeParseDateString(firstSetExam.startDate) ? format(safeParseDateString(firstSetExam.startDate)!, "MMM dd") : 'No date'}
                                              </p>
                                              {/* Digital Signature Display */}
                                              <ExamSignatureDisplay
                                                exam={firstSetExam}
                                                variant="inline"
                                                className="mt-1"
                                              />
                                            </div>
                                          </div>

                                          <div className="flex gap-2">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              asChild
                                              className="h-8 w-8 p-0 rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                              title="Record Results"
                                            >
                                              <Link href={`/exams/${firstSetExam.id}/record-results?classId=${firstSetExam.classId}`}>
                                                <FilePenLine className="h-4 w-4" />
                                              </Link>
                                            </Button>

                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => openExamPrintOptions(firstSetExam)}
                                              className="h-8 w-8 p-0 rounded-full border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                              title="Print Reports"
                                            >
                                              <Printer className="h-4 w-4" />
                                            </Button>

                                            <Button
                                              variant="outline"
                                              size="sm"
                                              asChild
                                              className="h-8 w-8 p-0 rounded-full border-2 border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                              title="View Results"
                                            >
                                              <Link href={`/exams/${firstSetExam.id}/view-results?classId=${firstSetExam.classId}`}>
                                                <Eye className="h-4 w-4" />
                                              </Link>
                                            </Button>

                                            {/* Add Set button for the latest set */}
                                            {setIndex === sortedSets.length - 1 && (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleAddSet(firstSetExam)}
                                                className="h-8 w-8 p-0 rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                                title="Add Set"
                                              >
                                                <Plus className="h-4 w-4" />
                                              </Button>
                                            )}

                                            {/* Delete Set button */}
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                // Delete all exams in this set
                                                const examIds = setExams.map(exam => exam.id);
                                                handleDeleteExamStack(examIds, `${firstSetExam.baseName || firstSetExam.name} ${setName}`);
                                              }}
                                              className="h-8 w-8 p-0 rounded-full border-2 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                              title="Delete Set"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  });
                                })()
                              ) : (
                                // Regular Exam - Show classes
                                exams.map((exam, index) => {
                                  const className = allClasses.find(c => c.id === exam.classId)?.name || 'Unknown';
                                  const classCode = allClasses.find(c => c.id === exam.classId)?.code || 'N/A';

                                  return (
                                    <div
                                      key={exam.id}
                                      className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl p-3 border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all duration-200"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                                            <span className="text-white font-bold text-sm">
                                              {classCode}
                                            </span>
                                          </div>

                                          <div>
                                            <p className="font-semibold text-gray-900 text-sm">{className}</p>
                                            <p className="text-xs text-gray-500">
                                              {exam.examNature === 'Subject based' && exam.subjectIds
                                                ? `${exam.subjectIds.length} subject${exam.subjectIds.length !== 1 ? 's' : ''}`
                                                : 'All subjects'
                                              }
                                            </p>
                                            {/* Digital Signature Display */}
                                            <ExamSignatureDisplay
                                              exam={exam}
                                              variant="inline"
                                              className="mt-1"
                                            />
                                          </div>
                                        </div>

                                        <div className="flex gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                            className="h-8 w-8 p-0 rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                            title="Record Results"
                                          >
                                            <Link href={`/exams/${exam.id}/record-results?classId=${exam.classId}`}>
                                              <FilePenLine className="h-4 w-4" />
                                            </Link>
                                          </Button>

                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openExamPrintOptions(exam)}
                                            className="h-8 w-8 p-0 rounded-full border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                            title="Print Reports"
                                          >
                                            <Printer className="h-4 w-4" />
                                          </Button>

                                          <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                            className="h-8 w-8 p-0 rounded-full border-2 border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                            title="View Results"
                                          >
                                            <Link href={`/exams/${exam.id}/view-results?classId=${exam.classId}`}>
                                              <Eye className="h-4 w-4" />
                                            </Link>
                                          </Button>

                                          <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                            className="h-8 w-8 p-0 rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                            title="Edit Snapshot Data"
                                          >
                                            <Link href={`/exams/${exam.id}/edit-snapshot`}>
                                              <Camera className="h-4 w-4" />
                                            </Link>
                                          </Button>

                                          {/* Delete Exam button */}
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDeleteExam(exam.id)}
                                            className="h-8 w-8 p-0 rounded-full border-2 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                            title="Delete Exam"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}

                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ===== SCHEDULE EXAM MODAL ===== */}
        {isDialogOpen && typeof document !== 'undefined' && ReactDOM.createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setIsDialogOpen(false); resetForm(); }}
            />

            {/* Modal Panel */}
            <div className="relative z-10 w-full max-w-2xl h-[90vh] flex flex-col bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

              {/* Close Button */}
              <button
                type="button"
                onClick={() => { setIsDialogOpen(false); resetForm(); }}
                className="absolute right-3 top-3 z-20 h-8 w-8 rounded-full bg-white/80 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-white shadow-sm transition-all"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>

              {/* --- HEADER --- */}
              <div className="flex-shrink-0 px-5 py-4 border-b border-slate-200 bg-white flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                  {editingExam ? <FilePenLine className="h-5 w-5" /> : isAddingSet ? <PlusCircle className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {editingExam ? "Edit Exam" : isAddingSet ? "Add New Set" : "Schedule New Exam"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {editingExam ? "Update the details for this examination." : isAddingSet ? "Add another set to an existing continuous assessment." : "Fill in the details, schedule, and targets below."}
                  </p>
                </div>
              </div>

              {/* --- SCROLLABLE BODY --- */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">

                {/* SECTION 1: Basic Information */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-slate-700">Basic Information</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Assessment Name for CAT */}
                    {examTypeId === 'et_cat' && (
                      <div>
                        <Label htmlFor="assessmentName" className="text-sm font-medium text-slate-700">Assessment Name <span className="text-rose-500">*</span></Label>
                        <Input
                          id="assessmentName"
                          value={assessmentName}
                          onChange={(e) => setAssessmentName(e.target.value.toUpperCase())}
                          placeholder="e.g., WEEKLY TEST, MONTHLY ASSESSMENT"
                          className="mt-1.5"
                          disabled={isAddingSet}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <Label htmlFor="examName" className="text-sm font-medium text-slate-700">Exam Name <span className="text-rose-500">*</span></Label>
                        <Input
                          id="examName"
                          value={examName}
                          onChange={(e) => setExamName(e.target.value.toUpperCase())}
                          placeholder="e.g., MIDTERM, PRACTICAL"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="examTypeId" className="text-sm font-medium text-slate-700">Exam Type <span className="text-rose-500">*</span></Label>
                        <Select value={examTypeId} onValueChange={(val) => {
                          setExamTypeId(val);
                          if (val !== OTHER_EXAM_TYPE_ID) setCustomExamTypeName("");
                          if (val === 'et_cat' && !isAddingSet) { setSetNumber("SET 1"); setAssessmentName(""); setExamName(""); }
                          else if (val !== 'et_cat') { setAssessmentName(""); setSetNumber(""); }
                        }} disabled={isAddingSet}>
                          <SelectTrigger id="examTypeId" className="mt-1.5"><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent position="popper">
                            {sampleExamTypes.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="examNature" className="text-sm font-medium text-slate-700">
                          {selectedClassIdsForm.length > 1 && !editingExam ? "Default Exam Nature" : "Exam Nature"} <span className="text-rose-500">*</span>
                        </Label>
                        <Select value={examNature} onValueChange={(val) => {
                          const nextNature = val as ExamNature;
                          setExamNature(nextNature);

                          if (!editingExam && selectedClassIdsForm.length > 1) {
                            setPerClassExamNatures(prev => {
                              const next = { ...prev };
                              selectedClassIdsForm.forEach(classId => {
                                next[classId] = nextNature;
                              });
                              return next;
                            });

                            if (nextNature === 'Set based') {
                              setPerClassSelectedSubjects({});
                            }
                          }
                        }} disabled={isAddingSet}>
                          <SelectTrigger id="examNature" className="mt-1.5"><SelectValue placeholder="Select nature" /></SelectTrigger>
                          <SelectContent position="popper">
                            {EXAM_NATURES.map(nature => <SelectItem key={nature} value={nature}>{nature}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {selectedClassIdsForm.length > 1 && !editingExam && (
                          <p className="mt-1.5 text-xs text-slate-500">This applies to all selected classes first. You can still override each class below.</p>
                        )}
                      </div>
                    </div>

                    {examTypeId === 'et_cat' && (
                      <div>
                        <Label htmlFor="setNumber" className="text-sm font-medium text-slate-700">Set Number</Label>
                        <Input id="setNumber" value={setNumber} placeholder="SET 1" className="mt-1.5 bg-slate-50 text-slate-500 cursor-not-allowed" disabled readOnly />
                      </div>
                    )}
                    {examTypeId === OTHER_EXAM_TYPE_ID && !isAddingSet && (
                      <div>
                        <Label htmlFor="customExamTypeName" className="text-sm font-medium text-slate-700">Custom Type Name <span className="text-rose-500">*</span></Label>
                        <Input id="customExamTypeName" value={customExamTypeName} onChange={(e) => setCustomExamTypeName(e.target.value.toUpperCase())} placeholder="e.g., QUIZ, ORAL" className="mt-1.5" />
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 2: Schedule & Grading */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-purple-500" />
                    <h3 className="text-sm font-semibold text-slate-700">Schedule & Grading</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-slate-700">Start Date <span className="text-rose-500">*</span></Label>
                        <div className="mt-1.5">
                          <ModernDatePicker date={startDate} setDate={setStartDate} placeholder="Select start date" showQuickSelects={true} minDate={getCurrentTermDateRange().minDate} maxDate={getCurrentTermDateRange().maxDate} examMode={true} excludeWeekends={false} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-slate-700">End Date <span className="text-rose-500">*</span></Label>
                        <div className="mt-1.5">
                          <ModernDatePicker date={endDate} setDate={setEndDate} placeholder="Select end date" showQuickSelects={true} minDate={startDate || getCurrentTermDateRange().minDate} maxDate={getCurrentTermDateRange().maxDate} examMode={true} excludeWeekends={false} />
                        </div>
                      </div>
                    </div>

                    {!isAddingSet && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                        <div>
                          <Label htmlFor="maxMarks" className="text-sm font-medium text-slate-700">Max Marks <span className="text-rose-500">*</span></Label>
                          <Input id="maxMarks" type="number" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} placeholder="100" className="mt-1.5" />
                        </div>
                        <div>
                          <Label htmlFor="passingMarks" className="text-sm font-medium text-slate-700">Passing Marks <span className="text-rose-500">*</span></Label>
                          <Input id="passingMarks" type="number" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} placeholder="40" className="mt-1.5" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 3: Target Audience */}
                {!isAddingSet && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-500" />
                      <h3 className="text-sm font-semibold text-slate-700">Target Audience</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-medium text-slate-700">Target Class(es) <span className="text-rose-500">*</span></Label>
                          {selectedClassIdsForm.length > 0 && (
                            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{selectedClassIdsForm.length} selected</span>
                          )}
                        </div>
                        {pupilsLoading && (
                          <div className="flex items-center p-2.5 mb-2 bg-blue-50 rounded-lg border border-blue-100">
                            <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-500" />
                            <span className="text-sm text-blue-700">Loading class data...</span>
                          </div>
                        )}
                        <MultiSelect
                          options={allClasses.map(cls => ({ value: cls.id, label: cls.code }))}
                          selected={selectedClassIdsForm}
                          onChange={(selected) => {
                            setSelectedClassIdsForm(selected);
                            if (selected.length < selectedClassIdsForm.length) {
                              const removedClasses = selectedClassIdsForm.filter(id => !selected.includes(id));
                              setPerClassExamNatures(prev => {
                                const updated = { ...prev };
                                removedClasses.forEach(classId => { delete updated[classId]; });
                                return updated;
                              });
                              setPerClassSelectedSubjects(prev => {
                                const updated = { ...prev };
                                removedClasses.forEach(classId => { delete updated[classId]; });
                                return updated;
                              });
                            }
                          }}
                          placeholder="Select one or more classes..."
                          searchPlaceholder="Search classes..."
                          disabled={!!editingExam || allClasses.length === 0}
                          className="w-full"
                        />
                        {allClasses.length === 0 && <p className="text-xs text-slate-500 mt-2">No classes available for this term.</p>}
                      </div>

                      {selectedClassIdsForm.length > 1 && !editingExam && (
                        <div className="pt-3 border-t border-slate-100">
                          <Label className="text-sm font-medium text-slate-700">Per Class Setup <span className="text-rose-500">*</span></Label>
                          <p className="text-xs text-slate-500 mt-0.5 mb-3">Choose the exam nature for each class. Subject-based classes can then pick their own subjects.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedClassIdsForm.map(classId => {
                              const currentClass = allClasses.find(c => c.id === classId);
                              const classNature = getExamNatureForClass(classId);
                              const subjectsInThisClass = getSubjectsForClass(classId);

                              return (
                                <div key={`class-setup-${classId}`} className="border border-slate-200 rounded-lg overflow-hidden">
                                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                                    <h5 className="text-sm font-semibold text-slate-800">{currentClass?.name || classId} <span className="text-slate-400 font-normal text-xs">({currentClass?.code})</span></h5>
                                  </div>
                                  <div className="p-3 space-y-3">
                                    <div>
                                      <Label className="text-xs font-medium text-slate-600">Exam Nature</Label>
                                      <Select value={classNature} onValueChange={(value) => handlePerClassExamNatureChange(classId, value as ExamNature)}>
                                        <SelectTrigger className="mt-1.5">
                                          <SelectValue placeholder="Select nature" />
                                        </SelectTrigger>
                                        <SelectContent position="popper">
                                          {EXAM_NATURES.map(nature => <SelectItem key={`${classId}-${nature}`} value={nature}>{nature}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {classNature === 'Subject based' && (
                                      <div>
                                        <Label className="text-xs font-medium text-slate-600">Subjects</Label>
                                        <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1.5">
                                          {subjectsInThisClass.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic text-center py-2">No subjects assigned.</p>
                                          ) : (
                                            subjectsInThisClass.map(sub => (
                                              <label key={`multi-class-${classId}-${sub.id}`} className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-md px-3 py-1.5 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition-colors">
                                                <Checkbox
                                                  id={`class-${classId}-subj-${sub.id}`}
                                                  checked={(perClassSelectedSubjects[classId] || []).includes(sub.id)}
                                                  onCheckedChange={(checked) => handlePerClassSubjectIdChange(classId, sub.id, checked)}
                                                  className="h-4 w-4"
                                                />
                                                <span className="text-sm text-slate-700">{sub.name} <span className="text-slate-400 text-xs">({sub.code})</span></span>
                                              </label>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {selectedClassIdsForm.length > 0 && selectedClassIdsForm.some(classId => getExamNatureForClass(classId) === 'Subject based') && selectedClassIdsForm.length <= 1 && (
                        <div className="pt-3 border-t border-slate-100">
                          <Label className="text-sm font-medium text-slate-700">Target Subjects per Class <span className="text-rose-500">*</span></Label>
                          <p className="text-xs text-slate-500 mt-0.5 mb-3">Select subjects for each selected class.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedClassIdsForm.map(classId => {
                              const subjectsInThisClass = getSubjectsForClass(classId);
                              const currentClass = allClasses.find(c => c.id === classId);
                              return (
                                <div key={`class-subjects-${classId}`} className="border border-slate-200 rounded-lg overflow-hidden">
                                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                                    <h5 className="text-sm font-semibold text-slate-800">{currentClass?.name || classId} <span className="text-slate-400 font-normal text-xs">({currentClass?.code})</span></h5>
                                  </div>
                                  <div className="p-3 max-h-40 overflow-y-auto space-y-1.5">
                                    {subjectsInThisClass.length === 0 ? (
                                      <p className="text-sm text-slate-400 italic text-center py-2">No subjects assigned.</p>
                                    ) : (
                                      subjectsInThisClass.map(sub => (
                                        <label key={sub.id} className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-md px-3 py-1.5 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition-colors">
                                          <Checkbox
                                            id={`class-${classId}-subj-${sub.id}`}
                                            checked={(perClassSelectedSubjects[classId] || []).includes(sub.id)}
                                            onCheckedChange={(checked) => handlePerClassSubjectIdChange(classId, sub.id, checked)}
                                            className="h-4 w-4"
                                          />
                                          <span className="text-sm text-slate-700">{sub.name} <span className="text-slate-400 text-xs">({sub.code})</span></span>
                                        </label>
                                      ))
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION 4: Options */}
                {!isAddingSet && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <h3 className="text-sm font-semibold text-slate-700">Options</h3>
                    </div>
                    <div className="p-4">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <Checkbox
                          id="markAsEvent"
                          checked={markAsEvent}
                          onCheckedChange={(checked) => setMarkAsEvent(checked as boolean)}
                          className="mt-0.5 h-4 w-4"
                        />
                        <div>
                          <span className="text-sm font-medium text-slate-800 group-hover:text-amber-700 transition-colors">Publish to School Calendar</span>
                          <p className="text-xs text-slate-500 mt-0.5">Automatically create calendar events for the exam start and end dates.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

              </div>
              {/* --- END SCROLLABLE BODY --- */}

              {/* --- FOOTER --- */}
              <div className="flex-shrink-0 bg-white border-t border-slate-200 px-5 py-3.5 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setIsDialogOpen(false); resetForm(); }}
                  className="h-10 px-5 border-slate-300 text-slate-700 hover:bg-slate-100 font-medium"
                  disabled={createExamMutation.isPending || createMultipleExamsMutation.isPending || updateExamMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createExamMutation.isPending || createMultipleExamsMutation.isPending || updateExamMutation.isPending}
                  className="h-10 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  {(createExamMutation.isPending || createMultipleExamsMutation.isPending || updateExamMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingExam ? "Saving..." : isAddingSet ? "Adding Set..." : "Creating Exam..."}
                    </>
                  ) : (
                    editingExam ? "Save Changes" : isAddingSet ? "Add Set" : "Create Exam"
                  )}
                </Button>
              </div>

            </div>
          </div>
          , document.body)}

        <ModernDialog open={stackGradingScaleDialogOpen} onOpenChange={(open) => {
          setStackGradingScaleDialogOpen(open);
          if (!open) {
            setStackGradingScaleTarget(null);
            setStackGradingScaleDraft(cloneDefaultGradingScale());
          }
        }}>
          <ModernDialogContent className="max-w-3xl">
            <ModernDialogHeader>
              <ModernDialogTitle>Stack Grading Scale</ModernDialogTitle>
              <ModernDialogDescription>
                {stackGradingScaleTarget
                  ? `Update the grading scale for every class in "${stackGradingScaleTarget.label}".`
                  : "Update the grading scale for this stack."}
              </ModernDialogDescription>
            </ModernDialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm text-slate-600">Each row applies to every exam result in the selected stack.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStackGradingScaleDraft(cloneDefaultGradingScale())}
                >
                  Reset Default
                </Button>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {stackGradingScaleDraft.map((scale, index) => (
                  <div key={`stack-scale-${index}`} className="grid grid-cols-4 gap-3 rounded-lg border border-slate-200 p-3">
                    <div>
                      <Label className="text-xs text-slate-600">Min Mark</Label>
                      <Input
                        type="number"
                        value={scale.minMark}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setStackGradingScaleDraft(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, minMark: Number.isNaN(value) ? 0 : value } : item));
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Max Mark</Label>
                      <Input
                        type="number"
                        value={scale.maxMark}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setStackGradingScaleDraft(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, maxMark: Number.isNaN(value) ? 0 : value } : item));
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Grade</Label>
                      <Input
                        value={scale.grade}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setStackGradingScaleDraft(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, grade: value } : item));
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Aggregates</Label>
                      <Input
                        type="number"
                        value={scale.aggregates ?? 0}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setStackGradingScaleDraft(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, aggregates: Number.isNaN(value) ? 0 : value } : item));
                        }}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ModernDialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setStackGradingScaleDialogOpen(false);
                  setStackGradingScaleTarget(null);
                  setStackGradingScaleDraft(cloneDefaultGradingScale());
                }}
                disabled={isSavingStackGradingScale}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveStackGradingScale} disabled={isSavingStackGradingScale}>
                {isSavingStackGradingScale ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Apply to Stack"
                )}
              </Button>
            </ModernDialogFooter>
          </ModernDialogContent>
        </ModernDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-md w-[95vw]">
            <AlertDialogHeader>
              <AlertDialogTitle>{examStackToDelete ? 'Delete Exam Stack' : 'Delete Exam'}</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete
                {examStackToDelete ? ' the exam stack ' : ' the exam '}
                {examStackToDelete ? (
                  <span className="font-semibold">&quot;{examStackToDelete.label}&quot;</span>
                ) : examToDelete ? (
                  <span className="font-semibold">&quot;{examToDelete.baseName || examToDelete.name}&quot;</span>
                ) : null}
                {' '}and all associated results.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4">
              <Label htmlFor="admin-password" className="text-sm font-medium">
                Administrator Password
              </Label>
              <Input
                id="admin-password"
                type="password"
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  setPasswordError(false);
                }}
                className={`mt-1 ${passwordError ? 'border-destructive' : ''}`}
                placeholder="Enter admin password to confirm"
              />
              {passwordError && (
                <p className="text-destructive text-xs mt-1">
                  Incorrect password. Please try again.
                </p>
              )}
            </div>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <AlertDialogCancel className="mt-2 sm:mt-0" onClick={() => {
                setDeleteDialogOpen(false);
                setExamToDelete(null);
                setExamStackToDelete(null);
                setAdminPassword("");
                setPasswordError(false);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
