"use client";

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { collection, query as firestoreQuery, onSnapshot, where, getDocs, getDocsFromCache, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import { liteRead, liteWrite, liteInvalidate, LITE_KEYS, LITE_TTL } from '@/lib/cache/lite-cache';
import {
  persistentCollectionCacheKey,
  readPersistentCollection,
  writePersistentCollection,
} from '@/lib/cache/persistent-collection-cache';
import { applyPupilChangesToQueryCaches } from '@/lib/hooks/use-pupils';

/**
 * 🚀 ROLE-AWARE DATA PRELOADER (OPTIMIZED FOR QUOTA)
 * 
 * STRATEGY:
 * - Real-time listeners (onSnapshot) ONLY for data that changes frequently
 *   and needs instant cross-device sync: classes, pupils, academic years, staff, subjects
 * - One-time reads (getDocs) for data that rarely changes: fees, requirements,
 *   uniforms, photos, and events. User-directory and access-level data are
 *   loaded only when their feature is opened, through shared live listeners.
 * 
 * This dramatically reduces Firestore reads to prevent quota exhaustion.
 */
export function GlobalDataPreloader() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;
  const userFamilyId = user?.familyId;

  useEffect(() => {
    // Don't start preloading until user is authenticated
    if (!isAuthenticated || !userId || !userRole) {
      console.log('⏸️ PRELOADER: Waiting for authentication...');
      return;
    }

    console.log(`🚀 GLOBAL PRELOADER: Starting role-aware listeners for ${userRole}...`);

    const unsubscribers: Array<() => void> = [];
    let deferredTimer: ReturnType<typeof setTimeout> | undefined;
    let pupilCacheWriteTimer: ReturnType<typeof setTimeout> | undefined;
    let pupilCacheIdleHandle: number | undefined;
    let disposed = false;

    // ═══════════════════════════════════════════════════════════
    // REAL-TIME LISTENERS (onSnapshot) — Data that needs live sync
    // ═══════════════════════════════════════════════════════════

    // 1. 📚 CLASSES - Real-time (critical, cross-device sync)
    const setupClassesListener = () => {
      const classesQuery = firestoreQuery(collection(db, 'classes'));
      const unsubscribe = onSnapshot(
        classesQuery,
        (snapshot) => {
          const classes = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            .sort((a: any, b: any) => (a.order ?? Infinity) - (b.order ?? Infinity));
          if (classes.length > 0) {
            queryClient.setQueryData(['classes', 'list'], classes);
            console.log(`⚡ PRELOADER: Loaded ${classes.length} classes`);
          }
        },
        (error) => console.error('❌ PRELOADER: Classes error:', error.message)
      );
      unsubscribers.push(unsubscribe);
    };

    // 2. 📅 ACADEMIC YEARS — Same 3-phase strategy as pupils:
    //    Phase 1: Firestore IndexedDB cache (instant, includes term dates)
    //    Phase 2: Network fetch (cache miss fallback)
    //    Phase 3: Narrow onSnapshot — only watches documents updated after session start
    const setupAcademicYearsListener = async () => {
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


    // 3. 👥 STAFF - Real-time (cross-device sync)
    const setupStaffListener = () => {
      const staffQuery = firestoreQuery(collection(db, 'staff'));
      const unsubscribe = onSnapshot(
        staffQuery,
        (snapshot) => {
          const staff = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              // ISO strings — not Date objects — for JSON-safe localStorage caching
              createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
              updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
              dateOfBirth: data.dateOfBirth?.toDate?.()?.toISOString?.() ?? null,
              dateOfJoining: data.dateOfJoining?.toDate?.()?.toISOString?.() ?? null,
            };
          });
          if (staff.length > 0) {
            queryClient.setQueryData(['staff'], staff);
            console.log(`⚡ PRELOADER: Loaded ${staff.length} staff members`);
          }
        },
        (error) => console.error('❌ PRELOADER: Staff error:', error.message)
      );
      unsubscribers.push(unsubscribe);
    };

    // 4. 📖 SUBJECTS - Real-time (cross-device sync)
    const setupSubjectsListener = () => {
      const subjectsQuery = firestoreQuery(collection(db, 'subjects'));
      const unsubscribe = onSnapshot(
        subjectsQuery,
        (snapshot) => {
          const subjects = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              // ISO strings for JSON-safe caching
              createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
              updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
            };
          });
          if (subjects.length > 0) {
            queryClient.setQueryData(['subjects'], subjects);
            console.log(`⚡ PRELOADER: Loaded ${subjects.length} subjects`);
          }
        },
        (error) => console.error('❌ PRELOADER: Subjects error:', error.message)
      );
      unsubscribers.push(unsubscribe);
    };

    // 5. PUPILS - One cache-first, server-backed real-time listener.
    //
    // Firestore emits the listener's local IndexedDB snapshot first and then
    // reconciles it with the server. Cached data must never wait behind a count
    // request or a duplicate getDocs() call.
    const setupPupilsListener = async (
      onParentPupilIds?: (pupilIds: string[]) => void,
    ) => {
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

      // Build the base query (scoped to family for parents)
      const baseQuery = (userRole === 'Parent' && userFamilyId)
        ? firestoreQuery(collection(db, 'pupils'), where('familyId', '==', userFamilyId))
        : firestoreQuery(collection(db, 'pupils'));
      const projectId =
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
      const cacheScope =
        userRole === 'Parent'
          ? `parent:${userId}:family:${userFamilyId || 'unassigned'}`
          : `user:${userId}`;
      const persistentCacheKey = persistentCollectionCacheKey(
        projectId,
        'pupils',
        cacheScope,
      );

      if (userRole === 'Parent' && userFamilyId) {
        console.log(`🎯 PARENT MODE: Loading only pupils for family ${userFamilyId}`);
      }

      const schedulePersistentPupilCacheWrite = () => {
        if (disposed) return;
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
            if (disposed) return;
            const pupils = queryClient.getQueryData<any[]>(['pupils', 'list']);
            if (!pupils) return;
            void writePersistentCollection(persistentCacheKey, pupils);
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

      // Restore the complete normalized list from one asynchronous IndexedDB
      // value while the Firestore listener starts below. Neither source blocks
      // the other, and a server result always wins if it arrives first.
      const fastCacheStartedAt = performance.now();
      void readPersistentCollection<any[]>(persistentCacheKey).then(persistedPupils => {
        const existingPupils = queryClient.getQueryData<any[]>(['pupils', 'list']);
        if (
          disposed ||
          serverSnapshotSeen ||
          existingPupils?.length ||
          !persistedPupils ||
          !Array.isArray(persistedPupils) ||
          persistedPupils.length === 0
        ) {
          return;
        }

        queryClient.setQueryData(['pupils', 'list'], persistedPupils);
        onParentPupilIds?.(persistedPupils.map(pupil => pupil.id));
        performance.mark?.('trinity:pupils-fast-cache-ready');
        console.log(
          `FAST CACHE: Restored ${persistedPupils.length} pupils in ${Math.round(performance.now() - fastCacheStartedAt)}ms`,
        );
      });

      const unsubscribe = onSnapshot(
        baseQuery,
        { includeMetadataChanges: true },
        (snapshot) => {
          const source = snapshot.metadata.fromCache ? 'cache' : 'server';

          if (!initialSnapshotPublished) {
            initialSnapshotPublished = true;
            serverSnapshotSeen = !snapshot.metadata.fromCache;
            const allPupils = snapshot.docs.map(normalizePupilDoc);
            const existingPupils = queryClient.getQueryData<any[]>(['pupils', 'list']);
            // An empty local snapshot must not blank a populated in-memory cache.
            // The following server snapshot will authoritatively add/remove docs.
            if (!(snapshot.metadata.fromCache && allPupils.length === 0 && existingPupils?.length)) {
              queryClient.setQueryData(['pupils', 'list'], allPupils);
              onParentPupilIds?.(allPupils.map(pupil => pupil.id));
            }
            schedulePersistentPupilCacheWrite();
            performance.mark?.(`trinity:pupils-${source}-ready`);
            console.log(`PRELOADER: Loaded ${allPupils.length} pupils from ${source}`);
            return;
          }

          // Metadata-only confirmation must not rebuild a large cached array.
          // The parent record subscriptions only react to membership changes, so
          // reuse this existing family-scoped listener instead of opening a
          // second identical pupils listener.
          onParentPupilIds?.(snapshot.docs.map(doc => doc.id));
          const changes = snapshot.docChanges({ includeMetadataChanges: false });
          if (!snapshot.metadata.fromCache && !serverSnapshotSeen) {
            serverSnapshotSeen = true;
            performance.mark?.('trinity:pupils-server-synced');
            if (changes.length > 0) {
              // Reconcile against the complete authoritative result once. This
              // removes records that may exist only in an older React Query cache.
              queryClient.setQueryData(
                ['pupils', 'list'],
                snapshot.docs.map(normalizePupilDoc),
              );
              schedulePersistentPupilCacheWrite();
            }
            return;
          }
          if (changes.length === 0) return;

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
          schedulePersistentPupilCacheWrite();

          if (!snapshot.metadata.fromCache) {
            performance.mark?.('trinity:pupils-server-synced');
          }
          console.log(`PRELOADER: Applied ${changes.length} live pupil change(s) from ${source}`);
        },
        (error) => console.error('❌ PRELOADER: Pupils listener error:', error.message)
      );
      unsubscribers.push(unsubscribe);
    };


    // ═══════════════════════════════════════════════════════════
    // ONE-TIME READS (getDocs) — Data that rarely changes
    // These save massive Firestore reads vs onSnapshot listeners
    // ═══════════════════════════════════════════════════════════

    // 6. 💰 FEE STRUCTURES - One-time read (rarely changes)
    const fetchFees = async () => {
      try {
        // Skip if cache already has data
        const cached = queryClient.getQueryData(['fees', 'structures']);
        if (cached && (cached as any[]).length > 0) {
          console.log('⚡ PRELOADER: Fees already cached, skipping fetch');
          return;
        }
        const snapshot = await getDocs(firestoreQuery(collection(db, 'feeStructures')));
        const fees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (fees.length > 0) {
          queryClient.setQueryData(['fees', 'structures'], fees);
          console.log(`⚡ PRELOADER: Loaded ${fees.length} fee structures`);
        }
      } catch (error: any) {
        console.error('❌ PRELOADER: Fees fetch error:', error.message);
      }
    };

    // 7. 📋 REQUIREMENTS - One-time read (rarely changes)
    const fetchRequirements = async () => {
      try {
        const cached = queryClient.getQueryData(['requirements']);
        if (cached && (cached as any[]).length > 0) return;
        const snapshot = await getDocs(firestoreQuery(collection(db, 'requirements')));
        const requirements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (requirements.length > 0) {
          queryClient.setQueryData(['requirements'], requirements);
          console.log(`⚡ PRELOADER: Loaded ${requirements.length} requirements`);
        }
      } catch (error: any) {
        console.error('❌ PRELOADER: Requirements fetch error:', error.message);
      }
    };

    // 8. 👔 UNIFORMS - One-time read (rarely changes)
    const fetchUniforms = async () => {
      try {
        const cached = queryClient.getQueryData(['uniforms']);
        if (cached && (cached as any[]).length > 0) return;
        const snapshot = await getDocs(firestoreQuery(collection(db, 'uniforms')));
        const uniforms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        queryClient.setQueryData(['uniforms'], uniforms);
        console.log(`⚡ PRELOADER: Loaded ${uniforms.length} uniforms`);
      } catch (error: any) {
        console.error('❌ PRELOADER: Uniforms fetch error:', error.message);
      }
    };

    // 9. 📸 PHOTOS - One-time read with smart re-fetch on new uploads
    // No persistent listener — photos are cached and only refreshed when count changes.
    const fetchPhotos = async () => {
      try {
        

        const cached = queryClient.getQueryData<any[]>(['photos']);
        const serverCount = cached?.length ?? 0;
        

        

        // Skip full fetch if counts match — nothing new has been added
        if (cached && cached.length > 0) {
          console.log(`⚡ PRELOADER: Photos count unchanged (${serverCount}), using cache`);
          return;
        }

        // Count differs — fetch the full list once
        const snapshot = await getDocs(collection(db, 'photos'));
        const photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Keep only active Cloudinary photos (same filter as before)
        const validPhotos = photos.filter((photo: any) =>
          photo.url?.includes('cloudinary.com') && photo.isActive !== false
        );

        queryClient.setQueryData(['photos'], validPhotos);
        // Persist to lite cache so usePhotos() has instant initialData on warm loads
        liteWrite(LITE_KEYS.photos, validPhotos);
        console.log(`⚡ PRELOADER: Loaded ${validPhotos.length} photos (one-time read, server=${serverCount})`);
      } catch (error: any) {
        console.error('❌ PRELOADER: Photos fetch error:', error.message);
      }
    };

    // 10. 👤 USERS - One-time read (rarely changes)
    const fetchUsers = async () => {
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

    // 11. 🔐 ACCESS LEVELS - One-time read (rarely changes)
    const fetchAccessLevels = async () => {
      try {
        const cached = queryClient.getQueryData(['accessLevels', 'all']);
        if (cached && (cached as any[]).length > 0) return;
        const snapshot = await getDocs(firestoreQuery(collection(db, 'accessLevels')));
        const accessLevels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        queryClient.setQueryData(['accessLevels', 'all'], accessLevels);
        console.log(`⚡ PRELOADER: Loaded ${accessLevels.length} access levels`);
      } catch (error: any) {
        console.error('❌ PRELOADER: Access levels fetch error:', error.message);
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
    const setupParentRecordsListeners = () => {
      if (!userFamilyId) return;
      const childUnsubscribers = new Map<string, Array<() => void>>();

      const syncParentPupilRecords = (parentPupilIds: string[]) => {
          const pupilIds = new Set(parentPupilIds);

          childUnsubscribers.forEach((listeners, pupilId) => {
            if (!pupilIds.has(pupilId)) {
              listeners.forEach(unsubscribe => unsubscribe());
              childUnsubscribers.delete(pupilId);
            }
          });

          pupilIds.forEach(pupilId => {
            if (childUnsubscribers.has(pupilId)) return;

            const attendanceQuery = firestoreQuery(
              collection(db, 'attendanceRecords'),
              where('pupilId', '==', pupilId)
            );
            const paymentsQuery = firestoreQuery(
              collection(db, 'payments'),
              where('pupilId', '==', pupilId)
            );

            const attendanceUnsubscribe = onSnapshot(
              attendanceQuery,
              (snapshot) => {
                const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                queryClient.setQueryData(['attendance', 'pupil', pupilId], records);
                console.log(`⚡ PRELOADER: Loaded ${records.length} attendance records for pupil ${pupilId}`);
              },
              (error) => console.error('❌ PRELOADER: Attendance error:', error.message)
            );
            const paymentsUnsubscribe = onSnapshot(
              paymentsQuery,
              (snapshot) => {
                const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                queryClient.setQueryData(['payments', 'pupil', pupilId], payments);
                console.log(`⚡ PRELOADER: Loaded ${payments.length} payment records for pupil ${pupilId}`);
              },
              (error) => console.error('❌ PRELOADER: Payments error:', error.message)
            );
            childUnsubscribers.set(pupilId, [attendanceUnsubscribe, paymentsUnsubscribe]);
          });
      };

      unsubscribers.push(() => {
        childUnsubscribers.forEach(listeners => listeners.forEach(unsubscribe => unsubscribe()));
        childUnsubscribers.clear();
      });

      return syncParentPupilRecords;
    };

    // ═══════════════════════════════════════════════════════════
    // START LOADING — Role-based
    // ═══════════════════════════════════════════════════════════

    // Fire all data setup calls in PARALLEL — do not await any single one
    // before starting the others. setupPupilsListener is async only so setup
    // failures can be reported consistently; the listener itself starts at once.
    (async () => {
      try {
        // Dashboard-critical data starts first. Secondary module data begins
        // just afterward so it remains warm for navigation without competing
        // with the first visible dashboard request burst.
        setupAcademicYearsListener().catch(e => console.error('❌ PRELOADER: Academic years load error:', e));

        if (userRole === 'Parent') {
          console.log('🎯 PARENT MODE: Loading minimal essential data + pupil-specific records...');
          // Fire all in parallel — pupils load concurrently with classes and fees
          const syncParentPupilRecords = setupParentRecordsListeners();
          setupPupilsListener(syncParentPupilRecords).catch(e => console.error('❌ PRELOADER: Pupils load error:', e));
          setupClassesListener();
          fetchFees();
          console.log('✅ PARENT PRELOADER: Essential data + pupil records listeners active');
        } else {
          console.log('👥 ADMIN/STAFF MODE: Loading dashboard data first...');
          setupClassesListener();
          setupStaffListener();
          setupPupilsListener().catch(e => console.error('❌ PRELOADER: Pupils load error:', e));

          deferredTimer = setTimeout(() => {
            setupSubjectsListener();
            void fetchPhotos();
            void fetchFees();
            void fetchRequirements();
            void fetchUniforms();
            void fetchEvents();
          }, 1200);

          console.log('✅ GLOBAL PRELOADER: Dashboard listeners active; remaining data queued');
        }
      } catch (error) {
        console.error('❌ GLOBAL PRELOADER: Setup failed:', error);
      }
    })();

    // Cleanup all listeners on unmount or when user changes
    return () => {
      console.log('🔌 GLOBAL PRELOADER: Cleaning up all listeners');
      disposed = true;
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
  }, [queryClient, isAuthenticated, userId, userRole, userFamilyId]);


  return null; // This component doesn't render anything
}
