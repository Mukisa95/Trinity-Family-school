'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/auth-context';
import { auth } from '@/lib/firebase';
import { androidOfflineRequest, hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { exportAndroidCachedSnapshot } from '@/lib/offline/android-cache-export';
import { isAndroidOfflineSnapshot, type AndroidOfflineSession } from '@/lib/offline/android-contracts';
import { subscribeToParentOfflineChanges } from '@/lib/parent-offline/repository';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useTimetableEntries, useTimetablePeriods, useTimetableProfiles } from '@/lib/hooks/use-timetable';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSubjects } from '@/lib/hooks/use-subjects';
import { useStaff } from '@/lib/hooks/use-staff';
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
  const client = useQueryClient();
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
      if (refreshing || disposed || !navigator.onLine || !user || isLocked || auth.currentUser?.uid !== user.id) return;
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
    else void connect();
    const unsubscribeAuth = auth.onIdTokenChanged(() => void connect());
    window.addEventListener('online', connect);
    return () => { disposed = true; if (retry) clearTimeout(retry); unsubscribeAuth(); window.removeEventListener('online', connect); };
  }, [user?.id, user?.role, user?.granularPermissions, user?.modulePermissions, isLoading, isLocked]);

  useEffect(() => {
    if (!session || !user || session.accountId !== user.id || isLocked) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let dirty = false;
    let previous = '';
    const synchronize = async () => {
      if (disposed) return;
      if (running) { dirty = true; return; }
      running = true;
      try {
        const snapshot = await exportAndroidCachedSnapshot(session);
        if (disposed || !snapshot || !isAndroidOfflineSnapshot(snapshot, session)) return;
        // copiedAt is not a data change; avoid repeated full snapshot bridge writes.
        const fingerprint = JSON.stringify(snapshot.datasets, (key, value) => key === 'preparedAt' ? undefined : value);
        if (fingerprint === previous) return;
        await androidOfflineRequest('save', { snapshot });
        previous = fingerprint;
      } catch (error) { console.warn('Android saved-data refresh failed:', error instanceof Error ? error.message : 'Unavailable'); }
      finally { running = false; if (dirty && !disposed) { dirty = false; schedule(); } }
    };
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void synchronize(), 600); };
    const unsubscribe = client.getQueryCache().subscribe(event => { if (event.type === 'updated' && event.action.type === 'success') schedule(); });
    const unsubscribeParent = subscribeToParentOfflineChanges(session.accountId, schedule);
    window.addEventListener('trinity-native-cache-written', schedule);
    schedule();
    return () => { disposed = true; if (timer) clearTimeout(timer); unsubscribe(); unsubscribeParent(); window.removeEventListener('trinity-native-cache-written', schedule); };
  }, [client, session, user?.id, isLocked]);

  return session?.grants.timetable && !isLocked ? <PrepareCurrentTimetables /> : null;
}
