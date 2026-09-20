'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Pupil } from '@/types';
import { pupilsKeys } from '@/lib/hooks/use-pupils';
import { prepareParentAppShell } from '@/lib/parent-offline/app-shell';
import { useParentAppRelease } from '@/lib/hooks/use-parent-app-release';
import {
  getParentOfflineFamilyStatus,
  isParentOfflineStorageAvailable,
  readParentOfflineFamily,
  removeParentOfflineAccount,
  saveParentOfflineFamily,
  subscribeToParentOfflineChanges,
} from '@/lib/parent-offline/repository';
import type { ParentOfflineFamilySnapshot, ParentOfflineFamilyStatus } from '@/lib/parent-offline/contracts';

type OfflineState = 'unavailable' | 'loading' | 'saving' | 'ready' | 'error';

function familyFingerprint(pupils: Pupil[]) {
  return JSON.stringify(
    pupils
      .map(pupil => ({ id: pupil.id, pupil }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}

export function useParentOfflineFamily({
  accountId,
  familyId,
  liveFamilyMembers,
  hasLiveFamilyData,
}: {
  accountId?: string;
  familyId?: string;
  liveFamilyMembers?: Pupil[];
  hasLiveFamilyData: boolean;
}) {
  useParentAppRelease(Boolean(accountId));
  const queryClient = useQueryClient();
  const [savedFamily, setSavedFamily] = useState<ParentOfflineFamilySnapshot | null>(null);
  const [state, setState] = useState<OfflineState>(
    isParentOfflineStorageAvailable() ? 'loading' : 'unavailable',
  );
  const [error, setError] = useState<string | null>(null);
  const liveFingerprint = useMemo(() => familyFingerprint(liveFamilyMembers || []), [liveFamilyMembers]);

  const load = useCallback(async () => {
    if (!accountId) {
      setSavedFamily(null);
      return;
    }
    if (!isParentOfflineStorageAvailable()) {
      setState('unavailable');
      return;
    }
    try {
      const snapshot = await readParentOfflineFamily(accountId);
      setSavedFamily(snapshot);
      setState(snapshot ? 'ready' : 'loading');
      setError(null);
    } catch (loadError) {
      setState('error');
      setError(loadError instanceof Error ? loadError.message : 'Could not read saved parent information.');
    }
  }, [accountId]);

  useEffect(() => {
    setSavedFamily(null);
    void load();
    if (!accountId) return;
    return subscribeToParentOfflineChanges(accountId, () => void load());
  }, [accountId, load]);

  // Existing parent components already obtain profile information through
  // usePupil(). Hydrating that canonical query from this account's saved family
  // lets the unchanged parent dashboard render its child header and profile
  // while Firestore is unavailable. A later live source remains authoritative.
  useEffect(() => {
    if (!accountId || hasLiveFamilyData || !savedFamily || savedFamily.accountId !== accountId) return;
    queryClient.setQueryData(pupilsKeys.lists(), savedFamily.pupils);
  }, [accountId, hasLiveFamilyData, queryClient, savedFamily]);

  useEffect(() => {
    if (!accountId || !hasLiveFamilyData || !liveFamilyMembers?.length) return;
    let cancelled = false;
    setState('saving');
    void saveParentOfflineFamily({ accountId, familyId, pupils: liveFamilyMembers })
      .then(snapshot => {
        if (cancelled) return;
        setSavedFamily(snapshot);
        setState('ready');
        setError(null);
      })
      .catch(saveError => {
        if (cancelled) return;
        setState('error');
        setError(saveError instanceof Error ? saveError.message : 'Could not save parent information for offline use.');
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, familyId, hasLiveFamilyData, liveFingerprint, liveFamilyMembers]);

  // The interface is saved separately from private records. A failed shell
  // preparation must not discard a successfully saved family snapshot; the
  // status is kept in the console until the dedicated readiness UI lands with
  // the remaining datasets.
  useEffect(() => {
    if (!accountId) return;
    void prepareParentAppShell().catch(error => {
      console.warn('Parent offline interface preparation failed:', error);
    });
  }, [accountId]);

  return {
    familyMembers: hasLiveFamilyData
      ? (liveFamilyMembers || [])
      : (!savedFamily || savedFamily.accountId !== accountId ? [] : savedFamily.pupils),
    savedFamily,
    state,
    error,
  };
}

export function useParentOfflineStatus(accountId?: string) {
  const [status, setStatus] = useState<ParentOfflineFamilyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(accountId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accountId) {
      setStatus(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setStatus(await getParentOfflineFamilyStatus(accountId));
      setError(null);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not read saved parent information.');
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refresh();
    if (!accountId) return;
    return subscribeToParentOfflineChanges(accountId, () => void refresh());
  }, [accountId, refresh]);

  const remove = useCallback(async () => {
    if (!accountId) return;
    await removeParentOfflineAccount(accountId);
    await refresh();
  }, [accountId, refresh]);

  return { status, isLoading, error, refresh, remove, isSupported: isParentOfflineStorageAvailable() };
}
