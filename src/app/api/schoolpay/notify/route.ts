import { NextRequest, NextResponse } from 'next/server';
import {
  SchoolPayIntegrationService,
  type SchoolPayPaymentPayload,
  type SchoolPayWebhookPayload,
} from '@/lib/services/schoolpay-integration.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RawWebhookPayload = Record<string, unknown>;

interface ParsedWebhookPayload {
  payload: SchoolPayWebhookPayload;
  raw: RawWebhookPayload;
  contentType: string;
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return `${value}`.trim();
}

function buildFieldLookup(raw: RawWebhookPayload): Map<string, unknown> {
  const lookup = new Map<string, unknown>();
  for (const [key, value] of Object.entries(raw)) {
    lookup.set(key.toLowerCase(), value);
  }
  return lookup;
}

function getField(lookup: Map<string, unknown>, ...names: string[]): string {
  for (const name of names) {
    const value = lookup.get(name.toLowerCase());
    const text = stringifyValue(value);
    if (text) return text;
  }
  return '';
}

function summarizeRawPayload(raw: RawWebhookPayload): Record<string, unknown> {
  const lookup = buildFieldLookup(raw);
  const payment =
    raw?.payment && typeof raw.payment === 'object'
      ? (raw.payment as RawWebhookPayload)
      : raw;
  const paymentLookup = buildFieldLookup(payment);

  return {
    keys: Object.keys(raw).slice(0, 30),
    nestedPaymentKeys:
      raw?.payment && typeof raw.payment === 'object'
        ? Object.keys(raw.payment as RawWebhookPayload).slice(0, 30)
        : [],
    hasSignature: !!(
      getField(lookup, 'signature', 'hash', 'checksum') ||
      getField(paymentLookup, 'signature', 'hash', 'checksum')
    ),
    receiptNumber: getField(
      paymentLookup,
      'schoolpayReceiptNumber',
      'schoolPayReceiptNumber',
      'receiptNumber',
      'receiptNo'
    ),
    paymentCode: getField(paymentLookup, 'studentPaymentCode', 'paymentCode', 'schoolPayCode'),
    transactionId: getField(
      paymentLookup,
      'sourceChannelTransactionId',
      'transactionId',
      'transactionReference'
    ),
    amount: getField(paymentLookup, 'amount', 'paymentAmount', 'paidAmount'),
    status: getField(paymentLookup, 'transactionCompletionStatus', 'completionStatus', 'status'),
  };
}

async function parseIncomingPayload(request: NextRequest): Promise<ParsedWebhookPayload> {
  const contentType = request.headers.get('content-type') || '';
  let raw: RawWebhookPayload;

  if (contentType.includes('application/json')) {
    raw = (await request.json()) as RawWebhookPayload;
  } else if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const formData = await request.formData();
    raw = Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : value.name,
      ])
    );
  } else {
    const text = await request.text();
    try {
      raw = JSON.parse(text || '{}') as RawWebhookPayload;
    } catch {
      raw = Object.fromEntries(new URLSearchParams(text));
    }
  }

  if (raw?.payment && typeof raw.payment === 'object') {
    const signature =
      stringifyValue(raw.signature) ||
      request.headers.get('x-schoolpay-signature') ||
      request.headers.get('x-signature') ||
      '';

    return {
      payload: {
        ...raw,
        signature,
        payment: raw.payment as SchoolPayPaymentPayload,
      } as SchoolPayWebhookPayload,
      raw,
      contentType,
    };
  }

  const lookup = buildFieldLookup(raw);
  const payment: SchoolPayPaymentPayload = {
    amount: getField(lookup, 'amount', 'paymentAmount', 'paidAmount'),
    paymentDateAndTime: getField(lookup, 'paymentDateAndTime', 'paymentDate', 'datePaid'),
    schoolpayReceiptNumber: getField(
      lookup,
      'schoolpayReceiptNumber',
      'schoolPayReceiptNumber',
      'receiptNumber',
      'receiptNo'
    ),
    settlementBankCode: getField(lookup, 'settlementBankCode', 'bankCode'),
    sourceChannelTransDetail: getField(lookup, 'sourceChannelTransDetail', 'transactionDetail'),
    sourceChannelTransactionId: getField(
      lookup,
      'sourceChannelTransactionId',
      'transactionId',
      'transactionReference'
    ),
    sourcePaymentChannel: getField(lookup, 'sourcePaymentChannel', 'paymentChannel', 'channel'),
    studentClass: getField(lookup, 'studentClass', 'class'),
    studentName: getField(lookup, 'studentName', 'name'),
    studentPaymentCode: getField(lookup, 'studentPaymentCode', 'paymentCode', 'schoolPayCode'),
    studentRegistrationNumber: getField(
      lookup,
      'studentRegistrationNumber',
      'registrationNumber',
      'admissionNumber'
    ),
    supplementaryFeeDescription: getField(lookup, 'supplementaryFeeDescription', 'feeDescription'),
    supplementaryFeeId: getField(lookup, 'supplementaryFeeId', 'feeId'),
    transactionCompletionDateAndTime: getField(
      lookup,
      'transactionCompletionDateAndTime',
      'completionDate',
      'completedAt'
    ),
    transactionCompletionStatus: getField(
      lookup,
      'transactionCompletionStatus',
      'completionStatus',
      'status'
    ),
  };

  const rawType = getField(lookup, 'type', 'paymentType');
  const inferredType = payment.supplementaryFeeId ? 'OTHER_FEES' : 'SCHOOL_FEES';

  return {
    payload: {
      signature:
        getField(lookup, 'signature', 'hash', 'checksum') ||
        request.headers.get('x-schoolpay-signature') ||
        request.headers.get('x-signature') ||
        '',
      type: rawType === 'OTHER_FEES' ? 'OTHER_FEES' : inferredType,
      payment,
    },
    raw,
    contentType,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { payload, raw, contentType } = await parseIncomingPayload(request);

    await SchoolPayIntegrationService.logWebhookReceipt({
      url: request.url,
      contentType,
      userAgent: request.headers.get('user-agent') || '',
      ...summarizeRawPayload(raw),
    }).catch((error) => {
      console.error('❌ [SchoolPay Webhook] Error logging webhook receipt:', error);
    });

    if (!payload?.payment || !payload?.type) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payload',
          message: 'Expected payload with type, signature, and payment fields',
        },
        { status: 422 }
      );
    }

    if (payload.type !== 'SCHOOL_FEES' && payload.type !== 'OTHER_FEES') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payment type',
          message: 'type must be either SCHOOL_FEES or OTHER_FEES',
        },
        { status: 422 }
      );
    }

    const result = await SchoolPayIntegrationService.processWebhookPayload(payload);
    const status = result.statusCode || (result.success ? 200 : 500);

    return NextResponse.json(
      {
        success: result.success,
        duplicate: !!result.duplicate,
        skipped: !!result.skipped,
        message: result.message,
        receiptNumber: result.receiptNumber,
        paymentType: result.paymentType,
        pupilId: result.pupilId,
        localPaymentIds: result.localPaymentIds,
      },
      { status }
    );
  } catch (error) {
    console.error('❌ [SchoolPay Webhook] Error processing webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'SchoolPay webhook endpoint is active',
    configured: SchoolPayIntegrationService.isConfigured(),
    timestamp: new Date().toISOString(),
  });
}
