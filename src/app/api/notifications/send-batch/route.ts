import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json(
    { error: 'Deprecated. Use /api/notifications/send-push instead.' },
    { status: 410 }
  );
}
export async function GET() {
  return NextResponse.json({ status: 'deprecated', replacement: '/api/notifications/send-push' });
}
