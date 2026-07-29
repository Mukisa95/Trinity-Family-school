import { useMemo } from 'react';
import { format } from 'date-fns';
import { useSchoolSettings } from './use-school-settings';
import { usePhotos } from './use-photos';
import type { Pupil } from '@/types';
import { usePupils } from './use-pupils';
import { useStaff } from './use-staff';
import { useClasses } from './use-classes';
import { useAttendanceSummary } from './use-attendance-summary';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  pupils: () => [...dashboardKeys.all, 'pupils'] as const,
  staff: () => [...dashboardKeys.all, 'staff'] as const,
  classes: () => [...dashboardKeys.all, 'classes'] as const,
  attendance: (date: string) => [...dashboardKeys.all, 'attendance', date] as const,
};

interface UseDashboardDataOptions {
  enabled?: boolean;
}

/**
 * Dashboard data owner. Attendance is deliberately not a live collection
 * listener: today's pupil-level projection is restored from local cache and
 * reconciled only when its shared publication revision changes.
 */
export function useDashboardData({ enabled = true }: UseDashboardDataOptions = {}) {
  const { data: allPupils = [], isLoading: pupilsLoading, error: pupilsError } = usePupils();
  const pupils = useMemo(() => allPupils
    .filter(pupil => pupil.status === 'Active')
    .map(({ photo, ...pupil }) => pupil as Pupil), [allPupils]);
  const refetchPupils = () => Promise.resolve();

  const {
    data: staff = [],
    isLoading: staffLoading,
    error: staffError,
    refetch: refetchStaff,
  } = useStaff();
  const {
    data: classes = [],
    isLoading: classesLoading,
    error: classesError,
    refetch: refetchClasses,
  } = useClasses();

  const today = format(new Date(), 'yyyy-MM-dd');
  const attendanceSummary = useAttendanceSummary(today, enabled);
  const attendanceData = useMemo(() => {
    const classLookup = new Map(classes.map(cls => [cls.id, cls.code || cls.name]));
    const records = attendanceSummary.data.records.map(record => ({
      ...record,
      className: classLookup.get(record.classId) || record.className,
    }));
    const byClass = attendanceSummary.data.byClass.map(item => ({
      ...item,
      className: classLookup.get(item.classId) || item.className,
    }));
    return { ...attendanceSummary.data, records, byClass };
  }, [attendanceSummary.data, classes]);
  const attendanceLoading = attendanceSummary.isLoading;
  const attendanceError = attendanceSummary.error;
  const refetchAttendance = async () => { await attendanceSummary.refetch(); };

  const { data: schoolSettings, isLoading: settingsLoading } = useSchoolSettings();
  const { data: photos, isLoading: photosLoading } = usePhotos();

  const stats = useMemo(() => {
    const malePupils = pupils.filter(pupil => pupil.gender === 'Male');
    const femalePupils = pupils.filter(pupil => pupil.gender === 'Female');
    return {
      totalPupils: pupils.length,
      malePupils: malePupils.length,
      femalePupils: femalePupils.length,
      totalStaff: staff.length,
      totalClasses: classes.length,
      presentToday: attendanceData.present,
      absentToday: attendanceData.absent,
      lateToday: attendanceData.late,
      delayedToday: attendanceData.delayed,
      attendanceTotal: attendanceData.total,
    };
  }, [attendanceData, classes.length, pupils, staff.length]);

  const basicStatsLoading = pupilsLoading || staffLoading;
  const isLoading = basicStatsLoading || attendanceLoading;
  const hasError = pupilsError || staffError || classesError || attendanceError;

  const refetchAll = async () => {
    await Promise.all([
      refetchPupils(),
      refetchStaff(),
      refetchClasses(),
      refetchAttendance(),
    ]);
  };

  return {
    pupils,
    staff,
    classes,
    attendanceData,
    schoolSettings,
    photos,
    stats,
    isLoading,
    basicStatsLoading,
    pupilsLoading,
    staffLoading,
    classesLoading,
    attendanceLoading,
    settingsLoading,
    photosLoading,
    hasError,
    pupilsError,
    staffError,
    classesError,
    attendanceError,
    refetchAll,
    refetchPupils,
    refetchStaff,
    refetchClasses,
    refetchAttendance,
  };
}
