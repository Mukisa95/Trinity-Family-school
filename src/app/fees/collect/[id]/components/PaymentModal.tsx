import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CurrencyCircleDollar } from '@phosphor-icons/react';
import { formatMoneyInput, parseFormattedMoney } from '@/lib/utils';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

interface SelectedFee {
  feeId: string;
  amount: number;
  name: string;
  balance: number;
  amountPaid: number;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { amount: number }) => Promise<void>;
  fee: SelectedFee;
}

export function PaymentModal({ isOpen, onClose, onSubmit, fee }: PaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const balance = fee.balance;
  const maxPayment = balance;

  const validateAmount = (value: string): string | undefined => {
    const numValue = parseFormattedMoney(value);
    
    if (!value || value.trim() === '') {
      return 'Amount is required';
    }
    
    if (numValue <= 0) {
      return 'Amount must be a positive number';
    }
    
    if (numValue > maxPayment) {
      return `Amount cannot exceed balance of ${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(maxPayment)}`;
    }
    
    return undefined;
  };
  const formValidation = useFormValidation([
    createFieldValidation('paymentAmount', amount, 'Payment amount', true, {
      message: 'Enter the payment amount.',
      validate: (value) => validateAmount(String(value ?? '')),
    }),
  ]);

  const handleAmountChange = (value: string) => {
    const formatted = formatMoneyInput(value);
    setAmount(formatted);
    formValidation.handleFieldChange('paymentAmount');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formValidation.validateAll().isValid) return;

    setIsProcessing(true);

    try {
      await onSubmit({ amount: parseFormattedMoney(amount) });
      setAmount('');
      // Don't call onClose() here - parent component handles it
    } catch (error) {
      console.error('Payment submission error:', error);
      formValidation.setSubmissionError(error instanceof Error ? error.message : 'The payment could not be recorded. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setAmount('');
      formValidation.resetValidation();
      onClose();
    }
  };

  const suggestedAmounts = [
    { label: 'Full', value: balance },
    { label: 'Half', value: Math.round(balance / 2) },
    { label: '25%', value: Math.round(balance * 0.25) },
  ].filter(item => item.value > 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-bold text-sm text-indigo-600">Shs.</span>
            Record Payment
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {/* Fee Information */}
          <div className="bg-indigo-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-indigo-900 mb-2">{fee.name}</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-indigo-700">Total Amount:</span>
                <span className="font-medium text-indigo-900">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-700">Amount Paid:</span>
                <span className="font-medium text-green-600">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.amountPaid)}
                </span>
              </div>
              <div className="flex justify-between border-t border-indigo-200 pt-1">
                <span className="text-indigo-700 font-medium">Balance:</span>
                <span className="font-bold text-red-600">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(balance)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
            <div>
              <label htmlFor="paymentAmount" className={`block text-sm font-medium mb-2 ${formValidation.getFieldError('paymentAmount') ? 'text-red-700' : 'text-gray-700'}`}>
                Payment Amount (UGX)
              </label>
              <input
                type="text"
                id="paymentAmount"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="Enter amount"
                {...formValidation.getFieldProps('paymentAmount')}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 aria-invalid:border-red-600 aria-invalid:bg-red-50/70 aria-invalid:ring-red-200 ${
                  formValidation.getFieldError('paymentAmount') ? 'border-red-600' : 'border-gray-300'
                }`}
                disabled={isProcessing}
              />
              <FieldError error={formValidation.getFieldError('paymentAmount')} />
            </div>

            {/* Suggested Amounts */}
            {suggestedAmounts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Quick Select:
                </label>
                <div className="flex gap-2 flex-nowrap overflow-x-auto pb-1 scrollbar-thin">
                  {suggestedAmounts.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => handleAmountChange(formatMoneyInput(suggestion.value.toString()))}
                      className="px-2.5 py-1 text-xs border border-indigo-200 rounded-full hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white whitespace-nowrap"
                      disabled={isProcessing}
                    >
                      <span className="font-medium text-indigo-900">{suggestion.label}</span>
                      <span className="text-gray-500 ml-1">
                        ({new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(suggestion.value)})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Type Indicator */}
            {amount && !formValidation.getFieldError('paymentAmount') && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm">
                  <span className="text-gray-600">Payment Type: </span>
                  <span className={`font-medium ${
                    parseFormattedMoney(amount) === balance ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {parseFormattedMoney(amount) === balance ? 'Full Payment' : 'Partial Payment'}
                  </span>
                </div>
                {parseFormattedMoney(amount) < balance && (
                  <div className="text-sm text-gray-600 mt-1">
                    Remaining balance: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(balance - parseFormattedMoney(amount))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isProcessing}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isProcessing || Boolean(formValidation.getFieldError('paymentAmount')) || !amount}
                className="min-w-[120px] rounded-full"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </div>
                ) : (
                  'Record Payment'
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
