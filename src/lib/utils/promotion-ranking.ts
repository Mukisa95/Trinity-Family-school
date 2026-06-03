/**
 * Promotion ranking configuration and utilities
 */

export interface PromotionRankingConfig {
  enabled: boolean;
  ranges: {
    promoted: { min: number; max: number };
    probation: { min: number; max: number };
    repeat: { min: number; max: number };
  };
}

export const DEFAULT_PROMOTION_RANKING: PromotionRankingConfig = {
  enabled: true,
  ranges: {
    promoted: { min: 4, max: 25 },
    probation: { min: 26, max: 30 },
    repeat: { min: 31, max: 36 }
  }
};

/**
 * Calculate promotion status based on total aggregates
 * @param totalAggregates - Pupil's total aggregates
 * @param config - Promotion ranking configuration
 * @param classCode - Class code for repeat message
 * @returns Promotion status text or null if not applicable
 */
export function calculatePromotionStatus(
  totalAggregates: number,
  config: PromotionRankingConfig,
  classCode?: string
): string | null {
  console.log('🎓 calculatePromotionStatus called:', { 
    totalAggregates, 
    configEnabled: config.enabled, 
    ranges: config.ranges,
    classCode 
  });
  
  if (!config.enabled) {
    console.log('❌ Promotion ranking disabled in config');
    return null;
  }
  
  if (!totalAggregates || totalAggregates === 0) {
    console.log('❌ No total aggregates:', totalAggregates);
    return null;
  }

  const { ranges } = config;

  // Check promoted range
  if (totalAggregates >= ranges.promoted.min && totalAggregates <= ranges.promoted.max) {
    console.log('✅ PROMOTED:', totalAggregates, 'in range', ranges.promoted);
    return 'PROMOTED';
  }

  // Check promoted on probation range
  if (totalAggregates >= ranges.probation.min && totalAggregates <= ranges.probation.max) {
    console.log('✅ PROMOTED ON PROBATION:', totalAggregates, 'in range', ranges.probation);
    return 'PROMOTED ON PROBATION';
  }

  // Check repeat range
  if (totalAggregates >= ranges.repeat.min && totalAggregates <= ranges.repeat.max) {
    const status = classCode ? `ADVISED TO REPEAT ${classCode}` : 'ADVISED TO REPEAT';
    console.log('✅ ADVISED TO REPEAT:', totalAggregates, 'in range', ranges.repeat, 'status:', status);
    return status;
  }

  console.log('⚠️ Total aggregates', totalAggregates, 'outside all ranges');
  return null;
}

/**
 * Check if an exam is for Term 3 (final term)
 * @param termName - Term name from exam
 * @returns True if Term 3
 */
export function isTermThree(termName?: string): boolean {
  if (!termName) {
    console.log('❌ isTermThree: No termName provided');
    return false;
  }
  
  console.log('🔍 isTermThree checking:', termName);
  
  const termLower = termName.toLowerCase().trim();
  const isTerm3 = termLower.includes('term 3') || 
                  termLower.includes('term three') || 
                  termLower.includes('3 (three)') ||
                  termLower === '3' ||
                  termLower === 'three' ||
                  termLower === '3 (three)' ||
                  /term\s*3/i.test(termName) ||
                  /\b3\b/.test(termName);
  
  console.log('✅ isTermThree result:', isTerm3);
  return isTerm3;
}

