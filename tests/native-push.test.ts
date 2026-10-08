import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNativeSchool, nativeBindingOwner, nativeDeviceId, nativeDeviceInput, nativeSecretHash, nativeMessageData, expiredNativeToken } from '../src/lib/server/native-push-contract';

const device = { installationId: '12345678-abcd-1234-abcd-123456789abc', deviceSecret: 'a'.repeat(43), applicationId: 'ug.trinityfamilyschool.live', projectId: 'trinity-family-schools', token: 't'.repeat(160) };
const existing = { userId: 'parent-a', deviceSecretHash: nativeSecretHash(device.deviceSecret), isActive: true, transport: 'android-fcm' };
test('registration validates SDK token and a private device proof', () => {
  assert.deepEqual(nativeDeviceInput(device), device);
  for (const input of [{...device,token:'bad'}, {...device,deviceSecret:'short'}, {...device,installationId:'-'.repeat(36)}]) assert.throws(() => nativeDeviceInput(input), /INVALID_NATIVE_DEVICE/);
  assert.equal(nativeDeviceInput({...device,token:undefined}, false).token, undefined);
});
test('another application or Firebase project cannot bind this school device', () => {
  assert.doesNotThrow(() => assertNativeSchool(device,device.applicationId,device.projectId,device.projectId));
  for (const input of [{...device,projectId:'ganda-school'}, {...device,applicationId:'ug.trinity.ganda'}]) assert.throws(() => assertNativeSchool(input,device.applicationId,device.projectId,device.projectId), /NATIVE_SCHOOL_MISMATCH/);
  assert.throws(() => assertNativeSchool(device,device.applicationId,device.projectId,'ganda-school'), /NATIVE_SCHOOL_MISMATCH/);
});
test('initial binding and account changes require a verified identity plus the device proof', () => {
  assert.throws(() => nativeBindingOwner(device,undefined,'register'), /AUTH_REQUIRED/);
  assert.equal(nativeBindingOwner(device,existing,'register','parent-b'),'parent-b');
  assert.throws(() => nativeBindingOwner({...device,deviceSecret:'b'.repeat(43)},existing,'register','parent-b'), /NATIVE_DEVICE_PROOF_REQUIRED/);
});
test('background rotation preserves the bound account and cannot reactivate a retired device', () => {
  assert.equal(nativeBindingOwner(device,existing,'rotate','attacker'),'parent-a');
  assert.throws(() => nativeBindingOwner(device,{...existing,isActive:false},'rotate'), /NATIVE_DEVICE_NOT_REGISTERED/);
  assert.throws(() => nativeBindingOwner(device,undefined,'rotate'), /NATIVE_DEVICE_NOT_REGISTERED/);
});
test('deactivation is device scoped and rejects another device proof', () => {
  assert.equal(nativeBindingOwner(device,existing,'deactivate','attacker'),'parent-a');
  assert.throws(() => nativeBindingOwner({...device,deviceSecret:'b'.repeat(43)},existing,'deactivate'), /NATIVE_DEVICE_PROOF_REQUIRED/);
  assert.notEqual(nativeDeviceId(device),nativeDeviceId({...device,installationId:'12345678-abcd-1234-abcd-123456789abd'}));
  assert.notEqual(nativeDeviceId(device),nativeDeviceId({...device,applicationId:'ug.trinity.ganda'}));
});
test('sender identity and school metadata cannot be overridden by payload data', () => {
  const data=nativeMessageData('parent-a','school-one',{title:'Message',body:'Hello',url:'/parent',data:{recipientId:'parent-b',schoolProjectId:'school-two',googleReserved:'bad'}});
  assert.equal(data.recipientId,'parent-a');assert.equal(data.schoolProjectId,'school-one');assert.equal((data as Record<string,string>).googleReserved,undefined);assert.equal(data.url,'/parent');
});
test('oversized Unicode and escaped payloads remain below the FCM data limit', () => {
  for (const body of ['📝'.repeat(8000), '"'.repeat(8000)]) {
    const data=nativeMessageData('u'.repeat(128),'p'.repeat(100),{title:'"'.repeat(400),body,url:'/'+ '"'.repeat(800),tag:'"'.repeat(400),data:Object.fromEntries(Array.from({length:20},(_,i)=>['extra'+i,'"'.repeat(200)]))});
    assert.ok(Buffer.byteLength(JSON.stringify(data))<=3500);assert.ok(!data.body.endsWith('\uFFFD'));
  }
});
test('unsafe tap destinations fall back to the private school inbox', () => {
  for (const url of ['//evil.test','https://evil.test','/\\evil.test','/path\nHeader']) assert.equal(nativeMessageData('u','school',{title:'x',body:'y',url}).url,'/push-notifications');
});
test('payload/provider failures cannot retire a valid FCM registration', () => {
  assert.equal(expiredNativeToken('messaging/invalid-argument'),false);assert.equal(expiredNativeToken('messaging/server-unavailable'),false);
  assert.equal(expiredNativeToken('messaging/registration-token-not-registered'),true);
});
