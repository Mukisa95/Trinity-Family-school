import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp, getFirestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { resolveNotificationDestination } from '@/lib/notifications/notification-destinations';
import { pushQueueId } from '@/lib/scheduler/schedule-times';
import { SCHEDULED_DISPATCH_QUEUE } from '@/lib/server/scheduled-dispatch-queue';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const TARGETS = new Set(['all', 'admins', 'fees_staff']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function canSendNotifications(user: Awaited<ReturnType<typeof requireAppUser>>['user']) {
  return GranularPermissionService.canPerformAction(
    user,
    'notifications',
    'list',
    'send_notification',
  );
}

function scheduleTimeInKampala(date: string, time: string) {
  return new Date(`${date}T${time}:00+03:00`);
}

function serializeJob(document: QueryDocumentSnapshot) {
  const data = document.data();
  return {
    id: document.id,
    title: data.payload?.title || '',
    body: data.payload?.body || '',
    target: data.target || (Array.isArray(data.userIds) ? 'custom' : ''),
    status: data.status || 'scheduled',
    runAt: data.runAt?.toDate?.().toISOString?.() || null,
    createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
    sentAt: data.sentAt?.toDate?.().toISOString?.() || null,
    lastError: data.lastError || null,
    createdBy: data.createdBy || '',
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canSendNotifications(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to schedule notifications.' }, { status: 403 });
    }
    const jobsQuery = getFirestore(getFirebaseAdminApp())
      .collection('scheduledNotifications');
    const snapshot = actor.user.role === 'Admin'
      ? await jobsQuery.orderBy('createdAt', 'desc').limit(100).get()
      : await jobsQuery.where('createdBy', '==', actor.decoded.uid).orderBy('createdAt', 'desc').limit(100).get();
    const jobs = snapshot.docs.map(serializeJob);
    return NextResponse.json({ jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to load scheduled notifications.' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canSendNotifications(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to schedule notifications.' }, { status: 403 });
    }
    const body = await request.json();
    const title = typeof body?.payload?.title === 'string' ? body.payload.title.trim() : '';
    const message = typeof body?.payload?.body === 'string' ? body.payload.body.trim() : '';
    const date = typeof body?.scheduleDate === 'string' ? body.scheduleDate : '';
    const time = typeof body?.scheduleTime === 'string' ? body.scheduleTime : '';
    const target = typeof body?.target === 'string' && TARGETS.has(body.target) ? body.target : null;
    const userIds = Array.isArray(body?.userIds)
      ? Array.from(new Set(body.userIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0 && id.length <= 160))).slice(0, 500)
      : [];

    if (!title || title.length > 160 || !message || message.length > 4000) {
      return NextResponse.json({ error: 'Add a subject and message within the allowed length.' }, { status: 400 });
    }
    if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
      return NextResponse.json({ error: 'Choose a valid date and time.' }, { status: 400 });
    }
    if (!target && !userIds.length) {
      return NextResponse.json({ error: 'Choose notification recipients.' }, { status: 400 });
    }
    const runAt = scheduleTimeInKampala(date, time);
    if (!Number.isFinite(runAt.getTime()) || runAt.getTime() < Date.now() + 60_000) {
      return NextResponse.json({ error: 'Choose a time at least one minute in the future.' }, { status: 400 });
    }
    if (runAt.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Notifications can be scheduled up to one year ahead.' }, { status: 400 });
    }

    let destination = null;
    if (body.destination) {
      try {
        destination = resolveNotificationDestination(body.destination);
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Choose a valid destination.' }, { status: 400 });
      }
    }

    const db = getFirestore(getFirebaseAdminApp());
    const ref = db.collection('scheduledNotifications').doc();
    const queueRef = db.collection(SCHEDULED_DISPATCH_QUEUE).doc(pushQueueId(ref.id));
    const batch = db.batch();
    batch.set(ref, {
      status: 'scheduled',
      kind: 'manual',
      payload: { title, body: message },
      ...(target ? { target } : { userIds }),
      ...(destination ? { destination } : {}),
      urgency: ['low', 'high'].includes(body.urgency) ? body.urgency : 'normal',
      runAt: Timestamp.fromDate(runAt),
      timezone: 'Africa/Kampala',
      createdBy: actor.decoded.uid,
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(queueRef, {
      channel: 'push',
      sourceId: ref.id,
      status: 'scheduled',
      dueAt: Timestamp.fromDate(runAt),
      leaseUntil: null,
      attempts: 0,
      createdBy: actor.decoded.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({ success: true, id: ref.id, runAt: runAt.toISOString() }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to schedule this notification.' }, { status });
  }
}
