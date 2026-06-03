import type { Pupil } from "@/types";
import type { SchoolSettings } from "@/types";

/**
 * Checks if a pupil should be excluded based on pending status settings
 * 
 * IMPORTANT: Components checked in "Affected Components" are those WHERE pending pupils 
 * should NOT be fetched/shown. Unchecked components will show ALL pupils including pending ones.
 * 
 * @param pupil - The pupil to check
 * @param schoolSettings - School settings containing pending configuration
 * @param component - The component context ('classes', 'exams', 'attendance', 'pupilsList', 'feesCollection')
 * @returns true if the pupil should be excluded (is pending and component is checked in affected components), false otherwise
 */
export function shouldExcludePendingPupil(
  pupil: Pupil,
  schoolSettings: SchoolSettings | undefined | null,
  component: 'classes' | 'exams' | 'attendance' | 'pupilsList' | 'feesCollection'
): boolean {
  // If pending is not enabled, don't exclude anyone - show all pupils
  if (!schoolSettings?.pending?.enabled) {
    return false;
  }

  // If pupil is not in Pending status, don't exclude - show them everywhere
  if (pupil.status !== 'Pending') {
    return false;
  }

  // Only exclude pending pupils if the component is checked in affected components
  // Checked = component where pending pupils should NOT be shown
  const affectedComponents = schoolSettings.pending.affectedComponents;
  if (!affectedComponents) {
    // If no components are specified, don't exclude (show all including pending)
    return false;
  }

  // Map component names to settings keys
  const componentMap: Record<string, keyof typeof affectedComponents> = {
    'classes': 'classes',
    'exams': 'exams',
    'attendance': 'attendance',
    'pupilsList': 'pupilsList',
    'feesCollection': 'feesCollection', // Added for fees collection
  };

  const componentKey = componentMap[component];
  if (!componentKey) {
    // Unknown component - don't exclude (show all including pending)
    return false;
  }

  // Exclude pending pupils ONLY if this component is checked (marked as affected)
  // If unchecked, return false (don't exclude, show all including pending)
  return affectedComponents[componentKey] === true;
}

/**
 * Filters out pending pupils from an array based on settings
 * 
 * Only filters out pending pupils if:
 * 1. Pending status is enabled in settings
 * 2. The component is checked in "Affected Components" (meaning pending should be excluded)
 * 
 * Unchecked components will return all pupils including pending ones.
 * 
 * @param pupils - Array of pupils to filter
 * @param schoolSettings - School settings
 * @param component - The component context
 * @returns Filtered array of pupils (excluding pending only if component is affected)
 */
export function filterPendingPupils(
  pupils: Pupil[],
  schoolSettings: SchoolSettings | undefined | null,
  component: 'classes' | 'exams' | 'attendance' | 'pupilsList' | 'feesCollection'
): Pupil[] {
  return pupils.filter(pupil => !shouldExcludePendingPupil(pupil, schoolSettings, component));
}

