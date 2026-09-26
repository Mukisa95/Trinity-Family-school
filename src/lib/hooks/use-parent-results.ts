'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParentResultsRevision } from '@/lib/hooks/use-parent-dashboard-revision';
import {
  isParentOfflineStorageAvailable,
  readParentOfflineResults,
  saveParentOfflineResults,
  subscribeToParentOfflineChanges,
} from '@/lib/parent-offline/repository';
import type { ParentOfflineResultsSnapshot } from '@/lib/parent-offline/contracts';
import { ParentResultsService } from '@/lib/services/parent-results.service';

export const parentResultsKeys = {
  all: ['parent-results'] as const,
  byPupil: (accountId: string | undefined, pupilId: string, revision: number | undefined) =>
    [...parentResultsKeys.all, accountId || 'signed-out', pupilId, revision ?? 'unknown'] as const,
};

function useOnlineStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

/** Saves only the signed-in family's released results, never class-wide records. */
export function useParentResults(
  pupilId: string,
  accountId?: string,
  familyId?: string,
  enabled = true,
) {
  const online = useOnlineStatus();
  const { revision: resultsRevision, isLoading: isRevisionLoading } = useParentResultsRevision(accountId);
  const [savedSnapshot, setSavedSnapshot] = useState<ParentOfflineResultsSnapshot | null>(null);
  const [isStorageLoading, setIsStorageLoading] = useState(Boolean(accountId && pupilId));

  const loadSavedSnapshot = useCallback(async () => {
    if (!accountId || !pupilId || !isParentOfflineStorageAvailable()) {
      setSavedSnapshot(null);
      setIsStorageLoading(false);
      return;
    }
    setIsStorageLoading(true);
    try {
      setSavedSnapshot(await readParentOfflineResults(accountId, pupilId));
    } finally {
      setIsStorageLoading(false);
    }
  }, [accountId, pupilId]);

  useEffect(() => {
    setSavedSnapshot(null);
    void loadSavedSnapshot();
    if (!accountId) return;
    return subscribeToParentOfflineChanges(accountId, () => void loadSavedSnapshot());
  }, [accountId, loadSavedSnapshot]);

  const query = useQuery({
    queryKey: parentResultsKeys.byPupil(accountId, pupilId, resultsRevision),
    queryFn: () => ParentResultsService.getForPupil(pupilId),
    enabled: Boolean(
      pupilId &&
      accountId &&
      enabled &&
      online &&
      !isStorageLoading &&
      !isRevisionLoading &&
      (!savedSnapshot || (resultsRevision !== undefined && resultsRevision > savedSnapshot.revision)),
    ),
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: previousData => previousData,
  });

  useEffect(() => {
    if (!accountId || !pupilId || !query.data || resultsRevision === undefined) return;
    void saveParentOfflineResults({
      accountId,
      pupilId,
      revision: resultsRevision,
      results: query.data,
    })
      .then(snapshot => setSavedSnapshot(snapshot))
      .catch(error => console.warn('Could not save parent results for offline use:', error));
  }, [accountId, pupilId, query.data, resultsRevision]);

  const data = query.data || savedSnapshot?.results;

  return {
    ...query,
    data,
    error: data ? null : query.error,
    isLoading: isStorageLoading || isRevisionLoading || (query.isLoading && !data),
    isOfflineData: Boolean(savedSnapshot && !online && !query.data),
    preparedAt: savedSnapshot?.preparedAt,
  };
}
