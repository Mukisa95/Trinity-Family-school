"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { SyncStatus } from '@/types';

interface SyncContextType extends SyncStatus {
  syncNow: () => Promise<void>;
  markOffline: () => void;
  markOnline: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  // Always initialize with a consistent value for both server and client
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true, // Always start with true, then update in useEffect
    isSyncing: false,
    pendingChanges: 0,
    syncErrors: [],
  });

  // Monitor online/offline status
  useEffect(() => {
    // Set the actual online status after mounting
    if (typeof navigator !== 'undefined') {
      setSyncStatus(prev => ({ ...prev, isOnline: navigator.onLine }));
    }

    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const syncNow = async (): Promise<void> => {
    if (!syncStatus.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      // Simulate sync operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
        pendingChanges: 0,
        syncErrors: [],
      }));
    } catch (error) {
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncErrors: [error instanceof Error ? error.message : 'Sync failed'],
      }));
      throw error;
    }
  };

  const markOffline = () => {
    setSyncStatus(prev => ({ ...prev, isOnline: false }));
  };

  const markOnline = () => {
    setSyncStatus(prev => ({ ...prev, isOnline: true }));
  };

  const value: SyncContextType = {
    ...syncStatus,
    syncNow,
    markOffline,
    markOnline,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSyncContext = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
}; 