import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calculator, Users, MessageSquare, CreditCard, AlertTriangle, CheckCircle, Wallet } from 'lucide-react';

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

  const affordableMessages = balanceNum !== null ? Math.floor(balanceNum / pricePerSMS) : null;
  const affordableRecipients = balanceNum !== null ? Math.floor(balanceNum / (pricePerSMS * messageCount)) : null;

  const balanceAfterSend = balanceNum !== null ? balanceNum - totalCost : null;
  const canAfford = balanceNum !== null ? balanceNum >= totalCost : null;
  const shortfall = canAfford === false && balanceNum !== null ? totalCost - balanceNum : 0;

  const formatCurrency = (amount: number) =>
    `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <Card className={`border ${canAfford === false ? 'border-red-200 bg-red-50/20' : 'border-blue-200 bg-blue-50/20'}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className={`h-4 w-4 ${canAfford === false ? 'text-red-600' : 'text-blue-600'}`} />
            <span className={`text-sm font-medium ${canAfford === false ? 'text-red-800' : 'text-blue-800'}`}>
              SMS Cost
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${canAfford === false
              ? 'bg-red-100 text-red-700 border-red-200'
              : 'bg-blue-100 text-blue-700 border-blue-200'}`}
          >
            {canAfford === false ? 'Insufficient Balance' : 'Live'}
          </Badge>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white p-2 rounded border border-blue-100">
            <div className="text-xs text-gray-500 mb-1">Recipients</div>
            <div className="text-lg font-bold text-gray-900">{recipientCount}</div>
          </div>
          <div className="bg-white p-2 rounded border border-blue-100">
            <div className="text-xs text-gray-500 mb-1">Total SMS</div>
            <div className="text-lg font-bold text-blue-600">{totalMessages}</div>
          </div>
          <div className="bg-white p-2 rounded border border-blue-100">
            <div className="text-xs text-gray-500 mb-1">Per SMS</div>
            <div className="text-lg font-bold text-orange-600">{formatCurrency(pricePerSMS)}</div>
          </div>
        </div>

        {/* Consolidated Cost & Balance Row */}
        <div className={`grid grid-cols-2 gap-2 ${canAfford === false ? 'bg-red-50' : 'bg-white'} rounded border p-3`}>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 font-medium">Total Cost</span>
            <span className={`text-lg font-bold ${canAfford === false ? 'text-red-700' : 'text-blue-700'}`}>
              {formatCurrency(totalCost)}
            </span>
          </div>

          <div className="flex flex-col items-end text-right border-l pl-2">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <Wallet className="h-3 w-3" /> Balance
            </span>
            {balanceNum !== null ? (
              <>
                <span className={`text-lg font-bold ${canAfford === false ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(balanceNum)}
                </span>
                {messageCount > 0 && (
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    ≈ {affordableMessages?.toLocaleString()} SMS
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm font-medium text-gray-400">---</span>
            )}
          </div>
        </div>

        {/* After-send balance preview */}
        {balanceNum !== null && recipientCount > 0 && (
          <div className="flex items-center justify-between text-xs text-gray-500 bg-white rounded border px-3 py-1.5">
            <span>Remaining after send</span>
            <span className={`font-semibold ${(balanceAfterSend ?? 0) < 0 ? 'text-red-600' : 'text-gray-700'}`}>
              {formatCurrency(Math.max(0, balanceAfterSend ?? 0))}
            </span>
          </div>
        )}

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
            Balance sufficient — {formatCurrency(balanceAfterSend ?? 0)} will remain after sending.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
