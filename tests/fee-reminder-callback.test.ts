import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file: string, imports: Record<string, any>, globals = {}) {
  const module = {exports: {} as any};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText,
    {module, exports: module.exports, console, AbortSignal, Set, Map, Error, SyntaxError, ...globals, require: (name: string) => {
      assert.ok(name in imports, name); return imports[name];
    }});
  return module.exports;
}
function routeFixture() {
  let authError = '', allowed = true, fail = false, user: any = {}; const calls: any[] = [];
  const route = load('src/app/api/fees/reminders/reconcile/route.ts', {
    'next/server': {NextResponse: {json: (body: any, options: any) => ({body, status: options?.status || 200})}},
    'firebase-admin/firestore': {getFirestore: () => ({collection: () => ({doc: () => ({get: async () => ({data: () => ({pupilId: 'actual-pupil'})})})})})},
    '@/lib/firebase-admin': {getFirebaseAdminApp: () => ({})},
    '@/lib/server/fee-notes-gate': {readFeeNotesGate: async () => ({anyEnabled: true, isEnabled: () => true})},
    '@/lib/server/app-auth': {requireAppUser: async () => {if (authError) throw Error(authError); return {user};}},
    '@/lib/fees/fee-reminders': {canReceiveFeeReminders: () => allowed},
    '@/lib/server/fee-reminders': {processFeeReminderChange: async (change: any) => {calls.push(change); if (fail) throw Error('temporary');}},
  });
  return {calls, post: (body: any) => route.POST({json: async () => body}),
    auth: (error: string) => {authError = error;}, allow: (value: boolean) => {allowed = value;}, user: (value: any) => {user = value;}, fail: () => {fail = true;}};
}
test('payment callbacks require signed active Fees access and validate identifiers', async () => {
  const f = routeFixture(); f.auth('AUTH_REQUIRED'); assert.equal((await f.post({pupilIds: ['pupil']})).status, 401);
  f.auth(''); f.allow(false); assert.equal((await f.post({pupilIds: ['pupil']})).status, 403);
  f.allow(true);
  for (const body of [null, [], {pupilIds: ['../forged']}, {feeIds: Array(101).fill('fee')}, {scopes: [null]}, {source: {collection: 'payments', id: 'payment'}}]) {
    assert.equal((await f.post(body)).status, 400);
  }
  assert.equal(f.calls.length, 0);
});
test('callbacks recompute supplied pupil identities from committed data and never accept balances or recipients', async () => {
  const f = routeFixture(); assert.equal((await f.post({pupilIds: ['previous-pupil'], source: {collection: 'uniformTracking', id: 'record'}, amount: 999, recipientIds: ['forged']})).status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0])), {reversal: false, pupilIds: ['previous-pupil']});
  f.fail(); assert.equal((await f.post({pupilIds: ['pupil']})).status, 503);
});
test('staff assignment and uniform editors can recalculate without Fees inbox access; parents cannot', async () => {
  const f = routeFixture(); f.allow(false);
  f.user({role: 'Staff', modulePermissions: [{module: 'pupils', permission: 'edit'}]});
  assert.equal((await f.post({pupilIds: ['pupil']})).status, 200);
  f.user({role: 'Staff', granularPermissions: [{moduleId: 'uniforms', pages: [{canAccess: true, actions: [{actionId: 'record_collection', allowed: true}]}]}]});
  assert.equal((await f.post({source: {collection: 'uniformTracking', id: 'record'}})).status, 200);
  f.user({role: 'Parent', modulePermissions: [{module: 'pupils', permission: 'edit'}]});
  assert.equal((await f.post({pupilIds: ['pupil']})).status, 403);
});
test('browser callbacks preserve failed work, recover on reconnect, and keep pending work per account', async () => {
  const storage = new Map<string, string>(); const auth = {currentUser: {uid: 'cashier', isAnonymous: false, getIdToken: async () => 'signed'}};
  let status = 503, online: (() => void) | undefined; const calls: any[] = [];
  const client = load('src/lib/fees/fee-reminder-change-client.ts', {
    '@/lib/firebase': {auth}, 'firebase/auth': {onAuthStateChanged: () => () => {}},
    'firebase/firestore': {doc: () => ({}), getDocFromCache: async () => ({data: () => ({pupilId: 'joan'})})},
  }, {window: {addEventListener: (_: string, fn: () => void) => {online = fn;}, removeEventListener: () => {}},
    localStorage: {getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value)},
    fetch: async (_: string, request: any) => {calls.push(JSON.parse(request.body)); return {ok: status === 200, status};}});
  await client.notifyFeeReminderChange({pupilIds: ['joan']});
  assert.equal(JSON.parse(storage.get('fee-reminder-changes:cashier')!).length, 1);
  auth.currentUser = {...auth.currentUser, uid: 'other'}; status = 200; await client.flushFeeReminderChanges();
  assert.equal(JSON.parse(storage.get('fee-reminder-changes:cashier')!).length, 1);
  auth.currentUser = {...auth.currentUser, uid: 'cashier'}; const dispose = client.recoverFeeReminderChanges(); online!(); await client.flushFeeReminderChanges();
  assert.deepEqual(JSON.parse(storage.get('fee-reminder-changes:cashier')!), []); dispose();
  assert.ok(calls.length >= 2);
});
