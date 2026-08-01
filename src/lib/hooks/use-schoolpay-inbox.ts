'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, onSnapshot, query, where, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { acquireSharedFirestoreSubscription } from '@/lib/firebase/firestore-subscription-registry';
import type { SchoolPayInboxRecord } from '@/types/schoolpay-inbox';

function asIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toISOString();
  }
  return '';
}

function normaliseInboxRecord(id: string, data: DocumentData): SchoolPayInboxRecord {
  return {
    ...data,
    id,
    amount: Number(data.amount || 0),
    attempts: Number(data.attempts || 0),
    paymentDate: asIso(data.paymentDate),
    receivedAt: asIso(data.receivedAt),
    updatedAt: asIso(data.updatedAt),
    recordedAt: data.recordedAt ? asIso(data.recordedAt) : undefined,
    assignedAt: data.assignedAt ? asIso(data.assignedAt) : undefined,
  } as SchoolPayInboxRecord;
}

export const schoolPayInboxKeys = {
  unresolved: (scope: string) => ['schoolpay-inbox', 'unresolved', scope] as const,
};

export function useSchoolPayInbox() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const canView = !!user && user.role !== 'Parent' &&
    GranularPermissionService.canAccessPage(user, 'fees', 'schoolpay_feed');
  const scope = isAuthenticated && canView ? `${user?.id || 'staff'}:${user?.role || ''}` : '';
  const queryKey = useMemo(() => schoolPayInboxKeys.unresolved(scope), [scope]);

  useEffect(() => {
    if (!scope) return;

    return acquireSharedFirestoreSubscription<SchoolPayInboxRecord[]>({
      key: `schoolpay-inbox:unresolved:${scope}`,
      queryClient,
      queryKey,
      subscribe: ({ next, error }) => {
        const unresolvedQuery = query(
          collection(db, 'schoolPayInboundTransactions'),
          where('status', 'in', ['unmatched', 'failed']),
        );

        return onSnapshot(unresolvedQuery, { includeMetadataChanges: true }, snapshot => {
          const records = snapshot.docs
            .map(item => normaliseInboxRecord(item.id, item.data()))
            .sort((a, b) => (b.paymentDate || b.receivedAt).localeCompare(a.paymentDate || a.receivedAt));
          next(records);
        }, error);
      },
      onError: error => console.error('SchoolPay inbox listener error:', error),
    });
  }, [queryClient, queryKey, scope]);

  const cached = queryClient.getQueryData<SchoolPayInboxRecord[]>(queryKey);
  const result = useQuery({
    queryKey,
    queryFn: async () => queryClient.getQueryData<SchoolPayInboxRecord[]>(queryKey) || [],
    enabled: false,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    initialData: cached,
  });

  return {
    ...result,
    data: scope ? (result.data || []) : [],
    isLoading: !!scope && result.data === undefined,
    canView,
  };
}
