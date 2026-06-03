import { useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSchoolSettings } from './use-school-settings';
import { usePhotos } from './use-photos';
import { collection, query, where, getDocs, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import type { Pupil, Staff, Class } from '@/types';
import { usePupils } from './use-pupils';
import { useStaff } from './use-staff';
import { useClasses } from './use-classes';

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

  // ─── Pupils: derive directly from the global cache — no extra useQuery/useEffect ───
  // The preloader populates ['pupils','list'] via setQueryData. usePupils() subscribes
  // to that key. We filter active pupils here via useMemo only — zero side effects,
  // zero extra setQueryData calls, zero re-render cascades.
  const { data: allPupils = [], isLoading: pupilsLoading, error: pupilsError } = usePupils();

  const pupils = useMemo(() => {
    if (allPupils.length === 0) return [] as Pupil[];
    return allPupils
      .filter(p => p.status === 'Active')
      .map(({ photo, ...pupil }) => pupil as Pupil);
  }, [allPupils]);

  // Stub out refetchPupils — the preloader's live patch listener handles refreshes
  const refetchPupils = () => Promise.resolve();

  // queryClient is still needed for attendance caching below
  const queryClient = useQueryClient();


  // 🚀 USE EXISTING HOOKS: Staff data with real-time listener
  const {
    data: staff = [],
    isLoading: staffLoading,
    error: staffError,
    refetch: refetchStaff
  } = useStaff();

  // 🚀 USE EXISTING HOOKS: Classes data with real-time listener
  const {
    data: classes = [],
    isLoading: classesLoading,
    error: classesError,
    refetch: refetchClasses
  } = useClasses();

  // 🚀 REAL-TIME: Today's attendance data with live updates
  const today = format(new Date(), 'yyyy-MM-dd');

  // Set up real-time listener for today's attendance
  // Keep a ref to classes so the onSnapshot handler can read the latest
  // value without being listed as a useEffect dependency (which would delay
  // the listener setup until classes have loaded).
  const classesRef = useRef(classes);
  useEffect(() => { classesRef.current = classes; }, [classes]);

  useEffect(() => {
    if (!enabled) return;

    if (process.env.NODE_ENV === 'development') {
      console.log('⏱️ POLL: Setting up 2-min attendance poll for', today);
    }

    const startOfDay = Timestamp.fromDate(new Date(today + 'T00:00:00'));
    const endOfDay = Timestamp.fromDate(new Date(today + 'T23:59:59.999'));

    const attendanceQuery = query(
      collection(db, 'attendanceRecords'),
      where('date', '>=', startOfDay),
      where('date', '<=', endOfDay),
      limit(700) // Safety cap: never exceed school capacity
    );

    // ── Shared fetch & process function ───────────────────────────────────
    const fetchAndProcess = async () => {
      try {
        const snapshot = await getDocs(attendanceQuery);
        const rawRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (process.env.NODE_ENV === 'development') {
          console.log(`⏱️ POLL: Fetched ${rawRecords.length} attendance records`);
        }

        // CRITICAL FIX: Deduplicate records by pupilId
        // If a pupil has multiple records for the same day (from re-recording),
        // keep only the latest one (by recordedAt timestamp)
        const dedupMap = new Map<string, any>();
        rawRecords.forEach((record: any) => {
          const key = `${record.pupilId}_${record.classId}`;
          const existing = dedupMap.get(key);
          if (!existing) {
            dedupMap.set(key, record);
          } else {
            const existingTime = existing.recordedAt?.seconds || 0;
            const newTime = record.recordedAt?.seconds || 0;
            if (newTime > existingTime) dedupMap.set(key, record);
          }
        });
        const records = Array.from(dedupMap.values());

        if (process.env.NODE_ENV === 'development' && records.length !== rawRecords.length) {
          console.log(`🔧 DEDUP: Reduced ${rawRecords.length} records to ${records.length} unique pupil records`);
        }

        // Build classId -> className lookup
        const classLookup: Record<string, string> = {};
        classesRef.current.forEach((cls: any) => {
          classLookup[cls.id] = cls.code || cls.name || 'Unknown';
        });

        const present = records.filter((r: any) => r.status === 'Present').length;
        const absent  = records.filter((r: any) => r.status === 'Absent').length;
        const late    = records.filter((r: any) => r.status === 'Late').length;
        const delayed = records.filter((r: any) => r.status === 'Delayed').length;

        const byClass = records.reduce((acc: any, record: any) => {
          const classId = record.classId;
          if (!classId) return acc;
          if (!acc[classId]) {
            acc[classId] = {
              classId,
              className: classLookup[classId] || record.classCode || record.className || classId,
              present: 0, absent: 0, late: 0, delayed: 0, total: 0
            };
          }
          acc[classId].total++;
          if (record.status === 'Present') acc[classId].present++;
          else if (record.status === 'Absent') acc[classId].absent++;
          else if (record.status === 'Late') acc[classId].late++;
          else if (record.status === 'Delayed') acc[classId].delayed++;
          return acc;
        }, {});

        queryClient.setQueryData(dashboardKeys.attendance(today), {
          present, absent, late, delayed,
          total: records.length,
          records,
          byClass: Object.values(byClass)
        });
      } catch (error: any) {
        console.error('❌ POLL ATTENDANCE ERROR:', error.message);
      }
    };

    // ── Initial fetch on mount ─────────────────────────────────────────────
    fetchAndProcess();

    // ── Poll every 2 minutes ───────────────────────────────────────────────
    const interval = setInterval(fetchAndProcess, 2 * 60 * 1000);

    // ── Instant refresh when user returns to the tab ──────────────────────
    const onFocus = () => {
      if (process.env.NODE_ENV === 'development') console.log('👁️ POLL: Tab focused — refreshing attendance');
      fetchAndProcess();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      if (process.env.NODE_ENV === 'development') {
        console.log('🔌 POLL: Cleaned up attendance poll');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, enabled, queryClient]);


  // 🔧 FIX: Re-hydrate class names in cached attendanceData once classes load.
  // This closes the timing race: if the snapshot fired before classes were available,
  // class names in byClass may be stored as classIds (placeholders). When classes
  // finally arrive, we re-resolve all class names in the cached data.
  useEffect(() => {
    if (!classes || classes.length === 0) return;
    const cached = queryClient.getQueryData<any>(dashboardKeys.attendance(today));
    if (!cached?.byClass) return;

    const classLookup: Record<string, string> = {};
    classes.forEach((cls: any) => {
      classLookup[cls.id] = cls.code || cls.name || 'Unknown';
    });

    // Check if any byClass entry still has its classId as the className (placeholder)
    const needsUpdate = cached.byClass.some(
      (c: any) => c.className === c.classId || c.className === 'Unknown'
    );
    if (!needsUpdate) return;

    const updatedByClass = cached.byClass.map((c: any) => ({
      ...c,
      className: classLookup[c.classId] || c.className
    }));

    queryClient.setQueryData(dashboardKeys.attendance(today), {
      ...cached,
      byClass: updatedByClass
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 RE-HYDRATE: Resolved class names in cached attendanceData');
    }
  }, [classes, queryClient, today]);

  // Query with initial data from cache
  const {
    data: attendanceData,
    isLoading: attendanceLoading,
    error: attendanceError,
    refetch: refetchAttendance
  } = useQuery({
    queryKey: dashboardKeys.attendance(today),
    queryFn: async () => {
      // Check cache first
      const cachedData = queryClient.getQueryData(dashboardKeys.attendance(today));
      if (cachedData) {
        if (process.env.NODE_ENV === 'development') {
          console.log('⚡ Using cached attendance data');
        }
        return cachedData;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📊 DASHBOARD: Fetching today\'s attendance from server...');
      }

      try {
        const startOfDay = Timestamp.fromDate(new Date(today + 'T00:00:00'));
        const endOfDay = Timestamp.fromDate(new Date(today + 'T23:59:59.999'));

        const attendanceQuery = query(
          collection(db, 'attendanceRecords'),
          where('date', '>=', startOfDay),
          where('date', '<=', endOfDay)
        );

        const snapshot = await getDocs(attendanceQuery);
        const rawRecords = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // CRITICAL FIX: Deduplicate records by pupilId
        const dedupMap = new Map<string, any>();
        rawRecords.forEach((record: any) => {
          const key = `${record.pupilId}_${record.classId}`;
          const existing = dedupMap.get(key);
          if (!existing) {
            dedupMap.set(key, record);
          } else {
            const existingTime = existing.recordedAt?.seconds || 0;
            const newTime = record.recordedAt?.seconds || 0;
            if (newTime > existingTime) {
              dedupMap.set(key, record);
            }
          }
        });
        const records = Array.from(dedupMap.values());

        const classLookup: Record<string, string> = {};
        classes.forEach((cls: any) => {
          classLookup[cls.id] = cls.code || cls.name || 'Unknown';
        });

        const present = records.filter((r: any) => r.status === 'Present').length;
        const absent = records.filter((r: any) => r.status === 'Absent').length;
        const late = records.filter((r: any) => r.status === 'Late').length;
        const delayed = records.filter((r: any) => r.status === 'Delayed').length;

        const byClass = records.reduce((acc: any, record: any) => {
          const classId = record.classId;
          if (!classId) return acc;

          if (!acc[classId]) {
            acc[classId] = {
              classId,
              className: classLookup[classId] || record.classCode || record.className || classId,
              present: 0,
              absent: 0,
              late: 0,
              delayed: 0,
              total: 0
            };
          }

          acc[classId].total++;
          if (record.status === 'Present') acc[classId].present++;
          else if (record.status === 'Absent') acc[classId].absent++;
          else if (record.status === 'Late') acc[classId].late++;
          else if (record.status === 'Delayed') acc[classId].delayed++;

          return acc;
        }, {});

        return {
          present,
          absent,
          late,
          delayed,
          total: records.length,
          records,
          byClass: Object.values(byClass)
        };
      } catch (error) {
        console.error('❌ Error fetching attendance:', error);
        return {
          present: 0,
          absent: 0,
          late: 0,
          delayed: 0,
          total: 0,
          records: [],
          byClass: []
        };
      }
    },
    enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes - attendance doesn't change frequently
    gcTime: 60 * 60 * 1000, // 60 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: false, // Real-time listener handles updates
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
    initialData: () => {
      const cached = queryClient.getQueryData(dashboardKeys.attendance(today));
      return cached || undefined;
    },
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
      presentToday: (attendanceData as any)?.present || 0,
      absentToday: (attendanceData as any)?.absent || 0,
      lateToday: (attendanceData as any)?.late || 0,
      delayedToday: (attendanceData as any)?.delayed || 0,
      attendanceTotal: (attendanceData as any)?.total || 0,
    };
  }, [pupils, staff, classes, attendanceData]);

  // Split loading states for better UX
  // Basic stats (pupils, staff, classes) load independently from attendance
  const basicStatsLoading = pupilsLoading || staffLoading || classesLoading;
  const isLoading = basicStatsLoading || attendanceLoading; // Keep for backward compatibility
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
    basicStatsLoading, // For first 4 cards (pupils, staff, classes)
    pupilsLoading,
    staffLoading,
    classesLoading,
    attendanceLoading, // For attendance cards
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

