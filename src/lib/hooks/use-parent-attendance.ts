'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParentDashboardRevision } from '@/lib/hooks/use-parent-dashboard-revision';
import {
  isParentOfflineStorageAvailable,
  readParentOfflineAttendance,
  saveParentOfflineAttendance,
  subscribeToParentOfflineChanges,
} from '@/lib/parent-offline/repository';
import type { ParentOfflineAttendanceSnapshot } from '@/lib/parent-offline/contracts';
import { ParentAttendanceService } from '@/lib/services/parent-attendance.service';

export const parentAttendanceKeys = {
  all: ['parent-attendance'] as const,
  byPupil: (accountId: string | undefined, pupilId: string, revision: number | undefined) =>
    [...parentAttendanceKeys.all, accountId || 'signed-out', pupilId, revision ?? 'unknown'] as const,
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

/**
 * Attendance follows the same local-first contract as banking: show the last
 * complete, parent-authorized projection immediately and only download again
 * after a school-side attendance change advances this account's revision.
 */
export function useParentAttendance(
  pupilId: string,
  accountId?: string,
  familyId?: string,
  enabled = true,
) {
  const online = useOnlineStatus();
  const { revision: attendanceRevision, isLoading: isRevisionLoading } = useParentDashboardRevision(accountId, 'attendance');
  const [savedSnapshot, setSavedSnapshot] = useState<ParentOfflineAttendanceSnapshot | null>(null);
  const [isStorageLoading, setIsStorageLoading] = useState(Boolean(accountId && pupilId));

  const loadSavedSnapshot = useCallback(async () => {
    if (!accountId || !pupilId || !isParentOfflineStorageAvailable()) {
      setSavedSnapshot(null);
      setIsStorageLoading(false);
      return;
    }
    setIsStorageLoading(true);
    try {
      setSavedSnapshot(await readParentOfflineAttendance(accountId, pupilId));
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
    queryKey: parentAttendanceKeys.byPupil(accountId, pupilId, attendanceRevision),
    queryFn: () => ParentAttendanceService.getForPupil(pupilId),
    enabled: Boolean(
      pupilId &&
      accountId &&
      enabled &&
      online &&
      !isStorageLoading &&
      !isRevisionLoading &&
      (!savedSnapshot || (attendanceRevision !== undefined && attendanceRevision > savedSnapshot.revision)),
    ),
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: previousData => previousData,
  });

  useEffect(() => {
    if (!accountId || !pupilId || !query.data || attendanceRevision === undefined) return;
    void saveParentOfflineAttendance({
      accountId,
      pupilId,
      revision: attendanceRevision,
      records: query.data,
    })
      .then(snapshot => setSavedSnapshot(snapshot))
      .catch(error => console.warn('Could not save parent attendance information for offline use:', error));
  }, [accountId, attendanceRevision, pupilId, query.data]);

  const data = query.data || savedSnapshot?.records;

  return {
    ...query,
    data,
    error: data ? null : query.error,
    isLoading: isStorageLoading || isRevisionLoading || (query.isLoading && !data),
    isOfflineData: Boolean(savedSnapshot && !online && !query.data),
    preparedAt: savedSnapshot?.preparedAt,
  };
}
