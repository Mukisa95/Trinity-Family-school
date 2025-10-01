"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCreateEventFromExam, useUpdateEventFromExam } from '@/lib/hooks/use-events-fixed';
import { GraduationCap, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import type { Exam } from '@/types';

interface ExamEventIntegrationProps {
  exam: Exam;
  linkedEventId?: string;
  onEventCreated?: (eventId: string) => void;
  onEventUpdated?: (eventId: string) => void;
}

export function ExamEventIntegration({ 
  exam, 
  linkedEventId, 
  onEventCreated, 
  onEventUpdated 
}: ExamEventIntegrationProps) {
  const { toast } = useToast();
  const createEventFromExamMutation = useCreateEventFromExam();
  const updateEventFromExamMutation = useUpdateEventFromExam();

  const handleCreateEvent = async () => {
    try {
      const event = await createEventFromExamMutation.mutateAsync(exam);
      
      toast({
        title: "Event Created",
        description: `Calendar event has been created for ${exam.name}`,
      });

      onEventCreated?.(event.id);
    } catch (error) {
      toast({
        title: "Error Creating Event",
        description: error instanceof Error ? error.message : "Failed to create event",
        variant: "destructive",
      });
    }
  };

  const handleUpdateEvent = async () => {
    if (!linkedEventId) return;

    try {
      await updateEventFromExamMutation.mutateAsync({
        eventId: linkedEventId,
        examData: exam
      });
      
      toast({
        title: "Event Updated",
        description: `Calendar event has been updated for ${exam.name}`,
      });

      onEventUpdated?.(linkedEventId);
    } catch (error) {
      toast({
        title: "Error Updating Event",
        description: error instanceof Error ? error.message : "Failed to update event",
        variant: "destructive",
      });
    }
  };

  if (linkedEventId) {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
          <CheckCircle className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900">
            Calendar Event Linked
          </p>
          <p className="text-xs text-green-700">
            This exam is automatically synced with the calendar
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleUpdateEvent}
          disabled={updateEventFromExamMutation.isPending}
          className="text-green-700 border-green-300 hover:bg-green-100"
        >
          <Calendar className="h-4 w-4 mr-1" />
          Update Event
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
        <AlertCircle className="h-4 w-4 text-blue-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900">
          Create Calendar Event
        </p>
        <p className="text-xs text-blue-700">
          Add this exam to the school calendar with automatic reminders
        </p>
      </div>
      <Button
        onClick={handleCreateEvent}
        disabled={createEventFromExamMutation.isPending}
        size="sm"
        className="bg-blue-600 hover:bg-blue-700"
      >
        <GraduationCap className="h-4 w-4 mr-1" />
        Create Event
      </Button>
    </div>
  );
}

// Hook to use in exam forms for automatic integration
export function useExamEventSync() {
  const createEventFromExamMutation = useCreateEventFromExam();
  const updateEventFromExamMutation = useUpdateEventFromExam();

  const syncExamWithEvent = async (exam: Exam, linkedEventId?: string) => {
    if (linkedEventId) {
      // Update existing event
      return updateEventFromExamMutation.mutateAsync({
        eventId: linkedEventId,
        examData: exam
      });
    } else {
      // Create new event
      return createEventFromExamMutation.mutateAsync(exam);
    }
  };

  return {
    syncExamWithEvent,
    isLoading: createEventFromExamMutation.isPending || updateEventFromExamMutation.isPending,
    error: createEventFromExamMutation.error || updateEventFromExamMutation.error,
  };
} 