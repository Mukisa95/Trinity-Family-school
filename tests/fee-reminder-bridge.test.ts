import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {feeReminderTarget} from '../functions/fee-reminder-targets';
import {sendFeeReminderWebsitePush} from '../functions/fee-reminder-web-push';

test('each school sends to its own website and unknown projects fail closed', () => {
  assert.equal(feeReminderTarget('trinity-family-ganda').origin, 'https://gandalocked.vercel.app');
  assert.equal(feeReminderTarget('trinity-family-schools').origin, 'https://trinityfamilyschool.vercel.app');
  assert.throws(() => feeReminderTarget('unknown'));
});
test('the trigger obtains a Google identity for the exact audience and signs the website request', async () => {
  const calls: any[] = [], delivery = {id: 'note', version: 2};
  await sendFeeReminderWebsitePush('trinity-family-schools', delivery, async (url: any, options: any) => {
    calls.push({url, options}); return calls.length === 1 ? new Response('signed-identity') : new Response('{}');
  });
  assert.equal(calls[0].options.headers['Metadata-Flavor'], 'Google');
  assert.equal(new URL(calls[0].url).searchParams.get('audience'), calls[1].url);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer signed-identity');
  assert.deepEqual(JSON.parse(calls[1].options.body), delivery);
});
test('identity and website failures reach the independent function retry', async () => {
  await assert.rejects(() => sendFeeReminderWebsitePush('trinity-family-schools', {}, async () => new Response('', {status: 403})), /identity/);
  let requests = 0;
  await assert.rejects(() => sendFeeReminderWebsitePush('trinity-family-schools', {}, async () => ++requests === 1 ? new Response('identity') : new Response('', {status: 503})), /503.*retry/);
});
function authFixture(claims: any, fail = false) {
  const checks: any[] = [], module = {exports: {} as any};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/server/fee-reminder-function-auth.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {
    exports: module.exports, module,
    require: (name: string) => name === 'server-only' ? {} : name === 'google-auth-library' ? {OAuth2Client: class {
      async verifyIdToken(options: any) {checks.push(options); if (fail) throw new Error('Invalid signature, audience or expiration'); return {getPayload: () => claims};}
    }} : {feeReminderTarget},
  });
  return {verify: module.exports.verifyFeeReminderFunction, checks};
}
test('only the same-school verified service identity can send a function delivery', async () => {
  const f = authFixture({email: '148171496339-compute@developer.gserviceaccount.com', email_verified: true});
  assert.equal(await f.verify('Bearer signed', 'trinity-family-schools'), true);
  assert.equal(f.checks[0].audience, feeReminderTarget('trinity-family-schools').audience);
  assert.equal(await f.verify('Bearer signed', 'trinity-family-ganda'), false);
  assert.equal(await authFixture({email: 'attacker@gmail.com', email_verified: true}).verify('Bearer signed', 'trinity-family-schools'), false);
  assert.equal(await authFixture({email: '148171496339-compute@developer.gserviceaccount.com', email_verified: false}).verify('Bearer signed', 'trinity-family-schools'), false);
});
test('missing, invalid, expired or wrongly addressed identities never authorize delivery', async () => {
  const f = authFixture({}, true);
  for (const header of [null, '', 'Basic token', 'Bearer invalid']) assert.equal(await f.verify(header, 'trinity-family-schools'), false);
  assert.equal(await f.verify('Bearer signed', 'unknown'), false);
});

function routeFixture(authorized: boolean, note: any) {
  const pushes: any[] = [], module = {exports: {} as any};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/fees/reminders/function-delivery/route.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {
    exports: module.exports, module, process: {env: {}},
    require: (name: string) => {
      if (name === 'next/server') return {NextResponse: {json: (data: any, options?: any) => new Response(JSON.stringify(data), options)}};
      if (name === '@/lib/firebase-admin') return {getFirebaseAdminApp: () => ({options: {projectId: 'trinity-family-schools'}})};
      if (name === '@/lib/server/fee-reminder-function-auth') return {verifyFeeReminderFunction: async () => authorized};
      if (name === 'firebase-admin/firestore') return {getFirestore: () => ({collection: () => ({doc: () => ({get: async () => ({data: () => note})})})})};
      if (name === '@/lib/server/fee-reminders') return {sendCustomFeeNotePush: async (d: any) => pushes.push(d), sendFeeReminderResolutionPush: async (d: any) => pushes.push(d)};
      throw Error('Unexpected route import '+name);
    },
  });
  const delivery = {id: 'note', pupilId: 'joan', version: 2, type: 'FEE_REMINDER_RESOLVED', title: 'Promise paid', body: 'No follow-up required', recipientIds: ['cashier'], collectRecipientIds: ['cashier']};
  return {pushes, delivery, invoke: (d = delivery) => module.exports.POST({headers: new Headers({authorization: 'Bearer identity'}), json: async () => d})};
}
test('the delivery endpoint denies unauthorized calls and ignores replaced or resolved deliveries', async () => {
  const denied = routeFixture(false, {}); assert.equal((await denied.invoke()).status, 401); assert.equal(denied.pushes.length, 0);
  for (const note of [null, {pupilId: 'another', notificationVersion: 2, dismissalPending: true, reminderStatus: 'fulfilled'},
    {pupilId: 'joan', notificationVersion: 3, dismissalPending: true, reminderStatus: 'fulfilled'},
    {pupilId: 'joan', notificationVersion: 2, dismissalPending: false, reminderStatus: 'fulfilled'}]) {
    const f = routeFixture(true, note); assert.equal((await (await f.invoke()).json()).skipped, true); assert.equal(f.pushes.length, 0);
  }
});
test('a verified current cancellation or custom notice uses the websites existing push sender', async () => {
  const f = routeFixture(true, {pupilId: 'joan', notificationVersion: 2, dismissalPending: true, reminderStatus: 'cancelled'});
  assert.equal((await f.invoke()).status, 200); assert.equal(f.pushes.length, 1);
  const invalid = routeFixture(true, {}); assert.equal((await invalid.invoke({...invalid.delivery, id: '../invalid'})).status, 400);
  const custom = routeFixture(true, {pupilId: 'joan', notificationVersion: 2, customDeliveryPending: true, reminderStatus: 'sent'});
  assert.equal((await custom.invoke({...custom.delivery, type: 'FEE_REMINDER_ALERT'})).status, 200); assert.equal(custom.pushes.length, 1);
});
