import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const readiness = readFileSync('src/lib/parent-offline/readiness.ts', 'utf8');
const card = readFileSync('src/components/parent/parent-offline-readiness-card.tsx', 'utf8');
const worker = readFileSync('public/sw.js', 'utf8');
const manifest = JSON.parse(readFileSync('public/parent-manifest.json', 'utf8')) as { start_url?: string };

test('parent offline status exposes real progress and per-dataset update times', () => {
  assert.match(readiness, /percentage:\s*expected \? Math\.round/);
  assert.match(card, /role="progressbar"/);
  assert.match(card, /Last updated on this device/);
  assert.match(card, /dataset\.preparedAt/);
});

test('a confirmed child without a bank account is omitted instead of reported missing', () => {
  assert.match(readiness, /if \(!banking \|\| banking\.account\)/);
  assert.match(readiness, /No attendance records yet/);
  assert.match(readiness, /No released results yet/);
  assert.match(readiness, /No fees recorded/);
});

test('parent installations and legacy root launches both have offline entry points', () => {
  assert.equal(manifest.start_url, '/parent');
  assert.match(worker, /PARENT_OFFLINE_LAUNCH_ROUTE = '\/'/);
  assert.match(worker, /fall back to the root shell/);
});
