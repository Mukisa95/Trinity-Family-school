// This file is disabled for static export - functionality moved to Firebase Functions
export default function handler() {
  return new Response('API route disabled for static export', { status: 404 });
}

/*
// This API route is disabled for static export deployment
// SMS bulk functionality is handled by Firebase Functions instead

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = false;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, recipients, sentBy } = body;

    if (!message || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Message and recipients are required' }, { status: 400 });
    }

    // Simple response for local development
    return NextResponse.json({
      success: true,
      message: `Messages sent to ${recipients.length} recipients`,
      recipientCount: recipients.length,
      messageId: `local_${Date.now()}`,
      cost: 'UGX 0.0000',
      details: {
        total: recipients.length,
        successful: recipients.length,
        failed: 0,
        blocked: 0,
        mtnBlocked: 0
      }
    });

  } catch (error) {
    return NextResponse.json({ error: 'SMS service error' }, { status: 500 });
  }
}
*/ 