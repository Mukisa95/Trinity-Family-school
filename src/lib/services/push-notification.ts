"use client";

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PushSubscription as PushSubscriptionType, NotificationDelivery } from '@/types';

// VAPID public key - Default key generated 2025-10-26
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BKdPGmGr1PGvX5FgBPph5yywU7ilPtSFxSYzpNdf751UHl7dFn-Qgt_qVQWeZ4-KSCkXC1F0VrbnfJ6m7Ozc2W4';

class PushNotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;

  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported');
      return false;
    }

    try {
      // Register service worker
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', this.swRegistration);
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    return permission;
  }

  async subscribe(userId: string): Promise<PushSubscriptionType | null> {
    if (!this.swRegistration) {
      await this.initialize();
    }

    if (!this.swRegistration) {
      throw new Error('Service Worker not registered');
    }

    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Push notification permission denied');
    }

    try {
      console.log('[Push Notification] Attempting to subscribe with VAPID key:', VAPID_PUBLIC_KEY);
      
      // Test VAPID key conversion first
      try {
        const testArray = this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        console.log('[Push Notification] VAPID key conversion successful, length:', testArray.length);
      } catch (conversionError) {
        console.error('[Push Notification] VAPID key conversion failed:', conversionError);
        throw new Error(`VAPID key conversion failed: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
      }

      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      console.log('[Push Notification] Successfully subscribed to push notifications');

      const subscriptionData: Omit<PushSubscriptionType, 'id'> = {
        userId,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        },
        userAgent: navigator.userAgent,
        createdAt: new Date().toISOString(),
        isActive: true
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'pushSubscriptions'), {
        ...subscriptionData,
        createdAt: serverTimestamp()
      });

      return {
        id: docRef.id,
        ...subscriptionData
      };
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  async unsubscribe(userId: string): Promise<void> {
    if (!this.swRegistration) {
      return;
    }

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove from Firestore
      const q = query(
        collection(db, 'pushSubscriptions'),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(doc => 
        updateDoc(doc.ref, { isActive: false })
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  async getSubscription(userId: string): Promise<PushSubscriptionType | null> {
    try {
      const q = query(
        collection(db, 'pushSubscriptions'),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as PushSubscriptionType;
    } catch (error) {
      console.error('Failed to get push subscription:', error);
      return null;
    }
  }

  async sendNotification(
    subscriptions: PushSubscriptionType[],
    payload: {
      title: string;
      body: string;
      icon?: string;
      image?: string;
      url?: string;
      actions?: Array<{ action: string; title: string; icon?: string }>;
    }
  ): Promise<NotificationDelivery[]> {
    const deliveries: NotificationDelivery[] = [];

    for (const subscription of subscriptions) {
      try {
        const response = await fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscription: {
              endpoint: subscription.endpoint,
              keys: subscription.keys
            },
            payload
          })
        });

        const delivery: NotificationDelivery = {
          id: `${Date.now()}-${Math.random()}`,
          notificationId: '', // Will be set by caller
          userId: subscription.userId,
          method: 'push',
          status: response.ok ? 'sent' : 'failed',
          sentAt: response.ok ? new Date().toISOString() : undefined,
          error: response.ok ? undefined : `HTTP ${response.status}`,
          retryCount: 0
        };

        deliveries.push(delivery);
      } catch (error) {
        const delivery: NotificationDelivery = {
          id: `${Date.now()}-${Math.random()}`,
          notificationId: '',
          userId: subscription.userId,
          method: 'push',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount: 0
        };

        deliveries.push(delivery);
      }
    }

    return deliveries;
  }

  async showLocalNotification(
    title: string,
    options: NotificationOptions = {}
  ): Promise<void> {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      throw new Error('Notifications are not supported in this browser');
    }

    // Check permission status
    if (Notification.permission === 'denied') {
      throw new Error('Notification permission has been denied');
    }

    if (Notification.permission === 'default') {
      throw new Error('Notification permission has not been granted. Please request permission first.');
    }

    if (Notification.permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    try {
      if (this.swRegistration) {
        // Show notification via service worker (preferred method)
        await this.swRegistration.showNotification(title, {
          badge: '/icons/badge-72x72.png',
          icon: '/icons/icon-192x192.png',
          requireInteraction: false,
          silent: false,
          ...options
        });
      } else {
        // Fallback to regular notification
        const notification = new Notification(title, {
          icon: '/icons/icon-192x192.png',
          ...options
        });
        
        // Auto-close after 5 seconds if not clicked
        setTimeout(() => {
          notification.close();
        }, 5000);
      }
    } catch (error) {
      console.error('Error showing local notification:', error);
      throw error;
    }
  }

  // Utility methods
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // Check if push notifications are supported
  static isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // Get current permission status
  static getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }
}

export const pushNotificationService = new PushNotificationService(); 