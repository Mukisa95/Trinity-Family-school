import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import release from '../src/lib/android/app-release.json';

test('the real download page renders the school APK link without an account or authentication headers', async () => {
  const bundled = await build({
    entryPoints: [path.resolve('src/app/download/page.tsx')], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
    external: ['react', 'react/*'],
    plugins: [{ name: 'public-request', setup(builder) {
      builder.onResolve({ filter: /^next\/(headers|image|link)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'next/headers'
        ? `export const headers=async()=>new Headers({host:${JSON.stringify(new URL(release.websiteOrigin).host)}});`
        : `import React from 'react'; export default ({children,...props})=>React.createElement(${JSON.stringify(args.path === 'next/link' ? 'a' : 'img')},props,children);`, loader: 'jsx' }));
    } }],
  });
  const exports = {};
  const context = { exports, module: { exports }, require: createRequire(import.meta.url), Headers, URL, process: { env: { NODE_ENV: 'production', NEXT_PUBLIC_FIREBASE_PROJECT_ID: release.firebaseProjectId } } };
  vm.runInNewContext(bundled.outputFiles[0].text, context);
  const page = await (context.module.exports as { default: () => Promise<ReactNode> }).default();
  const html = renderToStaticMarkup(page);
  assert.match(html, /No sign-in required to download/);
  assert.match(html, /href="\/api\/android\/download"/);
  assert.ok(html.includes(release.appName));
  assert.ok(html.includes(`Version ${release.versionName}`));
});
