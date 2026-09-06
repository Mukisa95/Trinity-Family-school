import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import type { ProcurementRestockRequest, SystemUser } from '@/types';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';

export const dynamic = 'force-dynamic';
export const revalidate = false;

function canViewRestockQueue(user: SystemUser) {
  return GranularPermissionService.canAccessPage(user, 'procurement', 'purchases')
    && GranularPermissionService.canPerformAction(user, 'procurement', 'purchases', 'view_purchases');
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return typeof value === 'string' ? value : new Date().toISOString();
}

function toRestockRequest(id: string, data: Record<string, unknown>): ProcurementRestockRequest {
  const status = ['submitted', 'purchased', 'received', 'cancelled'].includes(String(data.status))
    ? data.status as ProcurementRestockRequest['status']
    : 'submitted';
  return {
    id,
    itemRequestId: String(data.itemRequestId || ''),
    catalogItemId: String(data.catalogItemId || ''),
    procurementItemId: String(data.procurementItemId || ''),
    itemName: String(data.itemName || 'Requested item'),
    unit: String(data.unit || 'Units'),
    requestedQuantity: Number(data.requestedQuantity || 0),
    status,
    requestedByUserId: String(data.requestedByUserId || ''),
    requestedByName: String(data.requestedByName || 'Staff member'),
    createdByUserId: String(data.createdByUserId || ''),
    createdByName: String(data.createdByName || 'Staff member'),
    createdAt: toIso(data.createdAt),
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : undefined,
    procurementPurchaseId: typeof data.procurementPurchaseId === 'string' ? data.procurementPurchaseId : undefined,
    receivedInventoryTransactionId: typeof data.receivedInventoryTransactionId === 'string' ? data.receivedInventoryTransactionId : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canViewRestockQueue(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to view Procurement restock work.' }, { status: 403 });
    }
    const db = getFirestore(getFirebaseAdminApp());
    const snapshot = await db.collection('procurementRestockRequests')
      .where('status', 'in', ['submitted', 'purchased'])
      .limit(500)
      .get();
    const restocks = snapshot.docs
      .map(doc => toRestockRequest(doc.id, doc.data()))
      .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime())
      .slice(0, 100);
    // A purchase is written by the established Procurement screen before the
    // protected route confirms both records together. Surface an interrupted
    // confirmation so the next user does not accidentally buy the same item.
    const unlinkedPurchaseByRestockId = new Map<string, string>();
    const restockIds = restocks.filter(item => !item.procurementPurchaseId).map(item => item.id);
    for (let start = 0; start < restockIds.length; start += 30) {
      const purchases = await db.collection('procurementPurchases')
        .where('restockRequestId', 'in', restockIds.slice(start, start + 30))
        .get();
      purchases.docs.forEach(purchase => {
        const restockId = String(purchase.data().restockRequestId || '');
        if (restockId && !unlinkedPurchaseByRestockId.has(restockId)) unlinkedPurchaseByRestockId.set(restockId, purchase.id);
      });
    }
    return NextResponse.json({
      requests: restocks.map(restock => ({
        ...restock,
        unlinkedPurchaseId: unlinkedPurchaseByRestockId.get(restock.id),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load restock work.';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'ACCOUNT_INACTIVE' ? 403 : 500;
    console.error('Procurement restock queue load failed:', error);
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to load restock work.' }, { status });
  }
}
