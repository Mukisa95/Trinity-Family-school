'use client';

import React, { useEffect, useState } from 'react';
import { X, CurrencyDollar, Users } from '@phosphor-icons/react';
import { toast } from '@/hooks/use-toast';
import { formatMoneyInput, parseFormattedMoney } from '@/lib/utils';
import { findDiscountAwarePaymentViolation } from '@/lib/utils/fee-discount-calculation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SimpleFee {
  id: string;
  name: string;
  balance: number;
  isCarryForward?: boolean;
  feeBreakdown?: Array<{
    name: string;
    amount: number;
    paid: number;
    balance: number;
    term: string;
    year: string;
    feeStructureId?: string;
    termId?: string;
    academicYearId?: string;
  }>;
}

interface SelectedFee {
  feeId: string;
  feeName: string;
  maxAmount: number;
  selectedAmount: number;
  isComplete?: boolean; // If true, always pay full balance for this fee
  isCarryForward?: boolean;
  feeBreakdown?: SimpleFee['feeBreakdown'];
}

interface MultiFeePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupilName: string;
  fees: SimpleFee[];
  onPaymentSubmit: (paymentData: {
    totalAmount: number;
    paymentMethod: string;
    selectedFees: SelectedFee[];
    paidBy: string;
  }) => Promise<void> | void;
}

type DistributionMode = 'equal' | 'proportional' | 'smart' | 'manual';

export function MultiFeePaymentModal({
  isOpen,
  onClose,
  pupilName,
  fees,
  onPaymentSubmit
}: MultiFeePaymentModalProps) {
  const [selectedFees, setSelectedFees] = useState<SelectedFee[]>([]);
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paidBy, setPaidBy] = useState<string>(pupilName || 'Parent / Guardian');
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('smart');
  const [isRecording, setIsRecording] = useState(false);

  // Helper: recalculate distributed amounts for automatic modes
  const recalculateDistributedAmounts = (
    currentFees: SelectedFee[],
    amount: number,
    mode: DistributionMode
  ): SelectedFee[] => {
    if (currentFees.length === 0) return currentFees;

    // Manual mode: don't auto-distribute, but still ensure "complete" items are fully paid
    if (mode === 'manual') {
      return currentFees.map(fee => ({
        ...fee,
        selectedAmount: fee.isComplete ? fee.maxAmount : fee.selectedAmount
      }));
    }

    if (amount <= 0) {
      // No amount entered - only ensure completed items are at full amount
      return currentFees.map(fee => ({
        ...fee,
        selectedAmount: fee.isComplete ? fee.maxAmount : 0
      }));
    }

    // First, fully pay all fees marked as complete
    const completedTotal = currentFees
      .filter(fee => fee.isComplete)
      .reduce((sum, fee) => sum + fee.maxAmount, 0);

    let remainingAmount = Math.max(0, amount - completedTotal);

    // Start with all completed fees fully paid, others zero
    const updated = currentFees.map(fee => ({
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
      const amountPerFee = remainingAmount / incompleteIndices.length;
      incompleteIndices.forEach(index => {
        const fee = updated[index];
        fee.selectedAmount = Math.min(amountPerFee, fee.maxAmount);
      });
    } else if (mode === 'proportional') {
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
      const sortedIndices = [...incompleteIndices].sort(
        (a, b) => updated[a].maxAmount - updated[b].maxAmount
      );

      sortedIndices.forEach(index => {
        const fee = updated[index];
        if (remainingAmount >= fee.maxAmount) {
          fee.selectedAmount = fee.maxAmount;
          remainingAmount -= fee.maxAmount;
        } else {
          fee.selectedAmount = 0;
        }
      });

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

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFees([]);
      setTotalAmount('');
      setPaymentMethod('Cash');
      setPaidBy(pupilName || 'Parent / Guardian');
      setDistributionMode('smart');
      setIsRecording(false);
    }
  }, [isOpen, pupilName]);

  // Recalculate when total amount or mode changes
  useEffect(() => {
    if (distributionMode === 'manual') return;
    const parsedAmount = parseFormattedMoney(totalAmount);

    setSelectedFees(prev =>
      recalculateDistributedAmounts(prev, parsedAmount, distributionMode)
    );
  }, [totalAmount, distributionMode]);

  const handleFeeSelection = (fee: SimpleFee, selected: boolean) => {
    setSelectedFees(prev => {
      let updated: SelectedFee[];

      if (selected) {
        const newFee: SelectedFee = {
          feeId: fee.id,
          feeName: fee.name,
          maxAmount: fee.balance,
          selectedAmount: 0,
          isComplete: false,
          isCarryForward: fee.isCarryForward,
          feeBreakdown: fee.feeBreakdown
        };
        updated = [...prev, newFee];
      } else {
        updated = prev.filter(f => f.feeId !== fee.id);
      }

      const parsedAmount = parseFormattedMoney(totalAmount);
      if (distributionMode !== 'manual' && parsedAmount > 0) {
        return recalculateDistributedAmounts(updated, parsedAmount, distributionMode);
      }

      return updated;
    });
  };

  const toggleFeeComplete = (feeId: string) => {
    setSelectedFees(prev => {
      const updated = prev.map(fee =>
        fee.feeId === feeId
          ? {
              ...fee,
              isComplete: !fee.isComplete,
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

  const handleManualAmountChange = (feeId: string, value: string) => {
    const formatted = formatMoneyInput(value);
    const newAmount = parseFormattedMoney(formatted);
    setSelectedFees(prev =>
      prev.map(fee => {
        if (fee.feeId !== feeId) return fee;
        const clamped = Math.min(Math.max(0, newAmount), fee.maxAmount);
        return {
          ...fee,
          selectedAmount: clamped,
          isComplete: clamped === fee.maxAmount ? fee.isComplete : false
        };
      })
    );
  };

  const handleSubmit = async () => {
    if (selectedFees.length === 0) {
      toast({
        title: 'No fees selected',
        description: 'Please select at least one fee to make a payment',
        variant: 'destructive'
      });
      return;
    }

    const parsedTotalAmount = parseFormattedMoney(totalAmount);
    if (parsedTotalAmount <= 0 && distributionMode !== 'manual') {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid total payment amount',
        variant: 'destructive'
      });
      return;
    }

    const totalSelectedAmount = selectedFees.reduce(
      (sum, fee) => sum + fee.selectedAmount,
      0
    );
    const payableSelections = selectedFees.filter((fee) => fee.selectedAmount > 0);
    const currentBalances = new Map(fees.map((fee) => [fee.id, fee.balance]));
    const balanceViolation = findDiscountAwarePaymentViolation(
      payableSelections.map((fee) => ({
        key: fee.feeId,
        feeName: fee.feeName,
        selectedAmount: fee.selectedAmount,
      })),
      currentBalances,
    );

    if (balanceViolation) {
      toast({
        title: 'Fee balance changed',
        description: `${balanceViolation.feeName} now has a balance of UGX ${(balanceViolation.currentBalance || 0).toLocaleString()}. Review the refreshed balances before recording payment.`,
        variant: 'destructive'
      });
      return;
    }

    if (distributionMode === 'manual') {
      if (totalSelectedAmount <= 0) {
        toast({
          title: 'Invalid payment amounts',
          description: 'Please enter valid payment amounts for the selected fees',
          variant: 'destructive'
        });
        return;
      }
    } else {
      if (totalSelectedAmount !== parsedTotalAmount) {
        toast({
          title: 'Amount mismatch',
          description: `Selected amounts (${totalSelectedAmount.toLocaleString()}) don't match total amount (${parsedTotalAmount.toLocaleString()})`,
          variant: 'destructive'
        });
        return;
      }
    }

    setIsRecording(true);
    try {
      await onPaymentSubmit({
        totalAmount: distributionMode === 'manual' ? totalSelectedAmount : parsedTotalAmount,
        paymentMethod,
        selectedFees: payableSelections,
        paidBy
      });
    } catch (error) {
      console.error('Payment submission error:', error);
      setIsRecording(false);
    }
  };

  const totalSelectedAmount = selectedFees.reduce(
    (sum, fee) => sum + fee.selectedAmount,
    0
  );
  const totalMaxAmount = selectedFees.reduce(
    (sum, fee) => sum + fee.maxAmount,
    0
  );

  const handleClose = () => {
    if (!isRecording) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="pl-4 pr-10 pt-3 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <span className="font-bold text-lg text-green-600 dark:text-green-400">Shs.</span>
            <span className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Multi-Fee Payment - {pupilName}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pt-2.5 pb-4 overflow-y-auto flex-1">
          {/* Payment Details */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 dark:text-slate-400">
                Total Amount (UGX)
              </label>
              <input
                type="text"
                value={distributionMode === 'manual' ? formatMoneyInput(totalSelectedAmount.toString()) : totalAmount}
                onChange={(e) =>
                  setTotalAmount(formatMoneyInput(e.target.value))
                }
                disabled={distributionMode === 'manual' || isRecording}
                className="w-full px-4 py-1.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:border-slate-700 dark:disabled:bg-slate-900"
                placeholder="Enter total amount"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 dark:text-slate-400">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={isRecording}
                className="w-full px-4 py-1.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed bg-white dark:border-slate-700 dark:disabled:bg-slate-900 dark:bg-slate-900"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 dark:text-slate-400">
                Distribution Mode
              </label>
              <select
                value={distributionMode}
                onChange={(e) =>
                  setDistributionMode(
                    e.target.value as DistributionMode
                  )
                }
                disabled={isRecording}
                className="w-full px-4 py-1.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed bg-white dark:border-slate-700 dark:disabled:bg-slate-900 dark:bg-slate-900"
              >
                <option value="smart">Smart Distribution</option>
                <option value="equal">Equal Distribution</option>
                <option value="proportional">Proportional to Balance</option>
                <option value="manual">Manual Allocation</option>
              </select>
            </div>
          </div>
          {/* Fees list */}
          <div className="space-y-3">
            <h3 className="text-base font-medium text-gray-900 flex items-center gap-2 dark:text-slate-100">
              <Users className="w-4 h-4" />
              Select Fees to Pay
            </h3>

            {fees.filter(f => f.balance > 0).length === 0 && (
              <p className="text-sm text-gray-500 dark:text-slate-400">
                There are no outstanding fees for this pupil on the selected term.
              </p>
            )}

            {fees
              .filter(f => f.balance > 0)
              .map(fee => {
                const isSelected = selectedFees.some(f => f.feeId === fee.id);
                const selectedFee = selectedFees.find(f => f.feeId === fee.id);

                return (
                  <div
                    key={fee.id}
                    className={`flex items-center justify-between p-2 rounded-md border transition-colors ${
                      isRecording ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                    } ${
                      isSelected
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/40'
                        : 'border-gray-200 hover:border-gray-300 dark:border-slate-700 dark:hover:border-slate-700'
                    }`}
                    onClick={() => !isRecording && handleFeeSelection(fee, !isSelected)}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0 flex-1 mr-4">
                      <span className="font-medium text-sm text-gray-900 truncate dark:text-slate-100">
                        {fee.name}
                        {fee.isCarryForward && (
                          <span className="ml-1 text-orange-600 text-xs whitespace-nowrap dark:text-orange-400">
                            (Carry Forward)
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-500 whitespace-nowrap dark:text-slate-400">
                        Balance:{' '}
                        {new Intl.NumberFormat('en-UG', {
                          style: 'currency',
                          currency: 'UGX'
                        }).format(fee.balance)}
                      </span>
                    </div>

                    {isSelected && selectedFee && (
                      <div className="flex items-center gap-3">
                        <label
                          className="flex items-center gap-1 text-xs text-gray-600 dark:text-slate-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedFee.isComplete}
                            onChange={() => !isRecording && toggleFeeComplete(fee.id)}
                            disabled={isRecording}
                            className="h-3 w-3 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:text-green-400"
                          />
                          <span>Mark complete</span>
                        </label>

                        {distributionMode === 'manual' ? (
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-xs text-gray-600 dark:text-slate-300">
                              Pay:
                            </span>
                            <input
                              type="text"
                              value={formatMoneyInput(selectedFee.selectedAmount.toString())}
                              onChange={(e) =>
                                handleManualAmountChange(
                                  fee.id,
                                  e.target.value
                                )
                              }
                              className="w-24 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700"
                              disabled={selectedFee.isComplete || isRecording}
                            />
                          </div>
                        ) : (
                          <div className="text-xs font-medium text-green-600 dark:text-green-400">
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

          {/* Summary */}
          {selectedFees.length > 0 && (
            <div className="mt-4 bg-gray-50/70 border border-gray-200/50 rounded-xl p-4 dark:bg-slate-900/70 dark:border-slate-700/50">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm dark:text-slate-100">
                Payment Summary
              </h4>
              <div className={`grid gap-4 ${distributionMode === 'manual' ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block dark:text-slate-400">
                    Selected Fees
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                    {selectedFees.length}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block dark:text-slate-400">
                    {distributionMode === 'manual' ? 'Total Payment' : 'Total to Pay'}
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                    {new Intl.NumberFormat('en-UG', {
                      style: 'currency',
                      currency: 'UGX',
                      minimumFractionDigits: 0
                    }).format(
                      distributionMode === 'manual'
                        ? totalSelectedAmount
                        : parseFormattedMoney(totalAmount)
                    )}
                  </span>
                </div>
                {distributionMode !== 'manual' && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block dark:text-slate-400">
                      Distributed
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        totalSelectedAmount === parseFormattedMoney(totalAmount)
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {new Intl.NumberFormat('en-UG', {
                        style: 'currency',
                        currency: 'UGX',
                        minimumFractionDigits: 0
                      }).format(totalSelectedAmount)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block dark:text-slate-400">
                    Max Payable
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                    {new Intl.NumberFormat('en-UG', {
                      style: 'currency',
                      currency: 'UGX',
                      minimumFractionDigits: 0
                    }).format(totalMaxAmount)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 pb-6 pt-2 px-6 bg-transparent">
          <button
            onClick={handleClose}
            disabled={isRecording}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors text-sm disabled:bg-gray-100 disabled:cursor-not-allowed dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-900 dark:disabled:bg-slate-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedFees.length === 0 || isRecording}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isRecording ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent dark:border-slate-700" />
                <span>Recording Payment...</span>
              </>
            ) : (
              <>
                <span className="font-bold text-xs">Shs.</span>
                <span>Process Payment</span>
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

