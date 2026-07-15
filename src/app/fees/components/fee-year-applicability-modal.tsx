"use client";

import * as React from "react";
import { CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from "@/components/ui/modern-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getApplicableYearIds } from "@/lib/utils/fee-applicability";
import type { AcademicYear, FeeStructure } from "@/types";

interface FeeYearApplicabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  fee: FeeStructure | null;
  academicYears: AcademicYear[];
  onSave: (feeId: string, effectiveYears: string[]) => Promise<boolean>;
}

const FeeYearApplicabilityModal: React.FC<FeeYearApplicabilityModalProps> = ({
  isOpen,
  onClose,
  fee,
  academicYears,
  onSave,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedYearIds, setSelectedYearIds] = React.useState<string[]>([]);

  const sortedAcademicYears = React.useMemo(
    () => [...academicYears].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    ),
    [academicYears]
  );

  const getDefaultApplicableYearIds = React.useCallback(() => {
    if (!fee) return [];
    return getApplicableYearIds(fee, sortedAcademicYears);
  }, [fee, sortedAcademicYears]);

  React.useEffect(() => {
    if (!isOpen) return;
    setIsEditing(false);
    setSelectedYearIds(getDefaultApplicableYearIds());
  }, [isOpen, getDefaultApplicableYearIds]);

  const toggleYear = (yearId: string, isApplicable: boolean) => {
    setSelectedYearIds(current => isApplicable
      ? [...current, yearId]
      : current.filter(id => id !== yearId)
    );
  };

  const handleCancelEdit = () => {
    setSelectedYearIds(getDefaultApplicableYearIds());
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!fee) return;
    setIsSaving(true);
    const didSave = await onSave(fee.id, selectedYearIds);
    setIsSaving(false);
    if (didSave) onClose();
  };

  if (!fee) return null;

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModernDialogContent size="lg">
        <ModernDialogHeader>
          <ModernDialogTitle>Year Applicability: {fee.name}</ModernDialogTitle>
          <ModernDialogDescription>
            Applicable years are active for this fee. Years shown with a strike-through are not applicable.
          </ModernDialogDescription>
        </ModernDialogHeader>

        <div className="max-h-[55vh] overflow-y-auto py-2 pr-1">
          <div className="grid gap-2 sm:grid-cols-2">
            {sortedAcademicYears.map(year => {
              const isApplicable = selectedYearIds.includes(year.id);
              const checkboxId = `fee-${fee.id}-year-${year.id}`;

              return (
                <div
                  key={year.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    isApplicable ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50 text-slate-500"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {isEditing ? (
                      <Checkbox
                        id={checkboxId}
                        checked={isApplicable}
                        onCheckedChange={(checked) => toggleYear(year.id, checked === true)}
                        aria-label={`${isApplicable ? 'Remove' : 'Add'} ${year.name} applicability`}
                      />
                    ) : (
                      <CheckCircle2 className={cn("h-4 w-4 shrink-0", isApplicable ? "text-emerald-600" : "text-slate-400")} />
                    )}
                    <label
                      htmlFor={isEditing ? checkboxId : undefined}
                      className={cn("font-medium", isEditing && "cursor-pointer", !isApplicable && "line-through")}
                    >
                      {year.name}
                    </label>
                  </div>
                  <Badge variant={isApplicable ? "default" : "outline"} className={cn(!isApplicable && "text-slate-500")}> 
                    {isApplicable ? "Applicable" : "Not applicable"}
                  </Badge>
                </div>
              );
            })}
          </div>

          {sortedAcademicYears.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No academic years are available.</p>
          )}
        </div>

        <ModernDialogFooter>
          {isEditing ? (
            <>
              <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSaving}>Cancel</Button>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Applicability"}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
              <Button type="button" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Years
              </Button>
            </>
          )}
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
};

export default FeeYearApplicabilityModal;
