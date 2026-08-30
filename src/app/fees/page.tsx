"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle, Edit, Trash2, DollarSign, ChevronDown, ChevronRight, Power, MinusCircle, ArrowDownUp, Calendar, Loader2, Plus, Filter } from "lucide-react";
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";
import { cn } from "@/lib/utils";
import { GlassPageRouteSkeleton } from "@/components/common/glass-page-loading";
import { UniformManagement } from "./components/uniform-management";
import { RequirementManagement } from "./components/requirement-management";
import { useUniforms } from "@/lib/hooks/use-uniforms";
import { useRequirements } from "@/lib/hooks/use-requirements";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { FeeStructure, AcademicYear, Term, Class as SchoolClass, FeeStatus, FeeAdjustmentEntry, DisableHistoryEntry, DisableTypeOption, FeeAdjustmentType, FeeAdjustmentEffectivePeriodType } from "@/types";
import { initialSampleAcademicYears as importedSampleAcademicYears, sampleClasses } from "@/lib/sample-data";
import { formatCurrency } from "@/lib/utils";
import { useFeeStructures, useCreateFeeStructure, useUpdateFeeStructure, useDeleteFeeStructure, useFeeAdjustments, useCreateFeeAdjustment } from "@/lib/hooks/use-fees";
import { FeeStructuresService } from "@/lib/services/fee-structures.service";
import { useProgressiveDashboard } from "@/lib/hooks/use-progressive-dashboard";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { detectCurrentAcademicYear, detectCurrentTerm } from "@/lib/utils/academic-year-utils";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { isFeeApplicableInYear, getApplicableYearIdsAfterDisable } from "@/lib/utils/fee-applicability";
import { calculateFeeAmountForAcademicYear } from "@/lib/utils/fee-adjustments";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";
import FeeStructureModal from "./components/fee-structure-modal";
import DiscountModal from "./components/discount-modal";
import FeeDisableModal from "./components/fee-disable-modal";
import FeeAdjustmentModal from "./components/fee-adjustment-modal";
import FeeYearApplicabilityModal from "./components/fee-year-applicability-modal";
import { format } from "date-fns";

type ActiveFilter = 'general' | 'assignment' | 'discounts';

export function FeesManagementPageContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  // The Academic Years page derives the current context from term dates.
  // Use that same source so a stale stored isActive flag cannot select 2025.
  const activeAcademicYear = effectiveTerm.academicYear;

  const [isFeeStructureModalOpen, setIsFeeStructureModalOpen] = React.useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = React.useState(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = React.useState(false);
  const [isYearApplicabilityModalOpen, setIsYearApplicabilityModalOpen] = React.useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = React.useState(false);
  const [editingFeeStructure, setEditingFeeStructure] = React.useState<FeeStructure | null>(null);
  const [selectedFeeForDisable, setSelectedFeeForDisable] = React.useState<FeeStructure | null>(null);
  const [selectedFeeForApplicability, setSelectedFeeForApplicability] = React.useState<FeeStructure | null>(null);
  const [selectedFeeForAdjustment, setSelectedFeeForAdjustment] = React.useState<FeeStructure | null>(null);

  // Tab and routing state
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSettingTab = (searchParams.get('tab') as 'fees' | 'uniforms' | 'requirements') || 'fees';

  const handleTabChange = (newTab: 'fees' | 'uniforms' | 'requirements') => {
    router.push(`/fees?tab=${newTab}`);
  };

  // Uniform/Requirements hooks and stats
  const { data: uniforms = [] } = useUniforms();
  const uniqueUniformGroups = Array.from(new Set(uniforms.map(u => u.group).filter(Boolean))).sort();
  const totalUniforms = uniforms.length;
  const activeUniforms = uniforms.filter(u => u.isActive).length;
  const averageUniformPrice = totalUniforms > 0 ? uniforms.reduce((sum, u) => sum + (u.price || 0), 0) / totalUniforms : 0;

  const { data: requirements = [] } = useRequirements();
  const uniqueRequirementGroups = Array.from(new Set(requirements.map(r => r.group).filter(Boolean))).sort();
  const totalRequirements = requirements.length;
  const activeRequirements = requirements.filter(r => r.isActive).length;
  const totalRequirementsValue = requirements.reduce((sum, r) => sum + (r.price || 0), 0);

  // States
  const [showUniformFilters, setShowUniformFilters] = React.useState(false);
  const [uniformAddTrigger, setUniformAddTrigger] = React.useState(0);
  const [showRequirementFilters, setShowRequirementFilters] = React.useState(false);
  const [requirementAddTrigger, setRequirementAddTrigger] = React.useState(0);

  const totalFeesCount = feeStructures.length;
  const activeFeesCount = feeStructures.filter(f => f.status === 'active').length;
  const discountsCount = feeStructures.filter(f => f.category === 'Discount').length;
  const [modalMode, setModalMode] = React.useState<'add' | 'edit'>('add');
  const [activeFilter, setActiveFilter] = React.useState<ActiveFilter>('general');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = React.useState<string | null>(null);
  const [hasUserSelectedAcademicYear, setHasUserSelectedAcademicYear] = React.useState(false);
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
      const activeFromList = detectCurrentAcademicYear(academicYears) || academicYears[0];
      if (activeFromList) {
        console.log('🎯 Using active academic year from list:', activeFromList.name);
        return activeFromList;
      }
    }

    // Final fallback to sample data
    if (sampleAcademicYears && sampleAcademicYears.length > 0) {
      const fallback = detectCurrentAcademicYear(sampleAcademicYears.filter(ay => !ay.isLocked)) ||
        sampleAcademicYears.find(ay => !ay.isLocked) ||
        sampleAcademicYears[0];
      console.log('⚠️ Using fallback academic year from sample data:', fallback?.name);
      return fallback;
    }

    console.log('❌ No academic year found');
    return undefined;
  }, [activeAcademicYear, academicYears, sampleAcademicYears]);

  // Initialize selected academic year to current academic year
  React.useEffect(() => {
    if (currentAcademicYear) {
      // If no year is selected, or the selected year doesn't exist in available years, default to current
      const selectedYearExists = selectedAcademicYearId
        ? allAcademicYears.some(ay => ay.id === selectedAcademicYearId)
        : false;

      if ((!hasUserSelectedAcademicYear && selectedAcademicYearId !== currentAcademicYear.id) || !selectedYearExists) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 Initializing selected academic year to current:', currentAcademicYear.name, {
            reason: !selectedYearExists ? 'invalid selection' : 'current academic context resolved'
          });
        }
        setSelectedAcademicYearId(currentAcademicYear.id);
      }
    }
  }, [currentAcademicYear, selectedAcademicYearId, allAcademicYears, hasUserSelectedAcademicYear]);

  // Log when selected academic year changes
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development' && selectedAcademicYearId) {
      const selectedYear = allAcademicYears.find(ay => ay.id === selectedAcademicYearId);
      console.log('🎯 Selected academic year changed:', {
        selectedAcademicYearId,
        selectedYearName: selectedYear?.name || 'Not found',
        totalFees: feeStructures.length
      });
    }
  }, [selectedAcademicYearId, allAcademicYears, feeStructures.length]);

  // Compute available academic years (ALL years, sorted chronologically)
  const availableAcademicYears = React.useMemo(() => {
    // Show ALL academic years, sorted chronologically (oldest first)
    return [...allAcademicYears].sort((a, b) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return dateA - dateB;
    });
  }, [allAcademicYears]);

  // Get the selected academic year object
  const selectedAcademicYear = React.useMemo(() => {
    if (!selectedAcademicYearId) return currentAcademicYear;
    return allAcademicYears.find(year => year.id === selectedAcademicYearId) || currentAcademicYear;
  }, [selectedAcademicYearId, allAcademicYears, currentAcademicYear]);

  const currentTerm = React.useMemo(() => {
    if (!currentAcademicYear || !currentAcademicYear.terms || currentAcademicYear.terms.length === 0) return undefined;

    if (effectiveTerm.academicYear?.id === currentAcademicYear.id && effectiveTerm.term) {
      return effectiveTerm.term;
    }

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
    const fallbackTerm = detectCurrentTerm(currentAcademicYear) || currentAcademicYear.terms[0];
    console.log('📅 Current term determined by fallback:', fallbackTerm?.name);
    return fallbackTerm;
  }, [currentAcademicYear, effectiveTerm]);

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
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Filtering fees:', {
        totalFees: feeStructures.length,
        selectedAcademicYearId,
        activeFilter,
        allAcademicYearsCount: allAcademicYears.length
      });
    }

    const filtered = feeStructures.filter(fee => {
      // First filter by active filter type
      let matchesFilter = false;
      switch (activeFilter) {
        case 'general':
          matchesFilter = !fee.isAssignmentFee && fee.category !== 'Discount';
          break;
        case 'assignment':
          matchesFilter = fee.isAssignmentFee === true;
          break;
        case 'discounts':
          matchesFilter = fee.category === 'Discount';
          break;
        default:
          matchesFilter = true;
      }

      if (!matchesFilter) return false;

      // Then filter by selected academic year
      // Assignment fees and discounts don't have academic year context
      if (fee.isAssignmentFee || fee.category === 'Discount') {
        return true;
      }

      // For general fees, check if this fee applies to the selected year
      if (!selectedAcademicYearId) {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Fee included (no year selected):', fee.name);
        }
        return true;
      }

      const selectedYear = allAcademicYears.find(ay => ay.id === selectedAcademicYearId);
      if (!selectedYear) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Selected year not found:', selectedAcademicYearId);
        }
        return false;
      }

      // If fee has no academic context, show it for all years
      if (!fee.academicYearId && !isFeeApplicableInYear(fee, selectedAcademicYearId, allAcademicYears)) {
        return false;
      }
      if (!fee.academicYearId) {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Fee included (no academic context):', fee.name);
        }
        return true;
      }

      // An explicit effectiveYears array, including an empty one, is the
      // source of truth for which academic years this fee applies to.
      if (fee.effectiveYears !== undefined) {
        const isIncluded = fee.effectiveYears.includes(selectedAcademicYearId);
        if (process.env.NODE_ENV === 'development') {
          console.log(`${isIncluded ? '✅' : '❌'} Fee ${isIncluded ? 'included' : 'excluded'} (effectiveYears check):`, {
            feeName: fee.name,
            feeAcademicYearId: fee.academicYearId,
            effectiveYears: fee.effectiveYears,
            selectedYearId: selectedAcademicYearId,
            isIncluded
          });
        }
        return isFeeApplicableInYear(fee, selectedAcademicYearId, allAcademicYears);
      }

      // If effectiveYears doesn't exist, calculate it on the fly:
      // Fee applies to the academic context year and all future years
      const feeContextYear = allAcademicYears.find(ay => ay.id === fee.academicYearId);
      if (!feeContextYear) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Fee context year not found:', {
            feeName: fee.name,
            feeAcademicYearId: fee.academicYearId
          });
        }
        return false;
      }

      // Compare start dates: fee applies if selected year starts on or after context year
      const feeContextStartDate = new Date(feeContextYear.startDate).getTime();
      const selectedYearStartDate = new Date(selectedYear.startDate).getTime();
      const isApplicable = selectedYearStartDate >= feeContextStartDate;

      if (process.env.NODE_ENV === 'development') {
        console.log(`${isApplicable ? '✅' : '❌'} Fee ${isApplicable ? 'included' : 'excluded'} (date comparison):`, {
          feeName: fee.name,
          feeContextYear: feeContextYear.name,
          feeContextStartDate: feeContextYear.startDate,
          selectedYear: selectedYear.name,
          selectedYearStartDate: selectedYear.startDate,
          isApplicable
        });
      }

      return isFeeApplicableInYear(fee, selectedAcademicYearId, allAcademicYears);
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Filtering result:', {
        totalFees: feeStructures.length,
        filteredCount: filtered.length,
        selectedAcademicYearId
      });
    }

    return filtered;
  }, [feeStructures, activeFilter, selectedAcademicYearId, allAcademicYears]);

  // Helper functions to match terms across academic years
  const findTermDetails = React.useCallback((termId: string | undefined, academicYears: AcademicYear[]) => {
    if (!termId) return null;
    for (const academicYear of academicYears) {
      const term = academicYear.terms?.find(t => t.id === termId);
      if (term) {
        return { term, academicYear };
      }
    }
    return null;
  }, []);

  const extractTermOrder = React.useCallback((termName?: string): number | null => {
    if (!termName) return null;
    const numericMatch = termName.match(/(\d+)/);
    if (numericMatch) {
      return Number.parseInt(numericMatch[1], 10);
    }
    const normalized = termName.trim().toLowerCase();
    if (normalized.includes('first')) return 1;
    if (normalized.includes('second')) return 2;
    if (normalized.includes('third')) return 3;
    if (normalized.includes('fourth')) return 4;
    return null;
  }, []);

  const normalizeTermName = React.useCallback((termName?: string): string => {
    return termName?.trim().toLowerCase().replace(/\s+/g, '') || '';
  }, []);

  const findMatchingTermInYear = React.useCallback((originalTerm: Term, targetYear: AcademicYear): Term | null => {
    // Try to match by term order first (e.g., "Term 1" -> "Term 1")
    const originalOrder = extractTermOrder(originalTerm.name);
    if (originalOrder !== null) {
      const matchingTerm = targetYear.terms.find(t => {
        const termOrder = extractTermOrder(t.name);
        return termOrder === originalOrder;
      });
      if (matchingTerm) return matchingTerm;
    }

    // Fallback to name matching (normalized)
    const normalizedOriginal = normalizeTermName(originalTerm.name);
    const matchingTerm = targetYear.terms.find(t => {
      return normalizeTermName(t.name) === normalizedOriginal;
    });
    if (matchingTerm) return matchingTerm;

    // If no match found, return null (will fallback to first term)
    return null;
  }, [extractTermOrder, normalizeTermName]);

  const groupedFeesByTerm = React.useMemo(() => {
    // Use selectedAcademicYear if available, otherwise fallback to currentAcademicYear
    const yearToUse = selectedAcademicYear || currentAcademicYear;
    if (!yearToUse || activeFilter === 'assignment' || activeFilter === 'discounts') return [];

    // Group all available fees into terms
    // If there are no term-specific assignments, show all fees under current term
    const groups: Record<string, { term: Term | undefined, fees: FeeStructure[] }> = {};

    // First, try to group fees by their assigned terms
    // IMPORTANT: Fees from previous years will have termIds from those years,
    // so we need to map them to the corresponding term in the selected year
    const feesWithTerms = filteredFeeStructures.filter(fs => fs.termId);
    const feesWithoutTerms = filteredFeeStructures.filter(fs => !fs.termId);

    if (process.env.NODE_ENV === 'development') {
      console.log('📦 Grouping fees:', {
        totalFiltered: filteredFeeStructures.length,
        feesWithTerms: feesWithTerms.length,
        feesWithoutTerms: feesWithoutTerms.length,
        selectedYear: yearToUse.name,
        selectedYearTerms: yearToUse.terms.map(t => t.name)
      });
    }

    // Show ALL terms from the selected year, regardless of whether they have fees
    yearToUse.terms.forEach(term => {
      // Only match fees where termId exactly matches this term's ID
      // (fees from other years will have different termIds, so they won't match here)
      const termFees = feesWithTerms.filter(fs => fs.termId === term.id);

      // Always add the term, even if it has no fees
      groups[term.id] = {
        term,
        fees: termFees.sort((a, b) => a.name.localeCompare(b.name))
      };
    });

    // Handle fees from other years - map them to corresponding terms in selected year
    const feesFromOtherYears = feesWithTerms.filter(fs => {
      // Check if this fee's termId belongs to the selected year
      return !yearToUse.terms.some(term => term.id === fs.termId);
    });

    // Map fees from other years to corresponding terms in the selected year
    feesFromOtherYears.forEach(fee => {
      if (!fee.termId) return;

      // Find the original term details from all academic years
      const originalTermDetails = findTermDetails(fee.termId, allAcademicYears);

      if (originalTermDetails) {
        // Find the matching term in the selected year
        const matchingTerm = findMatchingTermInYear(originalTermDetails.term, yearToUse);

        if (matchingTerm) {
          // Add fee to the matching term
          if (!groups[matchingTerm.id]) {
            groups[matchingTerm.id] = { term: matchingTerm, fees: [] };
          }
          groups[matchingTerm.id].fees.push(fee);

          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Mapped fee "${fee.name}" from ${originalTermDetails.term.name} (${originalTermDetails.academicYear.name}) to ${matchingTerm.name} (${yearToUse.name})`);
          }
        } else {
          // If no matching term found, add to first term as fallback
          const targetTerm = yearToUse.terms[0];
          if (targetTerm) {
            if (!groups[targetTerm.id]) {
              groups[targetTerm.id] = { term: targetTerm, fees: [] };
            }
            groups[targetTerm.id].fees.push(fee);

            if (process.env.NODE_ENV === 'development') {
              console.log(`⚠️ Could not match term for fee "${fee.name}" (original: ${originalTermDetails.term.name}), placed in ${targetTerm.name} as fallback`);
            }
          }
        }
      } else {
        // If we can't find the original term, add to first term as fallback
        const targetTerm = yearToUse.terms[0];
        if (targetTerm) {
          if (!groups[targetTerm.id]) {
            groups[targetTerm.id] = { term: targetTerm, fees: [] };
          }
          groups[targetTerm.id].fees.push(fee);

          if (process.env.NODE_ENV === 'development') {
            console.log(`⚠️ Could not find original term for fee "${fee.name}" (termId: ${fee.termId}), placed in ${targetTerm.name} as fallback`);
          }
        }
      }
    });

    // Sort fees in each group
    Object.keys(groups).forEach(termId => {
      groups[termId].fees.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Handle fees without term assignments - place them in first term
    if (feesWithoutTerms.length > 0) {
      const targetTerm = yearToUse.terms[0];
      if (targetTerm) {
        if (!groups[targetTerm.id]) {
          groups[targetTerm.id] = { term: targetTerm, fees: [] };
        }
        groups[targetTerm.id].fees = [
          ...groups[targetTerm.id].fees,
          ...feesWithoutTerms
        ].sort((a, b) => a.name.localeCompare(b.name));

        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Added ${feesWithoutTerms.length} fees without term assignments to ${targetTerm.name}`);
        }
      }
    }

    // If no fees were grouped at all, ensure we still show the terms
    if (Object.keys(groups).length === 0 && filteredFeeStructures.length > 0) {
      // Put all fees in the first term
      const firstTerm = yearToUse.terms[0];
      if (firstTerm) {
        groups[firstTerm.id] = {
          term: firstTerm,
          fees: filteredFeeStructures.sort((a, b) => a.name.localeCompare(b.name))
        };
      }
    }

    // Ensure we have at least one term group if we have fees
    if (Object.keys(groups).length === 0 && filteredFeeStructures.length > 0) {
      const firstTerm = yearToUse.terms[0];
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
  }, [filteredFeeStructures, selectedAcademicYear, currentAcademicYear, activeFilter]);

  const calculateCurrentFeeAmount = React.useCallback((baseAmount: number, feeId: string, targetAcademicYearId: string | undefined, allAdjustments: FeeAdjustmentEntry[]): number => {
    return calculateFeeAmountForAcademicYear(
      baseAmount,
      feeId,
      targetAcademicYearId,
      allAcademicYears,
      allAdjustments
    );
  }, [allAcademicYears]);

  React.useEffect(() => {
    const initialCollapsedState: Record<string, boolean> = {};
    // Use selectedAcademicYear if available, otherwise fallback to currentAcademicYear
    const yearToUse = selectedAcademicYear || currentAcademicYear;
    if (yearToUse && (activeFilter === 'general')) {
      // For selected year, collapse all terms initially (user can expand what they need)
      // For current year, expand current term
      const termToExpand = selectedAcademicYear ? undefined : currentTerm;
      yearToUse.terms.forEach(term => {
        initialCollapsedState[term.id] = term.id !== termToExpand?.id;
      });
    }
    setCollapsedTerms(initialCollapsedState);
  }, [selectedAcademicYear, currentAcademicYear, currentTerm, activeFilter]);

  // Show loading state only for critical data (fee structures and academic years)
  // Allow page to render even if adjustments or classes are still loading
  // This prevents the page from being stuck in loading state when non-critical data is slow
  if (isLoadingFees || academicYearsLoading) {
    return <GlassPageRouteSkeleton />;
  }

  // Show offline notice if there are connectivity errors
  if (feesError || adjustmentsError) {
    const isOfflineError = feesError?.message?.includes('offline') || adjustmentsError?.message?.includes('offline');

    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Fees Management"
          subtitle="Connection Status"
          backHref="/"
        />
        <div className="max-w-7xl mx-auto px-4 py-12">
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

  const handleOpenYearApplicabilityModal = (fee: FeeStructure) => {
    setSelectedFeeForApplicability(fee);
    setIsYearApplicabilityModalOpen(true);
  };

  const handleSaveYearApplicability = async (feeId: string, effectiveYears: string[]): Promise<boolean> => {
    try {
      await updateFeeStructureMutation.mutateAsync({
        id: feeId,
        data: { effectiveYears, hasCustomYearApplicability: true }
      });
      await queryClient.invalidateQueries({ queryKey: ['fee-structures-management'] });
      toast({ title: "Year Applicability Updated", description: "The fee's applicable academic years have been saved." });
      return true;
    } catch (error) {
      console.error('Error updating fee year applicability:', error);
      toast({
        variant: "destructive",
        title: "Unable to Save Applicability",
        description: "The fee's applicable years could not be updated. Please try again."
      });
      return false;
    }
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

    const effectiveYears = getApplicableYearIdsAfterDisable(
      feeToDisable,
      allAcademicYears,
      disableType,
      startYearId,
      endYearId
    );

    const updatedData = {
      // A scoped disable only removes the fee from those years. It remains an
      // active fee structure so it can still be fetched in unaffected years.
      status: (disableType === 'immediate_indefinite' ? 'disabled' : 'active') as FeeStatus,
      effectiveYears,
      hasCustomYearApplicability: true,
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

  const handleSubmitFeeStructure = async (data: Omit<FeeStructure, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'disableHistory' | 'description' | 'linkedFeeId'>) => {
    // Calculate effectiveYears: includes the year of context and all future years
    let effectiveYears: string[] | undefined = undefined;
    if (!data.isAssignmentFee && data.academicYearId && academicYears.length > 0) {
      const contextYear = academicYears.find(ay => ay.id === data.academicYearId);
      if (contextYear) {
        // Sort academic years by start date
        const sortedYears = [...academicYears].sort((a, b) => {
          const dateA = new Date(a.startDate).getTime();
          const dateB = new Date(b.startDate).getTime();
          return dateA - dateB;
        });

        const contextYearStartDate = new Date(contextYear.startDate).getTime();
        // Include the context year and all years that start on or after it
        effectiveYears = sortedYears
          .filter(ay => new Date(ay.startDate).getTime() >= contextYearStartDate)
          .map(ay => ay.id);

        console.log('📅 Calculated effectiveYears for fee:', {
          feeName: data.name,
          contextYear: contextYear.name,
          effectiveYears: effectiveYears.map(id => {
            const year = academicYears.find(ay => ay.id === id);
            return year?.name || id;
          })
        });
      }
    }

    const finalData = {
      ...data,
      amount: Number(data.amount) || 0,
      academicYearId: data.isAssignmentFee ? undefined : data.academicYearId,
      termId: data.isAssignmentFee ? undefined : data.termId,
      effectiveYears: data.isAssignmentFee ? undefined : effectiveYears,
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
      
      // Force aggressive invalidation of ALL fee structure queries across the app
      queryClient.invalidateQueries({ queryKey: ['fee-structures-management'] });
      queryClient.invalidateQueries({ queryKey: ['feeStructures'] });
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      queryClient.invalidateQueries({ queryKey: ['fee-structures-applicable-to-year'] });
      queryClient.invalidateQueries({ queryKey: ['all-fee-structures-for-carryforward'] });
      
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
    linkedFeeIds?: string[];
    action: 'save' | 'create';
  }) => {
    const discountPayload = {
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
      linkedFeeIds: data.linkedFeeIds,
      linkedFeeId: data.linkedFeeIds?.[0], // Keep first for backward compatibility
      disableHistory: [],
      isAssignmentFee: false,
      description: data.description,
    };

    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures-management'] });
      queryClient.invalidateQueries({ queryKey: ['feeStructures'] });
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      queryClient.invalidateQueries({ queryKey: ['fee-structures-applicable-to-year'] });
      queryClient.invalidateQueries({ queryKey: ['all-fee-structures-for-carryforward'] });
    };

    try {
      if (data.action === 'save' && editingFeeStructure) {
        // Update the existing discount record in place
        await updateFeeStructureMutation.mutateAsync({
          id: editingFeeStructure.id,
          data: discountPayload,
        });
        invalidateAll();
        toast({ title: "Discount Updated", description: `Discount "${data.name}" has been updated.` });
      } else {
        // Create a brand-new discount record
        await createFeeStructureMutation.mutateAsync(discountPayload);
        invalidateAll();
        toast({ title: "Discount Created", description: `Discount "${data.name}" has been added.` });
      }
      setIsDiscountModalOpen(false);
    } catch (error) {
      console.error('Error saving discount:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save discount. Please try again."
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
  }): Promise<boolean> => {
    if (!selectedFeeForAdjustment) return false;

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
      return true;
    } catch (error) {
      console.error('Error creating fee adjustment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create fee adjustment. Please try again."
      });
      return false;
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
      } else if (latestDisable.disableType === 'immediate_indefinite') {
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
            const linkedFeeIds = fee.linkedFeeIds || (fee.linkedFeeId ? [fee.linkedFeeId] : []);
            const linkedFees = linkedFeeIds.map(id => feeStructures.find(f => f.id === id)).filter(Boolean) as FeeStructure[];
            return (
              <TableRow key={fee.id}>
                <TableCell className="font-medium align-top py-4">
                  {fee.name}
                  {renderDisableInfo(fee)}
                </TableCell>
                <TableCell className="text-destructive font-semibold align-top py-4">
                  {formatCurrency(Math.abs(fee.amount))}
                </TableCell>
                <TableCell className="align-top py-4">
                  {linkedFees.length > 0 ? (
                    <div className="space-y-3">
                      {linkedFees.map((linkedFee, index) => {
                        const currentLinkedFeeAmount = calculateCurrentFeeAmount(linkedFee.amount, linkedFee.id, currentAcademicYear?.id, feeAdjustments);
                        return (
                          <div key={`${linkedFee.id}-${index}`} className="border-b last:border-0 pb-2 last:pb-0">
                            <div className="font-medium">{linkedFee.name}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(currentLinkedFeeAmount)}</div>
                            <div className="text-xs text-blue-600 font-medium">{getTermName(linkedFee)}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : 'N/A'}
                </TableCell>
                <TableCell className="align-top py-4">
                  {linkedFees.length > 0 ? (
                    <div className="space-y-3">
                      {linkedFees.map((linkedFee, index) => {
                        const currentLinkedFeeAmount = calculateCurrentFeeAmount(linkedFee.amount, linkedFee.id, currentAcademicYear?.id, feeAdjustments);
                        const newAmountAfterDiscount = currentLinkedFeeAmount - Math.abs(fee.amount);
                        return (
                          <div key={`discount-${linkedFee.id}-${index}`} className="border-b last:border-0 pb-2 last:pb-0 flex flex-col justify-center h-[52px]">
                            {formatCurrency(newAmountAfterDiscount)}
                          </div>
                        );
                      })}
                    </div>
                  ) : 'N/A'}
                </TableCell>
                <TableCell className="align-top py-4">{fee.description || '-'}</TableCell>
                <TableCell className="align-top py-4">
                  <Badge variant={fee.status === 'active' ? 'default' : 'outline'}>
                    {fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="font-bold text-xs">Shs.</span>
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
                      <span className="font-bold text-xs">Shs.</span>
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
                          {formatCurrency(calculateCurrentFeeAmount(
                            fee.amount,
                            fee.id,
                            selectedAcademicYearId || currentAcademicYear?.id,
                            feeAdjustments
                          ))}
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
                                <span className="font-bold text-xs">Shs.</span>
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
                              <DropdownMenuItem onClick={() => handleOpenYearApplicabilityModal(fee)}>
                                <Calendar className="mr-2 h-4 w-4" /> Year Applicability
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

  // Dynamic top bar attributes based on active tab
  const pageTitle = activeSettingTab === 'fees' ? 'Fees Management' :
                    activeSettingTab === 'uniforms' ? 'Uniform Management' :
                    'Requirement Management';

  const pageSubtitle = activeSettingTab === 'fees' ? (
    selectedAcademicYear
      ? `Manage ${selectedAcademicYear.name} fees${selectedAcademicYear.id !== currentAcademicYear?.id ? ' (Future Year)' : ''}.`
      : `Manage ${currentAcademicYear?.name || "current academic year"} fees.`
  ) : activeSettingTab === 'uniforms' ? (
    'Manage school uniform items, pricing, and availability for different classes and sections'
  ) : (
    'Configure standard school requirements for pupils'
  );

  const renderFeeSettingsControls = (className: string) => (
    <div className={className}>
      <select
        value={activeFilter}
        onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
        aria-label="Choose fee type"
        className="h-[34px] min-w-0 max-w-[35vw] rounded-full border border-violet-200/70 bg-white/95 px-2.5 text-[10px] font-bold text-violet-700 shadow-sm outline-none transition-colors hover:bg-violet-50 focus:ring-2 focus:ring-violet-400/60 lg:max-w-none"
      >
        <option value="general">General</option>
        <option value="assignment">Assignment</option>
        <option value="discounts">Discounts</option>
      </select>

      {availableAcademicYears.length > 0 && (
        <select
          value={selectedAcademicYearId || ''}
          onChange={(event) => {
            setHasUserSelectedAcademicYear(true);
            setSelectedAcademicYearId(event.target.value);
          }}
          aria-label="Choose academic year"
          className="h-[34px] min-w-0 max-w-[42vw] rounded-full border border-blue-200/70 bg-white/95 px-2.5 text-[10px] font-bold text-blue-700 shadow-sm outline-none transition-colors hover:bg-blue-50 focus:ring-2 focus:ring-blue-400/60 lg:max-w-none"
        >
          {availableAcademicYears.map((year) => {
            const isCurrent = year.id === currentAcademicYear?.id;
            const yearStartDate = new Date(year.startDate).getTime();
            const currentYearStartDate = currentAcademicYear ? new Date(currentAcademicYear.startDate).getTime() : 0;
            const isPast = yearStartDate < currentYearStartDate;
            const isFuture = yearStartDate > currentYearStartDate;

            return (
              <option key={year.id} value={year.id}>
                {year.name}
                {isCurrent ? ' (Current)' : ''}
                {isPast ? ' (Past)' : ''}
                {isFuture ? ' (Future)' : ''}
              </option>
            );
          })}
        </select>
      )}
    </div>
  );

  return (
    <div className="min-h-screen pb-12">
      <GlassPageTopBar
        title={pageTitle}
        subtitle={pageSubtitle}
        className="mb-1.5"
        backHref="/dashboard"
        backLabel="Dashboard"
        titleControls={activeSettingTab === 'fees' ? renderFeeSettingsControls('flex min-w-0 items-center gap-1.5 lg:hidden') : null}
        center={activeSettingTab === 'fees' ? renderFeeSettingsControls('hidden items-center gap-2 lg:flex') : null}
        actions={
          <GlassActionDock>
            {activeSettingTab === 'fees' && (
              <GlassActionButton
                label="Add"
                icon={<PlusCircle className="h-4 w-4" />}
                tone="purple"
                onClick={handleMainActionClick}
                title={mainActionText}
                aria-label={mainActionText}
              />
            )}

            {activeSettingTab === 'uniforms' && (
              <>
                <GlassActionButton
                  label="Filters"
                  tone={showUniformFilters ? "violet" : "slate"}
                  icon={<Filter className="h-4 w-4" />}
                  onClick={() => setShowUniformFilters(!showUniformFilters)}
                  title="Toggle Filters"
                />
                <GlassActionButton
                  label="Add"
                  tone="purple"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setUniformAddTrigger(t => t + 1)}
                  title="Add New Uniform"
                />
              </>
            )}

            {activeSettingTab === 'requirements' && (
              <>
                <GlassActionButton
                  label="Filters"
                  tone={showRequirementFilters ? "violet" : "slate"}
                  icon={<Filter className="h-4 w-4" />}
                  onClick={() => setShowRequirementFilters(!showRequirementFilters)}
                  title="Toggle Filters"
                />
                <GlassActionButton
                  label="Add"
                  tone="purple"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setRequirementAddTrigger(t => t + 1)}
                  title="Add New Requirement"
                />
              </>
            )}
          </GlassActionDock>
        }
      />

      <GlassSummaryBar
        left={
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-xs text-indigo-500">Shs.</span>
            <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 uppercase mr-2">
              Accounts Overview
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {activeSettingTab === 'fees' && (
                <>
                  <div className="flex items-center gap-1 bg-blue-50/80 border border-blue-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-blue-700">{totalFeesCount}</span>
                    <span className="text-blue-700/85 font-medium">total fee structures</span>
                  </div>
                  <div className="flex items-center gap-1 bg-green-50/80 border border-green-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-green-700">{activeFeesCount}</span>
                    <span className="text-green-700/85 font-medium">active structures</span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50/80 border border-amber-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-amber-700">{discountsCount}</span>
                    <span className="text-amber-700/85 font-medium">discounts configured</span>
                  </div>
                </>
              )}

              {activeSettingTab === 'uniforms' && (
                <>
                  <div className="flex items-center gap-1 bg-purple-50/80 border border-purple-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-purple-700">{totalUniforms}</span>
                    <span className="text-purple-700/85 font-medium">uniform items</span>
                  </div>
                  <div className="flex items-center gap-1 bg-blue-50/80 border border-blue-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-blue-700">{activeUniforms}</span>
                    <span className="text-blue-700/85 font-medium">active items</span>
                  </div>
                  <div className="flex items-center gap-1 bg-green-50/80 border border-green-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-green-700">{uniqueUniformGroups.length}</span>
                    <span className="text-green-700/85 font-medium">groups</span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50/80 border border-amber-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="text-amber-700/85 font-medium">avg price:</span>
                    <span className="font-bold text-amber-700">{formatCurrency(averageUniformPrice)}</span>
                  </div>
                </>
              )}

              {activeSettingTab === 'requirements' && (
                <>
                  <div className="flex items-center gap-1 bg-emerald-50/80 border border-emerald-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-emerald-700">{totalRequirements}</span>
                    <span className="text-emerald-700/85 font-medium">requirement items</span>
                  </div>
                  <div className="flex items-center gap-1 bg-blue-50/80 border border-blue-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-blue-700">{activeRequirements}</span>
                    <span className="text-blue-700/85 font-medium">active items</span>
                  </div>
                  <div className="flex items-center gap-1 bg-green-50/80 border border-green-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="font-bold text-green-700">{uniqueRequirementGroups.length}</span>
                    <span className="text-green-700/85 font-medium">groups</span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50/80 border border-amber-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                    <span className="text-amber-700/85 font-medium">total value:</span>
                    <span className="font-bold text-amber-700">{formatCurrency(totalRequirementsValue)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-full border border-slate-200/50 backdrop-blur-sm">
            {[
              { id: 'fees', label: 'Fees' },
              { id: 'uniforms', label: 'Uniforms' },
              { id: 'requirements', label: 'Requirements' }
            ].map((tab) => {
              const isActive = activeSettingTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as any)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300",
                    isActive
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        }
      />

      <div className="max-w-none px-4 sm:px-6 lg:px-8 py-6">
        {activeSettingTab === 'fees' && (
          <div className="space-y-6">
            <RecessStatusBanner />

            {activeFilter === 'assignment' ? (
              <div className="rounded-lg border shadow-sm mt-4 bg-white/60 backdrop-blur-md">
                {renderTableForAssignmentFees()}
              </div>
            ) : activeFilter === 'discounts' ? (
              <div className="rounded-lg border shadow-sm mt-4 bg-white/60 backdrop-blur-md">
                {renderTableForDiscounts()}
              </div>
            ) : (
              <div className="space-y-4">
                {renderTableForGeneralFees()}
              </div>
            )}

            {(activeFilter === 'general' && groupedFeesByTerm.length === 0 && filteredFeeStructures.length > 0) && (
              <p className="text-center text-muted-foreground mt-6 bg-white/50 backdrop-blur-sm p-4 rounded-xl">
                No {activeFilter} fees found for the current academic year terms.
              </p>
            )}
            {filteredFeeStructures.length === 0 && (
              <p className="text-center text-muted-foreground mt-6 bg-white/50 backdrop-blur-sm p-4 rounded-xl">
                No fee items defined yet. Click the button above to start.
              </p>
            )}
          </div>
        )}

        {activeSettingTab === 'uniforms' && (
          <UniformManagement
            showFilters={showUniformFilters}
            addTrigger={uniformAddTrigger}
          />
        )}

        {activeSettingTab === 'requirements' && (
          <RequirementManagement
            showFilters={showRequirementFilters}
            addTrigger={requirementAddTrigger}
          />
        )}
      </div>

        {isFeeStructureModalOpen && currentAcademicYear && (
          <FeeStructureModal
            isOpen={isFeeStructureModalOpen}
            onClose={() => setIsFeeStructureModalOpen(false)}
            onSubmit={handleSubmitFeeStructure}
            initialData={editingFeeStructure}
            mode={modalMode}
            // Historical academic years remain selectable when creating or editing
            // a fee item, including locked years such as 2019–2025.
            academicYears={allAcademicYears}
            allClasses={classes || []}
            currentAcademicYearId={selectedAcademicYearId || currentAcademicYear?.id}
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
            onClose={() => { setIsDisableModalOpen(false); setSelectedFeeForDisable(null); }}
            onSubmit={handleDisableSubmit}
            feeToDisable={selectedFeeForDisable}
            academicYears={allAcademicYears}
          />
        )}
        {isYearApplicabilityModalOpen && selectedFeeForApplicability && (
          <FeeYearApplicabilityModal
            isOpen={isYearApplicabilityModalOpen}
            onClose={() => {
              setIsYearApplicabilityModalOpen(false);
              setSelectedFeeForApplicability(null);
            }}
            fee={selectedFeeForApplicability}
            academicYears={allAcademicYears}
            onSave={handleSaveYearApplicability}
          />
        )}
        {isAdjustmentModalOpen && selectedFeeForAdjustment && (
          <FeeAdjustmentModal
            isOpen={isAdjustmentModalOpen}
            onClose={() => { setIsAdjustmentModalOpen(false); setSelectedFeeForAdjustment(null); }}
            onSubmit={handleAdjustmentSubmit}
            feeToAdjust={selectedFeeForAdjustment}
            academicYears={availableAcademicYears}
          />
        )}
    </div>
  );
}

export default function FeesManagementPage() {
  return (
    <Suspense fallback={<GlassPageRouteSkeleton />}>
      <FeesManagementPageContent />
    </Suspense>
  );
}
