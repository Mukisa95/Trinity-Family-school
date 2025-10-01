"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import type { 
  Event, 
  CreateEventData, 
  UpdateEventData, 
  EventFilters,
  EventType 
} from '@/types';
import { useToast } from '@/hooks/use-toast';

const EVENTS_COLLECTION = 'events';

// Helper function to convert Firestore timestamp to date string
const timestampToDateString = (timestamp: any): string => {
  if (!timestamp) return '';
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString().split('T')[0];
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
  }
  return new Date(timestamp).toISOString().split('T')[0];
};

// Helper function to convert Firestore timestamp to time string
const timestampToTimeString = (timestamp: any): string => {
  if (!timestamp) return '';
  if (timestamp.toDate) {
    return timestamp.toDate().toTimeString().slice(0, 5);
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toTimeString().slice(0, 5);
  }
  return new Date(timestamp).toTimeString().slice(0, 5);
};

// Convert Firestore document to Event type
const convertFirestoreEvent = (doc: any): Event => {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || '',
    description: data.description || '',
    type: data.type || 'Academic',
    priority: data.priority || 'Medium',
    status: data.status || 'Draft',
    startDate: timestampToDateString(data.startDate),
    endDate: timestampToDateString(data.endDate),
    startTime: data.startTime || (data.startDate ? timestampToTimeString(data.startDate) : undefined),
    endTime: data.endTime || (data.endDate ? timestampToTimeString(data.endDate) : undefined),
    isAllDay: data.isAllDay || false,
    location: data.location || '',
    targetAudience: data.targetAudience || [],
    academicYearId: data.academicYearId || '',
    termId: data.termId || '',
    classIds: data.classIds || [],
    subjectIds: data.subjectIds || [],
    isExamEvent: data.isExamEvent || false,
    isRecurringInstance: data.isRecurringInstance || false,
    parentEventId: data.parentEventId,
    recurrence: data.recurrence || { frequency: 'None' },
    reminders: data.reminders || [],
    notificationsSent: data.notificationsSent || [],
    sendReminders: data.sendReminders !== false,
    colorCode: data.colorCode || '#3b82f6',
    requiresApproval: data.requiresApproval || false,
    approvedBy: data.approvedBy,
    approvedAt: data.approvedAt ? timestampToDateString(data.approvedAt) : undefined,
    requiresAttendance: data.requiresAttendance || false,
    isPublic: data.isPublic !== false,
    tags: data.tags || [],
    attachments: data.attachments || [],
    customFields: data.customFields || {},
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    createdAt: data.createdAt ? timestampToDateString(data.createdAt) : new Date().toISOString(),
    updatedAt: data.updatedAt ? timestampToDateString(data.updatedAt) : undefined,
  };
};

// Convert Event data to Firestore format
const convertToFirestoreData = (eventData: CreateEventData | UpdateEventData) => {
  const data: any = {
    title: eventData.title,
    type: eventData.type,
    priority: eventData.priority,
    status: eventData.status,
    isAllDay: eventData.isAllDay,
    targetAudience: eventData.targetAudience || [],
    isExamEvent: eventData.isExamEvent || false,
    isRecurringInstance: eventData.isRecurringInstance || false,
    recurrence: eventData.recurrence || { frequency: 'None' },
    reminders: eventData.reminders || [],
    sendReminders: eventData.sendReminders !== false,
    colorCode: eventData.colorCode || '#3b82f6',
    requiresApproval: eventData.requiresApproval || false,
    requiresAttendance: eventData.requiresAttendance || false,
    isPublic: eventData.isPublic !== false,
    updatedAt: serverTimestamp(),
  };

  // Only add fields that have actual values (not undefined, null, or empty strings)
  if (eventData.description) {
    data.description = eventData.description;
  }
  
  if (eventData.location) {
    data.location = eventData.location;
  }
  
  if (eventData.academicYearId) {
    data.academicYearId = eventData.academicYearId;
  }
  
  if (eventData.termId) {
    data.termId = eventData.termId;
  }
  
  if (eventData.classIds && eventData.classIds.length > 0) {
    data.classIds = eventData.classIds;
  }
  
  if (eventData.subjectIds && eventData.subjectIds.length > 0) {
    data.subjectIds = eventData.subjectIds;
  }
  
  if (eventData.parentEventId) {
    data.parentEventId = eventData.parentEventId;
  }
  
  if (eventData.tags && eventData.tags.length > 0) {
    data.tags = eventData.tags;
  }
  
  if (eventData.attachments && eventData.attachments.length > 0) {
    data.attachments = eventData.attachments;
  }
  
  if (eventData.customFields && Object.keys(eventData.customFields).length > 0) {
    data.customFields = eventData.customFields;
  }

  // Handle dates - convert to Timestamp if they exist
  if (eventData.startDate) {
    const startDateTime = eventData.startTime 
      ? `${eventData.startDate}T${eventData.startTime}:00`
      : `${eventData.startDate}T00:00:00`;
    data.startDate = Timestamp.fromDate(new Date(startDateTime));
    data.startTime = eventData.startTime;
  }

  if (eventData.endDate) {
    const endDateTime = eventData.endTime 
      ? `${eventData.endDate}T${eventData.endTime}:00`
      : `${eventData.endDate}T23:59:59`;
    data.endDate = Timestamp.fromDate(new Date(endDateTime));
    data.endTime = eventData.endTime;
  }

  // Add creation fields for new events
  if ('createdBy' in eventData) {
    data.createdBy = eventData.createdBy;
    data.createdAt = serverTimestamp();
  }

  return data;
};

// Get all events
export function useEvents(filters?: EventFilters) {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: async () => {
      try {
        let eventsQuery = collection(db, EVENTS_COLLECTION);
        
        // Apply filters
        const constraints = [orderBy('startDate', 'desc')];
        
        if (filters?.types?.length) {
          constraints.push(where('type', 'in', filters.types));
        }
        
        if (filters?.statuses?.length) {
          constraints.push(where('status', 'in', filters.statuses));
        }
        
        if (filters?.academicYearIds?.length) {
          constraints.push(where('academicYearId', 'in', filters.academicYearIds));
        }

        if (filters?.isExamEvent !== undefined) {
          constraints.push(where('isExamEvent', '==', filters.isExamEvent));
        }

        const q = query(eventsQuery, ...constraints);
        const snapshot = await getDocs(q);
        const events = snapshot.docs.map(convertFirestoreEvent);

        // Apply client-side filters for complex filtering
        let filteredEvents = events;

        if (filters?.searchTerm) {
          const searchTerm = filters.searchTerm.toLowerCase();
          filteredEvents = filteredEvents.filter(event =>
            event.title.toLowerCase().includes(searchTerm) ||
            event.description.toLowerCase().includes(searchTerm) ||
            event.location?.toLowerCase().includes(searchTerm)
          );
        }

        if (filters?.classIds?.length) {
          filteredEvents = filteredEvents.filter(event =>
            event.classIds.some(classId => filters.classIds!.includes(classId))
          );
        }

        if (filters?.subjectIds?.length) {
          filteredEvents = filteredEvents.filter(event =>
            event.subjectIds.some(subjectId => filters.subjectIds!.includes(subjectId))
          );
        }

        return filteredEvents;
      } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
    },
  });
}

// Get single event
export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['events', eventId],
    queryFn: async () => {
      try {
        const docRef = doc(db, EVENTS_COLLECTION, eventId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          throw new Error('Event not found');
        }
        
        return convertFirestoreEvent(docSnap);
      } catch (error) {
        console.error('Error fetching event:', error);
        throw error;
      }
    },
    enabled: !!eventId,
  });
}

// Create event
export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { signAction } = useDigitalSignatureHelpers();

  return useMutation({
    mutationFn: async (eventData: CreateEventData) => {
      try {
        const data = convertToFirestoreData({
          ...eventData,
          createdBy: eventData.createdBy || user?.id || '',
        });
        
        const docRef = await addDoc(collection(db, EVENTS_COLLECTION), data);
        
        // Get the created document to return complete event data
        const docSnap = await getDoc(docRef);
        const newEvent = convertFirestoreEvent(docSnap);
        
        // Create digital signature for event creation
        if (user) {
          await signAction(
            'event_creation',
            docRef.id,
            'created',
            {
              title: eventData.title,
              type: eventData.type,
              priority: eventData.priority,
              status: eventData.status,
              startDate: eventData.startDate,
              endDate: eventData.endDate,
              isExamEvent: eventData.isExamEvent,
              academicYearId: eventData.academicYearId,
              termId: eventData.termId,
              classIds: eventData.classIds,
              targetAudience: eventData.targetAudience
            }
          );
        }
        
        return newEvent;
      } catch (error) {
        console.error('Error creating event:', error);
        throw error;
      }
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      
      // If it's an exam event, also invalidate exams queries
      if (event.isExamEvent) {
        queryClient.invalidateQueries({ queryKey: ['exams'] });
      }
      
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      });
    },
  });
}

// Update event
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: UpdateEventData }) => {
      try {
        const docRef = doc(db, EVENTS_COLLECTION, eventId);
        const firestoreData = convertToFirestoreData(data);
        
        await updateDoc(docRef, firestoreData);
        
        // Get the updated document
        const docSnap = await getDoc(docRef);
        return convertFirestoreEvent(docSnap);
      } catch (error) {
        console.error('Error updating event:', error);
        throw error;
      }
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', event.id] });
      
      // If it's an exam event, also invalidate exams queries
      if (event.isExamEvent) {
        queryClient.invalidateQueries({ queryKey: ['exams'] });
      }
      
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating event:', error);
      toast({
        title: "Error",
        description: "Failed to update event",
        variant: "destructive",
      });
    },
  });
}

// Delete event
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      try {
        const docRef = doc(db, EVENTS_COLLECTION, eventId);
        await deleteDoc(docRef);
        return eventId;
      } catch (error) {
        console.error('Error deleting event:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    },
  });
}

// Get events by type
export function useEventsByType(type: EventType) {
  return useQuery({
    queryKey: ['events', 'type', type],
    queryFn: async () => {
      try {
        const q = query(
          collection(db, EVENTS_COLLECTION),
          where('type', '==', type),
          orderBy('startDate', 'desc')
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(convertFirestoreEvent);
      } catch (error) {
        console.error('Error fetching events by type:', error);
        throw error;
      }
    },
  });
}

// Get exam events (for integration with exams component)
export function useExamEvents() {
  return useQuery({
    queryKey: ['events', 'exams'],
    queryFn: async () => {
      try {
        const q = query(
          collection(db, EVENTS_COLLECTION),
          where('isExamEvent', '==', true),
          orderBy('startDate', 'desc')
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(convertFirestoreEvent);
      } catch (error) {
        console.error('Error fetching exam events:', error);
        throw error;
      }
    },
  });
}

// Create event from exam (for exam-event integration)
export function useCreateEventFromExam() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (exam: any) => {
      try {
        const eventData: CreateEventData = {
          title: `Exam: ${exam.name}`,
          description: `${exam.subject} examination for ${exam.class}${exam.description ? `\n\nDetails: ${exam.description}` : ''}`,
          type: 'Academic',
          priority: 'High',
          status: 'Scheduled',
          startDate: exam.startDate,
          endDate: exam.endDate || exam.startDate,
          startTime: exam.startTime,
          endTime: exam.endTime,
          isAllDay: !exam.startTime && !exam.endTime,
          location: exam.venue || exam.room || '',
          targetAudience: [exam.class],
          academicYearId: exam.academicYearId || '',
          termId: exam.termId || '',
          classIds: [exam.classId].filter(Boolean),
          subjectIds: [exam.subjectId].filter(Boolean),
          isExamEvent: true,
          isRecurringInstance: false,
          recurrence: { frequency: 'None' },
          reminders: [
            { timing: 'one_week_before', enabled: true, channels: ['in_app', 'email'] },
            { timing: 'one_day_before', enabled: true, channels: ['in_app', 'email', 'sms'] },
            { timing: 'one_hour_before', enabled: true, channels: ['in_app'] }
          ],
          sendReminders: true,
          colorCode: '#dc2626', // Red for exams
          requiresApproval: false,
          requiresAttendance: true,
          isPublic: true,
          tags: ['exam', exam.subject, exam.class],
          notes: exam.instructions || '',
          customFields: {
            examId: exam.id,
            subject: exam.subject,
            class: exam.class,
            duration: exam.duration,
            totalMarks: exam.totalMarks,
            supervisor: exam.supervisor,
          },
          createdBy: user?.id || '',
        };

        const data = convertToFirestoreData(eventData);
        const docRef = await addDoc(collection(db, EVENTS_COLLECTION), data);
        const docSnap = await getDoc(docRef);
        return convertFirestoreEvent(docSnap);
      } catch (error) {
        console.error('Error creating event from exam:', error);
        throw error;
      }
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', 'exams'] });
      toast({
        title: "Success",
        description: "Exam event created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating exam event:', error);
      toast({
        title: "Error",
        description: "Failed to create exam event",
        variant: "destructive",
      });
    },
  });
}

// Update event from exam data
export function useUpdateEventFromExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, examData }: { eventId: string; examData: any }) => {
      try {
        const eventData: UpdateEventData = {
          title: `Exam: ${examData.name}`,
          description: `${examData.subject} examination for ${examData.class}${examData.description ? `\n\nDetails: ${examData.description}` : ''}`,
          startDate: examData.startDate,
          endDate: examData.endDate || examData.startDate,
          startTime: examData.startTime,
          endTime: examData.endTime,
          isAllDay: !examData.startTime && !examData.endTime,
          location: examData.venue || examData.room || '',
          targetAudience: [examData.class],
          classIds: [examData.classId].filter(Boolean),
          subjectIds: [examData.subjectId].filter(Boolean),
          tags: ['exam', examData.subject, examData.class],
          notes: examData.instructions || '',
          customFields: {
            examId: examData.id,
            subject: examData.subject,
            class: examData.class,
            duration: examData.duration,
            totalMarks: examData.totalMarks,
            supervisor: examData.supervisor,
          },
        };

        const docRef = doc(db, EVENTS_COLLECTION, eventId);
        const firestoreData = convertToFirestoreData(eventData);
        await updateDoc(docRef, firestoreData);
        
        const docSnap = await getDoc(docRef);
        return convertFirestoreEvent(docSnap);
      } catch (error) {
        console.error('Error updating event from exam:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', 'exams'] });
      toast({
        title: "Success",
        description: "Exam event updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating exam event:', error);
      toast({
        title: "Error",
        description: "Failed to update exam event",
        variant: "destructive",
      });
    },
  });
} 