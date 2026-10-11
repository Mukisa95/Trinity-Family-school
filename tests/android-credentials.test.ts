import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import * as download from '../src/lib/android/download';
import releases from '../src/lib/android/app-releases.json';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
const require = createRequire(import.meta.url);

function credentials(project: string) {
  const module = { exports: {} as any };
  runInNewContext(transformSync(readFileSync('src/lib/server/android-credentials.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
    module, exports: module.exports, Buffer,
    require: () => ({ ...download, websiteFirebaseProjectId: () => project }),
  });
  return module.exports;
}

test('each school associates only its own permanent signing certificate and native passkey origin', () => {
  for (const release of releases) {
    const service = credentials(release.firebaseProjectId);
    const association = service.androidCredentialAssociation(release.websiteOrigin);
    assert.equal(association.target.package_name, release.applicationId);
    assert.equal(association.target.sha256_cert_fingerprints[0], release.signingCertificateSha256);
    const origins = service.passkeyExpectedOrigins(release.websiteOrigin);
    assert.equal(origins[0], release.websiteOrigin);
    assert.equal(origins[1], 'android:apk-key-hash:' + Buffer.from(release.signingCertificateSha256.replaceAll(':', ''), 'hex').toString('base64url'));
    for (const other of releases.filter(value => value !== release)) {
      assert.equal(service.androidCredentialAssociation(other.websiteOrigin), null);
      assert.deepEqual(Array.from(service.passkeyExpectedOrigins(other.websiteOrigin)), [other.websiteOrigin]);
      assert.ok(!origins.includes('android:apk-key-hash:' + Buffer.from(other.signingCertificateSha256.replaceAll(':', ''), 'hex').toString('base64url')));
    }
    assert.equal(service.androidCredentialAssociation('https://untrusted.invalid'), null);
  }
});

test('asset links return JSON at the exact public origin and reject mismatched deployments', async () => {
  for (const release of releases) {
    const module = { exports: {} as any };
    runInNewContext(transformSync(readFileSync('src/app/.well-known/assetlinks.json/route.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
      module, exports: module.exports, Response,
      require: (name: string) => name === '@/lib/android/download' ? download : credentials(release.firebaseProjectId),
    });
    const request = (origin: string) => ({ headers: new Headers({ host: new URL(origin).host, 'x-forwarded-proto': 'https' }), nextUrl: { origin: 'https://internal.invalid' } });
    const response = module.exports.GET(request(release.websiteOrigin));
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('Content-Type').startsWith('application/json'));
    const json = await response.json();
    assert.equal(json.length, 1);
    assert.equal(json[0].target.package_name, release.applicationId);
    assert.equal(module.exports.GET(request('https://untrusted.invalid')).status, 404);
  }
});

function passkeyRoute(actor = 'account-a', passwordOwner = 'account-a') {
  const module = { exports: {} as any };
  const source = transformSync(readFileSync('src/app/api/auth/passkey/route.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  let checks = 0;
  runInNewContext(source, {
    module, exports: module.exports, console, Buffer, Date, Math, URL, Error,
    require: (name: string) => {
      if (name === 'firebase-admin/firestore') return { getFirestore: () => { throw new Error('Local setup must not create passkeys or challenges'); } };
      if (name === '@/lib/server/app-auth') return {
        requireAppUser: async () => { if (!actor) throw new Error('AUTH_REQUIRED'); return { user: { id: actor, username: 'current-account' } }; },
        verifyLegacyCredentials: async (_username: string, password: string) => { checks++; return password === 'correct-password' ? { id: passwordOwner } : null; },
      };
      if (name === '@/lib/firebase-admin') return {};
      if (name === '@/lib/server/android-credentials') return { passkeyExpectedOrigins: (origin: string) => [origin] };
      return require(name);
    },
  });
  const send = (password?: string, origin = 'https://trinityfamilyschool.vercel.app') => module.exports.POST({ headers: new Headers({ origin, host: 'trinityfamilyschool.vercel.app' }), json: async () => ({ action: 'verify-local', password }) });
  return { send, checks: () => checks };
}

test('native enrollment requires an authenticated account and its own verified password', async () => {
  const valid = passkeyRoute();
  const response = await valid.send('correct-password');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { userId: 'account-a' });
  assert.equal(valid.checks(), 1);
  assert.equal((await passkeyRoute().send('wrong-password')).status, 401);
  assert.equal((await passkeyRoute().send()).status, 400);
  assert.equal((await passkeyRoute('', '').send('correct-password')).status, 401);
  assert.equal((await passkeyRoute('account-a', 'another-account').send('correct-password')).status, 401);
  assert.equal((await passkeyRoute().send('correct-password', 'https://untrusted.invalid')).status, 403);
});

test('real signed native passkey assertions retain challenge, school and user-verification checks', async () => {
  const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');
  const { isoCBOR } = await import('@simplewebauthn/server/helpers');
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const publicCose = isoCBOR.encode(new Map<number, number | Uint8Array>([
    [1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x!, 'base64url')], [-3, Buffer.from(jwk.y!, 'base64url')],
  ]));
  const id = randomBytes(24).toString('base64url');
  for (const release of releases) {
    const rpID = new URL(release.websiteOrigin).hostname;
    const expectedOrigins = Array.from(credentials(release.firebaseProjectId).passkeyExpectedOrigins(release.websiteOrigin)) as string[];
    const challenge = randomBytes(32).toString('base64url');
    const responseFor = (origin: string, flags = 5) => {
      const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }));
      const counter = Buffer.alloc(4); counter.writeUInt32BE(1);
      const authenticator = Buffer.concat([createHash('sha256').update(rpID).digest(), Buffer.from([flags]), counter]);
      const signature = sign('sha256', Buffer.concat([authenticator, createHash('sha256').update(clientData).digest()]), privateKey);
      return { id, rawId: id, type: 'public-key' as const, clientExtensionResults: {}, response: { clientDataJSON: clientData.toString('base64url'), authenticatorData: authenticator.toString('base64url'), signature: signature.toString('base64url') } };
    };
    const verify = (origin: string, flags = 5, expectedChallenge = challenge) => verifyAuthenticationResponse({
      response: responseFor(origin, flags), expectedChallenge, expectedOrigin: expectedOrigins, expectedRPID: rpID,
      requireUserVerification: true, credential: { id, publicKey: publicCose, counter: 0 },
    });
    assert.equal((await verify(expectedOrigins[1])).verified, true);
    assert.equal((await verify(release.websiteOrigin)).verified, true);
    const other = releases.find(value => value !== release)!;
    const foreignOrigin = credentials(other.firebaseProjectId).passkeyExpectedOrigins(other.websiteOrigin)[1];
    await assert.rejects(verify(foreignOrigin), /origin/i);
    await assert.rejects(verify(expectedOrigins[1], 1), /verification|verified/i);
    await assert.rejects(verify(expectedOrigins[1], 5, randomBytes(32).toString('base64url')), /challenge/i);
  }
});
