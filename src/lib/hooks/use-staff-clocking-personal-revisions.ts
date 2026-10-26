'use client';

import { useEffect } from 'react';
import { skipToken, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { doc, onSnapshot } from '@/lib/access/scoped-firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import type { StaffClockingPersonalRevisions } from '@/lib/staff-clocking/contracts';

// Schedule/status/history/notification consumers share ONE own-staff listener.
// It contains change counters only; no attendance or other employees' data.
const listeners = new Map<string, { count: number; stop: () => void; clients: Map<QueryClient, number>; value?: StaffClockingPersonalRevisions }>();

export function useStaffClockingPersonalRevisions(enabled: boolean, targetStaffId?: string) {
  const { user, isAuthenticated } = useAuth();
  const client = useQueryClient();
  const staffId = targetStaffId || user?.staffId;
  const identity = JSON.stringify([user?.id, staffId]);
  const key = ['staff-clocking-personal-revisions', identity];
  useEffect(() => {
    if (!enabled || !isAuthenticated || !staffId || !user?.id || (user.role !== 'Admin' && user.staffId !== staffId) || user.role === 'Parent') return;
    let listener = listeners.get(identity);
    if (!listener) {
      const clients = new Map<QueryClient, number>();
      const stop = onSnapshot(doc(db, 'staffClockingPersonalRevisions', staffId), { includeMetadataChanges: true }, snapshot => {
        if (!snapshot.exists() && snapshot.metadata.fromCache) return;
        const value = (snapshot.exists() ? snapshot.data() : {}) as StaffClockingPersonalRevisions;
        const entry = listeners.get(identity);
        if (entry) entry.value = value;
        clients.forEach((_, owner) => { owner.setQueryData(key, value); owner.setQueryData([...key, 'error'], null); });
      }, error => clients.forEach((_, owner) => owner.setQueryData([...key, 'error'], error.message)));
      listener = { count: 0, stop, clients };
      listeners.set(identity, listener);
    }
    listener.count += 1;
    listener.clients.set(client, (listener.clients.get(client) || 0) + 1);
    if (listener.value) client.setQueryData(key, listener.value);
    return () => {
      const count = (listener!.clients.get(client) || 1) - 1;
      if (count) listener!.clients.set(client, count); else listener!.clients.delete(client);
      if (--listener!.count === 0) { listener!.stop(); listeners.delete(identity); }
    };
  }, [client, enabled, identity, isAuthenticated, user?.id, user?.staffId, user?.role, staffId]);
  const result = useQuery<StaffClockingPersonalRevisions>({ queryKey: key, queryFn: skipToken, enabled: false, staleTime: Infinity, gcTime: 24 * 60 * 60 * 1000 });
  const error = useQuery<string | null>({ queryKey: [...key, 'error'], queryFn: skipToken, enabled: false, staleTime: Infinity });
  return { ...result, error: error.data ? new Error('Unable to synchronize your clocking status. Reconnect and try again.') : null };
}
