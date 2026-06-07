import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calculator, AlertTriangle, CheckCircle } from 'lucide-react';

interface SMSCostCalculatorProps {
  recipientCount: number;
  messageCount: number;
  pricePerSMS?: number;
  currency?: string;
  /** Wallet balance in the same currency — passed in from the live balance fetch */
  walletBalance?: string | null;
}

export const SMSCostCalculator: React.FC<SMSCostCalculatorProps> = ({
  recipientCount,
  messageCount,
  pricePerSMS = 35,
  currency = 'UGX',
  walletBalance,
}) => {
  const totalMessages = recipientCount * messageCount;
  const totalCost = totalMessages * pricePerSMS;

  const balanceNum = walletBalance !== null && walletBalance !== undefined
    ? parseFloat(walletBalance)
    : null;

  const affordableRecipients = balanceNum !== null ? Math.floor(balanceNum / (pricePerSMS * messageCount)) : null;

  const canAfford = balanceNum !== null ? balanceNum >= totalCost : null;
  const shortfall = canAfford === false && balanceNum !== null ? totalCost - balanceNum : 0;

  const formatCurrency = (amount: number) =>
    `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <Card className={`border ${canAfford === false ? 'border-red-200 bg-red-50/20' : 'border-blue-200 bg-blue-50/20'}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Calculator className={`h-4 w-4 shrink-0 ${canAfford === false ? 'text-red-600' : 'text-blue-600'}`} />
            <span className={`text-sm font-medium truncate ${canAfford === false ? 'text-red-800' : 'text-blue-800'}`}>
              SMS Cost: {formatCurrency(pricePerSMS)} each
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-xs shrink-0 ${canAfford === false
              ? 'bg-red-100 text-red-700 border-red-200'
              : 'bg-blue-100 text-blue-700 border-blue-200'}`}
          >
            {canAfford === false ? 'Insufficient Balance' : 'Live'}
          </Badge>
        </div>

        {/* Stats + total cost */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white p-3 rounded border border-blue-100">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-xs text-gray-500 mb-1">Recipients</div>
                <div className="text-lg font-bold text-gray-900">{recipientCount}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Total SMS</div>
                <div className="text-lg font-bold text-blue-600">{totalMessages}</div>
              </div>
            </div>
          </div>

          <div className={`p-3 rounded border text-center ${canAfford === false ? 'bg-red-50 border-red-100' : 'bg-white border-blue-100'}`}>
            <div className="text-xs text-gray-500 mb-1">Total Cost</div>
            <div className={`text-lg font-bold ${canAfford === false ? 'text-red-700' : 'text-blue-700'}`}>
              {formatCurrency(totalCost)}
            </div>
          </div>
        </div>

        {/* Alert — insufficient balance */}
        {canAfford === false && recipientCount > 0 && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Insufficient balance.</strong> You need {formatCurrency(shortfall)} more to send this message.
              {affordableRecipients !== null && affordableRecipients > 0 && (
                <> You can currently reach <strong>{affordableRecipients}</strong> recipients.</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Success hint — can afford */}
        {canAfford === true && recipientCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5">
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
            Balance sufficient to send this message.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
