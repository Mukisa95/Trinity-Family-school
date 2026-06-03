import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sms/wiza-recharge
 * Initiates a mobile money collection via Wiza SMS API (POST /v1/sms/buy).
 * Body: { phone: string, amount: number }
 * - phone: Ugandan mobile money number (e.g. +256700000000)
 * - amount: Amount in UGX to credit (Wiza applies a 1% processing fee)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, amount } = body;

    if (!phone || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Phone number and a positive amount are required.' },
        { status: 400 }
      );
    }

    const username = process.env.WIZA_SMS_USERNAME || '';
    const password = process.env.WIZA_SMS_PASSWORD || '';

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Wiza SMS credentials not configured. Set WIZA_SMS_USERNAME and WIZA_SMS_PASSWORD in Vercel environment variables.' },
        { status: 500 }
      );
    }

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    // Normalize phone number to international format
    let normalizedPhone = String(phone).replace(/[\s\-\(\)]/g, '');
    if (!normalizedPhone.startsWith('+')) {
      if (normalizedPhone.startsWith('0')) normalizedPhone = '256' + normalizedPhone.substring(1);
      else if (!normalizedPhone.startsWith('256')) normalizedPhone = '256' + normalizedPhone;
      normalizedPhone = '+' + normalizedPhone;
    }

    console.log(`Initiating Wiza SMS recharge: ${normalizedPhone} → UGX ${amount}`);

    const response = await fetch('https://api.wizasms.ug/v1/sms/buy', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        amount: Number(amount),
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Wiza API returned ${response.status}: ${responseText.substring(0, 200)}` },
        { status: 502 }
      );
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Wiza API returned invalid format.', message: responseText.substring(0, 200) },
        { status: 502 }
      );
    }

    const success = data.success === true || data.status === 'success';

    if (!success) {
      return NextResponse.json(
        { success: false, error: data.message || data.error || 'Recharge request failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: data.message || `Recharge of UGX ${amount} initiated successfully. Check your mobile money prompt.`,
      data: data.data || data,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Wiza recharge error:', error);
    return NextResponse.json(
      { success: false, error: `Server exception: ${msg}` },
      { status: 500 }
    );
  }
}
