'use client';
import { useSyncExternalStore } from 'react';
import { isAndroidOffline } from '@/lib/offline/android-app-shell';
function subscribe(listener: () => void) {
  for (const name of ['online', 'offline', 'trinity-android-connectivity']) window.addEventListener(name, listener);
  return () => { for (const name of ['online', 'offline', 'trinity-android-connectivity']) window.removeEventListener(name, listener); };
}
export function useAndroidOfflineStatus() { return useSyncExternalStore(subscribe, isAndroidOffline, () => false); }
