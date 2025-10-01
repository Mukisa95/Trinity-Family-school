import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CurrencyCircleDollar, Calculator, Target } from '@phosphor-icons/react';

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
  const [errors, setErrors] = useState<{ amount?: string; item?: string }>({});

  const balance = fee.balance;
  const hasMultipleItems = fee.feeBreakdown && fee.feeBreakdown.length > 1;

  const validateAmount = (value: string): string | undefined => {
    const numValue = parseFloat(value);
    
    if (!value || value.trim() === '') {
      return 'Amount is required';
    }
    
    if (isNaN(numValue) || numValue <= 0) {
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

  const validateSelection = (): string | undefined => {
    if (paymentType === 'item-specific' && !selectedItem) {
      return 'Please select an item for specific payment';
    }
    return undefined;
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const error = validateAmount(value);
    setErrors(prev => ({ ...prev, amount: error }));
  };

  const handlePaymentTypeChange = (type: 'general' | 'item-specific') => {
    setPaymentType(type);
    setSelectedItem(null);
    setAmount('');
    setErrors({});
  };

  const handleItemSelect = (item: CarryForwardItem) => {
    setSelectedItem(item);
    setAmount('');
    setErrors(prev => ({ ...prev, item: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountError = validateAmount(amount);
    const selectionError = validateSelection();
    
    if (amountError || selectionError) {
      setErrors({ 
        amount: amountError, 
        item: selectionError 
      });
      return;
    }

    setIsProcessing(true);
    setErrors({});

    try {
      await onSubmit({ 
        amount: parseFloat(amount),
        paymentType,
        targetItem: selectedItem || undefined
      });
      setAmount('');
      setPaymentType('general');
      setSelectedItem(null);
      onClose();
    } catch (error) {
      console.error('Payment submission error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setAmount('');
      setPaymentType('general');
      setSelectedItem(null);
      setErrors({});
      onClose();
    }
  };

  const getDistributionPreview = () => {
    if (paymentType !== 'general' || !amount || !fee.feeBreakdown) return null;
    
    const totalAmount = parseFloat(amount);
    const totalBalance = fee.feeBreakdown.reduce((sum, item) => sum + item.balance, 0);
    
    return fee.feeBreakdown.map(item => ({
      ...item,
      allocation: (item.balance / totalBalance) * totalAmount
    }));
  };

  const distributionPreview = getDistributionPreview();

  const suggestedAmounts = paymentType === 'item-specific' && selectedItem ? [
    { label: 'Full Item Balance', value: selectedItem.balance },
    { label: 'Half Item Balance', value: Math.round(selectedItem.balance / 2) },
    { label: '25% of Item', value: Math.round(selectedItem.balance * 0.25) },
  ].filter(item => item.value > 0) : [
    { label: 'Full Balance', value: balance },
    { label: 'Half Balance', value: Math.round(balance / 2) },
    { label: '25%', value: Math.round(balance * 0.25) },
  ].filter(item => item.value > 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CurrencyCircleDollar className="w-5 h-5 text-indigo-600" />
            Record Carry Forward Payment
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Payment Type:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handlePaymentTypeChange('general')}
                  className={`p-4 border rounded-lg text-left transition-all ${
                    paymentType === 'general' 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="w-5 h-5" />
                    <span className="font-medium">General Payment</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Distribute payment proportionally across all outstanding items
                  </p>
                </button>
                
                <button
                  type="button"
                  onClick={() => handlePaymentTypeChange('item-specific')}
                  className={`p-4 border rounded-lg text-left transition-all ${
                    paymentType === 'item-specific' 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5" />
                    <span className="font-medium">Item Specific</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Apply payment to a specific fee item
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Item Selection for Item-Specific Payment */}
          {paymentType === 'item-specific' && fee.feeBreakdown && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
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
              {errors.item && (
                <p className="mt-1 text-sm text-red-600">{errors.item}</p>
              )}
            </div>
          )}

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Payment Amount (UGX)
              </label>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="Enter amount"
                min="1"
                step="1"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Select:
                </label>
                <div className="flex gap-2 flex-wrap">
                  {suggestedAmounts.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => handleAmountChange(suggestion.value.toString())}
                      className="px-3 py-1 text-sm border border-indigo-200 rounded-md hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={isProcessing}
                    >
                      {suggestion.label}
                      <br />
                      <span className="text-xs text-gray-500">
                        {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(suggestion.value)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Distribution Preview for General Payment */}
            {paymentType === 'general' && distributionPreview && amount && !errors.amount && (
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
            {amount && !errors.amount && (
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
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isProcessing || !!errors.amount || !!errors.item || !amount}
                className="min-w-[120px]"
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