'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { isAppleMobile } from '@/lib/pwa/platform';
import { useVisualViewport } from '@/lib/hooks/use-visual-viewport';
import { RemoveScroll } from 'react-remove-scroll';

/** Keep Apple mobile chrome outside the workspace's scrolling content. */
export function MobileWorkspaceFrame({ children, className, routeKey }: { children: ReactNode; className?: string; routeKey?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(isAppleMobile()), []);
  const viewport = useVisualViewport(false, apple);
  useLayoutEffect(() => {
    if (!apple) return;
    frame.current?.querySelectorAll<HTMLElement>(':scope > main, [data-parent-workspace-scroll]').forEach(element => { element.scrollTop = 0; element.scrollLeft = 0; });
  }, [apple, routeKey]);
  // The touch guard also stops edge bounce on WebKit builds without CSS support.
  // Independent global overlays retain their own scrolling and modal locks.
  return <RemoveScroll ref={frame} enabled={apple} allowPinchZoom noRelative noIsolation forwardProps>
    <div data-apple-mobile-workspace={apple ? '' : undefined} className={className}
      style={viewport ? { height: viewport.height, top: viewport.top } : undefined}>{children}</div>
  </RemoveScroll>;
}
