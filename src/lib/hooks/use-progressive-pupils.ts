import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePupils } from './use-pupils';
import type { Pupil } from '@/types';

interface ProgressivePupilsState {
  pupils: Pupil[];
  isProcessing: boolean;
  currentBatch: number;
  totalBatches: number;
  processedCount: number;
  totalCount: number;
  error: string | null;
  isComplete: boolean;
}

interface UseProgressivePupilsOptions {
  batchSize?: number;
  enabled?: boolean;
}

export function useProgressivePupils({
  batchSize = 100,
  enabled = true
}: UseProgressivePupilsOptions = {}) {
  const [state, setState] = useState<ProgressivePupilsState>({
    pupils: [],
    isProcessing: false,
    currentBatch: 0,
    totalBatches: 0,
    processedCount: 0,
    totalCount: 0,
    error: null,
    isComplete: false
  });

  // Add refs to prevent race conditions and memory leaks
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch all pupils initially to get the total count and basic data
  const pupilsQuery = usePupils();
  const allPupils = enabled ? pupilsQuery.data ?? [] : [];
  const isLoadingPupils = enabled && pupilsQuery.isLoading;

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (state.totalCount === 0) return 0;
    return Math.round((state.processedCount / state.totalCount) * 100);
  }, [state.processedCount, state.totalCount]);

  // Process pupils in batches with cancellation support
  const processPupilsBatch = useCallback(async (pupils: Pupil[], batchIndex: number, batchSize: number, signal?: AbortSignal) => {
    if (signal?.aborted) {
      throw new Error('Cancelled');
    }

    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, pupils.length);
    const batch = pupils.slice(startIndex, endIndex);

    // For pupils, we don't need complex processing like fees
    // Just return the batch as-is since all data is already loaded
    // Add a small delay to simulate progressive loading
    await new Promise(resolve => {
      const timeoutId = setTimeout(resolve, 100);
      signal?.addEventListener('abort', () => clearTimeout(timeoutId));
    });

    if (signal?.aborted) {
      throw new Error('Cancelled');
    }

    return batch;
  }, []);

  // Start processing pupils with proper cleanup
  const startProcessing = useCallback(async () => {
    if (!allPupils.length || processingRef.current || !mountedRef.current) {
      return;
    }

    // Cancel any existing processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    processingRef.current = true;

    console.log('🚀 Starting progressive pupils processing...');

    const totalBatches = Math.ceil(allPupils.length / batchSize);

    if (!mountedRef.current) return;

    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentBatch: 0,
      totalBatches,
      processedCount: 0,
      totalCount: allPupils.length,
      error: null,
      isComplete: false,
      pupils: [] // Reset pupils array to prevent duplicates
    }));

    try {
      const allProcessedPupils: Pupil[] = [];

      // Process batches sequentially to show progressive loading
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        if (signal.aborted || !mountedRef.current) {
          console.log('🚫 Pupils processing cancelled');
          return;
        }

        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            currentBatch: batchIndex + 1
          }));
        }

        const batchPupils = await processPupilsBatch(allPupils, batchIndex, batchSize, signal);
        
        if (signal.aborted || !mountedRef.current) return;
        
        allProcessedPupils.push(...batchPupils);

        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            pupils: [...allProcessedPupils], // Use the accumulated array
            processedCount: allProcessedPupils.length
          }));
        }

        // Add a small delay to show progressive loading effect
        if (batchIndex < totalBatches - 1 && !signal.aborted && mountedRef.current) {
          await new Promise(resolve => {
            const timeoutId = setTimeout(resolve, 150);
            signal.addEventListener('abort', () => clearTimeout(timeoutId));
          });
        }
      }

      if (mountedRef.current && !signal.aborted) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          isComplete: true
        }));
        console.log('✅ Progressive pupils processing completed successfully');
      }

    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.message === 'Cancelled')) {
        console.log('🚫 Pupils processing was cancelled');
        return;
      }
      
      console.error('❌ Error processing pupils:', error);
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: error instanceof Error ? error.message : 'Failed to process pupils',
          isComplete: false
        }));
      }
    } finally {
      processingRef.current = false;
      if (abortControllerRef.current === abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [allPupils, batchSize, processPupilsBatch]);

  // Auto-start processing when data is ready - prevent infinite loops
  useEffect(() => {
    if (!isLoadingPupils && allPupils.length > 0 && mountedRef.current && !processingRef.current) {
      const timeoutId = setTimeout(() => {
        if (mountedRef.current && !processingRef.current) {
          startProcessing();
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isLoadingPupils, allPupils.length]); // Stable dependencies only

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      processingRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  return {
    pupils: state.pupils,
    isProcessing: state.isProcessing,
    currentBatch: state.currentBatch,
    totalBatches: state.totalBatches,
    processedCount: state.processedCount,
    totalCount: state.totalCount,
    progressPercentage,
    error: state.error,
    isComplete: state.isComplete,
    isLoading: isLoadingPupils,
    restart: startProcessing
  };
}
