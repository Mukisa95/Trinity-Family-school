'use client';

import { useEffect, useState } from 'react';
import { detectAppPlatform, type AppPlatform } from '@/lib/app-platform';
import { hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';

export function useAppPlatform() {
  const [platform, setPlatform] = useState<AppPlatform | null>(null);
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const update = () => setPlatform(detectAppPlatform({
      userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
      nativeAndroid: hasAndroidOfflineBridge(), standalone: media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      mobileHint: Boolean((navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile),
    }));
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return platform;
}
