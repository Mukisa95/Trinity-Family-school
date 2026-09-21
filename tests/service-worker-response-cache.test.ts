import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('the service worker clones static responses before returning them', async () => {
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const staticRouteStart = source.indexOf("if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/'))");
  const nextRouteStart = source.indexOf("if (url.pathname.startsWith('/_next/'))", staticRouteStart);

  assert.notEqual(staticRouteStart, -1, 'expected the static asset cache route');
  assert.notEqual(nextRouteStart, -1, 'expected the following Next.js route guard');

  const staticRoute = source.slice(staticRouteStart, nextRouteStart);
  const clonePosition = staticRoute.indexOf('const responseToCache = response.clone();');
  const returnPosition = staticRoute.lastIndexOf('return response;');

  assert.notEqual(clonePosition, -1, 'the network response should be cloned for the cache');
  assert.notEqual(returnPosition, -1, 'the original network response should be returned');
  assert.ok(clonePosition < returnPosition, 'the response must be cloned before it is returned to the browser');
  assert.match(staticRoute, /event\.waitUntil\([\s\S]*cache\.put\(event\.request, responseToCache\)/);
  assert.doesNotMatch(staticRoute, /cache\.put\(event\.request, response\.clone\(\)\)/);
});
