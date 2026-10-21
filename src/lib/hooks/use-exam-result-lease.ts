import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot } from '@/lib/access/scoped-firestore';
import { useAuth } from '@/lib/contexts/auth-context';
import type { ExamLease } from '@/types';
import { ExamLeaseService, type ExamLeaseAttempt, type ExamLeaseOverride, type ExamLeaseToken } from '@/lib/services/exam-lease.service';
import { isAndroidOffline } from '@/lib/offline/android-app-shell';
import { EXAM_LEASE_RENEW_MS, EXAM_LEASE_CLOCK_SKEW_MS } from '@/lib/utils/exam-lease-policy';

let pageClientId: string | undefined;

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
  const userNameRef = useRef(userName);
  userNameRef.current = userName;
  // A disposed acquisition must never release a newer effect's lock.
  const leaseId = useMemo(newLeaseId, [examId, userId]);

  useEffect(() => {
    if (!canAttempt || !userId) {
      setLease(null);
      setHolder(null);
      setStatus('blocked');
      return;
    }
    let disposed = false;
    let suspended = false;
    const clientId = pageClientId ||= newLeaseId();
    const token: ExamLeaseToken = { lockedByUid: userId, leaseId };
    let inFlight: Promise<ExamLeaseToken> | undefined;
    const attempt = async (): Promise<ExamLeaseToken> => {
      if (disposed || suspended) throw new Error('The exam editor is no longer active.');
      if (!navigator.onLine || isAndroidOffline()) { setStatus('offline'); throw new Error('Reconnect before saving.'); }
      let outcome: ExamLeaseAttempt;
      try {
        outcome = await ExamLeaseService.acquire(examId, { id: userId, name: userNameRef.current }, token.leaseId, clientId);
      } catch (error) {
        if (!disposed) setStatus('error');
        throw error;
      }
      if (disposed || suspended) {
        // React may replay the effect with the same token. Its replacement
        // still owns that token, so only release an abandoned acquisition.
        if (outcome.acquired && (suspended || acquireRef.current?.leaseId !== token.leaseId)) {
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
    if (document.visibilityState !== 'hidden') void acquire().catch(() => undefined);

    const requestAcquire = () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine || isAndroidOffline()) return;
      // A server release may arrive while an older transaction is finishing.
      const pending = inFlight;
      if (pending) void pending.catch(() => { if (!disposed && !suspended) void acquire().catch(() => undefined); });
      else void acquire().catch(() => undefined);
    };
    const unsubscribe = onSnapshot(ExamLeaseService.ref(examId), { includeMetadataChanges: true }, snapshot => {
      if (disposed || suspended || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      const observed = snapshot.exists() ? ExamLeaseService.normalize(examId, snapshot.data()) : null;
      if (!observed || ExamLeaseService.isExpired(observed)) {
        setLease(null);
        setHolder(null);
        setStatus('loading');
        requestAcquire();
        return;
      }
      if (observed.lockedByUid === token.lockedByUid && observed.clientId === clientId && observed.leaseId !== token.leaseId) {
        setLease(null);
        setHolder(null);
        setStatus('loading');
        requestAcquire();
        return;
      }
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
      if (suspended || document.visibilityState === 'hidden' || !navigator.onLine || isAndroidOffline()) return;
      void acquire().catch(() => undefined);
    };
    const interval = window.setInterval(renew, EXAM_LEASE_RENEW_MS);
    const onVisibility = () => { if (document.visibilityState === 'visible') renew(); };
    const onPageHide = () => {
      suspended = true;
      setLease(null);
      setHolder(null);
      setStatus('loading');
      void ExamLeaseService.release(examId, token).catch(() => undefined);
    };
    const onPageShow = () => { suspended = false; renew(); };
    const onOffline = () => { setLease(null); setHolder(null); setStatus('offline'); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', renew);
    window.addEventListener('offline', onOffline);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('trinity-android-connectivity', renew);

    return () => {
      disposed = true;
      if (acquireRef.current === owner) acquireRef.current = null;
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', renew);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('trinity-android-connectivity', renew);
      void ExamLeaseService.release(examId, token).catch(() => undefined);
    };
  }, [canAttempt, examId, leaseId, userId]);

  const ensureLease = useCallback(async () => {
    if (!acquireRef.current) throw new Error('Editing permission is unavailable. Your entries are still on this page.');
    return acquireRef.current.acquire();
  }, []);

  // A listener does not fire simply because time has elapsed, so schedule an
  // expiry transition locally and make the editor read-only before any save.
  useEffect(() => {
    const observed = holder || lease;
    if (!observed) return;
    const deadline = ExamLeaseService.deadline(observed);
    const delay = Number.isFinite(deadline) ? Math.max(0, deadline - Date.now() + EXAM_LEASE_CLOCK_SKEW_MS + 1) : 0;
    const timer = window.setTimeout(() => {
      if (ExamLeaseService.isExpired(observed)) {
        setLease(null);
        setHolder(null);
        setStatus('loading');
        if (document.visibilityState !== 'hidden' && navigator.onLine && !isAndroidOffline()) void acquireRef.current?.acquire().catch(() => undefined);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [lease, holder]);

  const token = useMemo<ExamLeaseToken | undefined>(() =>
    status === 'held' && lease && lease.examId === examId && lease.lockedByUid === userId
      ? { lockedByUid: lease.lockedByUid, leaseId: lease.leaseId }
      : undefined,
  [examId, lease, status, userId]);

  // A positive lease held by somebody else is the only evidence that should
  // stop an authorised editor. Loading, offline, and listener/transaction
  // errors mean Firestore could not establish the answer; those states must
  // remain saveable instead of pretending that another editor is present.
  const hasConfirmedOtherEditor = status === 'blocked' && holder !== null && holder.examId === examId && !ExamLeaseService.isExpired(holder);
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
    holder: hasConfirmedOtherEditor ? holder : null,
    isSameAccount: hasConfirmedOtherEditor && holder.lockedByUid === userId,
    token,
    ensureLease,
    canOverride: canAttempt && hasConfirmedOtherEditor,
    override,
  };
}
