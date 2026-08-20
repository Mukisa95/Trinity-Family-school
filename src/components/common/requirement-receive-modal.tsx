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
import { Package, AlertCircle, Plus, Minus } from 'lucide-react';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

interface RequirementReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (quantity: number) => void;
  totalRequired: number;
  currentReceived: number;
  hasQuantities: boolean;
}

export function RequirementReceiveModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  totalRequired,
  currentReceived,
  hasQuantities
}: RequirementReceiveModalProps) {
  const [quantity, setQuantity] = useState('');

  const remainingToReceive = Math.max(0, totalRequired - currentReceived);
  const formValidation = useFormValidation([
    createFieldValidation('requirementQuantity', quantity, 'Quantity to receive', true, {
      message: 'Enter the quantity to receive.',
      validate: (value) => {
        const parsed = Number.parseInt(String(value ?? ''), 10);
        if (!Number.isFinite(parsed) || parsed <= 0) return 'Enter a quantity greater than zero.';
        if (hasQuantities && parsed > remainingToReceive) return `Enter a quantity no greater than ${remainingToReceive}.`;
        return undefined;
      },
    }),
  ]);

  useEffect(() => {
    if (isOpen) {
      // Default to remaining quantity if there are quantities, otherwise 1
      setQuantity(hasQuantities ? remainingToReceive.toString() : '1');
      formValidation.resetValidation();
    }
  }, [isOpen, remainingToReceive, hasQuantities]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string for clearing
    if (value === '') {
      setQuantity('');
      formValidation.handleFieldChange('requirementQuantity');
      return;
    }
    // Only allow positive integers
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      if (hasQuantities && numValue > remainingToReceive) {
        setQuantity(remainingToReceive.toString());
      } else {
        setQuantity(numValue.toString());
      }
    }
    formValidation.handleFieldChange('requirementQuantity');
  };

  const handleIncrement = () => {
    const current = parseInt(quantity) || 0;
    if (hasQuantities) {
      const newValue = Math.min(current + 1, remainingToReceive);
      setQuantity(newValue.toString());
    } else {
      setQuantity((current + 1).toString());
    }
    formValidation.handleFieldChange('requirementQuantity');
  };

  const handleDecrement = () => {
    const current = parseInt(quantity) || 0;
    if (current > 0) {
      setQuantity((current - 1).toString());
      formValidation.handleFieldChange('requirementQuantity');
    }
  };

  const handleReceiveAll = () => {
    if (hasQuantities) {
      setQuantity(remainingToReceive.toString());
    } else {
      setQuantity('1');
    }
    formValidation.handleFieldChange('requirementQuantity');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantityNum = parseInt(quantity) || 0;
    
    if (!formValidation.validateAll().isValid) return;

    onSubmit(quantityNum);
    setQuantity('');
    formValidation.resetValidation();
  };

  const handleClose = () => {
    setQuantity('');
    formValidation.resetValidation();
    onClose();
  };

  const quantityNum = parseInt(quantity) || 0;

  return (
    <ModernDialog open={isOpen} onOpenChange={handleClose}>
      <ModernDialogContent size="md" open={isOpen} onOpenChange={handleClose}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            Receive Items in Class
          </ModernDialogTitle>
        </ModernDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormErrorSummary errors={formValidation.errors} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
          {/* Summary */}
          {hasQuantities && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Required:</span>
                <span className="font-medium">{totalRequired} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Already Received:</span>
                <span className="font-medium">{currentReceived} items</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm font-medium">Remaining:</span>
                <span className="font-bold text-orange-600">{remainingToReceive} items</span>
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <Label htmlFor="requirementQuantity" className={formValidation.getFieldError('requirementQuantity') ? 'text-destructive' : undefined}>
              {hasQuantities ? 'Quantity to Receive' : 'Mark as Received'}
            </Label>
            {hasQuantities ? (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDecrement}
                  disabled={quantityNum <= 0}
                  className="h-10 w-10 p-0"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                
                <Input
                  id="requirementQuantity"
                  type="number"
                  value={quantity}
                  onChange={handleQuantityChange}
                  min="0"
                  max={remainingToReceive}
                  className="text-center text-lg font-semibold"
                  {...formValidation.getFieldProps('requirementQuantity')}
                />
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleIncrement}
                  disabled={hasQuantities && quantityNum >= remainingToReceive}
                  className="h-10 w-10 p-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Input
                id="requirementQuantity"
                type="number"
                value={quantity}
                onChange={handleQuantityChange}
                min="1"
                className="mt-2"
                {...formValidation.getFieldProps('requirementQuantity')}
              />
            )}
            <FieldError error={formValidation.getFieldError('requirementQuantity')} />
            
            {hasQuantities && (
              <p className="text-xs text-gray-500 mt-1">
                Maximum: {remainingToReceive} items
              </p>
            )}

            {hasQuantities && quantityNum > remainingToReceive && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Quantity cannot exceed remaining items ({remainingToReceive})
              </p>
            )}
          </div>

          {/* Quick Actions */}
          {hasQuantities && remainingToReceive > 0 && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReceiveAll}
                className="flex-1"
              >
                Receive All Remaining ({remainingToReceive})
              </Button>
            </div>
          )}

          <ModernDialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              <Package className="w-4 h-4 mr-2" />
              Record Receipt
            </Button>
          </ModernDialogFooter>
        </form>
      </ModernDialogContent>
    </ModernDialog>
  );
}
