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
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatMoneyInput, parseFormattedMoney } from "@/lib/utils";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    amount: number; // Positive from form, stored negative
    description?: string;
    linkedFeeIds?: string[];
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
  const { toast } = useToast();
  const { data: academicYears = [] } = useAcademicYears();
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState<number | string>(""); // User enters positive
  const [description, setDescription] = React.useState("");
  const [linkedFeeIds, setLinkedFeeIds] = React.useState<string[]>([]);

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

  const handleSubmit = () => {
    const numericAmount = parseFormattedMoney(typeof amount === 'string' ? amount : amount.toString());
    if (!name.trim() || numericAmount <= 0) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields (Name, Amount)." });
      return;
    }
    if (linkedFeeIds.length === 0) {
        toast({ variant: "destructive", title: "Validation Error", description: "Please link this discount to at least one fee item." });
        return;
    }


    onSubmit({
      name,
      amount: numericAmount, // Will be converted to negative by parent
      description,
      linkedFeeIds,
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
            <div className="space-y-2">
              <Label htmlFor="discountName">Discount Name <span className="text-destructive">*</span></Label>
              <Input id="discountName" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountAmount">Discount Amount <span className="text-destructive">*</span></Label>
              <Input id="discountAmount" type="text" value={typeof amount === 'string' ? amount : formatMoneyInput(amount.toString())} onChange={(e) => setAmount(formatMoneyInput(e.target.value))} placeholder="Enter positive value"/>
            </div>
             <div className="space-y-2">
              <Label>Linked Fee Items <span className="text-destructive">*</span></Label>
              <ScrollArea className="h-[200px] w-full rounded-md border p-4">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountDescription">Reason/Description</Label>
              <Textarea id="discountDescription" value={description} onChange={(e) => setDescription(e.target.value.toUpperCase())} rows={3}/>
            </div>
          </div>
        </div>
        <ModernDialogFooter className="flex-shrink-0 px-6 pb-6 pt-4 border-t flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleSubmit} className="w-full sm:w-auto">Save Discount</Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
};

export default DiscountModal;