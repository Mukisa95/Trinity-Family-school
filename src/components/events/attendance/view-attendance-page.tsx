"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Users, 
  GraduationCap, 
  Building, 
  UserPlus,
  Calendar,
  MapPin,
  Download,
  CheckCircle,
  XCircle,
  Clock3
} from 'lucide-react';
import { useEvent } from '@/lib/hooks/use-events-fixed';
import { useEventAttendance } from '@/lib/hooks/use-event-attendance';
import { format, parseISO } from 'date-fns';
import type { EventAttendanceDocument, PupilAttendanceEntry, StaffAttendanceEntry, ParentAttendanceEntry } from '@/types/attendance';

interface ViewAttendancePageProps {
  eventId: string;
}

export function ViewAttendancePage({ eventId }: ViewAttendancePageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Get event data
  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  
  // Get attendance data
  const { attendanceDoc, loading: attendanceLoading, error: attendanceError } = useEventAttendance(eventId);
  
  // Determine which audience types are relevant for this event
  const relevantAudienceTypes = React.useMemo(() => {
    if (!event?.targetAudience || !event.requiresAttendance) {
      // For non-attendance events, show all types
      return ['pupils', 'staff', 'parents'];
    }
    
    const audiences = event.targetAudience;
    const types: ('pupils' | 'staff' | 'parents')[] = [];
    
    // For attendance-tracking events, be strict about audience matching
    audiences.forEach(audience => {
      const lowerAudience = audience.toLowerCase();
      
      // Check for exact matches with the standard audience types
      if (lowerAudience === 'all pupils' || lowerAudience === 'all students') {
        if (!types.includes('pupils')) types.push('pupils');
      } else if (lowerAudience === 'all teachers' || lowerAudience === 'all staff') {
        if (!types.includes('staff')) types.push('staff');
      } else if (lowerAudience === 'all parents' || lowerAudience === 'all guardians') {
        if (!types.includes('parents')) types.push('parents');
      }
    });
    
    return types;
  }, [event]);
  
  // Extract individual arrays from the attendance document
  const pupilAttendance = attendanceDoc?.pupils || [];
  const staffAttendance = attendanceDoc?.staff || [];
  const parentAttendance = attendanceDoc?.parents || [];
  const allAttendance = [...pupilAttendance, ...staffAttendance, ...parentAttendance];

  // Debug logging (remove after testing)
  console.log('ViewAttendancePage Debug:', {
    eventId,
    eventLoading,
    attendanceLoading,
    attendanceError,
    allAttendanceCount: allAttendance?.length,
    pupilCount: pupilAttendance?.length,
    staffCount: staffAttendance?.length,
    parentCount: parentAttendance?.length
  });

  if (eventLoading || attendanceLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Event not found</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Calculate attendance statistics
  const getAttendanceStats = (records: (PupilAttendanceEntry | StaffAttendanceEntry | ParentAttendanceEntry)[]) => {
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const total = records.length;
    
    return { present, absent, late, total };
  };

  const pupilStats = getAttendanceStats(pupilAttendance);
  const staffStats = getAttendanceStats(staffAttendance);
  const parentStats = getAttendanceStats(parentAttendance);
  const totalStats = getAttendanceStats(allAttendance);

  const formatDateTime = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      return format(date, 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'absent':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'late':
        return <Clock3 className="h-4 w-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Present</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Absent</Badge>;
      case 'late':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Late</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Attendance: {event.title}
                </h1>
                <p className="text-sm text-gray-500">
                  View and manage attendance records
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                onClick={() => router.push(`/events/${eventId}/attendance`)}
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Record More
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Event Information
              {event.requiresAttendance && relevantAudienceTypes.length === 1 && (
                <Badge variant="secondary" className="ml-2">
                  {relevantAudienceTypes[0].charAt(0).toUpperCase() + relevantAudienceTypes[0].slice(1)} Only
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{formatDateTime(event.startDate)}</p>
                </div>
              </div>
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium">{event.location}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Total Recorded</p>
                  <p className="font-medium">{totalStats.total} attendees</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${relevantAudienceTypes.length === 1 ? 'grid-cols-2' : relevantAudienceTypes.length === 2 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Overview
            </TabsTrigger>
            {relevantAudienceTypes.includes('pupils') && (
              <TabsTrigger value="pupils" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Pupils ({pupilStats.total})
              </TabsTrigger>
            )}
            {relevantAudienceTypes.includes('staff') && (
              <TabsTrigger value="staff" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Staff ({staffStats.total})
              </TabsTrigger>
            )}
            {relevantAudienceTypes.includes('parents') && (
              <TabsTrigger value="parents" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Parents ({parentStats.total})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <div className={`grid grid-cols-1 ${relevantAudienceTypes.length === 1 ? 'md:grid-cols-1' : relevantAudienceTypes.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-6`}>
              {/* Summary Cards - Only show relevant audience types */}
              {relevantAudienceTypes.includes('pupils') && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pupils</CardTitle>
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Present:</span>
                        <span className="font-medium">{pupilStats.present}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">Absent:</span>
                        <span className="font-medium">{pupilStats.absent}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-600">Late:</span>
                        <span className="font-medium">{pupilStats.late}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium border-t pt-2">
                        <span>Total:</span>
                        <span>{pupilStats.total}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {relevantAudienceTypes.includes('staff') && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Staff</CardTitle>
                    <Building className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Present:</span>
                        <span className="font-medium">{staffStats.present}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">Absent:</span>
                        <span className="font-medium">{staffStats.absent}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-600">Late:</span>
                        <span className="font-medium">{staffStats.late}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium border-t pt-2">
                        <span>Total:</span>
                        <span>{staffStats.total}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {relevantAudienceTypes.includes('parents') && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Parents</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Present:</span>
                        <span className="font-medium">{parentStats.present}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">Absent:</span>
                        <span className="font-medium">{parentStats.absent}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-600">Late:</span>
                        <span className="font-medium">{parentStats.late}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium border-t pt-2">
                        <span>Total:</span>
                        <span>{parentStats.total}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Recent Activity */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest attendance records</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {[...pupilAttendance, ...staffAttendance, ...parentAttendance].slice(0, 10).map((record, index) => {
                      let name = '';
                      let type = '';
                      if ('pupilName' in record) {
                        name = record.pupilName;
                        type = 'Pupil';
                      } else if ('staffName' in record) {
                        name = record.staffName;
                        type = 'Staff';
                      } else if ('attendees' in record && Array.isArray((record as ParentAttendanceEntry).attendees)) {
                        name = (record as ParentAttendanceEntry).attendees[0]?.name || 'Parent';
                        type = 'Parent';
                      }
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(record.status)}
                            <div>
                              <p className="font-medium">{name}</p>
                              <p className="text-sm text-gray-500">{type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(record.status)}
                            <p className="text-xs text-gray-400 mt-1">
                              Recorded by {record.recordedBy}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {allAttendance.length === 0 && (
                      <p className="text-center text-gray-500 py-8">No attendance records found</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Individual Type Tabs */}
          <TabsContent value="pupils" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Pupil Attendance Records
                </CardTitle>
                <CardDescription>
                  {pupilStats.total} records • {pupilStats.present} present, {pupilStats.absent} absent, {pupilStats.late} late
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {pupilAttendance.map((record, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(record.status)}
                          <div>
                            <p className="font-medium">{record.pupilName}</p>
                            <p className="text-sm text-gray-500">Class: {record.className}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(record.status)}
                          <p className="text-xs text-gray-400 mt-1">
                            By {record.recordedBy}
                          </p>
                        </div>
                      </div>
                    ))}
                    {pupilAttendance.length === 0 && (
                      <p className="text-center text-gray-500 py-8">No pupil attendance records found</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staff" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Staff Attendance Records
                </CardTitle>
                <CardDescription>
                  {staffStats.total} records • {staffStats.present} present, {staffStats.absent} absent, {staffStats.late} late
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {staffAttendance.map((record, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(record.status)}
                          <div>
                            <p className="font-medium">{record.staffName}</p>
                            <div className="flex gap-2 text-sm text-gray-500">
                              {record.position && <span>{record.position}</span>}
                              {record.department && <span>• {record.department}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(record.status)}
                          <p className="text-xs text-gray-400 mt-1">
                            By {record.recordedBy}
                          </p>
                        </div>
                      </div>
                    ))}
                    {staffAttendance.length === 0 && (
                      <p className="text-center text-gray-500 py-8">No staff attendance records found</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Parent Attendance Records
                </CardTitle>
                <CardDescription>
                  {parentStats.total} records • {parentStats.present} present, {parentStats.absent} absent, {parentStats.late} late
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {parentAttendance.map((record, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(record.status)}
                          <div>
                            <p className="font-medium">{record.attendees[0]?.name || 'Parent'}</p>
                            <div className="text-sm text-gray-500">
                              {record.attendees[0]?.relationship && (
                                <span>{record.attendees[0].relationship}</span>
                              )}
                              <span className="ml-2">
                                • For: {record.pupilName} ({record.className})
                              </span>
                            </div>
                            {record.attendees[0]?.reason && (
                              <p className="text-xs text-gray-400 mt-1">
                                Reason: {record.attendees[0].reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(record.status)}
                          <p className="text-xs text-gray-400 mt-1">
                            By {record.recordedBy}
                          </p>
                        </div>
                      </div>
                    ))}
                    {parentAttendance.length === 0 && (
                      <p className="text-center text-gray-500 py-8">No parent attendance records found</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 