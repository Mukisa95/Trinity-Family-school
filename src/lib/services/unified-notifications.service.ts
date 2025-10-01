/**
 * Unified Notifications Service
 * Handles notifications for both web browsers and Android WebView
 */

interface AndroidBridge {
  showNotification: (title: string, message: string, url?: string) => void;
  isAndroidApp: () => boolean;
}

declare global {
  interface Window {
    Android?: AndroidBridge;
  }
}

export class UnifiedNotificationsService {
  
  /**
   * Check if running in Android WebView
   */
  static isAndroidApp(): boolean {
    return typeof window !== 'undefined' && 
           window.Android !== undefined && 
           typeof window.Android.isAndroidApp === 'function' &&
           window.Android.isAndroidApp();
  }

  /**
   * Check if running in a browser that supports web push
   */
  static isWebPushSupported(): boolean {
    return typeof window !== 'undefined' &&
           'serviceWorker' in navigator &&
           'PushManager' in window &&
           'Notification' in window;
  }

  /**
   * Get the platform type
   */
  static getPlatform(): 'android' | 'web' | 'unsupported' {
    if (this.isAndroidApp()) return 'android';
    if (this.isWebPushSupported()) return 'web';
    return 'unsupported';
  }

  /**
   * Show a notification using the appropriate method for the platform
   */
  static async showNotification(
    title: string, 
    message: string, 
    options: {
      url?: string;
      icon?: string;
      tag?: string;
      requireInteraction?: boolean;
    } = {}
  ): Promise<boolean> {
    
    const platform = this.getPlatform();
    console.log(`📱 Showing notification on platform: ${platform}`, { title, message, options });

    switch (platform) {
      case 'android':
        return this.showAndroidNotification(title, message, options.url || '');
        
      case 'web':
        return this.showWebNotification(title, message, options);
        
      default:
        console.warn('❌ Notifications not supported on this platform');
        // Fallback to browser alert
        if (typeof window !== 'undefined') {
          alert(`${title}: ${message}`);
          return true;
        }
        return false;
    }
  }

  /**
   * Show notification using Android WebView bridge
   */
  private static showAndroidNotification(title: string, message: string, url: string = ''): boolean {
    try {
      if (window.Android && window.Android.showNotification) {
        window.Android.showNotification(title, message, url);
        console.log('✅ Android notification triggered');
        return true;
      } else {
        console.error('❌ Android bridge not available');
        return false;
      }
    } catch (error) {
      console.error('❌ Android notification error:', error);
      return false;
    }
  }

  /**
   * Show notification using Web Push API
   */
  private static async showWebNotification(
    title: string, 
    message: string, 
    options: {
      url?: string;
      icon?: string;
      tag?: string;
      requireInteraction?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      // Check permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.warn('❌ Web notification permission denied');
        return false;
      }

      // Show local notification first
      const notification = new Notification(title, {
        body: message,
        icon: options.icon || '/icons/icon-192x192.png',
        tag: options.tag || 'trinity-notification',
        requireInteraction: options.requireInteraction || false
      });

      // Handle notification click
      if (options.url) {
        notification.onclick = () => {
          window.focus();
          window.location.href = options.url!;
          notification.close();
        };
      }

      console.log('✅ Web notification shown');
      return true;

    } catch (error) {
      console.error('❌ Web notification error:', error);
      return false;
    }
  }

  /**
   * Request notification permission (for web platforms)
   */
  static async requestPermission(): Promise<NotificationPermission | boolean> {
    const platform = this.getPlatform();
    
    switch (platform) {
      case 'android':
        // Android permissions are handled by the app itself
        console.log('📱 Android notifications managed by app');
        return true;
        
      case 'web':
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          console.log(`🔔 Web notification permission: ${permission}`);
          return permission;
        }
        return false;
        
      default:
        console.warn('❌ Notification permission not supported');
        return false;
    }
  }

  /**
   * Get current notification permission status
   */
  static getPermissionStatus(): string {
    const platform = this.getPlatform();
    
    switch (platform) {
      case 'android':
        return 'granted'; // Assume granted for Android apps
        
      case 'web':
        return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
        
      default:
        return 'unsupported';
    }
  }

  /**
   * Test notification - useful for debugging
   */
  static async testNotification(): Promise<boolean> {
    const platform = this.getPlatform();
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`🧪 Testing notification on ${platform} at ${timestamp}`);
    
    return this.showNotification(
      '🧪 Test Notification', 
      `Trinity School notification test - ${timestamp}`,
      {
        url: window.location.href,
        tag: 'test-notification'
      }
    );
  }
}
