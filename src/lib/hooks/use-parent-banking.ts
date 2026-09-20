'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ParentBankingService } from '@/lib/services/parent-banking.service';
import { useParentBankingRevision } from '@/lib/hooks/use-parent-dashboard-revision';
import {
  isParentOfflineStorageAvailable,
  readParentOfflineBanking,
  saveParentOfflineBanking,
  subscribeToParentOfflineChanges,
} from '@/lib/parent-offline/repository';
import type { ParentOfflineBankingSnapshot } from '@/lib/parent-offline/contracts';

export const parentBankingKeys = {
  all: ['parent-banking'] as const,
  byPupil: (accountId: string | undefined, pupilId: string, revision: number | undefined) =>
    [...parentBankingKeys.all, accountId || 'signed-out', pupilId, revision ?? 'unknown'] as const,
};

/**
 * Parent banking never reads raw browser Firestore collections. It shares one
 * server-checked request between the dashboard navigation and banking view.
 */
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

export function useParentBanking(
  pupilId: string,
  accountId?: string,
  familyId?: string,
  enabled = true,
) {
  const online = useOnlineStatus();
  const { revision: bankingRevision, isLoading: isRevisionLoading } = useParentBankingRevision(familyId);
  const [savedSnapshot, setSavedSnapshot] = useState<ParentOfflineBankingSnapshot | null>(null);
  const [isStorageLoading, setIsStorageLoading] = useState(Boolean(accountId && pupilId));

  const loadSavedSnapshot = useCallback(async () => {
    if (!accountId || !pupilId || !isParentOfflineStorageAvailable()) {
      setSavedSnapshot(null);
      setIsStorageLoading(false);
      return;
    }
    setIsStorageLoading(true);
    try {
      setSavedSnapshot(await readParentOfflineBanking(accountId, pupilId));
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
    queryKey: parentBankingKeys.byPupil(accountId, pupilId, bankingRevision),
    queryFn: () => ParentBankingService.getForPupil(pupilId),
    // A saved complete record wins at startup. Later work will invalidate this
    // query from a family revision, rather than polling whenever a parent
    // revisits the dashboard.
    enabled: Boolean(
      pupilId &&
      accountId &&
      enabled &&
      online &&
      !isStorageLoading &&
      !isRevisionLoading &&
      (!savedSnapshot || (bankingRevision !== undefined && bankingRevision > savedSnapshot.revision)),
    ),
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: previousData => previousData,
  });

  useEffect(() => {
    if (!accountId || !pupilId || !query.data || bankingRevision === undefined) return;
    void saveParentOfflineBanking({ accountId, pupilId, revision: bankingRevision, ...query.data })
      .then(snapshot => setSavedSnapshot(snapshot))
      .catch(error => console.warn('Could not save parent banking information for offline use:', error));
  }, [accountId, bankingRevision, pupilId, query.data]);

  const data = query.data || (savedSnapshot ? {
    account: savedSnapshot.account,
    transactions: savedSnapshot.transactions,
    loans: savedSnapshot.loans,
  } : undefined);

  return {
    ...query,
    data,
    error: data ? null : query.error,
    isLoading: isStorageLoading || isRevisionLoading || (query.isLoading && !data),
    isOfflineData: Boolean(savedSnapshot && !online && !query.data),
    preparedAt: savedSnapshot?.preparedAt,
  };
}
