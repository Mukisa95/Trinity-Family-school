import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PupilsService } from '../services/pupils.service';
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
  const { 
    data: classPupils = [], 
    isLoading: isLoadingClass,
    isFetching: isFetchingClass,
    error: classError 
  } = useQuery({
    queryKey: ['pupils-by-class', classId, filters],
    queryFn: async () => {
      console.log('🎯 LOADING PUPILS FOR CLASS:', classId);
      
      if (!classId || classId === '') {
        console.log('❌ No class selected - not loading any data');
        return [];
      }
      
      if (classId === 'all') {
        // Only load all if explicitly requested
        console.log('⚠️ Loading ALL pupils (slower) - user explicitly selected "All"');
        return includeAllClasses ? await PupilsService.getAllPupils() : [];
      }
      
      // Use optimized class-based query - this is the main use case
      console.log('⚡ Loading pupils for specific class (faster)');
      try {
        if (filters && Object.keys(filters).length > 0) {
          console.log('🎯 Using filtered query for class:', classId, filters);
          return await PupilsService.getPupilsByClassWithFilters(classId, filters);
        }
        
        console.log('📚 Using basic class query for:', classId);
        return await PupilsService.getPupilsByClass(classId);
      } catch (queryError) {
        console.error('❌ Class-specific query failed, trying basic query:', queryError);
        // Fallback to basic query without filters if there are issues
        return await PupilsService.getPupilsByClass(classId);
      }
    },
    enabled: enabled && !!classId && classId !== '', // Only fetch when a class is actually selected
    staleTime: 8 * 60 * 1000, // 8 minutes - pupils change less frequently
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    refetchInterval: 10 * 60 * 1000, // 10 minutes - less frequent background updates
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new data
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

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
 * Hook for getting minimal pupil data (faster loading for dropdowns, etc.)
 */
export function useClassPupilsMinimal(classId?: string) {
  return useQuery({
    queryKey: ['pupils-minimal', classId],
    queryFn: async () => {
      console.log('⚡ Loading minimal pupil data for:', classId);
      const result = await PupilsService.getPupilsMinimal(classId);
      console.log('✅ Minimal pupils loaded:', result.length);
      return result;
    },
    enabled: !!classId,
    staleTime: 10 * 60 * 1000, // 10 minutes - minimal data changes even less
    gcTime: 20 * 60 * 1000, // 20 minutes cache
  });
}

/**
 * Hook for managing class selection state with pupils data
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

  const pupilsData = useClassPupils({
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
    optimizationLevel: selectedClassId === 'all' ? 'All classes (slower)' : 'Single class (faster)'
  };
}

export default useClassPupils;
