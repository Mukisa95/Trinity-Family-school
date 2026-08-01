import { NextRequest, NextResponse } from 'next/server';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { SchoolPayInboxService } from '@/lib/services/schoolpay-inbox.server';
import {
  SchoolPayIntegrationService,
  type SchoolPayPaymentPayload,
  type SchoolPayPaymentType,
} from '@/lib/services/schoolpay-integration.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAppUser(request);
    if (!GranularPermissionService.canAccessPage(actor.user, 'fees', 'schoolpay_feed')) {
      return jsonError('You do not have permission to assign SchoolPay payments.', 403);
    }

    const { id } = await params;
    const { pupilId } = await request.json() as { pupilId?: string };
    if (!id || !pupilId) return jsonError('A SchoolPay inbox record and pupil are required.', 400);

    const inbox = await SchoolPayInboxService.get(id);
    if (!inbox) return jsonError('SchoolPay payment was not found.', 404);
    if (inbox.status === 'recorded') {
      return NextResponse.json({
        success: true,
        alreadyRecorded: true,
        pupilId: inbox.pupilId,
        localPaymentIds: inbox.localPaymentIds || [],
      });
    }

    const paymentCode = `${inbox.studentPaymentCode || inbox.rawPayment?.studentPaymentCode || ''}`.trim();
    if (!paymentCode) return jsonError('SchoolPay did not provide a payment code for this transaction.', 422);

    const db = getFirestore(getFirebaseAdminApp());
    const pupilRef = db.collection('pupils').doc(pupilId);
    const pupilSnap = await pupilRef.get();
    if (!pupilSnap.exists) return jsonError('The selected pupil no longer exists.', 404);

    const conflicts = new Set<string>();
    const fields = ['payCode', 'schoolPayCode', 'schoolPayPaymentCode', 'paymentCode'];
    const codeValues: Array<string | number> = [paymentCode];
    if (/^\d+$/.test(paymentCode)) codeValues.push(Number(paymentCode));
    const conflictSnaps = await Promise.all([
      ...fields.flatMap(field => codeValues.map(value =>
        db.collection('pupils').where(field, '==', value).limit(2).get()
      )),
      db.collection('pupils').where('additionalIdentifiers', 'array-contains', {
        idType: 'SchoolPay Payment Code',
        idValue: paymentCode,
      }).limit(2).get(),
    ]);
    conflictSnaps.forEach(snapshot => snapshot.docs.forEach(item => {
      if (item.id !== pupilId) conflicts.add(item.id);
    }));
    if (conflicts.size > 0) {
      return jsonError('This SchoolPay code is already assigned to another pupil.', 409);
    }

    const pupilData = pupilSnap.data() || {};
    const identifiers = Array.isArray(pupilData.additionalIdentifiers)
      ? pupilData.additionalIdentifiers.filter((item: any) => {
          const type = `${item?.idType || ''}`.toLowerCase();
          return !type.includes('payment code') && !type.includes('pay code');
        })
      : [];
    identifiers.push({ idType: 'SchoolPay Payment Code', idValue: paymentCode });

    const actorSummary = {
      id: actor.user.id,
      name: actor.user.username || `${actor.user.firstName || ''} ${actor.user.lastName || ''}`.trim(),
      role: actor.user.role,
    };
    const claimed = await SchoolPayInboxService.markProcessing(id, 'assignment');
    if (!claimed) return jsonError('This receipt is already being processed on another device.', 409);

    // The existing fee-allocation service still uses Firebase's Web SDK. Give
    // it the server identity, while pupil matching itself now uses Admin reads.
    let result;
    try {
      await pupilRef.update({
        payCode: paymentCode,
        additionalIdentifiers: identifiers,
        updatedAt: Timestamp.now(),
      });
      await SchoolPayInboxService.markAssigned(id, actorSummary);
      await ensureServerFirestoreAuth();
      result = await SchoolPayIntegrationService.processReconciliationPayload(
        inbox.paymentType as SchoolPayPaymentType,
        inbox.rawPayment as SchoolPayPaymentPayload,
        'assignment',
      );
      await SchoolPayInboxService.markResult(id, result);
    } catch (error) {
      await SchoolPayInboxService.markUnexpectedFailure(id, error);
      throw error;
    }

    await db.collection('historyLogs').add({
      a: 'update',
      e: 'schoolpay_inbox',
      rid: id,
      rl: `Assigned SchoolPay code to ${pupilData.firstName || ''} ${pupilData.lastName || ''}`.trim(),
      m: {
        pupilId,
        receiptNumber: `${inbox.receiptNumber || ''}`.slice(0, 40),
        outcome: result.success ? 'success' : 'failed',
      },
      uid: actorSummary.id,
      un: actorSummary.name,
      ur: actorSummary.role,
      ts: Timestamp.now(),
    });

    if (!result.success) return jsonError(result.message, result.statusCode || 500);
    return NextResponse.json({
      success: true,
      pupilId,
      localPaymentIds: result.localPaymentIds,
      receiptNumber: result.receiptNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign SchoolPay payment';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403
        : 500;
    console.error('[SchoolPay Inbox] Assignment failed:', error);
    return jsonError(message, status);
  }
}
