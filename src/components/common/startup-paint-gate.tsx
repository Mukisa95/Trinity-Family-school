'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { afterStartupPaint, isNonLoginPublicPath } from '@/lib/performance/startup-display';

/** Keep public SSR content; yield a loader paint before protected app mounting. */
export function StartupPaintGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [painted, setPainted] = useState(false);
  useEffect(() => afterStartupPaint(() => setPainted(true)), []);
  return painted || isNonLoginPublicPath(pathname) ? children : null;
}
