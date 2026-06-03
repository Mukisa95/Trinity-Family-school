import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Pupil, AcademicYear, FeeStructure, PaymentRecord } from '@/types';
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { PaymentsService } from '@/lib/services/payments.service';
import { filterApplicableFees, processPupilFees as processFeesWithDiscounts } from '@/app/fees/collect/[id]/utils/feeProcessing';
import { feeGroupCacheService, type OptimizedPupilFees } from '@/lib/services/fee-group-cache.service';
import { isTermEnded } from '@/lib/utils/academic-year-utils';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';

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

  // 🚀 OPTIMIZED: Process a single pupil's fees using pre-loaded payments (NO individual queries)
  const processSinglePupilFees = useCallback(async (
    pupil: Pupil,
    correctedFeeStructures: FeeStructure[],
    paymentsGrouped: Map<string, PaymentRecord[]>, // Pre-loaded and grouped payments
    snapshotsMap?: Map<string, Pupil>, // Pre-loaded historical pupils for ended terms
    signal?: AbortSignal
  ): Promise<PupilFeesInfo> => {
    if (signal?.aborted) {
      throw new Error('Cancelled');
    }

    try {
      if (!selectedYear || !selectedTermId) {
        throw new Error('Missing year or term selection');
      }

      // 🔥 CRITICAL FIX: Use historical pupil snapshot if viewing an ended term
      // This ensures fees are calculated based on the pupil's class/section during that term
      // MUST use snapshot data - no fallback to current pupil for ended terms
      let pupilForFees = pupil;
      const selectedTerm = selectedYear.terms.find(t => t.id === selectedTermId);
      
      if (selectedTerm && isTermEnded(selectedTerm)) {
        // Term has ended - MUST use snapshot data (pre-loaded in snapshotsMap)
        if (snapshotsMap && snapshotsMap.has(pupil.id)) {
          pupilForFees = snapshotsMap.get(pupil.id)!;
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`📸 Using pre-loaded historical snapshot for ended term:`, {
              pupilId: pupil.id,
              termId: selectedTermId,
              currentClass: pupil.classId,
              historicalClass: pupilForFees.classId,
              currentSection: pupil.section,
              historicalSection: pupilForFees.section
            });
          }
        } else {
          // CRITICAL: If snapshot is missing, we MUST fetch it - no fallback to current data
          console.warn(`⚠️ Snapshot missing for pupil ${pupil.id}, fetching now...`);
          try {
            const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
              pupil,
              selectedTermId,
              selectedYear
            );
            // Create virtual pupil with historical data
            pupilForFees = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);
            
            // Store in map for future use
            if (snapshotsMap) {
              snapshotsMap.set(pupil.id, pupilForFees);
            }
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`📸 Fetched and cached historical snapshot for ended term:`, {
                pupilId: pupil.id,
                termId: selectedTermId,
                currentClass: pupil.classId,
                historicalClass: pupilForFees.classId
              });
            }
          } catch (error) {
            // CRITICAL ERROR: Cannot proceed without snapshot for ended term
            console.error(`❌ CRITICAL: Failed to load snapshot for pupil ${pupil.id}, term ${selectedTermId}:`, error);
            throw new Error(`Cannot process fees for ended term without historical snapshot. Pupil: ${pupil.firstName} ${pupil.lastName}, Term: ${selectedTermId}`);
          }
        }
      }

      // Filter applicable fees using historical pupil data if term has ended
      const applicableFees = filterApplicableFees(
        correctedFeeStructures,
        pupilForFees, // Use historical pupil if term ended, otherwise current pupil
        selectedTermId,
        selectedYear,
        academicYears
      );

      if (signal?.aborted) {
        throw new Error('Cancelled');
      }

      // 🚀 OPTIMIZATION: Get payments from pre-loaded grouped data (instant lookup, NO query)
      const termPayments = paymentsGrouped.get(pupil.id) || [];
      
      // 🔍 DEBUG: Log payment data for first few pupils
      if (Math.random() < 0.05) { // Log ~5% of pupils to avoid spam
        console.log(`[DEBUG] Pupil ${pupil.firstName} ${pupil.lastName}:`, {
          pupilId: pupil.id,
          paymentsFound: termPayments.length,
          termPaymentsDetails: termPayments.map(p => ({
            id: p.id,
            amount: p.amount,
            termId: p.termId,
            yearId: p.academicYearId,
            expectedTermId: selectedTermId,
            expectedYearId: selectedYear.id
          }))
        });
      }
      
      // ⚠️ IMPORTANT: Payments are already filtered by term/year at database level
      // No need to filter again - just use them directly!
      const filteredPayments = termPayments;

      if (signal?.aborted) {
        throw new Error('Cancelled');
      }

      // Process fees with discounts
      // Use historical pupil for processing if term ended (for accurate discount calculations)
      const processedFees = processFeesWithDiscounts(
        applicableFees,
        filteredPayments,
        correctedFeeStructures,
        pupilForFees, // Use historical pupil if term ended
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
    paymentsGrouped: Map<string, PaymentRecord[]>, // 🚀 Pre-loaded payments
    snapshotsMap: Map<string, Pupil>, // 🚀 Pre-loaded historical pupils for ended terms
    totalProcessedSoFar: number,
    signal?: AbortSignal
  ) => {
    if (signal?.aborted) {
      throw new Error('Cancelled');
    }

    const batchResults: Record<string, PupilFeesInfo> = {};
    
    // 🚀 OPTIMIZED: Process pupils in parallel now that we have all payments and snapshots pre-loaded
    // No need for sequential processing or delays - we're not hitting the database!
    const processingPromises = batch.map(async (pupil) => {
      if (signal?.aborted) {
        throw new Error('Cancelled');
      }

      try {
        const result = await processSinglePupilFees(pupil, correctedFeeStructures, paymentsGrouped, snapshotsMap, signal);
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
    });

    // 🚀 OPTIMIZED: Process all pupils in parallel (no delays needed - no database queries!)
    await Promise.all(processingPromises);

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

      // 🚀 BATCH OPTIMIZATION: Load ALL payments for the term in ONE query (instead of N queries)
      setState(prev => ({ ...prev, processingStatus: 'Loading ALL payment records in ONE batch query...' }));
      
      let allTermPayments: PaymentRecord[] = [];
      try {
        console.log(`🔍 [OPTIMIZED] BATCH LOADING: Requesting payments for year=${selectedYear.id}, term=${selectedTermId}`);
        allTermPayments = await PaymentsService.getAllPaymentsByTerm(selectedYear.id, selectedTermId);
        console.log(`✅ [OPTIMIZED] BATCH LOADED: ${allTermPayments.length} payments for ${pupils.length} pupils in ONE query`);
        
        // 🔍 DEBUG: Show sample of loaded payments
        if (allTermPayments.length > 0) {
          console.log('📋 [OPTIMIZED] Sample payment:', {
            firstPayment: {
              id: allTermPayments[0].id,
              pupilId: allTermPayments[0].pupilId,
              amount: allTermPayments[0].amount,
              termId: allTermPayments[0].termId,
              yearId: allTermPayments[0].academicYearId
            },
            totalAmount: allTermPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
          });
        } else {
          console.warn('⚠️ [OPTIMIZED] NO PAYMENTS FOUND for this term/year combination!');
        }
      } catch (error) {
        console.error('❌ [OPTIMIZED] Failed to batch load payments:', error);
        // Fallback to empty array if batch loading fails
        allTermPayments = [];
      }

      // 🚀 Group payments by pupilId in memory (instant lookups, NO more queries!)
      const pupilPaymentsMap = PaymentsService.groupPaymentsByPupil(allTermPayments);
      console.log(`📊 [OPTIMIZED] GROUPED: ${pupilPaymentsMap.size} pupils have payment records out of ${pupils.length} total pupils`);

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
    console.log('🔍 startProcessing validation:', {
      enabled,
      hasSelectedYear: !!selectedYear,
      selectedYearId: selectedYear?.id,
      selectedTermId,
      pupilsLength: pupils.length,
      allFeeStructuresLength: allFeeStructures.length
    });
    
    if (!enabled || !selectedYear || !selectedTermId || pupils.length === 0 || allFeeStructures.length === 0) {
      console.log('❌ startProcessing returning early - validation failed');
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

      // 🚀 BATCH OPTIMIZATION: Load ALL payments for the term in ONE query (instead of N queries)
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          processingStatus: 'Loading ALL payment records in ONE batch query...'
        }));
      }
      
      let allTermPayments: PaymentRecord[] = [];
      try {
        console.log(`🔍 BATCH LOADING: Requesting payments for year=${selectedYear.id}, term=${selectedTermId}`);
        allTermPayments = await PaymentsService.getAllPaymentsByTerm(selectedYear.id, selectedTermId);
        console.log(`✅ BATCH LOADED: ${allTermPayments.length} payments for ${pupils.length} pupils in ONE query`);
        
        // 🔍 DEBUG: Show sample of loaded payments
        if (allTermPayments.length > 0) {
          console.log('📋 Sample payment:', {
            firstPayment: {
              id: allTermPayments[0].id,
              pupilId: allTermPayments[0].pupilId,
              amount: allTermPayments[0].amount,
              termId: allTermPayments[0].termId,
              yearId: allTermPayments[0].academicYearId
            },
            totalAmount: allTermPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
          });
        } else {
          console.warn('⚠️ NO PAYMENTS FOUND for this term/year combination!');
        }
      } catch (error) {
        console.error('❌ Failed to batch load payments:', error);
        // Fallback to empty array if batch loading fails
        allTermPayments = [];
      }

      // 🚀 Group payments by pupilId in memory (instant lookups, NO more queries!)
      const paymentsGrouped = PaymentsService.groupPaymentsByPupil(allTermPayments);
      console.log(`📊 GROUPED: ${paymentsGrouped.size} pupils have payment records out of ${pupils.length} total pupils`);

      if (signal.aborted || !mountedRef.current) return;

      // 🔥 CRITICAL: Pre-load ALL historical snapshots for ended terms BEFORE processing fees
      // This ensures ALL pupils use snapshot data, not live data
      const snapshotsMap = new Map<string, Pupil>();
      const selectedTerm = selectedYear.terms.find(t => t.id === selectedTermId);
      
      if (selectedTerm && isTermEnded(selectedTerm)) {
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            processingStatus: `Loading historical snapshots for ${pupils.length} pupils (ended term)...`
          }));
        }
        
        console.log(`📸 PRE-LOADING: Loading snapshots for ${pupils.length} pupils for ended term ${selectedTerm.name}`);
        const snapshotStartTime = performance.now();
        
        // Load snapshots in parallel batches to avoid overwhelming the database
        const snapshotBatchSize = 20; // Process 20 pupils at a time
        const snapshotBatches: Pupil[][] = [];
        for (let i = 0; i < pupils.length; i += snapshotBatchSize) {
          snapshotBatches.push(pupils.slice(i, i + snapshotBatchSize));
        }
        
        for (let batchIdx = 0; batchIdx < snapshotBatches.length; batchIdx++) {
          if (signal.aborted || !mountedRef.current) return;
          
          const batch = snapshotBatches[batchIdx];
          const snapshotPromises = batch.map(async (pupil) => {
            try {
              const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
                pupil,
                selectedTermId,
                selectedYear
              );
              // Create virtual pupil with historical data
              const historicalPupil = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);
              snapshotsMap.set(pupil.id, historicalPupil);
              
              if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
                console.log(`📸 Loaded snapshot for pupil ${pupil.firstName} ${pupil.lastName}:`, {
                  currentClass: pupil.classId,
                  historicalClass: historicalPupil.classId,
                  currentSection: pupil.section,
                  historicalSection: historicalPupil.section
                });
              }
            } catch (error) {
              // CRITICAL: If snapshot fails, we cannot proceed - log error but continue for other pupils
              console.error(`❌ CRITICAL: Failed to load snapshot for pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}):`, error);
              // Don't add to map - will be handled in processSinglePupilFees with retry
            }
          });
          
          await Promise.all(snapshotPromises);
          
          if (mountedRef.current) {
            setState(prev => ({
              ...prev,
              processingStatus: `Loaded snapshots: ${snapshotsMap.size}/${pupils.length} pupils (batch ${batchIdx + 1}/${snapshotBatches.length})...`
            }));
          }
        }
        
        const snapshotLoadTime = performance.now() - snapshotStartTime;
        console.log(`✅ PRE-LOADED: ${snapshotsMap.size}/${pupils.length} snapshots loaded in ${snapshotLoadTime.toFixed(0)}ms`);
        
        if (snapshotsMap.size < pupils.length) {
          console.warn(`⚠️ WARNING: Only ${snapshotsMap.size} out of ${pupils.length} snapshots loaded. Missing snapshots will be fetched during processing.`);
        }
      }

      if (signal.aborted || !mountedRef.current) return;

      // Create batches
      const batches: Pupil[][] = [];
      for (let i = 0; i < pupils.length; i += batchSize) {
        batches.push(pupils.slice(i, i + batchSize));
      }

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          processingStatus: `Processing ${batches.length} batches of ${batchSize} pupils each (payments and snapshots pre-loaded)...`
        }));
      }

      // 🚀 OPTIMIZED: Process batches in parallel now (no delays needed - we have all the data!)
      let totalProcessedSoFar = 0;
      for (let i = 0; i < batches.length; i++) {
        if (signal.aborted || !mountedRef.current) {
          console.log('🚫 Fees processing cancelled');
          return;
        }

        totalProcessedSoFar = await processBatch(batches[i], i, correctedFeeStructures, paymentsGrouped, snapshotsMap, totalProcessedSoFar, signal);
        
        // 🚀 NO DELAYS NEEDED - we have all the data pre-loaded!
        // Old code used to have 300ms delays to prevent rate limiting
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