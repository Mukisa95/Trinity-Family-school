"use client";

import React, { useState, useEffect } from 'react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogFooter,
} from '@/components/ui/modern-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Percent, DollarSign } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatMoneyInput, parseFormattedMoney, formatCurrency } from '@/lib/utils';
import { calculateFinalAmount, formatDiscountDisplay, validateDiscountValue } from '@/lib/utils/discount-utils';
import { usePupil } from '@/lib/hooks/use-pupils';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useApplicableDiscounts, useCreateDynamicDiscount } from '@/lib/hooks/use-dynamic-discounts';
import type { 
  UniformTrackingFormData, 
  SelectionMode, 
  PaymentStatus, 
  CollectionStatus, 
  UniformItem,
  UniformTracking,
  DiscountType,
  DiscountValueType,
  DiscountConfig,
  AcademicYear
} from '@/types';

interface UniformTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: Omit<UniformTracking, 'id' | 'createdAt' | 'updatedAt'>) => void;
  pupilId: string;
  selectedRecord?: UniformTracking | null;
  eligibleUniforms: UniformItem[];
}

export function UniformTrackingModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  pupilId, 
  selectedRecord, 
  eligibleUniforms 
}: UniformTrackingModalProps) {
  // Fetch academic years for term selection
  const { data: academicYears = [] } = useAcademicYears();
  
  // Get current academic year (the one marked as active)
  const currentAcademicYear = academicYears.find(ay => ay.isActive) || academicYears[0];
  
  // Get current term based on actual dates, not flags
  const currentTerm = React.useMemo(() => {
    if (!currentAcademicYear || !currentAcademicYear.terms?.length) return null;
    
    const now = new Date();
    
    // Find term that contains current date
    const termByDate = currentAcademicYear.terms.find(term => {
      if (!term.startDate || !term.endDate) return false;
      const termStart = new Date(term.startDate);
      const termEnd = new Date(term.endDate);
      return now >= termStart && now <= termEnd;
    });
    
    if (termByDate) {
      console.log('👕 Current term detected by date:', {
        termName: termByDate.name,
        termStart: termByDate.startDate,
        termEnd: termByDate.endDate,
        currentDate: now.toISOString()
      });
      return termByDate;
    }
    
    // Fallback: find next upcoming term or use first term
    const upcomingTerm = currentAcademicYear.terms.find(term => {
      if (!term.startDate) return false;
      const termStart = new Date(term.startDate);
      return termStart > now;
    });
    
    const fallbackTerm = upcomingTerm || currentAcademicYear.terms[0];
    console.log('👕 Current term fallback:', fallbackTerm?.name);
    return fallbackTerm;
  }, [currentAcademicYear]);

  const [formData, setFormData] = useState<UniformTrackingFormData>({
    uniformId: '',
    selectionMode: 'item',
    paidAmount: '',
    paymentStatus: 'pending',
    collectionStatus: 'pending',
    academicYearId: '', // Will be auto-set from current year
    termId: '', // Will be auto-set from current term
    hasDiscount: false,
    discountType: 'static',
    discountValueType: 'percentage',
    discountValue: '',
    discountReason: ''
  });

  const [selectedUniforms, setSelectedUniforms] = useState<string[]>([]);

  // Get pupil data for dynamic discount matching
  const { data: pupil } = usePupil(pupilId);
  
  // Get current uniform selection for discount matching
  const currentUniformIds = React.useMemo(() => {
    if (formData.selectionMode === 'full') {
      return eligibleUniforms.map(u => u.id);
    } else if (formData.selectionMode === 'partial') {
      return selectedUniforms;
    } else {
      return formData.uniformId ? [formData.uniformId as string] : [];
    }
  }, [formData.selectionMode, formData.uniformId, selectedUniforms, eligibleUniforms]);

  // Get applicable dynamic discounts
  const { data: applicableDiscounts = [] } = useApplicableDiscounts({
    uniformId: currentUniformIds,
    selectionMode: formData.selectionMode,
    classId: pupil?.classId,
    section: pupil?.section,
    gender: pupil?.gender,
    createdAfter: undefined // Don't filter by creation time for existing discounts
  });

  const getTotalAmount = React.useCallback(() => {
    if (formData.selectionMode === 'full') {
      return eligibleUniforms.reduce((total, uniform) => total + uniform.price, 0);
    } else if (formData.selectionMode === 'partial') {
      return selectedUniforms.reduce((total, uniformId) => {
        const uniform = eligibleUniforms.find(u => u.id === uniformId);
        return total + (uniform?.price || 0);
      }, 0);
    } else {
      const uniform = eligibleUniforms.find(u => u.id === formData.uniformId);
      return uniform?.price || 0;
    }
  }, [formData.selectionMode, formData.uniformId, selectedUniforms, eligibleUniforms]);

  // Calculate the original amount separately to avoid circular dependencies
  const originalAmount = React.useMemo(() => {
    return getTotalAmount();
  }, [getTotalAmount]);

  // Check if there's an applicable dynamic discount for new records
  const bestDynamicDiscount = React.useMemo(() => {
    if (selectedRecord || !pupil || applicableDiscounts.length === 0 || currentUniformIds.length === 0) {
      return null;
    }
    
    // The service already filters by criteria, so we just need to find the best discount
    if (applicableDiscounts.length === 0) return null;
    
    // Calculate original amount using current state
    let originalAmount = 0;
    if (formData.selectionMode === 'full') {
      originalAmount = eligibleUniforms.reduce((total, uniform) => total + uniform.price, 0);
    } else if (formData.selectionMode === 'partial') {
      originalAmount = selectedUniforms.reduce((total, uniformId) => {
        const uniform = eligibleUniforms.find(u => u.id === uniformId);
        return total + (uniform?.price || 0);
      }, 0);
    } else {
      const uniform = eligibleUniforms.find(u => u.id === formData.uniformId);
      originalAmount = uniform?.price || 0;
    }
    
    // Return the discount with highest reduction amount
    const bestDiscount = applicableDiscounts.reduce((best, current) => {
      const currentReduction = current.valueType === 'percentage' 
        ? (originalAmount * current.value) / 100
        : current.value;
      const bestReduction = best.valueType === 'percentage'
        ? (originalAmount * best.value) / 100  
        : best.value;
      return currentReduction > bestReduction ? current : best;
    });
    
    return bestDiscount;
  }, [applicableDiscounts, pupil, selectedRecord, currentUniformIds, formData.selectionMode, formData.uniformId, selectedUniforms, eligibleUniforms]);

  // Mutation for creating dynamic discounts
  const createDynamicDiscountMutation = useCreateDynamicDiscount();

  useEffect(() => {
    if (selectedRecord) {
      setFormData({
        uniformId: selectedRecord.uniformId,
        selectionMode: selectedRecord.selectionMode,
        paidAmount: selectedRecord.paidAmount.toString(),
        paymentStatus: selectedRecord.paymentStatus,
        collectionStatus: selectedRecord.collectionStatus,
        academicYearId: selectedRecord.academicYearId || '',
        termId: selectedRecord.termId || '',
        hasDiscount: !!selectedRecord.discountConfig?.isEnabled,
        discountType: selectedRecord.discountConfig?.type || 'static',
        discountValueType: selectedRecord.discountConfig?.valueType || 'percentage',
        discountValue: selectedRecord.discountConfig?.value?.toString() || '',
        discountReason: selectedRecord.discountConfig?.reason || ''
      });
      
      if (Array.isArray(selectedRecord.uniformId)) {
        setSelectedUniforms(selectedRecord.uniformId);
      } else {
        setSelectedUniforms([selectedRecord.uniformId]);
      }
    } else {
      setFormData({
        uniformId: '',
        selectionMode: 'item',
        paidAmount: '',
        paymentStatus: 'pending',
        collectionStatus: 'pending',
        academicYearId: '',
        termId: '',
        hasDiscount: false,
        discountType: 'static',
        discountValueType: 'percentage',
        discountValue: '',
        discountReason: ''
      });
      setSelectedUniforms([]);
    }
  }, [selectedRecord, isOpen, currentAcademicYear, currentTerm]);

  const handleInputChange = (field: keyof UniformTrackingFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMoneyInput(e.target.value);
    handleInputChange('paidAmount', formatted);
  };

  const handleSelectionModeChange = (mode: SelectionMode) => {
    setFormData(prev => ({
      ...prev,
      selectionMode: mode,
      uniformId: mode === 'full' ? eligibleUniforms.map(u => u.id) : ''
    }));
    
    if (mode === 'full') {
      setSelectedUniforms(eligibleUniforms.map(u => u.id));
    } else {
      setSelectedUniforms([]);
    }
  };

  const handleUniformSelection = (uniformId: string, checked: boolean) => {
    let newSelection: string[];
    
    if (checked) {
      newSelection = [...selectedUniforms, uniformId];
    } else {
      newSelection = selectedUniforms.filter(id => id !== uniformId);
    }
    
    setSelectedUniforms(newSelection);
    
    if (formData.selectionMode === 'partial') {
      setFormData(prev => ({
        ...prev,
        uniformId: newSelection
      }));
    } else if (formData.selectionMode === 'item') {
      setFormData(prev => ({
        ...prev,
        uniformId: newSelection[0] || ''
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!currentAcademicYear || !currentTerm) {
      alert('Current academic year and term must be set in system settings');
      return;
    }
    
    if (formData.selectionMode === 'item' && !formData.uniformId) {
      alert('Please select a uniform item');
      return;
    }
    
    if (formData.selectionMode === 'partial' && selectedUniforms.length === 0) {
      alert('Please select at least one uniform item');
      return;
    }

    // Validate discount if enabled
    if (formData.hasDiscount) {
      if (!formData.discountValue || !formData.discountReason.trim()) {
        alert('Please provide discount value and reason');
        return;
      }

      const discountValue = parseFloat(formData.discountValue);
      const originalAmount = getTotalAmount();
      const validation = validateDiscountValue(formData.discountValueType, discountValue, originalAmount);
      
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }
    }
    
    // Parse payment amount - allow empty/zero for no initial payment
    const paidAmount = formData.paidAmount ? parseFormattedMoney(formData.paidAmount) : 0;
    
    // Validate payment amount if provided
    if (formData.paidAmount && paidAmount < 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const originalAmount = getTotalAmount();
    
    // Create discount config if enabled or if dynamic discount is available
    let discountConfig: DiscountConfig | undefined;
    let finalAmount = originalAmount;
    
    if (formData.hasDiscount) {
      discountConfig = {
        isEnabled: true,
        type: formData.discountType,
        valueType: formData.discountValueType,
        value: parseFloat(formData.discountValue),
        reason: formData.discountReason,
        appliedBy: 'Current User', // TODO: Get from auth context
        appliedAt: new Date().toISOString()
      };

      // Calculate final amount after discount
      const discountResult = calculateFinalAmount(originalAmount, discountConfig, applicableDiscounts);
      finalAmount = discountResult.finalAmount;
    } else if (bestDynamicDiscount && !selectedRecord) {
      // Auto-apply dynamic discount for new records
      discountConfig = {
        isEnabled: true,
        type: 'dynamic',
        valueType: bestDynamicDiscount.valueType,
        value: bestDynamicDiscount.value,
        reason: bestDynamicDiscount.reason,
        appliedBy: 'Auto-Applied Dynamic Discount',
        appliedAt: new Date().toISOString(),
        dynamicDiscountId: bestDynamicDiscount.id
      };

      // Calculate final amount with dynamic discount
      finalAmount = bestDynamicDiscount.valueType === 'percentage'
        ? originalAmount - (originalAmount * bestDynamicDiscount.value) / 100
        : originalAmount - bestDynamicDiscount.value;
    } else {
      // Check for applicable dynamic discounts (fallback)
      const discountResult = calculateFinalAmount(originalAmount, undefined, applicableDiscounts);
      finalAmount = discountResult.finalAmount;
    }
    
    // Determine payment status based on final amount
    let paymentStatus: PaymentStatus = 'pending';
    if (paidAmount >= finalAmount) {
      paymentStatus = 'paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'partial';
    }

    const trackingData = {
      pupilId,
      uniformId: formData.selectionMode === 'full' ? eligibleUniforms.map(u => u.id) :
                 formData.selectionMode === 'partial' ? selectedUniforms :
                 formData.uniformId,
      selectionMode: formData.selectionMode,
      academicYearId: currentAcademicYear!.id,
      termId: currentTerm!.id,
      originalAmount,
      finalAmount,
      paidAmount,
      paymentStatus,
      collectionStatus: formData.collectionStatus,
      paymentDate: paidAmount > 0 ? new Date().toISOString() : undefined,
      discountConfig,
      history: selectedRecord?.history || []
    };

    // If creating a dynamic discount, save it first
    if (formData.hasDiscount && formData.discountType === 'dynamic') {
      const dynamicDiscountData = {
        uniformId: formData.selectionMode === 'full' ? eligibleUniforms.map(u => u.id) :
                   formData.selectionMode === 'partial' ? selectedUniforms :
                   formData.uniformId,
        selectionMode: formData.selectionMode,
        classId: pupil?.classId,
        section: pupil?.section,
        gender: pupil?.gender,
        valueType: formData.discountValueType,
        value: parseFloat(formData.discountValue),
        reason: formData.discountReason,
        isActive: true,
        createdBy: 'Current User' // TODO: Get from auth context
      };

      createDynamicDiscountMutation.mutateAsync(dynamicDiscountData)
        .then(() => {
          onSubmit(trackingData);
        })
        .catch((error) => {
          console.error('Error creating dynamic discount:', error);
          alert('Failed to create dynamic discount');
        });
    } else {
    onSubmit(trackingData);
    }
  };

  const getSelectedUniformsDisplay = () => {
    if (formData.selectionMode === 'full') {
      return eligibleUniforms;
    } else if (formData.selectionMode === 'partial') {
      return eligibleUniforms.filter(u => selectedUniforms.includes(u.id));
    } else {
      const uniform = eligibleUniforms.find(u => u.id === formData.uniformId);
      return uniform ? [uniform] : [];
    }
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModernDialogContent size="2xl" open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <ModernDialogHeader>
          <ModernDialogTitle>
            {selectedRecord ? 'Edit Uniform Tracking' : 'Add Uniform Tracking'}
          </ModernDialogTitle>
        </ModernDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Selection Mode */}
            <div className="space-y-4">
              <div>
                <Label>Selection Mode *</Label>
                <RadioGroup
                  value={formData.selectionMode}
                  onValueChange={handleSelectionModeChange}
                  className="flex flex-col space-y-2 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full" id="mode-full" />
                    <Label htmlFor="mode-full" className="font-normal">
                      Full Set - All eligible uniforms
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partial" id="mode-partial" />
                    <Label htmlFor="mode-partial" className="font-normal">
                      Multiple Items - Select specific items
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="item" id="mode-item" />
                    <Label htmlFor="mode-item" className="font-normal">
                      Single Item - One uniform item
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Current Academic Year and Term Display */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Assignment Period</span>
                </div>
                <div className="text-sm text-blue-700">
                  <div><strong>Academic Year:</strong> {currentAcademicYear?.name || 'Not Set'}</div>
                  <div><strong>Term:</strong> {currentTerm?.name || 'Not Set'}</div>
                  <div className="text-xs text-blue-600 mt-1">
                    Uniforms will be assigned to the current academic period
                  </div>
                </div>
              </div>

              {/* Uniform Selection */}
              {formData.selectionMode !== 'full' && (
                <div>
                  <Label>
                    {formData.selectionMode === 'partial' ? 'Select Uniforms:' : 'Select Uniform:'}
                  </Label>
                  
                  {formData.selectionMode === 'item' ? (
                    <Select 
                      value={formData.uniformId as string} 
                      onValueChange={(value) => handleInputChange('uniformId', value)}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select a uniform item" />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleUniforms.map((uniform) => (
                          <SelectItem key={uniform.id} value={uniform.id}>
                            {uniform.name} - {formatCurrency(uniform.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <ScrollArea className="h-48 border rounded-md p-3 mt-2">
                      <div className="space-y-3">
                        {eligibleUniforms.map((uniform) => (
                          <div key={uniform.id} className="flex items-center space-x-3">
                            <Checkbox
                              id={`uniform-${uniform.id}`}
                              checked={selectedUniforms.includes(uniform.id)}
                              onCheckedChange={(checked) => handleUniformSelection(uniform.id, checked as boolean)}
                            />
                            <Label htmlFor={`uniform-${uniform.id}`} className="flex-1 text-sm">
                              <div className="flex justify-between items-center">
                                <span>{uniform.name}</span>
                                <span className="font-semibold">{formatCurrency(uniform.price)}</span>
                              </div>
                              <div className="text-xs text-gray-500">{uniform.group}</div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

              {/* Payment Information */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="paidAmount">Payment Amount (UGX)</Label>
                  <Input
                    id="paidAmount"
                    value={formData.paidAmount}
                    onChange={handlePriceChange}
                    placeholder="e.g., 25,000 (optional - leave empty for no initial payment)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to create tracking record without initial payment
                  </p>
                </div>

                <div>
                  <Label>Collection Status</Label>
                  <Select 
                    value={formData.collectionStatus} 
                    onValueChange={(value: CollectionStatus) => handleInputChange('collectionStatus', value)}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending Collection</SelectItem>
                      <SelectItem value="collected">Collected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Dynamic Discount Auto-Apply Notification */}
                {bestDynamicDiscount && !selectedRecord && !formData.hasDiscount && (
                  <Alert className="border-green-200 bg-green-50">
                    <AlertCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <div className="space-y-3">
                        <div>
                          <div className="font-medium">Dynamic Discount Available!</div>
                          <div className="text-sm mt-1">
                            A {bestDynamicDiscount.valueType === 'percentage' 
                              ? `${bestDynamicDiscount.value}%` 
                              : `UGX ${bestDynamicDiscount.value.toLocaleString()}`} discount 
                            is available for: {bestDynamicDiscount.reason}
                          </div>
                          <div className="text-xs mt-1 text-green-600">
                            Applies to: {bestDynamicDiscount.selectionMode} mode, {pupil?.className}, {pupil?.section}, {pupil?.gender}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-right">
                            <div className="text-xs text-green-600">Discount Amount</div>
                            <div className="font-semibold text-green-700">
                              -{formatCurrency(bestDynamicDiscount.valueType === 'percentage' 
                                ? (getTotalAmount() * bestDynamicDiscount.value) / 100
                                : bestDynamicDiscount.value)}
                            </div>
                          </div>
                          <Button 
                            type="button"
                            size="sm"
                            onClick={() => {
                              handleInputChange('hasDiscount', true);
                              handleInputChange('discountType', 'dynamic');
                              handleInputChange('discountValueType', bestDynamicDiscount.valueType);
                              handleInputChange('discountValue', bestDynamicDiscount.value.toString());
                              handleInputChange('discountReason', bestDynamicDiscount.reason);
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Accept Discount
                          </Button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Discount Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="hasDiscount" className="text-base font-medium">
                        Apply Discount
                      </Label>
                      {bestDynamicDiscount && !selectedRecord && (
                        <div className="text-xs text-gray-500 mt-1">
                          You can override or disable the auto-applied discount
                        </div>
                      )}
                    </div>
                    <Switch
                      id="hasDiscount"
                      checked={formData.hasDiscount}
                      onCheckedChange={(checked) => handleInputChange('hasDiscount', checked)}
                    />
                  </div>

                  {formData.hasDiscount && (
                    <Card className="p-4 space-y-4 border-blue-200 bg-blue-50">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Discount Configuration</span>
                      </div>

                      {/* Discount Type */}
                      <div>
                        <Label className="text-sm font-medium">Discount Type *</Label>
                        <RadioGroup
                          value={formData.discountType}
                          onValueChange={(value: DiscountType) => handleInputChange('discountType', value)}
                          className="flex flex-col space-y-2 mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="static" id="type-static" />
                            <Label htmlFor="type-static" className="font-normal text-sm">
                              Static - Apply only to this pupil
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="dynamic" id="type-dynamic" />
                            <Label htmlFor="type-dynamic" className="font-normal text-sm">
                              Dynamic - Apply to all future similar assignments
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Discount Value Type */}
                      <div>
                        <Label className="text-sm font-medium">Discount Value Type *</Label>
                        <RadioGroup
                          value={formData.discountValueType}
                          onValueChange={(value: DiscountValueType) => handleInputChange('discountValueType', value)}
                          className="flex flex-row space-x-6 mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="percentage" id="value-percentage" />
                            <Label htmlFor="value-percentage" className="font-normal text-sm flex items-center gap-1">
                              <Percent className="h-3 w-3" />
                              Percentage
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="fixed" id="value-fixed" />
                            <Label htmlFor="value-fixed" className="font-normal text-sm flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Fixed Amount
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Discount Value */}
                      <div>
                        <Label htmlFor="discountValue" className="text-sm font-medium">
                          Discount Value *
                        </Label>
                        <Input
                          id="discountValue"
                          value={formData.discountValue}
                          onChange={(e) => handleInputChange('discountValue', e.target.value)}
                          placeholder={formData.discountValueType === 'percentage' ? 'e.g., 10 (for 10%)' : 'e.g., 5000 (UGX)'}
                          type="number"
                          min="0"
                          max={formData.discountValueType === 'percentage' ? '100' : undefined}
                          className="mt-1"
                        />
                      </div>

                      {/* Discount Reason */}
                      <div>
                        <Label htmlFor="discountReason" className="text-sm font-medium">
                          Discount Reason *
                        </Label>
                        <Textarea
                          id="discountReason"
                          value={formData.discountReason}
                          onChange={(e) => handleInputChange('discountReason', e.target.value)}
                          placeholder="e.g., Staff discount, Bulk purchase, Financial assistance, etc."
                          rows={2}
                          className="mt-1"
                        />
                      </div>

                      {/* Dynamic Discount Info */}
                      {formData.discountType === 'dynamic' && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            This discount will be automatically applied to future uniform assignments that match:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              <li>Same uniform selection mode ({formData.selectionMode})</li>
                              {pupil?.classId && <li>Class: {pupil.className}</li>}
                              {pupil?.section && <li>Section: {pupil.section}</li>}
                              {pupil?.gender && <li>Gender: {pupil.gender}</li>}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </Card>
                  )}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Selected Items:</Label>
                    {getSelectedUniformsDisplay().length > 0 ? (
                      <div className="space-y-2">
                        {getSelectedUniformsDisplay().map((uniform) => (
                          <div key={uniform.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <div>
                              <div className="font-medium text-sm">{uniform.name}</div>
                              <div className="text-xs text-gray-500">{uniform.group}</div>
                            </div>
                            <div className="font-semibold">{formatCurrency(uniform.price)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No items selected</div>
                    )}
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Original Amount:</span>
                      <span className="text-lg font-semibold">{formatCurrency(getTotalAmount())}</span>
                    </div>
                    
                    {/* Discount Display */}
                    {(() => {
                      const originalAmount = getTotalAmount();
                      let discountAmount = 0;
                      let finalAmount = originalAmount;
                      let discountSource = '';
                      
                      if (formData.hasDiscount && formData.discountValue) {
                        const discountConfig: DiscountConfig = {
                          isEnabled: true,
                          type: formData.discountType,
                          valueType: formData.discountValueType,
                          value: parseFloat(formData.discountValue) || 0,
                          reason: formData.discountReason,
                          appliedBy: 'Current User',
                          appliedAt: new Date().toISOString()
                        };
                        
                        const result = calculateFinalAmount(originalAmount, discountConfig, applicableDiscounts);
                        discountAmount = result.discountAmount;
                        finalAmount = result.finalAmount;
                        discountSource = result.discountSource;
                      } else {
                        const result = calculateFinalAmount(originalAmount, undefined, applicableDiscounts);
                        discountAmount = result.discountAmount;
                        finalAmount = result.finalAmount;
                        discountSource = result.discountSource;
                      }

                      return (
                        <>
                          {discountAmount > 0 && (
                            <>
                              <div className="flex justify-between items-center text-green-600">
                                <span className="text-sm">
                                  Discount ({discountSource}):
                                  {formData.hasDiscount && (
                                    <span className="ml-1">
                                      {formatDiscountDisplay(formData.discountValueType, parseFloat(formData.discountValue) || 0)}
                                    </span>
                                  )}
                                </span>
                                <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                              </div>
                              
                              {discountSource === 'dynamic' && (
                                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                                  Auto-applied dynamic discount
                                </div>
                              )}
                            </>
                          )}
                          
                          <div className="border-t pt-2">
                            <div className="flex justify-between items-center font-bold text-lg">
                              <span>Final Amount:</span>
                              <span className={discountAmount > 0 ? 'text-green-600' : ''}>{formatCurrency(finalAmount)}</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                    
                    <div className="flex justify-between items-center text-sm border-t pt-2">
                      <span>Paid Amount:</span>
                      <span>{formatCurrency(formData.paidAmount ? parseFormattedMoney(formData.paidAmount) : 0)}</span>
                    </div>
                    
                    {(() => {
                      const finalAmount = (() => {
                        const originalAmount = getTotalAmount();
                        if (formData.hasDiscount && formData.discountValue) {
                          const discountConfig: DiscountConfig = {
                            isEnabled: true,
                            type: formData.discountType,
                            valueType: formData.discountValueType,
                            value: parseFloat(formData.discountValue) || 0,
                            reason: formData.discountReason,
                            appliedBy: 'Current User',
                            appliedAt: new Date().toISOString()
                          };
                          return calculateFinalAmount(originalAmount, discountConfig, applicableDiscounts).finalAmount;
                        }
                        return calculateFinalAmount(originalAmount, undefined, applicableDiscounts).finalAmount;
                      })();
                      
                      const paidAmount = formData.paidAmount ? parseFormattedMoney(formData.paidAmount) : 0;
                      const balance = finalAmount - paidAmount;
                      
                      return (
                    <div className="flex justify-between items-center text-sm">
                      <span>Balance:</span>
                          <span className={balance > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                            {formatCurrency(balance)}
                      </span>
                    </div>
                      );
                    })()}
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center text-sm">
                      <span>Payment Status:</span>
                      {(() => {
                        const finalAmount = (() => {
                          const originalAmount = getTotalAmount();
                          if (formData.hasDiscount && formData.discountValue) {
                            const discountConfig: DiscountConfig = {
                              isEnabled: true,
                              type: formData.discountType,
                              valueType: formData.discountValueType,
                              value: parseFloat(formData.discountValue) || 0,
                              reason: formData.discountReason,
                              appliedBy: 'Current User',
                              appliedAt: new Date().toISOString()
                            };
                            return calculateFinalAmount(originalAmount, discountConfig, applicableDiscounts).finalAmount;
                          }
                          return calculateFinalAmount(originalAmount, undefined, applicableDiscounts).finalAmount;
                        })();
                        
                        const paidAmount = formData.paidAmount ? parseFormattedMoney(formData.paidAmount) : 0;
                        
                        return (
                      <Badge variant={
                            paidAmount >= finalAmount ? 'default' :
                            paidAmount > 0 ? 'secondary' : 'outline'
                      }>
                            {paidAmount >= finalAmount ? 'Paid' :
                             paidAmount > 0 ? 'Partial' : 'Pending'}
                      </Badge>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <ModernDialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              {selectedRecord ? 'Update Tracking' : 'Add Tracking'}
            </Button>
          </ModernDialogFooter>
        </form>
      </ModernDialogContent>
    </ModernDialog>
  );
} 