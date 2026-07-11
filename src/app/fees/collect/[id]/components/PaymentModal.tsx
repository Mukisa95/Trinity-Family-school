import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CurrencyCircleDollar } from '@phosphor-icons/react';
import { formatMoneyInput, parseFormattedMoney } from '@/lib/utils';

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
  const [errors, setErrors] = useState<{ amount?: string }>({});

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

  const handleAmountChange = (value: string) => {
    const formatted = formatMoneyInput(value);
    setAmount(formatted);
    const error = validateAmount(formatted);
    setErrors(prev => ({ ...prev, amount: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountError = validateAmount(amount);
    if (amountError) {
      setErrors({ amount: amountError });
      return;
    }

    setIsProcessing(true);
    setErrors({});

    try {
      await onSubmit({ amount: parseFormattedMoney(amount) });
      setAmount('');
      // Don't call onClose() here - parent component handles it
    } catch (error) {
      console.error('Payment submission error:', error);
      // Error handling is done in the parent component
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setAmount('');
      setErrors({});
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
            <CurrencyCircleDollar className="w-5 h-5 text-indigo-600" />
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
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Payment Amount (UGX)
              </label>
              <input
                type="text"
                id="amount"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="Enter amount"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.amount ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isProcessing}
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
              )}
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
            {amount && !errors.amount && (
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
                disabled={isProcessing || !!errors.amount || !amount}
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