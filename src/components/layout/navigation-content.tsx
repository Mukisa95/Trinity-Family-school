'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigation } from '@/lib/contexts/navigation-context';
import { LoadingOverlay } from '@/components/ui/loading-indicator';

/** Only the old page is busy; the application header and menus stay usable. */
export function NavigationContent({ children }: { children: ReactNode }) {
  const { isNavigating, destination, isSlow } = useNavigation();
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isNavigating) content.current?.setAttribute('inert', '');
    else content.current?.removeAttribute('inert');
  }, [isNavigating]);
  return <div className="relative isolate min-h-[16rem]" data-navigation-content>
    <LoadingOverlay isLoading={isNavigating} destination={destination || undefined} slow={isSlow} />
    <div ref={content} className="relative z-0" aria-busy={isNavigating}>{children}</div>
  </div>;
}
