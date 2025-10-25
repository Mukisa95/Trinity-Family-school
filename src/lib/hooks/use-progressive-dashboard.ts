import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PupilsService } from '../services/pupils.service';
import { StaffService } from '../services/staff.service';
import { ClassesService } from '../services/classes.service';
import { SubjectsService } from '../services/subjects.service';
import { useSchoolSettings } from './use-school-settings';
import { usePhotos } from './use-photos';
import type { Pupil, Staff, Class, Subject } from '@/types';

interface ProgressiveDashboardState {
  pupils: Pupil[];
  staff: Staff[];
  classes: Class[];
  subjects: Subject[];
  isProcessing: boolean;
  currentStage: number;
  totalStages: number;
  processedStages: string[];
  error: string | null;
  isComplete: boolean;
  stageProgress: {
    pupils: boolean;
    staff: boolean;
    classes: boolean;
    subjects: boolean;
  };
}

interface UseProgressiveDashboardOptions {
  enabled?: boolean;
}

export function useProgressiveDashboard({
  enabled = true
}: UseProgressiveDashboardOptions = {}) {
  const [state, setState] = useState<ProgressiveDashboardState>({
    pupils: [],
    staff: [],
    classes: [],
    subjects: [],
    isProcessing: false,
    currentStage: 0,
    totalStages: 4,
    processedStages: [],
    error: null,
    isComplete: false,
    stageProgress: {
      pupils: false,
      staff: false,
      classes: false,
      subjects: false,
    }
  });

  // Use refs to prevent race conditions and infinite loops
  const isProcessingRef = useRef(false);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load school settings and photos immediately (they're usually small/cached)
  const { data: schoolSettings, isLoading: isLoadingSettings } = useSchoolSettings();
  const { data: photos, isLoading: isLoadingPhotos } = usePhotos();

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (state.totalStages === 0) return 0;
    return Math.round((state.currentStage / state.totalStages) * 100);
  }, [state.currentStage, state.totalStages]);

  // Load data stage by stage with cancellation support
  const loadDataStage = useCallback(async (stage: number, signal?: AbortSignal) => {
    if (signal?.aborted) return;
    
    try {
      switch (stage) {
        case 1:
          // Stage 1: Load Classes (usually small, needed for other calculations)
          if (mountedRef.current) {
            setState(prev => ({ ...prev, processedStages: [...prev.processedStages, 'Loading classes...'] }));
          }
          const classesData = await ClassesService.getAll();
          if (signal?.aborted || !mountedRef.current) return;
          setState(prev => ({
            ...prev,
            classes: classesData,
            stageProgress: { ...prev.stageProgress, classes: true }
          }));
          break;

        case 2:
          // Stage 2: Load Subjects (usually small)
          if (mountedRef.current) {
            setState(prev => ({ ...prev, processedStages: [...prev.processedStages, 'Loading subjects...'] }));
          }
          const subjectsData = await SubjectsService.getAllSubjects();
          if (signal?.aborted || !mountedRef.current) return;
          setState(prev => ({
            ...prev,
            subjects: subjectsData,
            stageProgress: { ...prev.stageProgress, subjects: true }
          }));
          break;

        case 3:
          // Stage 3: Load Staff (medium size)
          if (mountedRef.current) {
            setState(prev => ({ ...prev, processedStages: [...prev.processedStages, 'Loading staff...'] }));
          }
          const staffData = await StaffService.getAllStaff();
          if (signal?.aborted || !mountedRef.current) return;
          setState(prev => ({
            ...prev,
            staff: staffData,
            stageProgress: { ...prev.stageProgress, staff: true }
          }));
          break;

        case 4:
          // Stage 4: Load Active Pupils (largest dataset, load last)
          // 🚀 OPTIMIZED: Only load active pupils from database, not all pupils
          if (mountedRef.current) {
            setState(prev => ({ ...prev, processedStages: [...prev.processedStages, 'Loading active pupils...'] }));
          }
          const pupilsData = await PupilsService.getActivePupils(); // Database-level filter
          if (signal?.aborted || !mountedRef.current) return;
          setState(prev => ({
            ...prev,
            pupils: pupilsData,
            stageProgress: { ...prev.stageProgress, pupils: true }
          }));
          break;
      }
    } catch (error) {
      if (signal?.aborted) return;
      throw error;
    }
  }, []);

  // Start progressive loading with proper cleanup
  const startProgressiveLoading = useCallback(async () => {
    // Prevent multiple simultaneous processing
    if (isProcessingRef.current || !mountedRef.current) {
      return;
    }

    // Cancel any existing processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    isProcessingRef.current = true;

    if (!mountedRef.current) return;

    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentStage: 0,
      processedStages: [],
      error: null,
      isComplete: false,
      stageProgress: {
        pupils: false,
        staff: false,
        classes: false,
        subjects: false,
      }
    }));

    try {
      // Load data in stages
      for (let stage = 1; stage <= 4; stage++) {
        if (signal.aborted || !mountedRef.current) {
          return;
        }

        if (mountedRef.current) {
          setState(prev => ({ ...prev, currentStage: stage }));
        }
        
        await loadDataStage(stage, signal);
        
        // Small delay to show progressive loading and prevent overwhelming Firebase
        if (stage < 4 && !signal.aborted && mountedRef.current) {
          await new Promise(resolve => {
            const timeoutId = setTimeout(resolve, 200);
            signal.addEventListener('abort', () => clearTimeout(timeoutId));
          });
        }
      }

      if (mountedRef.current && !signal.aborted) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          isComplete: true,
          currentStage: 4
        }));
      }

    } catch (error) {
      if (signal.aborted) return;
      
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: error instanceof Error ? error.message : 'Failed to load dashboard data',
          isComplete: false
        }));
      }
    } finally {
      isProcessingRef.current = false;
      if (abortControllerRef.current === abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [loadDataStage]);

  // Auto-start loading when enabled - simplified to avoid race conditions
  useEffect(() => {
    if (enabled && !isProcessingRef.current && !state.isComplete && state.currentStage === 0) {
      // Start loading immediately without checking mountedRef in timeout
      // The individual functions will check if mounted
      const timeoutId = setTimeout(() => {
        startProgressiveLoading();
      }, 100); // Short delay just to let React settle

      return () => clearTimeout(timeoutId);
    }
  }, [enabled, state.isComplete, state.currentStage]); // Restore original dependencies

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      isProcessingRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Calculate statistics as data becomes available
  // 🚀 OPTIMIZED: pupils are already active pupils from database query
  const stats = useMemo(() => {
    const activePupils = state.pupils; // Already filtered at database level
    const malePupils = activePupils.filter(p => p.gender === 'Male');
    const femalePupils = activePupils.filter(p => p.gender === 'Female');

    return {
      totalPupils: activePupils.length,
      malePupils: malePupils.length,
      femalePupils: femalePupils.length,
      totalStaff: state.staff.length,
      totalClasses: state.classes.length,
      totalSubjects: state.subjects.length,
    };
  }, [state.pupils, state.staff, state.classes, state.subjects]);

  // Determine loading states for individual components
  const loadingStates = useMemo(() => ({
    pupilsLoading: !state.stageProgress.pupils,
    staffLoading: !state.stageProgress.staff,
    classesLoading: !state.stageProgress.classes,
    subjectsLoading: !state.stageProgress.subjects,
    isLoading: state.isProcessing || (!state.isComplete && state.currentStage < 4),
    settingsLoading: isLoadingSettings,
    photosLoading: isLoadingPhotos
  }), [state.stageProgress, state.isProcessing, state.isComplete, state.currentStage, isLoadingSettings, isLoadingPhotos]);

  return {
    // Data
    pupils: state.pupils,
    staff: state.staff,
    classes: state.classes,
    subjects: state.subjects,
    schoolSettings,
    photos,
    stats,

    // Loading states (for compatibility with existing code)
    ...loadingStates,

    // Progressive loading info
    isProcessing: state.isProcessing,
    currentStage: state.currentStage,
    totalStages: state.totalStages,
    progressPercentage,
    processedStages: state.processedStages,
    stageProgress: state.stageProgress,
    error: state.error,
    isComplete: state.isComplete,
    restart: startProgressiveLoading
  };
} 