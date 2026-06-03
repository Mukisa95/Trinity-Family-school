import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sms/auto-topup
 * Returns a link to the Wiza SMS dashboard for top-up.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    dashboardUrl: 'https://wizasms.ug',
    message: 'Visit the Wiza SMS dashboard to top up your balance.',
  });
}