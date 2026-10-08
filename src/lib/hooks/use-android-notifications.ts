'use client';

import { useEffect, useState } from 'react';
import { hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { readAndroidNotificationState, type AndroidNotificationState } from '@/lib/offline/android-notifications';

export function useAndroidNotifications() {
  const [isAndroid, setIsAndroid] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [state, setState] = useState<AndroidNotificationState | null>(null);

  useEffect(() => {
    let disposed = false, pending = false;
    const native = hasAndroidOfflineBridge();
    setIsAndroid(native);
    if (!native) { setIsChecking(false); return; }
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const next = await readAndroidNotificationState();
        if (!disposed) setState(next);
      } catch {
        // Older Android releases still open reminder settings, but cannot report permission.
        if (!disposed) setState(null);
      } finally {
        pending = false;
        if (!disposed) setIsChecking(false);
      }
    };
    const onResume = () => { void refresh(); };
    void refresh();
    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('trinity-android-notifications-change', onResume);
    return () => {
      disposed = true;
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('trinity-android-notifications-change', onResume);
    };
  }, []);

  return { isAndroid, isChecking, state };
}
