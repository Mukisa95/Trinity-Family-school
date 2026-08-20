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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoneyInput, parseFormattedMoney, formatCurrency } from '@/lib/utils';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
  fullAmount: number;
  paidAmount: number;
  balance: number;
}

export function PaymentModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  fullAmount, 
  paidAmount, 
  balance 
}: PaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const formValidation = useFormValidation([
    createFieldValidation('paymentAmount', paymentAmount, 'Payment amount', true, {
      message: 'Enter the payment amount.',
      validate: (value) => parseFormattedMoney(String(value ?? '')) > 0 ? undefined : 'Enter a payment amount greater than zero.',
    }),
  ]);

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMoneyInput(e.target.value);
    setPaymentAmount(formatted);
    formValidation.handleFieldChange('paymentAmount');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFormattedMoney(paymentAmount);
    
    if (!formValidation.validateAll().isValid) return;
    
    if (amount > balance) {
      if (!window.confirm(`Payment amount (${formatCurrency(amount)}) exceeds balance (${formatCurrency(balance)}). Continue?`)) {
        return;
      }
    }

    onSubmit(amount);
    setPaymentAmount('');
    formValidation.resetValidation();
  };

  const handleQuickPayment = (amount: number) => {
    setPaymentAmount(amount.toString());
    formValidation.handleFieldChange('paymentAmount');
  };

  const handleClose = () => {
    setPaymentAmount('');
    formValidation.resetValidation();
    onClose();
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <ModernDialogContent size="md">
        <ModernDialogHeader>
          <ModernDialogTitle>Make Payment</ModernDialogTitle>
        </ModernDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormErrorSummary errors={formValidation.errors} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-semibold">{formatCurrency(fullAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Already Paid:</span>
                <span className="font-semibold">{formatCurrency(paidAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>Outstanding Balance:</span>
                <span className="font-semibold text-red-600">{formatCurrency(balance)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Amount */}
          <div>
            <Label htmlFor="paymentAmount" className={formValidation.getFieldError('paymentAmount') ? 'text-destructive' : undefined}>Payment Amount (UGX) *</Label>
            <Input
              id="paymentAmount"
              value={paymentAmount}
              onChange={handlePaymentChange}
              {...formValidation.getFieldProps('paymentAmount')}
              placeholder="Enter payment amount"
            />
            <FieldError error={formValidation.getFieldError('paymentAmount')} />
          </div>

          {/* Quick Payment Options */}
          {balance > 0 && (
            <div>
              <Label className="text-sm">Quick Payment Options:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPayment(balance)}
                >
                  Pay Full Balance ({formatCurrency(balance)})
                </Button>
                {balance > 10000 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickPayment(Math.floor(balance / 2))}
                  >
                    Pay Half ({formatCurrency(Math.floor(balance / 2))})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Payment Preview */}
          {paymentAmount && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Payment Amount:</span>
                    <span className="font-semibold">{formatCurrency(parseFormattedMoney(paymentAmount))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>New Total Paid:</span>
                    <span className="font-semibold">{formatCurrency(paidAmount + parseFormattedMoney(paymentAmount))}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Remaining Balance:</span>
                    <span className={`font-semibold ${
                      balance - parseFormattedMoney(paymentAmount) <= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(Math.max(0, balance - parseFormattedMoney(paymentAmount)))}
                    </span>
                  </div>
                  {balance - parseFormattedMoney(paymentAmount) <= 0 && (
                    <div className="text-green-600 font-medium text-center">
                      ✓ Fully Paid
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <ModernDialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              Process Payment
            </Button>
          </ModernDialogFooter>
        </form>
      </ModernDialogContent>
    </ModernDialog>
  );
}
