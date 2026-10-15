import { NextRequest } from 'next/server';
import { androidRequestOrigin } from '@/lib/android/download';
import { androidCredentialAssociation } from '@/lib/server/android-credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: NextRequest) {
  const association = androidCredentialAssociation(androidRequestOrigin(request.headers, request.nextUrl.origin));
  return Response.json(association ? [association] : [], {
    status: association ? 200 : 404,
    headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' },
  });
}
