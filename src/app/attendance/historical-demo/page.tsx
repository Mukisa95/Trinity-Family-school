'use client';

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, Camera, Database, CheckCircle, XCircle, Clock, Info } from 'lucide-react';
import { PupilHistoricalSelector } from '@/components/common/pupil-historical-selector';
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { getTermStatus } from '@/lib/utils/academic-year-utils';
import type { AcademicYear, AttendanceStatus } from '@/types';

interface PupilWithSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  classId: string;
  section: string;
  dateOfBirth?: string;
  snapshotData?: any;
  isHistorical: boolean;
  dataSource: 'live' | 'snapshot';
}

interface AttendanceRecord {
  pupilId: string;
  status: AttendanceStatus;
  recordedAt: string;
  notes?: string;
}

export default function HistoricalAttendanceDemoPage() {
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [pupils, setPupils] = useState<PupilWithSnapshot[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Fetch academic years
  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => AcademicYearsService.getAllAcademicYears()
  });

  const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);
  const selectedTerm = selectedAcademicYear?.terms.find(term => term.id === selectedTermId);
  const termStatus = selectedTerm ? getTermStatus(selectedTerm) : null;

  const handlePupilsChange = useCallback((newPupils: PupilWithSnapshot[]) => {
    setPupils(newPupils);
    // Initialize attendance records for new pupils
    setAttendanceRecords(prev => {
      const existingPupilIds = new Set(prev.map(r => r.pupilId));
      const newRecords = newPupils
        .filter(pupil => !existingPupilIds.has(pupil.id))
        .map(pupil => ({
          pupilId: pupil.id,
          status: 'Present' as AttendanceStatus,
          recordedAt: new Date().toISOString()
        }));
      return [...prev.filter(r => newPupils.some(p => p.id === r.pupilId)), ...newRecords];
    });
  }, []);

  const handleAttendanceChange = (pupilId: string, status: AttendanceStatus) => {
    setAttendanceRecords(prev => prev.map(record => 
      record.pupilId === pupilId 
        ? { ...record, status, recordedAt: new Date().toISOString() }
        : record
    ));
  };

  const getAttendanceStats = () => {
    const present = attendanceRecords.filter(r => r.status === 'Present').length;
    const absent = attendanceRecords.filter(r => r.status === 'Absent').length;
    const late = attendanceRecords.filter(r => r.status === 'Late').length;
    const excused = attendanceRecords.filter(r => r.status === 'Excused').length;
    
    return { present, absent, late, excused, total: attendanceRecords.length };
  };

  const stats = getAttendanceStats();

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'Present':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Absent':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'Late':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'Excused':
        return <Info className="h-4 w-4 text-blue-600" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    const variants = {
      Present: 'bg-green-100 text-green-800 border-green-200',
      Absent: 'bg-red-100 text-red-800 border-red-200',
      Late: 'bg-orange-100 text-orange-800 border-orange-200',
      Excused: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    
    return (
      <Badge variant="outline" className={variants[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Historical Attendance Demo</h1>
        <p className="text-gray-600">
          Demonstrates how the snapshot system ensures historical accuracy for attendance tracking
        </p>
      </div>

      {/* Academic Year and Term Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Academic Period
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Academic Year</label>
              <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map(year => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name}
                      {year.isActive && <Badge className="ml-2">Active</Badge>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Term</label>
              <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={!selectedAcademicYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {selectedAcademicYear?.terms.map(term => {
                    const status = getTermStatus(term);
                    return (
                      <SelectItem key={term.id} value={term.id}>
                        <div className="flex items-center gap-2">
                          {term.name}
                          <Badge variant={status === 'past' ? 'default' : status === 'current' ? 'secondary' : 'outline'}>
                            {status}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          </div>

          {termStatus && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {termStatus === 'past' && (
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    <span>
                      <strong>Historical Term:</strong> Using locked snapshots to show pupils as they were during this term.
                      This ensures attendance records remain accurate even if pupils have since changed classes.
                    </span>
                  </div>
                )}
                {termStatus === 'current' && (
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>
                      <strong>Current Term:</strong> Using live pupil data. Changes to pupil classes will be reflected immediately.
                    </span>
                  </div>
                )}
                {termStatus === 'future' && (
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>
                      <strong>Future Term:</strong> Using current pupil data for planning purposes.
                    </span>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Pupils Selection with Historical Accuracy */}
      <PupilHistoricalSelector
        onPupilsChange={handlePupilsChange}
        selectedAcademicYearId={selectedAcademicYearId}
        selectedTermId={selectedTermId}
        title="Select Pupils for Attendance"
        description="Pupils are automatically filtered based on their class and section during the selected term"
      />

      {/* Attendance Recording */}
      {pupils.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Record Attendance
              <Badge variant="outline">{selectedDate}</Badge>
            </CardTitle>
            <CardDescription>
              {termStatus === 'past' ? 
                'Recording attendance for historical term using snapshot data' :
                'Recording attendance using current pupil data'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Attendance Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.present}</div>
                <div className="text-sm text-gray-600">Present</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
                <div className="text-sm text-gray-600">Absent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.late}</div>
                <div className="text-sm text-gray-600">Late</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.excused}</div>
                <div className="text-sm text-gray-600">Excused</div>
              </div>
            </div>

            {/* Attendance List */}
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {pupils.map((pupil) => {
                const attendance = attendanceRecords.find(r => r.pupilId === pupil.id);
                
                return (
                  <div key={pupil.id} className="flex items-center justify-between p-4 border-b last:border-b-0">
                    <div className="flex items-center gap-3">
                      {pupil.dataSource === 'snapshot' ? 
                        <Camera className="h-4 w-4 text-blue-600" title="Historical snapshot data" /> :
                        <Database className="h-4 w-4 text-green-600" title="Live data" />
                      }
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {pupil.firstName} {pupil.lastName}
                          </span>
                          {pupil.dataSource === 'snapshot' && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Historical
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {pupil.admissionNumber} • {pupil.section}
                          {pupil.isHistorical && pupil.snapshotData && (
                            <span className="ml-2 text-blue-600">
                              (Class as of {new Date(pupil.snapshotData.snapshotDate).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {attendance && getStatusIcon(attendance.status)}
                      
                      <Select
                        value={attendance?.status || 'Present'}
                        onValueChange={(status: AttendanceStatus) => handleAttendanceChange(pupil.id, status)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Present">Present</SelectItem>
                          <SelectItem value="Absent">Absent</SelectItem>
                          <SelectItem value="Late">Late</SelectItem>
                          <SelectItem value="Excused">Excused</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button 
                onClick={() => {
                  // Here you would save the attendance records
                  console.log('Saving attendance records:', attendanceRecords);
                  alert('Attendance records saved! (Demo mode - check console for data)');
                }}
                disabled={pupils.length === 0}
              >
                Save Attendance Records
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>How This Ensures Historical Accuracy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Camera className="h-4 w-4 text-blue-600" />
                Past Terms (Historical)
              </h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Uses locked snapshots from when the term ended</li>
                <li>• Shows pupils in their classes as they were during that term</li>
                <li>• Preserves admission numbers and sections from that time</li>
                <li>• Attendance records remain accurate forever</li>
                <li>• Cannot be affected by subsequent class changes</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Database className="h-4 w-4 text-green-600" />
                Current/Future Terms (Live)
              </h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Uses current pupil data from the database</li>
                <li>• Reflects real-time class and section changes</li>
                <li>• Allows for promotions and transfers during the term</li>
                <li>• System remains flexible and up-to-date</li>
                <li>• Snapshots will be created when the term ends</li>
              </ul>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Key Benefit:</strong> This system solves the problem where changing a pupil's class 
              would make their historical attendance records appear incorrect. With snapshots, historical 
              data is preserved exactly as it was, while current data remains dynamic and accurate.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
} 