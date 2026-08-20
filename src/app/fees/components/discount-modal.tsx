"use client";

import * as React from "react";
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle, ModernDialogDescription, ModernDialogFooter } from "@/components/ui/modern-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FeeStructure, AcademicYear } from "@/types";
import { formatCurrency, formatMoneyInput, parseFormattedMoney } from "@/lib/utils";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    amount: number; // Positive from form, stored negative
    description?: string;
    linkedFeeIds?: string[];
    action: 'save' | 'create'; // 'save' updates the existing discount, 'create' makes a new one
  }) => void;
  feeItems: FeeStructure[]; // For linking discount to a fee
  initialData?: FeeStructure | null; // For editing an existing discount
  mode: 'add' | 'edit';
}

const DiscountModal: React.FC<DiscountModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  feeItems,
  initialData,
  mode
}) => {
  const { data: academicYears = [] } = useAcademicYears();
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState<number | string>(""); // User enters positive
  const [description, setDescription] = React.useState("");
  const [linkedFeeIds, setLinkedFeeIds] = React.useState<string[]>([]);
  const validationFields = React.useMemo(() => [
    createFieldValidation('discountName', name, 'Discount Name', true, { message: 'Enter the discount name.' }),
    createFieldValidation('discountAmount', amount, 'Discount Amount', true, {
      message: 'Enter the discount amount.',
      validate: (value) => parseFormattedMoney(String(value || '')) > 0 ? undefined : 'Enter an amount greater than zero.',
    }),
    createFieldValidation('linkedFeeIds', linkedFeeIds, 'Linked Fee Items', true, { message: 'Choose at least one fee item to link.' }),
  ], [amount, linkedFeeIds, name]);
  const formValidation = useFormValidation(validationFields);

  // Helper function to get term name for a fee item
  const getTermName = (feeItem: FeeStructure): string => {
    if (!feeItem.termId) return "No Term";
    
    // Find the academic year that contains this term
    const academicYear = academicYears.find(year => 
      year.terms.some(term => term.id === feeItem.termId)
    );
    
    if (!academicYear) return "Unknown Term";
    
    // Find the specific term
    const term = academicYear.terms.find(term => term.id === feeItem.termId);
    return term ? `${term.name} (${academicYear.name})` : "Unknown Term";
  };

  React.useEffect(() => {
    if (mode === 'edit' && initialData) {
        setName(initialData.name);
        setAmount(Math.abs(initialData.amount)); // Show positive for editing
        setDescription(initialData.description || "");
        setLinkedFeeIds(initialData.linkedFeeIds || (initialData.linkedFeeId ? [initialData.linkedFeeId] : []));
    } else {
        // Reset for add mode
        setName("");
        setAmount("");
        setDescription("");
        setLinkedFeeIds([]);
    }
  }, [initialData, isOpen, mode]);

  const handleSubmit = (action: 'save' | 'create') => {
    const validation = formValidation.validateAll();
    if (!validation.isValid) return;
    const numericAmount = parseFormattedMoney(typeof amount === 'string' ? amount : amount.toString());

    onSubmit({
      name,
      amount: numericAmount, // Will be converted to negative by parent
      description,
      linkedFeeIds,
      action,
    });
    onClose(); // Close modal on successful submission
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={onClose}>
      <ModernDialogContent size="lg" className="flex flex-col max-h-[90vh] p-0">
        <ModernDialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <ModernDialogTitle>{mode === 'add' ? 'Create New Discount' : 'Edit Discount'}</ModernDialogTitle>
          <ModernDialogDescription>Fill in the details for the discount.</ModernDialogDescription>
        </ModernDialogHeader>
        <div className="flex-grow min-h-0 overflow-y-auto">
          <div className="grid gap-4 p-6">
            <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
            <div className="space-y-2">
              <Label htmlFor="discountName">Discount Name <span className="text-destructive">*</span></Label>
              <Input id="discountName" value={name} onChange={(e) => { setName(e.target.value.toUpperCase()); formValidation.handleFieldChange('discountName'); }} {...formValidation.getFieldProps('discountName')} />
              <FieldError error={formValidation.getFieldError('discountName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountAmount">Discount Amount <span className="text-destructive">*</span></Label>
              <Input id="discountAmount" type="text" value={typeof amount === 'string' ? amount : formatMoneyInput(amount.toString())} onChange={(e) => { setAmount(formatMoneyInput(e.target.value)); formValidation.handleFieldChange('discountAmount'); }} placeholder="Enter positive value" {...formValidation.getFieldProps('discountAmount')} />
              <FieldError error={formValidation.getFieldError('discountAmount')} />
            </div>
             <div className="space-y-2">
              <Label>Linked Fee Items <span className="text-destructive">*</span></Label>
              <ScrollArea id="linkedFeeIds" tabIndex={-1} aria-invalid={Boolean(formValidation.getFieldError('linkedFeeIds'))} aria-describedby={formValidation.getFieldError('linkedFeeIds') ? 'linkedFeeIds-error' : undefined} className="h-[200px] w-full rounded-md border p-4 aria-invalid:border-red-600 aria-invalid:bg-red-50/70 aria-invalid:ring-2 aria-invalid:ring-red-200">
                <div className="space-y-4">
                  {feeItems.filter(item => item.status === 'active' && item.category !== 'Discount').map(item => (
                    <div key={item.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={`fee-${item.id}`}
                        checked={linkedFeeIds.includes(item.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setLinkedFeeIds(prev => [...prev, item.id]);
                          } else {
                            setLinkedFeeIds(prev => prev.filter(id => id !== item.id));
                          }
                          formValidation.handleFieldChange('linkedFeeIds');
                        }}
                      />
                      <Label
                        htmlFor={`fee-${item.id}`}
                        className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {item.name} ({formatCurrency(item.amount)}) - {getTermName(item)}
                      </Label>
                    </div>
                  ))}
                  {feeItems.filter(item => item.status === 'active' && item.category !== 'Discount').length === 0 && (
                    <div className="text-sm text-muted-foreground p-2">No active fee items to link</div>
                  )}
                </div>
              </ScrollArea>
              <FieldError error={formValidation.getFieldError('linkedFeeIds')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountDescription">Reason/Description</Label>
              <Textarea id="discountDescription" value={description} onChange={(e) => setDescription(e.target.value.toUpperCase())} rows={3}/>
            </div>
          </div>
        </div>
        <ModernDialogFooter className="flex-shrink-0 px-6 pb-6 pt-4 border-t">
          {mode === 'edit' ? (
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
              <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto">
                <Button
                  variant="secondary"
                  onClick={() => handleSubmit('create')}
                  className="w-full sm:w-auto"
                  title="Save as a new discount, keeping the original unchanged"
                >
                  Create New
                </Button>
                <Button
                  onClick={() => handleSubmit('save')}
                  className="w-full sm:w-auto"
                  title="Save changes to the existing discount"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:justify-end">
              <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={() => handleSubmit('create')} className="w-full sm:w-auto">Save Discount</Button>
            </div>
          )}
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
};

export default DiscountModal;
