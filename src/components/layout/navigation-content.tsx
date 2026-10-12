'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useNavigation } from '@/lib/contexts/navigation-context';
import { LoadingOverlay } from '@/components/ui/loading-indicator';
import { setRouteContentPending } from '@/lib/navigation/navigation-work';

/** Only the old page is busy; the application header and menus stay usable. */
export function NavigationContent({ children }: { children: ReactNode }) {
  const { isNavigating, destination, isSlow, timedOut, reportContentState, retryNavigation } = useNavigation();
  const pathname = usePathname();
  const content = useRef<HTMLDivElement>(null);
  const owner = useRef({});
  useLayoutEffect(() => {
    const root = content.current;
    if (!root) return;
    let frame: number | undefined;
    const check = () => {
      frame = undefined;
      const loading = root.childElementCount === 0 || [...root.querySelectorAll<HTMLElement>('[data-workspace-page-loading]')]
        .some(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden');
      setRouteContentPending(owner.current, loading);
      if (document.querySelector('[data-workspace-visible="false"]')) return;
      reportContentState(loading, `${location.pathname}${location.search}${location.hash}`);
    };
    const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(check); };
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-workspace-page-loading'] });
    const poll = isNavigating ? setInterval(schedule, 100) : undefined;
    check();
    window.addEventListener('resize', schedule);
    window.addEventListener('trinity-workspace-visible', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      observer.disconnect(); clearInterval(poll); if (frame !== undefined) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule); window.removeEventListener('trinity-workspace-visible', schedule);
      document.removeEventListener('visibilitychange', schedule);
      setRouteContentPending(owner.current, false);
    };
  }, [pathname, isNavigating, reportContentState]);
  useEffect(() => {
    if (isNavigating) content.current?.setAttribute('inert', '');
    else content.current?.removeAttribute('inert');
  }, [isNavigating]);
  return <div className="relative isolate min-h-[16rem]" data-navigation-content>
    <LoadingOverlay isLoading={isNavigating} destination={destination || undefined} slow={isSlow} timedOut={timedOut} onRetry={retryNavigation} />
    <div ref={content} className="relative z-0" aria-busy={isNavigating}>{children}</div>
  </div>;
}
