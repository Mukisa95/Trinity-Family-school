'use client';
import { useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { auth } from '@/lib/firebase';
import { onIdTokenChanged } from 'firebase/auth';
import { hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { readAndroidNotificationState } from '@/lib/offline/android-notifications';
import { connectNativePush } from '@/lib/native-push-client';

/** One registration at sign-in; healthy resume/online checks stay entirely local. */
export function NativePushRegistration() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user?.id || !hasAndroidOfflineBridge()) return;
    let disposed = false, pending = false;
    const sync = async () => {
      if (disposed || pending || !navigator.onLine || document.visibilityState === 'hidden' || auth.currentUser?.uid !== user.id) return;
      pending = true;
      try {
        const state = await readAndroidNotificationState();
        if (!disposed && state.pushEnabled && (!state.remotePush || state.pushAccountId !== user.id)) await connectNativePush(user.id);
      } catch { /* Retry at the next sign-in/resume/connection change; the inbox remains available. */ }
      finally { pending = false; }
    };
    const refresh = () => { void sync(); };
    const unsubscribe = onIdTokenChanged(auth, refresh);
    refresh(); window.addEventListener('online', refresh); window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { disposed = true; unsubscribe(); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [user?.id]);
  return null;
}
