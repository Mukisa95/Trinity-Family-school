"use client";

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  isLoading?: boolean;
}

const colorClasses = {
  blue: {
    bg: 'from-brand-surface-50 to-brand-surface-100 dark:from-brand-surface-950/40 dark:to-brand-surface-950/40',
    icon: 'text-brand-ink-600 bg-brand-surface-100 dark:text-brand-ink-400 dark:bg-brand-surface-950/40',
    text: 'text-brand-ink-900 dark:text-brand-ink-200',
    subtitle: 'text-brand-ink-600 dark:text-brand-ink-400'
  },
  green: {
    bg: 'from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-950/40',
    icon: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950/40',
    text: 'text-green-900 dark:text-green-200',
    subtitle: 'text-green-600 dark:text-green-400'
  },
  orange: {
    bg: 'from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-950/40',
    icon: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-950/40',
    text: 'text-orange-900 dark:text-orange-200',
    subtitle: 'text-orange-600 dark:text-orange-400'
  },
  red: {
    bg: 'from-red-50 to-red-100 dark:from-red-950/40 dark:to-red-950/40',
    icon: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950/40',
    text: 'text-red-900 dark:text-red-200',
    subtitle: 'text-red-600 dark:text-red-400'
  },
  purple: {
    bg: 'from-brand-secondary-surface-50 to-brand-secondary-surface-100 dark:from-brand-secondary-surface-950/40 dark:to-brand-secondary-surface-950/40',
    icon: 'text-brand-secondary-ink-600 bg-brand-secondary-surface-100 dark:text-brand-secondary-ink-400 dark:bg-brand-secondary-surface-950/40',
    text: 'text-brand-secondary-ink-900 dark:text-brand-secondary-ink-200',
    subtitle: 'text-brand-secondary-ink-600 dark:text-brand-secondary-ink-400'
  }
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  isLoading = false
}: StatCardProps) {
  const colors = colorClasses[color];

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className={`p-6 bg-gradient-to-br ${colors.bg}`}>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/2 dark:bg-slate-800"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4 dark:bg-slate-800"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3 dark:bg-slate-800"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden group">
        <CardContent className={`p-6 bg-gradient-to-br ${colors.bg} relative`}>
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500 dark:bg-slate-900/20"></div>
          
          <div className="relative z-10">
            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl ${colors.icon} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
              <Icon className="w-6 h-6" />
            </div>

            {/* Title */}
            <h3 className="text-sm font-medium text-gray-600 mb-2 dark:text-slate-300">{title}</h3>

            {/* Value */}
            <div className={`text-3xl font-bold ${colors.text} mb-1`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>

            {/* Subtitle or Trend */}
            {subtitle && (
              <p className={`text-sm ${colors.subtitle} font-medium`}>{subtitle}</p>
            )}

            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <span className={`text-sm font-medium ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
                {trend.label && (
                  <span className="text-xs text-gray-500 dark:text-slate-400">{trend.label}</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

