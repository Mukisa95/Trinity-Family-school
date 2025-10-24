"use client";

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, User, Tag, AlertCircle, Clock, Settings, Power, PowerOff, History, Edit3, Save, RotateCcw } from 'lucide-react';
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
import { useFeeStructures } from '@/lib/hooks/use-fee-structures';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupil: Pupil;
  onSave: (updatedAssignedFees: PupilAssignedFee[]) => Promise<void>;
}

interface TimeManagementFormData {
  validityType: FeeValidityType;
  startAcademicYearId?: string;
  endAcademicYearId?: string;
  termApplicability: TermApplicabilityType;
  applicableTermIds?: string[];
}

export function AssignmentModal({ isOpen, onClose, pupil, onSave }: AssignmentModalProps) {
  const { toast } = useToast();
  const { data: allFeeStructures = [] } = useFeeStructures();
  const { data: academicYears = [] } = useAcademicYears();
  
  const [assignedFees, setAssignedFees] = useState<PupilAssignedFee[]>(pupil.assignedFees || []);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedFeeId, setSelectedFeeId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Time management state
  const [timeSettings, setTimeSettings] = useState<TimeManagementFormData>({
    validityType: 'indefinite',
    termApplicability: 'all_terms',
  });
  
  // Status management state
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disableAssignmentId, setDisableAssignmentId] = useState<string | null>(null);
  const [disableEffect, setDisableEffect] = useState<DisableEffectType>('from_next_term');
  const [disableReason, setDisableReason] = useState('');
  const [timeEditModalOpen, setTimeEditModalOpen] = useState(false);
  const [editingTimeAssignmentId, setEditingTimeAssignmentId] = useState<string | null>(null);
  const [editingTimeSettings, setEditingTimeSettings] = useState<TimeManagementFormData>({
    validityType: 'indefinite',
    termApplicability: 'all_terms',
  });

  // Get current academic year and term
  const currentAcademicYear = academicYears.find(year => year.isActive);
  const currentTerm = currentAcademicYear?.terms.find(term => term.isCurrent);

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
      setSelectedFeeId('');
      setNotes('');
      setTimeSettings({
        validityType: 'indefinite',
        termApplicability: 'all_terms',
      });
      setEditingAssignmentId(null);
      setDisableModalOpen(false);
      setTimeEditModalOpen(false);
    }
  }, [isOpen, pupil.assignedFees]);

  // Get available fees for assignment (assignment fees and discounts)
  const availableFees = allFeeStructures.filter(fee => 
    (fee.isAssignmentFee || fee.category === 'Discount') && 
    fee.status === 'active' &&
    !assignedFees.some(assigned => assigned.feeStructureId === fee.id)
  );

  const handleAddAssignment = () => {
    if (!selectedFeeId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a fee to assign.",
      });
      return;
    }

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
    setTimeSettings({
      validityType: 'indefinite',
      termApplicability: 'all_terms',
    });

    toast({
      title: "Assignment Added",
      description: "Fee assignment has been added successfully.",
    });
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

  const getFeeStructure = (feeId: string) => {
    return allFeeStructures.find(f => f.id === feeId);
  };

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

  const renderTimeManagementForm = (
    settings: TimeManagementFormData,
    onSettingsChange: (settings: TimeManagementFormData) => void
  ) => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="validity-type">Validity Period</Label>
        <Select 
          value={settings.validityType} 
          onValueChange={(value: FeeValidityType) => 
            onSettingsChange({ ...settings, validityType: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select validity period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="indefinite">Indefinite</SelectItem>
            <SelectItem value="current_term">Current Term Only</SelectItem>
            <SelectItem value="current_year">Current Academic Year</SelectItem>
            <SelectItem value="specific_year">Specific Academic Year</SelectItem>
            <SelectItem value="year_range">Range of Years</SelectItem>
            <SelectItem value="specific_terms">Specific Terms</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(settings.validityType === 'specific_year' || settings.validityType === 'year_range') && (
        <div>
          <Label htmlFor="start-year">Start Academic Year</Label>
          <Select 
            value={settings.startAcademicYearId || ''} 
            onValueChange={(value) => 
              onSettingsChange({ ...settings, startAcademicYearId: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select start year" />
            </SelectTrigger>
            <SelectContent>
              {academicYears.map(year => (
                <SelectItem key={year.id} value={year.id}>
                  {year.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {settings.validityType === 'year_range' && (
        <div>
          <Label htmlFor="end-year">End Academic Year</Label>
          <Select 
            value={settings.endAcademicYearId || ''} 
            onValueChange={(value) => 
              onSettingsChange({ ...settings, endAcademicYearId: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select end year" />
            </SelectTrigger>
            <SelectContent>
              {academicYears.map(year => (
                <SelectItem key={year.id} value={year.id}>
                  {year.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="term-applicability">Term Applicability</Label>
        <Select 
          value={settings.termApplicability} 
          onValueChange={(value: TermApplicabilityType) => 
            onSettingsChange({ ...settings, termApplicability: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select term applicability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_terms">All Terms</SelectItem>
            <SelectItem value="specific_terms">Specific Terms</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {settings.termApplicability === 'specific_terms' && (
        <div>
          <Label>Select Applicable Terms</Label>
          <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2">
            {academicYears.map(year => (
              <div key={year.id} className="space-y-1">
                <div className="font-medium text-sm text-muted-foreground">{year.name}</div>
                {year.terms.map(term => (
                  <div key={term.id} className="flex items-center space-x-2 ml-4">
                    <Checkbox
                      id={`term-${term.id}`}
                      checked={settings.applicableTermIds?.includes(term.id) || false}
                      onCheckedChange={(checked) => {
                        const currentTermIds = settings.applicableTermIds || [];
                        const newTermIds = checked
                          ? [...currentTermIds, term.id]
                          : currentTermIds.filter(id => id !== term.id);
                        onSettingsChange({ ...settings, applicableTermIds: newTermIds });
                      }}
                    />
                    <Label htmlFor={`term-${term.id}`} className="text-sm">
                      {term.name}
                    </Label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <ModernDialog open={isOpen} onOpenChange={onClose}>
        <ModernDialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Manage Fee Assignments & Discounts
            </ModernDialogTitle>
            <ModernDialogDescription>
              Assign special fees and discounts to {pupil.firstName} {pupil.lastName} with time management and status control
            </ModernDialogDescription>
          </ModernDialogHeader>

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
                    const feeStructure = getFeeStructure(assignment.feeStructureId);
                    if (!feeStructure) return null;

                    return (
                      <Card key={assignment.id} className={assignment.status === 'disabled' ? 'opacity-60' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{feeStructure.name}</h4>
                                <Badge variant={feeStructure.category === 'Discount' ? 'secondary' : 'default'}>
                                  {feeStructure.category === 'Discount' ? 'Discount' : 'Assignment Fee'}
                                </Badge>
                                <Badge variant={assignment.status === 'active' ? 'default' : 'destructive'}>
                                  {assignment.status}
                                </Badge>
                                {feeStructure.category === 'Discount' && (
                                  <Badge variant="outline" className="text-xs">
                                    {feeStructure.amount < 0 
                                      ? `${formatCurrency(Math.abs(feeStructure.amount))} off`
                                      : `${feeStructure.amount}% off`
                                    }
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  <span>{getValidityDescription(assignment)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{getTermApplicabilityDescription(assignment)}</span>
                                </div>
                              </div>

                              {feeStructure.category === 'Discount' && feeStructure.linkedFeeId && (
                                <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                                  <span className="text-blue-700">
                                    Linked to: {allFeeStructures.find(f => f.id === feeStructure.linkedFeeId)?.name || 'Unknown Fee'}
                                  </span>
                                </div>
                              )}

                              {assignment.notes && (
                                <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                  <span className="text-gray-700">{assignment.notes}</span>
                                </div>
                              )}

                              {feeStructure.category !== 'Discount' && (
                                <div className="mt-2 text-lg font-semibold text-green-600">
                                  {formatCurrency(feeStructure.amount)}
                                </div>
                              )}

                              {/* Status History */}
                              {assignment.statusHistory && assignment.statusHistory.length > 0 && (
                                <Collapsible>
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto text-xs text-muted-foreground hover:text-foreground">
                                      <History className="h-3 w-3 mr-1" />
                                      View History ({assignment.statusHistory.length})
                                    </Button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-2">
                                    <div className="space-y-1 text-xs">
                                      {assignment.statusHistory
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map((entry, index) => (
                                          <div key={index} className="p-2 bg-muted/50 rounded text-xs">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="outline" className="text-xs">
                                                {entry.action}
                                              </Badge>
                                              <span>{new Date(entry.date).toLocaleDateString()}</span>
                                            </div>
                                            {entry.reason && (
                                              <div className="mt-1 text-muted-foreground">{entry.reason}</div>
                                            )}
                                            {entry.disableEffect && (
                                              <div className="mt-1 text-muted-foreground">
                                                Effect: {entry.disableEffect === 'from_next_term' ? 'From next term' : 'From current term'}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </div>
                            
                            <div className="flex flex-col gap-1 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTimeSettings(assignment.id)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              
                              {assignment.status === 'active' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDisableAssignment(assignment.id)}
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                >
                                  <PowerOff className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEnableAssignment(assignment.id)}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Power className="h-4 w-4" />
                                </Button>
                              )}
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveAssignment(assignment.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add New Assignment */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add New Assignment</h3>
                {!isAddingNew && (
                  <Button onClick={() => setIsAddingNew(true)} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Assignment
                  </Button>
                )}
              </div>

              {isAddingNew && (
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <Label htmlFor="fee-select">Select Fee or Discount</Label>
                      <Select value={selectedFeeId} onValueChange={setSelectedFeeId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a fee or discount to assign" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFees.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No available fees to assign
                            </SelectItem>
                          ) : (
                            availableFees.map((fee) => (
                              <SelectItem key={fee.id} value={fee.id}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{fee.name}</span>
                                  <div className="flex items-center gap-2 ml-4">
                                    <Badge variant={fee.category === 'Discount' ? 'secondary' : 'default'} className="text-xs">
                                      {fee.category === 'Discount' ? 'Discount' : 'Assignment'}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                      {fee.category === 'Discount' 
                                        ? (fee.amount < 0 
                                            ? `${formatCurrency(Math.abs(fee.amount))} off`
                                            : `${fee.amount}% off`
                                          )
                                        : formatCurrency(fee.amount)
                                      }
                                    </span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Time Management Section */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Time Management
                      </h4>
                      {renderTimeManagementForm(timeSettings, setTimeSettings)}
                    </div>

                    <div>
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value.toUpperCase())}
                        placeholder="Add any notes about this assignment..."
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleAddAssignment} disabled={!selectedFeeId}>
                        Add Assignment
                      </Button>
                      <Button variant="outline" onClick={() => setIsAddingNew(false)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <ModernDialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </ModernDialogFooter>
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
            {renderTimeManagementForm(editingTimeSettings, setEditingTimeSettings)}
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