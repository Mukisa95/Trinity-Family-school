'use client';

import { useEffect } from 'react';
import { initializeAndroidBackButton } from '@/lib/utils/android-navigation';
import { initializeStatusBar } from '@/lib/utils/android-status-bar';
import { Capacitor } from '@capacitor/core';

/**
 * Android App Initialization Component
 * 
 * Initializes Android-specific features:
 * - Back button navigation handler
 * - Status bar detection and handling
 * - Other native features as needed
 */
export function AndroidAppInit() {
  useEffect(() => {
    // Only run in native Android
    if (!Capacitor.isNativePlatform()) {
      console.log('📱 Running in browser - Android features disabled');
      return;
    }

    console.log('📱 Initializing Android app features...');

    // Initialize back button handler
    initializeAndroidBackButton();

    // Initialize status bar detection
    initializeStatusBar();

    console.log('✅ Android app features initialized');
  }, []);

  // This component doesn't render anything
  return null;
}

