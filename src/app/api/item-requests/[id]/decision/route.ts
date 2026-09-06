import { createHash } from 'crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { AcademicYear, ItemRequestStatus, SystemUser, Term } from '@/types';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import {
  getServerPushSubscriptionsForUsers,
  sendServerWebPush,
} from '@/lib/server/push-notifications';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { calculateInventoryQuantity } from '@/lib/utils/inventory-movement';
import { defaultRestockPendingReason } from '@/lib/utils/item-request-state';
import { bumpDomainRevisionsAdmin } from '@/lib/server/domain-cache-revisions.admin';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const RELEASE_PAGE = 'release';

const decisionSchema = z.object({
  action: z.enum(['release', 'pending', 'decline']),
  pendingMode: z.enum(['available', 'restock']).optional(),
  reason: z.string().trim().max(2_000).optional(),
  operationId: z.string().trim().min(8).max(160),
}).superRefine((value, ctx) => {
  if ((value.action === 'pending' || value.action === 'decline') && !value.reason?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Provide a clear reason for the requester.' });
  }
  if (value.action === 'pending' && !value.pendingMode) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pendingMode'], message: 'Choose why this request is pending.' });
  }
});

function actorName(user: SystemUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || 'Store staff';
}

function canPerform(user: SystemUser, action: 'release_items' | 'pend_requests' | 'decline_requests') {
  return GranularPermissionService.canAccessPage(user, 'item_requests', RELEASE_PAGE)
    && GranularPermissionService.canPerformAction(user, 'item_requests', RELEASE_PAGE, action);
}

function dateIsWithin(date: Date, start?: unknown, end?: unknown): boolean {
  if (typeof start !== 'string' || typeof end !== 'string') return false;
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Number.isFinite(startDate.getTime()) && Number.isFinite(endDate.getTime())
    && date >= startDate && date <= endDate;
}

async function activeAcademicContext(): Promise<{ academicYear: Pick<AcademicYear, 'id' | 'name'>; term: Pick<Term, 'id' | 'name'> }> {
  const db = getFirestore(getFirebaseAdminApp());
  const snapshot = await db.collection('academicYears').get();
  const years = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Array<AcademicYear & Record<string, unknown>>;
  const today = new Date();
  const academicYear = years.find(year => Array.isArray(year.terms) && year.terms.some(term => dateIsWithin(today, term.startDate, term.endDate)))
    || years.find(year => dateIsWithin(today, year.startDate, year.endDate))
    || years.find(year => year.isActive);
  if (!academicYear) throw new Error('ACADEMIC_CONTEXT_UNAVAILABLE');
  const terms = Array.isArray(academicYear.terms) ? academicYear.terms : [];
  const term = terms.find(candidate => dateIsWithin(today, candidate.startDate, candidate.endDate))
    || terms.find(candidate => candidate.isCurrent)
    || terms[0];
  if (!term?.id || !term?.name) throw new Error('ACADEMIC_CONTEXT_UNAVAILABLE');
  return { academicYear: { id: academicYear.id, name: academicYear.name }, term: { id: term.id, name: term.name } };
}

async function notifyRequester(
  recipientId: string,
  requestId: string,
  status: ItemRequestStatus,
  itemName: string,
  quantity: number,
  unit: string,
  reason?: string,
) {
  const db = getFirestore(getFirebaseAdminApp());
  const title = status === 'released'
    ? 'Your requested item was released'
    : status === 'declined'
      ? 'Your item request was declined'
      : 'Your item request is pending';
  const body = status === 'released'
    ? `${quantity} ${unit} of ${itemName} has been released for you.`
    : reason || `Your request for ${itemName} has been updated.`;
  const notificationRef = db.collection('notifications').doc();
  await notificationRef.set({
    title,
    description: body,
    type: 'announcement',
    priority: status === 'released' ? 'high' : 'medium',
    status: 'completed',
    recipients: [{ id: recipientId, type: 'user', name: 'Requester' }],
    recipientIds: [recipientId],
    targetGroups: [],
    createdBy: 'system:item-requests',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    sentAt: FieldValue.serverTimestamp(),
    completedAt: FieldValue.serverTimestamp(),
    enablePush: true,
    pushTitle: title,
    pushBody: body,
    pushIcon: '/trinity-logo-192.png',
    pushUrl: `/item-requests?requestId=${encodeURIComponent(requestId)}`,
    deliveryStats: { total: 1, sent: 1, delivered: 1, failed: 0, read: 0 },
    actions: [],
    readBy: [],
    metadata: { source: 'item-request-status', requestId, status },
  });
  const deliveryRef = db.collection('notificationDeliveries').doc();
  await deliveryRef.set({
    id: deliveryRef.id,
    notificationId: notificationRef.id,
    userId: recipientId,
    method: 'in_app',
    status: 'sent',
    sentAt: FieldValue.serverTimestamp(),
    retryCount: 0,
  });
  try {
    const subscriptions = await getServerPushSubscriptionsForUsers([recipientId]);
    const push = await sendServerWebPush(subscriptions, {
      title,
      body,
      icon: '/trinity-logo-192.png',
      badge: '/icons/trinity-badge-72.png',
      tag: `item-request-${requestId}`,
      url: `/item-requests?requestId=${encodeURIComponent(requestId)}`,
      requireInteraction: status === 'released',
    }, { urgency: status === 'released' ? 'high' : 'normal' });
    await notificationRef.update({ 'metadata.pushSent': push.accepted, 'metadata.pushFailed': push.failed });
  } catch (error) {
    console.warn('Item request status Web Push unavailable:', error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAppUser(request);
    const { id } = await params;
    if (!id || id.length > 160 || id.includes('/')) return NextResponse.json({ error: 'Invalid item request.' }, { status: 400 });
    const parsed = decisionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the decision details and try again.' }, { status: 400 });
    const input = parsed.data;
    const permission = input.action === 'release' ? 'release_items' : input.action === 'pending' ? 'pend_requests' : 'decline_requests';
    if (!canPerform(actor.user, permission)) {
      return NextResponse.json({ error: 'You do not have permission to make this request decision.' }, { status: 403 });
    }

    const academicContext = input.action === 'release' ? await activeAcademicContext() : null;
    const db = getFirestore(getFirebaseAdminApp());
    const requestRef = db.collection('itemRequests').doc(id);
    const eventRef = db.collection('itemRequestEvents').doc();
    const operationKey = createHash('sha256').update(`${id}:${actor.decoded.uid}:${input.operationId}`).digest('hex');
    const operationRef = db.collection('itemRequestDecisionOperations').doc(operationKey);
    const inventoryTransactionRef = db.collection('inventoryTransactions').doc(`item-request-${id}`);
    const issuedItemRef = db.collection('issuedItems').doc(`item-request-${id}`);
    const performedBy = actorName(actor.user);

    const outcome = await db.runTransaction(async transaction => {
      const previousOperation = await transaction.get(operationRef);
      if (previousOperation.exists) {
        return { duplicate: true, status: String(previousOperation.data()?.status || '') as ItemRequestStatus, requesterUserId: '', itemName: '', quantity: 0, unit: '', reason: '' };
      }

      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists) throw new Error('REQUEST_NOT_FOUND');
      const itemRequest = requestSnapshot.data() as Record<string, unknown>;
      const previousStatus = String(itemRequest.status || 'submitted') as ItemRequestStatus;
      if (itemRequest.isActive !== true || ['released', 'declined', 'cancelled'].includes(previousStatus)) {
        throw new Error('REQUEST_ALREADY_COMPLETED');
      }
      const requesterUserId = String(itemRequest.requesterUserId || '');
      const itemName = String(itemRequest.itemName || 'Requested item');
      const unit = String(itemRequest.unit || 'Units');
      const quantity = Number(itemRequest.quantity || 0);
      if (!requesterUserId || !Number.isFinite(quantity) || quantity <= 0) throw new Error('REQUEST_INVALID');

      let status: ItemRequestStatus;
      let reason = input.reason?.trim() || '';
      const now = FieldValue.serverTimestamp();
      const requestUpdates: Record<string, FieldValue | string | number | boolean | null> = {
        updatedAt: now,
        lastActionAt: now,
        lastActionBy: actor.decoded.uid,
        lastActionByName: performedBy,
      };

      if (input.action === 'release') {
        const catalogItemId = typeof itemRequest.catalogItemId === 'string' ? itemRequest.catalogItemId : '';
        if (!catalogItemId) throw new Error('REQUEST_NOT_CATALOGUED');
        const inventoryQuery = db.collection('inventoryItems').where('catalogItemId', '==', catalogItemId);
        const inventorySnapshot = await transaction.get(inventoryQuery);
        const eligible = inventorySnapshot.docs
          .filter(doc => doc.data().isActive !== false && Number(doc.data().quantity || 0) >= quantity)
          .sort((left, right) => Number(right.data().quantity || 0) - Number(left.data().quantity || 0));
        const inventoryItem = eligible[0];
        if (!inventoryItem) throw new Error('INSUFFICIENT_STOCK');
        const inventory = inventoryItem.data() as Record<string, unknown>;
        const previousQuantity = Number(inventory.quantity || 0);
        const newQuantity = calculateInventoryQuantity(previousQuantity, 'issue', quantity);
        const existingTransaction = await transaction.get(inventoryTransactionRef);
        if (existingTransaction.exists) throw new Error('REQUEST_ALREADY_COMPLETED');

        transaction.create(inventoryTransactionRef, {
          itemId: inventoryItem.id,
          catalogItemId,
          operationId: `item-request-${id}`,
          itemName: String(inventory.name || itemName),
          itemCategory: inventory.category,
          type: 'issue',
          quantity,
          previousQuantity,
          newQuantity,
          fromLocation: inventory.location,
          issuedTo: String(itemRequest.requesterName || 'Staff member'),
          issuedToRole: 'Staff',
          purpose: String(itemRequest.reason || ''),
          expectedReturnDate: itemRequest.expectedReturnDate || undefined,
          notes: `Released from staff item request ${id}`,
          academicYearId: academicContext!.academicYear.id,
          academicYearName: academicContext!.academicYear.name,
          termId: academicContext!.term.id,
          termName: academicContext!.term.name,
          processedBy: performedBy,
          processedByUserId: actor.decoded.uid,
          processedByUsername: actor.user.username,
          transactionDate: new Date().toISOString().slice(0, 10),
          createdAt: now,
        });
        transaction.create(issuedItemRef, {
          itemId: inventoryItem.id,
          catalogItemId,
          itemName: String(inventory.name || itemName),
          transactionId: inventoryTransactionRef.id,
          quantity,
          issuedTo: String(itemRequest.requesterName || 'Staff member'),
          issuedToRole: 'Staff',
          purpose: String(itemRequest.reason || ''),
          location: inventory.location,
          issueDate: new Date().toISOString().slice(0, 10),
          expectedReturnDate: itemRequest.expectedReturnDate || undefined,
          status: 'issued',
          academicYearId: academicContext!.academicYear.id,
          termId: academicContext!.term.id,
          createdAt: now,
        });
        transaction.update(inventoryItem.ref, {
          quantity: newQuantity,
          totalValue: Number(inventory.unitValue || 0) * newQuantity,
          totalIssued: Number(inventory.totalIssued || 0) + quantity,
          currentlyIssued: Number(inventory.currentlyIssued || 0) + quantity,
          updatedAt: now,
        });
        status = 'released';
        requestUpdates.inventoryItemId = inventoryItem.id;
        requestUpdates.inventoryTransactionId = inventoryTransactionRef.id;
        requestUpdates.issuedItemId = issuedItemRef.id;
        requestUpdates.isActive = false;
        requestUpdates.statusReason = null;
      } else if (input.action === 'pending') {
        status = input.pendingMode === 'restock' ? 'pending_restock' : 'pending_available';
        reason = reason || (status === 'pending_restock' ? defaultRestockPendingReason(itemName) : 'Your request is waiting for release.');
        requestUpdates.statusReason = reason;
      } else {
        status = 'declined';
        requestUpdates.statusReason = reason;
        requestUpdates.isActive = false;
      }

      requestUpdates.status = status;
      transaction.update(requestRef, requestUpdates);
      transaction.create(eventRef, {
        requestId: id,
        action: input.action === 'release' ? 'released' : input.action === 'decline' ? 'declined' : 'pending',
        fromStatus: previousStatus,
        toStatus: status,
        actorUserId: actor.decoded.uid,
        actorName: performedBy,
        reason: reason || null,
        operationId: input.operationId,
        createdAt: now,
      });
      transaction.create(operationRef, { requestId: id, status, actorUserId: actor.decoded.uid, operationId: input.operationId, createdAt: now });
      bumpDomainRevisionsAdmin(
        db,
        transaction,
        input.action === 'release'
          ? ['itemRequests', 'inventoryItems', 'inventoryTransactions', 'issuedItems']
          : ['itemRequests'],
      );
      return { duplicate: false, status, requesterUserId, itemName, quantity, unit, reason };
    });

    if (!outcome.duplicate) {
      await notifyRequester(outcome.requesterUserId, id, outcome.status, outcome.itemName, outcome.quantity, outcome.unit, outcome.reason);
    }
    return NextResponse.json({ success: true, status: outcome.status, duplicate: outcome.duplicate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update this item request.';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403
        : ['REQUEST_NOT_FOUND'].includes(message) ? 404
          : ['REQUEST_ALREADY_COMPLETED', 'INSUFFICIENT_STOCK', 'REQUEST_NOT_CATALOGUED', 'ACADEMIC_CONTEXT_UNAVAILABLE'].includes(message) ? 409 : 500;
    const responseMessage = message === 'INSUFFICIENT_STOCK'
      ? 'There is no single available stock record with enough quantity to release this request.'
      : message === 'REQUEST_NOT_CATALOGUED'
        ? 'This proposed item must be added to the shared catalogue and stocked before it can be released.'
        : message === 'ACADEMIC_CONTEXT_UNAVAILABLE'
          ? 'Set an active academic year and term before releasing stock.'
          : message === 'REQUEST_ALREADY_COMPLETED'
            ? 'This request has already been completed or changed. Refresh the queue.'
            : status === 401 ? 'Sign in is required.' : 'Unable to update this item request.';
    console.error('Item request decision failed:', error);
    return NextResponse.json({ error: responseMessage }, { status });
  }
}
