import { NextResponse } from 'next/server';
// This route has been superseded by /api/notifications/subscribe
// Keeping this file to return a clear deprecation message so any
// old code hitting this endpoint knows to update.
export async function POST() {
  return NextResponse.json(
    { error: 'Deprecated. Use /api/notifications/subscribe instead.' },
    { status: 410 }
  );
}
export async function GET() {
  return NextResponse.json({ status: 'deprecated', replacement: '/api/notifications/subscribe' });
}
