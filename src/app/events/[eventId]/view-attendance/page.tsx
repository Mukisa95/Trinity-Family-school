import { Suspense } from 'react';
import { ViewAttendancePage } from '@/components/events/attendance/view-attendance-page';

export default async function EventViewAttendancePage({ 
  params 
}: { 
  params: Promise<{ eventId: string }> 
}) {
  const { eventId } = await params;
  
  return (
    <Suspense fallback={<div>Loading attendance data...</div>}>
      <ViewAttendancePage eventId={eventId} />
    </Suspense>
  );
} 