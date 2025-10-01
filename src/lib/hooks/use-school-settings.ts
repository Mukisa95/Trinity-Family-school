import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SchoolSettingsService } from '../services/school-settings.service';
import type { SchoolSettings } from '@/types';
import { getFirebaseQueryConfig, logFirebaseError } from '@/lib/utils/firebase-error-handler';

// Query keys
export const schoolSettingsKeys = {
  all: ['schoolSettings'] as const,
  settings: () => [...schoolSettingsKeys.all, 'settings'] as const,
};

// Query hooks
export function useSchoolSettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: schoolSettingsKeys.settings(),
    queryFn: async () => {
      try {
        console.log('🏫 Loading school settings...');
        const settings = await SchoolSettingsService.getSchoolSettings();
        console.log('✅ School settings loaded');
        return settings;
      } catch (error) {
        logFirebaseError(error, 'Fetching school settings');
        throw error;
      }
    },
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 20 * 60 * 1000, // 20 minutes - school settings change very rarely
    gcTime: 60 * 60 * 1000, // 1 hour cache - settings are static
  });
}

// Mutation hooks
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
    mutationFn: (generalInfo: SchoolSettings['generalInfo']) => SchoolSettingsService.updateGeneralInfo(generalInfo),
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