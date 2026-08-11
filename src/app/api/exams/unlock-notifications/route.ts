import { randomUUID } from 'crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import {
  getServerPushSubscriptionsForUsers,
  sendServerWebPush,
} from '@/lib/server/push-notifications';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const CLOCK_SKEW_MS = 15_000;

type PendingUnlockRequest = {
  id: string;
  userId: string;
  classId: string;
  examName: string;
};

function getExamId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const examId = value.trim();
  return examId && examId.length <= 200 && !examId.includes('/') ? examId : null;
}

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  return Number.NaN;
}

function isActiveLock(lock: Record<string, unknown>): boolean {
  const expiresAt = toMillis(lock.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now() - CLOCK_SKEW_MS;
}

function canRecordExamResults(user: Parameters<typeof GranularPermissionService.canPerformAction>[0]): boolean {
  return GranularPermissionService.canPerformAction(user, 'exams', 'results', 'enter_results')
    || GranularPermissionService.canPerformAction(user, 'exams', 'results', 'edit_results');
}

function requestId(examId: string, userId: string) {
  return Buffer.from(`${examId}:${userId}`).toString('base64url');
}

/** Register this signed-in user for one notification when a locked exam is released. */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canRecordExamResults(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to record exam results.' }, { status: 403 });
    }

    const body = await request.json();
    const examId = getExamId(body?.examId);
    if (!examId) return NextResponse.json({ error: 'A valid examId is required.' }, { status: 400 });

    const adminDb = getFirestore(getFirebaseAdminApp());
    const [examSnapshot, lockSnapshot, subscriptions] = await Promise.all([
      adminDb.collection('exams').doc(examId).get(),
      adminDb.collection('examLocks').doc(examId).get(),
      getServerPushSubscriptionsForUsers([actor.decoded.uid]),
    ]);
    if (!examSnapshot.exists) return NextResponse.json({ error: 'EXAM_NOT_FOUND' }, { status: 404 });
    if (!subscriptions.length) {
      return NextResponse.json({ error: 'PUSH_NOT_ACTIVE' }, { status: 409 });
    }

    const lock = lockSnapshot.exists ? lockSnapshot.data() as Record<string, unknown> : null;
    if (!lock || !isActiveLock(lock)) {
      return NextResponse.json({ error: 'EXAM_UNLOCKED' }, { status: 409 });
    }
    if (lock.lockedByUid === actor.decoded.uid) {
      return NextResponse.json({ error: 'EXAM_LOCK_OWNED' }, { status: 409 });
    }

    const exam = examSnapshot.data() || {};
    const waitRef = adminDb.collection('examUnlockNotificationRequests').doc(requestId(examId, actor.decoded.uid));
    await waitRef.set({
      examId,
      classId: typeof exam.classId === 'string' ? exam.classId : '',
      examName: typeof exam.name === 'string' ? exam.name.slice(0, 180) : 'this exam',
      userId: actor.decoded.uid,
      lockedByUid: String(lock.lockedByUid || ''),
      lockLeaseId: String(lock.leaseId || ''),
      status: 'pending',
      requestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403 : 500;
    console.error('Exam unlock notification request failed:', error);
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to request an exam unlock notification.' }, { status });
  }
}

/** Deliver any pending requests after the active editor has released their exam lease. */
export async function PUT(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canRecordExamResults(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to record exam results.' }, { status: 403 });
    }

    const body = await request.json();
    const examId = getExamId(body?.examId);
    if (!examId) return NextResponse.json({ error: 'A valid examId is required.' }, { status: 400 });

    const adminDb = getFirestore(getFirebaseAdminApp());
    const lockRef = adminDb.collection('examLocks').doc(examId);
    const requestsQuery = adminDb.collection('examUnlockNotificationRequests').where('examId', '==', examId);
    const dispatchId = randomUUID();
    const pendingRequests = await adminDb.runTransaction(async transaction => {
      const lockSnapshot = await transaction.get(lockRef);
      const lock = lockSnapshot.exists ? lockSnapshot.data() as Record<string, unknown> : null;
      if (lock && isActiveLock(lock)) return null;

      const waiters = await transaction.get(requestsQuery);
      const pending = waiters.docs.filter(waiter => waiter.data().status === 'pending');
      pending.forEach(waiter => transaction.update(waiter.ref, {
        status: 'dispatching',
        dispatchId,
        dispatchStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }));
      return pending.map<PendingUnlockRequest>(waiter => {
        const data = waiter.data();
        return {
          id: waiter.id,
          userId: typeof data.userId === 'string' ? data.userId : '',
          classId: typeof data.classId === 'string' ? data.classId : '',
          examName: typeof data.examName === 'string' ? data.examName : 'this exam',
        };
      });
    });

    if (pendingRequests === null) {
      return NextResponse.json({ success: true, skipped: true, reason: 'EXAM_STILL_LOCKED' }, { status: 409 });
    }
    if (!pendingRequests.length) return NextResponse.json({ success: true, recipients: 0, pushSent: 0 });

    const recipientIds = pendingRequests.map(waiter => waiter.userId).filter(Boolean);
    const subscriptions = await getServerPushSubscriptionsForUsers(recipientIds);
    const firstRequest = pendingRequests[0];
    const classId = firstRequest.classId;
    const clickUrl = `/exams/${encodeURIComponent(examId)}/record-results?classId=${encodeURIComponent(classId)}`;
    let push = { accepted: 0, failed: subscriptions.length };
    try {
      push = await sendServerWebPush(subscriptions, {
        title: 'Results recording is ready',
        body: `The Record Results page for ${firstRequest.examName} is now available.`,
        icon: '/trinity-logo-192.png',
        badge: '/icons/trinity-badge-72.png',
        tag: `exam-ready-${examId}`,
        url: clickUrl,
        requireInteraction: true,
      }, { urgency: 'high' });
    } catch (error) {
      console.warn('Exam unlock Web Push unavailable:', error);
    }

    const batch = adminDb.batch();
    pendingRequests.forEach(waiter => batch.update(
      adminDb.collection('examUnlockNotificationRequests').doc(waiter.id),
      {
        status: 'notified',
        notifiedAt: FieldValue.serverTimestamp(),
        pushSent: push.accepted,
        pushFailed: push.failed,
        updatedAt: FieldValue.serverTimestamp(),
      },
    ));
    await batch.commit();

    return NextResponse.json({
      success: true,
      recipients: recipientIds.length,
      pushSent: push.accepted,
      pushFailed: push.failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403 : 500;
    console.error('Exam unlock notification dispatch failed:', error);
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to send exam unlock notifications.' }, { status });
  }
}
