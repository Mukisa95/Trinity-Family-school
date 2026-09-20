'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  isParentOfflineStorageAvailable,
  readParentOfflineFees,
  saveParentOfflineFees,
  subscribeToParentOfflineChanges,
} from '@/lib/parent-offline/repository';
import type { ParentOfflineFeeDisplay, ParentOfflineFeesSnapshot } from '@/lib/parent-offline/contracts';

export function useParentOfflineFees(
  accountId: string | undefined,
  pupilId: string,
  academicYearId: string | undefined,
  termId: string | undefined,
) {
  const [snapshot, setSnapshot] = useState<ParentOfflineFeesSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(accountId && pupilId && academicYearId && termId));

  const load = useCallback(async () => {
    if (!accountId || !pupilId || !academicYearId || !termId || !isParentOfflineStorageAvailable()) {
      setSnapshot(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setSnapshot(await readParentOfflineFees(accountId, pupilId, academicYearId, termId));
    } finally {
      setIsLoading(false);
    }
  }, [accountId, academicYearId, pupilId, termId]);

  useEffect(() => {
    setSnapshot(null);
    void load();
    if (!accountId) return;
    return subscribeToParentOfflineChanges(accountId, () => void load());
  }, [accountId, load]);

  const save = useCallback(async (
    fees: ParentOfflineFeeDisplay[],
    totals: ParentOfflineFeesSnapshot['totals'],
  ) => {
    if (!accountId || !pupilId || !academicYearId || !termId) return null;
    const next = await saveParentOfflineFees({ accountId, pupilId, academicYearId, termId, fees, totals });
    setSnapshot(next);
    return next;
  }, [accountId, academicYearId, pupilId, termId]);

  return { snapshot, isLoading, save };
}
