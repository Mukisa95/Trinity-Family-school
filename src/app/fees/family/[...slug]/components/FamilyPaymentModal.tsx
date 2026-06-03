'use client';

import React, { useState, useEffect } from 'react';
import { X, Users, CurrencyDollar, Check } from '@phosphor-icons/react';
import { toast } from '@/hooks/use-toast';
import { formatMoneyInput, parseFormattedMoney } from '@/lib/utils';

// Types
import type { Pupil } from '@/types';

interface FeeWithPayment {
  feeStructureId: string;
  name: string;
  amount: number;
  paid: number;
  balance: number;
  termId: string;
  academicYearId?: string;
  isCurrentTerm: boolean;
  isCarryForward: boolean;
}

interface FeesInfo {
  totalFees: number;
  totalPaid: number;
  balance: number;
  applicableFees: Array<FeeWithPayment>;
}

interface SelectedPupilFee {
  pupilId: string;
  pupilName: string;
  feeStructureId: string;
  feeName: string;
  maxAmount: number; // Maximum payable amount (balance)
  selectedAmount: number; // Amount to pay for this fee
  termId?: string;
  academicYearId?: string;
  isCarryForward?: boolean;
  isComplete?: boolean; // If true, always pay full balance for this fee
}

interface FamilyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyPupils: Pupil[];
  feesInfo: Record<string, FeesInfo>;
  onPaymentSubmit: (paymentData: {
    totalAmount: number;
    paymentMethod: string;
    selectedFees: SelectedPupilFee[];
    paidBy: string;
  }) => Promise<void> | void;
}

export function FamilyPaymentModal({
  isOpen,
  onClose,
  familyPupils,
  feesInfo,
  onPaymentSubmit
}: FamilyPaymentModalProps) {
  const [selectedFees, setSelectedFees] = useState<SelectedPupilFee[]>([]);
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paidBy, setPaidBy] = useState<string>('Family Payment');
  const [distributionMode, setDistributionMode] = useState<'equal' | 'proportional' | 'smart' | 'manual'>('smart');
  const [isRecording, setIsRecording] = useState(false);

  const getFeeKey = (fee: Pick<SelectedPupilFee, 'feeStructureId' | 'termId' | 'academicYearId' | 'isCarryForward'>) =>
    `${fee.isCarryForward ? 'cf' : 'current'}:${fee.feeStructureId}:${fee.academicYearId || ''}:${fee.termId || ''}`;

  // Helper: recalculate distributed amounts for automatic modes
  const recalculateDistributedAmounts = (
    fees: SelectedPupilFee[],
    amount: number,
    mode: 'equal' | 'proportional' | 'smart' | 'manual'
  ): SelectedPupilFee[] => {
    if (fees.length === 0) return fees;

    // Manual mode: don't auto-distribute, but still ensure "complete" items are fully paid
    if (mode === 'manual') {
      return fees.map(fee => ({
        ...fee,
        selectedAmount: fee.isComplete ? fee.maxAmount : fee.selectedAmount
      }));
    }

    if (amount <= 0) {
      // No amount entered - only ensure completed items are at full amount
      return fees.map(fee => ({
        ...fee,
        selectedAmount: fee.isComplete ? fee.maxAmount : 0
      }));
    }

    // First, fully pay all fees marked as complete
    const completedTotal = fees
      .filter(fee => fee.isComplete)
      .reduce((sum, fee) => sum + fee.maxAmount, 0);

    let remainingAmount = Math.max(0, amount - completedTotal);

    // Start with all completed fees fully paid, others zero
    const updated = fees.map(fee => ({
      ...fee,
      selectedAmount: fee.isComplete ? fee.maxAmount : 0
    }));

    // Work only on fees that are NOT marked complete
    const incompleteIndices = updated
      .map((fee, index) => ({ fee, index }))
      .filter(({ fee }) => !fee.isComplete)
      .map(({ index }) => index);

    if (incompleteIndices.length === 0 || remainingAmount <= 0) {
      return updated;
    }

    if (mode === 'equal') {
      // Equal distribution among incomplete fees
      const amountPerFee = remainingAmount / incompleteIndices.length;
      incompleteIndices.forEach(index => {
        const fee = updated[index];
        fee.selectedAmount = Math.min(amountPerFee, fee.maxAmount);
      });
    } else if (mode === 'proportional') {
      // Proportional distribution based on balance among incomplete fees
      const totalBalance = incompleteIndices.reduce(
        (sum, index) => sum + updated[index].maxAmount,
        0
      );
      if (totalBalance > 0) {
        incompleteIndices.forEach(index => {
          const fee = updated[index];
          const proportion = fee.maxAmount / totalBalance;
          fee.selectedAmount = Math.min(remainingAmount * proportion, fee.maxAmount);
        });
      }
    } else if (mode === 'smart') {
      // Smart distribution: pay smaller balances first, then distribute remaining among incomplete fees
      // Sort incomplete fees by balance (smallest first) using indices to preserve original order
      const sortedIndices = [...incompleteIndices].sort(
        (a, b) => updated[a].maxAmount - updated[b].maxAmount
      );

      // First pass: clear smaller balances for incomplete fees
      sortedIndices.forEach(index => {
        const fee = updated[index];
        if (remainingAmount >= fee.maxAmount) {
          fee.selectedAmount = fee.maxAmount;
          remainingAmount -= fee.maxAmount;
        } else {
          fee.selectedAmount = 0;
        }
      });

      // Second pass: distribute remaining amount to unpaid fees
      const unpaidIndices = sortedIndices.filter(index => updated[index].selectedAmount === 0);

      if (unpaidIndices.length > 0 && remainingAmount > 0) {
        if (unpaidIndices.length === 1) {
          const fee = updated[unpaidIndices[0]];
          fee.selectedAmount = Math.min(remainingAmount, fee.maxAmount);
        } else {
          const unpaidTotalBalance = unpaidIndices.reduce(
            (sum, index) => sum + updated[index].maxAmount,
            0
          );
          unpaidIndices.forEach(index => {
            const fee = updated[index];
            const proportion = fee.maxAmount / unpaidTotalBalance;
            fee.selectedAmount = Math.min(remainingAmount * proportion, fee.maxAmount);
          });
        }
      }
    }
    return updated;
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedFees([]);
      setTotalAmount('');
      setPaymentMethod('Cash');
      setPaidBy('Family Payment');
      setDistributionMode('smart');
      setIsRecording(false);
    }
  }, [isOpen]);

  // Calculate distributed amounts when total amount or distribution mode changes
  useEffect(() => {
    if (distributionMode === 'manual') return;

    setSelectedFees(prev =>
      recalculateDistributedAmounts(prev, parseFormattedMoney(totalAmount), distributionMode)
    );
  }, [totalAmount, distributionMode]);

  const handleFeeSelection = (pupilId: string, pupilName: string, fee: FeeWithPayment, selected: boolean) => {
    setSelectedFees(prev => {
      let updated: SelectedPupilFee[];

      if (selected) {
        // Add fee to selection
        const newFee: SelectedPupilFee = {
          pupilId,
          pupilName,
          feeStructureId: fee.feeStructureId,
          feeName: fee.name,
          maxAmount: fee.balance,
          selectedAmount: 0,
          termId: fee.termId,
          academicYearId: fee.academicYearId,
          isCarryForward: fee.isCarryForward,
          isComplete: false
        };
        updated = [...prev, newFee];
      } else {
        // Remove fee from selection
        updated = prev.filter(
          f => !(f.pupilId === pupilId && getFeeKey(f) === getFeeKey(fee))
        );
      }

      // For automatic modes, recalculate distribution immediately so UI updates live
      const parsedAmount = parseFormattedMoney(totalAmount);
      if (distributionMode !== 'manual' && parsedAmount > 0) {
        return recalculateDistributedAmounts(updated, parsedAmount, distributionMode);
      }

      return updated;
    });
  };

  const toggleFeeComplete = (feeKey: string, pupilId: string) => {
    setSelectedFees(prev => {
      const updated = prev.map(fee =>
        getFeeKey(fee) === feeKey && fee.pupilId === pupilId
          ? {
              ...fee,
              isComplete: !fee.isComplete,
              // In manual mode, immediately set full amount when marking complete
              selectedAmount:
                !fee.isComplete && distributionMode === 'manual'
                  ? fee.maxAmount
                  : fee.selectedAmount
            }
          : fee
      );

      const parsedAmount = parseFormattedMoney(totalAmount);
      if (distributionMode !== 'manual' && parsedAmount > 0) {
        return recalculateDistributedAmounts(updated, parsedAmount, distributionMode);
      }

      return updated;
    });
  };

  const handleManualAmountChange = (feeKey: string, pupilId: string, value: string) => {
    const formatted = formatMoneyInput(value);
    const newAmount = parseFormattedMoney(formatted);
    setSelectedFees(prev =>
      prev.map(fee => {
        if (getFeeKey(fee) === feeKey && fee.pupilId === pupilId) {
          const clamped = Math.min(Math.max(0, newAmount), fee.maxAmount);
          return {
            ...fee,
            selectedAmount: clamped,
            // If user edits amount manually, clear "complete" flag unless it's still full amount
            isComplete: clamped === fee.maxAmount ? fee.isComplete : false
          };
        }
        return fee;
      })
    );
  };

  const handleSubmit = async () => {
    if (selectedFees.length === 0) {
      toast({
        title: "No fees selected",
        description: "Please select at least one fee to make a payment",
        variant: "destructive"
      });
      return;
    }

    const parsedTotalAmount = parseFormattedMoney(totalAmount);
    if (parsedTotalAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid payment amount",
        variant: "destructive"
      });
      return;
    }

    const totalSelectedAmount = selectedFees.reduce((sum, fee) => sum + fee.selectedAmount, 0);
    
    // For manual mode, allow flexible payment amounts
    if (distributionMode === 'manual') {
      if (totalSelectedAmount <= 0) {
        toast({
          title: "Invalid payment amounts",
          description: "Please enter valid payment amounts for the selected fees",
          variant: "destructive"
        });
        return;
      }
      // Update total amount to match selected amounts in manual mode
      setTotalAmount(formatMoneyInput(totalSelectedAmount.toString()));
    } else {
      // For automatic modes, ensure amounts match
      if (totalSelectedAmount !== parsedTotalAmount) {
        toast({
          title: "Amount mismatch",
          description: `Selected amounts (${totalSelectedAmount.toLocaleString()}) don't match total amount (${parsedTotalAmount.toLocaleString()})`,
          variant: "destructive"
        });
        return;
      }
    }

    setIsRecording(true);
    try {
      await onPaymentSubmit({
        totalAmount: distributionMode === 'manual' ? totalSelectedAmount : parsedTotalAmount,
        paymentMethod,
        selectedFees,
        paidBy
      });
    } catch (error) {
      console.error('Payment submission error:', error);
      setIsRecording(false);
    }
  };

  const totalSelectedAmount = selectedFees.reduce((sum, fee) => sum + fee.selectedAmount, 0);
  const totalMaxAmount = selectedFees.reduce((sum, fee) => sum + fee.maxAmount, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Family Payment</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isRecording}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Payment Details */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Amount (UGX)
              </label>
              <input
                type="text"
                value={totalAmount}
                onChange={(e) => setTotalAmount(formatMoneyInput(e.target.value))}
                disabled={isRecording}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter total amount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={isRecording}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distribution Mode
              </label>
              <select
                value={distributionMode}
                onChange={(e) => setDistributionMode(e.target.value as 'equal' | 'proportional' | 'smart' | 'manual')}
                disabled={isRecording}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="smart">Smart Distribution (Recommended)</option>
                <option value="equal">Equal Distribution</option>
                <option value="proportional">Proportional to Balance</option>
                <option value="manual">Manual Allocation</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paid By
            </label>
            <input
              type="text"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              disabled={isRecording}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Enter payer name"
            />
          </div>

          {/* Family Members and Fees */}
          <div className="space-y-4">
            <h3 className="text-base font-medium text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Select Fees to Pay
            </h3>

            {familyPupils.map((pupil) => {
              const summary = feesInfo[pupil.id];
              if (!summary?.applicableFees || summary.applicableFees.length === 0) return null;

              return (
                <div key={pupil.id} className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 mb-2 text-sm">
                    {pupil.firstName} {pupil.lastName} - {pupil.className} ({pupil.section})
                  </h4>
                  
                  <div className="space-y-1.5">
                    {summary.applicableFees
                      .filter(fee => fee.balance > 0)
                      .map((fee) => {
                        const feeKey = getFeeKey(fee);
                        const isSelected = selectedFees.some(
                          f => f.pupilId === pupil.id && getFeeKey(f) === feeKey
                        );
                        const selectedFee = selectedFees.find(
                          f => f.pupilId === pupil.id && getFeeKey(f) === feeKey
                        );

                        return (
                          <div
                            key={feeKey}
                            className={`flex items-center justify-between p-2 rounded-md border transition-colors ${
                              isRecording ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                            } ${
                              isSelected 
                                ? 'border-green-500 bg-green-50' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => !isRecording && handleFeeSelection(pupil.id, `${pupil.firstName} ${pupil.lastName}`, fee, !isSelected)}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'border-green-500 bg-green-500' : 'border-gray-300'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 text-sm">
                                  {fee.name}
                                  {fee.feeStructureId.startsWith('uniform') && (
                                    <span className="ml-1 text-purple-600 text-xs">👕</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {fee.isCarryForward && <span className="text-orange-600">(CF) </span>}
                                  Balance: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.balance)}
                                </div>
                              </div>
                            </div>
                            {isSelected && selectedFee && (
                              <div className="flex items-center gap-3">
                                <label
                                  className="flex items-center gap-1 text-xs text-gray-600"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!selectedFee.isComplete}
                                    onChange={() =>
                                      !isRecording && toggleFeeComplete(feeKey, pupil.id)
                                    }
                                    disabled={isRecording}
                                    className="h-3 w-3 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <span>Mark complete</span>
                                </label>

                                {distributionMode === 'manual' ? (
                                  <div
                                    className="flex items-center gap-1"
                                    // Prevent clicking inside the manual amount input from toggling fee selection
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="text-xs text-gray-600">Pay:</span>
                                    <input
                                      type="text"
                                      value={formatMoneyInput(selectedFee.selectedAmount.toString())}
                                      onChange={(e) =>
                                        handleManualAmountChange(
                                          feeKey,
                                          pupil.id,
                                          e.target.value
                                        )
                                      }
                                      className="w-24 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                      disabled={selectedFee.isComplete || isRecording}
                                    />
                                  </div>
                                ) : (
                                  <div className="text-xs font-medium text-green-600">
                                    Pay:{' '}
                                    {new Intl.NumberFormat('en-UG', {
                                      style: 'currency',
                                      currency: 'UGX'
                                    }).format(selectedFee.selectedAmount)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          {selectedFees.length > 0 && (
            <div className="mt-4 bg-gray-50 rounded-lg p-3">
              <h4 className="font-medium text-gray-900 mb-2 text-sm">Payment Summary</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Selected Fees:</span>
                  <span>{selectedFees.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>{distributionMode === 'manual' ? 'Total Payment Amount:' : 'Total Amount to Pay:'}</span>
                  <span className="font-medium">{new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(distributionMode === 'manual' ? totalSelectedAmount : parseFormattedMoney(totalAmount))}</span>
                </div>
                {distributionMode !== 'manual' && (
                  <div className="flex justify-between">
                    <span>Amount Distributed:</span>
                    <span className={totalSelectedAmount === parseFormattedMoney(totalAmount) ? 'text-green-600' : 'text-red-600'}>
                      {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(totalSelectedAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Max Payable:</span>
                  <span>{new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(totalMaxAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={isRecording}
            className="px-3 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedFees.length === 0 || parseFormattedMoney(totalAmount) <= 0 || isRecording}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isRecording ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Recording Payment...</span>
              </>
            ) : (
              <>
                <CurrencyDollar className="w-4 h-4" />
                <span>Process Payment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
