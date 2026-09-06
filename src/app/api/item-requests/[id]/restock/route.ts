import { createHash } from 'crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ProcurementUnit, SystemUser } from '@/types';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { buildCatalogKey, normalizeCatalogName } from '@/lib/utils/item-catalog';
import { bumpDomainRevisionsAdmin } from '@/lib/server/domain-cache-revisions.admin';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const restockSchema = z.object({ operationId: z.string().trim().min(8).max(160) });
const procurementUnits = new Set<ProcurementUnit>(['Kg', 'Litres', 'Dozens', 'Pieces', 'Packets', 'Bags', 'Boxes', 'Metres', 'Bundles', 'Sets', 'Rolls', 'Bottles', 'Cans', 'Other']);

function displayName(user: SystemUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || 'Procurement staff';
}

function canStartRestock(user: SystemUser) {
  return GranularPermissionService.canAccessPage(user, 'item_requests', 'release')
    && GranularPermissionService.canPerformAction(user, 'item_requests', 'release', 'start_restock');
}

function canCreateProcurementItem(user: SystemUser) {
  return GranularPermissionService.canAccessPage(user, 'procurement', 'items')
    && GranularPermissionService.canPerformAction(user, 'procurement', 'items', 'create_item');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAppUser(request);
    const { id } = await params;
    if (!id || id.length > 160 || id.includes('/')) return NextResponse.json({ error: 'Invalid item request.' }, { status: 400 });
    if (!canStartRestock(actor.user)) return NextResponse.json({ error: 'You do not have permission to start restocking.' }, { status: 403 });
    const parsed = restockSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid restock request.' }, { status: 400 });

    const db = getFirestore(getFirebaseAdminApp());
    const requestRef = db.collection('itemRequests').doc(id);
    const eventRef = db.collection('itemRequestEvents').doc();
    const restockRef = db.collection('procurementRestockRequests').doc(`item-request-${id}`);
    const operationKey = createHash('sha256').update(`${id}:${actor.decoded.uid}:${parsed.data.operationId}`).digest('hex');
    const operationRef = db.collection('itemRequestRestockOperations').doc(operationKey);
    const performedBy = displayName(actor.user);

    // We first check whether the request will require a new Procurement master
    // item. This allows the route to refuse that separate authority before any
    // writes occur, while the transaction below still protects against races.
    const preflight = await requestRef.get();
    if (!preflight.exists) return NextResponse.json({ error: 'Item request not found.' }, { status: 404 });
    const preflightData = preflight.data() as Record<string, unknown>;
    let catalogItemId = typeof preflightData.catalogItemId === 'string' ? preflightData.catalogItemId : '';
    if (!catalogItemId) {
      const name = String(preflightData.itemName || '').trim();
      const unit = String(preflightData.unit || '').trim();
      if (!name || !unit) return NextResponse.json({ error: 'This proposed item is incomplete and cannot be restocked.' }, { status: 409 });
      catalogItemId = buildCatalogKey(normalizeCatalogName(name), unit);
    }
    const existingProcurement = await db.collection('procurementItems').where('catalogItemId', '==', catalogItemId).limit(1).get();
    if (!existingProcurement.docs.length && !canCreateProcurementItem(actor.user)) {
      return NextResponse.json({ error: 'You may start restocking, but creating the required shared Procurement item needs the Create Procurement Item permission.' }, { status: 403 });
    }

    const outcome = await db.runTransaction(async transaction => {
      const completed = await transaction.get(operationRef);
      if (completed.exists) return { id: String(completed.data()?.restockRequestId || ''), duplicate: true, createdCatalogItem: false };
      const existingRestock = await transaction.get(restockRef);
      if (existingRestock.exists) {
        transaction.create(operationRef, { restockRequestId: restockRef.id, actorUserId: actor.decoded.uid, operationId: parsed.data.operationId, createdAt: FieldValue.serverTimestamp() });
        return { id: restockRef.id, duplicate: true, createdCatalogItem: false };
      }
      const itemRequestSnapshot = await transaction.get(requestRef);
      if (!itemRequestSnapshot.exists) throw new Error('REQUEST_NOT_FOUND');
      const itemRequest = itemRequestSnapshot.data() as Record<string, unknown>;
      if (itemRequest.isActive !== true || ['released', 'declined', 'cancelled'].includes(String(itemRequest.status || ''))) throw new Error('REQUEST_NOT_ACTIVE');
      const itemName = String(itemRequest.itemName || '').trim();
      const unit = String(itemRequest.unit || '').trim();
      const quantity = Number(itemRequest.quantity || 0);
      const requesterUserId = String(itemRequest.requesterUserId || '');
      if (!itemName || !unit || !Number.isFinite(quantity) || quantity <= 0 || !requesterUserId) throw new Error('REQUEST_INVALID');

      const targetCatalogId = typeof itemRequest.catalogItemId === 'string' && itemRequest.catalogItemId
        ? itemRequest.catalogItemId
        : buildCatalogKey(normalizeCatalogName(itemName), unit);
      const catalogRef = db.collection('schoolItemCatalog').doc(targetCatalogId);
      const catalogSnapshot = await transaction.get(catalogRef);
      const createdCatalogItem = !catalogSnapshot.exists;
      if (createdCatalogItem) {
        if (!canCreateProcurementItem(actor.user)) throw new Error('CATALOG_CREATE_FORBIDDEN');
        transaction.create(catalogRef, {
          catalogKey: targetCatalogId,
          name: itemName,
          normalizedName: normalizeCatalogName(itemName),
          standardUnit: unit,
          purchaseUnit: unit,
          unitsPerPurchaseUnit: 1,
          isStockTracked: true,
          isActive: true,
          createdBy: performedBy,
          createdByUserId: actor.decoded.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (catalogSnapshot.data()?.isActive === false) {
        throw new Error('CATALOG_ITEM_INACTIVE');
      }

      const procurementItemsQuery = db.collection('procurementItems').where('catalogItemId', '==', targetCatalogId).limit(1);
      const procurementItems = await transaction.get(procurementItemsQuery);
      let procurementItemRef = procurementItems.docs[0]?.ref;
      const createdProcurementItem = !procurementItemRef;
      if (!procurementItemRef) {
        if (!canCreateProcurementItem(actor.user)) throw new Error('CATALOG_CREATE_FORBIDDEN');
        procurementItemRef = db.collection('procurementItems').doc();
        const procurementUnit = procurementUnits.has(unit as ProcurementUnit) ? unit as ProcurementUnit : 'Other';
        transaction.create(procurementItemRef, {
          catalogItemId: targetCatalogId,
          name: itemName,
          category: 'Other',
          unit: procurementUnit,
          customUnit: procurementUnit === 'Other' ? unit : null,
          purchaseUnit: unit,
          unitsPerPurchaseUnit: 1,
          useCase: `Restock for staff item request ${id}`,
          description: String(itemRequest.reason || ''),
          isActive: true,
          stockTracking: true,
          totalQuantityPurchased: 0,
          totalAmountSpent: 0,
          createdBy: performedBy,
          createdByUserId: actor.decoded.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      const now = FieldValue.serverTimestamp();
      transaction.create(restockRef, {
        itemRequestId: id,
        catalogItemId: targetCatalogId,
        procurementItemId: procurementItemRef.id,
        itemName,
        unit,
        requestedQuantity: quantity,
        status: 'submitted',
        requestedByUserId: requesterUserId,
        requestedByName: String(itemRequest.requesterName || 'Staff member'),
        createdByUserId: actor.decoded.uid,
        createdByName: performedBy,
        createdAt: now,
        updatedAt: now,
      });
      transaction.update(requestRef, {
        catalogItemId: targetCatalogId,
        status: 'restock_in_progress',
        statusReason: `Restocking has started for ${itemName}.`,
        restockRequestId: restockRef.id,
        lastActionAt: now,
        lastActionBy: actor.decoded.uid,
        lastActionByName: performedBy,
        updatedAt: now,
      });
      transaction.create(eventRef, {
        requestId: id,
        action: 'restock_started',
        fromStatus: String(itemRequest.status || 'submitted'),
        toStatus: 'restock_in_progress',
        actorUserId: actor.decoded.uid,
        actorName: performedBy,
        reason: `Restock instruction ${restockRef.id} created.`,
        operationId: parsed.data.operationId,
        createdAt: now,
      });
      transaction.create(operationRef, { restockRequestId: restockRef.id, actorUserId: actor.decoded.uid, operationId: parsed.data.operationId, createdAt: now });
      const revisionKeys: Array<'itemRequests' | 'procurementRestocks' | 'schoolItemCatalog' | 'procurementItems'> = ['itemRequests', 'procurementRestocks'];
      if (createdCatalogItem) revisionKeys.push('schoolItemCatalog');
      if (createdProcurementItem) revisionKeys.push('procurementItems');
      bumpDomainRevisionsAdmin(db, transaction, revisionKeys);
      return { id: restockRef.id, duplicate: false, createdCatalogItem };
    });

    return NextResponse.json({ success: true, restockRequestId: outcome.id, duplicate: outcome.duplicate, createdCatalogItem: outcome.createdCatalogItem });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start restocking.';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' || message === 'CATALOG_CREATE_FORBIDDEN' ? 403
        : ['REQUEST_NOT_FOUND'].includes(message) ? 404
          : ['REQUEST_NOT_ACTIVE', 'REQUEST_INVALID', 'CATALOG_ITEM_INACTIVE'].includes(message) ? 409 : 500;
    console.error('Item request restock failed:', error);
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : message === 'CATALOG_ITEM_INACTIVE' ? 'The linked shared item is inactive.' : 'Unable to start restocking.' }, { status });
  }
}
