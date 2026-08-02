import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import {
  hasNotificationAccess,
  resolveNotificationParticipant,
} from '@/lib/server/notification-participants';
import { requireAppUser } from '@/lib/server/app-auth';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

export const dynamic = 'force-dynamic';
export const revalidate = false;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAppUser(request);
    const { id } = await params;
    await ensureServerFirestoreAuth();
    const db = getFirestore(getFirebaseAdminApp());
    const notification = await db.collection('notifications').doc(id).get();
    if (!notification.exists) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });

    const data = notification.data() as Record<string, unknown>;
    if (!hasNotificationAccess(data, actor.decoded.uid)) {
      return NextResponse.json({ error: 'You do not have access to this notification.' }, { status: 403 });
    }

    const recipientIds = Array.isArray(data.recipientIds)
      ? [...new Set(data.recipientIds.filter((value): value is string => typeof value === 'string' && value.length > 0))]
      : [];
    const canViewNames = actor.user.role !== 'Parent';
    if (!canViewNames) {
      return NextResponse.json({
        canViewNames: false,
        total: recipientIds.length || Number((data.deliveryStats as any)?.total || 0),
        recipients: [],
      });
    }

    const page = Math.max(0, Number(request.nextUrl.searchParams.get('page') || '0'));
    const pageSize = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('pageSize') || '50')));
    const pageIds = recipientIds.slice(page * pageSize, page * pageSize + pageSize);
    const recipients = await Promise.all(pageIds.map(userId => resolveNotificationParticipant(db, userId)));

    return NextResponse.json({
      canViewNames: true,
      total: recipientIds.length,
      nextPage: (page + 1) * pageSize < recipientIds.length ? page + 1 : null,
      recipients,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load recipients.';
    const status = message === 'AUTH_REQUIRED' || message === 'APP_AUTH_REQUIRED' ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in again to view recipients.' : message }, { status });
  }
}
