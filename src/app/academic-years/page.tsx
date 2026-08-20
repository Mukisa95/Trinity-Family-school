"use client";

import * as React from "react";
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import type { AcademicYear, Term } from "@/types";
import { format, parseISO, differenceInCalendarDays, isWithinInterval, isValid, compareAsc, startOfDay, endOfDay } from 'date-fns';
import { CalendarDays, CheckCircle, Edit, Save, X, ArchiveIcon, ArrowUpDown, InfoIcon, Target, Loader2, MessageSquare, PlusCircle } from "lucide-react"; // Added Target, MessageSquare, PlusCircle
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAcademicYears, useUpdateAcademicYear } from "@/lib/hooks/use-academic-years";
import { DatePicker } from "@/components/common/date-picker";
import { SubjectManagement } from "./components/subject-management";
import { CommentaryBoxManagement } from "./components/commentary-box-management";
import { useSubjects } from "@/lib/hooks/use-subjects";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";
import { cn } from "@/lib/utils";
import { GlassPageRouteSkeleton } from "@/components/common/glass-page-loading";
import { FieldError, FormErrorSummary } from "@/components/ui/form-feedback";
import { useFormValidation } from "@/lib/utils/form-validation";


// --- Utility Functions (adapted from example) ---

const isDateWithinTerm = (date: Date, termStartDateStr: string, termEndDateStr: string): boolean => {
  if (!termStartDateStr || !termEndDateStr || typeof termStartDateStr !== 'string' || typeof termEndDateStr !== 'string') return false;
  const termStart = parseISO(termStartDateStr);
  const termEnd = parseISO(termEndDateStr);
  if (!isValid(termStart) || !isValid(termEnd)) return false;
  return isWithinInterval(date, { start: termStart, end: termEnd });
};

const getDaysBetween = (startDateStr: string, endDateStr: string): number => {
  if (!startDateStr || !endDateStr || typeof startDateStr !== 'string' || typeof endDateStr !== 'string') return 0;
  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);
  if (!isValid(start) || !isValid(end)) return 0;
  return differenceInCalendarDays(end, start) + 1;
};

const getRemainingDaysInTerm = (endDateStr: string): number => {
  if (!endDateStr || typeof endDateStr !== 'string') return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to start of day
  const end = parseISO(endDateStr);
  if (!isValid(end)) return 0;
  end.setHours(23, 59, 59, 999); // Normalize end date to end of day
  if (today > end) return 0; // Term has ended
  return differenceInCalendarDays(end, today) + 1;
};

const getDaysUntilTermStart = (startDateStr: string): number => {
  if (!startDateStr || typeof startDateStr !== 'string') return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = parseISO(startDateStr);
  if (!isValid(start)) return 0;
  start.setHours(0, 0, 0, 0);
  if (today >= start) return 0; // Term has started or is today
  return differenceInCalendarDays(start, today);
};

const extractCalendarDate = (dateStr: string): string => {
  if (!dateStr || typeof dateStr !== 'string') return '';

  const isoDateMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) {
    return isoDateMatch[1];
  }

  const parsed = parseISO(dateStr);
  return isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : '';
};

const parseStartOfDay = (dateStr: string): Date => parseISO(extractCalendarDate(dateStr));
const parseEndOfDay = (dateStr: string): Date => endOfDay(parseISO(extractCalendarDate(dateStr)));

const getDerivedYearBounds = (terms: Term[]): { startDate: string; endDate: string } | null => {
  const validTerms = terms
    .filter(
      (term) =>
        term.startDate &&
        term.endDate &&
        typeof term.startDate === 'string' &&
        typeof term.endDate === 'string' &&
        extractCalendarDate(term.startDate) &&
        extractCalendarDate(term.endDate)
    )
    .sort((a, b) => compareAsc(parseStartOfDay(a.startDate), parseStartOfDay(b.startDate)));

  if (validTerms.length === 0) {
    return null;
  }

  return {
    startDate: extractCalendarDate(validTerms[0].startDate),
    endDate: extractCalendarDate(validTerms[validTerms.length - 1].endDate),
  };
};

// Helper function to calculate holiday periods
const getHolidayPeriods = (year: AcademicYear) => {
  if (!year.terms || year.terms.length < 3) return [];

  const holidays = [];
  const sortedTerms = [...year.terms].filter(term =>
    term.startDate && term.endDate &&
    typeof term.startDate === 'string' && typeof term.endDate === 'string'
  ).sort((a, b) => compareAsc(parseISO(a.startDate), parseISO(b.startDate)));

  // Mid-year recess (Term 1 to Term 2)
  if (sortedTerms[0] && sortedTerms[1]) {
    const term1End = parseISO(sortedTerms[0].endDate);
    const term2Start = parseISO(sortedTerms[1].startDate);
    if (isValid(term1End) && isValid(term2Start)) {
      const holidayDays = differenceInCalendarDays(term2Start, term1End) - 1;
      holidays.push({
        name: "Mid-year Recess",
        startDate: format(new Date(term1End.getTime() + 24 * 60 * 60 * 1000), 'MMM d'),
        endDate: format(new Date(term2Start.getTime() - 24 * 60 * 60 * 1000), 'MMM d'),
        days: holidayDays,
        type: "mid-term" as const
      });
    }
  }

  // Second recess (Term 2 to Term 3)
  if (sortedTerms[1] && sortedTerms[2]) {
    const term2End = parseISO(sortedTerms[1].endDate);
    const term3Start = parseISO(sortedTerms[2].startDate);
    if (isValid(term2End) && isValid(term3Start)) {
      const holidayDays = differenceInCalendarDays(term3Start, term2End) - 1;
      holidays.push({
        name: "Second Recess",
        startDate: format(new Date(term2End.getTime() + 24 * 60 * 60 * 1000), 'MMM d'),
        endDate: format(new Date(term3Start.getTime() - 24 * 60 * 60 * 1000), 'MMM d'),
        days: holidayDays,
        type: "mid-term" as const
      });
    }
  }

  return holidays;
};

// Helper function to calculate holiday periods for editing terms (live updates)
const getEditingHolidayPeriods = (terms: Term[]): Array<{ name: string, startDate: string, endDate: string, days: number, type: 'mid-term', isValid: boolean }> => {
  if (!terms || terms.length < 3) return [];

  const holidays = [];
  const sortedTerms = [...terms].filter(term =>
    term.startDate && term.endDate &&
    typeof term.startDate === 'string' && typeof term.endDate === 'string'
  ).sort((a, b) => compareAsc(parseISO(a.startDate), parseISO(b.startDate)));

  // Mid-year recess (Term 1 to Term 2)
  if (sortedTerms[0] && sortedTerms[1]) {
    const term1End = parseISO(sortedTerms[0].endDate);
    const term2Start = parseISO(sortedTerms[1].startDate);
    const isValidDates = isValid(term1End) && isValid(term2Start);

    if (isValidDates) {
      const holidayDays = differenceInCalendarDays(term2Start, term1End) - 1;
      const isValidPeriod = holidayDays > 0;

      holidays.push({
        name: "Mid-year Recess",
        startDate: format(new Date(term1End.getTime() + 24 * 60 * 60 * 1000), 'MMM d'),
        endDate: format(new Date(term2Start.getTime() - 24 * 60 * 60 * 1000), 'MMM d'),
        days: Math.max(0, holidayDays),
        type: "mid-term" as const,
        isValid: isValidPeriod
      });
    } else {
      holidays.push({
        name: "Mid-year Recess",
        startDate: "Invalid",
        endDate: "Invalid",
        days: 0,
        type: "mid-term" as const,
        isValid: false
      });
    }
  }

  // Second recess (Term 2 to Term 3)
  if (sortedTerms[1] && sortedTerms[2]) {
    const term2End = parseISO(sortedTerms[1].endDate);
    const term3Start = parseISO(sortedTerms[2].startDate);
    const isValidDates = isValid(term2End) && isValid(term3Start);

    if (isValidDates) {
      const holidayDays = differenceInCalendarDays(term3Start, term2End) - 1;
      const isValidPeriod = holidayDays > 0;

      holidays.push({
        name: "Second Recess",
        startDate: format(new Date(term2End.getTime() + 24 * 60 * 60 * 1000), 'MMM d'),
        endDate: format(new Date(term3Start.getTime() - 24 * 60 * 60 * 1000), 'MMM d'),
        days: Math.max(0, holidayDays),
        type: "mid-term" as const,
        isValid: isValidPeriod
      });
    } else {
      holidays.push({
        name: "Second Recess",
        startDate: "Invalid",
        endDate: "Invalid",
        days: 0,
        type: "mid-term" as const,
        isValid: false
      });
    }
  }

  return holidays;
};


// --- Main Component ---

export function AcademicYearsPageContent() {
  const { toast } = useToast();

  // Firebase hooks
  const { data: rawAcademicYears = [], isLoading, error } = useAcademicYears();
  const updateAcademicYearMutation = useUpdateAcademicYear();

  const [editingYearId, setEditingYearId] = React.useState<string | null>(null);
  const [editedTerms, setEditedTerms] = React.useState<Term[]>([]);
  const termValidation = useFormValidation(editedTerms.flatMap((term, index) => {
    const stableId = term.id || String(index + 1);
    return [
      {
        id: `academic-term-${stableId}-start`,
        label: `${term.name} start date`,
        value: term.startDate,
        required: true,
        message: `Choose the start date for ${term.name}.`,
        validate: (value: unknown) => {
          const date = typeof value === 'string' ? parseStartOfDay(value) : new Date('invalid');
          if (!isValid(date)) return `Choose a valid start date for ${term.name}.`;
          const previous = editedTerms[index - 1];
          if (previous?.endDate && parseEndOfDay(previous.endDate) >= date) return `${term.name} must start after ${previous.name} ends.`;
          return undefined;
        },
      },
      {
        id: `academic-term-${stableId}-end`,
        label: `${term.name} end date`,
        value: term.endDate,
        required: true,
        message: `Choose the end date for ${term.name}.`,
        validate: (value: unknown) => {
          const end = typeof value === 'string' ? parseEndOfDay(value) : new Date('invalid');
          if (!isValid(end)) return `Choose a valid end date for ${term.name}.`;
          const start = term.startDate ? parseStartOfDay(term.startDate) : new Date('invalid');
          return isValid(start) && end < start ? `${term.name} must end on or after its start date.` : undefined;
        },
      },
    ];
  }));
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  // For auto-scrolling and "Return to Active Year" button
  const hasScrolledToActiveYear = React.useRef(false);
  const activeYearCardRef = React.useRef<HTMLDivElement | null>(null);
  const [showScrollToActiveButton, setShowScrollToActiveButton] = React.useState(false);
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  // Tab routing
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSettingTab = (searchParams.get('tab') as 'years' | 'subjects' | 'commentary') || 'years';

  const handleTabChange = (newTab: 'years' | 'subjects' | 'commentary') => {
    router.push(`/academic-years?tab=${newTab}`);
  };

  // Subjects and commentary hooks/states
  const { data: subjects = [] } = useSubjects();
  const [subjectAddTrigger, setSubjectAddTrigger] = React.useState(0);
  const [commentaryAddTrigger, setCommentaryAddTrigger] = React.useState(0);

  // Process academic years with current status
  const academicYears = React.useMemo(() => {
    const today = new Date();

    const processed = rawAcademicYears.map(year => {
      const derivedBounds = getDerivedYearBounds(year.terms);
      const effectiveStartDate = derivedBounds?.startDate || year.startDate;
      const effectiveEndDate = derivedBounds?.endDate || year.endDate;
      let isActiveYear = false;
      if (effectiveStartDate && effectiveEndDate && typeof effectiveStartDate === 'string' && typeof effectiveEndDate === 'string') {
        const yearStart = parseStartOfDay(effectiveStartDate);
        const yearEnd = parseEndOfDay(effectiveEndDate);
        if (isValid(yearStart) && isValid(yearEnd) && isWithinInterval(today, { start: yearStart, end: yearEnd })) {
          isActiveYear = true;
        }
      }

      const processedTerms = year.terms.map(term => ({
        ...term,
        isCurrent: isDateWithinTerm(today, term.startDate, term.endDate)
      }));

      return {
        ...year,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        terms: processedTerms,
        isActive: isActiveYear
      };
    });

    return processed;
  }, [rawAcademicYears]);

  const getYearStatus = React.useCallback((year: AcademicYear): { label: string; className: string; icon: React.ElementType } => {
    if (year.isLocked) return { label: 'Locked', className: 'bg-gray-100 text-gray-600 border-gray-300', icon: ArchiveIcon };
    if (year.isActive) return { label: 'Active', className: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle };

    if (year.startDate && typeof year.startDate === 'string') {
      const yearStartDate = parseStartOfDay(year.startDate);
      if (isValid(yearStartDate) && yearStartDate > new Date()) {
        return { label: 'Upcoming', className: 'bg-blue-100 text-blue-700 border-blue-300', icon: CalendarDays };
      }
    }
    return { label: 'Past', className: 'bg-amber-100 text-amber-700 border-amber-300', icon: CalendarDays };
  }, []);

  const calculatedYears = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today for accurate date comparisons

    // 1. Find the single overall next term across all relevant years
    let overallNextTermCandidate: { term: Term; yearId: string; termStartDate: Date; } | null = null;
    const potentialFutureTerms: { term: Term; yearId: string; termStartDate: Date; }[] = [];

    academicYears.forEach(year => {
      const yearStatus = getYearStatus(year); // Determine year status (Active, Upcoming, Past, Locked)
      // Consider terms from years that are not locked and not already entirely in the past
      if (!year.isLocked && yearStatus.label !== 'Past') {
        year.terms.forEach(term => {
          if (term.startDate && typeof term.startDate === 'string') {
            const termStart = parseISO(term.startDate);
            if (isValid(termStart) && termStart > today) {
              potentialFutureTerms.push({ term, yearId: year.id, termStartDate: termStart });
            }
          }
        });
      }
    });

    if (potentialFutureTerms.length > 0) {
      potentialFutureTerms.sort((a, b) => compareAsc(a.termStartDate, b.termStartDate));
      overallNextTermCandidate = potentialFutureTerms[0]; // The earliest future term is the one
    }

    // 2. Map academicYears for display, incorporating the single overallNextTerm
    const mapped = academicYears
      .map(year => {
        const status = getYearStatus(year);
        const currentTerm = year.terms.find(t => t.isCurrent); // isCurrent is set in the `academicYears` memo

        let designatedNextTermForThisYear: Term | null = null;
        if (overallNextTermCandidate && overallNextTermCandidate.yearId === year.id) {
          // If the overall next term belongs to this year, assign it
          designatedNextTermForThisYear = overallNextTermCandidate.term;
        }

        const totalDays = year.terms.reduce((acc, term) => acc + getDaysBetween(term.startDate, term.endDate), 0);

        return { year, status, currentTerm, nextTerm: designatedNextTermForThisYear, totalDays };
      })
      .sort((a, b) => {
        const comparison = parseInt(a.year.name) - parseInt(b.year.name);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    return mapped;
  }, [academicYears, getYearStatus, sortDirection]);

  const activeYearCardDOMId = React.useMemo(() => {
    const activeYearData = calculatedYears.find(cy => cy.year.isActive);
    return activeYearData ? `academic-year-card-${activeYearData.year.id}` : null;
  }, [calculatedYears]);

  React.useEffect(() => {
    if (activeYearCardDOMId && academicYears.length > 0 && !hasScrolledToActiveYear.current) {
      const element = document.getElementById(activeYearCardDOMId);
      if (element) {
        requestAnimationFrame(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          hasScrolledToActiveYear.current = true;
        });
      }
    }
  }, [activeYearCardDOMId, academicYears.length]);


  React.useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const activeNode = activeYearCardRef.current;

    if (activeNode) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          setShowScrollToActiveButton(!entry.isIntersecting && entry.boundingClientRect.height > 0);
        },
        { threshold: 0.1, rootMargin: "-150px 0px -150px 0px" } // Show button if active card is >150px from top/bottom viewport edge
      );
      observer.observe(activeNode);
      observerRef.current = observer;

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    } else {
      setShowScrollToActiveButton(false);
    }
  }, [activeYearCardDOMId]); // Re-setup observer if the active year changes


  // Helper function to convert ISO date string to YYYY-MM-DD format for HTML date inputs
  const formatDateForInput = (dateStr: string): string => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    try {
      return extractCalendarDate(dateStr);
    } catch {
      return '';
    }
  };

  const handleEditTerms = (year: AcademicYear) => {
    if (year.isLocked) {
      toast({ title: "Cannot Edit", description: "This academic year is locked and its terms cannot be modified.", variant: "destructive" });
      return;
    }
    setEditingYearId(year.id);

    // Convert dates to HTML date input format (YYYY-MM-DD)
    const termsForEditing = year.terms.map(term => ({
      ...term,
      startDate: formatDateForInput(term.startDate),
      endDate: formatDateForInput(term.endDate)
    }));

    setEditedTerms(termsForEditing);
    termValidation.resetValidation();
  };

  const handleTermDateChange = (termIndex: number, field: 'startDate' | 'endDate', value: string) => {
    const updated = editedTerms.map((term, idx) =>
      idx === termIndex ? { ...term, [field]: value } : term
    );
    setEditedTerms(updated);
    const term = editedTerms[termIndex];
    if (term) termValidation.handleFieldChange(`academic-term-${term.id || termIndex + 1}-${field === 'startDate' ? 'start' : 'end'}`);
  };

  const handleSaveTerms = async () => {
    if (!editingYearId || !editedTerms.length) return;

    if (!termValidation.validateAll().isValid) return;

    const sortedEditedTerms = [...editedTerms]
      .filter(term => term.startDate && term.endDate &&
        typeof term.startDate === 'string' && typeof term.endDate === 'string')
      .sort((a, b) => compareAsc(parseISO(a.startDate), parseISO(b.startDate)));

    try {
      const termsForSaving = sortedEditedTerms.map(term => ({
        ...term,
        startDate: term.startDate ? extractCalendarDate(term.startDate) : '',
        endDate: term.endDate ? extractCalendarDate(term.endDate) : ''
      }));
      const derivedBounds = getDerivedYearBounds(termsForSaving);

      if (!derivedBounds) {
        termValidation.setSubmissionError("Academic year dates could not be derived from the term dates.");
        return;
      }

      // Update in Firebase
      await updateAcademicYearMutation.mutateAsync({
        id: editingYearId,
        data: {
          terms: termsForSaving,
          startDate: derivedBounds.startDate,
          endDate: derivedBounds.endDate
        }
      });

      toast({ title: "Terms Updated", description: "Term dates saved successfully." });
      setEditingYearId(null);
      setEditedTerms([]);
    } catch (error) {
      termValidation.setSubmissionError("Failed to update term dates. Your dates have been preserved; please try again.");
    }
  };

  const handleCancelEdit = () => {
    setEditingYearId(null);
    setEditedTerms([]);
    termValidation.resetValidation();
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pb-12">
        <GlassPageTopBar
          title="Academic Years"
          subtitle="Loading academic years..."
          backHref="/dashboard"
          backLabel="Dashboard"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading academic years...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pb-12">
        <GlassPageTopBar
          title="Academic Years"
          subtitle="Error loading data"
          backHref="/dashboard"
          backLabel="Dashboard"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-destructive py-16">
          Error loading academic years. Please try again.
        </div>
      </div>
    );
  }

  if (!academicYears.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pb-12">
        <GlassPageTopBar
          title="Academic Years"
          subtitle="System automatically manages academic years and terms"
          backHref="/dashboard"
          backLabel="Dashboard"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>No Academic Years</AlertTitle>
            <AlertDescription>
              No academic years found. Please create an academic year to get started.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Dynamic top bar attributes based on active tab
  const pageTitle = activeSettingTab === 'years' ? 'Academic Years' :
                    activeSettingTab === 'subjects' ? 'Subject Management' :
                    'Commentary Box';

  const pageSubtitle = activeSettingTab === 'years' ? (
    'View and manage academic terms. Active year and current term are automatically detected.'
  ) : activeSettingTab === 'subjects' ? (
    'Create, view, edit, and delete subjects'
  ) : (
    'Create and manage comment templates for report cards'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pb-12">
      <GlassPageTopBar
        title={pageTitle}
        subtitle={pageSubtitle}
        className="mb-1.5"
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={
          <GlassActionDock>
            {/* Tab buttons */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-full border border-slate-200/50 backdrop-blur-sm mr-2">
              {[
                { id: 'years', label: 'Years' },
                { id: 'subjects', label: 'Subjects' },
                { id: 'commentary', label: 'Commentry' }
              ].map((tab) => {
                const isActive = activeSettingTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as any)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300",
                      isActive
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            {activeSettingTab === 'years' && (
              <GlassActionButton
                label={`Sort: ${academicYears[0]?.name || ''} - ${academicYears[academicYears.length - 1]?.name || ''}`}
                icon={<ArrowUpDown className="h-4 w-4" />}
                tone="slate"
                onClick={toggleSortDirection}
              />
            )}

            {activeSettingTab === 'subjects' && (
              <GlassActionButton
                label="New Subject"
                icon={<PlusCircle className="h-4 w-4" />}
                tone="blue"
                onClick={() => setSubjectAddTrigger(t => t + 1)}
                title="Add New Subject"
              />
            )}

            {activeSettingTab === 'commentary' && (
              <GlassActionButton
                label="New Comment"
                icon={<PlusCircle className="h-4 w-4" />}
                tone="blue"
                onClick={() => setCommentaryAddTrigger(t => t + 1)}
                title="Add Comment Template"
              />
            )}
          </GlassActionDock>
        }
      />

      <GlassSummaryBar
        left={
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-500" />
            <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 uppercase mr-2">
              Academic Setup
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {activeSettingTab === 'years' && (
                <>
                  <div className="flex items-center gap-1 bg-blue-50/80 border border-blue-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-blue-700">{academicYears.length}</span>
                    <span className="text-blue-700/85 font-medium">academic years</span>
                  </div>
                  {academicYears.find(y => y.isActive) && (
                    <div className="flex items-center gap-1 bg-green-50/80 border border-green-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                      <span className="text-green-700/85 font-medium">active:</span>
                      <span className="font-bold text-green-700">{academicYears.find(y => y.isActive)?.name}</span>
                    </div>
                  )}
                </>
              )}

              {activeSettingTab === 'subjects' && (
                <>
                  <div className="flex items-center gap-1 bg-purple-50/80 border border-purple-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-purple-700">{subjects.length}</span>
                    <span className="text-purple-700/85 font-medium">subjects total</span>
                  </div>
                  <div className="flex items-center gap-1 bg-blue-50/80 border border-blue-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-blue-700">{subjects.filter(s => s.type === 'Core').length}</span>
                    <span className="text-blue-700/85 font-medium">core</span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50/80 border border-amber-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-amber-700">{subjects.filter(s => s.type !== 'Core').length}</span>
                    <span className="text-amber-700/85 font-medium">elective</span>
                  </div>
                </>
              )}

              {activeSettingTab === 'commentary' && (
                <>
                  <div className="flex items-center gap-1 bg-emerald-50/80 border border-emerald-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-emerald-700">2</span>
                    <span className="text-emerald-700/85 font-medium">recipient roles</span>
                  </div>
                  <div className="flex items-center gap-1 bg-blue-50/80 border border-blue-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-blue-700">5</span>
                    <span className="text-blue-700/85 font-medium">performance bands</span>
                  </div>
                  <div className="flex items-center gap-1 bg-purple-50/80 border border-purple-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-purple-700">50+</span>
                    <span className="text-purple-700/85 font-medium">comment templates</span>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      <div className="max-w-none px-4 sm:px-6 lg:px-8 py-6">
        {activeSettingTab === 'years' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {calculatedYears.map(({ year, status, currentTerm, nextTerm, totalDays }) => (
          <Card
            key={year.id}
            id={`academic-year-card-${year.id}`}
            ref={year.isActive ? (el) => { activeYearCardRef.current = el; } : null}
            className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${year.isLocked ? 'border-gray-200 bg-gray-50/80' :
                year.isActive ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md' :
                  status.label === 'Upcoming' ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-sky-50' :
                    'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50'
              }`}>

            {/* Status indicator bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${year.isLocked ? 'bg-gray-400' :
                year.isActive ? 'bg-green-500' :
                  status.label === 'Upcoming' ? 'bg-blue-500' : 'bg-amber-500'
              }`} />

            <CardHeader className="pb-3 pt-4 px-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                {/* Left: Icon + Year Name */}
                <div className="flex items-center gap-2">
                  <status.icon className={`h-4 w-4 ${year.isLocked ? 'text-gray-500' :
                      year.isActive ? 'text-green-600' :
                        status.label === 'Upcoming' ? 'text-blue-600' : 'text-amber-600'
                    }`} />
                  <CardTitle className="text-xl font-bold">{year.name}</CardTitle>
                </div>

                {/* Center: Status Badge */}
                <div className="flex justify-center">
                  <Badge
                    variant={year.isActive ? 'default' : 'secondary'}
                    className={`text-xs font-medium ${year.isLocked ? 'bg-gray-100 text-gray-600' :
                        year.isActive ? 'bg-green-100 text-green-700 border-green-200' :
                          status.label === 'Upcoming' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            'bg-amber-100 text-amber-700 border-amber-200'
                      }`}
                  >
                    {status.label}
                  </Badge>
                </div>

                {/* Right: Edit Button (Icon only) */}
                <div className="flex justify-end">
                  {!year.isLocked && editingYearId !== year.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full animate-in fade-in zoom-in-95 duration-200"
                      onClick={() => handleEditTerms(year)}
                      disabled={editingYearId !== null}
                      title="Edit Terms"
                    >
                      <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      <span className="sr-only">Edit Terms</span>
                    </Button>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground font-medium mt-1.5 flex items-center gap-2">
                <span>
                  {year.startDate && typeof year.startDate === 'string' ? format(parseISO(year.startDate), 'MMM d') : 'N/A'} - {year.endDate && typeof year.endDate === 'string' ? format(parseISO(year.endDate), 'MMM d') : 'N/A'}
                </span>
                <span className="text-slate-300">•</span>
                <span>{totalDays} days</span>
              </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-2">
              {editingYearId === year.id ? (
                <div className="space-y-2">
                  <FormErrorSummary errors={termValidation.errors} submissionError={termValidation.submissionError} onSelectError={termValidation.focusField} />
                  {(() => {
                    // Calculate live holiday periods as user edits
                    const liveHolidays = getEditingHolidayPeriods(editedTerms);
                    const liveYearBounds = getDerivedYearBounds(editedTerms);

                    return editedTerms.map((term, index) => {
                      const termDays = getDaysBetween(term.startDate, term.endDate);
                      const termStart = term.startDate && typeof term.startDate === 'string' ? parseStartOfDay(term.startDate) : new Date('invalid');
                      const termEnd = term.endDate && typeof term.endDate === 'string' ? parseEndOfDay(term.endDate) : new Date('invalid');

                      // Validation flags for visual feedback
                      const hasValidDates = isValid(termStart) && isValid(termEnd);
                      const hasValidRange = hasValidDates && termEnd >= termStart;

                      return (
                        <React.Fragment key={term.id}>
                          <div className={`p-3 border rounded-lg space-y-2 transition-colors ${hasValidDates && hasValidRange
                              ? 'bg-background/80 border-green-200'
                              : 'bg-red-50/50 border-red-200'
                            }`}>
                            <div className="flex items-center justify-between">
                              <Label className="font-medium text-sm">{term.name}</Label>
                              {hasValidDates && (
                                <span className="text-xs text-muted-foreground">
                                  {termDays > 0 ? `${termDays} days` : 'Invalid range'}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label htmlFor={`academic-term-${term.id || index + 1}-start`} className={`text-xs ${termValidation.getFieldError(`academic-term-${term.id || index + 1}-start`) ? 'text-red-700' : 'text-muted-foreground'}`}>Start <span className="text-red-600">*</span></Label>
                                <DatePicker
                                  date={term.startDate && isValid(parseISO(term.startDate)) ? parseISO(term.startDate) : undefined}
                                  setDate={(d) => handleTermDateChange(index, 'startDate', d ? format(d, 'yyyy-MM-dd') : '')}
                                  placeholder="Start date"
                                  triggerProps={{ id: `academic-term-${term.id || index + 1}-start`, ...termValidation.getFieldProps(`academic-term-${term.id || index + 1}-start`) }}
                                />
                                <FieldError error={termValidation.getFieldError(`academic-term-${term.id || index + 1}-start`)} />
                              </div>
                              <div>
                                <Label htmlFor={`academic-term-${term.id || index + 1}-end`} className={`text-xs ${termValidation.getFieldError(`academic-term-${term.id || index + 1}-end`) ? 'text-red-700' : 'text-muted-foreground'}`}>End <span className="text-red-600">*</span></Label>
                                <DatePicker
                                  date={term.endDate && isValid(parseISO(term.endDate)) ? parseISO(term.endDate) : undefined}
                                  setDate={(d) => handleTermDateChange(index, 'endDate', d ? format(d, 'yyyy-MM-dd') : '')}
                                  placeholder="End date"
                                  triggerProps={{ id: `academic-term-${term.id || index + 1}-end`, ...termValidation.getFieldProps(`academic-term-${term.id || index + 1}-end`) }}
                                />
                                <FieldError error={termValidation.getFieldError(`academic-term-${term.id || index + 1}-end`)} />
                              </div>
                            </div>

                            {/* Live validation feedback */}
                            {!hasValidDates && (
                              <p className="text-xs text-red-600">⚠️ Invalid date format</p>
                            )}
                            {hasValidDates && !hasValidRange && (
                              <p className="text-xs text-red-600">⚠️ End date must be after start date</p>
                            )}
                            {index === 0 && liveYearBounds && (
                              <p className="text-xs text-muted-foreground">
                                Academic year will update to {format(parseISO(liveYearBounds.startDate), 'PPP')} - {format(parseISO(liveYearBounds.endDate), 'PPP')}
                              </p>
                            )}
                          </div>

                          {/* Live recess period display */}
                          {index < editedTerms.length - 1 && liveHolidays[index] && (
                            <div className={`px-3 py-2 rounded-lg border transition-colors ${liveHolidays[index].isValid
                                ? 'bg-orange-50 border-orange-200'
                                : 'bg-red-50 border-red-200'
                              }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${liveHolidays[index].isValid ? 'bg-orange-400' : 'bg-red-400'
                                    }`}></div>
                                  <span className={`text-xs font-medium ${liveHolidays[index].isValid ? 'text-orange-800' : 'text-red-800'
                                    }`}>
                                    {liveHolidays[index].name}
                                  </span>
                                </div>
                                <span className={`text-xs font-medium ${liveHolidays[index].isValid ? 'text-orange-600' : 'text-red-600'
                                  }`}>
                                  {liveHolidays[index].days} days
                                  {!liveHolidays[index].isValid && ' (Invalid)'}
                                </span>
                              </div>
                              <div className={`text-xs mt-1 ${liveHolidays[index].isValid ? 'text-orange-600' : 'text-red-600'
                                }`}>
                                {liveHolidays[index].isValid
                                  ? `${liveHolidays[index].startDate} - ${liveHolidays[index].endDate}`
                                  : 'Fix term dates to calculate recess period'
                                }
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="space-y-2">
                  {year.terms.map((term, termIndex) => {
                    const termDays = getDaysBetween(term.startDate, term.endDate);
                    const remainingDays = term.isCurrent ? getRemainingDaysInTerm(term.endDate) : 0;
                    const daysUntilStart = !term.isCurrent && term.startDate && typeof term.startDate === 'string' && isValid(parseISO(term.startDate)) && parseISO(term.startDate) > new Date() ? getDaysUntilTermStart(term.startDate) : 0;
                    const progress = term.isCurrent && termDays > 0 ? Math.max(0, Math.min(100, ((termDays - remainingDays) / termDays) * 100)) : 0;
                    const holidays = getHolidayPeriods(year);

                    return (
                      <React.Fragment key={term.id}>
                        <div className={`relative p-3 rounded-lg border transition-colors ${term.isCurrent ? 'bg-white border-green-200 shadow-sm' :
                            (nextTerm?.id === term.id) ? 'bg-white border-purple-200 shadow-sm' : // Simplified condition for "Next Term"
                              'bg-white/60 border-gray-200'
                          }`}>

                          {/* Term header */}
                          <div className={cn(
                            "items-center gap-2 mb-2",
                            (term.isCurrent || nextTerm?.id === term.id) ? "grid grid-cols-[1fr_auto_1fr]" : "flex justify-between"
                          )}>
                            <h4 className="font-semibold text-sm">{term.name}</h4>
                            
                            {term.isCurrent ? (
                              <>
                                <div className="flex justify-center">
                                  <Badge variant="default" className="text-xs px-2 py-0.5 bg-green-600 hover:bg-green-600">
                                    Current
                                  </Badge>
                                </div>
                                <div className="flex justify-end text-xs font-semibold text-green-700">
                                  {remainingDays} left
                                </div>
                              </>
                            ) : nextTerm?.id === term.id ? (
                              <>
                                <div className="flex justify-center">
                                  <Badge className="text-xs px-2 py-0.5 bg-purple-600 text-white hover:bg-purple-600">
                                    Next
                                  </Badge>
                                </div>
                                <div className="flex justify-end text-xs font-semibold text-purple-700">
                                  {daysUntilStart > 0 ? `in ${daysUntilStart} days` : ""}
                                </div>
                              </>
                            ) : null}
                          </div>

                          {/* Term dates & days */}
                          <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                            <span>
                              {term.startDate && typeof term.startDate === 'string' && isValid(parseISO(term.startDate)) ? format(parseISO(term.startDate), 'MMM d') : 'N/A'} - {term.endDate && typeof term.endDate === 'string' && isValid(parseISO(term.endDate)) ? format(parseISO(term.endDate), 'MMM d') : 'N/A'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>{termDays} days</span>
                          </div>

                          {/* Progress bar for current term */}
                          {term.isCurrent && (
                            <div className="mt-2.5 flex items-center gap-2 text-xs">
                              <Progress value={progress} className="h-1.5 flex-1" />
                              <span className="text-muted-foreground font-semibold min-w-[2rem] text-right">{Math.round(progress)}%</span>
                            </div>
                          )}
                        </div>

                        {/* Holiday period after this term (except for the last term) */}
                        {termIndex < year.terms.length - 1 && holidays[termIndex] && (
                          <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                                <span className="text-xs font-medium text-orange-800">{holidays[termIndex].name}</span>
                              </div>
                              <span className="text-xs text-orange-600 font-medium">{holidays[termIndex].days} days</span>
                            </div>
                            <div className="text-xs text-orange-600 mt-1">
                              {holidays[termIndex].startDate} - {holidays[termIndex].endDate}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* End-of-year holiday for the last term */}
                  {year.terms.length > 0 && (
                    <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                          <span className="text-xs font-medium text-blue-800">End-of-Year Holiday</span>
                        </div>
                        <span className="text-xs text-blue-600 font-medium">~60 days</span>
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        Dec - Jan (Next Academic Year)
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            {editingYearId === year.id && (
              <CardFooter className="px-4 pb-4 pt-0">
                <div className="flex w-full gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} className="flex-1">
                    <X className="mr-1 h-3 w-3" />Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveTerms} className="flex-1">
                    <Save className="mr-1 h-3 w-3" />Save
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        ))}`
      </div>
    )}

        {activeSettingTab === 'subjects' && (
          <SubjectManagement
            addTrigger={subjectAddTrigger}
          />
        )}

        {activeSettingTab === 'commentary' && (
          <CommentaryBoxManagement
            addTrigger={commentaryAddTrigger}
          />
        )}
      </div>

      {showScrollToActiveButton && activeSettingTab === 'years' && (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg bg-background hover:bg-accent"
          onClick={() => {
            if (activeYearCardRef.current) {
              activeYearCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          aria-label="Scroll to active year"
        >
          <Target className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}

export default function AcademicYearsPage() {
  return (
    <Suspense fallback={<GlassPageRouteSkeleton />}>
      <AcademicYearsPageContent />
    </Suspense>
  );
}
