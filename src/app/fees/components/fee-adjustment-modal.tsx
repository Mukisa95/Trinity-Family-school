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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FeeStructure, AcademicYear, FeeAdjustmentType, FeeAdjustmentEffectivePeriodType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface FeeAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    adjustmentType: FeeAdjustmentType;
    amount: number;
    effectivePeriodType: FeeAdjustmentEffectivePeriodType;
    startYearId: string;
    endYearId?: string;
    reason?: string;
  }) => void;
  feeToAdjust: FeeStructure | null;
  academicYears: AcademicYear[]; // Non-locked academic years
}

const FeeAdjustmentModal: React.FC<FeeAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  feeToAdjust,
  academicYears,
}) => {
  const { toast } = useToast();
  const [adjustmentType, setAdjustmentType] = React.useState<FeeAdjustmentType>("increase");
  const [amount, setAmount] = React.useState<string>("");
  const [effectivePeriodType, setEffectivePeriodType] = React.useState<FeeAdjustmentEffectivePeriodType>("specific_year");
  const [selectedStartYearId, setSelectedStartYearId] = React.useState<string | undefined>(undefined);
  const [selectedEndYearId, setSelectedEndYearId] = React.useState<string | undefined>(undefined);
  const [reason, setReason] = React.useState<string>("");

  React.useEffect(() => {
    if (isOpen && feeToAdjust) {
      // Set default start year if "specific_year" is selected and the fee has an academicYearId
      if (effectivePeriodType === 'specific_year' && feeToAdjust.academicYearId) {
        setSelectedStartYearId(feeToAdjust.academicYearId);
      } else if (academicYears.length > 0) {
        setSelectedStartYearId(academicYears[0].id); // Default to first available year otherwise
      }
    } else if (!isOpen) {
      // Reset form when modal closes
      setAdjustmentType("increase");
      setAmount("");
      setEffectivePeriodType("specific_year");
      setSelectedStartYearId(undefined);
      setSelectedEndYearId(undefined);
      setReason("");
    }
  }, [isOpen, feeToAdjust, academicYears, effectivePeriodType]);
  
  // Update default end year when start year changes for range
  React.useEffect(() => {
    if (effectivePeriodType === 'year_range' && selectedStartYearId) {
        if (!selectedEndYearId || (selectedEndYearId && academicYears.find(ay => ay.id === selectedEndYearId)!.name < academicYears.find(ay => ay.id === selectedStartYearId)!.name)) {
            setSelectedEndYearId(selectedStartYearId);
        }
    }
  }, [selectedStartYearId, effectivePeriodType, academicYears, selectedEndYearId]);


  const handleSubmit = () => {
    if (!feeToAdjust) return;

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Adjustment amount must be a positive number." });
      return;
    }
    if (!selectedStartYearId) {
        toast({ variant: "destructive", title: "Missing Year", description: "Please select the effective start year." });
        return;
    }
    if (effectivePeriodType === 'year_range' && !selectedEndYearId) {
        toast({ variant: "destructive", title: "Missing End Year", description: "Please select the effective end year for the range." });
        return;
    }
    if (effectivePeriodType === 'year_range' && selectedStartYearId && selectedEndYearId) {
        const startYearObj = academicYears.find(ay => ay.id === selectedStartYearId);
        const endYearObj = academicYears.find(ay => ay.id === selectedEndYearId);
        if (startYearObj && endYearObj && parseInt(endYearObj.name) < parseInt(startYearObj.name)) {
             toast({ variant: "destructive", title: "Invalid Year Range", description: "End year cannot be before start year." });
            return;
        }
    }

    onSubmit({
      adjustmentType,
      amount: numericAmount,
      effectivePeriodType,
      startYearId: effectivePeriodType === 'specific_year' ? (feeToAdjust.academicYearId || selectedStartYearId) : selectedStartYearId,
      endYearId: effectivePeriodType === 'year_range' ? selectedEndYearId : undefined,
      reason,
    });
    onClose();
  };

  if (!feeToAdjust) return null;

  const availableEndYears = selectedStartYearId
    ? academicYears.filter(ay => parseInt(ay.name) >= parseInt(academicYears.find(sAy => sAy.id === selectedStartYearId)?.name || '0'))
    : academicYears;

  return (
    <ModernDialog open={isOpen} onOpenChange={onClose}>
      <ModernDialogContent size="lg">
        <ModernDialogHeader>
          <ModernDialogTitle>Adjust Fee: {feeToAdjust.name}</ModernDialogTitle>
          <ModernDialogDescription>
            Current Base Amount: {formatCurrency(feeToAdjust.amount)}. Applied to {feeToAdjust.academicYearId ? `Year ${academicYears.find(ay=>ay.id === feeToAdjust.academicYearId)?.name || 'N/A'}` : 'All Applicable Years'}.
          </ModernDialogDescription>
        </ModernDialogHeader>
        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <Label htmlFor="adjustmentType">Adjustment Type</Label>
            <RadioGroup
              id="adjustmentType"
              value={adjustmentType}
              onValueChange={(value) => setAdjustmentType(value as FeeAdjustmentType)}
              className="flex space-x-4 mt-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="increase" id="increase" />
                <Label htmlFor="increase" className="font-normal">Increase</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="decrease" id="decrease" />
                <Label htmlFor="decrease" className="font-normal">Decrease</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="adjustmentAmount">Adjustment Amount (Positive Value)</Label>
            <Input
              id="adjustmentAmount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 50000"
              min="0.01"
              step="0.01"
            />
          </div>
          
          <div>
            <Label htmlFor="effectivePeriodType">Effective Period</Label>
            <RadioGroup
              id="effectivePeriodType"
              value={effectivePeriodType}
              onValueChange={(value) => {
                setEffectivePeriodType(value as FeeAdjustmentEffectivePeriodType);
                if (value === 'specific_year' && feeToAdjust.academicYearId) {
                    setSelectedStartYearId(feeToAdjust.academicYearId);
                    setSelectedEndYearId(undefined);
                } else if (value !== 'year_range'){
                    setSelectedEndYearId(undefined);
                }
              }}
              className="mt-1 space-y-2"
            >
              <Label htmlFor="specific_year" className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                <RadioGroupItem value="specific_year" id="specific_year" />
                <span>For Fee Item's Current Academic Year ({feeToAdjust.academicYearId ? academicYears.find(ay=>ay.id === feeToAdjust.academicYearId)?.name : 'N/A - Not Year Specific'})</span>
              </Label>
              <Label htmlFor="from_year_onwards" className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                <RadioGroupItem value="from_year_onwards" id="from_year_onwards" />
                <span>From Specific Year Onwards</span>
              </Label>
              <Label htmlFor="year_range" className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                <RadioGroupItem value="year_range" id="year_range" />
                <span>For Specific Year Range</span>
              </Label>
            </RadioGroup>
          </div>

          {effectivePeriodType === 'from_year_onwards' && (
            <div>
              <Label htmlFor="startYearOnwards">Start Adjustment From Year</Label>
              <Select value={selectedStartYearId} onValueChange={setSelectedStartYearId}>
                <SelectTrigger id="startYearOnwards">
                  <SelectValue placeholder="Select start year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map(ay => (
                    <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {effectivePeriodType === 'year_range' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rangeStartYear">Range Start Year</Label>
                <Select value={selectedStartYearId} onValueChange={setSelectedStartYearId}>
                  <SelectTrigger id="rangeStartYear">
                    <SelectValue placeholder="Select start year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map(ay => (
                      <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rangeEndYear">Range End Year</Label>
                <Select value={selectedEndYearId} onValueChange={setSelectedEndYearId} disabled={!selectedStartYearId}>
                  <SelectTrigger id="rangeEndYear">
                    <SelectValue placeholder="Select end year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEndYears.map(ay => (
                      <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="reason">Reason/Notes (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.toUpperCase())}
              placeholder="e.g., Inflation adjustment, new facilities"
            />
          </div>
        </div>
        <ModernDialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Save Adjustment
          </Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
};

export default FeeAdjustmentModal;
