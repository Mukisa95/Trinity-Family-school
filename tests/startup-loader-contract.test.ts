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
  assert.match(loader, /prefers-reduced-motion/);
});

test('startup messages describe preparation and the overlay fades as soon as the workspace can render', () => {
  assert.match(loader, /Preparing school records/);
  assert.match(loader, /transition-opacity duration-200/);
  assert.match(appLayout, /startupScreenPhase/);
  assert.match(appLayout, /setStartupScreenPhase\('exiting'\)/);
  assert.match(appLayout, /setTimeout\(\(\) => setStartupScreenPhase\('complete'\), 200\)/);
  assert.doesNotMatch(appLayout, /\}, \[authLoading, isAuthenticated, startupScreenPhase\]\);/);
  assert.match(appLayout, /authLoading \|\| \(isAuthenticated && startupScreenPhase !== 'complete'\)/);
});
