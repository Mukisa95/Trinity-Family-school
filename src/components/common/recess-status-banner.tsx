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
    periodMessage,
    detailedMessage,
    recessInfo,
    currentTerm,
    previousTerm,
    nextTerm,
    academicYears,
    isLoading
  } = useCurrentAcademicPeriod();

  const [isExpanded, setIsExpanded] = useState(false);

  // Use the detailed message for better display
  const displayMessage = detailedMessage?.message || periodMessage;

  // Create a compact, direct message
  const compactMessage = React.useMemo(() => {
    if (!previousTerm) return displayMessage;

    const termEndDate = previousTerm.endDate ? new Date(previousTerm.endDate) : null;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let whenEnded = '';
    if (termEndDate) {
      if (termEndDate.toDateString() === today.toDateString()) {
        whenEnded = 'today';
      } else if (termEndDate.toDateString() === yesterday.toDateString()) {
        whenEnded = 'yesterday';
      } else {
        whenEnded = `on ${termEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      }
    }

    const nextTermStart = nextTerm?.startDate ?
      new Date(nextTerm.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) :
      'TBD';

    return `${previousTerm.name} has ended ${whenEnded} and holidays have begun. Next term starts ${nextTermStart}.`;
  }, [previousTerm, nextTerm, displayMessage]);

  // Don't show banner if academic years haven't loaded yet,
  // or if we're confirmed in term (not in recess/holiday).
  // IMPORTANT: also suppress when academicYears is empty — that means data isn't ready yet
  // even if isLoading is false (TanStack returns false immediately when initialData is provided).
  const hasConfirmedData = !isLoading && Array.isArray(academicYears) && academicYears.length > 0;
  if (!hasConfirmedData || (!isInRecess && !isHoliday)) {
    return null;
  }

  return (
    <Alert className={`border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer ${className}`} onClick={() => setIsExpanded(!isExpanded)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-shrink-0">
            {isInRecess ? (
              <CalendarDays className="h-4 w-4 text-amber-600" />
            ) : (
              <Info className="h-4 w-4 text-amber-600" />
            )}
          </div>

          <AlertDescription className="text-amber-800 font-medium text-sm">
            {compactMessage}
          </AlertDescription>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs">
            {isInRecess ? 'Recess' : 'Holiday'}
          </Badge>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-200"
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
