import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { collection, query as firestoreQuery, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UsersService } from '@/lib/services/users.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { SystemUser, UserRole, ModulePermission, ModulePermissions } from '@/types';

// Query keys
const USERS_QUERY_KEY = 'users';

// Get all users
export function useUsers() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // 🚀 BULLETPROOF REAL-TIME LISTENER for users
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎧 REALTIME: Setting up users listener...');
    }

    let unsubscribe: (() => void) | null = null;
    let isActive = true;
    let listenerFired = false;
    let fallbackTimeout: NodeJS.Timeout | null = null;

    const setupListener = () => {
      if (!isActive) return;

      // 🔧 FIX: Unsubscribe old listener before creating a new one
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      try {
        // Use 'system_users' collection (matches UsersService)
        const usersQuery = firestoreQuery(collection(db, 'system_users'));

        unsubscribe = onSnapshot(
          usersQuery,
          {
            includeMetadataChanges: true
          },
          (snapshot) => {
            if (!isActive) return;

            listenerFired = true;

            const users = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as SystemUser[];

            const fromCache = snapshot.metadata.fromCache;

            if (process.env.NODE_ENV === 'development') {
              console.log(`⚡ REALTIME: Loaded ${users.length} users from 'system_users' collection`, {
                fromCache,
                source: fromCache ? '📦 cache' : '☁️ server'
              });
            }

            // Always update cache, even if empty (to clear stale data)
            queryClient.setQueryData([USERS_QUERY_KEY], users);
          },
          (error) => {
            if (!isActive) return;
            console.error('❌ REALTIME USERS ERROR:', error.message);
          }
        );

        // Fallback: manual fetch if listener doesn't fire
        fallbackTimeout = setTimeout(async () => {
          if (!listenerFired && isActive) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ REALTIME: Users listener did not fire, fetching manually...');
            }

            try {
              const users = await UsersService.getAllUsers();
              queryClient.setQueryData([USERS_QUERY_KEY], users);
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ FALLBACK: Loaded ${users.length} users`);
              }
            } catch (error) {
              console.error('❌ FALLBACK: Users fetch failed:', error);
            }
          }
        }, 3000);

      } catch (error) {
        console.error('❌ REALTIME: Failed to setup users listener:', error);
      }
    };

    setupListener();

    // Cleanup
    return () => {
      isActive = false;
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (unsubscribe) unsubscribe();

      if (process.env.NODE_ENV === 'development') {
        console.log('🔌 REALTIME: Cleaned up users listener');
      }
    };
  }, [queryClient]);

  return useQuery({
    queryKey: [USERS_QUERY_KEY],
    queryFn: async () => {
      // Check cache first
      const cachedData = queryClient.getQueryData<SystemUser[]>([USERS_QUERY_KEY]);
      if (cachedData && cachedData.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ useUsers: Using ${cachedData.length} users from cache`);
        }
        return cachedData;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useUsers: No cache, fetching from server...');
      }
      return UsersService.getAllUsers();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    initialData: () => {
      const cached = queryClient.getQueryData<SystemUser[]>([USERS_QUERY_KEY]);
      return cached || undefined;
    },
    // For notification recipient picker, show all users including admins
    // Admin hiding should be done at the UI level if needed
    select: (allUsers: SystemUser[]) => {
      // Return all users for notifications and recipient selection
      return allUsers;
    }
  });
}

// Get users by role
export function useUsersByRole(role: UserRole) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'role', role],
    queryFn: () => UsersService.getUsersByRole(role),
  });
}

// Get user by username
export function useUserByUsername(username: string) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'username', username],
    queryFn: () => UsersService.getUserByUsername(username),
    enabled: !!username,
  });
}

// Create user mutation
export function useCreateUser() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (userData: Omit<SystemUser, 'id' | 'createdAt'> & { password?: string }) => {
      const userId = await UsersService.createUser(userData);

      // Create digital signature for user creation
      if (user) {
        await signAction(
          'user_creation',
          userId,
          'created',
          {
            createdUserRole: userData.role,
            createdUsername: userData.username,
            createdUserEmail: userData.email,
            modulePermissions: userData.modulePermissions?.length || 0,
            isActive: userData.isActive
          }
        );
      }

      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
}

// Update user mutation
export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<SystemUser> & { password?: string } }) => {
      await UsersService.updateUser(userId, updates);

      // Create digital signature for user modification
      if (user) {
        await signAction(
          'user_modification',
          userId,
          'modified',
          {
            updatedFields: Object.keys(updates),
            passwordChanged: !!updates.password,
            activeStatusChanged: updates.isActive !== undefined,
            permissionsChanged: !!updates.modulePermissions
          }
        );
      }

      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
}

// Delete user mutation
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => UsersService.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
}

// Create parent account mutation
export function useCreateParentAccount() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      pupilId,
      pupilName,
      admissionNumber,
      guardianId
    }: {
      pupilId: string;
      pupilName: string;
      admissionNumber: string;
      guardianId?: string;
    }) => {
      const userId = await UsersService.createParentAccount(pupilId, pupilName, admissionNumber, guardianId);

      // Create digital signature for parent account creation
      if (user) {
        await signAction(
          'user_creation',
          userId,
          'created',
          {
            createdUserRole: 'Parent',
            pupilId,
            pupilName,
            admissionNumber,
            accountType: 'parent'
          }
        );
      }

      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
}

// Create staff account mutation
export function useCreateStaffAccount() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      staffId,
      username,
      firstName,
      lastName,
      email,
      modulePermissions,
      granularPermissions,
      password
    }: {
      staffId: string;
      username: string;
      firstName: string;
      lastName: string;
      email: string;
      modulePermissions: ModulePermission[];
      granularPermissions?: ModulePermissions[];
      password: string;
    }) => {
      const userId = await UsersService.createStaffAccount(
        staffId,
        username,
        firstName,
        lastName,
        email,
        modulePermissions,
        password,
        granularPermissions
      );

      // Create digital signature for staff account creation
      if (user) {
        await signAction(
          'user_creation',
          userId,
          'created',
          {
            createdUserRole: 'Staff',
            staffId,
            username,
            firstName,
            lastName,
            email,
            modulePermissions: modulePermissions.length,
            accountType: 'staff'
          }
        );
      }

      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
}

// Create bulk parent accounts mutation
export function useCreateBulkParentAccounts() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      pupilIds,
      guardianId
    }: {
      pupilIds: string[];
      guardianId?: string;
    }) => {
      const results = await UsersService.createBulkParentAccounts(pupilIds, guardianId);

      // Create digital signatures for bulk parent account creation
      if (user) {
        for (const result of results.success) {
          await signAction(
            'user_creation',
            result.userId,
            'created',
            {
              createdUserRole: 'Parent',
              pupilId: result.pupilId,
              pupilName: result.pupilName,
              admissionNumber: result.admissionNumber,
              accountType: 'parent',
              bulkOperation: true
            }
          );
        }
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
} 