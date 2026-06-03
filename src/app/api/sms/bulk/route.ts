import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Build the Basic Auth header from env vars. */
function getBasicAuth(): { auth: string; senderId: string } | null {
  const username = process.env.WIZA_SMS_USERNAME || '';
  const password = process.env.WIZA_SMS_PASSWORD || '';
  if (!username || !password) return null;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  return { auth, senderId: process.env.WIZA_SMS_SENDER_ID || 'TRINITY' };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, recipients } = body;

    if (!message || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Message and recipients are required' }, { status: 400 });
    }

    const creds = getBasicAuth();
    if (!creds) {
      return NextResponse.json(
        { success: false, error: 'Wiza SMS credentials not configured. Set WIZA_SMS_USERNAME and WIZA_SMS_PASSWORD in Vercel environment variables.' },
        { status: 500 }
      );
    }

    // Format phone numbers to international format (+256XXXXXXXXX)
    const formattedContacts = recipients.map((phone: string | number) => {
      let p = String(phone).replace(/[\s\-\(\)]/g, '');
      if (!p.startsWith('+')) {
        if (p.startsWith('0')) p = '256' + p.substring(1);
        else if (!p.startsWith('256')) p = '256' + p;
        p = '+' + p;
      }
      return p;
    });

    console.log(`Sending SMS via new Wiza API to ${formattedContacts.length} recipients`);

    const response = await fetch('https://api.wizasms.ug/v1/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds.auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contacts: formattedContacts,
        message,
        sender_id: creds.senderId,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Wiza SMS HTTP error:', response.status, responseText);
      return NextResponse.json(
        { success: false, error: `Wiza SMS API returned ${response.status}: ${responseText.substring(0, 200)}` },
        { status: 502 }
      );
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Wiza SMS non-JSON response:', responseText);
      return NextResponse.json(
        { success: false, error: 'Wiza API returned invalid format (non-JSON). Temporary provider issue.', message: responseText.substring(0, 200) },
        { status: 502 }
      );
    }

    console.log('Wiza SMS API response:', data);

    // The new API uses a "status" field or "success" field
    const success = data.success === true || data.status === 'success' || response.ok;

    if (!success) {
      return NextResponse.json(
        { success: false, error: data.message || data.error || 'Wiza SMS API error', recipientCount: 0, messageId: '' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Messages sent successfully to ${recipients.length} recipients`,
      recipientCount: recipients.length,
      messageId: data.data?.message_id || data.message_id || `wiza_${Date.now()}`,
      cost: data.data?.cost ? `UGX ${data.data.cost}` : undefined,
      details: {
        total: recipients.length,
        successful: data.data?.recipients_count || recipients.length,
        failed: 0,
        blocked: 0,
        mtnBlocked: 0,
      },
    });
  } catch (error) {
    console.error('SMS bulk send error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: `Server exception: ${msg}`, message: msg, recipientCount: 0, messageId: '' }, { status: 500 });
  }
}