import { useQuery } from '@tanstack/react-query';
import { CollectionAnalyticsService, type CollectionAnalytics } from '../services/collection-analytics.service';
import { useActiveAcademicYear } from './use-academic-years';
import { useMemo } from 'react';

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

  console.log('🔍 ANALYTICS: Academic year data', {
    activeYear,
    yearLoading,
    hasYear: !!activeYear,
    yearId: activeYear?.id,
    currentTermId: activeYear?.currentTermId,
    terms: activeYear?.terms?.map(t => ({ id: t.id, start: t.startDate, end: t.endDate }))
  });

  // Determine which year and term to use
  const effectiveYearId = academicYearId || activeYear?.id;
  const effectiveTermId = termId || activeYear?.currentTermId;

  // Get term dates from active year
  const termDates = useMemo(() => {
    if (!activeYear || !effectiveTermId) {
      console.warn('⚠️ ANALYTICS: Cannot determine term dates', {
        hasActiveYear: !!activeYear,
        effectiveTermId
      });
      return null;
    }

    const term = activeYear.terms?.find(t => t.id === effectiveTermId);
    if (!term) {
      console.warn('⚠️ ANALYTICS: Term not found in active year', {
        searchingFor: effectiveTermId,
        availableTerms: activeYear.terms?.map(t => t.id)
      });
      return null;
    }

    const dates = {
      startDate: term.startDate instanceof Date ? term.startDate : new Date(term.startDate),
      endDate: term.endDate instanceof Date ? term.endDate : new Date(term.endDate)
    };

    console.log('✅ ANALYTICS: Term dates determined', dates);
    return dates;
  }, [activeYear, effectiveTermId]);

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
          termDates.endDate
        );
        console.log('✅ ANALYTICS HOOK: Successfully fetched analytics data', result);
        return result;
      } catch (error) {
        console.error('❌ ANALYTICS HOOK: Error fetching analytics', error);
        throw error;
      }
    },
    enabled: enabled && !!effectiveYearId && !!effectiveTermId && !!termDates,
    staleTime: 5 * 60 * 1000, // 5 minutes - analytics should be fairly fresh
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnMount: true, // Always fetch latest when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    retry: 1, // Retry once on failure
  });

  const isLoading = yearLoading || analyticsLoading;

  return {
    analytics,
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
    hasData: !!analytics,
    isEmpty: analytics?.overview.totalPupils === 0
  };
}

/**
 * Hook for getting analytics query key (useful for manual cache invalidation)
 */
export function getCollectionAnalyticsQueryKey(yearId?: string, termId?: string) {
  return ['collection-analytics', yearId, termId];
}

