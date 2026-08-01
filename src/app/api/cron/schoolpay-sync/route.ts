import { NextRequest, NextResponse } from 'next/server';
import { SchoolPayIntegrationService } from '@/lib/services/schoolpay-integration.service';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

function formatDateInKampala(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to format SchoolPay sync date');
  }

  return `${year}-${month}-${day}`;
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid date range');
  }

  if (startDate > endDate) {
    throw new Error('dateFrom cannot be after dateTo');
  }

  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(formatDateInKampala(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function buildDefaultDates(daysBack: number): string[] {
  const dates: string[] = [];
  for (let offset = 0; offset < daysBack; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    dates.push(formatDateInKampala(date));
  }
  return dates.reverse();
}

export async function GET(request: NextRequest) {
  const secret =
    request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const hasValidSecret = !!cronSecret && (
    secret === cronSecret || authHeader === `Bearer ${cronSecret}`
  );

  if (!hasValidSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!SchoolPayIntegrationService.isConfigured()) {
    return NextResponse.json(
      { success: false, error: 'SchoolPay integration is not configured' },
      { status: 500 }
    );
  }

  try {
    await ensureServerFirestoreAuth();
    const date = request.nextUrl.searchParams.get('date');
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');
    const daysBack = Math.min(
      Math.max(parseInt(request.nextUrl.searchParams.get('daysBack') || '3', 10), 1),
      14
    );

    let datesToSync: string[];
    if (date) {
      datesToSync = [date];
    } else if (dateFrom && dateTo) {
      datesToSync = enumerateDates(dateFrom, dateTo);
    } else {
      datesToSync = buildDefaultDates(daysBack);
    }

    const results = [];
    for (const dateValue of datesToSync) {
      const result = await SchoolPayIntegrationService.syncTransactionsForDate(dateValue);
      results.push(result);
    }

    return NextResponse.json({
      success: results.every((result) => result.success),
      syncedDates: datesToSync,
      totals: {
        processed: results.reduce((sum, result) => sum + result.processed, 0),
        duplicates: results.reduce((sum, result) => sum + result.duplicates, 0),
        skipped: results.reduce((sum, result) => sum + result.skipped, 0),
        failed: results.reduce((sum, result) => sum + result.failed, 0),
      },
      results,
    });
  } catch (error) {
    console.error('❌ [SchoolPay Cron Sync] Error syncing SchoolPay transactions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
