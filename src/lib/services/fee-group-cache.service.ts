import { FeeStructure, Pupil, AcademicYear } from '@/types';
// import { filterApplicableFees, processPupilFees } from '@/app/fees/collect/[id]/utils/feeProcessing';

/**
 * Represents a group of pupils who share the same base fees
 */
interface PupilGroup {
  groupKey: string;
  classId: string;
  section: string;
  academicYearId: string;
  termId: string;
  pupils: string[]; // Array of pupil IDs
}

/**
 * Cached base fees for a pupil group
 */
interface CachedGroupFees {
  groupKey: string;
  baseFees: Array<{
    feeStructureId: string;
    name: string;
    amount: number;
    category: string;
    isRequired: boolean;
  }>;
  totalBaseFees: number;
  calculatedAt: number; // Timestamp
  expiresAt: number; // Cache expiration
}

/**
 * Individual pupil fee components that vary per pupil
 */
interface PupilVariableComponents {
  pupilId: string;
  assignmentFees: Array<{
    feeStructureId: string;
    name: string;
    amount: number;
  }>;
  discounts: Array<{
    feeStructureId: string;
    name: string;
    amount: number;
    linkedFeeId?: string;
  }>;
  totalPaid: number;
  lastCalculated: number;
}

/**
 * Final optimized fees result for a pupil
 */
export interface OptimizedPupilFees {
  totalFees: number;
  totalPaid: number;
  balance: number;
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
  fromCache: boolean;
  calculationTime: number;
}

/**
 * Fee Group Caching Service
 * Optimizes fee calculations by grouping pupils with identical base fees
 */
class FeeGroupCacheService {
  private groupCache = new Map<string, CachedGroupFees>();
  private pupilGroupMap = new Map<string, string>(); // pupilId -> groupKey
  private variableComponentsCache = new Map<string, PupilVariableComponents>();
  
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly BACKGROUND_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate a unique key for a pupil group based on fee-determining characteristics
   */
  private generateGroupKey(
    classId: string,
    section: string,
    academicYearId: string,
    termId: string
  ): string {
    return `${classId}|${section}|${academicYearId}|${termId}`;
  }

  /**
   * Group pupils by their fee-determining characteristics
   */
  groupPupilsByFeeCharacteristics(
    pupils: Pupil[],
    academicYearId: string,
    termId: string
  ): Map<string, PupilGroup> {
    const groups = new Map<string, PupilGroup>();

    for (const pupil of pupils) {
      const groupKey = this.generateGroupKey(
        pupil.classId,
        pupil.section || 'day',
        academicYearId,
        termId
      );

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          classId: pupil.classId,
          section: pupil.section || 'day',
          academicYearId,
          termId,
          pupils: []
        });
      }

      groups.get(groupKey)!.pupils.push(pupil.id);
      this.pupilGroupMap.set(pupil.id, groupKey);
    }

    console.log(`📊 Grouped ${pupils.length} pupils into ${groups.size} fee groups:`, 
      Array.from(groups.entries()).map(([key, group]) => ({
        groupKey: key,
        pupilCount: group.pupils.length,
        classId: group.classId,
        section: group.section
      }))
    );

    return groups;
  }

  /**
   * Calculate and cache base fees for a pupil group
   */
  async calculateGroupBaseFees(
    group: PupilGroup,
    feeStructures: FeeStructure[],
    academicYears: AcademicYear[]
  ): Promise<CachedGroupFees> {
    console.log(`⚡ Calculating base fees for group: ${group.groupKey}`);
    
    const startTime = performance.now();
    
    // Create a representative pupil for the group (same characteristics, no individual assignments)
    const representativePupil: Pupil = {
      id: 'group-representative',
      classId: group.classId,
      section: group.section,
      // No assignedFees - we only want base fees
      assignedFees: [],
      firstName: 'Representative',
      lastName: 'Pupil',
      admissionNumber: 'REP001',
      status: 'Active'
    } as Pupil;

    const selectedAcademicYear = academicYears.find(year => year.id === group.academicYearId);
    if (!selectedAcademicYear) {
      throw new Error(`Academic year ${group.academicYearId} not found`);
    }

    // Filter applicable fees for this group (base fees only)
    // TODO: Implement filterApplicableFees function or use alternative approach
    const applicableFees = feeStructures.filter(fee => 
      fee.academicYearId === group.academicYearId && 
      fee.termId === group.termId &&
      fee.classId === group.classId
    );

    // Only include base fees (not assignment fees or discounts)
    const baseFees = applicableFees.filter(fee => 
      !fee.isAssignmentFee && 
      fee.category !== 'Discount' && 
      fee.amount >= 0
    );

    const groupBaseFees = baseFees.map(fee => ({
      feeStructureId: fee.id,
      name: fee.name,
      amount: fee.amount,
      category: fee.category,
      isRequired: fee.isRequired
    }));

    const totalBaseFees = groupBaseFees.reduce((sum, fee) => sum + fee.amount, 0);
    
    const calculationTime = performance.now() - startTime;
    
    const cachedFees: CachedGroupFees = {
      groupKey: group.groupKey,
      baseFees: groupBaseFees,
      totalBaseFees,
      calculatedAt: Date.now(),
      expiresAt: Date.now() + this.CACHE_DURATION
    };

    this.groupCache.set(group.groupKey, cachedFees);

    console.log(`✅ Cached base fees for group ${group.groupKey}:`, {
      baseFeesCount: groupBaseFees.length,
      totalBaseFees,
      calculationTime: `${calculationTime.toFixed(2)}ms`,
      pupilsInGroup: group.pupils.length
    });

    return cachedFees;
  }

  /**
   * Calculate variable components for an individual pupil
   */
  async calculatePupilVariableComponents(
    pupil: Pupil,
    feeStructures: FeeStructure[],
    pupilPayments: any[],
    academicYears: AcademicYear[],
    termId: string
  ): Promise<PupilVariableComponents> {
    const startTime = performance.now();

    const selectedAcademicYear = academicYears.find(year => 
      year.terms.some(term => term.id === termId)
    );

    if (!selectedAcademicYear) {
      throw new Error(`Academic year for term ${termId} not found`);
    }

    // Calculate assignment fees
    const assignmentFees = [];
    if (pupil.assignedFees) {
      for (const assignment of pupil.assignedFees) {
        const feeStructure = feeStructures.find(fs => fs.id === assignment.feeStructureId);
        if (feeStructure && feeStructure.isAssignmentFee && feeStructure.amount > 0) {
          assignmentFees.push({
            feeStructureId: feeStructure.id,
            name: feeStructure.name,
            amount: feeStructure.amount
          });
        }
      }
    }

    // Calculate discounts
    const discounts = [];
    if (pupil.assignedFees) {
      for (const assignment of pupil.assignedFees) {
        const feeStructure = feeStructures.find(fs => fs.id === assignment.feeStructureId);
        if (feeStructure && (feeStructure.category === 'Discount' || feeStructure.amount < 0)) {
          discounts.push({
            feeStructureId: feeStructure.id,
            name: feeStructure.name,
            amount: Math.abs(feeStructure.amount),
            linkedFeeId: feeStructure.linkedFeeId
          });
        }
      }
    }

    // Calculate total paid from payments
    const totalPaid = pupilPayments.reduce((sum, payment) => sum + payment.amount, 0);

    const calculationTime = performance.now() - startTime;

    const variableComponents: PupilVariableComponents = {
      pupilId: pupil.id,
      assignmentFees,
      discounts,
      totalPaid,
      lastCalculated: Date.now()
    };

    this.variableComponentsCache.set(pupil.id, variableComponents);

    console.log(`🔧 Calculated variable components for pupil ${pupil.id}:`, {
      assignmentFeesCount: assignmentFees.length,
      discountsCount: discounts.length,
      totalPaid,
      calculationTime: `${calculationTime.toFixed(2)}ms`
    });

    return variableComponents;
  }

  /**
   * Get optimized fees for a pupil using cached base fees + variable components
   */
  async getOptimizedPupilFees(
    pupil: Pupil,
    feeStructures: FeeStructure[],
    pupilPayments: any[],
    academicYears: AcademicYear[],
    termId: string
  ): Promise<OptimizedPupilFees> {
    const startTime = performance.now();
    
    const groupKey = this.pupilGroupMap.get(pupil.id);
    if (!groupKey) {
      throw new Error(`No group found for pupil ${pupil.id}`);
    }

    // Get cached base fees for the group
    let cachedGroupFees = this.groupCache.get(groupKey);
    const isExpired = !cachedGroupFees || cachedGroupFees.expiresAt < Date.now();
    
    if (!cachedGroupFees || isExpired) {
      console.log(`🔄 Cache miss/expired for group ${groupKey}, recalculating...`);
      // Find the group and recalculate
      const academicYear = academicYears.find(year => 
        year.terms.some(term => term.id === termId)
      );
      if (!academicYear) {
        throw new Error(`Academic year for term ${termId} not found`);
      }

      const group: PupilGroup = {
        groupKey,
        classId: pupil.classId,
        section: pupil.section || 'day',
        academicYearId: academicYear.id,
        termId,
        pupils: [pupil.id]
      };

      cachedGroupFees = await this.calculateGroupBaseFees(group, feeStructures, academicYears);
    }

    // Get variable components for this specific pupil
    const variableComponents = await this.calculatePupilVariableComponents(
      pupil,
      feeStructures,
      pupilPayments,
      academicYears,
      termId
    );

    // Combine base fees with variable components
    const applicableFees = [];
    let totalFees = cachedGroupFees.totalBaseFees;
    let totalPaid = variableComponents.totalPaid;

    // Add base fees
    for (const baseFee of cachedGroupFees.baseFees) {
      let finalAmount = baseFee.amount;
      let originalAmount = undefined;
      let discount = undefined;

      // Apply discounts if they link to this fee
      const applicableDiscounts = variableComponents.discounts.filter(d => 
        d.linkedFeeId === baseFee.feeStructureId
      );

      if (applicableDiscounts.length > 0) {
        originalAmount = baseFee.amount;
        const totalDiscountAmount = applicableDiscounts.reduce((sum, d) => sum + d.amount, 0);
        finalAmount = Math.max(0, baseFee.amount - totalDiscountAmount);
        
        discount = {
          id: applicableDiscounts[0].feeStructureId,
          name: applicableDiscounts[0].name,
          amount: totalDiscountAmount,
          type: 'fixed' as const
        };
      }

      // Calculate payment allocation (simplified)
      const feePayments = pupilPayments.filter(p => 
        p.feeId === baseFee.feeStructureId
      );
      const feePaid = feePayments.reduce((sum, p) => sum + p.amount, 0);

      applicableFees.push({
        feeStructureId: baseFee.feeStructureId,
        name: baseFee.name,
        amount: finalAmount,
        paid: feePaid,
        balance: Math.max(0, finalAmount - feePaid),
        originalAmount,
        discount
      });
    }

    // Add assignment fees
    for (const assignmentFee of variableComponents.assignmentFees) {
      const feePayments = pupilPayments.filter(p => 
        p.feeId === assignmentFee.feeStructureId
      );
      const feePaid = feePayments.reduce((sum, p) => sum + p.amount, 0);

      applicableFees.push({
        feeStructureId: assignmentFee.feeStructureId,
        name: assignmentFee.name,
        amount: assignmentFee.amount,
        paid: feePaid,
        balance: Math.max(0, assignmentFee.amount - feePaid)
      });

      totalFees += assignmentFee.amount;
    }

    const calculationTime = performance.now() - startTime;
    const balance = Math.max(0, totalFees - totalPaid);

    console.log(`🚀 Optimized fees calculated for pupil ${pupil.id}:`, {
      totalFees,
      totalPaid,
      balance,
      calculationTime: `${calculationTime.toFixed(2)}ms`,
      fromCache: !!cachedGroupFees && !isExpired
    });

    return {
      totalFees,
      totalPaid,
      balance,
      applicableFees,
      fromCache: !!cachedGroupFees && !isExpired,
      calculationTime
    };
  }

  /**
   * Batch process multiple pupils efficiently
   */
  async batchProcessPupils(
    pupils: Pupil[],
    feeStructures: FeeStructure[],
    pupilPaymentsMap: Map<string, any[]>,
    academicYears: AcademicYear[],
    termId: string
  ): Promise<Map<string, OptimizedPupilFees>> {
    console.log(`🔥 BATCH PROCESSING ${pupils.length} pupils with fee optimization`);
    
    const startTime = performance.now();
    const results = new Map<string, OptimizedPupilFees>();

    // Step 1: Group pupils by fee characteristics
    const academicYear = academicYears.find(year => 
      year.terms.some(term => term.id === termId)
    );
    
    if (!academicYear) {
      throw new Error(`Academic year for term ${termId} not found`);
    }

    const groups = this.groupPupilsByFeeCharacteristics(pupils, academicYear.id, termId);

    // Step 2: Pre-calculate base fees for each group
    const groupCalculationPromises = Array.from(groups.entries()).map(async ([groupKey, group]) => {
      let cachedFees = this.groupCache.get(groupKey);
      const isExpired = !cachedFees || cachedFees.expiresAt < Date.now();
      
      if (!cachedFees || isExpired) {
        cachedFees = await this.calculateGroupBaseFees(group, feeStructures, academicYears);
      }
      
      return { groupKey, cachedFees };
    });

    await Promise.all(groupCalculationPromises);

    // Step 3: Process each pupil with cached base fees
    const pupilProcessingPromises = pupils.map(async (pupil) => {
      try {
        const pupilPayments = pupilPaymentsMap.get(pupil.id) || [];
        const optimizedFees = await this.getOptimizedPupilFees(
          pupil,
          feeStructures,
          pupilPayments,
          academicYears,
          termId
        );
        results.set(pupil.id, optimizedFees);
      } catch (error) {
        console.error(`Error processing pupil ${pupil.id}:`, error);
        results.set(pupil.id, {
          totalFees: 0,
          totalPaid: 0,
          balance: 0,
          applicableFees: [],
          fromCache: false,
          calculationTime: 0
        });
      }
    });

    await Promise.all(pupilProcessingPromises);

    const totalTime = performance.now() - startTime;
    const cacheHits = Array.from(results.values()).filter(r => r.fromCache).length;
    
    console.log(`✅ BATCH PROCESSING COMPLETE:`, {
      pupilsProcessed: pupils.length,
      groupsCreated: groups.size,
      cacheHits,
      totalTime: `${totalTime.toFixed(2)}ms`,
      avgTimePerPupil: `${(totalTime / pupils.length).toFixed(2)}ms`,
      speedupEstimate: `${Math.round((pupils.length * 100) / totalTime)}x faster`
    });

    return results;
  }

  /**
   * Clear cache (useful for testing or when fee structures change)
   */
  clearCache(): void {
    this.groupCache.clear();
    this.pupilGroupMap.clear();
    this.variableComponentsCache.clear();
    console.log('🧹 Fee cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const totalGroups = this.groupCache.size;
    const totalPupils = this.pupilGroupMap.size;
    const expiredGroups = Array.from(this.groupCache.values())
      .filter(cache => cache.expiresAt < Date.now()).length;

    return {
      totalGroups,
      totalPupils,
      expiredGroups,
      activeGroups: totalGroups - expiredGroups,
      cacheEfficiency: totalGroups > 0 ? ((totalGroups - expiredGroups) / totalGroups * 100).toFixed(1) + '%' : '0%'
    };
  }

  /**
   * Invalidate cache for specific academic year and term
   */
  invalidateCacheForTerm(academicYearId: string, termId: string): void {
    const keysToDelete: string[] = [];
    
    for (const [groupKey, cachedFees] of this.groupCache.entries()) {
      if (groupKey.includes(academicYearId) && groupKey.includes(termId)) {
        keysToDelete.push(groupKey);
      }
    }
    
    keysToDelete.forEach(key => {
      this.groupCache.delete(key);
      console.log(`🗑️ Invalidated cache for group: ${key}`);
    });
    
    console.log(`🔄 Cache invalidation complete: ${keysToDelete.length} groups cleared for term ${termId}`);
  }

  /**
   * Background cache maintenance - remove expired entries
   */
  performCacheMaintenance(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [groupKey, cachedFees] of this.groupCache.entries()) {
      if (cachedFees.expiresAt < now) {
        expiredKeys.push(groupKey);
      }
    }
    
    expiredKeys.forEach(key => {
      this.groupCache.delete(key);
    });
    
    // Clean up pupil mappings for expired groups
    const validGroupKeys = new Set(this.groupCache.keys());
    const pupilsToRemove: string[] = [];
    
    for (const [pupilId, groupKey] of this.pupilGroupMap.entries()) {
      if (!validGroupKeys.has(groupKey)) {
        pupilsToRemove.push(pupilId);
      }
    }
    
    pupilsToRemove.forEach(pupilId => {
      this.pupilGroupMap.delete(pupilId);
    });
    
    console.log(`🧹 Cache maintenance: Removed ${expiredKeys.length} expired groups and ${pupilsToRemove.length} orphaned pupil mappings`);
  }

  /**
   * Start background cache maintenance (call this once when app initializes)
   */
  startBackgroundMaintenance(): void {
    // Run maintenance every 10 minutes
    setInterval(() => {
      this.performCacheMaintenance();
    }, 10 * 60 * 1000);
    
    console.log('🔄 Background cache maintenance started');
  }

  /**
   * Preload cache for common class/term combinations
   */
  async preloadCommonGroups(
    commonClasses: string[],
    academicYears: AcademicYear[],
    feeStructures: FeeStructure[]
  ): Promise<void> {
    console.log('🚀 Preloading cache for common class groups...');
    
    const preloadPromises: Promise<void>[] = [];
    
    for (const academicYear of academicYears) {
      for (const term of academicYear.terms) {
        for (const classId of commonClasses) {
          const sections = ['day', 'boarding']; // Common sections
          
          for (const section of sections) {
            const group: PupilGroup = {
              groupKey: this.generateGroupKey(classId, section, academicYear.id, term.id),
              classId,
              section,
              academicYearId: academicYear.id,
              termId: term.id,
              pupils: [] // Empty for preloading
            };
            
            preloadPromises.push(
              this.calculateGroupBaseFees(group, feeStructures, academicYears)
                .catch(error => {
                  console.warn(`Failed to preload cache for ${group.groupKey}:`, error);
                })
            );
          }
        }
      }
    }
    
    await Promise.all(preloadPromises);
    console.log(`✅ Preloaded cache for ${preloadPromises.length} common groups`);
  }
}

// Export singleton instance
export const feeGroupCacheService = new FeeGroupCacheService();
export { FeeGroupCacheService };
