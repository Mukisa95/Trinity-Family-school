/**
 * Android Navigation Utilities
 * 
 * Handles back button behavior in Capacitor Android app
 */

import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Initialize Android back button handler
 * 
 * Features:
 * - Back button navigates to previous page (instead of closing app)
 * - Only closes app when on home page
 * - Works with Next.js router
 */
export function initializeAndroidBackButton() {
  // Only run in native Android
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }

  console.log('🔙 Initializing Android back button handler...');

  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    // Get current path
    const currentPath = window.location.pathname;
    
    // Define home routes (where back button should close the app)
    const homeRoutes = ['/', '/login'];
    const isOnHomePage = homeRoutes.includes(currentPath);

    console.log('🔙 Back button pressed:', { currentPath, canGoBack, isOnHomePage });

    if (!isOnHomePage && canGoBack) {
      // Navigate back using browser history
      console.log('🔙 Navigating back...');
      window.history.back();
    } else {
      // On home page or can't go back - close the app
      console.log('🔙 Closing app...');
      CapacitorApp.exitApp();
    }
  });

  console.log('✅ Android back button handler initialized');
}

/**
 * Manually trigger navigation back
 * Useful for custom back buttons in the UI
 */
export function navigateBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else if (Capacitor.isNativePlatform()) {
    // If no history, go to home or close app
    window.location.href = '/';
  }
}

/**
 * Check if we can navigate back
 */
export function canNavigateBack(): boolean {
  return window.history.length > 1;
}

/**
 * Refresh the current page/app
 * Forces a complete reload
 */
export function refreshApp() {
  console.log('🔄 Refreshing app...');
  
  if (Capacitor.isNativePlatform()) {
    // In native app, reload the WebView
    window.location.reload();
  } else {
    // In browser, just reload
    window.location.reload();
  }
}

/**
 * Clear app cache and refresh
 * Use this for the pull-to-refresh functionality
 */
export async function clearCacheAndRefresh() {
  console.log('🧹 Clearing cache and refreshing...');
  
  try {
    // Clear React Query cache if available
    if (typeof window !== 'undefined' && (window as any).__REACT_QUERY_CLIENT__) {
      const queryClient = (window as any).__REACT_QUERY_CLIENT__;
      queryClient.clear();
      console.log('✅ React Query cache cleared');
    }

    // Clear localStorage cached data
    const keysToKeep = ['authUser', 'firebase:authUser']; // Keep auth data
    const allKeys = Object.keys(localStorage);
    
    allKeys.forEach(key => {
      if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('✅ localStorage cache cleared (auth preserved)');

    // Reload the app
    window.location.reload();
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    // Fallback to simple reload
    window.location.reload();
  }
}

