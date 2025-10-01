import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersService } from '@/lib/services/users.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { SystemUser, UserRole, ModulePermission, ModulePermissions } from '@/types';

// Query keys
const USERS_QUERY_KEY = 'users';

// Get all users
export function useUsers() {
  return useQuery({
    queryKey: [USERS_QUERY_KEY],
    queryFn: UsersService.getAllUsers,
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