'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RequirementItem, RequirementCoverageMode } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, Package, AlertCircle, Calculator } from 'lucide-react';

interface RequirementCoverageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    coverageMode: RequirementCoverageMode;
    cashAmount?: number;
    itemQuantity?: number;
  }) => void;
  requirements: RequirementItem[];
  fullAmount: number;
  paidAmount: number;
  balance: number;
  totalQuantityRequired?: number;
  itemQuantityProvided?: number;
}

export function RequirementCoverageModal({
  isOpen,
  onClose,
  onSubmit,
  requirements,
  fullAmount,
  paidAmount,
  balance,
  totalQuantityRequired,
  itemQuantityProvided = 0,
}: RequirementCoverageModalProps) {
  const [coverageMode, setCoverageMode] = useState<RequirementCoverageMode>('cash');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<string>('');

  // Calculate total quantity required from requirements if not provided
  const calculatedTotalQuantity = totalQuantityRequired || requirements.reduce((sum, req) => sum + (req.quantity || 0), 0);
  
  // Calculate remaining quantities
  const remainingQuantity = calculatedTotalQuantity - itemQuantityProvided;
  const hasQuantityRequirements = calculatedTotalQuantity > 0;

  // Calculate price per item for item mode (price is total for all items, not per item)
  const pricePerItem = hasQuantityRequirements && calculatedTotalQuantity > 0 ? 
    fullAmount / calculatedTotalQuantity : 0;

  useEffect(() => {
    if (isOpen) {
      setCashAmount(balance.toString());
      setItemQuantity('');
      setCoverageMode('cash');
    }
  }, [isOpen, balance]);

  const handleSubmit = () => {
    const data: {
      coverageMode: RequirementCoverageMode;
      cashAmount?: number;
      itemQuantity?: number;
    } = {
      coverageMode,
    };

    if (coverageMode === 'cash') {
      data.cashAmount = parseFloat(cashAmount) || 0;
    } else {
      data.itemQuantity = parseInt(itemQuantity) || 0;
    }

    onSubmit(data);
  };

  const calculateCashEquivalent = () => {
    const quantity = parseInt(itemQuantity) || 0;
    return quantity * pricePerItem;
  };

  const isValidSubmission = () => {
    if (coverageMode === 'cash') {
      const amount = parseFloat(cashAmount) || 0;
      return amount > 0 && amount <= balance;
    } else {
      const quantity = parseInt(itemQuantity) || 0;
      return quantity > 0 && quantity <= remainingQuantity;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Cover Requirements
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Requirements Summary */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Requirements</h4>
            <div className="space-y-1">
              {requirements.map((req) => (
                <div key={req.id} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span>{req.name}</span>
                    {req.quantity && (
                      <Badge variant="outline" className="text-xs">
                        {req.quantity}x
                      </Badge>
                    )}
                  </div>
                  <span className="font-medium">{formatCurrency(req.price)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm font-medium">
                <span>Balance Due:</span>
                <span className="text-red-600">{formatCurrency(balance)}</span>
              </div>
              {hasQuantityRequirements && (
                <div className="flex justify-between items-center text-xs text-gray-600 mt-1">
                  <span>Items Remaining:</span>
                  <span>{remainingQuantity} of {calculatedTotalQuantity}</span>
                </div>
              )}
            </div>
          </div>

          {/* Coverage Mode Selection */}
          <div>
            <Label className="text-sm font-medium">Coverage Method</Label>
            <RadioGroup 
              value={coverageMode} 
              onValueChange={(value) => setCoverageMode(value as RequirementCoverageMode)}
              className="mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Cash Payment
                </Label>
              </div>
              {hasQuantityRequirements && remainingQuantity > 0 && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="item" id="item" />
                  <Label htmlFor="item" className="flex items-center gap-2 cursor-pointer">
                    <Package className="w-4 h-4 text-blue-600" />
                    Provide Items
                  </Label>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* Cash Payment Input */}
          {coverageMode === 'cash' && (
            <div>
              <Label htmlFor="cashAmount" className="text-sm font-medium">
                Cash Amount
              </Label>
              <Input
                id="cashAmount"
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                max={balance}
                step="0.01"
                className="mt-1"
                placeholder="Enter amount"
              />
              {parseFloat(cashAmount) > balance && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Amount cannot exceed balance due
                </p>
              )}
            </div>
          )}

          {/* Item Quantity Input */}
          {coverageMode === 'item' && hasQuantityRequirements && (
            <div>
              <Label htmlFor="itemQuantity" className="text-sm font-medium">
                Item Quantity
              </Label>
              <Input
                id="itemQuantity"
                type="number"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                max={remainingQuantity}
                min="1"
                className="mt-1"
                placeholder="Enter quantity"
              />
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Price per item:</span>
                  <span>{formatCurrency(pricePerItem)}</span>
                </div>
                {parseInt(itemQuantity) > 0 && (
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="flex items-center gap-1">
                      <Calculator className="w-3 h-3" />
                      Cash equivalent:
                    </span>
                    <span className="text-green-600">
                      {formatCurrency(calculateCashEquivalent())}
                    </span>
                  </div>
                )}
              </div>
              {parseInt(itemQuantity) > remainingQuantity && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Quantity cannot exceed remaining items needed
                </p>
              )}
            </div>
          )}

          {/* Item mode not available message */}
          {coverageMode === 'item' && !hasQuantityRequirements && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Item provision is not available for these requirements
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isValidSubmission()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {coverageMode === 'cash' ? 'Make Payment' : 'Provide Items'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 