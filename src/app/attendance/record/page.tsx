"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";
import { ClassSelector } from "@/components/common/class-selector";
import { GlassPageSearchInput, GlassPageTopBar } from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { Class, Pupil, AttendanceRecord, AttendanceStatus } from "@/types";
import { useClasses } from "@/lib/hooks/use-classes";
import { usePupilsWithoutPhotos } from "@/lib/hooks/use-pupils";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { getEffectiveTermForDataDisplay } from "@/lib/utils/term-status-utils";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";
import { useExcludedDays } from "@/lib/hooks/use-excluded-days";
import {
  useAttendanceByDateRange,
  useBulkCreateAttendanceRecords,
  useBulkUpdateAttendanceRecords,
  useUpdateAttendanceRecord
} from "@/lib/hooks/use-attendance";
import { AttendanceService, getAttendanceRecordId } from "@/lib/services/attendance.service";
import {
  queueAttendanceSummaryPublication,
  flushAttendanceSummarySession,
} from "@/lib/services/attendance-summary-outbox";
import { useRecordSignatures } from "@/lib/hooks/use-digital-signature";
import { DigitalSignatureDisplay } from "@/components/common/digital-signature-display";
import { AttendanceSignatureDisplay } from "@/components/attendance/AttendanceSignatureDisplay";
import { Loader2, Save, ArrowLeft, Clock, Users, Calendar, AlertTriangle, CheckCircle, Search } from "lucide-react";
import { ATTENDANCE_STATUSES } from "@/lib/constants";
import { format } from "date-fns";
import {
  canRecordAttendance,
  getCurrentTermForDate,
  getAttendanceRecordingStatus
} from "@/lib/utils/attendance-academic-utils";
import { wasPupilActiveOnDate } from "@/lib/utils/pupil-status-utils";
import { useAuth } from "@/lib/contexts/auth-context";
import { getAttendanceCacheScope } from "@/lib/cache/attendance-summary-cache";
import { auth } from "@/lib/firebase";

interface PupilAttendanceEntry {
  status: AttendanceStatus | "";
  remarks: string;
}

function buildSessionRecords(
  date: string,
  classId: string,
  entries: Record<string, PupilAttendanceEntry>,
  existing: AttendanceRecord[],
  classInfo?: Class,
): AttendanceRecord[] {
  const existingForClass = existing.filter(record =>
    record.classId === classId && format(new Date(record.date), 'yyyy-MM-dd') === date
  );
  const byPupil = new Map(existingForClass.map(record => [record.pupilId, record]));

  Object.entries(entries).forEach(([pupilId, entry]) => {
    if (!entry?.status) return;
    const previous = byPupil.get(pupilId);
    byPupil.set(pupilId, {
      ...(previous || {}),
      id: previous?.id || getAttendanceRecordId(date, classId, pupilId),
      date,
      classId,
      className: classInfo?.name || previous?.className || '',
      classCode: classInfo?.code || previous?.classCode || '',
      pupilId,
      status: entry.status,
      remarks: entry.remarks || '',
      recordedBy: previous?.recordedBy || 'System Admin',
      recordedAt: previous?.recordedAt || new Date().toISOString(),
    } as AttendanceRecord);
  });

  return Array.from(byPupil.values());
}

function getConfirmedSessionRecords(
  date: string,
  classId: string,
  existing: AttendanceRecord[],
  classInfo?: Class,
): AttendanceRecord[] {
  const records = existing
    .filter(record =>
      record.classId === classId &&
      format(new Date(record.date), 'yyyy-MM-dd') === date
    )
    .map(record => ({
      ...record,
      className: classInfo?.name || record.className || '',
      classCode: classInfo?.code || record.classCode || '',
    }));
  return Array.from(new Map(records.map(record => [record.pupilId, record])).values());
}

// ─── Memoized pupil row (desktop) ────────────────────────────────────────────
// React.memo means only THIS row re-renders when its own entry changes.
// The other 99 rows stay frozen, so selecting a status is always instant.
const DesktopPupilRow = React.memo(function DesktopPupilRow({
  pupil,
  index,
  entry,
  onChange,
}: {
  pupil: Pupil;
  index: number;
  entry: PupilAttendanceEntry;
  onChange: (pupilId: string, field: "status" | "remarks", value: string) => void;
}) {
  return (
    <TableRow className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200 border-b border-gray-100 dark:border-gray-800">
      <TableCell className="font-semibold text-gray-600 dark:text-gray-400">{index + 1}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {pupil.lastName} {pupil.firstName}
          </div>
          {pupil.otherNames && (
            <div className="text-sm text-gray-500 dark:text-gray-400">{pupil.otherNames}</div>
          )}
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm text-gray-700 dark:text-gray-300">{pupil.admissionNumber}</TableCell>
      <TableCell>
        <Select
          value={entry.status}
          onValueChange={(value) => onChange(pupil.id, "status", value)}
        >
          <SelectTrigger className="h-10 border-2 hover:border-emerald-300 focus:border-emerald-500 rounded-xl transition-colors duration-200">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl shadow-lg">
            {ATTENDANCE_STATUSES.map((status) => (
              <SelectItem key={status} value={status} className="rounded-lg">
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={entry.remarks}
          onChange={(e) => onChange(pupil.id, "remarks", e.target.value)}
          placeholder="Optional remarks"
          className="border-2 hover:border-emerald-300 focus:border-emerald-500 rounded-xl transition-colors duration-200"
        />
      </TableCell>
    </TableRow>
  );
});

// ─── Memoized pupil card (mobile) ────────────────────────────────────────────
const MobilePupilCard = React.memo(function MobilePupilCard({
  pupil,
  index,
  entry,
  onChange,
}: {
  pupil: Pupil;
  index: number;
  entry: PupilAttendanceEntry;
  onChange: (pupilId: string, field: "status" | "remarks", value: string) => void;
}) {
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700 space-y-3">
      <div className="flex items-center space-x-2">
        <span className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
            {pupil.lastName} {pupil.firstName} {pupil.otherNames && `(${pupil.otherNames})`}
          </h4>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <div>
          <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Status</Label>
          <Select
            value={entry.status}
            onValueChange={(value) => onChange(pupil.id, "status", value)}
          >
            <SelectTrigger className="h-10 border border-gray-300 dark:border-gray-600 hover:border-emerald-400 focus:border-emerald-500 rounded-lg transition-colors duration-200 text-sm">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent className="rounded-lg shadow-lg max-h-[30vh] overflow-y-auto">
              {ATTENDANCE_STATUSES.map((status) => (
                <SelectItem key={status} value={status} className="rounded text-sm py-2">
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Remarks</Label>
          <Input
            value={entry.remarks}
            onChange={(e) => onChange(pupil.id, "remarks", e.target.value)}
            placeholder="Optional remarks..."
            className="border border-gray-300 dark:border-gray-600 hover:border-emerald-400 focus:border-emerald-500 rounded-lg transition-colors duration-200 text-sm h-9"
          />
        </div>
      </div>
    </div>
  );
});

export default function RecordAttendancePage() {
  const { user, isAuthenticated } = useAuth();
  const attendanceCacheScope = isAuthenticated
    ? getAttendanceCacheScope(user?.id, user?.role)
    : '';
  const { toast } = useToast();

  // Firebase hooks
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  // 🚀 PERFORMANCE: Use optimized hook that excludes photos
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupilsWithoutPhotos();
  // Fetch all academic years and derive the correct one via global two-pass scan
  const { data: allAcademicYears = [], isLoading: academicYearLoading } = useAcademicYears();
  const _effectiveTerm = React.useMemo(
    () => getEffectiveTermForDataDisplay(allAcademicYears),
    [allAcademicYears]
  );
  // This is the academically correct year (cross-year, date-aware, no isActive bias)
  const activeAcademicYear = _effectiveTerm.academicYear ?? undefined;
  const { data: excludedDays = [], isLoading: excludedDaysLoading } = useExcludedDays();

  // Date setup - get today's date
  const today = React.useMemo(() => new Date(), []);
  const formattedCurrentDate = React.useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const displayDate = React.useMemo(() => format(today, "PPP"), [today]);

  // Check if attendance can be recorded for today
  const attendanceStatus = React.useMemo(() => {
    return canRecordAttendance(today, activeAcademicYear || null, excludedDays);
  }, [today, activeAcademicYear, excludedDays]);

  // Get current term: prefer term whose date range contains today;
  // fall back to the globally effective term (covers inter-term recess)
  const currentTerm = React.useMemo(() => {
    const termForDate = getCurrentTermForDate(today, activeAcademicYear || null);
    if (termForDate) return termForDate;
    // During recess, use the effective term so saved records have the right termId
    return _effectiveTerm.term ?? null;
  }, [today, activeAcademicYear, _effectiveTerm]);

  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();

  // Get status message
  const statusMessage = React.useMemo(() => {
    return getAttendanceRecordingStatus(today, activeAcademicYear || null, excludedDays);
  }, [today, activeAcademicYear, excludedDays]);

  // State
  const searchParams = useSearchParams();
  const [selectedClassId, setSelectedClassId] = React.useState<string>("");
  const [attendanceData, setAttendanceData] = React.useState<Record<string, PupilAttendanceEntry>>({});
  const [searchQuery, setSearchQuery] = React.useState("");
  const [currentTime, setCurrentTime] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);

  // Pre-select class from URL param (e.g. from dashboard bar click)
  React.useEffect(() => {
    const classIdParam = searchParams?.get('classId');
    if (classIdParam && allClasses.length > 0) {
      const found = allClasses.find(c => c.id === classIdParam);
      if (found) setSelectedClassId(classIdParam);
    }
    // Only run when classes load and param is present
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClasses.length]);

  // Auto-save: track in-flight count WITHOUT React state to avoid re-renders
  const autoSavePendingCount = React.useRef(0);
  const autoSaveIndicatorRef = React.useRef<HTMLSpanElement>(null);
  const autoSaveQueue = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const autoSaveFailedPupilsRef = React.useRef<Set<string>>(new Set());
  const autoSaveGenerationRef = React.useRef(0);
  const manualSaveInProgressRef = React.useRef(false);
  const summaryPublishPendingRef = React.useRef(false);

  // Helper: update the auto-save indicator using direct DOM mutation — zero React re-renders
  const updateAutoSaveIndicator = React.useCallback(() => {
    const el = autoSaveIndicatorRef.current;
    if (!el) return;
    if (
      autoSavePendingCount.current > 0 ||
      autoSaveQueue.current.size > 0 ||
      summaryPublishPendingRef.current
    ) {
      el.textContent = summaryPublishPendingRef.current ? '⟳ Syncing…' : '⟳ Saving…';
      el.className = 'attendance-autosave-indicator saving';
      el.style.display = 'inline-flex';
    } else {
      el.textContent = '✓ Auto-saved';
      el.className = 'attendance-autosave-indicator saved';
      el.style.display = 'inline-flex';
    }
  }, []);

  // Refs to always-current values for use inside async callbacks (avoids stale closures)
  const attendanceDataRef = React.useRef<Record<string, PupilAttendanceEntry>>({});
  const existingAttendanceRecordsRef = React.useRef<AttendanceRecord[]>([]);
  const selectedClassIdRef = React.useRef<string>('');
  const allClassesRef = React.useRef(allClasses);
  const allPupilsRef = React.useRef(allPupils);
  const activeAcademicYearRef = React.useRef(activeAcademicYear);
  const currentTermRef = React.useRef(currentTerm);

  // Get existing attendance records for today
  const { data: existingAttendanceRecords = [] } = useAttendanceByDateRange(
    formattedCurrentDate,
    formattedCurrentDate
  );

  // Mutations
  const bulkCreateMutation = useBulkCreateAttendanceRecords();
  const bulkUpdateMutation = useBulkUpdateAttendanceRecords();
  const updateAttendanceMutation = useUpdateAttendanceRecord();

  // Memoized pupils in selected class
  const pupilsInClass = React.useMemo(() => {
    if (!selectedClassId) return [];

    let filtered = allPupils.filter(p => p.classId === selectedClassId && wasPupilActiveOnDate(p, formattedCurrentDate));

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.firstName?.toLowerCase().includes(query) ||
        p.lastName?.toLowerCase().includes(query) ||
        p.otherNames?.toLowerCase().includes(query) ||
        p.admissionNumber?.toLowerCase().includes(query)
      );
    }

    // Sort by Surname (lastName), then FirstName, then OtherNames
    return filtered.sort((a, b) => {
      const nameA = `${a.lastName || ''} ${a.firstName || ''} ${a.otherNames || ''}`.trim().toLowerCase();
      const nameB = `${b.lastName || ''} ${b.firstName || ''} ${b.otherNames || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [allPupils, selectedClassId, searchQuery]);

  // Selected class info
  const selectedClass = React.useMemo(() => {
    return allClasses.find(c => c.id === selectedClassId);
  }, [allClasses, selectedClassId]);

  // Keep refs in sync every render so async callbacks always see current values
  attendanceDataRef.current = attendanceData;
  selectedClassIdRef.current = selectedClassId;
  allClassesRef.current = allClasses;
  allPupilsRef.current = allPupils;
  activeAcademicYearRef.current = activeAcademicYear;
  currentTermRef.current = currentTerm;

  React.useEffect(() => {
    const recordKey = (record: AttendanceRecord) =>
      `${record.date?.split('T')[0]}::${record.classId}::${record.pupilId}`;
    const merged = new Map(existingAttendanceRecords.map(record => [recordKey(record), record]));
    // Locally confirmed writes are newer than the published summary and must
    // survive re-renders until the session projection is flushed.
    existingAttendanceRecordsRef.current.forEach(record => {
      merged.set(recordKey(record), record);
    });
    existingAttendanceRecordsRef.current = Array.from(merged.values());
  }, [existingAttendanceRecords]);

  React.useEffect(() => {
    autoSaveFailedPupilsRef.current.clear();
    return () => {
      autoSaveQueue.current.forEach(timer => clearTimeout(timer));
      autoSaveQueue.current.clear();
    };
  }, [formattedCurrentDate, selectedClassId]);

  // Update current time every second
  React.useEffect(() => {
    const updateTime = () => setCurrentTime(format(new Date(), "HH:mm:ss"));
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Completed classes publish automatically. Visibility and route changes are
  // additional best-effort safety boundaries for partial sessions.
  React.useEffect(() => {
    if (!selectedClassId) return;
    const flush = () => {
      void flushAttendanceSummarySession(
        attendanceCacheScope,
        formattedCurrentDate,
        selectedClassId,
      );
    };
    window.addEventListener('pagehide', flush);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flush();
    };
  }, [attendanceCacheScope, formattedCurrentDate, selectedClassId]);

  // Load existing attendance data when class changes
  React.useEffect(() => {
    if (!selectedClassId || allPupils.length === 0) {
      // Only update if attendanceData is not already empty to prevent loops
      if (Object.keys(attendanceData).length > 0) {
        setAttendanceData({});
      }
      return;
    }

    const newAttendanceData: Record<string, PupilAttendanceEntry> = {};

    allPupils
      .filter(p => p.classId === selectedClassId && wasPupilActiveOnDate(p, formattedCurrentDate))
      .forEach((pupil) => {
        const existingRecord = existingAttendanceRecords.find(
          (ar) =>
            ar.classId === selectedClassId &&
            ar.pupilId === pupil.id &&
            format(new Date(ar.date), 'yyyy-MM-dd') === formattedCurrentDate
        );

        newAttendanceData[pupil.id] = {
          status: existingRecord?.status || "",
          remarks: existingRecord?.remarks || "",
        };
      });

    // Only update if new data is different from existing data to prevent unnecessary re-renders
    if (JSON.stringify(attendanceData) !== JSON.stringify(newAttendanceData)) {
      setAttendanceData(newAttendanceData);
    }
  }, [
    selectedClassId,
    JSON.stringify(allPupils), // Stringify to compare by value
    JSON.stringify(existingAttendanceRecords), // Stringify to compare by value
    formattedCurrentDate,
    // Do not add attendanceData here as it would cause a loop with the conditional setAttendanceData
  ]);

  const handleAttendanceChange = React.useCallback((
    pupilId: string,
    field: "status" | "remarks",
    value: string
  ) => {
    // 1. Update local state immediately (instant UI response)
    setAttendanceData((prev) => ({
      ...prev,
      [pupilId]: {
        ...prev[pupilId],
        [field]: value,
      },
    }));

    // 2. Background auto-save: only trigger on status changes (most important field)
    if (field === "status" && value) {
      // Debounce per-pupil: cancel any pending save for this pupil and schedule a new one
      const existingTimer = autoSaveQueue.current.get(pupilId);
      if (existingTimer) clearTimeout(existingTimer);

      const scheduledClassId = selectedClassIdRef.current;
      const scheduledGeneration = autoSaveGenerationRef.current;
      const timer = setTimeout(async () => {
        autoSaveQueue.current.delete(pupilId);
        const saveClassId = scheduledClassId;
        const failureKey = `${saveClassId}::${pupilId}`;
        // Increment counter and update DOM directly — no setState, no re-render
        autoSavePendingCount.current += 1;
        updateAutoSaveIndicator();
        try {
          // Get latest values via refs (always fresh, no stale closure)
          const currentAttendanceData = attendanceDataRef.current;
          const currentExistingRecords = existingAttendanceRecordsRef.current;
          const currentSelectedClassId = saveClassId;
          const currentSelectedClass = allClassesRef.current.find(c => c.id === currentSelectedClassId);
          const currentActiveAcademicYear = activeAcademicYearRef.current;
          const currentCurrentTerm = currentTermRef.current;

          if (!currentSelectedClassId || !value) return;

          const pupilEntry = currentAttendanceData[pupilId];
          if (!pupilEntry?.status) return;

          const existingRecord = currentExistingRecords.find(
            (ar) =>
              ar.classId === currentSelectedClassId &&
              ar.pupilId === pupilId &&
              format(new Date(ar.date), 'yyyy-MM-dd') === formattedCurrentDate
          );

          if (existingRecord) {
            console.log(`⚡ AUTO-SAVE: Updating pupil ${pupilId} -> ${pupilEntry.status}`);
            await AttendanceService.updateAttendanceRecord(existingRecord.id, {
              status: pupilEntry.status as AttendanceStatus,
              remarks: pupilEntry.remarks,
              recordedBy: "System Admin",
              className: currentSelectedClass?.name || '',
              classCode: currentSelectedClass?.code || '',
            });
            existingAttendanceRecordsRef.current = currentExistingRecords.map(record =>
              record.id === existingRecord.id
                ? { ...record, status: pupilEntry.status as AttendanceStatus, remarks: pupilEntry.remarks }
                : record
            );
          } else {
            console.log(`⚡ AUTO-SAVE: Creating record for pupil ${pupilId} -> ${pupilEntry.status}`);
            const newId = await AttendanceService.createAttendanceRecord({
              date: formattedCurrentDate,
              classId: currentSelectedClassId,
              className: currentSelectedClass?.name || '',
              classCode: currentSelectedClass?.code || '',
              pupilId,
              status: pupilEntry.status as AttendanceStatus,
              remarks: pupilEntry.remarks,
              recordedBy: "System Admin",
              academicYearId: currentActiveAcademicYear?.id || '',
              termId: currentCurrentTerm?.id || '',
            });
            // Update the local existingRecords ref so next auto-save of same pupil knows it exists
            existingAttendanceRecordsRef.current = [
              ...currentExistingRecords,
              {
                id: newId,
                date: formattedCurrentDate,
                classId: currentSelectedClassId,
                className: currentSelectedClass?.name || '',
                classCode: currentSelectedClass?.code || '',
                pupilId,
                status: pupilEntry.status as AttendanceStatus,
                remarks: pupilEntry.remarks,
                recordedBy: "System Admin",
                academicYearId: currentActiveAcademicYear?.id || '',
                termId: currentCurrentTerm?.id || '',
                recordedAt: new Date().toISOString(),
              } as any
            ];
          }

          autoSaveFailedPupilsRef.current.delete(failureKey);
          if (scheduledGeneration === autoSaveGenerationRef.current) {
            queueAttendanceSummaryPublication(
              attendanceCacheScope,
              formattedCurrentDate,
              currentSelectedClassId,
              getConfirmedSessionRecords(
                formattedCurrentDate,
                currentSelectedClassId,
                existingAttendanceRecordsRef.current,
                currentSelectedClass,
              ),
              true,
            );
          }
        } catch (err) {
          autoSaveFailedPupilsRef.current.add(failureKey);
          console.error('⚠️ AUTO-SAVE failed for pupil', pupilId, err);
        } finally {
          // Decrement counter and update DOM — no React re-render
          autoSavePendingCount.current = Math.max(0, autoSavePendingCount.current - 1);
          updateAutoSaveIndicator();

          const currentClassId = selectedClassIdRef.current;
          const sessionSettled =
            autoSavePendingCount.current === 0 &&
            autoSaveQueue.current.size === 0;
          const classPupils = allPupilsRef.current.filter(pupil =>
            pupil.classId === currentClassId &&
            wasPupilActiveOnDate(pupil, formattedCurrentDate)
          );
          const classComplete =
            classPupils.length > 0 &&
            classPupils.every(pupil => !!attendanceDataRef.current[pupil.id]?.status);
          const classHasFailures = Array.from(autoSaveFailedPupilsRef.current)
            .some(key => key.startsWith(`${currentClassId}::`));

          if (
            sessionSettled &&
            classComplete &&
            !classHasFailures &&
            !manualSaveInProgressRef.current
          ) {
            summaryPublishPendingRef.current = true;
            updateAutoSaveIndicator();
            try {
              const published = await flushAttendanceSummarySession(
                attendanceCacheScope,
                formattedCurrentDate,
                currentClassId,
              );
              if (!published) {
                console.warn('Attendance was saved, but its dashboard refresh remains queued.');
              }
            } finally {
              summaryPublishPendingRef.current = false;
              updateAutoSaveIndicator();
            }
          }
        }
      }, 800); // 800ms debounce — fast enough to feel instant, eliminates rapid-click duplicates

      autoSaveQueue.current.set(pupilId, timer);
      updateAutoSaveIndicator();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceCacheScope, formattedCurrentDate]);

  const handleSaveAttendance = React.useCallback(async () => {
    if (!selectedClassId) {
      toast({
        title: "Missing Information",
        description: "Please select a class.",
        variant: "destructive",
      });
      return;
    }

    if (!attendanceStatus.canRecord) {
      toast({
        title: "Cannot Record Attendance",
        description: attendanceStatus.reason || "Attendance cannot be recorded for this date.",
        variant: "destructive",
      });
      return;
    }

    // The explicit save owns this session from here. Cancel delayed per-pupil
    // callbacks so they cannot enqueue an older projection after publication.
    manualSaveInProgressRef.current = true;
    autoSaveGenerationRef.current += 1;
    autoSaveQueue.current.forEach(timer => clearTimeout(timer));
    autoSaveQueue.current.clear();
    updateAutoSaveIndicator();
    setIsSaving(true);

    try {
      const recordsToCreate: Omit<AttendanceRecord, 'id' | 'recordedAt'>[] = [];
      const recordsToUpdate: { id: string; data: Partial<Omit<AttendanceRecord, 'id' | 'recordedAt'>> }[] = [];

      // Use the ref — it's kept up-to-date by auto-save (includes records auto-save just wrote)
      const latestExistingRecords = existingAttendanceRecordsRef.current;

      pupilsInClass.forEach((pupil) => {
        const pupilEntry = attendanceData[pupil.id];
        if (!pupilEntry || !pupilEntry.status) {
          return; // Skip pupils with no status selected
        }

        const existingRecord = latestExistingRecords.find(
          (ar) =>
            ar.classId === selectedClassId &&
            ar.pupilId === pupil.id &&
            format(new Date(ar.date), 'yyyy-MM-dd') === formattedCurrentDate
        );

        if (existingRecord) {
          recordsToUpdate.push({
            id: existingRecord.id,
            data: {
              status: pupilEntry.status as AttendanceStatus,
              remarks: pupilEntry.remarks,
              recordedBy: "System Admin",
              className: selectedClass?.name || '',
              classCode: selectedClass?.code || '',
            }
          });
        } else {
          recordsToCreate.push({
            date: formattedCurrentDate,
            classId: selectedClassId,
            className: selectedClass?.name || '',
            classCode: selectedClass?.code || '',
            pupilId: pupil.id,
            status: pupilEntry.status as AttendanceStatus,
            remarks: pupilEntry.remarks,
            recordedBy: "System Admin",
            academicYearId: activeAcademicYear?.id || '',
            termId: currentTerm?.id || '',
          });
        }
      });

      // Process all operations in parallel for maximum performance
      const [, createResult] = await Promise.all([
        recordsToUpdate.length > 0
          ? bulkUpdateMutation.mutateAsync(recordsToUpdate)
          : Promise.resolve(),
        recordsToCreate.length > 0
          ? bulkCreateMutation.mutateAsync(recordsToCreate)
          : Promise.resolve({ recordIds: [], records: [] }),
      ]);

      if (recordsToUpdate.length > 0) {
        const updateMap = new Map(recordsToUpdate.map(update => [update.id, update.data]));
        existingAttendanceRecordsRef.current = existingAttendanceRecordsRef.current.map(record =>
          updateMap.has(record.id)
            ? { ...record, ...updateMap.get(record.id) }
            : record
        );
      }

      if (createResult.recordIds.length > 0) {
        const created = createResult.records.map((record, index) => ({
          ...record,
          id: createResult.recordIds[index],
          recordedAt: new Date().toISOString(),
        } as AttendanceRecord));
        const createdKeys = new Set(created.map(record =>
          `${record.date?.split('T')[0]}::${record.classId}::${record.pupilId}`
        ));
        existingAttendanceRecordsRef.current = [
          ...existingAttendanceRecordsRef.current.filter(record => !createdKeys.has(
            `${record.date?.split('T')[0]}::${record.classId}::${record.pupilId}`
          )),
          ...created,
        ];
      }

      autoSaveFailedPupilsRef.current.clear();
      queueAttendanceSummaryPublication(
        attendanceCacheScope,
        formattedCurrentDate,
        selectedClassId,
        buildSessionRecords(
          formattedCurrentDate,
          selectedClassId,
          attendanceData,
          existingAttendanceRecordsRef.current,
          selectedClass,
        ),
        true,
      );

      summaryPublishPendingRef.current = true;
      updateAutoSaveIndicator();
      const published = await flushAttendanceSummarySession(
        attendanceCacheScope,
        formattedCurrentDate,
        selectedClassId,
      );
      summaryPublishPendingRef.current = false;
      updateAutoSaveIndicator();

      let attendanceNotificationSent = false;
      if (published && user?.id && auth.currentUser?.uid === user.id) {
        try {
          const token = await auth.currentUser.getIdToken();
          const notificationResponse = await fetch('/api/attendance/notify-class-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ date: formattedCurrentDate, classId: selectedClassId }),
          });
          attendanceNotificationSent = notificationResponse.ok;
          if (!notificationResponse.ok) {
            console.warn('Attendance saved, but class notification could not be sent:', await notificationResponse.text());
          }
        } catch (notificationError) {
          console.warn('Attendance saved, but class notification could not be sent:', notificationError);
        }
      }

      toast({
        title: published ? "Attendance Saved and Synced" : "Attendance Saved; Sync Pending",
        description: published
          ? attendanceNotificationSent
            ? `Attendance for ${selectedClass?.name} was sent to attendance dashboard users.`
            : `Attendance for ${selectedClass?.name} is now available on active devices.`
          : "The pupil records were saved, but the dashboard refresh is queued for retry.",
        variant: published ? "default" : "destructive",
      });

    } catch (error) {
      summaryPublishPendingRef.current = false;
      updateAutoSaveIndicator();
      console.error('Error saving attendance:', error);
      toast({
        title: "Error",
        description: "Failed to save attendance. Please try again.",
        variant: "destructive",
      });
    } finally {
      manualSaveInProgressRef.current = false;
      setIsSaving(false);
    }
  }, [
    attendanceCacheScope,
    activeAcademicYear?.id,
    attendanceData,
    bulkCreateMutation,
    bulkUpdateMutation,
    currentTerm?.id,
    formattedCurrentDate,
    pupilsInClass,
    selectedClass,
    selectedClassId,
    toast,
    user?.id,
  ]);

  const getStatusBadgeColor = (status: AttendanceStatus | "") => {
    switch (status) {
      case "Present": return "bg-green-100 text-green-800";
      case "Absent": return "bg-red-100 text-red-800";
      case "Late": return "bg-yellow-100 text-yellow-800";
      case "Excused": return "bg-blue-100 text-blue-800";
      case "Delayed": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const attendanceStats = React.useMemo(() => {
    const stats = { present: 0, absent: 0, late: 0, excused: 0, delayed: 0, notMarked: 0 };

    pupilsInClass.forEach(pupil => {
      const entry = attendanceData[pupil.id];
      if (!entry || !entry.status) {
        stats.notMarked++;
      } else {
        switch (entry.status) {
          case "Present": stats.present++; break;
          case "Absent": stats.absent++; break;
          case "Late": stats.late++; break;
          case "Excused": stats.excused++; break;
          case "Delayed": stats.delayed++; break;
        }
      }
    });

    return stats;
  }, [pupilsInClass, attendanceData]);

  if (classesLoading || pupilsLoading || academicYearLoading || excludedDaysLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Show recess status banner if in recess mode */}
      <RecessStatusBanner />

      <GlassPageTopBar
        title="Record Attendance"
        backHref="/attendance"
        backLabel="Back to Attendance Hub"
        className={selectedClass ? "mb-1.5" : "mb-4"}
        meta={
          <span className="whitespace-nowrap rounded-full border border-indigo-100/80 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
            {format(today, "MMM d")}
          </span>
        }
        titleControls={
          <div className="lg:hidden">
            <ClassSelector
              selectedClassId={selectedClassId}
              onClassChange={setSelectedClassId}
              placeholder="Class"
              size="sm"
              showIcon={false}
              className="shrink-0"
              triggerClassName="h-[34px] min-w-[104px] max-w-[140px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50"
              includeAllOption={false}
            />
          </div>
        }
        center={
          <>
            <ClassSelector
              selectedClassId={selectedClassId}
              onClassChange={setSelectedClassId}
              placeholder="Class"
              size="sm"
              showIcon={false}
              className="shrink-0"
              triggerClassName="h-[34px] min-w-[120px] max-w-[160px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50"
              includeAllOption={false}
            />
            {selectedClassId && (
              <GlassPageSearchInput
                placeholder="Search pupils..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            )}
          </>
        }
        actionsLeading={
          selectedClassId ? (
            <GlassPageSearchInput
              placeholder="Search pupils..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="lg:hidden"
            />
          ) : null
        }
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            {selectedClassId && (
              <span
                ref={autoSaveIndicatorRef}
                style={{ display: 'none' }}
                className="attendance-autosave-indicator text-[9px] sm:text-[10px]"
              />
            )}
            <div className="flex h-[34px] items-center gap-1 rounded-full border border-blue-200/60 bg-white/90 px-3 shadow-sm">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              <span className="font-mono text-[10px] font-bold text-blue-700 sm:text-xs">
                {currentTime}
              </span>
            </div>
          </div>
        }
      />

      {/* Stats Card / Summary Bar - Placed here outside the max-w-7xl container to match topbar width! */}
      {selectedClass && (
        <GlassSummaryBar
          left={
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 dark:text-indigo-200 uppercase">
                  {selectedClass.name}
                </span>
                <span className="text-xs text-gray-300 font-medium">•</span>
                <span className="text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100/80 dark:bg-gray-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {pupilsInClass.length} Students
                </span>
              </div>
              {/* Show signature for latest attendance record */}
              {existingAttendanceRecords.length > 0 && (
                <AttendanceSignatureDisplay
                  recordId={`${selectedClassId}-${formattedCurrentDate}`}
                  date={formattedCurrentDate}
                  variant="inline"
                  className="mt-0.5"
                />
              )}
            </>
          }
          right={
            <>
              <div className="flex items-center gap-1 bg-green-50/80 dark:bg-green-950/20 border border-green-100/50 dark:border-green-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-green-600 dark:text-green-400">{attendanceStats.present}</span>
                <span className="text-green-700/85 dark:text-green-300 font-medium">Present</span>
              </div>
              <div className="flex items-center gap-1 bg-red-50/80 dark:bg-red-950/20 border border-red-100/50 dark:border-red-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-red-600 dark:text-red-400">{attendanceStats.absent}</span>
                <span className="text-red-700/85 dark:text-green-300 font-medium">Absent</span>
              </div>
              <div className="flex items-center gap-1 bg-yellow-50/80 dark:bg-yellow-950/20 border border-yellow-100/50 dark:border-yellow-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-yellow-600 dark:text-yellow-400">{attendanceStats.late}</span>
                <span className="text-yellow-700/85 dark:text-green-300 font-medium">Late</span>
              </div>
              <div className="flex items-center gap-1 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-blue-600 dark:text-blue-400">{attendanceStats.excused}</span>
                <span className="text-blue-700/85 dark:text-green-300 font-medium">Excused</span>
              </div>
              <div className="flex items-center gap-1 bg-purple-50/80 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-purple-600 dark:text-purple-400">{attendanceStats.delayed}</span>
                <span className="text-purple-700/85 dark:text-green-300 font-medium">Delayed</span>
              </div>
              <div className="flex items-center gap-1 bg-gray-50/80 dark:bg-gray-800/30 border border-gray-100/50 dark:border-gray-700/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-gray-600 dark:text-gray-400">{attendanceStats.notMarked}</span>
                <span className="text-gray-700/85 dark:text-green-300 font-medium">Not Marked</span>
              </div>
            </>
          }
        />
      )}

      <div className="max-w-7xl mx-auto px-2 sm:px-6 pt-4 sm:pt-6 pb-12 space-y-4 sm:space-y-6">
        {!attendanceStatus.canRecord && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-2 border-red-200 dark:border-red-700 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-red-800 dark:text-red-200 mb-1">{statusMessage}</h4>
                {attendanceStatus.reason && (
                  <p className="text-sm text-red-700 dark:text-red-300">{attendanceStatus.reason}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modern Attendance Table/Cards */}
        {selectedClassId && pupilsInClass.length > 0 && (
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl sm:rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden backdrop-blur-sm">

            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 border-b-2 border-gray-200 dark:border-gray-700">
                      <TableHead className="w-[60px] font-bold text-gray-700 dark:text-gray-300">#</TableHead>
                      <TableHead className="font-bold text-gray-700 dark:text-gray-300">Student Name</TableHead>
                      <TableHead className="font-bold text-gray-700 dark:text-gray-300">Admission No.</TableHead>
                      <TableHead className="w-[180px] font-bold text-gray-700 dark:text-gray-300">Status</TableHead>
                      <TableHead className="font-bold text-gray-700 dark:text-gray-300">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pupilsInClass.map((pupil, index) => (
                      <DesktopPupilRow
                        key={pupil.id}
                        pupil={pupil}
                        index={index}
                        entry={attendanceData[pupil.id] || { status: "", remarks: "" }}
                        onChange={handleAttendanceChange}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden p-3 space-y-3">
              {pupilsInClass.map((pupil, index) => (
                <MobilePupilCard
                  key={pupil.id}
                  pupil={pupil}
                  index={index}
                  entry={attendanceData[pupil.id] || { status: "", remarks: "" }}
                  onChange={handleAttendanceChange}
                />
              ))}
            </div>
          </div>
        )}

        {/* No pupils message */}
        {selectedClassId && pupilsInClass.length === 0 && (
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-gray-500 dark:text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Active Students</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No active students found in the selected class.
            </p>
          </div>
        )}

        {/* Beautiful Floating Save Button */}
        {selectedClassId && pupilsInClass.length > 0 && (
          <div className="fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-50">
            <button
              onClick={handleSaveAttendance}
              disabled={isSaving || !selectedClassId || !attendanceStatus.canRecord}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: isSaving || !attendanceStatus.canRecord
                  ? '#9ca3af'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                cursor: isSaving || !attendanceStatus.canRecord ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                transform: 'scale(1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (!isSaving && attendanceStatus.canRecord) {
                  (e.target as HTMLButtonElement).style.transform = 'scale(1.1)';
                  (e.target as HTMLButtonElement).style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.transform = 'scale(1)';
                (e.target as HTMLButtonElement).style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
              }}
              onMouseDown={(e) => {
                if (!isSaving && attendanceStatus.canRecord) {
                  (e.target as HTMLButtonElement).style.transform = 'scale(0.95)';
                }
              }}
              onMouseUp={(e) => {
                if (!isSaving && attendanceStatus.canRecord) {
                  (e.target as HTMLButtonElement).style.transform = 'scale(1.1)';
                }
              }}
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'white' }} />
              ) : (
                <>
                  <Save className="h-4 w-4" style={{ color: 'white', marginBottom: '2px' }} />
                  <span style={{ color: 'white', fontSize: '9px', fontWeight: '600' }}>Save</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
