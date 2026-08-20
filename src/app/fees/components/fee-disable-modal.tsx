"use client";

import * as React from "react";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogDescription,
  ModernDialogFooter,
} from "@/components/ui/modern-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { FeeStructure, AcademicYear } from "@/types"; // Removed Term as it's not used
import { useToast } from "@/hooks/use-toast";
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';

type DisableTypeOption = 'immediate_indefinite' | 'from_year_onwards' | 'year_range';

interface FeeDisableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    feeId: string, 
    reason: string, 
    effectiveDate: string, // Date of taking the action
    disableType: DisableTypeOption, 
    startYearId?: string, 
    endYearId?: string
  ) => void;
  feeToDisable: FeeStructure | null;
  academicYears: AcademicYear[]; // To populate year dropdowns, including historical years
}

const FeeDisableModal: React.FC<FeeDisableModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  feeToDisable,
  academicYears,
}) => {
  const { toast } = useToast();
  const [reason, setReason] = React.useState("");
  const [disableType, setDisableType] = React.useState<DisableTypeOption>('immediate_indefinite');
  const [selectedStartYearId, setSelectedStartYearId] = React.useState<string | undefined>(undefined);
  const [selectedEndYearId, setSelectedEndYearId] = React.useState<string | undefined>(undefined);
  const validationFields = React.useMemo(() => [
    createFieldValidation('disableReason', reason, 'Reason for Disabling', true, { message: 'Enter the reason for disabling this fee.' }),
    createFieldValidation('selectedStartYearId', selectedStartYearId, 'Start Year', true, {
      active: disableType === 'from_year_onwards' || disableType === 'year_range',
      message: 'Choose the starting academic year.',
    }),
    createFieldValidation('selectedEndYearId', selectedEndYearId, 'End Year', true, {
      active: disableType === 'year_range',
      message: 'Choose the ending academic year.',
      validate: () => {
        const startYear = academicYears.find((year) => year.id === selectedStartYearId);
        const endYear = academicYears.find((year) => year.id === selectedEndYearId);
        return startYear && endYear && parseInt(endYear.name) < parseInt(startYear.name)
          ? 'Choose an end year that is not before the start year.'
          : undefined;
      },
    }),
  ], [academicYears, disableType, reason, selectedEndYearId, selectedStartYearId]);
  const formValidation = useFormValidation(validationFields);

  // Historical years must remain available for backdated fee disable records.
  const availableYearsForSelection = React.useMemo(() => {
    return [...academicYears].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  }, [academicYears]);

  React.useEffect(() => {
    if (!isOpen) {
      setReason("");
      setDisableType('immediate_indefinite');
      setSelectedStartYearId(undefined);
      setSelectedEndYearId(undefined);
    } else {
      // Pre-select if needed or keep undefined
       setSelectedStartYearId(availableYearsForSelection[0]?.id);
       setSelectedEndYearId(availableYearsForSelection[0]?.id);
    }
  }, [isOpen, availableYearsForSelection]);


  const handleSubmit = () => {
    if (!feeToDisable) {
      toast({ variant: "destructive", title: "Error", description: "No fee item selected to disable." });
      return;
    }
    const validation = formValidation.validateAll();
    if (!validation.isValid) return;
    
    const effectiveDate = new Date().toISOString(); 
    onSubmit(
      feeToDisable.id, 
      reason, 
      effectiveDate, 
      disableType,
      (disableType === 'from_year_onwards' || disableType === 'year_range') ? selectedStartYearId : undefined,
      disableType === 'year_range' ? selectedEndYearId : undefined
    );
  };

  if (!feeToDisable) return null;

  return (
    <ModernDialog open={isOpen} onOpenChange={onClose}>
      <ModernDialogContent size="lg">
        <ModernDialogHeader>
          <ModernDialogTitle>Disable Fee: {feeToDisable.name}</ModernDialogTitle>
          <ModernDialogDescription>
            Specify how and why this fee item should be disabled. The fee status will be set to 'disabled'.
          </ModernDialogDescription>
        </ModernDialogHeader>
        <div className="py-4 space-y-4">
          <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
          <div>
            <Label htmlFor="disableType" className="text-sm font-medium">Disable Type</Label>
            <RadioGroup
              id="disableType"
              value={disableType}
              onValueChange={(value) => setDisableType(value as DisableTypeOption)}
              className="mt-1 space-y-2"
            >
              <Label htmlFor="immediate_indefinite" className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 cursor-pointer has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                <RadioGroupItem value="immediate_indefinite" id="immediate_indefinite" />
                <span>Disable Now (Current & Future Years)</span>
              </Label>
              <Label htmlFor="from_year_onwards" className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 cursor-pointer has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                <RadioGroupItem value="from_year_onwards" id="from_year_onwards" />
                <span>Disable From Specific Year Onwards</span>
              </Label>
              <Label htmlFor="year_range" className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 cursor-pointer has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                <RadioGroupItem value="year_range" id="year_range" />
                <span>Disable For Specific Year Range</span>
              </Label>
            </RadioGroup>
          </div>

          {disableType === 'from_year_onwards' && (
            <div className="space-y-3 p-3 border rounded-md bg-muted/30">
              <h4 className="text-xs font-medium text-muted-foreground">Specify Start Year</h4>
              <div>
                <Label htmlFor="selectedStartYearId">Start Disable From Year</Label>
                <Select value={selectedStartYearId} onValueChange={(value) => { setSelectedStartYearId(value); formValidation.handleFieldChange('selectedStartYearId'); }}>
                  <SelectTrigger id="selectedStartYearId" {...formValidation.getFieldProps('selectedStartYearId')}>
                    <SelectValue placeholder="Select start year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYearsForSelection.map(ay => (
                      <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                    ))}
                     {availableYearsForSelection.length === 0 && <SelectItem value="no-years" disabled>No academic years available</SelectItem>}
                  </SelectContent>
                </Select>
                <FieldError error={formValidation.getFieldError('selectedStartYearId')} />
              </div>
            </div>
          )}

          {disableType === 'year_range' && (
            <div className="space-y-3 p-3 border rounded-md bg-muted/30">
              <h4 className="text-xs font-medium text-muted-foreground">Specify Year Range</h4>
              <div>
                <Label htmlFor="selectedRangeStartYearId">Start Disable Year</Label>
                <Select value={selectedStartYearId} onValueChange={(value) => { setSelectedStartYearId(value); formValidation.handleFieldChange('selectedStartYearId'); }}>
                  <SelectTrigger id="selectedRangeStartYearId" {...formValidation.getFieldProps('selectedStartYearId')}>
                    <SelectValue placeholder="Select start year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYearsForSelection.map(ay => (
                      <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                    ))}
                     {availableYearsForSelection.length === 0 && <SelectItem value="no-years" disabled>No academic years available</SelectItem>}
                  </SelectContent>
                </Select>
                <FieldError error={formValidation.getFieldError('selectedStartYearId')} />
              </div>
              <div>
                <Label htmlFor="selectedEndYearId">End Disable Year</Label>
                <Select 
                  value={selectedEndYearId} 
                  onValueChange={(value) => { setSelectedEndYearId(value); formValidation.handleFieldChange('selectedEndYearId'); }}
                  disabled={!selectedStartYearId}
                >
                  <SelectTrigger id="selectedEndYearId" {...formValidation.getFieldProps('selectedEndYearId')}>
                    <SelectValue placeholder="Select end year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYearsForSelection
                      .filter(ay => selectedStartYearId && parseInt(ay.name) >= parseInt(academicYears.find(sAy => sAy.id === selectedStartYearId)?.name || '0'))
                      .map(ay => (
                      <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                    ))}
                    {availableYearsForSelection.length === 0 && <SelectItem value="no-years-end" disabled>Select start year first</SelectItem>}
                  </SelectContent>
                </Select>
                <FieldError error={formValidation.getFieldError('selectedEndYearId')} />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="disableReason" className="text-sm font-medium">Reason for Disabling <span className="text-destructive">*</span></Label>
            <Textarea
              id="disableReason"
              value={reason}
              onChange={(e) => { setReason(e.target.value.toUpperCase()); formValidation.handleFieldChange('disableReason'); }}
              {...formValidation.getFieldProps('disableReason')}
              placeholder="Enter reason..."
              className="mt-1"
              rows={3}
            />
            <FieldError error={formValidation.getFieldError('disableReason')} />
          </div>
        </div>
        <ModernDialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Confirm Disable
          </Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
};

export default FeeDisableModal;
