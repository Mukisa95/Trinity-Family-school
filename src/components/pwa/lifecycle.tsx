'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { isHomeScreenApp } from '@/lib/pwa/platform';
import { recordAppDiagnostic } from '@/lib/utils/app-diagnostics';

export function HomeScreenLifecycle() {
  const path = usePathname();
  const { user } = useAuth();
  useEffect(() => {
    if (!isHomeScreenApp() || window.TrinityOffline) return;
    document.documentElement.dataset.homeScreen = 'true';
    recordAppDiagnostic('home_screen_started');
    return () => { delete document.documentElement.dataset.homeScreen; };
  }, []);
  useEffect(() => {
    if (!isHomeScreenApp() || window.TrinityOffline || user && path !== '/notifications') return;
    const badge = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    void badge.clearAppBadge?.().catch(() => {});
  }, [path, user]);
  return null;
}
