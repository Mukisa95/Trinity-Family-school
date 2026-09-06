import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { SystemUser } from '@/types';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import {
  getServerPushSubscriptionsForUsers,
  sendServerWebPush,
} from '@/lib/server/push-notifications';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const inputSchema = z.object({
  inventoryItemId: z.string().trim().min(1).max(160),
  inventoryTransactionId: z.string().trim().min(1).max(200),
});

function canReceiveStock(user: SystemUser) {
  return GranularPermissionService.canAccessPage(user, 'inventory', 'dashboard')
    && GranularPermissionService.canPerformAction(user, 'inventory', 'dashboard', 'manage_inventory');
}

function displayName(user: SystemUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || 'Inventory staff';
}

async function releaseRecipientIds() {
  const db = getFirestore(getFirebaseAdminApp());
  const users = await db.collection('system_users').where('isActive', '==', true).get();
  return users.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as SystemUser)
    .filter(user => GranularPermissionService.canAccessPage(user, 'item_requests', 'release')
      && GranularPermissionService.canPerformAction(user, 'item_requests', 'release', 'release_items'))
    .map(user => user.id);
}

async function notifyReleaseOfficers(
  request: { id: string; requesterName: string; itemName: string; quantity: number; unit: string },
  recipientIds: string[],
) {
  if (!recipientIds.length) return;
  const db = getFirestore(getFirebaseAdminApp());
  const body = `${request.itemName} has been restocked. ${request.requesterName}'s request for ${request.quantity} ${request.unit} is ready to release.`;
  const notificationRef = db.collection('notifications').doc();
  await notificationRef.set({
    title: 'Item request ready to release',
    description: body,
    type: 'announcement',
    priority: 'high',
    status: 'completed',
    recipients: recipientIds.map(id => ({ id, type: 'user', name: 'Release officer' })),
    recipientIds,
    targetGroups: [],
    createdBy: 'system:item-requests',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    sentAt: FieldValue.serverTimestamp(),
    completedAt: FieldValue.serverTimestamp(),
    enablePush: true,
    pushTitle: 'Item request ready to release',
    pushBody: body,
    pushIcon: '/trinity-logo-192.png',
    pushUrl: `/item-requests/release?requestId=${encodeURIComponent(request.id)}`,
    deliveryStats: { total: recipientIds.length, sent: recipientIds.length, delivered: recipientIds.length, failed: 0, read: 0 },
    actions: [],
    readBy: [],
    metadata: { source: 'item-request-restocked', requestId: request.id },
  });
  for (let start = 0; start < recipientIds.length; start += 450) {
    const batch = db.batch();
    recipientIds.slice(start, start + 450).forEach(userId => {
      const deliveryRef = db.collection('notificationDeliveries').doc();
      batch.set(deliveryRef, { id: deliveryRef.id, notificationId: notificationRef.id, userId, method: 'in_app', status: 'sent', sentAt: FieldValue.serverTimestamp(), retryCount: 0 });
    });
    await batch.commit();
  }
  try {
    const subscriptions = await getServerPushSubscriptionsForUsers(recipientIds);
    const push = await sendServerWebPush(subscriptions, {
      title: 'Item request ready to release', body, icon: '/trinity-logo-192.png', badge: '/icons/trinity-badge-72.png',
      tag: `item-request-ready-${request.id}`, url: `/item-requests/release?requestId=${encodeURIComponent(request.id)}`, requireInteraction: true,
    }, { urgency: 'high' });
    await notificationRef.update({ 'metadata.pushSent': push.accepted, 'metadata.pushFailed': push.failed });
  } catch (error) {
    console.warn('Item restocked Web Push unavailable:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canReceiveStock(actor.user)) return NextResponse.json({ error: 'You do not have permission to receive stock.' }, { status: 403 });
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid stock receipt details.' }, { status: 400 });
    const { inventoryItemId, inventoryTransactionId } = parsed.data;
    const db = getFirestore(getFirebaseAdminApp());
    const inventoryRef = db.collection('inventoryItems').doc(inventoryItemId);
    const inventoryTransactionRef = db.collection('inventoryTransactions').doc(inventoryTransactionId);
    const actorName = displayName(actor.user);

    const readyRequests = await db.runTransaction(async transaction => {
      const [inventorySnapshot, transactionSnapshot] = await Promise.all([
        transaction.get(inventoryRef),
        transaction.get(inventoryTransactionRef),
      ]);
      if (!inventorySnapshot.exists) throw new Error('INVENTORY_ITEM_NOT_FOUND');
      if (!transactionSnapshot.exists || transactionSnapshot.data()?.type !== 'purchase' || transactionSnapshot.data()?.itemId !== inventoryItemId) {
        throw new Error('STOCK_RECEIPT_NOT_FOUND');
      }
      const inventory = inventorySnapshot.data() as Record<string, unknown>;
      const catalogItemId = typeof inventory.catalogItemId === 'string' ? inventory.catalogItemId : '';
      const quantityAvailable = Number(inventory.quantity || 0);
      if (!catalogItemId || !Number.isFinite(quantityAvailable) || quantityAvailable < 0) return [];

      const pendingQuery = db.collection('itemRequests')
        .where('catalogItemId', '==', catalogItemId)
        .where('isActive', '==', true);
      const pending = await transaction.get(pendingQuery);
      const now = FieldValue.serverTimestamp();
      const ready: Array<{ id: string; requesterName: string; itemName: string; quantity: number; unit: string }> = [];
      for (const requestSnapshot of pending.docs) {
        const itemRequest = requestSnapshot.data() as Record<string, unknown>;
        const status = String(itemRequest.status || '');
        const requestedQuantity = Number(itemRequest.quantity || 0);
        if (!['pending_restock', 'restock_in_progress'].includes(status) || !Number.isFinite(requestedQuantity) || requestedQuantity > quantityAvailable) continue;
        const eventRef = db.collection('itemRequestEvents').doc();
        transaction.update(requestSnapshot.ref, {
          status: 'ready_to_release',
          statusReason: 'The item has been restocked and is ready for release.',
          lastActionAt: now,
          lastActionBy: actor.decoded.uid,
          lastActionByName: actorName,
          updatedAt: now,
        });
        transaction.create(eventRef, {
          requestId: requestSnapshot.id,
          action: 'ready_to_release',
          fromStatus: status,
          toStatus: 'ready_to_release',
          actorUserId: actor.decoded.uid,
          actorName,
          reason: `Stock receipt ${inventoryTransactionId} made this request ready for release.`,
          operationId: `restock-received-${inventoryTransactionId}`,
          createdAt: now,
        });
        if (typeof itemRequest.restockRequestId === 'string' && itemRequest.restockRequestId) {
          transaction.set(db.collection('procurementRestockRequests').doc(itemRequest.restockRequestId), {
            status: 'received', receivedInventoryTransactionId: inventoryTransactionId, updatedAt: now,
          }, { merge: true });
        }
        ready.push({
          id: requestSnapshot.id,
          requesterName: String(itemRequest.requesterName || 'Staff member'),
          itemName: String(itemRequest.itemName || 'Requested item'),
          quantity: requestedQuantity,
          unit: String(itemRequest.unit || 'Units'),
        });
      }
      return ready;
    });

    if (readyRequests.length) {
      const recipients = await releaseRecipientIds();
      await Promise.all(readyRequests.map(itemRequest => notifyReleaseOfficers(itemRequest, recipients)));
    }
    return NextResponse.json({ success: true, readyRequestCount: readyRequests.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process the stock receipt.';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403
        : ['INVENTORY_ITEM_NOT_FOUND', 'STOCK_RECEIPT_NOT_FOUND'].includes(message) ? 404 : 500;
    console.error('Item request stock receipt processing failed:', error);
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to process the stock receipt.' }, { status });
  }
}
