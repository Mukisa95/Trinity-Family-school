import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AcademicYearsService } from '../services/academic-years.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import { getAcademicYearCacheScope, readAcademicYearCache } from '@/lib/cache/academic-year-cache';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import type { AcademicYear } from '@/types';

// Ordinary academic-year consumers observe this one identity-scoped list.
// The GlobalDataPreloader cache bootstrap is the only browser network owner.
export const academicYearsKeys = {
  all: ['academicYears'] as const,
  lists: () => [...academicYearsKeys.all, 'list'] as const,
  list: (scope: string) => [...academicYearsKeys.lists(), scope] as const,
  details: () => [...academicYearsKeys.all, 'detail'] as const,
  detail: (scope: string, id: string) => [...academicYearsKeys.details(), scope, id] as const,
};

/**
 * Advances local academic-period selectors at midnight without creating a
 * Firestore read. Supplying a date keeps tests and historical views stable.
 */
export function useAcademicNow(targetDate?: Date): Date {
  const [now, setNow] = useState(() => targetDate ?? new Date());

  useEffect(() => {
    if (targetDate) {
      setNow(targetDate);
      return;
    }

    let timer: number | undefined;
    const scheduleNextDay = () => {
      const current = new Date();
      const next = new Date(current);
      next.setHours(24, 0, 1, 0);
      timer = window.setTimeout(() => {
        setNow(new Date());
        scheduleNextDay();
      }, next.getTime() - current.getTime());
    };

    scheduleNextDay();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [targetDate]);

  return targetDate ?? now;
}

function resolveAcademicYearForDate(years: AcademicYear[], targetDate: Date): AcademicYear | undefined {
  const sortNewest = (matches: AcademicYear[]) => matches.sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  )[0];

  const termMatches = years.filter(year => year.terms.some(term => {
    const start = new Date(term.startDate);
    const end = new Date(term.endDate);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
      && targetDate >= start && targetDate <= end;
  }));
  if (termMatches.length > 0) return sortNewest(termMatches);

  const yearMatches = years.filter(year => {
    const start = new Date(year.startDate);
    const end = new Date(year.endDate);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
      && targetDate >= start && targetDate <= end;
  });
  if (yearMatches.length > 0) return sortNewest(yearMatches);

  const lastCompletedTermYear = getEffectiveTermForDataDisplay(years, targetDate).academicYear;
  if (lastCompletedTermYear) return lastCompletedTermYear;

  return years.find(year => year.isActive) ?? years[0];
}

export function useAcademicYears() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getAcademicYearCacheScope(user?.id, user?.role) : '';
  const queryKey = academicYearsKeys.list(scope);
  const inMemory = queryClient.getQueryData<AcademicYear[]>(queryKey);
  const persisted = inMemory === undefined ? readAcademicYearCache(scope) : null;
  const initialData = inMemory ?? persisted?.data;

  const query = useQuery({
    queryKey,
    // Cache-only by design. This prevents each page from turning a year or
    // current-term lookup into an independent Firestore collection read.
    queryFn: async () => queryClient.getQueryData<AcademicYear[]>(queryKey) ?? [],
    enabled: false,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    initialData,
    initialDataUpdatedAt: initialData !== undefined ? Date.now() : undefined,
    placeholderData: previousData => previousData,
  });

  return {
    ...query,
    isLoading: !!scope && query.data === undefined,
  };
}

export function useAcademicYear(id: string) {
  const yearsQuery = useAcademicYears();
  const data = useMemo(
    () => yearsQuery.data?.find(year => year.id === id),
    [id, yearsQuery.data],
  );

  return { ...yearsQuery, data };
}

/**
 * Resolves the academic year from cached dates first, with isActive retained
 * only as a fallback for incomplete historical data.
 */
export function useActiveAcademicYear() {
  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];
  const now = useAcademicNow();
  const data = useMemo(() => {
    if (years.length === 0) return undefined;
    return resolveAcademicYearForDate(years, now);
  }, [now, years]);

  return { ...yearsQuery, data };
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (yearData: Omit<AcademicYear, 'id'>) => {
      const yearId = await AcademicYearsService.createAcademicYear(yearData);
      if (user) {
        await signAction('academic_year_creation', yearId, 'created', {
          yearName: yearData.name,
          startDate: yearData.startDate,
          endDate: yearData.endDate,
          termCount: yearData.terms?.length || 0,
          isActive: yearData.isActive,
          isLocked: yearData.isLocked,
        });
      }
      return yearId;
    },
    onSuccess: () => {
      // The atomic revision bump requests one necessary reconciliation; no
      // individual page is allowed to start another one.
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.all, refetchType: 'none' });
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
      if (user) {
        await signAction('academic_year_creation', id, 'modified', {
          updatedFields: Object.keys(data),
          nameChanged: !!data.name,
          datesChanged: !!(data.startDate || data.endDate),
          termsChanged: !!data.terms,
          statusChanged: data.isActive !== undefined || data.isLocked !== undefined,
        });
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.all, refetchType: 'none' });
    },
  });
}

export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => AcademicYearsService.deleteAcademicYear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.all, refetchType: 'none' });
    },
  });
}

export function useSetActiveAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => AcademicYearsService.setActiveAcademicYear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.all, refetchType: 'none' });
    },
  });
}
