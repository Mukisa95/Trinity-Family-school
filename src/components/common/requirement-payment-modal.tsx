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

  const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMoneyInput(e.target.value);
    setPaymentAmount(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFormattedMoney(paymentAmount);
    
    if (amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }
    
    if (amount > balance) {
      alert('Payment amount cannot exceed the remaining balance');
      return;
    }

    onSubmit(amount);
    setPaymentAmount('');
  };

  const handleClose = () => {
    setPaymentAmount('');
    onClose();
  };

  const handlePayFullBalance = () => {
    setPaymentAmount(balance.toString());
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={handleClose}>
      <ModernDialogContent size="md" open={isOpen} onOpenChange={handleClose}>
        <ModernDialogHeader>
          <ModernDialogTitle>Make Payment</ModernDialogTitle>
        </ModernDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="paymentAmount">Payment Amount (UGX) *</Label>
            <Input
              id="paymentAmount"
              value={paymentAmount}
              onChange={handlePaymentAmountChange}
              placeholder="Enter payment amount"
              required
            />
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