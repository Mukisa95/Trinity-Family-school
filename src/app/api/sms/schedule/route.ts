import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import {
  nextSmsRunAt,
  smsQueueId,
  type SmsScheduleType,
} from '@/lib/scheduler/schedule-times';
import { SCHEDULED_DISPATCH_QUEUE } from '@/lib/server/scheduled-dispatch-queue';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const TYPES = new Set<SmsScheduleType>(['once', 'weekly', 'dates']);

function canSendSms(user: Awaited<ReturnType<typeof requireAppUser>>['user']) {
  return GranularPermissionService.canPerformAction(user, 'bulk_sms', 'send', 'send_sms');
}

async function wizaBalance() {
  const username = process.env.WIZA_SMS_USERNAME || '';
  const password = process.env.WIZA_SMS_PASSWORD || '';
  if (!username || !password) return null;
  try {
    const response = await fetch('https://api.wizasms.ug/v1/sms/balance', {
      headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = await response.json();
    const value = Number(data.balance ?? data.wallet_balance ?? data.amount);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canSendSms(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to view scheduled SMS.' }, { status: 403 });
    }
    const snapshot = await getFirestore(getFirebaseAdminApp())
      .collection('scheduledSMS')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const jobs = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data(),
      createdAt: document.data().createdAt?.toDate?.().toISOString?.() || null,
      sentAt: document.data().sentAt?.toDate?.().toISOString?.() || document.data().sentAt || null,
      lastSentAt: document.data().lastSentAt?.toDate?.().toISOString?.() || document.data().lastSentAt || null,
      nextRunAt: document.data().nextRunAt?.toDate?.().toISOString?.() || null,
    }));
    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to load scheduled SMS.' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canSendSms(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to schedule SMS.' }, { status: 403 });
    }
    const body = await request.json();
    const type = TYPES.has(body?.type) ? body.type as SmsScheduleType : null;
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const schedule = body?.schedule && typeof body.schedule === 'object' ? body.schedule as Record<string, unknown> : null;
    const recipients = body?.recipients && typeof body.recipients === 'object' ? body.recipients : null;
    if (!type || !message || message.length > 4000 || !schedule || !recipients) {
      return NextResponse.json({ error: 'The SMS schedule is incomplete.' }, { status: 400 });
    }

    const requestedStatus = body.status === 'draft' ? 'draft' : 'scheduled';
    const estimatedCost = Math.max(0, Number(body.estimatedCost || 0));
    const balance = await wizaBalance();
    const status = requestedStatus === 'scheduled' && balance !== null && balance < estimatedCost
      ? 'draft'
      : requestedStatus;
    const nextRunAt = nextSmsRunAt(type, schedule, new Date(Date.now() - 1000));
    if (status === 'scheduled' && !nextRunAt) {
      return NextResponse.json({ error: 'Choose at least one future SMS time.' }, { status: 400 });
    }

    const db = getFirestore(getFirebaseAdminApp());
    const jobRef = db.collection('scheduledSMS').doc();
    const queueRef = db.collection(SCHEDULED_DISPATCH_QUEUE).doc(smsQueueId(jobRef.id));
    const batch = db.batch();
    batch.set(jobRef, {
      type,
      channel: 'sms',
      message,
      recipients,
      schedule,
      estimatedSMSCount: Math.max(0, Number(body.estimatedSMSCount || 0)),
      estimatedCost,
      status,
      lockedAmount: status === 'scheduled' ? estimatedCost : 0,
      nextRunAt: nextRunAt ? Timestamp.fromDate(nextRunAt) : null,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: null,
      schoolId: (actor.user as { schoolId?: string }).schoolId || 'unknown',
      createdBy: actor.decoded.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (status === 'scheduled' && nextRunAt) {
      batch.set(queueRef, {
        channel: 'sms',
        sourceId: jobRef.id,
        status: 'scheduled',
        dueAt: Timestamp.fromDate(nextRunAt),
        leaseUntil: null,
        attempts: 0,
        createdBy: actor.decoded.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    return NextResponse.json({
      success: true,
      id: jobRef.id,
      status,
      balanceSufficient: status === requestedStatus,
      walletBalance: balance,
      nextRunAt: nextRunAt?.toISOString() || null,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to schedule this SMS.' }, { status });
  }
}
