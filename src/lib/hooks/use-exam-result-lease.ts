import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot } from '@/lib/access/scoped-firestore';
import { useAuth } from '@/lib/contexts/auth-context';
import type { ExamLease } from '@/types';
import { ExamLeaseService, type ExamLeaseAttempt, type ExamLeaseOverride, type ExamLeaseToken } from '@/lib/services/exam-lease.service';
import { isAndroidOffline } from '@/lib/offline/android-app-shell';

const RENEW_EVERY_MS = 2 * 60_000;

function newLeaseId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useExamResultLease(examId: string) {
  const { user, isAuthenticated } = useAuth();
  const acquireRef = useRef<{ acquire: () => Promise<ExamLeaseToken>; leaseId: string } | null>(null);
  const [lease, setLease] = useState<ExamLease | null>(null);
  const [holder, setHolder] = useState<ExamLease | null>(null);
  const [status, setStatus] = useState<'loading' | 'held' | 'blocked' | 'offline' | 'error'>('loading');
  const canAttempt = isAuthenticated && !!user && (user.role === 'Admin' || user.role === 'Staff') && !!examId;
  const userId = user?.id;
  const userName = user?.firstName || user?.username || 'Authorised editor';
  // A disposed acquisition must never release a newer effect's lock.
  const leaseId = useMemo(newLeaseId, [examId, userId, userName]);

  useEffect(() => {
    if (!canAttempt || !userId) {
      setLease(null);
      setHolder(null);
      setStatus('blocked');
      return;
    }
    let disposed = false;
    const token: ExamLeaseToken = { lockedByUid: userId, leaseId };
    let inFlight: Promise<ExamLeaseToken> | undefined;
    const attempt = async (): Promise<ExamLeaseToken> => {
      if (disposed) throw new Error('The exam editor is no longer active.');
      if (!navigator.onLine || isAndroidOffline()) { setStatus('offline'); throw new Error('Reconnect before saving.'); }
      let outcome: ExamLeaseAttempt;
      try {
        outcome = await ExamLeaseService.acquire(examId, { id: userId, name: userName }, token.leaseId);
      } catch (error) {
        if (!disposed) setStatus('error');
        throw error;
      }
      if (disposed) {
        // React may replay the effect with the same token. Its replacement
        // still owns that token, so only release an abandoned acquisition.
        if (outcome.acquired && acquireRef.current?.leaseId !== token.leaseId) {
          void ExamLeaseService.release(examId, token).catch(() => undefined);
        }
        throw new Error('The exam editor is no longer active.');
      }
      if (outcome.acquired) {
        setLease(outcome.lease);
        setHolder(null);
        setStatus('held');
        return token;
      }
      setLease(null);
      setHolder(outcome.holder);
      setStatus('blocked');
      throw new Error(`This result is being edited by ${outcome.holder?.lockedByName || 'another editor'}. Review the editing lock before saving.`);
    };
    const acquire = () => {
      if (!inFlight) inFlight = attempt().finally(() => { inFlight = undefined; });
      return inFlight;
    };
    const owner = { acquire, leaseId };
    acquireRef.current = owner;
    void acquire().catch(() => undefined);

    const unsubscribe = onSnapshot(ExamLeaseService.ref(examId), snapshot => {
      if (disposed) return;
      if (!snapshot.exists()) {
        setLease(null);
        setStatus('loading');
        void acquire().catch(() => undefined);
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
      if (document.visibilityState === 'hidden' || !navigator.onLine || isAndroidOffline()) return;
      void acquire().catch(() => undefined);
    };
    const interval = window.setInterval(renew, RENEW_EVERY_MS);
    const onVisibility = () => { if (document.visibilityState === 'visible') renew(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', renew);
    window.addEventListener('trinity-android-connectivity', renew);

    return () => {
      disposed = true;
      if (acquireRef.current === owner) acquireRef.current = null;
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', renew);
      window.removeEventListener('trinity-android-connectivity', renew);
      void ExamLeaseService.release(examId, token).catch(() => undefined);
    };
  }, [canAttempt, examId, leaseId, userId, userName]);

  const ensureLease = useCallback(async () => {
    if (!acquireRef.current) throw new Error('Editing permission is unavailable. Your entries are still on this page.');
    return acquireRef.current.acquire();
  }, []);

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
    status === 'held' && lease && lease.examId === examId && lease.lockedByUid === userId
      ? { lockedByUid: lease.lockedByUid, leaseId: lease.leaseId }
      : undefined,
  [examId, lease, status, userId]);

  // A positive lease held by somebody else is the only evidence that should
  // stop an authorised editor. Loading, offline, and listener/transaction
  // errors mean Firestore could not establish the answer; those states must
  // remain saveable instead of pretending that another editor is present.
  const hasConfirmedOtherEditor = status === 'blocked' && holder !== null;
  const canSave = canAttempt && !hasConfirmedOtherEditor;
  const override = useMemo<ExamLeaseOverride | undefined>(() =>
    canAttempt && user
      ? {
          lockedByUid: user.id,
          lockedByName: user.firstName || user.username || 'Authorised editor',
          leaseId,
        }
      : undefined,
  [canAttempt, leaseId, user]);

  return {
    canEdit: !!token,
    canSave,
    status,
    holder,
    token,
    ensureLease,
    canOverride: canAttempt && hasConfirmedOtherEditor,
    override,
  };
}
