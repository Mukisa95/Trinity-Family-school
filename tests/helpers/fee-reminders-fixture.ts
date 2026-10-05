import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import * as model from '../../src/lib/fees/fee-reminders';
import * as discounts from '../../src/lib/utils/fee-discount-calculation';
import * as adjustments from '../../src/lib/utils/fee-adjustments';
import * as assignments from '../../src/lib/utils/fee-assignment-pipeline';
import * as applicability from '../../src/lib/utils/fee-applicability';
import * as firestoreValues from '../../src/lib/fees/reminder-engine/firestore-values';
import * as lifecycle from '../../src/lib/fees/reminder-engine/fee-reminder-lifecycle';
import * as customModel from '../../src/lib/fees/custom-fee-notes';
import * as customLifecycle from '../../src/lib/fees/reminder-engine/custom-fee-notes';

export function feeReminderFixture() {
  const documents = new Map<string, any>();
  const versions = new Map<string, number>();
  const pushes: any[] = [];
  const reads: string[] = [];
  const failPushUsers = new Set<string>();
  const failReads = new Set<string>();
  let beforePush: (() => void | Promise<void>) | undefined;
  let enabledPupils: Set<string> | null = null;
  const readFeeNotesGate = async () => ({anyEnabled: enabledPupils === null || enabledPupils.size > 0,
    isEnabled: (id: string) => enabledPupils === null || enabledPupils.has(id)});
  const stamp = (value: Date) => ({ toDate: () => value, toMillis: () => value.getTime() });
  const clone = (value: any): any => {
    if (!value || typeof value !== 'object' || value.toDate) return value;
    return Array.isArray(value) ? value.map(clone) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  };
  const snapshot = (path: string) => ({ id: path.split('/').at(-1)!, ref: doc(path), exists: documents.has(path), data: () => clone(documents.get(path)) });
  const write = (path: string, input: any, merge = false) => {
    const data = merge ? clone(documents.get(path) || {}) : {};
    for (const [key, value] of Object.entries(input) as any) {
      assert.notEqual(value, undefined, `${path}: Firestore rejects undefined fields`);
      if (value?.op === 'delete') delete data[key]; else data[key] = clone(value);
    }
    documents.set(path, data); versions.set(path, (versions.get(path) || 0) + 1);
  };
  const doc = (path: string): any => ({ path, id: path.split('/').at(-1),
    get: async () => { reads.push(path); if (failReads.has(path)) throw new Error('read unavailable'); return snapshot(path); },
    set: async (data: any, options?: any) => write(path, data, options?.merge),
    update: async (data: any) => write(path, data, true),
  });
  const collection = (name: string, filters: any[] = []): any => ({
    path: name, query: true,
    doc: (id: string) => doc(`${name}/${id}`),
    where: (field: string, operator: string, value: any) => collection(name, [...filters, [field, operator, value]]),
    get: async () => {
      reads.push(name);
      if (failReads.has(name)) throw new Error('query unavailable');
      return { docs: [...documents].filter(([path, data]) => path.startsWith(`${name}/`) && path.split('/').length === 2
        && filters.every(([field, operator, value]) => operator === 'in' ? value.includes(data[field]) : operator === 'array-contains' ? data[field]?.includes(value) : data[field] === value)).map(([path]) => snapshot(path)) };
    },
  });
  const makeBatch = () => {
    const writes: any[] = [];
    return { set: (ref: any, data: any, options?: any) => writes.push([ref.path, data, options?.merge]),
      update: (ref: any, data: any) => writes.push([ref.path, data, true]),
      commit: async () => writes.forEach(([path, data, merge]) => write(path, data, merge)) };
  };
  const db = { collection, batch: makeBatch, getAll: async (...refs: any[]) => Promise.all(refs.map(ref => ref.get())),
    runTransaction: async (callback: any) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const readVersions = new Map(versions); const writes: any[] = [];
        const value = await callback({
          get: async (ref: any) => { assert.equal(writes.length, 0, 'All transaction reads precede writes'); return ref.get(); },
          create: (ref: any, data: any) => writes.push([ref.path, data, false, true]),
          update: (ref: any, data: any) => writes.push([ref.path, data, true, false]),
          set: (ref: any, data: any, options?: any) => writes.push([ref.path, data, options?.merge, false]),
        });
        if ([...versions].some(([path, version]) => readVersions.get(path) !== version)) continue;
        writes.forEach(([path, data, merge, create]) => { if (create) assert.equal(documents.has(path), false); write(path, data, merge); });
        return value;
      }
      throw new Error('transaction contention');
    },
  };
  const module = { exports: {} as any };
  const output = ts.transpileModule(fs.readFileSync('src/lib/server/fee-reminders.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(output, {
    module, exports: module.exports, Date, console,
    require: (name: string) => {
      if (name === 'server-only') return {};
      if (name === 'crypto') return crypto;
      if (name === 'firebase-admin/firestore') return { getFirestore: () => db, Timestamp: { fromDate: stamp },
        FieldValue: { serverTimestamp: () => stamp(new Date()), delete: () => ({ op: 'delete' }) } };
      if (name === '@/lib/firebase-admin') return { getFirebaseAdminApp: () => ({}) };
      if (name === '@/lib/server/fee-notes-gate') return {readFeeNotesGate};
      if (name === '@/lib/fees/fee-reminders') return model;
      if (name === '@/lib/utils/fee-discount-calculation') return discounts;
      if (name === '@/lib/utils/fee-adjustments') return adjustments;
      if (name === '@/lib/utils/fee-assignment-pipeline') return assignments;
      if (name === '@/lib/utils/fee-applicability') return applicability;
      if (name === '../fees/reminder-engine/firestore-values') return firestoreValues;
      if (name === '@/lib/server/scheduled-dispatch-queue') return { SCHEDULED_DISPATCH_QUEUE: 'scheduledDispatchQueue' };
      if (name === '../fees/reminder-engine/fee-reminder-lifecycle') return lifecycle;
      if (name === '@/lib/fees/custom-fee-notes') return customModel;
      if (name === '../fees/reminder-engine/custom-fee-notes') return customLifecycle;
      if (name === '@/lib/server/push-notifications') return {
        getServerPushSubscriptionsForUsers: async (ids: string[]) => ids.filter(id => documents.has(`subscriptions/${id}`)).map(id => ({ userId: id, id })),
        sendServerWebPush: async (targets: any[], payload: any) => {
          const action = beforePush; beforePush = undefined; await action?.();
          targets.forEach(target => pushes.push({ userId: target.userId, payload }));
          const failed = targets.filter(target => failPushUsers.has(target.userId)).length;
          return { accepted: targets.length - failed, failed, expired: 0, rejected: 0 };
        },
      };
      throw new Error(`Unexpected server import: ${name}`);
    },
  });
  return { documents, pushes, reads, failPushUsers, failReads, db, stamp, server: module.exports,
    readFeeNotesGate, setEnabledFeeNotesPupils: (ids: string[]) => {enabledPupils = new Set(ids);},
    setBeforePush: (value: () => void | Promise<void>) => { beforePush = value; }, seed: (path: string, data: any) => write(path, data) };
}
