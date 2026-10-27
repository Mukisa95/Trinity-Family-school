'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { auth } from '@/lib/firebase';
import { workspaceOfflineRequest as androidOfflineRequest, hasOfflineWorkspace as hasAndroidOfflineBridge } from '@/lib/offline/workspace-bridge';
import { hasBrowserOfflineWorkspace } from '@/lib/pwa/platform';
import { androidRouteBuildId } from '@/lib/offline/android-route-cache';
import { exportAndroidCachedSnapshot } from '@/lib/offline/android-cache-export';
import { androidSnapshotRevision, isAndroidSavedCacheKey } from '@/lib/offline/android-sync-policy';
import { androidSessionMatchesUser, isAndroidOfflineSnapshot, type AndroidOfflineSession } from '@/lib/offline/android-contracts';
import { subscribeToParentOfflineChanges } from '@/lib/parent-offline/repository';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useTimetableEntries, useTimetablePeriods, useTimetableProfiles } from '@/lib/hooks/use-timetable';
import { useEvents, useExamsAsEvents } from '@/lib/hooks/use-events-fixed';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSubjects } from '@/lib/hooks/use-subjects';
import { useDutyServiceData } from '@/lib/hooks/use-duty-service-data';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useStaff } from '@/lib/hooks/use-staff';
import { prepareAndroidAppShell, isAndroidOffline, installAndroidOfflineNavigation } from '@/lib/offline/android-app-shell';
import { toast } from '@/hooks/use-toast';
import { circumferenceKey } from '@/lib/access/circumference';
import { sessionAccessKey } from '@/lib/access/session-profile';
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

function PrepareDutyService() { useDutyServiceData(); useStaff(); usePupils(); useAcademicYears(); useClasses(); return null; }

function PrepareEvents() { useEvents(); useExamsAsEvents(); useAcademicYears(); return null; }

/** Installed apps reuse existing caches and query owners; ordinary tabs stay inert. */
export function AndroidOfflineProvider() {
  const router = useRouter();
  const { user, isLoading, isLocked } = useAuth();
  const [session, setSession] = useState<AndroidOfflineSession | null>(null);
  const generation = useRef(0);
  const scopeKey = circumferenceKey(user);
  const accessKey = sessionAccessKey(user);
  const previousAccess = useRef<{ accountId: string; key: string } | null>(null);
  useEffect(() => {
    // Auth can restore the Firebase identity after its cached profile. Do not
    // erase saved access during that initial gap; auth owns explicit logout.
    if (!hasAndroidOfflineBridge() || isLoading || !user) return;
    const current = ++generation.current;
    setSession(null);
    let disposed = false;
    let refreshing = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let lastConnectionAt = 0;
    const changedAccess = previousAccess.current?.accountId === user.id && previousAccess.current.key !== accessKey;
    previousAccess.current = { accountId: user.id, key: accessKey };
    let prepared: Promise<void> | undefined;
    const connect = async () => {
      if (refreshing || disposed || isAndroidOffline() || !user || isLocked || auth.currentUser?.uid !== user.id) return;
      if (Date.now() - lastConnectionAt < 15 * 60 * 1000) return;
      refreshing = true;
      try {
        prepared ||= prepareNative();
        await prepared;
        if (disposed || current !== generation.current) return;
        const token = await auth.currentUser.getIdToken();
        if (disposed || current !== generation.current || auth.currentUser?.uid !== user.id) return;
        const reply = await androidOfflineRequest('connect', { token, accountId: user.id });
        if (!disposed && current === generation.current && androidSessionMatchesUser(reply.session, user)) {
          setSession(reply.session!); attempts = 0;
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
    const prepareNative = async () => {
      if (changedAccess) { recordAppDiagnostic('offline_clear/access_changed'); await androidOfflineRequest('clear'); return; }
      const reply = await androidOfflineRequest('status');
      if (disposed || current !== generation.current) return;
      if (reply.session && !androidSessionMatchesUser(reply.session, user)) {
        recordAppDiagnostic('offline_clear/session_mismatch'); await androidOfflineRequest('clear');
      }
      else if (reply.session) setSession(reply.session);
    };
    prepared = prepareNative();
    // A failed clear/status must not revive or overwrite an incompatible saved session.
    void prepared.catch(() => { prepared = undefined; });
    if (user) void connect();
    const unsubscribeAuth = auth.onIdTokenChanged(() => void connect());
    const onVisible = () => { if (document.visibilityState === 'visible') void connect(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', connect);
    window.addEventListener('trinity-android-connectivity', connect);
    const refresh = () => { lastConnectionAt = 0; void connect(); };
    window.addEventListener('trinity-pwa-prepare', refresh);
    return () => { disposed = true; if (retry) clearTimeout(retry); unsubscribeAuth(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', connect); window.removeEventListener('trinity-android-connectivity', connect); window.removeEventListener('trinity-pwa-prepare', refresh); };
  }, [accessKey, isLoading, isLocked]);

  useEffect(() => {
    if (!session || !user || !androidSessionMatchesUser(session, user) || isLocked) return;
    let disposed = false;
    let previous = '';
    let sourceGeneration = 0;
    const preparation = new AbortController();
    const synchronize = async () => {
      if (disposed) return;
      const startedAt = performance.now();
      const capturedGeneration = sourceGeneration;
      const exportAt = performance.now();
      const snapshot = await measureWorkspaceOperation('android:snapshot-export', () => exportAndroidCachedSnapshot(session, preparation.signal, hasBrowserOfflineWorkspace() ? 'browser' : 'native'));
      if (performance.now() - exportAt >= 2000) recordAppDiagnostic('offline_snapshot_export_slow', performance.now() - exportAt);
      if (disposed || !snapshot || !isAndroidOfflineSnapshot(snapshot, session)) return;
      if (isNavigationPending() || document.visibilityState === 'hidden') { scheduler.request(); return; }
      // copiedAt is not a data change; avoid repeated full snapshot bridge writes.
      const revisionAt = performance.now();
      const fingerprint = await measureWorkspaceOperation('android:snapshot-revision', () => androidSnapshotRevision(snapshot));
      if (performance.now() - revisionAt >= 2000) recordAppDiagnostic('offline_snapshot_revision_slow', performance.now() - revisionAt);
      if (fingerprint === previous) return;
      const bridgeAt = performance.now();
      await measureWorkspaceOperation('android:snapshot-save', () => androidOfflineRequest('save', { snapshot }));
      if (performance.now() - bridgeAt >= 2000) recordAppDiagnostic('offline_snapshot_bridge_slow', performance.now() - bridgeAt);
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
    window.addEventListener('trinity-pwa-prepare', persistedChange);
    schedule();
    return () => { disposed = true; preparation.abort(); scheduler.dispose(); unsubscribeNavigation(); unsubscribeParent(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('trinity-native-cache-written', onCacheWritten); window.removeEventListener('trinity-pwa-prepare', persistedChange); };
  }, [session, user?.id, scopeKey, isLocked]);

  useEffect(() => {
    // HTML and immutable assets contain no private records; prepare them even
    // while the existing session privacy screen is locked.
    if (!session || !user || !androidSessionMatchesUser(session, user)) return;
    let disposed = false;
    let preparing = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const prepare = async () => {
      if (disposed || preparing || isAndroidOffline()) return;
      preparing = true;
      if (retry) { clearTimeout(retry); retry = undefined; }
      try {
        await measureWorkspaceOperation('android:app-shell-preparation', () => prepareAndroidAppShell(session));
        if (!disposed && hasBrowserOfflineWorkspace()) await androidOfflineRequest('shellReady', { build: androidRouteBuildId() });
      }
      catch { recordAppDiagnostic('offline_shell_failed'); if (!disposed) retry = setTimeout(() => void prepare(), 15_000); }
      finally { preparing = false; }
    };
    void prepare();
    window.addEventListener('online', prepare);
    window.addEventListener('trinity-android-connectivity', prepare);
    window.addEventListener('trinity-service-worker-updated', prepare);
    window.addEventListener('trinity-pwa-prepare', prepare);
    return () => { disposed = true; if (retry) clearTimeout(retry); window.removeEventListener('online', prepare); window.removeEventListener('trinity-android-connectivity', prepare); window.removeEventListener('trinity-service-worker-updated', prepare); window.removeEventListener('trinity-pwa-prepare', prepare); };
  }, [session?.accountId, session?.role, session?.grants.dashboard, session?.grants.pupils, session?.grants.timetable, session?.grants.events, session?.grants.dutyService, session?.grants.dutyServiceCacheName, user?.id, user?.role, scopeKey]);

  useEffect(() => {
    if (!hasAndroidOfflineBridge() || !user) return;
    return installAndroidOfflineNavigation(user.role, () => toast({ title: 'Connection needed', description: 'This page has not finished downloading, or needs a connection to make changes.' }), { navigate: href => router.push(href) });
  }, [user?.id, user?.role, router]);

  return !isLocked && user && androidSessionMatchesUser(session, user) ? <>{session?.grants.timetable && <PrepareCurrentTimetables />}{session?.grants.events && <PrepareEvents />}{session?.grants.dutyService && <PrepareDutyService />}</> : null;
}
