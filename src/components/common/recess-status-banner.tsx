"use client";

import React, { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useCurrentAcademicPeriod } from '@/lib/hooks/use-term-status';
import { Button } from '@/components/ui/button';

interface RecessStatusBannerProps {
  className?: string;
}

export function RecessStatusBanner({ className = '' }: RecessStatusBannerProps) {
  const {
    isInRecess,
    isHoliday,
    shouldShowPreviousTermData,
    recessInfo,
    previousTerm,
    nextTerm,
    academicYears,
    isLoading
  } = useCurrentAcademicPeriod();

  const [isExpanded, setIsExpanded] = useState(false);

  // Keep the collapsed banner short while retaining the full details below.
  const compactMessage = React.useMemo(() => {
    if (!nextTerm?.startDate) {
      return 'Term Recess · Next term date pending';
    }

    const nextTermDate = new Date(nextTerm.startDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const daysUntilNextTerm = Math.max(0, recessInfo.daysUntilNextTerm || 0);
    const countdown = daysUntilNextTerm === 0
      ? 'today'
      : `in ${daysUntilNextTerm} day${daysUntilNextTerm === 1 ? '' : 's'}`;

    return `Term Recess · Next term starts ${countdown} (${nextTermDate})`;
  }, [nextTerm, recessInfo.daysUntilNextTerm]);

  // Don't show banner if academic years haven't loaded yet,
  // or if we're confirmed in term (not in recess/holiday).
  // IMPORTANT: also suppress when academicYears is empty — that means data isn't ready yet
  // even if isLoading is false (TanStack returns false immediately when initialData is provided).
  const hasConfirmedData = !isLoading && Array.isArray(academicYears) && academicYears.length > 0;
  if (!hasConfirmedData || (!isInRecess && !isHoliday)) {
    return null;
  }

  return (
    <Alert
      className={`border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer ${
        isExpanded ? 'px-4 py-3' : 'px-3 py-2'
      } ${className}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-shrink-0">
            {isInRecess ? (
              <CalendarDays className="h-4 w-4 text-amber-600" />
            ) : (
              <Info className="h-4 w-4 text-amber-600" />
            )}
          </div>

          <AlertDescription className="text-xs font-medium leading-snug text-amber-800 sm:text-sm">
            {compactMessage}
          </AlertDescription>
        </div>

        <div className="flex items-center gap-2">
          {isExpanded && (
            <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs">
              {isInRecess ? 'Recess' : 'Holiday'}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-200"
            aria-label={isExpanded ? 'Collapse recess details' : 'Expand recess details'}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-amber-200 space-y-2 text-sm text-amber-700">
          {shouldShowPreviousTermData && previousTerm && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Displaying data from:</span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                {previousTerm.name}
              </Badge>
            </div>
          )}

          {nextTerm && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Next term:</span>
              <Badge variant="outline" className="border-amber-300 text-amber-700">
                {nextTerm.name}
              </Badge>
              {nextTerm.startDate && (
                <span className="text-xs text-amber-600">
                  (starts {new Date(nextTerm.startDate).toLocaleDateString()})
                </span>
              )}
            </div>
          )}

          {isInRecess && recessInfo.recessType && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Recess type:</span>
              <span className="text-amber-600">
                {recessInfo.recessType === 'mid-term' ? 'Mid-term break' : 'End of year break'}
              </span>
            </div>
          )}

          {isInRecess && recessInfo.daysInRecess > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-amber-600" />
              <span className="text-amber-600">
                {recessInfo.daysInRecess} day{recessInfo.daysInRecess !== 1 ? 's' : ''} total recess period
              </span>
            </div>
          )}
        </div>
      )}
    </Alert>
  );
}

export default RecessStatusBanner;
