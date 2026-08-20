import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CurrencyCircleDollar, Calculator, Target } from '@phosphor-icons/react';
import { formatMoneyInput, parseFormattedMoney } from '@/lib/utils';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

interface CarryForwardItem {
  name: string;
  amount: number;
  paid: number;
  balance: number;
  term: string;
  year: string;
  feeStructureId?: string;
  termId?: string;
  academicYearId?: string;
}

interface SelectedCarryForwardFee {
  feeId: string;
  amount: number;
  name: string;
  balance: number;
  amountPaid: number;
  feeBreakdown: CarryForwardItem[];
}

interface CarryForwardPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { 
    amount: number; 
    paymentType: 'general' | 'item-specific';
    targetItem?: CarryForwardItem;
  }) => Promise<void>;
  fee: SelectedCarryForwardFee;
}

export function CarryForwardPaymentModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  fee 
}: CarryForwardPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'general' | 'item-specific'>('general');
  const [selectedItem, setSelectedItem] = useState<CarryForwardItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const balance = fee.balance;
  const hasMultipleItems = fee.feeBreakdown && fee.feeBreakdown.length > 1;

  const validateAmount = (value: string): string | undefined => {
    const numValue = parseFormattedMoney(value);
    
    if (!value || value.trim() === '') {
      return 'Amount is required';
    }
    
    if (numValue <= 0) {
      return 'Amount must be a positive number';
    }
    
    if (paymentType === 'item-specific' && selectedItem) {
      if (numValue > selectedItem.balance) {
        return `Amount cannot exceed item balance of ${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(selectedItem.balance)}`;
      }
    } else {
      if (numValue > balance) {
        return `Amount cannot exceed total balance of ${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(balance)}`;
      }
    }
    
    return undefined;
  };

  const formValidation = useFormValidation([
    createFieldValidation('carryPaymentItem', selectedItem, 'Carry-forward item', paymentType === 'item-specific', {
      active: paymentType === 'item-specific',
      message: 'Choose the carry-forward item to pay.',
    }),
    createFieldValidation('carryPaymentAmount', amount, 'Payment amount', true, {
      message: 'Enter the payment amount.',
      validate: (value) => validateAmount(String(value ?? '')),
    }),
  ]);

  const handleAmountChange = (value: string) => {
    const formatted = formatMoneyInput(value);
    setAmount(formatted);
    formValidation.handleFieldChange('carryPaymentAmount');
  };

  const handlePaymentTypeChange = (type: 'general' | 'item-specific') => {
    setPaymentType(type);
    setSelectedItem(null);
    setAmount('');
    formValidation.resetValidation();
  };

  const handleItemSelect = (item: CarryForwardItem) => {
    setSelectedItem(item);
    setAmount('');
    formValidation.handleFieldChange('carryPaymentItem');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formValidation.validateAll().isValid) return;

    setIsProcessing(true);

    try {
      await onSubmit({ 
        amount: parseFormattedMoney(amount),
        paymentType,
        targetItem: selectedItem || undefined
      });
      setAmount('');
      setPaymentType('general');
      setSelectedItem(null);
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
      setPaymentType('general');
      setSelectedItem(null);
      formValidation.resetValidation();
      onClose();
    }
  };

  const getDistributionPreview = () => {
    if (paymentType !== 'general' || !amount || !fee.feeBreakdown) return null;
    
    const totalAmount = parseFormattedMoney(amount);
    const totalBalance = fee.feeBreakdown.reduce((sum, item) => sum + item.balance, 0);
    
    return fee.feeBreakdown.map(item => ({
      ...item,
      allocation: (item.balance / totalBalance) * totalAmount
    }));
  };

  const distributionPreview = getDistributionPreview();

  const suggestedAmounts = paymentType === 'item-specific' && selectedItem ? [
    { label: 'Full', value: selectedItem.balance },
    { label: 'Half', value: Math.round(selectedItem.balance / 2) },
    { label: '25%', value: Math.round(selectedItem.balance * 0.25) },
  ].filter(item => item.value > 0) : [
    { label: 'Full', value: balance },
    { label: 'Half', value: Math.round(balance / 2) },
    { label: '25%', value: Math.round(balance * 0.25) },
  ].filter(item => item.value > 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-bold text-sm text-indigo-600">Shs.</span>
            Record Carry Forward Payment
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
          {/* Fee Information */}
          <div className="bg-indigo-50 rounded-lg p-4">
            <h3 className="font-medium text-indigo-900 mb-2">{fee.name}</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-indigo-700">Total Outstanding:</span>
                <span className="font-bold text-red-600">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(balance)}
                </span>
              </div>
              <div className="text-indigo-700 text-xs">
                {fee.feeBreakdown?.length || 0} item(s) from previous terms
              </div>
            </div>
          </div>

          {/* Payment Type Selection */}
          {hasMultipleItems && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Payment Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handlePaymentTypeChange('general')}
                  className={`p-2.5 border rounded-full text-center transition-all flex items-center justify-center gap-2 ${
                    paymentType === 'general' 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-sm ring-1 ring-indigo-500/30' 
                      : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  <Calculator className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-semibold">General Payment</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => handlePaymentTypeChange('item-specific')}
                  className={`p-2.5 border rounded-full text-center transition-all flex items-center justify-center gap-2 ${
                    paymentType === 'item-specific' 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-sm ring-1 ring-indigo-500/30' 
                      : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  <Target className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-semibold">Item Specific</span>
                </button>
              </div>
            </div>
          )}

          {/* Item Selection for Item-Specific Payment */}
          {paymentType === 'item-specific' && fee.feeBreakdown && (
            <div id="carryPaymentItem" tabIndex={-1} aria-invalid={Boolean(formValidation.getFieldError('carryPaymentItem'))} aria-describedby={formValidation.getFieldError('carryPaymentItem') ? 'carryPaymentItem-error' : undefined} className="rounded-md aria-invalid:border aria-invalid:border-red-600 aria-invalid:bg-red-50/70 aria-invalid:p-2">
              <label className={`block text-sm font-medium mb-3 ${formValidation.getFieldError('carryPaymentItem') ? 'text-red-700' : 'text-gray-700'}`}>
                Select Item to Pay:
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {fee.feeBreakdown.map((item, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleItemSelect(item)}
                    className={`w-full p-3 border rounded-lg text-left transition-all ${
                      selectedItem === item 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-sm text-gray-600">{item.term} - {item.year}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-red-600">
                          {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(item.balance)}
                        </div>
                        <div className="text-xs text-gray-500">Balance</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <FieldError error={formValidation.getFieldError('carryPaymentItem')} />
            </div>
          )}

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="carryPaymentAmount" className={`block text-sm font-medium mb-2 ${formValidation.getFieldError('carryPaymentAmount') ? 'text-red-700' : 'text-gray-700'}`}>
                Payment Amount (UGX)
              </label>
              <input
                type="text"
                id="carryPaymentAmount"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="Enter amount"
                {...formValidation.getFieldProps('carryPaymentAmount')}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 aria-invalid:border-red-600 aria-invalid:bg-red-50/70 aria-invalid:ring-red-200 ${
                  formValidation.getFieldError('carryPaymentAmount') ? 'border-red-600' : 'border-gray-300'
                }`}
                disabled={isProcessing}
              />
              <FieldError error={formValidation.getFieldError('carryPaymentAmount')} />
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

            {/* Distribution Preview for General Payment */}
            {paymentType === 'general' && distributionPreview && amount && !formValidation.getFieldError('carryPaymentAmount') && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Payment Distribution Preview:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {distributionPreview.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{item.name} ({item.term})</span>
                      <span className="font-medium text-gray-900">
                        {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(item.allocation)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Type Indicator */}
            {amount && !formValidation.getFieldError('carryPaymentAmount') && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm">
                  <span className="text-gray-600">Payment Type: </span>
                  <span className="font-medium text-indigo-600">
                    {paymentType === 'general' ? 'General Distribution' : 'Item Specific'}
                  </span>
                </div>
                {paymentType === 'item-specific' && selectedItem && (
                  <div className="text-sm text-gray-600 mt-1">
                    Target: {selectedItem.name} ({selectedItem.term} - {selectedItem.year})
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
                disabled={isProcessing || Boolean(formValidation.getFieldError('carryPaymentAmount')) || Boolean(formValidation.getFieldError('carryPaymentItem')) || !amount}
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
