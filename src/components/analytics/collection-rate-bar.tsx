"use client";

import { motion } from 'framer-motion';

interface CollectionRateBarProps {
  rate: number; // 0-100
  showPercentage?: boolean;
  height?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function CollectionRateBar({
  rate,
  showPercentage = true,
  height = 'md',
  animated = true
}: CollectionRateBarProps) {
  const clampedRate = Math.min(100, Math.max(0, rate));
  
  const heightClasses = {
    sm: 'h-2',
    md: 'h-4',
    lg: 'h-6'
  };

  // Color based on collection rate
  const getColor = () => {
    if (clampedRate >= 80) return 'bg-green-500';
    if (clampedRate >= 60) return 'bg-blue-500';
    if (clampedRate >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full">
      <div className={`w-full ${heightClasses[height]} bg-gray-200 rounded-full overflow-hidden`}>
        {animated ? (
          <motion.div
            className={`${heightClasses[height]} ${getColor()} rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${clampedRate}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        ) : (
          <div
            className={`${heightClasses[height]} ${getColor()} rounded-full transition-all duration-500`}
            style={{ width: `${clampedRate}%` }}
          />
        )}
      </div>
      {showPercentage && (
        <div className="mt-1 text-sm font-medium text-gray-600 text-right">
          {clampedRate.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

