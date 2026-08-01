import { NextRequest, NextResponse } from 'next/server';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';

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
    await ensureServerFirestoreAuth();
    const { collection, limit, orderBy, query, getDocs } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');

    const url = new URL(request.url);
    const maxResults = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

    const q = query(
      collection(db, 'schoolPaySyncLogs'),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
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
