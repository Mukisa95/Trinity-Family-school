import { useMemo } from 'react';
import { useSchoolSettings } from './use-school-settings';
import { usePhotos } from './use-photos';
import { usePupils } from './use-pupils';
import { useStaff } from './use-staff';
import { useClasses } from './use-classes';
import { useSubjects } from './use-subjects';
import type { Pupil, Staff, Class, Subject } from '@/types';

/**
 * 🚀 OPTIMIZED PROGRESSIVE DASHBOARD HOOK
 * 
 * Now uses cached data from real-time listeners instead of fetching from services.
 * This provides INSTANT loading since data is already in React Query cache
 * from the GlobalDataPreloader and individual hook listeners.
 */

interface UseProgressiveDashboardOptions {
  enabled?: boolean;
}

export function useProgressiveDashboard({
  enabled = true
}: UseProgressiveDashboardOptions = {}) {

  // 🚀 INSTANT: Use cached data from real-time listener hooks
  // These hooks populate React Query cache via onSnapshot listeners
  const {
    data: allPupils = [],
    isLoading: pupilsLoading,
    error: pupilsError
  } = usePupils();

  const {
    data: staff = [],
    isLoading: staffLoading,
    error: staffError
  } = useStaff();

  const {
    data: classes = [],
    isLoading: classesLoading,
    error: classesError
  } = useClasses();

  const {
    data: subjects = [],
    isLoading: subjectsLoading,
    error: subjectsError
  } = useSubjects();

  // Load school settings and photos (they're usually small/cached)
  const { data: schoolSettings, isLoading: isLoadingSettings } = useSchoolSettings();
  const { data: photos, isLoading: isLoadingPhotos } = usePhotos();

  // 🚀 INSTANT: Filter active pupils from cached data
  const pupils = useMemo(() => {
    if (!enabled || !allPupils) return [];
    return allPupils.filter((p: Pupil) => p.status === 'Active');
  }, [allPupils, enabled]);

  // Calculate statistics from cached data
  const stats = useMemo(() => {
    const activePupils = pupils;
    const malePupils = activePupils.filter(p => p.gender === 'Male');
    const femalePupils = activePupils.filter(p => p.gender === 'Female');

    return {
      totalPupils: activePupils.length,
      malePupils: malePupils.length,
      femalePupils: femalePupils.length,
      totalStaff: staff.length,
      totalClasses: classes.length,
      totalSubjects: subjects.length,
    };
  }, [pupils, staff, classes, subjects]);

  // Calculate progress based on which data sources are loaded
  const stageProgress = useMemo(() => ({
    pupils: !pupilsLoading && pupils.length >= 0,
    staff: !staffLoading && staff.length >= 0,
    classes: !classesLoading && classes.length >= 0,
    subjects: !subjectsLoading && subjects.length >= 0,
  }), [pupilsLoading, staffLoading, classesLoading, subjectsLoading, pupils, staff, classes, subjects]);

  const currentStage = useMemo(() => {
    let stage = 0;
    if (stageProgress.classes) stage++;
    if (stageProgress.subjects) stage++;
    if (stageProgress.staff) stage++;
    if (stageProgress.pupils) stage++;
    return stage;
  }, [stageProgress]);

  const isComplete = currentStage === 4;
  const isProcessing = pupilsLoading || staffLoading || classesLoading || subjectsLoading;
  const progressPercentage = Math.round((currentStage / 4) * 100);

  // Combine errors
  const error = pupilsError || staffError || classesError || subjectsError
    ? (pupilsError?.message || staffError?.message || classesError?.message || subjectsError?.message || 'Failed to load data')
    : null;

  // Log cache usage in development
  if (process.env.NODE_ENV === 'development' && !isProcessing && isComplete) {
    console.log('⚡ PROGRESSIVE DASHBOARD: Using cached data from real-time listeners', {
      pupils: pupils.length,
      staff: staff.length,
      classes: classes.length,
      subjects: subjects.length
    });
  }

  return {
    // Data - all from real-time listener cache
    pupils,
    staff,
    classes,
    subjects,
    schoolSettings,
    photos,
    stats,

    // Loading states (for compatibility with existing code)
    pupilsLoading,
    staffLoading,
    classesLoading,
    subjectsLoading,
    isLoading: isProcessing,
    settingsLoading: isLoadingSettings,
    photosLoading: isLoadingPhotos,

    // Progressive loading info (maintained for compatibility)
    isProcessing,
    currentStage,
    totalStages: 4,
    progressPercentage,
    processedStages: isComplete
      ? ['Loading classes...', 'Loading subjects...', 'Loading staff...', 'Loading active pupils...']
      : [],
    stageProgress,
    error,
    isComplete,

    // Restart is a no-op since data comes from real-time listeners
    restart: () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 PROGRESSIVE DASHBOARD: Data is managed by real-time listeners, no manual restart needed');
      }
    }
  };
}
