import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { TimetableService, getPeriodsCollectionPath, getEntriesCollectionPath, getTimetablesCollectionPath } from '../services/timetable.service';
import type { TimetableProfile, GeneratedPeriod, TimetableEntry } from '@/types';
import { useAuth } from '@/lib/contexts/auth-context';
import { useDashboardDataRevisions } from './use-school-settings';
import { liteRead, liteWrite } from '@/lib/cache/lite-cache';
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

type TimetableCacheEntry<T> = {
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

function readTimetableCache<T>(cacheKey: string, revision: number, revisionsReady: boolean): T | undefined {
    const entry = liteRead<TimetableCacheEntry<T>>(cacheKey);
    if (!entry) return undefined;
    if (revisionsReady && entry.revision !== revision) return undefined;
    return entry.data;
}

function writeTimetableCache<T>(cacheKey: string, revision: number, data: T) {
    liteWrite(cacheKey, { revision, data } satisfies TimetableCacheEntry<T>, TIMETABLE_CACHE_TTL);
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
    const initialData = readTimetableCache<TimetableProfile[]>(cacheKey, revision, revisionsReady);

    return useQuery({
        queryKey: [...timetableKeys.allProfiles(yearId, termId), scope, revision],
        queryFn: async () => {
            const snapshot = await getDocs(
                query(collection(db, getTimetablesCollectionPath(yearId, termId)))
            );
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
            writeTimetableCache(cacheKey, revision, profilesList);
            return profilesList;
        },
        enabled: !!yearId && !!termId && !!scope &&
            (revisionsReady || initialData === undefined),
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        placeholderData: (prev) => prev,
        initialData,
        initialDataUpdatedAt: initialData ? Date.now() : undefined,
    });
}

export function useTimetableProfile(yearId: string, termId: string, timetableId: string) {
    const queryClient = useQueryClient();
    const { scope, revision, revisionsReady } = useTimetableRevision(yearId, termId);
    const cacheKey = timetableCacheKey(scope, 'profile', yearId, termId, timetableId);
    const cachedProfile = readTimetableCache<TimetableProfile | null>(cacheKey, revision, revisionsReady);
    const profilesCacheKey = timetableCacheKey(scope, 'profiles', yearId, termId);
    const cachedProfiles =
        queryClient.getQueryData<TimetableProfile[]>([
            ...timetableKeys.allProfiles(yearId, termId),
            scope,
            revision,
        ]) ?? readTimetableCache<TimetableProfile[]>(profilesCacheKey, revision, revisionsReady);
    const initialData = cachedProfile !== undefined
        ? cachedProfile
        : cachedProfiles?.find(profile => profile.id === timetableId);

    return useQuery({
        queryKey: [...timetableKeys.profile(yearId, termId, timetableId), scope, revision],
        queryFn: async () => {
            const profile = await TimetableService.getTimetableById(yearId, termId, timetableId);
            writeTimetableCache(cacheKey, revision, profile);
            return profile;
        },
        enabled: !!yearId && !!termId && !!timetableId && !!scope &&
            (revisionsReady || initialData === undefined),
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
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
    const initialData = readTimetableCache<GeneratedPeriod[]>(cacheKey, revision, revisionsReady);

    return useQuery({
        queryKey: [...timetableKeys.periods(yearId, termId, timetableId), scope, revision],
        queryFn: async () => {
            const snapshot = await getDocs(
                query(collection(db, getPeriodsCollectionPath(yearId, termId, timetableId)))
            );
            const periods = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as GeneratedPeriod[];
            writeTimetableCache(cacheKey, revision, periods);
            return periods;
        },
        enabled: !!yearId && !!termId && !!timetableId && !!scope &&
            (revisionsReady || initialData === undefined),
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        placeholderData: (prev) => prev,
        initialData,
        initialDataUpdatedAt: initialData ? Date.now() : undefined,
    });
}

// ─── useTimetableEntries ──────────────────────────────────────────────────────
// Was: onSnapshot (live) + queryFn getDocs = 2 fetches on every mount
// Now: one cold/revision read with a persistent snapshot.
export function useTimetableEntries(yearId: string, termId: string, timetableId: string) {
    const { scope, revision, revisionsReady } = useTimetableRevision(yearId, termId);
    const cacheKey = timetableCacheKey(scope, 'entries', yearId, termId, timetableId);
    const initialData = readTimetableCache<TimetableEntry[]>(cacheKey, revision, revisionsReady);

    return useQuery({
        queryKey: [...timetableKeys.entries(yearId, termId, timetableId), scope, revision],
        queryFn: async () => {
            const snapshot = await getDocs(
                query(collection(db, getEntriesCollectionPath(yearId, termId, timetableId)))
            );
            const entries = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                } as TimetableEntry;
            });
            writeTimetableCache(cacheKey, revision, entries);
            return entries;
        },
        enabled: !!yearId && !!termId && !!timetableId && !!scope &&
            (revisionsReady || initialData === undefined),
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        placeholderData: (prev) => prev,
        initialData,
        initialDataUpdatedAt: initialData ? Date.now() : undefined,
    });
}

// ─── useClassTimetableEntries ─────────────────────────────────────────────────
// Was: onSnapshot (live) + queryFn getDocs = 2 fetches on every mount
// Now: select from cached full entries first; query only on a genuine cold cache.
export function useClassTimetableEntries(yearId: string, termId: string, timetableId: string, classId: string) {
    const { scope, revision, revisionsReady } = useTimetableRevision(yearId, termId);
    const cacheKey = timetableCacheKey(scope, 'class-entries', yearId, termId, `${timetableId}:${classId}`);
    const queryClient = useQueryClient();
    const cachedClassEntries = readTimetableCache<TimetableEntry[]>(cacheKey, revision, revisionsReady);
    const allEntriesCacheKey = timetableCacheKey(scope, 'entries', yearId, termId, timetableId);
    const allEntries =
        queryClient.getQueryData<TimetableEntry[]>([
            ...timetableKeys.entries(yearId, termId, timetableId),
            scope,
            revision,
        ]) ?? readTimetableCache<TimetableEntry[]>(allEntriesCacheKey, revision, revisionsReady);
    const initialData = cachedClassEntries ?? allEntries?.filter(entry => entry.classId === classId);

    return useQuery({
        queryKey: [...timetableKeys.classEntries(yearId, termId, timetableId, classId), scope, revision],
        queryFn: async () => {
            const snapshot = await getDocs(
                query(
                    collection(db, getEntriesCollectionPath(yearId, termId, timetableId)),
                    where('classId', '==', classId)
                )
            );
            const entries = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                } as TimetableEntry;
            });
            writeTimetableCache(cacheKey, revision, entries);
            return entries;
        },
        enabled: !!yearId && !!termId && !!timetableId && !!classId && !!scope &&
            (revisionsReady || initialData === undefined),
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        placeholderData: (prev) => prev,
        initialData,
        initialDataUpdatedAt: initialData ? Date.now() : undefined,
    });
}

// ─── Mutations ────────────────────────────────────────────────────────────────
// All mutations call invalidateQueries on the relevant key, which causes the
// next read to re-fetch from Firestore — ensuring correctness after any write.

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
