"use client";

import React, { useState, useMemo } from 'react';
import { Check, X, Clock, AlertCircle, Users, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClasses } from '@/lib/hooks/use-classes';
import { usePupilsByClass } from '@/lib/hooks/use-pupils';
import { useRecordPupilAttendance, useRecordedPupils } from '@/lib/hooks/use-event-attendance';
import type { Event } from '@/types';
import type { PupilAttendanceFormData } from '@/types/attendance';

interface PupilAttendanceFormProps {
  eventId: string;
  event: Event;
}

interface AttendanceStatus {
  pupilId: string;
  status: 'present' | 'absent' | 'late';
  notes?: string;
}

export function PupilAttendanceForm({ eventId, event }: PupilAttendanceFormProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks
  const { data: allClasses = [] } = useClasses();
  const { data: allPupils = [] } = usePupilsByClass(selectedClassId);
  const { recordedPupils = [] } = useRecordedPupils(eventId, selectedClassId);
  const { recordAttendance, loading: isRecording, error } = useRecordPupilAttendance();

  // Get classes relevant to this event
  const eventClasses = useMemo(() => {
    if (!event.classIds || event.classIds.length === 0) {
      return allClasses;
    }
    return allClasses.filter(cls => event.classIds!.includes(cls.id));
  }, [allClasses, event.classIds]);

  // Filter out pupils who already have attendance recorded
  const availablePupils = useMemo(() => {
    const recordedPupilIds = new Set(recordedPupils);
    return allPupils.filter(pupil => !recordedPupilIds.has(pupil.id));
  }, [allPupils, recordedPupils]);

  const handleStatusChange = (pupilId: string, status: 'present' | 'absent' | 'late') => {
    setAttendanceStatuses(prev => ({
      ...prev,
      [pupilId]: {
        ...prev[pupilId],
        pupilId,
        status,
      }
    }));
  };

  const handleNotesChange = (pupilId: string, notes: string) => {
    setAttendanceStatuses(prev => ({
      ...prev,
      [pupilId]: {
        ...prev[pupilId],
        pupilId,
        status: prev[pupilId]?.status || 'present',
        notes,
      }
    }));
  };

  const markAllPresent = () => {
    const newStatuses: Record<string, AttendanceStatus> = {};
    availablePupils.forEach(pupil => {
      newStatuses[pupil.id] = {
        pupilId: pupil.id,
        status: 'present',
        notes: attendanceStatuses[pupil.id]?.notes || '',
      };
    });
    setAttendanceStatuses(newStatuses);
  };

  const markAllAbsent = () => {
    const newStatuses: Record<string, AttendanceStatus> = {};
    availablePupils.forEach(pupil => {
      newStatuses[pupil.id] = {
        pupilId: pupil.id,
        status: 'absent',
        notes: attendanceStatuses[pupil.id]?.notes || '',
      };
    });
    setAttendanceStatuses(newStatuses);
  };

  const clearAll = () => {
    setAttendanceStatuses({});
  };

  const handleSubmit = async () => {
    if (!selectedClassId) {
      alert('Please select a class first');
      return;
    }

    const attendanceRecords = Object.values(attendanceStatuses).filter(status => status.status);
    
    if (attendanceRecords.length === 0) {
      alert('Please mark attendance for at least one pupil');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedClass = allClasses.find(cls => cls.id === selectedClassId);
      const formData: PupilAttendanceFormData = {
        classId: selectedClassId,
        className: selectedClass?.name || '',
        pupils: attendanceRecords.map(record => {
          const pupil = availablePupils.find(p => p.id === record.pupilId);
          return {
            pupilId: record.pupilId,
            pupilName: pupil ? `${pupil.firstName} ${pupil.lastName}` : 'Unknown',
            status: record.status,
          };
        }),
        notes: generalNotes || '',
      };

      const success = await recordAttendance(eventId, event, formData);
      
      if (success) {
        // Reset form
        setAttendanceStatuses({});
        setGeneralNotes('');
      } else {
        throw new Error('Failed to record attendance');
      }
      
    } catch (error) {
      console.error('Error submitting attendance:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusCounts = () => {
    const statuses = Object.values(attendanceStatuses);
    return {
      present: statuses.filter(s => s.status === 'present').length,
      absent: statuses.filter(s => s.status === 'absent').length,
      late: statuses.filter(s => s.status === 'late').length,
      total: availablePupils.length,
    };
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-6">
      {/* Class Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Class
          </CardTitle>
          <CardDescription>
            Choose the class for which you want to record attendance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="class-select">Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger id="class-select">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {eventClasses.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {eventClasses.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No classes are available for this event. Please check the event configuration.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pupil List */}
      {selectedClassId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mark Attendance</CardTitle>
                <CardDescription>
                  {availablePupils.length} pupils available for attendance marking
                  {recordedPupils.length > 0 && (
                    <span className="text-green-600 ml-2">
                      ({recordedPupils.length} already recorded)
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={markAllPresent}>
                  Mark All Present
                </Button>
                <Button variant="outline" size="sm" onClick={markAllAbsent}>
                  Mark All Absent
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {availablePupils.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {allPupils.length === 0 
                    ? "No pupils found in this class." 
                    : "All pupils in this class already have attendance recorded for this event."
                  }
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {/* Status Summary */}
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Present: {statusCounts.present}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Absent: {statusCounts.absent}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Late: {statusCounts.late}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                    <span>Not Marked: {statusCounts.total - statusCounts.present - statusCounts.absent - statusCounts.late}</span>
                  </div>
                </div>

                {/* Pupil List */}
                <ScrollArea className="h-96 rounded-md border">
                  <div className="p-4 space-y-3">
                    {availablePupils.map(pupil => {
                      const status = attendanceStatuses[pupil.id];
                      return (
                        <div key={pupil.id} className="flex items-start justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-medium">
                              {pupil.firstName} {pupil.lastName}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              ID: {pupil.id}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant={status?.status === 'present' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleStatusChange(pupil.id, 'present')}
                              className={status?.status === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={status?.status === 'late' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleStatusChange(pupil.id, 'late')}
                              className={status?.status === 'late' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={status?.status === 'absent' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleStatusChange(pupil.id, 'absent')}
                              className={status?.status === 'absent' ? 'bg-red-600 hover:bg-red-700' : ''}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* General Notes */}
                <div>
                  <Label htmlFor="general-notes">General Notes (Optional)</Label>
                  <Textarea
                    id="general-notes"
                    placeholder="Add any general notes about this attendance session..."
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                  />
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || Object.keys(attendanceStatuses).length === 0}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isSubmitting ? 'Saving...' : `Save Attendance (${Object.keys(attendanceStatuses).length})`}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Previously Recorded */}
      {recordedPupils.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Previously Recorded</CardTitle>
            <CardDescription>
              Pupils who already have attendance recorded for this event
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recordedPupils.map(record => (
                <div key={record.pupilId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="font-medium">{record.pupilName}</span>
                  <Badge 
                    variant={
                      record.status === 'present' ? 'default' :
                      record.status === 'late' ? 'secondary' : 'destructive'
                    }
                  >
                    {record.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 