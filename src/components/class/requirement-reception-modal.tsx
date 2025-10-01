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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
  Minus,
  BookOpen,
  User,
  GraduationCap,
  Calendar,
  School,
  Building2,
  Users
} from 'lucide-react';
import { useRequirements, useRequirementsByFilter, useEnhancedRequirementsByFilter } from '@/lib/hooks/use-requirements';
import { useRequirementTrackingByPupilAndTerm, useCreateRequirementTracking, useUpdateRequirementTracking, useEnhancedRequirementTrackingByPupilAndTerm } from '@/lib/hooks/use-requirement-tracking';
import { useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { getCurrentTerm, getTermLabel } from '@/lib/utils/academic-year-utils';
import { formatCurrency } from '@/lib/utils';
import type { 
  Pupil, 
  RequirementItem, 
  RequirementTracking,
  RequirementPaymentStatus,
  RequirementReleaseStatus,
  RequirementCoverageMode,
  RequirementSelectionMode,
  RequirementHistory,
  RequirementReceiptType,
  RequirementReceiptLocation
} from '@/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface RequirementReceptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupil: Pupil;
  classId: string;
  className: string;
}

interface RequirementReceptionItem {
  requirement: RequirementItem;
  trackingRecord?: RequirementTracking;
  quantityToReceive: number;
  isNewRecord: boolean;
  sourceType: 'office' | 'parent'; // New field to track item source
}

export function RequirementReceptionModal({ 
  isOpen, 
  onClose, 
  pupil,
  classId,
  className
}: RequirementReceptionModalProps) {
  const [items, setItems] = useState<RequirementReceptionItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: activeAcademicYear } = useActiveAcademicYear();
  const currentTerm = activeAcademicYear ? getCurrentTerm(activeAcademicYear) : null;

  // Get eligible requirements for this pupil with enhanced data integrity
  const { data: eligibleRequirements = [] } = useEnhancedRequirementsByFilter(
    pupil,
    currentTerm?.id || '',
    activeAcademicYear,
    []
  );

  // Get existing tracking records with enhanced data integrity
  const { data: trackingRecords = [], refetch } = useEnhancedRequirementTrackingByPupilAndTerm(
    pupil,
    currentTerm?.id || '',
    activeAcademicYear
  );

  const createTrackingMutation = useCreateRequirementTracking();
  const updateTrackingMutation = useUpdateRequirementTracking();

  // Initialize items when modal opens or data changes
  useEffect(() => {
    if (isOpen && eligibleRequirements.length > 0) {
      const receptionItems: RequirementReceptionItem[] = eligibleRequirements.map(requirement => {
        const existingRecord = trackingRecords.find(record => {
          const reqIds = Array.isArray(record.requirementId) 
            ? record.requirementId 
            : [record.requirementId];
          return reqIds.includes(requirement.id);
        });

        return {
          requirement,
          trackingRecord: existingRecord,
          quantityToReceive: 0,
          isNewRecord: !existingRecord,
          sourceType: (() => {
            // Automatically detect source based on payment status
            if (!existingRecord) {
              // No existing record means no payment yet - default to parent
              return 'parent' as const;
            }
            
            // Check if there's already payment recorded
            const hasPayment = existingRecord.paidAmount > 0 || existingRecord.paymentStatus !== 'pending';
            
            // If payment exists, items are likely from office
            // If no payment, items are likely from parent
            return hasPayment ? 'office' as const : 'parent' as const;
          })()
        };
      });

      setItems(receptionItems);
      setErrors({});
    }
  }, [isOpen, eligibleRequirements, trackingRecords]);

  const updateQuantity = (requirementId: string, newQuantity: number) => {
    setItems(prev => prev.map(item => 
      item.requirement.id === requirementId 
        ? { ...item, quantityToReceive: Math.max(0, newQuantity) }
        : item
    ));
    
    // Clear any error for this item
    if (errors[requirementId]) {
      setErrors(prev => ({ ...prev, [requirementId]: '' }));
    }
  };

  const updateSourceType = (requirementId: string, sourceType: 'office' | 'parent') => {
    setItems(prev => prev.map(item => 
      item.requirement.id === requirementId 
        ? { ...item, sourceType }
        : item
    ));
  };

  const getTotalQuantityRequired = (requirement: RequirementItem) => {
    return requirement.quantity || 1;
  };

  const getReceivedQuantity = (item: RequirementReceptionItem) => {
    if (!item.trackingRecord) return 0;
    return item.trackingRecord.itemQuantityReceived || 0;
  };

  const getRemainingQuantity = (item: RequirementReceptionItem) => {
    const total = getTotalQuantityRequired(item.requirement);
    const received = getReceivedQuantity(item);
    return Math.max(0, total - received);
  };

  const getCashEquivalent = (requirement: RequirementItem, quantity: number) => {
    const totalRequired = getTotalQuantityRequired(requirement);
    const pricePerItem = totalRequired > 0 ? requirement.price / totalRequired : requirement.price;
    return quantity * pricePerItem;
  };

  const validateSubmission = () => {
    const newErrors: Record<string, string> = {};
    let hasItemsToReceive = false;

    items.forEach(item => {
      if (item.quantityToReceive > 0) {
        hasItemsToReceive = true;
        const remaining = getRemainingQuantity(item);
        
        if (item.quantityToReceive > remaining) {
          newErrors[item.requirement.id] = `Cannot receive more than ${remaining} remaining items`;
        }
      }
    });

    if (!hasItemsToReceive) {
      newErrors.general = 'Please select at least one item to receive';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateSubmission() || !activeAcademicYear || !currentTerm) return;

    setIsSubmitting(true);
    try {
      const itemsToProcess = items.filter(item => item.quantityToReceive > 0);

      for (const item of itemsToProcess) {
        const cashEquivalent = getCashEquivalent(item.requirement, item.quantityToReceive);
        const currentDate = new Date().toISOString();
        const totalRequired = getTotalQuantityRequired(item.requirement);
        
        if (item.isNewRecord) {
          // Create new tracking record
          let newTrackingData;
          
          if (item.sourceType === 'parent') {
            // Items brought directly from parent - record both payment and receipt
            const historyEntry: RequirementHistory = {
              date: currentDate,
              paymentStatus: 'paid' as RequirementPaymentStatus,
              paidAmount: cashEquivalent,
              coverageMode: 'item' as RequirementCoverageMode,
              itemQuantityProvided: item.quantityToReceive,
              releaseStatus: 'released' as RequirementReleaseStatus,
              releaseDate: currentDate,
              receivedBy: 'Class Teacher',
              academicYearId: activeAcademicYear.id,
              termId: currentTerm.id,
              receiptType: 'payment_and_receipt' as RequirementReceiptType,
              itemQuantityReceived: item.quantityToReceive,
              receiptLocation: 'class' as RequirementReceiptLocation,
              isOfficePayment: false,
              classReceiptDate: currentDate,
              classReceivedBy: 'Class Teacher'
            };

            newTrackingData = {
            pupilId: pupil.id,
            requirementId: item.requirement.id,
            academicYearId: activeAcademicYear.id,
            termId: currentTerm.id,
            selectionMode: 'item' as RequirementSelectionMode,
            paidAmount: cashEquivalent,
            paymentStatus: 'paid' as RequirementPaymentStatus,
            releaseStatus: 'released' as RequirementReleaseStatus,
              paymentDate: currentDate,
              releaseDate: currentDate,
              receivedBy: 'Class Teacher',
              coverageMode: 'item' as RequirementCoverageMode,
              totalItemQuantityRequired: totalRequired,
              itemQuantityProvided: item.quantityToReceive,
              itemQuantityReceived: item.quantityToReceive,
              itemQuantityReceivedFromParent: item.quantityToReceive,
              itemQuantityReceivedFromOffice: 0,
              lastClassReceiptDate: currentDate,
              lastClassReceivedBy: 'Class Teacher',
              remainingQuantity: totalRequired - item.quantityToReceive,
              history: [historyEntry]
            };
          } else {
            // Items from office - only record receipt (assume already paid)
            const historyEntry: RequirementHistory = {
              date: currentDate,
              paymentStatus: 'pending' as RequirementPaymentStatus,
              paidAmount: 0,
              coverageMode: 'item' as RequirementCoverageMode,
              itemQuantityProvided: 0,
              releaseStatus: 'released' as RequirementReleaseStatus,
              releaseDate: currentDate,
              receivedBy: 'Class Teacher',
              academicYearId: activeAcademicYear.id,
              termId: currentTerm.id,
              receiptType: 'receipt_only' as RequirementReceiptType,
              itemQuantityReceived: item.quantityToReceive,
              receiptLocation: 'class' as RequirementReceiptLocation,
              isOfficePayment: false,
              classReceiptDate: currentDate,
              classReceivedBy: 'Class Teacher'
            };

            newTrackingData = {
              pupilId: pupil.id,
              requirementId: item.requirement.id,
              academicYearId: activeAcademicYear.id,
              termId: currentTerm.id,
              selectionMode: 'item' as RequirementSelectionMode,
              paidAmount: 0,
              paymentStatus: 'pending' as RequirementPaymentStatus,
              releaseStatus: 'released' as RequirementReleaseStatus,
              releaseDate: currentDate,
              receivedBy: 'Class Teacher',
              coverageMode: 'item' as RequirementCoverageMode,
              totalItemQuantityRequired: totalRequired,
              itemQuantityProvided: 0,
              itemQuantityReceived: item.quantityToReceive,
              itemQuantityReceivedFromOffice: item.quantityToReceive,
              itemQuantityReceivedFromParent: 0,
              lastClassReceiptDate: currentDate,
              lastClassReceivedBy: 'Class Teacher',
              remainingQuantity: totalRequired - item.quantityToReceive,
              history: [historyEntry]
            };
          }

          await createTrackingMutation.mutateAsync(newTrackingData);
        } else if (item.trackingRecord) {
          // Update existing tracking record
          const currentReceived = item.trackingRecord.itemQuantityReceived || 0;
          const currentReceivedFromOffice = item.trackingRecord.itemQuantityReceivedFromOffice || 0;
          const currentReceivedFromParent = item.trackingRecord.itemQuantityReceivedFromParent || 0;
          
          let historyEntry: RequirementHistory;
          let updatedData;
          
          if (item.sourceType === 'parent') {
            // Items from parent - add to both payment and receipt
          const newTotalPaid = item.trackingRecord.paidAmount + cashEquivalent;
            const newPaymentStatus: RequirementPaymentStatus = newTotalPaid >= (totalRequired * (item.requirement.price / totalRequired)) ? 'paid' : 'partial';
            
            historyEntry = {
              date: currentDate,
              paymentStatus: newPaymentStatus,
            paidAmount: cashEquivalent,
            coverageMode: 'item' as RequirementCoverageMode,
            itemQuantityProvided: item.quantityToReceive,
            releaseStatus: 'released' as RequirementReleaseStatus,
              releaseDate: currentDate,
            receivedBy: 'Class Teacher',
            academicYearId: activeAcademicYear.id,
              termId: currentTerm.id,
              receiptType: 'payment_and_receipt' as RequirementReceiptType,
              itemQuantityReceived: item.quantityToReceive,
              receiptLocation: 'class' as RequirementReceiptLocation,
              isOfficePayment: false,
              classReceiptDate: currentDate,
              classReceivedBy: 'Class Teacher'
            };

            updatedData = {
            ...item.trackingRecord,
            paidAmount: newTotalPaid,
              paymentStatus: newPaymentStatus,
              releaseStatus: 'released' as RequirementReleaseStatus,
              releaseDate: currentDate,
              receivedBy: 'Class Teacher',
              itemQuantityProvided: (item.trackingRecord.itemQuantityProvided || 0) + item.quantityToReceive,
              itemQuantityReceived: currentReceived + item.quantityToReceive,
              itemQuantityReceivedFromParent: currentReceivedFromParent + item.quantityToReceive,
              lastClassReceiptDate: currentDate,
              lastClassReceivedBy: 'Class Teacher',
              remainingQuantity: Math.max(0, totalRequired - (currentReceived + item.quantityToReceive)),
              history: [...(item.trackingRecord.history || []), historyEntry]
            };
          } else {
            // Items from office - only add to receipt
            historyEntry = {
              date: currentDate,
              paymentStatus: item.trackingRecord.paymentStatus,
              paidAmount: 0,
              coverageMode: 'item' as RequirementCoverageMode,
              itemQuantityProvided: 0,
              releaseStatus: 'released' as RequirementReleaseStatus,
              releaseDate: currentDate,
              receivedBy: 'Class Teacher',
              academicYearId: activeAcademicYear.id,
              termId: currentTerm.id,
              receiptType: 'receipt_only' as RequirementReceiptType,
              itemQuantityReceived: item.quantityToReceive,
              receiptLocation: 'class' as RequirementReceiptLocation,
              isOfficePayment: true,
              classReceiptDate: currentDate,
              classReceivedBy: 'Class Teacher'
            };

            updatedData = {
              ...item.trackingRecord,
            releaseStatus: 'released' as RequirementReleaseStatus,
              releaseDate: currentDate,
            receivedBy: 'Class Teacher',
              itemQuantityReceived: currentReceived + item.quantityToReceive,
              itemQuantityReceivedFromOffice: currentReceivedFromOffice + item.quantityToReceive,
              lastClassReceiptDate: currentDate,
              lastClassReceivedBy: 'Class Teacher',
              remainingQuantity: Math.max(0, totalRequired - (currentReceived + item.quantityToReceive)),
            history: [...(item.trackingRecord.history || []), historyEntry]
          };
          }

          await updateTrackingMutation.mutateAsync({
            id: item.trackingRecord.id,
            data: updatedData
          });
        }
      }

      // Refresh data and close modal
      await refetch();
      onClose();
      
      // Reset form
      setItems(prev => prev.map(item => ({ ...item, quantityToReceive: 0 })));
      
    } catch (error) {
      console.error('Error processing requirement reception:', error);
      setErrors({ general: 'Failed to process requirement reception. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasItemsToReceive = items.some(item => item.quantityToReceive > 0);
  const totalItemsToReceive = items.reduce((sum, item) => sum + item.quantityToReceive, 0);

  return (
    <ModernDialog open={isOpen} onOpenChange={onClose}>
      <ModernDialogContent open={isOpen} onOpenChange={onClose}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center gap-3">
            <Package className="w-5 h-5 text-blue-600" />
            Receive Class Requirements
          </ModernDialogTitle>
          
          {/* Pupil and Context Info */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">
                    {pupil.firstName} {pupil.lastName}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {pupil.admissionNumber}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <GraduationCap className="w-4 h-4" />
                  <span>{className} • {pupil.section}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{activeAcademicYear?.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <School className="w-4 h-4" />
                  <span>{currentTerm && activeAcademicYear ? getTermLabel(activeAcademicYear, currentTerm.id) : 'No Active Term'}</span>
                </div>
              </div>
            </div>
          </div>
        </ModernDialogHeader>

        <div className="space-y-6">
          {/* Error Display */}
          {errors.general && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{errors.general}</AlertDescription>
            </Alert>
          )}



          {/* Requirements List */}
          <ScrollArea className="h-80">
            <div className="space-y-1">
              {items.map((item) => {
                const totalRequired = getTotalQuantityRequired(item.requirement);
                const received = getReceivedQuantity(item);
                const remaining = getRemainingQuantity(item);
                const progress = totalRequired > 0 ? (received / totalRequired) * 100 : 0;
                const isCompleted = received >= totalRequired;

                return (
                  <Card key={item.requirement.id} className={`border ${isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200'} mb-1`}>
                    <CardContent className="p-2">
                      {/* Main Content - Ultra compact single row */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Left side - Basic info */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <BookOpen className="w-3 h-3 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm truncate">{item.requirement.name}</span>
                              <Badge variant="secondary" className="text-xs px-1 py-0 h-4 flex-shrink-0">
                                {item.requirement.group}
                              </Badge>
                              {item.isNewRecord && (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 h-4 flex-shrink-0">
                                  New
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <span>{formatCurrency(item.requirement.price)}</span>
                              <span>•</span>
                              <span>{received}/{totalRequired} ({Math.round(progress)}%)</span>
                              <Progress value={progress} className="h-1 w-16 flex-shrink-0" />
                              {isCompleted ? (
                                <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                              ) : (
                                <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Right side - Actions */}
                        {!isCompleted && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Label htmlFor={`quantity-${item.requirement.id}`} className="text-xs text-gray-600 whitespace-nowrap">
                              Max {remaining}:
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.requirement.id, item.quantityToReceive - 1)}
                              disabled={item.quantityToReceive <= 0}
                              className="h-5 w-5 p-0"
                            >
                              <Minus className="w-2 h-2" />
                            </Button>
                            
                            <Input
                              id={`quantity-${item.requirement.id}`}
                              type="number"
                              min="0"
                              max={remaining}
                              value={item.quantityToReceive}
                              onChange={(e) => updateQuantity(item.requirement.id, parseInt(e.target.value) || 0)}
                              className="w-10 text-center h-5 text-xs p-0"
                            />
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.requirement.id, item.quantityToReceive + 1)}
                              disabled={item.quantityToReceive >= remaining}
                              className="h-5 w-5 p-0"
                            >
                              <Plus className="w-2 h-2" />
                            </Button>
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.requirement.id, remaining)}
                              disabled={remaining === 0}
                              className="h-5 px-1 text-xs"
                            >
                              All
                            </Button>
                          </div>
                        )}
                        
                        {isCompleted && (
                          <div className="flex items-center gap-1 text-xs text-green-700 flex-shrink-0">
                            <CheckCircle className="w-3 h-3" />
                            <span>Complete</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom row - Show only when relevant */}
                      {(item.quantityToReceive > 0 || errors[item.requirement.id]) && (
                        <div className="mt-1 pt-1 border-t border-gray-100">
                          {item.quantityToReceive > 0 && (
                            <div className="text-xs text-green-700 bg-green-50 px-1 py-0.5 rounded inline-block">
                              Cash equivalent: {formatCurrency(getCashEquivalent(item.requirement, item.quantityToReceive))}
                            </div>
                          )}
                          {errors[item.requirement.id] && (
                            <p className="text-xs text-red-600 mt-1">{errors[item.requirement.id]}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <ModernDialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!hasItemsToReceive || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? 'Processing...' : `Receive Items (${totalItemsToReceive})`}
          </Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
} 