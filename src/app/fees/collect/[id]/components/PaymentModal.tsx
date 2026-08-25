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
      <DialogContent className="!flex !w-full !max-w-md !flex-col !gap-0 !overflow-hidden !rounded-2xl !border-slate-200 !bg-white !p-0 sm:!max-w-lg">
        <DialogHeader className="flex-none border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white px-4 py-3.5 pr-12 sm:px-6 sm:py-4">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold text-slate-900 sm:text-lg">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
              <CurrencyCircleDollar className="h-5 w-5" weight="bold" aria-hidden="true" />
            </span>
            Record Payment
          </DialogTitle>
        </DialogHeader>
        
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {/* Fee Information */}
          <section className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 sm:p-4" aria-label="Fee payment summary">
            <h3 className="mb-3 break-words text-sm font-semibold leading-5 text-indigo-950 sm:text-base">{fee.name}</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-0 rounded-lg bg-white/80 px-2.5 py-2 shadow-sm ring-1 ring-inset ring-indigo-100">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Total</span>
                <span className="mt-0.5 block break-words text-xs font-semibold tabular-nums text-indigo-950 sm:text-sm">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.amount)}
                </span>
              </div>
              <div className="min-w-0 rounded-lg bg-white/80 px-2.5 py-2 shadow-sm ring-1 ring-inset ring-indigo-100">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Paid</span>
                <span className="mt-0.5 block break-words text-xs font-semibold tabular-nums text-emerald-700 sm:text-sm">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.amountPaid)}
                </span>
              </div>
              <div className="min-w-0 rounded-lg bg-white/80 px-2.5 py-2 shadow-sm ring-1 ring-inset ring-indigo-100">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Balance</span>
                <span className="mt-0.5 block break-words text-xs font-bold tabular-nums text-rose-700 sm:text-sm">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(balance)}
                </span>
              </div>
            </div>
          </section>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
            <div>
              <label htmlFor="paymentAmount" className={`mb-2 block text-sm font-medium ${formValidation.getFieldError('paymentAmount') ? 'text-red-700' : 'text-slate-800'}`}>
                Payment Amount (UGX)
              </label>
              <input
                type="text"
                id="paymentAmount"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="Enter amount"
                inputMode="numeric"
                autoFocus
                {...formValidation.getFieldProps('paymentAmount')}
                className={`min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-base tabular-nums shadow-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 aria-invalid:border-red-600 aria-invalid:bg-red-50/70 aria-invalid:ring-red-200 ${
                  formValidation.getFieldError('paymentAmount') ? 'border-red-600' : 'border-slate-300'
                }`}
                disabled={isProcessing}
              />
              <FieldError error={formValidation.getFieldError('paymentAmount')} />
            </div>

            {/* Suggested Amounts */}
            {suggestedAmounts.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quick Select:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {suggestedAmounts.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => handleAmountChange(formatMoneyInput(suggestion.value.toString()))}
                      className="min-h-11 rounded-xl border border-indigo-200 bg-white px-2 py-1.5 text-center text-xs transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isProcessing}
                      aria-label={`Use ${suggestion.label.toLowerCase()} payment amount of ${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(suggestion.value)}`}
                    >
                      <span className="block font-semibold text-indigo-950">{suggestion.label}</span>
                      <span className="mt-0.5 block break-words text-[10px] leading-3 tabular-nums text-slate-500">
                        {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(suggestion.value)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Type Indicator */}
            {amount && !formValidation.getFieldError('paymentAmount') && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm leading-5">
                  <span className="text-slate-600">Payment Type: </span>
                  <span className={`font-medium ${
                    parseFormattedMoney(amount) === balance ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {parseFormattedMoney(amount) === balance ? 'Full Payment' : 'Partial Payment'}
                  </span>
                </div>
                {parseFormattedMoney(amount) < balance && (
                  <div className="mt-1 text-sm leading-5 text-slate-600">
                    Remaining balance: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(balance - parseFormattedMoney(amount))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-6 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isProcessing}
                className="min-h-11 w-full rounded-full border-slate-300 sm:w-auto sm:min-w-28"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isProcessing || Boolean(formValidation.getFieldError('paymentAmount')) || !amount}
                className="min-h-11 w-full rounded-full sm:w-auto sm:min-w-36"
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
