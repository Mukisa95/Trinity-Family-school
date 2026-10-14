'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { auth } from '@/lib/firebase';
import { androidOfflineRequest, hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { exportAndroidCachedSnapshot } from '@/lib/offline/android-cache-export';
import { androidSnapshotRevision, isAndroidSavedCacheKey } from '@/lib/offline/android-sync-policy';
import { isAndroidOfflineSnapshot, type AndroidOfflineSession } from '@/lib/offline/android-contracts';
import { subscribeToParentOfflineChanges } from '@/lib/parent-offline/repository';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useTimetableEntries, useTimetablePeriods, useTimetableProfiles } from '@/lib/hooks/use-timetable';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSubjects } from '@/lib/hooks/use-subjects';
import { useStaff } from '@/lib/hooks/use-staff';
import { prepareAndroidAppShell, isAndroidOffline, installAndroidOfflineNavigation } from '@/lib/offline/android-app-shell';
import { toast } from '@/hooks/use-toast';
import { getDashboardTimetableTerm } from '@/lib/offline/timetable-feed';
import { recordAppDiagnostic } from '@/lib/utils/app-diagnostics';
import { measureWorkspaceOperation } from '@/lib/startup/workspace-timing';
import { isNavigationPending, subscribeNavigationWork } from '@/lib/navigation/navigation-work';
import { createAndroidSnapshotScheduler } from '@/lib/offline/android-snapshot-scheduler';

function PrepareTimetable({ yearId, termId, id }: { yearId: string; termId: string; id: string }) {
  useTimetablePeriods(yearId, termId, id);
  useTimetableEntries(yearId, termId, id);
  return null;
}
function PrepareTerm({ yearId, termId }: { yearId: string; termId: string }) {
  const { data: profiles = [] } = useTimetableProfiles(yearId, termId);
  return <>{profiles.map(profile => <PrepareTimetable key={profile.id} yearId={yearId} termId={termId} id={profile.id} />)}</>;
}
function PrepareCurrentTimetables() {
  const { data: years = [] } = useAcademicYears();
  useClasses(); useSubjects(); useStaff();
  const { year, term } = getDashboardTimetableTerm(years);
  return year && term ? <PrepareTerm yearId={year.id} termId={term.id} /> : null;
}

/** Inert in the normal browser/PWA; Android reuses existing caches and query owners. */
export function AndroidOfflineProvider() {
  const { user, isLoading, isLocked } = useAuth();
  const [session, setSession] = useState<AndroidOfflineSession | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    if (!hasAndroidOfflineBridge() || isLoading) return;
    const current = ++generation.current;
    setSession(null);
    let disposed = false;
    let refreshing = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let lastConnectionAt = 0;
    const connect = async () => {
      if (refreshing || disposed || isAndroidOffline() || !user || isLocked || auth.currentUser?.uid !== user.id) return;
      if (Date.now() - lastConnectionAt < 15 * 60 * 1000) return;
      refreshing = true;
      try {
        const token = await auth.currentUser.getIdToken();
        if (disposed || current !== generation.current || auth.currentUser?.uid !== user.id) return;
        const reply = await androidOfflineRequest('connect', { token });
        if (!disposed && current === generation.current && reply.session?.accountId === user.id) {
          setSession(reply.session); attempts = 0;
          lastConnectionAt = Date.now();
          recordAppDiagnostic('offline_access_ready');
          window.dispatchEvent(new Event('trinity-android-session-updated'));
        }
      } catch (error) {
        recordAppDiagnostic('offline_connect_failed');
        console.warn('Android offline access could not be prepared:', error instanceof Error ? error.message : 'Unavailable');
        if (!disposed) { if (retry) clearTimeout(retry); retry = setTimeout(() => void connect(), Math.min(60_000, 5_000 * 2 ** attempts++)); }
      }
      finally { refreshing = false; }
    };
    if (!user) void androidOfflineRequest('clear').catch(() => undefined);
    else {
      void androidOfflineRequest('status').then(reply => {
        if (!disposed && current === generation.current && reply.session?.accountId === user.id) setSession(reply.session);
      }).catch(() => undefined);
      void connect();
    }
    const unsubscribeAuth = auth.onIdTokenChanged(() => void connect());
    const onVisible = () => { if (document.visibilityState === 'visible') void connect(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', connect);
    window.addEventListener('trinity-android-connectivity', connect);
    return () => { disposed = true; if (retry) clearTimeout(retry); unsubscribeAuth(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', connect); window.removeEventListener('trinity-android-connectivity', connect); };
  }, [user?.id, user?.role, user?.granularPermissions, user?.modulePermissions, isLoading, isLocked]);

  useEffect(() => {
    if (!session || !user || session.accountId !== user.id || isLocked) return;
    let disposed = false;
    let previous = '';
    let sourceGeneration = 0;
    const preparation = new AbortController();
    const synchronize = async () => {
      if (disposed) return;
      const startedAt = performance.now();
      const capturedGeneration = sourceGeneration;
      const snapshot = await measureWorkspaceOperation('android:snapshot-export', () => exportAndroidCachedSnapshot(session, preparation.signal));
      if (disposed || !snapshot || !isAndroidOfflineSnapshot(snapshot, session)) return;
      if (isNavigationPending() || document.visibilityState === 'hidden') { scheduler.request(); return; }
      // copiedAt is not a data change; avoid repeated full snapshot bridge writes.
      const fingerprint = await measureWorkspaceOperation('android:snapshot-revision', () => androidSnapshotRevision(snapshot));
      if (fingerprint === previous) return;
      await measureWorkspaceOperation('android:snapshot-save', () => androidOfflineRequest('save', { snapshot }));
      // A disk write during export/save must survive even if timestamps match.
      previous = capturedGeneration === sourceGeneration ? fingerprint : '';
      recordAppDiagnostic('offline_snapshot_saved', performance.now() - startedAt);
      window.dispatchEvent(new Event('trinity-android-session-updated'));
    };
    const scheduler = createAndroidSnapshotScheduler(synchronize,
      () => !isNavigationPending() && document.visibilityState === 'visible',
      error => {
        if (disposed || preparation.signal.aborted) return;
        recordAppDiagnostic('offline_snapshot_failed');
        console.warn('Android saved-data refresh failed:', error instanceof Error ? error.message : 'Unavailable');
      });
    const schedule = () => scheduler.request();
    const unsubscribeNavigation = subscribeNavigationWork(pending => {
      if (!pending) scheduler.resume();
    });
    const onVisible = () => { if (document.visibilityState === 'visible') scheduler.resume(); };
    document.addEventListener('visibilitychange', onVisible);
    // A repository write may change a projected photo or occur in the same
    // millisecond as the prior write. Do not deduplicate confirmed disk writes.
    const persistedChange = () => { sourceGeneration++; previous = ''; schedule(); };
    const onCacheWritten = (event: Event) => {
      if (isAndroidSavedCacheKey((event as CustomEvent<{ key?: string }>).detail?.key, session)) persistedChange();
    };
    const unsubscribeParent = subscribeToParentOfflineChanges(session.accountId, persistedChange);
    window.addEventListener('trinity-native-cache-written', onCacheWritten);
    schedule();
    return () => { disposed = true; preparation.abort(); scheduler.dispose(); unsubscribeNavigation(); unsubscribeParent(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('trinity-native-cache-written', onCacheWritten); };
  }, [session, user?.id, isLocked]);

  useEffect(() => {
    // HTML and immutable assets contain no private records; prepare them even
    // while the existing session privacy screen is locked.
    if (!session) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const prepare = async () => {
      if (disposed || isAndroidOffline()) return;
      try { await measureWorkspaceOperation('android:app-shell-preparation', () => prepareAndroidAppShell(session)); }
      catch { recordAppDiagnostic('offline_shell_failed'); if (!disposed) retry = setTimeout(() => void prepare(), 15_000); }
    };
    void prepare();
    window.addEventListener('online', prepare);
    window.addEventListener('trinity-service-worker-updated', prepare);
    return () => { disposed = true; if (retry) clearTimeout(retry); window.removeEventListener('online', prepare); window.removeEventListener('trinity-service-worker-updated', prepare); };
  }, [session?.accountId, session?.role, session?.grants.dashboard, session?.grants.pupils, session?.grants.timetable]);

  useEffect(() => {
    if (!hasAndroidOfflineBridge() || !user) return;
    return installAndroidOfflineNavigation(user.role, () => toast({ title: 'Connection needed', description: 'Connect to open this section or make changes.' }));
  }, [user?.id, user?.role]);

  return session?.grants.timetable && !isLocked ? <PrepareCurrentTimetables /> : null;
}
