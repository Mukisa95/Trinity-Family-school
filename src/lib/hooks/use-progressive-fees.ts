import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Pupil, AcademicYear, FeeStructure, PaymentRecord } from '@/types';
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { PaymentsService } from '@/lib/services/payments.service';
import { filterApplicableFees, processPupilFees as processFeesWithDiscounts } from '@/app/fees/collect/[id]/utils/feeProcessing';
import { feeGroupCacheService, type OptimizedPupilFees } from '@/lib/services/fee-group-cache.service';

export interface PupilFeesInfo {
  totalFees: number;
  totalPaid: number;
  balance: number;
  // Removed lastPayment to speed up calculations
  applicableFees: Array<{
    feeStructureId: string;
    name: string;
    amount: number;
    paid: number;
    balance: number;
    originalAmount?: number;
    discount?: {
      id: string;
      name: string;
      amount: number;
      type: 'fixed' | 'percentage';
    };
  }>;
}

export interface ProgressiveFeesState {
  pupilFeesInfo: Record<string, PupilFeesInfo>;
  processedCount: number;
  totalCount: number;
  isProcessing: boolean;
  currentBatch: number;
  totalBatches: number;
  processingStatus: string;
  error: string | null;
  optimizationInfo?: {
    cacheHits: number;
    groupsCreated: number;
    speedupFactor: number;
    totalCalculationTime: number;
  };
}

interface UseProgressiveFeesOptions {
  pupils: Pupil[];
  selectedYear: AcademicYear | null;
  selectedTermId: string;
  academicYears: AcademicYear[];
  batchSize?: number;
  enabled?: boolean;
}

export function useProgressiveFees({
  pupils,
  selectedYear,
  selectedTermId,
  academicYears,
  batchSize = 25, // Reduced for faster processing of class-specific data
  enabled = true
}: UseProgressiveFeesOptions) {
  const [state, setState] = useState<ProgressiveFeesState>({
    pupilFeesInfo: {},
    processedCount: 0,
    totalCount: 0,
    isProcessing: false,
    currentBatch: 0,
    totalBatches: 0,
    processingStatus: 'Ready',
    error: null,
    optimizationInfo: undefined
  });

  // Add refs to prevent race conditions and memory leaks
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastProcessingParamsRef = useRef<string | null>(null);

  // Fetch fee structures once
  const { data: allFeeStructures = [], isLoading: isLoadingFeeStructures } = useQuery({
    queryKey: ['fee-structures'],
    queryFn: async () => {
      const structures = await FeeStructuresService.getAllFeeStructures();
      console.log('📚 Loaded fee structures:', structures.length);
      return structures;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Process a single pupil's fees with cancellation support
  const processSinglePupilFees = useCallback(async (
    pupil: Pupil,
    correctedFeeStructures: FeeStructure[],
    signal?: AbortSignal
  ): Promise<PupilFeesInfo> => {
    if (signal?.aborted) {
      throw new Error('Cancelled');
    }

    try {
      if (!selectedYear || !selectedTermId) {
        throw new Error('Missing year or term selection');
      }

      // Filter applicable fees
      const applicableFees = filterApplicableFees(
        correctedFeeStructures,
        pupil,
        selectedTermId,
        selectedYear,
        academicYears
      );

      if (signal?.aborted) {
        throw new Error('Cancelled');
      }

      // Get payments for this pupil with retry mechanism
      let payments: PaymentRecord[] = [];
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          payments = await PaymentsService.getPaymentsByPupil(pupil.id);
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries || signal?.aborted) {
            throw error;
          }
          // Exponential backoff: 500ms, 1s, 2s
          await new Promise(resolve => {
            const delay = 500 * Math.pow(2, retryCount - 1);
            const timeoutId = setTimeout(resolve, delay);
            signal?.addEventListener('abort', () => clearTimeout(timeoutId));
          });
        }
      }

      if (signal?.aborted) {
        throw new Error('Cancelled');
      }

      const termPayments = payments.filter((p: PaymentRecord) => 
        p.termId === selectedTermId && p.academicYearId === selectedYear.id
      );

      // Process fees with discounts
      const processedFees = processFeesWithDiscounts(
        applicableFees,
        termPayments,
        correctedFeeStructures,
        pupil,
        selectedTermId,
        selectedYear,
        academicYears
      );

      if (signal?.aborted) {
        throw new Error('Cancelled');
      }

      let totalFees = 0;
      let totalPaid = 0;
      // Removed lastPayment processing for speed optimization
      const feeDetails: PupilFeesInfo['applicableFees'] = [];

      // Calculate totals from processed fees (optimized - no lastPayment tracking)
      for (const fee of processedFees) {
        // Removed lastPayment processing to speed up calculations

        feeDetails.push({
          feeStructureId: fee.id,
          name: fee.name,
          amount: fee.amount,
          paid: fee.paid,
          balance: fee.balance,
          originalAmount: fee.originalAmount,
          discount: fee.discount
        });

        totalFees += fee.amount;
        totalPaid += fee.paid;
      }

      return {
        totalFees,
        totalPaid,
        balance: Math.max(0, totalFees - totalPaid),
        applicableFees: feeDetails
      };

    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.message === 'Cancelled')) {
        throw new Error('Cancelled');
      }
      console.error(`Error processing fees for pupil ${pupil.id}:`, error);
      return {
        totalFees: 0,
        totalPaid: 0,
        balance: 0,
        applicableFees: []
      };
    }
  }, [selectedYear, selectedTermId, academicYears]);

  // Process a batch of pupils with better error handling
  const processBatch = useCallback(async (
    batch: Pupil[],
    batchIndex: number,
    correctedFeeStructures: FeeStructure[],
    totalProcessedSoFar: number,
    signal?: AbortSignal
  ) => {
    if (signal?.aborted) {
      throw new Error('Cancelled');
    }

    const batchResults: Record<string, PupilFeesInfo> = {};
    
    // Process pupils sequentially to avoid overwhelming Firebase
    for (const pupil of batch) {
      if (signal?.aborted) {
        throw new Error('Cancelled');
      }

      try {
        const result = await processSinglePupilFees(pupil, correctedFeeStructures, signal);
        batchResults[pupil.id] = result;
              } catch (error) {
          if (signal?.aborted || (error instanceof Error && error.message === 'Cancelled')) {
            throw new Error('Cancelled');
          }
          console.error(`Error processing pupil ${pupil.id}:`, error);
        // Continue with other pupils even if one fails
        batchResults[pupil.id] = {
          totalFees: 0,
          totalPaid: 0,
          balance: 0,
          applicableFees: []
        };
      }

      // Small delay between pupils to prevent rate limiting
      if (signal?.aborted) {
        throw new Error('Cancelled');
      }
      
      await new Promise(resolve => {
        const timeoutId = setTimeout(resolve, 50);
        signal?.addEventListener('abort', () => clearTimeout(timeoutId));
      });
    }

    if (signal?.aborted) {
      throw new Error('Cancelled');
    }

    // Update state with batch results - use actual count
    const newProcessedCount = totalProcessedSoFar + batch.length;
    
    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        pupilFeesInfo: { ...prev.pupilFeesInfo, ...batchResults },
        processedCount: Math.min(newProcessedCount, prev.totalCount),
        currentBatch: batchIndex + 1,
        processingStatus: `Processed batch ${batchIndex + 1} of ${prev.totalBatches} (${batch.length} pupils)`
      }));
    }

    console.log(`✅ Completed batch ${batchIndex + 1}: ${batch.length} pupils processed (Total: ${newProcessedCount})`);
    
    return newProcessedCount;
  }, [processSinglePupilFees]);

  // OPTIMIZED: Fast batch processing using fee group caching
  const processWithOptimization = useCallback(async () => {
    if (!enabled || !selectedYear || !selectedTermId || pupils.length === 0 || allFeeStructures.length === 0) {
      return;
    }

    console.log('🚀 OPTIMIZED PROCESSING: Starting fee calculation with grouping and caching');
    const startTime = performance.now();
    
    // Create a unique key for this processing request
    const processingKey = `optimized-${selectedYear.id}-${selectedTermId}-${pupils.length}`;
    
    // Prevent multiple simultaneous processing
    if (processingRef.current || !mountedRef.current || lastProcessingParamsRef.current === processingKey) {
      console.log('⚠️ Optimized processing already in progress, skipping...');
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
    lastProcessingParamsRef.current = processingKey;

    if (!mountedRef.current) return;

    // Reset state
    setState({
      pupilFeesInfo: {},
      processedCount: 0,
      totalCount: pupils.length,
      isProcessing: true,
      currentBatch: 1,
      totalBatches: 1, // Single optimized batch
      processingStatus: 'Optimizing fee calculations with grouping...',
      error: null,
      optimizationInfo: undefined
    });

    try {
      if (signal.aborted) return;

      // Correct fee structures (same logic as before)
      setState(prev => ({ ...prev, processingStatus: 'Preparing fee structures...' }));
      
      const correctedFeeStructures = allFeeStructures.map(fee => {
        if (signal.aborted) return fee;

        if (!fee.academicYearId || fee.academicYearId !== selectedYear.id) {
          const correctedFee = {
            ...fee,
            academicYearId: selectedYear.id,
          };

          if (!fee.termId || fee.termId !== selectedTermId) {
            if (fee.termId) {
              const termNumberMatch = fee.termId.match(/^t(\d+)-/);
              if (termNumberMatch) {
                const termNumber = parseInt(termNumberMatch[1]);
                const equivalentTerm = selectedYear.terms.find(t => t.name.includes(termNumber.toString()));
                if (equivalentTerm) {
                  correctedFee.termId = equivalentTerm.id;
                }
              }
            } else {
              correctedFee.termId = selectedTermId;
            }
          }

          return correctedFee;
        }
        return fee;
      });

      if (signal.aborted || !mountedRef.current) return;

      // Fetch payment data for all pupils in parallel
      setState(prev => ({ ...prev, processingStatus: 'Loading payment records...' }));
      
      const paymentPromises = pupils.map(async (pupil) => {
        try {
          const payments = await PaymentsService.getPaymentsByPupil(pupil.id);
          return { pupilId: pupil.id, payments };
        } catch (error) {
          console.warn(`Failed to load payments for pupil ${pupil.id}:`, error);
          return { pupilId: pupil.id, payments: [] };
        }
      });

      const paymentResults = await Promise.all(paymentPromises);
      const pupilPaymentsMap = new Map(
        paymentResults.map(result => [result.pupilId, result.payments])
      );

      if (signal.aborted || !mountedRef.current) return;

      // Use the optimized batch processing
      setState(prev => ({ ...prev, processingStatus: 'Processing with optimization...' }));
      
      const optimizedResults = await feeGroupCacheService.batchProcessPupils(
        pupils,
        correctedFeeStructures,
        pupilPaymentsMap,
        academicYears,
        selectedTermId
      );

      if (signal.aborted || !mountedRef.current) return;

      // Convert OptimizedPupilFees to PupilFeesInfo format
      const pupilFeesInfo: Record<string, PupilFeesInfo> = {};
      let cacheHits = 0;
      let totalCalculationTime = 0;

      for (const [pupilId, optimizedFees] of optimizedResults.entries()) {
        pupilFeesInfo[pupilId] = {
          totalFees: optimizedFees.totalFees,
          totalPaid: optimizedFees.totalPaid,
          balance: optimizedFees.balance,
          applicableFees: optimizedFees.applicableFees
        };

        if (optimizedFees.fromCache) cacheHits++;
        totalCalculationTime += optimizedFees.calculationTime;
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const cacheStats = feeGroupCacheService.getCacheStats();

      // Calculate speedup estimate (comparing to sequential processing)
      const estimatedSequentialTime = pupils.length * 200; // Estimate 200ms per pupil normally
      const speedupFactor = estimatedSequentialTime / totalTime;

      if (mountedRef.current && !signal.aborted) {
        setState(prev => ({
          ...prev,
          pupilFeesInfo,
          processedCount: pupils.length,
          isProcessing: false,
          processingStatus: `🚀 Optimized! Processed ${pupils.length} pupils in ${totalTime.toFixed(0)}ms (${speedupFactor.toFixed(1)}x faster)`,
          optimizationInfo: {
            cacheHits,
            groupsCreated: cacheStats.totalGroups,
            speedupFactor,
            totalCalculationTime: totalTime
          }
        }));

        console.log('🎉 OPTIMIZED PROCESSING COMPLETE:', {
          pupilsProcessed: pupils.length,
          totalTime: `${totalTime.toFixed(2)}ms`,
          avgTimePerPupil: `${(totalTime / pupils.length).toFixed(2)}ms`,
          cacheHits,
          cacheHitRate: `${((cacheHits / pupils.length) * 100).toFixed(1)}%`,
          speedupEstimate: `${speedupFactor.toFixed(1)}x faster`,
          groupsCreated: cacheStats.totalGroups
        });
      }

    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.message === 'Cancelled')) {
        console.log('🚫 Optimized processing was cancelled');
        return;
      }
      
      console.error('❌ Error during optimized processing:', error);
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: error instanceof Error ? error.message : 'Optimization failed',
          processingStatus: 'Optimization failed - consider clearing cache'
        }));
      }
    } finally {
      processingRef.current = false;
      if (abortControllerRef.current === abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [enabled, selectedYear, selectedTermId, pupils, allFeeStructures, academicYears]);

  // Main processing function with comprehensive cleanup (FALLBACK - legacy method)
  const startProcessing = useCallback(async () => {
    if (!enabled || !selectedYear || !selectedTermId || pupils.length === 0 || allFeeStructures.length === 0) {
      return;
    }

    // Create a unique key for this processing request
    const processingKey = `${selectedYear.id}-${selectedTermId}-${pupils.length}-${allFeeStructures.length}`;
    
    // Prevent multiple simultaneous processing and duplicate requests
    if (processingRef.current || !mountedRef.current || lastProcessingParamsRef.current === processingKey) {
      console.log('⚠️ Fees processing already in progress or duplicate request, skipping...');
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
    lastProcessingParamsRef.current = processingKey;

    console.log('🚀 Starting progressive fees processing:', {
      pupilsCount: pupils.length,
      batchSize,
      selectedYear: selectedYear.name,
      selectedTerm: selectedTermId
    });

    if (!mountedRef.current) return;

    // Reset state completely
    setState({
      pupilFeesInfo: {},
      processedCount: 0,
      totalCount: pupils.length,
      isProcessing: true,
      currentBatch: 0,
      totalBatches: Math.ceil(pupils.length / batchSize),
      processingStatus: 'Preparing fee structures...',
      error: null,
      optimizationInfo: undefined // Clear optimization info for legacy processing
    });

    try {
      if (signal.aborted) return;

      console.log('🏗️ Starting fee structures correction:', {
        totalFeeStructures: allFeeStructures.length,
        selectedYear: selectedYear.name,
        selectedTermId
      });

      // Correct fee structures (same logic as original but with cancellation checks)
      const correctedFeeStructures = allFeeStructures.map(fee => {
        if (signal.aborted) return fee;

        if (!fee.academicYearId || fee.academicYearId !== selectedYear.id) {
          const correctedFee = {
            ...fee,
            academicYearId: selectedYear.id,
          };

          if (!fee.termId || fee.termId !== selectedTermId) {
            if (fee.termId) {
              const termNumberMatch = fee.termId.match(/^t(\d+)-/);
              if (termNumberMatch) {
                const termNumber = parseInt(termNumberMatch[1]);
                const equivalentTerm = selectedYear.terms.find(t => t.name.includes(termNumber.toString()));
                if (equivalentTerm) {
                  correctedFee.termId = equivalentTerm.id;
                }
              }
            } else {
              correctedFee.termId = selectedTermId;
            }
          }

          return correctedFee;
        }
        return fee;
      });

      if (signal.aborted || !mountedRef.current) return;

      console.log('🏁 Fee structures correction completed');

      // Create batches
      const batches: Pupil[][] = [];
      for (let i = 0; i < pupils.length; i += batchSize) {
        batches.push(pupils.slice(i, i + batchSize));
      }

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          processingStatus: `Processing ${batches.length} batches of ${batchSize} pupils each...`
        }));
      }

      // Process batches sequentially to avoid overwhelming the database
      let totalProcessedSoFar = 0;
      for (let i = 0; i < batches.length; i++) {
        if (signal.aborted || !mountedRef.current) {
          console.log('🚫 Fees processing cancelled');
          return;
        }

        totalProcessedSoFar = await processBatch(batches[i], i, correctedFeeStructures, totalProcessedSoFar, signal);
        
        // Longer delay between batches to prevent rate limiting
        if (i < batches.length - 1 && !signal.aborted && mountedRef.current) {
          await new Promise(resolve => {
            const timeoutId = setTimeout(resolve, 300);
            signal.addEventListener('abort', () => clearTimeout(timeoutId));
          });
        }
      }

      if (mountedRef.current && !signal.aborted) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          processingStatus: `Completed! Processed ${pupils.length} pupils successfully.`
        }));
        console.log('🎉 Progressive fees processing completed successfully');
      }

    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.message === 'Cancelled')) {
        console.log('🚫 Fees processing was cancelled');
        return;
      }
      
      console.error('❌ Error during progressive fees processing:', error);
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          processingStatus: 'Processing failed'
        }));
      }
    } finally {
      processingRef.current = false;
      if (abortControllerRef.current === abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [enabled, selectedYear, selectedTermId, pupils, allFeeStructures, batchSize, processBatch]);

  // Start processing when dependencies are ready - USING LEGACY VERSION (OPTIMIZATION DISABLED)
  useEffect(() => {
    if (!isLoadingFeeStructures && allFeeStructures.length > 0 && mountedRef.current) {
      const timeoutId = setTimeout(() => {
        if (mountedRef.current && !processingRef.current) {
          // ⚠️ USING LEGACY PROCESSING: Optimization disabled due to payment calculation bug
          console.log('⚠️ Using legacy processing - optimization disabled due to critical payment calculation bug');
          startProcessing();
        }
      }, 200); // Delay to ensure component is fully mounted

      return () => clearTimeout(timeoutId);
    }
  }, [isLoadingFeeStructures, allFeeStructures.length, selectedYear?.id, selectedTermId, pupils.length, startProcessing]); // Use legacy processing

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      processingRef.current = false;
      lastProcessingParamsRef.current = null;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (state.totalCount === 0) return 0;
    return Math.round((state.processedCount / state.totalCount) * 100);
  }, [state.processedCount, state.totalCount]);

  // Calculate totals from processed pupils
  const totals = useMemo(() => {
    const processedPupils = Object.values(state.pupilFeesInfo);
    return processedPupils.reduce(
      (acc, pupilInfo) => ({
        totalFees: acc.totalFees + pupilInfo.totalFees,
        totalPaid: acc.totalPaid + pupilInfo.totalPaid,
        balance: acc.balance + pupilInfo.balance
      }),
      { totalFees: 0, totalPaid: 0, balance: 0 }
    );
  }, [state.pupilFeesInfo]);

  return {
    ...state,
    progressPercentage,
    totals,
    isLoading: isLoadingFeeStructures,
    restart: startProcessing, // ⚠️ USING LEGACY: Optimization disabled due to payment calculation bug
    restartOptimized: processWithOptimization, // Keep optimized version (disabled) for future fixing
    clearCache: () => feeGroupCacheService.clearCache(),
    cacheStats: () => feeGroupCacheService.getCacheStats()
  };
} 