import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, getDocsFromServer, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { TimetableService, getPeriodsCollectionPath, getEntriesCollectionPath, getTimetablesCollectionPath } from '../services/timetable.service';
import type { TimetableProfile, GeneratedPeriod, TimetableEntry } from '@/types';
import { useAuth } from '@/lib/contexts/auth-context';
import { useDashboardDataRevisions } from './use-school-settings';
import { liteRead, liteWrite } from '@/lib/cache/lite-cache';
import { getRevisionCachePolicy } from '@/lib/cache/revision-cache-policy';
import { dashboardRevisionKeys } from '@/lib/services/dashboard-cache-revisions.service';

// Keys for caching
export const timetableKeys = {
    allProfiles: (yearId: string, termId: string) => ['timetables', 'all', yearId, termId] as const,
    profile: (yearId: string, termId: string, timetableId: string) => ['timetable', 'profile', yearId, termId, timetableId] as const,
    periods: (yearId: string, termId: string, timetableId: string) => ['timetable', 'periods', yearId, termId, timetableId] as const,
    entries: (yearId: string, termId: string, timetableId: string) => ['timetable', 'entries', yearId, termId, timetableId] as const,
    classEntries: (yearId: string, termId: string, timetableId: string, classId: string) => ['timetable', 'entries', 'class', yearId, termId, timetableId, classId] as const,
};

// ─── Timetable cache TTL ──────────────────────────────────────────────────────
// Timetables are revision-invalidated by create/edit/delete mutations. The
// persistent copy intentionally has no time-based refresh: a term may remain
// unchanged for months, and a revision change is the only normal reason to
// re-read it.
const STALE_TIME = Infinity;
const GC_TIME = 24 * 60 * 60 * 1000;
const TIMETABLE_CACHE_TTL = Number.MAX_SAFE_INTEGER;
const TIMETABLE_CACHE_SCHEMA = 2;

type TimetableCacheEntry<T> = {
    schema: number;
    revision: number;
    data: T;
};

function timetableCacheKey(
    scope: string,
    resource: string,
    yearId: string,
    termId: string,
    identifier?: string,
) {
    return [
        'timetable',
        encodeURIComponent(scope),
        encodeURIComponent(yearId),
        encodeURIComponent(termId),
        resource,
        identifier ? encodeURIComponent(identifier) : '',
    ].join(':');
}

function readTimetableCache<T>(cacheKey: string): TimetableCacheEntry<T> | undefined {
    const entry = liteRead<TimetableCacheEntry<T>>(cacheKey);
    if (!entry || entry.schema !== TIMETABLE_CACHE_SCHEMA) return undefined;
    return entry;
}

function writeTimetableCache<T>(cacheKey: string, revision: number, data: T) {
    liteWrite(
        cacheKey,
        { schema: TIMETABLE_CACHE_SCHEMA, revision, data } satisfies TimetableCacheEntry<T>,
        TIMETABLE_CACHE_TTL,
    );
}

async function fetchWithTimetableFallback<T>(
    fallback: T | undefined,
    fetcher: () => Promise<T>,
): Promise<T> {
    try {
        return await fetcher();
    } catch (error) {
        if (fallback !== undefined) {
            console.warn('Timetable refresh failed; keeping the cached snapshot.', error);
            return fallback;
        }
        throw error;
    }
}

function useTimetableRevision(yearId: string, termId: string) {
    const { user } = useAuth();
    const revisionsQuery = useDashboardDataRevisions();
    const revisionKey = dashboardRevisionKeys.timetable(yearId, termId);
    const revision = revisionsQuery.data?.timetable?.[revisionKey] ?? 0;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
    const scope = user
        ? [projectId, user.id, user.role, user.familyId || 'school'].map(encodeURIComponent).join(':')
        : '';

    return {
        scope,
        revision,
        revisionsReady: revisionsQuery.data !== undefined,
    };
}

// ─── useTimetableProfiles ─────────────────────────────────────────────────────
// Was: onSnapshot (live) + queryFn getDocs = 2 fetches on every mount
// Now: one cold/revision read. Mutations advance the shared revision.
export function useTimetableProfiles(yearId: string, termId: string) {
    const { scope, revision, revisionsReady } = useTimetableRevision(yearId, termId);
    const cacheKey = timetableCacheKey(scope, 'profiles', yearId, termId);
    const cacheEntry = readTimetableCache<TimetableProfile[]>(cacheKey);
    const initialData = cacheEntry?.data;
    const cachePolicy = getRevisionCachePolicy({
        hasCachedData: initialData !== undefined,
        cachedRevision: cacheEntry?.revision,
        currentRevision: revision,
        revisionsReady,
    });

    return useQuery({
        queryKey: [
            ...timetableKeys.allProfiles(yearId, termId),
            scope,
            revision,
            revisionsReady ? 'ready' : 'pending',
        ],
        queryFn: () => fetchWithTimetableFallback(initialData, async () => {
            const profilesQuery = query(collection(db, getTimetablesCollectionPath(yearId, termId)));
            const snapshot = revisionsReady
                ? await getDocsFromServer(profilesQuery)
                : await getDocs(profilesQuery);
            const profilesList = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
                } as TimetableProfile;
            });
            // Sort descending by createdAt (matches original sort)
            profilesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            writeTimetableCache(cacheKey, revisionsReady ? revision : -1, profilesList);
            return profilesList;
        }),
        enabled: !!yearId && !!termId && !!scope &&
            cachePolicy.shouldFetch,
        staleTime: cachePolicy.shouldFetch ? 0 : STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: cachePolicy.shouldFetch,
        refetchOnWindowFocus: false,
        refetchOnReconnect: cachePolicy.shouldFetch,
        placeholderData: (prev) => prev ?? initialData,
        initialData,
        initialDataUpdatedAt: initialData !== undefined ? Date.now() : undefined,
    });
}

export function useTimetableProfile(yearId: string, termId: string, timetableId: string) {
    const queryClient = useQueryClient();
    const { scope, revision, revisionsReady } = useTimetableRevision(yearId, termId);
    const cacheKey = timetableCacheKey(scope, 'profile', yearId, termId, timetableId);
    const cachedProfileEntry = readTimetableCache<TimetableProfile | null>(cacheKey);
    const profilesCacheKey = timetableCacheKey(scope, 'profiles', yearId, termId);
    const memoryProfiles = queryClient.getQueryData<TimetableProfile[]>([
            ...timetableKeys.allProfiles(yearId, termId),
            scope,
            revision,
            revisionsReady ? 'ready' : 'pending',
        ]);
    const cachedProfilesEntry = readTimetableCache<TimetableProfile[]>(profilesCacheKey);
    const cachedProfiles = memoryProfiles ?? cachedProfilesEntry?.data;
    const initialData = cachedProfileEntry !== undefined
        ? cachedProfileEntry.data
        : cachedProfiles?.find(profile => profile.id === timetableId);
    const cachedRevision = cachedProfileEntry?.revision ??
        (memoryProfiles !== undefined ? revision : cachedProfilesEntry?.revision);
    const cachePolicy = getRevisionCachePolicy({
        hasCachedData: initialData !== undefined,
        cachedRevision,
        currentRevision: revision,
        revisionsReady,
    });

    return useQuery({
        queryKey: [
            ...timetableKeys.profile(yearId, termId, timetableId),
            scope,
            revision,
            revisionsReady ? 'ready' : 'pending',
        ],
        queryFn: () => fetchWithTimetableFallback(initialData, async () => {
            const profile = await TimetableService.getTimetableById(
                yearId,
                termId,
                timetableId,
                revisionsReady ? 'server' : 'default',
            );
            writeTimetableCache(cacheKey, revisionsReady ? revision : -1, profile);
            return profile;
        }),
        enabled: !!yearId && !!termId && !!timetableId && !!scope &&
            cachePolicy.shouldFetch,
        staleTime: cachePolicy.shouldFetch ? 0 : STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: cachePolicy.shouldFetch,
        refetchOnWindowFocus: false,
        refetchOnReconnect: cachePolicy.shouldFetch,
        placeholderData: (prev) => prev ?? initialData,
        initialData,
        initialDataUpdatedAt: initialData !== undefined ? Date.now() : undefined,
    });
}

// ─── useTimetablePeriods ──────────────────────────────────────────────────────
// Was: onSnapshot (live) + queryFn getDocs = 2 fetches on every mount
// Now: one cold/revision read with a persistent snapshot.
export function useTimetablePeriods(yearId: string, termId: string, timetableId: string) {
    const { scope, revision, revisionsReady } = useTimetableRevision(yearId, termId);
    const cacheKey = timetableCacheKey(scope, 'periods', yearId, termId, timetableId);
    const cacheEntry = readTimetableCache<GeneratedPeriod[]>(cacheKey);
    const initialData = cacheEntry?.data;
    const cachePolicy = getRevisionCachePolicy({
        hasCachedData: initialData !== undefined,
        cachedRevision: cacheEntry?.revision,
        currentRevision: revision,
        revisionsReady,
    });

    return useQuery({
        queryKey: [
            ...timetableKeys.periods(yearId, termId, timetableId),
            scope,
            revision,
            revisionsReady ? 'ready' : 'pending',
        ],
        queryFn: () => fetchWithTimetableFallback(initialData, async () => {
            const periodsQuery = query(
                collection(db, getPeriodsCollectionPath(yearId, termId, timetableId)),
            );
            const snapshot = revisionsReady
                ? await getDocsFromServer(periodsQuery)
                : await getDocs(periodsQuery);
            const periods = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as GeneratedPeriod[];
            writeTimetableCache(cacheKey, revisionsReady ? revision : -1, periods);
            return periods;
        }),
        enabled: !!yearId && !!termId && !!timetableId && !!scope &&
            cachePolicy.shouldFetch,
        staleTime: cachePolicy.shouldFetch ? 0 : STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: cachePolicy.shouldFetch,
        refetchOnWindowFocus: false,
        refetchOnReconnect: cachePolicy.shouldFetch,
        placeholderData: (prev) => prev ?? initialData,
        initialData,
        initialDataUpdatedAt: initialData !== undefined ? Date.now() : undefined,
    });
}

// ─── useTimetableEntries ──────────────────────────────────────────────────────
// Was: onSnapshot (live) + queryFn getDocs = 2 fetches on every mount
// Now: one cold/revision read with a persistent snapshot.
export function useTimetableEntries(yearId: string, termId: string, timetableId: string) {
    const { scope, revision, revisionsReady } = useTimetableRevision(yearId, termId);
    const cacheKey = timetableCacheKey(scope, 'entries', yearId, termId, timetableId);
    const cacheEntry = readTimetableCache<TimetableEntry[]>(cacheKey);
    const initialData = cacheEntry?.data;
    const cachePolicy = getRevisionCachePolicy({
        hasCachedData: initialData !== undefined,
        cachedRevision: cacheEntry?.revision,
        currentRevision: revision,
        revisionsReady,
    });

    return useQuery({
        queryKey: [
            ...timetableKeys.entries(yearId, termId, timetableId),
            scope,
            revision,
            revisionsReady ? 'ready' : 'pending',
        ],
        queryFn: () => fetchWithTimetableFallback(initialData, async () => {
            const entriesQuery = query(
                collection(db, getEntriesCollectionPath(yearId, termId, timetableId)),
            );
            const snapshot = revisionsReady
                ? await getDocsFromServer(entriesQuery)
                : await getDocs(entriesQuery);
            const entries = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                } as TimetableEntry;
            });
            writeTimetableCache(cacheKey, revisionsReady ? revision : -1, entries);
            return entries;
        }),
        enabled: !!yearId && !!termId && !!timetableId && !!scope &&
            cachePolicy.shouldFetch,
        staleTime: cachePolicy.shouldFetch ? 0 : STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: cachePolicy.shouldFetch,
        refetchOnWindowFocus: false,
        refetchOnReconnect: cachePolicy.shouldFetch,
        placeholderData: (prev) => prev ?? initialData,
        initialData,
        initialDataUpdatedAt: initialData !== undefined ? Date.now() : undefined,
    });
}

// ─── useClassTimetableEntries ─────────────────────────────────────────────────
// Was: onSnapshot (live) + queryFn getDocs = 2 fetches on every mount
// Now: select from cached full entries first; query only on a genuine cold cache.
export function useClassTimetableEntries(yearId: string, termId: string, timetableId: string, classId: string) {
    const { scope, revision, revisionsReady } = useTimetableRevision(yearId, termId);
    const cacheKey = timetableCacheKey(scope, 'class-entries', yearId, termId, `${timetableId}:${classId}`);
    const queryClient = useQueryClient();
    const cachedClassEntry = readTimetableCache<TimetableEntry[]>(cacheKey);
    const allEntriesCacheKey = timetableCacheKey(scope, 'entries', yearId, termId, timetableId);
    const memoryEntries = queryClient.getQueryData<TimetableEntry[]>([
            ...timetableKeys.entries(yearId, termId, timetableId),
            scope,
            revision,
            revisionsReady ? 'ready' : 'pending',
        ]);
    const allEntriesCache = readTimetableCache<TimetableEntry[]>(allEntriesCacheKey);
    const allEntries = memoryEntries ?? allEntriesCache?.data;
    const initialData = cachedClassEntry?.data ?? allEntries?.filter(entry => entry.classId === classId);
    const cachedRevision = cachedClassEntry?.revision ??
        (memoryEntries !== undefined ? revision : allEntriesCache?.revision);
    const cachePolicy = getRevisionCachePolicy({
        hasCachedData: initialData !== undefined,
        cachedRevision,
        currentRevision: revision,
        revisionsReady,
    });

    return useQuery({
        queryKey: [
            ...timetableKeys.classEntries(yearId, termId, timetableId, classId),
            scope,
            revision,
            revisionsReady ? 'ready' : 'pending',
        ],
        queryFn: () => fetchWithTimetableFallback(initialData, async () => {
            const classEntriesQuery = query(
                collection(db, getEntriesCollectionPath(yearId, termId, timetableId)),
                where('classId', '==', classId),
            );
            const snapshot = revisionsReady
                ? await getDocsFromServer(classEntriesQuery)
                : await getDocs(classEntriesQuery);
            const entries = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                } as TimetableEntry;
            });
            writeTimetableCache(cacheKey, revisionsReady ? revision : -1, entries);
            return entries;
        }),
        enabled: !!yearId && !!termId && !!timetableId && !!classId && !!scope &&
            cachePolicy.shouldFetch,
        staleTime: cachePolicy.shouldFetch ? 0 : STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: cachePolicy.shouldFetch,
        refetchOnWindowFocus: false,
        refetchOnReconnect: cachePolicy.shouldFetch,
        placeholderData: (prev) => prev ?? initialData,
        initialData,
        initialDataUpdatedAt: initialData !== undefined ? Date.now() : undefined,
    });
}

// ─── Mutations ────────────────────────────────────────────────────────────────
// Service mutations publish the term revision atomically. Local invalidation
// updates observers without forcing a read; the revision reconciles other
// devices when an actual timetable change occurs.

export function useCreateTimetable() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            profileData,
            generatedPeriods
        }: {
            profileData: Omit<TimetableProfile, 'id' | 'createdAt' | 'updatedAt'>,
            generatedPeriods: Omit<GeneratedPeriod, 'id'>[]
        }) => TimetableService.createTimetable(profileData, generatedPeriods),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: timetableKeys.allProfiles(variables.profileData.academicYearId, variables.profileData.termId),
                refetchType: 'none',
            });
        },
    });
}

export function useUpdateTimetable() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            yearId, termId, timetableId, profileData, generatedPeriods
        }: {
            yearId: string; termId: string; timetableId: string;
            profileData: Partial<Omit<TimetableProfile, 'id' | 'createdAt'>>;
            generatedPeriods: Omit<GeneratedPeriod, 'id'>[];
        }) => TimetableService.updateTimetable(yearId, termId, timetableId, profileData, generatedPeriods),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: timetableKeys.allProfiles(variables.yearId, variables.termId), refetchType: 'none' });
            queryClient.invalidateQueries({ queryKey: timetableKeys.periods(variables.yearId, variables.termId, variables.timetableId), refetchType: 'none' });
        },
    });
}

export function useCloneTimetable() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: {
            srcYearId: string; srcTermId: string; srcTimetableId: string;
            dstYearId: string; dstTermId: string;
            overrideName: string; includeEntries: boolean;
        }) => TimetableService.cloneTimetable(
            args.srcYearId, args.srcTermId, args.srcTimetableId,
            args.dstYearId, args.dstTermId, args.overrideName, args.includeEntries
        ),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: timetableKeys.allProfiles(variables.dstYearId, variables.dstTermId), refetchType: 'none' });
        },
    });
}

export function useSaveTimetableEntries() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            yearId,
            termId,
            timetableId,
            entries
        }: {
            yearId: string,
            termId: string,
            timetableId: string,
            entries: Partial<TimetableEntry>[]
        }) => TimetableService.saveEntriesBatch(yearId, termId, timetableId, entries),
        onSuccess: (_, variables) => {
            // Invalidate both entries and class-entries so timetable view refreshes
            queryClient.invalidateQueries({
                queryKey: timetableKeys.entries(variables.yearId, variables.termId, variables.timetableId),
                refetchType: 'none',
            });
            queryClient.invalidateQueries({
                predicate: (q) =>
                    q.queryKey[0] === 'timetable' &&
                    q.queryKey[1] === 'entries' &&
                    q.queryKey[2] === 'class',
                refetchType: 'none',
            });
        },
    });
}

export function useSetTimetableClassStreamMode() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ yearId, termId, timetableId, ...args }: {
            yearId: string;
            termId: string;
            timetableId: string;
            classId: string;
            mode: 'consolidated' | 'separate';
            scope: 'timetable' | 'day' | 'period';
            streams: import('@/types').ClassStream[];
            dayId?: number;
            periodId?: string;
            sourceEntryId?: string;
        }) => TimetableService.setClassStreamMode(yearId, termId, timetableId, args),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: timetableKeys.allProfiles(variables.yearId, variables.termId),
                refetchType: 'none',
            });
            queryClient.invalidateQueries({
                queryKey: timetableKeys.entries(variables.yearId, variables.termId, variables.timetableId),
                refetchType: 'none',
            });
            queryClient.invalidateQueries({
                predicate: (q) => q.queryKey[0] === 'timetable' && q.queryKey[1] === 'entries' && q.queryKey[2] === 'class',
                refetchType: 'none',
            });
        },
    });
}

export function useSaveTimetablePeriods() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            yearId,
            termId,
            timetableId,
            periods
        }: {
            yearId: string,
            termId: string,
            timetableId: string,
            periods: Partial<GeneratedPeriod>[]
        }) => TimetableService.savePeriodsBatch(yearId, termId, timetableId, periods),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: timetableKeys.periods(variables.yearId, variables.termId, variables.timetableId),
                refetchType: 'none',
            });
        },
    });
}

export function useDeleteTimetableEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            yearId,
            termId,
            timetableId,
            entryId
        }: {
            yearId: string,
            termId: string,
            timetableId: string,
            entryId: string
        }) => TimetableService.deleteEntry(yearId, termId, timetableId, entryId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: timetableKeys.entries(variables.yearId, variables.termId, variables.timetableId),
                refetchType: 'none',
            });
            queryClient.invalidateQueries({
                predicate: (q) =>
                    q.queryKey[0] === 'timetable' &&
                    q.queryKey[1] === 'entries' &&
                    q.queryKey[2] === 'class',
                refetchType: 'none',
            });
        },
    });
}
