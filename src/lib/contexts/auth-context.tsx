"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SystemUser, UserRole, ModulePermission, Permission } from '@/types';
import { UsersService } from '@/lib/services/users.service';
import { SecureAuthError, SecureAuthService } from '@/lib/services/secure-auth.service';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { onIdTokenChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/utils/logger';
import { validateCurrentAppSession } from '@/lib/auth/firebase-session';

const AUTH_CACHE_KEY = 'trinity_user';
// How often a long-lived tab asks Firebase Authentication for a fresh signed
// token. This is not a password login and does not read Firestore.
const SESSION_VALIDATION_INTERVAL_MS = 15 * 60 * 1000;
// For legacy (un-timestamped) cache entries, report the age as if they are
// old for diagnostics, but still restore the session immediately.
const AUTH_CACHE_MAX_AGE_MS = SESSION_VALIDATION_INTERVAL_MS * 2;

type SessionStatus = 'checking' | 'fresh' | 'stale' | 'degraded';

type StoredAuthCache = {
  user: SystemUser;
  cachedAt: number;
};

interface AuthContextType {
  user: SystemUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isSessionStale: boolean;
  sessionStatus: SessionStatus;
  sessionMessage: string | null;
  isSessionVerificationDelayed: boolean;
  isAuthenticated: boolean;
  canAccessModule: (module: string) => boolean;
  canEdit: (module: string) => boolean;
  canDelete: (module: string) => boolean;
  getModulePermission: (module: string) => Permission | null;
  canAccessPage: (module: string, page: string) => boolean;
  canPerformAction: (module: string, page: string, action: string) => boolean;
  isLocked: boolean;
  lockAccount: () => void;
  resumeSession: () => Promise<boolean>;
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
  const [lastSessionValidationAt, setLastSessionValidationAt] = useState<number>(0);

  const saveUserCache = (userData: SystemUser) => {
    if (typeof window === 'undefined') return;
    // SECURITY: Strip any credential or hash fields before persisting to localStorage.
    // The SystemUser type has an optional `passwordHash` field (marked "for development")
    // which is built by spreading the raw Firestore document. Even if it somehow ends up
    // on the object, it must never reach localStorage where XSS could read it.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = userData as SystemUser & { passwordHash?: string };
    const payload: StoredAuthCache = { user: safeUser as SystemUser, cachedAt: Date.now() };
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
    let restoredCachedUser: SystemUser | null = null;

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
              restoredCachedUser = storedCache.user;
              setHasStoredUser(true);
              setSessionStatus('fresh');  // Trust the cache until DB says otherwise
              setSessionMessage(null);
              setIsLoading(false);
              performance.mark?.('trinity:auth-cache-ready');

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

        // Firebase's listener waits for its own initialization. Adding an extra
        // timer here only delays cold starts and does not make auth safer.
        unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
          logger.debug('Firebase signed-token state changed', {
            userId: firebaseUser?.uid || 'No user',
            anonymous: firebaseUser?.isAnonymous || false,
            initialized: firebaseInitialized,
          });

          if (firebaseUser && !firebaseUser.isAnonymous) {
            firebaseInitialized = true;
            try {
              const tokenResult = await firebaseUser.getIdTokenResult();
              if (
                tokenResult.claims.appUser !== true ||
                tokenResult.claims.isActive !== true
              ) {
                throw new Error('Firebase identity is not an active application user.');
              }

              // Bind the signed Firebase uid to the profile returned by the
              // successful login. No system_users read is needed on reload.
              const latestCache = readUserCache();
              const cachedUser = latestCache?.user || restoredCachedUser;
              if (!cachedUser || cachedUser.id !== firebaseUser.uid || !validateStoredUser(cachedUser)) {
                throw new Error('The signed identity does not match the cached application profile.');
              }

              const systemUserData: SystemUser = {
                ...cachedUser,
                role: (tokenResult.claims.role || cachedUser.role) as UserRole,
                isActive: true,
              };

              logger.debug('Setting user from verified Firebase identity', { username: systemUserData.username });
              setUser(systemUserData);
              restoredCachedUser = systemUserData;
              setHasStoredUser(true);
              saveUserCache(systemUserData);
              setLastSessionValidationAt(Date.now());
              setSessionStatus('fresh');
              setSessionMessage(null);
              performance.mark?.('trinity:firebase-auth-ready');
            } catch (error) {
              logger.error('AuthContext: Error processing Firebase identity', error);
              setUser(null);
              restoredCachedUser = null;
              setHasStoredUser(false);
              clearUserCache();
              setSessionStatus('stale');
              setSessionMessage('Your secure session could not be verified. Please sign in again.');
              await firebaseSignOut(auth).catch(() => undefined);
            }
          } else {
            firebaseInitialized = true;
            logger.debug('No signed Firebase application user - clearing the private user session');
            setUser(null);
            restoredCachedUser = null;
            setHasStoredUser(false);
            clearUserCache();
          }
          
          if (!isInitialized) {
            setIsLoading(false);
            setIsInitialized(true);
            performance.mark?.('trinity:auth-resolved');
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
      const authenticatedUser = await SecureAuthService.signIn(username, password);
      
      if (authenticatedUser) {
        setUser(authenticatedUser);
        if (typeof window !== 'undefined') {
          saveUserCache(authenticatedUser);
          localStorage.removeItem('trinity_account_locked');
        }
        setIsLocked(false);
        
        logger.info('Successfully authenticated with Firebase custom token', { username: authenticatedUser.username });
        setHasStoredUser(true);
        setLastSessionValidationAt(Date.now());
        setSessionStatus('fresh');
        setSessionMessage(null);
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Login error', error);
      // A failed re-authentication must not destroy the fast cached dashboard
      // session. Only a confirmed server-side credential mismatch returns
      // false; connection, rate-limit, and Firebase handoff failures are
      // surfaced to the login screen with an accurate retry message.
      if (error instanceof SecureAuthError && error.code === 'invalid-credentials') {
        return false;
      }
      if (error instanceof SecureAuthError) throw error;
      throw new SecureAuthError(
        'service-unavailable',
        'Sign-in could not be completed. Check your connection and try again.',
      );
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
        // NOTE: We intentionally do NOT call liteClearAll() here.
        // Photos, events, and academicYears are school-level public data — they
        // don't belong to any individual user. Keeping them in the lite cache
        // means the login page can render all its content instantly from cache
        // without making any Firestore requests.
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
        // Same reasoning — don't clear public system data on logout.
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

  const revalidateSignedSession = async (forceRefresh: boolean): Promise<boolean> => {
    if (!user) return false;

    const validation = await validateCurrentAppSession(user.id, forceRefresh);
    setLastSessionValidationAt(Date.now());

    if (validation.status === 'valid') {
      if (validation.role && validation.role !== user.role) {
        const updatedUser = { ...user, role: validation.role as UserRole };
        setUser(updatedUser);
        saveUserCache(updatedUser);
      }
      setSessionStatus('fresh');
      setSessionMessage(null);
      return true;
    }

    if (validation.status === 'unavailable') {
      // A network interruption must not turn a privacy lock into a lockout.
      // Live Firestore operations remain governed by the signed token/rules.
      setSessionStatus('degraded');
      setSessionMessage(validation.message);
      return true;
    }

    logger.info('Signed session is no longer valid', { userId: user.id });
    setUser(null);
    setHasStoredUser(false);
    setIsLocked(false);
    clearUserCache();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trinity_account_locked');
    }
    setSessionStatus('stale');
    setSessionMessage(validation.message);
    await firebaseSignOut(auth).catch(() => undefined);
    return false;
  };

  const resumeSession = async (): Promise<boolean> => {
    if (!user) return false;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser || firebaseUser.isAnonymous || firebaseUser.uid !== user.id) {
      return revalidateSignedSession(false);
    }

    // Auto-lock is a local privacy screen, not a second sign-in. Resume
    // immediately and verify revocation in the background so slow internet
    // never delays access to the already-mounted dashboard and cache.
    setIsLocked(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trinity_account_locked');
    }
    logger.info('Local privacy lock resumed');
    // This uses the already-issued token locally. Forced refreshes happen on
    // the bounded background schedule, not on every privacy-lock resume.
    void revalidateSignedSession(false);
    return true;
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
        setLastSessionValidationAt(Date.now());
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
      setLastSessionValidationAt(Date.now());
    }
  };

  // Revalidate the signed Firebase session without reading system_users.
  // Firebase also refreshes its ID token automatically; this focus check is a
  // low-frequency fallback for tabs that remain open for a long time.
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const validateIfDue = () => {
      const age = Date.now() - lastSessionValidationAt;
      if (age < SESSION_VALIDATION_INTERVAL_MS) return;
      void revalidateSignedSession(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        validateIfDue();
      }
    };

    window.addEventListener('focus', validateIfDue);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const validationTimer = window.setInterval(
      validateIfDue,
      SESSION_VALIDATION_INTERVAL_MS,
    );

    return () => {
      window.removeEventListener('focus', validateIfDue);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(validationTimer);
    };
  }, [user, lastSessionValidationAt]);

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
    isSessionVerificationDelayed: sessionStatus === 'degraded',
    isAuthenticated: !!user,
    canAccessModule,
    canEdit,
    canDelete,
    getModulePermission,
    canAccessPage,
    canPerformAction,
    isLocked,
    lockAccount,
    resumeSession,
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
