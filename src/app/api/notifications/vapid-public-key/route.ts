import { NextResponse } from 'next/server';

import { getServerVapidDetails } from '@/lib/server/vapid-config';

export const dynamic = 'force-dynamic';
export const revalidate = false;

/** The VAPID public key is intentionally public and is required by PushManager. */
export async function GET() {
  const { publicKey } = getServerVapidDetails();
  return NextResponse.json(
    { publicKey },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
