"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Class, Pupil } from '@/types';
import { RefreshCw, CheckCircle, Download, Search, ArrowUpDown, ArrowUp, ArrowDown, Printer, FileText, List, MessageSquare, Clock, Loader2, Filter, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AcademicYear, Term } from '@/types';
import Link from 'next/link';
import { useActivePupils, useUpdatePupil } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { RecessStatusBanner } from '@/components/common/recess-status-banner';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { useCommentTemplates } from '@/hooks/useCommentTemplates';
import { getDynamicComments, getSubjectComments } from '@/utils/commentUtils';
import { pdf, Document } from '@react-pdf/renderer';
import PupilPerformanceListPDF from '@/components/reports/PupilPerformanceListPDF';
import NurseryAssessmentReport, { NurseryAssessmentReportPageContent } from '@/components/reports/NurseryAssessmentReport';
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
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { SubjectCommentType, SubjectStatus } from '@/types';
import { SUBJECT_COMMENT_TYPES, SUBJECT_STATUS_OPTIONS } from '@/lib/constants/subject-comments';
import { ChevronDown, ChevronUp } from 'lucide-react';


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

export default function RemarkReportPage() {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [updatedPupils, setUpdatedPupils] = useState<Record<string, string>>({});
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
  const [updatedSubjectStatuses, setUpdatedSubjectStatuses] = useState<Record<string, Record<string, Record<SubjectCommentType, SubjectStatus | undefined>>>>({});
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

  // Use existing hooks
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  const { data: allPupils = [], isLoading: pupilsLoading } = useActivePupils();

  // Filter to only nursery classes
  const nurseryClasses = allClasses.filter((cls: Class) => cls.level === 'Nursery');
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  const { data: schoolSettings = null, isLoading: settingsLoading } = useSchoolSettings();

  const fetchLivePupilsMap = async (pupilIds: string[]) => {
    if (pupilIds.length === 0) return {} as Record<string, Pupil>;

    const response = await fetch('/api/pupils/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pupilIds: [...new Set(pupilIds)] }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch live pupil records');
    }

    return await response.json() as Record<string, Pupil>;
  };

  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  const updatePupilMutation = useUpdatePupil();

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
      pupils = pupils.filter((pupil: Pupil) => pupil.performanceStatus === selectedStatusFilter);
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
  }, [allPupils, selectedClass, selectedStatusFilter, searchTerm, sortBy, sortOrder]);

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
    return ((selectedTermId && updatedSubjectStatuses[pupilId]?.[selectedTermId]) || {}) as Partial<Record<SubjectCommentType, SubjectStatus | undefined>>;
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
          nextTermBackups[subject.value] = effectiveStatuses[subject.value];
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
    setUpdatedPupils(prev => ({ ...prev, [pupilId]: status }));

    if (!selectedTermId || !isTieEnabledForPupil(pupilId)) return;

    applyTieToPupil(pupilId, status);
  };

  const handleTieToggle = (pupilId: string, checked: boolean) => {
    setManualTieOverrides(prev => ({
      ...prev,
      [pupilId]: checked === bulkTieEnabled ? undefined : checked
    }));

    if (!selectedTermId) return;

    const pupil = getPupilById(pupilId);
    const currentPerformanceStatus = updatedPupils[pupilId]
      || (selectedTermId ? pupil?.termPerformanceStatuses?.[selectedTermId] : pupil?.performanceStatus)
      || pupil?.performanceStatus
      || 'fair';

    if (checked) {
      applyTieToPupil(pupilId, currentPerformanceStatus);
    } else {
      removeTieFromPupil(pupilId);
    }
  };

  const toggleBulkTie = () => {
    const nextBulkTieEnabled = !bulkTieEnabled;
    setBulkTieEnabledPersisted(nextBulkTieEnabled);

    if (!selectedTermId) return;

    filteredPupils.forEach((pupil: Pupil) => {
      const effectiveTie = manualTieOverrides[pupil.id] ?? nextBulkTieEnabled;
      const currentPerformanceStatus = updatedPupils[pupil.id]
        || (selectedTermId ? pupil.termPerformanceStatuses?.[selectedTermId] : pupil.performanceStatus)
        || pupil.performanceStatus
        || 'fair';

      if (effectiveTie) {
        applyTieToPupil(pupil.id, currentPerformanceStatus);
      } else {
        removeTieFromPupil(pupil.id);
      }
    });
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

  const handleSubjectStatusChange = (pupilId: string, subject: SubjectCommentType, status: SubjectStatus | undefined) => {
    if (!selectedTermId) return; // Don't allow changes if no term is selected

    setUpdatedSubjectStatuses(prev => ({
      ...prev,
      [pupilId]: {
        ...(prev[pupilId] || {}),
        [selectedTermId]: {
          ...(prev[pupilId]?.[selectedTermId] || {}),
          [subject]: status
        }
      }
    }));

    setAutoTiedSubjects(prev => {
      const nextTermAutoSubjects = {
        ...(prev[pupilId]?.[selectedTermId] || {})
      };
      delete nextTermAutoSubjects[subject];

      return {
        ...prev,
        [pupilId]: {
          ...(prev[pupilId] || {}),
          [selectedTermId]: nextTermAutoSubjects
        }
      };
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

      // Prepare all pupil data with their comments
      const allPupilsData = [];
      for (let i = 0; i < filteredPupils.length; i++) {
        const pupil = livePupilsMap[filteredPupils[i].id] || filteredPupils[i];
        const performanceStatus = (selectedTermId ? pupil.termPerformanceStatuses?.[selectedTermId] : pupil.performanceStatus) || pupil.performanceStatus || 'fair';

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

        // Fetch dynamic comments for this pupil
        const comments = await getDynamicComments(performanceStatus, pupil.gender);

        // Fetch subject comments based on subject statuses (with term ID)
        const subjectCommentsMap = await getSubjectComments(
          allSubjectStatuses,
          pupil.classId,
          pupil.gender,
          selectedTermId
        );

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

  const handlePrintReportLight = async () => {
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
      setBatchProgress({
        isGenerating: true,
        currentStep: 'Initializing lightweight batch report generation...',
        progress: 0,
        total: Math.max(0, filteredPupils.length || 0)
      });

      toast({
        title: "Generating Batch Reports",
        description: `Creating a lighter combined report for ${filteredPupils.length} pupils. Please wait...`,
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
      const livePupilsMap = await fetchLivePupilsMap(filteredPupils.map((pupil) => pupil.id));

      const allPupilsData = [];
      for (let i = 0; i < filteredPupils.length; i++) {
        const pupil = livePupilsMap[filteredPupils[i].id] || filteredPupils[i];
        const performanceStatus = (selectedTermId ? pupil.termPerformanceStatuses?.[selectedTermId] : pupil.performanceStatus) || pupil.performanceStatus || 'fair';

        setBatchProgress(prev => ({
          ...prev,
          currentStep: `Preparing ${formatPupilDisplayName(pupil)} (${i + 1}/${filteredPupils.length})`,
          progress: i + 1,
        }));

        const allSubjectStatuses = {
          ...(pupil.termSubjectStatuses?.[selectedTermId] || {}),
          ...(updatedSubjectStatuses[pupil.id]?.[selectedTermId] || {})
        } as Record<SubjectCommentType, SubjectStatus>;

        const comments = await getDynamicComments(performanceStatus, pupil.gender);
        const subjectCommentsMap = await getSubjectComments(
          allSubjectStatuses,
          pupil.classId,
          pupil.gender,
          selectedTermId
        );

        allPupilsData.push({
          pupil,
          performanceStatus,
          classTeacherComment: comments.classTeacherComment,
          headTeacherComment: comments.headTeacherComment,
          subjectComments: subjectCommentsMap
        });
      }

      if (allPupilsData.length === 0) {
        throw new Error('No pupil data available for batch report');
      }

      setBatchProgress(prev => ({
        ...prev,
        currentStep: 'Rendering lightweight combined PDF...',
        progress: Math.max(0, allPupilsData.length || 0),
        total: Math.max(0, allPupilsData.length || 0)
      }));

      const batchPdfDoc = (
        <Document title={`Batch Assessment Reports - ${selectedClassData.name}`}>
          {allPupilsData.map((pupilData, index) => (
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
          ))}
        </Document>
      );

      const fileName = `Batch_Assessment_Reports_${selectedClassData.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      const title = 'Batch Assessment Reports';

      await pdfViewer.openPDF(batchPdfDoc, fileName, title);

      setBatchProgress({
        isGenerating: false,
        currentStep: '',
        progress: 0,
        total: 0
      });

      toast({
        title: "Batch Report Generated",
        description: `Combined assessment report with ${allPupilsData.length} pupils from ${selectedClassData.name} is ready.`,
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
        description: "Failed to generate the lighter batch assessment report. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Individual pupil print handler
  const handlePrintPupil = async (pupil: Pupil) => {
    if (!selectedClassData) {
      toast({
        title: "Error",
        description: "Class information not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generating Report",
        description: `Creating assessment report for ${formatPupilDisplayName(pupil)}...`,
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
          // If no current term, return first term
          const firstTerm = academicYear.terms[0];
          return {
            startDate: firstTerm?.startDate || null,
            endDate: firstTerm?.endDate || null
          };
        }

        // Find current term index
        const currentTermIndex = academicYear.terms.findIndex((term: any) => term.id === currentTerm.id);

        if (currentTermIndex === -1) {
          // Current term not found, return first term
          const firstTerm = academicYear.terms[0];
          return {
            startDate: firstTerm?.startDate || null,
            endDate: firstTerm?.endDate || null
          };
        }

        // Get next term (if exists in same academic year)
        const nextTermIndex = currentTermIndex + 1;
        if (nextTermIndex < academicYear.terms.length) {
          const nextTerm = academicYear.terms[nextTermIndex];
          console.log('📅 Next term found in same academic year:', nextTerm.name);
          return {
            startDate: nextTerm.startDate || null,
            endDate: nextTerm.endDate || null
          };
        }

        // If no next term in current academic year, look for next academic year's first term
        // Note: Since AcademicYear uses 'name' instead of 'year', we'll need to parse the year from the name
        const currentYearNumber = parseInt(academicYear.name.match(/\d{4}/)?.[0] || '0');
        const nextAcademicYear = academicYears.find(year => {
          const yearNumber = parseInt(year.name.match(/\d{4}/)?.[0] || '0');
          return yearNumber === (currentYearNumber + 1);
        });

        if (nextAcademicYear && nextAcademicYear.terms && nextAcademicYear.terms.length > 0) {
          const firstTermNextYear = nextAcademicYear.terms[0];
          console.log('📅 Next term found in next academic year:', firstTermNextYear.name);
          return {
            startDate: firstTermNextYear.startDate || null,
            endDate: firstTermNextYear.endDate || null
          };
        }

        // Fallback: no next term found
        console.log('📅 No next term found, using fallback');
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

          // Add ordinal suffix to day
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

      console.log('📅 Next term dates:', {
        startDate: nextTermStartDate,
        endDate: nextTermEndDate,
        rawDates: nextTermDates
      });

      const livePupilMap = await fetchLivePupilsMap([pupil.id]);
      const livePupil = livePupilMap[pupil.id] || pupil;

      // Get the performance status securely for the selected term
      const performanceStatus = (selectedTermId ? livePupil.termPerformanceStatuses?.[selectedTermId] : livePupil.performanceStatus) || livePupil.performanceStatus || 'fair';

      // Merge saved and unsaved subject statuses for the selected term (prioritize unsaved changes)
      const allSubjectStatuses = {
        ...(livePupil.termSubjectStatuses?.[selectedTermId] || {}),
        ...(updatedSubjectStatuses[pupil.id]?.[selectedTermId] || {})
      } as Record<SubjectCommentType, SubjectStatus>;

      // Fetch dynamic comments from Commentary Management system
      const comments = await getDynamicComments(performanceStatus, pupil.gender);

      // Fetch subject comments based on subject statuses (with term ID)
      const subjectCommentsMap = await getSubjectComments(
        allSubjectStatuses,
        pupil.classId,
        pupil.gender,
        selectedTermId
      );

      // Generate PDF with dynamic comments
      const pdfDoc = (
        <NurseryAssessmentReport
          pupil={livePupil}
          pupilClass={selectedClassData}
          settings={schoolSettings}
          currentAcademicYear={currentAcademicYear}
          currentTerm={currentTerm}
          nextTermStartDate={nextTermStartDate}
          nextTermEndDate={nextTermEndDate}
          performanceStatus={performanceStatus}
          classTeacherComment={comments.classTeacherComment}
          headTeacherComment={comments.headTeacherComment}
          subjectComments={subjectCommentsMap}
          showPayCode={showPayCode}
        />
      );

      // Generate PDF and open in viewer
      const fileName = `Assessment_Report_${formatPupilDisplayName(livePupil).replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      const title = 'Assessment Report';

      await pdfViewer.openPDF(pdfDoc, fileName, title);

      toast({
        title: "Report Generated",
        description: `Assessment report for ${formatPupilDisplayName(livePupil)} has been downloaded.`,
      });
    } catch (error) {
      console.error('Error generating pupil report:', error);
      toast({
        title: "Error",
        description: "Failed to generate assessment report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveChanges = async () => {
    if (Object.keys(updatedPupils).length === 0 && Object.keys(updatedSubjectStatuses).length === 0) return;

    if (isSaving) return;
    setIsSaving(true);

    try {
      // Snapshot the pending changes at save-time so UI edits during saving don't corrupt the batch
      const pendingPupils = { ...updatedPupils };
      const pendingSubjectStatuses = JSON.parse(JSON.stringify(updatedSubjectStatuses)) as typeof updatedSubjectStatuses;

      const allPupilIds = Array.from(new Set([
        ...Object.keys(pendingPupils),
        ...Object.keys(pendingSubjectStatuses)
      ]));

      if (allPupilIds.length === 0) {
        setIsSaving(false);
        return;
      }

    const BATCH_SIZE = 5; // Save 5 pupils at a time to avoid Firestore stampede
    const savedIds: string[] = [];
    const failedIds: string[] = [];

    for (let i = 0; i < allPupilIds.length; i += BATCH_SIZE) {
      const batch = allPupilIds.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (pupilId) => {
        try {
          const currentPupil = allPupils.find((p: Pupil) => p.id === pupilId);
          if (!currentPupil) return;

          const updateData: any = {};

          // Performance status
          if (pendingPupils[pupilId]) {
            if (selectedTermId) {
              const existingTermPerformanceStatuses = currentPupil.termPerformanceStatuses || {};
              updateData.termPerformanceStatuses = {
                ...existingTermPerformanceStatuses,
                [selectedTermId]: pendingPupils[pupilId] as 'good' | 'fair' | 'weak' | 'young' | 'irregular'
              };
            } else {
              updateData.performanceStatus = pendingPupils[pupilId] as 'good' | 'fair' | 'weak' | 'young' | 'irregular';
            }
          }

          // Subject statuses
          if (pendingSubjectStatuses[pupilId]) {
            const existingTermStatuses = currentPupil.termSubjectStatuses || {};
            const newTermStatuses = { ...existingTermStatuses };

            Object.entries(pendingSubjectStatuses[pupilId]).forEach(([termId, subjectStatusMap]) => {
              const existingStatusesForTerm = newTermStatuses[termId] || {};
              const newStatusesForTerm = { ...existingStatusesForTerm };

              Object.entries(subjectStatusMap as Record<string, any>).forEach(([subject, status]) => {
                if (status === undefined) {
                  delete newStatusesForTerm[subject as SubjectCommentType];
                } else {
                  newStatusesForTerm[subject as SubjectCommentType] = status as SubjectStatus;
                }
              });

              if (Object.keys(newStatusesForTerm).length > 0) {
                newTermStatuses[termId] = newStatusesForTerm;
              } else {
                delete newTermStatuses[termId];
              }
            });

            updateData.termSubjectStatuses = newTermStatuses;
          }

          // Preserve otherNames
          if (currentPupil.otherNames &&
            !PERFORMANCE_STATUS_OPTIONS.some(opt => opt.value === currentPupil.otherNames)) {
            updateData.otherNames = currentPupil.otherNames;
          }

          await updatePupilMutation.mutateAsync({ id: pupilId, data: updateData });
          savedIds.push(pupilId);
        } catch (err) {
          console.error(`Failed to save pupil ${pupilId}:`, err);
          failedIds.push(pupilId);
        }
      }));
    }

    // Granular cleanup — only remove pupils that were successfully saved
    if (savedIds.length > 0) {
      setUpdatedPupils(prev => {
        const next = { ...prev };
        savedIds.forEach(id => delete next[id]);
        return next;
      });
      setUpdatedSubjectStatuses(prev => {
        const next = { ...prev };
        savedIds.forEach(id => delete next[id]);
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
            <Select value={selectedClass} onValueChange={setSelectedClass}>
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

            <Select value={selectedTermId} onValueChange={setSelectedTermId}>
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
            <Select value={selectedClass} onValueChange={setSelectedClass}>
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

            <Select value={selectedTermId} onValueChange={setSelectedTermId}>
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
                    disabled={batchProgress.isGenerating}
                    aria-label="Print Options"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handlePrintList} className="cursor-pointer">
                    <List className="mr-2 h-4 w-4" />
                    Print List
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePrintReportLight} className="cursor-pointer">
                    <FileText className="mr-2 h-4 w-4" />
                    Print Report
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
        {selectedClass && (Object.keys(updatedPupils).length > 0 || Object.keys(updatedSubjectStatuses).length > 0) && (
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
                  Save Changes ({(Object.keys(updatedPupils).length + Object.keys(updatedSubjectStatuses).length)})
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
                        <span className="sr-only">Expand</span>
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
                          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        >
                          <span>Tie</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${bulkTieEnabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {bulkTieEnabled ? 'All On' : 'All Off'}
                          </span>
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Subject Statuses
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPupils.map((pupil: Pupil) => {
                      const isExpanded = expandedPupils.has(pupil.id);
                      const currentPerformanceStatus = updatedPupils[pupil.id]
                        || (selectedTermId ? pupil.termPerformanceStatuses?.[selectedTermId] : pupil.performanceStatus)
                        || pupil.performanceStatus
                        || 'fair';
                      const isTied = isTieEnabledForPupil(pupil.id);
                      // Get subject statuses for the selected term
                      const pupilSubjectStatuses = updatedSubjectStatuses[pupil.id]?.[selectedTermId] || {};
                      const currentSubjectStatuses = (pupil.termSubjectStatuses?.[selectedTermId] || {}) as any;
                      const hasSubjectStatusChanges = Object.keys(pupilSubjectStatuses).length > 0;

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
                                    aria-label={`Tie subject statuses to main status for ${formatPupilDisplayName(pupil)}`}
                                  />
                                  <span className="text-xs text-gray-600">
                                    {isTied ? 'On' : 'Off'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {hasSubjectStatusChanges && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                    {Object.keys(pupilSubjectStatuses).length} changed
                                  </Badge>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => togglePupilExpansion(pupil.id)}
                                  className="text-xs"
                                >
                                  {isExpanded ? 'Hide Subjects' : 'Show Subjects'}
                                </Button>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePrintPupil(pupil)}
                                className="text-green-600 border-green-600 hover:bg-green-50"
                              >
                                <Printer className="h-4 w-4 mr-1" />
                                Print Report
                              </Button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="px-6 py-4 bg-gray-50">
                                <div className="space-y-4">
                                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Subject-Based Statuses</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {SUBJECT_COMMENT_TYPES.map((subject) => {
                                      const currentStatus = pupilSubjectStatuses[subject.value] ?? currentSubjectStatuses[subject.value];
                                      const hasChange = pupilSubjectStatuses[subject.value] !== undefined;

                                      return (
                                        <div key={subject.value} className="space-y-1">
                                          <Label className="text-xs font-medium text-gray-600">
                                            {subject.label}
                                          </Label>
                                          <Select
                                            value={currentStatus || 'none'}
                                            onValueChange={(value) => handleSubjectStatusChange(
                                              pupil.id,
                                              subject.value,
                                              value === 'none' ? undefined : (value as SubjectStatus)
                                            )}
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
