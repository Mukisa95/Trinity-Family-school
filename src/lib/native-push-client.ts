'use client';
import { auth } from '@/lib/firebase';
import { androidOfflineRequest, hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';

export async function connectNativePush(userId: string, enable = false) {
  if (!hasAndroidOfflineBridge() || !auth.currentUser || auth.currentUser.isAnonymous || auth.currentUser.uid !== userId) throw new Error('Sign in to connect school alerts.');
  const idToken = await auth.currentUser.getIdToken();
  await androidOfflineRequest('registerNativePush', { userId, idToken, enable });
  window.dispatchEvent(new Event('trinity-android-notifications-change'));
}
export async function testNativePush(userId: string) {
  if (!hasAndroidOfflineBridge() || auth.currentUser?.uid !== userId) throw new Error('Sign in to test school alerts.');
  await androidOfflineRequest('testNativePush', { userId, idToken: await auth.currentUser.getIdToken() });
}
export async function disableNativePush() {
  await androidOfflineRequest('disableNativePush');
  window.dispatchEvent(new Event('trinity-android-notifications-change'));
}
