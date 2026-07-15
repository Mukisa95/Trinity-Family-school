import { useQuery } from '@tanstack/react-query';
import { useStaff } from './use-staff';

/**
 * Hook to efficiently resolve a list of teacher IDs to full names.
 * Prioritizes React Query's existing staff cache (`useStaff()`) to avoid network requests,
 * and falls back to individual API lookups only if staff IDs are not found in cache.
 */
export function useTeacherNames(teacherIds: string[]) {
  const { data: allStaff = [] } = useStaff();

  return useQuery({
    queryKey: ['teacherNames', ...[...teacherIds].sort()],
    queryFn: async () => {
      const staffMap = new Map<string, string>();
      allStaff.forEach((s) => {
        const name = `${s.firstName || ''} ${s.lastName || ''}`.trim();
        if (s.id && name) {
          staffMap.set(s.id, name);
        }
      });

      const result: Record<string, string> = {};

      const missingIds: string[] = [];
      for (const id of teacherIds) {
        if (!id) continue;
        if (staffMap.has(id)) {
          result[id] = staffMap.get(id)!;
        } else {
          missingIds.push(id);
        }
      }

      // Fetch any missing teacher IDs
      if (missingIds.length > 0) {
        const fetched = await Promise.all(
          missingIds.map(async (id) => {
            try {
              const res = await fetch(`/api/staff/${id}`);
              if (res.ok) {
                const data = await res.json();
                const name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
                return { id, name: name || 'Unknown Teacher' };
              }
            } catch {
              // fallback
            }
            return { id, name: 'Unknown Teacher' };
          })
        );

        fetched.forEach(({ id, name }) => {
          result[id] = name;
        });
      }

      return result;
    },
    enabled: teacherIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}
