import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  return useQuery({
    queryKey: attendanceKeys.byDateRange(startDate, endDate),
    queryFn: () => AttendanceService.getAttendanceByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}

export function useAttendanceByPupil(pupilId: string) {
  return useQuery({
    queryKey: attendanceKeys.byPupil(pupilId),
    queryFn: () => AttendanceService.getAttendanceByPupil(pupilId),
    enabled: !!pupilId,
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
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (records: Omit<AttendanceRecord, 'id' | 'recordedAt'>[]) => {
      const recordIds = await AttendanceService.bulkCreateAttendanceRecords(records);
      
      // Create digital signatures for bulk attendance recording
      if (user && recordIds.length > 0) {
        // Create a single signature for the bulk operation
        await signAction(
          'attendance_record',
          `bulk_${Date.now()}`, // Use a unique identifier for bulk operations
          'bulk_recorded',
          {
            recordCount: records.length,
            date: records[0]?.date,
            classIds: [...new Set(records.map(r => r.classId))],
            academicYearIds: [...new Set(records.map(r => r.academicYearId))],
            termIds: [...new Set(records.map(r => r.termId))]
          }
        );
      }
      
      return recordIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
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

export function useDeleteAttendanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: AttendanceService.deleteAttendanceRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
} 