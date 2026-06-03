/**
 * Android Status Bar Detection and Handling
 * 
 * Detects status bar height and applies it to the app content
 * without using wrappers - content starts directly below status bar
 */

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

let statusBarHeight = 0;
let isInitialized = false;

/**
 * Initialize status bar detection and styling
 * This should be called once when the app loads
 */
export async function initializeStatusBar() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    console.log('📱 Not Android - skipping status bar initialization');
    return;
  }

  if (isInitialized) {
    console.log('📱 Status bar already initialized');
    return;
  }

  try {
    console.log('📱 ===== INITIALIZING ANDROID STATUS BAR =====');

    // Get status bar info
    const info = await StatusBar.getInfo();
    console.log('📱 Status bar info:', info);

    // Set status bar style (light content on dark background or dark on light)
    await StatusBar.setStyle({ style: Style.Light });

    // Set status bar background color (transparent or match app theme)
    await StatusBar.setBackgroundColor({ color: '#ffffff' });

    // Wait a bit for native interface to be ready
    console.log('📱 Waiting for native interface...');
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get status bar height using native method
    console.log('📱 Getting status bar height from native...');
    statusBarHeight = await getStatusBarHeightNative();

    console.log(`📱 ===== STATUS BAR HEIGHT DETECTED: ${statusBarHeight}px =====`);

    // Apply status bar height to document
    console.log('📱 Applying status bar height to body...');
    applyStatusBarHeight(statusBarHeight);

    // Verify it was applied
    const bodyPaddingTop = window.getComputedStyle(document.body).paddingTop;
    console.log(`📱 Body padding-top after application: ${bodyPaddingTop}`);

    // Listen for status bar changes (e.g., when device rotates)
    // DEBOUNCED to prevent interfering with Firestore queries
    let resizeTimeout: NodeJS.Timeout | null = null;
    const debouncedResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        handleStatusBarResize();
      }, 1000); // Wait 1 second after last resize event
    };
    
    window.addEventListener('resize', debouncedResize, { passive: true });
    window.addEventListener('orientationchange', () => {
      // Orientation change - recalculate immediately but don't block
      setTimeout(() => handleStatusBarResize(), 500);
    }, { passive: true });

    isInitialized = true;
    console.log('✅ ===== STATUS BAR INITIALIZED SUCCESSFULLY =====');
  } catch (error) {
    console.error('❌ Error initializing status bar:', error);
    console.error('❌ Error stack:', (error as Error).stack);
    // Fallback: use default Android status bar height (usually 24dp = ~24px)
    statusBarHeight = 24;
    console.log(`📱 Using fallback status bar height: ${statusBarHeight}px`);
    applyStatusBarHeight(statusBarHeight);
  }
}

/**
 * Get status bar height using native Android methods
 * This uses the JavaScript interface exposed by MainActivity
 */
async function getStatusBarHeightNative(): Promise<number> {
  try {
    // Method 1: Use JavaScript interface from MainActivity (WAIT for it to be ready)
    if (typeof window !== 'undefined') {
      // Wait a bit for the interface to be available
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if ((window as any).AndroidStatusBar) {
        try {
          const height = (window as any).AndroidStatusBar.getStatusBarHeight();
          console.log(`📱 Native interface returned: ${height}px`);
          if (height && height > 0 && height < 200) { // Sanity check: should be 24-48px typically
            console.log(`✅ Status bar height from native: ${height}px`);
            return height;
          } else {
            console.warn(`⚠️ Native returned invalid height: ${height}px, using fallback`);
          }
        } catch (error) {
          console.warn('⚠️ Could not get status bar height from AndroidStatusBar interface:', error);
        }
      } else {
        console.warn('⚠️ AndroidStatusBar interface not available yet');
      }
    }

    // Method 2: Use CSS environment variable (if set by native code)
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    const envHeight = computedStyle.getPropertyValue('--status-bar-height');
    if (envHeight) {
      const height = parseInt(envHeight.replace('px', ''), 10);
      if (height > 0) return height;
    }

    // Method 3: Calculate from window dimensions
    // On Android, status bar is usually at the top
    // We can detect it by checking window.screenY or using visual viewport
    if (typeof window !== 'undefined' && window.visualViewport) {
      const viewportHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      const difference = windowHeight - viewportHeight;
      
      // If there's a difference, it might be the status bar
      if (difference > 0 && difference < 100) {
        console.log(`📱 Status bar height from viewport difference: ${difference}px`);
        return difference;
      }
    }

    // Fallback: Default Android status bar height
    // Standard Android status bar is 24dp
    // On mdpi (density = 1.0): 24px
    // On hdpi (density = 1.5): 36px
    // On xhdpi (density = 2.0): 48px
    // On xxhdpi (density = 3.0): 72px
    // But typically it's around 24-48px on most modern devices
    const dpr = window.devicePixelRatio || 1;
    // Use a more conservative calculation - status bar is usually 24-48px
    const fallbackHeight = Math.min(Math.round(24 * dpr), 48);
    console.log(`📱 Using fallback status bar height: ${fallbackHeight}px (dpr: ${dpr})`);
    return fallbackHeight;
  } catch (error) {
    console.warn('⚠️ Could not get native status bar height, using fallback:', error);
    return 24; // Default fallback
  }
}

/**
 * Apply status bar height to the document
 * Android WebView handles padding automatically via fitsSystemWindows/WindowInsets
 * (Same mechanism as "hide camera cutout" setting)
 * Only set CSS variable for floating elements to use
 */
function applyStatusBarHeight(height: number) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  
  // Set CSS custom property for status bar height (for floating elements only)
  root.style.setProperty('--status-bar-height', `${height}px`);
  
  // Android WebView automatically handles padding via fitsSystemWindows/WindowInsets
  // (Same as when you enable "hide camera cutout" in settings)
  // DO NOT add JavaScript padding - let Android handle it natively
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    // Remove any existing status bar style tag
    const existingStyle = document.getElementById('android-status-bar-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Ensure body has NO padding - Android WebView adds it automatically
    document.body.style.paddingTop = '0px';
    document.body.style.marginTop = '0px';
    
    // Only create CSS rules for fixed/floating elements that overlay content
    const style = document.createElement('style');
    style.id = 'android-status-bar-styles';
    style.textContent = `
      /* Root variable for floating elements */
      :root {
        --status-bar-height: ${height}px;
      }
      
      /* NO padding on html/body - Android WebView handles this automatically */
      html, body {
        padding-top: 0 !important;
        margin-top: 0 !important;
      }
      
      /* Prevent horizontal scroll */
      html {
        overflow-x: hidden;
      }
      
      /* Body scroll - WebView content area already positioned below status bar */
      body {
        overflow-y: auto;
      }
      
      /* Fixed/floating elements that overlay need to account for status bar */
      [data-radix-sidebar],
      aside[class*="sidebar"],
      [class*="Sidebar"] {
        top: ${height}px !important;
        height: calc(100vh - ${height}px) !important;
        max-height: calc(100vh - ${height}px) !important;
      }
      
      /* Fixed headers and navigation */
      header[class*="fixed"],
      nav[class*="fixed"],
      [class*="enhanced-header"][class*="fixed"] {
        top: ${height}px !important;
      }
      
      /* Modals and dialogs */
      [role="dialog"],
      [data-radix-dialog],
      [data-radix-dialog-content],
      [class*="Dialog"],
      [class*="Modal"],
      [class*="Overlay"] {
        top: ${height}px !important;
        max-height: calc(100vh - ${height}px) !important;
      }
      
      /* Mobile sidebar sheet */
      [data-radix-sheet-content],
      [class*="SheetContent"],
      [class*="mobile-sidebar"],
      [class*="MobileSidebar"] {
        top: ${height}px !important;
        height: calc(100vh - ${height}px) !important;
        max-height: calc(100vh - ${height}px) !important;
      }
      
      /* Floating elements */
      [class*="floating"][class*="fixed"],
      [class*="Floating"][class*="fixed"] {
        top: ${height}px !important;
      }
    `;
    
    document.head.appendChild(style);
    
    console.log(`📱 Status bar height: ${height}px - Android WebView handles padding (like camera cutout)`);
  }
}

/**
 * Handle status bar resize (e.g., device rotation)
 * Non-blocking - doesn't interfere with Firestore queries
 */
async function handleStatusBarResize() {
  if (!isInitialized) return;
  
  // Use requestIdleCallback if available to avoid blocking main thread
  const runWhenIdle = (callback: () => void) => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(callback, { timeout: 2000 });
    } else {
      // Fallback: run after a short delay
      setTimeout(callback, 100);
    }
  };
  
  runWhenIdle(async () => {
    try {
      console.log('📱 Status bar resize detected, recalculating...');
      
      // Recalculate status bar height (non-blocking)
      const newHeight = await getStatusBarHeightNative();
      
      if (newHeight !== statusBarHeight && newHeight > 0 && newHeight < 200) {
        statusBarHeight = newHeight;
        applyStatusBarHeight(statusBarHeight);
        console.log(`📱 Status bar height updated: ${statusBarHeight}px`);
      }
    } catch (error) {
      // Silently fail - don't interfere with app functionality
      console.warn('⚠️ Status bar resize check failed (non-critical):', error);
    }
  });
}

/**
 * Get current status bar height
 */
export function getStatusBarHeight(): number {
  return statusBarHeight;
}

/**
 * Get status bar height as CSS value
 */
export function getStatusBarHeightCSS(): string {
  return `var(--status-bar-height, ${statusBarHeight}px)`;
}

/**
 * Show status bar (if hidden)
 */
export async function showStatusBar() {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await StatusBar.show();
  } catch (error) {
    console.error('Error showing status bar:', error);
  }
}

/**
 * Hide status bar
 */
export async function hideStatusBar() {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await StatusBar.hide();
  } catch (error) {
    console.error('Error hiding status bar:', error);
  }
}

