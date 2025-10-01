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
  academicYears: AcademicYear[]; // To populate year dropdowns, non-locked ones
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

  // Filter for non-locked academic years
  const availableYearsForSelection = React.useMemo(() => {
    return academicYears.filter(ay => !ay.isLocked);
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
    if (!reason.trim()) {
      toast({ variant: "destructive", title: "Reason Required", description: "Please provide a reason for disabling the fee item." });
      return;
    }
    if (disableType === 'from_year_onwards' && !selectedStartYearId) {
      toast({ variant: "destructive", title: "Missing Start Year", description: "Please select the year to disable from." });
      return;
    }
    if (disableType === 'year_range' && (!selectedStartYearId || !selectedEndYearId)) {
      toast({ variant: "destructive", title: "Missing Year Range", description: "Please select both start and end years for the range." });
      return;
    }
    if (disableType === 'year_range' && selectedStartYearId && selectedEndYearId) {
        const startYearObj = academicYears.find(ay => ay.id === selectedStartYearId);
        const endYearObj = academicYears.find(ay => ay.id === selectedEndYearId);
        if (startYearObj && endYearObj && parseInt(endYearObj.name) < parseInt(startYearObj.name)) {
             toast({ variant: "destructive", title: "Invalid Year Range", description: "End year cannot be before start year." });
            return;
        }
    }
    
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
                <Select value={selectedStartYearId} onValueChange={setSelectedStartYearId}>
                  <SelectTrigger id="selectedStartYearId">
                    <SelectValue placeholder="Select start year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYearsForSelection.map(ay => (
                      <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                    ))}
                     {availableYearsForSelection.length === 0 && <SelectItem value="no-years" disabled>No non-locked years</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {disableType === 'year_range' && (
            <div className="space-y-3 p-3 border rounded-md bg-muted/30">
              <h4 className="text-xs font-medium text-muted-foreground">Specify Year Range</h4>
              <div>
                <Label htmlFor="selectedRangeStartYearId">Start Disable Year</Label>
                <Select value={selectedStartYearId} onValueChange={setSelectedStartYearId}>
                  <SelectTrigger id="selectedRangeStartYearId">
                    <SelectValue placeholder="Select start year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYearsForSelection.map(ay => (
                      <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                    ))}
                     {availableYearsForSelection.length === 0 && <SelectItem value="no-years" disabled>No non-locked years</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="selectedEndYearId">End Disable Year</Label>
                <Select 
                  value={selectedEndYearId} 
                  onValueChange={setSelectedEndYearId} 
                  disabled={!selectedStartYearId}
                >
                  <SelectTrigger id="selectedEndYearId">
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
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="disableReason" className="text-sm font-medium">Reason for Disabling <span className="text-destructive">*</span></Label>
            <Textarea
              id="disableReason"
              value={reason}
              onChange={(e) => setReason(e.target.value.toUpperCase())}
              placeholder="Enter reason..."
              className="mt-1"
              rows={3}
            />
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
