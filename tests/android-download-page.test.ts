import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import * as download from '../src/lib/android/download';
import releases from '../src/lib/android/app-releases.json';

const require = createRequire(import.meta.url);
async function pageFor(origin: string, projectId: string) {
  const source = readFileSync(new URL('../src/app/download/page.tsx', import.meta.url), 'utf8');
  const module = { exports: {} as any };
  runInNewContext(transformSync(source, { loader: 'tsx', format: 'cjs', jsx: 'automatic' }).code, {
    module, exports: module.exports, console, process,
    require: (name: string) => {
      if (name === 'next/headers') return { headers: async () => new Headers({ host: new URL(origin).host, 'x-forwarded-proto': 'https' }) };
      if (name === '@/lib/android/download') return { ...download, websiteFirebaseProjectId: () => projectId };
      return require(name);
    },
  });
  return renderToStaticMarkup(await module.exports.default());
}

test('both public download pages render the correct school name, APK filename and version', async () => {
  for (const release of releases) {
    const html = await pageFor(release.websiteOrigin, release.firebaseProjectId);
    assert.ok(html.includes(`Download ${release.appName}`));
    assert.ok(html.includes(`download="${release.filename}"`));
    assert.ok(html.includes('href="/api/android/download"'));
    assert.ok(html.includes(`Version ${release.versionName}`));
    for (const other of releases.filter(item => item !== release)) {
      assert.ok(!html.includes(`Download ${other.appName}`));
      assert.ok(!html.includes(`download="${other.filename}"`));
    }
  }
});

test('a mismatched website and database do not display a download button', async () => {
  const html = await pageFor(releases[0].websiteOrigin, releases[1].firebaseProjectId);
  assert.ok(html.includes('not available for this school yet'));
  assert.ok(!html.includes('href="/api/android/download"'));
});
