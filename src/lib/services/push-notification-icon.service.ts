/**
 * 🔔 PUSH NOTIFICATION ICON SERVICE
 * 
 * Manages the icon used for push notifications.
 * Icons are stored in school settings and automatically sync when app icons are updated.
 * 
 * This ensures push notifications always use the same icon as the app,
 * without checking dynamically on every notification send (for performance).
 */

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SchoolSettings } from '@/types';

class PushNotificationIconService {
  private static instance: PushNotificationIconService;
  private cachedIcon: string | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): PushNotificationIconService {
    if (!PushNotificationIconService.instance) {
      PushNotificationIconService.instance = new PushNotificationIconService();
    }
    return PushNotificationIconService.instance;
  }

  /**
   * Get the current push notification icon path
   * Uses caching to avoid frequent database reads
   */
  async getPushIcon(): Promise<string> {
    const now = Date.now();
    
    // Return cached icon if still valid
    if (this.cachedIcon && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cachedIcon;
    }

    try {
      const settingsRef = doc(db, 'schoolSettings', 'current');
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        const settings = settingsSnap.data() as SchoolSettings;
        const icon = settings.generalInfo?.pushNotificationIcon || '/trinity-logo-192.png';
        
        // Update cache
        this.cachedIcon = icon;
        this.cacheTimestamp = now;
        
        return icon;
      }
    } catch (error) {
      console.error('Error fetching push notification icon:', error);
    }

    // Fallback to default icon
    return '/trinity-logo-192.png';
  }

  /**
   * Update the push notification icon in settings
   * Called when app icons are regenerated
   */
  async updatePushIcon(iconPath: string): Promise<void> {
    try {
      const settingsRef = doc(db, 'schoolSettings', 'current');
      
      await updateDoc(settingsRef, {
        'generalInfo.pushNotificationIcon': iconPath
      });

      // Update cache
      this.cachedIcon = iconPath;
      this.cacheTimestamp = Date.now();

      console.log(`✅ Push notification icon updated to: ${iconPath}`);
    } catch (error) {
      console.error('Error updating push notification icon:', error);
      throw error;
    }
  }

  /**
   * Clear the cached icon
   * Useful when you want to force a fresh fetch
   */
  clearCache(): void {
    this.cachedIcon = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get icon synchronously from cache only
   * Returns null if not cached
   */
  getCachedIcon(): string | null {
    const now = Date.now();
    
    if (this.cachedIcon && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cachedIcon;
    }
    
    return null;
  }
}

export const pushNotificationIconService = PushNotificationIconService.getInstance();
