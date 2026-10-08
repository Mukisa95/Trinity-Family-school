import 'server-only';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirebaseAdminApp, getFirebaseAdminProjectId } from '@/lib/firebase-admin';
import release from '@/lib/android/app-release.json';
import { assertNativeSchool, nativeBindingOwner, expiredNativeToken, nativeDeviceId, nativeSecretHash, nativeSecretMatches, nativeMessageData, type NativeDeviceInput } from './native-push-contract';
import type { ServerPushSubscription, WebPushPayload } from './push-notifications';

function verifySchool(input: NativeDeviceInput) {
  assertNativeSchool(input, release.applicationId, release.firebaseProjectId, getFirebaseAdminProjectId());
}
/** Bearer authentication is used for initial registration/account changes. Device proofs only rotate or retire that binding. */
export async function updateNativeDevice(input: NativeDeviceInput, action: 'register' | 'rotate' | 'deactivate', userId?: string) {
  verifySchool(input);
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection('pushSubscriptions').doc(nativeDeviceId(input));
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref), previous = snapshot.data();
    const bindingOwner = nativeBindingOwner(input, previous, action, userId);
    if (action === 'deactivate') {
      if (previous?.isActive) transaction.update(ref, { isActive: false, deactivatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return { active: false, changed: previous?.isActive === true };
    }
    if (action === 'rotate') {
      if (!previous?.isActive) throw new Error('NATIVE_DEVICE_NOT_REGISTERED');
      const owner = await transaction.get(db.collection('system_users').doc(previous.userId));
      if (!owner.exists || owner.data()?.isActive === false) throw new Error('ACCOUNT_INACTIVE');
      userId = previous.userId;
    }
    userId = bindingOwner;
    const changed = !previous || previous.userId !== userId || previous.nativeToken !== input.token || previous.isActive !== true;
    if (changed) transaction.set(ref, { transport: 'android-fcm', userId, nativeToken: input.token, installationId: input.installationId,
      applicationId: input.applicationId, firebaseProjectId: input.projectId, deviceSecretHash: nativeSecretHash(input.deviceSecret),
      deviceType: 'mobile', platform: 'Android', isActive: true, updatedAt: FieldValue.serverTimestamp(), deactivatedAt: null,
      ...(!previous ? { createdAt: FieldValue.serverTimestamp() } : {}) }, { merge: true });
    return { active: true, userId, changed };
  });
}

export async function sendServerNativePush(subscriptions: ServerPushSubscription[], payload: WebPushPayload, options: { ttlSeconds?: number; deactivateExpired?: boolean } = {}) {
  const result = { accepted: 0, failed: 0, expired: 0, rejected: 0 };
  if (!subscriptions.length) return result;
  const app = getFirebaseAdminApp(), projectId = getFirebaseAdminProjectId() || app.options.projectId || '';
  for (let index = 0; index < subscriptions.length; index += 100) {
    const chunk = subscriptions.slice(index, index + 100);
    try {
      const response = await getMessaging(app).sendEach(chunk.map(subscription => ({
        token: subscription.nativeToken!, data: nativeMessageData(subscription.userId, projectId, payload),
        android: { priority: 'high' as const, ttl: (options.ttlSeconds ?? 86400) * 1000 },
      })));
      result.accepted += response.successCount; result.failed += response.failureCount;
      for (let i = 0; i < response.responses.length; i++) {
        const code = response.responses[i].error?.code;
        if (expiredNativeToken(code)) {
          result.expired++;
          if (options.deactivateExpired !== false) {
            const db = getFirestore(app), ref = db.collection('pushSubscriptions').doc(chunk[i].id);
            // An expired old token must not retire a token that rotated during delivery.
            await db.runTransaction(async transaction => {
              const current = await transaction.get(ref);
              if (current.data()?.nativeToken === chunk[i].nativeToken) transaction.update(ref, { isActive: false, deactivatedAt: FieldValue.serverTimestamp() });
            }).catch(() => console.warn('Expired native token cleanup will be retried on the next delivery.'));
          }
        } else if (code === 'messaging/mismatched-credential') result.rejected++;
      }
    } catch (error) {
      result.failed += chunk.length;
      console.warn('Native push provider unavailable:', (error as { code?: string })?.code || 'unknown');
    }
  }
  return result;
}

export async function testNativeDevice(input: NativeDeviceInput, userId: string) {
  verifySchool(input);
  const snapshot = await getFirestore(getFirebaseAdminApp()).collection('pushSubscriptions').doc(nativeDeviceId(input)).get(), value = snapshot.data();
  if (!value?.isActive || value.userId !== userId || value.transport !== 'android-fcm' || !nativeSecretMatches(input.deviceSecret, value.deviceSecretHash)) throw new Error('NATIVE_DEVICE_PROOF_REQUIRED');
  return sendServerNativePush([{ id: snapshot.id, userId, nativeToken: value.nativeToken, transport: 'android-fcm', endpoint: '', p256dh: '', auth: '' }], {
    title: 'School push connection test', body: 'This alert arrived from your school through Firebase Cloud Messaging.', url: '/push-notifications', tag: 'native-push-connection-test',
  });
}
