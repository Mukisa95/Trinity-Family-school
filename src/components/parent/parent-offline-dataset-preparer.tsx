'use client';

import { useEffect, useState } from 'react';
import type { Pupil } from '@/types';
import { useParentDashboardRevisions } from '@/lib/hooks/use-parent-dashboard-revision';
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
  const { revisions } = useParentDashboardRevisions(familyId);
  const bankingRevision = revisions?.banking;
  const attendanceRevision = revisions?.attendance;
  const resultsRevision = revisions?.results;
  const pupilIds = pupils.map(pupil => pupil.id).filter(Boolean).sort().join('|');

  useEffect(() => {
    if (
      !accountId ||
      !online ||
      bankingRevision === undefined ||
      attendanceRevision === undefined ||
      resultsRevision === undefined ||
      !isParentOfflineStorageAvailable()
    ) return;
    let cancelled = false;
    let idleHandle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const prepare = async () => {
      // Process one child and one dataset at a time. This keeps background
      // preparation from competing with the screen the parent is using.
      for (const pupilId of pupilIds.split('|').filter(Boolean)) {
        if (cancelled) return;

        try {
          const saved = await readParentOfflineBanking(accountId, pupilId);
          if (!cancelled && (!saved || saved.revision < bankingRevision)) {
            const banking = await ParentBankingService.getForPupil(pupilId);
            if (!cancelled) {
              await saveParentOfflineBanking({ accountId, pupilId, revision: bankingRevision, ...banking });
            }
          }
        } catch (error) {
          console.warn('Could not prepare parent banking for offline use:', error);
        }

        if (cancelled) return;
        try {
          const saved = await readParentOfflineAttendance(accountId, pupilId);
          if (!cancelled && (!saved || saved.revision < attendanceRevision)) {
            const records = await ParentAttendanceService.getForPupil(pupilId);
            if (!cancelled) {
              await saveParentOfflineAttendance({ accountId, pupilId, revision: attendanceRevision, records });
            }
          }
        } catch (error) {
          console.warn('Could not prepare parent attendance for offline use:', error);
        }

        if (cancelled) return;
        try {
          const saved = await readParentOfflineResults(accountId, pupilId);
          if (!cancelled && (!saved || saved.revision < resultsRevision)) {
            const results = await ParentResultsService.getForPupil(pupilId);
            if (!cancelled) {
              await saveParentOfflineResults({ accountId, pupilId, revision: resultsRevision, results });
            }
          }
        } catch (error) {
          console.warn('Could not prepare parent results for offline use:', error);
        }
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(() => void prepare(), { timeout: 3000 });
    } else {
      timer = setTimeout(() => void prepare(), 500);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
      if (timer) clearTimeout(timer);
    };
  }, [accountId, attendanceRevision, bankingRevision, online, pupilIds, resultsRevision]);

  return null;
}
