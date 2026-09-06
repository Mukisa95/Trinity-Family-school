import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { SystemUser } from '@/types';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const inputSchema = z.object({ purchaseId: z.string().trim().min(1).max(160) });

function canCreatePurchase(user: SystemUser) {
  return GranularPermissionService.canAccessPage(user, 'procurement', 'purchases')
    && GranularPermissionService.canPerformAction(user, 'procurement', 'purchases', 'create_purchase');
}

function displayName(user: SystemUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || 'Procurement staff';
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAppUser(request);
    if (!canCreatePurchase(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to record Procurement purchases.' }, { status: 403 });
    }
    const { id } = await params;
    if (!id || id.length > 160 || id.includes('/')) return NextResponse.json({ error: 'Invalid restock instruction.' }, { status: 400 });
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid purchase reference.' }, { status: 400 });

    const db = getFirestore(getFirebaseAdminApp());
    const restockRef = db.collection('procurementRestockRequests').doc(id);
    const purchaseRef = db.collection('procurementPurchases').doc(parsed.data.purchaseId);
    const actorName = displayName(actor.user);
    const outcome = await db.runTransaction(async transaction => {
      const [restockSnapshot, purchaseSnapshot] = await Promise.all([
        transaction.get(restockRef),
        transaction.get(purchaseRef),
      ]);
      if (!restockSnapshot.exists) throw new Error('RESTOCK_NOT_FOUND');
      if (!purchaseSnapshot.exists) throw new Error('PURCHASE_NOT_FOUND');
      const restock = restockSnapshot.data() as Record<string, unknown>;
      const purchase = purchaseSnapshot.data() as Record<string, unknown>;
      if (!['submitted', 'purchased'].includes(String(restock.status || ''))) throw new Error('RESTOCK_NOT_ACTIVE');
      if (String(restock.procurementItemId || '') !== String(purchase.itemId || '')) throw new Error('PURCHASE_ITEM_MISMATCH');
      const linkedPurchaseId = typeof restock.procurementPurchaseId === 'string' ? restock.procurementPurchaseId : '';
      if (linkedPurchaseId && linkedPurchaseId !== purchaseRef.id) throw new Error('RESTOCK_ALREADY_LINKED');
      const purchaseRestockId = typeof purchase.restockRequestId === 'string' ? purchase.restockRequestId : '';
      if (purchaseRestockId && purchaseRestockId !== restockRef.id) throw new Error('PURCHASE_ALREADY_LINKED');

      const now = FieldValue.serverTimestamp();
      const duplicate = linkedPurchaseId === purchaseRef.id;
      transaction.set(purchaseRef, { restockRequestId: restockRef.id, updatedAt: now }, { merge: true });
      transaction.set(restockRef, {
        status: 'purchased',
        procurementPurchaseId: purchaseRef.id,
        updatedAt: now,
        purchaseRecordedBy: actor.decoded.uid,
        purchaseRecordedByName: actorName,
      }, { merge: true });
      transaction.set(db.collection('itemRequests').doc(String(restock.itemRequestId)), {
        procurementPurchaseId: purchaseRef.id,
        updatedAt: now,
        lastActionAt: now,
        lastActionBy: actor.decoded.uid,
        lastActionByName: actorName,
      }, { merge: true });
      if (!duplicate) {
        const eventRef = db.collection('itemRequestEvents').doc();
        transaction.create(eventRef, {
          requestId: String(restock.itemRequestId),
          action: 'purchase_recorded',
          fromStatus: 'restock_in_progress',
          toStatus: 'restock_in_progress',
          actorUserId: actor.decoded.uid,
          actorName,
          reason: `Procurement purchase ${purchaseRef.id} was recorded for restock instruction ${restockRef.id}.`,
          operationId: `restock-purchase-${purchaseRef.id}`,
          createdAt: now,
        });
      }
      return { duplicate };
    });
    return NextResponse.json({ success: true, duplicate: outcome.duplicate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to link the purchase.';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403
        : ['RESTOCK_NOT_FOUND', 'PURCHASE_NOT_FOUND'].includes(message) ? 404
          : ['RESTOCK_NOT_ACTIVE', 'PURCHASE_ITEM_MISMATCH', 'RESTOCK_ALREADY_LINKED', 'PURCHASE_ALREADY_LINKED'].includes(message) ? 409 : 500;
    console.error('Procurement restock purchase link failed:', error);
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to link this purchase to the restock instruction.' }, { status });
  }
}
