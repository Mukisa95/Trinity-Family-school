import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { androidReleaseForProject } from '../src/lib/android/download';
import * as contract from '../src/lib/server/native-push-contract';
import releases from '../src/lib/android/app-releases.json';

// Exercise the real native registration service with local transaction doubles.
// No Firebase records are written and no notification is sent.
function service(websiteProject: string, adminProject = websiteProject) {
  let databaseCalls = 0;
  const bindings: any[] = [];
  const transaction = {
    get: async () => ({ exists: false, data: () => undefined }),
    set: (_ref: unknown, data: unknown) => bindings.push(data),
  };
  const db = { collection: () => ({ doc: () => ({}) }), runTransaction: (work: any) => work(transaction) };
  const source = readFileSync(new URL('../src/lib/server/native-push.ts', import.meta.url), 'utf8');
  const module = { exports: {} as any };
  runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, {
    module, exports: module.exports, console, Buffer,
    require: (name: string) => {
      if (name === 'server-only') return {};
      if (name === 'firebase-admin/firestore') return { FieldValue: { serverTimestamp: () => 'timestamp' }, getFirestore: () => { databaseCalls++; return db; } };
      if (name === 'firebase-admin/messaging') return {};
      if (name === '@/lib/firebase-admin') return { getFirebaseAdminProjectId: () => adminProject, getFirebaseAdminApp: () => ({}) };
      if (name === '@/lib/android/download') return { androidReleaseForProject, websiteFirebaseProjectId: () => websiteProject };
      if (name === './native-push-contract') return contract;
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { update: module.exports.updateNativeDevice, bindings, calls: () => databaseCalls };
}
const device = { installationId: '12345678-abcd-1234-abcd-123456789abc', deviceSecret: 'a'.repeat(43), token: 't'.repeat(160) };

test('each school can register its own Android app for native push', async () => {
  assert.ok(releases.some(release => release.firebaseProjectId === 'trinity-family-ganda'));
  assert.ok(releases.some(release => release.firebaseProjectId === 'trinity-family-schools'));
  for (const release of releases) {
    const adapter = service(release.firebaseProjectId);
    const result = await adapter.update({ ...device, applicationId: release.applicationId, projectId: release.firebaseProjectId }, 'register', 'sample-parent');
    assert.equal(result.active, true);
    assert.equal(adapter.bindings.length, 1);
    assert.equal(adapter.bindings[0].applicationId, release.applicationId);
    assert.equal(adapter.bindings[0].firebaseProjectId, release.firebaseProjectId);
    assert.equal(adapter.bindings[0].userId, 'sample-parent');
  }
});

test('another school app or a mismatched server project is rejected before database access', async () => {
  for (const release of releases) {
    const other = releases.find(item => item !== release)!;
    const adapter = service(release.firebaseProjectId);
    await assert.rejects(adapter.update({ ...device, applicationId: other.applicationId, projectId: other.firebaseProjectId }, 'register', 'sample-parent'), /NATIVE_SCHOOL_MISMATCH/);
    assert.equal(adapter.calls(), 0);
    const wrongAdmin = service(release.firebaseProjectId, other.firebaseProjectId);
    await assert.rejects(wrongAdmin.update({ ...device, applicationId: release.applicationId, projectId: release.firebaseProjectId }, 'register', 'sample-parent'), /NATIVE_SCHOOL_MISMATCH/);
    assert.equal(wrongAdmin.calls(), 0);
  }
  const unknown = service('unconfigured-school');
  await assert.rejects(unknown.update({ ...device, applicationId: releases[0].applicationId, projectId: releases[0].firebaseProjectId }, 'register', 'sample-parent'), /NATIVE_SCHOOL_MISMATCH/);
  assert.equal(unknown.calls(), 0);
});
