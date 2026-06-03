"use client";

import { useState, useEffect, useCallback } from 'react';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BKdPGmGr1PGvX5FgBPph5yywU7ilPtSFxSYzpNdf751UHl7dFn-Qgt_qVQWeZ4-KSCkXC1F0VrbnfJ6m7Ozc2W4';

/**
 * Converts a URL-safe base64 VAPID public key to a Uint8Array.
 * Inlined here to avoid pulling in server-side Firebase imports from the service file.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Trim whitespace/newlines — PowerShell echo may add a trailing \n when piping to vercel env add
  const key = (base64String || '').trim();
  if (!key) {
    throw new Error('VAPID public key is empty or missing');
  }
  // Convert URL-safe base64 (- and _) to standard base64 (+ and /), then add padding
  const padding = '='.repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
  try {
    const rawData = atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      output[i] = rawData.charCodeAt(i);
    }
    return output;
  } catch (e) {
    throw new Error(`Failed to decode VAPID key. Key value: "${key.substring(0, 20)}…" — ensure NEXT_PUBLIC_VAPID_PUBLIC_KEY is set correctly.`);
  }
}

interface UsePushSubscribeResult {
  /** Whether the browser supports push notifications at all */
  isSupported: boolean;
  /** Whether the current user has an active push subscription */
  isSubscribed: boolean;
  /** Current browser notification permission state */
  permission: NotificationPermission;
  /** Loading state (subscribing or unsubscribing in progress) */
  isLoading: boolean;
  /** Last error message, if any */
  error: string | null;
  /** Subscribe the current user — pass their userId */
  subscribe: (userId: string) => Promise<boolean>;
  /** Unsubscribe the current user */
  unsubscribe: (userId: string) => Promise<boolean>;
}

export function usePushSubscribe(): UsePushSubscribeResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check support and existing subscription on mount
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (!supported) return;

    setPermission(Notification.permission);

    // Check if already subscribed
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => setIsSubscribed(false));
  }, []);

  const subscribe = useCallback(async (userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!('Notification' in window)) throw new Error('Notifications not supported');

      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') throw new Error('Notification permission denied');

      // Register service worker, then wait for the *active* registration.
      // navigator.serviceWorker.ready waits until a SW is active and controlling
      // the page. We MUST use this registration (not the one returned by register())
      // because register() may return an INSTALLING worker, and pushManager.subscribe()
      // on a non-active worker throws NotAllowedError.
      await navigator.serviceWorker.register('/sw.js');
      const activeReg = await navigator.serviceWorker.ready;

      // Subscribe to push manager using the active registration
      const pushSub = await activeReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      const pushSubJson = pushSub.toJSON();

      // Save to our backend
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription: pushSubJson }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save subscription');
      }

      setIsSubscribed(true);
      return true;
    } catch (err) {
      // Provide a specific message for NotAllowedError (OS/browser blocked push at system level)
      let msg = err instanceof Error ? err.message : 'Unknown error';
      if (err instanceof Error && err.name === 'NotAllowedError') {
        msg = 'Push notifications are blocked by your browser or OS. Please open Site Settings and allow notifications, then try again.';
        setPermission('denied');
      }
      setError(msg);
      console.error('[usePushSubscribe] subscribe error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async (userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Unsubscribe browser-side
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }

      // Deactivate server-side
      const res = await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to deactivate subscription');
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      console.error('[usePushSubscribe] unsubscribe error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isSupported, isSubscribed, permission, isLoading, error, subscribe, unsubscribe };
}
