import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { androidReleaseForSite, androidRequestOrigin, websiteFirebaseProjectId } from '@/lib/android/download';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function download(request: NextRequest, head: boolean) {
  const development = process.env.NODE_ENV === 'development';
  const release = androidReleaseForSite(androidRequestOrigin(request.headers, request.nextUrl.origin, development), websiteFirebaseProjectId(), development);
  if (!release) return new Response('Android download is not available for this school yet.', { status: 404 });
  try {
    const apk = await readFile(path.join(process.cwd(), 'android-releases', release.filename));
    if (apk.length !== release.bytes || createHash('sha256').update(apk).digest('hex') !== release.sha256) throw new Error('Release artifact mismatch');
    return new Response(head ? null : new Uint8Array(apk), { headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${release.filename}"`,
      'Content-Length': String(release.bytes),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-APK-SHA256': release.sha256,
    } });
  } catch { return new Response('Android download is temporarily unavailable. Please try again.', { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
export function GET(request: NextRequest) { return download(request, false); }
export function HEAD(request: NextRequest) { return download(request, true); }
