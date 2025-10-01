'use client';

import React, { useState, useEffect } from 'react';
import { X, Users, CurrencyDollar, Check } from '@phosphor-icons/react';
import { toast } from '@/hooks/use-toast';

// Types
import type { Pupil } from '@/types';

interface FeeWithPayment {
  feeStructureId: string;
  name: string;
  amount: number;
  paid: number;
  balance: number;
  termId: string;
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
  }) => void;
}

export function FamilyPaymentModal({
  isOpen,
  onClose,
  familyPupils,
  feesInfo,
  onPaymentSubmit
}: FamilyPaymentModalProps) {
  const [selectedFees, setSelectedFees] = useState<SelectedPupilFee[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paidBy, setPaidBy] = useState<string>('Family Payment');
  const [distributionMode, setDistributionMode] = useState<'equal' | 'proportional' | 'smart' | 'manual'>('smart');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedFees([]);
      setTotalAmount(0);
      setPaymentMethod('Cash');
      setPaidBy('Family Payment');
      setDistributionMode('smart');
    }
  }, [isOpen]);

  // Calculate distributed amounts when total amount or distribution mode changes
  useEffect(() => {
    if (selectedFees.length > 0 && totalAmount > 0 && distributionMode !== 'manual') {
      const updatedFees = [...selectedFees];
      
      if (distributionMode === 'equal') {
        // Equal distribution
        const amountPerFee = totalAmount / selectedFees.length;
        updatedFees.forEach(fee => {
          fee.selectedAmount = Math.min(amountPerFee, fee.maxAmount);
        });
      } else if (distributionMode === 'proportional') {
        // Proportional distribution based on balance
        const totalBalance = selectedFees.reduce((sum, fee) => sum + fee.maxAmount, 0);
        if (totalBalance > 0) {
          updatedFees.forEach(fee => {
            const proportion = fee.maxAmount / totalBalance;
            fee.selectedAmount = Math.min(totalAmount * proportion, fee.maxAmount);
          });
        }
      } else if (distributionMode === 'smart') {
        // Smart distribution: pay smaller balances first, then distribute remaining
        let remainingAmount = totalAmount;
        
        // Sort fees by balance (smallest first)
        const sortedFees = [...updatedFees].sort((a, b) => a.maxAmount - b.maxAmount);
        
        // First pass: clear smaller balances
        sortedFees.forEach(fee => {
          if (remainingAmount >= fee.maxAmount) {
            fee.selectedAmount = fee.maxAmount;
            remainingAmount -= fee.maxAmount;
          } else {
            fee.selectedAmount = 0;
          }
        });
        
        // Second pass: distribute remaining amount to unpaid fees
        const unpaidFees = sortedFees.filter(fee => fee.selectedAmount === 0);
        if (unpaidFees.length > 0 && remainingAmount > 0) {
          if (unpaidFees.length === 1) {
            // Only one unpaid fee, give it all remaining amount
            unpaidFees[0].selectedAmount = Math.min(remainingAmount, unpaidFees[0].maxAmount);
          } else {
            // Multiple unpaid fees, distribute proportionally among them
            const unpaidTotalBalance = unpaidFees.reduce((sum, fee) => sum + fee.maxAmount, 0);
            unpaidFees.forEach(fee => {
              const proportion = fee.maxAmount / unpaidTotalBalance;
              fee.selectedAmount = Math.min(remainingAmount * proportion, fee.maxAmount);
            });
          }
        }
      }
      
      setSelectedFees(updatedFees);
    }
  }, [totalAmount, distributionMode]);

  const handleFeeSelection = (pupilId: string, pupilName: string, fee: FeeWithPayment, selected: boolean) => {
    if (selected) {
      // Add fee to selection
      const newFee: SelectedPupilFee = {
        pupilId,
        pupilName,
        feeStructureId: fee.feeStructureId,
        feeName: fee.name,
        maxAmount: fee.balance,
        selectedAmount: 0
      };
      setSelectedFees(prev => [...prev, newFee]);
    } else {
      // Remove fee from selection
      setSelectedFees(prev => prev.filter(
        f => !(f.pupilId === pupilId && f.feeStructureId === fee.feeStructureId)
      ));
    }
  };

  const handleManualAmountChange = (feeStructureId: string, pupilId: string, newAmount: number) => {
    setSelectedFees(prev => prev.map(fee => {
      if (fee.feeStructureId === feeStructureId && fee.pupilId === pupilId) {
        return {
          ...fee,
          selectedAmount: Math.min(Math.max(0, newAmount), fee.maxAmount)
        };
      }
      return fee;
    }));
  };

  const handleSubmit = () => {
    if (selectedFees.length === 0) {
      toast({
        title: "No fees selected",
        description: "Please select at least one fee to make a payment",
        variant: "destructive"
      });
      return;
    }

    if (totalAmount <= 0) {
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
      setTotalAmount(totalSelectedAmount);
    } else {
      // For automatic modes, ensure amounts match
      if (totalSelectedAmount !== totalAmount) {
        toast({
          title: "Amount mismatch",
          description: `Selected amounts (${totalSelectedAmount.toLocaleString()}) don't match total amount (${totalAmount.toLocaleString()})`,
          variant: "destructive"
        });
        return;
      }
    }

    onPaymentSubmit({
      totalAmount: distributionMode === 'manual' ? totalSelectedAmount : totalAmount,
      paymentMethod,
      selectedFees,
      paidBy
    });
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
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
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
                type="number"
                value={totalAmount || ''}
                onChange={(e) => setTotalAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
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
                        const isSelected = selectedFees.some(
                          f => f.pupilId === pupil.id && f.feeStructureId === fee.feeStructureId
                        );
                        const selectedFee = selectedFees.find(
                          f => f.pupilId === pupil.id && f.feeStructureId === fee.feeStructureId
                        );

                        return (
                          <div
                            key={fee.feeStructureId}
                            className={`flex items-center justify-between p-2 rounded-md border transition-colors cursor-pointer ${
                              isSelected 
                                ? 'border-green-500 bg-green-50' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => handleFeeSelection(pupil.id, `${pupil.firstName} ${pupil.lastName}`, fee, !isSelected)}
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
                              <div className="flex items-center gap-2">
                                {distributionMode === 'manual' ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-600">Pay:</span>
                                    <input
                                      type="number"
                                      value={selectedFee.selectedAmount}
                                      onChange={(e) => handleManualAmountChange(fee.feeStructureId, pupil.id, Number(e.target.value))}
                                      className="w-20 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                                      min="0"
                                      max={fee.balance}
                                    />
                                  </div>
                                ) : (
                                  <div className="text-xs font-medium text-green-600">
                                    Pay: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(selectedFee.selectedAmount)}
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
                  <span className="font-medium">{new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(distributionMode === 'manual' ? totalSelectedAmount : totalAmount)}</span>
                </div>
                {distributionMode !== 'manual' && (
                  <div className="flex justify-between">
                    <span>Amount Distributed:</span>
                    <span className={totalSelectedAmount === totalAmount ? 'text-green-600' : 'text-red-600'}>
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
            className="px-3 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedFees.length === 0 || totalAmount <= 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <CurrencyDollar className="w-4 h-4" />
            Process Payment
          </button>
        </div>
      </div>
    </div>
  );
}
