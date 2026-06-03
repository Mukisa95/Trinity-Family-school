/**
 * Utility functions for handling Firebase errors consistently across the application
 */

export interface FirebaseErrorHandlerOptions {
  maxRetries?: number;
  retryDelay?: (attemptIndex: number) => number;
  skipRetryFor?: string[];
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean;
  refetchOnReconnect?: boolean;
}

/**
 * Default retry configuration for Firebase errors
 */
export const DEFAULT_FIREBASE_ERROR_OPTIONS: FirebaseErrorHandlerOptions = {
  maxRetries: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
  skipRetryFor: [
    'offline',
    'Target ID already exists',
    'unavailable',
    'Could not reach Cloud Firestore',
    'Failed to obtain primary lease',
    'Release target',
    'Apply remote event',
    'failed-precondition',
    'unimplemented'
  ],
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: true,
};

/**
 * Determines if an error should trigger a retry based on Firebase error patterns
 */
export function shouldRetryFirebaseError(
  error: any, 
  options: FirebaseErrorHandlerOptions = DEFAULT_FIREBASE_ERROR_OPTIONS
): boolean {
  const { skipRetryFor = [], maxRetries = 2 } = options;
  
  // Check if error message contains any of the skip patterns
  const errorMessage = error?.message || '';
  const errorCode = error?.code || '';
  
  for (const pattern of skipRetryFor) {
    if (errorMessage.includes(pattern) || errorCode === pattern) {
      return false;
    }
  }
  
  return true;
}

/**
 * Creates a retry function for React Query hooks
 */
export function createFirebaseRetryFunction(
  options: FirebaseErrorHandlerOptions = DEFAULT_FIREBASE_ERROR_OPTIONS
) {
  return (failureCount: number, error: any): boolean => {
    if (!shouldRetryFirebaseError(error, options)) {
      return false;
    }
    
    return failureCount < (options.maxRetries || 2);
  };
}

/**
 * Creates retry delay function for React Query hooks
 */
export function createFirebaseRetryDelayFunction(
  options: FirebaseErrorHandlerOptions = DEFAULT_FIREBASE_ERROR_OPTIONS
) {
  return options.retryDelay || DEFAULT_FIREBASE_ERROR_OPTIONS.retryDelay!;
}

/**
 * Logs Firebase errors with appropriate level based on error type
 */
export function logFirebaseError(error: any, context: string = 'Firebase operation') {
  const errorMessage = error?.message || 'Unknown error';
  const errorCode = error?.code || 'unknown';
  
  // Log "Target ID already exists" as info since it's expected behavior
  if (errorMessage.includes('Target ID already exists')) {
    console.log(`ℹ️ ${context}: ${errorMessage}`);
    return;
  }
  
  // Log offline errors as warnings
  if (errorMessage.includes('offline') || errorMessage.includes('Could not reach Cloud Firestore')) {
    console.warn(`⚠️ ${context}: ${errorMessage}`);
    return;
  }
  
  // Log other errors as errors
  console.error(`❌ ${context}:`, error);
}

/**
 * Standard React Query configuration for Firebase hooks
 */
export function getFirebaseQueryConfig(options: Partial<FirebaseErrorHandlerOptions> = {}) {
  const config = { ...DEFAULT_FIREBASE_ERROR_OPTIONS, ...options };
  
  return {
    retry: createFirebaseRetryFunction(config),
    retryDelay: createFirebaseRetryDelayFunction(config),
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    refetchOnWindowFocus: config.refetchOnWindowFocus,
    refetchOnMount: config.refetchOnMount,
    refetchOnReconnect: config.refetchOnReconnect,
  };
}
