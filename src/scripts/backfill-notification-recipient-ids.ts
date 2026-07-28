import dotenv from 'dotenv';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, getFirebaseAdminProjectId } from '@/lib/firebase-admin';

dotenv.config({ path: '.env.local' });

const PAGE_SIZE = 200;
const WRITE_BATCH_SIZE = 400;

type NotificationRecord = {
  recipientIds?: unknown;
};

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const apply = hasFlag('--apply');
  const confirmed = hasFlag('--confirm-recipient-ids');
  if (apply && !confirmed) {
    throw new Error('--apply requires --confirm-recipient-ids. Run the default analysis first.');
  }

  const projectId = getFirebaseAdminProjectId();
  if (!projectId) throw new Error('Firebase Admin project is not configured.');

  const db = getFirestore(getFirebaseAdminApp());
  let totalNotifications = 0;
  let alreadyScoped = 0;
  let legacyNotifications = 0;
  let scoped = 0;
  let unresolvedWithoutDeliveries = 0;
  let lastDocument: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  // The default mode only scans notification documents and reports counts. It
  // does not query deliveries and it never writes. This makes the expected
  // migration cost visible before any recipient data is read or changed.
  while (true) {
    let pageQuery = db
      .collection('notifications')
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (lastDocument) pageQuery = pageQuery.startAfter(lastDocument);

    const page = await pageQuery.get();
    if (page.empty) break;
    totalNotifications += page.size;
    lastDocument = page.docs[page.docs.length - 1];

    const legacy = page.docs.filter(notification =>
      !Array.isArray((notification.data() as NotificationRecord).recipientIds),
    );
    alreadyScoped += page.size - legacy.length;
    legacyNotifications += legacy.length;

    if (!apply || legacy.length === 0) continue;

    let batch = db.batch();
    let writes = 0;

    // Firestore permits up to 10 values in this `in` query. Delivery records
    // already exist for the in-app notification workflow, so this adds no new
    // per-recipient documents and writes only the missing notification field.
    for (let index = 0; index < legacy.length; index += 10) {
      const notificationIds = legacy.slice(index, index + 10).map(notification => notification.id);
      const deliveries = await db
        .collection('notificationDeliveries')
        .where('notificationId', 'in', notificationIds)
        .get();
      const recipientIdsByNotification = new Map<string, Set<string>>();

      deliveries.docs.forEach(delivery => {
        const data = delivery.data();
        if (typeof data.notificationId !== 'string' || typeof data.userId !== 'string' || !data.userId) return;
        const recipients = recipientIdsByNotification.get(data.notificationId) ?? new Set<string>();
        recipients.add(data.userId);
        recipientIdsByNotification.set(data.notificationId, recipients);
      });

      for (const notification of legacy.slice(index, index + 10)) {
        const recipientIds = [...(recipientIdsByNotification.get(notification.id) ?? new Set<string>())];
        if (recipientIds.length === 0) {
          unresolvedWithoutDeliveries += 1;
          continue;
        }
        batch.update(notification.ref, { recipientIds });
        writes += 1;
        scoped += 1;

        if (writes >= WRITE_BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          writes = 0;
        }
      }
    }

    if (writes > 0) await batch.commit();
  }

  console.log(JSON.stringify({
    projectId,
    mode: apply ? 'apply' : 'analysis-only',
    totalNotifications,
    alreadyScoped,
    legacyNotifications,
    scoped,
    unresolvedWithoutDeliveries,
    writesPerformed: scoped,
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
