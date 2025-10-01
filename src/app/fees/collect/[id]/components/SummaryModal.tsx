'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

// Icons
import { 
  X, 
  User, 
  GraduationCap, 
  Calendar, 
  CurrencyCircleDollar,
  CheckCircle,
  Clock,
  XCircle,
  Receipt,
  Printer
} from '@phosphor-icons/react';

// Types
import type { Pupil, AcademicYear, SchoolSettings } from '@/types';
import type { PupilFee } from '../types';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';

// Utils
import { generateFeeStatementPDF } from '../utils/pdfGenerator';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupil: Pupil;
  fees: PupilFee[];
  selectedAcademicYear?: AcademicYear | null;
  selectedTerm?: string;
}

export function SummaryModal({
  isOpen,
  onClose,
  pupil,
  fees,
  selectedAcademicYear,
  selectedTerm
}: SummaryModalProps) {
  const { data: schoolSettings } = useSchoolSettings();
  
  // Calculate summary statistics
  const totalFees = fees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
  const totalPaid = fees.reduce((sum, fee) => sum + (fee.paid || 0), 0);
  const totalBalance = totalFees - totalPaid;
  const paymentProgress = totalFees > 0 ? (totalPaid / totalFees) * 100 : 0;

  // Categorize fees by payment status
  const paidFees = fees.filter(fee => (fee.balance || 0) === 0);
  const partialFees = fees.filter(fee => (fee.paid || 0) > 0 && (fee.balance || 0) > 0);
  const unpaidFees = fees.filter(fee => (fee.paid || 0) === 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', { 
      style: 'currency', 
      currency: 'UGX' 
    }).format(amount);
  };

  // Get payment status badge
  const getPaymentStatusBadge = (fee: PupilFee) => {
    const balance = fee.balance || 0;
    const paid = fee.paid || 0;

    if (balance === 0 && paid > 0) {
      return <Badge variant="default" className="bg-green-100 text-green-800">PAID</Badge>;
    } else if (paid > 0 && balance > 0) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">PARTIAL</Badge>;
    } else {
      return <Badge variant="destructive" className="bg-red-100 text-red-800">UNPAID</Badge>;
    }
  };

  const handlePrint = async () => {
    try {
      await generateFeeStatementPDF({
        pupil,
        fees,
        selectedAcademicYear,
        selectedTerm,
        includePaymentHistory: true,
        includeSignature: true,
        schoolSettings
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Could add toast notification here
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-gray-900">
              Fees Summary
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Printer size={16} />
                Print
              </Button>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Student Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User size={20} />
              Student Information
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>
                <p className="font-medium">{pupil.firstName} {pupil.lastName}</p>
              </div>
              <div>
                <span className="text-gray-500">Admission No:</span>
                <p className="font-medium">{pupil.admissionNumber}</p>
              </div>
              <div>
                <span className="text-gray-500">Class:</span>
                <p className="font-medium">{pupil.className}</p>
              </div>
              <div>
                <span className="text-gray-500">Section:</span>
                <p className="font-medium">{pupil.section || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Academic Period */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar size={20} />
              Academic Period
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Academic Year:</span>
                <p className="font-medium">{selectedAcademicYear?.name || 'All Years'}</p>
              </div>
              <div>
                <span className="text-gray-500">Term:</span>
                <p className="font-medium">{selectedTerm || 'All Terms'}</p>
              </div>
            </div>
          </div>

          {/* Payment Overview */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CurrencyCircleDollar size={20} />
              Payment Overview
            </h3>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Payment Progress</span>
                <span>{paymentProgress.toFixed(1)}%</span>
              </div>
              <Progress value={paymentProgress} className="h-3" />
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-sm text-blue-600 font-medium">Total Fees</p>
                <p className="text-lg font-bold text-blue-900">{formatCurrency(totalFees)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-sm text-green-600 font-medium">Total Paid</p>
                <p className="text-lg font-bold text-green-900">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-sm text-red-600 font-medium">Balance</p>
                <p className="text-lg font-bold text-red-900">{formatCurrency(totalBalance)}</p>
              </div>
            </div>

            {/* Payment Status Breakdown */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                <span>Paid: {paidFees.length} fees</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-yellow-600" />
                <span>Partial: {partialFees.length} fees</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle size={16} className="text-red-600" />
                <span>Unpaid: {unpaidFees.length} fees</span>
              </div>
            </div>
          </div>

          {/* Detailed Fees Table */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Receipt size={20} />
                Detailed Fees Breakdown
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fee Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Paid
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fees.map((fee) => (
                    <tr key={fee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{fee.name}</p>
                          {fee.description && (
                            <p className="text-xs text-gray-500">{fee.description}</p>
                          )}
                          {fee.discount && (
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {fee.discount.type === 'percentage' 
                                  ? `${fee.discount.amount}% discount` 
                                  : `${formatCurrency(fee.discount.amount)} discount`
                                }
                              </Badge>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {fee.category}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(fee.amount || 0)}
                        {fee.originalAmount && fee.originalAmount !== fee.amount && (
                          <div className="text-xs text-gray-400 line-through">
                            {formatCurrency(fee.originalAmount)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">
                        {formatCurrency(fee.paid || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600 text-right font-medium">
                        {formatCurrency(fee.balance || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getPaymentStatusBadge(fee)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-900">
                      TOTALS
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      {formatCurrency(totalFees)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">
                      {formatCurrency(totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">
                      {formatCurrency(totalBalance)}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Previous Term Balances */}
          {fees.some(fee => fee.feeBreakdown) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Previous Term Balances
              </h3>
              {fees
                .filter(fee => fee.feeBreakdown)
                .map(fee => (
                  <div key={fee.id} className="space-y-2">
                    <h4 className="font-medium text-gray-900">{fee.name}</h4>
                    <div className="grid gap-2">
                      {fee.feeBreakdown?.map((breakdown, index) => (
                        <div key={index} className="flex justify-between items-center text-sm bg-white rounded p-2">
                          <span>{breakdown.name} ({breakdown.term} - {breakdown.year})</span>
                          <div className="flex gap-4">
                            <span>Amount: {formatCurrency(breakdown.amount)}</span>
                            <span>Paid: {formatCurrency(breakdown.paid)}</span>
                            <span className="font-medium text-red-600">
                              Balance: {formatCurrency(breakdown.balance)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 