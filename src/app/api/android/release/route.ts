import { NextRequest } from 'next/server';
import { androidReleaseForSite, androidRequestOrigin, websiteFirebaseProjectId } from '@/lib/android/download';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: NextRequest) {
  const development = process.env.NODE_ENV === 'development';
  const release = androidReleaseForSite(androidRequestOrigin(request.headers, request.nextUrl.origin, development), websiteFirebaseProjectId(), development);
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!release) return Response.json({ error: 'No Android release for this school.' }, { status: 404, headers });
  return Response.json({ ...release, minSdk: (release as typeof release & { minSdk?: number }).minSdk ?? 26, downloadUrl: `${release.websiteOrigin}/api/android/download` }, { headers });
}
