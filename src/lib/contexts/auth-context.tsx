"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SystemUser, UserRole, User, ModulePermission, Permission } from '@/types';
import { UsersService } from '@/lib/services/users.service';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { liteClearAll } from '@/lib/cache/lite-cache';
import { logger } from '@/lib/utils/logger';

const AUTH_CACHE_KEY = 'trinity_user';
// How often to silently re-check permissions from the DB (not a logout timer).
// The session itself never expires due to time — only permission/role changes invalidate it.
const AUTH_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 min background sync

type SessionStatus = 'checking' | 'fresh' | 'stale';

type StoredAuthCache = {
  user: SystemUser;
  cachedAt: number;
};

interface AuthContextType {
  user: SystemUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isSessionStale: boolean;
  sessionStatus: SessionStatus;
  sessionMessage: string | null;
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
  autoLockAction: 'lock-on-close' | 'lock-on-leave' | 'signout' | null;
  setAutoLockAction: (action: 'lock-on-close' | 'lock-on-leave' | 'signout') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SystemUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasStoredUser, setHasStoredUser] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [autoLockAction, setAutoLockActionState] = useState<'lock-on-close' | 'lock-on-leave' | 'signout' | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('checking');
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [lastPermissionRefreshAt, setLastPermissionRefreshAt] = useState<number>(0);

  const saveUserCache = (userData: SystemUser) => {
    if (typeof window === 'undefined') return;
    const payload: StoredAuthCache = { user: userData, cachedAt: Date.now() };
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
  };

  const clearUserCache = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AUTH_CACHE_KEY);
  };

  const readUserCache = (): { user: SystemUser; ageMs: number; isLegacy: boolean } | null => {
    if (typeof window === 'undefined') return null;
    const storedUser = localStorage.getItem(AUTH_CACHE_KEY);
    if (!storedUser) return null;

    const parsed = JSON.parse(storedUser);
    if (parsed?.user && typeof parsed.cachedAt === 'number') {
      return { user: parsed.user, ageMs: Date.now() - parsed.cachedAt, isLegacy: false };
    }

    return { user: parsed, ageMs: AUTH_CACHE_MAX_AGE_MS, isLegacy: true };
  };

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
          logger.debug('Stored user is older than 30 days', { daysDiff });
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error validating stored user', error);
      return false;
    }
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let firebaseInitialized = false;

    const initializeAuth = async () => {
      try {
        // First, try to restore user from localStorage immediately
        const storedAutoLock = localStorage.getItem('trinity_auto_lock');
        const storedLockState = localStorage.getItem('trinity_account_locked');
        const storedAutoLockAction = localStorage.getItem('trinity_auto_lock_action');
        
        if (storedAutoLock) {
          try {
            setAutoLockEnabled(JSON.parse(storedAutoLock));
          } catch (error) {
            logger.warn('Error parsing auto lock setting', error);
          }
        }
        
        if (storedLockState) {
          try {
            setIsLocked(JSON.parse(storedLockState));
          } catch (error) {
            logger.warn('Error parsing lock state', error);
          }
        }
        
        if (storedAutoLockAction) {
          try {
            const parsedAction = JSON.parse(storedAutoLockAction);
            // Migrate old 'lock' value to 'lock-on-close' for backward compatibility
            if (parsedAction === 'lock') {
              setAutoLockActionState('lock-on-close');
              localStorage.setItem('trinity_auto_lock_action', JSON.stringify('lock-on-close'));
            } else {
              setAutoLockActionState(parsedAction);
            }
          } catch (error) {
            logger.warn('Error parsing auto lock action', error);
          }
        }
        
        const storedCache = readUserCache();
        if (storedCache) {
          try {
            if (validateStoredUser(storedCache.user)) {
              // Always restore the cached session immediately — no time-based expiry.
              // We only invalidate if DB says the account is gone or permissions changed.
              logger.debug('Restored user from local cache', {
                username: storedCache.user.username,
                ageMinutes: Math.round(storedCache.ageMs / 60000),
                legacyCache: storedCache.isLegacy,
              });
              setUser(storedCache.user);
              setHasStoredUser(true);
              setSessionStatus('fresh');  // Trust the cache until DB says otherwise
              setSessionMessage(null);
              setIsLoading(false);

              // Background check: only invalidate if something actually changed
              UsersService.getUserById(storedCache.user.id)
                .then((freshUser) => {
                  if (!freshUser || freshUser.isActive === false) {
                    // Account deactivated or deleted — this specific user must sign in again
                    logger.info('Account deactivated or removed — clearing session', { id: storedCache.user.id });
                    setUser(null);
                    setHasStoredUser(false);
                    clearUserCache();
                    setSessionStatus('stale');
                    setSessionMessage('Your account has been deactivated. Please contact the administrator.');
                    return;
                  }

                  // Check whether role or permissions changed
                  const cachedUser = storedCache.user;
                  const roleChanged = freshUser.role !== cachedUser.role;
                  const cachedPerms = JSON.stringify(cachedUser.modulePermissions ?? []);
                  const freshPerms = JSON.stringify(freshUser.modulePermissions ?? []);
                  const permsChanged = cachedPerms !== freshPerms;

                  if (roleChanged || permsChanged) {
                    logger.info('Permissions/role changed — updating session silently', {
                      id: freshUser.id,
                      roleChanged,
                      permsChanged,
                    });
                  }

                  // Always update with the freshest data (name, avatar, etc.) but never log out
                  setUser(freshUser);
                  setHasStoredUser(true);
                  saveUserCache(freshUser);
                  setLastPermissionRefreshAt(Date.now());
                  setSessionStatus('fresh');
                  setSessionMessage(null);
                })
                .catch((error) => {
                  // Network error — keep the cached session alive, just mark it as potentially stale
                  logger.warn('Could not verify session from DB during startup — using cache', error);
                  setLastPermissionRefreshAt(Date.now());
                  setSessionStatus('fresh');  // Don't show a scary warning; the user is still logged in
                  setSessionMessage(null);
                });
            } else {
              logger.info('Stored user cache is invalid, removing it');
              clearUserCache();
              setHasStoredUser(false);
            }
          } catch (error) {
            logger.warn('Error parsing stored user cache', error);
            clearUserCache();
            setHasStoredUser(false);
          }
        } else {
          setHasStoredUser(false);
        }

        // Wait a bit for Firebase to initialize before setting up the listener
        await new Promise(resolve => setTimeout(resolve, 500));

        // Then set up Firebase auth listener
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          logger.debug('Firebase auth state changed', { email: firebaseUser?.email || 'No user', initialized: firebaseInitialized });
          
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
                      logger.debug('Could not fetch staff data', error);
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
              
              logger.debug('Setting user from Firebase', { username: systemUserData.username });
              setUser(systemUserData);
              setHasStoredUser(true);
              saveUserCache(systemUserData);
              setLastPermissionRefreshAt(Date.now());
              setSessionStatus('fresh');
              setSessionMessage(null);

            } catch (error) {
              logger.error('AuthContext: Error processing auth state', error);
              // Only clear user if we don't have a stored user to fall back to AND Firebase has actually initialized
              if (!hasStoredUser && firebaseInitialized) {
                setUser(null);
                clearUserCache();
              }
            }
          } else {
            // Firebase user is null
            // Only clear the user if:
            // 1. Firebase has actually initialized (not just the initial null state)
            // 2. AND we don't have a valid stored user
            if (firebaseInitialized && !hasStoredUser) {
              logger.debug('No Firebase user and no stored user - logging out');
              setUser(null);
              clearUserCache();
            } else if (!firebaseInitialized) {
              logger.debug('Firebase not yet initialized, keeping stored user if any');
            } else {
              logger.debug('No Firebase user but have stored user, keeping stored user');
            }
          }
          
          if (!isInitialized) {
            setIsLoading(false);
            setIsInitialized(true);
          }
        });

      } catch (error) {
        logger.error('Error initializing auth', error);
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

  // Handle auto lock on window close and visibility change
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }
    
    if (!autoLockEnabled || !autoLockAction || !user) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Perform the chosen action on window close
      if (autoLockAction === 'lock-on-close' || autoLockAction === 'lock-on-leave') {
        setIsLocked(true);
        localStorage.setItem('trinity_account_locked', JSON.stringify(true));
      } else if (autoLockAction === 'signout') {
        // Clear user data
        setUser(null);
        setHasStoredUser(false);
        setIsLocked(false);
        clearUserCache();
        localStorage.removeItem('trinity_account_locked');
      }
    };

    const handleVisibilityChange = () => {
      // Only lock on leave if the action is 'lock-on-leave' and page becomes hidden
      if (autoLockAction === 'lock-on-leave' && document.visibilityState === 'hidden') {
        setIsLocked(true);
        localStorage.setItem('trinity_account_locked', JSON.stringify(true));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoLockEnabled, autoLockAction, user]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const authenticatedUser = await UsersService.authenticateUser(username, password);
      
      if (authenticatedUser) {
        setUser(authenticatedUser);
        if (typeof window !== 'undefined') {
          saveUserCache(authenticatedUser);
        }
        
        logger.info('Successfully authenticated with custom auth system', { username: authenticatedUser.username });
        setHasStoredUser(true);
        setLastPermissionRefreshAt(Date.now());
        setSessionStatus('fresh');
        setSessionMessage(null);
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Login error', error);
      setUser(null);
      if (typeof window !== 'undefined') {
        clearUserCache();
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      logger.info('Explicit logout - clearing all user data');
      await firebaseSignOut(auth);
      setUser(null);
      setHasStoredUser(false);
      setIsLocked(false);
      if (typeof window !== 'undefined') {
        clearUserCache();
        localStorage.removeItem('trinity_account_locked');
        // Clear the lite cache so the next login gets fresh data
        liteClearAll();
      }
    } catch (error) {
      logger.error('Error signing out from Firebase', error);
      // Even if Firebase logout fails, clear local state
      setUser(null);
      setHasStoredUser(false);
      setIsLocked(false);
      if (typeof window !== 'undefined') {
        clearUserCache();
        localStorage.removeItem('trinity_account_locked');
        liteClearAll();
      }
    }
  };

  const lockAccount = () => {
    setIsLocked(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trinity_account_locked', JSON.stringify(true));
    }
    logger.info('Account locked');
  };

  const unlockAccount = async (password: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Authenticate with the provided password
      const authenticatedUser = await UsersService.authenticateUser(user.username, password);
      
      if (authenticatedUser) {
        setIsLocked(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('trinity_account_locked');
        }
        logger.info('Account unlocked successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error unlocking account', error);
      return false;
    }
  };

  const handleSetAutoLockEnabled = (enabled: boolean) => {
    setAutoLockEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trinity_auto_lock', JSON.stringify(enabled));
    }
  };
  const setAutoLockAction = (action: 'lock-on-close' | 'lock-on-leave' | 'signout') => {
    setAutoLockActionState(action);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trinity_auto_lock_action', JSON.stringify(action));
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    
    try {
      logger.debug('Refreshing user data from database');
      const updatedUser = await UsersService.getUserById(user.id);
      
      if (updatedUser && updatedUser.isActive !== false) {
        logger.debug('User data refreshed successfully', { username: updatedUser.username });
        setUser(updatedUser);
        saveUserCache(updatedUser);
        setLastPermissionRefreshAt(Date.now());
        setSessionStatus('fresh');
        setSessionMessage(null);
      } else {
        // Account deactivated or removed — invalidate only this user's session
        setUser(null);
        setHasStoredUser(false);
        clearUserCache();
        setSessionStatus('stale');
        setSessionMessage('Your account has been deactivated. Please contact the administrator.');
      }
    } catch (error) {
      // Network error — keep the user logged in; don't show a scary warning
      logger.warn('Error refreshing user data — keeping current session', error);
      setLastPermissionRefreshAt(Date.now());
    }
  };

  // Silently re-check permissions in the background when the user returns to the tab.
  // This NEVER forces a logout — it only updates the session if permissions/role changed
  // or deactivates the session if the account was removed.
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const silentPermissionCheck = async () => {
      const age = Date.now() - lastPermissionRefreshAt;
      if (age < AUTH_REFRESH_INTERVAL_MS) return; // Not time for a re-check yet

      try {
        const freshUser = await UsersService.getUserById(user.id);

        if (!freshUser || freshUser.isActive === false) {
          // Account was deactivated/deleted — only this user is logged out
          logger.info('Background check: account deactivated or removed', { id: user.id });
          setUser(null);
          setHasStoredUser(false);
          clearUserCache();
          setSessionStatus('stale');
          setSessionMessage('Your account has been deactivated. Please contact the administrator.');
          return;
        }

        // Silently apply any permission/role changes without logging the user out
        setUser(freshUser);
        saveUserCache(freshUser);
        setLastPermissionRefreshAt(Date.now());
        setSessionStatus('fresh');
        setSessionMessage(null);
      } catch (error) {
        // Network issue — do nothing; keep the user logged in
        logger.debug('Background permission check failed (network?) — keeping session', error);
        setLastPermissionRefreshAt(Date.now()); // Reset timer so we don't hammer the DB
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentPermissionCheck();
      }
    };

    window.addEventListener('focus', silentPermissionCheck);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', silentPermissionCheck);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, lastPermissionRefreshAt]);

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
    isSessionStale: sessionStatus === 'stale',
    sessionStatus,
    sessionMessage,
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
