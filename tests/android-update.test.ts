import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/android/release/route';
import release from '../src/lib/android/app-release.json';

test('update discovery identifies the exact signed school release without caching', async () => {
  const response = GET(new NextRequest(`${release.websiteOrigin}/api/android/release`));
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const data = await response.json();
  assert.equal(data.applicationId, release.applicationId); assert.equal(data.firebaseProjectId, release.firebaseProjectId);
  assert.equal(data.versionCode, release.versionCode); assert.equal(data.sha256, release.sha256); assert.equal(data.bytes, release.bytes);
  assert.equal(data.downloadUrl, `${release.websiteOrigin}/api/android/download`); assert.equal(data.minSdk, 26);
});
test('another school website or database receives no updater manifest', () => {
  assert.equal(GET(new NextRequest('https://another-school.example/api/android/release')).status, 404);
  const previous = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'another-school';
  try { assert.equal(GET(new NextRequest(`${release.websiteOrigin}/api/android/release`)).status, 404); }
  finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; else process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = previous; }
});
test('update discovery checks the public website behind deployment proxies', () => {
  const headers = { 'x-forwarded-host': new URL(release.websiteOrigin).host, 'x-forwarded-proto': 'https' };
  assert.equal(GET(new NextRequest('http://localhost:9009/api/android/release', { headers })).status, 200);
  assert.equal(GET(new NextRequest('http://localhost:9009/api/android/release', { headers: { ...headers, 'x-forwarded-host': 'ganda.example' } })).status, 404);
});
