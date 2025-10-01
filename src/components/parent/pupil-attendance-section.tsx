"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle } from '@/components/ui/modern-dialog';
import { 
  Calendar,
  CalendarDays,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Edit3,
  Save,
  X,
  CheckCircle,
  XCircle,
  Info,
  BarChart3,
  Users,
  BookOpen,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAttendanceByPupil, useUpdateAttendanceRecord } from '@/lib/hooks/use-attendance';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useExcludedDays } from '@/lib/hooks/use-excluded-days';
import { usePupil } from '@/lib/hooks/use-pupils';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, getDay } from 'date-fns';
import { isSchoolDay } from '@/lib/utils/attendance-academic-utils';
import type { AttendanceRecord, AttendanceStatus } from '@/types';

interface PupilAttendanceSectionProps {
  pupilId: string;
}

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'term';

export function PupilAttendanceSection({ pupilId }: PupilAttendanceSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editRemarks, setEditRemarks] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const { toast } = useToast();

  // Fetch data
  const { data: attendanceRecords = [], isLoading: attendanceLoading, error: attendanceError } = useAttendanceByPupil(pupilId);
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  const { data: excludedDays = [] } = useExcludedDays();
  const { data: pupil } = usePupil(pupilId);
  const updateAttendanceMutation = useUpdateAttendanceRecord();

  // Set default academic year and term when data loads
  useEffect(() => {
    if (academicYears.length > 0 && !selectedAcademicYearId) {
      const currentYear = academicYears.find(year => year.isActive);
      if (currentYear) {
        setSelectedAcademicYearId(currentYear.id);
        
        // Set current term
        const now = new Date();
        const currentTerm = currentYear.terms.find(term => {
          if (!term.startDate || !term.endDate) return false;
          const termStart = new Date(term.startDate);
          const termEnd = new Date(term.endDate);
          return now >= termStart && now <= termEnd;
        });
        
        if (currentTerm) {
          setSelectedTermId(currentTerm.id);
        } else if (currentYear.terms.length > 0) {
          setSelectedTermId(currentYear.terms[0].id);
        }
      }
    }
  }, [academicYears, selectedAcademicYearId]);

  // Set default date, week, and month when view mode changes
  useEffect(() => {
    const now = new Date();
    
    if (viewMode === 'daily' && !selectedDate) {
      setSelectedDate(format(now, 'yyyy-MM-dd'));
    }
    
    if (viewMode === 'weekly' && !selectedWeek) {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      setSelectedWeek(format(weekStart, 'yyyy-MM-dd'));
    }
    
    if (viewMode === 'monthly' && !selectedMonth) {
      setSelectedMonth(format(now, 'yyyy-MM'));
    }
  }, [viewMode, selectedDate, selectedWeek, selectedMonth]);

  // Get current academic year if none selected
  const currentAcademicYear = academicYears.find(ay => ay.isActive);
  const effectiveAcademicYearId = selectedAcademicYearId || currentAcademicYear?.id || '';

  // Get current term if none selected
  const currentTerm = useMemo(() => {
    if (!currentAcademicYear) return null;
    
    const now = new Date();
    
    // Find term that contains current date
    const termByDate = currentAcademicYear.terms.find(term => {
      if (!term.startDate || !term.endDate) return false;
      const termStart = new Date(term.startDate);
      const termEnd = new Date(term.endDate);
      return now >= termStart && now <= termEnd;
    });
    
    if (termByDate) {
      return termByDate;
    }
    
    // Fallback: find next upcoming term or use first term
    const upcomingTerm = currentAcademicYear.terms.find(term => {
      if (!term.startDate) return false;
      const termStart = new Date(term.startDate);
      return termStart > now;
    });
    
    return upcomingTerm || currentAcademicYear.terms[0] || null;
  }, [currentAcademicYear]);

  const effectiveTermId = selectedTermId || currentTerm?.id || '';

  // Get available terms for selected academic year
  const availableTerms = useMemo(() => {
    const selectedYear = academicYears.find(year => year.id === effectiveAcademicYearId);
    return selectedYear ? selectedYear.terms : [];
  }, [academicYears, effectiveAcademicYearId]);

  // Helper function to get personalized attendance message
  const getPersonalizedMessage = (record: AttendanceRecord | null, date: string) => {
    const firstName = pupil?.firstName || 'Your child';
    const selectedDate = new Date(date);
    const isSelectedDateToday = isToday(selectedDate);
    const dateText = isSelectedDateToday ? 'today' : `on ${format(selectedDate, 'EEEE, MMMM dd, yyyy')}`;
    
    // console.log('🎯 getPersonalizedMessage called:', {
    //   record: record ? { id: record.id, date: record.date, status: record.status } : null,
    //   date,
    //   firstName,
    //   isSelectedDateToday
    // });
    
    // Check if it's an excluded day (weekend, holiday, etc.)
    const excludedDayReason = getExcludedDayReason(selectedDate);
    const isExcludedDay = excludedDayReason !== 'a regular school day';
    
    if (!record) {
      // console.log('❌ No record found for date:', date);
      if (isExcludedDay) {
        // It's an excluded day, so child doesn't need to come to school
        return `${firstName} does not have to come to school ${dateText} because it is: ${excludedDayReason}`;
      } else {
        // It's a school day but no attendance record was taken
        const recordText = isSelectedDateToday ? "today's attendance record" : 
                          isToday(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000)) ? "yesterday's attendance record" :
                          `the record of ${format(selectedDate, 'MMMM dd')}`;
        return `${recordText} was not taken so contact the school for more information.`;
      }
    }
    
    switch (record.status) {
      case 'Present':
        return `${firstName} was present ${dateText}`;
      case 'Late':
        return `${firstName} came late ${dateText}`;
      case 'Absent':
        return `${firstName} did not come to school ${dateText}`;
      case 'Excused':
        return `${firstName} was given permission to skip school ${dateText}`;
      default:
        return `${firstName}'s attendance for ${dateText}`;
    }
  };

  // Helper function to get excluded day reason
  const getExcludedDayReason = (date: Date) => {
    const dayOfWeek = getDay(date);
    const dateString = format(date, 'yyyy-MM-dd');
    
    // Check if it's a weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return dayOfWeek === 0 ? 'a Sunday' : 'a Saturday';
    }
    
    // Check if it's in excluded days (specific dates)
    const excludedDay = excludedDays.find(day => 
      day.type === 'specific_date' && day.date === dateString
    );
    if (excludedDay) {
      return excludedDay.description || 'a holiday';
    }
    
    // Check if it's in excluded days (recurring days of week)
    const recurringExcludedDay = excludedDays.find(day => 
      day.type === 'recurring_day_of_week' && day.dayOfWeek === dayOfWeek
    );
    if (recurringExcludedDay) {
      return recurringExcludedDay.description || 'a non-school day';
    }
    
    // Check if it's a school day
    if (!isSchoolDay(date, currentAcademicYear || null, excludedDays)) {
      return 'a non-school day';
    }
    
    return 'a regular school day';
  };

  // Helper function to generate all days in a period
  const getDaysInPeriod = () => {
    if (viewMode === 'weekly' && selectedWeek) {
      const weekStart = new Date(selectedWeek);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const days = [];
      let currentDate = new Date(weekStart);
      
      while (currentDate <= weekEnd) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return days;
    }
    
    if (viewMode === 'monthly' && selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthEnd = endOfMonth(monthStart);
      const days = [];
      let currentDate = new Date(monthStart);
      
      while (currentDate <= monthEnd) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return days;
    }
    
    return [];
  };

  // Get all days in the current period
  const daysInPeriod = getDaysInPeriod();

  // Generate dynamic options based on view mode
  const dynamicOptions = useMemo(() => {
    const now = new Date();
    
    switch (viewMode) {
      case 'daily':
        // Generate last 30 days
        const dailyOptions = [];
        for (let i = 0; i < 30; i++) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          dailyOptions.push({
            value: format(date, 'yyyy-MM-dd'),
            label: format(date, 'EEEE, MMMM dd, yyyy'),
            isCurrent: i === 0
          });
        }
        return dailyOptions;
        
      case 'weekly':
        // Generate last 12 weeks
        const weeklyOptions = [];
        for (let i = 0; i < 12; i++) {
          const weekStart = startOfWeek(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          weeklyOptions.push({
            value: format(weekStart, 'yyyy-MM-dd'),
            label: `Week of ${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd, yyyy')}`,
            isCurrent: i === 0
          });
        }
        return weeklyOptions;
        
      case 'monthly':
        // Generate last 12 months
        const monthlyOptions = [];
        for (let i = 0; i < 12; i++) {
          const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthlyOptions.push({
            value: format(month, 'yyyy-MM'),
            label: format(month, 'MMMM yyyy'),
            isCurrent: i === 0
          });
        }
        return monthlyOptions;
        
      case 'yearly':
        // Return academic years
        return academicYears.map(year => ({
          value: year.id,
          label: year.name,
          isCurrent: year.isActive
        }));
        
      case 'term':
        // Return terms for selected academic year
        return availableTerms.map(term => ({
          value: term.id,
          label: term.name,
          isCurrent: term.isCurrent
        }));
        
      default:
        return [];
    }
  }, [viewMode, academicYears, availableTerms]);

  // Filter records by selected academic year and term
  const filteredRecords = useMemo(() => {
    let filtered = attendanceRecords;
    
    // Debug logging (commented out for performance)
    // console.log('🔍 Debugging attendance records:', {
    //   totalRecords: attendanceRecords.length,
    //   effectiveAcademicYearId,
    //   effectiveTermId,
    //   viewMode,
    //   sampleRecords: attendanceRecords.slice(0, 3).map(r => ({
    //     id: r.id,
    //     date: r.date,
    //     dateType: typeof r.date,
    //     formattedDate: format(new Date(r.date), 'yyyy-MM-dd'),
    //     academicYearId: r.academicYearId,
    //     termId: r.termId,
    //     status: r.status
    //   }))
    // });
    
    // Filter by academic year
    if (effectiveAcademicYearId) {
      filtered = filtered.filter(record => record.academicYearId === effectiveAcademicYearId);
    }
    
    // Filter by term for all views (not just term view)
    if (effectiveTermId) {
      filtered = filtered.filter(record => record.termId === effectiveTermId);
    }
    return filtered;
  }, [attendanceRecords, effectiveAcademicYearId, effectiveTermId, viewMode]);

  // Helper function to get term summary statistics
  const getTermSummary = () => {
    if (viewMode !== 'term' || !effectiveTermId) return null;
    
    const term = availableTerms.find(t => t.id === effectiveTermId);
    if (!term || !term.startDate || !term.endDate) return null;

    const termRecords = filteredRecords.filter(record => record.termId === effectiveTermId);
    
    const present = termRecords.filter(r => r.status === 'Present').length;
    const absent = termRecords.filter(r => r.status === 'Absent').length;
    const late = termRecords.filter(r => r.status === 'Late').length;
    const excused = termRecords.filter(r => r.status === 'Excused').length;
    const total = termRecords.length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      term,
      present,
      absent,
      late,
      excused,
      total,
      attendanceRate
    };
  };

  // Helper function to get monthly breakdown for a term
  const getMonthlyBreakdown = () => {
    if (viewMode !== 'term' || !effectiveTermId) return [];
    
    const term = availableTerms.find(t => t.id === effectiveTermId);
    if (!term || !term.startDate || !term.endDate) return [];

    const termStart = new Date(term.startDate);
    const termEnd = new Date(term.endDate);
    const termRecords = filteredRecords.filter(record => record.termId === effectiveTermId);
    const monthlyData: { [key: string]: any } = {};

    // Generate all months in the term period
    const currentMonth = startOfMonth(termStart);
    const endMonth = endOfMonth(termEnd);
    
    while (currentMonth <= endMonth) {
      const monthKey = format(currentMonth, 'yyyy-MM');
      const monthName = format(currentMonth, 'MMMM yyyy');
      
      monthlyData[monthKey] = {
        monthKey,
        monthName,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
        records: []
      };
      
      // Move to next month
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Now populate with actual attendance records
    termRecords.forEach(record => {
      const monthKey = format(new Date(record.date), 'yyyy-MM');
      
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].records.push(record);
        monthlyData[monthKey][record.status.toLowerCase()]++;
        monthlyData[monthKey].total++;
      }
    });

    return Object.values(monthlyData).map(month => ({
      ...month,
      attendanceRate: month.total > 0 ? Math.round((month.present / month.total) * 100) : 0
    }));
  };

  // Helper function to get academic year summary statistics
  const getYearSummary = () => {
    if (viewMode !== 'yearly' || !effectiveAcademicYearId) return null;
    
    const academicYear = academicYears.find(ay => ay.id === effectiveAcademicYearId);
    if (!academicYear) return null;

    const yearRecords = filteredRecords.filter(record => record.academicYearId === effectiveAcademicYearId);
    
    const present = yearRecords.filter(r => r.status === 'Present').length;
    const absent = yearRecords.filter(r => r.status === 'Absent').length;
    const late = yearRecords.filter(r => r.status === 'Late').length;
    const excused = yearRecords.filter(r => r.status === 'Excused').length;
    const total = yearRecords.length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      academicYear,
      present,
      absent,
      late,
      excused,
      total,
      attendanceRate
    };
  };

  // Helper function to get term breakdown for an academic year
  const getYearTermBreakdown = () => {
    if (viewMode !== 'yearly' || !effectiveAcademicYearId) return [];
    
    const academicYear = academicYears.find(ay => ay.id === effectiveAcademicYearId);
    if (!academicYear) return [];

    const yearRecords = filteredRecords.filter(record => record.academicYearId === effectiveAcademicYearId);
    const termData: { [key: string]: any } = {};

    // Generate entries for all terms in the academic year
    academicYear.terms.forEach(term => {
      if (!term.startDate || !term.endDate) return;
      
      const termRecords = yearRecords.filter(record => record.termId === term.id);
      
      const present = termRecords.filter(r => r.status === 'Present').length;
      const absent = termRecords.filter(r => r.status === 'Absent').length;
      const late = termRecords.filter(r => r.status === 'Late').length;
      const excused = termRecords.filter(r => r.status === 'Excused').length;
      const total = termRecords.length;
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

      termData[term.id] = {
        termId: term.id,
        termName: term.name,
        term,
        present,
        absent,
        late,
        excused,
        total,
        attendanceRate,
        records: termRecords
      };
    });

    return Object.values(termData);
  };

  // Helper function to get monthly breakdown for a term (used in year view)
  const getTermMonthlyBreakdown = (termId: string) => {
    const term = availableTerms.find(t => t.id === termId);
    if (!term || !term.startDate || !term.endDate) return [];

    const termStart = new Date(term.startDate);
    const termEnd = new Date(term.endDate);
    const termRecords = filteredRecords.filter(record => record.termId === termId);
    const monthlyData: { [key: string]: any } = {};

    // Generate all months in the term period
    const currentMonth = startOfMonth(termStart);
    const endMonth = endOfMonth(termEnd);
    
    while (currentMonth <= endMonth) {
      const monthKey = format(currentMonth, 'yyyy-MM');
      const monthName = format(currentMonth, 'MMMM yyyy');
      
      monthlyData[monthKey] = {
        monthKey,
        monthName,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
        records: []
      };
      
      // Move to next month
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Now populate with actual attendance records
    termRecords.forEach(record => {
      const monthKey = format(new Date(record.date), 'yyyy-MM');
      
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].records.push(record);
        monthlyData[monthKey][record.status.toLowerCase()]++;
        monthlyData[monthKey].total++;
      }
    });

    return Object.values(monthlyData).map(month => ({
      ...month,
      attendanceRate: month.total > 0 ? Math.round((month.present / month.total) * 100) : 0
    }));
  };

  // State for expandable sections
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedMonthDays, setExpandedMonthDays] = useState<Set<string>>(new Set());
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());
  const [expandedTermMonths, setExpandedTermMonths] = useState<Set<string>>(new Set());

  const toggleMonthExpansion = (monthKey: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey);
    } else {
      newExpanded.add(monthKey);
    }
    setExpandedMonths(newExpanded);
  };

  const toggleMonthDaysExpansion = (monthKey: string) => {
    const newExpanded = new Set(expandedMonthDays);
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey);
    } else {
      newExpanded.add(monthKey);
    }
    setExpandedMonthDays(newExpanded);
  };

  const toggleTermExpansion = (termId: string) => {
    const newExpanded = new Set(expandedTerms);
    if (newExpanded.has(termId)) {
      newExpanded.delete(termId);
    } else {
      newExpanded.add(termId);
    }
    setExpandedTerms(newExpanded);
  };

  const toggleTermMonthExpansion = (termMonthKey: string) => {
    const newExpanded = new Set(expandedTermMonths);
    if (newExpanded.has(termMonthKey)) {
      newExpanded.delete(termMonthKey);
    } else {
      newExpanded.add(termMonthKey);
    }
    setExpandedTermMonths(newExpanded);
  };

  const termSummary = getTermSummary();
  const monthlyBreakdown = getMonthlyBreakdown();
  const yearSummary = getYearSummary();
  const yearTermBreakdown = getYearTermBreakdown();

  // Get the current dynamic selection value
  const getCurrentDynamicValue = () => {
    switch (viewMode) {
      case 'daily':
        return selectedDate;
      case 'weekly':
        return selectedWeek;
      case 'monthly':
        return selectedMonth;
      case 'yearly':
        return selectedAcademicYearId;
      case 'term':
        return selectedTermId;
      default:
        return '';
    }
  };

  // Handle dynamic selection change
  const handleDynamicSelectionChange = (value: string) => {
    switch (viewMode) {
      case 'daily':
        setSelectedDate(value);
        break;
      case 'weekly':
        setSelectedWeek(value);
        break;
      case 'monthly':
        setSelectedMonth(value);
        break;
      case 'yearly':
        setSelectedAcademicYearId(value);
        break;
      case 'term':
        setSelectedTermId(value);
        break;
    }
  };

  // Get today's attendance record for editing
  const todaysRecord = useMemo(() => {
    const today = new Date();
    const todayString = format(today, 'yyyy-MM-dd');
    return filteredRecords.find(record => {
      const recordDate = new Date(record.date);
      return format(recordDate, 'yyyy-MM-dd') === todayString;
    });
  }, [filteredRecords]);

  // Get selected date's attendance record for editing (in daily view)
  const selectedDateRecord = useMemo(() => {
    if (viewMode === 'daily' && selectedDate) {
      return filteredRecords.find(record => {
        const recordDate = new Date(record.date);
        return format(recordDate, 'yyyy-MM-dd') === selectedDate;
      });
    }
    return null;
  }, [filteredRecords, viewMode, selectedDate]);

  // Calculate attendance statistics
  const attendanceStats = useMemo(() => {
    let filteredByTimeframe: AttendanceRecord[] = [];

    // Debug logging (commented out for performance)
    // console.log('📊 Calculating attendance stats:', {
    //   viewMode,
    //   selectedDate,
    //   selectedWeek,
    //   selectedMonth,
    //   filteredRecordsCount: filteredRecords.length,
    //   selectedDateRecord: selectedDateRecord
    // });

    switch (viewMode) {
      case 'daily':
        // Show selected date's record only
        if (selectedDate) {
          const selectedDateString = selectedDate;
        filteredByTimeframe = filteredRecords.filter(record => {
            const recordDateString = format(new Date(record.date), 'yyyy-MM-dd');
            return recordDateString === selectedDateString;
        });
          // console.log(`📅 Daily view: Found ${filteredByTimeframe.length} records for ${selectedDate}`);
        }
        break;
      case 'weekly':
        // Show selected week's records
        if (selectedWeek) {
          const weekStart = new Date(selectedWeek);
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          const weekStartString = format(weekStart, 'yyyy-MM-dd');
          const weekEndString = format(weekEnd, 'yyyy-MM-dd');
          
        filteredByTimeframe = filteredRecords.filter(record => {
            const recordDateString = format(new Date(record.date), 'yyyy-MM-dd');
            return recordDateString >= weekStartString && recordDateString <= weekEndString;
        });
          // console.log(`📅 Weekly view: Found ${filteredByTimeframe.length} records for week starting ${selectedWeek}`);
        }
        break;
      case 'monthly':
        // Show selected month's records
        if (selectedMonth) {
          const [year, month] = selectedMonth.split('-');
          const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
          const monthEnd = endOfMonth(monthStart);
          const monthStartString = format(monthStart, 'yyyy-MM-dd');
          const monthEndString = format(monthEnd, 'yyyy-MM-dd');
          
        filteredByTimeframe = filteredRecords.filter(record => {
            const recordDateString = format(new Date(record.date), 'yyyy-MM-dd');
            return recordDateString >= monthStartString && recordDateString <= monthEndString;
        });
          // console.log(`📅 Monthly view: Found ${filteredByTimeframe.length} records for ${selectedMonth}`);
        }
        break;
      case 'yearly':
        // Show selected academic year's records
        filteredByTimeframe = filteredRecords;
        // console.log(`📅 Yearly view: Using all ${filteredByTimeframe.length} filtered records`);
        break;
      case 'term':
        // Show selected term's records (already filtered by term above)
        filteredByTimeframe = filteredRecords;
        // console.log(`📅 Term view: Using all ${filteredByTimeframe.length} filtered records`);
        break;
    }

    const total = filteredByTimeframe.length;
    const present = filteredByTimeframe.filter(r => r.status === 'Present').length;
    const absent = filteredByTimeframe.filter(r => r.status === 'Absent').length;
    const late = filteredByTimeframe.filter(r => r.status === 'Late').length;
    const excused = filteredByTimeframe.filter(r => r.status === 'Excused').length;

    const attendanceRate = total > 0 ? ((present + late + excused) / total) * 100 : 0;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      records: filteredByTimeframe.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
  }, [filteredRecords, viewMode, selectedDate, selectedWeek, selectedMonth]);

  // Create a memoized lookup map for fast record finding
  const recordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceStats.records.forEach(record => {
      const dateString = format(new Date(record.date), 'yyyy-MM-dd');
      map.set(dateString, record);
    });
    return map;
  }, [attendanceStats.records]);

  const handleEditRemarks = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditRemarks(record.remarks || '');
    setIsEditDialogOpen(true);
  };

  const handleSaveRemarks = async () => {
    if (!editingRecord) return;

    try {
      await updateAttendanceMutation.mutateAsync({
        id: editingRecord.id,
        data: { remarks: editRemarks }
      });

      toast({
        title: "Remarks Updated",
        description: "Attendance remarks have been updated successfully.",
      });

      setIsEditDialogOpen(false);
      setEditingRecord(null);
      setEditRemarks('');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update remarks. Please try again.",
      });
    }
  };

  const getStatusIcon = (status: AttendanceStatus, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'h-3 w-3',
      md: 'h-4 w-4',
      lg: 'h-6 w-6'
    };
    
    switch (status) {
      case 'Present':
        return <CheckCircle className={`${sizeClasses[size]} text-green-600`} />;
      case 'Absent':
        return <XCircle className={`${sizeClasses[size]} text-red-600`} />;
      case 'Late':
        return <Clock className={`${sizeClasses[size]} text-yellow-600`} />;
      case 'Excused':
        return <Info className={`${sizeClasses[size]} text-blue-600`} />;
      default:
        return <AlertCircle className={`${sizeClasses[size]} text-gray-400`} />;
    }
  };

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'Present':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Absent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Late':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Excused':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (attendanceError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load attendance information. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (academicYearsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Avatar */}
      <div className="flex items-center space-x-3 mb-4">
        <Avatar className="h-12 w-12">
          {pupil?.photo && pupil.photo.trim() !== '' ? (
            <AvatarImage 
              src={pupil.photo} 
              alt={`${pupil.firstName} ${pupil.lastName}`}
              onError={(e) => {
                console.log('Avatar image failed to load:', pupil.photo);
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <AvatarFallback className="text-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
            {pupil?.firstName?.charAt(0)}{pupil?.lastName?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-lg md:text-xl font-semibold tracking-tight">
          Attendance Information
        </h2>
      </div>

      {/* Controls */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Academic Year Selector */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Academic Year</Label>
            <Select 
              value={selectedAcademicYearId} 
              onValueChange={(value) => {
                setSelectedAcademicYearId(value);
                setSelectedTermId(''); // Reset term when year changes
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {academicYears.map((year) => (
                <SelectItem key={year.id} value={year.id}>
                  {year.name} {year.isActive && '(Current)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* View Mode Selector */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">View Mode</Label>
          <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
              <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="term">Term</SelectItem>
            </SelectContent>
          </Select>
          </div>

          {/* Dynamic Selector */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">
              {viewMode === 'daily' && 'Date'}
              {viewMode === 'weekly' && 'Week'}
              {viewMode === 'monthly' && 'Month'}
              {viewMode === 'yearly' && 'Year'}
              {viewMode === 'term' && 'Term'}
            </Label>
            <Select 
              value={getCurrentDynamicValue()} 
              onValueChange={handleDynamicSelectionChange}
              disabled={dynamicOptions.length === 0}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={
                  viewMode === 'daily' ? 'Select date' :
                  viewMode === 'weekly' ? 'Select week' :
                  viewMode === 'monthly' ? 'Select month' :
                  viewMode === 'yearly' ? 'Select year' :
                  viewMode === 'term' ? 'Select term' : 'Select'
                } />
              </SelectTrigger>
              <SelectContent>
                {dynamicOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} {option.isCurrent && '(Current)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Selected Date's Attendance Card (only show if viewing daily) */}
      {viewMode === 'daily' && selectedDate && (
        <Card className={`relative overflow-hidden border-0 shadow-lg rounded-2xl ${selectedDateRecord ? 
          selectedDateRecord.status === 'Present' ? 'bg-gradient-to-br from-green-50 to-emerald-50' :
          selectedDateRecord.status === 'Absent' ? 'bg-gradient-to-br from-red-50 to-pink-50' :
          selectedDateRecord.status === 'Late' ? 'bg-gradient-to-br from-yellow-50 to-amber-50' :
          selectedDateRecord.status === 'Excused' ? 'bg-gradient-to-br from-blue-50 to-indigo-50' :
          'bg-gradient-to-br from-gray-50 to-slate-50' : 'bg-gradient-to-br from-gray-50 to-slate-50'}`}>
          {/* Decorative background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-16 -translate-y-16">
              <div className={`w-full h-full rounded-full ${
                selectedDateRecord ? 
                  selectedDateRecord.status === 'Present' ? 'bg-green-400' :
                  selectedDateRecord.status === 'Absent' ? 'bg-red-400' :
                  selectedDateRecord.status === 'Late' ? 'bg-yellow-400' :
                  selectedDateRecord.status === 'Excused' ? 'bg-blue-400' :
                  'bg-gray-400' : 'bg-gray-400'
              }`}></div>
            </div>
          </div>
          
          <CardHeader className={`py-4 relative z-10 ${selectedDateRecord ? 
            selectedDateRecord.status === 'Present' ? 'bg-gradient-to-r from-green-50/80 to-emerald-50/80' :
            selectedDateRecord.status === 'Absent' ? 'bg-gradient-to-r from-red-50/80 to-pink-50/80' :
            selectedDateRecord.status === 'Late' ? 'bg-gradient-to-r from-yellow-50/80 to-amber-50/80' :
            selectedDateRecord.status === 'Excused' ? 'bg-gradient-to-r from-blue-50/80 to-indigo-50/80' :
            'bg-gradient-to-r from-gray-50/80 to-slate-50/80' : 'bg-gradient-to-r from-gray-50/80 to-slate-50/80'}`}>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {selectedDateRecord ? (
                  <div className={`w-5 h-5 rounded-full ${
                    selectedDateRecord.status === 'Present' ? 'bg-green-100' :
                    selectedDateRecord.status === 'Absent' ? 'bg-red-100' :
                    selectedDateRecord.status === 'Late' ? 'bg-yellow-100' :
                    selectedDateRecord.status === 'Excused' ? 'bg-blue-100' :
                    'bg-gray-100'
                  } flex items-center justify-center`}>
                    {getStatusIcon(selectedDateRecord.status, 'sm')}
                  </div>
                ) : (
                  <Calendar className="h-4 w-4 text-gray-500" />
                )}
                <span className={`text-base font-semibold ${
                  selectedDateRecord ? 
                    selectedDateRecord.status === 'Present' ? 'text-green-800' :
                    selectedDateRecord.status === 'Absent' ? 'text-red-800' :
                    selectedDateRecord.status === 'Late' ? 'text-yellow-800' :
                    selectedDateRecord.status === 'Excused' ? 'text-blue-800' :
                    'text-gray-800' : 'text-gray-600'
                }`}>
                  {getPersonalizedMessage(selectedDateRecord || null, selectedDate)}
              </span>
              </span>
              {selectedDateRecord && !selectedDateRecord.remarks && (
              <Button
                variant="outline"
                size="sm"
                  onClick={() => handleEditRemarks(selectedDateRecord)}
                  className="text-blue-600 hover:text-blue-700 text-xs px-2 py-1"
              >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Please tell us why
              </Button>
              )}
            </CardTitle>
          </CardHeader>
          {selectedDateRecord && (
            <CardContent className="py-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md border-2 border-white/50 ${
                  selectedDateRecord.status === 'Present' ? 'bg-gradient-to-br from-green-100 to-green-200' :
                  selectedDateRecord.status === 'Absent' ? 'bg-gradient-to-br from-red-100 to-red-200' :
                  selectedDateRecord.status === 'Late' ? 'bg-gradient-to-br from-yellow-100 to-yellow-200' :
                  selectedDateRecord.status === 'Excused' ? 'bg-gradient-to-br from-blue-100 to-blue-200' :
                  'bg-gradient-to-br from-gray-100 to-gray-200'
                }`}>
                  {getStatusIcon(selectedDateRecord.status, 'lg')}
                </div>
                <div className="flex-1">
                  <div className="mb-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedDateRecord.status === 'Present' ? 'bg-green-100 text-green-800' :
                      selectedDateRecord.status === 'Absent' ? 'bg-red-100 text-red-800' :
                      selectedDateRecord.status === 'Late' ? 'bg-yellow-100 text-yellow-800' :
                      selectedDateRecord.status === 'Excused' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedDateRecord.status}
                    </span>
              </div>
                  {selectedDateRecord.remarks && (
                    <div className="flex items-center gap-2">
                      <div className={`flex-1 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 ${
                        selectedDateRecord.status === 'Present' ? 'shadow-green-100' :
                        selectedDateRecord.status === 'Absent' ? 'shadow-red-100' :
                        selectedDateRecord.status === 'Late' ? 'shadow-yellow-100' :
                        selectedDateRecord.status === 'Excused' ? 'shadow-blue-100' :
                        'shadow-gray-100'
                      }`}>
                        <p className={`text-sm ${
                          selectedDateRecord.status === 'Present' ? 'text-green-700' :
                          selectedDateRecord.status === 'Absent' ? 'text-red-700' :
                          selectedDateRecord.status === 'Late' ? 'text-yellow-700' :
                          selectedDateRecord.status === 'Excused' ? 'text-blue-700' :
                          'text-gray-700'
                        }`}>
                          <strong>Remarks:</strong> {selectedDateRecord.remarks}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditRemarks(selectedDateRecord)}
                        className="text-blue-600 hover:text-blue-700 p-2 h-auto rounded-full hover:bg-blue-50 transition-colors shadow-sm"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                </div>
              )}
                </div>
            </div>
          </CardContent>
          )}
        </Card>
      )}



      {/* Attendance Records */}
      {viewMode !== 'daily' && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Attendance Records ({viewMode})
              {effectiveAcademicYearId && (
                <span className="text-sm font-normal text-gray-500">
                  • {academicYears.find(ay => ay.id === effectiveAcademicYearId)?.name}
                  {viewMode === 'weekly' && selectedWeek && (
                    <span> • Week of {format(new Date(selectedWeek), 'MMM dd')}</span>
                  )}
                  {viewMode === 'monthly' && selectedMonth && (
                    <span> • {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}</span>
                  )}
                  {viewMode === 'term' && effectiveTermId && (
                    <span> • {availableTerms.find(t => t.id === effectiveTermId)?.name}</span>
                  )}
                </span>
              )}
          </CardTitle>
            {/* Color Legend */}
            <div className="flex flex-wrap gap-3 mt-1">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-green-100 border border-green-200"></div>
                <span className="text-xs text-green-700">Present</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-100 border border-red-200"></div>
                <span className="text-xs text-red-700">Absent</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-100 border border-yellow-200"></div>
                <span className="text-xs text-yellow-700">Late</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-200"></div>
                <span className="text-xs text-blue-700">Excused</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-100 border border-gray-200"></div>
                <span className="text-xs text-gray-700">No Record</span>
              </div>
            </div>
        </CardHeader>
        <CardContent>
          {attendanceLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (viewMode === 'weekly' || viewMode === 'monthly') && daysInPeriod.length > 0 ? (
            <div className="space-y-2">
              {daysInPeriod.map((date) => {
                const dateString = format(date, 'yyyy-MM-dd');
                const record = recordsByDate.get(dateString);
                
                // Get color coding based on record status
                const getStatusColors = (record: AttendanceRecord | null | undefined) => {
                  if (!record) {
                    return {
                      bg: 'bg-gray-50',
                      border: 'border-gray-200',
                      text: 'text-gray-600',
                      iconBg: 'bg-gray-200',
                      iconColor: 'text-gray-500'
                    };
                  }
                  
                  switch (record.status) {
                    case 'Present':
                      return {
                        bg: 'bg-green-50',
                        border: 'border-green-200',
                        text: 'text-green-800',
                        iconBg: 'bg-green-100',
                        iconColor: 'text-green-600'
                      };
                    case 'Absent':
                      return {
                        bg: 'bg-red-50',
                        border: 'border-red-200',
                        text: 'text-red-800',
                        iconBg: 'bg-red-100',
                        iconColor: 'text-red-600'
                      };
                    case 'Late':
                      return {
                        bg: 'bg-yellow-50',
                        border: 'border-yellow-200',
                        text: 'text-yellow-800',
                        iconBg: 'bg-yellow-100',
                        iconColor: 'text-yellow-600'
                      };
                    case 'Excused':
                      return {
                        bg: 'bg-blue-50',
                        border: 'border-blue-200',
                        text: 'text-blue-800',
                        iconBg: 'bg-blue-100',
                        iconColor: 'text-blue-600'
                      };
                    default:
                      return {
                        bg: 'bg-gray-50',
                        border: 'border-gray-200',
                        text: 'text-gray-600',
                        iconBg: 'bg-gray-200',
                        iconColor: 'text-gray-500'
                      };
                  }
                };

                const colors = getStatusColors(record);
                
                return (
                  <div key={dateString} className={`group relative flex items-center justify-between p-3 border-0 rounded-xl transition-all duration-200 ease-in-out ${colors.bg} hover:shadow-md hover:scale-[1.02] backdrop-blur-sm`} style={{
                    background: record ? 
                      record.status === 'Present' ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' :
                      record.status === 'Absent' ? 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)' :
                      record.status === 'Late' ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' :
                      record.status === 'Excused' ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' :
                      'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)' :
                      'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'
                  }}>
                    {/* Status indicator line */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                      record ? 
                        record.status === 'Present' ? 'bg-gradient-to-b from-green-400 to-green-600' :
                        record.status === 'Absent' ? 'bg-gradient-to-b from-red-400 to-red-600' :
                        record.status === 'Late' ? 'bg-gradient-to-b from-yellow-400 to-yellow-600' :
                        record.status === 'Excused' ? 'bg-gradient-to-b from-blue-400 to-blue-600' :
                        'bg-gradient-to-b from-gray-400 to-gray-600' :
                        'bg-gradient-to-b from-gray-400 to-gray-600'
                    }`}></div>
                    
                    <div className="flex items-center gap-3 pl-1">
                      {record ? (
                        <div className={`w-8 h-8 rounded-full ${colors.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm border-2 border-white/50`}>
                          {getStatusIcon(record.status, 'sm')}
                        </div>
                      ) : (
                        <div className={`w-8 h-8 rounded-full ${colors.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm border-2 border-white/50`}>
                          <Calendar className={`h-4 w-4 ${colors.iconColor}`} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm mb-1 ${colors.text} leading-tight font-medium`}>
                          {getPersonalizedMessage(record || null, dateString)}
                        </p>
                        {record?.remarks && (
                          <div className="flex items-center gap-2">
                            <p className={`text-xs ${colors.text.replace('800', '600')} truncate bg-white/50 px-2 py-1 rounded-full`}>
                              <strong>Remarks:</strong> {record.remarks}
                            </p>
                            {isToday(date) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRemarks(record)}
                                className="text-blue-600 hover:text-blue-700 p-1 h-auto flex-shrink-0 rounded-full hover:bg-blue-50 transition-colors"
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {record && isToday(date) && !record.remarks && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRemarks(record)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      )}
                      {record && (
                        <div className="text-right text-sm text-gray-500">
                          {format(new Date(record.recordedAt), 'HH:mm')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'term' && termSummary ? (
            <div className="space-y-3">
              {/* Term Summary */}
              <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-4 shadow-lg border border-blue-100/50">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
                  <div className="w-full h-full bg-blue-400 rounded-full transform translate-x-8 -translate-y-8"></div>
                </div>
                <div className="absolute bottom-0 left-0 w-16 h-16 opacity-10">
                  <div className="w-full h-full bg-indigo-400 rounded-full transform -translate-x-4 translate-y-4"></div>
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-blue-900 bg-white/60 px-4 py-2 rounded-xl backdrop-blur-sm">
                      {termSummary.term.name} Summary
                    </h3>
                    <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs px-3 py-1 rounded-full shadow-md">
                      {termSummary.attendanceRate}% Attendance
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center bg-white/60 p-3 rounded-xl backdrop-blur-sm shadow-sm border border-white/20">
                      <div className="text-2xl font-bold text-green-600 mb-1">{termSummary.present}</div>
                      <div className="text-xs text-gray-600 font-medium">Present</div>
                    </div>
                    <div className="text-center bg-white/60 p-3 rounded-xl backdrop-blur-sm shadow-sm border border-white/20">
                      <div className="text-2xl font-bold text-red-600 mb-1">{termSummary.absent}</div>
                      <div className="text-xs text-gray-600 font-medium">Absent</div>
                    </div>
                    <div className="text-center bg-white/60 p-3 rounded-xl backdrop-blur-sm shadow-sm border border-white/20">
                      <div className="text-2xl font-bold text-yellow-600 mb-1">{termSummary.late}</div>
                      <div className="text-xs text-gray-600 font-medium">Late</div>
                    </div>
                    <div className="text-center bg-white/60 p-3 rounded-xl backdrop-blur-sm shadow-sm border border-white/20">
                      <div className="text-2xl font-bold text-blue-600 mb-1">{termSummary.excused}</div>
                      <div className="text-xs text-gray-600 font-medium">Excused</div>
                    </div>
                    <div className="text-center bg-white/60 p-3 rounded-xl backdrop-blur-sm shadow-sm border border-white/20">
                      <div className="text-2xl font-bold text-gray-600 mb-1">{termSummary.total}</div>
                      <div className="text-xs text-gray-600 font-medium">Total Days</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Breakdown */}
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-gray-700">Monthly Breakdown</h4>
                {monthlyBreakdown.map((month) => (
                  <div key={month.monthKey} className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                    <div 
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-colors rounded-xl"
                      onClick={() => toggleMonthExpansion(month.monthKey)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          expandedMonths.has(month.monthKey) ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                        } transition-colors`}>
                          {expandedMonths.has(month.monthKey) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                        <span className="font-semibold text-sm text-gray-800">{month.monthName}</span>
                        <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs px-2 py-1 rounded-full">
                          {month.attendanceRate}% Attendance
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Present: {month.present}</span>
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Absent: {month.absent}</span>
                        <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Late: {month.late}</span>
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Excused: {month.excused}</span>
                      </div>
                    </div>
                    
                    {expandedMonths.has(month.monthKey) && (
                      <div className="border-t bg-gray-50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Daily Details</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMonthDaysExpansion(month.monthKey)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            {expandedMonthDays.has(month.monthKey) ? 'Hide Details' : 'Show Details'}
                          </Button>
                        </div>
                        
                        {expandedMonthDays.has(month.monthKey) && (
                          <div className="space-y-2">
                            {month.records.map((record) => (
                              <div key={record.id} className="flex items-center justify-between p-2 bg-white rounded border">
                                <div className="flex items-center gap-3">
                    {getStatusIcon(record.status)}
                                  <div className="flex-1">
                                    <p className="text-sm text-gray-600">
                                      {getPersonalizedMessage(record, format(new Date(record.date), 'yyyy-MM-dd'))}
                                    </p>
                                    {record.remarks && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xs text-gray-500">
                                          <strong>Remarks:</strong> {record.remarks}
                                        </p>
                                        {isToday(new Date(record.date)) && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditRemarks(record)}
                                            className="text-blue-600 hover:text-blue-700 p-1 h-auto"
                                          >
                                            <Edit3 className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                      <div className="flex items-center gap-2">
                                  {isToday(new Date(record.date)) && !record.remarks && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditRemarks(record)}
                                      className="text-blue-600 hover:text-blue-700"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <div className="text-right text-xs text-gray-500">
                                    {format(new Date(record.recordedAt), 'HH:mm')}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : viewMode === 'yearly' && yearSummary ? (
            <div className="space-y-4">
              {/* Year Summary */}
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-green-900">
                    {yearSummary.academicYear.name} Summary
                  </h3>
                  <Badge className="bg-green-100 text-green-800">
                    {yearSummary.attendanceRate}% Attendance
                        </Badge>
                      </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{yearSummary.present}</div>
                    <div className="text-sm text-gray-600">Present</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{yearSummary.absent}</div>
                    <div className="text-sm text-gray-600">Absent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{yearSummary.late}</div>
                    <div className="text-sm text-gray-600">Late</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{yearSummary.excused}</div>
                    <div className="text-sm text-gray-600">Excused</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{yearSummary.total}</div>
                    <div className="text-sm text-gray-600">Total Days</div>
                  </div>
                </div>
              </div>

              {/* Term Breakdown */}
              <div className="space-y-2">
                <h4 className="text-md font-medium text-gray-700">Term Breakdown</h4>
                {yearTermBreakdown.map((termData) => (
                  <div key={termData.termId} className="border rounded-lg">
                    <div 
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleTermExpansion(termData.termId)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedTerms.has(termData.termId) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        <span className="font-medium">{termData.termName}</span>
                        <Badge className="bg-gray-100 text-gray-800">
                          {termData.attendanceRate}% Attendance
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Present: {termData.present}</span>
                        <span>Absent: {termData.absent}</span>
                        <span>Late: {termData.late}</span>
                        <span>Excused: {termData.excused}</span>
                      </div>
                    </div>
                    
                    {expandedTerms.has(termData.termId) && (
                      <div className="border-t bg-gray-50 p-3">
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-gray-700">Monthly Breakdown</h5>
                          {getTermMonthlyBreakdown(termData.termId).map((month) => (
                            <div key={month.monthKey} className="border rounded-lg">
                              <div 
                                className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100"
                                onClick={() => toggleTermMonthExpansion(`${termData.termId}-${month.monthKey}`)}
                              >
                                <div className="flex items-center gap-2">
                                  {expandedTermMonths.has(`${termData.termId}-${month.monthKey}`) ? (
                                    <ChevronDown className="h-3 w-3 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-gray-500" />
                                  )}
                                  <span className="text-sm font-medium">{month.monthName}</span>
                                  <Badge className="bg-gray-100 text-gray-800 text-xs">
                                    {month.attendanceRate}% Attendance
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-600">
                                  <span>Present: {month.present}</span>
                                  <span>Absent: {month.absent}</span>
                                  <span>Late: {month.late}</span>
                                  <span>Excused: {month.excused}</span>
                                </div>
                              </div>
                              
                              {expandedTermMonths.has(`${termData.termId}-${month.monthKey}`) && (
                                <div className="border-t bg-white p-2">
                                  <div className="space-y-1">
                                    {month.records.map((record) => (
                                      <div key={record.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                                        <div className="flex items-center gap-2">
                                          {getStatusIcon(record.status)}
                                          <div className="flex-1">
                                            <p className="text-xs text-gray-600">
                                              {getPersonalizedMessage(record, format(new Date(record.date), 'yyyy-MM-dd'))}
                                            </p>
                      {record.remarks && (
                                              <div className="flex items-center gap-1 mt-1">
                                                <p className="text-xs text-gray-500">
                          <strong>Remarks:</strong> {record.remarks}
                        </p>
                                                {isToday(new Date(record.date)) && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditRemarks(record)}
                                                    className="text-blue-600 hover:text-blue-700 p-1 h-auto"
                                                  >
                                                    <Edit3 className="h-2 w-2" />
                                                  </Button>
                      )}
                    </div>
                                            )}
                  </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {isToday(new Date(record.date)) && !record.remarks && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleEditRemarks(record)}
                                              className="text-blue-600 hover:text-blue-700"
                                            >
                                              <Edit3 className="h-3 w-3" />
                                            </Button>
                                          )}
                                          <div className="text-right text-xs text-gray-500">
                                            {format(new Date(record.recordedAt), 'HH:mm')}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : attendanceStats.records.length > 0 ? (
            <div className="space-y-3">
              {attendanceStats.records.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(record.status)}
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-2">
                        {getPersonalizedMessage(record, format(new Date(record.date), 'yyyy-MM-dd'))}
                      </p>
                      {record.remarks && (
                  <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-500">
                            <strong>Remarks:</strong> {record.remarks}
                          </p>
                    {isToday(new Date(record.date)) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRemarks(record)}
                              className="text-blue-600 hover:text-blue-700 p-1 h-auto"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isToday(new Date(record.date)) && !record.remarks && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditRemarks(record)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="text-right text-sm text-gray-500">
                      {format(new Date(record.recordedAt), 'HH:mm')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                No attendance records found for this period
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Edit Remarks Dialog */}
      <ModernDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <ModernDialogContent open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <ModernDialogHeader>
            <ModernDialogTitle>Please, tell us why</ModernDialogTitle>
          </ModernDialogHeader>
          <div className="space-y-4">
            {editingRecord && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(editingRecord.status)}
                  <Badge className={getStatusColor(editingRecord.status)}>
                    {editingRecord.status}
                  </Badge>
                  <span className="font-medium">
                    {format(new Date(editingRecord.date), 'EEEE, MMMM dd, yyyy')}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Help us understand why {pupil?.firstName || 'your child'} was {editingRecord.status.toLowerCase()} on this day.
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="remarks">Please, tell us why</Label>
              <Input
                id="remarks"
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="e.g., Sick, Doctor appointment, Family emergency, etc."
                maxLength={200}
              />
              <p className="text-xs text-gray-500">
                {editRemarks.length}/200 characters
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={updateAttendanceMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveRemarks}
                disabled={updateAttendanceMutation.isPending}
              >
                {updateAttendanceMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Remarks
                  </>
                )}
              </Button>
            </div>
          </div>
        </ModernDialogContent>
      </ModernDialog>
    </div>
  );
} 