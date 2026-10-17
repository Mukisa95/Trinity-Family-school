import { NextRequest, NextResponse } from 'next/server';
import { schoolWebAppManifest } from '@/lib/pwa/manifest';
import { websiteFirebaseProjectId } from '@/lib/android/download';

/** Public installation metadata only; never account or pupil data. */
export function GET(request: NextRequest) {
  return NextResponse.json(schoolWebAppManifest(websiteFirebaseProjectId(), request.nextUrl.searchParams.get('portal') === 'parent'), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  });
}
