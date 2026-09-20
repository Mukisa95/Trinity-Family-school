'use client';

import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';

const PARENT_DASHBOARD_REVISIONS = 'parentDashboardRevisions';

/**
 * One family-scoped document is the parent dashboard's change signal. It is
 * intentionally a listener: Firestore sends a new record only when the
 * school changes a relevant dataset, rather than the dashboard polling.
 */
export function useParentDashboardRevision(
  familyId: string | undefined,
  dataset: 'banking' | 'attendance' | 'results',
) {
  const [revision, setRevision] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(Boolean(familyId));

  useEffect(() => {
    if (!familyId) {
      setRevision(undefined);
      setIsLoading(false);
      return;
    }

    setRevision(undefined);
    setIsLoading(true);
    return onSnapshot(
      doc(db, PARENT_DASHBOARD_REVISIONS, familyId),
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
  }, [dataset, familyId]);

  return { revision, isLoading };
}

export function useParentBankingRevision(familyId?: string) {
  return useParentDashboardRevision(familyId, 'banking');
}

export function useParentResultsRevision(familyId?: string) {
  return useParentDashboardRevision(familyId, 'results');
}
