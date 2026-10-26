'use client';
import Link from 'next/link';
import { createContext, useContext } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import type { DetailRange } from '@/lib/staff-clocking/details-contracts';

export const StaffClockingDetailLinksContext = createContext<(DetailRange & { view?: string }) | null>(null);
export function StaffClockingStaffLink({ staffId, name, peers, date }: { staffId: string; name: string; peers: string[]; date?: string }) {
  const range = useContext(StaffClockingDetailLinksContext);
  const { user } = useAuth();
  const params = new URLSearchParams(range ? { from: range.from, to: range.to, period: ({ daily: 'day', weekly: 'week', monthly: 'month', termly: 'term' } as Record<string, string>)[range.view || ''] || 'custom' } : date ? { date } : {});
  return <Link className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/staff-clocking/staff/${encodeURIComponent(staffId)}?${params}`} onClick={() => {
    try { sessionStorage.setItem(`staff-clocking-peers:${user?.id}`, JSON.stringify([...new Set(peers)].slice(0, 500))); } catch { /* Single-profile navigation still works. */ }
  }}>{name}</Link>;
}
