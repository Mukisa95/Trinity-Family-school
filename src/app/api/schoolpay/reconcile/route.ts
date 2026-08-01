import { NextRequest, NextResponse } from 'next/server';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { SchoolPayIntegrationService } from '@/lib/services/schoolpay-integration.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function enumerateDates(dateFrom: string, dateTo: string): string[] {
  if (!DATE_PATTERN.test(dateFrom) || !DATE_PATTERN.test(dateTo)) {
    throw new Error('Dates must use YYYY-MM-DD format.');
  }
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error('The recovery date range is invalid.');
  }

  const dates: string[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
    if (dates.length > 14) throw new Error('A maximum of 14 days can be recovered at once.');
  }
  return dates;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!GranularPermissionService.canAccessPage(actor.user, 'fees', 'schoolpay_feed')) {
      return jsonError('You do not have permission to recover SchoolPay payments.', 403);
    }

    const body = await request.json() as { date?: string; dateFrom?: string; dateTo?: string };
    const dateFrom = `${body.dateFrom || body.date || ''}`.trim();
    const dateTo = `${body.dateTo || body.date || ''}`.trim();
    const dates = enumerateDates(dateFrom, dateTo);

    await ensureServerFirestoreAuth();
    const results = [];
    for (const date of dates) {
      results.push(await SchoolPayIntegrationService.syncTransactionsForDate(date, { force: true }));
    }

    const totals = {
      processed: results.reduce((sum, result) => sum + result.processed, 0),
      duplicates: results.reduce((sum, result) => sum + result.duplicates, 0),
      skipped: results.reduce((sum, result) => sum + result.skipped, 0),
      failed: results.reduce((sum, result) => sum + result.failed, 0),
    };

    const actorName = actor.user.username || `${actor.user.firstName || ''} ${actor.user.lastName || ''}`.trim();
    await getFirestore(getFirebaseAdminApp()).collection('historyLogs').add({
      a: 'reconcile',
      e: 'schoolpay',
      rid: `${dateFrom}:${dateTo}`,
      rl: `Recovered SchoolPay payments for ${dateFrom}${dateTo !== dateFrom ? ` to ${dateTo}` : ''}`,
      m: { dates, totals },
      uid: actor.user.id,
      un: actorName,
      ur: actor.user.role,
      ts: Timestamp.now(),
    });

    return NextResponse.json({
      success: results.every(result => result.success),
      dates,
      totals,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SchoolPay recovery failed';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403
        : /date|maximum/i.test(message) ? 400
          : 500;
    console.error('[SchoolPay Reconcile] Recovery failed:', error);
    return jsonError(message, status);
  }
}
