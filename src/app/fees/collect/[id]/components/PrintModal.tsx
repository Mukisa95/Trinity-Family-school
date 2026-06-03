import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer } from '@phosphor-icons/react';

// Types
import type { Pupil, AcademicYear, SchoolSettings } from '@/types';
import type { PupilFee } from '../types';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';

// Utils
import { generateFeeStatementPDF } from '../utils/pdfGenerator';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  fees: PupilFee[];
  pupil?: Pupil;
  selectedAcademicYear?: AcademicYear | null;
  selectedTerm?: string;
  onPrint?: (selectedFees: PupilFee[]) => void;
}

export function PrintModal({ 
  isOpen, 
  onClose, 
  fees, 
  pupil,
  selectedAcademicYear,
  selectedTerm,
  onPrint 
}: PrintModalProps) {
  const [selectedFees, setSelectedFees] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: schoolSettings } = useSchoolSettings();

  const handleToggleFee = (feeId: string) => {
    setSelectedFees(prev => 
      prev.includes(feeId) 
        ? prev.filter(id => id !== feeId)
        : [...prev, feeId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFees.length === fees.length) {
      setSelectedFees([]);
    } else {
      setSelectedFees(fees.map(fee => fee.id));
    }
  };

  const handlePrint = async () => {
    const selectedFeeItems = fees.filter(fee => selectedFees.includes(fee.id));
    
    if (pupil && selectedFeeItems.length > 0) {
      setIsGenerating(true);
      try {
        await generateFeeStatementPDF({
          pupil,
          fees: selectedFeeItems,
          selectedAcademicYear,
          selectedTerm,
          includePaymentHistory: true,
          includeSignature: true,
          schoolSettings
        });
      } catch (error) {
        console.error('Error generating PDF:', error);
      } finally {
        setIsGenerating(false);
      }
    }
    
    // Call the optional onPrint callback
    onPrint?.(selectedFeeItems);
    
    setSelectedFees([]);
    onClose();
  };

  const handleClose = () => {
    setSelectedFees([]);
    onClose();
  };

  const selectedFeesData = fees.filter(fee => selectedFees.includes(fee.id));
  const totalAmount = selectedFeesData.reduce((sum, fee) => sum + (fee.amount || 0), 0);
  const totalPaid = selectedFeesData.reduce((sum, fee) => sum + (fee.paid || 0), 0);
  const totalBalance = totalAmount - totalPaid;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            Select Fees to Print
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Summary */}
          {selectedFees.length > 0 && (
            <div className="bg-indigo-50 rounded-lg p-4 mb-4">
              <h3 className="font-medium text-indigo-900 mb-2">
                Selected: {selectedFees.length} fee{selectedFees.length !== 1 ? 's' : ''}
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-indigo-700">Total Amount:</span>
                  <div className="font-medium text-indigo-900">
                    {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(totalAmount)}
                  </div>
                </div>
                <div>
                  <span className="text-indigo-700">Total Paid:</span>
                  <div className="font-medium text-green-600">
                    {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(totalPaid)}
                  </div>
                </div>
                <div>
                  <span className="text-indigo-700">Total Balance:</span>
                  <div className="font-medium text-red-600">
                    {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(totalBalance)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Select All */}
          {fees.length > 0 && (
            <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-gray-200">
              <Checkbox
                id="select-all"
                checked={selectedFees.length === fees.length}
                onCheckedChange={handleSelectAll}
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Select All ({fees.length} fees)
              </label>
            </div>
          )}

          {/* Fees List */}
          <div className="flex-1 overflow-y-auto">
            {fees.length === 0 ? (
              <div className="text-center py-8">
                <Printer className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No fees available</h3>
                <p className="mt-1 text-sm text-gray-500">
                  There are no fees to print for the selected term.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {fees.map((fee) => {
                  const balance = (fee.balance || 0);
                  const paid = (fee.paid || 0);
                  const paymentStatus = balance === 0 && paid > 0 ? 'paid' : 
                                       paid > 0 && balance > 0 ? 'partial' : 'unpaid';
                  
                  return (
                    <div key={fee.id} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <Checkbox
                        id={fee.id}
                        checked={selectedFees.includes(fee.id)}
                        onCheckedChange={() => handleToggleFee(fee.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <label
                              htmlFor={fee.id}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {fee.name}
                            </label>
                            {fee.description && (
                              <p className="text-xs text-gray-500 mt-1">{fee.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                {fee.category}
                              </span>
                              {fee.isRequired ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Required
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Optional
                                </span>
                              )}
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                                ${paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                                  paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'}`}>
                                {paymentStatus.toUpperCase()}
                              </span>
                              {fee.discount && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Discount Applied
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.amount || 0)}
                            </div>
                            {fee.originalAmount && fee.originalAmount !== fee.amount && (
                              <div className="text-xs text-gray-400 line-through">
                                {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.originalAmount)}
                              </div>
                            )}
                            {paid > 0 && (
                              <div className="text-xs text-green-600">
                                Paid: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(paid)}
                              </div>
                            )}
                            {balance > 0 && (
                              <div className="text-xs text-red-600">
                                Balance: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(balance)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button 
            onClick={handlePrint}
            disabled={selectedFees.length === 0 || isGenerating}
            className="min-w-[120px]"
          >
            <Printer className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating...' : `Print Selected (${selectedFees.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 