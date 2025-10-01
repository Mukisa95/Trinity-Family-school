"use client";

import React, { useState, useEffect } from 'react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogFooter,
} from '@/components/ui/modern-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatMoneyInput, parseFormattedMoney } from '@/lib/utils';
import { validateForm, highlightMissingFields, scrollToFirstMissingField, clearFieldHighlights, createFieldValidation } from '@/lib/utils/form-validation';
import type { 
  RequirementTrackingFormData, 
  RequirementPaymentStatus, 
  RequirementReleaseStatus,
  RequirementSelectionMode,
  RequirementTracking,
  RequirementItem
} from '@/types';

interface RequirementTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: RequirementTrackingFormData) => void;
  selectedRecord?: RequirementTracking | null;
  eligibleRequirements: RequirementItem[];
  pupilId: string;
}

export function RequirementTrackingModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  selectedRecord,
  eligibleRequirements,
  pupilId
}: RequirementTrackingModalProps) {
  const [formData, setFormData] = useState<RequirementTrackingFormData>({
    requirementId: '',
    selectionMode: 'item',
    paidAmount: '',
    paymentStatus: 'pending',
    releaseStatus: 'pending',
    coverageMode: 'cash'
  });

  useEffect(() => {
    if (selectedRecord) {
      setFormData({
        requirementId: selectedRecord.requirementId,
        selectionMode: selectedRecord.selectionMode,
        paidAmount: selectedRecord.paidAmount.toString(),
        paymentStatus: selectedRecord.paymentStatus,
        releaseStatus: selectedRecord.releaseStatus,
        coverageMode: selectedRecord.coverageMode || 'cash'
      });
    } else {
      setFormData({
        requirementId: '',
        selectionMode: 'item',
        paidAmount: '',
        paymentStatus: 'pending',
        releaseStatus: 'pending',
        coverageMode: 'cash'
      });
    }
  }, [selectedRecord, isOpen]);

  const handleInputChange = (field: keyof RequirementTrackingFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMoneyInput(e.target.value);
    handleInputChange('paidAmount', formatted);
  };

  const handleSelectionModeChange = (mode: RequirementSelectionMode) => {
    setFormData(prev => ({
      ...prev,
      selectionMode: mode,
      requirementId: mode === 'full' ? eligibleRequirements.map(r => r.id) : ''
    }));
  };

  const handleRequirementSelection = (requirementId: string, checked: boolean) => {
    if (formData.selectionMode === 'item') {
      setFormData(prev => ({
        ...prev,
        requirementId: requirementId
      }));
    } else {
      setFormData(prev => {
        const currentIds = Array.isArray(prev.requirementId) ? prev.requirementId : [];
        return {
          ...prev,
          requirementId: checked 
            ? [...currentIds, requirementId]
            : currentIds.filter(id => id !== requirementId)
        };
      });
    }
  };

  const getTotalAmount = () => {
    if (Array.isArray(formData.requirementId)) {
      return formData.requirementId.reduce((total, id) => {
        const requirement = eligibleRequirements.find(r => r.id === id);
        return total + (requirement?.price || 0);
      }, 0);
    }
    const requirement = eligibleRequirements.find(r => r.id === formData.requirementId);
    return requirement?.price || 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any previous field highlights
    const allFieldIds = ['requirementId', 'paidAmount', 'paymentStatus', 'releaseStatus'];
    clearFieldHighlights(allFieldIds);

    // Define validation fields
    const validationFields = [
      createFieldValidation('requirementId', 
        Array.isArray(formData.requirementId) 
          ? (formData.requirementId.length > 0 ? formData.requirementId : [])
          : (formData.requirementId ? formData.requirementId : ''), 
        'Requirement Selection', true),
      createFieldValidation('paidAmount', 
        formData.paidAmount && parseFormattedMoney(formData.paidAmount) >= 0 ? formData.paidAmount : '', 
        'Payment Amount', true),
      createFieldValidation('paymentStatus', formData.paymentStatus, 'Payment Status', true),
      createFieldValidation('releaseStatus', formData.releaseStatus, 'Release Status', true),
    ];

    // Validate form
    const validation = validateForm(validationFields);
    
    if (!validation.isValid) {
      // Highlight missing fields
      const missingFieldIds = validation.missingFields.map(field => field.id);
      highlightMissingFields(missingFieldIds);
      
      // Scroll to first missing field
      if (validation.firstMissingFieldId) {
        scrollToFirstMissingField(validation.firstMissingFieldId);
      }
      
      // Show error alert with specific missing fields
      const missingFieldNames = validation.missingFields.map(field => field.label).join(', ');
      alert(`Please fill in the following required fields: ${missingFieldNames}`);
      return;
    }

    const totalAmount = getTotalAmount();
    const paidAmount = parseFormattedMoney(formData.paidAmount);
    
    if (paidAmount > totalAmount) {
      alert('Payment amount cannot exceed the total requirement amount');
      return;
    }

    onSubmit(formData);
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModernDialogContent size="2xl" open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <ModernDialogHeader>
          <ModernDialogTitle>
            {selectedRecord ? 'Edit Requirement Tracking' : 'Add Requirement Tracking'}
          </ModernDialogTitle>
        </ModernDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selection Mode */}
          <div>
            <Label>Selection Mode *</Label>
            <RadioGroup
              value={formData.selectionMode}
              onValueChange={handleSelectionModeChange}
              className="flex flex-col space-y-2 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="item" id="mode-item" />
                <Label htmlFor="mode-item" className="font-normal">
                  Individual Item
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial" id="mode-partial" />
                <Label htmlFor="mode-partial" className="font-normal">
                  Multiple Items (Custom Selection)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="mode-full" />
                <Label htmlFor="mode-full" className="font-normal">
                  All Eligible Requirements
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Requirement Selection */}
          <div>
            <Label>Select Requirements *</Label>
            {formData.selectionMode === 'full' ? (
              <div className="mt-2 p-3 border rounded-md bg-gray-50">
                <p className="text-sm text-gray-600">All eligible requirements will be included:</p>
                <div className="mt-2 space-y-1">
                  {eligibleRequirements.map((requirement) => (
                    <div key={requirement.id} className="text-sm">
                      • {requirement.name} - UGX {requirement.price.toLocaleString()}
                    </div>
                  ))}
                </div>
                <div className="mt-2 font-medium">
                  Total: UGX {getTotalAmount().toLocaleString()}
                </div>
              </div>
            ) : formData.selectionMode === 'item' ? (
              <Select 
                value={formData.requirementId as string} 
                onValueChange={(value) => handleInputChange('requirementId', value)}
              >
                <SelectTrigger id="requirementId" className="mt-2">
                  <SelectValue placeholder="Select a requirement" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleRequirements.map((requirement) => (
                    <SelectItem key={requirement.id} value={requirement.id}>
                      {requirement.name} - UGX {requirement.price.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-2">
                <ScrollArea className="h-32 border rounded-md p-3">
                  <div className="space-y-2">
                    {eligibleRequirements.map((requirement) => (
                      <div key={requirement.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`req-${requirement.id}`}
                          checked={Array.isArray(formData.requirementId) && formData.requirementId.includes(requirement.id)}
                          onCheckedChange={(checked) => handleRequirementSelection(requirement.id, checked as boolean)}
                        />
                        <Label htmlFor={`req-${requirement.id}`} className="text-sm font-normal">
                          {requirement.name} - UGX {requirement.price.toLocaleString()}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {Array.isArray(formData.requirementId) && formData.requirementId.length > 0 && (
                  <div className="mt-2 text-sm">
                    <p className="font-medium">
                      Total: UGX {getTotalAmount().toLocaleString()}
                    </p>
                    <p className="text-gray-500">
                      {formData.requirementId.length} requirement(s) selected
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Amount */}
          <div>
            <Label htmlFor="paidAmount">Payment Amount (UGX) *</Label>
            <Input
              id="paidAmount"
              value={formData.paidAmount}
              onChange={handlePriceChange}
              placeholder="e.g., 25,000"
              required
            />
            {getTotalAmount() > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Total requirement amount: UGX {getTotalAmount().toLocaleString()}
              </p>
            )}
          </div>

          {/* Payment Status */}
          <div>
            <Label htmlFor="paymentStatus">Payment Status *</Label>
            <Select 
              value={formData.paymentStatus} 
              onValueChange={(value: RequirementPaymentStatus) => handleInputChange('paymentStatus', value)}
            >
              <SelectTrigger id="paymentStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial Payment</SelectItem>
                <SelectItem value="paid">Fully Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Release Status */}
          <div>
            <Label htmlFor="releaseStatus">Release Status *</Label>
            <Select 
              value={formData.releaseStatus} 
              onValueChange={(value: RequirementReleaseStatus) => handleInputChange('releaseStatus', value)}
            >
              <SelectTrigger id="releaseStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending Release</SelectItem>
                <SelectItem value="released">Released</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ModernDialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              {selectedRecord ? 'Update Tracking' : 'Add Tracking'}
            </Button>
          </ModernDialogFooter>
        </form>
      </ModernDialogContent>
    </ModernDialog>
  );
} 