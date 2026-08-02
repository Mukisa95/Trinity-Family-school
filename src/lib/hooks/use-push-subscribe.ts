"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  detachPushSubscriptionForLogout,
  enablePushSubscription,
  reconcilePushSubscription,
  supportsWebPush,
} from '@/lib/push-subscription-client';

interface UsePushSubscribeResult {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  isLoading: boolean;
  error: string | null;
  subscribe: (userId: string) => Promise<boolean>;
  unsubscribe: (userId: string) => Promise<boolean>;
  sync: (userId: string) => Promise<boolean>;
}

function messageForReason(reason?: string) {
  if (reason === 'permission-denied') {
    return 'Push notifications are blocked by your browser or operating system.';
  }
  if (reason === 'permission-required') {
    return 'Tap Enable Notifications to grant permission on this device.';
  }
  if (reason === 'offline') return 'Connect this device to the internet and try again.';
  if (reason === 'signed-out') return 'Sign in again to register this device.';
  if (reason === 'unsupported') return 'This browser does not support web push notifications.';
  return 'Could not activate push notifications on this device.';
}

export function usePushSubscribe(): UsePushSubscribeResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supported = supportsWebPush();
    setIsSupported(supported);
    if (!supported) return;

    setPermission(Notification.permission);
    void navigator.serviceWorker.getRegistration()
      .then(registration => registration?.pushManager.getSubscription())
      .then(subscription => setIsSubscribed(Boolean(subscription)))
      .catch(() => setIsSubscribed(false));
  }, []);

  const sync = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const result = await reconcilePushSubscription(userId);
      setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default');
      setIsSubscribed(result.active);
      if (result.active) setError(null);
      return result.active;
    } catch (syncError) {
      setIsSubscribed(false);
      setError(syncError instanceof Error ? syncError.message : 'Push subscription sync failed.');
      return false;
    }
  }, []);

  const subscribe = useCallback(async (userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await enablePushSubscription(userId);
      setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default');
      setIsSubscribed(result.active);
      if (!result.active) setError(messageForReason(result.reason));
      return result.active;
    } catch (subscribeError) {
      const message = subscribeError instanceof Error
        ? subscribeError.message
        : 'Unknown push subscription error.';
      setError(message);
      setIsSubscribed(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async (userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await detachPushSubscriptionForLogout(userId);
      setIsSubscribed(false);
      return true;
    } catch (unsubscribeError) {
      setError(unsubscribeError instanceof Error
        ? unsubscribeError.message
        : 'Failed to disable notifications on this device.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sync,
  };
}
