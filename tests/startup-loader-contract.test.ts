import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterStartupPaint, isNonLoginPublicPath } from '../src/lib/performance/startup-display';

test('protected startup yields a paint opportunity and cleans up either pending frame', () => {
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = id => { frames.delete(id); };
  const frame = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback(0)); };
  try {
    let mounted = false;
    afterStartupPaint(() => { mounted = true; });
    assert.equal(mounted, false);
    frame(); assert.equal(mounted, false, 'The first frame still precedes paint');
    frame(); assert.equal(mounted, true);
    let cancelled = false;
    const cancelFirst = afterStartupPaint(() => { cancelled = true; });
    cancelFirst(); frame(); frame(); assert.equal(cancelled, false);
    const cancelSecond = afterStartupPaint(() => { cancelled = true; });
    frame(); cancelSecond(); frame(); assert.equal(cancelled, false);
  } finally { globalThis.requestAnimationFrame = originalRequest; globalThis.cancelAnimationFrame = originalCancel; }
});

test('public documents retain SSR but login and private routes wait for the loader paint', () => {
  for (const path of ['/download', '/about-trinity', '/admin/setup', '/test-firebase/nested']) assert.equal(isNonLoginPublicPath(path), true);
  for (const path of [null, '/', '/login', '/parent', '/pupils', '/download-private']) assert.equal(isNonLoginPublicPath(path), false);
});

test('one initial HTML surface owns startup, independently of application data and JS animation', () => {
  const loader = readFileSync('src/components/common/premium-splash-loader.tsx', 'utf8');
  const root = readFileSync('src/app/layout.tsx', 'utf8');
  const handoff = readFileSync('src/components/common/startup-handoff.tsx', 'utf8');
  const layout = readFileSync('src/components/layout/app-layout.tsx', 'utf8');
  assert.ok(root.indexOf('<StartupBootstrap />') < root.indexOf('<StartupPaintGate>'));
  assert.doesNotMatch(loader, /useEffect|useState|setInterval|next\/image|\.animate\(/);
  assert.match(loader, /@keyframes startup-block-motion/);
  assert.match(loader, /prefers-reduced-motion:reduce/);
  assert.match(handoff, /if \(authLoading \|\| !isAuthenticated \|\| pathname === '\/login'\) return/);
  assert.doesNotMatch(handoff, /useQuery|useSchoolSettings|usePupils|minimumFrontendDisplayElapsed/);
  assert.match(layout, /<StartupHandoff pathname=\{pathname\} authLoading=\{authLoading\} isAuthenticated=\{isAuthenticated\}/);
});
