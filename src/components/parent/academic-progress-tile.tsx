"use client";

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { getCurrentTerm } from '@/lib/utils/academic-year-utils';
import { Calendar, Clock, GraduationCap, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AcademicProgressTileProps {
  className?: string;
}

export function AcademicProgressTile({ className = '' }: AcademicProgressTileProps) {
  const { data: activeYear, isLoading } = useActiveAcademicYear();
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate term progress
  const getTermProgress = () => {
    if (!activeYear) return null;

    const currentTerm = getCurrentTerm(activeYear);
    if (!currentTerm) return null;

    const now = new Date();
    const termStart = new Date(currentTerm.startDate);
    const termEnd = new Date(currentTerm.endDate);

    // Calculate total days in term
    const totalDays = Math.ceil((termEnd.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate days elapsed
    const daysCovered = Math.max(0, Math.ceil((now.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate remaining days
    const remainingDays = Math.max(0, Math.ceil((termEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate progress percentage
    const progressPercentage = Math.min(100, Math.max(0, (daysCovered / totalDays) * 100));

    return {
      currentTerm,
      totalDays,
      daysCovered: Math.min(daysCovered, totalDays),
      remainingDays,
      progressPercentage,
      termNumber: activeYear.terms.findIndex(t => t.id === currentTerm.id) + 1
    };
  };

  const progress = getTermProgress();

  if (isLoading) {
    return (
      <Card className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 ${className}`}>
        <CardContent className="p-2.5">
          <div className="animate-pulse">
            <div className="h-3 bg-blue-200 rounded mb-1.5"></div>
            <div className="h-2 bg-blue-200 rounded mb-1.5"></div>
            <div className="h-1.5 bg-blue-200 rounded mb-2"></div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="h-8 bg-blue-200 rounded"></div>
              <div className="h-8 bg-blue-200 rounded"></div>
              <div className="h-8 bg-blue-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activeYear || !progress) {
    return (
      <Card className={`bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 ${className}`}>
        <CardContent className="p-2.5">
          {isRecessMode ? (
            <div className="flex items-center justify-center text-amber-600 text-sm">
              <Calendar className="h-4 w-4 mr-2" />
              Learners on recess • {effectiveTerm.term?.name || 'Previous term'} data
            </div>
          ) : (
            <div className="flex items-center justify-center text-gray-500 text-sm">
              <Calendar className="h-4 w-4 mr-2" />
              Academic year data not available
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300 ${className}`}>
        <CardContent className="p-2.5">
          {/* Compact Header with Toggle Button */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-1 rounded-md">
                <GraduationCap className="h-3 w-3 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-xs leading-none">
                  {activeYear.name}
                </h3>
                <span className="text-gray-400">•</span>
                <span className="text-xs text-blue-600 dark:text-blue-400 leading-none">
                  Term {progress.termNumber}
                </span>
                {isRecessMode ? (
                  <Badge 
                    variant="secondary" 
                    className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 text-xs px-1.5 py-0 h-4"
                  >
                    Recess
                  </Badge>
                ) : (
                  <Badge 
                    variant="secondary" 
                    className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 text-xs px-1.5 py-0 h-4"
                  >
                    Active
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Toggle Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3 text-blue-600" />
              ) : (
                <ChevronDown className="h-3 w-3 text-blue-600" />
              )}
            </Button>
          </div>

          {/* Always Visible Progress Bar */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {isRecessMode ? effectiveTerm.term?.name || 'Previous term' : progress.currentTerm.name}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {isRecessMode ? 'Recess period' : `${Math.round(progress.progressPercentage)}% complete`}
                </span>
              </div>
            </div>
            {!isRecessMode && (
              <Progress 
                value={progress.progressPercentage} 
                className="h-1.5 bg-blue-100 dark:bg-blue-900/30" 
              />
            )}
            {isRecessMode && (
              <div className="h-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <div className="h-1.5 bg-amber-400 dark:bg-amber-500 rounded-full w-full"></div>
              </div>
            )}
          </div>

          {/* Expandable Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                  <div className="text-center bg-white/60 dark:bg-gray-800/40 rounded-md p-1">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="h-2 w-2 text-green-500" />
                      <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {progress.daysCovered}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 leading-none mt-0.5">
                      Days
                    </div>
                  </div>
                  
                  <div className="text-center bg-white/60 dark:bg-gray-800/40 rounded-md p-1">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-2 w-2 text-orange-500" />
                      <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {progress.remainingDays}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 leading-none mt-0.5">
                      Left
                    </div>
                  </div>
                  
                  <div className="text-center bg-white/60 dark:bg-gray-800/40 rounded-md p-1">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="h-2 w-2 text-blue-500" />
                      <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {progress.totalDays}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 leading-none mt-0.5">
                      Total
                    </div>
                  </div>
                </div>

                {/* Date Range */}
                <div className="pt-1.5 border-t border-blue-200/50 dark:border-blue-800/50">
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">📅</span>
                      <span>
                        {new Date(progress.currentTerm.startDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <span className="text-gray-400">→</span>
                    <div className="flex items-center gap-1">
                      <span>
                        {new Date(progress.currentTerm.endDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </span>
                      <span className="text-gray-400">🏁</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
} 