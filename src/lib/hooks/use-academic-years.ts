import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AcademicYearsService } from '../services/academic-years.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import { liteRead, liteInvalidate, LITE_KEYS } from '@/lib/cache/lite-cache';
import { detectCurrentAcademicYear } from '@/lib/utils/academic-year-utils';
import type { AcademicYear } from '@/types';

// Helper to convert Firestore timestamps to ISO strings (same logic as service)
const convertTimestampToISO = (timestamp: any): string => {
  if (!timestamp) return '';
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  if (timestamp.seconds && typeof timestamp.seconds === 'number') {
    const date = new Date(timestamp.seconds * 1000);
    if (timestamp.nanoseconds) {
      date.setMilliseconds(timestamp.nanoseconds / 1000000);
    }
    return date.toISOString();
  }
  if (typeof timestamp === 'string') return timestamp;
  if (timestamp instanceof Date) return timestamp.toISOString();
  try {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) return date.toISOString();
  } catch (error) {
    console.warn('Failed to convert timestamp to ISO:', timestamp, error);
  }
  return '';
};

/**
 * Normalise a single academic year so that every date field (including all
 * term startDate / endDate values) is a plain ISO string.
 *
 * WHY: Data can arrive from three sources — Firestore network, Firestore
 * IndexedDB, or localStorage — each of which may return raw Firestore
 * Timestamp objects ({seconds, nanoseconds}) instead of strings.  Running
 * this transform in the `select` option of useQuery ensures the component
 * ALWAYS receives clean strings, no matter which path the data travelled.
 */
const sanitiseYear = (year: AcademicYear): AcademicYear => ({
  ...year,
  startDate: convertTimestampToISO(year.startDate) || year.startDate,
  endDate:   convertTimestampToISO(year.endDate)   || year.endDate,
  terms: (year.terms ?? []).map(term => ({
    ...term,
    startDate: convertTimestampToISO(term.startDate) || term.startDate,
    endDate:   convertTimestampToISO(term.endDate)   || term.endDate,
  })),
});

const ACADEMIC_YEARS_QUERY_KEY = 'academicYears';

export function useAcademicYears() {
  const queryClient = useQueryClient();

  // Read synchronously from lite cache — zero loading flash on warm page loads.
  // Populated by GlobalDataPreloader via its onSnapshot listener.
  const liteYears = liteRead<AcademicYear[]>(LITE_KEYS.academicYears);

  const query = useQuery({
    queryKey: [ACADEMIC_YEARS_QUERY_KEY],
    queryFn: async () => {
      // Always serve from React Query in-memory cache (preloader keeps it fresh)
      const cachedData = queryClient.getQueryData<AcademicYear[]>([ACADEMIC_YEARS_QUERY_KEY]);
      if (cachedData && cachedData.length > 0) return cachedData;

      // Lite cache available but not yet in memory — return it and let the
      // preloader's onSnapshot update us shortly with a real-time value.
      if (liteYears && liteYears.length > 0) return liteYears;

      // Cold start: fetch once. The preloader's listener will take over.
      return AcademicYearsService.getAllAcademicYears();
    },
    // ✅ DEFINITIVE FIX: sanitise every year on the way out of the cache.
    // Converts any lingering Firestore Timestamps in term dates to ISO strings.
    // Runs synchronously, is idempotent, and costs <1 ms for 128 years.
    select: (years) => years.map(sanitiseYear),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    placeholderData: (prev) => prev,
    // Instant data: memory cache wins, then lite sessionStorage, nothing otherwise
    initialData: () => {
      const mem = queryClient.getQueryData<AcademicYear[]>([ACADEMIC_YEARS_QUERY_KEY]);
      if (mem && mem.length > 0) return mem;
      return liteYears || undefined;
    },
    // NOTE: intentionally NOT setting initialDataUpdatedAt — without it React Query
    // treats initialData as immediately stale, allowing the queryFn to run in the
    // background and replace it. Setting it to Date.now() would suppress background
    // fetches for 30 min and lock components into stale cached data.
  });

  // NOTE: NOT setting up an onSnapshot listener here.
  // The GlobalDataPreloader already maintains a real-time listener for academicYears
  // and writes to ['academicYears'] via setQueryData + liteWrite.
  // A second listener here would double the Firestore read quota usage.

  return query;
}

export function useAcademicYear(id: string) {
  const queryClient = useQueryClient();
  const liteYears = liteRead<AcademicYear[]>(LITE_KEYS.academicYears);

  return useQuery({
    queryKey: [ACADEMIC_YEARS_QUERY_KEY, id],
    queryFn: async () => {
      // 🚀 CRITICAL: First check detail cache or list cache
      const cachedYears = queryClient.getQueryData<AcademicYear[]>([ACADEMIC_YEARS_QUERY_KEY]);
      if (cachedYears && cachedYears.length > 0) {
        const found = cachedYears.find(y => y.id === id);
        if (found) return found;
      }
      
      if (liteYears && liteYears.length > 0) {
        const found = liteYears.find(y => y.id === id);
        if (found) return found;
      }
      
      return AcademicYearsService.getAcademicYearById(id);
    },
    enabled: !!id,
    select: (year) => year ? sanitiseYear(year) : year,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    initialData: () => {
      const cachedYears = queryClient.getQueryData<AcademicYear[]>([ACADEMIC_YEARS_QUERY_KEY]) || liteYears;
      if (cachedYears && cachedYears.length > 0) {
        return cachedYears.find(y => y.id === id) || undefined;
      }
      return undefined;
    },
    initialDataUpdatedAt: liteYears ? Date.now() : undefined,
    placeholderData: (previousData) => {
      const cachedYears = queryClient.getQueryData<AcademicYear[]>([ACADEMIC_YEARS_QUERY_KEY]) || liteYears;
      if (cachedYears && cachedYears.length > 0) {
        const found = cachedYears.find(y => y.id === id);
        if (found) return found;
      }
      return previousData;
    }
  });
}

/**
 * Returns the current active academic year derived directly from the
 * `useAcademicYears()` data (the single source of truth kept live by
 * GlobalDataPreloader).  Using a derived hook instead of a separate
 * `['academicYears', 'active']` query prevents the previous bug where
 * `refetchOnMount: false` + `initialDataUpdatedAt: Date.now()` stopped
 * the queryFn (and therefore `detectCurrentAcademicYear`) from ever running.
 */
export function useActiveAcademicYear() {
  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];

  // Derive synchronously — no separate network call, no stale-time confusion.
  // Re-computed any time the base years array changes (preloader update, etc.).
  const activeYear = useMemo(() => {
    if (years.length === 0) return undefined;
    return detectCurrentAcademicYear(years) ?? years[0] ?? undefined;
  }, [years]);

  return {
    // Match the useQuery return shape that callers expect.
    // Returns undefined (not null) so callers can type: AcademicYear | undefined
    data: activeYear as AcademicYear | undefined,
    isLoading: yearsQuery.isLoading,
    isFetching: yearsQuery.isFetching,
    isError: yearsQuery.isError,
    error: yearsQuery.error,
    isSuccess: yearsQuery.isSuccess,
  };
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (yearData: Omit<AcademicYear, 'id'>) => {
      const yearId = await AcademicYearsService.createAcademicYear(yearData);

      // Create digital signature for academic year creation
      if (user) {
        await signAction(
          'academic_year_creation',
          yearId,
          'created',
          {
            yearName: yearData.name,
            startDate: yearData.startDate,
            endDate: yearData.endDate,
            termCount: yearData.terms?.length || 0,
            isActive: yearData.isActive,
            isLocked: yearData.isLocked
          }
        );
      }

      return yearId;
    },
    onSuccess: () => {
      // Bust localStorage cache so next read gets fresh data from preloader
      liteInvalidate(LITE_KEYS.academicYears);
      queryClient.invalidateQueries({ queryKey: [ACADEMIC_YEARS_QUERY_KEY] });
    },
  });
}

export function useUpdateAcademicYear() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Omit<AcademicYear, 'id'>> }) => {
      await AcademicYearsService.updateAcademicYear(id, data);

      // Create digital signature for academic year modification
      if (user) {
        await signAction(
          'academic_year_creation',
          id,
          'modified',
          {
            updatedFields: Object.keys(data),
            nameChanged: !!data.name,
            datesChanged: !!(data.startDate || data.endDate),
            termsChanged: !!data.terms,
            statusChanged: data.isActive !== undefined || data.isLocked !== undefined
          }
        );
      }

      return id;
    },
    onSuccess: () => {
      liteInvalidate(LITE_KEYS.academicYears);
      queryClient.invalidateQueries({ queryKey: [ACADEMIC_YEARS_QUERY_KEY] });
    },
  });
}

export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => AcademicYearsService.deleteAcademicYear(id),
    onSuccess: () => {
      liteInvalidate(LITE_KEYS.academicYears);
      queryClient.invalidateQueries({ queryKey: [ACADEMIC_YEARS_QUERY_KEY] });
    },
  });
}

export function useSetActiveAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => AcademicYearsService.setActiveAcademicYear(id),
    onSuccess: () => {
      liteInvalidate(LITE_KEYS.academicYears);
      queryClient.invalidateQueries({ queryKey: [ACADEMIC_YEARS_QUERY_KEY] });
    },
  });
} 