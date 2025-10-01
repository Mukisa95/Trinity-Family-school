import type { DiscountConfig, DynamicDiscount, DiscountValueType } from '@/types';

/**
 * Calculate the discount amount based on configuration
 */
export function calculateDiscountAmount(
  originalAmount: number,
  valueType: DiscountValueType,
  value: number
): number {
  if (valueType === 'percentage') {
    return Math.round((originalAmount * value) / 100);
  } else {
    return Math.min(value, originalAmount); // Fixed amount, but not more than original
  }
}

/**
 * Apply discount to an amount
 */
export function applyDiscount(
  originalAmount: number,
  discountConfig: DiscountConfig
): { finalAmount: number; discountAmount: number } {
  if (!discountConfig.isEnabled) {
    return { finalAmount: originalAmount, discountAmount: 0 };
  }

  const discountAmount = calculateDiscountAmount(
    originalAmount,
    discountConfig.valueType,
    discountConfig.value
  );

  const finalAmount = Math.max(0, originalAmount - discountAmount);

  return { finalAmount, discountAmount };
}

/**
 * Apply multiple dynamic discounts (takes the best one)
 */
export function applyBestDynamicDiscount(
  originalAmount: number,
  dynamicDiscounts: DynamicDiscount[]
): { finalAmount: number; discountAmount: number; appliedDiscount?: DynamicDiscount } {
  if (!dynamicDiscounts.length) {
    return { finalAmount: originalAmount, discountAmount: 0 };
  }

  let bestDiscount: DynamicDiscount | undefined;
  let maxDiscountAmount = 0;

  // Find the discount that gives the maximum reduction
  for (const discount of dynamicDiscounts) {
    const discountAmount = calculateDiscountAmount(
      originalAmount,
      discount.valueType,
      discount.value
    );

    if (discountAmount > maxDiscountAmount) {
      maxDiscountAmount = discountAmount;
      bestDiscount = discount;
    }
  }

  const finalAmount = Math.max(0, originalAmount - maxDiscountAmount);

  return {
    finalAmount,
    discountAmount: maxDiscountAmount,
    appliedDiscount: bestDiscount
  };
}

/**
 * Calculate final amount considering both static and dynamic discounts
 */
export function calculateFinalAmount(
  originalAmount: number,
  staticDiscountConfig?: DiscountConfig,
  dynamicDiscounts: DynamicDiscount[] = []
): {
  finalAmount: number;
  discountAmount: number;
  discountSource: 'static' | 'dynamic' | 'none';
  appliedDiscount?: DiscountConfig | DynamicDiscount;
} {
  // If static discount is enabled, use it (takes priority)
  if (staticDiscountConfig?.isEnabled) {
    const { finalAmount, discountAmount } = applyDiscount(originalAmount, staticDiscountConfig);
    return {
      finalAmount,
      discountAmount,
      discountSource: 'static',
      appliedDiscount: staticDiscountConfig
    };
  }

  // Otherwise, check for applicable dynamic discounts
  const { finalAmount, discountAmount, appliedDiscount } = applyBestDynamicDiscount(
    originalAmount,
    dynamicDiscounts
  );

  return {
    finalAmount,
    discountAmount,
    discountSource: appliedDiscount ? 'dynamic' : 'none',
    appliedDiscount
  };
}

/**
 * Format discount display text
 */
export function formatDiscountDisplay(
  valueType: DiscountValueType,
  value: number
): string {
  if (valueType === 'percentage') {
    return `${value}% off`;
  } else {
    return `UGX ${value.toLocaleString()} off`;
  }
}

/**
 * Validate discount value
 */
export function validateDiscountValue(
  valueType: DiscountValueType,
  value: number,
  maxAmount?: number
): { isValid: boolean; error?: string } {
  if (value <= 0) {
    return { isValid: false, error: 'Discount value must be greater than 0' };
  }

  if (valueType === 'percentage' && value > 100) {
    return { isValid: false, error: 'Percentage discount cannot exceed 100%' };
  }

  if (valueType === 'fixed' && maxAmount && value > maxAmount) {
    return { isValid: false, error: `Fixed discount cannot exceed the total amount (UGX ${maxAmount.toLocaleString()})` };
  }

  return { isValid: true };
} 