"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  detachPushSubscriptionForLogout,
  enablePushSubscription,
  reconcilePushSubscription,
  supportsWebPush,
} from '@/lib/push-subscription-client';

const PUSH_SUBSCRIPTION_CHANGE_EVENT = 'trinity-push-subscription-change';

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
    let disposed = false;
    let permissionStatus: PermissionStatus | null = null;

    const refreshBrowserState = async () => {
      const supported = supportsWebPush();
      if (disposed) return;

      setIsSupported(supported);
      if (!supported) {
        setPermission('default');
        setIsSubscribed(false);
        return;
      }

      const nextPermission = Notification.permission;
      setPermission(nextPermission);
      if (nextPermission !== 'denied') setError(null);

      if (nextPermission !== 'granted') {
        setIsSubscribed(false);
        return;
      }

      // A browser endpoint alone is not enough: the server must confirm that
      // it is stored and active. sync/subscribe publish that confirmed state.
    };

    const refreshConfirmedState = (event: Event) => {
      const active = (event as CustomEvent<{ active?: boolean }>).detail?.active;
      if (typeof active === 'boolean') setIsSubscribed(active);
    };
    const refresh = () => void refreshBrowserState();

    void refreshBrowserState();
    window.addEventListener(PUSH_SUBSCRIPTION_CHANGE_EVENT, refreshConfirmedState);

    if ('permissions' in navigator) {
      void navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then(status => {
          if (disposed) return;
          permissionStatus = status;
          status.addEventListener('change', refresh);
        })
        .catch(() => {
          // Some browsers expose Permissions API but do not support querying notifications.
        });
    }

    return () => {
      disposed = true;
      window.removeEventListener(PUSH_SUBSCRIPTION_CHANGE_EVENT, refreshConfirmedState);
      permissionStatus?.removeEventListener('change', refresh);
    };
  }, []);

  const sync = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const result = await reconcilePushSubscription(userId);
      setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default');
      setIsSubscribed(result.active);
      if (result.active) setError(null);
      window.dispatchEvent(new CustomEvent(PUSH_SUBSCRIPTION_CHANGE_EVENT, { detail: { active: result.active } }));
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
      window.dispatchEvent(new CustomEvent(PUSH_SUBSCRIPTION_CHANGE_EVENT, { detail: { active: result.active } }));
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
      window.dispatchEvent(new CustomEvent(PUSH_SUBSCRIPTION_CHANGE_EVENT, { detail: { active: false } }));
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
