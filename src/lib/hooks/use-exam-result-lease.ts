import { useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/auth-context';
import type { ExamLease } from '@/types';
import { ExamLeaseService, type ExamLeaseToken } from '@/lib/services/exam-lease.service';

const RENEW_EVERY_MS = 2 * 60_000;

function newLeaseId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useExamResultLease(examId: string) {
  const { user, isAuthenticated } = useAuth();
  const leaseIdRef = useRef(newLeaseId());
  const [lease, setLease] = useState<ExamLease | null>(null);
  const [holder, setHolder] = useState<ExamLease | null>(null);
  const [status, setStatus] = useState<'loading' | 'held' | 'blocked' | 'offline' | 'error'>('loading');
  const canAttempt = isAuthenticated && !!user && (user.role === 'Admin' || user.role === 'Staff') && !!examId;

  useEffect(() => {
    if (!canAttempt || !user) {
      setLease(null);
      setHolder(null);
      setStatus('blocked');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('offline');
      return;
    }

    let disposed = false;
    const token: ExamLeaseToken = { lockedByUid: user.id, leaseId: leaseIdRef.current };
    const acquire = async () => {
      try {
        const outcome = await ExamLeaseService.acquire(examId, { id: user.id, name: user.firstName || user.username }, token.leaseId);
        if (disposed) return;
        if (outcome.acquired) {
          setLease(outcome.lease);
          setHolder(null);
          setStatus('held');
        } else {
          setLease(null);
          setHolder(outcome.holder);
          setStatus('blocked');
        }
      } catch {
        if (!disposed) setStatus('error');
      }
    };
    void acquire();

    const unsubscribe = onSnapshot(ExamLeaseService.ref(examId), snapshot => {
      if (disposed) return;
      if (!snapshot.exists()) {
        setLease(null);
        setStatus('loading');
        void acquire();
        return;
      }
      const observed = ExamLeaseService.normalize(examId, snapshot.data());
      if (observed.lockedByUid === token.lockedByUid && observed.leaseId === token.leaseId && !ExamLeaseService.isExpired(observed)) {
        setLease(observed);
        setHolder(null);
        setStatus('held');
      } else {
        setLease(null);
        setHolder(observed);
        setStatus('blocked');
      }
    }, () => {
      if (!disposed) setStatus('error');
    });

    const renew = () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine) return;
      void acquire();
    };
    const interval = window.setInterval(renew, RENEW_EVERY_MS);
    const onVisibility = () => { if (document.visibilityState === 'visible') renew(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      void ExamLeaseService.release(examId, token).catch(() => undefined);
    };
  }, [canAttempt, examId, user]);

  // A listener does not fire simply because time has elapsed, so schedule an
  // expiry transition locally and make the editor read-only before any save.
  useEffect(() => {
    if (!lease) return;
    const delay = Math.max(0, new Date(lease.expiresAt).getTime() - Date.now() + 15_000);
    const timer = window.setTimeout(() => {
      if (ExamLeaseService.isExpired(lease)) {
        setLease(null);
        setStatus('blocked');
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [lease]);

  const token = useMemo<ExamLeaseToken | undefined>(() =>
    status === 'held' && lease && user
      ? { lockedByUid: user.id, leaseId: lease.leaseId }
      : undefined,
  [lease, status, user]);

  return {
    canEdit: !!token,
    status,
    holder,
    token,
  };
}
