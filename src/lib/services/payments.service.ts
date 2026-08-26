import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  orderBy, 
  where,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { PaymentRecord } from '@/types';
import { HistoryLogService } from './history-log.service';

const PAYMENTS_COLLECTION = 'payments';

export interface PaymentHistoryContext {
  feeName?: string;
  pupilName?: string;
  paymentMethod?: string;
  source?: string;
  paidByName?: string;
}

// Utility function to remove undefined values from objects
function cleanUndefinedValues(obj: any): any {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        cleaned[key] = cleanUndefinedValues(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

export class PaymentsService {
  private static paymentsByYearCache = new Map<string, PaymentRecord[]>();
  private static paymentsByYearInFlight = new Map<string, Promise<PaymentRecord[]>>();

  private static clearYearPaymentsCache(academicYearId?: string) {
    if (!academicYearId) {
      this.paymentsByYearCache.clear();
      this.paymentsByYearInFlight.clear();
      return;
    }

    this.paymentsByYearCache.delete(academicYearId);
    this.paymentsByYearInFlight.delete(academicYearId);
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

  // Payment Records
  static async createPayment(
    paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>,
    options?: {
      skipHistoryLog?: boolean;
      historyContext?: PaymentHistoryContext;
    }
  ): Promise<string> {
    try {
      const newPayment = {
        ...paymentData,
        createdAt: Timestamp.now(),
        paymentDate: paymentData.paymentDate || new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = cleanUndefinedValues(newPayment);
      
      const docRef = doc(collection(db, PAYMENTS_COLLECTION));
      const batch = writeBatch(db);
      batch.set(docRef, cleanedData);
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
      
      const cleanedData = cleanUndefinedValues(updateData);
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

  // 🚀 PERFORMANCE OPTIMIZATION: Batch load ALL payments for a term in ONE query
  // This eliminates N+1 query problem (100+ queries → 1 query)
  static async getAllPaymentsByTerm(academicYearId: string, termId: string): Promise<PaymentRecord[]> {
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
    }
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
