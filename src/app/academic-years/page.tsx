"use client";

import * as React from "react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import type { AcademicYear, Term } from "@/types";
import { format, parseISO, differenceInCalendarDays, isWithinInterval, isValid, compareAsc } from 'date-fns';
import { CalendarDays, CheckCircle, Edit, Save, X, ArchiveIcon, ArrowUpDown, InfoIcon, Target, Loader2 } from "lucide-react"; // Added Target
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAcademicYears, useUpdateAcademicYear } from "@/lib/hooks/use-academic-years";


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
  return differenceInCalendarDays(end, today) +1;
};

const getDaysUntilTermStart = (startDateStr: string): number => {
  if (!startDateStr || typeof startDateStr !== 'string') return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = parseISO(startDateStr);
  if (!isValid(start)) return 0;
  start.setHours(0,0,0,0);
  if (today >= start) return 0; // Term has started or is today
  return differenceInCalendarDays(start, today);
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
const getEditingHolidayPeriods = (terms: Term[]): Array<{name: string, startDate: string, endDate: string, days: number, type: 'mid-term', isValid: boolean}> => {
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

export default function AcademicYearsPage() {
  const { toast } = useToast();
  
  // Firebase hooks
  const { data: rawAcademicYears = [], isLoading, error } = useAcademicYears();
  const updateAcademicYearMutation = useUpdateAcademicYear();
  
  const [editingYearId, setEditingYearId] = React.useState<string | null>(null);
  const [editedTerms, setEditedTerms] = React.useState<Term[]>([]);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc'); 

  // For auto-scrolling and "Return to Active Year" button
  const hasScrolledToActiveYear = React.useRef(false);
  const activeYearCardRef = React.useRef<HTMLDivElement | null>(null);
  const [showScrollToActiveButton, setShowScrollToActiveButton] = React.useState(false);
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  // Process academic years with current status
  const academicYears = React.useMemo(() => {
    const today = new Date();
    
    const processed = rawAcademicYears.map(year => {
      let isActiveYear = false;
      if (year.startDate && year.endDate && typeof year.startDate === 'string' && typeof year.endDate === 'string') {
        const yearStart = parseISO(year.startDate);
        const yearEnd = parseISO(year.endDate);
        if (isValid(yearStart) && isValid(yearEnd) && isWithinInterval(today, { start: yearStart, end: yearEnd })) {
          isActiveYear = true;
        }
      }

      const processedTerms = year.terms.map(term => ({
        ...term,
        isCurrent: isDateWithinTerm(today, term.startDate, term.endDate)
      }));

      return { ...year, terms: processedTerms, isActive: isActiveYear };
    });
    
    return processed;
  }, [rawAcademicYears]);

  const getYearStatus = React.useCallback((year: AcademicYear): { label: string; className: string; icon: React.ElementType } => {
    if (year.isLocked) return { label: 'Locked', className: 'bg-gray-100 text-gray-600 border-gray-300', icon: ArchiveIcon };
    if (year.isActive) return { label: 'Active', className: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle };
    
    if (year.startDate && typeof year.startDate === 'string') {
      const yearStartDate = parseISO(year.startDate);
      if (isValid(yearStartDate) && yearStartDate > new Date()){
          return { label: 'Upcoming', className: 'bg-blue-100 text-blue-700 border-blue-300', icon: CalendarDays };
      }
    }
    return { label: 'Past', className: 'bg-amber-100 text-amber-700 border-amber-300', icon: CalendarDays };
  }, []);

  const calculatedYears = React.useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0); // Normalize today for accurate date comparisons

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
      const date = new Date(dateStr);
      if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
      }
      return '';
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
  };

  const handleTermDateChange = (termIndex: number, field: 'startDate' | 'endDate', value: string) => {
    const updated = editedTerms.map((term, idx) => 
      idx === termIndex ? { ...term, [field]: value } : term
    );
    setEditedTerms(updated);
  };

  const handleSaveTerms = async () => {
    if (!editingYearId || !editedTerms.length) return;

    const currentAcademicYear = academicYears.find(y => y.id === editingYearId);
    if (!currentAcademicYear) return;

    if (!currentAcademicYear.startDate || !currentAcademicYear.endDate || 
        typeof currentAcademicYear.startDate !== 'string' || typeof currentAcademicYear.endDate !== 'string') {
      toast({ title: "Validation Error", description: "Academic year dates are invalid.", variant: "destructive" });
      return;
    }
    
    const yearStart = parseISO(currentAcademicYear.startDate);
    const yearEnd = parseISO(currentAcademicYear.endDate);

    for (const term of editedTerms) {
      if (!term.startDate || !term.endDate || typeof term.startDate !== 'string' || typeof term.endDate !== 'string') {
        toast({ title: "Validation Error", description: "All terms must have start and end dates.", variant: "destructive" });
        return;
      }
      const termStart = parseISO(term.startDate);
      const termEnd = parseISO(term.endDate);

      if (!isValid(termStart) || !isValid(termEnd)) {
        toast({ title: "Validation Error", description: `Invalid date format for ${term.name}.`, variant: "destructive" });
        return;
      }
      if (termStart < yearStart || termEnd > yearEnd) {
        toast({ title: "Validation Error", description: `Term dates for ${term.name} must be within the academic year (${format(yearStart, 'PPP')} - ${format(yearEnd, 'PPP')}).`, variant: "destructive" });
        return;
      }
      if (termEnd < termStart) {
        toast({ title: "Validation Error", description: `End date for ${term.name} must be after its start date.`, variant: "destructive" });
        return;
      }
    }

    const sortedEditedTerms = [...editedTerms]
      .filter(term => term.startDate && term.endDate && 
                     typeof term.startDate === 'string' && typeof term.endDate === 'string')
      .sort((a, b) => compareAsc(parseISO(a.startDate), parseISO(b.startDate)));
    
    for (let i = 0; i < sortedEditedTerms.length - 1; i++) {
      const currentTermEnd = parseISO(sortedEditedTerms[i].endDate);
      const nextTermStart = parseISO(sortedEditedTerms[i + 1].startDate);
      if (currentTermEnd >= nextTermStart) {
        toast({ title: "Validation Error", description: "Term dates cannot overlap.", variant: "destructive" });
        return;
      }
    }
    
    try {
      // Convert dates back to ISO format for Firebase
      const termsForSaving = sortedEditedTerms.map(term => ({
        ...term,
        startDate: term.startDate ? new Date(term.startDate).toISOString() : '',
        endDate: term.endDate ? new Date(term.endDate).toISOString() : ''
      }));

      // Update in Firebase
      await updateAcademicYearMutation.mutateAsync({
        id: editingYearId,
        data: { terms: termsForSaving }
      });

      toast({ title: "Terms Updated", description: "Term dates saved successfully." });
      setEditingYearId(null);
      setEditedTerms([]);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to update term dates. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingYearId(null);
    setEditedTerms([]);
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Academic Years Management" />
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading academic years...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Academic Years Management" />
        <div className="text-center text-destructive py-8">
          Error loading academic years. Please try again.
        </div>
      </div>
    );
  }

  if (!academicYears.length) {
     return ( 
        <div className="p-6 space-y-6">
            <PageHeader title="Academic Years Management" description="System automatically manages academic years and terms." />
            <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>No Academic Years</AlertTitle>
                <AlertDescription>
                No academic years found. Please create an academic year to get started.
                </AlertDescription>
            </Alert>
        </div>
     )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Academic Years Management"
        description="View and manage academic terms. Active year and current term are automatically detected."
        actions={
          <Button onClick={toggleSortDirection} variant="outline">
            Sort: {academicYears[0]?.name || ''} - {academicYears[academicYears.length - 1]?.name || ''}
            <ArrowUpDown className="ml-2 h-4 w-4" /> 
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {calculatedYears.map(({ year, status, currentTerm, nextTerm, totalDays }) => (
          <Card 
            key={year.id} 
            id={`academic-year-card-${year.id}`}
            ref={year.isActive ? (el) => { activeYearCardRef.current = el; } : null}
            className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${
            year.isLocked ? 'border-gray-200 bg-gray-50/80' : 
            year.isActive ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md' : 
            status.label === 'Upcoming' ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-sky-50' :
            'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50'
            }`}>
            
            {/* Status indicator bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${
              year.isLocked ? 'bg-gray-400' : 
              year.isActive ? 'bg-green-500' : 
              status.label === 'Upcoming' ? 'bg-blue-500' : 'bg-amber-500'
            }`} />
            
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <status.icon className={`h-4 w-4 ${
                    year.isLocked ? 'text-gray-500' : 
                    year.isActive ? 'text-green-600' : 
                    status.label === 'Upcoming' ? 'text-blue-600' : 'text-amber-600'
                  }`} />
                  <CardTitle className="text-xl font-bold">{year.name}</CardTitle>
                </div>
                <Badge 
                  variant={year.isActive ? 'default' : 'secondary'} 
                  className={`text-xs font-medium ${
                    year.isLocked ? 'bg-gray-100 text-gray-600' :
                    year.isActive ? 'bg-green-100 text-green-700 border-green-200' :
                    status.label === 'Upcoming' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                    'bg-amber-100 text-amber-700 border-amber-200'
                  }`}
                >
                  {status.label}
                </Badge>
              </div>
              
              <div className="text-xs text-muted-foreground font-medium">
                {year.startDate && typeof year.startDate === 'string' ? format(parseISO(year.startDate), 'MMM d, yyyy') : 'N/A'} - {year.endDate && typeof year.endDate === 'string' ? format(parseISO(year.endDate), 'MMM d, yyyy') : 'N/A'}
              </div>
              
              {/* Quick stats */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  <span>{year.terms?.length || 0} terms</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                  <span>{totalDays} days</span>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="px-4 pb-4 space-y-2">
              {editingYearId === year.id ? (
                <div className="space-y-2">
                  {(() => {
                    // Calculate live holiday periods as user edits
                    const liveHolidays = getEditingHolidayPeriods(editedTerms);
                    
                    return editedTerms.map((term, index) => {
                      const termDays = getDaysBetween(term.startDate, term.endDate);
                      const currentAcademicYear = academicYears.find(y => y.id === editingYearId);
                      const yearStart = currentAcademicYear && currentAcademicYear.startDate && typeof currentAcademicYear.startDate === 'string' ? parseISO(currentAcademicYear.startDate) : null;
                      const yearEnd = currentAcademicYear && currentAcademicYear.endDate && typeof currentAcademicYear.endDate === 'string' ? parseISO(currentAcademicYear.endDate) : null;
                      const termStart = term.startDate && typeof term.startDate === 'string' ? parseISO(term.startDate) : new Date('invalid');
                      const termEnd = term.endDate && typeof term.endDate === 'string' ? parseISO(term.endDate) : new Date('invalid');
                      
                      // Validation flags for visual feedback
                      const hasValidDates = isValid(termStart) && isValid(termEnd);
                      const isWithinYear = yearStart && yearEnd && hasValidDates && 
                                          termStart >= yearStart && termEnd <= yearEnd;
                      const hasValidRange = hasValidDates && termEnd >= termStart;
                      
                      return (
                        <React.Fragment key={term.id}>
                          <div className={`p-3 border rounded-lg space-y-2 transition-colors ${
                            hasValidDates && isWithinYear && hasValidRange
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
                                <Label htmlFor={`start-${term.id}`} className="text-xs text-muted-foreground">Start</Label>
                                <Input 
                                  type="date" 
                                  id={`start-${term.id}`} 
                                  value={term.startDate} 
                                  onChange={(e) => handleTermDateChange(index, 'startDate', e.target.value)}
                                  className={`h-8 text-xs ${
                                    hasValidDates && isWithinYear ? 'border-green-200' : 'border-red-200'
                                  }`}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`end-${term.id}`} className="text-xs text-muted-foreground">End</Label>
                                <Input 
                                  type="date" 
                                  id={`end-${term.id}`} 
                                  value={term.endDate} 
                                  onChange={(e) => handleTermDateChange(index, 'endDate', e.target.value)}
                                  className={`h-8 text-xs ${
                                    hasValidDates && isWithinYear ? 'border-green-200' : 'border-red-200'
                                  }`}
                                />
                              </div>
                            </div>
                            
                            {/* Live validation feedback */}
                            {!hasValidDates && (
                              <p className="text-xs text-red-600">⚠️ Invalid date format</p>
                            )}
                            {hasValidDates && !hasValidRange && (
                              <p className="text-xs text-red-600">⚠️ End date must be after start date</p>
                            )}
                            {hasValidDates && hasValidRange && !isWithinYear && (
                              <p className="text-xs text-red-600">⚠️ Term must be within academic year</p>
                            )}
                          </div>
                          
                          {/* Live recess period display */}
                          {index < editedTerms.length - 1 && liveHolidays[index] && (
                            <div className={`px-3 py-2 rounded-lg border transition-colors ${
                              liveHolidays[index].isValid 
                                ? 'bg-orange-50 border-orange-200' 
                                : 'bg-red-50 border-red-200'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    liveHolidays[index].isValid ? 'bg-orange-400' : 'bg-red-400'
                                  }`}></div>
                                  <span className={`text-xs font-medium ${
                                    liveHolidays[index].isValid ? 'text-orange-800' : 'text-red-800'
                                  }`}>
                                    {liveHolidays[index].name}
                                  </span>
                                </div>
                                <span className={`text-xs font-medium ${
                                  liveHolidays[index].isValid ? 'text-orange-600' : 'text-red-600'
                                }`}>
                                  {liveHolidays[index].days} days
                                  {!liveHolidays[index].isValid && ' (Invalid)'}
                                </span>
                              </div>
                              <div className={`text-xs mt-1 ${
                                liveHolidays[index].isValid ? 'text-orange-600' : 'text-red-600'
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
                        <div className={`relative p-3 rounded-lg border transition-colors ${
                          term.isCurrent ? 'bg-white border-green-200 shadow-sm' : 
                          (nextTerm?.id === term.id) ? 'bg-white border-purple-200 shadow-sm' : // Simplified condition for "Next Term"
                          'bg-white/60 border-gray-200'
                        }`}>
                          
                          {/* Term header */}
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-sm">{term.name}</h4>
                            <div className="flex gap-1">
                              {term.isCurrent && (
                                <Badge variant="default" className="text-xs px-2 py-0.5 bg-green-600 hover:bg-green-600">
                                  Current
                                </Badge>
                              )}
                              {/* Display "Next" badge if this term is the designated nextTerm for the current year card */}
                              {nextTerm?.id === term.id && (
                                <Badge className="text-xs px-2 py-0.5 bg-purple-600 text-white hover:bg-purple-600">
                                  Next
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Term dates */}
                          <div className="text-xs text-muted-foreground mb-2">
                            {term.startDate && typeof term.startDate === 'string' && isValid(parseISO(term.startDate)) ? format(parseISO(term.startDate), 'MMM d') : 'N/A'} - {term.endDate && typeof term.endDate === 'string' && isValid(parseISO(term.endDate)) ? format(parseISO(term.endDate), 'MMM d') : 'N/A'}
                          </div>
                          
                          {/* Term info */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{termDays} days</span>
                            {term.isCurrent && (
                              <span className="font-medium text-green-700">{remainingDays} left</span>
                            )}
                            {/* Display "starts in X days" if this term is the designated nextTerm */}
                            {nextTerm?.id === term.id && daysUntilStart > 0 && (
                              <span className="font-medium text-purple-700">in {daysUntilStart} days</span>
                            )}
                          </div>
                          
                          {/* Progress bar for current term */}
                          {term.isCurrent && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Progress</span>
                                <span>{Math.round(progress)}%</span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
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

            <CardFooter className="px-4 pb-4 pt-0">
              {editingYearId === year.id ? (
                <div className="flex w-full gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} className="flex-1">
                    <X className="mr-1 h-3 w-3" />Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveTerms} className="flex-1">
                    <Save className="mr-1 h-3 w-3" />Save
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors" 
                  onClick={() => handleEditTerms(year)} 
                  disabled={year.isLocked || editingYearId !== null}
                >
                  <Edit className="mr-2 h-3 w-3" /> Edit Terms
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {showScrollToActiveButton && (
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

    
