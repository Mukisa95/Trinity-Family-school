import type { Notification } from '@/types';

export type NotificationThread<T extends Notification = Notification> = {
  id: string;
  subject: string;
  messages: T[];
  latest: T;
  unreadCount: number;
};

function threadIdFor(notification: Notification): string {
  return notification.threadId || notification.rootNotificationId || notification.id;
}

function threadSubjectFor(notification: Notification): string {
  const explicitSubject = (notification as Notification & { threadSubject?: unknown }).threadSubject;
  if (typeof explicitSubject === 'string' && explicitSubject.trim()) return explicitSubject.trim();
  return notification.title.replace(/^Re:\s*/i, '').trim() || 'Notification';
}

/**
 * The inbox still receives individual delivery records. This turns the local
 * delivery history into conversations without adding a Firestore query.
 */
export function groupNotificationThreads<T extends Notification>(
  notifications: T[],
  currentUserId: string,
): NotificationThread<T>[] {
  const unique = new Map<string, T>();
  notifications.forEach(notification => unique.set(notification.id, notification));

  const grouped = new Map<string, T[]>();
  unique.forEach(notification => {
    const id = threadIdFor(notification);
    const messages = grouped.get(id) || [];
    messages.push(notification);
    grouped.set(id, messages);
  });

  return [...grouped.entries()]
    .map(([id, messages]) => {
      const ordered = [...messages].sort((left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );
      const latest = ordered[ordered.length - 1];
      return {
        id,
        subject: threadSubjectFor(ordered[0]),
        messages: ordered,
        latest,
        unreadCount: ordered.filter(message =>
          message.createdBy !== currentUserId && !message.readBy?.includes(currentUserId),
        ).length,
      };
    })
    .sort((left, right) => new Date(right.latest.createdAt).getTime() - new Date(left.latest.createdAt).getTime());
}
