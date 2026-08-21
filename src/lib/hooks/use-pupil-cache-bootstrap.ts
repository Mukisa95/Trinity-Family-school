"use client";

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Pupil } from '@/types';
import { useAuth } from '@/lib/contexts/auth-context';
import { PupilsService } from '@/lib/services/pupils.service';
import { pupilsKeys } from './use-pupils';
import { useDashboardDataRevisions } from './use-school-settings';
import {
  getPupilCacheChangeIds,
  hasCompletePupilCacheChangeRange,
  type PupilCacheChange,
} from '@/lib/cache/pupil-cache-changes';
import {
  getPupilCacheScope,
  normalisePupils,
  readPupilCache,
  writePupilCache,
} from '@/lib/cache/pupil-cache';

function applyChanges(
  current: Pupil[],
  changes: PupilCacheChange[],
  changedPupils: Pupil[],
): Pupil[] {
  const byId = new Map(current.map(pupil => [pupil.id, pupil]));
  changes.forEach(change => {
    if (change.operation === 'delete') {
      getPupilCacheChangeIds(change).forEach(pupilId => byId.delete(pupilId));
    }
  });
  changedPupils.forEach(pupil => byId.set(pupil.id, pupil));
  return normalisePupils(Array.from(byId.values()));
}

/**
 * Sole school-wide pupil cache owner for staff and administrators.
 *
 * A warm device restores one IndexedDB snapshot and performs no pupils query
 * while its revision is current. Mutations publish tiny ordered change records,
 * allowing stale devices to fetch only changed pupil documents. Parent data is
 * intentionally excluded and remains owned by the family-scoped listener.
 */
export function usePupilCacheBootstrap() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const previousScope = useRef<string | null>(null);
  const retryTarget = useRef('');
  const retryCount = useRef(0);
  const [retryEpoch, setRetryEpoch] = useState(0);

  const scope = isAuthenticated ? getPupilCacheScope(user?.id, user?.role) : '';
  const revision = revisionsQuery.data?.pupils ?? 0;
  const revisionsReady = revisionsQuery.data !== undefined;

  useEffect(() => {
    if (!scope) {
      if (previousScope.current) {
        queryClient.removeQueries({ queryKey: pupilsKeys.all });
        previousScope.current = null;
      }
      PupilsService.clearSharedPupils();
      return;
    }

    if (previousScope.current && previousScope.current !== scope) {
      queryClient.removeQueries({ queryKey: pupilsKeys.all });
      PupilsService.clearSharedPupils();
    }
    previousScope.current = scope;

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const target = `${scope}:${revisionsReady ? revision : 'cold'}`;
    if (retryTarget.current !== target) {
      retryTarget.current = target;
      retryCount.current = 0;
    }

    const publish = async (pupils: Pupil[], publishedRevision: number) => {
      if (disposed) return;
      const normalised = normalisePupils(pupils);
      PupilsService.hydrateSharedPupils(normalised);
      queryClient.setQueryData(pupilsKeys.lists(), normalised);
      await writePupilCache(scope, publishedRevision, normalised);
      performance.mark?.('trinity:pupils-revision-cache-ready');
    };

    const reconcile = async () => {
      const persisted = await readPupilCache(scope);
      if (disposed) return;

      const inMemory = queryClient.getQueryData<Pupil[]>(pupilsKeys.lists());
      const startingData = inMemory ?? persisted?.data;
      if (startingData) {
        PupilsService.hydrateSharedPupils(startingData);
        if (inMemory === undefined) queryClient.setQueryData(pupilsKeys.lists(), startingData);
      }

      const needsColdFetch = persisted === null && inMemory === undefined;
      const needsRevisionRefresh = revisionsReady && persisted?.revision !== revision;
      if (!needsColdFetch && !needsRevisionRefresh) return;

      if (needsColdFetch) {
        void PupilsService.getAllFromFirestoreCache().then(cachedPupils => {
          if (disposed || cachedPupils.length === 0) return;
          PupilsService.hydrateSharedPupils(cachedPupils);
          queryClient.setQueryData(pupilsKeys.lists(), normalisePupils(cachedPupils));
          performance.mark?.('trinity:pupils-firestore-cache-ready');
        });
      }

      const refreshed = await PupilsService.refreshSharedPupils(revision, async () => {
        if (!persisted || persisted.revision > revision) {
          return PupilsService.getAllForCache();
        }

        const changes = await PupilsService.getCacheChanges(persisted.revision, revision);
        if (!hasCompletePupilCacheChangeRange(changes, persisted.revision, revision)) {
          // A legacy/direct write did not publish a usable delta. Rebase once
          // instead of silently preserving a stale pupil snapshot.
          return PupilsService.getAllForCache();
        }

        const changedIds = Array.from(new Set(
          changes
            .filter(change => change.operation !== 'delete')
            .flatMap(getPupilCacheChangeIds),
        ));
        const changedPupils = await PupilsService.getPupilsByIdsForCache(changedIds);
        return applyChanges(persisted.data, changes, changedPupils);
      });

      await publish(refreshed, revisionsReady ? revision : 0);
      retryCount.current = 0;
    };

    void reconcile().catch(error => {
      console.error('Pupil cache reconciliation failed:', error);
      if (!disposed && retryCount.current < 2) {
        retryCount.current += 1;
        retryTimer = setTimeout(() => setRetryEpoch(epoch => epoch + 1), 3000);
      }
    });

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [queryClient, retryEpoch, revision, revisionsReady, scope]);
}
