'use client';

import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';

const PARENT_DASHBOARD_REVISIONS = 'parentDashboardRevisions';

/**
 * One account-scoped document is the parent dashboard's change signal. It is
 * intentionally a listener: Firestore sends a new record only when the
 * school changes a relevant dataset, rather than the dashboard polling.
 */
export function useParentDashboardRevision(
  accountId: string | undefined,
  dataset: 'banking' | 'attendance' | 'results',
) {
  const [revision, setRevision] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(Boolean(accountId));

  useEffect(() => {
    if (!accountId) {
      setRevision(undefined);
      setIsLoading(false);
      return;
    }

    setRevision(undefined);
    setIsLoading(true);
    return onSnapshot(
      doc(db, PARENT_DASHBOARD_REVISIONS, accountId),
      { includeMetadataChanges: true },
      snapshot => {
        const nextRevision = snapshot.exists() ? Number(snapshot.data()?.[dataset] || 0) : 0;
        setRevision(Number.isFinite(nextRevision) && nextRevision >= 0 ? nextRevision : 0);
        setIsLoading(false);
      },
      error => {
        // Existing device data remains usable if this tiny invalidation channel
        // cannot connect. The next successful listener snapshot resumes sync.
        console.warn('Parent dashboard revision listener failed:', error);
        setRevision(0);
        setIsLoading(false);
      },
    );
  }, [accountId, dataset]);

  return { revision, isLoading };
}

export function useParentBankingRevision(accountId?: string) {
  return useParentDashboardRevision(accountId, 'banking');
}

export function useParentResultsRevision(accountId?: string) {
  return useParentDashboardRevision(accountId, 'results');
}
