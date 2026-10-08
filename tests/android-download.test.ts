import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { androidReleaseForSite, androidRequestOrigin } from '../src/lib/android/download';
import release from '../src/lib/android/app-release.json';
import { GET, HEAD } from '../src/app/api/android/download/route';

test('only the configured school website and database receive the APK', () => {
  assert.equal(androidReleaseForSite(release.websiteOrigin, release.firebaseProjectId)?.applicationId, release.applicationId);
  assert.equal(androidReleaseForSite(release.websiteOrigin, 'another-school-project'), null);
  assert.equal(androidReleaseForSite('https://another-school.example', release.firebaseProjectId), null);
  assert.equal(androidReleaseForSite(`${release.websiteOrigin}.evil.test`, release.firebaseProjectId), null);
  assert.equal(androidReleaseForSite(`${release.websiteOrigin}@evil.test`, release.firebaseProjectId), null);
  assert.equal(androidReleaseForSite(release.websiteOrigin.replace('https:', 'http:'), release.firebaseProjectId), null);
});
test('local preview is explicit and still checks the school database', () => {
  assert.equal(androidReleaseForSite('http://localhost:9009', release.firebaseProjectId), null);
  assert.equal(androidReleaseForSite('http://localhost:9009', release.firebaseProjectId, true)?.appName, release.appName);
  assert.equal(androidReleaseForSite('http://localhost:9009', 'another-project', true), null);
  assert.equal(androidReleaseForSite('http://localhost.evil.test:9009', release.firebaseProjectId, true), null);
});
test('download sends the exact signed artifact as an attachment', async () => {
  const previous = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = release.firebaseProjectId;
  try {
    const response = await GET(new NextRequest(`${release.websiteOrigin}/api/android/download`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'application/vnd.android.package-archive');
    assert.equal(response.headers.get('Content-Disposition'), `attachment; filename="${release.filename}"`);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(bytes.length, release.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), release.sha256);
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; else process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = previous; }
});
test('HEAD allows checking the APK size without downloading it', async () => {
  const previous = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = release.firebaseProjectId;
  try {
    const response = await HEAD(new NextRequest(`${release.websiteOrigin}/api/android/download`));
    assert.equal(response.status, 200); assert.equal(response.headers.get('Content-Length'), String(release.bytes));
    assert.equal(response.headers.get('X-APK-SHA256'), release.sha256); assert.equal(await response.text(), '');
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; else process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = previous; }
});
test('a different website or database cannot silently distribute Trinity Live', async () => {
  const previous = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = release.firebaseProjectId;
  try {
    assert.equal((await GET(new NextRequest('https://another-school.example/api/android/download'))).status, 404);
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'ganda-project';
    assert.equal((await GET(new NextRequest(`${release.websiteOrigin}/api/android/download`))).status, 404);
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; else process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = previous; }
});
test('deployment proxy headers use the public school origin rather than the internal Next.js URL', async () => {
  const previous = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = release.firebaseProjectId;
  try {
    const headers = { 'x-forwarded-host': new URL(release.websiteOrigin).host, 'x-forwarded-proto': 'https', host: 'internal-deployment.example' };
    assert.equal((await HEAD(new NextRequest('http://localhost:9009/api/android/download', { headers }))).status, 200);
    assert.equal((await HEAD(new NextRequest(`${release.websiteOrigin}/api/android/download`, { headers: { ...headers, 'x-forwarded-host': 'another-school.example' } }))).status, 404);
    assert.equal((await HEAD(new NextRequest(`${release.websiteOrigin}/api/android/download`, { headers: { ...headers, 'x-forwarded-proto': 'http' } }))).status, 404);
    assert.equal(androidRequestOrigin(new Headers({ host: 'school.example@evil.test' })), '');
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; else process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = previous; }
});
