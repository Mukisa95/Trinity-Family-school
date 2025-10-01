"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Camera, 
  Database, 
  Users, 
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  History
} from "lucide-react";
import { format } from "date-fns";
import type { 
  Pupil, 
  AcademicYear, 
  Term, 
  Class, 
  EnhancedAttendanceRecord 
} from "@/types";
import { PupilHistoricalSelector } from "@/components/common/pupil-historical-selector";
import { useEnhancedAttendanceByDateRange } from "@/lib/hooks/use-enhanced-attendance";
import { getTermStatus } from "@/lib/utils/academic-year-utils";

interface EnhancedAttendanceSelectorProps {
  selectedAcademicYear: AcademicYear | null;
  selectedTerm: Term | null;
  selectedClass: Class | null;
  onAttendanceDataChange: (data: {
    attendanceRecords: EnhancedAttendanceRecord[];
    dataSource: 'snapshot' | 'live';
    termStatus: 'past' | 'current' | 'future';
  }) => void;
}

export function EnhancedAttendanceSelector({
  selectedAcademicYear,
  selectedTerm,
  selectedClass,
  onAttendanceDataChange
}: EnhancedAttendanceSelectorProps) {
  const [selectedDate, setSelectedDate] = React.useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );

  // Determine term status
  const termStatus = React.useMemo(() => {
    if (!selectedTerm) return 'current';
    return getTermStatus(selectedTerm);
  }, [selectedTerm]);

  // Get enhanced attendance data
  const { 
    data: attendanceRecords = [], 
    isLoading, 
    error 
  } = useEnhancedAttendanceByDateRange(
    selectedDate,
    selectedDate,
    selectedAcademicYear?.id,
    selectedTerm?.id
  );

  // Update parent when data changes
  React.useEffect(() => {
    if (attendanceRecords.length > 0) {
      const dataSource = attendanceRecords[0]?.pupilSnapshotData?.dataSource || 'live';
      onAttendanceDataChange({
        attendanceRecords,
        dataSource,
        termStatus
      });
    }
  }, [attendanceRecords, termStatus, onAttendanceDataChange]);

  const getStatusIcon = (status: 'past' | 'current' | 'future') => {
    switch (status) {
      case 'past':
        return <Camera className="h-4 w-4 text-blue-600" />;
      case 'current':
        return <Database className="h-4 w-4 text-green-600" />;
      case 'future':
        return <Clock className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusBadge = (status: 'past' | 'current' | 'future') => {
    switch (status) {
      case 'past':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Historical Data</Badge>;
      case 'current':
        return <Badge variant="default" className="bg-green-100 text-green-800">Live Data</Badge>;
      case 'future':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800">Future Term</Badge>;
    }
  };

  if (!selectedAcademicYear || !selectedTerm || !selectedClass) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please select an academic year, term, and class to view attendance data.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Term Status Indicator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {getStatusIcon(termStatus)}
            Attendance Data Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {getStatusBadge(termStatus)}
                <span className="text-sm text-muted-foreground">
                  {termStatus === 'past' && 'Using historical snapshots for accuracy'}
                  {termStatus === 'current' && 'Using live data for real-time updates'}
                  {termStatus === 'future' && 'Using projected data based on current assignments'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Term: {selectedTerm.name} ({format(new Date(selectedTerm.startDate), 'MMM dd')} - {format(new Date(selectedTerm.endDate), 'MMM dd, yyyy')})
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Select Date
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={selectedTerm.startDate}
            max={selectedTerm.endDate}
            className="w-full p-2 border rounded-md"
          />
        </CardContent>
      </Card>

      {/* Pupil Selector with Historical Accuracy */}
      <PupilHistoricalSelector
        selectedAcademicYear={selectedAcademicYear}
        selectedTerm={selectedTerm}
        selectedClass={selectedClass}
        onSelectionChange={(data) => {
          // Handle pupil selection changes
          console.log('Pupil selection changed:', data);
        }}
      />

      {/* Attendance Records Display */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Attendance Records
            {isLoading && <Skeleton className="h-4 w-20" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Error loading attendance data: {error.message}
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && !error && attendanceRecords.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No attendance records found for {format(new Date(selectedDate), 'MMM dd, yyyy')}.
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && !error && attendanceRecords.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">
                  {attendanceRecords.length} attendance records found
                </span>
                {attendanceRecords[0]?.pupilSnapshotData?.dataSource === 'snapshot' && (
                  <Badge variant="secondary" className="text-xs">
                    <History className="h-3 w-3 mr-1" />
                    Historical Data
                  </Badge>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground">
                {termStatus === 'past' && (
                  <p>✓ Showing historical attendance records with preserved class/section assignments</p>
                )}
                {termStatus === 'current' && (
                  <p>✓ Showing current attendance records with live pupil data</p>
                )}
                {termStatus === 'future' && (
                  <p>⚠️ Future term - attendance records may be projected</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 