"use client";

import React, { useState, useMemo } from 'react';
import { Check, X, Clock, AlertCircle, Building, Save, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStaff } from '@/lib/hooks/use-staff';
import { useRecordStaffAttendance } from '@/lib/hooks/use-event-attendance';
import { useToast } from '@/hooks/use-toast';
import type { Event, Staff } from '@/types';
import type { StaffAttendanceFormData } from '@/types/attendance';

interface StaffAttendanceFormProps {
  eventId: string;
  event: Event;
}

interface AttendanceStatus {
  staffId: string;
  status: 'present' | 'absent' | 'late';
  notes?: string;
}

export function StaffAttendanceForm({ eventId, event }: StaffAttendanceFormProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks
  const { data: allStaff = [] } = useStaff();
  const { recordAttendance, loading: isRecording, error } = useRecordStaffAttendance();
  const { toast } = useToast();

  // Get unique departments from staff
  const departments = useMemo(() => {
    const depts = new Set<string>();
    allStaff.forEach((staff: Staff) => {
      if (staff.department) {
        if (Array.isArray(staff.department)) {
          staff.department.forEach(dept => depts.add(dept));
        } else {
          depts.add(staff.department);
        }
      }
    });
    return Array.from(depts).sort();
  }, [allStaff]);

  // Filter staff by department
  const filteredStaff = useMemo(() => {
    if (selectedDepartment === 'all') {
      return allStaff.filter((staff: Staff) => staff.status === 'active');
    }
    return allStaff.filter((staff: Staff) => {
      if (staff.status !== 'active') return false;
      
      // Handle both old string format and new array format
      if (Array.isArray(staff.department)) {
        return staff.department.includes(selectedDepartment);
      } else {
        return staff.department === selectedDepartment;
      }
    });
  }, [allStaff, selectedDepartment]);

  const handleStatusChange = (staffId: string, status: 'present' | 'absent' | 'late') => {
    setAttendanceStatuses(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        staffId,
        status,
      }
    }));
  };

  const markAllPresent = () => {
    const newStatuses: Record<string, AttendanceStatus> = {};
    filteredStaff.forEach((staff: Staff) => {
      newStatuses[staff.id] = {
        staffId: staff.id,
        status: 'present',
        notes: attendanceStatuses[staff.id]?.notes || '',
      };
    });
    setAttendanceStatuses(newStatuses);
  };

  const markAllAbsent = () => {
    const newStatuses: Record<string, AttendanceStatus> = {};
    filteredStaff.forEach((staff: Staff) => {
      newStatuses[staff.id] = {
        staffId: staff.id,
        status: 'absent',
        notes: attendanceStatuses[staff.id]?.notes || '',
      };
    });
    setAttendanceStatuses(newStatuses);
  };

  const clearAll = () => {
    setAttendanceStatuses({});
  };

  const handleSubmit = async () => {
    const attendanceRecords = Object.values(attendanceStatuses).filter(status => status.status);
    
    if (attendanceRecords.length === 0) {
      alert('Please mark attendance for at least one staff member');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData: StaffAttendanceFormData = {
        staff: attendanceRecords.map(record => {
          const staff = allStaff.find((s: any) => s.id === record.staffId);
          return {
            staffId: record.staffId,
            staffName: staff ? `${staff.firstName} ${staff.lastName}` : 'Unknown',
            position: staff?.position || '',
            department: staff?.department || '',
            email: staff?.email || '',
            status: record.status,
          };
        }),
        notes: generalNotes || '',
      };

      // Record staff attendance using the new hook
      const success = await recordAttendance(eventId, event, formData);

      if (success) {
        // Show success message
        toast({
          title: "Staff Attendance Recorded",
          description: `Successfully recorded attendance for ${attendanceRecords.length} staff member(s).`,
        });
        
        // Reset form
        setAttendanceStatuses({});
        setGeneralNotes('');
      } else {
        throw new Error('Failed to record attendance');
      }
      
    } catch (error) {
      console.error('Error submitting staff attendance:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record staff attendance. Please try again.",
      });
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
      total: filteredStaff.length,
    };
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-6">
      {/* Department Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Staff
          </CardTitle>
          <CardDescription>
            Filter staff members by department (optional)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="department-select">Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger id="department-select">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-muted-foreground">
              Showing {filteredStaff.length} active staff member(s)
              {selectedDepartment !== 'all' && ` in ${selectedDepartment}`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mark Staff Attendance</CardTitle>
              <CardDescription>
                Mark attendance for {filteredStaff.length} staff member(s)
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
          {filteredStaff.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No active staff members found. Please check your filters or add staff members first.
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

              {/* Staff List */}
              <ScrollArea className="h-96 rounded-md border">
                <div className="p-4 space-y-3">
                  {filteredStaff.map((staff: any) => {
                    const status = attendanceStatuses[staff.id];
                    return (
                      <div key={staff.id} className="flex items-start justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">
                            {staff.firstName} {staff.lastName}
                          </h4>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            {staff.position && (
                              <span>Position: {staff.position}</span>
                            )}
                                            {staff.department && (
                  <span>Dept: {Array.isArray(staff.department) ? staff.department.join(', ') : staff.department}</span>
                )}
                          </div>
                          {staff.email && (
                            <p className="text-xs text-muted-foreground">
                              {staff.email}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant={status?.status === 'present' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleStatusChange(staff.id, 'present')}
                            className={status?.status === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={status?.status === 'late' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleStatusChange(staff.id, 'late')}
                            className={status?.status === 'late' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={status?.status === 'absent' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleStatusChange(staff.id, 'absent')}
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
                <Label htmlFor="staff-general-notes">General Notes (Optional)</Label>
                <Textarea
                  id="staff-general-notes"
                  placeholder="Add any general notes about this staff attendance session..."
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
                  {isSubmitting ? 'Saving...' : `Save Staff Attendance (${Object.keys(attendanceStatuses).length})`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
