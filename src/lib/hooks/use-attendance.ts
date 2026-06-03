import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { collection, query as firestoreQuery, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AttendanceService } from '../services/attendance.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { AttendanceRecord } from '@/types';

// Query Keys
export const attendanceKeys = {
  all: ['attendance'] as const,
  lists: () => [...attendanceKeys.all, 'list'] as const,
  details: () => [...attendanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...attendanceKeys.details(), id] as const,
  byDateRange: (startDate: string, endDate: string) => [...attendanceKeys.all, 'dateRange', startDate, endDate] as const,
  byPupil: (pupilId: string) => [...attendanceKeys.all, 'pupil', pupilId] as const,
};

// Query Hooks
export function useAttendanceRecords() {
  return useQuery({
    queryKey: attendanceKeys.lists(),
    queryFn: AttendanceService.getAllAttendanceRecords,
  });
}

export function useAttendanceRecord(id: string) {
  return useQuery({
    queryKey: attendanceKeys.detail(id),
    queryFn: () => AttendanceService.getAttendanceRecordById(id),
    enabled: !!id,
  });
}

export function useAttendanceByDateRange(startDate: string, endDate: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: attendanceKeys.byDateRange(startDate, endDate),
    queryFn: async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useAttendanceByDateRange: Fetching from Firestore for', startDate);
      }
      return AttendanceService.getAttendanceByDateRange(startDate, endDate);
    },
    enabled: !!startDate && !!endDate,
    // SHORT stale time so today's records are always fresh on page load
    staleTime: 30 * 1000, // 30 seconds — re-fetches if user navigates away and comes back
    gcTime: 30 * 60 * 1000, // Keep in memory 30 minutes
    refetchOnMount: true,  // ALWAYS re-validate on mount so saved statuses are shown
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Show previous / cached data immediately while the fresh fetch runs in background
    placeholderData: (previousData) => previousData,
  });
}

export function useAttendanceByPupil(pupilId: string) {
  const queryClient = useQueryClient();

  // 🚀 BULLETPROOF REAL-TIME LISTENER for pupil's attendance
  useEffect(() => {
    if (!pupilId) return;

    if (process.env.NODE_ENV === 'development') {
      console.log('🎧 REALTIME: Setting up attendance listener for pupil', pupilId);
    }

    let unsubscribe: (() => void) | null = null;
    let isActive = true;
    let listenerFired = false;
    let fallbackTimeout: NodeJS.Timeout | null = null;

    const setupListener = () => {
      if (!isActive) return;

      // 🔧 FIX: Unsubscribe old listener before creating a new one
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      try {
        const attendanceQuery = firestoreQuery(
          collection(db, 'attendanceRecords'),
          where('pupilId', '==', pupilId)
        );

        unsubscribe = onSnapshot(
          attendanceQuery,
          // Removed includeMetadataChanges for faster real-time sync
          (snapshot) => {
            if (!isActive) return;

            listenerFired = true;

            const records = snapshot.docs.map(doc => {
              const data = doc.data();
              // EAT TIMEZONE FIX: Convert Firestore Timestamps to local ISO strings
              // (same logic as AttendanceService) so date comparisons use local time
              let dateValue = data.date;
              if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
                const d = dateValue.toDate();
                const pad = (n: number) => String(n).padStart(2, '0');
                dateValue = (
                  d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
                  'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
                );
              }
              return {
                id: doc.id,
                ...data,
                date: dateValue,
              };
            }) as AttendanceRecord[];

            const fromCache = snapshot.metadata.fromCache;

            if (process.env.NODE_ENV === 'development') {
              console.log(`⚡ REALTIME: Loaded ${records.length} attendance records`, {
                pupilId,
                fromCache,
                source: fromCache ? '📦 cache' : '☁️ server'
              });
            }

            // Update cache
            queryClient.setQueryData(attendanceKeys.byPupil(pupilId), records);
          },
          (error) => {
            if (!isActive) return;
            console.error('❌ REALTIME ATTENDANCE ERROR:', error.message);
          }
        );

        // Fallback: manual fetch if listener doesn't fire
        fallbackTimeout = setTimeout(async () => {
          if (!listenerFired && isActive) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ REALTIME: Attendance listener did not fire, fetching manually...');
            }

            try {
              const records = await AttendanceService.getAttendanceByPupil(pupilId);
              queryClient.setQueryData(attendanceKeys.byPupil(pupilId), records);
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ FALLBACK: Loaded ${records.length} attendance records`);
              }
            } catch (error) {
              console.error('❌ FALLBACK: Attendance fetch failed:', error);
            }
          }
        }, 5000);

      } catch (error) {
        console.error('❌ REALTIME: Failed to setup attendance listener:', error);
      }
    };

    setupListener();

    // Cleanup
    return () => {
      isActive = false;
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (unsubscribe) unsubscribe();

      if (process.env.NODE_ENV === 'development') {
        console.log('🔌 REALTIME: Cleaned up attendance listener');
      }
    };
  }, [pupilId, queryClient]);

  return useQuery({
    queryKey: attendanceKeys.byPupil(pupilId),
    queryFn: async () => {
      // Check cache first
      const cachedData = queryClient.getQueryData<AttendanceRecord[]>(attendanceKeys.byPupil(pupilId));
      if (cachedData) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ useAttendanceByPupil: Using ${cachedData.length} records from cache`);
        }
        return cachedData;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useAttendanceByPupil: No cache, fetching from server...');
      }
      return AttendanceService.getAttendanceByPupil(pupilId);
    },
    enabled: !!pupilId,
    staleTime: 0, // Real-time listener handles updates - no stale time needed
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    initialData: () => {
      const cached = queryClient.getQueryData<AttendanceRecord[]>(attendanceKeys.byPupil(pupilId));
      return cached || undefined;
    },
  });
}

// Mutation Hooks
export function useCreateAttendanceRecord() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (recordData: Omit<AttendanceRecord, 'id' | 'recordedAt'>) => {
      const recordId = await AttendanceService.createAttendanceRecord(recordData);

      // Create digital signature for attendance recording
      if (user) {
        await signAction(
          'attendance_record',
          recordId,
          'recorded',
          {
            pupilId: recordData.pupilId,
            classId: recordData.classId,
            date: recordData.date,
            status: recordData.status,
            academicYearId: recordData.academicYearId,
            termId: recordData.termId
          }
        );
      }

      return recordId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useBulkCreateAttendanceRecords() {
  const queryClient = useQueryClient();
  // Note: digital signature is intentionally fire-and-forget (non-blocking)
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (records: Omit<AttendanceRecord, 'id' | 'recordedAt'>[]) => {
      // Write to Firestore first (fast batch write)
      const recordIds = await AttendanceService.bulkCreateAttendanceRecords(records);

      // Fire-and-forget: create digital signatures in background — don't await
      if (user && recordIds.length > 0) {
        signAction(
          'attendance_record',
          `bulk_${Date.now()}`,
          'bulk_recorded',
          {
            recordCount: records.length,
            date: records[0]?.date,
            classIds: [...new Set(records.map(r => r.classId))],
            academicYearIds: [...new Set(records.map(r => r.academicYearId))],
            termIds: [...new Set(records.map(r => r.termId))]
          }
        ).catch(() => {/* signature failure is non-critical */ });
      }

      return { recordIds, records };
    },
    onSuccess: ({ recordIds, records }) => {
      // Update cache in-place — NO network refetch triggered
      const now = new Date().toISOString();
      const newRecords: AttendanceRecord[] = records.map((r, i) => ({
        ...r,
        id: recordIds[i],
        recordedAt: now,
      }));

      // Merge new records into all matching date-range cache entries
      queryClient.setQueriesData<AttendanceRecord[]>(
        { queryKey: attendanceKeys.all },
        (old) => {
          if (!old) return newRecords;
          // Remove any existing records for same pupil+class+date then add fresh ones
          const existing = old.filter(existing =>
            !newRecords.some(n =>
              n.pupilId === existing.pupilId &&
              n.classId === existing.classId &&
              n.date?.split('T')[0] === existing.date?.split('T')[0]
            )
          );
          return [...existing, ...newRecords];
        }
      );
    },
  });
}

export function useUpdateAttendanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<AttendanceRecord, 'id' | 'recordedAt'>> }) =>
      AttendanceService.updateAttendanceRecord(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() });
    },
  });
}

export function useBulkUpdateAttendanceRecords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; data: Partial<Omit<AttendanceRecord, 'id' | 'recordedAt'>> }[]) => {
      // 🚀 Firestore writeBatch — single network call for all updates
      await AttendanceService.bulkUpdateAttendanceRecords(updates);
      return updates; // Return so onSuccess can update cache
    },
    onSuccess: (updates) => {
      // Update cache in-place — NO network refetch triggered
      queryClient.setQueriesData<AttendanceRecord[]>(
        { queryKey: attendanceKeys.all },
        (old) => {
          if (!old) return old;
          const updateMap = new Map(updates.map(u => [u.id, u.data]));
          return old.map(record =>
            updateMap.has(record.id)
              ? { ...record, ...updateMap.get(record.id) }
              : record
          );
        }
      );
    },
  });
}

export function useDeleteAttendanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: AttendanceService.deleteAttendanceRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
} 