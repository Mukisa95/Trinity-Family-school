"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FeeStructure, AcademicYear } from "@/types";
import { formatCurrency, formatMoneyInput, parseFormattedMoney } from "@/lib/utils";
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';

interface PivotDiscountFormProps {
  targetFeeId: string;
  feeItems: FeeStructure[];
  academicYears: AcademicYear[];
  onOpenSave: (data: {
    name: string;
    amount: number;
    description?: string;
    linkedFeeIds: string[];
  }) => void;
  onCloseSave: (data: {
    name: string;
    amount: number;
    description?: string;
    linkedFeeIds: string[];
  }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function PivotDiscountForm({
  targetFeeId,
  feeItems,
  academicYears,
  onOpenSave,
  onCloseSave,
  onCancel,
  isSaving = false,
}: PivotDiscountFormProps) {
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState<number | string>("");
  const [description, setDescription] = React.useState("");
  const [linkedFeeIds, setLinkedFeeIds] = React.useState<string[]>(
    targetFeeId ? [targetFeeId] : []
  );
  const validationFields = React.useMemo(() => [
    createFieldValidation('pivotDiscountName', name, 'Discount Name', true, { message: 'Enter the discount name.' }),
    createFieldValidation('pivotDiscountAmount', amount, 'Discount Amount', true, {
      message: 'Enter the discount amount.',
      validate: (value) => parseFormattedMoney(String(value || '')) > 0 ? undefined : 'Enter an amount greater than zero.',
    }),
    createFieldValidation('pivotLinkedFeeIds', linkedFeeIds, 'Linked Fee Items', true, { message: 'Choose at least one fee item to link.' }),
  ], [amount, linkedFeeIds, name]);
  const formValidation = useFormValidation(validationFields);

  // Auto-fill target fee check on mount / change
  React.useEffect(() => {
    if (targetFeeId && !linkedFeeIds.includes(targetFeeId)) {
      setLinkedFeeIds((prev) => [...prev, targetFeeId]);
    }
  }, [targetFeeId]);

  const getTermName = (feeItem: FeeStructure): string => {
    if (!feeItem.termId) return "No Term";
    const academicYear = academicYears.find((year) =>
      year.terms.some((term) => term.id === feeItem.termId)
    );
    if (!academicYear) return "Unknown Term";
    const term = academicYear.terms.find((term) => term.id === feeItem.termId);
    return term ? `${term.name} (${academicYear.name})` : "Unknown Term";
  };

  const validateAndGetData = () => {
    const numericAmount = parseFormattedMoney(
      typeof amount === "string" ? amount : amount.toString()
    );
    if (!formValidation.validateAll().isValid) return null;
    return {
      name: name.toUpperCase().trim(),
      amount: numericAmount,
      description: description.toUpperCase().trim() || undefined,
      linkedFeeIds,
    };
  };

  const handleOpenSaveClick = () => {
    const data = validateAndGetData();
    if (data) {
      onOpenSave(data);
    }
  };

  const handleCloseSaveClick = () => {
    const data = validateAndGetData();
    if (data) {
      onCloseSave(data);
    }
  };

  return (
    <div className="border border-indigo-100 rounded-lg bg-indigo-50/20 p-4 space-y-4">
      <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
      <div className="flex items-center justify-between border-b pb-2 border-indigo-50">
        <h4 className="text-sm font-semibold text-indigo-900">
          Create Pivot Discount (Custom)
        </h4>
        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-medium px-2 py-0.5 rounded-full">
          Bespoke Discount
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="pivotDiscountName" className="text-xs font-semibold">
            Discount Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pivotDiscountName"
            value={name}
            onChange={(e) => { setName(e.target.value.toUpperCase()); formValidation.handleFieldChange('pivotDiscountName'); }}
            {...formValidation.getFieldProps('pivotDiscountName')}
            placeholder="e.g. SPECIAL SIBLING DISCOUNT"
            className="h-9 text-xs"
          />
          <FieldError error={formValidation.getFieldError('pivotDiscountName')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pivotDiscountAmount" className="text-xs font-semibold">
            Discount Amount <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pivotDiscountAmount"
            type="text"
            value={
              typeof amount === "string"
                ? amount
                : formatMoneyInput(amount.toString())
            }
            onChange={(e) => { setAmount(formatMoneyInput(e.target.value)); formValidation.handleFieldChange('pivotDiscountAmount'); }}
            {...formValidation.getFieldProps('pivotDiscountAmount')}
            placeholder="Enter discount amount"
            className="h-9 text-xs"
          />
          <FieldError error={formValidation.getFieldError('pivotDiscountAmount')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">
          Linked Fee Items <span className="text-destructive">*</span>
        </Label>
        <ScrollArea id="pivotLinkedFeeIds" tabIndex={-1} aria-invalid={Boolean(formValidation.getFieldError('pivotLinkedFeeIds'))} aria-describedby={formValidation.getFieldError('pivotLinkedFeeIds') ? 'pivotLinkedFeeIds-error' : undefined} className="h-[120px] w-full rounded-md border bg-white p-2.5 aria-invalid:border-red-600 aria-invalid:bg-red-50/70 aria-invalid:ring-2 aria-invalid:ring-red-200">
          <div className="space-y-2">
            {feeItems
              .filter(
                (item) => item.status === "active" && item.category !== "Discount"
              )
              .map((item) => (
                <div key={item.id} className="flex items-start space-x-2">
                  <Checkbox
                    id={`pivot-fee-${item.id}`}
                    checked={linkedFeeIds.includes(item.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setLinkedFeeIds((prev) => [...prev, item.id]);
                      } else {
                        setLinkedFeeIds((prev) =>
                          prev.filter((id) => id !== item.id)
                        );
                      }
                      formValidation.handleFieldChange('pivotLinkedFeeIds');
                    }}
                  />
                  <Label
                    htmlFor={`pivot-fee-${item.id}`}
                    className="text-xs font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {item.name} ({formatCurrency(item.amount)}) - {getTermName(item)}
                  </Label>
                </div>
              ))}
            {feeItems.filter(
              (item) => item.status === "active" && item.category !== "Discount"
            ).length === 0 && (
              <div className="text-xs text-muted-foreground p-1">
                No active fee items to link
              </div>
            )}
          </div>
        </ScrollArea>
        <FieldError error={formValidation.getFieldError('pivotLinkedFeeIds')} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pivotDiscountDescription" className="text-xs font-semibold">
          Reason/Description
        </Label>
        <Textarea
          id="pivotDiscountDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value.toUpperCase())}
          placeholder="Reason for this bespoke discount..."
          rows={2}
          className="text-xs resize-none"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-indigo-50 sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          className="h-8 text-xs order-3 sm:order-1"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCloseSaveClick}
          disabled={isSaving}
          className="h-8 text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 order-2"
          title="Save only to this pupil's assignment list"
        >
          Close Save (Pupil Only)
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleOpenSaveClick}
          disabled={isSaving}
          className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white order-1 sm:order-3"
          title="Save globally for all pupils to use"
        >
          {isSaving ? "Saving..." : "Open Save (Global)"}
        </Button>
      </div>
    </div>
  );
}
