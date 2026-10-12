import type { QueryClient } from '@tanstack/react-query';
import type { Pupil } from '@/types';

/** Reject cached records that may have been written under a prior parent's key. */
export function isParentPupilSnapshotOwnedByAccount(accountId: string, pupils: unknown): pupils is Pupil[] {
  return Array.isArray(pupils) && pupils.every(pupil => (
    pupil && typeof pupil === 'object'
    && pupil.parentAccountId === accountId && pupil.parentAccountActive === true
  ));
}

/** Clear identity-independent private queries when the signed-in user changes. */
export function clearPupilSessionQueries(queryClient: QueryClient) {
  // A mounted disabled QueryObserver can retain its last result after a
  // removeQueries call. Scrub observers before evicting their query entries.
  for (const root of [['pupils'], ['pupils-by-class'], ['payments']]) {
    queryClient.getQueryCache().findAll({ queryKey: root }).forEach(query => {
      queryClient.setQueryData(query.queryKey, current => {
        if (Array.isArray(current)) return [];
        if (current instanceof Map) return new Map();
        return null;
      });
    });
  }
  queryClient.setQueryData(['pupils', 'list'], []);
  queryClient.setQueryData(['pupils', 'hydration'], 'loading');
  queryClient.removeQueries({ queryKey: ['pupils'], predicate: query => (
    query.queryKey.length !== 2 || !['list', 'hydration'].includes(String(query.queryKey[1]))
  ) });
  queryClient.removeQueries({ queryKey: ['pupils-by-class'] });
  queryClient.removeQueries({ queryKey: ['payments'] });
}
