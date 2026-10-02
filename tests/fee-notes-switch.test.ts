import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import * as noteModel from '../src/lib/fees/fee-reminders';
import {feeReminderFixture} from './helpers/fee-reminders-fixture';
function load(path: string, imports: Record<string, any>, globals = {}) {
  const module = {exports: {} as any};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText,
    {module, exports: module.exports, console, Date, Error, SyntaxError, AbortSignal, ...globals, require: (name: string) => {
      assert.ok(name in imports, name); return imports[name];
    }});
  return module.exports;
}
test('missing switches are off; switching another pupil on does not read a disabled pupil', async () => {
  const f = feeReminderFixture(); f.setEnabledFeeNotesPupils(['enabled-pupil']);
  await f.server.processFeeReminderChange({pupilIds: ['off-pupil']});
  await f.server.processRecordedFeePayments([{paymentData: {pupilId: 'off-pupil', feeStructureId: 'fee', academicYearId: 'year', termId: 'term'}}]);
  await f.server.reconcileFeeReminders('off-pupil');
  await f.server.withLiveCustomFeeDetails([{kind: 'custom'}], 'off-pupil');
  await f.server.dispatchFeeReminder('note', new Date(), 1, 'off-pupil');
  assert.deepEqual(f.reads, []); assert.equal(f.documents.size, 0);
});
test('all-off payments, catalog edits and deadline jobs perform zero Firestore reads or writes', async () => {
  const f = feeReminderFixture(); f.setEnabledFeeNotesPupils([]);
  await f.server.processFeeReminderChange({pupilIds: ['joan'], feeIds: ['fee'], reversal: true});
  await f.server.dispatchFeeReconciliation('joan', ['note']);
  await f.server.dispatchFeeReminder('legacy-note');
  await f.server.sendCustomFeeNotePush({pupilId: 'joan', recipientIds: ['user']});
  await f.server.sendFeeReminderResolutionPush({pupilId: 'joan', recipientIds: ['user']});
  assert.deepEqual(f.reads, []); assert.equal(f.documents.size, 0); assert.equal(f.pushes.length, 0);
});
test('disabled GET, creation and change endpoints stop before account lookup or fee queries', async () => {
  const imports = {
    'next/server': {NextResponse: {json: (body: any, options: any) => ({body, status: options?.status || 200})}},
    'firebase-admin/firestore': {getFirestore: () => {throw Error('Firestore must not be consulted');}},
    '@/lib/firebase-admin': {getFirebaseAdminApp: () => {throw Error('Firestore app must not be consulted');}},
    '@/lib/server/fee-notes-gate': {readFeeNotesGate: async () => ({anyEnabled: false, isEnabled: () => false})},
    '@/lib/server/app-auth': {requireAppUser: async () => {throw Error('Account lookup must not run');}},
    '@/lib/fees/fee-reminders': {},
    '@/lib/server/fee-reminders': {FeeReminderError: Error, validateFeeReminderInput: (input: any) => input},
  };
  const notes = load('src/app/api/fees/reminders/route.ts', imports);
  const request = {nextUrl: {searchParams: new URLSearchParams({pupilId: 'joan'})}, json: async () => ({pupilId: 'joan'})};
  assert.equal((await notes.GET(request)).status, 200);
  assert.equal((await notes.POST(request)).status, 403);
  const changes = load('src/app/api/fees/reminders/reconcile/route.ts', imports);
  assert.equal((await changes.POST(request)).status, 200);
  const update = load('src/app/api/fees/reminders/[id]/route.ts', imports);
  assert.equal((await update.PATCH(request, {params: Promise.resolve({id: 'note'})})).status, 403);
});
test('off Notes hooks have no polling, recipients, listeners or requests, even on a manual refetch', async () => {
  let requests = 0, listeners = 0; const effects: Array<() => void> = [];
  const hooks = load('src/lib/hooks/use-fee-reminders.ts', {
    '@tanstack/react-query': {useQueryClient: () => ({}), useQuery: (options: any) => options, useMutation: (options: any) => options},
    react: {useEffect: (effect: () => void) => effects.push(effect)},
    '@/lib/firebase': {auth: {currentUser: {getIdToken: async () => 'token'}}},
    '@/lib/contexts/auth-context': {useAuth: () => ({user: {id: 'cashier'}})},
    '@/lib/fees/fee-reminders': {canManageFeeReminders: () => true},
  }, {navigator: {serviceWorker: {addEventListener: () => {listeners++;}}}, fetch: async () => {requests++;}});
  const result = hooks.useFeeReminders('joan', true);
  assert.equal(result.notes.enabled, false); assert.equal(result.recipients.enabled, false); assert.equal(result.notes.refetchInterval, false);
  effects.forEach(effect => effect()); await result.notes.queryFn({}); await result.recipients.queryFn({});
  assert.equal(requests, 0); assert.equal(listeners, 0);
});
test('server gate defaults off, uses no Firestore, and sees a cross-instance disable on its next lookup', async () => {
  let template: any = {parameters: {}}; let reads = 0;
  const gate = load('src/lib/server/fee-notes-gate.ts', {
    'server-only': {}, crypto,
    '@/lib/firebase-admin': {getFirebaseAdminApp: () => ({options: {projectId: 'school', credential: {getAccessToken: async () => ({access_token: 'test-only'})}}})},
  }, {fetch: async () => {reads++; return {ok: true, json: async () => template, headers: {get: () => 'etag'}};}});
  assert.equal((await gate.readFeeNotesGate()).isEnabled('joan'), false);
  const id = crypto.createHash('sha256').update('joan').digest('hex');
  template = {parameters: {fee_notes_enabled_pupils: {defaultValue: {value: JSON.stringify([id])}}}};
  assert.equal((await gate.readFeeNotesGate()).isEnabled('joan'), true);
  template = {parameters: {}};
  assert.equal((await gate.readFeeNotesGate()).isEnabled('joan'), false); assert.equal(reads, 3);
});
test('switch publishing preserves other pupils and retries an ETag conflict instead of overwriting', async () => {
  const other = crypto.createHash('sha256').update('other').digest('hex');
  let conflicts = 1, writes = 0, template: any = {parameters: {unrelated: {defaultValue: {value: 'keep'}}, fee_notes_enabled_pupils: {defaultValue: {value: JSON.stringify([other])}}}};
  const gate = load('src/lib/server/fee-notes-gate.ts', {'server-only': {}, crypto,
    '@/lib/firebase-admin': {getFirebaseAdminApp: () => ({options: {projectId: 'school', credential: {getAccessToken: async () => ({access_token: 'test-only'})}}})},
  }, {fetch: async (_: string, options: any) => {
    if (options.method === 'PUT') {writes++; assert.equal(options.headers['If-Match'], 'etag'); if (conflicts--) return {ok: false, status: 412}; template = JSON.parse(options.body);}
    return {ok: true, json: async () => template, headers: {get: () => 'etag'}};
  }});
  await gate.publishFeeNotesSwitch('joan', true);
  const result = await gate.readFeeNotesGate();
  assert.equal(result.isEnabled('joan'), true); assert.equal(result.isEnabled('other'), true);
  assert.equal(template.parameters.unrelated.defaultValue.value, 'keep'); assert.equal(writes, 2);
});

function switchFixture() {
  const f = feeReminderFixture(), enabled = new Set(['joan', 'other']);
  let failPublish = false, failReconciliation = false, reconciliations = 0;
  const actor = {id: 'cashier', username: 'cashier', firstName: 'Fee', role: 'Staff', isActive: true,
    modulePermissions: [{module: 'fees', permission: 'edit'}], createdAt: ''};
  f.seed('pupils/joan', {feeNotesEnabled: true}); f.seed('system_users/cashier', actor); f.seed('subscriptions/cashier', {});
  f.seed('feeReminders/promise', {pupilId: 'joan', pupilName: 'Joan Kagwa', kind: 'promise', reminderStatus: 'scheduled',
    dueAt: f.stamp(new Date(Date.now() + 86400000)), notificationVersion: 2, recipientIds: ['cashier']});
  f.seed('feeReminders/completed', {pupilId: 'joan', kind: 'custom', reminderStatus: 'sent'});
  f.seed('feeReminderTargets/joan', {entries: {promise: {}}, feeIds: ['tuition']});
  f.seed('scheduledDispatchQueue/retry', {channel: 'fee_reconcile', sourceId: 'joan', status: 'scheduled'});
  f.seed('scheduledDispatchQueue/attendance', {channel: 'attendance', sourceId: 'joan', status: 'scheduled'});
  f.seed('notifications/fee-reminder-promise', {recipientIds: ['cashier'], readBy: [], metadata: {source: 'fee-reminders'}});
  const switches = load('src/lib/server/fee-notes-switch.ts', {
    'server-only': {}, crypto,
    'firebase-admin/firestore': {getFirestore: () => f.db, Timestamp: {now: () => f.stamp(new Date())},
      FieldValue: {serverTimestamp: () => f.stamp(new Date()), delete: () => ({op: 'delete'})}},
    '@/lib/firebase-admin': {getFirebaseAdminApp: () => ({})},
    '@/lib/server/fee-notes-gate': {publishFeeNotesSwitch: async (id: string, on: boolean) => {
      if (failPublish) throw Error('Switch service unavailable');
      if (on) enabled.add(id); else enabled.delete(id); f.setEnabledFeeNotesPupils([...enabled]);
    }},
    '@/lib/server/pupil-cache-revisions.admin': {updatePupilWithCacheRevision: async (_: any, ref: any, data: any) => ref.update(data)},
    '@/lib/fees/fee-reminders': noteModel,
    '@/lib/server/fee-reminders': {...f.server, FEE_REMINDER_TARGETS: 'feeReminderTargets', reconcileFeeReminders: async () => {reconciliations++; if (failReconciliation) throw Error('Ledger unavailable');}},
    '@/lib/server/scheduled-dispatch-queue': {SCHEDULED_DISPATCH_QUEUE: 'scheduledDispatchQueue'},
  });
  return {...f, actor, enabled, switches, failPublishing: () => {failPublish = true;}, failReconciliation: () => {failReconciliation = true;}, reconciliations: () => reconciliations};
}

test('switching off pauses saved notes, cancels only fee jobs, clears markers and explains the pause to recipients', async () => {
  const f = switchFixture();
  await f.switches.setPupilFeeNotesSwitch('joan', false, f.actor);
  assert.equal(f.enabled.has('joan'), false); assert.equal(f.enabled.has('other'), true);
  assert.equal(f.documents.get('pupils/joan').feeNotesEnabled, false);
  assert.equal(f.documents.get('pupils/joan').feeNotesSwitchLease, undefined);
  assert.equal(f.documents.get('feeReminders/promise').featurePaused, true);
  assert.equal(f.documents.get('feeReminders/promise').reminderStatus, 'scheduled');
  assert.equal(f.documents.get('feeReminders/completed').featurePaused, undefined);
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-promise').status, 'cancelled');
  assert.equal(f.documents.get('scheduledDispatchQueue/retry').status, 'cancelled');
  assert.equal(f.documents.get('scheduledDispatchQueue/attendance').status, 'scheduled');
  assert.equal(f.documents.get('feeReminderTargets/joan').feeIds.length, 0);
  assert.equal(f.pushes.length, 1); assert.match(f.pushes[0].payload.body, /does not confirm that fees were paid/);
  assert.equal(f.documents.get('notifications/fee-reminder-promise').metadata.resolved, true);
  assert.match(f.documents.get('notifications/fee-reminder-promise').description, /do not use it for a parent follow-up/);
  f.reads.length = 0;
  await f.server.processFeeReminderChange({pupilIds: ['joan']});
  assert.deepEqual(f.reads, []);
});

test('switching back on restores deadlines and reconciles payments made while paused', async () => {
  const f = switchFixture();
  await f.switches.setPupilFeeNotesSwitch('joan', false, f.actor);
  const deadline = f.documents.get('feeReminders/promise').dueAt.toMillis();
  await f.switches.setPupilFeeNotesSwitch('joan', true, f.actor);
  assert.equal(f.enabled.has('joan'), true); assert.equal(f.documents.get('pupils/joan').feeNotesEnabled, true);
  assert.equal(f.documents.get('feeReminders/promise').featurePaused, false);
  const job = f.documents.get('scheduledDispatchQueue/fee-reminder-promise');
  assert.equal(job.status, 'scheduled'); assert.equal(job.pupilId, 'joan'); assert.equal(job.dueAt.toMillis(), deadline);
  assert.equal(f.reconciliations(), 1);
  assert.equal([...f.documents].find(([path]) => path.includes('fee-reconcile-enabled-'))?.[1].status, 'completed');
});

test('a failed resume calculation leaves a due retry with pupil identity and preserved original deadlines', async () => {
  const f = switchFixture(); f.failReconciliation();
  await f.switches.setPupilFeeNotesSwitch('joan', true, f.actor);
  const retry = [...f.documents].find(([path]) => path.includes('fee-reconcile-enabled-'))![1];
  assert.equal(retry.status, 'scheduled'); assert.equal(retry.pupilId, 'joan'); assert.equal(retry.reminderIds[0], 'promise');
  assert.equal(f.enabled.has('joan'), true); assert.equal(f.documents.get('pupils/joan').feeNotesSwitchLease, undefined);
});

test('a failed switch-on rolls the displayed flag back to off and releases its lock', async () => {
  const f = switchFixture(); f.enabled.delete('joan'); f.seed('pupils/joan', {feeNotesEnabled: false}); f.failPublishing();
  await assert.rejects(f.switches.setPupilFeeNotesSwitch('joan', true, f.actor), /Switch service unavailable/);
  assert.equal(f.documents.get('pupils/joan').feeNotesEnabled, false);
  assert.equal(f.documents.get('pupils/joan').feeNotesSwitchLease, undefined);
  assert.equal(f.enabled.has('joan'), false);
});

test('a simultaneous switch action cannot overwrite an in-progress action for the same pupil', async () => {
  const f = switchFixture(); f.seed('pupils/joan', {feeNotesEnabled: true, feeNotesSwitchLease: {owner: 'other', until: Date.now() + 60000}});
  await assert.rejects(f.switches.setPupilFeeNotesSwitch('joan', false, f.actor), /SWITCH_BUSY/);
  assert.equal(f.enabled.has('joan'), true); assert.equal(f.documents.get('pupils/joan').feeNotesSwitchLease.owner, 'other');
});

test('the switch endpoint requires fees management permission and validates its pupil and boolean setting', async () => {
  let allowed = false, mutations = 0;
  const route = load('src/app/api/fees/reminders/switch/route.ts', {
    'next/server': {NextResponse: {json: (body: any, options: any) => ({body, status: options?.status || 200})}},
    '@/lib/server/app-auth': {requireAppUser: async () => ({user: {id: 'staff'}})},
    '@/lib/fees/fee-reminders': {canManageFeeReminders: () => allowed},
    '@/lib/server/fee-notes-switch': {setPupilFeeNotesSwitch: async () => {mutations++; return {enabled: true};}},
  });
  const request = (body: any) => ({json: async () => body});
  assert.equal((await route.POST(request({pupilId: 'joan', enabled: true}))).status, 403);
  allowed = true;
  assert.equal((await route.POST(request({pupilId: '../joan', enabled: true}))).status, 400);
  assert.equal((await route.POST(request({pupilId: 'joan', enabled: 'yes'}))).status, 400);
  assert.equal(mutations, 0);
  assert.equal((await route.POST(request({pupilId: 'joan', enabled: true}))).status, 200);
  assert.equal(mutations, 1);
});

for (const unavailable of [false, true]) test(`scheduler ${unavailable ? 'switch outage' : 'disabled switch'} skips fee claims and still considers other notifications`, async () => {
  const claims: string[] = [], cancellations: string[] = [];
  const documents = [{id: 'fee-job', data: () => ({channel: 'fee_reminder', pupilId: 'off-pupil'}),
    ref: {set: async () => cancellations.push('fee-job')}}, {id: 'other-job', data: () => ({channel: 'attendance'})}];
  const collection: any = {where: () => collection, orderBy: () => collection, limit: () => collection,
    get: async () => ({docs: documents}), doc: (id: string) => ({id})};
  const route = load('src/app/api/cron/send-scheduled-sms/route.ts', {
    'next/server': {NextResponse: {json: (body: any, options: any) => ({body, status: options?.status || 200})}},
    'firebase-admin/firestore': {getFirestore: () => ({collection: () => collection,
      runTransaction: async (callback: any) => callback({get: async (ref: any) => {claims.push(ref.id); return {exists: true, data: () => ({status: 'cancelled'})};}})}),
      Timestamp: {fromDate: (value: Date) => value}, FieldValue: {serverTimestamp: () => 'now'}},
    '@/lib/firebase-admin': {getFirebaseAdminApp: () => ({})},
    '@/lib/server/fee-notes-gate': {readFeeNotesGate: async () => {
      if (unavailable) throw Error('Switch unavailable'); return {anyEnabled: true, isEnabled: () => false};
    }},
    '@/lib/server/app-auth': {}, '@/lib/services/granular-permissions.service': {},
    '@/lib/server/notification-automation': {}, '@/lib/notifications/automation-settings': {},
    '@/lib/scheduler/schedule-times': {}, '@/lib/scheduler/academic-term-status': {},
    '@/lib/server/scheduled-dispatch-queue': {SCHEDULED_DISPATCH_QUEUE: 'scheduledDispatchQueue'},
    '@/lib/server/fee-reminders': {}, '@/lib/fees/fee-reminders': {},
  }, {process: {env: {CRON_SECRET: 'test-secret'}}});
  const result = await route.GET({headers: {get: () => 'test-secret'}});
  assert.equal(result.status, 200); assert.deepEqual(claims, ['other-job']);
  assert.deepEqual(cancellations, unavailable ? [] : ['fee-job']);
});
