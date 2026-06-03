import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SchoolSettingsService } from '../services/school-settings.service';
import type { SchoolSettings } from '@/types';
import { logFirebaseError } from '@/lib/utils/firebase-error-handler';
import { doc, onSnapshot, getDocFromCache } from 'firebase/firestore';
import { db } from '../firebase';
import { useEffect, useRef } from 'react';

export const schoolSettingsKeys = {
  all: ['schoolSettings'] as const,
  settings: () => [...schoolSettingsKeys.all, 'settings'] as const,
};

const SETTINGS_DOC_ID = 'school-settings';
const COLLECTION_NAME = 'settings';

export function useSchoolSettings(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const listenerSetupRef = useRef(false);

  useEffect(() => {
    if (options?.enabled === false || listenerSetupRef.current) return;
    listenerSetupRef.current = true;

    const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);

    getDocFromCache(docRef)
      .then((cachedSnap) => {
        if (cachedSnap.exists()) {
          const cachedSettings = { id: cachedSnap.id, ...cachedSnap.data() } as SchoolSettings;
          queryClient.setQueryData(schoolSettingsKeys.settings(), cachedSettings);
        }
      })
      .catch(() => {
        // Cache miss is fine, listener will get data from server.
      });

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const settings = { id: snapshot.id, ...snapshot.data() } as SchoolSettings;
          queryClient.setQueryData(schoolSettingsKeys.settings(), settings);
        } else {
          queryClient.setQueryData(schoolSettingsKeys.settings(), null);
        }
      },
      (error) => {
        console.error('Real-time listener error for school settings:', error);
      }
    );

    return () => {
      unsubscribe();
      listenerSetupRef.current = false;
    };
  }, [queryClient, options?.enabled]);

  return useQuery({
    queryKey: schoolSettingsKeys.settings(),
    queryFn: async () => {
      try {
        const settings = await SchoolSettingsService.getSchoolSettings();

        if (settings) {
          if (process.env.NODE_ENV === 'development') {
            console.log('School settings loaded');
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.warn('School settings returned null - document may not exist or timed out');
        }

        return settings;
      } catch (error) {
        logFirebaseError(error, 'Fetching school settings');
        throw error;
      }
    },
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 60 * 60 * 1000,
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
