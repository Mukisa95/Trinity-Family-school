import { skipToken, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';
import type { SchoolSettings } from '@/types';
import { db } from '@/lib/firebase';
import {
  readSchoolSettingsCache,
  writeSchoolSettingsCache,
  type SchoolSettingsCacheSnapshot,
} from '@/lib/cache/school-settings-cache';
import { SchoolSettingsService } from '../services/school-settings.service';
import {
  dashboardRevisionDocumentIds,
  dashboardRevisionDocumentRef,
  schoolSettingsDocumentRef,
  schoolSettingsMetaDocumentRef,
  type DashboardRevisionDocumentKind,
} from '@/lib/services/dashboard-revision-documents';
import { DOMAIN_REVISION_KEYS } from '@/lib/cache/domain-revisions';

export type DashboardDataRevisions = NonNullable<SchoolSettings['dataRevisions']>;

export const schoolSettingsKeys = {
  all: ['schoolSettings'] as const,
  settings: () => [...schoolSettingsKeys.all, 'settings'] as const,
};

export const dashboardDataRevisionKeys = {
  all: ['dashboardDataRevisions'] as const,
};

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function profileOnly(settings: SchoolSettings): SchoolSettings {
  const { dataRevisions: _legacyRevisions, ...profile } = settings;
  return profile as SchoolSettings;
}

function publishSettings(clients: Set<QueryClient>, settings: SchoolSettings | null) {
  clients.forEach(client => {
    const current = client.getQueryData<SchoolSettings | null>(schoolSettingsKeys.settings());
    if (!sameValue(current, settings)) {
      client.setQueryData(schoolSettingsKeys.settings(), settings);
    }
  });
}

interface SettingsListenerRegistry {
  unsubscribeMeta: () => void;
  unsubscribeLegacy?: () => void;
  refCount: number;
  clients: Set<QueryClient>;
  fallbackTimer?: ReturnType<typeof setTimeout>;
  recoveryPromise?: Promise<void>;
  persisted?: SchoolSettingsCacheSnapshot | null;
}

let settingsListenerRegistry: SettingsListenerRegistry | null = null;

async function restorePersistedSettings(registry: SettingsListenerRegistry) {
  const persisted = await readSchoolSettingsCache();
  if (settingsListenerRegistry !== registry) return;
  registry.persisted = persisted;
  if (persisted) {
    publishSettings(registry.clients, persisted.data);
    performance.mark?.('trinity:settings-persistent-cache-ready');
  }
}

function reconcileSettingsRevision(registry: SettingsListenerRegistry, revision: number) {
  if (registry.recoveryPromise) return registry.recoveryPromise;

  registry.recoveryPromise = (async () => {
    const persisted = registry.persisted ?? await readSchoolSettingsCache();
    if (settingsListenerRegistry !== registry) return;
    registry.persisted = persisted;

    if (persisted?.revision === revision) {
      publishSettings(registry.clients, persisted.data);
      return;
    }

    const settings = await SchoolSettingsService.getSchoolSettingsFromServer();
    if (settingsListenerRegistry !== registry) return;
    if (settings) {
      const profile = profileOnly(settings);
      await writeSchoolSettingsCache(revision, profile);
      registry.persisted = { schema: 1, revision, data: profile };
      publishSettings(registry.clients, profile);
      performance.mark?.('trinity:settings-server-synced');
    } else {
      publishSettings(registry.clients, null);
    }
  })().catch(error => {
    console.error('School settings cache reconciliation failed:', error);
  }).finally(() => {
    registry.recoveryPromise = undefined;
  });

  return registry.recoveryPromise;
}

function startLegacySettingsFallback(registry: SettingsListenerRegistry) {
  if (registry.unsubscribeLegacy) return;

  registry.unsubscribeLegacy = onSnapshot(
    schoolSettingsDocumentRef(),
    { includeMetadataChanges: true },
    snapshot => {
      if (settingsListenerRegistry !== registry) return;
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      const settings = snapshot.exists()
        ? profileOnly({ id: snapshot.id, ...snapshot.data() } as unknown as SchoolSettings)
        : null;
      publishSettings(registry.clients, settings);
      if (settings) {
        // Migration fallback only. The first meta-document snapshot will
        // replace this with an exact versioned cache entry.
        void writeSchoolSettingsCache(0, settings);
        registry.persisted = { schema: 1, revision: 0, data: settings };
      }
    },
    error => console.error('Legacy school-settings listener failed:', error),
  );
}

function startSettingsListener(registry: SettingsListenerRegistry) {
  void restorePersistedSettings(registry);

  registry.unsubscribeMeta = onSnapshot(
    schoolSettingsMetaDocumentRef(),
    { includeMetadataChanges: true },
    snapshot => {
      if (settingsListenerRegistry !== registry) return;
      if (snapshot.exists()) {
        registry.unsubscribeLegacy?.();
        registry.unsubscribeLegacy = undefined;
        void reconcileSettingsRevision(registry, Number(snapshot.data()?.revision || 0));
        return;
      }

      // Until the migration creates the tiny meta document, retain the old
      // profile listener so the application remains compatible and usable.
      if (!snapshot.metadata.fromCache) startLegacySettingsFallback(registry);
    },
    error => {
      console.error('School settings meta listener failed:', error);
      startLegacySettingsFallback(registry);
    },
  );

  registry.fallbackTimer = setTimeout(() => {
    if (settingsListenerRegistry !== registry) return;
    if (!registry.persisted) {
      void SchoolSettingsService.getSchoolSettings().then(settings => {
        if (settingsListenerRegistry === registry && settings) {
          publishSettings(registry.clients, settings);
        }
      }).catch(error => console.error('School settings recovery read failed:', error));
    }
  }, 4000);
}

function subscribeToSchoolSettings(queryClient: QueryClient) {
  if (!settingsListenerRegistry) {
    const registry: SettingsListenerRegistry = {
      unsubscribeMeta: () => undefined,
      refCount: 0,
      clients: new Set([queryClient]),
    };
    settingsListenerRegistry = registry;
    startSettingsListener(registry);
  } else {
    settingsListenerRegistry.clients.add(queryClient);
  }

  settingsListenerRegistry.refCount += 1;
  return () => {
    if (!settingsListenerRegistry) return;
    settingsListenerRegistry.refCount -= 1;
    if (settingsListenerRegistry.refCount > 0) return;
    settingsListenerRegistry.unsubscribeMeta();
    settingsListenerRegistry.unsubscribeLegacy?.();
    if (settingsListenerRegistry.fallbackTimer) clearTimeout(settingsListenerRegistry.fallbackTimer);
    settingsListenerRegistry = null;
  };
}

export function useSchoolSettings(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (options?.enabled === false) return;
    return subscribeToSchoolSettings(queryClient);
  }, [queryClient, options?.enabled]);

  const query = useQuery({
    queryKey: schoolSettingsKeys.settings(),
    queryFn: () => SchoolSettingsService.getSchoolSettings(),
    enabled: false,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    placeholderData: previousData => previousData,
    initialData: () => queryClient.getQueryData<SchoolSettings>(schoolSettingsKeys.settings()),
  });

  return {
    ...query,
    isLoading: options?.enabled !== false && query.data === undefined,
  };
}

type ModernRevisionSnapshots = Partial<Record<DashboardRevisionDocumentKind, Record<string, unknown>>>;

function maxRevision(...values: unknown[]): number | undefined {
  const finite = values
    .map(value => Number(value))
    .filter(value => Number.isFinite(value));
  return finite.length ? Math.max(...finite) : undefined;
}

function mergeRevisionMap(
  left: Record<string, number> | undefined,
  right: Record<string, number> | undefined,
): Record<string, number> | undefined {
  const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
  if (!keys.size) return undefined;
  return Object.fromEntries(Array.from(keys).map(key => [
    key,
    maxRevision(left?.[key], right?.[key]) || 0,
  ]));
}

function mergeDashboardRevisions(
  modern: ModernRevisionSnapshots,
  legacy: DashboardDataRevisions | undefined,
): DashboardDataRevisions {
  const reference = modern.reference || {};
  const operational = modern.operational || {};
  const timetable = modern.timetable || {};
  const examResults = modern.examResults || {};
  const result: DashboardDataRevisions = {};

  (['classes', 'academicYears', 'staff', 'subjects', 'houses', 'accessLevels', 'exams'] as const).forEach(key => {
    const value = maxRevision(reference[key], legacy?.[key]);
    if (value !== undefined) result[key] = value;
  });
  (['pupils', 'attendance', 'events'] as const).forEach(key => {
    const value = maxRevision(operational[key], legacy?.[key]);
    if (value !== undefined) result[key] = value;
  });
  DOMAIN_REVISION_KEYS.forEach(key => {
    const value = maxRevision(operational[key], legacy?.[key]);
    if (value !== undefined) result[key] = value;
  });
  const timetableRevisions = mergeRevisionMap(
    timetable.timetable as Record<string, number> | undefined,
    legacy?.timetable,
  );
  if (timetableRevisions) result.timetable = timetableRevisions;
  const examResultRevisions = mergeRevisionMap(
    examResults.examResults as Record<string, number> | undefined,
    legacy?.examResults,
  );
  if (examResultRevisions) result.examResults = examResultRevisions;
  return result;
}

interface RevisionListenerRegistry {
  refCount: number;
  clients: Set<QueryClient>;
  modern: ModernRevisionSnapshots;
  legacy?: DashboardDataRevisions;
  unsubscribers: Array<() => void>;
  unsubscribeLegacy?: () => void;
}

let revisionListenerRegistry: RevisionListenerRegistry | null = null;

function publishDashboardRevisions(registry: RevisionListenerRegistry) {
  const revisions = mergeDashboardRevisions(registry.modern, registry.legacy);
  registry.clients.forEach(client => {
    const current = client.getQueryData<DashboardDataRevisions>(dashboardDataRevisionKeys.all);
    if (!sameValue(current, revisions)) {
      client.setQueryData(dashboardDataRevisionKeys.all, revisions);
    }
  });
}

function startLegacyDashboardRevisionListener(registry: RevisionListenerRegistry) {
  if (registry.unsubscribeLegacy) return;
  registry.unsubscribeLegacy = onSnapshot(
    schoolSettingsDocumentRef(),
    { includeMetadataChanges: true },
    snapshot => {
      if (revisionListenerRegistry !== registry) return;
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      registry.legacy = snapshot.exists()
        ? ((snapshot.data()?.dataRevisions || {}) as DashboardDataRevisions)
        : {};
      publishDashboardRevisions(registry);
    },
    error => console.error('Legacy dashboard revision listener failed:', error),
  );
}

function stopLegacyDashboardRevisionListener(registry: RevisionListenerRegistry) {
  registry.unsubscribeLegacy?.();
  registry.unsubscribeLegacy = undefined;
  registry.legacy = undefined;
  publishDashboardRevisions(registry);
}

function startDashboardRevisionListeners(registry: RevisionListenerRegistry) {
  (Object.keys(dashboardRevisionDocumentIds) as DashboardRevisionDocumentKind[]).forEach(kind => {
    registry.unsubscribers.push(onSnapshot(
      dashboardRevisionDocumentRef(kind),
      { includeMetadataChanges: true },
      snapshot => {
        if (revisionListenerRegistry !== registry) return;
        if (!snapshot.exists() && snapshot.metadata.fromCache) return;
        registry.modern[kind] = snapshot.exists() ? snapshot.data() : {};
        if (kind === 'reference' && snapshot.exists()) {
          // The migration explicitly starts with this bridge enabled. After
          // old browser bundles have aged out, flipping this tiny field to
          // false removes the old 794 KB listener without another code deploy.
          if (snapshot.data()?.legacyCompatibility === false) {
            stopLegacyDashboardRevisionListener(registry);
          } else {
            startLegacyDashboardRevisionListener(registry);
          }
        }
        publishDashboardRevisions(registry);
      },
      error => console.error(`Dashboard ${kind} revision listener failed:`, error),
    ));
  });

  // Temporary migration bridge. It lets a refreshed browser see mutations from
  // an older open browser. The follow-up release removes this large legacy
  // listener after all active clients have moved to the new writers.
  startLegacyDashboardRevisionListener(registry);
}

function subscribeToDashboardRevisions(queryClient: QueryClient) {
  if (!revisionListenerRegistry) {
    const registry: RevisionListenerRegistry = {
      refCount: 0,
      clients: new Set([queryClient]),
      modern: {},
      unsubscribers: [],
    };
    revisionListenerRegistry = registry;
    startDashboardRevisionListeners(registry);
  } else {
    revisionListenerRegistry.clients.add(queryClient);
  }

  revisionListenerRegistry.refCount += 1;
  return () => {
    if (!revisionListenerRegistry) return;
    revisionListenerRegistry.refCount -= 1;
    if (revisionListenerRegistry.refCount > 0) return;
    revisionListenerRegistry.unsubscribers.forEach(unsubscribe => unsubscribe());
    revisionListenerRegistry.unsubscribeLegacy?.();
    revisionListenerRegistry = null;
  };
}

/** A tiny, separate invalidation channel for cache-owned data collections. */
export function useDashboardDataRevisions() {
  const queryClient = useQueryClient();
  useEffect(() => subscribeToDashboardRevisions(queryClient), [queryClient]);

  return useQuery({
    queryKey: dashboardDataRevisionKeys.all,
    queryFn: skipToken,
    enabled: false,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    initialData: () => queryClient.getQueryData<DashboardDataRevisions>(dashboardDataRevisionKeys.all),
  });
}

export function useUpdateSchoolSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: SchoolSettings) => SchoolSettingsService.updateSchoolSettings(settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schoolSettingsKeys.all, refetchType: 'none' }),
  });
}

export function useInitializeSchoolSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: SchoolSettings) => SchoolSettingsService.initializeSchoolSettings(settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schoolSettingsKeys.all, refetchType: 'none' }),
  });
}

export function useUpdateGeneralInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (generalInfo: SchoolSettings['generalInfo']) => SchoolSettingsService.updateGeneralInfo(generalInfo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schoolSettingsKeys.all, refetchType: 'none' }),
  });
}

export function useUpdateContactInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contact: SchoolSettings['contact']) => SchoolSettingsService.updateContactInfo(contact),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schoolSettingsKeys.all, refetchType: 'none' }),
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (address: SchoolSettings['address']) => SchoolSettingsService.updateAddress(address),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schoolSettingsKeys.all, refetchType: 'none' }),
  });
}
