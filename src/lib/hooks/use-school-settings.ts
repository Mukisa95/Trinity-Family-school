import { skipToken, useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { SchoolSettingsService } from '../services/school-settings.service';
import type { SchoolSettings } from '@/types';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useEffect } from 'react';

export type DashboardDataRevisions = NonNullable<SchoolSettings['dataRevisions']>;

export const schoolSettingsKeys = {
  all: ['schoolSettings'] as const,
  settings: () => [...schoolSettingsKeys.all, 'settings'] as const,
};

export const dashboardDataRevisionKeys = {
  all: ['dashboardDataRevisions'] as const,
};

const SETTINGS_DOC_ID = 'school-settings';
const COLLECTION_NAME = 'settings';

interface SettingsListenerRegistry {
  unsubscribe: () => void;
  refCount: number;
  clients: Set<QueryClient>;
  fallbackTimer?: ReturnType<typeof setTimeout>;
  retryTimer?: ReturnType<typeof setTimeout>;
  recoveryPromise?: Promise<void>;
  hasSnapshot: boolean;
}

let settingsListenerRegistry: SettingsListenerRegistry | null = null;

function publishSettings(
  clients: Set<QueryClient>,
  settings: SchoolSettings | null,
  fromCache: boolean,
) {
  const revisions = settings?.dataRevisions ?? {};

  clients.forEach(client => {
    const currentRevisions = client.getQueryData<DashboardDataRevisions>(dashboardDataRevisionKeys.all);
    // `undefined` means the revision channel is not ready. It must not be
    // treated as equal to an empty revision object: existing schools will not
    // have dataRevisions until their first cache-aware mutation, and suppressing
    // this initial `{}` publication leaves every cold cache owner disabled.
    if (currentRevisions === undefined ||
        JSON.stringify(currentRevisions) !== JSON.stringify(revisions)) {
      client.setQueryData(dashboardDataRevisionKeys.all, revisions);
    }

    const current = client.getQueryData<SchoolSettings | null>(schoolSettingsKeys.settings());
    const comparableCurrent = current
      ? { ...current, dataRevisions: undefined }
      : current;
    const comparableSettings = settings
      ? { ...settings, dataRevisions: undefined }
      : settings;
    if (!fromCache && current && settings &&
        JSON.stringify(comparableCurrent) === JSON.stringify(comparableSettings)) {
      return;
    }
    client.setQueryData(schoolSettingsKeys.settings(), settings);
  });
}

function recoverSchoolSettings(registry: SettingsListenerRegistry): Promise<void> {
  if (registry.recoveryPromise) return registry.recoveryPromise;

  registry.recoveryPromise = SchoolSettingsService.getSchoolSettings()
    .then(settings => {
      if (settingsListenerRegistry !== registry) return;
      registry.hasSnapshot = true;
      publishSettings(registry.clients, settings, false);
      performance.mark?.('trinity:settings-recovery-ready');
    })
    .catch(error => {
      console.error('School settings recovery read failed:', error);
    })
    .finally(() => {
      registry.recoveryPromise = undefined;
    });

  return registry.recoveryPromise;
}

function startSettingsListener(registry: SettingsListenerRegistry) {
  const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
  registry.unsubscribe = onSnapshot(
    docRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (settingsListenerRegistry !== registry) return;
      // An empty cache-only snapshot means "not cached", not "the settings
      // document does not exist". Keep waiting for the server/recovery read so
      // cold data caches do not reconcile against a false revision zero.
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;

      registry.hasSnapshot = true;
      if (registry.fallbackTimer) clearTimeout(registry.fallbackTimer);
      registry.fallbackTimer = undefined;

      const settings = snapshot.exists()
        ? ({ id: snapshot.id, ...snapshot.data() } as unknown as SchoolSettings)
        : null;
      publishSettings(registry.clients, settings, snapshot.metadata.fromCache);

      performance.mark?.(
        snapshot.metadata.fromCache
          ? 'trinity:settings-cache-ready'
          : 'trinity:settings-server-synced',
      );
    },
    (error) => {
      if (settingsListenerRegistry !== registry) return;
      console.error('Real-time listener error for school settings:', error);
      void recoverSchoolSettings(registry);

      // Firestore closes a listener after a terminal error. Re-establish the
      // same singleton listener with a bounded delay; never create a second one.
      if (!registry.retryTimer) {
        registry.retryTimer = setTimeout(() => {
          registry.retryTimer = undefined;
          if (settingsListenerRegistry === registry && registry.refCount > 0) {
            startSettingsListener(registry);
          }
        }, 5000);
      }
    },
  );

  if (registry.fallbackTimer) clearTimeout(registry.fallbackTimer);
  registry.fallbackTimer = setTimeout(() => {
    registry.fallbackTimer = undefined;
    if (!registry.hasSnapshot && settingsListenerRegistry === registry) {
      void recoverSchoolSettings(registry);
    }
  }, 4000);
}

function subscribeToSchoolSettings(queryClient: QueryClient) {
  if (!settingsListenerRegistry) {
    const registry: SettingsListenerRegistry = {
      unsubscribe: () => undefined,
      refCount: 0,
      clients: new Set<QueryClient>([queryClient]),
      hasSnapshot: false,
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
    settingsListenerRegistry.unsubscribe();
    if (settingsListenerRegistry.fallbackTimer) clearTimeout(settingsListenerRegistry.fallbackTimer);
    if (settingsListenerRegistry.retryTimer) clearTimeout(settingsListenerRegistry.retryTimer);
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
    // Manual refetch remains available for recovery, but ordinary hydration is
    // owned by the singleton listener and therefore issues no duplicate get().
    queryFn: () => SchoolSettingsService.getSchoolSettings(),
    enabled: false,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'status' in error) {
        const status = error.status as number;
        if (status >= 400 && status < 500) {
          return false;
        }
      }
      return failureCount < 1;
    },
    retryDelay: 500,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    placeholderData: (previousData) => previousData,
    initialData: () => {
      const cached = queryClient.getQueryData<SchoolSettings>(schoolSettingsKeys.settings());
      return cached || undefined;
    },
  });

  return {
    ...query,
    isLoading: options?.enabled !== false && query.data === undefined,
  };
}

/**
 * Reuses the singleton school-settings listener. This is an invalidation
 * signal only; consumers keep their data cache until its token changes.
 */
export function useDashboardDataRevisions() {
  const queryClient = useQueryClient();
  useSchoolSettings();

  return useQuery({
    queryKey: dashboardDataRevisionKeys.all,
    // This cache channel is populated exclusively by the singleton Firestore
    // listener above. `skipToken` makes that ownership explicit and prevents
    // TanStack Query from treating the intentionally fetchless query as an
    // invalid configuration.
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolSettingsKeys.all });
    },
  });
}

export function useInitializeSchoolSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: SchoolSettings) => SchoolSettingsService.initializeSchoolSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolSettingsKeys.all });
    },
  });
}

export function useUpdateGeneralInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (generalInfo: SchoolSettings['generalInfo']) =>
      SchoolSettingsService.updateGeneralInfo(generalInfo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolSettingsKeys.all });
    },
  });
}

export function useUpdateContactInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contact: SchoolSettings['contact']) => SchoolSettingsService.updateContactInfo(contact),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolSettingsKeys.all });
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (address: SchoolSettings['address']) => SchoolSettingsService.updateAddress(address),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolSettingsKeys.all });
    },
  });
}
