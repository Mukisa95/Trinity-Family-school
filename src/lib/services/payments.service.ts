import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  runTransaction,
  orderBy, 
  where,
  Timestamp,
  type Transaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { PaymentRecord } from '@/types';
import { HistoryLogService } from './history-log.service';

const PAYMENTS_COLLECTION = 'payments';
const PAYMENT_OPERATIONS_COLLECTION = 'paymentOperations';
const PAYMENT_NOTIFICATION_OUTBOX = 'scheduledNotifications/fee-payment-events/outbox';
const UNIFORM_TRACKING_COLLECTION = 'uniformTracking';
const MAX_PAYMENT_ALLOCATIONS_PER_OPERATION = 100;
const PAYMENT_OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{12,160}$/;

export interface PaymentHistoryContext {
  feeName?: string;
  pupilName?: string;
  paymentMethod?: string;
  source?: string;
  paidByName?: string;
}

// Remove undefined fields without flattening Firestore values such as Timestamp,
// DocumentReference and FieldValue sentinels into ordinary JSON objects.
export function cleanUndefinedPaymentValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cleanUndefinedPaymentValues(item)) as T;
  }
  if (!value || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .map(([key, nestedValue]) => [key, cleanUndefinedPaymentValues(nestedValue)]),
  ) as T;
}

export interface PaymentOperationAllocation {
  paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>;
  historyContext?: PaymentHistoryContext;
  uniformTracking?: {
    trackingId: string;
    paymentAmount: number;
    paymentDate: string;
  };
}

export interface PaymentOperationResult {
  operationId: string;
  paymentIds: string[];
  wasReplay: boolean;
}

function stablePaymentOperationFingerprint(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map(item => stablePaymentOperationFingerprint(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => (
    `${JSON.stringify(key)}:${stablePaymentOperationFingerprint(record[key])}`
  )).join(',')}}`;
}

export class PaymentsService {
  private static paymentsByYearCache = new Map<string, PaymentRecord[]>();
  private static paymentsByYearInFlight = new Map<string, Promise<PaymentRecord[]>>();
  private static paymentsByTermInFlight = new Map<string, Promise<PaymentRecord[]>>();

  private static termCacheKey(academicYearId: string, termId: string) {
    return `${academicYearId}:${termId}`;
  }

  private static clearYearPaymentsCache(academicYearId?: string) {
    if (!academicYearId) {
      this.paymentsByYearCache.clear();
      this.paymentsByYearInFlight.clear();
      this.paymentsByTermInFlight.clear();
      return;
    }

    this.paymentsByYearCache.delete(academicYearId);
    this.paymentsByYearInFlight.delete(academicYearId);
    const termPrefix = `${academicYearId}:`;
    [...this.paymentsByTermInFlight.keys()]
      .filter(key => key.startsWith(termPrefix))
      .forEach(key => this.paymentsByTermInFlight.delete(key));
  }

  private static buildPaymentHistoryLabel(
    paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>,
    historyContext?: PaymentHistoryContext
  ) {
    return historyContext?.feeName ||
      paymentData.notes ||
      historyContext?.pupilName ||
      paymentData.paidBy?.name ||
      paymentData.pupilId;
  }

  private static buildPaymentHistoryMeta(
    paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>,
    historyContext?: PaymentHistoryContext
  ) {
    return {
      amount: paymentData.amount,
      feeName: historyContext?.feeName || '',
      pupilName: historyContext?.pupilName || '',
      method: historyContext?.paymentMethod || (paymentData as any).paymentMethod || '',
      pupilId: paymentData.pupilId,
      feeId: paymentData.feeStructureId,
      termId: paymentData.termId,
      yearId: paymentData.academicYearId,
      source: historyContext?.source || '',
    };
  }

  private static addPaymentToTransaction(
    transaction: Transaction,
    paymentId: string,
    paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>,
    historyContext?: PaymentHistoryContext,
    enqueueNotification = false,
  ) {
    const newPayment = cleanUndefinedPaymentValues({
      ...paymentData,
      createdAt: Timestamp.now(),
      paymentDate: paymentData.paymentDate || new Date().toISOString(),
    });
    transaction.set(doc(db, PAYMENTS_COLLECTION, paymentId), newPayment);
    if (enqueueNotification) {
      transaction.set(doc(db, PAYMENT_NOTIFICATION_OUTBOX, `payment-${paymentId}`), {
        kind: 'fee_payment',
        version: 1,
        paymentId,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: Timestamp.now(),
        leaseToken: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
    HistoryLogService.addToTransaction(transaction, {
      action: 'create',
      entity: 'payment',
      recordId: paymentId,
      label: this.buildPaymentHistoryLabel(paymentData, historyContext),
      meta: this.buildPaymentHistoryMeta(paymentData, historyContext),
      actor: {
        id: paymentData.paidBy?.id,
        username: paymentData.paidBy?.name,
        role: paymentData.paidBy?.role,
      },
    });
  }

  /**
   * Commits one cashier command exactly once. Reusing the same operation ID
   * after a lost response returns the original payment IDs instead of adding
   * another payment. This deliberately does not alter authentication; callers
   * continue using their existing authorized payment route.
   */
  static async createPaymentOperation(
    operationId: string,
    allocations: PaymentOperationAllocation[],
    options?: { enqueueNotifications?: boolean },
  ): Promise<PaymentOperationResult> {
    if (!PAYMENT_OPERATION_ID_PATTERN.test(operationId)) {
      throw new Error('Payment operation ID is invalid');
    }
    if (allocations.length === 0 || allocations.length > MAX_PAYMENT_ALLOCATIONS_PER_OPERATION) {
      throw new Error(`A payment operation must contain between 1 and ${MAX_PAYMENT_ALLOCATIONS_PER_OPERATION} allocations`);
    }
    if (allocations.some(({ paymentData }) => !Number.isFinite(paymentData.amount) || paymentData.amount <= 0)) {
      throw new Error('Each payment allocation must have a positive amount');
    }

    const fingerprint = stablePaymentOperationFingerprint(allocations.map(allocation => ({
      paymentData: allocation.paymentData,
      historyContext: allocation.historyContext || null,
      ...(allocation.uniformTracking ? { uniformTracking: allocation.uniformTracking } : {}),
    })));
    const operationRef = doc(db, PAYMENT_OPERATIONS_COLLECTION, operationId);

    const result = await runTransaction(db, async transaction => {
      const existingOperation = await transaction.get(operationRef);
      if (existingOperation.exists()) {
        const existing = existingOperation.data();
        if (existing.fingerprint !== fingerprint) {
          throw new Error('This payment operation ID was already used with different payment details');
        }
        const paymentIds = Array.isArray(existing.paymentIds)
          ? existing.paymentIds.filter((id): id is string => typeof id === 'string')
          : [];
        if (paymentIds.length !== allocations.length) {
          throw new Error('The saved payment operation is incomplete and requires review');
        }
        return { paymentIds, wasReplay: true };
      }

      const uniformUpdatesByTrackingId = new Map<string, {
        paymentAmount: number;
        paymentDate: string;
      }>();
      allocations.forEach(({ uniformTracking, paymentData }) => {
        if (!uniformTracking) return;
        if (!uniformTracking.trackingId || !Number.isFinite(uniformTracking.paymentAmount) || uniformTracking.paymentAmount <= 0) {
          throw new Error('Uniform tracking payment details are invalid');
        }
        if (uniformTracking.paymentAmount !== paymentData.amount
          || uniformTracking.paymentDate !== paymentData.paymentDate
          || uniformTracking.trackingId !== (paymentData as any).uniformTrackingId) {
          throw new Error('Uniform tracking must match its payment record');
        }
        const current = uniformUpdatesByTrackingId.get(uniformTracking.trackingId);
        uniformUpdatesByTrackingId.set(uniformTracking.trackingId, {
          paymentAmount: (current?.paymentAmount || 0) + uniformTracking.paymentAmount,
          paymentDate: uniformTracking.paymentDate,
        });
      });
      const uniformSnapshots = await Promise.all(
        [...uniformUpdatesByTrackingId.keys()].map(async trackingId => [
          trackingId,
          await transaction.get(doc(db, UNIFORM_TRACKING_COLLECTION, trackingId)),
        ] as const),
      );

      const paymentIds = allocations.map(() => doc(collection(db, PAYMENTS_COLLECTION)).id);
      allocations.forEach((allocation, index) => {
        this.addPaymentToTransaction(
          transaction,
          paymentIds[index],
          allocation.paymentData,
          allocation.historyContext,
          options?.enqueueNotifications === true,
        );
      });
      uniformSnapshots.forEach(([trackingId, trackingSnapshot]) => {
        if (!trackingSnapshot.exists()) {
          throw new Error('Uniform tracking record not found');
        }
        const update = uniformUpdatesByTrackingId.get(trackingId)!;
        const tracking = trackingSnapshot.data();
        if (allocations.some(allocation => allocation.uniformTracking?.trackingId === trackingId
          && allocation.paymentData.pupilId !== tracking.pupilId)) {
          throw new Error('Uniform tracking does not belong to the payment pupil');
        }
        const currentPaid = Number(tracking.paidAmount) || 0;
        const newPaidAmount = currentPaid + update.paymentAmount;
        // Match the established uniform fee display and legacy tracking rule.
        const finalAmount = Number(tracking.finalAmount || tracking.originalAmount) || 0;
        const newBalance = Math.max(0, finalAmount - newPaidAmount);
        const paymentStatus = newBalance === 0 ? 'paid' : 'partial';
        transaction.update(trackingSnapshot.ref, cleanUndefinedPaymentValues({
          paidAmount: newPaidAmount,
          paymentStatus,
          paymentDate: newBalance === 0 ? update.paymentDate : tracking.paymentDate || update.paymentDate,
          history: [
            ...(Array.isArray(tracking.history) ? tracking.history : []),
            {
              date: update.paymentDate,
              paymentStatus,
              paidAmount: newPaidAmount,
              collectionStatus: tracking.collectionStatus,
            },
          ],
          updatedAt: Timestamp.now(),
        }));
      });
      transaction.set(operationRef, {
        fingerprint,
        paymentIds,
        allocationCount: allocations.length,
        createdAt: Timestamp.now(),
      });
      return { paymentIds, wasReplay: false };
    });

    allocations.forEach(({ paymentData }) => this.clearYearPaymentsCache(paymentData.academicYearId));
    return { operationId, ...result };
  }

  // Payment Records
  static async createPayment(
    paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>,
    options?: {
      skipHistoryLog?: boolean;
      historyContext?: PaymentHistoryContext;
      enqueueNotification?: boolean;
    }
  ): Promise<string> {
    try {
      const newPayment = {
        ...paymentData,
        createdAt: Timestamp.now(),
        paymentDate: paymentData.paymentDate || new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = cleanUndefinedPaymentValues(newPayment);
      
      const docRef = doc(collection(db, PAYMENTS_COLLECTION));
      const batch = writeBatch(db);
      batch.set(docRef, cleanedData);
      if (options?.enqueueNotification) {
        batch.set(doc(db, PAYMENT_NOTIFICATION_OUTBOX, `payment-${docRef.id}`), {
          kind: 'fee_payment',
          version: 1,
          paymentId: docRef.id,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: Timestamp.now(),
          leaseToken: null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      if (!options?.skipHistoryLog) {
        HistoryLogService.addToBatch(batch, {
          action: 'create',
          entity: 'payment',
          recordId: docRef.id,
          label: this.buildPaymentHistoryLabel(paymentData, options?.historyContext),
          meta: this.buildPaymentHistoryMeta(paymentData, options?.historyContext),
          actor: {
            id: paymentData.paidBy?.id,
            username: paymentData.paidBy?.name,
            role: paymentData.paidBy?.role,
          },
        });
      }
      await batch.commit();
      const paymentId = docRef.id;
      this.clearYearPaymentsCache(paymentData.academicYearId);
      
      return paymentId;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  }

  static async getPaymentsByPupil(pupilId: string): Promise<PaymentRecord[]> {
    try {
      const q = query(
        collection(db, PAYMENTS_COLLECTION), 
        where('pupilId', '==', pupilId),
        orderBy('paymentDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        paymentDate: doc.data().paymentDate?.toDate?.() || doc.data().paymentDate,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      })) as PaymentRecord[];
    } catch (error) {
      console.error('Error fetching payments by pupil:', error);
      throw error;
    }
  }

  /** Load a family's ledgers in Firestore-sized batches rather than one read per pupil. */
  static async getPaymentsByPupilIds(pupilIds: string[]): Promise<Map<string, PaymentRecord[]>> {
    const uniqueIds = [...new Set(pupilIds.filter(Boolean))];
    const paymentsByPupil = new Map(uniqueIds.map(id => [id, [] as PaymentRecord[]]));
    const batches = Array.from({ length: Math.ceil(uniqueIds.length / 30) }, (_, index) => uniqueIds.slice(index * 30, index * 30 + 30));

    await Promise.all(batches.map(async pupilIdBatch => {
      const snapshot = await getDocs(query(
        collection(db, PAYMENTS_COLLECTION),
        where('pupilId', 'in', pupilIdBatch),
        orderBy('paymentDate', 'desc'),
      ));
      snapshot.docs.forEach(paymentDoc => {
        const payment = {
          id: paymentDoc.id,
          ...paymentDoc.data(),
          paymentDate: paymentDoc.data().paymentDate?.toDate?.() || paymentDoc.data().paymentDate,
          createdAt: paymentDoc.data().createdAt?.toDate?.() || paymentDoc.data().createdAt,
        } as PaymentRecord;
        paymentsByPupil.get(payment.pupilId)?.push(payment);
      });
    }));

    paymentsByPupil.forEach(payments => payments.sort(
      (left, right) => new Date(right.paymentDate).getTime() - new Date(left.paymentDate).getTime(),
    ));
    return paymentsByPupil;
  }

  static async getPaymentsByFee(feeStructureId: string, pupilId: string, academicYearId: string, termId: string): Promise<PaymentRecord[]> {
    try {
      const q = query(
        collection(db, PAYMENTS_COLLECTION), 
        where('pupilId', '==', pupilId),
        where('feeStructureId', '==', feeStructureId),
        where('academicYearId', '==', academicYearId),
        where('termId', '==', termId),
        orderBy('paymentDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        paymentDate: doc.data().paymentDate?.toDate?.() || doc.data().paymentDate,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      })) as PaymentRecord[];
    } catch (error) {
      console.error('Error fetching payments by fee:', error);
      throw error;
    }
  }

  // 🚀 OPTIMIZED: Database-level filtering for terms/years
  static async getPaymentsByPupilAndTerm(pupilId: string, academicYearId: string, termId: string): Promise<PaymentRecord[]> {
    try {
      const q = query(
        collection(db, PAYMENTS_COLLECTION), 
        where('pupilId', '==', pupilId),
        where('academicYearId', '==', academicYearId),
        where('termId', '==', termId),
        orderBy('paymentDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        paymentDate: doc.data().paymentDate?.toDate?.() || doc.data().paymentDate,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      })) as PaymentRecord[];
    } catch (error) {
      console.error('Error fetching payments by pupil and term:', error);
      throw error;
    }
  }

  static async getPaymentsByPupilAndYear(pupilId: string, academicYearId: string): Promise<PaymentRecord[]> {
    try {
      const yearPayments = await this.getAllPaymentsByYear(academicYearId);
      return yearPayments.filter(payment => payment.pupilId === pupilId);
    } catch (error) {
      console.error('Error fetching payments by pupil and year:', error);
      throw error;
    }
  }

  static async getAllPaymentsByYear(academicYearId: string): Promise<PaymentRecord[]> {
    const cached = this.paymentsByYearCache.get(academicYearId);
    if (cached) {
      return cached;
    }

    const inFlight = this.paymentsByYearInFlight.get(academicYearId);
    if (inFlight) {
      return inFlight;
    }

    const request = (async () => {
      try {
        console.log('🚀 BATCH LOADING: Fetching ALL payments for year in ONE query');
        const startTime = performance.now();

        const q = query(
          collection(db, PAYMENTS_COLLECTION),
          where('academicYearId', '==', academicYearId),
          orderBy('paymentDate', 'desc')
        );

        const querySnapshot = await getDocs(q);

        const payments = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          paymentDate: doc.data().paymentDate?.toDate?.() || doc.data().paymentDate,
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
        })) as PaymentRecord[];

        const endTime = performance.now();
        console.log(`✅ BATCH LOADING: Loaded ${payments.length} year payments in ${(endTime - startTime).toFixed(2)}ms`);

        this.paymentsByYearCache.set(academicYearId, payments);
        return payments;
      } finally {
        this.paymentsByYearInFlight.delete(academicYearId);
      }
    })();

    this.paymentsByYearInFlight.set(academicYearId, request);
    return request;
  }

  static async revertPayment(
    paymentId: string,
    revertedBy: { id: string; name: string; role: string },
    knownPayment?: PaymentRecord,
  ): Promise<void> {
    try {
      let paymentData: (Omit<PaymentRecord, 'id' | 'createdAt'> & { paymentMethod?: string }) | null = knownPayment || null;
      if (!paymentData) {
        const paymentDoc = await getDoc(doc(db, PAYMENTS_COLLECTION, paymentId));
        paymentData = paymentDoc.exists()
          ? (paymentDoc.data() as Omit<PaymentRecord, 'id' | 'createdAt'> & { paymentMethod?: string })
          : null;
      }

      const docRef = doc(db, PAYMENTS_COLLECTION, paymentId);
      const updateData = {
        reverted: true,
        revertedAt: new Date().toISOString(),
        revertedBy
      };
      
      const cleanedData = cleanUndefinedPaymentValues(updateData);
      const batch = writeBatch(db);
      batch.update(docRef, cleanedData);
      HistoryLogService.addToBatch(batch, {
        action: 'revert',
        entity: 'payment',
        recordId: paymentId,
        label: this.buildPaymentHistoryLabel(
          paymentData || ({
            pupilId: paymentId,
            feeStructureId: '',
            academicYearId: '',
            termId: '',
            amount: 0,
            paymentDate: '',
            paidBy: revertedBy,
          } as Omit<PaymentRecord, 'id' | 'createdAt'>),
          {
            paymentMethod: paymentData?.paymentMethod,
          }
        ),
        changedFields: Object.keys(cleanedData),
        meta: {
          amount: paymentData?.amount || 0,
          feeId: paymentData?.feeStructureId || '',
          method: paymentData?.paymentMethod || '',
          pupilId: paymentData?.pupilId || '',
          source: 'revert',
        },
        actor: {
          id: revertedBy?.id,
          username: revertedBy?.name,
          role: revertedBy?.role,
        },
      });
      await batch.commit();
      this.clearYearPaymentsCache();
    } catch (error) {
      console.error('Error reverting payment:', error);
      throw error;
    }
  }

  // A collection screen, analytics, and fee calculations often ask for the
  // same term in one render cycle. Share only in-flight requests: a later
  // explicit refresh must see payments written by the server or another device.
  static async getAllPaymentsByTerm(academicYearId: string, termId: string): Promise<PaymentRecord[]> {
    const cacheKey = this.termCacheKey(academicYearId, termId);

    const inFlight = this.paymentsByTermInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const request = Promise.resolve().then(async () => {
      try {
        console.log('🚀 BATCH LOADING: Fetching ALL payments for term in ONE query');
        const startTime = performance.now();
        const q = query(
          collection(db, PAYMENTS_COLLECTION),
          where('academicYearId', '==', academicYearId),
          where('termId', '==', termId),
          orderBy('paymentDate', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const payments = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          paymentDate: doc.data().paymentDate?.toDate?.() || doc.data().paymentDate,
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
        })) as PaymentRecord[];
        const endTime = performance.now();
        console.log(`✅ BATCH LOADING: Loaded ${payments.length} payments in ${(endTime - startTime).toFixed(2)}ms`);
        return payments;
      } catch (error) {
        console.error('Error fetching payments by term (batch):', error);
        throw error;
      } finally {
        if (this.paymentsByTermInFlight.get(cacheKey) === request) this.paymentsByTermInFlight.delete(cacheKey);
      }
    });

    this.paymentsByTermInFlight.set(cacheKey, request);
    return request;
  }

  // 🚀 PERFORMANCE OPTIMIZATION: Group payments by pupilId in memory
  // This allows instant lookups without additional queries
  static groupPaymentsByPupil(payments: PaymentRecord[]): Map<string, PaymentRecord[]> {
    const grouped = new Map<string, PaymentRecord[]>();
    
    for (const payment of payments) {
      const pupilPayments = grouped.get(payment.pupilId) || [];
      pupilPayments.push(payment);
      grouped.set(payment.pupilId, pupilPayments);
    }
    
    console.log(`📊 GROUPING: Grouped ${payments.length} payments for ${grouped.size} pupils`);
    return grouped;
  }

}
