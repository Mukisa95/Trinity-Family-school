import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sms/wiza-balance
 * Fetches the Wiza SMS wallet balance using the new v1 API with Basic Auth.
 */
export async function GET() {
  const username = process.env.WIZA_SMS_USERNAME || '';
  const password = process.env.WIZA_SMS_PASSWORD || '';

  if (!username || !password) {
    return NextResponse.json({
      success: false,
      balance: null,
      currency: 'UGX',
      message: 'Wiza SMS credentials not configured. Set WIZA_SMS_USERNAME and WIZA_SMS_PASSWORD in Vercel environment variables.',
    });
  }

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  try {
    const response = await fetch('https://api.wizasms.ug/v1/sms/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      // No caching — always fetch live balance
      cache: 'no-store',
    });

    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        balance: null,
        currency: 'UGX',
        message: `Wiza API error (${response.status}): ${responseText.substring(0, 100)}`,
      });
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json({
        success: false,
        balance: null,
        currency: 'UGX',
        message: 'Wiza API returned invalid format.',
      });
    }

    // The balance can be in data.balance, data.data.balance, or data.wallet_balance
    const balance =
      data?.balance ??
      data?.data?.balance ??
      data?.wallet_balance ??
      data?.amount ??
      null;

    return NextResponse.json({
      success: true,
      balance: balance !== null ? String(balance) : null,
      currency: data?.currency || 'UGX',
      raw: data,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      balance: null,
      currency: 'UGX',
      message: `Failed to fetch balance: ${msg}`,
    });
  }
}
