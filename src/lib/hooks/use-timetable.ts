import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { TimetableService, getPeriodsCollectionPath, getEntriesCollectionPath, getTimetablesCollectionPath } from '../services/timetable.service';
import type { TimetableProfile, GeneratedPeriod, TimetableEntry } from '@/types';

// Keys for caching
export const timetableKeys = {
    allProfiles: (yearId: string, termId: string) => ['timetables', 'all', yearId, termId] as const,
    profile: (yearId: string, termId: string, timetableId: string) => ['timetable', 'profile', yearId, termId, timetableId] as const,
    periods: (yearId: string, termId: string, timetableId: string) => ['timetable', 'periods', yearId, termId, timetableId] as const,
    entries: (yearId: string, termId: string, timetableId: string) => ['timetable', 'entries', yearId, termId, timetableId] as const,
    classEntries: (yearId: string, termId: string, timetableId: string, classId: string) => ['timetable', 'entries', 'class', yearId, termId, timetableId, classId] as const,
};

// ─── Timetable cache TTL ──────────────────────────────────────────────────────
// Timetables are set once per term and virtually never change during a school day.
// 30 minutes of stale time means the timetable page always loads instantly from
// cache and Firestore is only hit once per half-hour at most.
const STALE_TIME = 30 * 60 * 1000; // 30 minutes
const GC_TIME   = 60 * 60 * 1000; // 60 minutes (keep in cache even when unmounted)

// ─── useTimetableProfiles ─────────────────────────────────────────────────────
// Was: onSnapshot (live) + queryFn getDocs = 2 fetches on every mount
// Now: getDocs once, cached 30 min. Mutations invalidate automatically.
export function useTimetableProfiles(yearId: string, termId: string) {
    return useQuery({
        queryKey: timetableKeys.allProfiles(yearId, termId),
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
            return profilesList;
        },
        enabled: !!yearId && !!termId,
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        placeholderData: (prev) => prev,
    });
}

export function useTimetableProfile(yearId: string, termId: string, timetableId: string) {
    return useQuery({
        queryKey: timetableKeys.profile(yearId, termId, timetableId),
        queryFn: () => TimetableService.getTimetableById(yearId, termId, timetableId),
        enabled: !!yearId && !!termId && !!timetableId,
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
}

// ─── useTimetablePeriods ──────────────────────────────────────────────────────
// Was: onSnapshot (live) + queryFn getDocs = 2 fetches on every mount
// Now: getDocs once, cached 30 min.
export function useTimetablePeriods(yearId: string, termId: string, timetableId: string) {
    return useQuery({
        queryKey: timetableKeys.periods(yearId, termId, timetableId),
        queryFn: async () => {
            const snapshot = await getDocs(
                query(collection(db, getPeriodsCollectionPath(yearId, termId, timetableId)))
            );
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as GeneratedPeriod[];
        },
        enabled: !!yearId && !!termId && !!timetableId,
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        placeholderData: (prev) => prev,
    });
}

// ─── useTimetableEntries ──────────────────────────────────────────────────────
// Was: onSnapshot (live) + queryFn getDocs = 2 fetches on every mount
// Now: getDocs once, cached 30 min.
export function useTimetableEntries(yearId: string, termId: string, timetableId: string) {
    return useQuery({
        queryKey: timetableKeys.entries(yearId, termId, timetableId),
        queryFn: async () => {
            const snapshot = await getDocs(
                query(collection(db, getEntriesCollectionPath(yearId, termId, timetableId)))
            );
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                } as TimetableEntry;
            });
        },
        enabled: !!yearId && !!termId && !!timetableId,
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        placeholderData: (prev) => prev,
    });
}

// ─── useClassTimetableEntries ─────────────────────────────────────────────────
// Was: onSnapshot (live) + queryFn getDocs = 2 fetches on every mount
// Now: getDocs once filtered by classId, cached 30 min.
export function useClassTimetableEntries(yearId: string, termId: string, timetableId: string, classId: string) {
    return useQuery({
        queryKey: timetableKeys.classEntries(yearId, termId, timetableId, classId),
        queryFn: async () => {
            const snapshot = await getDocs(
                query(
                    collection(db, getEntriesCollectionPath(yearId, termId, timetableId)),
                    where('classId', '==', classId)
                )
            );
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                } as TimetableEntry;
            });
        },
        enabled: !!yearId && !!termId && !!timetableId && !!classId,
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        placeholderData: (prev) => prev,
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
            queryClient.invalidateQueries({ queryKey: timetableKeys.allProfiles(variables.yearId, variables.termId) });
            queryClient.invalidateQueries({ queryKey: timetableKeys.periods(variables.yearId, variables.termId, variables.timetableId) });
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
            queryClient.invalidateQueries({ queryKey: timetableKeys.allProfiles(variables.dstYearId, variables.dstTermId) });
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
            });
            queryClient.invalidateQueries({
                predicate: (q) =>
                    q.queryKey[0] === 'timetable' &&
                    q.queryKey[1] === 'entries' &&
                    q.queryKey[2] === 'class',
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
            });
            queryClient.invalidateQueries({
                predicate: (q) =>
                    q.queryKey[0] === 'timetable' &&
                    q.queryKey[1] === 'entries' &&
                    q.queryKey[2] === 'class',
            });
        },
    });
}
