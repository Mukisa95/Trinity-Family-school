"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Class, Pupil } from '@/types';
import { RefreshCw, CheckCircle, Download, Search, ArrowUpDown, ArrowUp, ArrowDown, Printer, FileText, List, MessageSquare, Clock, Loader2, Filter, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AcademicYear, Term } from '@/types';
import Link from 'next/link';
import { useActivePupils, useUpdatePupilPerformanceBatch } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { RecessStatusBanner } from '@/components/common/recess-status-banner';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { BulkCommentGenerator } from '@/utils/commentUtils';
import { commentaryService } from '@/services/commentaryService';
import { pdf, Document } from '@react-pdf/renderer';
import PupilPerformanceListPDF from '@/components/reports/PupilPerformanceListPDF';
import NurseryAssessmentReport, { NurseryAssessmentReportPageContent } from '@/components/reports/NurseryAssessmentReport';
import { PlayfulNurseryReportPageContent } from '@/components/reports/PlayfulNurseryReport';
import { PDFViewer } from '@/components/pdf/pdf-viewer';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { GlassPageTopBar, GlassActionDock, GlassActionButton, GlassPageSearchInput } from "@/components/common/glass-page-top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { SubjectCommentType, SubjectStatus } from '@/types';
import { SUBJECT_COMMENT_TYPES, SUBJECT_STATUS_OPTIONS } from '@/lib/constants/subject-comments';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type {
  PupilPerformancePatch,
  PupilPerformanceStatus,
} from '@/lib/services/pupils.service';


// Performance status options
const PERFORMANCE_STATUS_OPTIONS = [
  { value: 'good', label: 'Good', color: 'bg-green-100 text-green-800' },
  { value: 'fair', label: 'Fair', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'weak', label: 'Weak', color: 'bg-orange-100 text-orange-800' },
  { value: 'young', label: 'Young', color: 'bg-purple-100 text-purple-800' },
  { value: 'irregular', label: 'Irregular Performance', color: 'bg-red-100 text-red-800' }
];

const getDefaultSubjectStatusForPerformance = (status: string): SubjectStatus => {
  switch (status) {
    case 'good':
      return 'good';
    case 'fair':
      return 'fair';
    case 'weak':
    case 'young':
    case 'irregular':
    default:
      return 'weak';
  }
};

const buildTiedSubjectStatuses = (status: string): Record<SubjectCommentType, SubjectStatus> => {
  const defaultStatus = getDefaultSubjectStatusForPerformance(status);

  return SUBJECT_COMMENT_TYPES.reduce((acc, subject) => {
    acc[subject.value] = defaultStatus;
    return acc;
  }, {} as Record<SubjectCommentType, SubjectStatus>);
};

const hasOwn = <T extends object>(value: T, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key);

export default function RemarkReportPage() {
  const [selectedClass, setSelectedClass] = useState<string>('');
  // Pupil -> term -> pending overall performance status.
  const [updatedPupils, setUpdatedPupils] = useState<
    Record<string, Record<string, PupilPerformanceStatus>>
  >({});
  const [expandedPupils, setExpandedPupils] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Persist bulkTie preference to localStorage so it survives page reloads
  const [bulkTieEnabled, setBulkTieEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nursery-report-bulk-tie') === 'true';
    } catch {
      return false;
    }
  });
  const setBulkTieEnabledPersisted = (value: boolean) => {
    setBulkTieEnabled(value);
    try { localStorage.setItem('nursery-report-bulk-tie', String(value)); } catch {}
  };
  const [manualTieOverrides, setManualTieOverrides] = useState<Record<string, boolean | undefined>>({});
  // Term-scoped subject statuses: pupilId -> termId -> subject -> status
  const [updatedSubjectStatuses, setUpdatedSubjectStatuses] = useState<
    Record<
      string,
      Record<string, Partial<Record<SubjectCommentType, SubjectStatus | null>>>
    >
  >({});
  const [autoTiedSubjects, setAutoTiedSubjects] = useState<Record<string, Record<string, Record<SubjectCommentType, boolean>>>>({});
  const [autoTieBackups, setAutoTieBackups] = useState<Record<string, Record<string, Record<SubjectCommentType, SubjectStatus | undefined>>>>({});
  const [batchProgress, setBatchProgress] = useState<{
    isGenerating: boolean;
    currentStep: string;
    progress: number;
    total: number;
  }>({
    isGenerating: false,
    currentStep: '',
    progress: 0,
    total: 0
  });

  // School Pay Code toggle for nursery reports
  const [showPayCode, setShowPayCode] = useState<boolean>(false);

  // Track whether a batch save is in progress to prevent double-clicks
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isBatchSubjectEditorOpen, setIsBatchSubjectEditorOpen] = useState(false);
  const [subjectSelectionModePupils, setSubjectSelectionModePupils] = useState<Set<string>>(new Set());
  const [selectedSubjectsByPupil, setSelectedSubjectsByPupil] = useState<
    Record<string, SubjectCommentType[]>
  >({});


  // PDF Viewer hook
  const pdfViewer = usePDFViewer();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedStatusFilter !== 'all') count++;
    if (showPayCode) count++;
    return count;
  }, [selectedStatusFilter, showPayCode]);

  const pendingPupilCount = useMemo(() => {
    const pupilIds = new Set<string>();

    Object.entries(updatedPupils).forEach(([pupilId, terms]) => {
      if (Object.keys(terms).length > 0) pupilIds.add(pupilId);
    });
    Object.entries(updatedSubjectStatuses).forEach(([pupilId, terms]) => {
      if (Object.values(terms).some(statuses => Object.keys(statuses).length > 0)) {
        pupilIds.add(pupilId);
      }
    });

    return pupilIds.size;
  }, [updatedPupils, updatedSubjectStatuses]);

  // Use existing hooks
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  const { data: allPupils = [], isLoading: pupilsLoading } = useActivePupils();

  // Filter to only nursery classes
  const nurseryClasses = allClasses.filter((cls: Class) => cls.level === 'Nursery');
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  const { data: schoolSettings = null, isLoading: settingsLoading } = useSchoolSettings();

  const fetchLivePupilsMap = async (pupilIds: string[]): Promise<Record<string, Pupil>> => {
    if (pupilIds.length === 0) return {} as Record<string, Pupil>;

    try {
      const response = await fetch('/api/pupils/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pupilIds: [...new Set(pupilIds)] }),
      });

      if (!response.ok) {
        console.warn(`⚠️ fetchLivePupilsMap: batch API returned ${response.status}, falling back to cached data`);
        // Fall back to the locally cached pupils already loaded by the hook
        const fallback: Record<string, Pupil> = {};
        allPupils.forEach((p: Pupil) => { if (p?.id) fallback[p.id] = p; });
        return fallback;
      }

      return await response.json() as Record<string, Pupil>;
    } catch (error) {
      console.warn('⚠️ fetchLivePupilsMap: network error, falling back to cached data', error);
      // Fall back to the locally cached pupils so report generation still works
      const fallback: Record<string, Pupil> = {};
      allPupils.forEach((p: Pupil) => { if (p?.id) fallback[p.id] = p; });
      return fallback;
    }
  };

  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  const updatePupilPerformanceBatchMutation = useUpdatePupilPerformanceBatch();

  // Selected term for filtering - defaults to effective term
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  // Derive current academic year and available terms via the centralized effective-term logic
  const effectiveTermData = React.useMemo(() => getEffectiveTermForDataDisplay(academicYears), [academicYears]);
  const currentAcademicYear = effectiveTermData?.academicYear ?? null;
  const availableTerms = currentAcademicYear?.terms || [];

  // Set default term when effective term becomes available
  React.useEffect(() => {
    if (effectiveTerm?.term?.id && !selectedTermId) {
      setSelectedTermId(effectiveTerm.term.id);
    }
  }, [effectiveTerm, selectedTermId]);

  React.useEffect(() => {
    setIsBatchSubjectEditorOpen(false);
    setSubjectSelectionModePupils(new Set());
    setSelectedSubjectsByPupil({});
  }, [selectedClass, selectedTermId]);

  // Filter pupils by selected class and search term (only nursery classes)
  const filteredPupils = useMemo(() => {
    // Filter pupils to only those in nursery classes
    const nurseryPupils = allPupils?.filter((pupil: Pupil) => {
      const pupilClass = allClasses.find((c: Class) => c.id === pupil.classId);
      return pupilClass?.level === 'Nursery';
    }) || [];

    let pupils = selectedClass
      ? nurseryPupils.filter((pupil: Pupil) => pupil.classId === selectedClass)
      : [];

    // Filter by selected status
    if (selectedStatusFilter && selectedStatusFilter !== 'all') {
      pupils = pupils.filter((pupil: Pupil) => {
        const status = selectedTermId
          ? pupil.termPerformanceStatuses?.[selectedTermId] || pupil.performanceStatus
          : pupil.performanceStatus;
        return status === selectedStatusFilter;
      });
    }

    // Filter by search term (case-insensitive)
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      pupils = pupils.filter((pupil: Pupil) =>
      (pupil.firstName?.toLowerCase().includes(lowerSearchTerm) ||
        pupil.lastName?.toLowerCase().includes(lowerSearchTerm) ||
        pupil.admissionNumber?.toLowerCase().includes(lowerSearchTerm) ||
        pupil.learnerIdentificationNumber?.toLowerCase().includes(lowerSearchTerm)
      )
      );
    }

    // Sort pupils
    if (pupils.length > 0) {
      pupils.sort((a, b) => {
        let aValue: string | number = '';
        let bValue: string | number = '';
        const aStatus = selectedTermId ? (a.termPerformanceStatuses?.[selectedTermId] || a.performanceStatus) : a.performanceStatus;
        const bStatus = selectedTermId ? (b.termPerformanceStatuses?.[selectedTermId] || b.performanceStatus) : b.performanceStatus;

        switch (sortBy) {
          case 'name':
            aValue = formatPupilDisplayName(a).toLowerCase();
            bValue = formatPupilDisplayName(b).toLowerCase();
            break;
          case 'regNumber':
            aValue = (a.admissionNumber || a.learnerIdentificationNumber || '').toLowerCase();
            bValue = (b.admissionNumber || b.learnerIdentificationNumber || '').toLowerCase();
            break;
          case 'status':
            aValue = (aStatus || 'zzz').toLowerCase(); // 'zzz' to sort "Not set" items last
            bValue = (bStatus || 'zzz').toLowerCase();
            break;
          case 'firstName':
            aValue = (a.firstName || '').toLowerCase();
            bValue = (b.firstName || '').toLowerCase();
            break;
          case 'lastName':
            aValue = (a.lastName || '').toLowerCase();
            bValue = (b.lastName || '').toLowerCase();
            break;
          default:
            aValue = formatPupilDisplayName(a).toLowerCase();
            bValue = formatPupilDisplayName(b).toLowerCase();
        }

        if (aValue < bValue) {
          return sortOrder === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortOrder === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return pupils;
  }, [allPupils, allClasses, selectedClass, selectedStatusFilter, searchTerm, sortBy, sortOrder, selectedTermId]);

  // Find class object for selected class
  const selectedClassData = allClasses.find((c: Class) => c.id === selectedClass) || null;

  // Handlers
  const isTieEnabledForPupil = (pupilId: string) => {
    return manualTieOverrides[pupilId] ?? bulkTieEnabled;
  };

  const getPupilById = (pupilId: string) => allPupils.find((p: Pupil) => p.id === pupilId);

  const getSavedSubjectStatuses = (pupilId: string) => {
    const pupil = getPupilById(pupilId);
    return ((selectedTermId && pupil?.termSubjectStatuses?.[selectedTermId]) || {}) as Partial<Record<SubjectCommentType, SubjectStatus>>;
  };

  const getPendingSubjectStatuses = (pupilId: string) => {
    return ((selectedTermId && updatedSubjectStatuses[pupilId]?.[selectedTermId]) || {}) as Partial<Record<SubjectCommentType, SubjectStatus | null>>;
  };

  const getEffectiveSubjectStatuses = (pupilId: string) => ({
    ...getSavedSubjectStatuses(pupilId),
    ...getPendingSubjectStatuses(pupilId),
  });

  const applyTieToPupil = (pupilId: string, performanceStatus: string) => {
    if (!selectedTermId) return;

    const autoStatuses = buildTiedSubjectStatuses(performanceStatus);
    const effectiveStatuses = getEffectiveSubjectStatuses(pupilId);

    setAutoTieBackups(prev => {
      const existingTermBackups = prev[pupilId]?.[selectedTermId] || {};
      const nextTermBackups = { ...existingTermBackups };

      SUBJECT_COMMENT_TYPES.forEach((subject) => {
        if (!autoTiedSubjects[pupilId]?.[selectedTermId]?.[subject.value]) {
          nextTermBackups[subject.value] = effectiveStatuses[subject.value] ?? undefined;
        }
      });

      return {
        ...prev,
        [pupilId]: {
          ...(prev[pupilId] || {}),
          [selectedTermId]: nextTermBackups,
        }
      };
    });

    setUpdatedSubjectStatuses(prev => ({
      ...prev,
      [pupilId]: {
        ...(prev[pupilId] || {}),
        [selectedTermId]: {
          ...(prev[pupilId]?.[selectedTermId] || {}),
          ...autoStatuses,
        }
      }
    }));

    setAutoTiedSubjects(prev => ({
      ...prev,
      [pupilId]: {
        ...(prev[pupilId] || {}),
        [selectedTermId]: SUBJECT_COMMENT_TYPES.reduce((acc, subject) => {
          acc[subject.value] = true;
          return acc;
        }, {
          ...(prev[pupilId]?.[selectedTermId] || {})
        } as Record<SubjectCommentType, boolean>)
      }
    }));
  };

  const removeTieFromPupil = (pupilId: string) => {
    if (!selectedTermId) return;

    const savedStatuses = getSavedSubjectStatuses(pupilId);
    const pendingStatuses = getPendingSubjectStatuses(pupilId);
    const termAutoSubjects = autoTiedSubjects[pupilId]?.[selectedTermId] || {};
    const termBackups = autoTieBackups[pupilId]?.[selectedTermId] || {};
    const nextTermStatuses = { ...pendingStatuses };

    SUBJECT_COMMENT_TYPES.forEach((subject) => {
      if (!termAutoSubjects[subject.value]) return;

      const backupStatus = termBackups[subject.value];
      if (backupStatus === undefined || backupStatus === savedStatuses[subject.value]) {
        delete nextTermStatuses[subject.value];
      } else {
        nextTermStatuses[subject.value] = backupStatus;
      }
    });

    setUpdatedSubjectStatuses(prev => {
      const nextPupilTerms = {
        ...(prev[pupilId] || {}),
        [selectedTermId]: nextTermStatuses
      };

      if (Object.keys(nextTermStatuses).length === 0) {
        delete nextPupilTerms[selectedTermId];
      }

      return {
        ...prev,
        [pupilId]: nextPupilTerms
      };
    });

    setAutoTiedSubjects(prev => {
      const nextTermAutoSubjects = { ...(prev[pupilId]?.[selectedTermId] || {}) };
      SUBJECT_COMMENT_TYPES.forEach((subject) => {
        delete nextTermAutoSubjects[subject.value];
      });

      return {
        ...prev,
        [pupilId]: {
          ...(prev[pupilId] || {}),
          [selectedTermId]: nextTermAutoSubjects
        }
      };
    });

    setAutoTieBackups(prev => {
      const nextTermBackups = { ...(prev[pupilId]?.[selectedTermId] || {}) };
      SUBJECT_COMMENT_TYPES.forEach((subject) => {
        delete nextTermBackups[subject.value];
      });

      return {
        ...prev,
        [pupilId]: {
          ...(prev[pupilId] || {}),
          [selectedTermId]: nextTermBackups
        }
      };
    });
  };

  const handleStatusChange = (pupilId: string, status: string) => {
    if (!selectedTermId) return;

    setUpdatedPupils(prev => ({
      ...prev,
      [pupilId]: {
        ...(prev[pupilId] || {}),
        [selectedTermId]: status as PupilPerformanceStatus,
      },
    }));

    if (!isTieEnabledForPupil(pupilId)) return;

    applyTieToPupil(pupilId, status);
  };

  const handleTieToggle = (pupilId: string, checked: boolean) => {
    if (!selectedTermId) return;

    const pupil = getPupilById(pupilId);
    const currentPerformanceStatus = updatedPupils[pupilId]?.[selectedTermId]
      || (selectedTermId ? pupil?.termPerformanceStatuses?.[selectedTermId] : pupil?.performanceStatus)
      || pupil?.performanceStatus;

    if (checked && !currentPerformanceStatus) {
      toast({
        title: 'Select a status first',
        description: 'Set the pupil’s main performance status before tying subject statuses.',
        variant: 'destructive',
      });
      return;
    }

    setManualTieOverrides(prev => ({
      ...prev,
      [pupilId]: checked === bulkTieEnabled ? undefined : checked
    }));

    if (checked) {
      applyTieToPupil(pupilId, currentPerformanceStatus!);
    } else {
      removeTieFromPupil(pupilId);
    }
  };

  const toggleBulkTie = () => {
    const nextBulkTieEnabled = !bulkTieEnabled;
    setBulkTieEnabledPersisted(nextBulkTieEnabled);

    if (!selectedTermId) return;

    const blockedPupilIds: string[] = [];

    filteredPupils.forEach((pupil: Pupil) => {
      const effectiveTie = manualTieOverrides[pupil.id] ?? nextBulkTieEnabled;
      const currentPerformanceStatus = updatedPupils[pupil.id]?.[selectedTermId]
        || (selectedTermId ? pupil.termPerformanceStatuses?.[selectedTermId] : pupil.performanceStatus)
        || pupil.performanceStatus;

      if (effectiveTie && currentPerformanceStatus) {
        applyTieToPupil(pupil.id, currentPerformanceStatus);
      } else {
        removeTieFromPupil(pupil.id);
        if (effectiveTie) blockedPupilIds.push(pupil.id);
      }
    });

    if (blockedPupilIds.length > 0) {
      setManualTieOverrides(prev => {
        const next = { ...prev };
        blockedPupilIds.forEach(pupilId => {
          next[pupilId] = false;
        });
        return next;
      });
      toast({
        title: 'Some pupils were not tied',
        description: `${blockedPupilIds.length} pupil(s) need a main performance status first.`,
      });
    }
  };

  const togglePupilExpansion = (pupilId: string) => {
    setExpandedPupils(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pupilId)) {
        newSet.delete(pupilId);
      } else {
        newSet.add(pupilId);
      }
      return newSet;
    });
  };

  const handleSortColumn = (column: 'name' | 'firstName' | 'lastName' | 'regNumber' | 'status') => {
    if (sortBy === column || (column === 'name' && (sortBy === 'firstName' || sortBy === 'lastName'))) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const applySubjectStatusChanges = (
    pupilIds: string[],
    subjects: SubjectCommentType[],
    status: SubjectStatus | null,
  ) => {
    if (!selectedTermId || pupilIds.length === 0 || subjects.length === 0) return;

    setUpdatedSubjectStatuses(prev => {
      const next = { ...prev };

      pupilIds.forEach(pupilId => {
        const pupilTerms = { ...(next[pupilId] || {}) };
        const termStatuses = { ...(pupilTerms[selectedTermId] || {}) };
        subjects.forEach(subject => {
          termStatuses[subject] = status;
        });
        pupilTerms[selectedTermId] = termStatuses;
        next[pupilId] = pupilTerms;
      });

      return next;
    });

    // These are copied per-pupil values, not a lasting tie. A later edit to one
    // subject or pupil therefore changes only that individual pending value.
    setAutoTiedSubjects(prev => {
      const next = { ...prev };

      pupilIds.forEach(pupilId => {
        const pupilTerms = { ...(next[pupilId] || {}) };
        const termAutoSubjects = { ...(pupilTerms[selectedTermId] || {}) };
        subjects.forEach(subject => {
          delete termAutoSubjects[subject];
        });
        pupilTerms[selectedTermId] = termAutoSubjects;
        next[pupilId] = pupilTerms;
      });

      return next;
    });
  };

  const handleSubjectStatusChange = (
    pupilId: string,
    subject: SubjectCommentType,
    status: SubjectStatus | null,
  ) => {
    applySubjectStatusChanges([pupilId], [subject], status);
  };

  const getEffectiveSubjectStatus = (
    pupil: Pupil,
    subject: SubjectCommentType,
  ): SubjectStatus | null => {
    const pendingStatuses = updatedSubjectStatuses[pupil.id]?.[selectedTermId] || {};
    if (hasOwn(pendingStatuses, subject)) return pendingStatuses[subject] ?? null;
    return pupil.termSubjectStatuses?.[selectedTermId]?.[subject] ?? null;
  };

  const getBatchSubjectStatus = (subject: SubjectCommentType) => {
    if (filteredPupils.length === 0) return 'none';
    const statuses = filteredPupils.map(pupil => getEffectiveSubjectStatus(pupil, subject));
    const firstStatus = statuses[0];
    return statuses.every(status => status === firstStatus)
      ? firstStatus || 'none'
      : 'mixed';
  };

  const toggleSubjectSelectionMode = (pupilId: string) => {
    const isCurrentlySelecting = subjectSelectionModePupils.has(pupilId);
    setSubjectSelectionModePupils(prev => {
      const next = new Set(prev);
      if (isCurrentlySelecting) next.delete(pupilId);
      else next.add(pupilId);
      return next;
    });

    if (isCurrentlySelecting) {
      setSelectedSubjectsByPupil(current => {
        const selections = { ...current };
        delete selections[pupilId];
        return selections;
      });
    }
  };

  const toggleSelectedSubject = (pupilId: string, subject: SubjectCommentType) => {
    setSelectedSubjectsByPupil(prev => {
      const selected = new Set(prev[pupilId] || []);
      if (selected.has(subject)) selected.delete(subject);
      else selected.add(subject);
      return { ...prev, [pupilId]: Array.from(selected) };
    });
  };

  const applyStatusToSelectedSubjects = (
    pupilId: string,
    status: SubjectStatus | null,
  ) => {
    const selectedSubjects = selectedSubjectsByPupil[pupilId] || [];
    applySubjectStatusChanges([pupilId], selectedSubjects, status);
    setSelectedSubjectsByPupil(prev => {
      const next = { ...prev };
      delete next[pupilId];
      return next;
    });
    setSubjectSelectionModePupils(prev => {
      const next = new Set(prev);
      next.delete(pupilId);
      return next;
    });
  };

  // Print handlers
  const handlePrintList = async () => {
    if (!selectedClass || filteredPupils.length === 0) {
      toast({
        title: "No Data",
        description: "Please select a class with pupils to print the list.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while we generate your performance list...",
      });

      // Generate PDF
      const pdfDoc = (
        <PupilPerformanceListPDF
          pupils={filteredPupils}
          pupilClass={selectedClassData}
          settings={schoolSettings}
          performanceOptions={PERFORMANCE_STATUS_OPTIONS}
          selectedTermId={selectedTermId}
        />
      );

      // Generate PDF and open in viewer
      const fileName = `Performance_List_${selectedClassData?.name || 'Class'}_${new Date().toISOString().split('T')[0]}.pdf`;
      const title = 'Performance List';

      await pdfViewer.openPDF(pdfDoc, fileName, title);

      toast({
        title: "PDF Generated",
        description: "Performance list is ready for viewing.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePrintReport = async () => {
    if (!selectedClass || filteredPupils.length === 0) {
      toast({
        title: "No Data",
        description: "Please select a class with pupils to generate batch reports.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedClassData) {
      toast({
        title: "Error",
        description: "Class information not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Initialize progress tracking
      setBatchProgress({
        isGenerating: true,
        currentStep: 'Initializing batch report generation...',
        progress: 0,
        total: Math.max(0, filteredPupils.length || 0)
      });

      toast({
        title: "Generating Batch Reports",
        description: `Creating assessment reports for ${filteredPupils.length} pupils. Please wait...`,
      });

      // Get current academic year and term via centralized effective-term detection
      const effectiveData = getEffectiveTermForDataDisplay(academicYears);
      const currentAcademicYear = effectiveData?.academicYear ?? null;
      const currentTerm = effectiveData?.term ?? null;

      // Get next term dates dynamically
      const getNextTermDates = (academicYear: any, currentTerm: any) => {
        if (!academicYear || !academicYear.terms || academicYear.terms.length === 0) {
          return { startDate: null, endDate: null };
        }

        if (!currentTerm) {
          const firstTerm = academicYear.terms[0];
          return {
            startDate: firstTerm?.startDate || null,
            endDate: firstTerm?.endDate || null
          };
        }

        const currentTermIndex = academicYear.terms.findIndex((term: any) => term.id === currentTerm.id);

        if (currentTermIndex === -1) {
          const firstTerm = academicYear.terms[0];
          return {
            startDate: firstTerm?.startDate || null,
            endDate: firstTerm?.endDate || null
          };
        }

        const nextTermIndex = currentTermIndex + 1;
        if (nextTermIndex < academicYear.terms.length) {
          const nextTerm = academicYear.terms[nextTermIndex];
          return {
            startDate: nextTerm.startDate || null,
            endDate: nextTerm.endDate || null
          };
        }

        // Note: Since AcademicYear uses 'name' instead of 'year', we'll need to parse the year from the name
        const currentYearNumber = parseInt(academicYear.name.match(/\d{4}/)?.[0] || '0');
        const nextAcademicYear = academicYears.find(year => {
          const yearNumber = parseInt(year.name.match(/\d{4}/)?.[0] || '0');
          return yearNumber === (currentYearNumber + 1);
        });

        if (nextAcademicYear && nextAcademicYear.terms && nextAcademicYear.terms.length > 0) {
          const firstTermNextYear = nextAcademicYear.terms[0];
          return {
            startDate: firstTermNextYear.startDate || null,
            endDate: firstTermNextYear.endDate || null
          };
        }

        return { startDate: null, endDate: null };
      };

      const nextTermDates = getNextTermDates(currentAcademicYear, currentTerm);

      // Format dates for display
      const formatDateForDisplay = (dateString: string | null): string => {
        if (!dateString) return '';

        try {
          const date = new Date(dateString);
          const day = date.getDate();
          const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
          const year = date.getFullYear();

          const getOrdinalSuffix = (day: number): string => {
            if (day > 3 && day < 21) return 'TH';
            switch (day % 10) {
              case 1: return 'ST';
              case 2: return 'ND';
              case 3: return 'RD';
              default: return 'TH';
            }
          };

          return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
        } catch (error) {
          console.error('Error formatting date:', error);
          return '';
        }
      };

      const nextTermStartDate = formatDateForDisplay(nextTermDates.startDate);
      const nextTermEndDate = formatDateForDisplay(nextTermDates.endDate);

      console.log(`📊 Batch Report - Processing ${filteredPupils.length} pupils`);

      // Update progress
      setBatchProgress(prev => ({
        ...prev,
        currentStep: 'Preparing pupil data and fetching comments...',
        progress: 0
      }));

      const livePupilsMap = await fetchLivePupilsMap(filteredPupils.map((pupil) => pupil.id));

      setBatchProgress(prev => ({ ...prev, currentStep: 'Fetching comment templates...' }));
      const allTemplates = await commentaryService.getAllActiveTemplates();
      const commentGenerator = new BulkCommentGenerator(allTemplates);

      // Prepare all pupil data with their comments
      const allPupilsData = [];
      for (let i = 0; i < filteredPupils.length; i++) {
        const pupil = livePupilsMap[filteredPupils[i].id] || filteredPupils[i];
        const performanceStatus =
          (selectedTermId ? updatedPupils[pupil.id]?.[selectedTermId] : undefined) ||
          (selectedTermId ? pupil.termPerformanceStatuses?.[selectedTermId] : pupil.performanceStatus) ||
          pupil.performanceStatus ||
          'fair';

        // Update progress for data preparation
        setBatchProgress(prev => ({
          ...prev,
          currentStep: `Preparing data for ${formatPupilDisplayName(pupil)} (${i + 1}/${filteredPupils.length})`,
          progress: Math.max(0, i || 0)
        }));

        console.log(`📄 Processing pupil ${i + 1}/${filteredPupils.length}: ${formatPupilDisplayName(pupil)} (${performanceStatus})`);

        // Merge saved and unsaved subject statuses for the selected term (prioritize unsaved changes)
        const allSubjectStatuses = {
          ...(pupil.termSubjectStatuses?.[selectedTermId] || {}),
          ...(updatedSubjectStatuses[pupil.id]?.[selectedTermId] || {})
        } as Record<SubjectCommentType, SubjectStatus>;

        // Fetch dynamic comments for this pupil synchronously
        const comments = commentGenerator.getDynamicCommentsSync(performanceStatus, pupil.gender);

        // Fetch subject comments based on subject statuses (with term ID) synchronously
        const subjectCommentsMap = commentGenerator.getSubjectCommentsSync(
          allSubjectStatuses,
          pupil.classId,
          pupil.gender,
          selectedTermId
        );

        // Yield to the UI thread so the browser doesn't freeze and progress updates smoothly
        await new Promise(resolve => setTimeout(resolve, 0));

        allPupilsData.push({
          pupil,
          performanceStatus,
          classTeacherComment: comments.classTeacherComment,
          headTeacherComment: comments.headTeacherComment,
          subjectComments: subjectCommentsMap
        });
      }

      console.log(`📚 Batch Report - Prepared data for ${allPupilsData.length} pupils`);

      // Create a single PDF document with multiple pages - one page per pupil
      // We'll use the same template but combine all pupils into one document

      if (allPupilsData.length === 0) {
        throw new Error('No pupil data available for batch report');
      }

      console.log('📄 Batch Report - Creating single PDF with all pupils...');

      // Create individual PDF blobs and then combine them
      console.log('📄 Batch Report - Generating individual PDFs for combination...');

      // Update progress for PDF generation phase
      setBatchProgress(prev => ({
        ...prev,
        currentStep: 'Generating individual PDF reports...',
        progress: 0,
        total: Math.max(0, allPupilsData.length || 0)
      }));

      const pdfBuffers: ArrayBuffer[] = [];
      for (let i = 0; i < allPupilsData.length; i++) {
        const pupilData = allPupilsData[i];

        // Update progress for each PDF generation
        setBatchProgress(prev => ({
          ...prev,
          currentStep: `Generating PDF for ${formatPupilDisplayName(pupilData.pupil)} (${i + 1}/${allPupilsData.length})`,
          progress: Math.max(0, i || 0)
        }));

        console.log(`📄 Generating PDF ${i + 1}/${allPupilsData.length} for ${formatPupilDisplayName(pupilData.pupil)}`);

        const individualReportDoc = (
          <NurseryAssessmentReport
            pupil={pupilData.pupil}
            pupilClass={selectedClassData}
            settings={schoolSettings}
            currentAcademicYear={currentAcademicYear}
            currentTerm={currentTerm}
            nextTermStartDate={nextTermStartDate}
            nextTermEndDate={nextTermEndDate}
            performanceStatus={pupilData.performanceStatus}
            classTeacherComment={pupilData.classTeacherComment}
            headTeacherComment={pupilData.headTeacherComment}
            subjectComments={pupilData.subjectComments || {}}
            showPayCode={showPayCode}
          />
        );

        const pdfBlob = await pdf(individualReportDoc).toBlob();
        const pdfBuffer = await pdfBlob.arrayBuffer();
        pdfBuffers.push(pdfBuffer);

        // Small delay to make progress visible and prevent overwhelming the system
        if (i < allPupilsData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Update progress for combining phase
      setBatchProgress(prev => ({
        ...prev,
        currentStep: 'Combining all PDFs into single document...',
        progress: Math.max(0, allPupilsData.length || 0),
        total: Math.max(0, allPupilsData.length || 0)
      }));

      // Combine all PDFs into one using PDF-lib
      const { PDFDocument } = await import('pdf-lib');
      const combinedPdf = await PDFDocument.create();

      for (let i = 0; i < pdfBuffers.length; i++) {
        const pdfBuffer = pdfBuffers[i];

        // Update progress for combining each PDF
        setBatchProgress(prev => ({
          ...prev,
          currentStep: `Combining PDF ${i + 1}/${pdfBuffers.length} into final document...`,
        }));

        const pdf = await PDFDocument.load(pdfBuffer);
        const pages = await combinedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => combinedPdf.addPage(page));
      }

      setBatchProgress(prev => ({
        ...prev,
        currentStep: 'Finalizing combined PDF document...',
      }));

      const combinedPdfBytes = await combinedPdf.save();
      const combinedBlob = new Blob([combinedPdfBytes as any], { type: 'application/pdf' });

      console.log('📄 Batch Report - Combined all PDFs successfully');
      const pdfBlob = combinedBlob;

      // Open in PDF viewer
      const fileName = `Batch_Assessment_Reports_${selectedClassData.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      const title = 'Batch Assessment Reports';

      pdfViewer.openPDFFromBlob(pdfBlob, fileName, title);

      // Reset progress and show success
      setBatchProgress({
        isGenerating: false,
        currentStep: '',
        progress: 0,
        total: 0
      });

      toast({
        title: "Batch Report Generated",
        description: `Combined assessment report with ${allPupilsData.length} pupils from ${selectedClassData.name} has been downloaded.`,
      });

      console.log(`✅ Batch Report - Successfully generated PDF with ${filteredPupils.length} reports`);
    } catch (error) {
      console.error('Error generating batch reports:', error);

      // Reset progress on error
      setBatchProgress({
        isGenerating: false,
        currentStep: '',
        progress: 0,
        total: 0
      });

      toast({
        title: "Error",
        description: "Failed to generate batch assessment reports. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePrintReportLight = async (
    reportStyle: 'standard' | 'playful' = 'standard',
    targetPupils?: Pupil[],
  ) => {
    const pupilsToPrint = targetPupils ?? filteredPupils;
    const isIndividualPrint = pupilsToPrint.length === 1 && Boolean(targetPupils);

    if (!selectedClass || pupilsToPrint.length === 0) {
      toast({
        title: "No Data",
        description: isIndividualPrint
          ? "The selected pupil is not available for printing."
          : "Please select a class with pupils to generate batch reports.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedClassData) {
      toast({
        title: "Error",
        description: "Class information not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      setBatchProgress({
        isGenerating: true,
        currentStep: `Initializing ${reportStyle === 'playful' ? 'playful' : 'standard'} ${isIndividualPrint ? 'pupil' : 'batch'} report...`,
        progress: 0,
        total: pupilsToPrint.length,
      });

      toast({
        title: isIndividualPrint ? "Generating Pupil Report" : "Generating Batch Reports",
        description: isIndividualPrint
          ? `Creating the ${reportStyle === 'playful' ? 'playful' : 'assessment'} report for ${formatPupilDisplayName(pupilsToPrint[0])}...`
          : `Creating ${reportStyle === 'playful' ? 'playful' : 'standard'} reports for ${pupilsToPrint.length} pupils. Please wait...`,
      });

      const effectiveData = getEffectiveTermForDataDisplay(academicYears);
      const currentAcademicYear = effectiveData?.academicYear ?? null;
      const currentTerm = effectiveData?.term ?? null;

      const getNextTermDates = (academicYear: any, currentTerm: any) => {
        if (!academicYear || !academicYear.terms || academicYear.terms.length === 0) {
          return { startDate: null, endDate: null };
        }

        if (!currentTerm) {
          const firstTerm = academicYear.terms[0];
          return {
            startDate: firstTerm?.startDate || null,
            endDate: firstTerm?.endDate || null
          };
        }

        const currentTermIndex = academicYear.terms.findIndex((term: any) => term.id === currentTerm.id);
        if (currentTermIndex === -1) {
          const firstTerm = academicYear.terms[0];
          return {
            startDate: firstTerm?.startDate || null,
            endDate: firstTerm?.endDate || null
          };
        }

        const nextTermIndex = currentTermIndex + 1;
        if (nextTermIndex < academicYear.terms.length) {
          const nextTerm = academicYear.terms[nextTermIndex];
          return {
            startDate: nextTerm.startDate || null,
            endDate: nextTerm.endDate || null
          };
        }

        const currentYearNumber = parseInt(academicYear.name.match(/\d{4}/)?.[0] || '0');
        const nextAcademicYear = academicYears.find(year => {
          const yearNumber = parseInt(year.name.match(/\d{4}/)?.[0] || '0');
          return yearNumber === (currentYearNumber + 1);
        });

        if (nextAcademicYear?.terms?.length) {
          const firstTermNextYear = nextAcademicYear.terms[0];
          return {
            startDate: firstTermNextYear.startDate || null,
            endDate: firstTermNextYear.endDate || null
          };
        }

        return { startDate: null, endDate: null };
      };

      const formatDateForDisplay = (dateString: string | null): string => {
        if (!dateString) return '';

        try {
          const date = new Date(dateString);
          const day = date.getDate();
          const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
          const year = date.getFullYear();
          const getOrdinalSuffix = (value: number) => {
            if (value > 3 && value < 21) return 'TH';
            switch (value % 10) {
              case 1: return 'ST';
              case 2: return 'ND';
              case 3: return 'RD';
              default: return 'TH';
            }
          };

          return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
        } catch {
          return '';
        }
      };

      const nextTermDates = getNextTermDates(currentAcademicYear, currentTerm);
      const nextTermStartDate = formatDateForDisplay(nextTermDates.startDate);
      const nextTermEndDate = formatDateForDisplay(nextTermDates.endDate);
      const livePupilsMap = await fetchLivePupilsMap(pupilsToPrint.map((pupil) => pupil.id));

      setBatchProgress(prev => ({ ...prev, currentStep: 'Fetching comment templates...' }));
      const allTemplates = await commentaryService.getAllActiveTemplates();
      const commentGenerator = new BulkCommentGenerator(allTemplates);

      const allPupilsData = [];
      for (let i = 0; i < pupilsToPrint.length; i++) {
        const pupil = livePupilsMap[pupilsToPrint[i].id] || pupilsToPrint[i];
        const performanceStatus =
          (selectedTermId ? updatedPupils[pupil.id]?.[selectedTermId] : undefined) ||
          (selectedTermId ? pupil.termPerformanceStatuses?.[selectedTermId] : pupil.performanceStatus) ||
          pupil.performanceStatus ||
          'fair';

        setBatchProgress(prev => ({
          ...prev,
          currentStep: `Preparing ${formatPupilDisplayName(pupil)} (${i + 1}/${pupilsToPrint.length})`,
          progress: i + 1,
        }));

        const allSubjectStatuses = {
          ...(pupil.termSubjectStatuses?.[selectedTermId] || {}),
          ...(updatedSubjectStatuses[pupil.id]?.[selectedTermId] || {})
        } as Record<SubjectCommentType, SubjectStatus>;

        const comments = commentGenerator.getDynamicCommentsSync(performanceStatus, pupil.gender);
        const subjectCommentsMap = commentGenerator.getSubjectCommentsSync(
          allSubjectStatuses,
          pupil.classId,
          pupil.gender,
          selectedTermId
        );

        // Yield to the UI thread so the browser doesn't freeze and progress updates smoothly
        await new Promise(resolve => setTimeout(resolve, 0));

        allPupilsData.push({
          pupil,
          performanceStatus,
          classTeacherComment: comments.classTeacherComment,
          headTeacherComment: comments.headTeacherComment,
          subjectComments: subjectCommentsMap
        });
      }

      if (allPupilsData.length === 0) {
        throw new Error('No pupil data available for report');
      }

      setBatchProgress(prev => ({
        ...prev,
        currentStep: `Rendering ${reportStyle === 'playful' ? 'playful' : 'standard'} combined PDF...`,
        progress: Math.max(0, allPupilsData.length || 0),
        total: Math.max(0, allPupilsData.length || 0)
      }));

      const reportPdfDoc = (
        <Document title={`${reportStyle === 'playful' ? 'Playful' : 'Assessment'} Report${isIndividualPrint ? '' : 's'} - ${selectedClassData.name}`}>
          {allPupilsData.map((pupilData, index) => (
            reportStyle === 'playful' ? (
              <PlayfulNurseryReportPageContent
                key={`${pupilData.pupil.id}-${selectedTermId || 'default'}-${index}`}
                pupil={pupilData.pupil}
                pupilClass={selectedClassData}
                settings={schoolSettings}
                currentAcademicYear={currentAcademicYear}
                currentTerm={currentTerm}
                nextTermStartDate={nextTermStartDate}
                nextTermEndDate={nextTermEndDate}
                classTeacherComment={pupilData.classTeacherComment}
                headTeacherComment={pupilData.headTeacherComment}
                subjectComments={pupilData.subjectComments || {}}
              />
            ) : (
              <NurseryAssessmentReportPageContent
                key={`${pupilData.pupil.id}-${selectedTermId || 'default'}-${index}`}
                pupil={pupilData.pupil}
                pupilClass={selectedClassData}
                settings={schoolSettings}
                currentAcademicYear={currentAcademicYear}
                currentTerm={currentTerm}
                nextTermStartDate={nextTermStartDate}
                nextTermEndDate={nextTermEndDate}
                performanceStatus={pupilData.performanceStatus}
                classTeacherComment={pupilData.classTeacherComment}
                headTeacherComment={pupilData.headTeacherComment}
                subjectComments={pupilData.subjectComments || {}}
                showPayCode={showPayCode}
              />
            )
          ))}
        </Document>
      );

      const individualPupil = allPupilsData[0]?.pupil;
      const individualPupilName = individualPupil
        ? formatPupilDisplayName(individualPupil)
        : 'the selected pupil';
      const safePupilName = individualPupil
        ? individualPupilName.replace(/[^a-zA-Z0-9]/g, '_')
        : 'Pupil';
      const fileName = isIndividualPrint
        ? `${reportStyle === 'playful' ? 'Playful_Report' : 'Assessment_Report'}_${safePupilName}_${new Date().toISOString().split('T')[0]}.pdf`
        : `${reportStyle === 'playful' ? 'Batch_Playful_Reports' : 'Batch_Assessment_Reports'}_${selectedClassData.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      const title = isIndividualPrint
        ? (reportStyle === 'playful' ? 'Playful Pupil Report' : 'Pupil Assessment Report')
        : (reportStyle === 'playful' ? 'Batch Playful Reports' : 'Batch Assessment Reports');

      await pdfViewer.openPDF(reportPdfDoc, fileName, title);

      setBatchProgress({
        isGenerating: false,
        currentStep: '',
        progress: 0,
        total: 0
      });

      toast({
        title: isIndividualPrint ? "Pupil Report Generated" : "Batch Report Generated",
        description: isIndividualPrint
          ? `${reportStyle === 'playful' ? 'Playful' : 'Assessment'} report for ${individualPupilName} is ready.`
          : `Combined ${reportStyle === 'playful' ? 'playful' : 'assessment'} report with ${allPupilsData.length} pupils from ${selectedClassData.name} is ready.`,
      });
    } catch (error) {
      console.error('Error generating lightweight batch reports:', error);

      setBatchProgress({
        isGenerating: false,
        currentStep: '',
        progress: 0,
        total: 0
      });

      toast({
        title: "Error",
        description: isIndividualPrint
          ? "Failed to generate the pupil report. Please try again."
          : "Failed to generate the batch assessment report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePrintPlayfulReport = () => handlePrintReportLight('playful');

  const handleSaveChanges = async () => {
    if (Object.keys(updatedPupils).length === 0 && Object.keys(updatedSubjectStatuses).length === 0) return;

    if (isSaving) return;
    setIsSaving(true);

    try {
      // Clone every pending map while preserving explicit null deletion markers.
      // JSON cloning previously removed unset fields before they could be saved.
      const pendingPupils = Object.fromEntries(
        Object.entries(updatedPupils).map(([pupilId, terms]) => [
          pupilId,
          { ...terms },
        ]),
      ) as typeof updatedPupils;
      const pendingSubjectStatuses = Object.fromEntries(
        Object.entries(updatedSubjectStatuses).map(([pupilId, terms]) => [
          pupilId,
          Object.fromEntries(
            Object.entries(terms).map(([termId, statuses]) => [
              termId,
              { ...statuses },
            ]),
          ),
        ]),
      ) as typeof updatedSubjectStatuses;

      const allPupilIds = Array.from(
        new Set([
          ...Object.keys(pendingPupils),
          ...Object.keys(pendingSubjectStatuses),
        ]),
      );
      const patches = allPupilIds.reduce<PupilPerformancePatch[]>((acc, pupilId) => {
        const termPerformanceStatuses = pendingPupils[pupilId] || {};
        const termSubjectStatuses = Object.entries(
          pendingSubjectStatuses[pupilId] || {},
        ).reduce<NonNullable<PupilPerformancePatch['termSubjectStatuses']>>(
          (terms, [termId, statuses]) => {
            if (Object.keys(statuses).length > 0) terms[termId] = statuses;
            return terms;
          },
          {},
        );

        if (
          Object.keys(termPerformanceStatuses).length > 0 ||
          Object.keys(termSubjectStatuses).length > 0
        ) {
          acc.push({
            id: pupilId,
            ...(Object.keys(termPerformanceStatuses).length > 0 && {
              termPerformanceStatuses,
            }),
            ...(Object.keys(termSubjectStatuses).length > 0 && {
              termSubjectStatuses,
            }),
          });
        }

        return acc;
      }, []);

      if (patches.length === 0) return;

      const { savedIds, failedIds } =
        await updatePupilPerformanceBatchMutation.mutateAsync(patches);
      const savedIdSet = new Set(savedIds);

      // Remove only values that still equal the save-time snapshot. This keeps
      // any newer edit made while the request was in flight dirty and visible.
      if (savedIds.length > 0) {
        setUpdatedPupils(prev => {
          const next = { ...prev };

          savedIdSet.forEach(pupilId => {
            const currentTerms = { ...(next[pupilId] || {}) };
            Object.entries(pendingPupils[pupilId] || {}).forEach(([termId, status]) => {
              if (currentTerms[termId] === status) delete currentTerms[termId];
            });

            if (Object.keys(currentTerms).length > 0) next[pupilId] = currentTerms;
            else delete next[pupilId];
          });

          return next;
        });

        setUpdatedSubjectStatuses(prev => {
          const next = { ...prev };

          savedIdSet.forEach(pupilId => {
            const currentTerms = { ...(next[pupilId] || {}) };

            Object.entries(pendingSubjectStatuses[pupilId] || {}).forEach(
              ([termId, savedStatuses]) => {
                const currentStatuses = { ...(currentTerms[termId] || {}) };

                Object.entries(savedStatuses).forEach(([subject, status]) => {
                  if (
                    hasOwn(currentStatuses, subject) &&
                    currentStatuses[subject as SubjectCommentType] === status
                  ) {
                    delete currentStatuses[subject as SubjectCommentType];
                  }
                });

                if (Object.keys(currentStatuses).length > 0) {
                  currentTerms[termId] = currentStatuses;
                } else {
                  delete currentTerms[termId];
                }
              },
            );

            if (Object.keys(currentTerms).length > 0) next[pupilId] = currentTerms;
            else delete next[pupilId];
          });

          return next;
        });
      }

      if (failedIds.length === 0) {
        toast({
          title: 'Changes Saved',
          description: `Updated ${savedIds.length} pupil(s) successfully.`,
        });
      } else if (savedIds.length > 0) {
        toast({
          title: 'Partially Saved',
          description: `${savedIds.length} saved. ${failedIds.length} failed — please try saving again.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Save Failed',
          description: 'No changes were saved. Please check your connection and try again.',
          variant: 'destructive',
        });
      }

    } catch (err) {
      console.error('Critical error in handleSaveChanges:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred during save. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (classesLoading || pupilsLoading || academicYearsLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <GlassPageTopBar
          title="Pupil Performance Report"
          backHref="/"
        />
        <div className="max-w-7xl mx-auto px-4 py-12 flex items-center justify-center">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-muted-foreground font-medium">Loading data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 animate-in fade-in duration-500">
      <GlassPageTopBar
        title="Pupil Performance Report"
        subtitle="Manage and track pupil performance status for nursery classes. Select subject-based statuses for detailed assessment reports."
        backHref="/"
        backLabel="Back to dashboard"
        titleControls={
          <div className="flex items-center gap-1.5 lg:hidden">
            <Select value={selectedClass} onValueChange={setSelectedClass} disabled={isSaving}>
              <SelectTrigger className="h-[34px] min-w-[70px] max-w-[100px] rounded-full border-blue-200/60 bg-white/90 px-2 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden shrink-0">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {nurseryClasses.map((cls: Class) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={isSaving}>
              <SelectTrigger className="h-[34px] min-w-[65px] max-w-[85px] rounded-full border-blue-200/60 bg-white/90 px-2 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden shrink-0">
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent>
                {availableTerms.map((term: Term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        center={
          <>
            <Select value={selectedClass} onValueChange={setSelectedClass} disabled={isSaving}>
              <SelectTrigger className="h-[34px] min-w-[85px] max-w-[115px] rounded-full border-blue-200/60 bg-white/90 px-2.5 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden shrink-0">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {nurseryClasses.map((cls: Class) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={isSaving}>
              <SelectTrigger className="h-[34px] min-w-[75px] max-w-[95px] rounded-full border-blue-200/60 bg-white/90 px-2 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden shrink-0">
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent>
                {availableTerms.map((term: Term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <GlassPageSearchInput
              placeholder="Search pupils..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </>
        }
        actionsLeading={
          <GlassPageSearchInput
            placeholder="Search pupils..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            containerClassName="lg:hidden"
          />
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="Filters"
              tone="blue"
              icon={<Filter className="h-4 w-4" />}
              badge={activeFiltersCount > 0 ? activeFiltersCount : undefined}
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Filter Pupils"
            />
            <GlassActionButton
              label="Settings"
              tone="blue"
              icon={<Settings className="h-4 w-4" />}
              href="/commentary-management"
            />
            {selectedClass && filteredPupils.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <GlassActionButton
                    label="Print"
                    tone="slate"
                    icon={batchProgress.isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    disabled={batchProgress.isGenerating || isSaving}
                    aria-label="Print Options"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handlePrintList} className="cursor-pointer">
                    <List className="mr-2 h-4 w-4" />
                    Print List
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrintReportLight()} className="cursor-pointer">
                    <FileText className="mr-2 h-4 w-4" />
                    Print Report
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePrintPlayfulReport} className="cursor-pointer">
                    <FileText className="mr-2 h-4 w-4 text-emerald-600" />
                    Playful Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </GlassActionDock>
        }
      />

      <div className="max-w-7xl mx-auto px-4 pb-12">
        {/* Show recess status banner if in recess mode */}
        <RecessStatusBanner />

        {/* Batch Report Progress Indicator */}
        {batchProgress.isGenerating && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Generating Batch Report
                  </h3>
                  <span className="text-sm font-medium text-gray-600">
                    {batchProgress.progress}/{batchProgress.total}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {batchProgress.currentStep}
                </p>
                <Progress
                  value={(() => {
                    if (batchProgress.total <= 0 || isNaN(batchProgress.total) || isNaN(batchProgress.progress)) {
                      return 0;
                    }
                    const percentage = (batchProgress.progress / batchProgress.total) * 100;
                    return Math.max(0, Math.min(100, isNaN(percentage) ? 0 : percentage));
                  })()}
                  className="w-full h-2"
                />
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>Please wait while we generate your reports...</span>
                  <span>
                    {(() => {
                      if (batchProgress.total <= 0 || isNaN(batchProgress.total) || isNaN(batchProgress.progress)) {
                        return '0% complete';
                      }
                      const percentage = (batchProgress.progress / batchProgress.total) * 100;
                      return `${Math.round(isNaN(percentage) ? 0 : percentage)}% complete`;
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-200 animate-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              {/* Status Filter */}
              <div className="w-full">
                <Label htmlFor="statusFilter" className="text-sm font-medium text-gray-700 mb-1">
                  Filter by Status
                </Label>
                <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {PERFORMANCE_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* School Pay Code Toggle */}
              <div className="flex items-center gap-3 h-10">
                <Switch
                  id="showPayCode"
                  checked={showPayCode}
                  onCheckedChange={setShowPayCode}
                />
                <Label htmlFor="showPayCode" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Show School Pay Code on Reports
                </Label>
                {showPayCode && (
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                    Only shown for pupils with code
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save Changes Button */}
        {selectedClass && pendingPupilCount > 0 && (
          <div className="mb-6">
            <Button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Save Changes ({pendingPupilCount})
                </>
              )}
            </Button>
          </div>
        )}

        {/* Pupil List */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          {selectedClass ? (
            filteredPupils.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="border-b-2 border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="w-12 px-3 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsBatchSubjectEditorOpen(true)}
                          disabled={isSaving || !selectedTermId || filteredPupils.length === 0}
                          className="h-11 w-11 rounded-full p-0 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900"
                          aria-label={`Batch edit subject statuses for ${filteredPupils.length} visible pupils`}
                          title="Batch edit subject statuses"
                        >
                          {isBatchSubjectEditorOpen ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </Button>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSortColumn('name')}
                      >
                        <div className="flex items-center space-x-2 hover:text-primary transition-all duration-200 hover:scale-105 rounded-lg px-2 py-1 hover:bg-primary/10 w-fit">
                          <span>Name</span>
                          {(sortBy === 'name' || sortBy === 'firstName' || sortBy === 'lastName') && (
                            <span className="text-primary font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSortColumn('status')}
                      >
                        <div className="flex items-center space-x-2 hover:text-primary transition-all duration-200 hover:scale-105 rounded-lg px-2 py-1 hover:bg-primary/10 w-fit">
                          <span>Current Status</span>
                          {sortBy === 'status' && (
                            <span className="text-primary font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        New Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={toggleBulkTie}
                          disabled={isSaving || !selectedTermId}
                          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span>Tie</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${bulkTieEnabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {bulkTieEnabled ? 'All On' : 'All Off'}
                          </span>
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPupils.map((pupil: Pupil) => {
                      const isExpanded = expandedPupils.has(pupil.id);
                      const currentPerformanceStatus = updatedPupils[pupil.id]?.[selectedTermId]
                        || (selectedTermId ? pupil.termPerformanceStatuses?.[selectedTermId] : pupil.performanceStatus)
                        || pupil.performanceStatus;
                      const isTied = isTieEnabledForPupil(pupil.id);
                      // Get subject statuses for the selected term
                      const pupilSubjectStatuses = updatedSubjectStatuses[pupil.id]?.[selectedTermId] || {};
                      const currentSubjectStatuses = (pupil.termSubjectStatuses?.[selectedTermId] || {}) as any;
                      const isSubjectSelectionMode = subjectSelectionModePupils.has(pupil.id);
                      const selectedSubjects = selectedSubjectsByPupil[pupil.id] || [];

                      return (
                        <React.Fragment key={pupil.id}>
                          <tr className="hover:bg-gray-50">
                            <td className="w-12 px-3 py-4 whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePupilExpansion(pupil.id)}
                                className="h-8 w-8 p-0"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  {pupil.photo ? (
                                    <img className="h-10 w-10 rounded-full object-cover" src={pupil.photo} alt="" />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                      <span className="text-gray-500 font-medium">
                                        {pupil.lastName?.[0]}{pupil.firstName?.[0]}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <Link href={`/pupils/${pupil.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900 hover:underline">
                                    {formatPupilDisplayName(pupil)}
                                  </Link>
                                  <p className="text-xs text-gray-500">{pupil.admissionNumber || pupil.learnerIdentificationNumber || 'No Reg No.'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                variant="secondary"
                                className={`text-xs ${(() => {
                                  const currentPerfStatus = selectedTermId ? (pupil.termPerformanceStatuses?.[selectedTermId] || pupil.performanceStatus) : pupil.performanceStatus;
                                  return currentPerfStatus && PERFORMANCE_STATUS_OPTIONS.find(opt => opt.value === currentPerfStatus)
                                    ? PERFORMANCE_STATUS_OPTIONS.find(opt => opt.value === currentPerfStatus)?.color
                                    : 'bg-gray-100 text-gray-800';
                                })()
                                  }`}
                              >
                                {(() => {
                                  const currentPerfStatus = selectedTermId ? (pupil.termPerformanceStatuses?.[selectedTermId] || pupil.performanceStatus) : pupil.performanceStatus;
                                  return currentPerfStatus && PERFORMANCE_STATUS_OPTIONS.find(opt => opt.value === currentPerfStatus)
                                    ? PERFORMANCE_STATUS_OPTIONS.find(opt => opt.value === currentPerfStatus)?.label
                                    : 'Not set';
                                })()}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <Select
                                  value={currentPerformanceStatus}
                                  onValueChange={(value) => handleStatusChange(pupil.id, value)}
                                  disabled={isSaving || !selectedTermId}
                                >
                                <SelectTrigger className="w-full max-w-xs">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PERFORMANCE_STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                                </Select>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <Switch
                                    checked={isTied}
                                    onCheckedChange={(checked) => handleTieToggle(pupil.id, checked)}
                                    disabled={isSaving || !selectedTermId}
                                    aria-label={`Tie subject statuses to main status for ${formatPupilDisplayName(pupil)}`}
                                  />
                                  <span className="text-xs text-gray-600">
                                    {isTied ? 'On' : 'Off'}
                                  </span>
                                </div>
                              </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={batchProgress.isGenerating || isSaving}
                                    className="h-8 w-8 p-0 text-green-600 border-green-600 hover:bg-green-50"
                                    aria-label={`Choose a report to print for ${formatPupilDisplayName(pupil)}`}
                                    title="Choose Report"
                                  >
                                    {batchProgress.isGenerating
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <Printer className="h-4 w-4" />}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuItem
                                    onClick={() => handlePrintReportLight('standard', [pupil])}
                                    className="cursor-pointer"
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Print Report
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handlePrintReportLight('playful', [pupil])}
                                    className="cursor-pointer"
                                  >
                                    <FileText className="mr-2 h-4 w-4 text-emerald-600" />
                                    Playful Report
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="px-6 py-4 bg-gray-50">
                                <div className="space-y-4">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-800">Subject-Based Statuses</h4>
                                      <p className="mt-1 text-xs text-gray-600">
                                        {isSubjectSelectionMode
                                          ? 'Choose multiple subjects, then assign one status to the selection.'
                                          : 'Edit one subject or select several for a one-time group change.'}
                                      </p>
                                    </div>

                                    {selectedSubjects.length > 0 ? (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Select
                                          onValueChange={(value) => applyStatusToSelectedSubjects(
                                            pupil.id,
                                            value === 'none' ? null : (value as SubjectStatus),
                                          )}
                                          disabled={isSaving || !selectedTermId}
                                        >
                                          <SelectTrigger
                                            className="h-11 min-w-[190px] border-indigo-300 bg-white text-indigo-800"
                                            aria-label={`Set a status for ${selectedSubjects.length} selected subjects`}
                                          >
                                            <SelectValue placeholder={`Set status for ${selectedSubjects.length}`} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">Not set</SelectItem>
                                            {SUBJECT_STATUS_OPTIONS.map(status => (
                                              <SelectItem key={status.value} value={status.value}>
                                                {status.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          onClick={() => toggleSubjectSelectionMode(pupil.id)}
                                          disabled={isSaving}
                                          className="h-11"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant={isSubjectSelectionMode ? 'ghost' : 'outline'}
                                        onClick={() => toggleSubjectSelectionMode(pupil.id)}
                                        disabled={isSaving || !selectedTermId}
                                        className="h-11 min-w-[92px]"
                                      >
                                        {isSubjectSelectionMode ? 'Cancel' : 'Select'}
                                      </Button>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {SUBJECT_COMMENT_TYPES.map((subject) => {
                                      const hasChange = hasOwn(pupilSubjectStatuses, subject.value);
                                      const currentStatus = hasChange
                                        ? pupilSubjectStatuses[subject.value]
                                        : currentSubjectStatuses[subject.value];
                                      const isSelected = selectedSubjects.includes(subject.value);
                                      const checkboxId = `subject-select-${pupil.id}-${subject.value}`;

                                      return (
                                        <div
                                          key={subject.value}
                                          className={`space-y-2 rounded-xl border p-3 transition-colors ${
                                            isSelected
                                              ? 'border-indigo-400 bg-indigo-50/80'
                                              : 'border-gray-200 bg-white'
                                          }`}
                                        >
                                          <div className="flex min-h-6 items-center gap-2">
                                            {isSubjectSelectionMode && (
                                              <Checkbox
                                                id={checkboxId}
                                                checked={isSelected}
                                                onCheckedChange={() => toggleSelectedSubject(pupil.id, subject.value)}
                                                disabled={isSaving}
                                                className="h-5 w-5"
                                                aria-label={`Select ${subject.label}`}
                                              />
                                            )}
                                            <Label
                                              htmlFor={isSubjectSelectionMode ? checkboxId : undefined}
                                              className={`text-xs font-medium text-gray-700 ${
                                                isSubjectSelectionMode ? 'cursor-pointer' : ''
                                              }`}
                                            >
                                              {subject.label}
                                            </Label>
                                          </div>
                                          <Select
                                            value={currentStatus || 'none'}
                                            onValueChange={(value) => handleSubjectStatusChange(
                                              pupil.id,
                                              subject.value,
                                              value === 'none' ? null : (value as SubjectStatus)
                                            )}
                                            disabled={isSaving || !selectedTermId}
                                          >
                                            <SelectTrigger className={`w-full ${hasChange ? 'ring-2 ring-blue-500' : ''}`}>
                                              <SelectValue placeholder="Not set" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="none">Not set</SelectItem>
                                              {SUBJECT_STATUS_OPTIONS.map((status) => (
                                                <SelectItem key={status.value} value={status.value}>
                                                  {status.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-5 text-center">
                <p className="text-sm text-gray-500">
                  {searchTerm
                    ? "No pupils match the current filters."
                    : "No pupils found in this class."
                  }
                </p>
              </div>
            )
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-gray-500">Select a class to view pupils.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isBatchSubjectEditorOpen} onOpenChange={setIsBatchSubjectEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="pr-10">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>Batch edit subject statuses</DialogTitle>
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">
                {filteredPupils.length} visible pupil{filteredPupils.length === 1 ? '' : 's'}
              </Badge>
            </div>
            <DialogDescription>
              Choose a status for any subject to stage that value separately for every visible pupil
              {selectedClassData?.name ? ` in ${selectedClassData.name}` : ''}. Search and status filters determine who is included.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            These are ordinary individual pupil changes. They are not linked after applying, and they
            are saved only when you use the page’s <span className="font-semibold">Save Changes</span> button.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {SUBJECT_COMMENT_TYPES.map(subject => {
              const batchStatus = getBatchSubjectStatus(subject.value);

              return (
                <div
                  key={subject.value}
                  className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <Label
                    htmlFor={`batch-subject-${subject.value}`}
                    className="mb-2 block text-sm font-medium text-gray-800"
                  >
                    {subject.label}
                  </Label>
                  <Select
                    value={batchStatus}
                    onValueChange={(value) => applySubjectStatusChanges(
                      filteredPupils.map(pupil => pupil.id),
                      [subject.value],
                      value === 'none' ? null : (value as SubjectStatus),
                    )}
                    disabled={isSaving || !selectedTermId || filteredPupils.length === 0}
                  >
                    <SelectTrigger
                      id={`batch-subject-${subject.value}`}
                      className="h-11 w-full"
                      aria-label={`Batch status for ${subject.label}`}
                    >
                      <SelectValue placeholder="Choose status" />
                    </SelectTrigger>
                    <SelectContent>
                      {batchStatus === 'mixed' && (
                        <SelectItem value="mixed" disabled>Mixed statuses</SelectItem>
                      )}
                      <SelectItem value="none">Not set</SelectItem>
                      {SUBJECT_STATUS_OPTIONS.map(status => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setIsBatchSubjectEditorOpen(false)}
              className="h-11 min-w-[110px] bg-indigo-600 hover:bg-indigo-700"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer */}
      <PDFViewer
        isOpen={pdfViewer.isOpen}
        onClose={pdfViewer.closePDF}
        pdfBlob={pdfViewer.pdfBlob}
        fileName={pdfViewer.fileName}
        title={pdfViewer.title}
        showDownload={true}
        showPrint={true}
      />
    </div >
  );
} 
