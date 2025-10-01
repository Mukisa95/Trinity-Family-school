"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, GraduationCap, Building, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEvent } from '@/lib/hooks/use-events-fixed';
import { useEventAttendance } from '@/lib/hooks/use-event-attendance';
import { PupilAttendanceForm } from './pupil-attendance-form';
import { StaffAttendanceForm } from './staff-attendance-form';
import { ParentAttendanceForm } from './parent-attendance-form';
import { format } from 'date-fns';

interface AttendanceRecordingPageProps {
  eventId: string;
}

export function AttendanceRecordingPage({ eventId }: AttendanceRecordingPageProps) {
  const router = useRouter();
  const { data: event, isLoading: eventLoading, error: eventError } = useEvent(eventId);
  const { attendanceDoc } = useEventAttendance(eventId);
  
  // Calculate total attendance records
  const totalAttendanceRecords = useMemo(() => {
    if (!attendanceDoc) return 0;
    return (attendanceDoc.pupils?.length || 0) + 
           (attendanceDoc.staff?.length || 0) + 
           (attendanceDoc.parents?.length || 0);
  }, [attendanceDoc]);
  const [activeTab, setActiveTab] = useState<'pupils' | 'staff' | 'parents'>('pupils');

  // Determine which audience types are relevant for this event
  const relevantAudienceTypes = useMemo(() => {
    if (!event?.targetAudience || !event.requiresAttendance) {
      // For non-attendance events, allow all types
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

  if (eventLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load event details. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!event.requiresAttendance) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Event
          </Button>
        </div>
        
        <Alert>
          <AlertDescription>
            This event does not require attendance tracking. Please enable attendance tracking in the event settings first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const formatEventDate = (date: string, time?: string) => {
    try {
      const dateObj = new Date(date);
      if (time) {
        return `${format(dateObj, 'PPP')} at ${time}`;
      }
      return format(dateObj, 'PPP');
    } catch {
      return date;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Event
        </Button>
      </div>

      {/* Event Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Record Attendance: {event.title}
              </CardTitle>
              <CardDescription>
                {formatEventDate(event.startDate, event.startTime)}
                {event.location && ` • ${event.location}`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{event.type}</Badge>
              <Badge variant="secondary">{event.status}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Target Audience</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {event.targetAudience.map((audience, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {audience}
                  </Badge>
                ))}
              </div>
            </div>
            {event.classIds && event.classIds.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Classes</p>
                <p className="font-medium">{event.classIds.length} class(es) involved</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Recorded Attendance</p>
              <p className="font-medium">{totalAttendanceRecords} record(s)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Recording Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Record Attendance</CardTitle>
          <CardDescription>
            {event.requiresAttendance && relevantAudienceTypes.length === 1 ? (
              `This event is configured for ${relevantAudienceTypes[0]} attendance only.`
            ) : (
              'Select the appropriate tab based on who you are recording attendance for.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger 
                value="pupils" 
                disabled={!relevantAudienceTypes.includes('pupils')}
                className="flex items-center gap-2"
              >
                <GraduationCap className="h-4 w-4" />
                Pupils
              </TabsTrigger>
              <TabsTrigger 
                value="staff" 
                disabled={!relevantAudienceTypes.includes('staff')}
                className="flex items-center gap-2"
              >
                <Building className="h-4 w-4" />
                Staff
              </TabsTrigger>
              <TabsTrigger 
                value="parents" 
                disabled={!relevantAudienceTypes.includes('parents')}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Parents
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pupils" className="mt-6">
              <PupilAttendanceForm eventId={eventId} event={event} />
            </TabsContent>

            <TabsContent value="staff" className="mt-6">
              <StaffAttendanceForm eventId={eventId} event={event} />
            </TabsContent>

            <TabsContent value="parents" className="mt-6">
              <ParentAttendanceForm eventId={eventId} event={event} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Attendance Summary */}
      {totalAttendanceRecords > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance Summary</CardTitle>
            <CardDescription>Current attendance statistics for this event</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {totalAttendanceRecords} attendance record(s) have been recorded for this event.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 