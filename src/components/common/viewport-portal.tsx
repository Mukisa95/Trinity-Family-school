'use client';

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { RemoveScroll } from 'react-remove-scroll';
import { useVisualViewport } from '@/lib/hooks/use-visual-viewport';

/** Keep floating controls outside scrolling ancestors and inside Safari's visible viewport. */
export function ViewportPortal({ children, zIndex, lockScroll = false, followZoom = true, className = '' }: { children: ReactNode; zIndex: number; lockScroll?: boolean; followZoom?: boolean; className?: string }) {
  const viewport = useVisualViewport(followZoom);

  if (!viewport) return null;
  return createPortal(<RemoveScroll enabled={lockScroll} allowPinchZoom noRelative className={`viewport-overlay ${className}`}
    style={{ position: 'fixed', ...viewport, zIndex, transform: 'translateZ(0)', pointerEvents: 'none' }}>
    {children}
  </RemoveScroll>, document.body);
}
