import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRuntimeContext, auditObservationWindow } from '../src/lib/operational-audit/context';
import { buildOperationalAuditMarkdown } from '../src/lib/operational-audit/core';
import { measureWorkspaceOperation, measureWorkspaceRequest } from '../src/lib/startup/workspace-timing';

test('runtime context distinguishes Android browser, installed PWA and native WebView without a raw UA', () => {
  const input = {userAgent:'Mozilla/5.0 Android 15 Chrome/131.0.123.4 Safari/537.36 private-device-name',native:false,standalone:false,firstSetup:true};
  assert.deepEqual(auditRuntimeContext(input), {runtime:'browser',browser:'Chrome 131',os:'Android',startup:'first-setup'});
  assert.equal(auditRuntimeContext({...input,standalone:true,firstSetup:false}).runtime,'pwa');
  assert.equal(auditRuntimeContext({...input,native:true,standalone:true}).runtime,'native-android');
  assert.equal(auditRuntimeContext({...input,native:true}).browser,'Chrome 131 WebView');
  assert.doesNotMatch(JSON.stringify(auditRuntimeContext(input)),/private-device-name/);
});

test('browser families, OS and unknown setup state remain explicit', () => {
  assert.deepEqual(auditRuntimeContext({userAgent:'Windows Chrome/130.0 Edg/130.0',native:false,standalone:false}),
    {runtime:'browser',browser:'Edge 130',os:'Windows',startup:'unknown'});
  assert.equal(auditRuntimeContext({userAgent:'iPhone Version/18.0 Safari/605.1',native:false,standalone:true}).browser,'Safari 18');
  assert.equal(auditRuntimeContext({userAgent:'unknown',native:false,standalone:false}).os,'unknown');
});

test('performance timestamps describe measured work rather than delayed observer callbacks', () => {
  const origin = Date.parse('2026-10-12T06:00:00.000Z');
  assert.deepEqual(auditObservationWindow(1000,350,origin),
    {firstAt:'2026-10-12T06:00:01.000Z',lastAt:'2026-10-12T06:00:01.350Z'});
});

test('exports retain observed boundaries, separate batch saves and include informational stage timings', () => {
  const markdown = buildOperationalAuditMarkdown([{
    id:'batch',ts:new Date('2026-10-12T06:10:00Z'),sessionId:'session',startedAt:'2026-10-12T06:00:00Z',endedAt:'2026-10-12T06:10:00Z',appVersion:'deployed-sha',device:'phone',
    context:{runtime:'native-android',browser:'Chrome 131 WebView',os:'Android',startup:'first-setup'},
    events:[{kind:'performance',name:'workspace:android:snapshot-serialize',source:'workspace-timing',severity:'info',route:'/pupils',count:1,
      firstAt:'2026-10-12T06:00:01.000Z',lastAt:'2026-10-12T06:00:01.350Z',totalMs:350,minMs:350,maxMs:350}],
  }], '2026-10-12', false);
  assert.match(markdown,/Startup, data readiness, offline preparation and clicks/);
  assert.match(markdown,/native-android; Chrome 131 WebView; Android; first-setup/);
  assert.match(markdown,/Observed first \/ last \| Batch saved/);
  assert.match(markdown,/06:00:01.000Z \/ 2026-10-12T06:00:01.350Z/);
  assert.match(markdown,/06:10:00.000Z/);
  assert.match(markdown,/350 ms avg \/ 350 ms max/);
  assert.match(markdown,/not a screenshot/);
});

test('legacy audit exports mark context unknown instead of inventing native or startup information', () => {
  const markdown=buildOperationalAuditMarkdown([{id:'old',ts:new Date(),sessionId:'old',startedAt:'',endedAt:'',appVersion:'old-sha',device:'phone',events:[]}],'2026-10-12',false);
  assert.match(markdown,/old-sha; phone; runtime\/startup unknown/);
});

test('operation instrumentation preserves successful values and the original rejection', async () => {
  const failure=new Error('Original failure');
  assert.equal(await measureWorkspaceOperation('test:operation',()=>42),42);
  await assert.rejects(measureWorkspaceOperation('test:operation',()=>Promise.reject(failure)),error=>error===failure);
  assert.ok(performance.getEntriesByName('trinity:workspace:test:operation:failed').length);
});

test('request instrumentation preserves request arguments and HTTP failures without resubmitting', async () => {
  const previous=globalThis.fetch, calls: unknown[][]=[];
  const response=new Response('failure',{status:500});
  globalThis.fetch=async(...args)=>{calls.push(args);return response;};
  try {
    const options={method:'POST',body:'private form values'};
    assert.equal(await measureWorkspaceRequest('payment:create-request','/api/payments/create',options),response);
    assert.deepEqual(calls,[['/api/payments/create',options]]);
    const entry=performance.getEntriesByName('trinity:workspace:payment:create-request:http-error').at(-1) as PerformanceMeasure;
    assert.doesNotMatch(JSON.stringify(entry.detail),/private form/);
  } finally {globalThis.fetch=previous;}
});
