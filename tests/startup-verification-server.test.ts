import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('session endpoint separates unavailable services from authoritative loss of access', async () => {
  const fixture: { error?: unknown } = {};
  const result = await build({ entryPoints: ['src/app/api/auth/session/route.ts'], bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'session-boundaries', setup(builder) {
      builder.onResolve({ filter: /^(next\/server|@\/lib\/server\/app-auth)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'next/server'
        ? 'export const NextResponse={json:(value,init)=>new Response(JSON.stringify(value),{...init,headers:{...init.headers,"Content-Type":"application/json"}})};'
        : 'export async function requireAppUser(){if(fixture.error)throw fixture.error;return {user:{id:"fixture"}}}' }));
    } }] });
  const module = { exports: {} as { GET: (request: unknown) => Promise<Response> } };
  new Function('module', 'exports', 'fixture', result.outputFiles[0].text)(module, module.exports, fixture);
  assert.equal((await module.exports.GET({})).status, 200);
  for (const error of [new Error('temporary database outage'), { code: 'auth/internal-error' }, { code: 'auth/id-token-expired' }]) {
    fixture.error = error;
    const response = await module.exports.GET({});
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  for (const error of [new Error('ACCOUNT_INACTIVE'), new Error('AUTH_REQUIRED'), { code: 'auth/id-token-revoked' }, { code: 'auth/user-disabled' }]) {
    fixture.error = error;
    assert.equal((await module.exports.GET({})).status, 401);
  }
});
