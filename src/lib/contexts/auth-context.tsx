"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SystemUser, UserRole, User, ModulePermission, Permission } from '@/types';
import { UsersService } from '@/lib/services/users.service';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

interface AuthContextType {
  user: SystemUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  canAccessModule: (module: string) => boolean;
  canEdit: (module: string) => boolean;
  canDelete: (module: string) => boolean;
  getModulePermission: (module: string) => Permission | null;
  canAccessPage: (module: string, page: string) => boolean;
  canPerformAction: (module: string, page: string, action: string) => boolean;
  isLocked: boolean;
  lockAccount: () => void;
  unlockAccount: (password: string) => Promise<boolean>;
  autoLockEnabled: boolean;
  setAutoLockEnabled: (enabled: boolean) => void;
  autoLockAction: 'lock' | 'signout' | null;
  setAutoLockAction: (action: 'lock' | 'signout') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SystemUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasStoredUser, setHasStoredUser] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [autoLockAction, setAutoLockActionState] = useState<'lock' | 'signout' | null>(null);

  // Function to validate stored user token
  const validateStoredUser = (storedUserData: SystemUser): boolean => {
    try {
      // Check if user data has required fields
      if (!storedUserData.id || !storedUserData.username || !storedUserData.role) {
        return false;
      }
      
      // Check if createdAt is not too old (optional validation)
      if (storedUserData.createdAt) {
        const createdDate = new Date(storedUserData.createdAt);
        const now = new Date();
        const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24);
        
        // If user was created more than 30 days ago, still valid but could add additional checks
        if (daysDiff > 30) {
          console.log('Stored user is quite old, but still accepting:', daysDiff, 'days');
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error validating stored user:', error);
      return false;
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let firebaseInitialized = false;

    const initializeAuth = async () => {
      try {
        // First, try to restore user from localStorage immediately
        const storedUser = localStorage.getItem('trinity_user');
        const storedAutoLock = localStorage.getItem('trinity_auto_lock');
        const storedLockState = localStorage.getItem('trinity_account_locked');
        const storedAutoLockAction = localStorage.getItem('trinity_auto_lock_action');
        
        if (storedAutoLock) {
          try {
            setAutoLockEnabled(JSON.parse(storedAutoLock));
          } catch (error) {
            console.error('Error parsing auto lock setting:', error);
          }
        }
        
        if (storedLockState) {
          try {
            setIsLocked(JSON.parse(storedLockState));
          } catch (error) {
            console.error('Error parsing lock state:', error);
          }
        }
        
        if (storedAutoLockAction) {
          try {
            setAutoLockActionState(JSON.parse(storedAutoLockAction));
          } catch (error) {
            console.error('Error parsing auto lock action:', error);
          }
        }
        
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            if (validateStoredUser(parsedUser)) {
              console.log('Restored valid user from localStorage:', parsedUser.username);
              setUser(parsedUser);
              setHasStoredUser(true);
              setIsLoading(false); // Set loading to false immediately when we have a valid stored user
              
              // Custom authentication is sufficient for Firestore operations
              console.log('User restored successfully from localStorage');
            } else {
              console.log('Stored user is invalid, removing from localStorage');
              localStorage.removeItem('trinity_user');
              setHasStoredUser(false);
            }
          } catch (error) {
            console.error('Error parsing stored user:', error);
            localStorage.removeItem('trinity_user');
            setHasStoredUser(false);
          }
        } else {
          setHasStoredUser(false);
        }

        // Wait a bit for Firebase to initialize before setting up the listener
        await new Promise(resolve => setTimeout(resolve, 500));

        // Then set up Firebase auth listener
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          console.log('Firebase auth state changed:', firebaseUser?.email || 'No user', 'initialized:', firebaseInitialized);
          
          if (firebaseUser) {
            firebaseInitialized = true;
            try {
              const tokenResult = await firebaseUser.getIdTokenResult();
              const userRole = (tokenResult.claims.role || 'User') as UserRole;
              
              let dbUser: User | null = null;
              let staffData: any = null;
              
              if (firebaseUser.uid) {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                  dbUser = { id: userDocSnap.id, ...userDocSnap.data() } as User;
                  
                  // If user has staffId, try to get staff data for better name resolution
                  const userData = userDocSnap.data() as any;
                  if (userData.staffId) {
                    try {
                      const staffDocRef = doc(db, 'staff', userData.staffId);
                      const staffDocSnap = await getDoc(staffDocRef);
                      if (staffDocSnap.exists()) {
                        staffData = { id: staffDocSnap.id, ...staffDocSnap.data() };
                      }
                    } catch (error) {
                      console.log('Could not fetch staff data:', error);
                    }
                  }
                }
              }

              const systemUserData: SystemUser = {
                id: firebaseUser.uid,
                username: dbUser?.name || firebaseUser.displayName || firebaseUser.email || firebaseUser.uid,
                email: firebaseUser.email ?? undefined,
                role: userRole,
                isActive: (dbUser as any)?.isActive ?? true,
                createdAt: dbUser?.createdAt || new Date().toISOString(),
                
                staffId: (dbUser as any)?.staffId,
                firstName: (dbUser as any)?.firstName || staffData?.firstName || firebaseUser.displayName?.split(' ')[0],
                lastName: (dbUser as any)?.lastName || staffData?.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' '),
                modulePermissions: (dbUser as any)?.modulePermissions as ModulePermission[] | undefined,
                pupilId: (dbUser as any)?.pupilId,
                guardianId: (dbUser as any)?.guardianId,
                
                updatedAt: (dbUser as any)?.updatedAt || new Date().toISOString(),
              };
              
              console.log('Setting user from Firebase:', systemUserData.username);
              setUser(systemUserData);
              setHasStoredUser(true);
              localStorage.setItem('trinity_user', JSON.stringify(systemUserData));

            } catch (error) {
              console.error('AuthContext: Error processing auth state:', error);
              // Only clear user if we don't have a stored user to fall back to AND Firebase has actually initialized
              if (!hasStoredUser && firebaseInitialized) {
                setUser(null);
                localStorage.removeItem('trinity_user');
              }
            }
          } else {
            // Firebase user is null
            // Only clear the user if:
            // 1. Firebase has actually initialized (not just the initial null state)
            // 2. AND we don't have a valid stored user
            if (firebaseInitialized && !hasStoredUser) {
              console.log('No Firebase user and no stored user - logging out');
              setUser(null);
              localStorage.removeItem('trinity_user');
            } else if (!firebaseInitialized) {
              console.log('Firebase not yet initialized, keeping stored user if any');
            } else {
              console.log('No Firebase user but have stored user, keeping stored user');
            }
          }
          
          if (!isInitialized) {
            setIsLoading(false);
            setIsInitialized(true);
          }
        });

      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []); // Remove the dependency to prevent infinite loops

  // Handle auto lock on window close
  useEffect(() => {
    if (!autoLockEnabled || !autoLockAction || !user) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Perform the chosen action
      if (autoLockAction === 'lock') {
        setIsLocked(true);
        localStorage.setItem('trinity_account_locked', JSON.stringify(true));
      } else if (autoLockAction === 'signout') {
        // Clear user data
        setUser(null);
        setHasStoredUser(false);
        setIsLocked(false);
        localStorage.removeItem('trinity_user');
        localStorage.removeItem('trinity_account_locked');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [autoLockEnabled, autoLockAction, user]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const authenticatedUser = await UsersService.authenticateUser(username, password);
      
      if (authenticatedUser) {
        setUser(authenticatedUser);
        localStorage.setItem('trinity_user', JSON.stringify(authenticatedUser));
        
        // Custom authentication successful
        console.log('Successfully authenticated with custom auth system');
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setUser(null);
      localStorage.removeItem('trinity_user');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('Explicit logout - clearing all user data');
      await firebaseSignOut(auth);
      setUser(null);
      setHasStoredUser(false);
      setIsLocked(false);
      localStorage.removeItem('trinity_user');
      localStorage.removeItem('trinity_account_locked');
    } catch (error) {
      console.error('Error signing out from Firebase:', error);
      // Even if Firebase logout fails, clear local state
      setUser(null);
      setHasStoredUser(false);
      setIsLocked(false);
      localStorage.removeItem('trinity_user');
      localStorage.removeItem('trinity_account_locked');
    }
  };

  const lockAccount = () => {
    setIsLocked(true);
    localStorage.setItem('trinity_account_locked', JSON.stringify(true));
    console.log('Account locked');
  };

  const unlockAccount = async (password: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Authenticate with the provided password
      const authenticatedUser = await UsersService.authenticateUser(user.username, password);
      
      if (authenticatedUser) {
        setIsLocked(false);
        localStorage.removeItem('trinity_account_locked');
        console.log('Account unlocked successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error unlocking account:', error);
      return false;
    }
  };

  const handleSetAutoLockEnabled = (enabled: boolean) => {
    setAutoLockEnabled(enabled);
    localStorage.setItem('trinity_auto_lock', JSON.stringify(enabled));
  };

  const setAutoLockAction = (action: 'lock' | 'signout') => {
    setAutoLockActionState(action);
    localStorage.setItem('trinity_auto_lock_action', JSON.stringify(action));
  };

  const refreshUser = async () => {
    if (!user) return;
    
    try {
      console.log('Refreshing user data from database...');
      const updatedUser = await UsersService.getUserById(user.id);
      
      if (updatedUser) {
        console.log('User data refreshed successfully:', updatedUser.username);
        setUser(updatedUser);
        localStorage.setItem('trinity_user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const canAccessModule = (module: string): boolean => {
    if (!user) return false;
    return UsersService.canUserAccessModule(user, module);
  };

  const canEdit = (module: string): boolean => {
    if (!user) return false;
    return UsersService.canUserEdit(user, module);
  };

  const canDelete = (module: string): boolean => {
    if (!user) return false;
    return UsersService.canUserDelete(user, module);
  };

  const getModulePermission = (module: string): Permission | null => {
    if (!user) return null;
    return UsersService.getUserModulePermission(user, module);
  };

  const canAccessPage = (module: string, page: string): boolean => {
    if (!user) return false;
    return GranularPermissionService.canAccessPage(user, module, page);
  };

  const canPerformAction = (module: string, page: string, action: string): boolean => {
    if (!user) return false;
    return GranularPermissionService.canPerformAction(user, module, page, action);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    canAccessModule,
    canEdit,
    canDelete,
    getModulePermission,
    canAccessPage,
    canPerformAction,
    isLocked,
    lockAccount,
    unlockAccount,
    autoLockEnabled,
    setAutoLockEnabled: handleSetAutoLockEnabled,
    autoLockAction,
    setAutoLockAction,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 