import type { PaymentRecord } from '@/types';
import {
  PaymentsService,
  type PaymentHistoryContext,
  type PaymentOperationAllocation,
} from './payments.service';
import { isFirestoreQuotaError } from '@/lib/utils/firestore-quota-error';

export type PaymentCommandInput = {
  operationId?: string;
  allocations?: PaymentOperationAllocation[];
  historyContext?: PaymentHistoryContext;
  skipHistoryLog?: boolean;
  [key: string]: unknown;
};

export type PaymentCommandResult = {
  success: true;
  paymentId?: string;
  paymentIds?: string[];
  operationId?: string;
  wasReplay: boolean;
};

const CAPACITY_MESSAGE = 'The database is temporarily at capacity, so this payment request could not be completed. Please wait and retry the same payment later.';

/**
 * Records a payment with the Firebase identity established during application
 * sign-in. This function performs no additional authentication or token minting.
 */
export async function submitPaymentCommand(command: PaymentCommandInput): Promise<PaymentCommandResult> {
  const {
    historyContext,
    skipHistoryLog,
    operationId,
    allocations,
    ...paymentData
  } = command;

  try {
    if (allocations) {
      if (!operationId) throw new Error('A grouped payment request requires an operation ID');
      const operation = await PaymentsService.createPaymentOperation(operationId, allocations);
      return {
        success: true,
        operationId,
        paymentIds: operation.paymentIds,
        wasReplay: operation.wasReplay,
      };
    }

    const typedPaymentData = paymentData as Omit<PaymentRecord, 'id' | 'createdAt'>;
    const operation = operationId
      ? await PaymentsService.createPaymentOperation(operationId, [{ paymentData: typedPaymentData, historyContext }])
      : null;
    const paymentId = operation?.paymentIds[0] || await PaymentsService.createPayment(typedPaymentData, {
      skipHistoryLog,
      historyContext,
    });

    return {
      success: true,
      paymentId,
      operationId: operation?.operationId,
      wasReplay: operation?.wasReplay || false,
    };
  } catch (error) {
    if (isFirestoreQuotaError(error)) throw new Error(CAPACITY_MESSAGE, { cause: error });
    throw error;
  }
}
