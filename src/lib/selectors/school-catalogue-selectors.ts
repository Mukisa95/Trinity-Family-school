import type { RequirementItem, UniformItem } from '@/types';

/** A confirmed empty filtered result is valid; it never starts a fallback read. */
export function filterSchoolCatalogue<T extends RequirementItem | UniformItem>(items: T[], filters: {
  gender?: string; classId?: string; section?: string;
}): T[] {
  return items.filter(item => item.isActive
    && (!filters.gender || filters.gender === 'all' || item.gender === filters.gender || item.gender === 'all')
    && (!filters.classId || item.classType === 'all' || (item.classType === 'specific' && item.classIds?.includes(filters.classId)))
    && (!filters.section || item.sectionType === 'all' || (item.sectionType === 'specific' && item.section === filters.section)));
}
