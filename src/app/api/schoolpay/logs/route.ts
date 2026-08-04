import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!GranularPermissionService.canAccessPage(actor.user, 'fees', 'schoolpay_feed')) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to view SchoolPay diagnostics.' },
        { status: 403 },
      );
    }
    const url = new URL(request.url);
    const requestedLimit = parseInt(url.searchParams.get('limit') || '100', 10);
    const maxResults = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 500))
      : 100;
    const snapshot = await getFirestore(getFirebaseAdminApp())
      .collection('schoolPaySyncLogs')
      .orderBy('timestamp', 'desc')
      .limit(maxResults)
      .get();
    const logs = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('❌ [SchoolPay Logs] Error fetching logs:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403
        : 500;
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
