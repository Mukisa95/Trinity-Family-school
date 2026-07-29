import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AttendanceService } from '../services/attendance.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { AttendanceRecord } from '@/types';
import { useAttendanceSummary } from './use-attendance-summary';
import { useDashboardDataRevisions } from './use-school-settings';

export const attendanceKeys = {
  all: ['attendance'] as const,
  lists: () => [...attendanceKeys.all, 'list'] as const,
  details: () => [...attendanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...attendanceKeys.details(), id] as const,
  byDateRange: (scope: string, startDate: string, endDate: string, revision: number) =>
    [...attendanceKeys.all, 'dateRange', scope, startDate, endDate, revision] as const,
  byPupil: (scope: string, pupilId: string, revision: number) =>
    [...attendanceKeys.all, 'pupil', scope, pupilId, revision] as const,
};

export function useAttendanceRecords() {
  return useQuery({ queryKey: attendanceKeys.lists(), queryFn: AttendanceService.getAllAttendanceRecords });
}

export function useAttendanceRecord(id: string) {
  return useQuery({
    queryKey: attendanceKeys.detail(id),
    queryFn: () => AttendanceService.getAttendanceRecordById(id),
    enabled: !!id,
  });
}

/** Daily views use the published summary; historical ranges use a 48-hour query cache. */
export function useAttendanceByDateRange(
  startDate: string,
  endDate: string,
  options: { enabled?: boolean } = {},
) {
  const { user, isAuthenticated } = useAuth();
  const revision = useDashboardDataRevisions().data?.attendance ?? 0;
  const scope = isAuthenticated && user ? `${user.id}:${user.role}` : '';
  const enabled = options.enabled !== false && !!scope;
  const isDaily = !!startDate && startDate === endDate;
  const dailySummary = useAttendanceSummary(startDate, enabled && isDaily);
  const rangeQuery = useQuery({
    queryKey: attendanceKeys.byDateRange(scope, startDate, endDate, revision),
    queryFn: () => AttendanceService.getAttendanceByDateRange(startDate, endDate),
    enabled: enabled && !!startDate && !!endDate && !isDaily,
    staleTime: 48 * 60 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: previousData => previousData,
  });

  if (isDaily) {
    const records = (dailySummary.summary?.records || []).map(record => ({
      id: record.recordId || `summary-${record.classId}-${record.pupilId}`,
      date: startDate,
      classId: record.classId,
      className: record.className,
      classCode: record.classCode,
      pupilId: record.pupilId,
      status: record.status,
      remarks: record.remarks || '',
      recordedAt: record.recordedAt || new Date(0).toISOString(),
    })) as AttendanceRecord[];
    return {
      ...dailySummary,
      data: records,
      isLoading: dailySummary.isLoading,
      isFetching: dailySummary.isLoading,
      isError: !!dailySummary.error,
      error: dailySummary.error,
      refetch: dailySummary.refetch,
    };
  }
  return rangeQuery;
}

/** Pupil history is a cache-first query, never a whole-history live listener. */
export function useAttendanceByPupil(pupilId: string) {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const revision = useDashboardDataRevisions().data?.attendance ?? 0;
  const scope = isAuthenticated && user ? `${user.id}:${user.role}` : '';
  const queryKey = attendanceKeys.byPupil(scope, pupilId, revision);
  return useQuery({
    queryKey,
    queryFn: () => AttendanceService.getAttendanceByPupil(pupilId),
    enabled: !!scope && !!pupilId,
    staleTime: 48 * 60 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: previousData => previousData,
    initialData: () => queryClient.getQueryData<AttendanceRecord[]>(queryKey),
  });
}

export function useCreateAttendanceRecord() {
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (recordData: Omit<AttendanceRecord, 'id' | 'recordedAt'>) => {
      const recordId = await AttendanceService.createAttendanceRecord(recordData);
      if (user) {
        await signAction('attendance_record', recordId, 'recorded', {
          pupilId: recordData.pupilId,
          classId: recordData.classId,
          date: recordData.date,
          status: recordData.status,
          academicYearId: recordData.academicYearId,
          termId: recordData.termId,
        });
      }
      return recordId;
    },
    onSuccess: () => { /* source writes are reconciled by the session summary */ },
  });
}

export function useBulkCreateAttendanceRecords() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (records: Omit<AttendanceRecord, 'id' | 'recordedAt'>[]) => {
      const recordIds = await AttendanceService.bulkCreateAttendanceRecords(records);
      if (user && recordIds.length > 0) {
        signAction('attendance_record', `bulk_${Date.now()}`, 'bulk_recorded', {
          recordCount: records.length,
          date: records[0]?.date,
          classIds: [...new Set(records.map(r => r.classId))],
          academicYearIds: [...new Set(records.map(r => r.academicYearId))],
          termIds: [...new Set(records.map(r => r.termId))],
        }).catch(() => { /* signature failure is non-critical */ });
      }
      return { recordIds, records };
    },
    onSuccess: ({ recordIds, records }) => {
      const now = new Date().toISOString();
      const newRecords: AttendanceRecord[] = records.map((record, index) => ({
        ...record,
        id: recordIds[index],
        recordedAt: now,
      }));
      queryClient.setQueriesData<AttendanceRecord[]>({ queryKey: attendanceKeys.all }, old => {
        if (!Array.isArray(old)) return old;
        const existing = old.filter(current => !newRecords.some(next =>
          next.pupilId === current.pupilId && next.classId === current.classId &&
          next.date?.split('T')[0] === current.date?.split('T')[0]
        ));
        return [...existing, ...newRecords];
      });
    },
  });
}

export function useUpdateAttendanceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<AttendanceRecord, 'id' | 'recordedAt'>> }) =>
      AttendanceService.updateAttendanceRecord(id, data),
    onSuccess: (_, { id, data }) => {
      queryClient.setQueryData<AttendanceRecord | null>(attendanceKeys.detail(id), current =>
        current ? { ...current, ...data } : current);
      queryClient.setQueriesData<AttendanceRecord[]>({ queryKey: attendanceKeys.all }, old =>
        Array.isArray(old) ? old.map(record => record.id === id ? { ...record, ...data } : record) : old);
    },
  });
}

export function useBulkUpdateAttendanceRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; data: Partial<Omit<AttendanceRecord, 'id' | 'recordedAt'>> }[]) => {
      await AttendanceService.bulkUpdateAttendanceRecords(updates);
      return updates;
    },
    onSuccess: updates => {
      queryClient.setQueriesData<AttendanceRecord[]>({ queryKey: attendanceKeys.all }, old => {
        if (!Array.isArray(old)) return old;
        const updateMap = new Map(updates.map(update => [update.id, update.data]));
        return old.map(record => updateMap.has(record.id)
          ? { ...record, ...updateMap.get(record.id) }
          : record);
      });
    },
  });
}

export function useDeleteAttendanceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: AttendanceService.deleteAttendanceRecord,
    onSuccess: (_, id) => {
      queryClient.setQueriesData<AttendanceRecord[]>({ queryKey: attendanceKeys.all }, old =>
        Array.isArray(old) ? old.filter(record => record.id !== id) : old);
    },
  });
}
