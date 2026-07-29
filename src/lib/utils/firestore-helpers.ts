import { doc, getDoc, getDocs, collection, query, QueryConstraint, DocumentReference, CollectionReference, getDocFromCache, getDocFromServer, getDocsFromCache, getDocsFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Optimized document fetch with cache-first strategy
 * Uses Firestore's built-in cache-first behavior via getDoc()
 * 
 * NOTE: We don't add our own timeout because Firestore already handles:
 * - Automatic caching (instant reads from cache)
 * - Built-in timeout handling (10 seconds default)
 * - Offline mode support
 * Adding our own timeout interferes with Firestore's optimizations
 */
export async function getDocWithTimeout<T>(
  docRef: DocumentReference,
  timeoutMs?: number // Deprecated - kept for API compatibility but not used
): Promise<T | null> {
  try {
    // Firestore's getDoc() automatically:
    // 1. Uses cache if available (instant)
    // 2. Fetches from server if cache miss
    // 3. Handles its own timeouts (10 seconds default)
    // 4. Works offline if data is cached
    
    // Just use getDoc directly - it's already optimized!
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  } catch (error: any) {
    // Log the error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('getDocWithTimeout error:', {
        message: error.message,
        code: error.code,
        path: docRef.path
      });
    }
    
    // For offline errors, return null instead of throwing
    if (error.code === 'unavailable' || 
        error.message?.includes('offline') ||
        error.message?.includes('Failed to get document') ||
        error.message?.includes('Could not reach Cloud Firestore backend')) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Firestore offline or unavailable for ${docRef.path}`);
      }
      return null;
    }
    
    // Re-throw other errors so they can be handled by the caller
    throw error;
  }
}

/**
 * Helper to detect network-related errors that should trigger retries
 */
function isNetworkError(error: any): boolean {
  const errorMessage = error?.message || '';
  const errorCode = error?.code || '';
  const errorName = error?.name || '';
  
  // Check for QUIC protocol errors (browser-level network errors)
  if (errorMessage.includes('QUIC') || 
      errorMessage.includes('ERR_QUIC') ||
      errorMessage.includes('ERR_NETWORK_IO_SUSPENDED') ||
      errorMessage.includes('network') && errorMessage.includes('failed')) {
    return true;
  }
  
  // Check for Firestore network errors
  if (errorCode === 'unavailable' || 
      errorCode === 'deadline-exceeded' ||
      errorMessage.includes('Could not reach Cloud Firestore') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('temporarily unavailable')) {
    return true;
  }
  
  return false;
}

/**
 * Optimized collection fetch with cache-first strategy and timeout protection
 * Uses Firestore's built-in cache-first behavior via getDocs()
 * Adds timeout protection to prevent hanging queries
 * Includes retry logic for network errors
 * 
 * NOTE: If queries consistently timeout, real-time listeners (onSnapshot) will
 * populate Firestore's cache and React Query's cache, which will be used by hooks.
 * Services calling this directly may return empty arrays on timeout, but hooks
 * will use cached data from real-time listeners.
 */
export async function getDocsWithTimeout<T>(
  collectionRef: CollectionReference | ReturnType<typeof query>,
  timeoutMs: number = 30000, // Default 30 seconds timeout
  retryCount: number = 0 // Internal retry counter
): Promise<T[]> {
  const actualTimeout = timeoutMs;
  
  // Get collection path for better error logging
  let collectionPath = 'unknown';
  try {
    if ('path' in collectionRef) {
      collectionPath = collectionRef.path;
    } else if ((collectionRef as any)?._query?.path) {
      const path = (collectionRef as any)._query.path;
      collectionPath = path.segments ? path.segments.join('/') : path.toString();
    } else if ((collectionRef as any)?._delegate?._query?.path) {
      const path = (collectionRef as any)._delegate._query.path;
      collectionPath = path.segments ? path.segments.join('/') : path.toString();
    }
  } catch {
    // Ignore errors in path extraction
  }
  
  // Determine if this is a critical collection that should have longer timeouts
  const isCriticalCollection = collectionPath.includes('pupils') || 
                                collectionPath.includes('users') || 
                                collectionPath.includes('accessLevels');
  
  // For critical collections on first attempt, use longer timeout
  const effectiveTimeout = (isCriticalCollection && retryCount === 0) 
    ? Math.max(actualTimeout, 60000) // At least 60s for critical collections
    : actualTimeout;
  
  try {
    // 🚀 CRITICAL: Try cache first for instant reads (with shorter timeout)
    // Cache should be nearly instant - if it takes longer, skip it
    try {
      const cacheTimeout = 500; // 500ms max for cache check (reduced from 1s)
      const cacheCheckPromise = getDocsFromCache(collectionRef);
      const cacheTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Cache check timeout')), cacheTimeout);
      });
      
      const cachedSnapshot = await Promise.race([cacheCheckPromise, cacheTimeoutPromise]);
      
      if (cachedSnapshot && cachedSnapshot.docs.length > 0) {
        const cachedResults = cachedSnapshot.docs.map(doc => {
          try {
            const data = doc.data() as Record<string, any>;
            return {
              id: doc.id,
              ...data
            } as T;
          } catch (mapError) {
            return null;
          }
        }).filter((item): item is T => item !== null);
        
        if (cachedResults.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`⚡ getDocsWithTimeout: Loaded ${cachedResults.length} documents from cache (instant)`);
          }
          // Return cached data immediately, but also fetch fresh data in background
          getDocs(collectionRef).catch(() => {
            // Silently fail background refresh - we already have cached data
          });
          return cachedResults;
        }
      }
    } catch (cacheError: any) {
      // Cache miss, error, or timeout - continue to server fetch
      // Don't log cache timeout errors as they're expected when cache is slow or empty
      if (process.env.NODE_ENV === 'development' && !cacheError.message?.includes('timeout')) {
        console.log('📭 Cache miss, fetching from server...');
      }
    }
    
    // 🚀 TIMEOUT PROTECTION: Use Promise.race to enforce timeout
    if (process.env.NODE_ENV === 'development') {
      console.log(`⏱️ Fetching ${collectionPath} from server with ${effectiveTimeout/1000}s timeout${retryCount > 0 ? ` (retry ${retryCount})` : ''}...`);
    }
    
    let timeoutId: NodeJS.Timeout | null = null;
    let fetchPromise: Promise<any>;
    
    // Wrap getDocs to catch network errors that might not be caught by Firestore
    try {
      fetchPromise = getDocs(collectionRef);
    } catch (setupError: any) {
      // If getDocs fails immediately (network error), handle it
      if (isNetworkError(setupError)) {
        throw setupError;
      }
      throw setupError;
    }
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Query timed out after ${effectiveTimeout}ms`));
      }, effectiveTimeout);
    });
    
    try {
      const querySnapshot = await Promise.race([fetchPromise, timeoutPromise]);
      
      // Clear timeout if fetch completed successfully
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    
      // Check if we got results
      if (!querySnapshot || !querySnapshot.docs) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('getDocsWithTimeout: querySnapshot is invalid');
        }
        return [];
      }
      
      // Map the documents to the expected format
      const results = querySnapshot.docs.map((doc: any) => {
        try {
          const data = doc.data() as Record<string, any>;
          return {
            id: doc.id,
            ...data
          } as T;
        } catch (mapError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error mapping document:', mapError, doc.id);
          }
          return null;
        }
      }).filter((item: T | null): item is T => item !== null);

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ getDocsWithTimeout: Fetched ${results.length} documents from server`);
      }

      return results;
    } catch (raceError: any) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Re-throw to be caught by outer catch block
      throw raceError;
    }
    } catch (error: any) {
      // Check if this is a network error that should trigger a retry
      const isNetworkErr = isNetworkError(error);
      const isTimeoutError = error.message?.includes('timed out') || 
                            error.message?.includes('temporarily unavailable') ||
                            error.code === 'deadline-exceeded';
      
      // 🚀 RETRY LOGIC: Retry network errors with exponential backoff
      const maxRetries = isCriticalCollection ? 2 : 1; // More retries for critical collections
      if (isNetworkErr && retryCount < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Max 5s delay
        
        if (process.env.NODE_ENV === 'development') {
          console.warn(`🔄 Network error detected for ${collectionPath}, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries + 1})...`, {
            error: error.message || error.code,
            collectionPath
          });
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Retry with increased timeout for critical collections
        const retryTimeout = isCriticalCollection ? effectiveTimeout * 1.5 : effectiveTimeout;
        return getDocsWithTimeout<T>(collectionRef, retryTimeout, retryCount + 1);
      }
      
      // Only log non-timeout errors as errors
      if (process.env.NODE_ENV === 'development' && !isTimeoutError && !isNetworkErr) {
        console.error(`getDocsWithTimeout error for ${collectionPath}:`, {
          message: error.message,
          code: error.code,
          name: error.name,
          stack: error.stack,
          collectionPath,
          timeoutMs: effectiveTimeout
        });
        // Also log the full error object for inspection
        console.error('Full error object:', error);
      }
    
    // For timeout errors, try to return cached data as fallback (with longer timeout for cache)
    if (isTimeoutError || isNetworkErr) {
      // Suppress timeout warnings - they're expected when network is slow
      // Real-time listeners populate React Query cache which hooks use
      // Services returning empty arrays here is fine since hooks are the primary data source
      
      try {
        // Try cache with longer timeout when network is slow (especially for critical collections)
        // Real-time listeners populate Firestore's cache, but getDocsFromCache can be slow
        // When network is having issues, cache might be our only source of data
        const cacheTimeout = (isNetworkErr && isCriticalCollection) ? 3000 : 2000; // 3s for critical on network error, 2s otherwise
        const cacheCheckPromise = getDocsFromCache(collectionRef).catch((err) => {
          // If getDocsFromCache throws an error, treat it as cache miss
          throw new Error('Cache access error');
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Cache check timeout')), cacheTimeout);
        });
        
        const cachedSnapshot = await Promise.race([cacheCheckPromise, timeoutPromise]);
        
        if (cachedSnapshot && cachedSnapshot.docs && cachedSnapshot.docs.length > 0) {
          const cachedResults = cachedSnapshot.docs.map(doc => {
            try {
              const data = doc.data() as Record<string, any>;
              return {
                id: doc.id,
                ...data
              } as T;
            } catch (mapError) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Error mapping cached document:', mapError, doc.id);
              }
              return null;
            }
          }).filter((item): item is T => item !== null);
          
          if (cachedResults.length > 0) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`✅ Query timed out, but returning ${cachedResults.length} cached documents from Firestore cache`);
            }
            return cachedResults;
          }
        }
        
        // Cache is empty or invalid - this is expected when network is slow
        // Real-time listeners will populate React Query cache which hooks use
      } catch (cacheError: any) {
        // Cache check failed, timed out, or threw an error - this is expected and not a problem
        // Real-time listeners will populate React Query cache, which will be used by hooks
        if (process.env.NODE_ENV === 'development') {
          // Only log if it's not a timeout (timeouts are expected)
          if (!cacheError.message?.includes('timeout') && !cacheError.message?.includes('Cache access error')) {
            console.warn(`⚠️ Cache check failed:`, cacheError.message || cacheError);
          }
        }
      }
      
      // No cache available, return empty array instead of throwing to prevent app crash
      // React Query will retry automatically, and real-time listeners will populate cache
      // NOTE: This is expected behavior when network is slow - real-time listeners will populate React Query cache
      // which hooks will use. Services returning empty arrays here is fine since hooks are the primary data source.
      if (process.env.NODE_ENV === 'development') {
        // Log for critical collections or when network errors occur
        if (isCriticalCollection || isNetworkErr) {
          console.warn(`⚠️ Query for ${collectionPath} ${isNetworkErr ? 'failed due to network error' : 'timed out'} after ${effectiveTimeout}ms - returning empty array`);
          console.warn(`💡 Note: Real-time listeners may populate cache shortly. React Query will retry.`);
        }
        // For other collections, timeout is expected when network is slow - real-time listeners handle it
      }
      return [];
    }
    
    // For offline errors, try cache first before returning empty
    if (error.code === 'unavailable' || 
        error.code === 'failed-precondition' ||
        error.message?.includes('offline') ||
        error.message?.includes('Failed to get document') ||
        error.message?.includes('Could not reach Cloud Firestore backend')) {
      
      // Try to get data from cache when offline
      try {
        const cacheTimeout = isCriticalCollection ? 3000 : 2000;
        const cacheCheckPromise = getDocsFromCache(collectionRef);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Cache check timeout')), cacheTimeout);
        });
        
        const cachedSnapshot = await Promise.race([cacheCheckPromise, timeoutPromise]);
        
        if (cachedSnapshot && cachedSnapshot.docs && cachedSnapshot.docs.length > 0) {
          const cachedResults = cachedSnapshot.docs.map(doc => {
            try {
              const data = doc.data() as Record<string, any>;
              return {
                id: doc.id,
                ...data
              } as T;
            } catch (mapError) {
              return null;
            }
          }).filter((item): item is T => item !== null);
          
          if (cachedResults.length > 0) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`✅ Firestore offline, but returning ${cachedResults.length} cached documents from ${collectionPath}`);
            }
            return cachedResults;
          }
        }
      } catch (cacheError) {
        // Cache check failed, continue to return empty
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Firestore offline or unavailable for ${collectionPath}:`, error.message);
      }
      return [];
    }
    
    // For index errors, return empty array
    if (error.message?.includes('The query requires an index')) {
      console.error('Missing Firestore index! Check Firebase Console for index creation link.');
      return [];
    }
    
    // For other errors, log and re-throw so caller can handle
    console.error('Unexpected error in getDocsWithTimeout:', error);
    throw error;
  }
}

/**
 * Authoritative collection read for revision reconciliation.
 *
 * Unlike getDocsWithTimeout, this never converts a connectivity failure into
 * an empty collection. Cache owners must only stamp the current revision after
 * the server has confirmed the snapshot; otherwise a temporary outage can be
 * persisted as valid empty data for months.
 */
export async function getDocsFromServerWithTimeout<T>(
  collectionRef: CollectionReference | ReturnType<typeof query>,
  timeoutMs: number = 30000,
): Promise<T[]> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const snapshot = await Promise.race([
      getDocsFromServer(collectionRef),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`Authoritative query timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);

    return snapshot.docs.map(snapshotDoc => ({
      id: snapshotDoc.id,
      ...(snapshotDoc.data() as Record<string, unknown>),
    } as T));
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Helper to check if Firestore is likely offline
export function isFirestoreOfflineError(error: any): boolean {
  return error?.code === 'unavailable' || 
         error?.message?.includes('offline') ||
         error?.message?.includes('Failed to get document because the client is offline');
} 
