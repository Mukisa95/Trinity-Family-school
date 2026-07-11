'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import type { AcademicYear, FeeValidityType, TermApplicabilityType } from '@/types';

export interface AssignmentTimeManagementFormData {
  validityType: FeeValidityType;
  startAcademicYearId?: string;
  endAcademicYearId?: string;
  termApplicability: TermApplicabilityType;
  applicableTermIds?: string[];
  allowedTermIds?: string[];
}

export const DEFAULT_ASSIGNMENT_TIME_SETTINGS: AssignmentTimeManagementFormData = {
  validityType: 'indefinite',
  termApplicability: 'all_terms',
};

interface AssignmentTimeManagementFormProps {
  academicYears: AcademicYear[];
  settings: AssignmentTimeManagementFormData;
  onSettingsChange: (settings: AssignmentTimeManagementFormData) => void;
}

export function AssignmentTimeManagementForm({
  academicYears,
  settings,
  onSettingsChange,
}: AssignmentTimeManagementFormProps) {
  const effectiveTermData = useMemo(() => {
    if (!academicYears.length) return null;
    return getEffectiveTermForDataDisplay(academicYears);
  }, [academicYears]);

  const currentAcademicYear = effectiveTermData?.academicYear ?? undefined;
  const currentTerm = effectiveTermData?.term ?? undefined;

  const sortedAcademicYears = useMemo(
    () => [...academicYears].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    [academicYears]
  );

  const [expandedYearIds, setExpandedYearIds] = useState<Set<string>>(() => new Set());
  const yearRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const expandAndScrollToYear = useCallback((yearId: string) => {
    setExpandedYearIds((prev) => new Set([...prev, yearId]));
    requestAnimationFrame(() => {
      setTimeout(() => {
        yearRefs.current[yearId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
    });
  }, []);

  const applyValidityTypeToSettings = useCallback(
    (prev: AssignmentTimeManagementFormData, validityType: FeeValidityType): AssignmentTimeManagementFormData => {
      if (!currentAcademicYear) return { ...prev, validityType };

      if (validityType === 'current_term' && currentTerm) {
        const isAllowed = prev.allowedTermIds ? prev.allowedTermIds.includes(currentTerm.id) : true;
        return {
          ...prev,
          validityType,
          termApplicability: 'specific_terms',
          applicableTermIds: isAllowed ? [currentTerm.id] : [],
          startAcademicYearId: currentAcademicYear.id,
        };
      }

      if (validityType === 'current_year') {
        let terms = currentAcademicYear.terms?.map((t) => t.id) || [];
        if (prev.allowedTermIds) {
          terms = terms.filter(id => prev.allowedTermIds!.includes(id));
        }
        return {
          ...prev,
          validityType,
          startAcademicYearId: currentAcademicYear.id,
          termApplicability: 'specific_terms',
          applicableTermIds: terms,
        };
      }

      if (validityType === 'indefinite') {
        return { 
          ...prev, 
          validityType, 
          applicableTermIds: prev.allowedTermIds ? [...prev.allowedTermIds] : undefined 
        };
      }

      return { ...prev, validityType };
    },
    [currentAcademicYear, currentTerm]
  );

  useEffect(() => {
    if (!currentAcademicYear) return;
    if (settings.validityType !== 'current_term' && settings.validityType !== 'current_year') return;

    const synced = applyValidityTypeToSettings(settings, settings.validityType);
    const changed =
      synced.applicableTermIds?.join(',') !== settings.applicableTermIds?.join(',') ||
      synced.startAcademicYearId !== settings.startAcademicYearId ||
      synced.termApplicability !== settings.termApplicability;

    if (changed) {
      onSettingsChange(synced);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when effective period resolves, not on every settings tick
  }, [currentAcademicYear?.id, currentTerm?.id, settings.validityType]);

  useEffect(() => {
    if (
      (settings.validityType === 'current_term' || settings.validityType === 'current_year') &&
      currentAcademicYear
    ) {
      expandAndScrollToYear(currentAcademicYear.id);
    } else if (settings.allowedTermIds && settings.allowedTermIds.length > 0) {
      // If we have allowed terms (e.g. from a discount), expand the years containing those terms
      academicYears.forEach(year => {
        if (year.terms.some(t => settings.allowedTermIds?.includes(t.id))) {
          expandAndScrollToYear(year.id);
        }
      });
    } else if (settings.applicableTermIds && settings.applicableTermIds.length > 0) {
       // Also expand if there are specific applicable terms selected
       academicYears.forEach(year => {
        if (year.terms.some(t => settings.applicableTermIds?.includes(t.id))) {
          expandAndScrollToYear(year.id);
        }
      });
    }
  }, [settings.validityType, settings.allowedTermIds, settings.applicableTermIds, currentAcademicYear, academicYears, expandAndScrollToYear]);

  const handleValidityTypeChange = (value: FeeValidityType) => {
    const next = applyValidityTypeToSettings(settings, value);
    onSettingsChange(next);

    if ((value === 'current_term' || value === 'current_year') && currentAcademicYear) {
      expandAndScrollToYear(currentAcademicYear.id);
    }
  };

  const lockTermSelection =
    settings.validityType === 'current_term' || settings.validityType === 'current_year';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Validity Period</Label>
          <Select value={settings.validityType} onValueChange={handleValidityTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select validity period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="indefinite">Indefinite</SelectItem>
              {(!settings.allowedTermIds || (currentTerm && settings.allowedTermIds.includes(currentTerm.id))) && (
                <SelectItem value="current_term">Current Term Only</SelectItem>
              )}
              <SelectItem value="current_year">Current Academic Year</SelectItem>
              <SelectItem value="specific_year">Specific Academic Year</SelectItem>
              <SelectItem value="year_range">Range of Years</SelectItem>
              <SelectItem value="specific_terms">Specific Terms</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Term Applicability</Label>
          <Select
            value={settings.termApplicability}
            onValueChange={(value: TermApplicabilityType) =>
              onSettingsChange({ ...settings, termApplicability: value })
            }
            disabled={lockTermSelection || (settings.allowedTermIds && settings.allowedTermIds.length > 0)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select term applicability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_terms" disabled={!!(settings.allowedTermIds && settings.allowedTermIds.length > 0)}>All Terms</SelectItem>
              <SelectItem value="specific_terms">Specific Terms</SelectItem>
            </SelectContent>
          </Select>
          {lockTermSelection && (
            <p className="mt-1 text-xs text-muted-foreground">
              Term selection is set automatically for the current period
            </p>
          )}
        </div>
      </div>

      {(settings.validityType === 'specific_year' || settings.validityType === 'year_range') && (
        <div className={`grid grid-cols-1 ${settings.validityType === 'year_range' ? 'sm:grid-cols-2' : ''} gap-4`}>
          <div>
            <Label>Start Academic Year</Label>
            <Select
              value={settings.startAcademicYearId || ''}
              onValueChange={(value) => onSettingsChange({ ...settings, startAcademicYearId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select start year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {settings.validityType === 'year_range' && (
            <div>
              <Label>End Academic Year</Label>
              <Select
                value={settings.endAcademicYearId || ''}
                onValueChange={(value) => onSettingsChange({ ...settings, endAcademicYearId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select end year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {settings.termApplicability === 'specific_terms' && (
        <div>
          <Label>Select Applicable Terms</Label>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-1.5">
            {sortedAcademicYears.map((year) => {
              const isExpanded = expandedYearIds.has(year.id);
              const isCurrentYear = year.id === currentAcademicYear?.id;
              const selectedInYear = year.terms.filter((t) =>
                settings.applicableTermIds?.includes(t.id)
              ).length;
              
              if (settings.allowedTermIds) {
                const hasAllowedTerms = year.terms.some(t => settings.allowedTermIds!.includes(t.id));
                if (!hasAllowedTerms) return null;
              }

              return (
                <div
                  key={year.id}
                  ref={(el) => {
                    yearRefs.current[year.id] = el;
                  }}
                  className="scroll-mt-1 overflow-hidden rounded-md border border-slate-200/80 bg-white"
                >
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={(open) => {
                      setExpandedYearIds((prev) => {
                        const next = new Set(prev);
                        if (open) next.add(year.id);
                        else next.delete(year.id);
                        return next;
                      });
                    }}
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50">
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate">{year.name}</span>
                        {isCurrentYear && (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-indigo-200 bg-indigo-50 text-[10px] text-indigo-700"
                          >
                            Current year
                          </Badge>
                        )}
                        {selectedInYear > 0 && (
                          <span className="shrink-0 text-[10px] font-normal text-muted-foreground">
                            {selectedInYear} selected
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-slate-100 px-2 pb-2 pt-1">
                      {year.terms.map((term) => {
                        const isAllowed = settings.allowedTermIds ? settings.allowedTermIds.includes(term.id) : true;
                        if (!isAllowed) return null;

                        const isChecked = settings.applicableTermIds?.includes(term.id) || false;
                        const isCurrentTerm = isCurrentYear && term.id === currentTerm?.id;
                        const checkboxId = `assign-time-term-${year.id}-${term.id}`;
                        const isCheckboxDisabled = lockTermSelection;

                        return (
                          <div
                            key={term.id}
                            className={`flex items-center space-x-2 rounded-md py-1 pl-1 pr-0.5 ${isCurrentTerm && isChecked ? 'bg-indigo-50' : ''}`}
                          >
                            <Checkbox
                              id={checkboxId}
                              checked={isChecked}
                              disabled={isCheckboxDisabled}
                              onCheckedChange={(checked) => {
                                if (isCheckboxDisabled) return;
                                const currentTermIds = settings.applicableTermIds || [];
                                const newTermIds = checked
                                  ? [...currentTermIds, term.id]
                                  : currentTermIds.filter((id) => id !== term.id);
                                onSettingsChange({ ...settings, applicableTermIds: newTermIds });
                              }}
                            />
                            <Label
                              htmlFor={checkboxId}
                              className={`text-sm ${isCurrentTerm ? 'font-medium text-indigo-800' : ''}`}
                            >
                              {term.name}
                              {isCurrentTerm && (
                                <span className="ml-1.5 text-[10px] font-normal text-indigo-600">
                                  (current)
                                </span>
                              )}
                            </Label>
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
