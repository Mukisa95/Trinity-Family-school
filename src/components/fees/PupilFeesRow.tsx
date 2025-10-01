import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Pupil, Class, FeeStructure } from '@/types';
import type { PupilFeesInfo } from '@/lib/hooks/use-progressive-fees';

interface PupilFeesRowProps {
  pupil: Pupil;
  pupilClass?: Class;
  feesInfo?: PupilFeesInfo;
  isLoading?: boolean;
  onClick?: () => void;
  selectedFeeId?: string;
  availableFeeStructures?: FeeStructure[];
}

export function PupilFeesRow({
  pupil,
  pupilClass,
  feesInfo,
  isLoading = false,
  onClick,
  selectedFeeId,
  availableFeeStructures = []
}: PupilFeesRowProps) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', { 
      style: 'currency', 
      currency: 'UGX',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(amount);
  };


  // Get fee-specific information if a fee is selected
  const getDisplayValues = () => {
    if (selectedFeeId && feesInfo?.applicableFees) {
      const selectedFee = feesInfo.applicableFees.find(fee => fee.feeStructureId === selectedFeeId);
      if (selectedFee) {
        return {
          amount: selectedFee.amount,
          paid: selectedFee.paid,
          balance: selectedFee.balance,
          originalAmount: selectedFee.originalAmount,
          discount: selectedFee.discount,
          feeName: availableFeeStructures.find(fs => fs.id === selectedFeeId)?.name || 'Unknown Fee'
        };
      }
      // If pupil doesn't have the selected fee, return zeros
      return {
        amount: 0,
        paid: 0,
        balance: 0,
        originalAmount: 0,
        discount: null,
        feeName: availableFeeStructures.find(fs => fs.id === selectedFeeId)?.name || 'Unknown Fee'
      };
    }
    
    // Default to total values
    return {
      amount: feesInfo?.totalFees || 0,
      paid: feesInfo?.totalPaid || 0,
      balance: feesInfo?.balance || 0,
      originalAmount: null,
      discount: null,
      feeName: null
    };
  };

  const displayValues = getDisplayValues();

  return (
    <tr 
      className={`hover:bg-gray-50 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Pupil Information */}
      <td className="px-6 py-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-sm font-medium text-indigo-700">
                {pupil.firstName.charAt(0)}{pupil.lastName.charAt(0)}
              </span>
            </div>
          </div>
          <div className="ml-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {pupil.firstName} {pupil.lastName}
                </p>
                {feesInfo?.applicableFees?.some(fee => fee.discount) && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    Discount
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2 text-gray-600 text-sm">
                <span>{pupil.admissionNumber}</span>
                <span>•</span>
                <span>{pupilClass?.code || pupilClass?.name}</span>
                <span>•</span>
                <span>{pupil.section}</span>
              </div>
            </div>
          </div>
        </div>
      </td>

      {/* Total Fees / Fee Amount */}
      <td className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ) : feesInfo ? (
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(displayValues.amount)}
            </p>
            {displayValues.discount && (
              <p className="text-xs text-gray-500">
                Original: {formatCurrency(displayValues.originalAmount || displayValues.amount)}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-gray-400">
            <div className="animate-pulse">⏳</div>
            <span className="text-sm">Calculating...</span>
          </div>
        )}
      </td>

      {/* Total Paid / Fee Paid */}
      <td className="px-6 py-4">
        {isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : feesInfo ? (
          <p className="text-sm font-semibold text-gray-900">
            {formatCurrency(displayValues.paid)}
          </p>
        ) : (
          <div className="flex items-center space-x-2 text-gray-400">
            <div className="animate-pulse">⏳</div>
            <span className="text-sm">Calculating...</span>
          </div>
        )}
      </td>

      {/* Balance */}
      <td className="px-6 py-4">
        {isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : feesInfo ? (
          <div>
            <p className={`text-sm font-semibold ${
              displayValues.balance > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {formatCurrency(displayValues.balance)}
            </p>
            {displayValues.balance === 0 && (
              <Badge variant="default" className="bg-green-100 text-green-800 text-xs mt-1">
                PAID
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-gray-400">
            <div className="animate-pulse">⏳</div>
            <span className="text-sm">Calculating...</span>
          </div>
        )}
      </td>


    </tr>
  );
} 