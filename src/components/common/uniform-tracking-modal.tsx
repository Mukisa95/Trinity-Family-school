"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
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
  AcademicYear,
  UniformInventoryItem
} from '@/types';
import { useUniformInventory, useReduceStockBatch } from '@/lib/hooks/use-uniform-inventory';

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

  // Get current academic year and term using effective term logic
  const effectiveTerm = React.useMemo(() => {
    return getEffectiveTermForDataDisplay(academicYears);
  }, [academicYears]);

  const currentAcademicYear = effectiveTerm?.academicYear || academicYears[0];
  const currentTerm = effectiveTerm?.term || null;

  // 🚀 DYNAMIC YEAR LABELS
  const currentAcademicYearId = React.useMemo(() => {
    if (academicYears.length === 0) return null;
    return effectiveTerm?.academicYear?.id || null;
  }, [academicYears, effectiveTerm]);

  // Initialize form data state first
  const [formData, setFormData] = useState<UniformTrackingFormData>({
    uniformId: '',
    selectionMode: 'item',
    paidAmount: '',
    paymentStatus: 'pending',
    collectionStatus: 'pending',
    academicYearId: '', // Will be auto-set from current year
    termId: '', // Will be auto-set from current term
    selectedSizes: {}, // Maps uniformId to selected size
    hasDiscount: false,
    discountType: 'static',
    discountValueType: 'percentage',
    discountValue: '',
    discountReason: ''
  });

  // Fetch uniform inventory for size selection
  const { data: uniformInventory = [] } = useUniformInventory();
  const reduceStockBatch = useReduceStockBatch();

  // Get selected academic year object
  const selectedAcademicYear = React.useMemo(() => {
    if (!formData.academicYearId) return currentAcademicYear;
    return academicYears.find(year => year.id === formData.academicYearId) || currentAcademicYear;
  }, [formData.academicYearId, academicYears, currentAcademicYear]);

  // Get available terms for selected academic year
  const availableTerms = React.useMemo(() => {
    if (!selectedAcademicYear || !selectedAcademicYear.terms) return [];
    return selectedAcademicYear.terms;
  }, [selectedAcademicYear]);

  const [selectedUniforms, setSelectedUniforms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDynamicDiscountHalted, setIsDynamicDiscountHalted] = useState(false);

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
        const qty = formData.selectedQuantities?.[uniformId] || 1;
        return total + ((uniform?.price || 0) * qty);
      }, 0);
    } else {
      const uniform = eligibleUniforms.find(u => u.id === formData.uniformId);
      const qty = formData.selectedQuantities?.[formData.uniformId as string] || 1;
      return (uniform?.price || 0) * qty;
    }
  }, [formData.selectionMode, formData.uniformId, formData.selectedQuantities, selectedUniforms, eligibleUniforms]);

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
        const qty = formData.selectedQuantities?.[uniformId] || 1;
        return total + ((uniform?.price || 0) * qty);
      }, 0);
    } else {
      const uniform = eligibleUniforms.find(u => u.id === formData.uniformId);
      const qty = formData.selectedQuantities?.[formData.uniformId as string] || 1;
      originalAmount = (uniform?.price || 0) * qty;
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
  }, [applicableDiscounts, pupil, selectedRecord, currentUniformIds, formData.selectionMode, formData.uniformId, formData.selectedQuantities, selectedUniforms, eligibleUniforms]);

  // Single source of truth for pricing that strictly honors halt state
  const computedPricing = React.useMemo(() => {
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

      const activeDynamicDiscounts = isDynamicDiscountHalted ? [] : applicableDiscounts;
      const result = calculateFinalAmount(originalAmount, discountConfig, activeDynamicDiscounts);
      return {
        originalAmount,
        finalAmount: result.finalAmount,
        discountAmount: result.discountAmount,
        discountSource: result.discountSource,
        discountConfig
      };
    }

    if (isDynamicDiscountHalted) {
      return {
        originalAmount,
        finalAmount: originalAmount,
        discountAmount: 0,
        discountSource: 'none',
        discountConfig: undefined
      };
    }

    if (bestDynamicDiscount && !selectedRecord) {
      const discountValue = bestDynamicDiscount.valueType === 'percentage'
        ? (originalAmount * bestDynamicDiscount.value) / 100
        : bestDynamicDiscount.value;
      const finalAmount = Math.max(0, originalAmount - discountValue);
      const discountConfig: DiscountConfig = {
        isEnabled: true,
        type: 'dynamic',
        valueType: bestDynamicDiscount.valueType,
        value: bestDynamicDiscount.value,
        reason: bestDynamicDiscount.reason,
        appliedBy: 'Auto-Applied Dynamic Discount',
        appliedAt: new Date().toISOString(),
        dynamicDiscountId: bestDynamicDiscount.id
      };
      return {
        originalAmount,
        finalAmount,
        discountAmount: discountValue,
        discountSource: 'dynamic',
        discountConfig
      };
    }

    const result = calculateFinalAmount(originalAmount, undefined, applicableDiscounts);
    return {
      originalAmount,
      finalAmount: result.finalAmount,
      discountAmount: result.discountAmount,
      discountSource: result.discountSource,
      discountConfig: result.appliedDiscount as DiscountConfig | undefined
    };
  }, [
    getTotalAmount,
    formData.hasDiscount,
    formData.discountValue,
    formData.discountType,
    formData.discountValueType,
    formData.discountReason,
    isDynamicDiscountHalted,
    bestDynamicDiscount,
    selectedRecord,
    applicableDiscounts
  ]);

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
        selectedSizes: selectedRecord.selectedSizes || {},
        selectedQuantities: selectedRecord.selectedQuantities || {},
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
      // Initialize with current academic year and term for new records
      const initialAcademicYearId = currentAcademicYear?.id || '';
      const initialTermId = currentTerm?.id || '';

      setFormData({
        uniformId: '',
        selectionMode: 'item',
        paidAmount: '',
        paymentStatus: 'pending',
        collectionStatus: 'pending',
        academicYearId: initialAcademicYearId,
        termId: initialTermId,
        selectedSizes: {},
        selectedQuantities: {},
        hasDiscount: false,
        discountType: 'static',
        discountValueType: 'percentage',
        discountValue: '',
        discountReason: ''
      });
      setSelectedUniforms([]);
    }
    setIsDynamicDiscountHalted(false);
  }, [selectedRecord, isOpen, currentAcademicYear, currentTerm]);

  // Update term when academic year changes (reset to first term if current term not available)
  useEffect(() => {
    if (!selectedRecord && formData.academicYearId && selectedAcademicYear) {
      const currentTermInYear = selectedAcademicYear.terms?.find(t => t.id === formData.termId);
      if (!currentTermInYear && selectedAcademicYear.terms?.length > 0) {
        // If current term is not in the selected year, use current term if it exists, otherwise first term
        const termToUse = currentTerm && selectedAcademicYear.id === currentAcademicYear?.id
          ? currentTerm.id
          : selectedAcademicYear.terms[0].id;
        setFormData(prev => ({ ...prev, termId: termToUse }));
      }
    }
  }, [formData.academicYearId, formData.termId, selectedAcademicYear, selectedRecord, currentTerm, currentAcademicYear]);

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

  const handleQuantityChange = (uniformId: string, quantity: number) => {
    setFormData(prev => ({
      ...prev,
      selectedQuantities: {
        ...(prev.selectedQuantities || {}),
        [uniformId]: Math.max(1, quantity)
      }
    }));
  };

  const handleUniformSelection = (uniformId: string, checked: boolean) => {
    let newSelection: string[];

    if (checked) {
      newSelection = [...selectedUniforms, uniformId];
      setFormData(prev => ({
        ...prev,
        selectedQuantities: {
          ...(prev.selectedQuantities || {}),
          [uniformId]: prev.selectedQuantities?.[uniformId] || 1
        }
      }));
    } else {
      newSelection = selectedUniforms.filter(id => id !== uniformId);
      // Clear size and quantity selection when uniform is deselected
      setFormData(prev => {
        const newSizes = { ...prev.selectedSizes };
        const newQuantities = { ...(prev.selectedQuantities || {}) };
        delete newSizes[uniformId];
        delete newQuantities[uniformId];
        return { ...prev, selectedSizes: newSizes, selectedQuantities: newQuantities };
      });
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

  // Helper to get inventory item for a uniform
  const getInventoryForUniform = React.useCallback((uniformId: string): UniformInventoryItem | undefined => {
    return uniformInventory.find(inv => inv.uniformId === uniformId);
  }, [uniformInventory]);

  // Handle size selection for a uniform
  const handleSizeSelection = (uniformId: string, size: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSizes: {
        ...prev.selectedSizes,
        [uniformId]: size
      }
    }));
  };

  // Get available sizes with stock for a uniform
  const getAvailableSizesForUniform = React.useCallback((uniformId: string) => {
    const inventory = getInventoryForUniform(uniformId);
    if (!inventory) return [];
    return inventory.stock.filter(s => s.quantity > 0);
  }, [getInventoryForUniform]);

  // Check if uniform has inventory configured
  const hasInventoryConfigured = React.useCallback((uniformId: string): boolean => {
    const inventory = getInventoryForUniform(uniformId);
    return !!inventory && inventory.sizes.length > 0;
  }, [getInventoryForUniform]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;



    // Validation
    if (!formData.academicYearId || !formData.termId) {
      alert('Please select an academic year and term');
      return;
    }

    const selectedYear = academicYears.find(y => y.id === formData.academicYearId);
    const selectedTerm = selectedYear?.terms?.find(t => t.id === formData.termId);

    if (!selectedYear || !selectedTerm) {
      alert('Selected academic year or term is invalid');
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


    // Note: Size selection is optional when adding tracking
    // Size validation and stock reduction happens during the collection process

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

    const originalAmount = computedPricing.originalAmount;
    const finalAmount = computedPricing.finalAmount;
    const discountConfig = computedPricing.discountConfig;

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
      academicYearId: formData.academicYearId,
      termId: formData.termId,
      selectedSizes: formData.selectedSizes,
      selectedQuantities: formData.selectedQuantities,
      originalAmount,
      finalAmount,
      paidAmount,
      paymentStatus,
      collectionStatus: formData.collectionStatus,
      collectionDate: formData.collectionStatus === 'collected' ? new Date().toISOString() : undefined,
      paymentDate: paidAmount > 0 ? new Date().toISOString() : undefined,
      discountConfig,
      history: selectedRecord?.history || []
    };

    // Reduce inventory stock when uniform is collected (only for new collections, not edits)
    const shouldReduceStock = formData.collectionStatus === 'collected' &&
      (!selectedRecord || selectedRecord.collectionStatus !== 'collected');

    const reduceStockIfNeeded = async () => {
      if (shouldReduceStock && Object.keys(formData.selectedSizes).length > 0) {
        const stockReductions = Object.entries(formData.selectedSizes).map(([uniformId, size]) => ({
          uniformId,
          size,
          quantity: formData.selectedQuantities?.[uniformId] || 1
        }));
        try {
          await reduceStockBatch.mutateAsync(stockReductions);
        } catch (error) {
          console.error('Error reducing stock:', error);
          // Continue with submission even if stock reduction fails
        }
      }
    };

    setIsSubmitting(true);

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
        .then(async () => {
          await reduceStockIfNeeded();
          onSubmit(trackingData);
        })
        .catch((error) => {
          console.error('Error creating dynamic discount:', error);
          alert('Failed to create dynamic discount');
          setIsSubmitting(false);
        });
    } else {
      reduceStockIfNeeded().then(() => {
        onSubmit(trackingData);
        // We don't set isSubmitting(false) here because the modal usually closes or redirects
        // If the parent component keeps the modal open on error, it should handle that.
        // But to be safe, if onSubmit is synchronous and doesn't close, we might want to reset.
        // uniquely for this case, we assume onSubmit closes the modal.
      }).catch((error) => {
        console.error('Error submitting:', error);
        setIsSubmitting(false);
      });
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedRecord ? 'Edit Uniform Tracking' : 'Add Uniform Tracking'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Selection Mode */}
            <div className="space-y-4">
              <div>
                <Label>Selection Mode *</Label>
                <RadioGroup
                  value={formData.selectionMode}
                  onValueChange={handleSelectionModeChange}
                  className="flex flex-row space-x-3.5 space-y-0 mt-2 flex-nowrap overflow-x-auto pb-1"
                >
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <RadioGroupItem value="full" id="mode-full" className="w-3.5 h-3.5" />
                    <Label htmlFor="mode-full" className="text-xs font-normal cursor-pointer whitespace-nowrap">
                      Full Set
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <RadioGroupItem value="partial" id="mode-partial" className="w-3.5 h-3.5" />
                    <Label htmlFor="mode-partial" className="text-xs font-normal cursor-pointer whitespace-nowrap">
                      multi
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <RadioGroupItem value="item" id="mode-item" className="w-3.5 h-3.5" />
                    <Label htmlFor="mode-item" className="text-xs font-normal cursor-pointer whitespace-nowrap">
                      one item
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Academic Year and Term Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="academicYear">Academic Year *</Label>
                  <Select
                    value={formData.academicYearId}
                    onValueChange={(value) => {
                      handleInputChange('academicYearId', value);
                      // Reset term when academic year changes
                      const year = academicYears.find(y => y.id === value);
                      if (year?.terms?.length > 0) {
                        // Use current term if it's in the selected year, otherwise first term
                        const currentTermInYear = year.terms.find(t => t.id === currentTerm?.id);
                        const termToUse = currentTermInYear?.id || year.terms[0].id;
                        handleInputChange('termId', termToUse);
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1 rounded-full h-8 text-xs px-3">
                      <SelectValue placeholder="Select academic year" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((year) => {
                        const today = new Date();
                        const yearEnd = new Date(year.endDate);
                        const hasEnded = today > yearEnd;

                        let label = '';
                        if (year.isLocked) {
                          label = '(Locked)';
                        } else if (!hasEnded && year.id !== currentAcademicYearId) {
                          label = '(Upcoming)';
                        }

                        return (
                          <SelectItem key={year.id} value={year.id}>
                            {year.name} {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="term">Term *</Label>
                  <Select
                    value={formData.termId}
                    onValueChange={(value) => handleInputChange('termId', value)}
                    disabled={!formData.academicYearId || availableTerms.length === 0}
                  >
                    <SelectTrigger className="mt-1 rounded-full h-8 text-xs px-3">
                      <SelectValue placeholder={formData.academicYearId ? "Select term" : "Select academic year first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTerms.map((term) => (
                        <SelectItem key={term.id} value={term.id}>
                          {term.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.academicYearId && availableTerms.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">No terms available for selected academic year</p>
                  )}
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
                        {eligibleUniforms.map((uniform) => {
                          const isSelected = selectedUniforms.includes(uniform.id);
                          const quantity = formData.selectedQuantities?.[uniform.id] || 1;

                          return (
                            <div key={uniform.id} className="flex items-center justify-between space-x-3">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <Checkbox
                                  id={`uniform-${uniform.id}`}
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleUniformSelection(uniform.id, checked as boolean)}
                                />
                                <Label htmlFor={`uniform-${uniform.id}`} className="flex-1 text-sm cursor-pointer truncate">
                                  <div className="flex justify-between items-center">
                                    <span className="truncate">{uniform.name}</span>
                                    <span className="font-semibold ml-2">{formatCurrency(uniform.price * (isSelected ? quantity : 1))}</span>
                                  </div>
                                  <div className="text-xs text-gray-500">{uniform.group}</div>
                                </Label>
                              </div>

                              {isSelected && (
                                <div className="flex items-center gap-1.5 ml-2 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5 border border-slate-300 dark:border-slate-700 shrink-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-full hover:bg-slate-200 text-xs font-bold"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleQuantityChange(uniform.id, Math.max(1, quantity - 1));
                                    }}
                                  >
                                    -
                                  </Button>
                                  <span className="text-xs font-bold px-1 min-w-[20px] text-center text-gray-900 dark:text-gray-100">
                                    {quantity}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-full hover:bg-slate-200 text-xs font-bold"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleQuantityChange(uniform.id, quantity + 1);
                                    }}
                                  >
                                    +
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

              {/* Size Selection for Selected Uniforms */}
              {(() => {
                // Get uniforms that need size selection
                const uniformsForSizeSelection = formData.selectionMode === 'full'
                  ? eligibleUniforms.filter(u => hasInventoryConfigured(u.id))
                  : formData.selectionMode === 'partial'
                    ? eligibleUniforms.filter(u => selectedUniforms.includes(u.id) && hasInventoryConfigured(u.id))
                    : formData.uniformId && hasInventoryConfigured(formData.uniformId as string)
                      ? eligibleUniforms.filter(u => u.id === formData.uniformId)
                      : [];

                if (uniformsForSizeSelection.length === 0) return null;

                return (
                  <div className="mt-2.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      Size Selection
                    </Label>
                    <ScrollArea className="max-h-36 border rounded-md p-2 mt-1.5">
                      <div className="space-y-1.5">
                        {uniformsForSizeSelection.map((uniform) => {
                          const inventory = getInventoryForUniform(uniform.id);
                          const selectedSize = formData.selectedSizes[uniform.id];
                          const selectedSizeStock = selectedSize
                            ? inventory?.stock.find(s => s.size === selectedSize)?.quantity || 0
                            : null;

                          return (
                            <div key={uniform.id} className="flex items-center gap-2 p-1.5 px-2 rounded-md bg-slate-50 dark:bg-slate-800">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-xs truncate text-gray-800 dark:text-gray-200">{uniform.name}</div>
                                <div className="text-[10px] text-muted-foreground">{uniform.group}</div>
                              </div>
                              <Select
                                value={selectedSize || ''}
                                onValueChange={(value) => handleSizeSelection(uniform.id, value)}
                              >
                                <SelectTrigger className="w-24 h-7 text-xs px-2.5 rounded-full">
                                  <SelectValue placeholder="Size" />
                                </SelectTrigger>
                                <SelectContent>
                                  {inventory?.sizes.map((size) => {
                                    const stockItem = inventory.stock.find(s => s.size === size);
                                    const qty = stockItem?.quantity || 0;
                                    const isOutOfStock = qty === 0;
                                    return (
                                      <SelectItem
                                        key={size}
                                        value={size}
                                      >
                                        <span className={isOutOfStock ? 'text-gray-400' : ''}>
                                          {size}
                                          <span className={`ml-1 text-xs ${isOutOfStock ? 'text-red-500' : qty < 3 ? 'text-orange-500' : 'text-green-600'}`}>
                                            ({qty})
                                          </span>
                                        </span>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              {selectedSize && selectedSizeStock !== null && (
                                selectedSizeStock > 0 ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 py-0 px-1.5 text-[10px] rounded-full">
                                    ✓ In Stock
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 py-0 px-1.5 text-[10px] rounded-full">
                                    ⚠ Out
                                  </Badge>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    {uniformsForSizeSelection.some(u => !formData.selectedSizes[u.id]) && (
                      <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Select sizes before marking as collected
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Payment & Collection Information */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label htmlFor="paidAmount">Pay</Label>
                  <Input
                    id="paidAmount"
                    value={formData.paidAmount}
                    onChange={handlePriceChange}
                    placeholder="e.g., 25,000"
                    className="mt-1 rounded-full h-8 text-xs px-3"
                  />
                </div>

                <div>
                  <Label>Collection</Label>
                  <Select
                    value={formData.collectionStatus}
                    onValueChange={(value: CollectionStatus) => handleInputChange('collectionStatus', value)}
                  >
                    <SelectTrigger className="mt-1 rounded-full h-8 text-xs px-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="collected">Collected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

                {/* Dynamic Discount Auto-Apply Notification */}
                {bestDynamicDiscount && !selectedRecord && !formData.hasDiscount && !isDynamicDiscountHalted && (
                  <Alert className="border-green-200 bg-green-50 p-2.5 rounded-xl">
                    <AlertDescription className="text-green-800 text-xs">
                      <div className="flex justify-between items-center gap-3">
                        <div className="space-y-0.5">
                          <span className="font-bold block">Dynamic Discount Available!</span>
                          <span className="text-[11px] leading-tight block text-green-700">
                            <strong>{formatCurrency(bestDynamicDiscount.valueType === 'percentage'
                              ? (getTotalAmount() * bestDynamicDiscount.value) / 100
                              : bestDynamicDiscount.value)} off</strong> for {bestDynamicDiscount.reason} ({pupil?.className || 'N/A'}, {pupil?.section || 'N/A'})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            onClick={() => {
                              handleInputChange('hasDiscount', true);
                              handleInputChange('discountType', 'dynamic');
                              handleInputChange('discountValueType', bestDynamicDiscount.valueType);
                              handleInputChange('discountValue', bestDynamicDiscount.value.toString());
                              handleInputChange('discountReason', bestDynamicDiscount.reason);
                              setIsDynamicDiscountHalted(false);
                            }}
                            className="bg-green-600 hover:bg-green-700 h-7 text-xs rounded-full px-3 text-white shadow-sm"
                          >
                            Accept
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDynamicDiscountHalted(true)}
                            className="border-green-300 text-green-800 hover:bg-green-100/80 h-7 text-xs rounded-full px-3"
                          >
                            Halt
                          </Button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Dynamic Discount Halted Notification */}
                {bestDynamicDiscount && !selectedRecord && !formData.hasDiscount && isDynamicDiscountHalted && (
                  <Alert className="border-amber-200 bg-amber-50 p-2.5 rounded-xl">
                    <AlertDescription className="text-amber-800 text-xs">
                      <div className="flex justify-between items-center gap-3">
                        <div className="space-y-0.5">
                          <span className="font-bold block">Dynamic Discount Halted</span>
                          <span className="text-[11px] leading-tight block text-amber-700">
                            Auto-application of <strong>{bestDynamicDiscount.reason}</strong> is paused for this record.
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsDynamicDiscountHalted(false)}
                          className="border-amber-300 text-amber-800 hover:bg-amber-100 h-7 text-xs rounded-full shrink-0 px-3"
                        >
                          Restore
                        </Button>
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
                          {isDynamicDiscountHalted
                            ? 'Auto-applied dynamic discount is currently halted for this pupil'
                            : 'You can override or disable the auto-applied discount'}
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

             {/* Summary */}
             <div className="space-y-4">
               <Card className="shadow-none border border-gray-200">
                 <CardHeader className="pb-1.5 pt-3.5 px-4">
                   <CardTitle className="text-sm font-semibold text-gray-900">Order Summary</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-2.5 px-4 pb-3.5 pt-1">
                   <div className="space-y-1">
                     <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Selected Items:</Label>
                     {getSelectedUniformsDisplay().length > 0 ? (
                       <ul className="divide-y divide-gray-100 text-xs">
                         {getSelectedUniformsDisplay().map((uniform) => {
                           const qty = formData.selectionMode === 'partial'
                             ? (formData.selectedQuantities?.[uniform.id] || 1)
                             : 1;

                           return (
                             <li key={uniform.id} className="py-1 flex justify-between items-center text-xs">
                               <span className="text-gray-800 font-medium">
                                 {qty > 1 ? `${qty} x ${uniform.name}` : uniform.name}{' '}
                                 <span className="text-[10px] text-gray-400 font-normal">({uniform.group})</span>
                               </span>
                               <span className="font-semibold text-gray-900">{formatCurrency(uniform.price * qty)}</span>
                             </li>
                           );
                         })}
                       </ul>
                     ) : (
                       <div className="text-xs text-gray-400">No items selected</div>
                     )}
                   </div>
 
                   <div className="border-t pt-2 space-y-1.5 text-xs">
                     <div className="flex justify-between items-center text-gray-600">
                       <span>Original Amount:</span>
                       <span className="font-semibold text-gray-900">{formatCurrency(getTotalAmount())}</span>
                     </div>
 
                     {/* Discount Display */}
                    {(() => {
                      const { discountAmount, finalAmount, discountSource } = computedPricing;

                      return (
                        <>
                          {discountAmount > 0 && (
                            <>
                              <div className="flex justify-between items-center text-green-600">
                                <span>
                                  Discount ({discountSource}):
                                  {formData.hasDiscount && (
                                    <span className="ml-1 font-semibold">
                                      {formatDiscountDisplay(formData.discountValueType, parseFloat(formData.discountValue) || 0)}
                                    </span>
                                  )}
                                </span>
                                <span className="font-bold">-{formatCurrency(discountAmount)}</span>
                              </div>
                            </>
                          )}

                          <div className="border-t pt-1.5">
                            <div className="flex justify-between items-center font-bold text-xs">
                              <span>Final Amount:</span>
                              <span className={`text-sm font-bold ${discountAmount > 0 ? 'text-green-600' : 'text-gray-900'}`}>{formatCurrency(finalAmount)}</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    <div className="flex justify-between items-center text-xs border-t pt-1.5 text-gray-600">
                      <span>Paid Amount:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(formData.paidAmount ? parseFormattedMoney(formData.paidAmount) : 0)}</span>
                    </div>

                    {(() => {
                      const finalAmount = computedPricing.finalAmount;
                      const paidAmount = formData.paidAmount ? parseFormattedMoney(formData.paidAmount) : 0;
                      const balance = finalAmount - paidAmount;

                      return (
                        <div className="flex justify-between items-center text-xs text-gray-600">
                          <span>Balance:</span>
                          <span className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(balance)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="border-t pt-2">
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>Payment Status:</span>
                      {(() => {
                        const finalAmount = computedPricing.finalAmount;
                        const paidAmount = formData.paidAmount ? parseFormattedMoney(formData.paidAmount) : 0;

                        return (
                          <Badge variant={
                            paidAmount >= finalAmount ? 'default' :
                              paidAmount > 0 ? 'secondary' : 'outline'
                          } className="py-0 px-2 text-[10px] rounded-full">
                            {paidAmount >= finalAmount ? 'Paid' :
                              paidAmount > 0 ? 'Partial' : 'Pending'}
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
               </Card>

               <div className="flex items-center justify-end gap-2 pt-2">
                 <Button
                   type="button"
                   variant="outline"
                   onClick={onClose}
                   className="rounded-full px-5 text-xs h-8"
                   disabled={isSubmitting}
                 >
                   Cancel
                 </Button>
                 <Button
                   type="submit"
                   className="rounded-full px-5 text-xs h-8 bg-green-600 hover:bg-green-700 text-white"
                   disabled={isSubmitting}
                 >
                   {isSubmitting ? 'Saving...' : (selectedRecord ? 'Update Tracking' : 'Add Tracking')}
                 </Button>
               </div>
             </div>
           </div>
         </form>
       </DialogContent>
     </Dialog>
   );
 }