"use client";

import React from 'react';
import { useCountUp } from '@/lib/hooks/use-count-up';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  enabled?: boolean;
}

/**
 * Displays a number with a counting animation
 */
export function AnimatedNumber({ 
  value, 
  duration = 2000,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  enabled = true
}: AnimatedNumberProps) {
  const animatedValue = useCountUp({ 
    end: value, 
    duration,
    decimals,
    enabled 
  });

  const formatNumber = (num: number) => {
    if (decimals > 0) {
      return num.toFixed(decimals);
    }
    return Math.round(num).toLocaleString();
  };

  return (
    <span className={className}>
      {prefix}{formatNumber(animatedValue)}{suffix}
    </span>
  );
}

/**
 * Displays currency with a counting animation
 */
export function AnimatedCurrency({ 
  amount, 
  duration = 2000,
  className = '',
  enabled = true
}: { 
  amount: number; 
  duration?: number; 
  className?: string;
  enabled?: boolean;
}) {
  return (
    <AnimatedNumber
      value={amount}
      duration={duration}
      prefix="UGX "
      className={className}
      enabled={enabled}
    />
  );
}

/**
 * Displays percentage with a counting animation
 */
export function AnimatedPercentage({ 
  value, 
  duration = 2000,
  decimals = 1,
  className = '',
  enabled = true
}: { 
  value: number; 
  duration?: number; 
  decimals?: number;
  className?: string;
  enabled?: boolean;
}) {
  return (
    <AnimatedNumber
      value={value}
      duration={duration}
      decimals={decimals}
      suffix="%"
      className={className}
      enabled={enabled}
    />
  );
}

