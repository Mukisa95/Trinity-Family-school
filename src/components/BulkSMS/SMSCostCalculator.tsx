import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calculator, Users, MessageSquare, CreditCard } from 'lucide-react';

interface SMSCostCalculatorProps {
  recipientCount: number;
  messageCount: number;
  pricePerSMS?: number;
  currency?: string;
}

export const SMSCostCalculator: React.FC<SMSCostCalculatorProps> = ({
  recipientCount,
  messageCount,
  pricePerSMS = 35,
  currency = 'UGX'
}) => {
  // Calculate total cost
  const totalCost = recipientCount * messageCount * pricePerSMS;
  
  // Calculate cost breakdown
  const costPerRecipient = messageCount * pricePerSMS;
  const totalMessages = recipientCount * messageCount;
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return `${currency} ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  };

  return (
    <Card className="border border-blue-200 bg-blue-50/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">SMS Cost</span>
          </div>
          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
            Live
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white p-2 rounded border border-blue-100">
            <div className="text-xs text-gray-500 mb-1">Recipients</div>
            <div className="text-lg font-bold text-gray-900">{recipientCount}</div>
          </div>
          <div className="bg-white p-2 rounded border border-blue-100">
            <div className="text-xs text-gray-500 mb-1">Messages</div>
            <div className="text-lg font-bold text-blue-600">{totalMessages}</div>
          </div>
          <div className="bg-white p-2 rounded border border-blue-100">
            <div className="text-xs text-gray-500 mb-1">Per SMS</div>
            <div className="text-lg font-bold text-orange-600">{formatCurrency(pricePerSMS)}</div>
          </div>
        </div>
        
        <div className="mt-3 bg-gradient-to-r from-blue-500 to-blue-600 p-3 rounded text-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Cost</span>
            <span className="text-xl font-bold">{formatCurrency(totalCost)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
