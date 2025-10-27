import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  orderBy, 
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import type { PaymentRecord } from '@/types';

const PAYMENTS_COLLECTION = 'payments';

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
  // Payment Records
  static async createPayment(paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>): Promise<string> {
    try {
      const newPayment = {
        ...paymentData,
        createdAt: Timestamp.now(),
        paymentDate: paymentData.paymentDate || new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = cleanUndefinedValues(newPayment);
      
      const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), cleanedData);
      return docRef.id;
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
      const q = query(
        collection(db, PAYMENTS_COLLECTION), 
        where('pupilId', '==', pupilId),
        where('academicYearId', '==', academicYearId),
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
      console.error('Error fetching payments by pupil and year:', error);
      throw error;
    }
  }

  static async revertPayment(paymentId: string, revertedBy: { id: string; name: string; role: string }): Promise<void> {
    try {
      const docRef = doc(db, PAYMENTS_COLLECTION, paymentId);
      const updateData = {
        reverted: true,
        revertedAt: new Date().toISOString(),
        revertedBy
      };
      
      const cleanedData = cleanUndefinedValues(updateData);
      await updateDoc(docRef, cleanedData);
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