"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
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
import { useAcademicNow, useAcademicYears } from './use-academic-years';
import { useDashboardDataRevisions } from './use-school-settings';
import { bumpEventsRevisionInBatch } from '@/lib/services/dashboard-cache-revisions.service';
import { useClasses } from './use-classes';
import { useSubjects } from './use-subjects';
import {
  getEventCacheScope,
  readEventCache,
  readEventCacheMetadata,
  readLegacyExamEventCache,
  readLegacyExamEventCacheMetadata,
  writeEventCache,
  writeLegacyExamEventCache,
} from '@/lib/cache/event-cache';
import { LITE_TTL } from '@/lib/cache/lite-cache';

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
    linkedExamId: data.linkedExamId,
    examIntegration: data.examIntegration,
    isRecurringInstance: data.isRecurringInstance || false,
    parentEventId: data.parentEventId,
    recurrence: data.recurrence || { frequency: 'None' },
    reminders: data.reminders || [],
    notificationsSent: data.notificationsSent || [],
    sendReminders: data.sendReminders !== false,
    colorCode: data.colorCode || '#3b82f6',
    requiresApproval: data.requiresApproval || false,
    approvedBy: data.approvedBy,
    approvalStatus: data.approvalStatus,
    approvedByName: data.approvedByName,
    approvedAt: data.approvedAt ? timestampToDateString(data.approvedAt) : undefined,
    rejectionReason: data.rejectionReason,
    requiresAttendance: data.requiresAttendance || false,
    expectedAttendees: data.expectedAttendees || [],
    actualAttendees: data.actualAttendees || [],
    attendanceNotes: data.attendanceNotes,
    isPublic: data.isPublic !== false,
    tags: data.tags || [],
    attachments: data.attachments || [],
    relatedLinks: data.relatedLinks || [],
    customFields: data.customFields || {},
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    createdAt: data.createdAt ? timestampToDateString(data.createdAt) : new Date().toISOString(),
    updatedAt: data.updatedAt ? timestampToDateString(data.updatedAt) : undefined,
    updatedBy: data.updatedBy,
    updatedByName: data.updatedByName,
  };
};

const convertLocalEvent = (id: string, data: Record<string, unknown>): Event =>
  convertFirestoreEvent({
    id,
    data: () => ({
      ...data,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  });

// Convert Event data to Firestore format
const convertToFirestoreData = (
  eventData: CreateEventData | UpdateEventData,
): Record<string, any> => {
  const isCreate = 'createdBy' in eventData;
  const data: any = { updatedAt: serverTimestamp() };

  const copyDefined = (field: keyof Event, fallback?: unknown) => {
    const value = (eventData as any)[field];
    if (value !== undefined) data[field] = value;
    else if (isCreate && fallback !== undefined) data[field] = fallback;
  };

  copyDefined('title');
  copyDefined('type');
  copyDefined('priority');
  copyDefined('status');
  copyDefined('isAllDay', false);
  copyDefined('targetAudience', []);
  copyDefined('isExamEvent', false);
  copyDefined('isRecurringInstance', false);
  copyDefined('recurrence', { frequency: 'None' });
  copyDefined('reminders', []);
  copyDefined('sendReminders', true);
  copyDefined('colorCode', '#3b82f6');
  copyDefined('requiresApproval', false);
  copyDefined('requiresAttendance', false);
  copyDefined('isPublic', true);

  // Only add fields that have actual values (not undefined, null, or empty strings)
  if (eventData.description !== undefined) {
    data.description = eventData.description;
  }

  if (eventData.location !== undefined) {
    data.location = eventData.location;
  }

  if (eventData.academicYearId !== undefined) {
    data.academicYearId = eventData.academicYearId;
  }

  if (eventData.termId !== undefined) {
    data.termId = eventData.termId;
  }

  if (eventData.classIds !== undefined) {
    data.classIds = eventData.classIds;
  }

  if (eventData.subjectIds !== undefined) {
    data.subjectIds = eventData.subjectIds;
  }

  if (eventData.parentEventId) {
    data.parentEventId = eventData.parentEventId;
  }

  if (eventData.linkedExamId) {
    data.linkedExamId = eventData.linkedExamId;
  }

  if (eventData.examIntegration) {
    data.examIntegration = eventData.examIntegration;
  }

  if (eventData.expectedAttendees !== undefined) {
    data.expectedAttendees = eventData.expectedAttendees;
  }

  if ('actualAttendees' in eventData && eventData.actualAttendees !== undefined) {
    data.actualAttendees = eventData.actualAttendees;
  }

  if (eventData.attendanceNotes !== undefined) {
    data.attendanceNotes = eventData.attendanceNotes;
  }

  if (eventData.tags !== undefined) {
    data.tags = eventData.tags;
  }

  if (eventData.attachments !== undefined) {
    data.attachments = eventData.attachments;
  }

  if (eventData.customFields !== undefined) {
    data.customFields = eventData.customFields;
  }

  // Handle dates - store as plain YYYY-MM-DD strings to avoid timezone shift.
  // Using Timestamp.fromDate with a local midnight Date would store UTC time,
  // which in UTC+3 is the previous day's 21:00 — causing an off-by-one display bug.
  if (eventData.startDate) {
    // Store as plain string, e.g. "2026-02-10"
    data.startDate = eventData.startDate;

    // Only add startTime if it has a value
    if (eventData.startTime !== undefined) {
      data.startTime = eventData.startTime;
    }
  }

  if (eventData.endDate) {
    // Store as plain string, e.g. "2026-02-11"
    data.endDate = eventData.endDate;

    // Only add endTime if it has a value
    if (eventData.endTime !== undefined) {
      data.endTime = eventData.endTime;
    }
  }

  // Add creation fields for new events
  if ('createdBy' in eventData) {
    data.createdBy = eventData.createdBy;
    data.createdAt = serverTimestamp();
  }

  // UpdateEventData is partial. Never send undefined values to Firestore,
  // otherwise a small edit (for example an exam date) can fail because fields
  // unrelated to that edit were included as undefined.
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Record<string, any>;
};

const eventsBaseCacheKey = (scope: string) => ['events', 'base', scope] as const;

function getCachedEvents(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: string,
): Event[] | undefined {
  if (!scope) return undefined;
  const inMemory = queryClient.getQueryData<Event[]>(eventsBaseCacheKey(scope));
  if (inMemory) return inMemory;

  return readEventCache(scope)?.data;
}

function writeCachedEvents(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: string,
  revision: number,
  events: Event[],
) {
  if (!scope) return;
  queryClient.setQueryData(eventsBaseCacheKey(scope), events);
  writeEventCache(scope, revision, events);
}

function updateFilteredEventQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: string,
  events: Event[],
  role?: string,
) {
  const filteredQueries = queryClient.getQueryCache().findAll({
    predicate: candidate =>
      candidate.queryKey[0] === 'events' &&
      candidate.queryKey[1] === 'filtered' &&
      candidate.queryKey[2] === scope,
  });
  filteredQueries.forEach(candidate => {
    queryClient.setQueryData(
      candidate.queryKey,
      applyEventFilters(
        events,
        candidate.queryKey[3] as EventFilters | undefined,
        role,
      ),
    );
  });
}

// Get all events with proper error handling
export function useEvents(filters?: EventFilters) {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const [refreshEpoch, setRefreshEpoch] = useState(0);
  const scope = isAuthenticated
    ? getEventCacheScope(user?.id, user?.role, user?.familyId)
    : '';
  const currentRevision = revisionsQuery.data?.events ?? 0;
  const revisionsReady = revisionsQuery.data !== undefined;
  const persisted = readEventCache(scope);
  const cacheMetadata = readEventCacheMetadata(scope);
  const cacheIsFresh = !!cacheMetadata &&
    Date.now() - cacheMetadata.writtenAt < LITE_TTL.events;
  const revisionMatches = !revisionsReady || persisted?.revision === currentRevision;

  useEffect(() => {
    if (!cacheMetadata) return;
    const refreshIn = Math.max(cacheMetadata.writtenAt + LITE_TTL.events - Date.now(), 0);
    const timer = window.setTimeout(() => setRefreshEpoch(epoch => epoch + 1), refreshIn + 50);
    return () => window.clearTimeout(timer);
  }, [cacheMetadata?.writtenAt, refreshEpoch]);

  // 🚀 CRITICAL: Read from GlobalDataPreloader's pre-populated cache immediately
  const cachedData = getCachedEvents(queryClient, scope);
  const canUseCachedData = cacheIsFresh && revisionMatches;
  const hasUsableCachedData = canUseCachedData && cachedData !== undefined;

  return useQuery({
    queryKey: [
      'events',
      'filtered',
      scope,
      filters,
      'revision',
      currentRevision,
      revisionsReady ? 'ready' : 'pending',
      refreshEpoch,
    ],
    // A warm calendar paints without a read. A genuinely cold calendar may
    // fetch before revisions arrive so settings-listener trouble cannot freeze
    // the page; a later non-zero revision will reconcile through a new key.
    enabled: !!scope && (revisionsReady || !hasUsableCachedData),
    queryFn: async () => {
      const currentCache = getCachedEvents(queryClient, scope);
      if (canUseCachedData && currentCache) {
        queryClient.setQueryData(eventsBaseCacheKey(scope), currentCache);
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ useEvents: Using ${currentCache.length} events from preloader cache`);
        }
        // Apply client-side filters and return immediately
        return applyEventFilters(currentCache, filters, user?.role);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useEvents: No cache, fetching from server...');
      }

      try {
        const eventsCollection = collection(db, EVENTS_COLLECTION);
        // Parent caches must never materialise staff/private events. Avoid an
        // orderBy here so this privacy boundary needs no composite index.
        const q = user?.role === 'Parent'
          ? query(eventsCollection, where('isPublic', '==', true))
          : query(eventsCollection, orderBy('startDate', 'desc'));
        const snapshot = revisionsReady
          ? await getDocsFromServer(q)
          : await getDocs(q);
        const events = snapshot.docs
          .map(convertFirestoreEvent)
          .filter(event => user?.role !== 'Parent' || event.isPublic)
          .sort((a, b) => b.startDate.localeCompare(a.startDate));

        writeCachedEvents(
          queryClient,
          scope,
          revisionsReady ? currentRevision : -1,
          events,
        );

        console.log('Events loaded successfully:', events.length);
        return applyEventFilters(events, filters, user?.role);
      } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
    },
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000, // 1 hour cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    // 🚀 Use pre-populated cache as initialData for zero-delay rendering
    initialData: () => {
      if (canUseCachedData && cachedData) {
        return applyEventFilters(cachedData, filters, user?.role);
      }
      return undefined;
    },
    placeholderData: (previousData) => {
      if (canUseCachedData && cachedData) {
        return applyEventFilters(cachedData, filters, user?.role);
      }
      return previousData;
    },
    retry: 1,
  });
}

// Helper: apply all event filters client-side without round-tripping to Firestore
function applyEventFilters(events: Event[], filters?: EventFilters, role?: string): Event[] {
  let result = role === 'Parent' ? events.filter(event => event.isPublic) : events;
  if (!filters) return result;

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
  const eventsQuery = useEvents();
  const data = useMemo(
    () => eventsQuery.data?.find(event => event.id === eventId),
    [eventId, eventsQuery.data],
  );

  return {
    ...eventsQuery,
    data,
    isLoading: !!eventId && eventsQuery.isLoading,
  };
}

// Create event
export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const currentRevision = revisionsQuery.data?.events ?? 0;
  const scope = getEventCacheScope(user?.id, user?.role, user?.familyId);
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (eventData: CreateEventData) => {
      try {
        const data = convertToFirestoreData({
          ...eventData,
          createdBy: eventData.createdBy || user?.id || '',
        });

        const docRef = doc(collection(db, EVENTS_COLLECTION));
        const batch = writeBatch(db);
        batch.set(docRef, data);
        bumpEventsRevisionInBatch(batch);
        await batch.commit();
        return convertLocalEvent(docRef.id, {
          ...eventData,
          createdBy: eventData.createdBy || user?.id || '',
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error creating event:', error);
        throw error;
      }
    },
    onSuccess: (newEvent) => {
      // 🚀 Directly push the new event into the master cache for instant UI update
      // This eliminates the need for a Firestore re-fetch
      const existing = getCachedEvents(queryClient, scope);
      if (existing) {
        const updated = [newEvent, ...existing.filter(event => event.id !== newEvent.id)];
        writeCachedEvents(queryClient, scope, currentRevision + 1, updated);
        updateFilteredEventQueries(queryClient, scope, updated, user?.role);
      }
      queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'none' });
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
  const { user } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const currentRevision = revisionsQuery.data?.events ?? 0;
  const scope = getEventCacheScope(user?.id, user?.role, user?.familyId);
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: UpdateEventData }) => {
      try {
        const docRef = doc(db, EVENTS_COLLECTION, eventId);
        const firestoreData = convertToFirestoreData(data);
        const cachedEvent = getCachedEvents(queryClient, scope)?.find(event => event.id === eventId);
        const existingEvent = cachedEvent ?? convertFirestoreEvent(await getDoc(docRef));
        const batch = writeBatch(db);
        batch.update(docRef, firestoreData);

        if (existingEvent.isExamEvent && existingEvent.examIntegration?.examIds) {
          const examIds = existingEvent.examIntegration.examIds;
          if (examIds.length > 498) {
            throw new Error('This event has too many linked exams for an atomic update.');
          }
          const examUpdateData: Record<string, any> = {
            updatedAt: serverTimestamp(),
          };
          if (data.title !== undefined) examUpdateData.name = data.title;
          if (data.startDate !== undefined) examUpdateData.startDate = data.startDate;
          if (data.endDate !== undefined) examUpdateData.endDate = data.endDate;
          if (data.startTime !== undefined) examUpdateData.startTime = data.startTime;
          if (data.endTime !== undefined) examUpdateData.endTime = data.endTime;
          if (data.location !== undefined) examUpdateData.location = data.location;
          if (data.description !== undefined) examUpdateData.instructions = data.description;
          examIds.forEach(examId => {
            batch.update(doc(db, 'exams', examId), examUpdateData);
          });
        }

        bumpEventsRevisionInBatch(batch);
        await batch.commit();
        const updatedEvent = {
          ...existingEvent,
          ...data,
          id: eventId,
          updatedAt: new Date().toISOString(),
        } as Event;
        return updatedEvent;
      } catch (error) {
        console.error('Error updating event:', error);
        throw error;
      }
    },
    onSuccess: (event) => {
      // 🚀 Directly replace the updated event in the master cache for instant UI update
      const existing = getCachedEvents(queryClient, scope);
      if (existing) {
        const hasEvent = existing.some(cachedEvent => cachedEvent.id === event.id);
        const updated = hasEvent
          ? existing.map(cachedEvent => cachedEvent.id === event.id ? event : cachedEvent)
          : [event, ...existing];
        writeCachedEvents(queryClient, scope, currentRevision + 1, updated);
        updateFilteredEventQueries(queryClient, scope, updated, user?.role);
      }
      // Notify all filtered-query observers to re-render from the updated master cache
      queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'none' });

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
  const { user } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const currentRevision = revisionsQuery.data?.events ?? 0;
  const scope = getEventCacheScope(user?.id, user?.role, user?.familyId);
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

          const examDocRef = doc(db, 'exams', actualExamId);
          const examDoc = await getDoc(examDocRef);

          if (!examDoc.exists()) {
            console.error('Exam not found in database:', actualExamId);
            throw new Error(`Exam not found: ${actualExamId}`);
          }

          const batch = writeBatch(db);
          batch.delete(examDocRef);
          bumpEventsRevisionInBatch(batch);
          await batch.commit();
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

          throw new Error(`Event not found: ${eventId}`);
        }

        const eventData = eventDoc.data();
        const batch = writeBatch(db);

        // If it's an exam event, delete associated exams in the same commit.
        if (eventData?.isExamEvent && eventData?.examIntegration?.examIds) {
          const examIds = eventData.examIntegration.examIds as string[];
          if (examIds.length > 498) {
            throw new Error('This event has too many linked exams for an atomic delete.');
          }
          console.log('Deleting associated exams:', examIds);
          examIds.forEach((examId: string) => {
            batch.delete(doc(db, 'exams', examId));
          });
        }

        batch.delete(eventDocRef);
        bumpEventsRevisionInBatch(batch);
        await batch.commit();
        console.log(`Deleted event: ${eventId}`);

        return eventId;
      } catch (error) {
        console.error('Error deleting event:', error);
        throw error;
      }
    },
    onSuccess: (deletedId) => {
      // 🚀 Directly remove the deleted event from the master cache for instant UI update
      const existing = getCachedEvents(queryClient, scope);
      if (existing) {
        // deletedId may have 'exam-' prefix - strip it for comparison
        const cleanId = typeof deletedId === 'string' ? deletedId.replace('exam-', '') : deletedId;
        const filtered = existing.filter(e => e.id !== deletedId && e.id !== cleanId);
        writeCachedEvents(queryClient, scope, currentRevision + 1, filtered);
        updateFilteredEventQueries(queryClient, scope, filtered, user?.role);
      }
      // Notify all filtered-query observers to re-render from the updated master cache
      queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'none' });
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
  return useEvents({ types: [type] });
}

// Get exam events (for integration with exams component)
export function useExamEvents() {
  return useEvents({ isExamEvent: true });
}

// Get all exams and convert them to events (for testing)
export function useExamsAsEvents(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const { data: academicYears = [], isLoading: yearsLoading } = useAcademicYears();
  const { data: classes = [], isLoading: classesLoading } = useClasses();
  const { data: subjects = [], isLoading: subjectsLoading } = useSubjects();
  const eventsQuery = useEvents();
  const revisionsQuery = useDashboardDataRevisions();
  const [refreshEpoch, setRefreshEpoch] = useState(0);
  const revision = revisionsQuery.data?.events ?? 0;
  const revisionsReady = revisionsQuery.data !== undefined;
  const scope = isAuthenticated
    ? getEventCacheScope(user?.id, user?.role, user?.familyId)
    : '';
  const persisted = readLegacyExamEventCache(scope);
  const cacheMetadata = readLegacyExamEventCacheMetadata(scope);
  const initialData = persisted?.revision === revision ? persisted.data : undefined;

  useEffect(() => {
    if (!cacheMetadata) return;
    const refreshIn = Math.max(cacheMetadata.writtenAt + LITE_TTL.events - Date.now(), 0);
    const timer = window.setTimeout(() => setRefreshEpoch(epoch => epoch + 1), refreshIn + 50);
    return () => window.clearTimeout(timer);
  }, [cacheMetadata?.writtenAt, refreshEpoch]);

  return useQuery({
    queryKey: [
      'exams-as-events',
      scope,
      revision,
      revisionsReady ? 'ready' : 'pending',
      refreshEpoch,
    ],
    enabled:
      (options?.enabled ?? true) &&
      !!scope &&
      !eventsQuery.isLoading &&
      !yearsLoading &&
      !classesLoading &&
      !subjectsLoading,
    queryFn: async () => {
      try {
        // Legacy exam documents have no audience field. Showing an unscoped
        // projection to parents could reveal another class's exam. Parents use
        // only canonical public event documents until legacy exams are migrated.
        if (user?.role === 'Parent') {
          writeLegacyExamEventCache(scope, revision, []);
          return [];
        }

        const regularExamEvents = (eventsQuery.data ?? [])
          .filter((event: any) => event.isExamEvent && event.examIntegration?.examIds);

        // Get exam IDs that are already represented as regular events
        const regularEventExamIds = new Set(
          regularExamEvents.flatMap((event: any) => event.examIntegration.examIds)
        );

        console.log('Regular exam events found:', regularExamEvents.length);
        console.log('Exam IDs already in regular events:', Array.from(regularEventExamIds));

        // Reaching this queryFn means the persisted projection is cold,
        // expired, or revision-mismatched. A generic exams query cache has no
        // revision token, so it cannot authoritatively satisfy this refresh.
        const examsSnapshot = revisionsReady
          ? await getDocsFromServer(collection(db, 'exams'))
          : await getDocs(collection(db, 'exams'));
        const allExams = examsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
            startDate: data.startDate?.toDate?.() || data.startDate,
            endDate: data.endDate?.toDate?.() || data.endDate,
          };
        }) as any[];

        queryClient.setQueryData(['exams', 'list'], allExams);

        // Filter out exams that are already represented as regular events
        const filteredExams = allExams.filter(exam => !regularEventExamIds.has(exam.id));

        console.log('Total exams:', allExams.length);
        console.log('Filtered exams (not in regular events):', filteredExams.length);

        const exams = filteredExams;

        console.log('Loaded classes for exam details:', classes.length);

        console.log('Loaded subjects for exam details:', subjects.length);
        if (subjects.length > 0) {
          console.log('Sample subject data:', subjects[0]);
          console.log('All subject IDs:', subjects.map(s => s.id));
        }

        console.log('Loaded academic years for exam details:', academicYears.length);

        // Convert exams to event format with enhanced details
        const examEvents: Event[] = exams.map((exam: any): Event => {
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
                  return { names: [singleClass.name || 'Unknown Class'], details: [singleClass] };
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
              names: classDetails.map(c => c.name || 'Unknown Class'),
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
                    return { names: [singleSubject.name || 'Unknown Subject'], details: [singleSubject] };
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
                  return { names: [matchingSubject.name], details: [matchingSubject] };
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
                  s.name && s.name.toLowerCase() === subjectId.toLowerCase()
                );
                if (subjectByName) {
                  console.log('✅ Found subject by name instead of ID:', subjectByName);
                  return subjectByName;
                }
                return { id: subjectId, name: subjectId };
              }
            });

            return {
              names: subjectDetails.map(s => s.name || s.id || 'Unknown Subject'),
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

        writeLegacyExamEventCache(scope, revisionsReady ? revision : -1, examEvents);
        console.log('Converted exam events:', examEvents.length);
        return examEvents;
      } catch (error) {
        console.error('Error fetching exams as events:', error);
        throw error;
      }
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    initialData,
  });
}

// Simplified exam integration hooks
export function useCreateEventFromExam() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const currentRevision = revisionsQuery.data?.events ?? 0;
  const scope = getEventCacheScope(user?.id, user?.role, user?.familyId);
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
          linkedExamId: exam.id,
          examIntegration: {
            examIds: [exam.id],
            examName: exam.name,
            examType: exam.examTypeId || exam.examTypeName,
            examNature: exam.examNature,
            maxMarks: exam.maxMarks || 0,
            passingMarks: exam.passingMarks || 0,
            classIds: [exam.classId].filter(Boolean),
          },
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
        const docRef = doc(collection(db, EVENTS_COLLECTION));
        const batch = writeBatch(db);
        batch.set(docRef, data);
        bumpEventsRevisionInBatch(batch);
        await batch.commit();
        return convertLocalEvent(docRef.id, {
          ...eventData,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error creating event from exam:', error);
        throw error;
      }
    },
    onSuccess: (newEvent) => {
      const existing = getCachedEvents(queryClient, scope);
      if (existing) {
        const updated = [newEvent, ...existing.filter(event => event.id !== newEvent.id)];
        writeCachedEvents(queryClient, scope, currentRevision + 1, updated);
        updateFilteredEventQueries(queryClient, scope, updated, user?.role);
      }
      queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'none' });
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
  const { user } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const currentRevision = revisionsQuery.data?.events ?? 0;
  const scope = getEventCacheScope(user?.id, user?.role, user?.familyId);
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
        const batch = writeBatch(db);
        batch.update(docRef, firestoreData);
        bumpEventsRevisionInBatch(batch);
        await batch.commit();

        const cachedEvent = getCachedEvents(queryClient, scope)?.find(event => event.id === eventId);
        return cachedEvent
          ? {
              ...cachedEvent,
              ...eventData,
              id: eventId,
              updatedAt: new Date().toISOString(),
            } as Event
          : convertFirestoreEvent(await getDoc(docRef));
      } catch (error) {
        console.error('Error updating event from exam:', error);
        throw error;
      }
    },
    onSuccess: (updatedEvent) => {
      const existing = getCachedEvents(queryClient, scope);
      if (existing) {
        const hasEvent = existing.some(event => event.id === updatedEvent.id);
        const updated = hasEvent
          ? existing.map(event => event.id === updatedEvent.id ? updatedEvent : event)
          : [updatedEvent, ...existing];
        writeCachedEvents(queryClient, scope, currentRevision + 1, updated);
        updateFilteredEventQueries(queryClient, scope, updated, user?.role);
      }
      queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'none' });
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
  // Academic years are already held live by GlobalDataPreloader. Reusing that
  // single source removes the calendar card's duplicate collection read.
  return useAcademicYears();
}

// Create Exam from Event Hook
export function useCreateExamFromEvent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: classes = [] } = useClasses();
  const { data: subjects = [] } = useSubjects();

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
        const firestoreBatch = writeBatch(db);

        // If existing exam IDs are provided, use them instead of creating new exams
        if (eventData.existingExamIds && eventData.existingExamIds.length > 0) {
          createdExamIds = eventData.existingExamIds;
        } else {
          // Create a single batch ID for all exams
          const batchId = `batch-${Date.now()}`;

          if (eventData.selectedClassIds.length > 498) {
            throw new Error('Too many classes were selected for one atomic exam creation.');
          }

          // Create exam instances for each selected class in the same atomic commit.
          createdExamIds = eventData.selectedClassIds.map((classId) => {
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

            const examRef = doc(collection(db, 'exams'));
            firestoreBatch.set(examRef, {
              ...examData,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            return examRef.id;
          });
        }

        // Resolve labels from the shared class and subject caches. This avoids
        // private collection reads from the event form.
        const classDetails = eventData.selectedClassIds.map(classId => {
          const classData = classes.find(classItem => classItem.id === classId);
          return {
            id: classId,
            name: classData?.name || `Class ${classId}`,
            className: classData?.name || `Class ${classId}`
          };
        });

        // Create subject details with actual subject names (if applicable)
        let subjectDetails: any[] = [];
        if (eventData.examNature === 'Subject based') {
          const allSubjectIds = Array.from(
            new Set(Object.values(eventData.perClassSelectedSubjects).flat()),
          );
          subjectDetails = allSubjectIds.map(subjectId => {
            const subjectData = subjects.find(subject => subject.id === subjectId);
            return {
              id: subjectId,
              name: subjectData?.name || `Subject ${subjectId}`,
              subjectName: subjectData?.name || `Subject ${subjectId}`
            };
          });
        }

        // Create the calendar event and revision marker in the same commit as
        // the exams, so readers can never observe a partially published edit.
        const eventDoc = doc(collection(db, EVENTS_COLLECTION));
        firestoreBatch.set(eventDoc, {
          title: eventData.title,
          description: eventData.description,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          isAllDay: !eventData.startTime && !eventData.endTime,
          location: eventData.location,
          type: 'Academic' as EventType,
          status: 'Scheduled' as EventStatus,
          priority: 'High' as EventPriority,
          targetAudience: classDetails.map(classItem => classItem.name),
          classIds: eventData.selectedClassIds,
          subjectIds: Array.from(
            new Set(Object.values(eventData.perClassSelectedSubjects).flat()),
          ),
          isExamEvent: true,
          isRecurringInstance: false,
          recurrence: { frequency: 'None' },
          reminders: [],
          notificationsSent: [],
          sendReminders: true,
          colorCode: '#dc2626',
          requiresApproval: false,
          requiresAttendance: true,
          isPublic: true,
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
          createdBy: user?.id || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        bumpEventsRevisionInBatch(firestoreBatch);
        await firestoreBatch.commit();
        return { eventId: eventDoc.id, examIds: createdExamIds };
      } catch (error) {
        console.error('Error creating exam from event:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'none' });
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
  const currentDate = useAcademicNow();

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
