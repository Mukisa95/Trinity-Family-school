"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { AttendanceRecordingPage } from '@/components/events/attendance/attendance-recording-page';

export default function EventAttendancePage() {
  const params = useParams();
  const eventId = params.eventId as string;

  return <AttendanceRecordingPage eventId={eventId} />;
} 