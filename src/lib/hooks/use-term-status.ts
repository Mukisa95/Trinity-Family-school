import { useMemo } from 'react';
import { useAcademicYears } from './use-academic-years';
import { 
  getTermStatusForDate, 
  getEffectiveTermForDataDisplay, 
  shouldDisplayRecessMode, 
  getCurrentPeriodMessage,
  type TermStatus 
} from '../utils/term-status-utils';

/**
 * Hook to get the current term status and determine what data should be displayed
 */
export function useTermStatus(targetDate?: Date) {
  const { data: academicYears = [] } = useAcademicYears();
  
  const termStatus = useMemo(() => {
    return getTermStatusForDate(academicYears, targetDate);
  }, [academicYears, targetDate]);
  
  const effectiveTerm = useMemo(() => {
    return getEffectiveTermForDataDisplay(academicYears, targetDate);
  }, [academicYears, targetDate]);
  
  const isRecessMode = useMemo(() => {
    return shouldDisplayRecessMode(academicYears);
  }, [academicYears]);
  
  const periodMessage = useMemo(() => {
    return getCurrentPeriodMessage(academicYears);
  }, [academicYears]);
  
  return {
    termStatus,
    effectiveTerm,
    isRecessMode,
    periodMessage,
    academicYears
  };
}

/**
 * Hook to get the effective term ID for data filtering
 * This is useful for components that need to filter data by term
 */
export function useEffectiveTermId(targetDate?: Date) {
  const { effectiveTerm } = useTermStatus(targetDate);
  return effectiveTerm.term?.id || null;
}

/**
 * Hook to check if the system is currently in recess mode
 */
export function useRecessMode(targetDate?: Date) {
  const { isRecessMode, termStatus } = useTermStatus(targetDate);
  return {
    isRecessMode,
    recessInfo: termStatus.recessInfo
  };
}

/**
 * Hook to get the current academic period information
 */
export function useCurrentAcademicPeriod(targetDate?: Date) {
  const { termStatus, periodMessage } = useTermStatus(targetDate);
  
  return {
    currentTerm: termStatus.currentTerm,
    previousTerm: termStatus.previousTerm,
    nextTerm: termStatus.nextTerm,
    isInRecess: termStatus.isRecessPeriod,
    isHoliday: termStatus.isHolidayPeriod,
    shouldShowPreviousTermData: termStatus.shouldShowPreviousTermData,
    periodMessage,
    recessInfo: termStatus.recessInfo
  };
}
