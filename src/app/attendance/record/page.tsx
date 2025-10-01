"use client";

import * as React from "react";
import Link from "next/link";
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
import { usePupils } from "@/lib/hooks/use-pupils";
import { useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";
import { useExcludedDays } from "@/lib/hooks/use-excluded-days";
import { 
  useAttendanceByDateRange, 
  useBulkCreateAttendanceRecords,
  useUpdateAttendanceRecord
} from "@/lib/hooks/use-attendance";
import { useRecordSignatures } from "@/lib/hooks/use-digital-signature";
import { DigitalSignatureDisplay } from "@/components/common/digital-signature-display";
import { AttendanceSignatureDisplay } from "@/components/attendance/AttendanceSignatureDisplay";
import { Loader2, Save, ArrowLeft, Clock, Users, Calendar, AlertTriangle, CheckCircle } from "lucide-react";
import { ATTENDANCE_STATUSES } from "@/lib/constants";
import { format } from "date-fns";
import { 
  canRecordAttendance, 
  getCurrentTermForDate, 
  getAttendanceRecordingStatus 
} from "@/lib/utils/attendance-academic-utils";

interface PupilAttendanceEntry {
  status: AttendanceStatus | "";
  remarks: string;
}

export default function RecordAttendancePage() {
  const { toast } = useToast();
  
  // Firebase hooks
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: activeAcademicYear, isLoading: academicYearLoading } = useActiveAcademicYear();
  const { data: excludedDays = [], isLoading: excludedDaysLoading } = useExcludedDays();
  
  // Date setup - get today's date
  const today = React.useMemo(() => new Date(), []);
  const formattedCurrentDate = React.useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const displayDate = React.useMemo(() => format(today, "PPP"), [today]);
  
  // Check if attendance can be recorded for today
  const attendanceStatus = React.useMemo(() => {
    return canRecordAttendance(today, activeAcademicYear || null, excludedDays);
  }, [today, activeAcademicYear, excludedDays]);
  
  // Get current term information
  const currentTerm = React.useMemo(() => {
    return getCurrentTermForDate(today, activeAcademicYear || null);
  }, [today, activeAcademicYear]);
  
  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  
  // Get status message
  const statusMessage = React.useMemo(() => {
    return getAttendanceRecordingStatus(today, activeAcademicYear || null, excludedDays);
  }, [today, activeAcademicYear, excludedDays]);
  
  // State
  const [selectedClassId, setSelectedClassId] = React.useState<string>("");
  const [attendanceData, setAttendanceData] = React.useState<Record<string, PupilAttendanceEntry>>({});
  const [currentTime, setCurrentTime] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);
  
  // Get existing attendance records for today
  const { data: existingAttendanceRecords = [] } = useAttendanceByDateRange(
    formattedCurrentDate, 
    formattedCurrentDate
  );
  
  // Mutations
  const bulkCreateMutation = useBulkCreateAttendanceRecords();
  const updateAttendanceMutation = useUpdateAttendanceRecord();
  
  // Memoized pupils in selected class
  const pupilsInClass = React.useMemo(() => {
    if (!selectedClassId) return [];
    return allPupils.filter(p => p.classId === selectedClassId && p.status === "Active");
  }, [allPupils, selectedClassId]);

  // Selected class info
  const selectedClass = React.useMemo(() => {
    return allClasses.find(c => c.id === selectedClassId);
  }, [allClasses, selectedClassId]);

  // Update current time every second
  React.useEffect(() => {
    const updateTime = () => setCurrentTime(format(new Date(), "HH:mm:ss"));
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

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
      .filter(p => p.classId === selectedClassId && p.status === "Active")
      .forEach((pupil) => {
        const existingRecord = existingAttendanceRecords.find(
          (ar) =>
            ar.classId === selectedClassId &&
            ar.pupilId === pupil.id &&
            ar.date.split('T')[0] === formattedCurrentDate 
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
    setAttendanceData((prev) => ({
      ...prev,
      [pupilId]: {
        ...prev[pupilId],
        [field]: value,
      },
    }));
  }, []);

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

    setIsSaving(true);

    try {
      const recordsToCreate: Omit<AttendanceRecord, 'id' | 'recordedAt'>[] = [];
      const recordsToUpdate: { id: string; data: Partial<Omit<AttendanceRecord, 'id' | 'recordedAt'>> }[] = [];

      pupilsInClass.forEach((pupil) => {
        const pupilEntry = attendanceData[pupil.id];
        if (!pupilEntry || !pupilEntry.status) { 
          return;
        }

        const existingRecord = existingAttendanceRecords.find(
          (ar) =>
            ar.classId === selectedClassId &&
            ar.pupilId === pupil.id &&
            ar.date.split('T')[0] === formattedCurrentDate 
        );

        if (existingRecord) {
          recordsToUpdate.push({
            id: existingRecord.id,
            data: {
              status: pupilEntry.status as AttendanceStatus,
              remarks: pupilEntry.remarks,
              recordedBy: "System Admin",
            }
          });
        } else {
          recordsToCreate.push({
            date: formattedCurrentDate,
            classId: selectedClassId,
            pupilId: pupil.id,
            status: pupilEntry.status as AttendanceStatus,
            remarks: pupilEntry.remarks,
            recordedBy: "System Admin",
            academicYearId: activeAcademicYear?.id || '',
            termId: currentTerm?.id || '',
          });
        }
      });

      // Process updates
      for (const updateRecord of recordsToUpdate) {
        await updateAttendanceMutation.mutateAsync(updateRecord);
      }

      // Process new records
      if (recordsToCreate.length > 0) {
        await bulkCreateMutation.mutateAsync(recordsToCreate);
      }

      toast({
        title: "Attendance Saved",
        description: `Attendance for ${selectedClass?.name} has been saved successfully.`,
      });

    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        title: "Error",
        description: "Failed to save attendance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [selectedClassId, pupilsInClass, attendanceData, existingAttendanceRecords, formattedCurrentDate, selectedClass?.name, updateAttendanceMutation, bulkCreateMutation, toast]);

  const getStatusBadgeColor = (status: AttendanceStatus | "") => {
    switch (status) {
      case "Present": return "bg-green-100 text-green-800";
      case "Absent": return "bg-red-100 text-red-800";
      case "Late": return "bg-yellow-100 text-yellow-800";
      case "Excused": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const attendanceStats = React.useMemo(() => {
    const stats = { present: 0, absent: 0, late: 0, excused: 0, notMarked: 0 };
    
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
    <>
      {/* Mobile Header with Clock */}
      <div className="block sm:hidden mb-6 px-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Record Daily Attendance</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Recording attendance for {displayDate}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-950 rounded-xl px-3 py-2 shadow-md border border-blue-100 dark:border-blue-800">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                <Clock className="h-3 w-3 text-white" />
              </div>
              <div>
                <div className="text-sm font-mono font-bold bg-gradient-to-r from-blue-900 to-indigo-900 dark:from-blue-100 dark:to-indigo-100 bg-clip-text text-transparent">
                  {currentTime}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Current Time
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Class Selection with Back Button */}
        <div className="space-y-3">
          {/* Before Selection: Heading with Back Button */}
          {!selectedClassId && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900 rounded-xl shadow-sm">
                  <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <Label htmlFor="class-select-mobile" className="text-base font-semibold text-gray-700 dark:text-gray-300">
                  Select Class
                </Label>
              </div>
              <Button variant="outline" size="sm" asChild className="h-8 w-8 p-0">
                <Link href="/attendance">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
          
          {/* Select Field - With Back Button when class is selected */}
          {!selectedClassId ? (
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger 
                id="class-select-mobile" 
                className="h-14 border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800 backdrop-blur-sm text-base"
              >
                <SelectValue placeholder="Choose a class code" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-2 shadow-xl backdrop-blur-sm max-h-[40vh] min-h-[200px] sm:max-h-[50vh] sm:min-h-[250px] lg:max-h-[60vh] lg:min-h-[300px] overflow-y-auto">
                {allClasses.map((cls) => (
                  <SelectItem 
                    key={cls.id} 
                    value={cls.id}
                    className="py-3 px-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 focus:bg-emerald-50 dark:focus:bg-emerald-900/20 rounded-xl my-1 mx-1 transition-colors duration-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-sm"></div>
                      <span className="font-medium text-base">{cls.code}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full font-medium">
                        {cls.name}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center justify-center space-x-3">
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger 
                  id="class-select-mobile" 
                  className="h-12 w-12 border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-full shadow-sm hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800 backdrop-blur-sm p-0 flex items-center justify-center"
                >
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate px-1">
                    {selectedClass?.code || '?'}
                  </span>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-2 shadow-xl backdrop-blur-sm max-h-[40vh] min-h-[200px] sm:max-h-[50vh] sm:min-h-[250px] lg:max-h-[60vh] lg:min-h-[300px] overflow-y-auto">
                  {allClasses.map((cls) => (
                    <SelectItem 
                      key={cls.id} 
                      value={cls.id}
                      className="py-3 px-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 focus:bg-emerald-50 dark:focus:bg-emerald-900/20 rounded-xl my-1 mx-1 transition-colors duration-200"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-sm"></div>
                        <span className="font-medium text-base">{cls.code}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full font-medium">
                          {cls.name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" asChild className="h-12 w-12 p-0 rounded-full flex-shrink-0">
                <Link href="/attendance">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden sm:block">
      <PageHeader
        title="Record Daily Attendance"
        description={`Recording attendance for ${displayDate}`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/attendance">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Attendance Hub
            </Link>
          </Button>
        }
      />
      
      {/* Show recess status banner if in recess mode */}
      <RecessStatusBanner />

        {/* Desktop Time Display and Class Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Beautiful Time Display */}
          <div className="order-2 lg:order-1 flex items-center justify-center lg:justify-start">
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-950 rounded-2xl px-6 py-4 shadow-lg border border-blue-100 dark:border-blue-800 hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                  <div>
                  <div className="text-xl font-mono font-bold bg-gradient-to-r from-blue-900 to-indigo-900 dark:from-blue-100 dark:to-indigo-100 bg-clip-text text-transparent">
                    {currentTime}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    Current Time
                    </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Class Selection */}
          <div className="order-1 lg:order-2 space-y-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900 rounded-xl shadow-sm">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <Label htmlFor="class-select-desktop" className="text-base font-semibold text-gray-700 dark:text-gray-300">
                Select Class
              </Label>
            </div>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                              <SelectTrigger 
                  id="class-select-desktop" 
                  className="h-14 border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800 backdrop-blur-sm text-base"
                >
                  <SelectValue placeholder="Choose a class code" />
                  </SelectTrigger>
                             <SelectContent className="rounded-2xl border-2 shadow-xl backdrop-blur-sm max-h-[40vh] min-h-[200px] sm:max-h-[50vh] sm:min-h-[250px] lg:max-h-[60vh] lg:min-h-[300px] overflow-y-auto">
                    {allClasses.map((cls) => (
                   <SelectItem 
                     key={cls.id} 
                     value={cls.id}
                     className="py-3 px-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 focus:bg-emerald-50 dark:focus:bg-emerald-900/20 rounded-xl my-1 mx-1 transition-colors duration-200"
                   >
                     <div className="flex items-center space-x-3">
                       <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-sm"></div>
                       <span className="font-medium text-base">{cls.code}</span>
                       <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full font-medium">
                         {cls.name}
                       </span>
                     </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
                </div>
              </div>
              
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        {/* Stats Card - Only show when class is selected */}
        {selectedClass && (
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl sm:rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 backdrop-blur-sm">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 rounded-xl">
                <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedClass.name} - {pupilsInClass.length} Students
                </h3>
                {/* Show signature for latest attendance record */}
                {existingAttendanceRecords.length > 0 && (
                  <AttendanceSignatureDisplay 
                    recordId={`${selectedClassId}-${formattedCurrentDate}`}
                    date={formattedCurrentDate}
                    variant="inline" 
                    className="mt-1" 
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1 sm:gap-3 lg:gap-4">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg sm:rounded-2xl p-2 sm:p-3 lg:p-4 text-center border border-green-200/50 dark:border-green-700/50">
                <div className="text-sm sm:text-xl lg:text-2xl font-bold text-green-600 dark:text-green-400">{attendanceStats.present}</div>
                <div className="text-xs sm:text-sm text-green-700 dark:text-green-300 font-medium leading-tight">Present</div>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-lg sm:rounded-2xl p-2 sm:p-3 lg:p-4 text-center border border-red-200/50 dark:border-red-700/50">
                <div className="text-sm sm:text-xl lg:text-2xl font-bold text-red-600 dark:text-red-400">{attendanceStats.absent}</div>
                <div className="text-xs sm:text-sm text-red-700 dark:text-red-300 font-medium leading-tight">Absent</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg sm:rounded-2xl p-2 sm:p-3 lg:p-4 text-center border border-yellow-200/50 dark:border-yellow-700/50">
                <div className="text-sm sm:text-xl lg:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{attendanceStats.late}</div>
                <div className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 font-medium leading-tight">Late</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg sm:rounded-2xl p-2 sm:p-3 lg:p-4 text-center border border-blue-200/50 dark:border-blue-700/50">
                <div className="text-sm sm:text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">{attendanceStats.excused}</div>
                <div className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 font-medium leading-tight">Excused</div>
                </div>
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 rounded-lg sm:rounded-2xl p-2 sm:p-3 lg:p-4 text-center border border-gray-200/50 dark:border-gray-700/50">
                <div className="text-sm sm:text-xl lg:text-2xl font-bold text-gray-600 dark:text-gray-400">{attendanceStats.notMarked}</div>
                <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium leading-tight">Not Marked</div>
                </div>
                </div>
                </div>
        )}

        {/* Show warning only when attendance cannot be recorded */}
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
                    {pupilsInClass.map((pupil, index) => {
                      const entry = attendanceData[pupil.id] || { status: "", remarks: "" };
                      return (
                        <TableRow key={pupil.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200 border-b border-gray-100 dark:border-gray-800">
                          <TableCell className="font-semibold text-gray-600 dark:text-gray-400">{index + 1}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {pupil.firstName} {pupil.lastName}
                            </div>
                            {pupil.otherNames && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                {pupil.otherNames}
                              </div>
                            )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-gray-700 dark:text-gray-300">{pupil.admissionNumber}</TableCell>
                          <TableCell>
                            <Select
                              value={entry.status}
                              onValueChange={(value) => 
                                handleAttendanceChange(pupil.id, "status", value)
                              }
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
                              onChange={(e) => 
                                handleAttendanceChange(pupil.id, "remarks", e.target.value)
                              }
                              placeholder="Optional remarks"
                              className="border-2 hover:border-emerald-300 focus:border-emerald-500 rounded-xl transition-colors duration-200"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile Card View - Compact */}
            <div className="lg:hidden p-3 space-y-3">
              {pupilsInClass.map((pupil, index) => {
                const entry = attendanceData[pupil.id] || { status: "", remarks: "" };
                return (
                  <div key={pupil.id} className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700 space-y-3">
                    {/* Student Info - Compact */}
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                          {pupil.firstName} {pupil.lastName} {pupil.otherNames && `(${pupil.otherNames})`}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                          {pupil.admissionNumber}
                        </p>
                      </div>
              </div>

                    {/* Compact Controls Grid */}
                    <div className="grid grid-cols-1 gap-2">
                      {/* Status Selection */}
                      <div>
                        <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Status</Label>
                        <Select
                          value={entry.status}
                          onValueChange={(value) => 
                            handleAttendanceChange(pupil.id, "status", value)
                          }
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

                      {/* Remarks */}
                      <div>
                        <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Remarks</Label>
                        <Input
                          value={entry.remarks}
                          onChange={(e) => 
                            handleAttendanceChange(pupil.id, "remarks", e.target.value)
                          }
                          placeholder="Optional remarks..."
                          className="border border-gray-300 dark:border-gray-600 hover:border-emerald-400 focus:border-emerald-500 rounded-lg transition-colors duration-200 text-sm h-9"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
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
    </>
  );
} 