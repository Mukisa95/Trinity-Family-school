import 'server-only';

import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import {
  NOTIFICATION_AUTOMATION_SETTINGS_COLLECTION,
  NOTIFICATION_AUTOMATION_SETTINGS_DOCUMENT,
  mergeNotificationAutomationSettings,
  normalizeNotificationAutomationSettings,
  type NotificationAutomationSettings,
} from '@/lib/notifications/automation-settings';

function settingsRef() {
  return getFirestore(getFirebaseAdminApp())
    .collection(NOTIFICATION_AUTOMATION_SETTINGS_COLLECTION)
    .doc(NOTIFICATION_AUTOMATION_SETTINGS_DOCUMENT);
}

export async function getNotificationAutomationSettings(): Promise<NotificationAutomationSettings> {
  const snapshot = await settingsRef().get();
  return normalizeNotificationAutomationSettings(snapshot.exists ? snapshot.data() : undefined);
}

export async function updateNotificationAutomationSettings(
  patch: unknown,
  actorId: string,
): Promise<NotificationAutomationSettings> {
  const db = getFirestore(getFirebaseAdminApp());
  const ref = settingsRef();
  return db.runTransaction(async transaction => {
    const current = await transaction.get(ref);
    const next = mergeNotificationAutomationSettings(
      normalizeNotificationAutomationSettings(current.exists ? current.data() : undefined),
      patch,
    );
    transaction.set(ref, {
      ...next,
      updatedBy: actorId,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ...next, updatedBy: actorId, updatedAt: new Date().toISOString() };
  });
}
