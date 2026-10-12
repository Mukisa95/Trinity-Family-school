'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useNavigation } from '@/lib/contexts/navigation-context';
import { LoadingOverlay } from '@/components/ui/loading-indicator';
import { setRouteContentPending } from '@/lib/navigation/navigation-work';
import { hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';

/** Route progress never prevents interaction with records already rendered. */
export function NavigationContent({ children }: { children: ReactNode }) {
  const { isNavigating, destination, isSlow } = useNavigation();
  const pathname = usePathname();
  const content = useRef<HTMLDivElement>(null);
  const owner = useRef({});
  useLayoutEffect(() => {
    const root = content.current;
    if (!root || !hasAndroidOfflineBridge()) return;
    let frame: number | undefined;
    const check = () => {
      frame = undefined;
      // Field loaders cannot restart navigation or block saved records.
      const loading = [...root.querySelectorAll<HTMLElement>('[data-route-content-pending]')]
        .some(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden');
      setRouteContentPending(owner.current, loading);
    };
    const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(check); };
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-route-content-pending'] });
    check();
    return () => {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      setRouteContentPending(owner.current, false);
    };
  }, [pathname]);
  return <div className="relative isolate min-h-[16rem]" data-navigation-content>
    <LoadingOverlay isLoading={isNavigating} destination={destination || undefined} slow={isSlow} />
    <div ref={content} className="relative z-0" aria-busy={isNavigating}>{children}</div>
  </div>;
}
