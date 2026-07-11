"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Calendar, User, Tag, AlertCircle, Clock, Settings, Power, PowerOff, History, Edit3, Save, RotateCcw, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssignmentPushFetchModal } from '@/components/pupils/assignment-push-fetch-modal';
import {
  getAssignmentPushFetchOptions,
  type AssignmentTermMoveAction,
} from '@/lib/utils/assignment-term-push';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from '@/components/ui/modern-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AssignmentTimeManagementForm,
  DEFAULT_ASSIGNMENT_TIME_SETTINGS,
  type AssignmentTimeManagementFormData,
} from '@/components/pupils/assignment-time-management-form';
import { FeeAssignmentPicker } from '@/components/pupils/fee-assignment-picker';

import type {
  Pupil,
  FeeStructure,
  PupilAssignedFee,
  AcademicYear,
  Term,
  FeeValidityType,
  TermApplicabilityType,
  AssignmentStatus,
  DisableEffectType,
  AssignmentStatusHistory
} from '@/types';
import { useFeeStructures, useCreateFeeStructure } from '@/lib/hooks/use-fee-structures';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { PivotDiscountForm } from '@/components/pupils/pivot-discount-form';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupil: Pupil;
  onSave: (updatedAssignedFees: PupilAssignedFee[]) => Promise<void>;
}

export function AssignmentModal({ isOpen, onClose, pupil, onSave }: AssignmentModalProps) {
  const { toast } = useToast();
  const { data: allFeeStructures = [] } = useFeeStructures();
  const createFeeStructureMutation = useCreateFeeStructure();
  const { data: academicYears = [] } = useAcademicYears();

  const [assignedFees, setAssignedFees] = useState<PupilAssignedFee[]>(pupil.assignedFees || []);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [addMode, setAddMode] = useState<'assign' | 'direct'>('assign');
  const [directFeeId, setDirectFeeId] = useState('');
  const [selectedFeeId, setSelectedFeeId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [timeSettings, setTimeSettings] = useState<AssignmentTimeManagementFormData>(
    DEFAULT_ASSIGNMENT_TIME_SETTINGS
  );

  // Status management state
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disableAssignmentId, setDisableAssignmentId] = useState<string | null>(null);
  const [disableEffect, setDisableEffect] = useState<DisableEffectType>('from_next_term');
  const [disableReason, setDisableReason] = useState('');
  const [timeEditModalOpen, setTimeEditModalOpen] = useState(false);
  const [editingTimeAssignmentId, setEditingTimeAssignmentId] = useState<string | null>(null);
  const [editingTimeSettings, setEditingTimeSettings] = useState<AssignmentTimeManagementFormData>(
    DEFAULT_ASSIGNMENT_TIME_SETTINGS
  );
  const [pushFetchModalOpen, setPushFetchModalOpen] = useState(false);
  const [pushFetchAssignmentId, setPushFetchAssignmentId] = useState<string | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [showPivotForm, setShowPivotForm] = useState(false);
  const [inlineDiscounts, setInlineDiscounts] = useState<Record<string, { name: string; amount: number; description?: string; linkedFeeIds: string[] }>>({});

  const hasUnsavedChanges = useMemo(() => {
    const isAdding = isAddingNew && selectedFeeId !== '';
    const hasModifications = JSON.stringify(assignedFees) !== JSON.stringify(pupil.assignedFees || []);
    return isAdding || hasModifications || showPivotForm;
  }, [assignedFees, pupil.assignedFees, isAddingNew, selectedFeeId, showPivotForm]);

  const handleAttemptClose = (open: boolean) => {
    if (!open) {
      if (hasUnsavedChanges) {
        setShowUnsavedWarning(true);
      } else {
        onClose();
      }
    }
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Ensure all existing assignments have the required status field
      const updatedAssignedFees = (pupil.assignedFees || []).map(fee => ({
        ...fee,
        status: fee.status || 'active' as AssignmentStatus, // Default to active if not set
        statusHistory: fee.statusHistory || []
      }));
      setAssignedFees(updatedAssignedFees);
      setIsAddingNew(false);
      setAddMode('assign');
      setDirectFeeId('');
      setSelectedFeeId('');
      setNotes('');
      setShowPivotForm(false);
      setInlineDiscounts({});
      setTimeSettings(DEFAULT_ASSIGNMENT_TIME_SETTINGS);
      setEditingAssignmentId(null);
      setDisableModalOpen(false);
      setTimeEditModalOpen(false);
      setPushFetchModalOpen(false);
      setPushFetchAssignmentId(null);
    }
  }, [isOpen, pupil.assignedFees]);

  const availableFees = useMemo(
    () =>
      allFeeStructures.filter(
        (fee) => {
          if (fee.status !== 'active') return false;
          if (assignedFees.some((assigned) => assigned.feeStructureId === fee.id)) return false;

          if (fee.category === 'Discount') {
            const linkedIds = fee.linkedFeeIds || (fee.linkedFeeId ? [fee.linkedFeeId] : []);
            if (linkedIds.length > 0) {
              const hasApplicableLinkedFee = linkedIds.some(id => {
                // 1. Is this fee explicitly assigned to the pupil and active?
                if (assignedFees.some(assigned => assigned.feeStructureId === id && assigned.status === 'active')) return true;
                
                // 2. Is this fee a standard general fee applicable to the pupil's class and section?
                const linkedFee = allFeeStructures.find(f => f.id === id);
                if (linkedFee && !linkedFee.isAssignmentFee && linkedFee.status === 'active') {
                   const matchesClass = linkedFee.classFeeType === 'all' || (linkedFee.classIds && linkedFee.classIds.includes(pupil.classId));
                   const matchesSection = linkedFee.sectionFeeType === 'all' || (pupil.section && linkedFee.section === pupil.section);
                   if (matchesClass && matchesSection) return true;
                }
                return false;
              });
              
              if (!hasApplicableLinkedFee) return false;
            }
          }

          return fee.isAssignmentFee || fee.category === 'Discount';
        }
      ),
    [allFeeStructures, assignedFees, pupil]
  );

  const pupilApplicableFees = useMemo(() => {
    return allFeeStructures.filter(fee => {
      if (fee.status !== 'active') return false;
      if (fee.category === 'Discount') return false;
      if (assignedFees.some(assigned => assigned.feeStructureId === fee.id && assigned.status === 'active')) return true;
      if (!fee.isAssignmentFee) {
         const matchesClass = fee.classFeeType === 'all' || (fee.classIds && fee.classIds.includes(pupil.classId));
         const matchesSection = fee.sectionFeeType === 'all' || (pupil.section && fee.section === pupil.section);
         if (matchesClass && matchesSection) return true;
      }
      return false;
    });
  }, [allFeeStructures, assignedFees, pupil]);

  const directAvailableDiscounts = useMemo(() => {
    if (!directFeeId) return [];
    return allFeeStructures.filter(fee => {
      if (fee.category !== 'Discount' || fee.status !== 'active') return false;
      if (assignedFees.some(assigned => assigned.feeStructureId === fee.id)) return false;
      const linkedIds = fee.linkedFeeIds || (fee.linkedFeeId ? [fee.linkedFeeId] : []);
      return linkedIds.includes(directFeeId);
    });
  }, [allFeeStructures, assignedFees, directFeeId]);

  const selectedFeeName = useMemo(() => {
    if (selectedFeeId && selectedFeeId.startsWith('pivot-') && inlineDiscounts[selectedFeeId]) {
      return `${inlineDiscounts[selectedFeeId].name} (Pupil-Specific)`;
    }
    return allFeeStructures.find((f) => f.id === selectedFeeId)?.name;
  }, [allFeeStructures, selectedFeeId, inlineDiscounts]);

  // Automatically determine term applicability for discounts based on linked fees
  useEffect(() => {
    if (selectedFeeId) {
      const fee = allFeeStructures.find(f => f.id === selectedFeeId);
      if (fee && fee.category === 'Discount') {
        const linkedIds = fee.linkedFeeIds || (fee.linkedFeeId ? [fee.linkedFeeId] : []);
        if (linkedIds.length > 0) {
          const linkedFees = allFeeStructures.filter(f => linkedIds.includes(f.id));
          const originalTermIds = linkedFees.map(f => f.termId).filter(Boolean) as string[];

          if (originalTermIds.length > 0) {
            // Find the original term objects to know their names/orders
            const originalTerms = originalTermIds.map(id => {
              for (const year of academicYears) {
                const term = year.terms.find(t => t.id === id);
                if (term) return term;
              }
              return null;
            }).filter(Boolean) as Term[];

            // Helper to match terms across years
            const extractOrder = (name: string) => {
              const match = name.match(/(\d+)/);
              if (match) return parseInt(match[1], 10);
              const n = name.toLowerCase();
              if (n.includes('first')) return 1;
              if (n.includes('second')) return 2;
              if (n.includes('third')) return 3;
              return null;
            };

            const originalOrders = originalTerms.map(t => extractOrder(t.name)).filter(o => o !== null);
            const originalNames = originalTerms.map(t => t.name.toLowerCase().trim());

            // Collect all matching term IDs from ALL years
            const allMatchingTermIds: string[] = [];
            academicYears.forEach(year => {
              year.terms.forEach(term => {
                const order = extractOrder(term.name);
                if ((order !== null && originalOrders.includes(order)) || originalNames.includes(term.name.toLowerCase().trim())) {
                  allMatchingTermIds.push(term.id);
                }
              });
            });

            const uniqueTermIds = Array.from(new Set(allMatchingTermIds));

            if (uniqueTermIds.length > 0) {
              setTimeSettings(prev => ({
                ...prev,
                termApplicability: 'specific_terms',
                applicableTermIds: uniqueTermIds,
                allowedTermIds: uniqueTermIds,
              }));
              return;
            }
          }
        }
      }
      // Reset if not a discount with specific terms, but preserve valid settings if they were manually changed? 
      // It's safer to reset to default when switching fees.
      setTimeSettings(DEFAULT_ASSIGNMENT_TIME_SETTINGS);
    }
  }, [selectedFeeId, allFeeStructures, academicYears]);

  const handleAddAssignment = () => {
    if (!selectedFeeId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a fee to assign.",
      });
      return;
    }

    const inlineDiscountData = (selectedFeeId.startsWith('pivot-') && inlineDiscounts[selectedFeeId])
      ? {
          name: inlineDiscounts[selectedFeeId].name,
          amount: -Math.abs(inlineDiscounts[selectedFeeId].amount),
          description: inlineDiscounts[selectedFeeId].description,
          linkedFeeIds: inlineDiscounts[selectedFeeId].linkedFeeIds,
        }
      : undefined;

    const newAssignment: PupilAssignedFee = {
      id: `paf-${Date.now()}`,
      feeStructureId: selectedFeeId,
      assignedAt: new Date().toISOString(),
      assignedBy: 'System Admin', // TODO: Get from current user
      notes: notes.trim() || undefined,
      status: 'active',
      validityType: timeSettings.validityType,
      startAcademicYearId: timeSettings.startAcademicYearId,
      endAcademicYearId: timeSettings.endAcademicYearId,
      termApplicability: timeSettings.termApplicability,
      applicableTermIds: timeSettings.applicableTermIds,
      inlineDiscount: inlineDiscountData,
      statusHistory: [{
        date: new Date().toISOString(),
        action: 'enabled',
        newStatus: 'active',
        processedBy: 'System Admin'
      }]
    };

    setAssignedFees(prev => [...prev, newAssignment]);
    setIsAddingNew(false);
    setSelectedFeeId('');
    setNotes('');
    setTimeSettings(DEFAULT_ASSIGNMENT_TIME_SETTINGS);
    setShowPivotForm(false);
    setInlineDiscounts({});
  };

  const handleCancelAddAssignment = () => {
    setIsAddingNew(false);
    setSelectedFeeId('');
    setNotes('');
    setTimeSettings(DEFAULT_ASSIGNMENT_TIME_SETTINGS);
    setShowPivotForm(false);
    setInlineDiscounts({});
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    const assignment = assignedFees.find(a => a.id === assignmentId);
    const feeStructure = allFeeStructures.find(f => f.id === assignment?.feeStructureId);

    setAssignedFees(prev => prev.filter(a => a.id !== assignmentId));

    toast({
      title: "Assignment Removed",
      description: `${feeStructure?.name || 'Fee'} assignment has been removed.`,
    });
  };

  const handleDisableAssignment = (assignmentId: string) => {
    setDisableAssignmentId(assignmentId);
    setDisableEffect('from_next_term');
    setDisableReason('');
    setDisableModalOpen(true);
  };

  const confirmDisableAssignment = () => {
    if (!disableAssignmentId) return;

    const assignment = assignedFees.find(a => a.id === disableAssignmentId);
    if (!assignment) return;

    const statusHistoryEntry: AssignmentStatusHistory = {
      date: new Date().toISOString(),
      action: 'disabled',
      previousStatus: assignment.status,
      newStatus: 'disabled',
      disableEffect,
      reason: disableReason.trim() || undefined,
      processedBy: 'System Admin'
    };

    setAssignedFees(prev => prev.map(a =>
      a.id === disableAssignmentId
        ? {
          ...a,
          status: 'disabled',
          statusHistory: [...(a.statusHistory || []), statusHistoryEntry]
        }
        : a
    ));

    const feeStructure = allFeeStructures.find(f => f.id === assignment.feeStructureId);

    toast({
      title: "Assignment Disabled",
      description: `${feeStructure?.name || 'Fee'} assignment has been disabled ${disableEffect === 'from_next_term' ? 'from next term' : 'from current term'}.`,
    });

    setDisableModalOpen(false);
    setDisableAssignmentId(null);
  };

  const handleEnableAssignment = (assignmentId: string) => {
    const assignment = assignedFees.find(a => a.id === assignmentId);
    if (!assignment) return;

    const statusHistoryEntry: AssignmentStatusHistory = {
      date: new Date().toISOString(),
      action: 'enabled',
      previousStatus: assignment.status,
      newStatus: 'active',
      processedBy: 'System Admin'
    };

    setAssignedFees(prev => prev.map(a =>
      a.id === assignmentId
        ? {
          ...a,
          status: 'active',
          statusHistory: [...(a.statusHistory || []), statusHistoryEntry]
        }
        : a
    ));

    const feeStructure = allFeeStructures.find(f => f.id === assignment.feeStructureId);

    toast({
      title: "Assignment Enabled",
      description: `${feeStructure?.name || 'Fee'} assignment has been enabled.`,
    });
  };

  const handleEditTimeSettings = (assignmentId: string) => {
    const assignment = assignedFees.find(a => a.id === assignmentId);
    if (!assignment) return;

    setEditingTimeAssignmentId(assignmentId);
    setEditingTimeSettings({
      validityType: assignment.validityType,
      startAcademicYearId: assignment.startAcademicYearId,
      endAcademicYearId: assignment.endAcademicYearId,
      termApplicability: assignment.termApplicability,
      applicableTermIds: assignment.applicableTermIds,
    });
    setTimeEditModalOpen(true);
  };

  const confirmTimeSettingsEdit = () => {
    if (!editingTimeAssignmentId) return;

    const assignment = assignedFees.find(a => a.id === editingTimeAssignmentId);
    if (!assignment) return;

    const statusHistoryEntry: AssignmentStatusHistory = {
      date: new Date().toISOString(),
      action: 'time_adjusted',
      previousStatus: assignment.status,
      newStatus: assignment.status,
      processedBy: 'System Admin',
      previousTimeSettings: {
        validityType: assignment.validityType,
        startAcademicYearId: assignment.startAcademicYearId,
        endAcademicYearId: assignment.endAcademicYearId,
        termApplicability: assignment.termApplicability,
        applicableTermIds: assignment.applicableTermIds,
      }
    };

    setAssignedFees(prev => prev.map(a =>
      a.id === editingTimeAssignmentId
        ? {
          ...a,
          validityType: editingTimeSettings.validityType,
          startAcademicYearId: editingTimeSettings.startAcademicYearId,
          endAcademicYearId: editingTimeSettings.endAcademicYearId,
          termApplicability: editingTimeSettings.termApplicability,
          applicableTermIds: editingTimeSettings.applicableTermIds,
          statusHistory: [...(a.statusHistory || []), statusHistoryEntry]
        }
        : a
    ));

    const feeStructure = allFeeStructures.find(f => f.id === assignment.feeStructureId);

    toast({
      title: "Time Settings Updated",
      description: `Time settings for ${feeStructure?.name || 'Fee'} have been updated.`,
    });

    setTimeEditModalOpen(false);
    setEditingTimeAssignmentId(null);
  };

  const handleOpenPushFetch = (assignmentId: string) => {
    setPushFetchAssignmentId(assignmentId);
    setPushFetchModalOpen(true);
  };

  const handleApplyPushFetch = (
    updated: PupilAssignedFee,
    action: AssignmentTermMoveAction,
    targetLabel: string
  ) => {
    setAssignedFees((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    );

    const feeStructure = allFeeStructures.find((f) => f.id === updated.feeStructureId);
    const verb =
      action === 'push' ? 'Pushed' : action === 'fetch' ? 'Fetched' : 'Moved';

    toast({
      title: `${verb} assignment`,
      description: `${feeStructure?.name || 'Fee'} now applies to ${targetLabel}. Click Save Changes to persist.`,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(assignedFees);
      toast({
        title: "Assignments Updated",
        description: "Fee assignments have been updated successfully.",
      });
      onClose();
    } catch (error) {
      console.error('Failed to save assignments:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save assignments. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getFeeStructure = (feeId: string, inlineDiscount?: any) => {
    if (inlineDiscount) {
      return {
        id: feeId,
        name: inlineDiscount.name,
        amount: inlineDiscount.amount, // negative
        category: 'Discount',
        status: 'active',
        linkedFeeIds: inlineDiscount.linkedFeeIds,
      } as any;
    }
    if (feeId && feeId.startsWith('pivot-') && inlineDiscounts[feeId]) {
      return {
        id: feeId,
        name: inlineDiscounts[feeId].name,
        amount: -Math.abs(inlineDiscounts[feeId].amount),
        category: 'Discount',
        status: 'active',
        linkedFeeIds: inlineDiscounts[feeId].linkedFeeIds,
      } as any;
    }
    return allFeeStructures.find(f => f.id === feeId);
  };

  const handleOpenSavePivot = async (data: { name: string; amount: number; description?: string; linkedFeeIds: string[] }) => {
    try {
      const discountPayload = {
        name: data.name,
        amount: -Math.abs(Number(data.amount) || 0), // stored negative
        category: "Discount" as const,
        academicYearId: undefined,
        termId: undefined,
        classFeeType: 'all' as const,
        classIds: undefined,
        sectionFeeType: 'all' as const,
        section: undefined,
        isRequired: false,
        isRecurring: false,
        frequency: undefined,
        status: "active" as const,
        linkedFeeIds: data.linkedFeeIds,
        linkedFeeId: data.linkedFeeIds?.[0],
        disableHistory: [],
        isAssignmentFee: false,
        description: data.description,
      };

      const result = await createFeeStructureMutation.mutateAsync(discountPayload);
      setSelectedFeeId(result.id);
      setShowPivotForm(false);
      toast({
        title: "Global Discount Created",
        description: `Discount "${data.name}" has been created and is now selected.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save discount globally.",
      });
    }
  };

  const handleCloseSavePivot = (data: { name: string; amount: number; description?: string; linkedFeeIds: string[] }) => {
    const customId = `pivot-${Date.now()}`;
    setInlineDiscounts(prev => ({
      ...prev,
      [customId]: data
    }));
    setSelectedFeeId(customId);
    setShowPivotForm(false);
    toast({
      title: "Pupil-Specific Discount Created",
      description: `Bespoke discount "${data.name}" is now configured for this assignment.`,
    });
  };

  const pushFetchAssignment = pushFetchAssignmentId
    ? assignedFees.find((a) => a.id === pushFetchAssignmentId) ?? null
    : null;
  const pushFetchFeeName = pushFetchAssignment
    ? getFeeStructure(pushFetchAssignment.feeStructureId, pushFetchAssignment.inlineDiscount)?.name ?? 'Assignment'
    : 'Assignment';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX'
    }).format(amount);
  };

  const getValidityDescription = (assignment: PupilAssignedFee) => {
    switch (assignment.validityType) {
      case 'current_term':
        return 'Current term only';
      case 'current_year':
        return 'Current academic year';
      case 'specific_year':
        const year = academicYears.find(y => y.id === assignment.startAcademicYearId);
        return `${year?.name || 'Unknown year'} only`;
      case 'year_range':
        const startYear = academicYears.find(y => y.id === assignment.startAcademicYearId);
        const endYear = academicYears.find(y => y.id === assignment.endAcademicYearId);
        return `${startYear?.name || 'Unknown'} to ${endYear?.name || 'Unknown'}`;
      case 'specific_terms':
        return 'Specific terms';
      case 'indefinite':
      default:
        return 'Indefinite';
    }
  };

  const getTermApplicabilityDescription = (assignment: PupilAssignedFee) => {
    if (assignment.termApplicability === 'specific_terms' && assignment.applicableTermIds) {
      const termNames = assignment.applicableTermIds.map(termId => {
        // Find term across all academic years
        for (const year of academicYears) {
          const term = year.terms.find(t => t.id === termId);
          if (term) return `${term.name} (${year.name})`;
        }
        return 'Unknown term';
      });
      return termNames.join(', ');
    }
    return 'All terms';
  };

  return (
    <>
      <ModernDialog open={isOpen} onOpenChange={handleAttemptClose}>
        <ModernDialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-3 -mt-4 -ml-2 relative">
            <ModernDialogHeader className="text-left space-y-0.5 m-0 p-0">
              <ModernDialogTitle className="flex items-center gap-1.5 text-sm font-bold leading-none text-indigo-900">
                <Tag className="h-4 w-4 text-blue-600" />
                Manage Fee Assignments & Discounts
              </ModernDialogTitle>
              <ModernDialogDescription className="text-[11px] font-medium text-gray-500 leading-tight">
                Assign special fees and discounts to {pupil.firstName} {pupil.lastName} with time management and status control.
              </ModernDialogDescription>
            </ModernDialogHeader>
            <div className="flex items-center gap-1.5 pt-0.5 pr-8">
              {!isAddingNew && (
                <Button variant="outline" size="sm" onClick={() => setIsAddingNew(true)} className="rounded-full h-6 px-2.5 text-[10px] font-medium flex items-center gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <Plus className="h-3 w-3" />
                  Add New
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="rounded-full h-6 px-3 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Current Assignments */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Current Assignments</h3>

              {assignedFees.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No fee assignments yet</p>
                      <p className="text-sm text-muted-foreground">Click "Add Assignment" to get started</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {assignedFees.map((assignment) => {
                    const feeStructure = getFeeStructure(assignment.feeStructureId, assignment.inlineDiscount);
                    if (!feeStructure) return null;
 
                    return (
                      <Card key={assignment.id} className={`overflow-hidden ${assignment.status === 'disabled' ? 'opacity-60' : ''}`}>
                        <Collapsible>
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                                  <h4 className="font-medium text-sm truncate mr-2">{feeStructure.name}</h4>
                                  <Badge variant={feeStructure.category === 'Discount' ? 'secondary' : 'default'} className="h-5 px-1.5 text-[10px]">
                                    {feeStructure.category === 'Discount' ? 'Discount' : 'Assignment Fee'}
                                  </Badge>
                                  {assignment.inlineDiscount && (
                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-slate-100 border-slate-300 text-slate-700 font-semibold">
                                      Pupil-Specific
                                    </Badge>
                                  )}
                                  <Badge variant={assignment.status === 'active' ? 'default' : 'destructive'} className="h-5 px-1.5 text-[10px]">
                                    {assignment.status}
                                  </Badge>
                                  {feeStructure.category === 'Discount' && (
                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                      {feeStructure.amount < 0
                                        ? `${formatCurrency(Math.abs(feeStructure.amount))} off`
                                        : `${feeStructure.amount}% off`
                                      }
                                    </Badge>
                                  )}
                                  {feeStructure.category !== 'Discount' && (
                                    <span className="font-semibold text-green-600 text-sm ml-auto">
                                      {formatCurrency(feeStructure.amount)}
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="truncate max-w-[150px]">{getValidityDescription(assignment)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span className="truncate max-w-[200px]" title={getTermApplicabilityDescription(assignment)}>
                                      {getTermApplicabilityDescription(assignment)}
                                    </span>
                                  </div>
                                  {feeStructure.category === 'Discount' && (feeStructure.linkedFeeId || (feeStructure.linkedFeeIds && feeStructure.linkedFeeIds.length > 0)) && (
                                    <div className="flex items-center gap-1 text-blue-600">
                                      <span className="font-medium">Linked:</span>
                                      <span className="truncate max-w-[200px]" title={
                                        (feeStructure.linkedFeeIds && feeStructure.linkedFeeIds.length > 0)
                                          ? feeStructure.linkedFeeIds.map(id => allFeeStructures.find(f => f.id === id)?.name || 'Unknown Fee').join(', ')
                                          : (allFeeStructures.find(f => f.id === feeStructure.linkedFeeId)?.name || 'Unknown Fee')
                                      }>
                                        {
                                          (feeStructure.linkedFeeIds && feeStructure.linkedFeeIds.length > 0)
                                            ? feeStructure.linkedFeeIds.map(id => allFeeStructures.find(f => f.id === id)?.name || 'Unknown Fee').join(', ')
                                            : (allFeeStructures.find(f => f.id === feeStructure.linkedFeeId)?.name || 'Unknown Fee')
                                        }
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {assignment.notes && (
                                  <div className="mt-1.5 text-xs text-gray-600 bg-gray-50 p-1.5 rounded line-clamp-1" title={assignment.notes}>
                                    <span className="font-medium mr-1">Note:</span> {assignment.notes}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-row flex-wrap justify-end gap-1 shrink-0">
                                {(() => {
                                  const moveOptions = getAssignmentPushFetchOptions(
                                    assignment,
                                    academicYears
                                  );
                                  const canMove =
                                    assignment.status === 'active' &&
                                    (moveOptions.push ||
                                      moveOptions.fetch ||
                                      moveOptions.customTargets.length > 0);
                                  if (!canMove) return null;
                                  return (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                      title="Push / Fetch to another term"
                                      onClick={() => handleOpenPushFetch(assignment.id)}
                                    >
                                      <ArrowRightLeft className="h-3.5 w-3.5" />
                                    </Button>
                                  );
                                })()}

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="Edit Time Settings"
                                  onClick={() => handleEditTimeSettings(assignment.id)}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>

                                {assignment.status === 'active' ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                    title="Disable Assignment"
                                    onClick={() => handleDisableAssignment(assignment.id)}
                                  >
                                    <PowerOff className="h-3.5 w-3.5" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Enable Assignment"
                                    onClick={() => handleEnableAssignment(assignment.id)}
                                  >
                                    <Power className="h-3.5 w-3.5" />
                                  </Button>
                                )}

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Remove Assignment"
                                  onClick={() => handleRemoveAssignment(assignment.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                
                                {assignment.statusHistory && assignment.statusHistory.length > 0 && (
                                  <CollapsibleTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                      title={`View History (${assignment.statusHistory.length})`}
                                    >
                                      <History className="h-3.5 w-3.5" />
                                    </Button>
                                  </CollapsibleTrigger>
                                )}
                              </div>
                            </div>
                            
                            {/* Status History Content */}
                            {assignment.statusHistory && assignment.statusHistory.length > 0 && (
                              <CollapsibleContent className="mt-2 pt-2 border-t border-slate-100">
                                <div className="space-y-1 text-[10px]">
                                  {assignment.statusHistory
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map((entry, index) => (
                                      <div key={index} className="px-2 py-1 bg-muted/50 rounded flex flex-wrap items-center justify-between gap-1">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-[9px] h-4 px-1 leading-none">{entry.action}</Badge>
                                          <span>{new Date(entry.date).toLocaleDateString()}</span>
                                          {entry.reason && <span className="text-muted-foreground truncate max-w-[150px]">- {entry.reason}</span>}
                                        </div>
                                        {entry.disableEffect && (
                                          <span className="text-muted-foreground">
                                            {entry.disableEffect === 'from_next_term' ? 'From next term' : 'From current term'}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              </CollapsibleContent>
                            )}
                          </div>
                        </Collapsible>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add New Assignment */}
            <div>
              {isAddingNew && (
                <h3 className="text-lg font-semibold mb-4">Add New Assignment</h3>
              )}

              {isAddingNew && (
                <Card>
                  {showPivotForm ? null : (
                    <CardHeader className="pb-3 border-b px-4 py-3">
                      <div className="flex bg-slate-100 p-1 rounded-md w-max">
                        <button 
                          type="button"
                          className={cn("px-4 py-1.5 text-sm font-medium rounded-sm transition-colors", addMode === 'assign' ? "bg-white shadow-sm text-indigo-900" : "text-slate-600 hover:text-slate-900")} 
                          onClick={() => { setAddMode('assign'); setSelectedFeeId(''); setDirectFeeId(''); }}
                        >
                          Assign Mode
                        </button>
                        <button 
                          type="button"
                          className={cn("px-4 py-1.5 text-sm font-medium rounded-sm transition-colors", addMode === 'direct' ? "bg-white shadow-sm text-indigo-900" : "text-slate-600 hover:text-slate-900")} 
                          onClick={() => { setAddMode('direct'); setSelectedFeeId(''); }}
                        >
                          Direct Mode
                        </button>
                      </div>
                    </CardHeader>
                  )}
                  <CardContent className="p-4 space-y-4 pt-4">
                    {showPivotForm ? (
                      <PivotDiscountForm
                        targetFeeId={directFeeId}
                        feeItems={pupilApplicableFees}
                        academicYears={academicYears}
                        onOpenSave={handleOpenSavePivot}
                        onCloseSave={handleCloseSavePivot}
                        onCancel={() => setShowPivotForm(false)}
                        isSaving={createFeeStructureMutation.isPending}
                      />
                    ) : (
                      <>
                        {addMode === 'assign' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="fee-select">Select Assignment Fee</Label>
                              <FeeAssignmentPicker
                                fees={availableFees.filter(f => f.category !== 'Discount')}
                                academicYears={academicYears}
                                selectedFeeId={selectedFeeId}
                                selectedFeeName={selectedFeeName}
                                onSelectFeeId={setSelectedFeeId}
                                placeholder="Choose an assignment fee..."
                              />
                            </div>
                            <div>
                              <Label htmlFor="discount-select">Select Discount</Label>
                              <FeeAssignmentPicker
                                fees={availableFees.filter(f => f.category === 'Discount')}
                                academicYears={academicYears}
                                selectedFeeId={selectedFeeId}
                                selectedFeeName={selectedFeeName}
                                onSelectFeeId={setSelectedFeeId}
                                placeholder="Choose a discount..."
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="direct-fee-select">Select Target Fee</Label>
                              <FeeAssignmentPicker
                                fees={pupilApplicableFees}
                                academicYears={academicYears}
                                selectedFeeId={directFeeId}
                                onSelectFeeId={setDirectFeeId}
                                placeholder="Choose an active fee..."
                              />
                            </div>
                            <div>
                              <Label htmlFor="direct-discount-select">Select Discount</Label>
                              <FeeAssignmentPicker
                                fees={directAvailableDiscounts}
                                academicYears={academicYears}
                                selectedFeeId={selectedFeeId}
                                selectedFeeName={selectedFeeName}
                                onSelectFeeId={setSelectedFeeId}
                                onPivotRequest={() => setShowPivotForm(true)}
                                placeholder={directFeeId ? "Choose a discount..." : "Select a fee first..."}
                              />
                            </div>
                          </div>
                        )}

                        <div className="pt-2">
                          <AssignmentTimeManagementForm
                            academicYears={academicYears}
                            settings={timeSettings}
                            onSettingsChange={setTimeSettings}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={handleAddAssignment} disabled={!selectedFeeId}>
                            Add Assignment
                          </Button>
                          <Button variant="outline" onClick={handleCancelAddAssignment}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

        </ModernDialogContent>
      </ModernDialog>

      {/* Disable Assignment Modal */}
      <ModernDialog open={disableModalOpen} onOpenChange={setDisableModalOpen}>
        <ModernDialogContent size="md">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center">
              <PowerOff className="mr-2 h-5 w-5 text-orange-600" />
              Disable Assignment
            </ModernDialogTitle>
            <ModernDialogDescription>
              Choose how to disable this assignment and its effect on payment history.
            </ModernDialogDescription>
          </ModernDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="disable-effect">Disable Effect</Label>
              <Select value={disableEffect} onValueChange={(value: DisableEffectType) => setDisableEffect(value)}>
                <SelectTrigger id="disable-effect">
                  <SelectValue placeholder="Select disable effect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="from_next_term">
                    <div>
                      <div className="font-medium">From Next Term</div>
                      <div className="text-xs text-muted-foreground">Keep current term payment history</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="from_current_term">
                    <div>
                      <div className="font-medium">From Current Term</div>
                      <div className="text-xs text-muted-foreground">Delete current term payment history</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disable-reason">Reason (Optional)</Label>
              <Textarea
                id="disable-reason"
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value.toUpperCase())}
                placeholder="Enter reason for disabling this assignment..."
                rows={3}
              />
            </div>
          </div>

          <ModernDialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDisableModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDisableAssignment}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <PowerOff className="mr-2 h-4 w-4" />
              Disable Assignment
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>

      <AssignmentPushFetchModal
        open={pushFetchModalOpen}
        onOpenChange={setPushFetchModalOpen}
        assignment={pushFetchAssignment}
        feeName={pushFetchFeeName}
        academicYears={academicYears}
        onApply={handleApplyPushFetch}
      />

      <ModernDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <ModernDialogContent size="sm">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              Unsaved Changes
            </ModernDialogTitle>
            <ModernDialogDescription>
              You have unsaved changes. Would you like to save them or discard them?
            </ModernDialogDescription>
          </ModernDialogHeader>
          <div className="flex justify-end gap-2 pt-4 mt-4">
            <Button variant="outline" onClick={() => {
              setShowUnsavedWarning(false);
              onClose();
            }}>
              Discard
            </Button>
            <Button onClick={() => {
              setShowUnsavedWarning(false);
              handleSave();
            }} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </ModernDialogContent>
      </ModernDialog>

      {/* Time Settings Edit Modal */}
      <ModernDialog open={timeEditModalOpen} onOpenChange={setTimeEditModalOpen}>
        <ModernDialogContent size="lg">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center">
              <Clock className="mr-2 h-5 w-5 text-blue-600" />
              Edit Time Settings
            </ModernDialogTitle>
            <ModernDialogDescription>
              Adjust the time period and term applicability for this assignment.
            </ModernDialogDescription>
          </ModernDialogHeader>

          <div className="py-4">
            <AssignmentTimeManagementForm
              academicYears={academicYears}
              settings={editingTimeSettings}
              onSettingsChange={setEditingTimeSettings}
            />
          </div>

          <ModernDialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setTimeEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmTimeSettingsEdit}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>
    </>
  );
} 