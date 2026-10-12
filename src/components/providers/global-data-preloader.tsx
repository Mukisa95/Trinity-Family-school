"use client";

import { useEffect, useRef } from 'react';
import { registerWorkspaceRecovery, reportWorkspaceTask, workspaceSetupScope, type SetupTaskState } from '@/lib/startup/workspace-setup';
import { withWorkspaceIdentity } from '@/lib/startup/workspace-auth';
import { clearSavedWorkspaceAccess, getSavedWorkspaceAccessStatus, hasSavedWorkspaceAccess, workspaceCacheAccessScope } from '@/lib/startup/workspace-cache-access';
import { measureWorkspaceStep } from '@/lib/startup/workspace-timing';
import { useQueryClient } from '@tanstack/react-query';
import { collection, query as firestoreQuery, onSnapshot, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import { liteWrite, LITE_KEYS } from '@/lib/cache/lite-cache';
import {
  persistentCollectionCacheKey,
  readPersistentCollectionWithMetadata,
  writePersistentCollection,
} from '@/lib/cache/persistent-collection-cache';
import { getPupilCacheScope, readPupilCache } from '@/lib/cache/pupil-cache';
import { applyPupilChangesToQueryCaches } from '@/lib/hooks/use-pupils';
import { useClassCacheBootstrap } from '@/lib/hooks/use-class-cache-bootstrap';
import { useAcademicYearCacheBootstrap } from '@/lib/hooks/use-academic-year-cache-bootstrap';
import { useStaffCacheBootstrap } from '@/lib/hooks/use-staff-cache-bootstrap';
import { useSubjectCacheBootstrap } from '@/lib/hooks/use-subject-cache-bootstrap';
import { useHouseCacheBootstrap } from '@/lib/hooks/use-house-cache-bootstrap';
import { useAccessLevelCacheBootstrap } from '@/lib/hooks/use-access-level-cache-bootstrap';
import { useExamCacheBootstrap } from '@/lib/hooks/use-exam-cache-bootstrap';
import { PupilsService } from '@/lib/services/pupils.service';
import { clearPupilSessionQueries, isParentPupilSnapshotOwnedByAccount } from '@/lib/cache/pupil-session-cache';
import { FeesService } from '@/lib/services/fees.service';
import { FEES_QUERY_KEYS } from '@/lib/hooks/use-fees';
import { restoreCatalogue } from '@/lib/cache/school-catalogue-cache';
import { schoolCatalogueOptions } from '@/lib/cache/school-catalogue-queries';

/**
 * 🚀 ROLE-AWARE DATA PRELOADER (OPTIMIZED FOR QUOTA)
 * 
 * STRATEGY:
 * - Real-time listeners (onSnapshot) ONLY for data that changes frequently
 *   and needs instant cross-device sync: pupils and payment records
 * - Revision-owned persistent caches for independent reference data: classes,
 *   academic years, staff, subjects, houses, access levels, and exams
 * - One-time reads (getDocs) for dependent module data that changes rarely:
 *   fees, requirements, uniforms, and events. Photos are owned by usePhotos,
 *   which restores its persistent snapshot and reconciles by revision.
 * 
 * This dramatically reduces Firestore reads to prevent quota exhaustion.
 */
export function GlobalDataPreloader() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  useClassCacheBootstrap();
  useAcademicYearCacheBootstrap();
  useStaffCacheBootstrap();
  useSubjectCacheBootstrap();
  useHouseCacheBootstrap();
  useAccessLevelCacheBootstrap();
  useExamCacheBootstrap();
  const userId = user?.id;
  const userRole = user?.role;
  const savedWorkspaceScope = user ? workspaceCacheAccessScope(user) : '';
  const lastPupilIdentity = useRef<string | null>(null);

  useEffect(() => {
    // Don't start preloading until user is authenticated
    if (!isAuthenticated || !userId || !userRole) {
      console.log('⏸️ PRELOADER: Waiting for authentication...');
      return;
    }

    console.log(`🚀 GLOBAL PRELOADER: Starting role-aware listeners for ${userRole}...`);

    // Preserve this same account's offline hydration on a cold PWA launch,
    // but never carry an earlier signed-in identity into a different account.
    const pupilIdentity = savedWorkspaceScope;
    if (lastPupilIdentity.current && lastPupilIdentity.current !== pupilIdentity) {
      clearPupilSessionQueries(queryClient);
      PupilsService.clearSharedPupils();
    }
    if (lastPupilIdentity.current !== pupilIdentity) {
      const existing = queryClient.getQueryData<any[]>(['pupils', 'list']);
      const hydration = queryClient.getQueryData<string>(['pupils', 'hydration']);
      queryClient.setQueryData(['pupils', 'hydration'],
        existing?.length || (existing && ['saved', 'live'].includes(hydration || '')) ? 'saved' : 'loading');
    }
    lastPupilIdentity.current = pupilIdentity;
    if (userRole === 'Parent') {
      queryClient.setQueryData(['parentPupilScope', userId], 'loading');
    }

    // ─── SERVICE-WORKER UPDATE COMPATIBILITY ──────────────────────────────────
    // A new JavaScript bundle does not make school data stale. Source mutations
    // already invalidate their own shared caches, and the pupil listener below
    // reconciles its local snapshot with Firestore. Clearing IndexedDB here made
    // every update look like a cold start and, when the network was slow, left
    // the app with no pupil list at all. Consume old update markers without
    // deleting locally confirmed data.
    const SW_UPDATE_KEY = 'sw_update_version';
    const swUpdateStamp =
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SW_UPDATE_KEY) : null;
    if (swUpdateStamp) {
      console.log(`🔄 PRELOADER: SW update detected (${swUpdateStamp}) — preserving shared data cache`);
      sessionStorage.removeItem(SW_UPDATE_KEY);
    }
    // ──────────────────────────────────────────────────────────────────────────

    const unsubscribers: Array<() => void> = [];
    let deferredTimer: ReturnType<typeof setTimeout> | undefined;
    let pupilCacheWriteTimer: ReturnType<typeof setTimeout> | undefined;
    let pupilCacheIdleHandle: number | undefined;
    let disposed = false;
    let pupilLoadFailed = false;
    let pupilsUnsubscribe: (() => void) | undefined;
    let pupilGeneration = 0;
    let pupilDataFromServer = false;
    let normalizedPupilsRestored = false;
    let pupilLocalAccessRevoked = false;
    let pupilLiveReadersReady = false;
    const authorizationScope = savedWorkspaceScope;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
    const persistentCacheKey = persistentCollectionCacheKey(
      projectId, 'pupils', userRole === 'Parent' ? `parent:${userId}:account-scope` : `user:${userId}`,
    );
    let syncParentPupilRecords: ((ids: string[]) => void) | undefined;
    const setupScope = workspaceSetupScope(userId, userRole);
    const report = (task: string, state: SetupTaskState) => {
      if (!disposed) {
        reportWorkspaceTask(queryClient, setupScope, task, state);
        if (task === 'pupils' && state === 'error' && queryClient.getQueryData(['pupils', 'hydration']) === 'loading') {
          queryClient.setQueryData(['pupils', 'hydration'], 'error');
        } else if (task === 'pupils' && state === 'loading' && queryClient.getQueryData(['pupils', 'hydration']) === 'error') {
          queryClient.setQueryData(['pupils', 'hydration'], 'loading');
        }
      }
    };
    ['pupils', 'fees', ...(userRole === 'Parent' ? ['payments'] : ['requirements', 'uniforms', 'excludedDays'])].forEach(task => report(task, 'loading'));

    // Small saved catalogues restore independently of live identity/network.
    const restoreCatalogues = () => {
      if (userRole !== 'Parent') {
        for (const name of ['requirements', 'uniforms', 'excludedDays'] as const) {
          void restoreCatalogue(queryClient, name, user!);
        }
      }
    };
    restoreCatalogues();
    window.addEventListener('trinity-workspace-cache-access', restoreCatalogues);
    unsubscribers.push(() => window.removeEventListener('trinity-workspace-cache-access', restoreCatalogues));

    // ═══════════════════════════════════════════════════════════
    // REAL-TIME LISTENERS (onSnapshot) — Data that needs live sync
    // ═══════════════════════════════════════════════════════════

    // Classes and academic years are mounted above through their revision-owned
    // persistent cache bootstraps. The disabled block below is retained only as
    // historical context while this provider is progressively simplified.
    /*
     * Historical implementation retained in Git history. Academic years and
     * staff are now exclusively owned by their revision cache bootstraps.
      // Retired: academic years are owned by useAcademicYearCacheBootstrap.
      // Keep this no-op temporarily while the remaining preloader code is
      // being simplified; it must never create a second collection reader.
      return;

      const sessionStart = Timestamp.now();

      const toISO = (v: any): string => {
        if (!v) return '';
        if (v?.toDate && typeof v.toDate === 'function') return v.toDate().toISOString();
        if (v instanceof Date) return v.toISOString();
        if (typeof v === 'string') return v;
        if (v?.seconds) return new Date(v.seconds * 1000).toISOString();
        return '';
      };

      const sanitizeYear = (docOrData: any) => {
        const data = docOrData.data ? docOrData.data() : docOrData;
        return {
          id: docOrData.id,
          ...data,
          startDate: toISO(data.startDate),
          endDate: toISO(data.endDate),
          terms: (data.terms ?? []).map((term: any) => ({
            ...term,
            startDate: toISO(term.startDate),
            endDate: toISO(term.endDate),
          })),
        };
      };

      const yearsRef = firestoreQuery(collection(db, 'academicYears'));

      // Sort helper: newest year first (highest startDate at index 0)
      // Applied after EVERY load path so dropdowns and detectCurrentAcademicYear
      // always receive a consistent, chronologically ordered array.
      const sortYears = (arr: any[]): any[] =>
        [...arr].sort((a, b) => {
          const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
          return bTime - aTime; // descending — most recent first
        });

      // Phase 1 & 2: Load data
      const existing = queryClient.getQueryData<any[]>(['academicYears']);
      let years: any[] = existing ?? [];

      if (years.length === 0) {
        try {
          const cacheSnap = await getDocsFromCache(yearsRef);
          if (cacheSnap.docs.length > 0) {
            years = sortYears(cacheSnap.docs.map(sanitizeYear));
            console.log(`⚡ PRELOADER: Loaded ${years.length} academic years from Firestore IndexedDB cache (instant, term dates included)`);
          } else {
            const netSnap = await getDocs(yearsRef);
            years = sortYears(netSnap.docs.map(sanitizeYear));
            console.log(`✅ PRELOADER: Loaded ${years.length} academic years (network fetch, term dates included)`);
          }
          queryClient.setQueryData(['academicYears'], years);
          liteWrite(LITE_KEYS.academicYears, years, LITE_TTL.academicYears);
        } catch (err: any) {
          console.error('❌ PRELOADER: Academic years load error:', err.message);
        }
      } else {
        // ── SANITIZE & SORT WARM CACHE ───────────────────────────────────────
        // Even if years are already in memory, term dates may be raw Firestore
        // Timestamps, and the array may not be sorted (e.g. from an older cache).
        const sanitized = sortYears(years.map(sanitizeYear));
        queryClient.setQueryData(['academicYears'], sanitized);
        liteWrite(LITE_KEYS.academicYears, sanitized, LITE_TTL.academicYears);
        console.log(`⚡ PRELOADER: ${sanitized.length} academic years sanitized & sorted in memory`);
      }

      // Phase 3: Narrow live listener
      const changesQuery = firestoreQuery(
        collection(db, 'academicYears'),
        where('updatedAt', '>=', sessionStart)
      );

      const unsubscribe = onSnapshot(
        changesQuery,
        (snapshot) => {
          if (snapshot.empty) return;
          queryClient.setQueryData(['academicYears'], (existing: any[] | undefined) => {
            const updated = existing ? [...existing] : [];
            snapshot.docChanges().forEach(change => {
              const patched = sanitizeYear(change.doc);
              if (change.type === 'removed') {
                const idx = updated.findIndex(y => y.id === change.doc.id);
                if (idx !== -1) updated.splice(idx, 1);
              } else {
                const idx = updated.findIndex(y => y.id === change.doc.id);
                if (idx !== -1) updated[idx] = patched;
                else updated.push(patched);
              }
            });
            const sorted = sortYears(updated);
            liteWrite(LITE_KEYS.academicYears, sorted, LITE_TTL.academicYears);
            return sorted;
          });
        },
        (error) => console.error('❌ PRELOADER: Academic years live patch error:', error.message)
      );
      unsubscribers.push(unsubscribe);
    };


    */
    // 5. PUPILS - Cache-first shared real-time listener.
    //
    // Firestore emits the listener's local IndexedDB snapshot first and then
    // reconciles it with the server. Cached data must never wait behind a count
    // request or a duplicate getDocs() call.
    // Local viewing and live synchronization have separate gates. The receipt
    // is account/permission scoped and exists only after prior signed validation.
    // Legacy devices without one wait once for Firebase, then acquire it through
    // AuthContext. Reading IndexedDB itself never waits for authentication.
    const restoreSavedPupils = () => {
      const startedAt = performance.now();
      const reported = new Set<string>();
      const diagnose = (reason: string) => {
        if (!disposed && !reported.has(reason)) {
          reported.add(reason); measureWorkspaceStep(`pupils-cache-access:${reason}`, performance.now());
        }
      };
      diagnose(getSavedWorkspaceAccessStatus(user!));
      const candidates: { pupils: any[]; source: string; complete?: boolean }[] = [];
      const publishSaved = (pupils: any[] | null | undefined, source: string, complete = false) => {
        diagnose(getSavedWorkspaceAccessStatus(user!));
        if (
          disposed || pupilLocalAccessRevoked || pupilDataFromServer || normalizedPupilsRestored
          || !Array.isArray(pupils) || (pupils.length === 0 && !complete)
          || (auth.currentUser && (auth.currentUser.uid !== userId || auth.currentUser.isAnonymous))
          || !hasSavedWorkspaceAccess(user!)
          || (userRole === 'Parent' && !isParentPupilSnapshotOwnedByAccount(userId, pupils))
        ) return;
        const existing = queryClient.getQueryData<any[]>(['pupils', 'list']);
        if (existing?.length) return;
        normalizedPupilsRestored = true;
        diagnose(auth.currentUser?.uid === userId ? 'published-with-identity' : 'published-before-identity');
        queryClient.setQueryData(['pupils', 'list'], pupils);
        queryClient.setQueryData(['pupils', 'hydration'], 'saved');
        PupilsService.hydrateSharedPupils(pupils);
        // Parent payments can use these IDs as soon as signed restoration has
        // finished, without waiting for a pupil server round trip.
        if (pupilLiveReadersReady) syncParentPupilRecords?.(pupils.map(pupil => pupil.id));
        if (userRole === 'Parent') queryClient.setQueryData(['parentPupilScope', userId], 'ready');
        report('pupils', 'ready');
        performance.mark?.('trinity:pupils-fast-cache-ready');
        measureWorkspaceStep('pupils-cache-published', 0);
        console.log(`FAST CACHE: Restored ${pupils.length} pupils from ${source} in ${Math.round(performance.now() - startedAt)}ms`);
      };
      const retrySavedPublication = () => {
        candidates.forEach(candidate => publishSaved(candidate.pupils, candidate.source, candidate.complete));
        if (normalizedPupilsRestored || pupilDataFromServer || disposed) candidates.length = 0;
      };
      window.addEventListener('trinity-workspace-cache-access', retrySavedPublication);
      unsubscribers.push(() => window.removeEventListener('trinity-workspace-cache-access', retrySavedPublication));
      const primaryRead = readPersistentCollectionWithMetadata<any[]>(persistentCacheKey);
      void primaryRead.then(snapshot => {
        measureWorkspaceStep('pupils-cache-read', startedAt);
        if (!snapshot) { diagnose('missing-snapshot'); return; }
        if (snapshot.authorizationScope && snapshot.authorizationScope !== authorizationScope) { diagnose('snapshot-scope-changed'); return; }
        if (Array.isArray(snapshot.data) && snapshot.data.length === 0 && !snapshot.complete) diagnose('incomplete-empty-snapshot');
        candidates.push({ pupils: snapshot.data, source: 'saved snapshot', complete: snapshot.complete });
        retrySavedPublication();
      }).catch(() => undefined);
      const revisionScope = getPupilCacheScope(userId, userRole);
      if (revisionScope) void primaryRead.then(async primary => {
        // Never use a legacy copy to bypass a newer snapshot's permission scope.
        // Avoid reading/cloning/sorting a second large list when the normalized
        // snapshot already exists.
        if (primary || disposed || pupilDataFromServer) return;
        const snapshot = await readPupilCache(revisionScope);
        if (!snapshot) return;
        measureWorkspaceStep('pupils-cache-read', startedAt);
        candidates.push({ pupils: snapshot.data, source: 'revision cache' });
        retrySavedPublication();
      }).catch(() => undefined);
    };
    restoreSavedPupils();

    const setupPupilsListener = async (
      onParentPupilIds?: (pupilIds: string[]) => void,
    ) => {
      await withWorkspaceIdentity(userId, async () => undefined);
      if (disposed) return;
      pupilLiveReadersReady = true;
      const persistedPupils = queryClient.getQueryData<any[]>(['pupils', 'list']);
      if (persistedPupils?.length && userRole === 'Parent'
        && isParentPupilSnapshotOwnedByAccount(userId, persistedPupils)) {
        onParentPupilIds?.(persistedPupils.map(pupil => pupil.id));
      }
      pupilsUnsubscribe?.();
      const listenerGeneration = ++pupilGeneration;
      const listenerDisposed = () => disposed || listenerGeneration !== pupilGeneration;
      report('pupils', 'loading');
      const normalizePupilDoc = (doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dateOfBirth: data.dateOfBirth?.toDate?.()?.toISOString?.() ?? data.dateOfBirth ?? null,
          dateOfAdmission: data.dateOfAdmission?.toDate?.()?.toISOString?.() ?? data.dateOfAdmission ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? (data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt) ?? new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? (data.updatedAt instanceof Date ? data.updatedAt.toISOString() : data.updatedAt) ?? new Date().toISOString(),
        };
      };

      // One account-scoped query covers both family pupils and standalone
      // pupils. Changing the pupil marker makes Firestore add/remove that pupil
      // from an already-open parent app without rebuilding the listener.
      const baseQuery = userRole === 'Parent'
        ? firestoreQuery(
            collection(db, 'pupils'),
            where('parentAccountId', '==', userId),
            where('parentAccountActive', '==', true),
          )
        : firestoreQuery(collection(db, 'pupils'));

      if (userRole === 'Parent') {
        console.log(`🎯 PARENT MODE: Loading pupils owned by account ${userId}`);
      }

      const schedulePersistentPupilCacheWrite = () => {
        if (listenerDisposed()) return;
        if (pupilCacheWriteTimer) clearTimeout(pupilCacheWriteTimer);
        if (
          pupilCacheIdleHandle !== undefined &&
          typeof window.cancelIdleCallback === 'function'
        ) {
          window.cancelIdleCallback(pupilCacheIdleHandle);
          pupilCacheIdleHandle = undefined;
        }

        pupilCacheWriteTimer = setTimeout(() => {
          const persist = () => {
            pupilCacheIdleHandle = undefined;
            if (listenerDisposed()) return;
            const pupils = queryClient.getQueryData<any[]>(['pupils', 'list']);
            if (!pupils) return;
            // Optional durable caching must not block already available data.
            void writePersistentCollection(persistentCacheKey, pupils, authorizationScope, serverSnapshotSeen).catch(error => console.warn('Pupil cache write failed:', error));
          };

          if (typeof window.requestIdleCallback === 'function') {
            pupilCacheIdleHandle = window.requestIdleCallback(persist, { timeout: 1500 });
          } else {
            persist();
          }
        }, 500);
      };

      let initialSnapshotPublished = false;
      let serverSnapshotSeen = false;
      let emptyScopeRecoveryStarted = false;
      const scopeStatus = (status: 'loading' | 'repairing' | 'ready' | 'error') => {
        if (userRole === 'Parent' && !listenerDisposed()) {
          queryClient.setQueryData(['parentPupilScope', userId], status);
        }
      };
      const publishPupils = (pupils: any[], source: 'cache' | 'server') => {
        if (listenerDisposed()) return;
        if (source === 'server') pupilDataFromServer = true;
        pupilLoadFailed = false;
        queryClient.setQueryData(['pupils', 'list'], pupils);
        queryClient.setQueryData(['pupils', 'hydration'], source === 'server' ? 'live' : 'saved');
        PupilsService.hydrateSharedPupils(pupils);
        onParentPupilIds?.(pupils.map(pupil => pupil.id));
        scopeStatus('ready');
        report('pupils', 'ready');
        schedulePersistentPupilCacheWrite();
        performance.mark?.(`trinity:pupils-${source}-ready`);
      };
      const recoverEmptyParentScope = async () => {
        if (emptyScopeRecoveryStarted || listenerDisposed()) return;
        pupilDataFromServer = true;
        emptyScopeRecoveryStarted = true;
        // An authoritative empty result supersedes stale local family data.
        clearPupilSessionQueries(queryClient);
        PupilsService.clearSharedPupils();
        onParentPupilIds?.([]);
        scopeStatus('repairing');
        try {
          const token = await auth.currentUser?.getIdToken();
          if (!token || auth.currentUser?.uid !== userId) throw new Error('The parent session changed.');
          const response = await fetch('/api/pupils/parent-scope-repair', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          if (!response.ok) throw new Error(`Account-link recovery failed (${response.status}).`);
          const result = await response.json() as { linked?: number };
          if (listenerDisposed()) return;
          if ((result.linked || 0) > 0) return; // The existing listener receives the repaired pupils.
          publishPupils([], 'server');
        } catch (error) {
          if (listenerDisposed()) return;
          console.error('❌ PRELOADER: Parent account-link recovery failed:', error);
          scopeStatus('error');
          pupilLoadFailed = true;
          report('pupils', 'error');
        }
      };

      const unsubscribe = onSnapshot(
        baseQuery,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (listenerDisposed()) return;
          const source = snapshot.metadata.fromCache ? 'cache' : 'server';
          // Firestore's first local result can be partial. Keep the complete
          // normalized saved list until the server has reconciled membership.
          if (snapshot.metadata.fromCache && normalizedPupilsRestored && !serverSnapshotSeen) return;
          if (!snapshot.metadata.fromCache) pupilDataFromServer = true;

          if (!initialSnapshotPublished) {
            initialSnapshotPublished = true;
            serverSnapshotSeen = !snapshot.metadata.fromCache;
            const allPupils = snapshot.docs.map(normalizePupilDoc);
            // An empty local Firestore snapshot is not proof that this account
            // has no pupils: the server may still be downloading them.
            if (snapshot.metadata.fromCache && allPupils.length === 0) return;
            if (!snapshot.metadata.fromCache && userRole === 'Parent' && allPupils.length === 0) {
              void recoverEmptyParentScope();
              return;
            }
            publishPupils(allPupils, source);
            console.log(`PRELOADER: Loaded ${allPupils.length} pupils from ${source}`);
            return;
          }

          // Metadata-only confirmation must not rebuild a large cached array.
          // The parent record subscriptions only react to membership changes, so
          // reuse this existing family-scoped listener instead of opening a
          // second identical pupils listener.
          const changes = snapshot.docChanges({ includeMetadataChanges: false });
          if (!snapshot.metadata.fromCache && !serverSnapshotSeen) {
            serverSnapshotSeen = true;
            performance.mark?.('trinity:pupils-server-synced');
            if (userRole === 'Parent' && snapshot.empty) {
              void recoverEmptyParentScope();
              return;
            }
            // Always reconcile the complete server result, including a
            // metadata-only confirmation with zero document changes.
            publishPupils(snapshot.docs.map(normalizePupilDoc), 'server');
            return;
          }
          if (
            userRole === 'Parent'
            && !snapshot.empty
            && (queryClient.getQueryData(['parentPupilScope', userId]) === 'repairing'
              || queryClient.getQueryData(['pupils', 'list']) === undefined)
          ) {
            publishPupils(snapshot.docs.map(normalizePupilDoc), source);
            return;
          }
          if (changes.length === 0) return;

          onParentPupilIds?.(snapshot.docs.map(doc => doc.id));

          applyPupilChangesToQueryCaches(
            queryClient,
            changes.map(change =>
              change.type === 'removed'
                ? { type: 'removed' as const, id: change.doc.id }
                : {
                    type: change.type,
                    pupil: normalizePupilDoc(change.doc) as any,
                  },
            ),
          );
          const currentPupils = queryClient.getQueryData<any[]>(['pupils', 'list']);
          if (currentPupils) PupilsService.hydrateSharedPupils(currentPupils);
          scopeStatus('ready');
          if (!pupilLoadFailed) report('pupils', 'ready');
          schedulePersistentPupilCacheWrite();

          if (!snapshot.metadata.fromCache) {
            performance.mark?.('trinity:pupils-server-synced');
          }
          console.log(`PRELOADER: Applied ${changes.length} live pupil change(s) from ${source}`);
        },
        (error) => {
          if (listenerDisposed()) return;
          console.error('❌ PRELOADER: Pupils listener error:', error.message);
          if (['permission-denied', 'unauthenticated'].includes(error.code)) {
            pupilLocalAccessRevoked = true;
            clearSavedWorkspaceAccess();
            clearPupilSessionQueries(queryClient);
            queryClient.setQueryData(['pupils', 'hydration'], 'denied');
            PupilsService.clearSharedPupils();
            onParentPupilIds?.([]);
          }
          scopeStatus('error');
          pupilLoadFailed = true;
          report('pupils', 'error');
        }
      );
      pupilsUnsubscribe = unsubscribe;
    };


    // ═══════════════════════════════════════════════════════════
    // ONE-TIME READS (getDocs) — Data that rarely changes
    // These save massive Firestore reads vs onSnapshot listeners
    // ═══════════════════════════════════════════════════════════

    // 6. 💰 FEE STRUCTURES - One-time read (rarely changes)
    const fetchFees = async () => {
      report('fees', 'loading');
      try {
        await withWorkspaceIdentity(userId, async () => undefined);
        if (disposed) return;
        // Share React Query's in-flight request with every consumer, including
        // the fees collection page. A cold navigation cannot start a second
        // collection read while the preloader is still running.
        await queryClient.ensureQueryData({
          queryKey: FEES_QUERY_KEYS.structures(),
          queryFn: FeesService.getAllFeeStructures,
          staleTime: Infinity,
        });
        report('fees', 'ready');
      } catch (error: any) {
        report('fees', 'error');
        console.error('❌ PRELOADER: Fees fetch error:', error.message);
      }
    };

    // 7. 📋 REQUIREMENTS - One-time read (rarely changes)
    const fetchRequirements = async () => {
      report('requirements', 'loading');
      try {
        await withWorkspaceIdentity(userId, async () => undefined);
        if (disposed) return;
        const requirements = await queryClient.fetchQuery(schoolCatalogueOptions(queryClient, 'requirements', user!));
        if (disposed) return;
        report('requirements', 'ready');
        if (requirements.length > 0) {
          console.log(`⚡ PRELOADER: Loaded ${requirements.length} requirements`);
        }
      } catch (error: any) {
        report('requirements', 'error');
        console.error('❌ PRELOADER: Requirements fetch error:', error.message);
      }
    };

    // 8. 👔 UNIFORMS - One-time read (rarely changes)
    const fetchUniforms = async () => {
      report('uniforms', 'loading');
      try {
        await withWorkspaceIdentity(userId, async () => undefined);
        if (disposed) return;
        await queryClient.fetchQuery(schoolCatalogueOptions(queryClient, 'uniforms', user!));
        report('uniforms', 'ready');
      } catch (error: any) {
        report('uniforms', 'error');
        console.error('❌ PRELOADER: Uniforms fetch error:', error.message);
      }
    };

    const fetchExcludedDays = async () => {
      report('excludedDays', 'loading');
      try {
        await withWorkspaceIdentity(userId, async () => undefined);
        if (disposed) return;
        await queryClient.fetchQuery(schoolCatalogueOptions(queryClient, 'excludedDays', user!));
        report('excludedDays', 'ready');
      } catch { report('excludedDays', 'error'); }
    };

    const reconcileCatalogues = () => {
      if (disposed || userRole === 'Parent') return;
      const owners = { requirements: fetchRequirements, uniforms: fetchUniforms, excludedDays: fetchExcludedDays };
      const jobs = (Object.keys(owners) as Array<keyof typeof owners>).filter(name => {
        const key = schoolCatalogueOptions(queryClient, name, user!).queryKey;
        // Mounted pages already own refetchOnReconnect; background owners
        // recover inactive copies without cancelling or duplicating those reads.
        if (queryClient.getQueryCache().find({ queryKey: key })?.isActive()) return false;
        void queryClient.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' });
        return true;
      });
      const run = async () => { while (!disposed && jobs.length) await owners[jobs.shift()!](); };
      void run(); void run();
    };
    window.addEventListener('online', reconcileCatalogues);
    unsubscribers.push(() => window.removeEventListener('online', reconcileCatalogues));

    // 10. 👤 USERS - One-time read (rarely changes)
    /*
     * Users, access levels, and events are feature-owned. Keeping their old
     * eager fetchers disabled prevents accidental reintroduction of dashboard
     * reads or the former unscoped event cache.
      try {
        const cached = queryClient.getQueryData(['users']);
        if (cached && (cached as any[]).length > 0) return;
        const snapshot = await getDocs(firestoreQuery(collection(db, 'users')));
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (users.length > 0) {
          queryClient.setQueryData(['users'], users);
          console.log(`⚡ PRELOADER: Loaded ${users.length} users`);
        }
      } catch (error: any) {
        console.error('❌ PRELOADER: Users fetch error:', error.message);
      }
    };

    // 14. 📆 EVENTS - One-time read (events rarely change in bulk; mutations invalidate individually)
    const fetchEvents = async () => {
      try {
        const cached = queryClient.getQueryData(['events', undefined]);
        if (cached && (cached as any[]).length > 0) {
          console.log('⚡ PRELOADER: Events already cached, skipping fetch');
          return;
        }
        // Events intentionally have no live listener. On a warm load, restore
        // their small persisted cache instead of reading the full collection.
        const persisted = liteRead<any[]>(LITE_KEYS.events);
        if (persisted && persisted.length > 0) {
          queryClient.setQueryData(['events', undefined], persisted);
          return;
        }

        const { orderBy } = await import('firebase/firestore');
        const q = firestoreQuery(collection(db, 'events'), orderBy('startDate', 'desc'));
        const snapshot = await getDocs(q);
        const events = snapshot.docs.map(doc => {
          const data = doc.data();
          const toDateString = (ts: any): string => {
            if (!ts) return '';
            if (typeof ts === 'string') return ts.split('T')[0];
            if (ts.toDate) return ts.toDate().toISOString().split('T')[0];
            if (ts.seconds) return new Date(ts.seconds * 1000).toISOString().split('T')[0];
            return '';
          };
          return {
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            type: data.type || 'Academic',
            priority: data.priority || 'Medium',
            status: data.status || 'Draft',
            startDate: toDateString(data.startDate),
            endDate: toDateString(data.endDate),
            startTime: data.startTime || '',
            endTime: data.endTime || '',
            isAllDay: data.isAllDay || false,
            location: data.location || '',
            targetAudience: data.targetAudience || [],
            academicYearId: data.academicYearId || '',
            termId: data.termId || '',
            classIds: data.classIds || [],
            subjectIds: data.subjectIds || [],
            isExamEvent: data.isExamEvent || false,
            isRecurringInstance: data.isRecurringInstance || false,
            parentEventId: data.parentEventId,
            recurrence: data.recurrence || { frequency: 'None' },
            reminders: data.reminders || [],
            notificationsSent: data.notificationsSent || [],
            sendReminders: data.sendReminders !== false,
            colorCode: data.colorCode || '#3b82f6',
            requiresApproval: data.requiresApproval || false,
            approvedBy: data.approvedBy,
            approvedAt: data.approvedAt ? toDateString(data.approvedAt) : undefined,
            requiresAttendance: data.requiresAttendance || false,
            isPublic: data.isPublic !== false,
            tags: data.tags || [],
            attachments: data.attachments || [],
            customFields: data.customFields || {},
            createdBy: data.createdBy || '',
            createdByName: data.createdByName || '',
            createdAt: data.createdAt ? toDateString(data.createdAt) : new Date().toISOString(),
            updatedAt: data.updatedAt ? toDateString(data.updatedAt) : undefined,
            examIntegration: data.examIntegration,
          };
        });
        if (events.length >= 0) {
          queryClient.setQueryData(['events', undefined], events);
          // Persist to lite cache so useEvents(undefined) has instant initialData on warm loads
          liteWrite(LITE_KEYS.events, events);
          console.log(`⚡ PRELOADER: Loaded ${events.length} events (one-time read)`);
        }
      } catch (error: any) {
        console.error('❌ PRELOADER: Events fetch error:', error.message);
      }
    };

    // 12–13. Parent child-record listeners are driven by the existing
    // family-scoped pupils listener. Child listeners are added or removed only
    // when membership changes, avoiding a second identical pupils subscription.
    */
    const setupParentRecordsListeners = () => {
      if (!userId || userRole !== 'Parent') return;
      const childUnsubscribers = new Map<string, Array<() => void>>();
      const paymentsReady = new Set<string>();
      const paymentsFailed = new Set<string>();
      let currentPupilIds = new Set<string>();
      const reportPayments = () => report('payments', [...currentPupilIds].some(id => paymentsFailed.has(id)) ? 'error'
        : [...currentPupilIds].every(id => paymentsReady.has(id)) ? 'ready' : 'loading');

      const syncParentPupilRecords = (parentPupilIds: string[]) => {
          const pupilIds = new Set(parentPupilIds);
          currentPupilIds = pupilIds;

          childUnsubscribers.forEach((listeners, pupilId) => {
            if (!pupilIds.has(pupilId)) {
              listeners.forEach(unsubscribe => unsubscribe());
              childUnsubscribers.delete(pupilId);
              paymentsReady.delete(pupilId);
              paymentsFailed.delete(pupilId);
            }
          });

          pupilIds.forEach(pupilId => {
            if (childUnsubscribers.has(pupilId)) return;

            const paymentsQuery = firestoreQuery(
              collection(db, 'payments'),
              where('pupilId', '==', pupilId)
            );

            const paymentsUnsubscribe = onSnapshot(
              paymentsQuery,
              { includeMetadataChanges: true },
              (snapshot) => {
                const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (disposed) return;
                queryClient.setQueryData(['payments', 'pupil', pupilId], payments);
                if (!snapshot.metadata.fromCache || payments.length > 0) {
                  paymentsReady.add(pupilId);
                  paymentsFailed.delete(pupilId);
                  reportPayments();
                }
                console.log(`⚡ PRELOADER: Loaded ${payments.length} payment records for pupil ${pupilId}`);
              },
              (error) => { if (disposed) return; paymentsFailed.add(pupilId); reportPayments(); console.error('❌ PRELOADER: Payments error:', error.message); }
            );
            childUnsubscribers.set(pupilId, [paymentsUnsubscribe]);
          });
          reportPayments();
      };

      unsubscribers.push(() => {
        childUnsubscribers.forEach(listeners => listeners.forEach(unsubscribe => unsubscribe()));
        childUnsubscribers.clear();
      });

      unsubscribers.push(registerWorkspaceRecovery(queryClient, setupScope, 'payments', async () => {
        await withWorkspaceIdentity(userId, async () => undefined);
        if (disposed) return;
        paymentsFailed.forEach(id => {
          childUnsubscribers.get(id)?.forEach(unsubscribe => unsubscribe());
          childUnsubscribers.delete(id);
          paymentsReady.delete(id);
        });
        paymentsFailed.clear();
        syncParentPupilRecords([...currentPupilIds]);
      }));
      return syncParentPupilRecords;
    };

    // ═══════════════════════════════════════════════════════════
    // START LOADING — Role-based
    // ═══════════════════════════════════════════════════════════

    if (userRole === 'Parent') syncParentPupilRecords = setupParentRecordsListeners();
    unsubscribers.push(registerWorkspaceRecovery(queryClient, setupScope, 'pupils', () =>
      setupPupilsListener(syncParentPupilRecords).catch(error => {
        report('pupils', 'error'); console.error('Pupil recovery failed:', error);
      })));
    unsubscribers.push(registerWorkspaceRecovery(queryClient, setupScope, 'fees', fetchFees));
    if (userRole !== 'Parent') {
      unsubscribers.push(registerWorkspaceRecovery(queryClient, setupScope, 'requirements', fetchRequirements));
      unsubscribers.push(registerWorkspaceRecovery(queryClient, setupScope, 'uniforms', fetchUniforms));
      unsubscribers.push(registerWorkspaceRecovery(queryClient, setupScope, 'excludedDays', fetchExcludedDays));
    }

    // Saved pupils are already restoring above. Only protected live readers
    // wait for Firebase; its Promise does not block rendering or local viewing.
    (async () => {
      try {
        await withWorkspaceIdentity(userId, async () => undefined);
        if (disposed) return;
        // Dashboard-critical data starts first. Secondary module data begins
        // just afterward so it remains warm for navigation without competing
        // with the first visible dashboard request burst.
        if (userRole === 'Parent') {
          console.log('🎯 PARENT MODE: Loading minimal essential data + pupil-specific records...');
          // Fire all in parallel — pupils load concurrently with classes and fees
          setupPupilsListener(syncParentPupilRecords).catch(e => { report('pupils', 'error'); console.error('❌ PRELOADER: Pupils load error:', e); });
          fetchFees();
          console.log('✅ PARENT PRELOADER: Essential data + payment listener active');
        } else {
          console.log('👥 ADMIN/STAFF MODE: Loading dashboard data first...');
          setupPupilsListener().catch(e => { report('pupils', 'error'); console.error('❌ PRELOADER: Pupils load error:', e); });
          deferredTimer = setTimeout(() => {
            // Two background owners at most. A page's own query still starts
            // immediately and shares the same in-flight request with its owner.
            const pathname = window.location.pathname;
            const warmups = pathname.includes('uniform') ? [fetchUniforms, fetchFees, fetchRequirements, fetchExcludedDays]
              : pathname.includes('requirement') ? [fetchRequirements, fetchFees, fetchUniforms, fetchExcludedDays]
                : [fetchFees, fetchExcludedDays, fetchRequirements, fetchUniforms];
            const run = async () => {
              while (!disposed && warmups.length) await warmups.shift()!();
            };
            void run(); void run();
          }, 1200);

          console.log('✅ GLOBAL PRELOADER: Dashboard listeners active; remaining data queued');
        }
      } catch (error) {
        ['pupils', 'fees', ...(userRole === 'Parent' ? ['payments'] : ['requirements', 'uniforms', 'excludedDays'])].forEach(task => report(task, 'error'));
        console.error('❌ GLOBAL PRELOADER: Setup failed:', error);
      }
    })();

    // Cleanup all listeners on unmount or when user changes
    return () => {
      console.log('🔌 GLOBAL PRELOADER: Cleaning up all listeners');
      disposed = true;
      pupilsUnsubscribe?.();
      PupilsService.clearSharedPupils();
      if (deferredTimer) clearTimeout(deferredTimer);
      if (pupilCacheWriteTimer) clearTimeout(pupilCacheWriteTimer);
      if (
        pupilCacheIdleHandle !== undefined &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(pupilCacheIdleHandle);
      }
      unsubscribers.forEach(unsub => unsub());
    };
  // Re-run when auth state changes so listeners are always tied to the current
  // user. The cleanup (unsubscribers.forEach) tears down old listeners before
  // new ones are created, preventing duplicate subscriptions.
  }, [queryClient, isAuthenticated, userId, userRole, savedWorkspaceScope]);


  return null; // This component doesn't render anything
}
