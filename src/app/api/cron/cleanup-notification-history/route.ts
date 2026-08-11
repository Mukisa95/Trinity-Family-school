import { NextRequest, NextResponse } from 'next/server';
import { Timestamp, getFirestore, type Query } from 'firebase-admin/firestore';

import { getFirebaseAdminApp } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = false;
export const maxDuration = 60;

const HISTORY_RETENTION_MS = 15 * 24 * 60 * 60 * 1000;
const COMPLETED_SCHEDULE_RETENTION_MS = 24 * 60 * 60 * 1000;
const DELETE_BATCH_SIZE = 400;

function isAuthorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return request.headers.get('x-cron-secret') === secret || bearer === secret;
}

async function deleteExpired(query: Query, label: string) {
  const snapshot = await query.limit(DELETE_BATCH_SIZE).get();
  if (snapshot.empty) return { label, deleted: 0, hasMore: false };
  const batch = getFirestore(getFirebaseAdminApp()).batch();
  snapshot.docs.forEach(document => batch.delete(document.ref));
  await batch.commit();
  return { label, deleted: snapshot.size, hasMore: snapshot.size === DELETE_BATCH_SIZE };
}

export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised cron request.' }, { status: 401 });
  }

  try {
    const db = getFirestore(getFirebaseAdminApp());
    const historyCutoff = Timestamp.fromDate(new Date(Date.now() - HISTORY_RETENTION_MS));
    const scheduleCutoff = Timestamp.fromDate(new Date(Date.now() - COMPLETED_SCHEDULE_RETENTION_MS));
    // Only targeted, ordered range queries are used. The inbox's device cache
    // retains history locally, so database retention does not erase it from a
    // user who has already loaded it.
    const results = await Promise.all([
      deleteExpired(db.collection('notificationDeliveries').where('sentAt', '<=', historyCutoff).orderBy('sentAt', 'asc'), 'notificationDeliveries'),
      deleteExpired(db.collection('notifications').where('createdAt', '<=', historyCutoff).orderBy('createdAt', 'asc'), 'notifications'),
      deleteExpired(db.collection('pushNotificationLog').where('sentAt', '<=', historyCutoff).orderBy('sentAt', 'asc'), 'pushNotificationLog'),
      deleteExpired(db.collection('notificationReplyRequests').where('createdAt', '<=', historyCutoff).orderBy('createdAt', 'asc'), 'notificationReplyRequests'),
      deleteExpired(db.collection('scheduledNotifications').where('status', '==', 'sent').where('sentAt', '<=', scheduleCutoff).orderBy('sentAt', 'asc'), 'sentScheduledNotifications'),
      deleteExpired(db.collection('scheduledNotifications').where('status', '==', 'cancelled').where('updatedAt', '<=', scheduleCutoff).orderBy('updatedAt', 'asc'), 'cancelledScheduledNotifications'),
      deleteExpired(db.collection('scheduledDispatchQueue').where('status', '==', 'completed').where('completedAt', '<=', scheduleCutoff).orderBy('completedAt', 'asc'), 'completedDispatchQueue'),
    ]);
    return NextResponse.json({
      success: true,
      deleted: results.reduce((total, result) => total + result.deleted, 0),
      hasMore: results.some(result => result.hasMore),
      results,
    });
  } catch (error) {
    console.error('Notification history cleanup failed:', error);
    return NextResponse.json({ error: 'Unable to clean notification history.' }, { status: 500 });
  }
}
