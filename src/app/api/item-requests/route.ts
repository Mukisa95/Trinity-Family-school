import { createHash } from 'crypto';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ItemRequest, ItemRequestStatus, SystemUser } from '@/types';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import {
  getServerPushSubscriptionsForUsers,
  sendServerWebPush,
} from '@/lib/server/push-notifications';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const ITEM_REQUESTS_COLLECTION = 'itemRequests';
const ITEM_REQUEST_EVENTS_COLLECTION = 'itemRequestEvents';
const ITEM_REQUEST_OPERATIONS_COLLECTION = 'itemRequestOperations';
const REQUESTER_PAGE = 'request';
const RELEASE_PAGE = 'release';

const createRequestSchema = z.object({
  source: z.enum(['catalog', 'other']),
  catalogItemId: z.string().trim().min(1).max(160).optional(),
  otherItemName: z.string().trim().min(2).max(160).optional(),
  otherItemUnit: z.string().trim().min(1).max(60).optional(),
  quantity: z.number().finite().int().min(1).max(1_000_000),
  reason: z.string().trim().min(3).max(2_000),
  neededBy: z.string().trim().max(40).optional(),
  useLocation: z.string().trim().max(160).optional(),
  expectedReturnDate: z.string().trim().max(40).optional(),
  operationId: z.string().trim().min(8).max(160),
}).superRefine((value, ctx) => {
  if (value.source === 'catalog' && !value.catalogItemId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['catalogItemId'], message: 'Choose a shared item.' });
  }
  if (value.source === 'other' && !value.otherItemName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['otherItemName'], message: 'Enter the item name.' });
  }
  if (value.source === 'other' && !value.otherItemUnit) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['otherItemUnit'], message: 'Enter the unit.' });
  }
});

function displayName(user: SystemUser): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.username || 'Staff member';
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function toItemRequest(id: string, data: Record<string, unknown>): ItemRequest {
  return {
    id,
    requesterUserId: String(data.requesterUserId || ''),
    requesterStaffId: typeof data.requesterStaffId === 'string' ? data.requesterStaffId : undefined,
    requesterName: String(data.requesterName || 'Staff member'),
    requesterDepartment: typeof data.requesterDepartment === 'string' ? data.requesterDepartment : undefined,
    source: data.source === 'other' ? 'other' : 'catalog',
    catalogItemId: typeof data.catalogItemId === 'string' ? data.catalogItemId : undefined,
    itemName: String(data.itemName || 'Unnamed item'),
    unit: String(data.unit || 'Units'),
    quantity: Number(data.quantity || 0),
    reason: String(data.reason || ''),
    neededBy: typeof data.neededBy === 'string' ? data.neededBy : undefined,
    useLocation: typeof data.useLocation === 'string' ? data.useLocation : undefined,
    expectedReturnDate: typeof data.expectedReturnDate === 'string' ? data.expectedReturnDate : undefined,
    status: String(data.status || 'submitted') as ItemRequestStatus,
    statusReason: typeof data.statusReason === 'string' ? data.statusReason : undefined,
    inventoryItemId: typeof data.inventoryItemId === 'string' ? data.inventoryItemId : undefined,
    restockRequestId: typeof data.restockRequestId === 'string' ? data.restockRequestId : undefined,
    procurementPurchaseId: typeof data.procurementPurchaseId === 'string' ? data.procurementPurchaseId : undefined,
    inventoryTransactionId: typeof data.inventoryTransactionId === 'string' ? data.inventoryTransactionId : undefined,
    issuedItemId: typeof data.issuedItemId === 'string' ? data.issuedItemId : undefined,
    availableQuantity: typeof data.availableQuantity === 'number' ? data.availableQuantity : undefined,
    canRelease: typeof data.canRelease === 'boolean' ? data.canRelease : undefined,
    createdAt: toIso(data.createdAt),
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : undefined,
    lastActionAt: data.lastActionAt ? toIso(data.lastActionAt) : undefined,
  };
}

function canRequestItems(user: SystemUser) {
  return GranularPermissionService.canAccessPage(user, 'item_requests', REQUESTER_PAGE)
    && GranularPermissionService.canPerformAction(user, 'item_requests', REQUESTER_PAGE, 'create_request');
}

function canViewOwnRequests(user: SystemUser) {
  return GranularPermissionService.canAccessPage(user, 'item_requests', REQUESTER_PAGE)
    && GranularPermissionService.canPerformAction(user, 'item_requests', REQUESTER_PAGE, 'view_own_requests');
}

function canViewReleaseQueue(user: SystemUser) {
  return GranularPermissionService.canAccessPage(user, 'item_requests', RELEASE_PAGE)
    && GranularPermissionService.canPerformAction(user, 'item_requests', RELEASE_PAGE, 'view_release_queue');
}

async function releaseRecipientIds(): Promise<string[]> {
  const db = getFirestore(getFirebaseAdminApp());
  const snapshot = await db.collection('system_users').where('isActive', '==', true).get();
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as SystemUser)
    .filter(user => GranularPermissionService.canAccessPage(user, 'item_requests', RELEASE_PAGE)
      && GranularPermissionService.canPerformAction(user, 'item_requests', RELEASE_PAGE, 'release_items'))
    .map(user => user.id);
}

async function createRequestNotification(
  requestId: string,
  requesterName: string,
  itemName: string,
  quantity: number,
  unit: string,
  recipientIds: string[],
) {
  if (!recipientIds.length) return;
  const db = getFirestore(getFirebaseAdminApp());
  const notificationRef = db.collection('notifications').doc();
  const body = `${requesterName} requested ${quantity} ${unit} of ${itemName}.`;
  await notificationRef.set({
    title: 'New item request',
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
    pushTitle: 'New item request',
    pushBody: body,
    pushIcon: '/trinity-logo-192.png',
    pushUrl: `/item-requests/release?requestId=${encodeURIComponent(requestId)}`,
    deliveryStats: { total: recipientIds.length, sent: recipientIds.length, delivered: recipientIds.length, failed: 0, read: 0 },
    actions: [],
    readBy: [],
    metadata: { source: 'item-request', requestId },
  });

  for (let start = 0; start < recipientIds.length; start += 450) {
    const batch = db.batch();
    recipientIds.slice(start, start + 450).forEach(userId => {
      const deliveryRef = db.collection('notificationDeliveries').doc();
      batch.set(deliveryRef, {
        id: deliveryRef.id,
        notificationId: notificationRef.id,
        userId,
        method: 'in_app',
        status: 'sent',
        sentAt: FieldValue.serverTimestamp(),
        retryCount: 0,
      });
    });
    await batch.commit();
  }

  try {
    const subscriptions = await getServerPushSubscriptionsForUsers(recipientIds);
    const result = await sendServerWebPush(subscriptions, {
      title: 'New item request',
      body,
      icon: '/trinity-logo-192.png',
      badge: '/icons/trinity-badge-72.png',
      tag: `item-request-${requestId}`,
      url: `/item-requests/release?requestId=${encodeURIComponent(requestId)}`,
      requireInteraction: true,
    }, { urgency: 'high' });
    await notificationRef.update({
      'metadata.pushSent': result.accepted,
      'metadata.pushFailed': result.failed,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // A request is valid even when a browser has no subscription or a push
    // provider is temporarily unavailable. The in-app delivery remains.
    console.warn('Item request Web Push unavailable:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    const scope = request.nextUrl.searchParams.get('scope') === 'queue' ? 'queue' : 'mine';
    if (scope === 'mine' && !canViewOwnRequests(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to view item requests.' }, { status: 403 });
    }
    if (scope === 'queue' && !canViewReleaseQueue(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to view the item release queue.' }, { status: 403 });
    }

    const db = getFirestore(getFirebaseAdminApp());
    const snapshot = scope === 'mine'
      ? await db.collection(ITEM_REQUESTS_COLLECTION)
        .where('requesterUserId', '==', actor.decoded.uid)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get()
      : await db.collection(ITEM_REQUESTS_COLLECTION)
        .where('isActive', '==', true)
        .orderBy('lastActionAt', 'desc')
        .limit(100)
        .get();

    const requests = snapshot.docs.map(doc => toItemRequest(doc.id, doc.data()));
    if (scope === 'mine') return NextResponse.json({ requests });

    // Release officers need a compact availability projection, not the full
    // Inventory dataset. Chunking keeps this to one batched read per 30 shared
    // catalogue identities instead of a query for every request card.
    const catalogIds = [...new Set(requests.map(item => item.catalogItemId).filter((id): id is string => Boolean(id)))];
    const inventoryByCatalog = new Map<string, Array<{ quantity: number; isActive: boolean }>>();
    for (let start = 0; start < catalogIds.length; start += 30) {
      const items = await db.collection('inventoryItems')
        .where('catalogItemId', 'in', catalogIds.slice(start, start + 30))
        .get();
      items.docs.forEach(item => {
        const data = item.data();
        const key = typeof data.catalogItemId === 'string' ? data.catalogItemId : '';
        if (!key) return;
        const list = inventoryByCatalog.get(key) || [];
        list.push({ quantity: Number(data.quantity || 0), isActive: data.isActive !== false });
        inventoryByCatalog.set(key, list);
      });
    }
    return NextResponse.json({
      requests: requests.map(item => {
        const matches = item.catalogItemId ? (inventoryByCatalog.get(item.catalogItemId) || []).filter(entry => entry.isActive) : [];
        const availableQuantity = matches.reduce((total, entry) => total + Math.max(0, entry.quantity), 0);
        return {
          ...item,
          availableQuantity,
          // Inventory releases are intentionally from one physical stock record;
          // combining locations automatically would make the audit misleading.
          canRelease: matches.some(entry => entry.quantity >= item.quantity),
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load item requests.';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403 : 500;
    console.error('Item requests load failed:', error);
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to load item requests.' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canRequestItems(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to request items.' }, { status: 403 });
    }

    const parsed = createRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the request details and try again.' }, { status: 400 });
    }
    const input = parsed.data;
    const db = getFirestore(getFirebaseAdminApp());
    const operationKey = createHash('sha256').update(`${actor.decoded.uid}:${input.operationId}`).digest('hex');
    const operationRef = db.collection(ITEM_REQUEST_OPERATIONS_COLLECTION).doc(operationKey);
    const requestRef = db.collection(ITEM_REQUESTS_COLLECTION).doc();
    const eventRef = db.collection(ITEM_REQUEST_EVENTS_COLLECTION).doc();
    const catalogRef = input.source === 'catalog' && input.catalogItemId
      ? db.collection('schoolItemCatalog').doc(input.catalogItemId)
      : null;
    const requesterName = displayName(actor.user);

    const outcome = await db.runTransaction(async transaction => {
      const existing = await transaction.get(operationRef);
      if (existing.exists()) {
        return { id: String(existing.data()?.requestId || ''), duplicate: true, itemName: '', unit: '' };
      }

      let itemName: string;
      let unit: string;
      if (catalogRef) {
        const catalog = await transaction.get(catalogRef);
        if (!catalog.exists || catalog.data()?.isActive === false) {
          throw new Error('CATALOG_ITEM_UNAVAILABLE');
        }
        itemName = String(catalog.data()?.name || '').trim();
        unit = String(catalog.data()?.standardUnit || '').trim();
        if (!itemName || !unit) throw new Error('CATALOG_ITEM_INVALID');
      } else {
        itemName = input.otherItemName!.trim();
        unit = input.otherItemUnit!.trim();
      }

      const now = FieldValue.serverTimestamp();
      transaction.create(requestRef, {
        requesterUserId: actor.decoded.uid,
        requesterStaffId: actor.user.staffId || null,
        requesterName,
        requesterDepartment: null,
        source: input.source,
        catalogItemId: catalogRef?.id || null,
        itemName,
        unit,
        quantity: input.quantity,
        reason: input.reason,
        neededBy: input.neededBy || null,
        useLocation: input.useLocation || null,
        expectedReturnDate: input.expectedReturnDate || null,
        status: 'submitted',
        statusReason: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        lastActionAt: now,
      });
      transaction.create(eventRef, {
        requestId: requestRef.id,
        action: 'submitted',
        fromStatus: null,
        toStatus: 'submitted',
        actorUserId: actor.decoded.uid,
        actorName: requesterName,
        reason: input.reason,
        operationId: input.operationId,
        createdAt: now,
      });
      transaction.create(operationRef, {
        requestId: requestRef.id,
        requesterUserId: actor.decoded.uid,
        operationId: input.operationId,
        createdAt: now,
      });
      return { id: requestRef.id, duplicate: false, itemName, unit };
    });

    if (!outcome.id) return NextResponse.json({ error: 'The earlier request is still being processed. Refresh and try again.' }, { status: 409 });
    if (!outcome.duplicate) {
      const recipients = await releaseRecipientIds();
      await createRequestNotification(outcome.id, requesterName, outcome.itemName, input.quantity, outcome.unit, recipients);
    }
    return NextResponse.json({ success: true, id: outcome.id, duplicate: outcome.duplicate }, { status: outcome.duplicate ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit the item request.';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403
        : ['CATALOG_ITEM_UNAVAILABLE', 'CATALOG_ITEM_INVALID'].includes(message) ? 409 : 500;
    console.error('Item request submission failed:', error);
    const responseMessage = message === 'CATALOG_ITEM_UNAVAILABLE'
      ? 'That shared item is no longer available. Refresh the list and choose it again.'
      : message === 'CATALOG_ITEM_INVALID'
        ? 'That shared item is incomplete. Ask an administrator to correct it.'
        : status === 401 ? 'Sign in is required.' : 'Unable to submit the item request.';
    return NextResponse.json({ error: responseMessage }, { status });
  }
}
