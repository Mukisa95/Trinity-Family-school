'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

// UI Components
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Icons
import {
  CurrencyCircleDollar,
  Receipt,
  Printer,
  ArrowCircleLeft,
  Users,
  ArrowCounterClockwise,
  ClipboardText,
  IdentificationCard
} from '@phosphor-icons/react';
import { Tag, BarChart3, Zap } from 'lucide-react';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from '@/components/common/glass-page-top-bar';
import { GlassSummaryBar } from '@/components/common/glass-summary-bar';
import { GlassPageRouteSkeleton } from '@/components/common/glass-page-loading';
import { ManagePayCodeModal } from '@/components/pupils/manage-pay-code-modal';
import { SchoolPayPaymentsModal } from './components/SchoolPayPaymentsModal';
import { SchoolPayPaymentBanner, type GroupedSchoolPayTx } from './components/SchoolPayPaymentBanner';
import { SchoolPayRedistributeModal } from './components/SchoolPayRedistributeModal';

// Services and Hooks
import { PupilsService } from '@/lib/services/pupils.service';
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { PaymentsService } from '@/lib/services/payments.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';

// Optimized hooks for instant data loading
import { usePupil } from '@/lib/hooks/use-pupils';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useClasses } from '@/lib/hooks/use-classes';
import { usePupils } from '@/lib/hooks/use-pupils';

// Utilities
import { getCurrentTerm, getActiveOrMostRecentTerm, isTermActive, isTermEnded, detectCurrentAcademicYear } from '@/lib/utils/academic-year-utils';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import {
  getValidAcademicYearsForPupil,
  getValidTermsForPupil,
  isAcademicYearValidForPupil,
  isTermValidForPupil,
  getLastActiveTermForPupil,
  isAssignmentCurrentlyValid
} from './utils/feeProcessing';

// Types
import type { AcademicYear, Pupil, FeeStructure, PaymentRecord } from '@/types';

// Component imports
import { FeeCard } from './components/FeeCard';
import { PaymentModal } from './components/PaymentModal';
import { PrintModal } from './components/PrintModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CarryForwardPaymentModal } from './components/CarryForwardPaymentModal';
import { MultiFeePaymentModal } from './components/MultiFeePaymentModal';
import { getSchoolPayCode } from '@/lib/utils/schoolpay';
import { BatchRecaptureModal } from './components/BatchRecaptureModal';
import { AssignmentModal } from '@/components/pupils/assignment-modal';
import { UniformTrackingModal } from '@/components/common/uniform-tracking-modal';
import { HistoryLogService } from '@/lib/services/history-log.service';

// Hooks
import { usePupilFees } from './hooks/usePupilFees';
import { usePaymentProcessing } from './hooks/usePaymentProcessing';
import { useDigitalSignatureHelpers } from '@/lib/hooks/use-digital-signature';
import { useAuth } from '@/lib/contexts/auth-context';
import { useActiveFeesHolidaysByPupil } from '@/lib/hooks/use-fees-holiday';
import { usePrint } from '@/lib/contexts/print-context';
import { useActiveUniforms, useUniforms, useUniformsByFilter } from '@/lib/hooks/use-uniforms';
import { useCreateUniformTracking } from '@/lib/hooks/use-uniform-tracking';
import { useFeeStructures } from '@/lib/hooks/use-fee-structures';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { invalidateFinanceSummaryQueries } from '@/lib/hooks/use-finance-summary';

// Performance and Error Handling
import { usePerformanceMonitor, useRenderTracker } from './utils/performance';
import { handleError, handleDataLoadingError } from './utils/errorHandling';
import {
  processCarryForwardPayment,
  validateCarryForwardPayment
} from './utils/carryForwardPayments';
import { getCollectedUniformItemIds } from './utils/uniformCollectionState';

// Helper functions to convert pupil attributes to uniform filter types
const getUniformGender = (pupilGender: string | undefined): 'male' | 'female' | undefined => {
  if (!pupilGender || pupilGender === '') return undefined;
  const gender = pupilGender.toLowerCase();
  if (gender === 'male' || gender === 'female') return gender as 'male' | 'female';
  return undefined;
};

const getUniformSection = (pupilSection: string | undefined): 'Day' | 'Boarding' | undefined => {
  if (!pupilSection || pupilSection === '') return undefined;
  if (pupilSection === 'Day' || pupilSection === 'Boarding') return pupilSection as 'Day' | 'Boarding';
  return undefined;
};


// Extended interfaces for this component
interface PupilFee extends FeeStructure {
  paid: number;
  balance: number;
  payments: PaymentRecord[];
  discount?: {
    id: string;
    name: string;
    amount: number;
    type: 'fixed' | 'percentage';
  };
  originalAmount?: number;
  feeBreakdown?: Array<{
    name: string;
    amount: number;
    paid: number;
    balance: number;
    term: string;
    year: string;
  }>;
}

interface PreviousTermBalance {
  amount: number;
  termInfo: { term: string; year: string };
  breakdown: Array<{
    name: string;
    amount: number;
    paid: number;
    balance: number;
    term: string;
    year: string;
  }>;
}

interface SelectedFee {
  feeId: string;
  amount: number;
  name: string;
  balance: number;
  amountPaid: number;
  feeBreakdown?: Array<{
    name: string;
    amount: number;
    paid: number;
    balance: number;
    term: string;
    year: string;
    feeStructureId?: string;
    termId?: string;
    academicYearId?: string;
  }>;
}

/** Neon outline + fill per term tab (cycles if more than three terms) */
const TERM_TAB_NEON_STYLES = [
  'border-cyan-400 text-cyan-700 shadow-[0_0_4px_rgba(34,211,238,0.55)] data-[state=active]:border-cyan-400 data-[state=active]:bg-cyan-400 data-[state=active]:text-white data-[state=active]:shadow-[0_0_10px_rgba(34,211,238,0.8)]',
  'border-fuchsia-400 text-fuchsia-700 shadow-[0_0_4px_rgba(232,121,249,0.55)] data-[state=active]:border-fuchsia-400 data-[state=active]:bg-fuchsia-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_10px_rgba(232,121,249,0.8)]',
  'border-lime-400 text-lime-800 shadow-[0_0_4px_rgba(163,230,53,0.55)] data-[state=active]:border-lime-400 data-[state=active]:bg-lime-400 data-[state=active]:text-lime-950 data-[state=active]:shadow-[0_0_10px_rgba(163,230,53,0.8)]',
] as const;

export default function PupilFeesCollectionClient({ pupilId: propPupilId }: { pupilId?: string }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { signAction } = useDigitalSignatureHelpers();
  const { registerPrintHandler } = usePrint();
  const { data: schoolSettings } = useSchoolSettings();

  // Performance monitoring
  const { measureOperation } = usePerformanceMonitor();
  const renderTracker = useRenderTracker('PupilFeesCollection');

  // Get pupilId from props (query param) or params (dynamic route)
  const pupilId = propPupilId || (params?.id as string);

  // State management
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<AcademicYear | null>(null);
  const [lastPaymentTimestamp, setLastPaymentTimestamp] = useState<number>(0);

  // Listen for family payment updates to refresh data
  useEffect(() => {
    const handleFamilyPaymentUpdate = (event: CustomEvent) => {
      const { affectedPupilIds, timestamp } = event.detail;
      if (affectedPupilIds.includes(pupilId)) {
        console.log('Family payment detected for pupil:', pupilId, 'updating timestamp to:', timestamp);
        setLastPaymentTimestamp(timestamp);
      }
    };

    // Check localStorage for recent family payments
    const storedTimestamp = localStorage.getItem(`lastPaymentTimestamp_${pupilId}`);
    if (storedTimestamp) {
      const timestamp = parseInt(storedTimestamp);
      if (timestamp > lastPaymentTimestamp) {
        console.log('Found recent family payment in localStorage for pupil:', pupilId, 'updating timestamp to:', timestamp);
        setLastPaymentTimestamp(timestamp);
        // Clear the localStorage entry after using it
        localStorage.removeItem(`lastPaymentTimestamp_${pupilId}`);
      }
    }

    window.addEventListener('familyPaymentUpdate', handleFamilyPaymentUpdate as EventListener);

    return () => {
      window.removeEventListener('familyPaymentUpdate', handleFamilyPaymentUpdate as EventListener);
    };
  }, [pupilId, lastPaymentTimestamp]);

  // Historical pupil info for the selected term
  const [historicalPupilInfo, setHistoricalPupilInfo] = useState<{
    classId: string;
    className: string;
    section: string;
    isRealSnapshot?: boolean; // True if using real snapshot (not virtual)
    termHasEnded?: boolean; // True if the term has ended
  } | null>(null);

  // Modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isCarryForwardPaymentModalOpen, setIsCarryForwardPaymentModalOpen] = useState(false);
  const [isMultiPaymentModalOpen, setIsMultiPaymentModalOpen] = useState(false);
  const [isBatchRecaptureModalOpen, setIsBatchRecaptureModalOpen] = useState(false);
  const [isSchoolPayModalOpen, setIsSchoolPayModalOpen] = useState(false);
  const [isRedistributeModalOpen, setIsRedistributeModalOpen] = useState(false);
  const [redistributeTx, setRedistributeTx] = useState<GroupedSchoolPayTx | null>(null);

  const handleRedistribute = (tx: GroupedSchoolPayTx) => {
    setRedistributeTx(tx);
    setIsRedistributeModalOpen(true);
  };

  const handleRedistributeDone = () => {
    setLastPaymentTimestamp(Date.now());
    queryClient.invalidateQueries({ queryKey: ['pupil-payments-all', pupilId] });
    queryClient.invalidateQueries({ queryKey: ['previous-balance', pupilId] });
    queryClient.invalidateQueries({ queryKey: ['assignment-details'] });
    invalidateFinanceSummaryQueries(queryClient, pupilId);
  };
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [isUniformTrackingModalOpen, setIsUniformTrackingModalOpen] = useState(false);
  const [isManagePayCodeModalOpen, setIsManagePayCodeModalOpen] = useState(false);
  const [isWirePopupOpen, setIsWirePopupOpen] = useState(false);

  // Selected items
  const [selectedFee, setSelectedFee] = useState<SelectedFee | null>(null);

  // 🚀 OPTIMIZED: Use optimized hooks for instant cache-first loading
  // All queries run in parallel and use cache-first strategy for instant loads

  // Fetch academic years - optimized with cache-first
  const { data: rawAcademicYears = [], isLoading: isLoadingAcademicYears, error: academicYearsError } = useAcademicYears();

  // Process academic years to mark current terms
  const academicYears = useMemo(() => {
    return rawAcademicYears.map(year => ({
      ...year,
      terms: year.terms.map(term => ({
        ...term,
        isCurrent: isTermActive(term)
      }))
    }));
  }, [rawAcademicYears]);

  // Fetch pupil data - optimized with cache-first (instant if cached)
  const { data: pupil, isLoading: isPupilLoading, error: pupilError } = usePupil(pupilId || '');

  // Fetch classes data - optimized with cache-first (instant if cached)
  const { data: classes = [] } = useClasses();

  // Fetch all pupils data for batch recapture modal
  const { data: allPupils = [] } = usePupils();

  // Fetch uniforms for tracking modal
  const { data: activeUniforms = [] } = useActiveUniforms();
  const { data: allUniforms = [] } = useUniforms();
  const createUniformTrackingMutation = useCreateUniformTracking();
  // Fetch fee structures to get names for assignments
  const { data: allFeeStructures = [] } = useFeeStructures();


  // Get valid academic years for this pupil:
  // 1. Filters out years before the pupil's registration date
  // 2. Filters out years where the pupil was entirely inactive (Graduated/Transferred/Inactive)
  const validAcademicYears = useMemo(() => {
    return getValidAcademicYearsForPupil(
      academicYears,
      pupil?.registrationDate,
      pupil ?? undefined
    );
  }, [academicYears, pupil?.registrationDate, pupil?.status, pupil?.statusChangeHistory?.length]);

  // Fetch filtered uniforms based on pupil's gender, class, and section
  const { data: eligibleUniforms = [] } = useUniformsByFilter({
    gender: getUniformGender(pupil?.gender),
    classId: pupil?.classId,
    section: getUniformSection(pupil?.section)
  }, !!pupil);

  // Compute siblings for quick navigation
  const siblings = useMemo(() => {
    if (!pupil?.familyId || allPupils.length === 0) return [];
    return allPupils.filter(p => p.familyId === pupil.familyId && p.id !== pupil.id);
  }, [pupil?.familyId, pupil?.id, allPupils]);
  const hasSiblings = siblings.length > 0;

  // Fallback to all active uniforms if filtering fails or returns empty
  const finalEligibleUniforms = eligibleUniforms.length > 0 ? eligibleUniforms : activeUniforms;

  // Get valid terms for the selected academic year and this pupil
  // Also filters out terms when the pupil was inactive (status-aware)
  const validTerms = useMemo<AcademicYear['terms']>(() => {
    if (!selectedAcademicYear) return [];
    return getValidTermsForPupil(
      selectedAcademicYear,
      pupil?.registrationDate,
      pupil ?? undefined
    );
  }, [selectedAcademicYear, pupil?.registrationDate, pupil?.status, pupil?.statusChangeHistory?.length]);

  // 🚀 DYNAMIC YEAR LABELS: Calculate which year is "current" based on effective term
  const currentAcademicYearId = useMemo(() => {
    if (validAcademicYears.length === 0) return null;
    const effectiveTerm = getEffectiveTermForDataDisplay(validAcademicYears);
    return effectiveTerm?.academicYear?.id || null;
  }, [validAcademicYears]);

  // Optimized: Set default academic year and term when data is loaded.
  // ALSO re-runs when validAcademicYears changes and the currently selected year
  // is no longer in the filtered list (happens when pupil loads AFTER academicYears:
  // first render sets selectedAcademicYear = 2026, then pupil loads and filters
  // out 2026 because pupil is Graduated, so we need to reselect).
  useEffect(() => {
    const isSelectedYearStillValid = selectedAcademicYear
      ? validAcademicYears.some(y => y.id === selectedAcademicYear.id)
      : false;

    if (validAcademicYears.length > 0 && (!selectedAcademicYear || !isSelectedYearStillValid)) {
      const shouldUseLastActiveTerm = pupil && !['Active', 'Suspended', 'Pending', ''].includes(pupil.status);
      const lastActiveTermData = shouldUseLastActiveTerm
        ? getLastActiveTermForPupil(validAcademicYears, pupil)
        : null;

      if (lastActiveTermData) {
        setSelectedAcademicYear(lastActiveTermData.academicYear);
        setSelectedTermId(lastActiveTermData.term.id);
        return;
      }
      // 🚀 USE CENTRALIZED LOGIC: Use getEffectiveTermForDataDisplay for consistency
      // This ensures we follow the same rules as the Academic Years component:
      // - During active terms: show the current term
      // - During holidays: show the PREVIOUS term (not the upcoming one)
      // - For upcoming terms of active year: only show if explicitly marked active

      // Import the utility dynamically since we need it
      import('@/lib/utils/term-status-utils').then(({ getEffectiveTermForDataDisplay }) => {
        const effectiveTermData = getEffectiveTermForDataDisplay(validAcademicYears);

        if (effectiveTermData?.term && effectiveTermData?.academicYear) {
          console.log('🚀 Fast setup: Using effective term for data display', {
            year: effectiveTermData.academicYear.name,
            term: effectiveTermData.term.name,
            reason: effectiveTermData.reason
          });

          setSelectedAcademicYear(effectiveTermData.academicYear);
          setSelectedTermId(effectiveTermData.term.id);

          console.log('🚀 Academic year and term setup completed using centralized logic');
        } else {
          // Fallback: Use the old logic if getEffectiveTermForDataDisplay fails
          console.warn('⚠️ getEffectiveTermForDataDisplay returned no data, using fallback');

          const currentYear = detectCurrentAcademicYear(validAcademicYears);
          if (currentYear) {
            setSelectedAcademicYear(currentYear);

            const pupilValidTerms = getValidTermsForPupil(
              currentYear,
              pupil?.registrationDate,
              pupil ?? undefined
            );

            if (pupilValidTerms.length > 0) {
              const activeTerm = getActiveOrMostRecentTerm(currentYear);
              const validActiveTerm = activeTerm && pupilValidTerms.find(t => t.id === activeTerm.id)
                ? activeTerm
                : [...pupilValidTerms].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
              setSelectedTermId(validActiveTerm.id);
            }
          }
        }
      }).catch(error => {
        console.error('Error loading term-status-utils:', error);
        // Fallback to simple active year logic
        const currentYear = detectCurrentAcademicYear(validAcademicYears);
        if (currentYear) {
          setSelectedAcademicYear(currentYear);
          const pupilValidTerms = getValidTermsForPupil(
            currentYear,
            pupil?.registrationDate,
            pupil ?? undefined
          );
          if (pupilValidTerms.length > 0) {
            const newestValidTerm = [...pupilValidTerms].sort(
              (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
            )[0];
            setSelectedTermId(newestValidTerm.id);
          }
        }
      });
    }
  }, [validAcademicYears, selectedAcademicYear, pupil]);

  // Optimized: Only reset term if academic year changes (much faster)
  useEffect(() => {
    if (selectedAcademicYear && validTerms.length > 0 && selectedTermId) {
      // Only validate if term is invalid for the current academic year
      const isCurrentTermValid = validTerms.find(t => t.id === selectedTermId);

      if (!isCurrentTermValid) {
        console.log('⚡ Term validation: Resetting to first valid term');
        const newestValidTerm = [...validTerms].sort(
          (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        )[0];
        setSelectedTermId(newestValidTerm.id);
      }
    } else if (selectedAcademicYear && validTerms.length === 0) {
      console.log('⚡ No valid terms: Clearing term selection');
      setSelectedTermId('');
    }
  }, [selectedAcademicYear?.id, selectedTermId, validTerms]);

  // Load historical pupil info when term/year selection changes
  // This ensures the pupil info display shows accurate class/section for the selected term
  useEffect(() => {
    const loadHistoricalPupilInfo = async () => {
      if (!pupil || !selectedTermId || !selectedAcademicYear || !classes.length) {
        setHistoricalPupilInfo(null);
        return;
      }

      try {
        // Get historical snapshot for the selected term - NO FALLBACK
        // This is critical for financial accuracy - must always use correct historical data
        const snapshot = await PupilSnapshotsService.getSnapshotForRead(
          pupil,
          selectedTermId,
          selectedAcademicYear
        );

        // Find class name from classes data
        const classData = classes.find(c => c.id === snapshot.classId);

        // Check if this is a real snapshot (not virtual) - real snapshots have IDs that don't start with 'virtual-'
        const isRealSnapshot = !snapshot.id.startsWith('virtual-') && !snapshot.id.startsWith('error-');

        // Check if term has ended - for ended terms, we should always show the icon if using snapshot
        const selectedTerm = selectedAcademicYear.terms.find(t => t.id === selectedTermId);
        const termHasEnded = selectedTerm ? isTermEnded(selectedTerm) : false;

        setHistoricalPupilInfo({
          classId: snapshot.classId,
          className: classData?.name || 'Unknown Class',
          section: snapshot.section,
          isRealSnapshot: isRealSnapshot,
          termHasEnded: termHasEnded
        });

        console.log(`📸 Historical pupil info for ${selectedTermId}:`, {
          classId: snapshot.classId,
          className: classData?.name,
          section: snapshot.section,
          currentClass: pupil.className,
          currentSection: pupil.section
        });
      } catch (error) {
        console.error('❌ Critical Error: Could not load historical pupil info:', error);
        // For this critical financial system, we must never show incorrect data
        setHistoricalPupilInfo(null);
        toast({
          variant: "destructive",
          title: "Historical Data Error",
          description: "Could not load accurate pupil information for this term. Please contact support.",
          duration: 8000,
        });
      }
    };

    loadHistoricalPupilInfo();
  }, [pupil, selectedTermId, selectedAcademicYear, classes]);


  // Fetch active fees holidays for this pupil (needed for fee calculations)
  const { data: feesHolidays = [] } = useActiveFeesHolidaysByPupil(pupilId, {
    enabled: !!pupilId
  });

  // Use custom hooks for data fetching
  const {
    pupilFees,
    pupilPayments,
    uniformTrackingRecords,
    isUniformTrackingLoading,
    uniformTrackingError,
    allFeeStructures: allFeeStructuresFromHook,
    isLoading: isPupilFeesLoading,
    isPaymentDataLoading,
    refetch,
    termTotals,
    error: pupilFeesError
  } = usePupilFees({
    pupilId,
    pupil: pupil || undefined,
    selectedTermId,
    selectedAcademicYear,
    lastPaymentTimestamp,
    feesHolidays
  });

  // Check for active assignments and uniform tracking - get actual names and status
  const activeAssignments = useMemo(() => {
    if (!pupil?.assignedFees) return [];

    return pupil.assignedFees
      .filter(fee => fee.status === 'active')
      .map(fee => {
        // For pivot (inline) discounts, the feeStructureId won't exist in allFeeStructures.
        // Build a synthetic structure from the inlineDiscount data so every downstream
        // render (pill, tooltip, amount, appliesTo) works correctly.
        const inlineDisc = fee.inlineDiscount || (fee as any).pivotDiscount;
        const isPivot = (fee.feeStructureId?.startsWith('pivot-') || !!inlineDisc) && inlineDisc;
        const structure = isPivot
          ? {
              id: fee.feeStructureId,
              name: inlineDisc!.name || 'Pivot Discount',
              amount: inlineDisc!.amount, // stored negative
              category: 'Discount' as const,
              status: 'active' as const,
              description: inlineDisc!.description,
              linkedFeeIds: inlineDisc!.linkedFeeIds,
              linkedFeeId: inlineDisc!.linkedFeeIds?.[0],
            }
          : allFeeStructures.find(s => s.id === fee.feeStructureId);

        let isActiveForCurrentTerm = true;
        if (selectedTermId && selectedAcademicYear) {
          isActiveForCurrentTerm = isAssignmentCurrentlyValid(
            fee,
            selectedTermId,
            selectedAcademicYear,
            academicYears
          );
        }

        const fallbackName = fee.feeStructureId?.startsWith('pivot-') ? 'Pivot Discount' : 'Assigned Fee';

        return {
          id: fee.id,
          name: structure?.name || inlineDisc?.name || (fee as any).name || fallbackName,
          category: structure?.category || '',
          isActiveForCurrentTerm,
          structure
        };
      });
  }, [pupil?.assignedFees, allFeeStructures, selectedTermId, selectedAcademicYear, academicYears]);

  const uniformTrackingSummary = useMemo(() => {
    return uniformTrackingRecords
      .filter(record => {
        return (
          record.termId === selectedTermId &&
          record.academicYearId === selectedAcademicYear?.id
        );
      })
      .map(record => {
        const uniformIds = Array.isArray(record.uniformId) ? record.uniformId : [record.uniformId];
        const collectedItemIds = getCollectedUniformItemIds(record);
        const recordIsFullyCollected =
          record.collectionStatus === 'collected' ||
          (
            uniformIds.length > 0 &&
            uniformIds.every(id => {
              const totalQty = record.selectedQuantities?.[id] || 1;
              const collectedQty =
                record.collectedQuantities?.[id] ??
                (collectedItemIds.includes(id) ? totalQty : 0);
              return collectedQty >= totalQty;
            })
          );
        const items = uniformIds.map(id => {
          const uniform = allUniforms.find(u => u.id === id);
          const totalQty = record.selectedQuantities?.[id] || 1;
          const colQty =
            record.collectedQuantities?.[id] ??
            (collectedItemIds.includes(id) || recordIsFullyCollected ? totalQty : 0);
          const isFullyCollected = colQty >= totalQty && colQty > 0;
          const isPartiallyCollected = colQty > 0 && colQty < totalQty;
          const rawName = uniform?.name || 'Unknown Uniform';
          let displayName = totalQty > 1 ? `${totalQty}x ${rawName}` : rawName;
          if (isFullyCollected) {
            displayName = `${rawName} (${colQty}/${totalQty} ✓)`;
          } else if (isPartiallyCollected) {
            displayName = `${rawName} (${colQty}/${totalQty} ◐)`;
          } else if (totalQty > 1) {
            displayName = `${rawName} (0/${totalQty})`;
          }
          return {
            id,
            name: displayName,
            isFullyCollected,
            isPartiallyCollected
          };
        });
        return {
          id: record.id,
          items,
          isFullyCollected: recordIsFullyCollected,
          isPartiallyCollected:
            !recordIsFullyCollected &&
            items.some(item => item.isPartiallyCollected || item.isFullyCollected),
        };
      });
  }, [
    uniformTrackingRecords,
    allUniforms,
    selectedTermId,
    selectedAcademicYear?.id,
  ]);

  // Handler functions
  const handleMakePayment = (fee: any, balance: number, totalPaid: number) => {
    const selectedFeeData: SelectedFee = {
      feeId: fee.id,
      name: fee.name,
      amount: fee.amount,
      balance,
      amountPaid: totalPaid,
      feeBreakdown: fee.feeBreakdown
    };

    setSelectedFee(selectedFeeData);

    // Check if this is a carry forward fee with multiple items
    if (fee.id === 'previous-balance' && fee.feeBreakdown && fee.feeBreakdown.length > 0) {
      setIsCarryForwardPaymentModalOpen(true);
    } else {
      setIsPaymentModalOpen(true);
    }
  };

  // Handle multi-fee payment using the same digital signature + notification flow
  const handleMultiPayment = async (paymentData: {
    totalAmount: number;
    paymentMethod: string;
    selectedFees: Array<{
      feeId: string;
      feeName: string;
      maxAmount: number;
      selectedAmount: number;
      isCarryForward?: boolean;
      feeBreakdown?: Array<{
        name: string;
        amount: number;
        paid: number;
        balance: number;
        term: string;
        year: string;
        feeStructureId?: string;
        termId?: string;
        academicYearId?: string;
      }>;
    }>;
    paidBy: string;
  }) => {
    if (!pupil || !selectedAcademicYear || !user) {
      toast({
        variant: 'destructive',
        title: 'Cannot Process Payment',
        description: 'Missing pupil, academic year, or user information.'
      });
      return;
    }

    try {
      // Import uniform integration service for uniform fee checks
      const { UniformFeesIntegrationService } = await import(
        '@/lib/services/uniform-fees-integration.service'
      );

      console.log('Processing multi-fee payment:', {
        totalAmount: paymentData.totalAmount,
        selectedFeesCount: paymentData.selectedFees.length,
        pupilId: pupil.id,
        pupilName: `${pupil.firstName} ${pupil.lastName}`
      });

      const paidByUser = {
        id: user.id,
        name: user.username,
        role: user.role
      };

      // Process each selected fee
      const paymentResults = await Promise.all(
        paymentData.selectedFees.map(async (feeSelection) => {
          const fee = pupilFees.find(f => f.id === feeSelection.feeId);
          if (!fee) {
            console.warn('Fee not found for multi payment:', feeSelection.feeId);
            return null;
          }

          const isUniformFee = UniformFeesIntegrationService.isUniformFee(
            fee as any
          );
          const isCarryForwardFee =
            feeSelection.isCarryForward ||
            feeSelection.feeId === 'previous-balance' ||
            fee.id === 'previous-balance';

          let signatureTargets: Array<{
            paymentId: string;
            amount: number;
            feeName: string;
            paymentType: 'uniform' | 'carry-forward' | 'regular';
          }> = [];

          if (isCarryForwardFee) {
            const feeBreakdown = feeSelection.feeBreakdown || fee.feeBreakdown || [];
            const carryForwardPaymentData = {
              pupilId: pupil.id,
              currentTermId: selectedTermId,
              currentAcademicYearId: selectedAcademicYear.id,
              amount: feeSelection.selectedAmount,
              paymentType: 'general' as const,
              feeBreakdown,
              paidBy: paidByUser
            };

            const validation = validateCarryForwardPayment(carryForwardPaymentData);
            if (!validation.isValid) {
              throw new Error(validation.error || 'Invalid carry forward payment');
            }

            const result = await processCarryForwardPayment(carryForwardPaymentData);
            if (!result.success) {
              throw new Error(result.message || 'Failed to create carry forward payment');
            }

            signatureTargets = result.paymentIds.map((paymentId, index) => ({
              paymentId,
              amount: result.distributions[index]?.allocatedAmount || feeSelection.selectedAmount,
              feeName: result.distributions[index]?.item?.name || feeSelection.feeName,
              paymentType: 'carry-forward' as const
            }));
          } else if (isUniformFee) {
            // Uniform fee payment through integration service
            const paymentId =
              await UniformFeesIntegrationService.createUniformPaymentRecord(
                fee as any,
                feeSelection.selectedAmount,
                pupil.id,
                selectedAcademicYear.id,
                selectedTermId,
                paidByUser
              );
            signatureTargets = [{
              paymentId,
              amount: feeSelection.selectedAmount,
              feeName: feeSelection.feeName,
              paymentType: 'uniform'
            }];
          } else {
            // Regular fee payment via API (for notifications)
            const paymentRecord = {
              pupilId: pupil.id,
              feeStructureId: feeSelection.feeId,
              academicYearId: selectedAcademicYear.id,
              termId: selectedTermId,
              amount: feeSelection.selectedAmount,
              paymentDate: new Date().toISOString(),
              paidBy: paidByUser,
              paymentMethod: paymentData.paymentMethod,
              notes: `Multi-fee payment for ${feeSelection.feeName}. Paid by: ${paymentData.paidBy}`,
              skipHistoryLog: true,
              historyContext: {
                feeName: feeSelection.feeName,
                pupilName: `${pupil.firstName} ${pupil.lastName}`,
                paymentMethod: paymentData.paymentMethod,
                source: 'multi_fee_payment',
                paidByName: paymentData.paidBy,
              }
            };

            const response = await fetch('/api/payments/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(paymentRecord)
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to create payment');
            }

            const result = await response.json();
            signatureTargets = [{
              paymentId: result.paymentId,
              amount: feeSelection.selectedAmount,
              feeName: feeSelection.feeName,
              paymentType: 'regular'
            }];
            await HistoryLogService.log({
              action: 'create',
              entity: 'payment',
              recordId: result.paymentId,
              label: feeSelection.feeName,
              meta: {
                amount: feeSelection.selectedAmount,
                feeName: feeSelection.feeName,
                pupilName: `${pupil.firstName} ${pupil.lastName}`,
                method: paymentData.paymentMethod,
                source: 'multi_fee_payment',
              },
              actor: {
                id: user.id,
                username: user.username,
                role: user.role,
              },
            });
          }

          // Digital signature for each payment
          await Promise.all(signatureTargets.map(signature =>
            signAction('fee_payment', signature.paymentId, 'collected', {
              amount: signature.amount,
              pupilName: `${pupil.firstName} ${pupil.lastName}`,
              feeName: signature.feeName,
              academicYear: selectedAcademicYear.name,
              term: selectedTermId,
              paymentType: signature.paymentType,
              paymentMethod: paymentData.paymentMethod,
              paidBy: paymentData.paidBy,
              receivedBy: user.username,
              source: 'multi_fee_payment'
            })
          ));

          return signatureTargets.map(signature => signature.paymentId);
        })
      );

      // Close modal before refetch
      setIsMultiPaymentModalOpen(false);

      const newTimestamp = Date.now();
      setLastPaymentTimestamp(newTimestamp);

      // Invalidate queries and refetch
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['pupil-payments-all', pupil.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ['previous-balance', pupil.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ['family-payments-all']
        }),
        queryClient.invalidateQueries({
          queryKey: ['family-previous-balances']
        }),
        queryClient.invalidateQueries({
          queryKey: ['uniform-fees', pupil.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ['pupil-snapshot', pupil.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ['fee-structures']
        }),
        queryClient.invalidateQueries({
          queryKey: ['assignment-details']
        }),
        queryClient.invalidateQueries({
          queryKey: ['finance-summary']
        })
      ]);

      await refetch();

      toast({
        title: 'Payment Successful',
        description: `Processed ${paymentData.selectedFees.length} fee payments totaling ${new Intl.NumberFormat(
          'en-UG',
          { style: 'currency', currency: 'UGX' }
        ).format(paymentData.totalAmount)}.`
      });
    } catch (error) {
      console.error('Multi-fee payment error:', error);
      toast({
        variant: 'destructive',
        title: 'Payment Failed',
        description:
          'There was an error processing the multi-fee payment. Please try again.'
      });
      throw error;
    }
  };

  const handlePaymentSubmit = async (data: { amount: number }) => {
    if (!selectedFee || !pupil || !selectedAcademicYear || !user) return;

    // 🔥 CRITICAL FIX: Remove optimistic updates - wait for real data from database
    // This ensures all old payments are included in calculations

    // Import uniform integration service for uniform fee checks
    const { UniformFeesIntegrationService } = await import('@/lib/services/uniform-fees-integration.service');

    // Check if this is a uniform fee
    const fee = pupilFees.find(f => f.id === selectedFee.feeId);
    const isUniformFee = fee && UniformFeesIntegrationService.isUniformFee(fee);

    try {
      let paymentId: string;

      if (isUniformFee) {
        // Handle uniform payment with integration
        paymentId = await UniformFeesIntegrationService.createUniformPaymentRecord(
          fee as any, // Type assertion since we know it's a uniform fee
          data.amount,
          pupil.id,
          selectedAcademicYear.id,
          selectedTermId,
          {
            id: user.id,
            name: user.username,
            role: user.role
          }
        );
      } else {
        // Handle regular fee payment via server-side API route
        const paymentData = {
          pupilId: pupil.id,
          feeStructureId: selectedFee.feeId,
          academicYearId: selectedAcademicYear.id,
          termId: selectedTermId,
          amount: data.amount,
          paymentDate: new Date().toISOString(),
          paidBy: {
            id: user.id,
            name: user.username,
            role: user.role
          },
          notes: `Payment for ${selectedFee.name}`,
          skipHistoryLog: true,
          historyContext: {
            feeName: selectedFee.name,
            pupilName: `${pupil.firstName} ${pupil.lastName}`,
            paymentMethod: 'Cash',
            source: 'single_fee_payment',
            paidByName: user.username,
          }
        };

        // 🔔 Call server-side API to create payment and trigger notifications
        const response = await fetch('/api/payments/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paymentData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create payment');
        }

        const result = await response.json();
        paymentId = result.paymentId;
        await HistoryLogService.log({
          action: 'create',
          entity: 'payment',
          recordId: paymentId,
          label: selectedFee.name,
          meta: {
            amount: data.amount,
            feeName: selectedFee.name,
            pupilName: `${pupil.firstName} ${pupil.lastName}`,
            method: 'Cash',
            source: 'single_fee_payment',
          },
          actor: {
            id: user.id,
            username: user.username,
            role: user.role,
          },
        });
      }

      // Create digital signature for the payment
      await signAction(
        'fee_payment',
        paymentId,
        'collected',
        {
          amount: data.amount,
          pupilName: `${pupil.firstName} ${pupil.lastName}`,
          feeName: selectedFee.name,
          academicYear: selectedAcademicYear.name,
          term: selectedTermId,
          paymentType: isUniformFee ? 'uniform' : 'regular'
        }
      );

      // Close modal and clear selected fee BEFORE any updates
      setIsPaymentModalOpen(false);
      setSelectedFee(null);

      // 🚀 OPTIMISTIC UPDATE: Immediately add payment to cache for instant UI feedback
      const newPayment: PaymentRecord = {
        id: paymentId,
        pupilId: pupil.id,
        feeStructureId: selectedFee.feeId,
        academicYearId: selectedAcademicYear.id,
        termId: selectedTermId,
        amount: data.amount,
        paymentDate: new Date().toISOString(),
        paidBy: {
          id: user.id,
          name: user.username,
          role: user.role
        },
        notes: `Payment for ${selectedFee.name}`,
        createdAt: new Date().toISOString()
      };

      // Optimistically update the payments cache
      queryClient.setQueryData(
        ['pupil-payments-all', pupil.id],
        (oldPayments: PaymentRecord[] = []) => [...oldPayments, newPayment]
      );

      // Update timestamp to trigger dependent query re-calculations
      const newTimestamp = Date.now();
      setLastPaymentTimestamp(newTimestamp);

      // Invalidate related queries in the background (no await - let React Query handle it)
      queryClient.invalidateQueries({ queryKey: ['previous-balance', pupil.id] });
      queryClient.invalidateQueries({ queryKey: ['family-payments-all'] });
      queryClient.invalidateQueries({ queryKey: ['family-previous-balances'] });
      queryClient.invalidateQueries({ queryKey: ['uniform-fees', pupil.id] });
      queryClient.invalidateQueries({ queryKey: ['pupil-snapshot', pupil.id] });
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-details'] });
      invalidateFinanceSummaryQueries(queryClient, pupil.id);

      // Show success message immediately (no blocking refetch)
      toast({
        title: "Payment Successful",
        description: `Payment of ${new Intl.NumberFormat('en-UG', {
          style: 'currency',
          currency: 'UGX'
        }).format(data.amount)} has been recorded.`,
      });

    } catch (error) {
      console.error('Payment submission error:', error);

      // Reopen modal
      setIsPaymentModalOpen(true);
      setSelectedFee({
        feeId: selectedFee.feeId,
        name: selectedFee.name,
        amount: selectedFee.amount,
        balance: selectedFee.balance,
        amountPaid: selectedFee.amountPaid
      });

      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: "There was an error processing the payment. Changes have been reverted.",
      });
    }
  };

  const handleCarryForwardPaymentSubmit = async (data: {
    amount: number;
    paymentType: 'general' | 'item-specific';
    targetItem?: any;
  }) => {
    if (!selectedFee || !pupil || !selectedAcademicYear) return;

    try {
      const paymentData = {
        pupilId: pupil.id,
        currentTermId: selectedTermId,
        currentAcademicYearId: selectedAcademicYear.id,
        amount: data.amount,
        paymentType: data.paymentType,
        targetItem: data.targetItem,
        feeBreakdown: selectedFee.feeBreakdown || [],
        paidBy: {
          id: 'current-user',
          name: 'System User',
          role: 'admin'
        }
      };

      // Validate payment data
      const validation = validateCarryForwardPayment(paymentData);
      if (!validation.isValid) {
        toast({
          variant: "destructive",
          title: "Invalid Payment",
          description: validation.error,
        });
        return;
      }

      // Process the carry forward payment
      const result = await processCarryForwardPayment(paymentData);

      if (result.success) {
        // Close modal and clear selected fee BEFORE any updates
        setIsCarryForwardPaymentModalOpen(false);
        setSelectedFee(null);

        // 🚀 OPTIMISTIC UPDATE: Immediately add payments to cache for instant UI feedback
        // React Query will handle background sync and data consistency
        const newPayments: PaymentRecord[] = result.paymentIds.map((id, index) => {
          const distribution = result.distributions[index];
          return {
            id,
            pupilId: pupil.id,
            feeStructureId: 'previous-balance',
            academicYearId: selectedAcademicYear.id,
            termId: selectedTermId,
            amount: distribution.allocatedAmount,
            paymentDate: new Date().toISOString(),
            paidBy: paymentData.paidBy,
            notes: `Carry forward payment: ${distribution.item.name} (${distribution.item.term} - ${distribution.item.year})`,
            createdAt: new Date().toISOString(),
            // Carry forward metadata
            isCarryForwardPayment: true,
            originalFeeStructureId: distribution.item.feeStructureId,
            originalTerm: distribution.item.term,
            originalYear: distribution.item.year,
            originalTermId: distribution.item.termId,
            originalAcademicYearId: distribution.item.academicYearId,
            carryForwardItemName: distribution.item.name,
            paymentMadeInTerm: selectedTermId,
            paymentMadeInYear: selectedAcademicYear.id
          } as any;
        });

        // Optimistically update the payments cache
        queryClient.setQueryData(
          ['pupil-payments-all', pupil.id],
          (oldPayments: PaymentRecord[] = []) => [...oldPayments, ...newPayments]
        );

        // Update timestamp to trigger dependent query re-calculations
        const newTimestamp = Date.now();
        setLastPaymentTimestamp(newTimestamp);

        // Invalidate related queries in the background (no await - let React Query handle it)
        queryClient.invalidateQueries({ queryKey: ['previous-balance', pupil.id] });
        queryClient.invalidateQueries({ queryKey: ['family-payments-all'] });
        queryClient.invalidateQueries({ queryKey: ['family-previous-balances'] });
        queryClient.invalidateQueries({ queryKey: ['uniform-fees', pupil.id] });
        queryClient.invalidateQueries({ queryKey: ['pupil-snapshot', pupil.id] });
        queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
        queryClient.invalidateQueries({ queryKey: ['assignment-details'] });
        invalidateFinanceSummaryQueries(queryClient, pupil.id);

        // Show success toast immediately (no blocking refetch)
        toast({
          title: "Payment Successful",
          description: result.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Payment Failed",
          description: result.message,
        });
      }

    } catch (error) {
      console.error('Carry forward payment submission error:', error);
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: "There was an error processing the payment. Please try again.",
      });
    }
  };

  const handleRevertPayment = async (payment: PaymentRecord, fee: any) => {
    if (!user) return;

    try {
      await PaymentsService.revertPayment(payment.id, {
        id: user.id,
        name: user.username,
        role: user.role
      });

      // Create digital signature for the payment reversal
      await signAction(
        'fee_payment',
        payment.id,
        'reverted',
        {
          originalAmount: payment.amount,
          pupilId: payment.pupilId,
          feeStructureId: payment.feeStructureId,
          revertReason: 'Payment reversal requested'
        }
      );

      toast({
        title: "Payment Reverted",
        description: `Payment of ${new Intl.NumberFormat('en-UG', {
          style: 'currency',
          currency: 'UGX'
        }).format(payment.amount)} has been reverted.`,
      });

      // Refetch all data to update UI (non-blocking)
      refetch().catch(err => console.error('Refetch error:', err));
      queryClient.invalidateQueries({ queryKey: ['assignment-details'] });
      setLastPaymentTimestamp(Date.now());

    } catch (error) {
      console.error('Payment revert error:', error);
      toast({
        variant: "destructive",
        title: "Revert Failed",
        description: "There was an error reverting the payment. Please try again.",
      });
    }
  };

  const handleRefreshData = async () => {
    try {
      await refetch();
      toast({
        title: "Data Refreshed",
        description: "Fee information has been updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Could not refresh data. Please try again.",
      });
    }
  };

  const handleSaveAssignments = async (updatedAssignedFees: any[]) => {
    if (!pupil) return;

    try {
      const response = await fetch(`/api/pupils/${pupil.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignedFees: updatedAssignedFees,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save assignments');
      }

      // 🔥 CRITICAL FIX: Optimistically update the pupil in ALL caches with the new assignedFees.
      // Without this, filterApplicableFees reads from the stale cached pupil and sees
      // pupilAssignedFees: 0 — causing all assignment fees to be rejected even after saving.
      const updatedPupil = { ...pupil, assignedFees: updatedAssignedFees };

      // Update the detail cache (used by usePupil hook → ['pupils', 'detail', id])
      queryClient.setQueryData(['pupils', 'detail', pupil.id], updatedPupil);

      // Update the pupil inside the list cache (used for fast lookups → ['pupils', 'list'])
      queryClient.setQueryData(['pupils', 'list'], (oldPupils: any[] | undefined) => {
        if (!oldPupils) return oldPupils;
        return oldPupils.map((p: any) => p.id === pupil.id ? updatedPupil : p);
      });

      // Remove the stale pupil snapshot from cache so it rebuilds fresh with new assignedFees
      queryClient.removeQueries({ queryKey: ['pupil-snapshot', pupil.id, selectedTermId, selectedAcademicYear?.id] });

      // Invalidate all relevant queries to refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pupils'] }),
        queryClient.invalidateQueries({ queryKey: ['pupil-payments-all', pupil.id] }),
        queryClient.invalidateQueries({ queryKey: ['previous-balance', pupil.id] }),
        queryClient.invalidateQueries({ queryKey: ['feeStructures'] }),
        queryClient.invalidateQueries({ queryKey: ['fees'] }),
        queryClient.invalidateQueries({ queryKey: ['fee-structures-applicable-to-year'] }),
        queryClient.invalidateQueries({ queryKey: ['all-fee-structures-for-carryforward'] }),
        queryClient.invalidateQueries({ queryKey: ['pupil-snapshot', pupil.id] }),
        queryClient.invalidateQueries({ queryKey: ['assign-pupils'] }),
        queryClient.invalidateQueries({ queryKey: ['assignment-details'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-summary'] }),
      ]);

      // Refetch fees to show updated assignments
      await refetch();

      toast({
        title: "Assignments Saved",
        description: "Fee assignments have been updated successfully.",
      });
    } catch (error) {
      console.error('Failed to save assignments:', error);
      throw error; // Re-throw so the modal can handle it
    }
  };

  const handleRecaptureSnapshot = async () => {
    if (!pupil || !selectedTermId || !selectedAcademicYear) {
      toast({
        variant: "destructive",
        title: "Cannot Recapture",
        description: "Missing pupil, term, or academic year information.",
      });
      return;
    }

    // Check if this is a real snapshot (not virtual)
    if (!historicalPupilInfo?.isRealSnapshot) {
      toast({
        variant: "destructive",
        title: "Cannot Recapture",
        description: "This term is using live data. Snapshots can only be recaptured for ended terms with existing snapshots.",
      });
      return;
    }

    try {
      // Show loading toast
      toast({
        title: "Recapturing Snapshot",
        description: "Deleting old snapshot and creating new one with current pupil data...",
      });

      // Recapture the snapshot
      await PupilSnapshotsService.recaptureSnapshot(
        pupil,
        selectedTermId,
        selectedAcademicYear
      );

      // Invalidate snapshot query to force refresh
      await queryClient.invalidateQueries({
        queryKey: ['pupil-snapshot', pupil.id, selectedTermId, selectedAcademicYear.id],
      });

      // Refetch fees to update with new snapshot data
      await refetch();

      // Reload historical pupil info
      const snapshot = await PupilSnapshotsService.getSnapshotForRead(
        pupil,
        selectedTermId,
        selectedAcademicYear
      );
      const classData = classes.find(c => c.id === snapshot.classId);
      const selectedTerm = selectedAcademicYear.terms.find(t => t.id === selectedTermId);
      const termHasEnded = selectedTerm ? isTermEnded(selectedTerm) : false;

      setHistoricalPupilInfo({
        classId: snapshot.classId,
        className: classData?.name || 'Unknown Class',
        section: snapshot.section,
        isRealSnapshot: !snapshot.id.startsWith('virtual-') && !snapshot.id.startsWith('error-'),
        termHasEnded: termHasEnded
      });

      toast({
        title: "Snapshot Recaptured",
        description: "The snapshot has been updated with the pupil's current details.",
      });
    } catch (error) {
      console.error('Error recapturing snapshot:', error);
      toast({
        variant: "destructive",
        title: "Recapture Failed",
        description: error instanceof Error ? error.message : "Could not recapture snapshot. Please try again.",
      });
    }
  };

  const handleBatchRecapture = () => {
    setIsBatchRecaptureModalOpen(true);
  };

  const handleBatchRecaptureComplete = async () => {
    // Refresh data after batch recapture
    await queryClient.invalidateQueries({
      queryKey: ['pupil-snapshot'],
    });
    await refetch();

    toast({
      title: "Refresh Complete",
      description: "Fee data has been refreshed after batch recapture.",
    });
  };

  const handlePrint = async (selectedFees: any[]) => {
    // Will be implemented in later phases
    console.log('Print fees:', selectedFees);
    toast({
      title: "Print Feature",
      description: "Print functionality will be implemented in later phases",
    });
  };

  // Register print handler to open print modal
  useEffect(() => {
    const unregister = registerPrintHandler(() => {
      setIsPrintModalOpen(true);
    }, 50);
    return unregister;
  }, [registerPrintHandler]);

  const handleGeneratePaymentID = async () => {
    if (!pupil) return;

    try {
      toast({
        title: "Generating Payment ID",
        description: "Preparing Payment ID card...",
      });

      // Dynamic imports to avoid SSR issues
      const [
        { default: ReactPDF },
        { Document, Page, Text, View, StyleSheet, Image, Font },
        { default: QRCode }
      ] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@react-pdf/renderer'),
        import('qrcode')
      ]);

      // Register fonts
      Font.register({
        family: 'Helvetica',
        fonts: [
          { src: '/fonts/Helvetica.ttf' },
          { src: '/fonts/Helvetica-Bold.ttf', fontWeight: 'bold' }
        ]
      });

      // A4 dimensions in points
      const A4_WIDTH = 595.28;  
      const A4_HEIGHT = 841.89; 

      // ID card dimensions from image (in mm, converted to points)
      const ID_CARD_WIDTH = 86 * 2.83465;  // 243.78
      const ID_CARD_HEIGHT = 55 * 2.83465; // 155.90

      const LEFT_MARGIN = 32 * 2.83465;
      const TOP_MARGIN = 10 * 2.83465;

      const COLORS = {
        navy: '#002B5B',
        gold: '#FFB800',
        burgundy: '#8B0000',
        white: '#FFFFFF',
        pink: '#FFF5F5',
        gray: {
          text: '#374151',
          border: '#D1D5DB'
        }
      };

      const qrData = {
        id: pupil.admissionNumber || '',
        name: `${pupil.firstName || ''} ${pupil.lastName || ''}`.trim(),
                      payCode: getSchoolPayCode(pupil) || 'N/A'
      };
      const jsonString = JSON.stringify(qrData);

      const qrCodeDataURL = await QRCode.toDataURL(jsonString, {
        errorCorrectionLevel: 'H',
        margin: 1,
        scale: 4,
        width: 200,
        color: {
          dark: '#000000FF',
          light: '#FFFFFFFF'
        }
      });

      const schoolInfo = {
        name: schoolSettings?.generalInfo?.name || "Trinity Family Nursery and Primary School",
        phone: schoolSettings?.contact?.phone || "0776300109 / 0774081378 / 0702957826",
      };

      const styles = StyleSheet.create({
        page: {
          width: A4_WIDTH,
          height: A4_HEIGHT,
          backgroundColor: COLORS.white,
          padding: 0
        },
        cardContainer: {
          position: 'absolute',
          top: TOP_MARGIN,
          left: LEFT_MARGIN,
          width: ID_CARD_WIDTH,
          height: ID_CARD_HEIGHT,
          backgroundColor: COLORS.white,
          fontFamily: 'Helvetica'
        },
        mainContainer: {
          flexDirection: 'row',
          height: '100%'
        },
        leftSection: {
          width: '35%',
          backgroundColor: COLORS.navy,
          position: 'relative',
          padding: 0,
          display: 'flex',
          alignItems: 'center'
        },
        hexagonContainer: {
          position: 'relative',
          width: '100%',
          height: 'auto',
          marginTop: 0,
          paddingTop: 8
        },
        photoContainer: {
          position: 'relative',
          width: 75,
          height: 75,
          marginLeft: 8,
          backgroundColor: COLORS.white,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2
        },
        photoBorder: {
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          border: `2px solid ${COLORS.gold}`,
          borderRadius: 8
        },
        photo: {
          width: '100%',
          height: '100%',
          borderRadius: 6,
          objectFit: 'cover'
        },
        payCodeContainer: {
          marginTop: 8,
          width: '100%',
          paddingHorizontal: 4
        },
        payCodeLabel: {
          fontSize: 5,
          color: COLORS.gold,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold',
          marginBottom: 1
        },
        payCodeValue: {
          fontSize: 12,
          color: COLORS.white,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold'
        },
        decorativeDots: {
          position: 'absolute',
          bottom: 4, left: 4,
          display: 'flex', flexDirection: 'row', flexWrap: 'wrap',
          width: 35, gap: 2
        },
        dot: { width: 2, height: 2, backgroundColor: COLORS.gold, borderRadius: 1 },
        rightSection: {
          width: '65%',
          backgroundColor: COLORS.pink,
          padding: 6,
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        },
        schoolName: {
          fontSize: 8,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.gold,
          marginBottom: 2,
          textAlign: 'center',
          width: '100%'
        },
        phoneNumbers: {
          fontSize: 5,
          color: COLORS.gray.text,
          marginBottom: 6,
          textAlign: 'center',
          width: '100%'
        },
        idTitle: {
          fontSize: 10,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.navy,
          marginBottom: 6,
          textAlign: 'center',
          width: '100%'
        },
        infoRow: {
          borderBottom: `0.5px solid ${COLORS.gray.border}`,
          paddingVertical: 2,
          marginBottom: 4,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        },
        label: {
          fontSize: 7,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.gray.text,
          flex: 1
        },
        value: {
          fontSize: 8,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.navy,
          flex: 2,
          textAlign: 'right'
        },
        qrCodeContainer: {
          position: 'absolute',
          bottom: 6,
          right: 6,
          width: 35,
          height: 35,
          backgroundColor: COLORS.white,
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        },
        qrCode: {
          width: '100%',
          height: '100%'
        }
      });

      const PaymentIDCardPDF = () => (
        <Document>
          <Page size="A4" style={styles.page}>
            <View style={styles.cardContainer}>
              <View style={styles.mainContainer}>
                {/* Left Section */}
                <View style={styles.leftSection}>
                  <View style={styles.hexagonContainer}>
                    <View style={styles.photoContainer}>
                      <View style={styles.photoBorder} />
                      {pupil.photo ? (
                        <Image src={pupil.photo} style={styles.photo} />
                      ) : (
                        <Text style={{ fontSize: 6, textAlign: 'center', color: '#9ca3af' }}>No Photo</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.payCodeContainer}>
                    <Text style={styles.payCodeLabel}>PAY CODE</Text>
                    <Text style={styles.payCodeValue}>{getSchoolPayCode(pupil) || 'N/A'}</Text>
                  </View>
                  <View style={styles.decorativeDots}>
                    {Array(15).fill(null).map((_, i) => <View key={i} style={styles.dot} />)}
                  </View>
                </View>
                {/* Right Section */}
                <View style={styles.rightSection}>
                  <Text style={styles.schoolName}>{schoolInfo.name}</Text>
                  <Text style={styles.phoneNumbers}>TEL: {schoolInfo.phone}</Text>
                  
                  <Text style={styles.idTitle}>PAYMENT ID</Text>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>NAME:</Text>
                    <Text style={styles.value}>
                      {pupil.firstName} {pupil.lastName}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>PIN:</Text>
                    <Text style={styles.value}>{pupil.admissionNumber}</Text>
                  </View>
                  
                  <View style={styles.qrCodeContainer}>
                    <Image src={qrCodeDataURL} style={styles.qrCode} />
                  </View>
                </View>
              </View>
            </View>
          </Page>
        </Document>
      );

      const blob = await ReactPDF.pdf(<PaymentIDCardPDF />).toBlob();
      const safeName = (pupil.firstName + "_" + pupil.lastName).replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_');
      const fileName = `${safeName}_Payment_ID.pdf`;
      
      const fileURL = URL.createObjectURL(blob);
      const printWindow = window.open(fileURL, '_blank');
      if (printWindow) {
        printWindow.focus();
      } else {
        // Fallback to download if popup blocker prevents opening
        const link = document.createElement('a');
        link.href = fileURL;
        link.download = fileName;
        link.click();
      }

      toast({
        title: "Payment ID Generated",
        description: "Payment ID card is ready.",
      });
    } catch (error) {
      console.error('Error generating Payment ID:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate Payment ID card.",
      });
    }
  };

  // Render term fees
  const renderTermFees = (term: string) => {
    // Find SchoolPay unmatched payments for the selected term/year
    const schoolPayGeneralPayments = (pupilPayments as any[]).filter((p: any) =>
        p.feeStructureId === 'schoolpay-general' &&
      !p.reverted &&
      p.academicYearId === selectedAcademicYear?.id &&
      p.termId === selectedTermId
    );

    if (pupilFees.length === 0 && schoolPayGeneralPayments.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="mx-auto h-10 w-10 text-gray-400 flex items-center justify-center font-bold text-2xl">Shs.</div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No fees found</h3>
          <p className="mt-1 text-sm text-gray-500">
            There are no applicable fees configured for this term and class.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {isPaymentDataLoading && (
          <div className="flex items-center justify-center p-3 mb-4 bg-indigo-50 border border-indigo-100 rounded-lg animate-pulse">
            <div className="w-4 h-4 mr-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium text-indigo-700">
              Checking for previous terms balance...
            </span>
          </div>
        )}
        {pupilFees.map((fee: any) => (
          <FeeCard
            key={fee.id}
            fee={fee}
            pupil={pupil!}
            onPayment={handleMakePayment}
            onRevertPayment={handleRevertPayment}
            selectedTerm={selectedTermId}
            selectedAcademicYear={selectedAcademicYear}
            isPaymentDataLoading={isPaymentDataLoading}
            uniformTrackingRecord={
              (fee as any).uniformTrackingRecord ||
              uniformTrackingRecords.find(
                record => record.id === (fee as any).uniformTrackingId
              ) ||
              null
            }
            isUniformTrackingLoading={isUniformTrackingLoading}
            uniformTrackingError={uniformTrackingError}
          />
        ))}

        {/* SchoolPay unmatched payments — shown when a payment could not be matched automatically */}
        {schoolPayGeneralPayments.length > 0 && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">💜</span>
                    <span className="font-semibold text-violet-800 text-sm">SchoolPay Payments (Unmatched)</span>
              <span className="ml-auto text-xs text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full border border-violet-200">
                {schoolPayGeneralPayments.length} payment{schoolPayGeneralPayments.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-violet-600 mb-3">
                    These payments were received via SchoolPay but could not be automatically matched to a specific fee. The money has been received — please manually record it against the correct fee above or contact support.
            </p>
            <div className="space-y-2">
              {schoolPayGeneralPayments.map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-2 border border-violet-100 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-violet-900">
                        {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(payment.amount)}
                      </span>
                          <span className="text-xs text-violet-500 font-mono">via SchoolPay</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {payment.notes?.split('|')[0]?.trim() || 'SchoolPay Payment'} ·{' '}
                      {new Date(payment.paymentDate).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kampala' })}
                    </p>
                  </div>
                  <span className="ml-2 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200 whitespace-nowrap">
                    Needs matching
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-violet-500 mt-2">
              Total unmatched: <span className="font-semibold">{new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(schoolPayGeneralPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0))}</span>
            </p>
          </div>
        )}
      </div>
    );
  };


  // Optimized loading states - show content as soon as basic data is available
  if (isPupilLoading) {
    return (
      <div className="min-h-screen pb-12">
        <GlassPageRouteSkeleton />
      </div>
    );
  }

  // OPTIMIZED: Show loading only if we don't have term/year selected yet
  const isWaitingForTermYear = !selectedTermId || !selectedAcademicYear;
  const shouldShowFullLoading = isPupilFeesLoading && pupil && isWaitingForTermYear;

  if (shouldShowFullLoading) {
    return (
      <div className="min-h-screen pb-12">
        <GlassPageTopBar
          backHref="/fees/collection"
          backLabel="Back to Fees"
          title={`Fees Collection - ${pupil.firstName} ${pupil.lastName}`}
          subtitle={`${pupil.admissionNumber} · ${pupil.className} · ${pupil.section}`}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="space-y-4 animate-pulse">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-white/55 bg-white/65 p-4 shadow-sm backdrop-blur-sm h-28 relative overflow-hidden">
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-pass" />
                  <div className="h-6 bg-slate-200/70 rounded-full w-12 mb-3"></div>
                  <div className="h-4 bg-slate-200/70 rounded-full w-24 mb-2"></div>
                  <div className="h-3 bg-slate-200/70 rounded-full w-32"></div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/55 bg-white/65 p-4 shadow-sm backdrop-blur-sm h-64 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-pass" />
              <div className="flex justify-between items-center mb-4">
                <div className="h-4 bg-slate-200/70 rounded-full w-36"></div>
                <div className="h-8 bg-slate-200/70 rounded-full w-24"></div>
              </div>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-200/70 shrink-0"></div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3 bg-slate-200/70 rounded-full w-1/2"></div>
                      <div className="h-3 bg-slate-200/70 rounded-full w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <GlassPageTopBar
        backHref="/fees/collection"
        backLabel="Back to Fees"
        className="mb-1.5"
        title={
          pupil ? (
            <Link
              href={`/pupil-detail?id=${pupil.id}`}
              className="text-indigo-900 hover:text-indigo-700 hover:underline transition-all duration-300"
            >
              {pupil.firstName} {pupil.lastName}
            </Link>
          ) : 'Loading...'
        }
        subtitle={pupil ? `${pupil.admissionNumber} · ${historicalPupilInfo ? (classes.find(c => c.id === historicalPupilInfo.classId)?.code || historicalPupilInfo.className) : (pupil.classCode || pupil.className || '')} · ${historicalPupilInfo ? historicalPupilInfo.section : (pupil.section || 'N/A')}` : undefined}
        meta={
          (() => {
            const payCode = getSchoolPayCode(pupil);
            return payCode ? (
              <span
                className="inline-flex items-center cursor-pointer"
                onClick={() => setIsManagePayCodeModalOpen(true)}
                title="SchoolPay Payment Code - click to manage"
              >
                <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-px rounded-full font-mono text-[10px] tracking-wide">
                  {payCode}
                </span>
              </span>
            ) : (
              <button
                className="text-[10px] text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
                onClick={() => setIsManagePayCodeModalOpen(true)}
                title="Add SchoolPay payment code"
              >
                + Add Pay Code
              </button>
            );
          })()
        }
        badges={
          <>
            {historicalPupilInfo && (
              (historicalPupilInfo.termHasEnded && historicalPupilInfo.isRealSnapshot) ||
              historicalPupilInfo.className !== pupil?.className
            ) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="text-blue-600 text-xs hover:text-blue-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                    title={historicalPupilInfo.termHasEnded && historicalPupilInfo.isRealSnapshot ? `Historical snapshot (Term ended) - Click to recapture` : `Current class: ${pupil?.classCode || pupil?.className} - Click to recapture`}
                  ><ArrowCounterClockwise className="inline w-3 h-3" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={handleRecaptureSnapshot} disabled={!historicalPupilInfo.isRealSnapshot} className="cursor-pointer">
                    <span className="flex items-center gap-2"><ArrowCounterClockwise className="w-3.5 h-3.5" /><span>Recapture Snapshot</span></span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBatchRecapture} className="cursor-pointer">
                    <span className="flex items-center gap-2"><ArrowCounterClockwise className="w-3.5 h-3.5" /><span>Batch Recapture</span></span>
                  </DropdownMenuItem>
                  {!historicalPupilInfo.isRealSnapshot && <p className="px-2 py-1 text-xs text-gray-500">Single recapture only for ended terms with snapshots</p>}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {historicalPupilInfo && (
              (historicalPupilInfo.termHasEnded && historicalPupilInfo.isRealSnapshot) ||
              historicalPupilInfo.section !== pupil?.section
            ) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="text-blue-600 text-xs hover:text-blue-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                    title={historicalPupilInfo.termHasEnded && historicalPupilInfo.isRealSnapshot ? `Historical snapshot (Term ended) - Click to recapture` : `Current section: ${pupil?.section} - Click to recapture`}
                  ><ArrowCounterClockwise className="inline w-3 h-3" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={handleRecaptureSnapshot} disabled={!historicalPupilInfo.isRealSnapshot} className="cursor-pointer">
                    <span className="flex items-center gap-2"><ArrowCounterClockwise className="w-3.5 h-3.5" /><span>Recapture Snapshot</span></span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBatchRecapture} className="cursor-pointer">
                    <span className="flex items-center gap-2"><ArrowCounterClockwise className="w-3.5 h-3.5" /><span>Batch Recapture</span></span>
                  </DropdownMenuItem>
                  {!historicalPupilInfo.isRealSnapshot && <p className="px-2 py-1 text-xs text-gray-500">Single recapture only for ended terms with snapshots</p>}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {activeAssignments.map((assignment) => {
              const isDiscount = assignment.category === 'Discount';
              const isActive = assignment.isActiveForCurrentTerm;
              let pillStyles = '';
              if (!isActive) pillStyles = 'bg-gray-100 text-gray-400 border-gray-200 opacity-60';
              else if (isDiscount) pillStyles = 'bg-pink-100 text-pink-850 border-pink-250 hover:bg-pink-150/70';
              else pillStyles = 'bg-purple-100 text-purple-800 border-purple-200';
              if (isDiscount) {
                const discountValue = assignment.structure ? (assignment.structure.amount || 0) : 0;
                const displayAmount = `-${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(Math.abs(discountValue))}`;
                let appliesTo = 'All applicable fees';
                const assignmentStructure = assignment.structure;
                if (assignmentStructure?.linkedFeeIds && assignmentStructure.linkedFeeIds.length > 0) {
                  appliesTo = assignmentStructure.linkedFeeIds.map((id: string) => allFeeStructures.find(s => s.id === id)?.name).filter(Boolean).join(', ');
                } else if (assignmentStructure?.linkedFeeId) {
                  appliesTo = allFeeStructures.find(s => s.id === assignmentStructure.linkedFeeId)?.name || 'Linked Fee';
                }
                return (
                  <TooltipProvider key={`assignment-${assignment.id}`}>
                    <Tooltip delayDuration={150}>
                      <TooltipTrigger asChild>
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold border cursor-pointer transition-all shadow-sm select-none', pillStyles)}>
                          {displayAmount}{!isActive && ' (Inactive)'}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={6} className="p-3 bg-white text-gray-900 border border-pink-200 shadow-xl rounded-lg max-w-xs z-[60]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between border-b border-pink-100 pb-1.5 mb-1.5">
                            <span className="font-bold text-xs uppercase tracking-wider text-pink-700 bg-pink-50 border border-pink-200/50 px-1.5 py-0.5 rounded truncate max-w-[140px]" title={assignment.name}>{assignment.name}</span>
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Active Discount</span>
                          </div>
                          <div className="text-xs text-gray-600 flex items-center justify-between">
                            <span className="font-semibold text-gray-700">Value:</span>
                            <span className="font-bold text-pink-700">{displayAmount}</span>
                          </div>
                          {assignment.structure?.description && (
                            <div className="text-xs text-gray-500 italic bg-gray-50 p-1.5 rounded border border-gray-100">"{assignment.structure.description}"</div>
                          )}
                          <div className="text-[11px] text-gray-500 pt-1.5 border-t border-gray-100">
                            <span className="font-semibold text-gray-700 block mb-0.5">Applied To:</span>
                            <span className="text-gray-600 block leading-tight">{appliesTo}</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }
              return (
                <span key={`assignment-${assignment.id}`} className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-medium border transition-all', pillStyles)}>
                  {assignment.name}{!isActive && ' (Inactive)'}
                </span>
              );
            })}
            {uniformTrackingSummary.map((record) => (
              <span
                key={`uniform-${record.id}`}
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-medium border transition-all',
                  record.isFullyCollected
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : record.isPartiallyCollected
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-blue-100 text-blue-800 border-blue-200'
                )}
              >
                <span
                  className={cn(
                    'font-semibold',
                    record.isFullyCollected ? 'text-green-900' : 'text-blue-900'
                  )}
                >
                  {record.isFullyCollected
                    ? 'Uniform Collected:'
                    : record.isPartiallyCollected
                    ? 'Uniform Partial:'
                    : 'Uniform:'}
                </span>
                <span className="flex flex-wrap items-center gap-x-1">
                  {record.items.map((item, itemIdx) => (
                    <span
                      key={item.id}
                      className={cn(
                        item.isFullyCollected && 'line-through opacity-70 text-green-700 font-normal',
                        item.isPartiallyCollected && 'text-amber-800 font-semibold'
                      )}
                    >
                      {item.name}{itemIdx < record.items.length - 1 && <span className="no-underline ml-0.5 opacity-100 text-blue-400">,</span>}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </>
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="Pay"
              tone="emerald"
              icon={<span className="font-bold text-[11px]">Shs.</span>}
              onClick={() => setIsMultiPaymentModalOpen(true)}
              title="Pay Multiple Fees"
            />
            {hasSiblings && (
              <GlassActionButton
                label="Family"
                tone="purple"
                icon={<Users className="w-4 h-4" weight="bold" />}
                onClick={() => {
                  if (!pupil?.familyId) {
                    toast({ title: 'Family ID Missing', description: 'This pupil does not have a family ID.', variant: 'destructive' });
                    return;
                  }
                  router.push(`/fees/family/${pupil.familyId}`);
                }}
                title="Family Accounts"
              />
            )}
            {hasSiblings && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="relative flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full border border-orange-400 bg-white text-orange-600 shadow-sm transition-all duration-300 hover:scale-105 hover:bg-gradient-to-br hover:from-orange-400 hover:via-amber-500 hover:to-orange-600 hover:text-white hover:shadow-md active:scale-95 sm:h-11 sm:w-11"
                    title="Siblings"
                  >
                    <span className="text-sm font-bold mb-0.5" style={{ lineHeight: '1' }}>{siblings.length}</span>
                    <span className="text-[7px] sm:text-[8px] font-semibold leading-tight mt-[-2px]">Siblings</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm font-semibold text-gray-900 border-b mb-1">Select Sibling</div>
                  {siblings.map(sibling => (
                    <DropdownMenuItem key={sibling.id} onClick={() => router.push(`/fees/collect/${sibling.id}`)} className="cursor-pointer flex flex-col items-start py-2">
                      <span className="font-medium text-gray-900">{sibling.firstName} {sibling.lastName}</span>
                      <span className="text-xs text-gray-500">{sibling.className} • {sibling.admissionNumber}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <GlassActionButton
              label="Assign"
              tone="violet"
              icon={<Tag className="w-4 h-4" />}
              onClick={() => setIsAssignmentModalOpen(true)}
              disabled={!pupil?.id}
              title="Assignment & Discounts"
            />
            {(() => {
              const schoolPayCount = (pupilPayments as any[]).filter(
                (p: any) => p.source === 'schoolpay' && !p.reverted &&
                  p.termId === selectedTermId && p.academicYearId === selectedAcademicYear?.id
              ).length;
              return (
                <DropdownMenu open={isWirePopupOpen} onOpenChange={setIsWirePopupOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="relative flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full border border-violet-400 bg-white text-violet-600 shadow-sm transition-all duration-300 hover:scale-105 hover:bg-gradient-to-br hover:from-violet-500 hover:via-purple-500 hover:to-violet-600 hover:text-white hover:shadow-md active:scale-95 sm:h-11 sm:w-11"
                      title="Wire / SchoolPay Options"
                      disabled={!pupil?.id}
                    >
                      {schoolPayCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white z-10">
                          {schoolPayCount > 9 ? '9+' : schoolPayCount}
                        </span>
                      )}
                      <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 mb-0.5" />
                      <span className="text-[7px] sm:text-[8px] font-semibold leading-tight">Wire</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-3 bg-white/95 backdrop-blur-xl border border-violet-100 shadow-2xl rounded-2xl">
                    <div className="mb-3 pb-2 border-b border-violet-100">
                      <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3 h-3" />Wire &amp; Payment Options
                      </p>
                    </div>
                    <div role="menuitem" className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-violet-50 transition-all duration-200 group mb-1" onClick={() => { setIsWirePopupOpen(false); setIsSchoolPayModalOpen(true); }}>
                      <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-violet-50 border border-violet-200 text-violet-600 group-hover:bg-violet-500 group-hover:text-white group-hover:border-violet-500 transition-all duration-200 flex-shrink-0">
                        {schoolPayCount > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-violet-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-white">{schoolPayCount > 9 ? '9+' : schoolPayCount}</span>}
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="min-w-0"><p className="text-[12px] font-semibold text-gray-800 leading-tight">SchoolPay Wire</p><p className="text-[10px] text-gray-500 leading-tight mt-0.5">View mobile money payments</p></div>
                    </div>
                    <div role="menuitem" className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-emerald-50 transition-all duration-200 group mb-1" onClick={() => { setIsWirePopupOpen(false); setIsManagePayCodeModalOpen(true); }}>
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-all duration-200 flex-shrink-0"><Tag className="w-4 h-4" /></div>
                      <div className="min-w-0"><p className="text-[12px] font-semibold text-gray-800 leading-tight">Pay Code</p><p className="text-[10px] text-gray-500 leading-tight mt-0.5">Manage SchoolPay payment code</p></div>
                    </div>
                    <div role="menuitem" className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-blue-50 transition-all duration-200 group" onClick={() => { setIsWirePopupOpen(false); handleGeneratePaymentID(); }}>
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 border border-blue-200 text-blue-600 group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500 transition-all duration-200 flex-shrink-0"><IdentificationCard className="w-4 h-4" weight="bold" /></div>
                      <div className="min-w-0"><p className="text-[12px] font-semibold text-gray-800 leading-tight">Pay ID Card</p><p className="text-[10px] text-gray-500 leading-tight mt-0.5">Print payment ID card (PDF)</p></div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })()}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full border border-blue-400 bg-white text-blue-600 shadow-sm transition-all duration-300 hover:scale-105 hover:bg-gradient-to-br hover:from-blue-400 hover:via-blue-500 hover:to-blue-600 hover:text-white hover:shadow-md active:scale-95 sm:h-11 sm:w-11"
                  title="Tracking Options"
                  disabled={!pupil?.id}
                >
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mb-0.5" />
                  <span className="text-[7px] sm:text-[8px] font-semibold leading-tight">Track</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setIsUniformTrackingModalOpen(true)} className="cursor-pointer">
                  <ClipboardText className="mr-2 h-4 w-4 text-blue-600" weight="bold" />Add Uniform
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { if (pupil?.id) router.push(`/requirement-tracking?id=${pupil.id}`); }} className="cursor-pointer">
                  <ClipboardText className="mr-2 h-4 w-4 text-purple-600" weight="bold" />Requirements
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <GlassActionButton
              label="Print"
              tone="rose"
              icon={<Printer className="w-4 h-4" weight="bold" />}
              onClick={() => setIsPrintModalOpen(true)}
              title="Print"
            />
          </GlassActionDock>
        }
      />

      <Tabs value={selectedTermId} onValueChange={setSelectedTermId} className="w-full">
        <GlassSummaryBar
          left={
            <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2.5 shrink-0 overflow-x-auto">
              {/* Academic Year Selection - Round and compact */}
              <div className="flex shrink-0 items-center">
                <select
                  value={selectedAcademicYear?.id || ''}
                  onChange={(e) => {
                    const year = validAcademicYears.find(year => year.id === e.target.value);
                    setSelectedAcademicYear(year || null);
                    const yearValidTerms = year
                      ? getValidTermsForPupil(year, pupil?.registrationDate, pupil ?? undefined)
                      : [];
                    const activeTerm = year ? getActiveOrMostRecentTerm(year) : null;
                    const defaultTerm = activeTerm && yearValidTerms.find(term => term.id === activeTerm.id)
                      ? activeTerm
                      : [...yearValidTerms].sort(
                        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
                      )[0];
                    setSelectedTermId(defaultTerm?.id || '');
                  }}
                  className="bg-white rounded-full px-2 py-1 sm:px-3 sm:py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-semibold hover:border-gray-300 transition-colors text-[10px] shadow-sm min-w-[90px] sm:min-w-[140px] max-w-[110px] sm:max-w-none"
                  disabled={isLoadingAcademicYears}
                >
                  <option value="">Select Year</option>
                  {[...validAcademicYears].reverse().map((year) => {
                    // Dynamic label based on effective term
                    const isCurrent = year.id === currentAcademicYearId;

                    // Check if year has ended
                    const today = new Date();
                    const yearEnd = new Date(year.endDate);
                    const hasEnded = today > yearEnd;

                    // Determine label: Current, Locked, no label for ended, or Upcoming
                    let label = '';
                    if (isCurrent) {
                      label = '(Current)';
                    } else if (year.isLocked) {
                      label = '(Locked)';
                    } else if (!hasEnded) {
                      label = '(Upcoming)';
                    }
                    // Ended years get no label

                    return (
                      <option key={year.id} value={year.id}>
                        {year.name} {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Term switcher tabs next to year selection */}
              {selectedAcademicYear && validTerms.length > 0 && (
                              <TabsList className="inline-flex h-auto w-auto items-center gap-1 rounded-none border-0 bg-transparent p-0 shadow-none flex-nowrap">
                  {validTerms.map((term, index) => (
                    <TabsTrigger
                      key={term.id}
                      value={term.id}
                      className={`h-6 sm:h-7 shrink-0 rounded-full border-2 bg-white/90 px-2 sm:px-3 py-0 text-[10px] sm:text-[11px] font-bold leading-none transition-all duration-200 ease-out hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 data-[state=inactive]:bg-white/90 whitespace-nowrap ${TERM_TAB_NEON_STYLES[index % TERM_TAB_NEON_STYLES.length]}`}
                    >
                      {term.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}
            </div>
          }
          right={
            <>
              <div className="flex items-center gap-1 bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="text-indigo-700/85 dark:text-indigo-350 font-medium">
                  <span className="sm:hidden">Total</span>
                  <span className="hidden sm:inline">Total Fees:</span>
                </span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(termTotals.totalFees)}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-green-50/80 dark:bg-green-950/20 border border-green-100/50 dark:border-green-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="text-green-700/85 dark:text-green-350 font-medium">
                  <span className="sm:hidden">Paid</span>
                  <span className="hidden sm:inline">Total Paid:</span>
                </span>
                <span className="font-bold text-green-600 dark:text-green-400">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(termTotals.totalPaid)}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-red-50/80 dark:bg-red-950/20 border border-red-100/50 dark:border-red-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="text-red-700/85 dark:text-red-350 font-medium">
                  <span className="sm:hidden">Bal</span>
                  <span className="hidden sm:inline">Balance:</span>
                </span>
                <span className="font-bold text-red-650 dark:text-red-400">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(termTotals.totalBalance)}
                </span>
              </div>
            </>
          }
        />

        <div className="max-w-none px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
            {/* Term content or empty state */}
            {selectedAcademicYear && validTerms.length > 0 ? (
              <div className="px-4 pb-4 pt-4 sm:px-6">
                {validTerms.map((term) => (
                  <TabsContent key={term.id} value={term.id} className="mt-0 focus-visible:outline-none">
                    {/* SchoolPay payment banner for the current term */}
                    {pupil && selectedAcademicYear && (
                      <SchoolPayPaymentBanner
                        payments={pupilPayments}
                        feeStructures={allFeeStructuresFromHook}
                        allAcademicYears={academicYears}
                        selectedTermId={selectedTermId}
                        selectedAcademicYear={selectedAcademicYear}
                        pupilId={pupil.id}
                        onRedistribute={handleRedistribute}
                      />
                    )}

                    {renderTermFees(term.name)}
                  </TabsContent>
                ))}
              </div>
            ) : (
              /* Show message if no valid terms */
              selectedAcademicYear && validTerms.length === 0 && pupil?.registrationDate && (
                <div className="px-4 py-8 text-center">
                  <div className="inline-block rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                    <h3 className="mb-2 font-medium text-yellow-800">No Available Terms</h3>
                    <p className="text-sm text-yellow-700">
                      This pupil was registered after all terms in {selectedAcademicYear.name} had ended.
                      <br />
                      <span className="font-medium">Registration Date:</span> {new Date(pupil.registrationDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </Tabs>

      {/* Modals */}
      {selectedFee && (
        <>
          <PaymentModal
            isOpen={isPaymentModalOpen}
            onClose={() => {
              setIsPaymentModalOpen(false);
              setSelectedFee(null);
            }}
            onSubmit={handlePaymentSubmit}
            fee={selectedFee}
          />

          <CarryForwardPaymentModal
            isOpen={isCarryForwardPaymentModalOpen}
            onClose={() => {
              setIsCarryForwardPaymentModalOpen(false);
              setSelectedFee(null);
            }}
            onSubmit={handleCarryForwardPaymentSubmit}
            fee={{
              feeId: selectedFee.feeId,
              amount: selectedFee.amount,
              name: selectedFee.name,
              balance: selectedFee.balance,
              amountPaid: selectedFee.amountPaid,
              feeBreakdown: selectedFee.feeBreakdown || []
            }}
          />
        </>
      )}

      <PrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        fees={pupilFees}
        pupil={pupil || undefined}
        selectedAcademicYear={selectedAcademicYear}
        selectedTerm={selectedTermId}
        onPrint={handlePrint}
      />

      {/* Multi-fee Payment Modal */}
      {pupil && (
        <MultiFeePaymentModal
          isOpen={isMultiPaymentModalOpen}
          onClose={() => setIsMultiPaymentModalOpen(false)}
          pupilName={`${pupil.firstName} ${pupil.lastName}`}
          fees={pupilFees.map(fee => ({
            id: fee.id,
            name: fee.name,
            balance: fee.balance,
            feeBreakdown: fee.feeBreakdown,
            isCarryForward:
              fee.id === 'previous-balance' ||
              (fee as any).isCarryForward
          }))}
          onPaymentSubmit={handleMultiPayment}
        />
      )}

      {/* Batch Recapture Modal */}
      <BatchRecaptureModal
        isOpen={isBatchRecaptureModalOpen}
        onClose={() => setIsBatchRecaptureModalOpen(false)}
        academicYears={validAcademicYears}
        classes={classes}
        allPupils={allPupils}
        onRecaptureComplete={handleBatchRecaptureComplete}
      />

      {/* Assignment Modal */}
      {pupil && (
        <AssignmentModal
          isOpen={isAssignmentModalOpen}
          onClose={() => setIsAssignmentModalOpen(false)}
          pupil={pupil}
          onSave={handleSaveAssignments}
        />
      )}

      {/* Uniform Tracking Modal */}
      {pupil && (
        <UniformTrackingModal
          isOpen={isUniformTrackingModalOpen}
          onClose={() => setIsUniformTrackingModalOpen(false)}
          onSubmit={async (trackingData) => {
            try {
              await createUniformTrackingMutation.mutateAsync(trackingData);

              // Invalidate and refetch relevant queries to update the fees display
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['pupil', pupil.id] }),
                queryClient.invalidateQueries({ queryKey: ['uniform-tracking', pupil.id] }),
                queryClient.invalidateQueries({ queryKey: ['pupil-fees'] }),
                queryClient.invalidateQueries({ queryKey: ['finance-summary'] }),
              ]);

              // Refetch fees data to show the newly added uniform
              await refetch();

              setIsUniformTrackingModalOpen(false);
              toast({
                title: "Uniform Added",
                description: "Uniform tracking record has been created successfully.",
              });
            } catch (error) {
              console.error('Error creating uniform tracking:', error);
              toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to create uniform tracking record.",
              });
            }
          }}
          pupilId={pupil.id}
          selectedRecord={null}
          eligibleUniforms={finalEligibleUniforms}
        />
      )}

      {/* Requirements Tracking - Navigate to page */}
      {/* Note: Requirements tracking doesn't have a modal component, so we'll keep navigation */}

      {/* Manage Pay Code Modal */}
      {pupil && (
        <ManagePayCodeModal
          isOpen={isManagePayCodeModalOpen}
          onClose={() => setIsManagePayCodeModalOpen(false)}
          onSave={async (payCode) => {
            const existing = (pupil.additionalIdentifiers || []).filter(
              (id) => !(id.idType || '').toLowerCase().includes('pay code')
            );
            const updated = payCode
              ? [...existing, { idType: 'SchoolPay Payment Code', idValue: payCode }]
              : existing;
            const response = await fetch(`/api/pupils/${pupil.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ additionalIdentifiers: updated, payCode: payCode || '' }),
            });
            if (!response.ok) throw new Error('Failed to save pay code');
            await queryClient.invalidateQueries({ queryKey: ['pupil', pupil.id] });
            await queryClient.invalidateQueries({ queryKey: ['pupils'] });
            toast({
              title: payCode ? 'Pay Code Saved' : 'Pay Code Removed',
              description: payCode ? `Pay code set to ${payCode}.` : 'Pay code removed.',
            });
          }}
          currentPayCode={
            getSchoolPayCode(pupil) || null
          }
          pupilName={`${pupil.firstName} ${pupil.lastName}`}
        />
      )}

      {/* SchoolPay payments modal */}
      {isSchoolPayModalOpen && pupil && selectedAcademicYear && (
        <SchoolPayPaymentsModal
          pupilId={pupil.id}
          pupil={pupil}
          feeStructures={allFeeStructuresFromHook}
          allFeeStructures={allFeeStructuresFromHook}
          academicYears={academicYears}
          selectedTermId={selectedTermId}
          selectedAcademicYear={selectedAcademicYear}
          allPayments={pupilPayments}
          onClose={() => setIsSchoolPayModalOpen(false)}
          onRedistribute={(tx) => {
            setIsSchoolPayModalOpen(false);
            handleRedistribute(tx);
          }}
        />
      )}

      {/* SchoolPay redistribute modal */}
      {isRedistributeModalOpen && redistributeTx && pupil && selectedAcademicYear && (
        <SchoolPayRedistributeModal
          transaction={redistributeTx}
          feeStructures={allFeeStructuresFromHook}
          allAcademicYears={academicYears}
          pupil={pupil}
          siblings={siblings}
          selectedTermId={selectedTermId}
          selectedAcademicYear={selectedAcademicYear}
          allPayments={pupilPayments}
          onDone={handleRedistributeDone}
          onClose={() => { setIsRedistributeModalOpen(false); setRedistributeTx(null); }}
        />
      )}


    </div>
  );
}
