"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Edit, Trash2, DollarSign, ChevronDown, ChevronRight, Power, MinusCircle, ArrowDownUp } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { FeeStructure, AcademicYear, Term, Class as SchoolClass, FeeStatus, FeeAdjustmentEntry, DisableHistoryEntry, DisableTypeOption, FeeAdjustmentType, FeeAdjustmentEffectivePeriodType } from "@/types";
import { initialSampleAcademicYears as importedSampleAcademicYears, sampleClasses } from "@/lib/sample-data";
import { formatCurrency } from "@/lib/utils";
import { useFeeStructures, useCreateFeeStructure, useUpdateFeeStructure, useDeleteFeeStructure, useFeeAdjustments, useCreateFeeAdjustment } from "@/lib/hooks/use-fees";
import { FeeStructuresService } from "@/lib/services/fee-structures.service";
import { useProgressiveDashboard } from "@/lib/hooks/use-progressive-dashboard";
import { useAcademicYears, useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";
import FeeStructureModal from "./components/fee-structure-modal";
import DiscountModal from "./components/discount-modal";
import FeeDisableModal from "./components/fee-disable-modal";
import FeeAdjustmentModal from "./components/fee-adjustment-modal";
import { format } from "date-fns";

type ActiveFilter = 'general' | 'assignment' | 'discounts';

export default function FeesManagementPage() {
  const { toast } = useToast();
  
  // Firebase hooks - temporarily using direct service call like collection page
  const { data: feeStructures = [], isLoading: isLoadingFees, error: feesError } = useQuery({
    queryKey: ['fee-structures-management'],
    queryFn: async () => {
      console.log('🎯 FEES MANAGEMENT - Fetching fee structures directly...');
      const allStructures = await FeeStructuresService.getAllFeeStructures();
      console.log('🎯 FEES MANAGEMENT - Got fee structures:', {
        total: allStructures.length,
        structures: allStructures.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          amount: s.amount,
          isAssignmentFee: s.isAssignmentFee,
          academicYearId: s.academicYearId,
          termId: s.termId,
          status: s.status
        }))
      });
      return allStructures;
    }
  });
  const { data: feeAdjustments = [], isLoading: isLoadingAdjustments, error: adjustmentsError } = useFeeAdjustments();
  const createFeeStructureMutation = useCreateFeeStructure();
  const updateFeeStructureMutation = useUpdateFeeStructure();
  const deleteFeeStructureMutation = useDeleteFeeStructure();
  const createFeeAdjustmentMutation = useCreateFeeAdjustment();
  
  // Dashboard hook for real classes data
  const { classes, classesLoading } = useProgressiveDashboard();
  
  // Academic years hooks for real academic year data
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  
  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  
  const [isFeeStructureModalOpen, setIsFeeStructureModalOpen] = React.useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = React.useState(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = React.useState(false); 
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = React.useState(false);
  const [editingFeeStructure, setEditingFeeStructure] = React.useState<FeeStructure | null>(null);
  const [selectedFeeForDisable, setSelectedFeeForDisable] = React.useState<FeeStructure | null>(null); 
  const [selectedFeeForAdjustment, setSelectedFeeForAdjustment] = React.useState<FeeStructure | null>(null);
  const [modalMode, setModalMode] = React.useState<'add' | 'edit'>('add');
  const [activeFilter, setActiveFilter] = React.useState<ActiveFilter>('general');
  const [collapsedTerms, setCollapsedTerms] = React.useState<Record<string, boolean>>({});

  // Use real academic years, fallback to sample data if none available
  const sampleAcademicYears = React.useMemo(() => importedSampleAcademicYears, []);
  const allAcademicYears = React.useMemo(() => 
    academicYears.length > 0 ? academicYears : sampleAcademicYears, 
    [academicYears, sampleAcademicYears]
  );

  const currentAcademicYear = React.useMemo(() => {
    // Always prefer the active academic year from Firebase hook
    if (activeAcademicYear) {
      console.log('🎯 Using active academic year from Firebase:', activeAcademicYear.name, {
        id: activeAcademicYear.id,
        isActive: activeAcademicYear.isActive,
        termsCount: activeAcademicYear.terms?.length || 0
      });
      return activeAcademicYear;
    }
    
    // Fallback to finding active year from the list (real data first)
    if (academicYears && academicYears.length > 0) {
      const activeFromList = academicYears.find(ay => ay.isActive && !ay.isLocked) || 
                            academicYears.find(ay => !ay.isLocked) || 
                            academicYears[0];
      if (activeFromList) {
        console.log('🎯 Using active academic year from list:', activeFromList.name);
        return activeFromList;
      }
    }
    
    // Final fallback to sample data
    if (sampleAcademicYears && sampleAcademicYears.length > 0) {
      const fallback = sampleAcademicYears.find(ay => ay.isActive && !ay.isLocked) || 
                     sampleAcademicYears.find(ay => !ay.isLocked) || 
                     sampleAcademicYears[0];
      console.log('⚠️ Using fallback academic year from sample data:', fallback?.name);
      return fallback;
    }
    
    console.log('❌ No academic year found');
    return undefined;
  }, [activeAcademicYear, academicYears, sampleAcademicYears]);

  const currentTerm = React.useMemo(() => {
    if (!currentAcademicYear || !currentAcademicYear.terms || currentAcademicYear.terms.length === 0) return undefined;
    
    // Determine current term based on actual dates
    const now = new Date();
    const currentTermByDate = currentAcademicYear.terms.find(term => {
      if (!term.startDate || !term.endDate) return false;
      const termStart = new Date(term.startDate);
      const termEnd = new Date(term.endDate);
      return now >= termStart && now <= termEnd;
    });
    
    // If we found a term by date, use it
    if (currentTermByDate) {
      console.log('📅 Current term determined by date:', currentTermByDate.name, {
        termStart: currentTermByDate.startDate,
        termEnd: currentTermByDate.endDate,
        now: now.toISOString()
      });
      return currentTermByDate;
    }
    
    // Fallback to isCurrent flag or first term
    const fallbackTerm = currentAcademicYear.terms.find(t => t.isCurrent) || currentAcademicYear.terms[0];
    console.log('📅 Current term determined by fallback:', fallbackTerm?.name);
    return fallbackTerm;
  }, [currentAcademicYear]);

  // Helper function to get term name for a fee item
  const getTermName = (feeItem: FeeStructure): string => {
    if (!feeItem.termId) return "No Term";
    
    // Find the academic year that contains this term
    const academicYear = allAcademicYears.find(year => 
      year.terms.some(term => term.id === feeItem.termId)
    );
    
    if (!academicYear) return "Unknown Term";
    
    // Find the specific term
    const term = academicYear.terms.find(term => term.id === feeItem.termId);
    return term ? `${term.name} (${academicYear.name})` : "Unknown Term";
  };

  const filteredFeeStructures = React.useMemo(() => {
    return feeStructures.filter(fee => {
      switch (activeFilter) {
        case 'general':
          return !fee.isAssignmentFee && fee.category !== 'Discount';
        case 'assignment':
          return fee.isAssignmentFee === true;
        case 'discounts':
          return fee.category === 'Discount';
        default:
          return true;
      }
    });
  }, [feeStructures, activeFilter]);

  const groupedFeesByTerm = React.useMemo(() => {
    if (!currentAcademicYear || activeFilter === 'assignment' || activeFilter === 'discounts') return []; 

        // Group all available fees into terms
    // If there are no term-specific assignments, show all fees under current term
    const groups: Record<string, { term: Term | undefined, fees: FeeStructure[] }> = {};
    
    // First, try to group fees by their assigned terms
    const feesWithTerms = filteredFeeStructures.filter(fs => fs.termId);
    const feesWithoutTerms = filteredFeeStructures.filter(fs => !fs.termId);

    // Show ALL terms, regardless of whether they have fees
    currentAcademicYear.terms.forEach(term => {
      const termFees = feesWithTerms.filter(fs => fs.termId === term.id);
      
      // Always add the term, even if it has no fees
      groups[term.id] = {
        term,
        fees: termFees.sort((a, b) => a.name.localeCompare(b.name))
      };
    });

    // If we have fees without term assignments or no term-grouped fees, 
    // assign them to the current term (or first term if no current term)
    if (feesWithoutTerms.length > 0 || Object.keys(groups).length === 0) {
      const targetTerm = currentTerm || currentAcademicYear.terms[0];
      
      if (targetTerm) {
        if (!groups[targetTerm.id]) {
          groups[targetTerm.id] = { term: targetTerm, fees: [] };
        }
        
        // Add unassigned fees to this term
        const feesToAdd = feesWithoutTerms.length > 0 ? feesWithoutTerms : filteredFeeStructures;
        groups[targetTerm.id].fees = [
          ...groups[targetTerm.id].fees,
          ...feesToAdd
        ].sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    // Ensure we have at least one term group if we have fees
    if (Object.keys(groups).length === 0 && filteredFeeStructures.length > 0) {
      const firstTerm = currentAcademicYear.terms[0];
      if (firstTerm) {
        groups[firstTerm.id] = {
          term: firstTerm,
          fees: filteredFeeStructures.sort((a, b) => a.name.localeCompare(b.name))
        };
      }
    }
    
    const result = Object.values(groups).sort((a, b) => {
        if (!a.term || !b.term) return 0;
        const termAOrder = parseInt(a.term.name.replace(/[^0-9]/g, '') || '99');
        const termBOrder = parseInt(b.term.name.replace(/[^0-9]/g, '') || '99');
        return termAOrder - termBOrder;
    });

    return result;
  }, [filteredFeeStructures, currentAcademicYear, activeFilter, currentTerm]);

  const calculateCurrentFeeAmount = React.useCallback((baseAmount: number, feeId: string, targetAcademicYearId: string | undefined, allAdjustments: FeeAdjustmentEntry[]): number => {
    if (!targetAcademicYearId) return baseAmount;

    const targetYearObj = allAcademicYears.find(ay => ay.id === targetAcademicYearId);
    if (!targetYearObj) return baseAmount;
    const targetYearNum = parseInt(targetYearObj.name);

    const relevantAdjustments = allAdjustments.filter(adj => {
        if (adj.feeStructureId !== feeId) return false;

        const startYearObj = allAcademicYears.find(ay => ay.id === adj.startYearId);
        if (!startYearObj) return false;
        const startYearNum = parseInt(startYearObj.name);

        if (adj.effectivePeriodType === 'specific_year') {
            return targetAcademicYearId === adj.startYearId;
        }
        if (adj.effectivePeriodType === 'from_year_onwards') {
            return targetYearNum >= startYearNum;
        }
        if (adj.effectivePeriodType === 'year_range' && adj.endYearId) {
            const endYearObj = allAcademicYears.find(ay => ay.id === adj.endYearId);
            if (!endYearObj) return false;
            const endYearNum = parseInt(endYearObj.name);
            return targetYearNum >= startYearNum && targetYearNum <= endYearNum;
        }
        return false;
    });

    let currentAmount = baseAmount;
    relevantAdjustments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const adj of relevantAdjustments) {
        if (adj.adjustmentType === 'increase') {
            currentAmount += adj.amount;
        } else if (adj.adjustmentType === 'decrease') {
            currentAmount -= adj.amount;
        }
    }
    return currentAmount;
  }, [allAcademicYears]);

  React.useEffect(() => {
    const initialCollapsedState: Record<string, boolean> = {};
    if (currentAcademicYear && currentTerm && (activeFilter === 'general')) {
      currentAcademicYear.terms.forEach(term => {
        initialCollapsedState[term.id] = term.id !== currentTerm.id;
      });
    }
    setCollapsedTerms(initialCollapsedState);
  }, [currentAcademicYear, currentTerm, activeFilter]);

  // Show loading state while Firebase data is loading
  if (isLoadingFees || isLoadingAdjustments || classesLoading || academicYearsLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Loading Fees Management..." />
        <div className="text-center text-muted-foreground">Loading fees data...</div>
      </div>
    );
  }

  // Show offline notice if there are connectivity errors
  if (feesError || adjustmentsError) {
    const isOfflineError = feesError?.message?.includes('offline') || adjustmentsError?.message?.includes('offline');
    
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Fees Management" />
        <div className="text-center space-y-4">
          <div className="text-muted-foreground">
            {isOfflineError ? (
              <>
                <p>🔌 You're currently offline</p>
                <p className="text-sm">Firebase data is not available. Please check your internet connection.</p>
              </>
            ) : (
              <>
                <p>⚠️ Unable to load fees data</p>
                <p className="text-sm">There was an error connecting to the database. Please try again later.</p>
              </>
            )}
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const toggleTermCollapse = (termId: string) => {
    setCollapsedTerms(prev => ({ ...prev, [termId]: !prev[termId] }));
  };

  const handleOpenAddFeeStructureModal = (isAssignment = false) => {
    setModalMode('add');
    setEditingFeeStructure(null);
    setIsFeeStructureModalOpen(true); 
  };

  const handleOpenAddDiscountModal = () => {
    setModalMode('add');
    setEditingFeeStructure(null); 
    setIsDiscountModalOpen(true);
  };

  const handleOpenEditModal = (fee: FeeStructure) => {
    setModalMode('edit');
    setEditingFeeStructure(fee);
    if (fee.category === 'Discount') {
      setIsDiscountModalOpen(true);
    } else {
      setIsFeeStructureModalOpen(true);
    }
  };

  const handleDeleteFeeStructure = async (feeId: string) => {
    const feeToDelete = feeStructures.find(f => f.id === feeId);
    if (window.confirm(`Are you sure you want to delete "${feeToDelete?.name || 'this fee item'}"? This action cannot be undone.`)) {
      try {
        await deleteFeeStructureMutation.mutateAsync(feeId);
        toast({ title: "Fee Item Deleted", description: `"${feeToDelete?.name}" has been removed.` });
      } catch (error) {
        console.error('Error deleting fee structure:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete fee structure. Please try again." 
        });
      }
    }
  };

  const handleOpenDisableModal = (fee: FeeStructure) => {
    setSelectedFeeForDisable(fee);
    setIsDisableModalOpen(true);
  };
  
  const handleEnableFee = async (feeId: string) => {
    const feeToEnable = feeStructures.find(f => f.id === feeId);
    if (!feeToEnable) return;

    const updatedData = {
      status: 'active' as FeeStatus,
      disableHistory: [
        ...(feeToEnable.disableHistory || []),
        {
          date: new Date().toISOString(),
          reason: 'Fee re-enabled by user.',
          disabledBy: 'System Admin',
          disableType: 'immediate_indefinite' as DisableTypeOption,
        },
      ],
    };
    
    try {
      await updateFeeStructureMutation.mutateAsync({ id: feeId, data: updatedData });
      toast({ title: "Fee Enabled", description: `"${feeToEnable.name}" has been enabled.` });
    } catch (error) {
      console.error('Error enabling fee structure:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to enable fee structure. Please try again." 
      });
    }
  };

  const handleDisableSubmit = async (
    feeId: string, 
    reason: string, 
    effectiveDate: string,
    disableType: DisableTypeOption,
    startYearId?: string,
    endYearId?: string
  ) => {
    const feeToDisable = feeStructures.find(f => f.id === feeId);
    if (!feeToDisable) return;

    const newHistoryEntry: DisableHistoryEntry = {
      date: effectiveDate, 
      reason: reason,
      disabledBy: 'System Admin', 
      disableType,
      startYearId,
      endYearId,
    };

    const updatedData = {
      status: 'disabled' as FeeStatus,
      disableHistory: [
        ...(feeToDisable.disableHistory || []),
        newHistoryEntry,
      ],
    };
    
    try {
      await updateFeeStructureMutation.mutateAsync({ id: feeId, data: updatedData });
      toast({ title: "Fee Disabled", description: `"${feeToDisable.name}" has been disabled. Reason: ${reason}` });
      setIsDisableModalOpen(false);
      setSelectedFeeForDisable(null);
    } catch (error) {
      console.error('Error disabling fee structure:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to disable fee structure. Please try again." 
      });
    }
  };

  const handleSubmitFeeStructure = async (data: Omit<FeeStructure, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'disableHistory' | 'description' | 'linkedFeeId' >) => {
    const finalData = {
        ...data,
        amount: Number(data.amount) || 0,
        academicYearId: data.isAssignmentFee ? undefined : data.academicYearId,
        termId: data.isAssignmentFee ? undefined : data.termId,
        classFeeType: data.isAssignmentFee ? 'all' : data.classFeeType,
        classIds: (data.isAssignmentFee || data.classFeeType === 'all' || !data.classFeeType) ? undefined : data.classIds,
        sectionFeeType: data.isAssignmentFee ? 'all' : data.sectionFeeType,
        section: (data.isAssignmentFee || data.sectionFeeType === 'all' || !data.sectionFeeType) ? undefined : data.section,
        isRequired: data.isAssignmentFee ? true : data.isRequired,
        isRecurring: data.isAssignmentFee ? false : data.isRecurring,
        frequency: data.isAssignmentFee ? undefined : (data.isRecurring ? data.frequency : undefined),
    };

    try {
      if (modalMode === 'add') {
        const newFeeData = {
          ...finalData,
          description: undefined, 
          linkedFeeId: undefined,
          status: 'active' as FeeStatus,
          disableHistory: [],
        };
        await createFeeStructureMutation.mutateAsync(newFeeData);
        toast({ title: "Fee Item Created", description: `"${finalData.name}" has been added.` });
      } else if (editingFeeStructure) {
        const updateData = {
          ...finalData,
          description: editingFeeStructure.description, 
          linkedFeeId: editingFeeStructure.linkedFeeId,
        };
        await updateFeeStructureMutation.mutateAsync({ id: editingFeeStructure.id, data: updateData });
        toast({ title: "Fee Item Updated", description: `"${finalData.name}" has been updated.` });
      }
      setIsFeeStructureModalOpen(false);
    } catch (error) {
      console.error('Error saving fee structure:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to save fee structure. Please try again." 
      });
    }
  };

  const handleSubmitDiscount = async (data: {
    name: string;
    amount: number; 
    description?: string;
    linkedFeeId?: string;
  }) => {
     const newDiscountData = {
      name: data.name,
      amount: -Math.abs(Number(data.amount) || 0), 
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
      status: "active" as FeeStatus,
      linkedFeeId: data.linkedFeeId === "NONE_LINKED" ? undefined : data.linkedFeeId,
      disableHistory: [],
      isAssignmentFee: false, 
      description: data.description,
    };
    
    try {
      await createFeeStructureMutation.mutateAsync(newDiscountData);
      toast({ title: "Discount Created", description: `Discount "${data.name}" has been added.` });
      setIsDiscountModalOpen(false);
    } catch (error) {
      console.error('Error creating discount:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to create discount. Please try again." 
      });
    }
  }

  const handleOpenAdjustmentModal = (fee: FeeStructure) => {
    setSelectedFeeForAdjustment(fee);
    setIsAdjustmentModalOpen(true);
  };

  const handleAdjustmentSubmit = async (data: {
    adjustmentType: FeeAdjustmentType;
    amount: number;
    effectivePeriodType: FeeAdjustmentEffectivePeriodType;
    startYearId: string;
    endYearId?: string;
    reason?: string;
  }) => {
    if (!selectedFeeForAdjustment) return;

    const newAdjustmentData = {
      feeStructureId: selectedFeeForAdjustment.id,
      adjustmentType: data.adjustmentType,
      amount: data.amount,
      effectivePeriodType: data.effectivePeriodType,
      startYearId: data.startYearId,
      endYearId: data.endYearId,
      reason: data.reason,
      adjustedBy: "System Admin", // Placeholder
    };

    try {
      await createFeeAdjustmentMutation.mutateAsync(newAdjustmentData);
      toast({ title: "Fee Adjustment Saved", description: `Adjustment for "${selectedFeeForAdjustment.name}" has been recorded.` });
      setIsAdjustmentModalOpen(false);
      setSelectedFeeForAdjustment(null);
    } catch (error) {
      console.error('Error creating fee adjustment:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to create fee adjustment. Please try again." 
      });
    }
  };

  const renderAdjustmentHistory = (feeId: string) => {
    const relatedAdjustments = feeAdjustments
      .filter(adj => adj.feeStructureId === feeId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (relatedAdjustments.length === 0) {
      return null;
    }

    return (
      <div className="mt-1 space-y-0.5">
        {relatedAdjustments.map(adj => (
          <Badge
            key={adj.id}
            variant={adj.adjustmentType === 'increase' ? 'default' : 'destructive'}
            className="text-xs font-normal mr-1 mb-1"
          >
            {adj.adjustmentType === 'increase' ? '+' : '-'}{formatCurrency(adj.amount)}
            <span className="ml-1 text-muted-foreground/80 text-[0.65rem]">
              ({format(new Date(adj.createdAt), 'dd/MM/yy')})
            </span>
          </Badge>
        ))}
      </div>
    );
  };

  const mainActionText = activeFilter === 'discounts' ? 'Create Discount' : 
                         activeFilter === 'assignment' ? 'Add Assignment Fee' : 'Add General Fee';
  
  const handleMainActionClick = () => {
    if (activeFilter === 'discounts') {
      handleOpenAddDiscountModal();
    } else {
      handleOpenAddFeeStructureModal(activeFilter === 'assignment');
    }
  };

  const getTargetClassesDisplay = (fee: FeeStructure) => {
    if (fee.isAssignmentFee || fee.classFeeType === 'all' || !fee.classFeeType) return 'All Classes';
    if (!fee.classIds || fee.classIds.length === 0) return 'N/A';
    if (fee.classIds.length === 1) return classes?.find(c => c.id === fee.classIds![0])?.name || 'Unknown Class';
    return `${fee.classIds.length} Classes`;
  };
  
  const getTargetSectionDisplay = (fee: FeeStructure) => {
    if (fee.isAssignmentFee || fee.sectionFeeType === 'all' || !fee.sectionFeeType) return 'All Sections';
    return fee.section || 'N/A';
  }

  const termDisplayName = (termId?: string, academicYearId?: string) => {
    if (!academicYearId || !termId) return 'N/A';
    const year = allAcademicYears.find(ay => ay.id === academicYearId);
    if (!year) return 'N/A';
    return year.terms.find(t => t.id === termId)?.name || termId || 'N/A';
  }

  const renderDisableInfo = (fee: FeeStructure) => {
    if (fee.status === 'disabled' && fee.disableHistory && fee.disableHistory.length > 0) {
      const latestDisable = fee.disableHistory[fee.disableHistory.length - 1];
      let info = `Disabled: ${new Date(latestDisable.date).toLocaleDateString()}`;
      
      if (latestDisable.disableType === 'from_year_onwards' && latestDisable.startYearId) {
        const yearName = allAcademicYears.find(ay => ay.id === latestDisable.startYearId)?.name || latestDisable.startYearId;
        info += ` (from ${yearName} onwards)`;
      } else if (latestDisable.disableType === 'year_range' && latestDisable.startYearId && latestDisable.endYearId) {
        const startYearName = allAcademicYears.find(ay => ay.id === latestDisable.startYearId)?.name || latestDisable.startYearId;
        const endYearName = allAcademicYears.find(ay => ay.id === latestDisable.endYearId)?.name || latestDisable.endYearId;
        info += ` (for ${startYearName} - ${endYearName})`;
      } else if (latestDisable.disableType === 'immediate_indefinite'){
        info += ` (indefinitely)`;
      }
      return <div className="text-xs text-red-500 mt-1">{info}</div>;
    }
    return null;
  };
  
  const renderTableForDiscounts = () => (
     <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Discount Name</TableHead>
                <TableHead>Discount Amount</TableHead>
                <TableHead>Linked Fee Item</TableHead>
                <TableHead>New Amount After Discount</TableHead>
                <TableHead>Reason/Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {filteredFeeStructures.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                        No discounts found.
                    </TableCell>
                </TableRow>
            ) : (
                filteredFeeStructures.map((fee) => {
                    const linkedFee = fee.linkedFeeId ? feeStructures.find(f => f.id === fee.linkedFeeId) : null;
                    const currentLinkedFeeAmount = linkedFee ? calculateCurrentFeeAmount(linkedFee.amount, linkedFee.id, currentAcademicYear?.id, feeAdjustments) : 0;
                    const newAmountAfterDiscount = linkedFee ? currentLinkedFeeAmount - Math.abs(fee.amount) : 0;
                    return (
                        <TableRow key={fee.id}>
                            <TableCell className="font-medium">
                                {fee.name}
                                {renderDisableInfo(fee)}
                            </TableCell>
                            <TableCell className="text-destructive font-semibold">
                                {formatCurrency(Math.abs(fee.amount))}
                            </TableCell>
                            <TableCell>
                                {linkedFee ? (
                                    <div className="space-y-1">
                                        <div className="font-medium">{linkedFee.name}</div>
                                        <div className="text-xs text-muted-foreground">{formatCurrency(currentLinkedFeeAmount)}</div>
                                        <div className="text-xs text-blue-600 font-medium">{getTermName(linkedFee)}</div>
                                    </div>
                                ) : 'N/A'}
                            </TableCell>
                            <TableCell>
                                {linkedFee ? formatCurrency(newAmountAfterDiscount) : 'N/A'}
                            </TableCell>
                            <TableCell>{fee.description || '-'}</TableCell>
                            <TableCell>
                                <Badge variant={fee.status === 'active' ? 'default' : 'outline'}>
                                    {fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <DollarSign className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => handleOpenEditModal(fee)}>
                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                        </DropdownMenuItem>
                                        {fee.status === 'active' ? (
                                            <DropdownMenuItem onClick={() => handleOpenDisableModal(fee)}>
                                                <Power className="mr-2 h-4 w-4 text-orange-500" /> Disable Discount
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem onClick={() => handleEnableFee(fee.id)}>
                                                <PlusCircle className="mr-2 h-4 w-4 text-green-500" /> Enable Discount
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() => handleDeleteFeeStructure(fee.id)}
                                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    );
                })
            )}
        </TableBody>
    </Table>
  );

  const renderTableForAssignmentFees = () => (
     <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {filteredFeeStructures.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                        No assignment fees found.
                    </TableCell>
                </TableRow>
            ) : (
                filteredFeeStructures.map((fee) => (
                    <TableRow key={fee.id}>
                        <TableCell className="font-medium">
                            <div>{fee.name}</div>
                            {renderDisableInfo(fee)}
                            {renderAdjustmentHistory(fee.id)}
                        </TableCell>
                        <TableCell>
                           {formatCurrency(calculateCurrentFeeAmount(fee.amount, fee.id, currentAcademicYear?.id, feeAdjustments))}
                        </TableCell>
                        <TableCell><Badge variant="secondary">{fee.category}</Badge></TableCell>
                        <TableCell>
                            <Badge variant={fee.status === 'active' ? 'default' : 'outline'}>
                                {fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                        <DollarSign className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => handleOpenEditModal(fee)}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                     <DropdownMenuItem onClick={() => handleOpenAdjustmentModal(fee)}>
                                        <ArrowDownUp className="mr-2 h-4 w-4" /> Adjust Fee
                                    </DropdownMenuItem>
                                    {fee.status === 'active' ? (
                                        <DropdownMenuItem onClick={() => handleOpenDisableModal(fee)}>
                                            <Power className="mr-2 h-4 w-4 text-orange-500" /> Disable Fee
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onClick={() => handleEnableFee(fee.id)}>
                                            <PlusCircle className="mr-2 h-4 w-4 text-green-500" /> Enable Fee
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => handleDeleteFeeStructure(fee.id)}
                                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))
            )}
        </TableBody>
    </Table>
  );

  const renderTableForGeneralFees = () => (
    groupedFeesByTerm.map(({ term, fees: feesInTerm }) => {
      if (!term) return null; 
      
      const shouldRenderTermSection = feesInTerm.length > 0 || 
                                      (activeFilter === 'general' && !term.isCurrent && !collapsedTerms[term.id]) ||
                                      (activeFilter === 'general' && term.isCurrent && !collapsedTerms[term.id]);

      if (!shouldRenderTermSection && (activeFilter !== 'general')) return null;

      return (
        <div key={term.id} className="mb-6">
          <Button
            variant="ghost"
            onClick={() => toggleTermCollapse(term.id)}
            className="w-full justify-start text-lg font-semibold mb-2 px-2 py-1 hover:bg-muted/50"
          >
            {collapsedTerms[term.id] ? <ChevronRight className="mr-2 h-5 w-5" /> : <ChevronDown className="mr-2 h-5 w-5" />}
            {term.name} ({feesInTerm.length}) {term.isCurrent && <Badge className="ml-2">Current</Badge>}
          </Button>
          {!collapsedTerms[term.id] && (
            <div className="rounded-lg border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Class Target</TableHead>
                    <TableHead>Section Target</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feesInTerm.length === 0 ? (
                      <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                              No {activeFilter} fees found for {term.name}.
                          </TableCell>
                      </TableRow>
                  ) : (
                      feesInTerm.map((fee) => (
                      <TableRow key={fee.id}>
                          <TableCell className="font-medium">
                            <div>{fee.name}</div>
                            {renderDisableInfo(fee)}
                            {renderAdjustmentHistory(fee.id)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(calculateCurrentFeeAmount(fee.amount, fee.id, fee.academicYearId, feeAdjustments))}
                          </TableCell>
                          <TableCell><Badge variant="secondary">{fee.category}</Badge></TableCell>
                          <TableCell>{getTargetClassesDisplay(fee)}</TableCell>
                          <TableCell>{getTargetSectionDisplay(fee)}</TableCell>
                          <TableCell><Badge variant={fee.isRequired ? "outline" : "secondary"}>{fee.isRequired ? "Yes" : "No"}</Badge></TableCell>
                          <TableCell>
                          <Badge variant={fee.status === 'active' ? 'default' : 'outline'}>
                              {fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
                          </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <DollarSign className="h-4 w-4" />
                              </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleOpenEditModal(fee)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenAdjustmentModal(fee)}>
                                <ArrowDownUp className="mr-2 h-4 w-4" /> Adjust Fee
                              </DropdownMenuItem>
                              {fee.status === 'active' ? (
                                <DropdownMenuItem onClick={() => handleOpenDisableModal(fee)}>
                                  <Power className="mr-2 h-4 w-4 text-orange-500" /> Disable Fee
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleEnableFee(fee.id)}>
                                  <PlusCircle className="mr-2 h-4 w-4 text-green-500" /> Enable Fee
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                  onClick={() => handleDeleteFeeStructure(fee.id)}
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                          </TableCell>
                      </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      );
    })
  );

  return (
    <>
      <PageHeader
        title="Fees Management"
        description={`Manage ${currentAcademicYear?.name || "current academic year"} fees.`}
        actions={
          <Button onClick={handleMainActionClick}>
            <PlusCircle className="mr-2 h-4 w-4" /> {mainActionText}
          </Button>
        }
      />
      
      {/* Show recess status banner if in recess mode */}
      <RecessStatusBanner />

      <div className="mb-4 flex space-x-2">
        {(['general', 'assignment', 'discounts'] as ActiveFilter[]).map(filter => (
          <Button
            key={filter}
            variant={activeFilter === filter ? 'default' : 'outline'}
            onClick={() => setActiveFilter(filter)}
            className="capitalize"
          >
            {filter.replace('-', ' ')} Fees
          </Button>
        ))}
      </div>



      {activeFilter === 'assignment' ? (
          <div className="rounded-lg border shadow-sm mt-4">
             {renderTableForAssignmentFees()}
          </div>
       ) : activeFilter === 'discounts' ? (
          <div className="rounded-lg border shadow-sm mt-4">
            {renderTableForDiscounts()}
          </div>
       ) : 
        renderTableForGeneralFees()
      }
      {(activeFilter === 'general' && groupedFeesByTerm.length === 0 && filteredFeeStructures.length > 0) && (
         <p className="text-center text-muted-foreground mt-6">
            No {activeFilter} fees found for the current academic year terms.
        </p>
      )}
       {filteredFeeStructures.length === 0 && (
         <p className="text-center text-muted-foreground mt-6">
            No fee items defined yet. Click the button above to start.
        </p>
      )}

      {isFeeStructureModalOpen && currentAcademicYear && (
        <FeeStructureModal
          isOpen={isFeeStructureModalOpen}
          onClose={() => setIsFeeStructureModalOpen(false)}
          onSubmit={handleSubmitFeeStructure}
          initialData={editingFeeStructure}
          mode={modalMode}
          academicYears={allAcademicYears.filter(ay => !ay.isLocked)}
          allClasses={classes || []}
          currentAcademicYearId={currentAcademicYear?.id}
          currentTermId={currentTerm?.id}
          isAssignmentFeeDefault={activeFilter === 'assignment'}
        />
      )}
      {isDiscountModalOpen && currentAcademicYear && (
        <DiscountModal
          isOpen={isDiscountModalOpen}
          onClose={() => setIsDiscountModalOpen(false)}
          onSubmit={handleSubmitDiscount}
          feeItems={feeStructures.filter(f => f.category !== 'Discount' && f.status === 'active' && f.amount >= 0)} 
          initialData={editingFeeStructure?.category === 'Discount' ? editingFeeStructure : null} 
          mode={editingFeeStructure?.category === 'Discount' ? 'edit' : 'add'}
        />
      )}
      {isDisableModalOpen && selectedFeeForDisable && (
        <FeeDisableModal
            isOpen={isDisableModalOpen}
            onClose={() => {setIsDisableModalOpen(false); setSelectedFeeForDisable(null);}}
            onSubmit={handleDisableSubmit}
            feeToDisable={selectedFeeForDisable}
            academicYears={allAcademicYears.filter(ay => !ay.isLocked)} 
        />
      )}
      {isAdjustmentModalOpen && selectedFeeForAdjustment && (
        <FeeAdjustmentModal
          isOpen={isAdjustmentModalOpen}
          onClose={() => { setIsAdjustmentModalOpen(false); setSelectedFeeForAdjustment(null); }}
          onSubmit={handleAdjustmentSubmit}
          feeToAdjust={selectedFeeForAdjustment}
          academicYears={allAcademicYears.filter(ay => !ay.isLocked)}
        />
      )}
    </>
  );
}
