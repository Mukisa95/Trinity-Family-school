import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import path from 'node:path';

test('explicit browser push off survives reload and cannot be undone by an in-flight registration', async () => {
  const bundled = await build({
    entryPoints: [path.resolve('src/lib/push-subscription-client.ts')], bundle: true, write: false, format: 'cjs', platform: 'node',
    plugins: [{ name: 'signed-fixture', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "export const auth={currentUser:{uid:'fixture',isAnonymous:false,getIdToken:async()=>'fixture-token'}};", loader: 'js' }));
    } }],
  });
  const local = new Map<string, string>(), session = new Map<string, string>();
  const storage = (items: Map<string, string>) => ({ getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => items.set(key, value), removeItem: (key: string) => items.delete(key) });
  const requests: { method: string; url: string }[] = [];
  let subscription: any = null;
  const makeSubscription = () => ({ endpoint: 'https://push.fixture/this-device', options: {}, toJSON: () => ({ endpoint: 'https://push.fixture/this-device', keys: { p256dh: 'fixture', auth: 'fixture' } }), unsubscribe: async () => { subscription = null; return true; } });
  const registration = { pushManager: { getSubscription: async () => subscription, subscribe: async () => (subscription = makeSubscription()) } };
  let pausePost: (() => Promise<void>) | undefined;
  const notification = { permission: 'granted' };
  const shared = {
    window: { Notification: notification, PushManager: class {}, matchMedia: () => ({ matches: false }), atob: (value: string) => Buffer.from(value, 'base64').toString('binary'), setTimeout, clearTimeout, dispatchEvent: () => true },
    Notification: notification, navigator: { onLine: true, userAgent: 'Fixture Browser', platform: 'Fixture', serviceWorker: { register: async () => registration, ready: Promise.resolve(registration), getRegistration: async () => registration } },
    localStorage: storage(local), sessionStorage: storage(session), AbortController, setTimeout, clearTimeout,
    CustomEvent: class { constructor(public type: string, public detail: unknown) {} },
    fetch: async (url: string, options?: { method?: string }) => {
      const method = options?.method || 'GET'; requests.push({ method, url });
      if (method === 'POST') await pausePost?.();
      return { ok: true, json: async () => url.includes('vapid') ? { publicKey: 'AAAA' } : { active: true } };
    },
  };
  const load = () => {
    const exports = {};
    const context = { ...shared, exports, module: { exports } };
    vm.runInNewContext(bundled.outputFiles[0].text, context);
    return context.module.exports as Record<string, (...args: any[]) => Promise<any>>;
  };
  let client = load();
  assert.equal((await client.enablePushSubscription('fixture')).active, true);
  await client.disablePushSubscription('fixture');
  assert.equal(subscription, null);
  const posts = requests.filter(item => item.method === 'POST').length;
  client = load();
  assert.equal((await client.reconcilePushSubscription('fixture')).active, false);
  assert.equal(requests.filter(item => item.method === 'POST').length, posts);
  assert.equal((await client.enablePushSubscription('fixture')).active, true);
  await client.disablePushSubscription('fixture');

  local.delete('trinity-push-disabled:fixture');
  let release!: () => void, entered!: () => void;
  const enteredPost = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  pausePost = async () => { entered(); await gate; };
  const inFlight = client.reconcilePushSubscription('fixture');
  await enteredPost;
  const disabling = client.disablePushSubscription('fixture');
  release(); await Promise.all([inFlight, disabling]);
  assert.equal(subscription, null);
  assert.equal((await client.reconcilePushSubscription('fixture')).active, false);
});
