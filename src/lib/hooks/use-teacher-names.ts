import { useMemo } from 'react';
import { useStaff } from './use-staff';

/**
 * Hook to efficiently resolve a list of teacher IDs to full names.
 * Resolves entirely from the canonical staff cache. A missing historical ID is
 * intentionally labelled rather than creating an N+1 browser fetch.
 */
export function useTeacherNames(teacherIds: string[]) {
  const { data: allStaff = [] } = useStaff();

  const data = useMemo(() => {
    const staffMap = new Map(
      allStaff.map(staff => [
        staff.id,
        `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'Unknown Teacher',
      ]),
    );
    return teacherIds.reduce<Record<string, string>>((names, id) => {
      if (id) names[id] = staffMap.get(id) || 'Unknown Teacher';
      return names;
    }, {});
  }, [allStaff, teacherIds]);

  return { data, isLoading: false, isFetching: false, error: null };
}
