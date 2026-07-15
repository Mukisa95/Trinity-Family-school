"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";
import { GlassActionButton, GlassActionDock, GlassPageTopBar } from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/common/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useClasses } from "@/lib/hooks/use-classes";
import { usePupilsWithoutPhotos } from "@/lib/hooks/use-pupils";
import { useAttendanceByDateRange } from "@/lib/hooks/use-attendance";
import { useExcludedDays } from "@/lib/hooks/use-excluded-days";
import { useAcademicYears, useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { getEffectiveTermForDataDisplay } from "@/lib/utils/term-status-utils";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";
import {
  Loader2,
  ArrowLeft,
  BarChart3,
  Download,
  Calendar,
  Printer,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  startOfWeek,
  endOfWeek,
  eachMonthOfInterval,
  parseISO,
  startOfDay,
  endOfDay
} from "date-fns";
import type { AttendanceRecord } from "@/types";
import {
  isSchoolDay,
  getTermBoundaries,
  getTermsInDateRange,
  validateAttendanceDateRange
} from "@/lib/utils/attendance-academic-utils";
import { wasPupilActiveOnDate, wasPupilActiveInDateRange } from "@/lib/utils/pupil-status-utils";
import { AttendancePrintModal, type PrintAttendanceConfig } from "@/components/attendance/AttendancePrintModal";
import { PrintableAttendanceSummary } from "@/components/attendance/PrintableAttendanceSummary";
import { PrintableAttendanceDetailed } from "@/components/attendance/PrintableAttendanceDetailed";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";

type TrendPeriod = "daily" | "weekly" | "monthly" | "termly";
type ReportType = "class" | "pupil" | "school";

interface TrendData {
  period: string;
  date: string;
  totalDays: number;
  schoolDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  delayed: number;
  notRecorded: number;
  attendanceRate: number;
  trend: "up" | "down" | "stable";
}

interface PupilTrendData extends TrendData {
  pupilId: string;
  pupilName: string;
  admissionNumber: string;
}

interface ClassPupilTrendData {
  pupilId: string;
  pupilName: string;
  admissionNumber: string;
  periods: TrendData[];
}

interface SchoolAttendanceData {
  classId: string;
  className: string;
  classCode: string;
  order?: number;
  totalPupils: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  delayed: number;
  notRecorded: number;
  attendanceRate: number;
  pupils: {
    present: Array<{ id: string; name: string; admissionNumber: string }>;
    absent: Array<{ id: string; name: string; admissionNumber: string }>;
    late: Array<{ id: string; name: string; admissionNumber: string }>;
    excused: Array<{ id: string; name: string; admissionNumber: string }>;
    delayed: Array<{ id: string; name: string; admissionNumber: string }>;
    notRecorded: Array<{ id: string; name: string; admissionNumber: string }>;
  };
}

export default function ViewAttendanceReportsPage() {

  // Next.js hooks
  const router = useRouter();

  // Firebase hooks
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  // 🚀 PERFORMANCE: Use optimized hook that excludes photos
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupilsWithoutPhotos();
  const { data: excludedDays = [], isLoading: excludedDaysLoading } = useExcludedDays();
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const { data: schoolSettings } = useSchoolSettings();

  // State for filters
  const [selectedAcademicYearId, setSelectedAcademicYearId] = React.useState("");
  const [selectedTermId, setSelectedTermId] = React.useState("");
  const [selectedClassId, setSelectedClassId] = React.useState("_all_");
  const [selectedPupilId, setSelectedPupilId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [reportType, setReportType] = React.useState<ReportType>("school");
  const [trendPeriod, setTrendPeriod] = React.useState<TrendPeriod>("daily");

  // School view expansion states
  const [expandedClasses, setExpandedClasses] = React.useState<Set<string>>(new Set());
  const [expandedStatuses, setExpandedStatuses] = React.useState<Set<string>>(new Set());
  const [expandAllStatus, setExpandAllStatus] = React.useState<string | null>(null);

  // Inline attendance recording states
  const [recordingPupils, setRecordingPupils] = React.useState<Set<string>>(new Set());
  const [recordingData, setRecordingData] = React.useState<Record<string, { status: string; remarks: string }>>({});

  // Printing states
  const [isPrintModalOpen, setIsPrintModalOpen] = React.useState(false);
  const [printConfig, setPrintConfig] = React.useState<PrintAttendanceConfig | null>(null);

  // Get selected academic year
  const selectedAcademicYear = React.useMemo(() => {
    return academicYears.find(year => year.id === selectedAcademicYearId) || null;
  }, [academicYears, selectedAcademicYearId]);

  // 🚀 DYNAMIC YEAR LABELS
  const currentAcademicYearId = React.useMemo(() => {
    if (academicYears.length === 0) return null;
    const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
    return effectiveTerm?.academicYear?.id || null;
  }, [academicYears]);

  // Set default academic year when data loads (using effective term logic)
  React.useEffect(() => {
    if (academicYears.length > 0 && !selectedAcademicYearId) {
      const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
      if (effectiveTerm?.academicYear) {
        setSelectedAcademicYearId(effectiveTerm.academicYear.id);
      }
    }
  }, [academicYears, selectedAcademicYearId]);

  // Set default term to current term when academic year is selected
  React.useEffect(() => {
    if (selectedAcademicYear && !selectedTermId) {
      const today = new Date();
      const currentTerm = selectedAcademicYear.terms.find(term => {
        const termStart = parseISO(term.startDate);
        const termEnd = parseISO(term.endDate);
        return today >= termStart && today <= termEnd;
      });
      if (currentTerm) {
        setSelectedTermId(currentTerm.id);
      }
    }
  }, [selectedAcademicYear, selectedTermId]);

  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();

  // Initialize with school daily view when component loads
  React.useEffect(() => {
    if (reportType === "school" && trendPeriod === "daily" && !startDate && !endDate) {
      // Set to today's date for school daily view
      const today = format(new Date(), "yyyy-MM-dd");
      setStartDate(today);
      setEndDate(today);
    } else if (selectedAcademicYear && trendPeriod === "termly" && !startDate && !endDate) {
      setQuickDateRange("term");
    }
  }, [selectedAcademicYear, trendPeriod, startDate, endDate, reportType]);

  // Load URL parameters on component mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);

      const urlReportType = urlParams.get('reportType') as ReportType;
      const urlPupilId = urlParams.get('pupilId');
      const urlClassId = urlParams.get('classId');
      const urlDate = urlParams.get('date');
      const urlTrendPeriod = urlParams.get('trendPeriod') as TrendPeriod;
      const urlStartDate = urlParams.get('startDate');
      const urlEndDate = urlParams.get('endDate');
      const urlAcademicYearId = urlParams.get('academicYearId');
      const urlTermId = urlParams.get('termId');

      if (urlReportType) setReportType(urlReportType);
      if (urlPupilId) { setSelectedPupilId(urlPupilId); setReportType('pupil'); }
      if (urlClassId) { setSelectedClassId(urlClassId); setReportType('class'); }
      if (urlDate) { setStartDate(urlDate); setEndDate(urlDate); }
      if (urlTrendPeriod) setTrendPeriod(urlTrendPeriod);
      if (urlStartDate) setStartDate(urlStartDate);
      if (urlEndDate) setEndDate(urlEndDate);
      if (urlAcademicYearId) setSelectedAcademicYearId(urlAcademicYearId);
      if (urlTermId) setSelectedTermId(urlTermId);
    }
  }, []);

  // Initialize dates when academic year changes
  React.useEffect(() => {
    if (selectedAcademicYear && !startDate && !endDate) {
      const boundaries = getTermBoundaries(selectedAcademicYear, selectedTermId);
      if (boundaries) {
        setStartDate(boundaries.startDate.split('T')[0]);
        setEndDate(boundaries.endDate.split('T')[0]);
      }
    }
  }, [selectedAcademicYear, selectedTermId, startDate, endDate]);

  // Update date range and academic year when term selection changes
  React.useEffect(() => {
    if (selectedTermId && selectedTermId !== "_all_") {
      // Find which academic year contains this term
      const containingAcademicYear = academicYears.find(year =>
        year.terms.some(term => term.id === selectedTermId)
      );

      if (containingAcademicYear) {
        // Update academic year if it's different
        if (containingAcademicYear.id !== selectedAcademicYearId) {
          setSelectedAcademicYearId(containingAcademicYear.id);
        }

        // Update date range for termly view
        if (trendPeriod === "termly") {
          const selectedTerm = containingAcademicYear.terms.find(term => term.id === selectedTermId);
          if (selectedTerm) {
            setStartDate(selectedTerm.startDate.split('T')[0]);
            setEndDate(selectedTerm.endDate.split('T')[0]);
          }
        }
      }
    }
  }, [selectedTermId, academicYears, selectedAcademicYearId, trendPeriod]);

  // Validate report type compatibility with trend period
  React.useEffect(() => {
    // If not in daily view and report type is "school", change to "class"
    if (trendPeriod !== "daily" && reportType === "school") {
      setReportType("class");
    }
  }, [trendPeriod, reportType]);

  // Get attendance data for the selected date range
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useAttendanceByDateRange(
    startDate,
    endDate
  );



  // Validate date range
  const dateRangeValidation = React.useMemo(() => {
    if (!startDate || !endDate) return { isValid: true };
    return validateAttendanceDateRange(
      parseISO(startDate),
      parseISO(endDate),
      selectedAcademicYear
    );
  }, [startDate, endDate, selectedAcademicYear]);

  // Helper function to get school days in a date range
  const getSchoolDays = React.useCallback((start: Date, end: Date): Date[] => {
    const allDays = eachDayOfInterval({ start, end });
    return allDays.filter(day => isSchoolDay(day, selectedAcademicYear, excludedDays));
  }, [selectedAcademicYear, excludedDays]);

  // Calculate statistics for a set of records
  const calculateStats = React.useCallback((records: AttendanceRecord[], schoolDaysCount: number, expectedPupilCount: number = 1, isDailyClassView: boolean = false) => {
    const present = records.filter(r => r.status === "Present").length;
    const absent = records.filter(r => r.status === "Absent").length;
    const late = records.filter(r => r.status === "Late").length;
    const excused = records.filter(r => r.status === "Excused").length;
    const delayed = records.filter(r => r.status === "Delayed").length;

    let notRecorded: number;
    let attendanceRate: number;

    if (isDailyClassView) {
      // For daily class view, calculate based on total pupils in class
      const totalRecordedPupils = present + absent + late + excused + delayed;
      notRecorded = Math.max(0, expectedPupilCount - totalRecordedPupils);

      // Attendance rate based on pupils who attended vs total pupils
      attendanceRate = expectedPupilCount > 0 ? ((present + late) / expectedPupilCount) * 100 : 0;
    } else {
      // Original logic for other views (weekly, monthly, termly)
      const totalExpectedRecords = schoolDaysCount * expectedPupilCount;
      const totalActualRecords = records.length;
      notRecorded = Math.max(0, totalExpectedRecords - totalActualRecords);

      attendanceRate = schoolDaysCount > 0 ? ((present + late) / schoolDaysCount) * 100 : 0;
    }

    return {
      totalDays: records.length,
      schoolDays: schoolDaysCount,
      present,
      absent,
      late,
      excused,
      delayed,
      notRecorded,
      attendanceRate
    };
  }, []);

  // Generate trend data based on selected period
  const generateTrendData = React.useCallback((): TrendData[] => {
    if (!startDate || !endDate) return [];

    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const trendData: TrendData[] = [];

      let intervals: { start: Date; end: Date; label: string }[] = [];

      switch (trendPeriod) {
        case "daily":
          const schoolDays = getSchoolDays(start, end);
          intervals = schoolDays.map(day => ({
            start: startOfDay(day),
            end: endOfDay(day),
            label: format(day, "MMM dd, yyyy")
          }));
          break;

        case "weekly":
          const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
          intervals = weeks.map(week => {
            const weekStart = startOfWeek(week, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(week, { weekStartsOn: 1 });
            return {
              start: weekStart > start ? weekStart : start,
              end: weekEnd < end ? weekEnd : end,
              label: `Week of ${format(weekStart, "MMM dd")}`
            };
          });
          break;

        case "monthly":
          const months = eachMonthOfInterval({ start, end });
          intervals = months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            return {
              start: monthStart > start ? monthStart : start,
              end: monthEnd < end ? monthEnd : end,
              label: format(month, "MMMM yyyy")
            };
          });
          break;

        case "termly":
          if (selectedAcademicYear) {
            const termsInRange = getTermsInDateRange(start, end, selectedAcademicYear);
            intervals = termsInRange.map(term => ({
              start: parseISO(term.startDate) > start ? parseISO(term.startDate) : start,
              end: parseISO(term.endDate) < end ? parseISO(term.endDate) : end,
              label: term.name
            }));
          }
          break;
      }

      intervals.forEach((interval, index) => {
        const periodRecords = attendanceRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate >= interval.start && recordDate <= interval.end;
        });

        // Filter by class or pupil if selected
        let filteredRecords = periodRecords;
        if (reportType === "class" && selectedClassId && selectedClassId !== "_all_") {
          filteredRecords = periodRecords.filter(r => r.classId === selectedClassId);
        } else if (reportType === "pupil" && selectedPupilId) {
          filteredRecords = periodRecords.filter(r => r.pupilId === selectedPupilId);
        }

        const schoolDaysInPeriod = getSchoolDays(interval.start, interval.end);
        // For trend data, calculate expected pupil count
        let expectedPupilCount = 1;
        if (reportType === "class" && selectedClassId && selectedClassId !== "_all_") {
          const classInfo = allClasses.find(c => c.id === selectedClassId);
          // Find pupils exactly matching the interval's active requirements
          expectedPupilCount = allPupils.filter(p => {
            if (p.classId !== selectedClassId) return false;
            
            if (trendPeriod === "daily") {
              // For daily views, interval.start and interval.end cover the same single day
              return wasPupilActiveOnDate(p, format(interval.start, 'yyyy-MM-dd'));
            } else {
              return wasPupilActiveInDateRange(p, format(interval.start, 'yyyy-MM-dd'), format(interval.end, 'yyyy-MM-dd'));
            }
          }).length;
        }
        const isDailyClassView = trendPeriod === "daily" && reportType === "class";
        const stats = calculateStats(filteredRecords, schoolDaysInPeriod.length, expectedPupilCount, isDailyClassView);

        // Calculate trend (compare with previous period)
        let trend: "up" | "down" | "stable" = "stable";
        if (index > 0) {
          const prevPeriodRate = trendData[index - 1]?.attendanceRate || 0;
          if (stats.attendanceRate > prevPeriodRate + 2) trend = "up";
          else if (stats.attendanceRate < prevPeriodRate - 2) trend = "down";
        }

        trendData.push({
          period: interval.label,
          date: format(interval.start, "yyyy-MM-dd"),
          ...stats,
          trend
        });
      });

      return trendData;
    } catch (error) {
      console.error('Error generating trend data:', error);
      return [];
    }
  }, [startDate, endDate, trendPeriod, attendanceRecords, getSchoolDays, calculateStats, selectedAcademicYear, reportType, selectedClassId, selectedPupilId]);

  // Generate pupil trend data
  const generatePupilTrendData = React.useCallback((): PupilTrendData[] => {
    if (!selectedPupilId || !startDate || !endDate) return [];

    const pupil = allPupils.find(p => p.id === selectedPupilId);
    if (!pupil) return [];

    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const pupilRecords = attendanceRecords.filter(r => r.pupilId === selectedPupilId);

      // Determine if this is a year view (spanning multiple terms)
      const isYearView = selectedAcademicYear &&
        selectedTermId === "_all_" &&
        selectedAcademicYear.terms.length > 1 &&
        Math.abs(end.getTime() - start.getTime()) > (180 * 24 * 60 * 60 * 1000); // More than 6 months

      let intervals: { start: Date; end: Date; label: string }[] = [];

      // For year view, always show by terms regardless of trend period
      if (isYearView) {
        // Year view: show by terms
        if (selectedAcademicYear) {
          const termsInRange = getTermsInDateRange(start, end, selectedAcademicYear);
          intervals = termsInRange.map(term => ({
            start: parseISO(term.startDate) > start ? parseISO(term.startDate) : start,
            end: parseISO(term.endDate) < end ? parseISO(term.endDate) : end,
            label: term.name
          }));
        }
      } else {
        // Individual date breakdown for week, month, and term views
        switch (trendPeriod) {
          case "daily":
            const schoolDays = getSchoolDays(start, end);
            intervals = schoolDays.map(day => ({
              start: startOfDay(day),
              end: endOfDay(day),
              label: format(day, "MMM dd, yyyy")
            }));
            break;

          case "weekly":
            // For weekly view, show actual weeks within the date range
            const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
            intervals = weeks.map(week => {
              const weekStart = startOfWeek(week, { weekStartsOn: 1 });
              const weekEnd = endOfWeek(week, { weekStartsOn: 1 });
              return {
                start: weekStart > start ? weekStart : start,
                end: weekEnd < end ? weekEnd : end,
                label: `Week of ${format(weekStart, "MMM dd")}`
              };
            });
            break;

          case "monthly":
            // For monthly view, show actual months within the date range
            const months = eachMonthOfInterval({ start, end });
            intervals = months.map(month => {
              const monthStart = startOfMonth(month);
              const monthEnd = endOfMonth(month);
              return {
                start: monthStart > start ? monthStart : start,
                end: monthEnd < end ? monthEnd : end,
                label: format(month, "MMMM yyyy")
              };
            });
            break;

          case "termly":
            // For termly view, show actual terms within the date range
            if (selectedAcademicYear) {
              const termsInRange = getTermsInDateRange(start, end, selectedAcademicYear);
              intervals = termsInRange.map(term => ({
                start: parseISO(term.startDate) > start ? parseISO(term.startDate) : start,
                end: parseISO(term.endDate) < end ? parseISO(term.endDate) : end,
                label: term.name
              }));
            }
            break;
        }
      }

      // If no intervals found, fall back to single period
      if (intervals.length === 0) {
        intervals = [{
          start,
          end,
          label: `${format(start, "MMM dd")} - ${format(end, "MMM dd, yyyy")}`
        }];
      }

      // Generate data for each interval
      const trendData: PupilTrendData[] = [];

      intervals.forEach((interval, index) => {
        // Get pupil's attendance records for this period
        const periodRecords = pupilRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate >= interval.start && recordDate <= interval.end;
        });

        const schoolDaysInPeriod = getSchoolDays(interval.start, interval.end);
        const stats = calculateStats(periodRecords, schoolDaysInPeriod.length, 1);

        // Calculate trend (compare with previous period)
        let trend: "up" | "down" | "stable" = "stable";
        if (index > 0) {
          const prevPeriodRate = trendData[index - 1]?.attendanceRate || 0;
          if (stats.attendanceRate > prevPeriodRate + 2) trend = "up";
          else if (stats.attendanceRate < prevPeriodRate - 2) trend = "down";
        }

        trendData.push({
          ...stats,
          period: interval.label,
          date: format(interval.start, "yyyy-MM-dd"),
          trend,
          pupilId: pupil.id,
          pupilName: `${pupil.lastName?.charAt(0).toUpperCase() + pupil.lastName?.slice(1).toLowerCase() || ''} ${pupil.firstName?.charAt(0).toUpperCase() + pupil.firstName?.slice(1).toLowerCase() || ''}`.trim(),
          admissionNumber: pupil.admissionNumber
        });
      });

      return trendData;
    } catch (error) {
      console.error('Error generating pupil trend data:', error);
      return [];
    }
  }, [selectedPupilId, allPupils, attendanceRecords, startDate, endDate, getSchoolDays, calculateStats, trendPeriod, selectedAcademicYear, selectedTermId]);

  // Generate school-wide attendance data for day view
  const generateSchoolAttendanceData = React.useCallback((): SchoolAttendanceData[] => {
    if (!startDate || !endDate || trendPeriod !== "daily") return [];

    try {
      const schoolData: SchoolAttendanceData[] = [];
      const targetDate = startDate; // YYYY-MM-DD format

      // Helper: determine if a pupil was active on a given date
      // Now imported from external shared utility: wasPupilActiveOnDate

      // Group pupils by class, filtered by active status on selected date
      const classPupils = allClasses.reduce((acc, cls) => {
        acc[cls.id] = {
          class: cls,
          pupils: allPupils.filter(p => p.classId === cls.id && wasPupilActiveOnDate(p, targetDate))
        };
        return acc;
      }, {} as Record<string, { class: any; pupils: any[] }>);

      // Process each class
      Object.values(classPupils).forEach(({ class: cls, pupils }) => {
        if (pupils.length === 0) return;

        const classAttendanceData: SchoolAttendanceData = {
          classId: cls.id,
          className: cls.name,
          classCode: cls.code,
          order: cls.order,
          totalPupils: pupils.length,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          delayed: 0,
          notRecorded: 0,
          attendanceRate: 0,
          pupils: {
            present: [],
            absent: [],
            late: [],
            excused: [],
            delayed: [],
            notRecorded: []
          }
        };

        // Process each pupil in the class
        pupils.forEach(pupil => {
          // Find attendance record for this pupil on the selected date
          // Convert both dates to YYYY-MM-DD format for comparison
          const targetDate = startDate; // Already in YYYY-MM-DD format
          const attendanceRecord = attendanceRecords.find(record => {
            // Handle different date formats that might come from the database
            let recordDate;
            try {
              if (typeof record.date === 'string') {
                // Use format() to get local date part (not split on 'T' which gives UTC date)
                recordDate = format(new Date(record.date), 'yyyy-MM-dd');
              } else if (record.date && typeof record.date === 'object' && 'getTime' in record.date) {
                // If it's a Date object, format it
                const dateObj = record.date as Date;
                if (isNaN(dateObj.getTime())) {
                  console.warn('Invalid date object:', record.date);
                  return false;
                }
                recordDate = format(dateObj, 'yyyy-MM-dd');
              } else if (record.date) {
                // Fallback: try to parse it
                const parsedDate = new Date(record.date as any);
                if (isNaN(parsedDate.getTime())) {
                  console.warn('Could not parse date:', record.date);
                  return false;
                }
                recordDate = format(parsedDate, 'yyyy-MM-dd');
              } else {
                console.warn('Record has no date:', record);
                return false;
              }
            } catch (error) {
              console.warn('Error processing date for record:', record, error);
              return false;
            }

            return record.pupilId === pupil.id && recordDate === targetDate;
          });

          const pupilInfo = {
            id: pupil.id,
            name: `${pupil.lastName?.charAt(0).toUpperCase() + pupil.lastName?.slice(1).toLowerCase() || ''} ${pupil.firstName?.charAt(0).toUpperCase() + pupil.firstName?.slice(1).toLowerCase() || ''}`.trim(),
            admissionNumber: pupil.admissionNumber
          };

          if (attendanceRecord) {
            switch (attendanceRecord.status) {
              case 'Present':
                classAttendanceData.present++;
                classAttendanceData.pupils.present.push(pupilInfo);
                break;
              case 'Absent':
                classAttendanceData.absent++;
                classAttendanceData.pupils.absent.push(pupilInfo);
                break;
              case 'Late':
                classAttendanceData.late++;
                classAttendanceData.pupils.late.push(pupilInfo);
                break;
              case 'Excused':
                classAttendanceData.excused++;
                classAttendanceData.pupils.excused.push(pupilInfo);
                break;
              case 'Delayed':
                classAttendanceData.delayed++;
                classAttendanceData.pupils.delayed.push(pupilInfo);
                break;
            }
          } else {
            // No record means not recorded yet (not absent by default)
            classAttendanceData.notRecorded++;
            classAttendanceData.pupils.notRecorded.push(pupilInfo);
          }
        });

        // Calculate attendance rate
        const attendingPupils = classAttendanceData.present + classAttendanceData.late;
        classAttendanceData.attendanceRate = classAttendanceData.totalPupils > 0
          ? (attendingPupils / classAttendanceData.totalPupils) * 100
          : 0;

        schoolData.push(classAttendanceData);
      });

      // Sort by class ordinal order
      schoolData.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

      // Sort pupils in each category by name
      schoolData.forEach(data => {
        const sortPupils = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
        data.pupils.present.sort(sortPupils);
        data.pupils.absent.sort(sortPupils);
        data.pupils.late.sort(sortPupils);
        data.pupils.excused.sort(sortPupils);
        data.pupils.delayed.sort(sortPupils);
        data.pupils.notRecorded.sort(sortPupils);
      });

      return schoolData;
    } catch (error) {
      console.error('Error generating school attendance data:', error);
      return [];
    }
  }, [allClasses, allPupils, attendanceRecords, startDate, endDate, trendPeriod]);

  // Get school attendance data
  const schoolAttendanceData = React.useMemo(() => generateSchoolAttendanceData(), [generateSchoolAttendanceData]);



  // Handle expanding/collapsing specific class-status combinations
  const toggleClassStatusExpansion = (classId: string, status: string) => {
    const key = `${classId}-${status}`;
    setExpandedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });

    // Clear expand all status if manually toggling
    if (expandAllStatus) {
      setExpandAllStatus(null);
    }
  };

  // Handle inline attendance recording
  const togglePupilRecording = (pupilId: string) => {
    setRecordingPupils(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pupilId)) {
        newSet.delete(pupilId);
        // Clear recording data when closing
        setRecordingData(prevData => {
          const newData = { ...prevData };
          delete newData[pupilId];
          return newData;
        });
      } else {
        newSet.add(pupilId);
        // Initialize recording data
        setRecordingData(prevData => ({
          ...prevData,
          [pupilId]: { status: 'Present', remarks: '' }
        }));
      }
      return newSet;
    });
  };

  const updateRecordingData = (pupilId: string, field: 'status' | 'remarks', value: string) => {
    setRecordingData(prev => ({
      ...prev,
      [pupilId]: {
        ...prev[pupilId],
        [field]: value
      }
    }));
  };

  const saveAttendanceRecord = async (pupilId: string, classId: string) => {
    const recordData = recordingData[pupilId];
    if (!recordData || !startDate) return;

    try {
      // Here you would typically save to your database
      // For now, we'll simulate the save operation
      console.log('Saving attendance record:', {
        pupilId,
        classId,
        date: startDate,
        status: recordData.status,
        remarks: recordData.remarks
      });

      // Remove from recording state
      setRecordingPupils(prev => {
        const newSet = new Set(prev);
        newSet.delete(pupilId);
        return newSet;
      });

      setRecordingData(prev => {
        const newData = { ...prev };
        delete newData[pupilId];
        return newData;
      });

      // Show success message
      // toast.success('Attendance recorded successfully');

      // You might want to refresh the data here
      // refetchAttendanceData();

    } catch (error) {
      console.error('Error saving attendance record:', error);
      // toast.error('Failed to save attendance record');
    }
  };

  // Handle expanding all rows for a specific status
  const toggleExpandAllStatus = (status: string) => {
    if (expandAllStatus === status) {
      // Collapse all
      setExpandAllStatus(null);
      setExpandedStatuses(new Set());
    } else {
      // Expand all for this status
      setExpandAllStatus(status);
      const newExpandedStatuses = new Set<string>();
      schoolAttendanceData.forEach(classData => {
        if (classData.pupils[status as keyof typeof classData.pupils].length > 0) {
          newExpandedStatuses.add(`${classData.classId}-${status}`);
        }
      });
      setExpandedStatuses(newExpandedStatuses);
    }
  };

  // Generate class pupil trend data - shows each pupil's attendance across time periods
  const generateClassPupilTrendData = React.useCallback((): ClassPupilTrendData[] => {
    if (!selectedClassId || selectedClassId === "_all_" || !startDate || !endDate) return [];

    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);

      // Get pupils in the selected class that were active at any point in the selected period
      const classPupils = allPupils
        .filter(p => {
          if (p.classId !== selectedClassId) return false;
          
          if (trendPeriod === "daily") {
            // Must be active on the specific day (startDate and endDate are the same day)
            return wasPupilActiveOnDate(p, format(start, 'yyyy-MM-dd'));
          } else {
            // Must be active at some point during the range
            return wasPupilActiveInDateRange(p, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
          }
        })
        .sort((a, b) => {
          const nameA = `${a.lastName || ''} ${a.firstName || ''} ${a.otherNames || ''}`.trim().toLowerCase();
          const nameB = `${b.lastName || ''} ${b.firstName || ''} ${b.otherNames || ''}`.trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });
      if (classPupils.length === 0) return [];

      // Generate time intervals (same logic as generateTrendData)
      let intervals: { start: Date; end: Date; label: string }[] = [];

      switch (trendPeriod) {
        case "daily":
          const schoolDays = getSchoolDays(start, end);
          intervals = schoolDays.map(day => ({
            start: startOfDay(day),
            end: endOfDay(day),
            label: format(day, "MMM dd, yyyy")
          }));
          break;

        case "weekly":
          const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
          intervals = weeks.map(week => {
            const weekStart = startOfWeek(week, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(week, { weekStartsOn: 1 });
            return {
              start: weekStart > start ? weekStart : start,
              end: weekEnd < end ? weekEnd : end,
              label: `Week of ${format(weekStart, "MMM dd")}`
            };
          });
          break;

        case "monthly":
          const months = eachMonthOfInterval({ start, end });
          intervals = months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            return {
              start: monthStart > start ? monthStart : start,
              end: monthEnd < end ? monthEnd : end,
              label: format(month, "MMMM yyyy")
            };
          });
          break;

        case "termly":
          if (selectedAcademicYear) {
            const termsInRange = getTermsInDateRange(start, end, selectedAcademicYear);
            intervals = termsInRange.map(term => ({
              start: parseISO(term.startDate) > start ? parseISO(term.startDate) : start,
              end: parseISO(term.endDate) < end ? parseISO(term.endDate) : end,
              label: term.name
            }));
          }
          break;
      }

      // Generate data for each pupil
      return classPupils.map(pupil => {
        const pupilPeriods: TrendData[] = [];

        intervals.forEach((interval, index) => {
          // Get pupil's attendance records for this period
          const pupilRecords = attendanceRecords.filter(record => {
            const recordDate = new Date(record.date);
            return record.pupilId === pupil.id &&
              recordDate >= interval.start &&
              recordDate <= interval.end;
          });

          const schoolDaysInPeriod = getSchoolDays(interval.start, interval.end);
          const stats = calculateStats(pupilRecords, schoolDaysInPeriod.length, 1);

          // Calculate trend (compare with previous period for this pupil)
          let trend: "up" | "down" | "stable" = "stable";
          if (index > 0) {
            const prevPeriodRate = pupilPeriods[index - 1]?.attendanceRate || 0;
            if (stats.attendanceRate > prevPeriodRate + 2) trend = "up";
            else if (stats.attendanceRate < prevPeriodRate - 2) trend = "down";
          }

          pupilPeriods.push({
            period: interval.label,
            date: format(interval.start, "yyyy-MM-dd"),
            ...stats,
            trend
          });
        });

        return {
          pupilId: pupil.id,
          pupilName: `${pupil.lastName?.charAt(0).toUpperCase() + pupil.lastName?.slice(1).toLowerCase() || ''} ${pupil.firstName?.charAt(0).toUpperCase() + pupil.firstName?.slice(1).toLowerCase() || ''}`.trim(),
          admissionNumber: pupil.admissionNumber,
          periods: pupilPeriods
        };
      }).sort((a, b) => a.pupilName.localeCompare(b.pupilName)); // Sort by name

    } catch (error) {
      console.error('Error generating class pupil trend data:', error);
      return [];
    }
  }, [selectedClassId, allPupils, startDate, endDate, trendPeriod, attendanceRecords, getSchoolDays, calculateStats, selectedAcademicYear]);

  // Generate memoized trend data (must be before any conditional returns)
  const trendData = React.useMemo(() => {
    try {
      return generateTrendData();
    } catch (error) {
      console.error('Error generating trend data:', error);
      return [];
    }
  }, [generateTrendData]);

  const pupilTrendData = React.useMemo(() => {
    try {
      return generatePupilTrendData();
    } catch (error) {
      console.error('Error generating pupil trend data:', error);
      return [];
    }
  }, [generatePupilTrendData]);

  const classPupilTrendData = React.useMemo(() => {
    try {
      return generateClassPupilTrendData();
    } catch (error) {
      console.error('Error generating class pupil trend data:', error);
      return [];
    }
  }, [generateClassPupilTrendData]);

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up": return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "down": return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const setQuickDateRange = (range: "day" | "week" | "month" | "term" | "year") => {
    const today = new Date();

    switch (range) {
      case "day":
        // Set to today only for day view
        setStartDate(format(today, "yyyy-MM-dd"));
        setEndDate(format(today, "yyyy-MM-dd"));
        setTrendPeriod("daily");
        break;
      case "week":
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        setStartDate(format(weekStart, "yyyy-MM-dd"));
        setEndDate(format(weekEnd, "yyyy-MM-dd"));
        setTrendPeriod("weekly");
        break;
      case "month":
        setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
        setTrendPeriod("monthly");
        break;
      case "term":
        setTrendPeriod("termly");
        // Enable term-based date setting through the term dropdown
        if (selectedAcademicYear) {
          // Find current term or default to first term
          const currentTerm = selectedAcademicYear.terms.find(term => {
            const termStart = parseISO(term.startDate);
            const termEnd = parseISO(term.endDate);
            return today >= termStart && today <= termEnd;
          }) || selectedAcademicYear.terms[0];

          if (currentTerm) {
            setSelectedTermId(currentTerm.id);
            setStartDate(currentTerm.startDate.split('T')[0]);
            setEndDate(currentTerm.endDate.split('T')[0]);
          }
        }
        break;
      case "year":
        if (selectedAcademicYear) {
          setStartDate(selectedAcademicYear.startDate.split('T')[0]);
          setEndDate(selectedAcademicYear.endDate.split('T')[0]);
          setTrendPeriod("termly");
        }
        break;
    }
  };

  const exportTrendData = () => {
    if (reportType === "class" && selectedClassId && selectedClassId !== "_all_") {
      // Export class pupil trend data
      const data = classPupilTrendData;
      if (data.length === 0) return;

      const csvContent = [
        ["Pupil Name", "Admission Number", "Period", "Date", "School Days", "Present", "Absent", "Late", "Excused", "Not Recorded", "Attendance Rate %"].join(","),
        ...data.flatMap(pupil =>
          pupil.periods.map(period => [
            pupil.pupilName,
            pupil.admissionNumber,
            period.period,
            period.date,
            period.schoolDays,
            period.present,
            period.absent,
            period.late,
            period.excused,
            period.notRecorded,
            period.attendanceRate.toFixed(1)
          ].join(","))
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `class-pupil-attendance-trend-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Export aggregated trend data
      const data = generateTrendData();
      const csvContent = [
        ["Period", "Date", "School Days", "Present", "Absent", "Late", "Excused", "Not Recorded", "Attendance Rate %"].join(","),
        ...data.map(row => [
          row.period,
          row.date,
          row.schoolDays,
          row.present,
          row.absent,
          row.late,
          row.excused,
          row.notRecorded,
          row.attendanceRate.toFixed(1)
        ].join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-trend-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const exportPupilTrendData = () => {
    const data = generatePupilTrendData();
    if (data.length === 0) return;

    const csvContent = [
      ["Pupil Name", "Admission Number", "Period", "Date", "School Days", "Present", "Absent", "Late", "Excused", "Not Recorded", "Attendance Rate %"].join(","),
      ...data.map(row => [
        row.pupilName,
        row.admissionNumber,
        row.period,
        row.date,
        row.schoolDays,
        row.present,
        row.absent,
        row.late,
        row.excused,
        row.notRecorded,
        row.attendanceRate.toFixed(1)
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pupil-attendance-trend-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle trend period changes with appropriate date setting
  const handleTrendPeriodChange = (period: TrendPeriod) => {
    setTrendPeriod(period);

    // If switching away from daily view and report type is "school", change to "class"
    if (period !== "daily" && reportType === "school") {
      setReportType("class");
    }

    // Set appropriate date ranges when switching views
    const today = new Date();
    switch (period) {
      case "weekly":
        // Use the same week calculation as Daily School View pupil stats
        let currentDate = today;
        if (startDate && startDate.length >= 10) {
          try {
            const parsedDate = parseISO(startDate);
            // Check if the parsed date is valid
            if (!isNaN(parsedDate.getTime())) {
              currentDate = parsedDate;
            }
          } catch (error) {
            console.warn('Invalid startDate for weekly view:', startDate);
          }
        }
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        setStartDate(format(weekStart, "yyyy-MM-dd"));
        setEndDate(format(weekEnd, "yyyy-MM-dd"));
        break;
      case "monthly":
        setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
        break;
      case "termly":
        // Use the same term calculation as Daily School View pupil stats
        if (selectedAcademicYear && selectedTermId && selectedTermId !== "_all_") {
          const currentTerm = selectedAcademicYear.terms.find(t => t.id === selectedTermId);
          if (currentTerm) {
            setStartDate(currentTerm.startDate.split('T')[0]);
            setEndDate(currentTerm.endDate.split('T')[0]);
          }
        } else if (selectedAcademicYear) {
          // If no term selected, find current term
          const currentTerm = selectedAcademicYear.terms.find(term => {
            const termStart = parseISO(term.startDate);
            const termEnd = parseISO(term.endDate);
            return today >= termStart && today <= termEnd;
          }) || selectedAcademicYear.terms[0];

          if (currentTerm) {
            setSelectedTermId(currentTerm.id);
            setStartDate(currentTerm.startDate.split('T')[0]);
            setEndDate(currentTerm.endDate.split('T')[0]);
          }
        }
        break;
      case "daily":
        // Keep current term for daily view
        if (selectedAcademicYear && selectedTermId) {
          const selectedTerm = selectedAcademicYear.terms.find(term => term.id === selectedTermId);
          if (selectedTerm) {
            setStartDate(selectedTerm.startDate.split('T')[0]);
            setEndDate(selectedTerm.endDate.split('T')[0]);
          }
        }
        break;
    }
  };

  // Handle navigation to individual pupil attendance
  const handlePupilClick = (pupilId: string) => {
    // Create URL with current parameters to maintain context
    const params = new URLSearchParams({
      reportType: 'pupil',
      pupilId: pupilId,
      trendPeriod: trendPeriod,
      startDate: startDate,
      endDate: endDate,
      ...(selectedAcademicYearId && { academicYearId: selectedAcademicYearId }),
      ...(selectedTermId && { termId: selectedTermId })
    });

    router.push(`/attendance/view?${params.toString()}`);
  };

  if (classesLoading || pupilsLoading || excludedDaysLoading || academicYearsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Recess status banner */}
      <RecessStatusBanner />

      <GlassPageTopBar
        title="View Attendance"
        backHref="/attendance"
        backLabel="Back to Attendance Hub"
        className={reportType === "school" && trendPeriod === "daily" && schoolAttendanceData.length > 0 ? "mb-1.5" : "mb-4"}
        meta={
          <span className="whitespace-nowrap rounded-full border border-indigo-100/80 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
            {trendPeriod}
          </span>
        }
        titleControls={
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200/60 bg-white/90 text-blue-600 shadow-sm transition-all hover:scale-105 hover:bg-blue-50 active:scale-95 lg:hidden"
            title="Print PDF"
            type="button"
            aria-label="Print PDF"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
        }
        center={
          <>
            <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
              <SelectTrigger className="h-[34px] w-[82px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {academicYears?.map((year) => {
                  const isCurrent = year.id === currentAcademicYearId;
                  const today = new Date();
                  const yearEnd = new Date(year.endDate);
                  const hasEnded = today > yearEnd;
                  let label = '';
                  if (year.isLocked) label = ' (Locked)';
                  else if (!hasEnded) label = ' (Upcoming)';
                  return (
                    <SelectItem key={year.id} value={year.id} className="rounded-lg text-sm">
                      {year.name}{label}
                    </SelectItem>
                  );
                }) || []}
              </SelectContent>
            </Select>

            <Select value={reportType} onValueChange={(value: ReportType) => setReportType(value)}>
              <SelectTrigger className="h-[34px] w-[96px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="class" className="rounded-lg text-sm">Class</SelectItem>
                <SelectItem value="pupil" className="rounded-lg text-sm">Pupil</SelectItem>
                {trendPeriod === "daily" && (
                  <SelectItem value="school" className="rounded-lg text-sm">School</SelectItem>
                )}
              </SelectContent>
            </Select>

            <Select defaultValue="day" onValueChange={(value) => setQuickDateRange(value as "day" | "week" | "month" | "term" | "year")}>
              <SelectTrigger className="h-[34px] w-[90px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="day" className="rounded-lg text-sm">Today</SelectItem>
                <SelectItem value="week" className="rounded-lg text-sm">Week</SelectItem>
                <SelectItem value="month" className="rounded-lg text-sm">Month</SelectItem>
                <SelectItem value="term" className="rounded-lg text-sm">Term</SelectItem>
                <SelectItem value="year" className="rounded-lg text-sm">Year</SelectItem>
              </SelectContent>
            </Select>

            {startDate && (
              <div className="flex h-[34px] items-center gap-0.5 rounded-full border border-blue-200/60 bg-white/90 px-1 shadow-sm">
                <button
                  onClick={() => {
                    if (!startDate) return;
                    try {
                      const currentDate = parseISO(startDate);
                      if (isNaN(currentDate.getTime())) return;
                      let newStartDate: Date;
                      let newEndDate: Date;
                      switch (trendPeriod) {
                        case "daily":
                          newStartDate = new Date(currentDate);
                          newStartDate.setDate(currentDate.getDate() - 1);
                          newEndDate = newStartDate;
                          break;
                        case "weekly":
                          const cwS = startOfWeek(currentDate, { weekStartsOn: 1 });
                          const pvS = new Date(cwS);
                          pvS.setDate(cwS.getDate() - 7);
                          newStartDate = pvS;
                          newEndDate = endOfWeek(pvS, { weekStartsOn: 1 });
                          break;
                        case "monthly":
                          const cm = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                          const pm = new Date(cm);
                          pm.setMonth(cm.getMonth() - 1);
                          newStartDate = startOfMonth(pm);
                          newEndDate = endOfMonth(pm);
                          break;
                        case "termly":
                          if (selectedAcademicYear) {
                            const ct = selectedAcademicYear.terms.find(t => {
                              const ts = parseISO(t.startDate);
                              const te = parseISO(t.endDate);
                              return currentDate >= ts && currentDate <= te;
                            });
                            if (ct) {
                              const ci = selectedAcademicYear.terms.findIndex(t => t.id === ct.id);
                              const pt = selectedAcademicYear.terms[ci - 1];
                              if (pt) { setSelectedTermId(pt.id); newStartDate = parseISO(pt.startDate); newEndDate = parseISO(pt.endDate); }
                              else return;
                            } else return;
                          } else return;
                          break;
                        default: return;
                      }
                      setStartDate(format(newStartDate, "yyyy-MM-dd"));
                      setEndDate(format(newEndDate, "yyyy-MM-dd"));
                    } catch (e) { console.warn(e); }
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition-all hover:bg-blue-50 hover:text-blue-700"
                  type="button"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>

                <button
                  onClick={() => {
                    const today = new Date();
                    let newStartDate: Date;
                    let newEndDate: Date;
                    switch (trendPeriod) {
                      case "daily": newStartDate = today; newEndDate = today; break;
                      case "weekly":
                        newStartDate = startOfWeek(today, { weekStartsOn: 1 });
                        newEndDate = endOfWeek(today, { weekStartsOn: 1 });
                        break;
                      case "monthly":
                        newStartDate = startOfMonth(today);
                        newEndDate = endOfMonth(today);
                        break;
                      case "termly":
                        if (selectedAcademicYear) {
                          const ct = selectedAcademicYear.terms.find(t => {
                            const ts = parseISO(t.startDate);
                            const te = parseISO(t.endDate);
                            return today >= ts && today <= te;
                          });
                          if (ct) { setSelectedTermId(ct.id); newStartDate = parseISO(ct.startDate); newEndDate = parseISO(ct.endDate); }
                          else return;
                        } else return;
                        break;
                      default: return;
                    }
                    setStartDate(format(newStartDate, "yyyy-MM-dd"));
                    setEndDate(format(newEndDate, "yyyy-MM-dd"));
                  }}
                  className="h-7 px-2 text-[10px] font-semibold text-gray-700 transition-all hover:text-blue-700"
                  type="button"
                >
                  {(() => {
                    if (!startDate) return "Now";
                    try {
                      const d = parseISO(startDate);
                      const today = new Date();
                      switch (trendPeriod) {
                        case "daily":
                          if (format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) return "Today";
                          const yest = new Date(today); yest.setDate(today.getDate() - 1);
                          if (format(d, "yyyy-MM-dd") === format(yest, "yyyy-MM-dd")) return "Yesterday";
                          return format(d, "MMM dd");
                        case "weekly":
                          const cws = startOfWeek(d, { weekStartsOn: 1 });
                          const tws = startOfWeek(today, { weekStartsOn: 1 });
                          if (format(cws, "yyyy-MM-dd") === format(tws, "yyyy-MM-dd")) return "This Week";
                          return `Wk ${format(cws, "MMM dd")}`;
                        case "monthly":
                          if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) return "This Month";
                          return format(d, "MMM yyyy");
                        case "termly":
                          if (selectedAcademicYear) {
                            const vt = selectedAcademicYear.terms.find(t => d >= parseISO(t.startDate) && d <= parseISO(t.endDate));
                            return vt?.name || "Term";
                          }
                          return "Term";
                        default: return "Period";
                      }
                    } catch { return "Now"; }
                  })()}
                </button>

                <button
                  onClick={() => {
                    if (!startDate) return;
                    try {
                      const currentDate = parseISO(startDate);
                      if (isNaN(currentDate.getTime())) return;
                      let newStartDate: Date;
                      let newEndDate: Date;
                      switch (trendPeriod) {
                        case "daily":
                          newStartDate = new Date(currentDate);
                          newStartDate.setDate(currentDate.getDate() + 1);
                          newEndDate = newStartDate;
                          break;
                        case "weekly":
                          const cwS = startOfWeek(currentDate, { weekStartsOn: 1 });
                          const nwS = new Date(cwS);
                          nwS.setDate(cwS.getDate() + 7);
                          newStartDate = nwS;
                          newEndDate = endOfWeek(nwS, { weekStartsOn: 1 });
                          break;
                        case "monthly":
                          const cm = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                          const nm = new Date(cm);
                          nm.setMonth(cm.getMonth() + 1);
                          newStartDate = startOfMonth(nm);
                          newEndDate = endOfMonth(nm);
                          break;
                        case "termly":
                          if (selectedAcademicYear) {
                            const ct = selectedAcademicYear.terms.find(t => {
                              const ts = parseISO(t.startDate);
                              const te = parseISO(t.endDate);
                              return currentDate >= ts && currentDate <= te;
                            });
                            if (ct) {
                              const ci = selectedAcademicYear.terms.findIndex(t => t.id === ct.id);
                              const nt = selectedAcademicYear.terms[ci + 1];
                              if (nt) { setSelectedTermId(nt.id); newStartDate = parseISO(nt.startDate); newEndDate = parseISO(nt.endDate); }
                              else return;
                            } else return;
                          } else return;
                          break;
                        default: return;
                      }
                      setStartDate(format(newStartDate, "yyyy-MM-dd"));
                      setEndDate(format(newEndDate, "yyyy-MM-dd"));
                    } catch (e) { console.warn(e); }
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition-all hover:bg-blue-50 hover:text-blue-700"
                  type="button"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {trendPeriod === "daily" ? (
              <Select value={startDate || ''} onValueChange={(v) => { if (v) { setStartDate(v); setEndDate(v); } }}>
                <SelectTrigger className="h-[34px] w-[132px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {(() => {
                    const days = [];
                    const today = new Date();
                    for (let i = -30; i <= 7; i++) {
                      const date = new Date(today); date.setDate(today.getDate() + i);
                      const value = format(date, "yyyy-MM-dd");
                      const label = format(date, "EEE, MMM dd");
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      days.push(<SelectItem key={value} value={value} className="rounded-lg text-sm"><span className={isWeekend ? "text-gray-500" : ""}>{label}</span></SelectItem>);
                    }
                    return days;
                  })()}
                </SelectContent>
              </Select>
            ) : trendPeriod === "weekly" ? (
              <Select value={startDate && endDate ? `${startDate}_${endDate}` : ''} onValueChange={(v) => { if (v) { const [s, e] = v.split('_'); setStartDate(s); setEndDate(e); } }}>
                <SelectTrigger className="h-[34px] w-[140px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden">
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {(() => {
                    const weeks = [];
                    const today = new Date();
                    for (let i = -8; i <= 4; i++) {
                      const weekStart = startOfWeek(subDays(today, i * 7), { weekStartsOn: 1 });
                      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                      const value = `${format(weekStart, "yyyy-MM-dd")}_${format(weekEnd, "yyyy-MM-dd")}`;
                      weeks.push(<SelectItem key={value} value={value} className="rounded-lg text-sm">{format(weekStart, "MMM dd")} - {format(weekEnd, "MMM dd")}</SelectItem>);
                    }
                    return weeks;
                  })()}
                </SelectContent>
              </Select>
            ) : trendPeriod === "monthly" ? (
              <Select value={`${startDate?.slice(0, 7) || ''}`} onValueChange={(v) => { if (v) { const [y, m] = v.split('-'); const ms = new Date(parseInt(y), parseInt(m) - 1, 1); const me = new Date(parseInt(y), parseInt(m), 0); setStartDate(format(ms, "yyyy-MM-dd")); setEndDate(format(me, "yyyy-MM-dd")); } }}>
                <SelectTrigger className="h-[34px] w-[120px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {(() => { const months = []; const today = new Date(); for (let i = -12; i <= 3; i++) { const date = new Date(today.getFullYear(), today.getMonth() + i, 1); months.push(<SelectItem key={format(date, "yyyy-MM")} value={format(date, "yyyy-MM")} className="rounded-lg text-sm">{format(date, "MMM yyyy")}</SelectItem>); } return months; })()}
                </SelectContent>
              </Select>
            ) : (
              <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                <SelectTrigger className="h-[34px] w-[120px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden">
                  <SelectValue placeholder="Term" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="_all_" className="rounded-lg text-sm">All terms</SelectItem>
                  {academicYears?.map((academicYear) => (
                    <React.Fragment key={academicYear.id}>
                      <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50">{academicYear.name}</div>
                      {academicYear.terms?.map((term) => (
                        <SelectItem key={term.id} value={term.id} className="rounded-lg text-sm">{term.name}</SelectItem>
                      ))}
                    </React.Fragment>
                  )) || []}
                </SelectContent>
              </Select>
            )}
          </>
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="Print"
              tone="blue"
              icon={<Printer className="h-4 w-4" />}
              onClick={() => setIsPrintModalOpen(true)}
              aria-label="Print PDF"
            />
          </GlassActionDock>
        }
        actionsClassName="hidden lg:flex"
        below={
          <div className="space-y-2">
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
              <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
                <SelectTrigger className="h-[30px] w-[72px] shrink-0 rounded-full border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 lg:hidden [&>svg]:hidden">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {academicYears?.map((year) => {
                    const isCurrent = year.id === currentAcademicYearId;
                    const today = new Date();
                    const yearEnd = new Date(year.endDate);
                    const hasEnded = today > yearEnd;
                    let label = '';
                    if (year.isLocked) label = ' (Locked)';
                    else if (!hasEnded) label = ' (Upcoming)';
                    return (
                      <SelectItem key={year.id} value={year.id} className="rounded-lg text-sm">
                        {year.name}{label}
                      </SelectItem>
                    );
                  }) || []}
                </SelectContent>
              </Select>

              <Select value={reportType} onValueChange={(value: ReportType) => setReportType(value)}>
                <SelectTrigger className="h-[30px] w-[74px] shrink-0 rounded-full border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 lg:hidden [&>svg]:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="class" className="rounded-lg text-sm">Class</SelectItem>
                  <SelectItem value="pupil" className="rounded-lg text-sm">Pupil</SelectItem>
                  {trendPeriod === "daily" && (
                    <SelectItem value="school" className="rounded-lg text-sm">School</SelectItem>
                  )}
                </SelectContent>
              </Select>

              <Select defaultValue="day" onValueChange={(value) => setQuickDateRange(value as "day" | "week" | "month" | "term" | "year")}>
                <SelectTrigger className="h-[30px] w-[72px] shrink-0 rounded-full border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 lg:hidden [&>svg]:hidden">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="day" className="rounded-lg text-sm">Today</SelectItem>
                  <SelectItem value="week" className="rounded-lg text-sm">Week</SelectItem>
                  <SelectItem value="month" className="rounded-lg text-sm">Month</SelectItem>
                  <SelectItem value="term" className="rounded-lg text-sm">Term</SelectItem>
                  <SelectItem value="year" className="rounded-lg text-sm">Year</SelectItem>
                </SelectContent>
              </Select>

              {startDate && (
                <div className="flex h-[34px] items-center gap-0.5 rounded-full border border-blue-200/60 bg-white/90 px-1 shadow-sm lg:hidden">
                  <button
                    onClick={() => {
                      if (!startDate) return;
                      try {
                        const currentDate = parseISO(startDate);
                        if (isNaN(currentDate.getTime())) return;
                        let newStartDate: Date;
                        let newEndDate: Date;
                        switch (trendPeriod) {
                          case "daily":
                            newStartDate = new Date(currentDate);
                            newStartDate.setDate(currentDate.getDate() - 1);
                            newEndDate = newStartDate;
                            break;
                          case "weekly":
                            const cwS = startOfWeek(currentDate, { weekStartsOn: 1 });
                            const pvS = new Date(cwS);
                            pvS.setDate(cwS.getDate() - 7);
                            newStartDate = pvS;
                            newEndDate = endOfWeek(pvS, { weekStartsOn: 1 });
                            break;
                          case "monthly":
                            const cm = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                            const pm = new Date(cm);
                            pm.setMonth(cm.getMonth() - 1);
                            newStartDate = startOfMonth(pm);
                            newEndDate = endOfMonth(pm);
                            break;
                          case "termly":
                            if (selectedAcademicYear) {
                              const ct = selectedAcademicYear.terms.find(t => {
                                const ts = parseISO(t.startDate);
                                const te = parseISO(t.endDate);
                                return currentDate >= ts && currentDate <= te;
                              });
                              if (ct) {
                                const ci = selectedAcademicYear.terms.findIndex(t => t.id === ct.id);
                                const pt = selectedAcademicYear.terms[ci - 1];
                                if (pt) { setSelectedTermId(pt.id); newStartDate = parseISO(pt.startDate); newEndDate = parseISO(pt.endDate); }
                                else return;
                              } else return;
                            } else return;
                            break;
                          default: return;
                        }
                        setStartDate(format(newStartDate, "yyyy-MM-dd"));
                        setEndDate(format(newEndDate, "yyyy-MM-dd"));
                      } catch (e) { console.warn(e); }
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition-all hover:bg-blue-50 hover:text-blue-700"
                    type="button"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>

                  <button
                    onClick={() => {
                      const today = new Date();
                      let newStartDate: Date;
                      let newEndDate: Date;
                      switch (trendPeriod) {
                        case "daily": newStartDate = today; newEndDate = today; break;
                        case "weekly":
                          newStartDate = startOfWeek(today, { weekStartsOn: 1 });
                          newEndDate = endOfWeek(today, { weekStartsOn: 1 });
                          break;
                        case "monthly":
                          newStartDate = startOfMonth(today);
                          newEndDate = endOfMonth(today);
                          break;
                        case "termly":
                          if (selectedAcademicYear) {
                            const ct = selectedAcademicYear.terms.find(t => {
                              const ts = parseISO(t.startDate);
                              const te = parseISO(t.endDate);
                              return today >= ts && today <= te;
                            });
                            if (ct) { setSelectedTermId(ct.id); newStartDate = parseISO(ct.startDate); newEndDate = parseISO(ct.endDate); }
                            else return;
                          } else return;
                          break;
                        default: return;
                      }
                      setStartDate(format(newStartDate, "yyyy-MM-dd"));
                      setEndDate(format(newEndDate, "yyyy-MM-dd"));
                    }}
                    className="h-7 px-2 text-[10px] font-semibold text-gray-700 transition-all hover:text-blue-700"
                    type="button"
                  >
                    {(() => {
                      if (!startDate) return "Now";
                      try {
                        const d = parseISO(startDate);
                        const today = new Date();
                        switch (trendPeriod) {
                          case "daily":
                            if (format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) return "Today";
                            const yest = new Date(today); yest.setDate(today.getDate() - 1);
                            if (format(d, "yyyy-MM-dd") === format(yest, "yyyy-MM-dd")) return "Yesterday";
                            return format(d, "MMM dd");
                          case "weekly":
                            const cws = startOfWeek(d, { weekStartsOn: 1 });
                            const tws = startOfWeek(today, { weekStartsOn: 1 });
                            if (format(cws, "yyyy-MM-dd") === format(tws, "yyyy-MM-dd")) return "This Week";
                            return `Wk ${format(cws, "MMM dd")}`;
                          case "monthly":
                            if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) return "This Month";
                            return format(d, "MMM yyyy");
                          case "termly":
                            if (selectedAcademicYear) {
                              const vt = selectedAcademicYear.terms.find(t => d >= parseISO(t.startDate) && d <= parseISO(t.endDate));
                              return vt ? vt.name : "Term";
                            }
                            return "Term";
                          default: return "Period";
                        }
                      } catch { return "Now"; }
                    })()}
                  </button>

                  <button
                    onClick={() => {
                      if (!startDate) return;
                      try {
                        const currentDate = parseISO(startDate);
                        if (isNaN(currentDate.getTime())) return;
                        let newStartDate: Date;
                        let newEndDate: Date;
                        switch (trendPeriod) {
                          case "daily":
                            newStartDate = new Date(currentDate);
                            newStartDate.setDate(currentDate.getDate() + 1);
                            newEndDate = newStartDate;
                            break;
                          case "weekly":
                            const cwS = startOfWeek(currentDate, { weekStartsOn: 1 });
                            const nwS = new Date(cwS);
                            nwS.setDate(cwS.getDate() + 7);
                            newStartDate = nwS;
                            newEndDate = endOfWeek(nwS, { weekStartsOn: 1 });
                            break;
                          case "monthly":
                            const cm = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                            const nm = new Date(cm);
                            nm.setMonth(cm.getMonth() + 1);
                            newStartDate = startOfMonth(nm);
                            newEndDate = endOfMonth(nm);
                            break;
                          case "termly":
                            if (selectedAcademicYear) {
                              const ct = selectedAcademicYear.terms.find(t => {
                                const ts = parseISO(t.startDate);
                                const te = parseISO(t.endDate);
                                return currentDate >= ts && currentDate <= te;
                              });
                              if (ct) {
                                const ci = selectedAcademicYear.terms.findIndex(t => t.id === ct.id);
                                const nt = selectedAcademicYear.terms[ci + 1];
                                if (nt) { setSelectedTermId(nt.id); newStartDate = parseISO(nt.startDate); newEndDate = parseISO(nt.endDate); }
                                else return;
                              } else return;
                            } else return;
                            break;
                          default: return;
                        }
                        setStartDate(format(newStartDate, "yyyy-MM-dd"));
                        setEndDate(format(newEndDate, "yyyy-MM-dd"));
                      } catch (e) { console.warn(e); }
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition-all hover:bg-blue-50 hover:text-blue-700"
                    type="button"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              )}

              {trendPeriod === "daily" ? (
                <Select value={startDate || ''} onValueChange={(v) => { if (v) { setStartDate(v); setEndDate(v); } }}>
                <SelectTrigger className="h-[30px] w-[112px] shrink-0 rounded-full border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 lg:hidden [&>svg]:hidden">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(() => {
                      const days = [];
                      const today = new Date();
                      for (let i = -30; i <= 7; i++) {
                        const date = new Date(today); date.setDate(today.getDate() + i);
                        const value = format(date, "yyyy-MM-dd");
                        const label = format(date, "EEE, MMM dd");
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        days.push(<SelectItem key={value} value={value} className="rounded-lg text-sm"><span className={isWeekend ? "text-gray-500" : ""}>{label}</span></SelectItem>);
                      }
                      return days;
                    })()}
                  </SelectContent>
                </Select>
              ) : trendPeriod === "weekly" ? (
                <Select value={startDate && endDate ? `${startDate}_${endDate}` : ''} onValueChange={(v) => { if (v) { const [s, e] = v.split('_'); setStartDate(s); setEndDate(e); } }}>
                <SelectTrigger className="h-[30px] w-[122px] shrink-0 rounded-full border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 lg:hidden [&>svg]:hidden">
                    <SelectValue placeholder="Select week" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(() => {
                      const weeks = [];
                      const today = new Date();
                      for (let i = -8; i <= 4; i++) {
                        const weekStart = startOfWeek(subDays(today, i * 7), { weekStartsOn: 1 });
                        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                        const value = `${format(weekStart, "yyyy-MM-dd")}_${format(weekEnd, "yyyy-MM-dd")}`;
                        weeks.push(<SelectItem key={value} value={value} className="rounded-lg text-sm">{format(weekStart, "MMM dd")} - {format(weekEnd, "MMM dd")}</SelectItem>);
                      }
                      return weeks;
                    })()}
                  </SelectContent>
                </Select>
              ) : trendPeriod === "monthly" ? (
                <Select value={`${startDate?.slice(0, 7) || ''}`} onValueChange={(v) => { if (v) { const [y, m] = v.split('-'); const ms = new Date(parseInt(y), parseInt(m) - 1, 1); const me = new Date(parseInt(y), parseInt(m), 0); setStartDate(format(ms, "yyyy-MM-dd")); setEndDate(format(me, "yyyy-MM-dd")); } }}>
                <SelectTrigger className="h-[30px] w-[102px] shrink-0 rounded-full border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 lg:hidden [&>svg]:hidden">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(() => { const months = []; const today = new Date(); for (let i = -12; i <= 3; i++) { const date = new Date(today.getFullYear(), today.getMonth() + i, 1); months.push(<SelectItem key={format(date, "yyyy-MM")} value={format(date, "yyyy-MM")} className="rounded-lg text-sm">{format(date, "MMM yyyy")}</SelectItem>); } return months; })()}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                <SelectTrigger className="h-[30px] w-[102px] shrink-0 rounded-full border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 lg:hidden [&>svg]:hidden">
                    <SelectValue placeholder="Term" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="_all_" className="rounded-lg text-sm">All terms</SelectItem>
                    {academicYears?.map((academicYear) => (
                      <React.Fragment key={academicYear.id}>
                        <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50">{academicYear.name}</div>
                        {academicYear.terms?.map((term) => (
                          <SelectItem key={term.id} value={term.id} className="rounded-lg text-sm">{term.name}</SelectItem>
                        ))}
                      </React.Fragment>
                    )) || []}
                  </SelectContent>
                </Select>
              )}

              {!(trendPeriod === "daily" && reportType === "school") && (
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="h-[34px] w-[110px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="_all_" className="rounded-lg text-sm">All Classes</SelectItem>
                    {allClasses?.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="rounded-lg text-sm">{cls.code}</SelectItem>
                    )) || []}
                  </SelectContent>
                </Select>
              )}

              {reportType === "pupil" && (
                <Select value={selectedPupilId} onValueChange={setSelectedPupilId}>
                  <SelectTrigger className="h-[34px] w-[150px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden">
                    <SelectValue placeholder="Pupil" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {allPupils
                      ?.filter(p => {
                        if (selectedClassId && selectedClassId !== "_all_" && p.classId !== selectedClassId) return false;
                        if (startDate && endDate) return wasPupilActiveInDateRange(p, startDate, endDate);
                        return true;
                      })
                      ?.sort((a, b) => {
                        const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
                        const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
                        return nameA.localeCompare(nameB);
                      })
                      ?.map((pupil) => (
                        <SelectItem key={pupil.id} value={pupil.id} className="rounded-lg text-sm">
                          {pupil.lastName} {pupil.firstName}
                        </SelectItem>
                      )) || []}
                  </SelectContent>
                </Select>
              )}
            </div>

            {(dateRangeValidation.warning || !selectedAcademicYear) && (
              <div className="flex flex-col gap-1">
                {dateRangeValidation.warning && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-[10px] text-amber-700 sm:text-xs">
                    <Info className="h-3 w-3 flex-shrink-0" />
                    <span>{dateRangeValidation.warning}</span>
                  </div>
                )}
                {!selectedAcademicYear && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50/80 px-2.5 py-1 text-[10px] text-yellow-700 sm:text-xs">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    <span>Select an academic year for accurate analysis.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        }
      />

      {/* School Summary - Compact Version */}
      {reportType === "school" && trendPeriod === "daily" && schoolAttendanceData.length > 0 && (
        <GlassSummaryBar
          left={
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 dark:text-indigo-200 uppercase">
                School Attendance - {startDate ? format(parseISO(startDate), "MMM dd, yyyy") : "Select Date"}
              </span>
              <span className="text-xs text-gray-300 font-medium">•</span>
              <span className="text-[10px] sm:text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-2 py-0.5 rounded-full border border-green-100/80 whitespace-nowrap">
                {(() => {
                  const totalPresent = schoolAttendanceData.reduce((sum, cls) => sum + cls.present + cls.late, 0);
                  const totalPupils = schoolAttendanceData.reduce((sum, cls) => sum + cls.totalPupils, 0);
                  return totalPupils > 0 ? ((totalPresent / totalPupils) * 100).toFixed(1) : '0';
                })()}% Rate
              </span>
            </div>
          }
          right={
            <>
              <div className="flex items-center gap-1 bg-green-50/80 dark:bg-green-950/20 border border-green-100/50 dark:border-green-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-green-600 dark:text-green-400">
                  {schoolAttendanceData.reduce((sum, cls) => sum + cls.present, 0)}
                </span>
                <span className="text-green-700/85 dark:text-green-300 font-medium">Present</span>
              </div>
              <div className="flex items-center gap-1 bg-red-50/80 dark:bg-red-950/20 border border-red-100/50 dark:border-red-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-red-600 dark:text-red-400">
                  {schoolAttendanceData.reduce((sum, cls) => sum + cls.absent, 0)}
                </span>
                <span className="text-red-700/85 dark:text-red-300 font-medium">Absent</span>
              </div>
              <div className="flex items-center gap-1 bg-yellow-50/80 dark:bg-yellow-950/20 border border-yellow-100/50 dark:border-yellow-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-yellow-600 dark:text-yellow-400">
                  {schoolAttendanceData.reduce((sum, cls) => sum + cls.late, 0)}
                </span>
                <span className="text-yellow-700/85 dark:text-green-300 font-medium">Late</span>
              </div>
              <div className="flex items-center gap-1 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {schoolAttendanceData.reduce((sum, cls) => sum + cls.excused, 0)}
                </span>
                <span className="text-blue-700/85 dark:text-blue-300 font-medium">Excused</span>
              </div>
              <div className="flex items-center gap-1 bg-purple-50/80 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {schoolAttendanceData.reduce((sum, cls) => sum + cls.delayed, 0)}
                </span>
                <span className="text-purple-700/85 dark:text-purple-300 font-medium">Delayed</span>
              </div>
              <div className="flex items-center gap-1 bg-gray-50/80 dark:bg-gray-800/30 border border-gray-100/50 dark:border-gray-700/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-gray-600 dark:text-gray-400">
                  {schoolAttendanceData.reduce((sum, cls) => sum + cls.notRecorded, 0)}
                </span>
                <span className="text-gray-700/85 dark:text-gray-300 font-medium">Not Recorded</span>
              </div>
            </>
          }
        />
      )}

      {/* Unified frosted-glass sticky header */}
      {false && (
      <div className="hidden">
        <div className="h-px bg-gradient-to-r from-transparent via-blue-200/60 to-transparent" />
        <div className="max-w-7xl mx-auto py-1">
          {/* Wrapped row of controls on small screens */}
          <div className="flex flex-row flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 w-full">

            {/* Back button */}
            <SmartBackButton
              fallbackHref="/attendance"
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-50/80 border border-blue-200/60 text-blue-600 shadow-sm flex-shrink-0 hover:bg-blue-100 transition-colors"
              title="Back to Attendance Hub"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </SmartBackButton>

            {/* Title */}
            <h1 className="text-xs sm:text-sm font-bold text-indigo-900 leading-tight flex-shrink-0 mr-1">
              Attendance
            </h1>

            <span className="text-gray-300 flex-shrink-0">|</span>

            {/* Academic Year */}
            <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
              <SelectTrigger className="h-7 w-[90px] sm:w-[110px] bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 transition-all rounded-full text-[10px] sm:text-xs flex-shrink-0 [&>svg]:hidden">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {academicYears?.map((year) => {
                  const isCurrent = year.id === currentAcademicYearId;
                  const today = new Date();
                  const yearEnd = new Date(year.endDate);
                  const hasEnded = today > yearEnd;
                  let label = '';
                  if (isCurrent) label = ' (Current)';
                  else if (year.isLocked) label = ' (Locked)';
                  else if (!hasEnded) label = ' (Upcoming)';
                  return (
                    <SelectItem key={year.id} value={year.id} className="rounded-lg text-sm">
                      {year.name}{label}
                    </SelectItem>
                  );
                }) || []}
              </SelectContent>
            </Select>

            {/* Report Type */}
            <Select value={reportType} onValueChange={(value: ReportType) => setReportType(value)}>
              <SelectTrigger className="h-7 w-[80px] sm:w-[100px] bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 transition-all rounded-full text-[10px] sm:text-xs flex-shrink-0 [&>svg]:hidden">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="class" className="rounded-lg text-sm">Class</SelectItem>
                <SelectItem value="pupil" className="rounded-lg text-sm">Pupil</SelectItem>
                {trendPeriod === "daily" && (
                  <SelectItem value="school" className="rounded-lg text-sm">School</SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* Quick Range */}
            <Select defaultValue="day" onValueChange={(value) => setQuickDateRange(value as "day" | "week" | "month" | "term" | "year")}>
              <SelectTrigger className="h-7 w-[75px] sm:w-[90px] bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 transition-all rounded-full text-[10px] sm:text-xs flex-shrink-0 [&>svg]:hidden">
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse flex-shrink-0" />
                  <SelectValue placeholder="Range" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="day" className="rounded-lg text-sm">Today</SelectItem>
                <SelectItem value="week" className="rounded-lg text-sm">Week</SelectItem>
                <SelectItem value="month" className="rounded-lg text-sm">Month</SelectItem>
                <SelectItem value="term" className="rounded-lg text-sm">Term</SelectItem>
                <SelectItem value="year" className="rounded-lg text-sm">Year</SelectItem>
              </SelectContent>
            </Select>

            {/* Period Navigator */}
            {startDate && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => {
                    if (!startDate) return;
                    try {
                      const currentDate = parseISO(startDate);
                      if (isNaN(currentDate.getTime())) return;
                      let newStartDate: Date;
                      let newEndDate: Date;
                      switch (trendPeriod) {
                        case "daily":
                          newStartDate = new Date(currentDate);
                          newStartDate.setDate(currentDate.getDate() - 1);
                          newEndDate = newStartDate;
                          break;
                        case "weekly":
                          const cwS = startOfWeek(currentDate, { weekStartsOn: 1 });
                          const pvS = new Date(cwS);
                          pvS.setDate(cwS.getDate() - 7);
                          newStartDate = pvS;
                          newEndDate = endOfWeek(pvS, { weekStartsOn: 1 });
                          break;
                        case "monthly":
                          const cm = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                          const pm = new Date(cm);
                          pm.setMonth(cm.getMonth() - 1);
                          newStartDate = startOfMonth(pm);
                          newEndDate = endOfMonth(pm);
                          break;
                        case "termly":
                          if (selectedAcademicYear) {
                            const ct = selectedAcademicYear.terms.find(t => {
                              const ts = parseISO(t.startDate);
                              const te = parseISO(t.endDate);
                              return currentDate >= ts && currentDate <= te;
                            });
                            if (ct) {
                              const ci = selectedAcademicYear.terms.findIndex(t => t.id === ct.id);
                              const pt = selectedAcademicYear.terms[ci - 1];
                              if (pt) { setSelectedTermId(pt.id); newStartDate = parseISO(pt.startDate); newEndDate = parseISO(pt.endDate); }
                              else return;
                            } else return;
                          } else return;
                          break;
                        default: return;
                      }
                      setStartDate(format(newStartDate, "yyyy-MM-dd"));
                      setEndDate(format(newEndDate, "yyyy-MM-dd"));
                    } catch (e) { console.warn(e); }
                  }}
                  className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/80 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-600"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>

                <button
                  onClick={() => {
                    const today = new Date();
                    let newStartDate: Date;
                    let newEndDate: Date;
                    switch (trendPeriod) {
                      case "daily": newStartDate = today; newEndDate = today; break;
                      case "weekly":
                        newStartDate = startOfWeek(today, { weekStartsOn: 1 });
                        newEndDate = endOfWeek(today, { weekStartsOn: 1 });
                        break;
                      case "monthly":
                        newStartDate = startOfMonth(today);
                        newEndDate = endOfMonth(today);
                        break;
                      case "termly":
                        if (selectedAcademicYear) {
                          const ct = selectedAcademicYear.terms.find(t => {
                            const ts = parseISO(t.startDate);
                            const te = parseISO(t.endDate);
                            return today >= ts && today <= te;
                          });
                          if (ct) { setSelectedTermId(ct.id); newStartDate = parseISO(ct.startDate); newEndDate = parseISO(ct.endDate); }
                          else return;
                        } else return;
                        break;
                      default: return;
                    }
                    setStartDate(format(newStartDate, "yyyy-MM-dd"));
                    setEndDate(format(newEndDate, "yyyy-MM-dd"));
                  }}
                  className="h-6 sm:h-7 px-2 rounded-full bg-white/80 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-[9px] sm:text-[10px] font-medium text-gray-700 whitespace-nowrap"
                >
                  {(() => {
                    if (!startDate) return "Now";
                    try {
                      const d = parseISO(startDate);
                      const today = new Date();
                      switch (trendPeriod) {
                        case "daily":
                          if (format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) return "Today";
                          const yest = new Date(today); yest.setDate(today.getDate() - 1);
                          if (format(d, "yyyy-MM-dd") === format(yest, "yyyy-MM-dd")) return "Yesterday";
                          return format(d, "MMM dd");
                        case "weekly":
                          const cws = startOfWeek(d, { weekStartsOn: 1 });
                          const tws = startOfWeek(today, { weekStartsOn: 1 });
                          if (format(cws, "yyyy-MM-dd") === format(tws, "yyyy-MM-dd")) return "This Week";
                          return `Wk ${format(cws, "MMM dd")}`;
                        case "monthly":
                          if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) return "This Month";
                          return format(d, "MMM yyyy");
                        case "termly":
                          if (selectedAcademicYear) {
                            const vt = selectedAcademicYear?.terms.find(t => d >= parseISO(t.startDate) && d <= parseISO(t.endDate));
                            return vt?.name || "Term";
                          }
                          return "Term";
                        default: return "Period";
                      }
                    } catch { return "Now"; }
                  })()}
                </button>

                <button
                  onClick={() => {
                    if (!startDate) return;
                    try {
                      const currentDate = parseISO(startDate);
                      if (isNaN(currentDate.getTime())) return;
                      let newStartDate: Date;
                      let newEndDate: Date;
                      switch (trendPeriod) {
                        case "daily":
                          newStartDate = new Date(currentDate);
                          newStartDate.setDate(currentDate.getDate() + 1);
                          newEndDate = newStartDate;
                          break;
                        case "weekly":
                          const cwS = startOfWeek(currentDate, { weekStartsOn: 1 });
                          const nwS = new Date(cwS);
                          nwS.setDate(cwS.getDate() + 7);
                          newStartDate = nwS;
                          newEndDate = endOfWeek(nwS, { weekStartsOn: 1 });
                          break;
                        case "monthly":
                          const cm = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                          const nm = new Date(cm);
                          nm.setMonth(cm.getMonth() + 1);
                          newStartDate = startOfMonth(nm);
                          newEndDate = endOfMonth(nm);
                          break;
                        case "termly":
                          if (selectedAcademicYear) {
                            const ct = selectedAcademicYear.terms.find(t => {
                              const ts = parseISO(t.startDate);
                              const te = parseISO(t.endDate);
                              return currentDate >= ts && currentDate <= te;
                            });
                            if (ct) {
                              const ci = selectedAcademicYear.terms.findIndex(t => t.id === ct.id);
                              const nt = selectedAcademicYear.terms[ci + 1];
                              if (nt) { setSelectedTermId(nt.id); newStartDate = parseISO(nt.startDate); newEndDate = parseISO(nt.endDate); }
                              else return;
                            } else return;
                          } else return;
                          break;
                        default: return;
                      }
                      setStartDate(format(newStartDate, "yyyy-MM-dd"));
                      setEndDate(format(newEndDate, "yyyy-MM-dd"));
                    } catch (e) { console.warn(e); }
                  }}
                  className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/80 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-600"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Period Selector (day / week / month / term) */}
            <div className="flex-shrink-0">
              {trendPeriod === "daily" ? (
                <Select value={startDate || ''} onValueChange={(v) => { if (v) { setStartDate(v); setEndDate(v); } }}>
                  <SelectTrigger className="h-7 w-[110px] sm:w-[140px] bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 transition-all rounded-full text-[10px] sm:text-xs [&>svg]:hidden">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(() => {
                      const days = [];
                      const today = new Date();
                      for (let i = -30; i <= 7; i++) {
                        const date = new Date(today); date.setDate(today.getDate() + i);
                        const value = format(date, "yyyy-MM-dd");
                        const label = format(date, "EEE, MMM dd");
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        days.push(<SelectItem key={value} value={value} className="rounded-lg text-sm"><span className={isWeekend ? "text-gray-500" : ""}>{label}</span></SelectItem>);
                      }
                      return days;
                    })()}
                  </SelectContent>
                </Select>
              ) : trendPeriod === "weekly" ? (
                <Select value={startDate && endDate ? `${startDate}_${endDate}` : ''} onValueChange={(v) => { if (v) { const [s, e] = v.split('_'); setStartDate(s); setEndDate(e); } }}>
                  <SelectTrigger className="h-7 w-[110px] sm:w-[140px] bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 transition-all rounded-full text-[10px] sm:text-xs [&>svg]:hidden">
                    <SelectValue placeholder="Select week" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(() => {
                      const weeks = [];
                      const today = new Date();
                      for (let i = -8; i <= 4; i++) {
                        const weekStart = startOfWeek(subDays(today, i * 7), { weekStartsOn: 1 });
                        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                        const value = `${format(weekStart, "yyyy-MM-dd")}_${format(weekEnd, "yyyy-MM-dd")}`;
                        weeks.push(<SelectItem key={value} value={value} className="rounded-lg text-sm">{format(weekStart, "MMM dd")} – {format(weekEnd, "MMM dd")}</SelectItem>);
                      }
                      return weeks;
                    })()}
                  </SelectContent>
                </Select>
              ) : trendPeriod === "monthly" ? (
                <Select value={`${startDate?.slice(0, 7) || ''}`} onValueChange={(v) => { if (v) { const [y, m] = v.split('-'); const ms = new Date(parseInt(y), parseInt(m) - 1, 1); const me = new Date(parseInt(y), parseInt(m), 0); setStartDate(format(ms, "yyyy-MM-dd")); setEndDate(format(me, "yyyy-MM-dd")); } }}>
                  <SelectTrigger className="h-7 w-[100px] sm:w-[120px] bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 transition-all rounded-full text-[10px] sm:text-xs [&>svg]:hidden">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(() => { const months = []; const today = new Date(); for (let i = -12; i <= 3; i++) { const date = new Date(today.getFullYear(), today.getMonth() + i, 1); months.push(<SelectItem key={format(date, "yyyy-MM")} value={format(date, "yyyy-MM")} className="rounded-lg text-sm">{format(date, "MMM yyyy")}</SelectItem>); } return months; })()}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                  <SelectTrigger className="h-7 w-[100px] sm:w-[120px] bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 transition-all rounded-full text-[10px] sm:text-xs [&>svg]:hidden">
                    <SelectValue placeholder="Term" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="_all_" className="rounded-lg text-sm">All terms</SelectItem>
                    {academicYears?.map((academicYear) => (
                      <React.Fragment key={academicYear.id}>
                        <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50">{academicYear.name}</div>
                        {academicYear.terms?.map((term) => (
                          <SelectItem key={term.id} value={term.id} className="rounded-lg text-sm">{term.name}</SelectItem>
                        ))}
                      </React.Fragment>
                    )) || []}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Class Selector */}
            {!(trendPeriod === "daily" && reportType === "school") && (
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-7 w-[80px] sm:w-[110px] bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 transition-all rounded-full text-[10px] sm:text-xs flex-shrink-0 [&>svg]:hidden">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="_all_" className="rounded-lg text-sm">All Classes</SelectItem>
                  {allClasses?.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id} className="rounded-lg text-sm">{cls.code}</SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            )}

            {/* Pupil Selector */}
            {reportType === "pupil" && (
              <Select value={selectedPupilId} onValueChange={setSelectedPupilId}>
                <SelectTrigger className="h-7 w-[120px] sm:w-[150px] bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 transition-all rounded-full text-[10px] sm:text-xs flex-shrink-0 [&>svg]:hidden">
                  <SelectValue placeholder="Pupil" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {allPupils
                    ?.filter(p => {
                      if (selectedClassId && selectedClassId !== "_all_" && p.classId !== selectedClassId) return false;
                      if (startDate && endDate) return wasPupilActiveInDateRange(p, startDate, endDate);
                      return true;
                    })
                    ?.sort((a, b) => {
                      const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
                      const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
                      return nameA.localeCompare(nameB);
                    })
                    ?.map((pupil) => (
                      <SelectItem key={pupil.id} value={pupil.id} className="rounded-lg text-sm">
                        {pupil.lastName} {pupil.firstName}
                      </SelectItem>
                    )) || []}
                </SelectContent>
              </Select>
            )}

            {/* Print Button */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/80 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex-shrink-0 text-blue-600"
              title="Print PDF"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>

          </div>

          {/* Inline alerts */}
          {(dateRangeValidation.warning || !selectedAcademicYear) && (
            <div className="mt-2 flex flex-col gap-1">
              {dateRangeValidation.warning && (
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-lg px-2.5 py-1">
                  <Info className="h-3 w-3 flex-shrink-0" />
                  <span>{dateRangeValidation.warning}</span>
                </div>
              )}
              {!selectedAcademicYear && (
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-yellow-700 bg-yellow-50/80 border border-yellow-200 rounded-lg px-2.5 py-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span>Select an academic year for accurate analysis.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      <div className="max-w-7xl mx-auto px-2 sm:px-6 pt-4 sm:pt-6 pb-12">
        <div className="space-y-4 sm:space-y-6">

        {/* Analysis Results */}
        <Tabs defaultValue="trends" className="space-y-4">
          {/* Hide TabsList since only Trend Analysis is implemented */}

          <TabsContent value="trends">
            <Card>
              {reportType !== "school" && (
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                    <CardTitle>
                      {reportType === "class" && selectedClassId && selectedClassId !== "_all_"
                        ? `Class Attendance Trends${classPupilTrendData.length > 0 && classPupilTrendData[0].periods.length > 0
                          ? ` - ${classPupilTrendData[0].periods.map(p => p.period).join(", ")}`
                          : ""}`
                        : reportType === "class"
                          ? "Class Attendance Trends"
                          : "Pupil Attendance Trends"
                      }
                    </CardTitle>
                  </div>
                </CardHeader>
              )}
              <CardContent className="p-4 sm:p-6">
                {attendanceLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    {reportType === "school" && trendPeriod === "daily" ? (
                      // School view - show all classes with expandable attendance details
                      <div className="space-y-4">


                        {/* School Attendance Table - Mobile Scrollable */}
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs sm:text-sm">Class</TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-xs sm:text-sm"
                                  onClick={() => toggleExpandAllStatus('present')}
                                >
                                  <div className="flex items-center gap-1">
                                    Present
                                    {expandAllStatus === 'present' && <span className="text-xs">↓</span>}
                                  </div>
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs sm:text-sm"
                                  onClick={() => toggleExpandAllStatus('absent')}
                                >
                                  <div className="flex items-center gap-1">
                                    Absent
                                    {expandAllStatus === 'absent' && <span className="text-xs">↓</span>}
                                  </div>
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors text-xs sm:text-sm"
                                  onClick={() => toggleExpandAllStatus('late')}
                                >
                                  <div className="flex items-center gap-1">
                                    Late
                                    {expandAllStatus === 'late' && <span className="text-xs">↓</span>}
                                  </div>
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-xs sm:text-sm"
                                  onClick={() => toggleExpandAllStatus('excused')}
                                >
                                  <div className="flex items-center gap-1">
                                    Excused
                                    {expandAllStatus === 'excused' && <span className="text-xs">↓</span>}
                                  </div>
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-xs sm:text-sm"
                                  onClick={() => toggleExpandAllStatus('delayed')}
                                >
                                  <div className="flex items-center gap-1">
                                    Delayed
                                    {expandAllStatus === 'delayed' && <span className="text-xs">↓</span>}
                                  </div>
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors text-xs sm:text-sm"
                                  onClick={() => toggleExpandAllStatus('notRecorded')}
                                >
                                  <div className="flex items-center gap-1">
                                    Not Recorded
                                    {expandAllStatus === 'notRecorded' && <span className="text-xs">↓</span>}
                                  </div>
                                </TableHead>
                                <TableHead className="text-xs sm:text-sm">Total Pupils</TableHead>
                                <TableHead className="text-xs sm:text-sm">Attendance Rate</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {schoolAttendanceData.map((classData) => {
                                const rows = [];

                                // Main class row
                                rows.push(
                                  <TableRow key={classData.classId} className="border-b border-gray-200 dark:border-gray-700">
                                    <TableCell className="font-medium p-2 sm:p-4">
                                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                                        {classData.classCode}
                                      </div>
                                    </TableCell>
                                    <TableCell className="p-2 sm:p-4">
                                      <button
                                        onClick={() => toggleClassStatusExpansion(classData.classId, 'present')}
                                        className="flex items-center gap-1 sm:gap-2 hover:bg-green-50 dark:hover:bg-green-900/20 p-1 rounded transition-colors"
                                      >
                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 text-xs sm:text-sm">{classData.present}</Badge>
                                        {expandedStatuses.has(`${classData.classId}-present`) && classData.pupils.present.length > 0 && (
                                          <span className="text-xs text-green-600">↓</span>
                                        )}
                                      </button>
                                    </TableCell>
                                    <TableCell>
                                      <button
                                        onClick={() => toggleClassStatusExpansion(classData.classId, 'absent')}
                                        className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded transition-colors"
                                      >
                                        <Badge className="bg-red-100 text-red-800 hover:bg-red-200">{classData.absent}</Badge>
                                        {expandedStatuses.has(`${classData.classId}-absent`) && classData.pupils.absent.length > 0 && (
                                          <span className="text-xs text-red-600">↓</span>
                                        )}
                                      </button>
                                    </TableCell>
                                    <TableCell>
                                      <button
                                        onClick={() => toggleClassStatusExpansion(classData.classId, 'late')}
                                        className="flex items-center gap-2 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 p-1 rounded transition-colors"
                                      >
                                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">{classData.late}</Badge>
                                        {expandedStatuses.has(`${classData.classId}-late`) && classData.pupils.late.length > 0 && (
                                          <span className="text-xs text-yellow-600">↓</span>
                                        )}
                                      </button>
                                    </TableCell>
                                    <TableCell>
                                      <button
                                        onClick={() => toggleClassStatusExpansion(classData.classId, 'excused')}
                                        className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-1 rounded transition-colors"
                                      >
                                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">{classData.excused}</Badge>
                                        {expandedStatuses.has(`${classData.classId}-excused`) && classData.pupils.excused.length > 0 && (
                                          <span className="text-xs text-blue-600">↓</span>
                                        )}
                                      </button>
                                    </TableCell>
                                    <TableCell>
                                      <button
                                        onClick={() => toggleClassStatusExpansion(classData.classId, 'delayed')}
                                        className="flex items-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 p-1 rounded transition-colors"
                                      >
                                        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">{classData.delayed}</Badge>
                                        {expandedStatuses.has(`${classData.classId}-delayed`) && classData.pupils.delayed.length > 0 && (
                                          <span className="text-xs text-purple-600">↓</span>
                                        )}
                                      </button>
                                    </TableCell>
                                    <TableCell>
                                      <button
                                        onClick={() => toggleClassStatusExpansion(classData.classId, 'notRecorded')}
                                        className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-900/20 p-1 rounded transition-colors"
                                      >
                                        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">{classData.notRecorded}</Badge>
                                        {expandedStatuses.has(`${classData.classId}-notRecorded`) && classData.pupils.notRecorded.length > 0 && (
                                          <span className="text-xs text-gray-600">↓</span>
                                        )}
                                      </button>
                                    </TableCell>
                                    <TableCell className="font-medium">{classData.totalPupils}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{classData.attendanceRate.toFixed(1)}%</span>
                                        <div className="w-16 bg-gray-200 rounded-full h-2">
                                          <div
                                            className={`h-2 rounded-full ${classData.attendanceRate >= 95 ? 'bg-green-500' :
                                              classData.attendanceRate >= 85 ? 'bg-yellow-500' :
                                                'bg-red-500'
                                              }`}
                                            style={{ width: `${Math.min(classData.attendanceRate, 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );

                                // Expanded pupil rows for each status
                                ['present', 'absent', 'late', 'excused', 'delayed', 'notRecorded'].forEach(status => {
                                  if (expandedStatuses.has(`${classData.classId}-${status}`)) {
                                    const pupils = classData.pupils[status as keyof typeof classData.pupils];
                                    if (pupils.length > 0) {
                                      rows.push(
                                        <TableRow key={`${classData.classId}-${status}-header`} className="bg-gray-50 dark:bg-gray-800">
                                          <TableCell colSpan={10} className="py-2">
                                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                              {status === 'notRecorded' ? 'Not Recorded' : status.charAt(0).toUpperCase() + status.slice(1)} Pupils in {classData.className} ({pupils.length})
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );

                                      pupils.forEach((pupil, index) => {
                                        // Removed pupil period stats calculation
                                        const isRecording = recordingPupils.has(pupil.id);

                                        rows.push(
                                          <TableRow key={`${classData.classId}-${status}-${pupil.id}`} className="bg-gray-25 dark:bg-gray-850">
                                            <TableCell className="pl-8">
                                              <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${status === 'present' ? 'bg-green-500' :
                                                  status === 'absent' ? 'bg-red-500' :
                                                    status === 'late' ? 'bg-yellow-500' :
                                                      status === 'excused' ? 'bg-blue-500' :
                                                        status === 'delayed' ? 'bg-purple-500' :
                                                          'bg-gray-500'
                                                  }`} />
                                                <div>
                                                  <div className="font-medium text-sm">{pupil.name}</div>
                                                  <div className="text-xs text-gray-500 font-mono">{pupil.admissionNumber}</div>
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                              <div className="text-gray-600 dark:text-gray-400">
                                                Status for {startDate ? format(parseISO(startDate), "EEEE, MMM dd, yyyy") : "Selected Date"}
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                              {status === 'notRecorded' ? (
                                                <div className="space-y-2">
                                                  <Button
                                                    size="sm"
                                                    variant={isRecording ? "destructive" : "default"}
                                                    onClick={() => togglePupilRecording(pupil.id)}
                                                    className="text-xs"
                                                  >
                                                    {isRecording ? "Cancel" : "Record"}
                                                  </Button>
                                                  {index + 1} of {pupils.length}
                                                </div>
                                              ) : (
                                                <div className="text-gray-600 dark:text-gray-400">
                                                  {index + 1} of {pupils.length}
                                                </div>
                                              )}
                                            </TableCell>
                                            <TableCell colSpan={5}></TableCell>
                                          </TableRow>
                                        );

                                        // Add inline recording row if pupil is being recorded
                                        if (status === 'notRecorded' && isRecording) {
                                          const currentRecordingData = recordingData[pupil.id] || { status: 'Present', remarks: '' };

                                          rows.push(
                                            <TableRow key={`${classData.classId}-${status}-${pupil.id}-recording`} className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400">
                                              <TableCell colSpan={8} className="p-4">
                                                <div className="space-y-3">
                                                  <div className="flex items-center gap-4">
                                                    <div className="font-medium text-blue-900 dark:text-blue-100">
                                                      Recording attendance for {pupil.name} - {startDate ? format(parseISO(startDate), "EEEE, MMMM dd, yyyy") : "Selected Date"}
                                                    </div>
                                                  </div>

                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                      <Label htmlFor={`status-${pupil.id}`} className="text-sm font-medium">
                                                        Status
                                                      </Label>
                                                      <Select
                                                        value={currentRecordingData.status}
                                                        onValueChange={(value) => updateRecordingData(pupil.id, 'status', value)}
                                                      >
                                                        <SelectTrigger id={`status-${pupil.id}`} className="mt-1">
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          <SelectItem value="Present">Present</SelectItem>
                                                          <SelectItem value="Absent">Absent</SelectItem>
                                                          <SelectItem value="Late">Late</SelectItem>
                                                          <SelectItem value="Excused">Excused</SelectItem>
                                                          <SelectItem value="Delayed">Delayed</SelectItem>
                                                        </SelectContent>
                                                      </Select>
                                                    </div>

                                                    <div>
                                                      <Label htmlFor={`remarks-${pupil.id}`} className="text-sm font-medium">
                                                        Remarks (Optional)
                                                      </Label>
                                                      <Input
                                                        id={`remarks-${pupil.id}`}
                                                        placeholder="Add any remarks..."
                                                        value={currentRecordingData.remarks}
                                                        onChange={(e) => updateRecordingData(pupil.id, 'remarks', e.target.value)}
                                                        className="mt-1"
                                                      />
                                                    </div>
                                                  </div>

                                                  <div className="flex items-center gap-2 pt-2">
                                                    <Button
                                                      size="sm"
                                                      onClick={() => saveAttendanceRecord(pupil.id, classData.classId)}
                                                      className="bg-green-600 hover:bg-green-700 text-white"
                                                    >
                                                      Save Record
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      onClick={() => togglePupilRecording(pupil.id)}
                                                    >
                                                      Cancel
                                                    </Button>
                                                  </div>
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          );
                                        }
                                      });
                                    }
                                  }
                                });

                                return rows;
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Empty State */}
                        {schoolAttendanceData.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <div className="text-gray-400 dark:text-gray-500 mb-2">
                              <Calendar className="w-8 h-8 mx-auto" />
                            </div>
                            <p className="text-lg font-medium">No attendance data found</p>
                            <p className="text-sm">No attendance records found for {startDate ? format(parseISO(startDate), "MMMM dd, yyyy") : "the selected date"}.</p>
                          </div>
                        )}
                      </div>
                    ) : reportType === "school" && trendPeriod !== "daily" ? (
                      // School view message for non-daily periods
                      <div className="text-center py-16">
                        <div className="max-w-md mx-auto">
                          <div className="text-gray-400 dark:text-gray-500 mb-4">
                            <Calendar className="w-12 h-12 mx-auto" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            School View Available in Day Mode Only
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 mb-4">
                            The entire school attendance view is designed for daily analysis. Please switch to "Daily" in the Trend Period dropdown to see the interactive school-wide attendance table.
                          </p>
                          <Button
                            onClick={() => handleTrendPeriodChange("daily")}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Switch to Daily View
                          </Button>
                        </div>
                      </div>
                    ) : reportType === "class" && selectedClassId && selectedClassId !== "_all_" ? (
                      // Class view - show all pupils in a single table
                      <div className="space-y-4">
                        {/* Period Information Summary */}
                        {classPupilTrendData.length > 0 && classPupilTrendData[0].periods.length > 0 && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                              Period Analysis
                            </h4>
                            <div className="space-y-2">
                              {classPupilTrendData[0].periods.map((period, index) => {
                                const start = parseISO(period.date);
                                const periodEnd = (() => {
                                  switch (trendPeriod) {
                                    case "daily":
                                      return start;
                                    case "weekly":
                                      return endOfWeek(start, { weekStartsOn: 1 });
                                    case "monthly":
                                      return endOfMonth(start);
                                    case "termly":
                                      if (selectedAcademicYear) {
                                        const term = selectedAcademicYear.terms.find(t => t.name === period.period);
                                        return term ? parseISO(term.endDate) : start;
                                      }
                                      return start;
                                    default:
                                      return start;
                                  }
                                })();

                                const totalDays = Math.ceil((periodEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                const schoolDays = period.schoolDays;
                                const excludedDays = totalDays - schoolDays;

                                // Calculate excluded day types
                                const allDays = eachDayOfInterval({ start, end: periodEnd });
                                const weekends = allDays.filter(day => day.getDay() === 0 || day.getDay() === 6).length;
                                const holidays = excludedDays - weekends;

                                return (
                                  <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-6 text-sm">
                                      <div className="font-semibold text-blue-800 dark:text-blue-200 min-w-[120px]">
                                        {period.period}
                                      </div>
                                      <div className="font-medium">
                                        <span className="text-gray-600 dark:text-gray-400">Total Days:</span> <span className="text-gray-900 dark:text-gray-100">{totalDays}</span>
                                      </div>
                                      <div className="font-medium">
                                        <span className="text-gray-600 dark:text-gray-400">School Days:</span> <span className="text-green-700 dark:text-green-400">{schoolDays}</span>
                                      </div>
                                      <div className="font-medium">
                                        <span className="text-gray-600 dark:text-gray-400">Excluded Days:</span> <span className="text-orange-700 dark:text-orange-400">{excludedDays}</span>
                                      </div>
                                      <div className="ml-auto">
                                        {excludedDays > 0 ? (
                                          <details className="group">
                                            <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-1">
                                              <span className="group-open:rotate-90 transition-transform">▶</span>
                                              Details
                                            </summary>
                                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs space-y-1">
                                              {weekends > 0 && (
                                                <div className="text-gray-600 dark:text-gray-300">
                                                  • {Math.floor(weekends / 2)} weekends ({weekends} days)
                                                </div>
                                              )}
                                              {holidays > 0 && (
                                                <div className="text-gray-600 dark:text-gray-300">
                                                  • {holidays} holidays/special days
                                                </div>
                                              )}
                                            </div>
                                          </details>
                                        ) : (
                                          <span className="text-sm text-gray-500">No exclusions</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Pupil Name</TableHead>
                              {/* Only show Period column for year view (multiple periods) */}
                              {classPupilTrendData.length > 0 && classPupilTrendData[0].periods.length > 1 && (
                                <TableHead>Period</TableHead>
                              )}
                              <TableHead>Present</TableHead>
                              <TableHead>Absent</TableHead>
                              <TableHead>Late</TableHead>
                              <TableHead>Excused</TableHead>
                              <TableHead>Delayed</TableHead>
                              <TableHead>Not Recorded</TableHead>
                              <TableHead>Attendance Rate</TableHead>
                              <TableHead>Trend</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {classPupilTrendData.length > 0 ? (
                              classPupilTrendData.flatMap((pupilData, pupilIndex) => {
                                // Calculate totals for this pupil
                                const totalPresent = pupilData.periods.reduce((sum, p) => sum + p.present, 0);
                                const totalAbsent = pupilData.periods.reduce((sum, p) => sum + p.absent, 0);
                                const totalLate = pupilData.periods.reduce((sum, p) => sum + p.late, 0);
                                const totalExcused = pupilData.periods.reduce((sum, p) => sum + p.excused, 0);
                                const totalDelayed = pupilData.periods.reduce((sum, p) => sum + p.delayed, 0);
                                const totalNotRecorded = pupilData.periods.reduce((sum, p) => sum + p.notRecorded, 0);
                                const totalSchoolDays = pupilData.periods.reduce((sum, p) => sum + p.schoolDays, 0);
                                const totalAttendanceRate = totalSchoolDays > 0 ? ((totalPresent + totalLate) / totalSchoolDays) * 100 : 0;

                                // Check if this is a year view (multiple periods)
                                const isYearView = pupilData.periods.length > 1;

                                // Create rows for each period plus a total row
                                const periodRows = pupilData.periods.map((period, periodIndex) => (
                                  <TableRow key={`${pupilData.pupilId}-${periodIndex}`} className={`${isYearView ? "h-10" : ""} ${pupilIndex > 0 && periodIndex === 0 ? "border-t-2 border-gray-200 dark:border-gray-700" : ""}`}>
                                    <TableCell className={isYearView ? "py-1" : ""}>
                                      {periodIndex === 0 ? (
                                        <div className={isYearView ? "space-y-0.5" : ""}>
                                          <button
                                            onClick={() => handlePupilClick(pupilData.pupilId)}
                                            className="font-medium text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:underline transition-colors text-left"
                                          >
                                            {pupilData.pupilName}
                                          </button>
                                          <div className="text-xs text-gray-500 font-mono">{pupilData.admissionNumber}</div>
                                        </div>
                                      ) : isYearView ? (
                                        <div className="h-8"></div>
                                      ) : (
                                        <div className="h-12"></div>
                                      )}
                                    </TableCell>
                                    {/* Only show Period column for year view (multiple periods) */}
                                    {isYearView && (
                                      <TableCell className="py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {period.period}
                                      </TableCell>
                                    )}
                                    <TableCell className={isYearView ? "py-1" : ""}>
                                      <Badge className={`${isYearView ? "text-xs px-2 py-0.5" : ""} bg-green-100 text-green-800`}>{period.present}</Badge>
                                    </TableCell>
                                    <TableCell className={isYearView ? "py-1" : ""}>
                                      <Badge className={`${isYearView ? "text-xs px-2 py-0.5" : ""} bg-red-100 text-red-800`}>{period.absent}</Badge>
                                    </TableCell>
                                    <TableCell className={isYearView ? "py-1" : ""}>
                                      <Badge className={`${isYearView ? "text-xs px-2 py-0.5" : ""} bg-yellow-100 text-yellow-800`}>{period.late}</Badge>
                                    </TableCell>
                                    <TableCell className={isYearView ? "py-1" : ""}>
                                      <Badge className={`${isYearView ? "text-xs px-2 py-0.5" : ""} bg-blue-100 text-blue-800`}>{period.excused}</Badge>
                                    </TableCell>
                                    <TableCell className={isYearView ? "py-1" : ""}>
                                      <Badge className={`${isYearView ? "text-xs px-2 py-0.5" : ""} bg-purple-100 text-purple-800`}>{period.delayed}</Badge>
                                    </TableCell>
                                    <TableCell className={isYearView ? "py-1" : ""}>
                                      <Badge className={`${isYearView ? "text-xs px-2 py-0.5" : ""} bg-gray-100 text-gray-800`}>{period.notRecorded}</Badge>
                                    </TableCell>
                                    <TableCell className={isYearView ? "py-1" : ""}>
                                      <div className="flex items-center">
                                        <span className={`font-medium ${isYearView ? "text-sm" : ""}`}>{period.attendanceRate.toFixed(1)}%</span>
                                        <div className={`ml-2 bg-gray-200 rounded-full ${isYearView ? "w-12 h-1.5" : "w-16 h-2"}`}>
                                          <div
                                            className={`bg-blue-600 rounded-full ${isYearView ? "h-1.5" : "h-2"}`}
                                            style={{ width: `${Math.min(period.attendanceRate, 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className={isYearView ? "py-1" : ""}>{getTrendIcon(period.trend)}</TableCell>
                                  </TableRow>
                                ));

                                // Add total row if there are multiple periods (year view)
                                if (isYearView) {
                                  periodRows.push(
                                    <TableRow key={`${pupilData.pupilId}-total`} className="bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-700 h-10">
                                      <TableCell className="py-1">
                                        <div className="h-8"></div>
                                      </TableCell>
                                      {/* Only show Period column for year view */}
                                      {isYearView && (
                                        <TableCell className="py-1 font-bold text-sm text-blue-900 dark:text-blue-100">
                                          Total
                                        </TableCell>
                                      )}
                                      <TableCell className="py-1">
                                        <Badge className="bg-green-300 text-green-900 font-bold text-xs px-2 py-0.5">{totalPresent}</Badge>
                                      </TableCell>
                                      <TableCell className="py-1">
                                        <Badge className="bg-red-300 text-red-900 font-bold text-xs px-2 py-0.5">{totalAbsent}</Badge>
                                      </TableCell>
                                      <TableCell className="py-1">
                                        <Badge className="bg-yellow-300 text-yellow-900 font-bold text-xs px-2 py-0.5">{totalLate}</Badge>
                                      </TableCell>
                                      <TableCell className="py-1">
                                        <Badge className="bg-blue-300 text-blue-900 font-bold text-xs px-2 py-0.5">{totalExcused}</Badge>
                                      </TableCell>
                                      <TableCell className="py-1">
                                        <Badge className="bg-purple-300 text-purple-900 font-bold text-xs px-2 py-0.5">{totalDelayed}</Badge>
                                      </TableCell>
                                      <TableCell className="py-1">
                                        <Badge className="bg-gray-300 text-gray-900 font-bold text-xs px-2 py-0.5">{totalNotRecorded}</Badge>
                                      </TableCell>
                                      <TableCell className="py-1">
                                        <div className="flex items-center">
                                          <span className="font-bold text-sm text-blue-900 dark:text-blue-100">{totalAttendanceRate.toFixed(1)}%</span>
                                          <div className="ml-2 w-12 bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                                            <div
                                              className="bg-blue-700 dark:bg-blue-400 h-2 rounded-full"
                                              style={{ width: `${Math.min(totalAttendanceRate, 100)}%` }}
                                            />
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-1">
                                        <span className="text-blue-600 dark:text-blue-400 text-sm">—</span>
                                      </TableCell>
                                    </TableRow>
                                  );
                                }

                                return periodRows;
                              })
                            ) : (
                              <TableRow>
                                <TableCell colSpan={classPupilTrendData.length > 0 && classPupilTrendData[0].periods.length > 1 ? 9 : 8} className="text-center py-8 text-muted-foreground">
                                  No pupils found in the selected class or no attendance data available.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      // Individual pupil view or no class selected
                      <div className="space-y-6">
                        {/* Pupil Attendance Summary */}
                        {reportType === "pupil" && pupilTrendData.length > 0 && (
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                                  {pupilTrendData[0]?.pupilName || 'Pupil'} - Attendance Summary
                                </h3>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                  Admission Number: {pupilTrendData[0]?.admissionNumber || 'N/A'}
                                </p>
                                <p className="text-sm text-blue-600 dark:text-blue-400">
                                  Period: {startDate ? format(parseISO(startDate), "MMM dd, yyyy") : "Start Date"} - {endDate ? format(parseISO(endDate), "MMM dd, yyyy") : "End Date"}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                  {(() => {
                                    const totalPresent = pupilTrendData.reduce((sum, day) => sum + day.present, 0);
                                    const totalSchoolDays = pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0);
                                    const overallRate = totalSchoolDays > 0 ? (totalPresent / totalSchoolDays) * 100 : 0;
                                    return overallRate.toFixed(1);
                                  })()}%
                                </div>
                                <div className="text-sm text-blue-700 dark:text-blue-300">Overall Rate</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200 dark:border-green-700">
                                <div className="flex items-center">
                                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Present</span>
                                </div>
                                <div className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">
                                  {pupilTrendData.reduce((sum, day) => sum + day.present, 0)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  out of {pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0)} days
                                </div>
                              </div>

                              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-700">
                                <div className="flex items-center">
                                  <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Absent</span>
                                </div>
                                <div className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">
                                  {pupilTrendData.reduce((sum, day) => sum + day.absent, 0)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0) > 0
                                    ? ((pupilTrendData.reduce((sum, day) => sum + day.absent, 0) / pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0)) * 100).toFixed(1)
                                    : '0'}% of days
                                </div>
                              </div>

                              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                                <div className="flex items-center">
                                  <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Late</span>
                                </div>
                                <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mt-1">
                                  {pupilTrendData.reduce((sum, day) => sum + day.late, 0)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0) > 0
                                    ? ((pupilTrendData.reduce((sum, day) => sum + day.late, 0) / pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0)) * 100).toFixed(1)
                                    : '0'}% of days
                                </div>
                              </div>

                              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                                <div className="flex items-center">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Excused</span>
                                </div>
                                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
                                  {pupilTrendData.reduce((sum, day) => sum + day.excused, 0)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0) > 0
                                    ? ((pupilTrendData.reduce((sum, day) => sum + day.excused, 0) / pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0)) * 100).toFixed(1)
                                    : '0'}% of days
                                </div>
                              </div>

                              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                                <div className="flex items-center">
                                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Delayed</span>
                                </div>
                                <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 mt-1">
                                  {pupilTrendData.reduce((sum, day) => sum + day.delayed, 0)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0) > 0
                                    ? ((pupilTrendData.reduce((sum, day) => sum + day.delayed, 0) / pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0)) * 100).toFixed(1)
                                    : '0'}% of days
                                </div>
                              </div>
                            </div>

                            {/* Attendance Rate Progress Bar */}
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Attendance Progress</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {pupilTrendData.reduce((sum, day) => sum + day.present, 0)} / {pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0)} days
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.min(
                                      pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0) > 0
                                        ? (pupilTrendData.reduce((sum, day) => sum + day.present, 0) / pupilTrendData.reduce((sum, day) => sum + day.schoolDays, 0)) * 100
                                        : 0,
                                      100
                                    )}%`
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Compact Attendance List */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <h4 className="text-base font-medium text-gray-900 dark:text-gray-100">
                              Attendance Records
                            </h4>
                          </div>

                          <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {(reportType === "pupil" ? pupilTrendData : trendData).map((row, index) => {
                              const attendanceStatus = row.present > 0 ? 'present' : row.absent > 0 ? 'absent' : row.late > 0 ? 'late' : row.excused > 0 ? 'excused' : row.delayed > 0 ? 'delayed' : 'unknown';

                              return (
                                <div key={index} className="px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                  <div className="flex items-center justify-between">
                                    {/* Left: Date and Status */}
                                    <div className="flex items-center space-x-3">
                                      <div className={`w-2.5 h-2.5 rounded-full ${attendanceStatus === 'present' ? 'bg-green-500' :
                                        attendanceStatus === 'absent' ? 'bg-red-500' :
                                          attendanceStatus === 'late' ? 'bg-yellow-500' :
                                            attendanceStatus === 'excused' ? 'bg-blue-500' :
                                              attendanceStatus === 'delayed' ? 'bg-purple-500' : 'bg-gray-400'
                                        }`}></div>

                                      <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                          {row.period}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 capitalize leading-tight">
                                          {attendanceStatus === 'unknown' ? 'No record' : attendanceStatus}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right: Attendance Details */}
                                    <div className="flex items-center space-x-4">
                                      {/* Attendance Numbers */}
                                      <div className="flex items-center space-x-3 text-xs">
                                        {row.present > 0 && (
                                          <div className="flex items-center space-x-1">
                                            <span className="text-gray-500 dark:text-gray-400">P:</span>
                                            <span className="font-medium text-green-600 dark:text-green-400">{row.present}</span>
                                          </div>
                                        )}
                                        {row.absent > 0 && (
                                          <div className="flex items-center space-x-1">
                                            <span className="text-gray-500 dark:text-gray-400">A:</span>
                                            <span className="font-medium text-red-600 dark:text-red-400">{row.absent}</span>
                                          </div>
                                        )}
                                        {row.late > 0 && (
                                          <div className="flex items-center space-x-1">
                                            <span className="text-gray-500 dark:text-gray-400">L:</span>
                                            <span className="font-medium text-yellow-600 dark:text-yellow-400">{row.late}</span>
                                          </div>
                                        )}
                                        {row.excused > 0 && (
                                          <div className="flex items-center space-x-1">
                                            <span className="text-gray-500 dark:text-gray-400">E:</span>
                                            <span className="font-medium text-blue-600 dark:text-blue-400">{row.excused}</span>
                                          </div>
                                        )}
                                        {row.delayed > 0 && (
                                          <div className="flex items-center space-x-1">
                                            <span className="text-gray-500 dark:text-gray-400">D:</span>
                                            <span className="font-medium text-purple-600 dark:text-purple-400">{row.delayed}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Attendance Rate */}
                                      <div className="flex items-center space-x-2">
                                        <span className={`text-xs font-medium ${row.attendanceRate >= 95 ? 'text-green-600 dark:text-green-400' :
                                          row.attendanceRate >= 85 ? 'text-yellow-600 dark:text-yellow-400' :
                                            'text-red-600 dark:text-red-400'
                                          }`}>
                                          {row.attendanceRate.toFixed(1)}%
                                        </span>

                                        {/* Mini Progress Bar */}
                                        <div className="w-12 bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                                          <div
                                            className={`h-1 rounded-full ${row.attendanceRate >= 95 ? 'bg-green-500' :
                                              row.attendanceRate >= 85 ? 'bg-yellow-500' :
                                                'bg-red-500'
                                              }`}
                                            style={{ width: `${Math.min(row.attendanceRate, 100)}%` }}
                                          />
                                        </div>

                                        {/* Trend Icon */}
                                        <div className="w-3 flex justify-center">
                                          <div className="scale-75">
                                            {getTrendIcon(row.trend)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Empty State */}
                          {(reportType === "pupil" ? pupilTrendData : trendData).length === 0 && (
                            <div className="px-4 py-8 text-center">
                              <div className="text-gray-400 dark:text-gray-500 mb-2">
                                <Calendar className="w-6 h-6 mx-auto" />
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                No attendance records found for this period.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!attendanceLoading && (
                  (reportType === "class" && selectedClassId && selectedClassId !== "_all_")
                    ? classPupilTrendData.length === 0
                    : (reportType === "pupil" ? pupilTrendData : trendData).length === 0
                ) && (
                    <div className="text-center py-8 text-muted-foreground">
                      No attendance data found for the selected criteria.
                    </div>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          {reportType === "class" && (
            <TabsContent value="pupils">
              <Card>
                <CardHeader>
                  <CardTitle>Individual Pupil Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    Pupil breakdown analysis will be implemented in the next phase.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>Summary Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Summary statistics will be implemented in the next phase.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>
      {/* Modals and Overlays */}
      <AttendancePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        onConfirm={(config) => {
          setPrintConfig(config);
          // Let the specific PDF Component call setPrintConfig(null) and setIsPrintModalOpen(false) when done
        }}
        onExportCSV={reportType === "pupil" ? exportPupilTrendData : exportTrendData}
        classes={allClasses}
        academicYears={academicYears}
        selectedAcademicYearId={selectedAcademicYearId}
        selectedTermId={selectedTermId}
        defaultClassId={selectedClassId}
        defaultStartDate={startDate}
        defaultEndDate={endDate}
        excludedDays={excludedDays}
      />

      {/* Hidden Printable Compilers */}
      {printConfig && printConfig.reportType === "summary" && (
        <PrintableAttendanceSummary
            config={printConfig}
            pupils={allPupils.filter(p => p.classId === printConfig.classId)}
            records={attendanceRecords} // The hook matches the page state, but wait we need records specifically for the print range!
            targetClass={allClasses.find(c => c.id === printConfig.classId)}
            schoolSettings={schoolSettings ?? null}
            onClose={() => {
                setPrintConfig(null);
                setIsPrintModalOpen(false);
            }}
        />
      )}
      
      {printConfig && printConfig.reportType === "detailed" && (
        <PrintableAttendanceDetailed
            config={printConfig}
            pupils={allPupils.filter(p => p.classId === printConfig.classId)}
            records={attendanceRecords}
            targetClass={allClasses.find(c => c.id === printConfig.classId)}
            schoolSettings={schoolSettings ?? null}
            onClose={() => {
                setPrintConfig(null);
                setIsPrintModalOpen(false);
            }}
        />
      )}
    </div>
  );
} 
