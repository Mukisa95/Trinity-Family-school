'use client';

import type { ReactNode } from 'react';
import { useDutyServiceOffline } from '@/lib/hooks/use-duty-service-data';

/** Viewing controls remain available; editing resumes when the device reconnects. */
export function DutyOnlineAction({ children }: { children: ReactNode }) {
  return useDutyServiceOffline() ? null : <>{children}</>;
}
