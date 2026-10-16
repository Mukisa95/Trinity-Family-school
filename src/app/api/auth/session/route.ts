import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try { const actor = await requireAppUser(request); return NextResponse.json({ user: actor.user }, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch { return NextResponse.json({ error: 'Sign in is required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } }); }
}
