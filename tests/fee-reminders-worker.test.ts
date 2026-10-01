import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

function workerFixture() {
  const listeners = new Map<string, (event: any) => void>();
  const stores = new Map<string, Map<string, string>>();
  const shown: any[] = [];
  const messages: any[] = [];
  const caches = {
    keys: async () => [...stores.keys()], delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        match: async (url: string) => store.has(url) ? new Response(store.get(url)) : undefined,
        put: async (url: string, response: Response) => store.set(url, await response.text()),
      };
    },
  };
  const self = {
    location: { origin: 'https://school.test' }, addEventListener: (type: string, handler: any) => listeners.set(type, handler),
    clients: { matchAll: async () => [{ postMessage: (message: any) => messages.push(message) }], claim: async () => {} },
    registration: {
      showNotification: async (title: string, options: any) => {
        shown.filter(item => item.tag === options.tag).forEach(item => item.close());
        const note = { title, ...options, closed: false, close() { this.closed = true; } }; shown.push(note);
      },
      getNotifications: async (filter?: any) => shown.filter(note => !note.closed && (!filter?.tag || note.tag === filter.tag)),
    },
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    self, caches, Response, Request, URL, Date, console: {log() {}, warn() {}, error() {}},
    setInterval: () => 1, clearInterval() {},
  });
  async function event(type: string, details: any = {}) {
    const promises: Promise<any>[] = [];
    listeners.get(type)!({ ...details, waitUntil: (promise: Promise<any>) => promises.push(promise) });
    await Promise.all(promises);
  }
  const push = (type: string, version: number, id = 'note') => event('push', { data: { text: () => '', json: () => ({
    title: 'Joan fees', body: 'Pay later', tag: `fee-reminder-${id}`, url: '/fees/collect/joan?notes=open',
    data: {type, reminderId: id, version: String(version)},
  }) } });
  return { push, event, stores, shown, messages, self };
}

test('a fulfillment push closes only the matching displayed fee reminder without adding an alert', async () => {
  const f = workerFixture();
  await f.push('FEE_REMINDER_ALERT', 1); await f.push('FEE_REMINDER_ALERT', 1, 'other');
  await f.push('FEE_REMINDER_DISMISS', 2);
  assert.equal(f.shown.length, 2);
  assert.equal(f.shown[0].closed, true); assert.equal(f.shown[1].closed, false);
  assert.ok(f.messages.some(message => message.type === 'FEE_REMINDER_UPDATED'));
});

test('paid promises reject delayed alerts, including delivery before the original alert', async () => {
  const f = workerFixture();
  await f.push('FEE_REMINDER_DISMISS', 2); await f.push('FEE_REMINDER_ALERT', 1); await f.push('FEE_REMINDER_ALERT', 2);
  assert.equal(f.shown.length, 0);
});

test('a newer reminder after payment reversal can appear without being dismissed by an old event', async () => {
  const f = workerFixture();
  await f.push('FEE_REMINDER_DISMISS', 2); await f.push('FEE_REMINDER_ALERT', 3); await f.push('FEE_REMINDER_DISMISS', 2);
  assert.equal(f.shown.length, 1); assert.equal(f.shown[0].closed, false);
});

test('simultaneous arrival is serialized and cannot resurrect a fulfilled promise', async () => {
  const f = workerFixture();
  await Promise.all([f.push('FEE_REMINDER_DISMISS', 2), f.push('FEE_REMINDER_ALERT', 1)]);
  assert.equal(f.shown.length, 0);
});

test('dismissal state survives a service-worker upgrade and does not retain payment or contact data', async () => {
  const f = workerFixture();
  await f.push('FEE_REMINDER_DISMISS', 2);
  f.stores.set('dynamic-old', new Map());
  await f.event('activate');
  assert.equal(f.stores.has('dynamic-old'), false);
  assert.equal(f.stores.has('trinity-fee-reminder-state'), true);
  const state = [...f.stores.get('trinity-fee-reminder-state')!.values()][0];
  assert.deepEqual(JSON.parse(state), {version: 2, dismissed: true});
  await f.push('FEE_REMINDER_ALERT', 1);
  assert.equal(f.shown.length, 0);
});

test('ordinary push notifications retain their existing handler', async () => {
  const f = workerFixture();
  await f.event('push', {data: {text: () => '', json: () => ({title: 'School news', body: 'News', tag: 'news'})}});
  assert.equal(f.shown[0].title, 'School news'); assert.equal(f.shown[0].closed, false);
});

test('a cancellation closes the parent-follow-up alert and displays a visible explanation', async () => {
  const f = workerFixture();
  await f.push('FEE_REMINDER_ALERT', 1);
  await f.event('push', {data: {text: () => '', json: () => ({
    title: 'Joan Kagwa: promise paid — reminder cancelled',
    body: 'The promised 20,000 shillings for Tuition is paid. No follow-up call is needed for this promise.',
    url: '/fees/collect/joan?notes=open', data: {type: 'FEE_REMINDER_RESOLVED', reminderId: 'note', version: '2'},
  })}});
  assert.equal(f.shown[0].closed, true); assert.equal(f.shown.length, 2);
  assert.match(f.shown[1].title, /reminder cancelled/); assert.match(f.shown[1].body, /No follow-up call/);
  assert.equal(f.shown[1].closed, false); assert.equal(f.shown[1].data.url, '/fees/collect/joan?notes=open');
  await f.push('FEE_REMINDER_ALERT', 1);
  assert.equal(f.shown.length, 2, 'the old call reminder cannot reappear');
});

test('an early cancellation shows its explanation even if no old alert exists', async () => {
  const f = workerFixture();
  await f.push('FEE_REMINDER_RESOLVED', 2);
  assert.equal(f.shown.length, 1); assert.equal(f.shown[0].tag, 'fee-reminder-update-note-v2');
  await f.push('FEE_REMINDER_ALERT', 1);
  assert.equal(f.shown.length, 1);
});

test('delivery retries do not repeatedly notify the user about the same cancellation', async () => {
  const f = workerFixture();
  await Promise.all([f.push('FEE_REMINDER_RESOLVED', 2), f.push('FEE_REMINDER_RESOLVED', 2)]);
  assert.equal(f.shown.length, 1);
  f.shown[0].close(); await f.push('FEE_REMINDER_RESOLVED', 2);
  assert.equal(f.shown.length, 1, 'a cancellation the user dismissed stays dismissed');
});
