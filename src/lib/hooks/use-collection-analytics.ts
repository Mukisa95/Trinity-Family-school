import { useQuery } from '@tanstack/react-query';
import { CollectionAnalyticsService, type CollectionAnalytics } from '../services/collection-analytics.service';
import { useActiveAcademicYear, useAcademicYears } from './use-academic-years';
import { useClasses } from './use-classes';
import { useMemo } from 'react';
import { detectCurrentTerm } from '@/lib/utils/academic-year-utils';

interface UseCollectionAnalyticsOptions {
  academicYearId?: string;
  termId?: string;
  enabled?: boolean;
}

/**
 * 🚀 OPTIMIZED HOOK: Collection Analytics with React Query caching
 * 
 * Features:
 * - Automatic batch loading
 * - Smart caching (5 minute stale time)
 * - Automatic refetch on mount (to show latest data)
 * - Loading and error states
 */
export function useCollectionAnalytics({
  academicYearId,
  termId,
  enabled = true
}: UseCollectionAnalyticsOptions = {}) {

  // Get active academic year and term if not provided
  const { data: activeYear, isLoading: yearLoading } = useActiveAcademicYear();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: classes = [], isLoading: classesLoading } = useClasses();

  console.log('🔍 ANALYTICS: Academic year data', {
    activeYear,
    yearLoading,
    hasYear: !!activeYear,
    yearId: activeYear?.id,
    currentTermId: detectCurrentTerm(activeYear)?.id,
    terms: activeYear?.terms?.map(t => ({ id: t.id, start: t.startDate, end: t.endDate }))
  });

  // Determine which year and term to use
  const effectiveYear = academicYearId
    ? academicYears.find(year => year.id === academicYearId)
    : activeYear;
  const effectiveYearId = effectiveYear?.id;
  const effectiveTermId = termId || detectCurrentTerm(effectiveYear)?.id;

  // Get term dates from active year
  const termDates = useMemo(() => {
    if (!effectiveYear || !effectiveTermId) {
      console.warn('⚠️ ANALYTICS: Cannot determine term dates', {
        hasActiveYear: !!effectiveYear,
        effectiveTermId
      });
      return null;
    }

    const term = effectiveYear.terms?.find(t => t.id === effectiveTermId);
    if (!term) {
      console.warn('⚠️ ANALYTICS: Term not found in active year', {
        searchingFor: effectiveTermId,
        availableTerms: effectiveYear.terms?.map(t => t.id)
      });
      return null;
    }

    const dates = {
      startDate: new Date(term.startDate),
      endDate: new Date(term.endDate)
    };

    console.log('✅ ANALYTICS: Term dates determined', dates);
    return dates;
  }, [effectiveYear, effectiveTermId]);

  // Fetch analytics data
  const {
    data: analytics,
    isLoading: analyticsLoading,
    error,
    refetch,
    isFetching
  } = useQuery<CollectionAnalytics>({
    queryKey: ['collection-analytics', effectiveYearId, effectiveTermId],
    queryFn: async () => {
      console.log('📊 ANALYTICS HOOK: Starting analytics fetch', {
        yearId: effectiveYearId,
        termId: effectiveTermId,
        termDates,
        enabled
      });

      if (!effectiveYearId || !effectiveTermId || !termDates) {
        console.error('❌ ANALYTICS HOOK: Missing required parameters', {
          hasYearId: !!effectiveYearId,
          hasTermId: !!effectiveTermId,
          hasTermDates: !!termDates
        });
        throw new Error('Missing required parameters for analytics');
      }

      console.log('📊 ANALYTICS HOOK: Fetching collection analytics', {
        yearId: effectiveYearId,
        termId: effectiveTermId,
        termDates
      });

      try {
        const result = await CollectionAnalyticsService.getCollectionAnalytics(
          effectiveYearId,
          effectiveTermId,
          termDates.startDate,
          termDates.endDate,
          classes
        );
        console.log('✅ ANALYTICS HOOK: Successfully fetched analytics data', result);
        return result;
      } catch (error) {
        console.error('❌ ANALYTICS HOOK: Error fetching analytics', error);
        throw error;
      }
    },
    enabled: enabled && !classesLoading && !!effectiveYearId && !!effectiveTermId && !!termDates,
    staleTime: 0, // 🚀 INSTANT: Use cached data immediately
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnMount: false, // 🚀 INSTANT: Don't refetch - use cached data
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    retry: 1, // Retry once on failure
  });

  const isLoading = yearLoading || classesLoading || analyticsLoading;
  const resolvedAnalytics = useMemo<CollectionAnalytics | undefined>(() => {
    if (!analytics) return undefined;
    const classMap = new Map(classes.map(classItem => [classItem.id, classItem]));

    return {
      ...analytics,
      byClass: analytics.byClass
        .filter(classStats => classMap.has(classStats.classId))
        .map(classStats => {
          const currentClass = classMap.get(classStats.classId)!;
          return {
            ...classStats,
            className: currentClass.name,
            classCode: currentClass.code,
          };
        })
        .sort((left, right) => left.className.localeCompare(right.className)),
    };
  }, [analytics, classes]);

  return {
    analytics: resolvedAnalytics,
    isLoading,
    isFetching,
    error,
    refetch,

    // Metadata
    academicYearId: effectiveYearId,
    termId: effectiveTermId,
    termDates,
    activeYear,

    // Helper flags
    hasData: !!resolvedAnalytics,
    isEmpty: resolvedAnalytics?.overview.totalPupils === 0
  };
}

/**
 * Hook for getting analytics query key (useful for manual cache invalidation)
 */
export function getCollectionAnalyticsQueryKey(yearId?: string, termId?: string) {
  return ['collection-analytics', yearId, termId];
}
