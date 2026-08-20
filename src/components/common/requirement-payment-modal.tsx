"use client";

import React, { useState } from 'react';
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
import { formatMoneyInput, parseFormattedMoney, formatCurrency } from '@/lib/utils';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

interface RequirementPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
  fullAmount: number;
  paidAmount: number;
  balance: number;
}

export function RequirementPaymentModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  fullAmount,
  paidAmount,
  balance
}: RequirementPaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const formValidation = useFormValidation([
    createFieldValidation('requirementPaymentAmount', paymentAmount, 'Payment amount', true, {
      message: 'Enter the requirement payment amount.',
      validate: (value) => {
        const amount = parseFormattedMoney(String(value ?? ''));
        if (amount <= 0) return 'Enter a payment amount greater than zero.';
        if (amount > balance) return 'Enter an amount that does not exceed the remaining balance.';
        return undefined;
      },
    }),
  ]);

  const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMoneyInput(e.target.value);
    setPaymentAmount(formatted);
    formValidation.handleFieldChange('requirementPaymentAmount');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFormattedMoney(paymentAmount);
    
    if (!formValidation.validateAll().isValid) return;

    onSubmit(amount);
    setPaymentAmount('');
    formValidation.resetValidation();
  };

  const handleClose = () => {
    setPaymentAmount('');
    formValidation.resetValidation();
    onClose();
  };

  const handlePayFullBalance = () => {
    setPaymentAmount(balance.toString());
    formValidation.handleFieldChange('requirementPaymentAmount');
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={handleClose}>
      <ModernDialogContent size="md" open={isOpen} onOpenChange={handleClose}>
        <ModernDialogHeader>
          <ModernDialogTitle>Make Payment</ModernDialogTitle>
        </ModernDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormErrorSummary errors={formValidation.errors} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
          {/* Payment Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Amount:</span>
              <span className="font-medium">{formatCurrency(fullAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Already Paid:</span>
              <span className="font-medium">{formatCurrency(paidAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-sm font-medium">Remaining Balance:</span>
              <span className="font-bold text-red-600">{formatCurrency(balance)}</span>
            </div>
          </div>

          {/* Payment Amount Input */}
          <div>
            <Label htmlFor="requirementPaymentAmount" className={formValidation.getFieldError('requirementPaymentAmount') ? 'text-destructive' : undefined}>Payment Amount (UGX) *</Label>
            <Input
              id="requirementPaymentAmount"
              value={paymentAmount}
              onChange={handlePaymentAmountChange}
              {...formValidation.getFieldProps('requirementPaymentAmount')}
              placeholder="Enter payment amount"
            />
            <FieldError error={formValidation.getFieldError('requirementPaymentAmount')} />
            <p className="text-xs text-gray-500 mt-1">
              Maximum: {formatCurrency(balance)}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePayFullBalance}
              className="flex-1"
            >
              Pay Full Balance
            </Button>
          </div>

          <ModernDialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              Make Payment
            </Button>
          </ModernDialogFooter>
        </form>
      </ModernDialogContent>
    </ModernDialog>
  );
}
