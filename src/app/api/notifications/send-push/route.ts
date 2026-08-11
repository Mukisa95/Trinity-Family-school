import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { requireAppUser, sanitizeSystemUser } from '@/lib/server/app-auth';
import {
  getServerPushSubscriptionsForUsers,
  resolvePushTargetToUserIdsAdmin,
  sendServerWebPush,
} from '@/lib/server/push-notifications';
import {
  getNotificationDestination,
  normalizeInternalNotificationUrl,
  resolveNotificationDestination,
  type ResolvedNotificationDestination,
  type NotificationDestinationSelection,
} from '@/lib/notifications/notification-destinations';
import { resolveNotificationParticipant } from '@/lib/server/notification-participants';


export const dynamic = 'force-dynamic';
export const revalidate = false;
export const maxDuration = 60;


export async function POST(request: NextRequest) {
  try {
    const requestedBody = await request.json();
    const scheduledJobId = typeof requestedBody?.scheduledJobId === 'string'
      ? requestedBody.scheduledJobId
      : null;
    const adminDb = getFirestore(getFirebaseAdminApp());
    let actor: Awaited<ReturnType<typeof requireAppUser>>;
    let body = requestedBody;
    let scheduledMetadata: { jobId: string; scheduledFor?: string } | null = null;


    if (scheduledJobId) {
      const cronSecret = process.env.CRON_SECRET;
      const suppliedSecret = request.headers.get('x-cron-secret');
