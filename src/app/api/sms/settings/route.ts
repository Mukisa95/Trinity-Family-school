import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sms/settings
 * Returns the current Wiza SMS credentials from env vars (password masked).
 */
export async function GET() {
  return NextResponse.json({
    username: process.env.WIZA_SMS_USERNAME || '',
    password: '',                              // never expose password
    senderId: process.env.WIZA_SMS_SENDER_ID || 'TRINITY',
    isDefault: true,
    updatedAt: null,
  });
}

/**
 * POST /api/sms/settings
 * Credentials are managed via Vercel environment variables.
 * This endpoint validates the supplied credentials against the Wiza SMS API.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, senderId, action } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    // If the client is just testing the connection, do a lightweight probe
    if (action === 'test') {
      try {
        const testRes = await fetch('https://wizasms.ug/API/V1/send-bulk-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            senderId: senderId || 'TRINITY',
            message: 'Connection test',
            recipients: '256700000000',
          }),
        });
        const testData = await testRes.json();
        // success=false with auth error means bad credentials; any response at all means reachable
        const reachable = testRes.ok || testRes.status < 500;
        const authOk = testData?.success || (testData?.messages && !testData.messages.toLowerCase().includes('invalid'));
        return NextResponse.json({
          success: reachable,
          message: reachable
            ? (authOk ? 'Connection successful — credentials are valid.' : `API reachable: ${testData?.messages || 'Check credentials.'}`)
            : 'Could not reach Wiza SMS API.',
        });
      } catch (err) {
        return NextResponse.json({ success: false, message: `Connection failed: ${err instanceof Error ? err.message : 'unknown'}` });
      }
    }

    // For a save action we instruct the admin to set env vars in Vercel
    return NextResponse.json({
      success: false,
      message:
        'To update Wiza SMS credentials, go to your Vercel project → Settings → Environment Variables and set: WIZA_SMS_USERNAME, WIZA_SMS_PASSWORD, WIZA_SMS_SENDER_ID, then redeploy.',
    }, { status: 200 });
  } catch (error) {
    console.error('Error in SMS settings route:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
