import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

export function notificationFixture() {
  const documents = new Map<string, any>();
  const versions = new Map<string, number>();
  const counts: Record<string, number> = {};
  const sent: Array<{ userId: string; payload: any; id: string }> = [];
  const failedUsers = new Set<string>();
  const failedReads = new Set<string>();
  let afterSend: (() => void) | undefined;
  const stamp = (ms: number) => ({ toDate: () => new Date(ms), toMillis: () => ms });
  const clone = (value: any): any => {
    if (!value || typeof value !== 'object' || value.toDate) return value;
    return Array.isArray(value) ? value.map(clone) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
  };
  const snapshot = (path: string) => ({
    id: path.split('/').at(-1), exists: documents.has(path), data: () => clone(documents.get(path)),
  });
  const write = (path: string, input: any, merge = false) => {
    const value = merge ? clone(documents.get(path) || {}) : {};
    for (const [key, item] of Object.entries(input) as Array<[string, any]>) {
      assert.notEqual(item, undefined, 'Firestore rejects undefined fields');
      if (item?.op === 'delete') delete value[key];
      else if (item?.op === 'union') value[key] = [...new Set([...(value[key] || []), ...item.values])];
      else value[key] = clone(item);
    }
    documents.set(path, value);
    versions.set(path, (versions.get(path) || 0) + 1);
  };
  const doc = (path: string) => ({
    path, id: path.split('/').at(-1),
    get: async () => {
      counts[path] = (counts[path] || 0) + 1;
      if (failedReads.has(path)) throw new Error('read unavailable');
      return snapshot(path);
    },
  });
  const db = {
    collection: (name: string) => {
      const make = (filters: any[] = [], sort?: string, limit = Infinity): any => ({
        doc: (id: string) => doc(name + '/' + id),
        where: (field: string, operator: string, value: any) => make([...filters, { field, operator, value }], sort, limit),
        orderBy: (field: string) => make(filters, field, limit),
        limit: (count: number) => make(filters, sort, count),
        get: async () => {
          counts[name] = (counts[name] || 0) + 1;
          if (failedReads.has(name)) throw new Error('query unavailable');
          let matches = [...documents].filter(([path, data]) => path.startsWith(name + '/') && filters.every(f => {
            const value = data[f.field]?.toMillis?.() ?? data[f.field];
            const expected = f.value?.toMillis?.() ?? f.value;
            return f.operator === 'in' ? expected.includes(value) : f.operator === '<=' ? value <= expected : value === expected;
          }));
          if (sort) matches.sort((a, b) => (a[1][sort]?.toMillis?.() ?? a[1][sort]) - (b[1][sort]?.toMillis?.() ?? b[1][sort]));
          return { docs: matches.slice(0, limit).map(([path]) => snapshot(path)) };
        },
      });
      return make();
    },
    runTransaction: async (callback: any) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const reads = new Map<string, number>();
        const writes: any[] = [];
        const result = await callback({
          get: async (ref: any) => {
            assert.equal(writes.length, 0);
            reads.set(ref.path, versions.get(ref.path) || 0);
            return snapshot(ref.path);
          },
          set: (ref: any, value: any) => writes.push([ref.path, value, false]),
          update: (ref: any, value: any) => writes.push([ref.path, value, true]),
        });
        if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) continue;
        writes.forEach(([path, value, merge]) => write(path, value, merge));
        return result;
      }
      throw new Error('contention');
    },
  };
  const cache = new Map<string, any>();
  const load = (file: string): any => {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(output, {
      module, exports: module.exports, Date,
      console: { log() {}, error() {} },
      require: (name: string) => {
        if (name === 'server-only') return {};
        if (name === 'node:crypto') return { randomUUID: () => 'lease-' + Math.random() };
        if (name === 'firebase-admin/firestore') return {
          getFirestore: () => db, Timestamp: { fromMillis: stamp },
          FieldValue: { delete: () => ({ op: 'delete' }), serverTimestamp: () => stamp(Date.now()), arrayUnion: (...values: any[]) => ({ op: 'union', values }) },
        };
        if (name === '@/lib/firebase-admin') return { getFirebaseAdminApp: () => ({}) };
        if (name === './payment-notification-outbox') return load('src/lib/server/payment-notification-outbox.ts');
        if (name === '@/lib/services/fees-payment-notification.server') return load('src/lib/services/fees-payment-notification.server.ts');
        if (name === '@/lib/users/parent-account-families') return load('src/lib/users/parent-account-families.ts');
        if (name === './granular-permissions.service') return { GranularPermissionService: { canAccessPage: () => true } };
        if (name === '@/lib/notifications/automation-settings') return {
          normalizeNotificationAutomationSettings: (v: any) => v,
          isNotificationAutomationEnabled: () => true,
          resolveAutomatedNotificationRecipientIds: (_a: any, _b: any, ids: any) => ids,
        };
        if (name === './optimized-notification.service') return { optimizedNotificationService: {
          sendPushOnlyNotification: async (payload: any, users: any[], id: string) => {
            sent.push({ userId: users[0].id, payload, id });
            afterSend?.();
            return { sent: failedUsers.has(users[0].id) ? 0 : 1, failed: failedUsers.has(users[0].id) ? 1 : 0, errors: [] };
          },
        } };
        throw new Error('Unexpected import: ' + name);
      },
    });
    cache.set(file, module.exports);
    return module.exports;
  };
  const seed = (id = 'payment-1', pupilId = 'pupil-1', feeId = 'fee-1') => {
    const payment = { id, pupilId, feeStructureId: feeId, academicYearId: 'year', termId: 'term', amount: 100, paymentDate: '2026-09-12', createdAt: '2026-09-12', paidBy: { id: 'staff', name: 'Cashier', role: 'Staff' } };
    documents.set('payments/' + id, payment);
    documents.set('pupils/' + pupilId, { firstName: 'Test', lastName: 'Pupil' });
    documents.set('feeStructures/' + feeId, { name: 'Tuition', amount: 500 });
    documents.set('system_users/staff', { role: 'Admin', isActive: true });
    return { paymentId: id, paymentData: payment };
  };
  return {
    documents, counts, sent, failedUsers, failedReads, stamp, seed,
    enqueue: load('src/lib/server/payment-notification-outbox.ts').enqueuePaymentNotificationEvents,
    process: load('src/lib/server/payment-notification-worker.ts').processPendingPaymentNotificationEvents,
    setAfterSend: (fn: () => void) => { afterSend = fn; },
    due: (id: string) => { documents.get('scheduledNotifications/fee-payment-events/outbox/payment-' + id).nextAttemptAt = stamp(0); },
  };
}
