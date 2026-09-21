'use client';

import { useEffect, useState } from 'react';
import type { Pupil } from '@/types';
import { useParentDashboardRevision } from '@/lib/hooks/use-parent-dashboard-revision';
import {
  isParentOfflineStorageAvailable,
  readParentOfflineAttendance,
  readParentOfflineBanking,
  readParentOfflineResults,
  saveParentOfflineAttendance,
  saveParentOfflineBanking,
  saveParentOfflineResults,
} from '@/lib/parent-offline/repository';
import { ParentAttendanceService } from '@/lib/services/parent-attendance.service';
import { ParentBankingService } from '@/lib/services/parent-banking.service';
import { ParentResultsService } from '@/lib/services/parent-results.service';
import { ParentOfflineFeePreparer } from './parent-offline-fee-preparer';

type ParentOfflineDatasetPreparerProps = {
  accountId?: string;
  familyId?: string;
  pupils: Pupil[];
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
 * Prepares the real parent data immediately after sign-in. Each data source is
 * read locally first and only fetches when absent or behind its family-scoped
 * server revision; reopening the dashboard therefore needs no background poll.
 */
export function ParentOfflineDatasetPreparer({
  accountId,
  familyId,
  pupils,
}: ParentOfflineDatasetPreparerProps) {
  const online = useOnlineStatus();
  const { revision: bankingRevision } = useParentDashboardRevision(familyId, 'banking');
  const { revision: attendanceRevision } = useParentDashboardRevision(familyId, 'attendance');
  const { revision: resultsRevision } = useParentDashboardRevision(familyId, 'results');
  const pupilIds = pupils.map(pupil => pupil.id).filter(Boolean).sort().join('|');

  useEffect(() => {
    if (!accountId || !online || bankingRevision === undefined || !isParentOfflineStorageAvailable()) return;
    let cancelled = false;
    void Promise.all(pupilIds.split('|').filter(Boolean).map(async pupilId => {
      const saved = await readParentOfflineBanking(accountId, pupilId);
      if (saved && saved.revision >= bankingRevision) return;
      const banking = await ParentBankingService.getForPupil(pupilId);
      if (!cancelled) await saveParentOfflineBanking({ accountId, pupilId, revision: bankingRevision, ...banking });
    })).catch(error => console.warn('Could not prepare parent banking for offline use:', error));
    return () => { cancelled = true; };
  }, [accountId, bankingRevision, online, pupilIds]);

  useEffect(() => {
    if (!accountId || !online || attendanceRevision === undefined || !isParentOfflineStorageAvailable()) return;
    let cancelled = false;
    void Promise.all(pupilIds.split('|').filter(Boolean).map(async pupilId => {
      const saved = await readParentOfflineAttendance(accountId, pupilId);
      if (saved && saved.revision >= attendanceRevision) return;
      const records = await ParentAttendanceService.getForPupil(pupilId);
      if (!cancelled) await saveParentOfflineAttendance({ accountId, pupilId, revision: attendanceRevision, records });
    })).catch(error => console.warn('Could not prepare parent attendance for offline use:', error));
    return () => { cancelled = true; };
  }, [accountId, attendanceRevision, online, pupilIds]);

  useEffect(() => {
    if (!accountId || !online || resultsRevision === undefined || !isParentOfflineStorageAvailable()) return;
    let cancelled = false;
    void Promise.all(pupilIds.split('|').filter(Boolean).map(async pupilId => {
      const saved = await readParentOfflineResults(accountId, pupilId);
      if (saved && saved.revision >= resultsRevision) return;
      const results = await ParentResultsService.getForPupil(pupilId);
      if (!cancelled) await saveParentOfflineResults({ accountId, pupilId, revision: resultsRevision, results });
    })).catch(error => console.warn('Could not prepare parent results for offline use:', error));
    return () => { cancelled = true; };
  }, [accountId, online, pupilIds, resultsRevision]);

  return (
    <>
      {online && pupils.map(pupil => (
        <ParentOfflineFeePreparer key={pupil.id} accountId={accountId} pupilId={pupil.id} />
      ))}
    </>
  );
}
