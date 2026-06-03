import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    query,
    orderBy,
    limit,
    updateDoc,
    deleteDoc,
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PromotionBatch, PromotionBatchType } from '@/types';

const COLLECTION_NAME = 'promotionBatches';

export interface CreatePromotionBatchData {
    type: PromotionBatchType;
    fromClassId: string;
    fromClassName: string;
    toClassId?: string;
    toClassName?: string;
    pupilIds: string[];
    processedBy?: string;
    academicYearId?: string;
    graduationYear?: number;
    notes?: string;
}

/**
 * Create a new promotion batch record
 */
export async function createPromotionBatch(data: CreatePromotionBatchData): Promise<string> {
    try {
        const batchData: any = {
            type: data.type,
            date: new Date().toISOString(),
            fromClassId: data.fromClassId,
            fromClassName: data.fromClassName,
            pupilIds: data.pupilIds,
            pupilCount: data.pupilIds.length,
            processedBy: data.processedBy || 'System Admin',
            createdAt: new Date().toISOString(),
        };

        // Only include optional fields if they have values (Firestore doesn't allow undefined)
        if (data.toClassId) batchData.toClassId = data.toClassId;
        if (data.toClassName) batchData.toClassName = data.toClassName;
        if (data.academicYearId) batchData.academicYearId = data.academicYearId;
        if (data.graduationYear) batchData.graduationYear = data.graduationYear;
        if (data.notes) batchData.notes = data.notes;

        const docRef = await addDoc(collection(db, COLLECTION_NAME), batchData);
        return docRef.id;
    } catch (error) {
        console.error('Error creating promotion batch:', error);
        throw error;
    }
}

/**
 * Get all promotion batches, ordered by date (most recent first)
 */
export async function getPromotionBatches(limitCount: number = 10): Promise<PromotionBatch[]> {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as PromotionBatch[];
    } catch (error) {
        console.error('Error fetching promotion batches:', error);
        throw error;
    }
}

/**
 * Get a specific promotion batch by ID
 */
export async function getPromotionBatchById(batchId: string): Promise<PromotionBatch | null> {
    try {
        const docRef = doc(db, COLLECTION_NAME, batchId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data(),
            } as PromotionBatch;
        }

        return null;
    } catch (error) {
        console.error('Error fetching promotion batch:', error);
        throw error;
    }
}

/**
 * Remove a pupil from a promotion batch
 * If the batch becomes empty, it will be deleted
 */
export async function removePupilFromBatch(batchId: string, pupilId: string): Promise<boolean> {
    try {
        const docRef = doc(db, COLLECTION_NAME, batchId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Batch not found');
        }

        const batch = docSnap.data() as PromotionBatch;
        const updatedPupilIds = batch.pupilIds.filter(id => id !== pupilId);

        // If no pupils left, delete the batch
        if (updatedPupilIds.length === 0) {
            await deleteDoc(docRef);
            console.log('Batch deleted - no pupils remaining');
            return true; // Batch was deleted
        }

        // Otherwise, update the batch
        await updateDoc(docRef, {
            pupilIds: updatedPupilIds,
            pupilCount: updatedPupilIds.length,
        });

        console.log('Pupil removed from batch, remaining pupils:', updatedPupilIds.length);
        return false; // Batch still exists
    } catch (error) {
        console.error('Error removing pupil from batch:', error);
        throw error;
    }
}

/**
 * Delete a promotion batch
 */
export async function deletePromotionBatch(batchId: string): Promise<void> {
    try {
        const docRef = doc(db, COLLECTION_NAME, batchId);
        await deleteDoc(docRef);
        console.log('Batch deleted successfully');
    } catch (error) {
        console.error('Error deleting promotion batch:', error);
        throw error;
    }
}
