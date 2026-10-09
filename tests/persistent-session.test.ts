import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requirePersistentSession } from '../src/lib/auth/persistent-session';

test('keeps local persistence when available', async () => {
  let fallback=false;
  await requirePersistentSession(async()=>{},async()=>{fallback=true;});
  assert.equal(fallback,false);
});
test('uses durable IndexedDB when local persistence fails', async () => {
  let fallback=false;
  await requirePersistentSession(async()=>{throw new Error('Local storage unavailable');},async()=>{fallback=true;});
  assert.equal(fallback,true);
});
test('rejects sign-in when neither durable backend works', async () => {
  await assert.rejects(requirePersistentSession(async()=>{throw new Error('Local storage unavailable');},async()=>{throw new Error('IndexedDB unavailable');}),/IndexedDB unavailable/);
});
