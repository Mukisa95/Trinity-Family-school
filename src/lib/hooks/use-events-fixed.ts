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
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import type {
  Event,
  CreateEventData,
  UpdateEventData,
  EventFilters,
  EventType,
  EventPriority,
  EventStatus,
  RecurrenceFrequency,
  Exam,
  CreateExamData
} from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AcademicYearsService } from '@/lib/services/academic-years.service';

const EVENTS_COLLECTION = 'events';

// Import exam types from constants to match Exams component exactly
import { EXAM_TYPES } from '@/lib/constants';

// Helper function to get exam type name from ID
function getExamTypeName(examTypeId: string): string {
  const examType = EXAM_TYPES.find(type => type.id === examTypeId);
  return examType ? examType.name : 'Unknown';
}

// Helper: format a Date to local YYYY-MM-DD (avoids UTC shift from toISOString())
const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper function to convert Firestore timestamp to date string
const timestampToDateString = (timestamp: any): string => {
  if (!timestamp) return '';
  // Plain string date — return as-is
  if (typeof timestamp === 'string') return timestamp.split('T')[0];
  if (timestamp.toDate) {
    return toLocalDateString(timestamp.toDate());
  }
  if (timestamp.seconds) {
    return toLocalDateString(new Date(timestamp.seconds * 1000));
  }
  return toLocalDateString(new Date(timestamp));
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

  // Handle dates - store as plain YYYY-MM-DD strings to avoid timezone shift.
  // Using Timestamp.fromDate with a local midnight Date would store UTC time,
  // which in UTC+3 is the previous day's 21:00 — causing an off-by-one display bug.
  if (eventData.startDate) {
    // Store as plain string, e.g. "2026-02-10"
    data.startDate = eventData.startDate;

    // Only add startTime if it has a value
    if (eventData.startTime) {
      data.startTime = eventData.startTime;
    }
  }

  if (eventData.endDate) {
    // Store as plain string, e.g. "2026-02-11"
    data.endDate = eventData.endDate;

    // Only add endTime if it has a value
    if (eventData.endTime) {
      data.endTime = eventData.endTime;
    }
  }

  // Add creation fields for new events
  if ('createdBy' in eventData) {
    data.createdBy = eventData.createdBy;
    data.createdAt = serverTimestamp();
  }

  return data;
};

// The raw/unfiltered events cache key used by GlobalDataPreloader
const EVENTS_CACHE_KEY = ['events', undefined] as const;

// Get all events with proper error handling
export function useEvents(filters?: EventFilters) {
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Read from GlobalDataPreloader's pre-populated cache immediately
  const cachedData = queryClient.getQueryData<Event[]>(EVENTS_CACHE_KEY);

  return useQuery({
    queryKey: ['events', filters],
    queryFn: async () => {
      // Check if GlobalDataPreloader already populated the cache
      const currentCache = queryClient.getQueryData<Event[]>(EVENTS_CACHE_KEY);
      if (currentCache && currentCache.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ useEvents: Using ${currentCache.length} events from preloader cache`);
        }
        // Apply client-side filters and return immediately
        return applyEventFilters(currentCache, filters);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useEvents: No cache, fetching from server...');
      }

      try {
        let eventsQuery = collection(db, EVENTS_COLLECTION);
        const q = query(eventsQuery, orderBy('startDate', 'desc'));
        const snapshot = await getDocs(q);
        const events = snapshot.docs.map(convertFirestoreEvent);

        // Populate the base cache for future calls
        if (events.length > 0) {
          queryClient.setQueryData(EVENTS_CACHE_KEY, events);
        }

        console.log('Events loaded successfully:', events.length);
        return applyEventFilters(events, filters);
      } catch (error) {
        console.error('Error fetching events:', error);
        return [];
      }
    },
    staleTime: Infinity, // GlobalDataPreloader handles ALL initial loads; mutations invalidate on demand
    gcTime: 60 * 60 * 1000, // 1 hour cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    // 🚀 Use pre-populated cache as initialData for zero-delay rendering
    initialData: () => {
      if (cachedData && cachedData.length > 0) {
        return applyEventFilters(cachedData, filters);
      }
      return undefined;
    },
    placeholderData: (previousData) => {
      if (cachedData && cachedData.length > 0) {
        return applyEventFilters(cachedData, filters);
      }
      return previousData;
    },
  });
}

// Helper: apply all event filters client-side without round-tripping to Firestore
function applyEventFilters(events: Event[], filters?: EventFilters): Event[] {
  if (!filters) return events;
  let result = events;

  if (filters.types?.length) {
    result = result.filter(e => filters.types!.includes(e.type));
  }
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    result = result.filter(e =>
      e.title.toLowerCase().includes(term) ||
      (e.description || '').toLowerCase().includes(term) ||
      (e.location || '').toLowerCase().includes(term)
    );
  }
  if (filters.statuses?.length) {
    result = result.filter(e => filters.statuses!.includes(e.status));
  }
  if (filters.priorities?.length) {
    result = result.filter(e => filters.priorities!.includes(e.priority));
  }
  if (filters.academicYearIds?.length) {
    result = result.filter(e => e.academicYearId && filters.academicYearIds!.includes(e.academicYearId));
  }
  if (filters.termIds?.length) {
    result = result.filter(e => e.termId && filters.termIds!.includes(e.termId));
  }
  if (filters.classIds?.length) {
    result = result.filter(e => e.classIds?.some(c => filters.classIds!.includes(c)));
  }
  if (filters.subjectIds?.length) {
    result = result.filter(e => e.subjectIds?.some(s => filters.subjectIds!.includes(s)));
  }
  if (filters.isExamEvent !== undefined) {
    result = result.filter(e => e.isExamEvent === filters.isExamEvent);
  }
  if (filters.dateRange?.startDate) {
    result = result.filter(e => e.startDate >= filters.dateRange!.startDate);
  }
  if (filters.dateRange?.endDate) {
    result = result.filter(e => e.endDate <= filters.dateRange!.endDate);
  }

  return result;
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

  return useMutation({
    mutationFn: async (eventData: CreateEventData) => {
      try {
        const data = convertToFirestoreData({
          ...eventData,
          createdBy: eventData.createdBy || user?.id || '',
        });

        const docRef = await addDoc(collection(db, EVENTS_COLLECTION), data);
        const docSnap = await getDoc(docRef);
        return convertFirestoreEvent(docSnap);
      } catch (error) {
        console.error('Error creating event:', error);
        throw error;
      }
    },
    onSuccess: (newEvent) => {
      // 🚀 Directly push the new event into the master cache for instant UI update
      // This eliminates the need for a Firestore re-fetch
      const existing = queryClient.getQueryData<Event[]>(EVENTS_CACHE_KEY) || [];
      queryClient.setQueryData(EVENTS_CACHE_KEY, [newEvent, ...existing]);
      // Notify all filtered-query observers to re-render from the updated master cache
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: () => {
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
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: UpdateEventData }) => {
      try {
        const docRef = doc(db, EVENTS_COLLECTION, eventId);
        const firestoreData = convertToFirestoreData(data);
        await updateDoc(docRef, firestoreData);

        // Get the updated document
        const docSnap = await getDoc(docRef);
        const updatedEvent = convertFirestoreEvent(docSnap);

        // If it's an exam event, update associated exams
        if (updatedEvent.isExamEvent && updatedEvent.examIntegration?.examIds) {
          const examIds = updatedEvent.examIntegration.examIds;
          console.log('Updating associated exams:', examIds);

          // Update all associated exams with new event data
          const updateExamPromises = examIds.map(async (examId: string) => {
            const examDocRef = doc(db, 'exams', examId);
            const examUpdateData: any = {};

            // Update exam fields that correspond to event fields
            if (data.title) examUpdateData.name = data.title;
            if (data.startDate) examUpdateData.startDate = data.startDate;
            if (data.endDate) examUpdateData.endDate = data.endDate;
            if (data.startTime) examUpdateData.startTime = data.startTime;
            if (data.endTime) examUpdateData.endTime = data.endTime;
            if (data.location) examUpdateData.location = data.location;
            if (data.description) examUpdateData.instructions = data.description;

            examUpdateData.updatedAt = serverTimestamp();

            await updateDoc(examDocRef, examUpdateData);
            console.log(`Updated exam: ${examId}`);
          });

          await Promise.all(updateExamPromises);
          console.log('All associated exams updated successfully');
        }

        return updatedEvent;
      } catch (error) {
        console.error('Error updating event:', error);
        throw error;
      }
    },
    onSuccess: (event) => {
      // 🚀 Directly replace the updated event in the master cache for instant UI update
      const existing = queryClient.getQueryData<Event[]>(EVENTS_CACHE_KEY) || [];
      const updated = existing.map(e => e.id === event.id ? event : e);
      queryClient.setQueryData(EVENTS_CACHE_KEY, updated);
      // Notify all filtered-query observers to re-render from the updated master cache
      queryClient.invalidateQueries({ queryKey: ['events'] });

      // If it's an exam event, also invalidate exams queries
      if (event.isExamEvent) {
        queryClient.invalidateQueries({ queryKey: ['exams'] });
      }

      toast({
        title: "Success",
        description: event.isExamEvent ? "Event and associated exams updated successfully" : "Event updated successfully",
      });
    },
    onError: () => {
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
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (eventId: string) => {
      try {
        console.log('Attempting to delete event with ID:', eventId);
        console.log('Event ID type:', typeof eventId);
        console.log('Event ID length:', eventId.length);
        console.log('Event ID trimmed:', eventId.trim());

        // Validate event ID
        if (!eventId || eventId.trim() === '') {
          throw new Error('Invalid event ID: empty or null');
        }

        // Check if this is an exam ID (starts with "exam-")
        if (eventId.startsWith('exam-')) {
          console.log('This is an exam ID, deleting from exams collection');

          // Remove the "exam-" prefix to get the actual exam ID
          const actualExamId = eventId.replace('exam-', '');
          console.log('Actual exam ID (without prefix):', actualExamId);

          // First, let's see what exams actually exist in the database
          const allExamsQuery = query(collection(db, 'exams'));
          const allExamsSnapshot = await getDocs(allExamsQuery);
          console.log('All exams in database:', allExamsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.data().title })));

          // Try to find the exam by the actual ID (without prefix)
          const examDocRef = doc(db, 'exams', actualExamId);
          const examDoc = await getDoc(examDocRef);

          if (!examDoc.exists()) {
            console.error('Exam not found in database:', actualExamId);
            throw new Error(`Exam not found: ${actualExamId}`);
          }

          await deleteDoc(examDocRef);
          console.log(`Deleted exam: ${actualExamId}`);

          return eventId; // Return the original eventId for consistency
        }

        // This is a regular event, delete from events collection
        console.log('This is a regular event, deleting from events collection');
        const eventDocRef = doc(db, EVENTS_COLLECTION, eventId.trim());
        const eventDoc = await getDoc(eventDocRef);

        console.log('Event document exists:', eventDoc.exists());
        console.log('Event document data:', eventDoc.data());

        if (!eventDoc.exists()) {
          console.error('Event not found in database:', eventId);

          // Let's also try to list all events to see what's available
          const allEventsQuery = query(collection(db, EVENTS_COLLECTION));
          const allEventsSnapshot = await getDocs(allEventsQuery);
          console.log('All events in database:', allEventsSnapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title })));

          throw new Error(`Event not found: ${eventId}`);
        }

        const eventData = eventDoc.data();

        // If it's an exam event, delete associated exams
        if (eventData?.isExamEvent && eventData?.examIntegration?.examIds) {
          const examIds = eventData.examIntegration.examIds;
          console.log('Deleting associated exams:', examIds);

          // Delete all associated exams
          const deleteExamPromises = examIds.map(async (examId: string) => {
            const examDocRef = doc(db, 'exams', examId);
            await deleteDoc(examDocRef);
            console.log(`Deleted exam: ${examId}`);
          });

          await Promise.all(deleteExamPromises);
          console.log('All associated exams deleted successfully');
        }

        // Delete the event
        await deleteDoc(eventDocRef);
        console.log(`Deleted event: ${eventId}`);

        return eventId;
      } catch (error) {
        console.error('Error deleting event:', error);
        throw error;
      }
    },
    onSuccess: (deletedId) => {
      // 🚀 Directly remove the deleted event from the master cache for instant UI update
      const existing = queryClient.getQueryData<Event[]>(EVENTS_CACHE_KEY) || [];
      // deletedId may have 'exam-' prefix - strip it for comparison
      const cleanId = typeof deletedId === 'string' ? deletedId.replace('exam-', '') : deletedId;
      const filtered = existing.filter(e => e.id !== deletedId && e.id !== cleanId);
      queryClient.setQueryData(EVENTS_CACHE_KEY, filtered);
      // Notify all filtered-query observers to re-render from the updated master cache
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['exams-as-events'] });
      toast({
        title: "Success",
        description: "Event/exam deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: `Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

// Get all exams and convert them to events (for testing)
export function useExamsAsEvents() {
  return useQuery({
    queryKey: ['exams-as-events'],
    queryFn: async () => {
      try {
        // First, check if there are any regular exam events
        const eventsSnapshot = await getDocs(collection(db, EVENTS_COLLECTION));
        const regularExamEvents = eventsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((event: any) => event.isExamEvent && event.examIntegration?.examIds);

        // Get exam IDs that are already represented as regular events
        const regularEventExamIds = new Set(
          regularExamEvents.flatMap((event: any) => event.examIntegration.examIds)
        );

        console.log('Regular exam events found:', regularExamEvents.length);
        console.log('Exam IDs already in regular events:', Array.from(regularEventExamIds));

        // Fetch from exams collection
        const examsSnapshot = await getDocs(collection(db, 'exams'));
        const allExams = examsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];

        // Filter out exams that are already represented as regular events
        const filteredExams = allExams.filter(exam => !regularEventExamIds.has(exam.id));

        console.log('Total exams:', allExams.length);
        console.log('Filtered exams (not in regular events):', filteredExams.length);

        const exams = filteredExams;

        // Fetch related data for enhanced exam details
        const classesSnapshot = await getDocs(collection(db, 'classes'));
        const classes = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        console.log('Fetched classes for exam details:', classes.length);

        const subjectsSnapshot = await getDocs(collection(db, 'subjects'));
        const subjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        console.log('Fetched subjects for exam details:', subjects.length);
        if (subjects.length > 0) {
          console.log('Sample subject data:', subjects[0]);
          console.log('All subject IDs:', subjects.map(s => s.id));
        }

        const academicYearsSnapshot = await getDocs(collection(db, 'academicYears'));
        const academicYears = academicYearsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        console.log('Fetched academic years for exam details:', academicYears.length);

        // Convert exams to event format with enhanced details
        const examEvents = exams.map((exam: any) => {
          // Helper function to format date to YYYY-MM-DD
          const formatDate = (date: any): string => {
            if (!date) return new Date().toISOString().split('T')[0];

            if (typeof date === 'string') {
              // If it's already a date string, try to parse and reformat
              try {
                const parsedDate = new Date(date);
                if (isNaN(parsedDate.getTime())) {
                  return new Date().toISOString().split('T')[0];
                }
                return parsedDate.toISOString().split('T')[0];
              } catch {
                return new Date().toISOString().split('T')[0];
              }
            }

            if (date.toDate) {
              // Firestore timestamp
              return date.toDate().toISOString().split('T')[0];
            }

            if (date.seconds) {
              // Firestore timestamp format
              return new Date(date.seconds * 1000).toISOString().split('T')[0];
            }

            return new Date().toISOString().split('T')[0];
          };

          // Get class details with multiple fallback strategies
          const getClassDetails = (classIds: string[]): { names: string[], details: any[] } => {
            console.log('Getting class details for:', classIds, 'from exam:', exam.id);

            // If no class IDs provided, try various fallback fields
            if (!classIds || classIds.length === 0) {
              // Try different possible field names for single class
              const possibleClassIds = [
                exam.classId,
                exam.class_id,
                exam.class?.id,
                exam.targetClass,
                exam.selectedClass
              ].filter(Boolean);

              if (possibleClassIds.length > 0) {
                const singleClass = classes.find(c => possibleClassIds.includes(c.id));
                if (singleClass) {
                  console.log('Found single class:', singleClass);
                  return { names: [singleClass.name || singleClass.className || 'Unknown Class'], details: [singleClass] };
                }
              }

              // Try string-based class name fields
              const possibleClassNames = [
                exam.className,
                exam.class_name,
                exam.class,
                exam.targetClassName
              ].filter(Boolean);

              if (possibleClassNames.length > 0) {
                console.log('Using class name fallback:', possibleClassNames[0]);
                return { names: [possibleClassNames[0]], details: [] };
              }

              console.log('No class information found');
              return { names: ['Unknown Class'], details: [] };
            }

            const classDetails = classIds.map(classId => {
              const cls = classes.find(c => c.id === classId);
              if (cls) {
                console.log('Found class by ID:', cls);
                return cls;
              } else {
                console.log('Class not found for ID:', classId);
                return { id: classId, name: 'Unknown Class' };
              }
            });

            return {
              names: classDetails.map(c => c.name || c.className || 'Unknown Class'),
              details: classDetails
            };
          };

          // Get subject details with multiple fallback strategies
          const getSubjectDetails = (subjectIds: string[], classDetails: { names: string[], details: any[] }): { names: string[], details: any[] } => {
            console.log('Getting subject details for:', subjectIds, 'from exam:', exam.id);
            console.log('Available subjects:', subjects.length, 'first few IDs:', subjects.slice(0, 3).map(s => s.id));
            console.log('Class details available:', classDetails.details.length > 0);

            // If no subject IDs provided, try various fallback fields
            if (!subjectIds || subjectIds.length === 0) {
              console.log('No direct subject IDs, trying fallback methods...');

              // Try different possible field names for single subject
              const possibleSubjectIds = [
                exam.subjectId,
                exam.subject_id,
                exam.subject?.id,
                exam.selectedSubject,
                exam.subject_assignment?.subjectId
              ].filter(Boolean);

              console.log('Trying possible subject IDs:', possibleSubjectIds);

              if (possibleSubjectIds.length > 0) {
                for (const possibleId of possibleSubjectIds) {
                  const singleSubject = subjects.find((s: any) => s.id === possibleId);
                  if (singleSubject) {
                    console.log('✅ Found single subject by ID:', possibleId, singleSubject);
                    return { names: [singleSubject.name || singleSubject.subjectName || singleSubject.title || 'Unknown Subject'], details: [singleSubject] };
                  } else {
                    console.log('❌ Subject not found for ID:', possibleId);
                  }
                }
              }

              // Try string-based subject name fields
              const possibleSubjectNames = [
                exam.subjectName,
                exam.subject_name,
                exam.subject,
                exam.subjectTitle,
                exam.title // Sometimes the exam title contains the subject
              ].filter(Boolean);

              console.log('Trying possible subject names:', possibleSubjectNames);

              if (possibleSubjectNames.length > 0) {
                // Try to match subject by name
                const subjectName = possibleSubjectNames[0];
                const matchingSubject = subjects.find((s: any) =>
                  (s.name && s.name.toLowerCase() === subjectName.toLowerCase()) ||
                  (s.subjectName && s.subjectName.toLowerCase() === subjectName.toLowerCase()) ||
                  (s.title && s.title.toLowerCase() === subjectName.toLowerCase())
                );

                if (matchingSubject) {
                  console.log('✅ Found subject by name match:', matchingSubject);
                  return { names: [matchingSubject.name || matchingSubject.subjectName || matchingSubject.title], details: [matchingSubject] };
                } else {
                  console.log('📝 Using subject name fallback:', subjectName);
                  return { names: [subjectName], details: [] };
                }
              }

              // FALLBACK: Extract subjects from class data if available
              if (classDetails.details.length > 0) {
                console.log('🔄 Trying to extract subjects from class data...');
                const classData = classDetails.details[0]; // Use first class

                // Try subjectAssignments first
                if (classData.subjectAssignments && classData.subjectAssignments.length > 0) {
                  console.log('Found subjectAssignments:', classData.subjectAssignments);
                  const subjectIdsFromClass = classData.subjectAssignments.map((sa: any) => sa.subjectId).filter(Boolean);
                  if (subjectIdsFromClass.length > 0) {
                    const subjectsFromClass = subjectIdsFromClass.map((sid: string) => {
                      const subject = subjects.find(s => s.id === sid);
                      return subject || { id: sid, name: `Subject ${sid}` };
                    });
                    console.log('✅ Found subjects from class subjectAssignments:', subjectsFromClass);
                    return {
                      names: subjectsFromClass.map((s: any) => s.name || s.subjectName || s.title || 'Unknown Subject'),
                      details: subjectsFromClass
                    };
                  }
                }

                // Try subjects array
                if (classData.subjects && classData.subjects.length > 0) {
                  console.log('Found subjects array:', classData.subjects);
                  const subjectIdsFromClass = classData.subjects.map((s: any) => s.id || s.subjectId || s).filter(Boolean);
                  if (subjectIdsFromClass.length > 0) {
                    const subjectsFromClass = subjectIdsFromClass.map((sid: string) => {
                      const subject = subjects.find(s => s.id === sid);
                      return subject || { id: sid, name: `Subject ${sid}` };
                    });
                    console.log('✅ Found subjects from class subjects array:', subjectsFromClass);
                    return {
                      names: subjectsFromClass.map((s: any) => s.name || s.subjectName || s.title || 'Unknown Subject'),
                      details: subjectsFromClass
                    };
                  }
                }
              }

              console.log('❌ No subject information found in exam or class');
              return { names: ['Unknown Subject'], details: [] };
            }

            // Process provided subject IDs
            console.log('Processing provided subject IDs:', subjectIds);
            const subjectDetails = subjectIds.map(subjectId => {
              const subject = subjects.find(s => s.id === subjectId);
              if (subject) {
                console.log('✅ Found subject by ID:', subjectId, subject);
                return subject;
              } else {
                console.log('❌ Subject not found for ID:', subjectId);
                // Try to find by name if the ID might actually be a name
                const subjectByName = subjects.find(s =>
                  (s.name && s.name.toLowerCase() === subjectId.toLowerCase()) ||
                  (s.subjectName && s.subjectName.toLowerCase() === subjectId.toLowerCase())
                );
                if (subjectByName) {
                  console.log('✅ Found subject by name instead of ID:', subjectByName);
                  return subjectByName;
                }
                return { id: subjectId, name: subjectId };
              }
            });

            return {
              names: subjectDetails.map(s => s.name || s.subjectName || s.title || s.id || 'Unknown Subject'),
              details: subjectDetails
            };
          };

          // Get academic year and term details
          const getAcademicDetails = (academicYearId: string, termId: string) => {
            const academicYear = academicYears.find(ay => ay.id === academicYearId);
            if (academicYear) {
              const term = academicYear.terms?.find((t: any) => t.id === termId);
              return {
                academicYearName: academicYear.name || 'Unknown Academic Year',
                termName: term?.name || 'Unknown Term',
                academicYear,
                term
              };
            }
            return {
              academicYearName: 'Unknown Academic Year',
              termName: 'Unknown Term',
              academicYear: null,
              term: null
            };
          };

          // Try to extract class and subject IDs from various possible field structures
          const examClassIds =
            exam.targetClasses ||
            exam.classIds ||
            exam.selectedClasses ||
            (exam.classId ? [exam.classId] : []) ||
            (exam.class_id ? [exam.class_id] : []) ||
            (exam.class?.id ? [exam.class.id] : []) ||
            [];

          const examSubjectIds =
            exam.subjectIds ||
            exam.selectedSubjects ||
            (exam.subjectId ? [exam.subjectId] : []) ||
            (exam.subject_id ? [exam.subject_id] : []) ||
            (exam.subject?.id ? [exam.subject.id] : []) ||
            [];

          console.log('Exam ID:', exam.id, 'Class IDs:', examClassIds, 'Subject IDs:', examSubjectIds);

          const classDetails = getClassDetails(examClassIds);
          const subjectDetails = getSubjectDetails(examSubjectIds, classDetails);
          const academicDetails = getAcademicDetails(exam.academicYearId, exam.termId);

          const startDate = formatDate(exam.startDate || exam.date);
          const endDate = formatDate(exam.endDate || exam.date || exam.startDate);

          // Create comprehensive description
          const descriptionParts = [
            exam.description || `${subjectDetails.names[0] || 'Unknown Subject'} examination`,
            '',
            `📚 Subject${subjectDetails.names.length > 1 ? 's' : ''}: ${subjectDetails.names.join(', ')}`,
            `🎓 Class${classDetails.names.length > 1 ? 'es' : ''}: ${classDetails.names.join(', ')}`,
            `📅 Academic Year: ${academicDetails.academicYearName}`,
            `📅 Term: ${academicDetails.termName}`,
          ];

          if (exam.examType) descriptionParts.push(`📝 Type: ${exam.examType}`);
          if (exam.examNature) descriptionParts.push(`🔬 Nature: ${exam.examNature}`);
          if (exam.maxMarks) descriptionParts.push(`💯 Max Marks: ${exam.maxMarks}`);
          if (exam.passingMarks) descriptionParts.push(`✅ Passing Marks: ${exam.passingMarks}`);
          if (exam.instructions) {
            descriptionParts.push('');
            descriptionParts.push('📋 Instructions:');
            descriptionParts.push(exam.instructions);
          }

          return {
            id: `exam-${exam.id}`,
            title: exam.title || exam.name || `${subjectDetails.names[0] || 'Unknown Subject'} Exam`,
            description: descriptionParts.join('\n'),
            type: 'Academic' as EventType,
            priority: 'High' as EventPriority,
            status: exam.status || 'Scheduled' as EventStatus,
            startDate,
            endDate,
            startTime: exam.startTime || undefined,
            endTime: exam.endTime || undefined,
            isAllDay: !exam.startTime,
            location: exam.venue || exam.room || exam.location || '',
            targetAudience: classDetails.names,
            academicYearId: exam.academicYearId || '',
            termId: exam.termId || '',
            classIds: examClassIds,
            subjectIds: examSubjectIds,
            isExamEvent: true,
            isRecurringInstance: false,
            parentEventId: undefined,
            recurrence: { frequency: 'None' as RecurrenceFrequency },
            reminders: [
              { timing: 'one_week_before', enabled: true, channels: ['in_app', 'email'] },
              { timing: 'one_day_before', enabled: true, channels: ['in_app', 'email'] }
            ],
            notificationsSent: [],
            sendReminders: true,
            colorCode: '#dc2626', // Red for exams
            requiresApproval: false,
            approvedBy: undefined,
            approvedAt: undefined,
            requiresAttendance: true,
            isPublic: true,
            tags: ['exam', ...subjectDetails.names, ...classDetails.names].filter(Boolean),
            attachments: [],
            customFields: {
              originalExamId: exam.id,
              examType: exam.examType,
              examNature: exam.examNature,
              maxMarks: exam.maxMarks,
              passingMarks: exam.passingMarks,
              instructions: exam.instructions,
              classDetails: classDetails.details,
              subjectDetails: subjectDetails.details,
              academicYearName: academicDetails.academicYearName,
              termName: academicDetails.termName,
            },
            createdBy: 'system',
            createdByName: 'System',
            createdAt: new Date().toISOString(),
            updatedAt: undefined,
          };
        });

        console.log('Converted exam events:', examEvents.length);
        return examEvents;
      } catch (error) {
        console.error('Error fetching exams as events:', error);
        return [];
      }
    },
  });
}

// Simplified exam integration hooks
export function useCreateEventFromExam() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (exam: any) => {
      try {
        const eventData: CreateEventData = {
          title: `Exam: ${exam.name}`,
          description: `${exam.subject} examination for ${exam.class}`,
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
            { timing: 'one_day_before', enabled: true, channels: ['in_app', 'email'] }
          ],
          sendReminders: true,
          colorCode: '#dc2626',
          requiresApproval: false,
          requiresAttendance: true,
          isPublic: true,
          tags: ['exam', exam.subject, exam.class],
          customFields: {
            examId: exam.id,
            subject: exam.subject,
            class: exam.class
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Success",
        description: "Exam event created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create exam event",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateEventFromExam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, examData }: { eventId: string; examData: any }) => {
      try {
        const eventData: UpdateEventData = {
          title: `Exam: ${examData.name}`,
          description: `${examData.subject} examination for ${examData.class}`,
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
          customFields: {
            examId: examData.id,
            subject: examData.subject,
            class: examData.class
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
      toast({
        title: "Success",
        description: "Exam event updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update exam event",
        variant: "destructive",
      });
    },
  });
}

// Academic Years Integration Hook
export function useAcademicYearsForEvents() {
  return useQuery({
    queryKey: ['academic-years-for-events'],
    queryFn: async () => {
      try {
        // Use the proper AcademicYearsService which handles date conversion correctly
        return await AcademicYearsService.getAllAcademicYears();
      } catch (error) {
        console.error('Error fetching academic years for events:', error);
        return [];
      }
    },
  });
}

// Create Exam from Event Hook
export function useCreateExamFromEvent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventData: {
      title: string;
      description?: string;
      startDate: string;
      endDate: string;
      startTime?: string;
      endTime?: string;
      location?: string;
      academicYearId: string;
      termId: string;
      examTypeId: string;
      examNature: 'Set based' | 'Subject based';
      selectedClassIds: string[];
      perClassSelectedSubjects: Record<string, string[]>;
      maxMarks: number;
      passingMarks: number;
      instructions?: string;
      existingExamIds?: string[]; // Optional: if provided, skip creating exams and use these IDs
    }) => {
      try {
        let createdExamIds: string[];

        // If existing exam IDs are provided, use them instead of creating new exams
        if (eventData.existingExamIds && eventData.existingExamIds.length > 0) {
          createdExamIds = eventData.existingExamIds;
        } else {
          // Create a single batch ID for all exams
          const batchId = `batch-${Date.now()}`;

          // Create exam instances for each selected class (all in the same batch)
          const examPromises = eventData.selectedClassIds.map(async (classId) => {
            // Get exam type name from the ID
            const examTypeName = getExamTypeName(eventData.examTypeId);

            const examData: CreateExamData = {
              name: eventData.title,
              baseName: eventData.title,
              batchId: batchId, // Same batch ID for all classes
              examTypeId: eventData.examTypeId,
              examTypeName: examTypeName, // Add the exam type name
              examNature: eventData.examNature,
              classId: classId,
              subjectIds: eventData.examNature === 'Subject based' ? eventData.perClassSelectedSubjects[classId] || [] : [],
              academicYearId: eventData.academicYearId,
              termId: eventData.termId,
              startDate: eventData.startDate,
              endDate: eventData.endDate,
              startTime: eventData.startTime,
              endTime: eventData.endTime,
              maxMarks: eventData.maxMarks,
              passingMarks: eventData.passingMarks,
              status: 'Scheduled' as const,
              instructions: eventData.instructions,
            };

            const examRef = await addDoc(collection(db, 'exams'), {
              ...examData,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            return examRef.id;
          });

          createdExamIds = await Promise.all(examPromises);
        }

        // Fetch actual class names for the customFields
        const classesSnapshot = await getDocs(collection(db, 'classes'));
        const classes = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        // Create class details with actual class names
        const classDetails = eventData.selectedClassIds.map(classId => {
          const classData = classes.find(c => c.id === classId);
          return {
            id: classId,
            name: classData?.name || classData?.className || `Class ${classId}`,
            className: classData?.name || classData?.className || `Class ${classId}`
          };
        });

        // Create subject details with actual subject names (if applicable)
        let subjectDetails: any[] = [];
        if (eventData.examNature === 'Subject based') {
          const subjectsSnapshot = await getDocs(collection(db, 'subjects'));
          const subjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

          const allSubjectIds = Object.values(eventData.perClassSelectedSubjects).flat();
          subjectDetails = allSubjectIds.map(subjectId => {
            const subjectData = subjects.find(s => s.id === subjectId);
            return {
              id: subjectId,
              name: subjectData?.name || subjectData?.subjectName || `Subject ${subjectId}`,
              subjectName: subjectData?.name || subjectData?.subjectName || `Subject ${subjectId}`
            };
          });
        }

        // Also create the calendar event
        const eventDoc = await addDoc(collection(db, EVENTS_COLLECTION), {
          title: eventData.title,
          description: eventData.description,
          startDate: Timestamp.fromDate(new Date(eventData.startDate)),
          endDate: Timestamp.fromDate(new Date(eventData.endDate)),
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          location: eventData.location,
          type: 'Academic' as EventType,
          status: 'Scheduled' as EventStatus,
          priority: 'High' as EventPriority,
          isExamEvent: true,
          examIntegration: {
            examIds: createdExamIds,
            examName: eventData.title,
            maxMarks: eventData.maxMarks,
            passingMarks: eventData.passingMarks,
            classIds: eventData.selectedClassIds,
          },
          customFields: {
            examType: getExamTypeName(eventData.examTypeId),
            examNature: eventData.examNature,
            maxMarks: eventData.maxMarks,
            passingMarks: eventData.passingMarks,
            instructions: eventData.instructions,
            selectedClassIds: eventData.selectedClassIds,
            perClassSelectedSubjects: eventData.perClassSelectedSubjects,
            // Use actual class and subject details
            classDetails: classDetails,
            subjectDetails: subjectDetails,
          },
          academicYearId: eventData.academicYearId,
          termId: eventData.termId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return { eventId: eventDoc.id, examIds: createdExamIds };
      } catch (error) {
        console.error('Error creating exam from event:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast({
        title: "Exam Scheduled",
        description: "Exam has been created and added to the calendar successfully.",
      });
    },
    onError: (error) => {
      console.error('Failed to create exam from event:', error);
      toast({
        title: "Error",
        description: "Failed to create exam. Please try again.",
        variant: "destructive",
      });
    },
  });
}

// Get Current Term Helper
export function useCurrentTerm(academicYears: any[]) {
  const currentDate = new Date();

  // First check all years by date (not just isActive)
  for (const year of academicYears) {
    for (const term of year.terms) {
      const termStart = new Date(term.startDate);
      const termEnd = new Date(term.endDate);

      if (currentDate >= termStart && currentDate <= termEnd) {
        return { year, term };
      }
    }
  }

  return null;
} 