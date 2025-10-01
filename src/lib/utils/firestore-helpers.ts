import { doc, getDoc, getDocs, collection, query, QueryConstraint, DocumentReference, CollectionReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Timeout wrapper for Firestore operations
export async function getDocWithTimeout<T>(
  docRef: DocumentReference,
  timeoutMs: number = 15000 // 15 seconds default
): Promise<T | null> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Firestore operation timed out')), timeoutMs);
    });

    const docPromise = getDoc(docRef);
    
    const docSnap = await Promise.race([docPromise, timeoutPromise]);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  } catch (error: any) {
    if (error.message === 'Firestore operation timed out') {
      console.warn(`Document fetch timed out for ${docRef.path}, returning null`);
      return null;
    }
    
    // For offline errors, return null instead of throwing
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
      console.warn(`Firestore offline, cannot fetch ${docRef.path}`);
      return null;
    }
    
    throw error; // Re-throw other errors
  }
}

// Robust collection fetch with timeout
export async function getDocsWithTimeout<T>(
  collectionRef: CollectionReference | ReturnType<typeof query>,
  timeoutMs: number = 15000
): Promise<T[]> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Firestore operation timed out')), timeoutMs);
    });

    const docsPromise = getDocs(collectionRef);
    
    const querySnapshot = await Promise.race([docsPromise, timeoutPromise]);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        ...data
      } as T;
    });
  } catch (error: any) {
    if (error.message === 'Firestore operation timed out') {
      console.warn(`Collection fetch timed out, returning empty array`);
      return [];
    }
    
    // For offline errors, return empty array instead of throwing
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
      console.warn(`Firestore offline, cannot fetch collection`);
      return [];
    }
    
    throw error; // Re-throw other errors
  }
}

// Helper to check if Firestore is likely offline
export function isFirestoreOfflineError(error: any): boolean {
  return error?.code === 'unavailable' || 
         error?.message?.includes('offline') ||
         error?.message?.includes('Failed to get document because the client is offline');
} 