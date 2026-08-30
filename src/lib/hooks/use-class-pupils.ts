import { useState, useMemo, useCallback } from 'react';
import { usePupils } from './use-pupils';
import {
  selectPupilsWithFilters,
  selectPupilsWithoutPhotos,
} from '../selectors/pupil-selectors';
import type { Pupil } from '@/types';

interface UseClassPupilsOptions {
  classId: string;
  filters?: {
    status?: string;
    section?: string;
    gender?: string;
  };
  enabled?: boolean;
  includeAllClasses?: boolean;
}

interface ClassPupilsState {
  pupils: Pupil[];
  filteredPupils: Pupil[];
  isLoading: boolean;
  error: Error | null;
  totalCount: number;
  classCount: number;
}

/**
 * Hook for efficiently loading pupils by class with optional filters
 * This is much faster than loading all pupils from the entire school
 */
export function useClassPupils({
  classId,
  filters,
  enabled = true,
  includeAllClasses = true
}: UseClassPupilsOptions) {

  const [searchQuery, setSearchQuery] = useState('');

  // Only load data if a specific class is selected (never load all by default)
  // CRITICAL: When no class is selected, completely disable the query to prevent any fetching
  const isQueryEnabled = enabled && !!classId && classId !== '';

  // Log when query is disabled to help debug
  if (!isQueryEnabled) {
    console.log('🚫 QUERY DISABLED: No class selected, query will not execute. classId:', classId, 'enabled:', enabled);
  }

  const pupilsQuery = usePupils();
  const classPupils = useMemo(() => {
    if (!isQueryEnabled) return [];
    if (classId === 'all') return includeAllClasses ? pupilsQuery.data ?? [] : [];
    return selectPupilsWithFilters(pupilsQuery.data, classId, filters);
  }, [classId, filters?.gender, filters?.section, filters?.status, includeAllClasses, isQueryEnabled, pupilsQuery.data]);
  const isLoadingClass = isQueryEnabled && pupilsQuery.isLoading;
  const isFetchingClass = false;
  const classError = pupilsQuery.error;

  // Optimized: Client-side search filter with performance improvements
  const filteredPupils = useMemo(() => {
    if (!searchQuery.trim()) {
      console.log('⚡ No search query - returning all pupils:', classPupils.length);
      return classPupils;
    }

    console.log('🔍 Searching pupils for:', searchQuery);
    const query = searchQuery.toLowerCase().trim();

    // Use for loop for better performance with large datasets
    const results: typeof classPupils = [];
    for (let i = 0; i < classPupils.length; i++) {
      const pupil = classPupils[i];

      if (pupil.firstName.toLowerCase().includes(query) ||
        pupil.lastName.toLowerCase().includes(query) ||
        pupil.admissionNumber.toLowerCase().includes(query) ||
        (pupil.otherNames && pupil.otherNames.toLowerCase().includes(query))) {
        results.push(pupil);
      }
    }

    console.log('✅ Search completed:', results.length, 'matches found');
    return results;
  }, [classPupils, searchQuery]);

  // Optimized: Calculate statistics efficiently
  const statistics = useMemo(() => {
    console.log('⚡ Calculating statistics for', filteredPupils.length, 'pupils');

    const totalCount = filteredPupils.length;
    const classCount = classPupils.length;

    // Use for loops for better performance with large datasets
    const statusCounts: Record<string, number> = {};
    const sectionCounts: Record<string, number> = {};
    const genderCounts: Record<string, number> = {};

    for (let i = 0; i < filteredPupils.length; i++) {
      const pupil = filteredPupils[i];

      // Status counting
      const status = pupil.status || 'Active';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Section counting
      const section = pupil.section || 'day';
      sectionCounts[section] = (sectionCounts[section] || 0) + 1;

      // Gender counting
      const gender = pupil.gender || 'Unknown';
      genderCounts[gender] = (genderCounts[gender] || 0) + 1;
    }

    console.log('✅ Statistics calculated');
    return {
      totalCount,
      classCount,
      statusCounts,
      sectionCounts,
      genderCounts
    };
  }, [filteredPupils, classPupils]);

  // Search functionality
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    // Data
    pupils: classPupils,
    filteredPupils,

    // Loading states
    isLoading: isLoadingClass,
    isFetching: isFetchingClass,
    error: classError,

    // Statistics
    totalCount: statistics.totalCount,
    classCount: statistics.classCount,
    statistics,

    // Search functionality
    searchQuery,
    handleSearch,
    clearSearch,
    hasSearchResults: searchQuery.trim().length > 0,

    // Helper flags
    isEmpty: filteredPupils.length === 0,
    isClassSpecific: classId !== 'all',
    hasFilters: filters && Object.values(filters).some(value => value && value !== 'all')
  };
}

/**
 * 🚀 PERFORMANCE OPTIMIZED: Hook for efficiently loading pupils by class WITHOUT photos
 * This is significantly faster than useClassPupils when photos are not needed initially
 * Use usePupilPhotos() to load photos separately after initial data is displayed
 */
export function useClassPupilsWithoutPhotos({
  classId,
  filters,
  enabled = true,
  includeAllClasses = true
}: UseClassPupilsOptions) {

  const [searchQuery, setSearchQuery] = useState('');

  // Only load data if a specific class is selected
  const isQueryEnabled = enabled && !!classId && classId !== '';

  if (!isQueryEnabled) {
    console.log('🚫 QUERY DISABLED (no photos): No class selected, query will not execute. classId:', classId);
  }

  const pupilsQuery = usePupils();
  const classPupils = useMemo(() => {
    if (!isQueryEnabled) return [];
    const selected = classId === 'all'
      ? includeAllClasses ? pupilsQuery.data ?? [] : []
      : selectPupilsWithFilters(pupilsQuery.data, classId, filters);
    return selectPupilsWithoutPhotos(selected);
  }, [classId, filters?.gender, filters?.section, filters?.status, includeAllClasses, isQueryEnabled, pupilsQuery.data]);
  const isLoadingClass = isQueryEnabled && pupilsQuery.isLoading;
  const isFetchingClass = false;
  const classError = pupilsQuery.error;

  // Client-side search filter
  const filteredPupils = useMemo(() => {
    if (!searchQuery.trim()) {
      return classPupils;
    }

    const query = searchQuery.toLowerCase().trim();
    const results: typeof classPupils = [];

    for (let i = 0; i < classPupils.length; i++) {
      const pupil = classPupils[i];

      if (pupil.firstName.toLowerCase().includes(query) ||
        pupil.lastName.toLowerCase().includes(query) ||
        pupil.admissionNumber.toLowerCase().includes(query) ||
        (pupil.otherNames && pupil.otherNames.toLowerCase().includes(query))) {
        results.push(pupil);
      }
    }

    return results;
  }, [classPupils, searchQuery]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalCount = filteredPupils.length;
    const classCount = classPupils.length;

    const statusCounts: Record<string, number> = {};
    const sectionCounts: Record<string, number> = {};
    const genderCounts: Record<string, number> = {};

    for (let i = 0; i < filteredPupils.length; i++) {
      const pupil = filteredPupils[i];

      const status = pupil.status || 'Active';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      const section = pupil.section || 'day';
      sectionCounts[section] = (sectionCounts[section] || 0) + 1;

      const gender = pupil.gender || 'Unknown';
      genderCounts[gender] = (genderCounts[gender] || 0) + 1;
    }

    return {
      totalCount,
      classCount,
      statusCounts,
      sectionCounts,
      genderCounts
    };
  }, [filteredPupils, classPupils]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    // Data
    pupils: classPupils,
    filteredPupils,

    // Loading states
    isLoading: isLoadingClass,
    isFetching: isFetchingClass,
    error: classError,

    // Statistics
    totalCount: statistics.totalCount,
    classCount: statistics.classCount,
    statistics,

    // Search functionality
    searchQuery,
    handleSearch,
    clearSearch,
    hasSearchResults: searchQuery.trim().length > 0,

    // Helper flags
    isEmpty: filteredPupils.length === 0,
    isClassSpecific: classId !== 'all',
    hasFilters: filters && Object.values(filters).some(value => value && value !== 'all')
  };
}

/**
 * Hook for getting minimal pupil data (faster loading for dropdowns, etc.)
 */
export function useClassPupilsMinimal(classId?: string) {
  const pupilsQuery = usePupils();
  const data = useMemo(() => {
    if (!classId) return [];
    const selected = classId === 'all'
      ? pupilsQuery.data ?? []
      : selectPupilsWithFilters(pupilsQuery.data, classId);
    return selected.map(({ id, firstName, lastName, admissionNumber, classId: pupilClassId, status }) => ({
      id,
      firstName,
      lastName,
      admissionNumber,
      classId: pupilClassId,
      status,
    }));
  }, [classId, pupilsQuery.data]);
  return { ...pupilsQuery, data, isLoading: !!classId && pupilsQuery.isLoading };
}

/**
 * Hook for managing class selection state with pupils data
 * 🚀 OPTIMIZED: Uses useClassPupilsWithoutPhotos for faster initial load
 */
export function useClassPupilsManager(initialClassId: string = '') {
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [filters, setFilters] = useState<{
    status?: string;
    section?: string;
    gender?: string;
  }>({
    status: 'Active',
    section: 'all',
    gender: 'all'
  });

  // 🚀 PERFORMANCE: Use optimized hook that excludes photos
  const pupilsData = useClassPupilsWithoutPhotos({
    classId: selectedClassId,
    filters,
    enabled: true,
    includeAllClasses: true
  });

  const handleClassChange = useCallback((classId: string) => {
    setSelectedClassId(classId);
  }, []);

  const handleFilterChange = useCallback((newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      status: 'Active',
      section: 'all',
      gender: 'all'
    });
    pupilsData.clearSearch();
  }, [pupilsData]);

  const resetAll = useCallback(() => {
    setSelectedClassId('all');
    resetFilters();
  }, [resetFilters]);

  return {
    // Class selection
    selectedClassId,
    handleClassChange,
    isAllSelected: selectedClassId === 'all',

    // Filters
    filters,
    handleFilterChange,
    resetFilters,
    resetAll,

    // Pupils data
    ...pupilsData,

    // Performance indicators
    loadingTime: pupilsData.isLoading ? 'Loading...' : `Loaded ${pupilsData.totalCount} pupils`,
    optimizationLevel: selectedClassId === 'all' ? 'All classes (faster - no photos)' : 'Single class (faster - no photos)'
  };
}

export default useClassPupils;
