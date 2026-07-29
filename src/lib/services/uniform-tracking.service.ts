import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  where,
  runTransaction,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import type { UniformTracking, CreateUniformTrackingData, UpdateUniformTrackingData } from '@/types';

const COLLECTION_NAME = 'uniformTracking';
const UNIFORM_INVENTORY_COLLECTION = 'uniformInventory';

export interface UniformStockReduction {
  uniformId: string;
  size: string;
  quantity?: number;
}

export class UniformTrackingService {
  static async getTrackingRecordsByPupil(pupilId: string): Promise<UniformTracking[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('pupilId', '==', pupilId)
      );
      const querySnapshot = await getDocs(q);
      
      const records = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Handle backward compatibility for records without academicYearId/termId
          academicYearId: data.academicYearId || 'legacy-record',
          termId: data.termId || 'legacy-record',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        };
      }) as UniformTracking[];

      // Sort by createdAt on client side to avoid composite index
      return records.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // desc order
      });
    } catch (error) {
      console.error('Error fetching uniform tracking records:', error);
      throw error;
    }
  }

  static async getTrackingRecordById(id: string): Promise<UniformTracking | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          // Handle backward compatibility for records without academicYearId/termId
          academicYearId: data.academicYearId || 'legacy-record',
          termId: data.termId || 'legacy-record',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        } as UniformTracking;
      }
      return null;
    } catch (error) {
      console.error('Error fetching uniform tracking record:', error);
      throw error;
    }
  }

  static async createTrackingRecord(trackingData: CreateUniformTrackingData): Promise<string> {
    try {
      const newRecord = {
        ...trackingData,
        createdAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newRecord);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating uniform tracking record:', error);
      throw error;
    }
  }

  static async updateTrackingRecord(id: string, trackingData: UpdateUniformTrackingData): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...trackingData,
        updatedAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating uniform tracking record:', error);
      throw error;
    }
  }

  /**
   * Atomically records a uniform collection and reduces its inventory.
   * This prevents a collection record and its stock changes from diverging.
   */
  static async updateTrackingRecordWithStock(
    id: string,
    trackingData: UpdateUniformTrackingData,
    stockReductions: UniformStockReduction[]
  ): Promise<UniformTracking> {
    try {
      const trackingRef = doc(db, COLLECTION_NAME, id);
      const reductionsByUniform = new Map<string, Map<string, number>>();

      stockReductions.forEach(({ uniformId, size, quantity = 1 }) => {
        if (!uniformId || !size || !Number.isInteger(quantity) || quantity <= 0) {
          throw new Error('Invalid uniform stock reduction.');
        }

        const sizeReductions = reductionsByUniform.get(uniformId) || new Map<string, number>();
        sizeReductions.set(size, (sizeReductions.get(size) || 0) + quantity);
        reductionsByUniform.set(uniformId, sizeReductions);
      });

      const inventoryRefs = Array.from(reductionsByUniform.keys()).map(uniformId => ({
        uniformId,
        ref: doc(db, UNIFORM_INVENTORY_COLLECTION, uniformId),
      }));

      return await runTransaction(db, async transaction => {
        // Firestore transactions require every read to happen before any write.
        const [trackingSnapshot, inventorySnapshots] = await Promise.all([
          transaction.get(trackingRef),
          Promise.all(inventoryRefs.map(({ ref }) => transaction.get(ref))),
        ]);

        if (!trackingSnapshot.exists()) {
          throw new Error(`Uniform tracking record not found: ${id}`);
        }

        const timestamp = Timestamp.now();

        inventorySnapshots.forEach((inventorySnapshot, index) => {
          const { uniformId, ref } = inventoryRefs[index];

          // Some uniforms do not use inventory tracking. Preserve that supported flow.
          if (!inventorySnapshot.exists()) {
            console.warn(`Uniform inventory item not found: ${uniformId}`);
            return;
          }

          const inventoryData = inventorySnapshot.data();
          const sizeReductions = reductionsByUniform.get(uniformId)!;
          const stock = Array.isArray(inventoryData.stock) ? inventoryData.stock : [];
          const knownSizes = new Set(stock.map(item => item.size));

          sizeReductions.forEach((quantity, size) => {
            if (!knownSizes.has(size)) {
              throw new Error(`Uniform inventory size "${size}" was not found for ${uniformId}.`);
            }

            const currentQuantity =
              stock.find(item => item.size === size)?.quantity || 0;
            if (currentQuantity < quantity) {
              throw new Error(
                `Insufficient stock for ${uniformId}, size ${size}. Available: ${currentQuantity}.`
              );
            }
          });

          const updatedStock = stock.map(item => {
            const reduction = sizeReductions.get(item.size) || 0;
            return reduction > 0
              ? { ...item, quantity: item.quantity - reduction }
              : item;
          });
          const totalStock = updatedStock.reduce(
            (sum, item) => sum + (Number(item.quantity) || 0),
            0
          );
          const uniformPrice = Number(inventoryData.uniformPrice) || 0;

          transaction.update(ref, {
            stock: updatedStock,
            totalStock,
            totalValue: totalStock * uniformPrice,
            updatedAt: timestamp,
          });
        });

        const updateData = this.cleanUndefinedValues({
          ...trackingData,
          updatedAt: timestamp,
        });
        transaction.update(trackingRef, updateData);

        const updatedData = {
          ...trackingSnapshot.data(),
          ...updateData,
        };

        return {
          id,
          ...updatedData,
          academicYearId: updatedData.academicYearId || 'legacy-record',
          termId: updatedData.termId || 'legacy-record',
          createdAt:
            updatedData.createdAt?.toDate?.()?.toISOString() || updatedData.createdAt,
          updatedAt:
            updatedData.updatedAt?.toDate?.()?.toISOString() || updatedData.updatedAt,
        } as UniformTracking;
      });
    } catch (error) {
      console.error('Error atomically updating uniform collection and stock:', error);
      throw error;
    }
  }

  static async deleteTrackingRecord(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting uniform tracking record:', error);
      throw error;
    }
  }

  static async getAllTrackingRecords(): Promise<UniformTracking[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      
      const records = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Handle backward compatibility for records without academicYearId/termId
          academicYearId: data.academicYearId || 'legacy-record',
          termId: data.termId || 'legacy-record',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        };
      }) as UniformTracking[];

      // Sort by createdAt on client side to avoid composite index
      return records.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // desc order
      });
    } catch (error) {
      console.error('Error fetching all uniform tracking records:', error);
      throw error;
    }
  }

  static async getTrackingRecordsByUniform(uniformId: string): Promise<UniformTracking[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('uniformId', '==', uniformId)
      );
      const querySnapshot = await getDocs(q);
      
      const records = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Handle backward compatibility for records without academicYearId/termId
          academicYearId: data.academicYearId || 'legacy-record',
          termId: data.termId || 'legacy-record',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        };
      }) as UniformTracking[];

      // Sort by createdAt on client side to avoid composite index
      return records.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // desc order
      });
    } catch (error) {
      console.error('Error fetching uniform tracking records by uniform:', error);
      throw error;
    }
  }

  // Utility function to recursively clean undefined values from objects
  private static cleanUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }
}
