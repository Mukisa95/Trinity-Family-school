'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from '@/components/ui/modern-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { AcademicYear, PupilAssignedFee } from '@/types';
import {
  getAssignmentPushFetchOptions,
  applyAssignmentToTerm,
  validatePushTarget,
  type AssignmentTermMoveAction,
  type TermTarget,
} from '@/lib/utils/assignment-term-push';

interface AssignmentPushFetchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: PupilAssignedFee | null;
  feeName: string;
  academicYears: AcademicYear[];
  onApply: (updated: PupilAssignedFee, action: AssignmentTermMoveAction, targetLabel: string) => void;
}

export function AssignmentPushFetchModal({
  open,
  onOpenChange,
  assignment,
  feeName,
  academicYears,
  onApply,
}: AssignmentPushFetchModalProps) {
  const [mode, setMode] = useState<AssignmentTermMoveAction | null>(null);
  const [customTarget, setCustomTarget] = useState<TermTarget | null>(null);
  const [expandedYearIds, setExpandedYearIds] = useState<Set<string>>(() => new Set());

  const options = useMemo(() => {
    if (!assignment) return null;
    return getAssignmentPushFetchOptions(assignment, academicYears);
  }, [assignment, academicYears]);

  const sortedYears = useMemo(
    () =>
      [...academicYears]
        .filter((y) => options?.customTargets.some((t) => t.yearId === y.id))
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    [academicYears, options?.customTargets]
  );

  const resetSelection = () => {
    setMode(null);
    setCustomTarget(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetSelection();
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (!assignment || !mode) return;

    let yearId: string;
    let termId: string;
    let label: string;

    if (mode === 'push' && options?.push) {
      yearId = options.push.target.yearId;
      termId = options.push.target.termId;
      label = options.push.target.label;
    } else if (mode === 'fetch' && options?.fetch) {
      yearId = options.fetch.target.yearId;
      termId = options.fetch.target.termId;
      label = options.fetch.target.label;
    } else if (mode === 'custom' && customTarget) {
      yearId = customTarget.yearId;
      termId = customTarget.termId;
      label = customTarget.label;
    } else {
      return;
    }

    const validation = validatePushTarget(yearId, termId, academicYears);
    if (!validation.valid) return;

    const updated = applyAssignmentToTerm(
      assignment,
      yearId,
      termId,
      academicYears,
      mode
    );
    onApply(updated, mode, label);
    handleOpenChange(false);
  };

  const canConfirm =
    mode === 'push'
      ? !!options?.push
      : mode === 'fetch'
        ? !!options?.fetch
        : mode === 'custom'
          ? !!customTarget
          : false;

  const hasQuickActions = !!(options?.push || options?.fetch);

  return (
    <ModernDialog open={open} onOpenChange={handleOpenChange}>
      <ModernDialogContent size="md">
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
            Push / Fetch Assignment
          </ModernDialogTitle>
          <ModernDialogDescription>
            Extend <span className="font-medium text-foreground">{feeName}</span> to another term without
            removing its existing term coverage.
          </ModernDialogDescription>
        </ModernDialogHeader>

        {options && assignment && (
          <div className="space-y-4 py-2">
            {options.assignmentTermRef && options.currentTermRef && (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Assignment applies to{' '}
                <span className="font-semibold">
                  {options.assignmentTermRef.term.name}, {options.assignmentTermRef.year.name}
                </span>
                . Current period:{' '}
                <span className="font-semibold">
                  {options.currentTermRef.term.name}, {options.currentTermRef.year.name}
                </span>
                .
              </p>
            )}

            {hasQuickActions && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick actions</Label>
                <div className="space-y-2">
                  {options.push && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('push');
                        setCustomTarget(null);
                      }}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        mode === 'push'
                          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                          : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-medium text-indigo-900">
                        Push to {options.push.target.label}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {options.push.description}
                      </div>
                    </button>
                  )}

                  {options.fetch && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('fetch');
                        setCustomTarget(null);
                      }}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        mode === 'fetch'
                          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                          : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-medium text-indigo-900">
                        Fetch to {options.fetch.target.label}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {options.fetch.description}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Custom target</Label>
              <button
                type="button"
                onClick={() => setMode('custom')}
                className={`mb-2 w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  mode === 'custom'
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                    : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-medium">Choose academic year and term</span>
              </button>

              {mode === 'custom' && (
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-1.5">
                  {sortedYears.map((year) => {
                    const isExpanded = expandedYearIds.has(year.id);
                    const yearTargets = options.customTargets.filter((t) => t.yearId === year.id);
                    const selectedInYear = yearTargets.filter(
                      (t) =>
                        customTarget?.yearId === t.yearId && customTarget?.termId === t.termId
                    ).length;

                    return (
                      <div
                        key={year.id}
                        className="overflow-hidden rounded-md border border-slate-200/80 bg-white"
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
                              {selectedInYear > 0 && (
                                <span className="shrink-0 text-[10px] font-normal text-muted-foreground">
                                  selected
                                </span>
                              )}
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="border-t border-slate-100 px-2 pb-2 pt-1">
                            {year.terms.map((term) => {
                              const target = yearTargets.find((t) => t.termId === term.id);
                              if (!target) return null;

                              const isChecked =
                                customTarget?.yearId === target.yearId &&
                                customTarget?.termId === target.termId;
                              const checkboxId = `push-fetch-term-${year.id}-${term.id}`;

                              return (
                                <div
                                  key={term.id}
                                  className={`flex items-center space-x-2 rounded-md py-1 pl-1 pr-0.5 ${isChecked ? 'bg-indigo-50' : ''}`}
                                >
                                  <Checkbox
                                    id={checkboxId}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      if (checked) setCustomTarget(target);
                                      else if (isChecked) setCustomTarget(null);
                                    }}
                                  />
                                  <Label htmlFor={checkboxId} className="text-sm">
                                    {term.name}
                                  </Label>
                                </div>
                              );
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  })}
                  {options.customTargets.length === 0 && (
                    <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                      No additional terms are available for this unlocked academic period.
                    </p>
                  )}
                </div>
              )}
            </div>

            {!hasQuickActions && options.customTargets.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No push or fetch actions are available for this assignment right now. All target terms may
                already be covered or belong to locked academic years.
              </p>
            )}
          </div>
        )}

        <ModernDialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm} className="bg-indigo-600 hover:bg-indigo-700">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Apply
          </Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
}
