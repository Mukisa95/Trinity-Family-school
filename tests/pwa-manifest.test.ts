import assert from 'node:assert/strict';
import test from 'node:test';
import { schoolWebAppManifest } from '../src/lib/pwa/manifest';
import { NextRequest } from 'next/server';
import { GET as getManifest } from '../src/app/api/pwa/manifest/route';

test('installed identities use the correct school and retain stable staff/parent launch paths', () => {
  for (const [project, name] of [['trinity-family-schools', 'Trinity Live'], ['trinity-family-ganda', 'Trinity Ganda']]) {
    const staff = schoolWebAppManifest(project), parent = schoolWebAppManifest(project, true);
    assert.equal(staff.name, name); assert.equal(staff.start_url, '/'); assert.equal(staff.id, '/');
    assert.equal(parent.name, `${name} Parent`); assert.equal(parent.start_url, '/parent'); assert.equal(parent.id, '/parent');
    assert.equal(staff.display, 'standalone'); assert.equal(staff.orientation, 'any');
  }
});

test('public install metadata returns the manifest content type and the parent launch identity', async () => {
  const response = getManifest(new NextRequest('https://school.invalid/api/pwa/manifest?portal=parent'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/manifest+json');
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600');
  const data = await response.json();
  assert.equal(data.start_url, '/parent'); assert.equal(data.id, '/parent');
  assert.equal(data.name, schoolWebAppManifest(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools', true).name);
});
