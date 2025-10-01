import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AttendanceService } from '@/lib/services/attendance.service';
import type { EnhancedAttendanceRecord, AttendanceRecord } from '@/types';

export function useEnhancedAttendanceByDateRange(
  startDate: string,
  endDate: string,
  academicYearId?: string,
  termId?: string
) {
  return useQuery({
    queryKey: ['enhanced-attendance', 'dateRange', startDate, endDate, academicYearId, termId],
    queryFn: () => AttendanceService.getEnhancedAttendanceByDateRange(
      startDate, 
      endDate, 
      academicYearId, 
      termId
    ),
    enabled: !!startDate && !!endDate,
  });
}

export function useEnhancedAttendanceByPupil(
  pupilId: string,
  academicYearId?: string,
  termId?: string
) {
  return useQuery({
    queryKey: ['enhanced-attendance', 'pupil', pupilId, academicYearId, termId],
    queryFn: () => AttendanceService.getEnhancedAttendanceByPupil(
      pupilId,
      academicYearId,
      termId
    ),
    enabled: !!pupilId,
  });
}

export function useCreateEnhancedAttendanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordData: Omit<AttendanceRecord, 'id' | 'recordedAt'>) =>
      AttendanceService.createEnhancedAttendanceRecord(recordData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
} 