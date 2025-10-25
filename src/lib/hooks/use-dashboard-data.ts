import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PupilsService } from '../services/pupils.service';
import { StaffService } from '../services/staff.service';
import { ClassesService } from '../services/classes.service';
import { useSchoolSettings } from './use-school-settings';
import { usePhotos } from './use-photos';
import { collection, query, where, getDocs, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import type { Pupil, Staff, Class } from '@/types';

/**
 * 🚀 OPTIMIZED DASHBOARD DATA HOOK
 * 
 * Uses React Query with proper caching to prevent re-fetching on navigation.
 * Data is cached for 10 minutes and persists across page navigation.
 * Only refetches when explicitly invalidated or after cache expires.
 */

// Dashboard query keys
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

export function useDashboardData({ enabled = true }: UseDashboardDataOptions = {}) {
  
  // 🚀 CACHED: Active pupils - only fetched once, then cached
  const { 
    data: pupils = [], 
    isLoading: pupilsLoading,
    error: pupilsError,
    refetch: refetchPupils
  } = useQuery({
    queryKey: dashboardKeys.pupils(),
    queryFn: async () => {
      console.log('📊 DASHBOARD: Fetching active pupils (will cache for 10 min)');
      return await PupilsService.getActivePupils();
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - data stays fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache even when unmounted
    refetchOnMount: false, // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });

  // 🚀 CACHED: Staff data
  const { 
    data: staff = [], 
    isLoading: staffLoading,
    error: staffError,
    refetch: refetchStaff
  } = useQuery({
    queryKey: dashboardKeys.staff(),
    queryFn: async () => {
      console.log('📊 DASHBOARD: Fetching staff (will cache for 10 min)');
      return await StaffService.getAllStaff();
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // 🚀 CACHED: Classes data (needed for charts)
  const { 
    data: classes = [], 
    isLoading: classesLoading,
    error: classesError,
    refetch: refetchClasses
  } = useQuery({
    queryKey: dashboardKeys.classes(),
    queryFn: async () => {
      console.log('📊 DASHBOARD: Fetching classes (will cache for 10 min)');
      return await ClassesService.getAll();
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // 🚀 CACHED: Today's attendance data
  const today = format(new Date(), 'yyyy-MM-dd');
  const { 
    data: attendanceData, 
    isLoading: attendanceLoading,
    error: attendanceError,
    refetch: refetchAttendance
  } = useQuery({
    queryKey: dashboardKeys.attendance(today),
    queryFn: async () => {
      console.log('📊 DASHBOARD: Fetching today\'s attendance (will cache for 5 min)', { today });
      
      try {
        // Convert date string to Timestamp for querying
        const startOfDay = Timestamp.fromDate(new Date(today + 'T00:00:00'));
        const endOfDay = Timestamp.fromDate(new Date(today + 'T23:59:59.999Z'));
        
        // Fetch today's attendance records using Timestamp comparison
        const attendanceQuery = query(
          collection(db, 'attendanceRecords'),
          where('date', '>=', startOfDay),
          where('date', '<=', endOfDay)
        );
        
        const snapshot = await getDocs(attendanceQuery);
        console.log('✅ Fetched', snapshot.docs.length, 'attendance records for', today);
        
        const records = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Count present and absent
        const present = records.filter(r => r.status === 'Present').length;
        const absent = records.filter(r => r.status === 'Absent').length;
        const late = records.filter(r => r.status === 'Late').length;

        // Group by class for breakdown
        const byClass = records.reduce((acc: any, record: any) => {
          const classId = record.classId;
          if (!classId) return acc;
          
          if (!acc[classId]) {
            acc[classId] = {
              classId,
              className: record.className || record.classCode || 'Unknown',
              present: 0,
              absent: 0,
              late: 0,
              total: 0
            };
          }
          
          acc[classId].total++;
          if (record.status === 'Present') acc[classId].present++;
          else if (record.status === 'Absent') acc[classId].absent++;
          else if (record.status === 'Late') acc[classId].late++;
          
          return acc;
        }, {});

        return {
          present,
          absent,
          late,
          total: records.length,
          records,
          byClass: Object.values(byClass)
        };
      } catch (error) {
        console.error('❌ Error fetching attendance:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: (error as any)?.code,
          today
        });
        return {
          present: 0,
          absent: 0,
          late: 0,
          total: 0,
          records: [],
          byClass: []
        };
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - attendance changes throughout the day
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: true, // Refetch when window gains focus (to get latest attendance)
    refetchOnReconnect: false,
  });

  // School settings and photos (already properly cached)
  const { data: schoolSettings, isLoading: settingsLoading } = useSchoolSettings();
  const { data: photos, isLoading: photosLoading } = usePhotos();

  // Calculate statistics
  const stats = useMemo(() => {
    const activePupils = pupils; // Already filtered at database level
    const malePupils = activePupils.filter(p => p.gender === 'Male');
    const femalePupils = activePupils.filter(p => p.gender === 'Female');

    return {
      totalPupils: activePupils.length,
      malePupils: malePupils.length,
      femalePupils: femalePupils.length,
      totalStaff: staff.length,
      totalClasses: classes.length,
      presentToday: attendanceData?.present || 0,
      absentToday: attendanceData?.absent || 0,
      lateToday: attendanceData?.late || 0,
      attendanceTotal: attendanceData?.total || 0,
    };
  }, [pupils, staff, classes, attendanceData]);

  // Overall loading state
  const isLoading = pupilsLoading || staffLoading || classesLoading || attendanceLoading;
  const hasError = pupilsError || staffError || classesError || attendanceError;

  // Refetch all data function
  const refetchAll = async () => {
    console.log('🔄 DASHBOARD: Manually refetching all data');
    await Promise.all([
      refetchPupils(),
      refetchStaff(),
      refetchClasses(),
      refetchAttendance(),
    ]);
  };

  return {
    // Data
    pupils,
    staff,
    classes,
    attendanceData,
    schoolSettings,
    photos,
    stats,

    // Loading states
    isLoading,
    pupilsLoading,
    staffLoading,
    classesLoading,
    attendanceLoading,
    settingsLoading,
    photosLoading,

    // Error states
    hasError,
    pupilsError,
    staffError,
    classesError,
    attendanceError,

    // Actions
    refetchAll,
    refetchPupils,
    refetchStaff,
    refetchClasses,
    refetchAttendance,
  };
}

