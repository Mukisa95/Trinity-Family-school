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
  if (!config.enabled) {
    return null;
  }
  
  if (!totalAggregates || totalAggregates === 0) {
    return null;
  }

  const { ranges } = config;

  // Check promoted range
  if (totalAggregates >= ranges.promoted.min && totalAggregates <= ranges.promoted.max) {
    return 'PROMOTED';
  }

  // Check promoted on probation range
  if (totalAggregates >= ranges.probation.min && totalAggregates <= ranges.probation.max) {
    return 'PROMOTED ON PROBATION';
  }

  // Check repeat range
  if (totalAggregates >= ranges.repeat.min && totalAggregates <= ranges.repeat.max) {
    const status = classCode ? `ADVISED TO REPEAT ${classCode}` : 'ADVISED TO REPEAT';
    return status;
  }

  return null;
}

/**
 * Check if an exam is for Term 3 (final term)
 * @param termName - Term name from exam
 * @returns True if Term 3
 */
export function isTermThree(termName?: string): boolean {
  if (!termName) return false;
  const termLower = termName.toLowerCase().trim();
  return /\bterm\s*(?:3|three|iii)\b/.test(termLower)
    || /^(?:3|three|iii)(?:\s*\(three\))?$/.test(termLower)
    || /^third\s+term$/.test(termLower);
}

export function isValidPromotionRanking(config: PromotionRankingConfig): boolean {
  if (!config.enabled) return true;
  const bands = Object.values(config.ranges).sort((a, b) => a.min - b.min);
  return bands.every((band, index) => Number.isInteger(band.min) && Number.isInteger(band.max)
    && band.min >= 4 && band.max <= 36 && band.min <= band.max
    && (!index || band.min > bands[index - 1].max));
}

export function reportPromotionRanking(termName: string | undefined, aggregates: number, config?: PromotionRankingConfig, classCode?: string): string | null {
  return isTermThree(termName) && config?.enabled && isValidPromotionRanking(config)
    ? calculatePromotionStatus(aggregates, config, classCode) : null;
}

