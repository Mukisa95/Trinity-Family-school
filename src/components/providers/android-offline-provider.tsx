'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { auth } from '@/lib/firebase';
import { androidOfflineRequest, hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { exportAndroidCachedSnapshot } from '@/lib/offline/android-cache-export';
import { isAndroidOfflineSnapshot, type AndroidOfflineSession, type AndroidOfflineSnapshot } from '@/lib/offline/android-contracts';
import { subscribeToParentOfflineChanges } from '@/lib/parent-offline/repository';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useTimetableEntries, useTimetablePeriods, useTimetableProfiles } from '@/lib/hooks/use-timetable';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSubjects } from '@/lib/hooks/use-subjects';
import { useStaff } from '@/lib/hooks/use-staff';
import { prepareAndroidAppShell, isAndroidOffline, installAndroidOfflineNavigation } from '@/lib/offline/android-app-shell';
import { toast } from '@/hooks/use-toast';
import { affectsAndroidSnapshot } from '@/lib/offline/android-snapshot-changes';
import { createSnapshotFingerprint } from '@/lib/offline/android-snapshot-fingerprint';
import { yieldToInterface } from '@/lib/performance/background-task';
import { getDashboardTimetableTerm } from '@/lib/offline/timetable-feed';

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
    const connect = async () => {
      if (refreshing || disposed || isAndroidOffline() || !user || isLocked || auth.currentUser?.uid !== user.id) return;
      refreshing = true;
      try {
        const token = await auth.currentUser.getIdToken();
        if (disposed || current !== generation.current || auth.currentUser?.uid !== user.id) return;
        const reply = await androidOfflineRequest('connect', { token });
        if (!disposed && current === generation.current && reply.session?.accountId === user.id) { setSession(reply.session); attempts = 0; }
      } catch (error) {
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
    window.addEventListener('online', connect);
    window.addEventListener('trinity-android-connectivity', connect);
    return () => { disposed = true; if (retry) clearTimeout(retry); unsubscribeAuth(); window.removeEventListener('online', connect); window.removeEventListener('trinity-android-connectivity', connect); };
  }, [user?.id, user?.role, user?.granularPermissions, user?.modulePermissions, isLoading, isLocked]);

  useEffect(() => {
    if (!session || !user || session.accountId !== user.id || isLocked) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let dirty = false;
    let previous = '';
    const fingerprintSnapshot = createSnapshotFingerprint();
    let previousSnapshot: AndroidOfflineSnapshot | undefined;
    let pupilsDirty = true;
    let firstDirtyAt = 0;
    const synchronize = async () => {
      if (disposed) return;
      if (running) { dirty = true; return; }
      running = true;
      firstDirtyAt = 0;
      try {
        await yieldToInterface();
        if (disposed) return;
        const pupilsChanged = pupilsDirty;
        pupilsDirty = false;
        const snapshot = await exportAndroidCachedSnapshot(session, previousSnapshot ? { previous: previousSnapshot, pupilsUnchanged: !pupilsChanged } : undefined);
        if (disposed || !snapshot || !isAndroidOfflineSnapshot(snapshot, session)) return;
        // copiedAt is not a data change; avoid repeated full snapshot bridge writes.
        const fingerprint = fingerprintSnapshot(snapshot);
        if (fingerprint === previous) return;
        await androidOfflineRequest('save', { snapshot });
        previous = fingerprint;
        previousSnapshot = snapshot;
      } catch (error) { pupilsDirty = true; console.warn('Android saved-data refresh failed:', error instanceof Error ? error.message : 'Unavailable'); }
      finally { running = false; if (dirty && !disposed) { dirty = false; schedule(); } }
    };
    const schedule = () => {
      if (disposed) return;
      if (running) { dirty = true; return; }
      if (!firstDirtyAt) firstDirtyAt = Date.now();
      if (timer) clearTimeout(timer);
      // Coalesce actual writes, with a bound so a continuous stream cannot starve saving.
      timer = setTimeout(() => void synchronize(), Math.max(0, Math.min(1_500, 5_000 - (Date.now() - firstDirtyAt))));
    };
    const cacheWritten = (event: Event) => {
      const key = (event as CustomEvent<{ key?: unknown }>).detail?.key;
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
      if (key === `${projectId}::pupils::user:${session.accountId}`) pupilsDirty = true;
      if (affectsAndroidSnapshot(session, key, projectId)) schedule();
    };
    const unsubscribeParent = subscribeToParentOfflineChanges(session.accountId, schedule);
    window.addEventListener('trinity-native-cache-written', cacheWritten);
    schedule();
    return () => { disposed = true; if (timer) clearTimeout(timer); unsubscribeParent(); window.removeEventListener('trinity-native-cache-written', cacheWritten); };
  }, [session, user?.id, isLocked]);

  useEffect(() => {
    // HTML and immutable assets contain no private records; prepare them even
    // while the existing session privacy screen is locked.
    if (!session) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const prepare = async () => {
      if (disposed || isAndroidOffline()) return;
      try { await prepareAndroidAppShell(session); }
      catch { if (!disposed) retry = setTimeout(() => void prepare(), 15_000); }
    };
    void prepare();
    window.addEventListener('online', prepare);
    window.addEventListener('trinity-service-worker-updated', prepare);
    return () => { disposed = true; if (retry) clearTimeout(retry); window.removeEventListener('online', prepare); window.removeEventListener('trinity-service-worker-updated', prepare); };
  }, [session, isLocked]);

  useEffect(() => {
    if (!hasAndroidOfflineBridge() || !user) return;
    return installAndroidOfflineNavigation(user.role, () => toast({ title: 'Connection needed', description: 'Connect to open this section or make changes.' }));
  }, [user?.id, user?.role]);

  return session?.grants.timetable && !isLocked ? <PrepareCurrentTimetables /> : null;
}
