'use client';

import { doc, onSnapshot } from 'firebase/firestore';
import { useCallback, useSyncExternalStore } from 'react';
import { db } from '@/lib/firebase';

const PARENT_DASHBOARD_REVISIONS = 'parentDashboardRevisions';

export type ParentDashboardRevisions = {
  banking: number;
  attendance: number;
  results: number;
};

type RevisionState = {
  revisions: ParentDashboardRevisions | undefined;
  isLoading: boolean;
};

type RevisionEntry = {
  state: RevisionState;
  subscribers: Set<() => void>;
  unsubscribe?: () => void;
};

const NO_FAMILY_STATE: RevisionState = { revisions: undefined, isLoading: false };
const LOADING_STATE: RevisionState = { revisions: undefined, isLoading: true };
const revisionEntries = new Map<string, RevisionEntry>();

function normalizeRevision(value: unknown) {
  const revision = Number(value || 0);
  return Number.isFinite(revision) && revision >= 0 ? revision : 0;
}

function getRevisionEntry(familyId: string) {
  let entry = revisionEntries.get(familyId);
  if (!entry) {
    entry = {
      state: LOADING_STATE,
      subscribers: new Set(),
    };
    revisionEntries.set(familyId, entry);
  }
  return entry;
}

function publish(entry: RevisionEntry, state: RevisionState) {
  const previous = entry.state;
  if (
    previous.isLoading === state.isLoading &&
    previous.revisions?.banking === state.revisions?.banking &&
    previous.revisions?.attendance === state.revisions?.attendance &&
    previous.revisions?.results === state.revisions?.results
  ) {
    return;
  }
  entry.state = state;
  entry.subscribers.forEach(subscriber => subscriber());
}

function subscribeToFamilyRevisions(familyId: string, subscriber: () => void) {
  const entry = getRevisionEntry(familyId);
  entry.subscribers.add(subscriber);

  if (!entry.unsubscribe) {
    entry.unsubscribe = onSnapshot(
      doc(db, PARENT_DASHBOARD_REVISIONS, familyId),
      { includeMetadataChanges: true },
      snapshot => {
        const data = snapshot.exists() ? snapshot.data() : {};
        publish(entry, {
          revisions: {
            banking: normalizeRevision(data.banking),
            attendance: normalizeRevision(data.attendance),
            results: normalizeRevision(data.results),
          },
          isLoading: false,
        });
      },
      error => {
        // Existing device data remains usable if this tiny invalidation channel
        // cannot connect. The next subscription resumes synchronization.
        console.warn('Parent dashboard revision listener failed:', error);
        publish(entry, {
          revisions: { banking: 0, attendance: 0, results: 0 },
          isLoading: false,
        });
      },
    );
  }

  return () => {
    entry.subscribers.delete(subscriber);
    if (entry.subscribers.size === 0) {
      entry.unsubscribe?.();
      revisionEntries.delete(familyId);
    }
  };
}

/** Shares one Firestore revision-document listener across every family consumer. */
export function useParentDashboardRevisions(familyId?: string) {
  const subscribe = useCallback((subscriber: () => void) => {
    if (!familyId) return () => undefined;
    return subscribeToFamilyRevisions(familyId, subscriber);
  }, [familyId]);

  const getSnapshot = useCallback(
    () => familyId ? getRevisionEntry(familyId).state : NO_FAMILY_STATE,
    [familyId],
  );

  const getServerSnapshot = useCallback(
    () => familyId ? LOADING_STATE : NO_FAMILY_STATE,
    [familyId],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * One family-scoped document is the parent dashboard's change signal. It is
 * intentionally a listener: Firestore sends a new record only when the
 * school changes a relevant dataset, rather than the dashboard polling.
 */
export function useParentDashboardRevision(
  familyId: string | undefined,
  dataset: 'banking' | 'attendance' | 'results',
) {
  const { revisions, isLoading } = useParentDashboardRevisions(familyId);
  return { revision: revisions?.[dataset], isLoading };
}

export function useParentBankingRevision(familyId?: string) {
  return useParentDashboardRevision(familyId, 'banking');
}

export function useParentResultsRevision(familyId?: string) {
  return useParentDashboardRevision(familyId, 'results');
}
