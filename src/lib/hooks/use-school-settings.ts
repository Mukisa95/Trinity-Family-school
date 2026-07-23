import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { SchoolSettingsService } from '../services/school-settings.service';
import type { SchoolSettings } from '@/types';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useEffect } from 'react';

export const schoolSettingsKeys = {
  all: ['schoolSettings'] as const,
  settings: () => [...schoolSettingsKeys.all, 'settings'] as const,
};

const SETTINGS_DOC_ID = 'school-settings';
const COLLECTION_NAME = 'settings';

interface SettingsListenerRegistry {
  unsubscribe: () => void;
  refCount: number;
  clients: Set<QueryClient>;
}

let settingsListenerRegistry: SettingsListenerRegistry | null = null;

function subscribeToSchoolSettings(queryClient: QueryClient) {
  if (!settingsListenerRegistry) {
    const clients = new Set<QueryClient>([queryClient]);
    const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);

    const unsubscribe = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const settings = snapshot.exists()
          ? ({ id: snapshot.id, ...snapshot.data() } as unknown as SchoolSettings)
          : null;

        clients.forEach(client => {
          const current = client.getQueryData<SchoolSettings | null>(schoolSettingsKeys.settings());
          // A server metadata confirmation with identical data must not cause a
          // new object and a layout-wide rerender.
          if (!snapshot.metadata.fromCache && current && settings &&
              JSON.stringify(current) === JSON.stringify(settings)) {
            return;
          }
          client.setQueryData(schoolSettingsKeys.settings(), settings);
        });

        performance.mark?.(
          snapshot.metadata.fromCache
            ? 'trinity:settings-cache-ready'
            : 'trinity:settings-server-synced',
        );
      },
      (error) => {
        console.error('Real-time listener error for school settings:', error);
      },
    );

    settingsListenerRegistry = {
      unsubscribe,
      refCount: 0,
      clients,
    };
  } else {
    settingsListenerRegistry.clients.add(queryClient);
  }

  settingsListenerRegistry.refCount += 1;

  return () => {
    if (!settingsListenerRegistry) return;
    settingsListenerRegistry.refCount -= 1;
    if (settingsListenerRegistry.refCount > 0) return;
    settingsListenerRegistry.unsubscribe();
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
