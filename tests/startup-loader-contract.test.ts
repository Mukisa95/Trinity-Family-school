import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const loader = readFileSync('src/components/common/premium-splash-loader.tsx', 'utf8');
const appLayout = readFileSync('src/components/layout/app-layout.tsx', 'utf8');

test('startup screen keeps the logo and lightweight moving blocks side by side', () => {
  assert.match(loader, /flex items-center justify-center gap-4/);
  assert.match(loader, /startup-block-one/);
  assert.match(loader, /startup-block-two/);
  assert.match(loader, /startup-block-three/);
  assert.doesNotMatch(loader, /styled-components/);
  assert.match(loader, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(loader, /block\.animate\(/);
});

test('startup messages cross-fade over the already-mounted workspace', () => {
  assert.match(loader, /Preparing school records/);
  assert.match(loader, /duration: 620/);
  assert.match(loader, /transition-opacity duration-300/);
  assert.match(loader, /isExiting \? 'pointer-events-none opacity-0' : 'opacity-100'/);
  assert.match(appLayout, /startupPhase/);
  assert.match(appLayout, /setMinimumFrontendDisplayElapsed\(true\), 1000/);
  assert.match(appLayout, /must never wait for\s+\/\/ Firestore, React Query, cache hydration, or GlobalDataPreloader work/);
  assert.doesNotMatch(appLayout, /minimumFrontendDisplayElapsed.*isLoadingSettings/);
  assert.match(appLayout, /requestAnimationFrame\(\(\) => setStartupPhase\('fading'\)\)/);
  assert.match(appLayout, /setTimeout\(\(\) => setStartupPhase\('complete'\), 300\)/);
  assert.match(appLayout, /isExiting=\{startupPhase === 'fading'\}/);
});
