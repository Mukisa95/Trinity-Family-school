import type { Firestore } from 'firebase-admin/firestore';

import type { SystemUser } from '@/types';

export type NotificationParticipantSnapshot = {
  userId: string;
  displayName: string;
  role: string;
  contextLabel?: string;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function preferredName(user: Partial<SystemUser>) {
  const name = [text(user.firstName), text(user.lastName)].filter(Boolean).join(' ');
  return name || text(user.username) || 'Unknown user';
}

async function getParentContext(
  db: Firestore,
  user: Partial<SystemUser>,
): Promise<Pick<NotificationParticipantSnapshot, 'displayName' | 'contextLabel'>> {
  const familyId = text(user.familyId);
  const pupilId = text(user.pupilId);
  const guardianId = text(user.guardianId);

  let pupils: Array<{ id: string; data: Record<string, unknown> }> = [];
  if (familyId) {
    const snapshot = await db.collection('pupils').where('familyId', '==', familyId).limit(8).get();
    pupils = snapshot.docs.map(document => ({ id: document.id, data: document.data() as Record<string, unknown> }));
  } else if (pupilId) {
    const pupil = await db.collection('pupils').doc(pupilId).get();
    if (pupil.exists) pupils = [{ id: pupil.id, data: pupil.data() as Record<string, unknown> }];
  }

  const pupilNames = pupils
    .map(({ data }) => [text(data.firstName), text(data.lastName)].filter(Boolean).join(' '))
    .filter(Boolean);
  const guardian = guardianId
    ? pupils.flatMap(({ data }) => Array.isArray(data.guardians) ? data.guardians : [])
      .find((item: any) => text(item?.id) === guardianId)
    : undefined;
  const guardianName = guardian
    ? [text(guardian.firstName), text(guardian.lastName)].filter(Boolean).join(' ')
    : '';
  const displayName = guardianName || preferredName(user);
  const contextLabel = pupilNames.length
    ? `Parent of ${pupilNames.slice(0, 2).join(' and ')}${pupilNames.length > 2 ? ` and ${pupilNames.length - 2} more` : ''}`
    : 'Parent';

  return { displayName, contextLabel };
}

export async function resolveNotificationParticipant(
  db: Firestore,
  userId: string,
  suppliedUser?: Partial<SystemUser> | null,
): Promise<NotificationParticipantSnapshot> {
  let user = suppliedUser;
  if (!user) {
    const snapshot = await db.collection('system_users').doc(userId).get();
    if (!snapshot.exists) return { userId, displayName: 'Former user', role: 'Former user' };
    user = { id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as Partial<SystemUser>;
  }

  const role = text(user.role) || 'User';
  if (role === 'Parent') {
    const parent = await getParentContext(db, user);
    return { userId, role, ...parent };
  }

  return { userId, displayName: preferredName(user), role };
}

export async function getActiveNotificationRecipientIds(db: Firestore, userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const activeIds: string[] = [];
  for (let index = 0; index < uniqueIds.length; index += 200) {
    const references = uniqueIds.slice(index, index + 200).map(id => db.collection('system_users').doc(id));
    const snapshots = await db.getAll(...references);
    snapshots.forEach(snapshot => {
      if (snapshot.exists && snapshot.data()?.isActive !== false) activeIds.push(snapshot.id);
    });
  }
  return activeIds;
}

export function hasNotificationAccess(
  notification: { createdBy?: unknown; recipientIds?: unknown },
  userId: string,
) {
  return notification.createdBy === userId
    || (Array.isArray(notification.recipientIds) && notification.recipientIds.includes(userId));
}
