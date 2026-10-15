'use client';

import { useEffect } from 'react';
import { hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { installAppDiagnosticMonitor } from '@/lib/utils/app-diagnostics';

/** Retain device-local reliability events without a floating help control. */
export function AppDiagnosticsMonitor() {
  useEffect(() => {
    if (!hasAndroidOfflineBridge()) return;
    return installAppDiagnosticMonitor();
  }, []);
  return null;
}
