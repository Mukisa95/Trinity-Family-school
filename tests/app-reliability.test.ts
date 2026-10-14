import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { isDefinitiveSessionError, sessionErrorCode } from '../src/lib/auth/session-error-policy';

test('service and unknown SDK failures do not masquerade as revoked credentials', () => {
  for (const code of ['auth/network-request-failed', 'auth/internal-error', 'auth/quota-exceeded', 'auth/too-many-requests', 'auth/timeout', 'auth/unexpected-sdk-failure']) {
    assert.equal(isDefinitiveSessionError({ code }), false, code);
  }
  assert.equal(isDefinitiveSessionError(new Error('fixture service failure')), false);
  assert.equal(sessionErrorCode({ code: 'password=private' }), 'unknown');
});

test('confirmed identity failures still invalidate access', () => {
  for (const code of ['auth/user-disabled', 'auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-not-found', 'app/invalid-claims', 'app/profile-mismatch']) {
    assert.equal(isDefinitiveSessionError({ code }), true, code);
  }
});

test('the actual signed-session validator preserves outage access and rejects missing, mismatched and disabled identities', async () => {
  const result = await build({ entryPoints: ['src/lib/auth/firebase-session.ts'], bundle: true, write: false,
    platform: 'node', format: 'cjs', plugins: [{ name: 'fixture-identity', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/firebase$/ }, () => ({ path: 'identity', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const auth = fixture;', loader: 'js' }));
    } }] });
  const fixture: { currentUser: any; authStateReady: () => Promise<void> } = { currentUser: null, authStateReady: async () => {} };
  const module = { exports: {} as any };
  new Function('module', 'exports', 'fixture', result.outputFiles[0].text)(module, module.exports, fixture);
  const validate = module.exports.validateCurrentAppSession;
  const missing = await validate('fixture-user');
  assert.equal(missing.status, 'invalid');
  assert.equal(missing.reason, 'identity-missing');
  // Reproduce a cold start: the profile is available before Firebase's stored
  // identity. The old validator returned invalid immediately at this point.
  let completeRestore!: () => void;
  fixture.authStateReady = () => new Promise<void>(resolve => { completeRestore = resolve; });
  let settled = false;
  const restoring = validate('fixture-user', true).then((value: any) => { settled = true; return value; });
  await Promise.resolve();
  assert.equal(settled, false);
  fixture.currentUser = { uid: 'fixture-user', isAnonymous: false, getIdTokenResult: async () => ({ claims: { appUser: true, isActive: true, role: 'Staff' } }) };
  completeRestore();
  assert.deepEqual(await restoring, { status: 'valid', role: 'Staff' });
  fixture.authStateReady = async () => { throw new Error('fixture restoration failure'); };
  const delayed = await validate('fixture-user');
  assert.equal(delayed.status, 'unavailable');
  assert.equal(delayed.reason, 'identity-restore-failed');
  fixture.authStateReady = async () => {};
  fixture.currentUser = { uid: 'different-user', isAnonymous: false };
  assert.equal((await validate('fixture-user')).status, 'invalid');
  fixture.currentUser = { uid: 'fixture-user', isAnonymous: false, getIdTokenResult: async () => { throw { code: 'auth/internal-error' }; } };
  assert.equal((await validate('fixture-user', true)).status, 'unavailable');
  fixture.currentUser.getIdTokenResult = async () => { throw { code: 'auth/user-disabled' }; };
  const disabled = await validate('fixture-user', true);
  assert.equal(disabled.status, 'invalid');
  assert.equal(disabled.reason, 'auth/user-disabled');
  fixture.currentUser.getIdTokenResult = async () => ({ claims: { appUser: true, isActive: false } });
  assert.equal((await validate('fixture-user')).status, 'invalid');
  fixture.currentUser.getIdTokenResult = async (force: boolean) => {
    assert.equal(force, true); return { claims: { appUser: true, isActive: true, role: 'Staff' } };
  };
  assert.deepEqual(await validate('fixture-user', true), { status: 'valid', role: 'Staff' });
});

test('profile read failures cannot be returned as a missing account', async () => {
  const result = await build({ entryPoints: ['src/lib/services/users.service.ts'], bundle: true, write: false,
    platform: 'node', format: 'cjs', plugins: [{ name: 'fixture-profile-read', setup(builder) {
      builder.onResolve({ filter: /firebase\/firestore$/ }, () => ({ path: 'firestore', namespace: 'fixture' }));
      builder.onResolve({ filter: /^\.\.\/firebase$/ }, () => ({ path: 'firebase', namespace: 'fixture' }));
      builder.onResolve({ filter: /firestore-helpers$/ }, () => ({ path: 'helpers', namespace: 'fixture' }));
      builder.onResolve({ filter: /secure-auth\.service$/ }, () => ({ path: 'secure', namespace: 'fixture' }));
      builder.onResolve({ filter: /pupils\.service$/ }, () => ({ path: 'pupils', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents:
        args.path === 'firestore' ? `export const doc=()=>({}), collection=()=>({}), getDocs=()=>({}), query=()=>({}), where=()=>({}), orderBy=()=>({}); export async function getDoc(){if(fixture.error)throw fixture.error;return fixture.snapshot;}`
        : args.path === 'firebase' ? 'export const auth={}, db={};'
        : args.path === 'helpers' ? 'export const getDocsWithTimeout=()=>{}; export const isFirestoreOfflineError=error=>error.code==="unavailable";'
        : args.path === 'pupils' ? 'export class PupilsService{}' : 'export class SecureAuthService{}' }));
    } }] });
  const fixture: any = { error: { code: 'unavailable', message: 'fixture outage' } };
  const module = { exports: {} as any };
  new Function('module', 'exports', 'fixture', result.outputFiles[0].text)(module, module.exports, fixture);
  const service = module.exports.UsersService;
  await assert.rejects(service.getUserById('fixture-user'), error => error === fixture.error);
  fixture.error = null;
  fixture.snapshot = { exists: () => false };
  assert.equal(await service.getUserById('fixture-user'), null);
  fixture.snapshot = { id: 'fixture-user', exists: () => true, data: () => ({ isActive: true, role: 'Staff' }) };
  assert.equal((await service.getUserById('fixture-user')).isActive, true);
});

test('Android sign-in uses persistent fallback and reports a storage failure before establishing a disappearing login', async () => {
  const result = await build({ entryPoints: ['src/lib/services/secure-auth.service.ts'], bundle: true, write: false,
    platform: 'node', format: 'cjs', plugins: [{ name: 'fixture-persistence', setup(builder) {
      builder.onResolve({ filter: /^firebase\/auth$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
      builder.onResolve({ filter: /lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'fixture' }));
      builder.onResolve({ filter: /app-diagnostics$/ }, () => ({ path: 'diagnostics', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents:
        args.path === 'auth' ? `export const indexedDBLocalPersistence='indexeddb', browserLocalPersistence='localstorage'; export async function setPersistence(auth,type){fixture.attempts.push(type);if(type==='localstorage'||fixture.failBoth)throw new Error('fixture storage failure')} export async function signInWithCustomToken(){fixture.signIns++}`
        : args.path === 'firebase' ? 'export const auth={};' : 'export const recordAppDiagnostic=code=>fixture.codes.push(code);' }));
    } }] });
  const fixture = { attempts: [] as string[], codes: [] as string[], signIns: 0, failBoth: false };
  const module = { exports: {} as any };
  new Function('module', 'exports', 'fixture', result.outputFiles[0].text)(module, module.exports, fixture);
  const priorWindow = (globalThis as any).window;
  const priorFetch = globalThis.fetch;
  const storage = new Map<string, string>();
  (globalThis as any).window = { TrinityOffline: {}, localStorage: {
    getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key),
  } };
  globalThis.fetch = async () => new Response(JSON.stringify({ customToken: 'fixture-only', user: { id: 'fixture-user', username: 'Fixture', role: 'Staff' } }));
  try {
    const service = module.exports.SecureAuthService;
    assert.equal((await service.signIn('Fixture', 'fixture-password')).id, 'fixture-user');
    assert.deepEqual(fixture.attempts, ['localstorage', 'indexeddb']);
    assert.equal(fixture.signIns, 1);
    const before = storage.get('trinity_user');
    fixture.failBoth = true;
    await assert.rejects(service.signIn('Fixture', 'fixture-password'), (error: any) => error.code === 'secure-session-failed' && /storage/.test(error.message));
    assert.equal(fixture.signIns, 1);
    assert.equal(storage.get('trinity_user'), before);
    assert.ok(fixture.codes.includes('auth_persistence_failed'));
  } finally {
    globalThis.fetch = priorFetch;
    if (priorWindow === undefined) delete (globalThis as any).window; else (globalThis as any).window = priorWindow;
  }
});
