import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try { const actor = await requireAppUser(request); return NextResponse.json({ user: actor.user }, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) {
    const reason = error instanceof Error ? error.message : '';
    const code = (error as { code?: string })?.code || '';
    const invalid = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED', 'ACCOUNT_INACTIVE'].includes(reason)
      || ['auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found', 'auth/invalid-id-token', 'auth/argument-error'].includes(code);
    return NextResponse.json({ error: invalid ? 'Sign in is required.' : 'Session verification is temporarily unavailable.' },
      { status: invalid ? 401 : 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
