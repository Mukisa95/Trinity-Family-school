"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Edit, 
  DollarSign, 
  Package, 
  BookOpen,
  ArrowLeft,
  AlertTriangle,
  ChevronDown,
  RefreshCw,
  Calendar,
  GraduationCap,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  FileText,
  User,
  School
} from 'lucide-react';
import { formatCurrency, parseFormattedMoney } from '@/lib/utils';
import { usePupil } from '@/lib/hooks/use-pupils';
import { useRequirements, useRequirementsByFilter } from '@/lib/hooks/use-requirements';
import { useAcademicYears, useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { 
  useRequirementTrackingByPupilAndTerm,
  useRequirementTrackingByPupilAndAcademicYear, 
  useCreateRequirementTracking, 
  useUpdateRequirementTracking 
} from '@/lib/hooks/use-requirement-tracking';
import { RecessStatusBanner } from '@/components/common/recess-status-banner';
import { RequirementTrackingService } from '@/lib/services/requirement-tracking.service';
import { RequirementTrackingModal } from '@/components/common/requirement-tracking-modal';
import { RequirementPaymentModal } from '@/components/common/requirement-payment-modal';
import { RequirementCoverageModal } from '@/components/common/requirement-coverage-modal';
import { RequirementReleaseModal } from '@/components/common/requirement-release-modal';
import { 
  getCurrentTerm, 
  getTermByDate, 
  getTermLabel, 
  groupRecordsByTerm 
} from '@/lib/utils/academic-year-utils';
import type { 
  RequirementItem, 
  RequirementTracking,
  RequirementTrackingFormData,
  RequirementHistory,
  RequirementPaymentStatus,
  RequirementReleaseStatus,
  RequirementCoverageMode,
  Pupil,
  AcademicYear
} from '@/types';

export default function RequirementTrackingPage() {
  const searchParams = useSearchParams();
  const pupilId = searchParams.get('id');
  
  const [selectedRecord, setSelectedRecord] = useState<RequirementTracking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCoverageModalOpen, setIsCoverageModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [selectedPaymentRecord, setSelectedPaymentRecord] = useState<RequirementTracking | null>(null);
  const [selectedCoverageRecord, setSelectedCoverageRecord] = useState<RequirementTracking | null>(null);
  const [selectedReleaseRecord, setSelectedReleaseRecord] = useState<RequirementTracking | null>(null);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [isYearSelectorOpen, setIsYearSelectorOpen] = useState(false);
  const [isTermSelectorOpen, setIsTermSelectorOpen] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const [autoAssignedTerms, setAutoAssignedTerms] = useState<Set<string>>(new Set());

  // Hooks
  const { data: pupil, isLoading: pupilLoading } = usePupil(pupilId || '');
  const { data: allRequirements = [] } = useRequirements();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  
  const trackingQuery = useRequirementTrackingByPupilAndTerm(pupilId || '', selectedAcademicYearId, selectedTermId);
  const allYearTrackingQuery = useRequirementTrackingByPupilAndAcademicYear(pupilId || '', selectedAcademicYearId);

  const trackingRecords = trackingQuery.data || [];
  const allYearTrackingRecords = allYearTrackingQuery.data || [];
  // Use trackingQuery.isLoading for the loading state of term-specific records
  const trackingLoading = trackingQuery.isLoading; 
  // Ensure refetchTracking is correctly assigned for the term-specific query
  const refetchTracking = trackingQuery.refetch; 

  const createTrackingMutation = useCreateRequirementTracking();
  const updateTrackingMutation = useUpdateRequirementTracking();

  // Get eligible requirements for this pupil
  const { data: eligibleRequirements = [] } = useRequirementsByFilter(
    pupil ? {
      gender: pupil.gender === 'Male' ? 'male' : pupil.gender === 'Female' ? 'female' : 'all',
      classId: pupil.classId,
      section: pupil.section === 'Day' ? 'Day' : pupil.section === 'Boarding' ? 'Boarding' : undefined
    } : {},
    !!pupil
  );

  // Set active academic year and current term as default
  useEffect(() => {
    if (activeAcademicYear && !selectedAcademicYearId) {
      setSelectedAcademicYearId(activeAcademicYear.id);
      
      // Set current term as default
      const currentTerm = getCurrentTerm(activeAcademicYear);
      if (currentTerm && !selectedTermId) {
        setSelectedTermId(currentTerm.id);
      } else if (!selectedTermId && activeAcademicYear.terms.length > 0) {
        // If no current term, default to first term
        setSelectedTermId(activeAcademicYear.terms[0].id);
      }
    }
  }, [activeAcademicYear, selectedAcademicYearId, selectedTermId]);

  // Update term when academic year changes
  useEffect(() => {
    const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);
    if (selectedAcademicYear && selectedAcademicYear.terms.length > 0) {
      // Check if current selected term exists in the new academic year
      const termExists = selectedAcademicYear.terms.some(term => term.id === selectedTermId);
      if (!termExists) {
        // Default to current term or first term
        const currentTerm = getCurrentTerm(selectedAcademicYear);
        setSelectedTermId(currentTerm?.id || selectedAcademicYear.terms[0].id);
      }
    }
  }, [selectedAcademicYearId, academicYears, selectedTermId]);

  // Auto-assign eligible requirements when pupil data loads (only once per term, after data is confirmed)
  useEffect(() => {
    const termKey = `${selectedAcademicYearId}-${selectedTermId}`;

    // Proceed only if all necessary data is loaded and successful
    if (
      pupil &&
      allRequirements.length > 0 &&
      selectedAcademicYearId &&
      selectedTermId &&
      trackingQuery.isSuccess && // Ensure term-specific data fetch is successful
      allYearTrackingQuery.isSuccess && // Ensure year-wide data fetch is successful
      !autoAssignedTerms.has(termKey) // Check if this term has already been processed in this session
    ) {
      // At this point, trackingQuery.data should be the fresh data for the term
      if (trackingQuery.data && trackingQuery.data.length === 0) {
        console.log(`Auto-assigning for term (data loaded and empty): ${termKey}`);
        autoAssignEligibleRequirements().then(() => {
          setAutoAssignedTerms(prev => new Set(prev).add(termKey));
        })
        .catch(error => {
          console.error('Error from autoAssignEligibleRequirements in useEffect:', error);
          // Optionally, you could set an error state here to inform the user
        });
      } else if (trackingQuery.data && trackingQuery.data.length > 0) {
        // Data loaded, records exist, mark as processed to prevent re-assignment attempts
        console.log(`Term ${termKey} already has ${trackingQuery.data.length} records. Marking as processed.`);
        setAutoAssignedTerms(prev => new Set(prev).add(termKey));
      } else if (trackingQuery.data === undefined) {
        // This case should ideally be caught by isSuccess, but as a safeguard:
        console.log(`Term ${termKey} data is undefined even after success, skipping auto-assign.`);
      }
    }
  }, [
    pupil?.id,
    allRequirements.length,
    selectedAcademicYearId,
    selectedTermId,
    trackingQuery.isSuccess, // Dependency for term-specific query success
    trackingQuery.data,      // Dependency for term-specific data
    allYearTrackingQuery.isSuccess, // Dependency for year-wide query success
    allYearTrackingQuery.data,    // Dependency for year-wide data
    autoAssignedTerms
  ]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-dropdown="year"]')) {
        setIsYearSelectorOpen(false);
      }
      if (!target.closest('[data-dropdown="term"]')) {
        setIsTermSelectorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const autoAssignEligibleRequirements = async () => {
    if (!pupil || !selectedAcademicYearId || !selectedTermId || isAutoAssigning) return;

    console.log('Starting auto-assignment for pupil:', pupil.firstName, pupil.lastName);
    console.log('Current tracking records count:', trackingRecords.length);
    console.log('All year tracking records count:', allYearTrackingRecords.length);

    setIsAutoAssigning(true);
    try {
      const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);
      if (!selectedAcademicYear) {
        console.log('No selected academic year found');
        return;
      }

      const selectedTerm = selectedAcademicYear.terms.find(term => term.id === selectedTermId);
      if (!selectedTerm) {
        console.log('No selected term found');
        return;
      }

      const eligibleRequirements = getEligibleRequirements();
      console.log('Eligible requirements found:', eligibleRequirements.length);
      
      // Check which requirements are not yet tracked (with proper duplicate prevention)
      const unassignedRequirements = eligibleRequirements.filter(requirement => {
        // For one-time and yearly requirements, check across all terms in the academic year
        if (requirement.frequency === 'one-time' || requirement.frequency === 'yearly') {
          const isAlreadyTracked = allYearTrackingRecords.some(record => {
            const reqIds = Array.isArray(record.requirementId) 
              ? record.requirementId 
              : [record.requirementId];
            return reqIds.includes(requirement.id);
          });
          console.log(`${requirement.frequency} requirement "${requirement.name}" already tracked:`, isAlreadyTracked);
          return !isAlreadyTracked;
        }
        
        // For termly requirements, only check within the current term
        const isAlreadyTrackedInTerm = trackingRecords.some(record => {
          const reqIds = Array.isArray(record.requirementId) 
            ? record.requirementId 
            : [record.requirementId];
          return reqIds.includes(requirement.id);
        });
        console.log(`Termly requirement "${requirement.name}" already tracked in term:`, isAlreadyTrackedInTerm);
        return !isAlreadyTrackedInTerm;
      });

      console.log('Unassigned requirements to create:', unassignedRequirements.length);
      
      // Auto-assign unassigned requirements
      for (const requirement of unassignedRequirements) {
        console.log('Creating tracking record for:', requirement.name);
        
        // Final safety check: verify this requirement doesn't already exist
        const existsInCurrentTerm = trackingRecords.some(record => {
          const reqIds = Array.isArray(record.requirementId) ? record.requirementId : [record.requirementId];
          return reqIds.includes(requirement.id);
        });
        
        const existsInYear = allYearTrackingRecords.some(record => {
          const reqIds = Array.isArray(record.requirementId) ? record.requirementId : [record.requirementId];
          return reqIds.includes(requirement.id);
        });
        
        // Skip if already exists based on frequency rules
        if (requirement.frequency === 'termly' && existsInCurrentTerm) {
          console.log('Skipping termly requirement (already exists in term):', requirement.name);
          continue;
        }
        
        if ((requirement.frequency === 'one-time' || requirement.frequency === 'yearly') && existsInYear) {
          console.log('Skipping one-time/yearly requirement (already exists in year):', requirement.name);
          continue;
        }
        
        const trackingData = {
          pupilId: pupil.id,
          requirementId: requirement.id,
          academicYearId: selectedAcademicYearId,
          termId: selectedTermId,
          selectionMode: 'item' as const,
                  paidAmount: 0,
        paymentStatus: 'pending' as RequirementPaymentStatus,
        releaseStatus: 'pending' as RequirementReleaseStatus,
        paymentDate: new Date().toISOString(),
        coverageMode: 'cash' as RequirementCoverageMode,
        history: []
        };

        try {
          await createTrackingMutation.mutateAsync(trackingData);
          console.log('Successfully created tracking record for:', requirement.name);
        } catch (error) {
          console.error('Error creating tracking record for', requirement.name, ':', error);
        }
      }

      // Refresh tracking records after auto-assignment
      if (unassignedRequirements.length > 0) {
        console.log('Refreshing tracking records after creating', unassignedRequirements.length, 'new records');
        await refetchTracking();
      } else {
        console.log('No new requirements to assign');
      }
    } catch (error) {
      console.error('Error auto-assigning requirements:', error);
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const cleanupDuplicateRequirements = async () => {
    if (!pupil || !selectedAcademicYearId || isCleaningDuplicates) return;

    setIsCleaningDuplicates(true);
    try {
      console.log('Finding duplicate requirements...');
      const duplicates = await RequirementTrackingService.findDuplicateRecords(pupil.id, selectedAcademicYearId);
      
      if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} duplicate records. Removing...`);
        
        // Delete duplicate records
        for (const duplicate of duplicates) {
          await RequirementTrackingService.deleteTrackingRecord(duplicate.id);
        }
        
        // Refresh tracking records after cleanup
        await refetchTracking();
        
        alert(`Cleaned up ${duplicates.length} duplicate requirement records.`);
      } else {
        console.log('No duplicates found.');
        alert('No duplicate requirements found.');
      }
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      alert('Failed to clean up duplicates. Please try again.');
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleOpenModal = () => {
    setSelectedRecord(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: RequirementTracking) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
  };

  const handleTrackingSubmit = async (formData: RequirementTrackingFormData) => {
    try {
      if (!selectedAcademicYearId || !selectedTermId) return;
      
      const trackingData = {
        pupilId: pupilId!,
        requirementId: formData.requirementId,
        academicYearId: selectedAcademicYearId,
        termId: selectedTermId,
        selectionMode: formData.selectionMode,
        paidAmount: parseFormattedMoney(formData.paidAmount),
        paymentStatus: formData.paymentStatus,
        releaseStatus: formData.releaseStatus,
        paymentDate: new Date().toISOString(),
        coverageMode: formData.coverageMode || 'cash' as RequirementCoverageMode,
        history: []
      };

      if (selectedRecord) {
        await updateTrackingMutation.mutateAsync({
          id: selectedRecord.id,
          data: trackingData
        });
      } else {
        await createTrackingMutation.mutateAsync(trackingData);
      }
      
      handleCloseModal();
    } catch (error) {
      console.error('Error saving tracking record:', error);
      alert('Failed to save tracking record. Please try again.');
    }
  };

  const getEligibleRequirements = () => {
    if (!pupil || !selectedAcademicYearId || !selectedTermId) return [];

    // Get selected academic year and term
    const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);
    const selectedTerm = selectedAcademicYear?.terms.find(term => term.id === selectedTermId);
    
    if (!selectedAcademicYear || !selectedTerm) return [];

    // Determine term number (1, 2, or 3) based on term name or order
    const termNumber = selectedAcademicYear.terms.findIndex(term => term.id === selectedTermId) + 1;
    
    console.log('Getting eligible requirements for term number:', termNumber);
    console.log('All year tracking records:', allYearTrackingRecords.length);
    console.log('Current term tracking records:', trackingRecords.length);

    const eligibleReqs = allRequirements.filter(requirement => {
      // Check gender eligibility
      if (requirement.gender !== 'all' && requirement.gender !== (pupil.gender === 'Male' ? 'male' : 'female')) {
        return false;
      }

      // Check class eligibility
      if (requirement.classType === 'specific' && !requirement.classIds?.includes(pupil.classId || '')) {
        return false;
      }

      // Check section eligibility
      if (requirement.sectionType === 'specific' && requirement.section !== (pupil.section === 'Day' ? 'Day' : 'Boarding')) {
        return false;
      }

      // Check frequency eligibility
      switch (requirement.frequency) {
        case 'termly':
          // Show termly requirements if not already tracked in this specific term
          const hasBeenTrackedThisTerm = trackingRecords.some(record => {
            const reqIds = Array.isArray(record.requirementId) 
              ? record.requirementId 
              : [record.requirementId];
            return reqIds.includes(requirement.id);
          });
          return !hasBeenTrackedThisTerm;
        case 'yearly':
          // Show yearly requirements only in first term AND if not already tracked
          if (termNumber !== 1) return false;
          
          const hasBeenTrackedThisYear = allYearTrackingRecords.some(record => {
            const reqIds = Array.isArray(record.requirementId) 
              ? record.requirementId 
              : [record.requirementId];
            return reqIds.includes(requirement.id);
          });
          return !hasBeenTrackedThisYear;
        case 'one-time':
          // Check if the requirement has already been tracked for this pupil in ANY term of this academic year
          const hasBeenTrackedInYear = allYearTrackingRecords.some(record => {
            const reqIds = Array.isArray(record.requirementId) 
              ? record.requirementId 
              : [record.requirementId];
            return reqIds.includes(requirement.id);
          });
          return !hasBeenTrackedInYear;
        default:
          return false;
      }
    });

    // Sort the eligible requirements
    return sortRequirements(eligibleReqs);
  };

  const getTotalAmount = (requirementId: string | string[]) => {
    if (Array.isArray(requirementId)) {
      return requirementId.reduce((total, id) => {
        const requirement = allRequirements.find(u => u.id === id);
        return total + (requirement?.price || 0);
      }, 0);
    }
    const requirement = allRequirements.find(u => u.id === requirementId);
    return requirement?.price || 0;
  };

  const getBalance = (record: RequirementTracking) => {
    const totalAmount = getTotalAmount(record.requirementId);
    return totalAmount - record.paidAmount;
  };

  // Helper function to get requirement details with quantities
  const getRequirementDetails = (record: RequirementTracking) => {
    const requirements = Array.isArray(record.requirementId)
      ? allRequirements.filter(req => record.requirementId.includes(req.id))
      : allRequirements.filter(req => req.id === record.requirementId);
    
    const totalQuantity = requirements.reduce((sum, req) => sum + (req.quantity || 0), 0);
    const totalAmount = getTotalAmount(record.requirementId);
    const pricePerItem = totalQuantity > 0 ? totalAmount / totalQuantity : 0;
    
    return {
      requirements,
      totalQuantity,
      totalAmount,
      pricePerItem,
      hasQuantities: totalQuantity > 0
    };
  };

  // Helper function to get cash equivalent of items
  const getCashEquivalent = (itemQuantity: number, pricePerItem: number) => {
    return itemQuantity * pricePerItem;
  };

  // Helper function to get item equivalent of cash
  const getItemEquivalent = (cashAmount: number, pricePerItem: number) => {
    return pricePerItem > 0 ? Math.floor(cashAmount / pricePerItem) : 0;
  };

  // Helper function to format payment display with item equivalents
  const formatPaymentDisplay = (record: RequirementTracking) => {
    const details = getRequirementDetails(record);
    const balance = getBalance(record);
    
    if (!details.hasQuantities) {
      return {
        paid: formatCurrency(record.paidAmount),
        balance: formatCurrency(balance)
      };
    }
    
    const paidItemEquivalent = getItemEquivalent(record.paidAmount, details.pricePerItem);
    const balanceItemEquivalent = getItemEquivalent(balance, details.pricePerItem);
    
    return {
      paid: `${formatCurrency(record.paidAmount)} (${paidItemEquivalent} items)`,
      balance: `${formatCurrency(balance)} (${balanceItemEquivalent} items)`
    };
  };

  // Helper function to format individual history entry for display
  const formatHistoryEntry = (entry: RequirementHistory, record: RequirementTracking, currentBalance: number) => {
    const details = getRequirementDetails(record);
    const entryDate = new Date(entry.date);
    
    // For history entries, paidAmount represents the amount paid in this specific transaction
    const transactionAmount = entry.paidAmount;
    
    let actionText = '';
    let balanceText = '';
    
    if (entry.coverageMode === 'item' && entry.itemQuantityProvided) {
      // Item provision
      const itemsProvided = entry.itemQuantityProvided;
      const cashValue = getCashEquivalent(itemsProvided, details.pricePerItem);
      const balanceItemEquivalent = details.hasQuantities ? 
        getItemEquivalent(currentBalance, details.pricePerItem) : 0;
      
      actionText = `Brought ${itemsProvided} items valued at ${formatCurrency(cashValue)}`;
      balanceText = details.hasQuantities ? 
        `Balance: ${balanceItemEquivalent} items valued at ${formatCurrency(currentBalance)}` :
        `Balance: ${formatCurrency(currentBalance)}`;
    } else {
      // Cash payment
      const itemEquivalent = details.hasQuantities ? 
        getItemEquivalent(transactionAmount, details.pricePerItem) : 0;
      const balanceItemEquivalent = details.hasQuantities ?
        getItemEquivalent(currentBalance, details.pricePerItem) : 0;
      
      actionText = details.hasQuantities ?
        `Paid ${formatCurrency(transactionAmount)} valued as ${itemEquivalent} items` :
        `Paid ${formatCurrency(transactionAmount)}`;
      balanceText = details.hasQuantities ?
        `Balance: ${formatCurrency(currentBalance)} valued as ${balanceItemEquivalent} items` :
        `Balance: ${formatCurrency(currentBalance)}`;
    }
    
    return {
      date: entryDate,
      actionText,
      balanceText,
      coverageMode: entry.coverageMode || 'cash',
      receivedBy: entry.receivedBy,
      itemQuantity: entry.itemQuantityProvided,
      cashEquivalent: entry.coverageMode === 'item' && entry.itemQuantityProvided ? 
        getCashEquivalent(entry.itemQuantityProvided, details.pricePerItem) : undefined
    };
  };

  // Helper function to get complete payment history
  const getPaymentHistory = (record: RequirementTracking) => {
    if (!record.history || record.history.length === 0) return [];
    
    return record.history
      .filter(entry => entry.receiptType === 'payment_only' || entry.receiptType === 'payment_and_receipt')
      .map(entry => {
        const date = new Date(entry.date);
        return {
          date,
          amount: entry.paidAmount,
          paymentStatus: entry.paymentStatus,
          location: entry.receiptLocation || 'office',
          isFromParent: entry.receiptLocation === 'class' && !entry.isOfficePayment,
          receivedBy: entry.receivedBy || entry.releasedBy || 'Office Staff',
          itemQuantity: entry.itemQuantityProvided || 0,
          cashEquivalent: entry.paidAmount
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  // Helper function to get receipt history (class receipts only)
  const getReceiptHistory = (record: RequirementTracking) => {
    if (!record.history || record.history.length === 0) return [];
    
    return record.history
      .filter(entry => entry.receiptType === 'receipt_only' || entry.receiptType === 'payment_and_receipt')
      .map(entry => {
        const date = new Date(entry.classReceiptDate || entry.date);
        return {
          date,
          itemQuantity: entry.itemQuantityReceived || 0,
          source: entry.isOfficePayment ? 'office' : 'parent',
          receivedBy: entry.classReceivedBy || 'Class Teacher',
          cashEquivalent: entry.receiptType === 'payment_and_receipt' ? entry.paidAmount : 0,
          receiptType: entry.receiptType
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  // Helper function to calculate running totals for payment history
  const getPaymentHistoryWithTotals = (record: RequirementTracking) => {
    const history = getPaymentHistory(record);
    const details = getRequirementDetails(record);
    const totalRequired = details.totalAmount;
    
    let runningTotal = 0;
    return history.map(entry => {
      runningTotal += entry.amount;
      const remainingBalance = Math.max(0, totalRequired - runningTotal);
      
      return {
        ...entry,
        runningTotal,
        remainingBalance,
        isFullPayment: remainingBalance === 0
      };
    });
  };

  // Helper function to calculate running totals for receipt history
  const getReceiptHistoryWithTotals = (record: RequirementTracking) => {
    const history = getReceiptHistory(record);
    const details = getRequirementDetails(record);
    const totalRequired = details.totalQuantity;
    
    let runningTotal = 0;
    return history.map(entry => {
      runningTotal += entry.itemQuantity;
      const remainingItems = Math.max(0, totalRequired - runningTotal);
      
      return {
        ...entry,
        runningTotal,
        remainingItems,
        isFullReceipt: remainingItems === 0
      };
    });
  };

  const handleOpenPaymentModal = (record: RequirementTracking) => {
    setSelectedPaymentRecord(record);
    setIsPaymentModalOpen(true);
  };

  const handleClosePaymentModal = () => {
    setSelectedPaymentRecord(null);
    setIsPaymentModalOpen(false);
  };

  const handlePaymentSubmit = async (amount: number) => {
    if (!selectedPaymentRecord) return;

    try {
      const totalAmount = getTotalAmount(selectedPaymentRecord.requirementId);
      const newPaidAmount = selectedPaymentRecord.paidAmount + amount;
      const newPaymentStatus: RequirementPaymentStatus = newPaidAmount >= totalAmount ? 'paid' : 'partial';

      // Create history entry
      const historyEntry: RequirementHistory = {
        date: new Date().toISOString(),
        paymentStatus: selectedPaymentRecord.paymentStatus,
        paidAmount: amount,
        coverageMode: 'cash' as RequirementCoverageMode,
        releaseStatus: selectedPaymentRecord.releaseStatus,
        releaseDate: selectedPaymentRecord.releaseDate,
        receivedBy: 'Current User', // TODO: Get from auth context
        academicYearId: selectedAcademicYearId,
        termId: selectedTermId
      };

      const updatedRecord = {
        ...selectedPaymentRecord,
        paidAmount: newPaidAmount,
        paymentStatus: newPaymentStatus,
        paymentDate: new Date().toISOString(),
        receivedBy: 'Current User',
        history: [...(selectedPaymentRecord.history || []), historyEntry]
      };

      await updateTrackingMutation.mutateAsync({
        id: selectedPaymentRecord.id,
        data: updatedRecord
      });

      handleClosePaymentModal();
    } catch (error) {
      console.error('Error updating payment:', error);
    }
  };

  const handleOpenCoverageModal = (record: RequirementTracking) => {
    // Calculate total quantity required if not already set
    const requirements = Array.isArray(record.requirementId)
      ? allRequirements.filter(req => record.requirementId.includes(req.id))
      : allRequirements.filter(req => req.id === record.requirementId);
    
    const totalQuantityRequired = record.totalItemQuantityRequired || 
      requirements.reduce((sum, req) => sum + (req.quantity || 0), 0);
    
    // Update the record with calculated values
    const updatedRecord = {
      ...record,
      totalItemQuantityRequired: totalQuantityRequired,
      itemQuantityProvided: record.itemQuantityProvided || 0,
    };
    
    setSelectedCoverageRecord(updatedRecord);
    setIsCoverageModalOpen(true);
  };

  const handleCloseCoverageModal = () => {
    setSelectedCoverageRecord(null);
    setIsCoverageModalOpen(false);
  };

  const handleCoverageSubmit = async (data: {
    coverageMode: 'cash' | 'item';
    cashAmount?: number;
    itemQuantity?: number;
  }) => {
    if (!selectedCoverageRecord) return;

    try {
      let cashAmountToAdd = data.cashAmount || 0;
      
      // For item coverage mode, calculate cash equivalent
      if (data.coverageMode === 'item' && data.itemQuantity) {
        const totalAmount = getTotalAmount(selectedCoverageRecord.requirementId);
        const totalQuantity = selectedCoverageRecord.totalItemQuantityRequired || 0;
        const pricePerItem = totalQuantity > 0 ? totalAmount / totalQuantity : 0;
        cashAmountToAdd = data.itemQuantity * pricePerItem;
      }

      const updateData: any = {
        paidAmount: selectedCoverageRecord.paidAmount + cashAmountToAdd,
        paymentDate: new Date().toISOString(),
        coverageMode: data.coverageMode,
      };

      // Add item quantity tracking for item coverage mode
      if (data.coverageMode === 'item') {
        updateData.itemQuantityProvided = (selectedCoverageRecord.itemQuantityProvided || 0) + (data.itemQuantity || 0);
        updateData.totalItemQuantityRequired = selectedCoverageRecord.totalItemQuantityRequired;
        updateData.remainingQuantity = updateData.totalItemQuantityRequired - updateData.itemQuantityProvided;
      }

      // Determine new payment status
      const newTotalPaid = updateData.paidAmount;
      const totalAmount = getTotalAmount(selectedCoverageRecord.requirementId);
      
      if (newTotalPaid >= totalAmount) {
        updateData.paymentStatus = 'paid';
      } else if (newTotalPaid > 0) {
        updateData.paymentStatus = 'partial';
      } else {
        updateData.paymentStatus = 'pending';
      }

      // Create history entry
      const historyEntry = {
        date: new Date().toISOString(),
        paymentStatus: selectedCoverageRecord.paymentStatus,
        paidAmount: cashAmountToAdd, // Use calculated cash amount
        coverageMode: data.coverageMode,
        itemQuantityProvided: data.itemQuantity,
        releaseStatus: selectedCoverageRecord.releaseStatus,
        releaseDate: selectedCoverageRecord.releaseDate,
        receivedBy: 'Current User', // TODO: Get from auth context
        academicYearId: selectedAcademicYearId,
        termId: selectedTermId
      };

      updateData.history = [...(selectedCoverageRecord.history || []), historyEntry];

      await updateTrackingMutation.mutateAsync({
        id: selectedCoverageRecord.id,
        data: updateData
      });

      handleCloseCoverageModal();
      refetchTracking();
    } catch (error) {
      console.error('Error updating coverage:', error);
      alert('Failed to update coverage. Please try again.');
    }
  };

  const handleOpenReleaseModal = (record: RequirementTracking) => {
    setSelectedReleaseRecord(record);
    setIsReleaseModalOpen(true);
  };

  const handleCloseReleaseModal = () => {
    setSelectedReleaseRecord(null);
    setIsReleaseModalOpen(false);
  };

  const handleReleaseSubmit = async (releasedItems: string[], isFullRelease: boolean) => {
    if (!selectedReleaseRecord) return;

    try {
      const releasedBy = 'Current User'; // TODO: Get from auth context

      // Create history entry for the current release
      const historyEntry: RequirementHistory = {
        date: new Date().toISOString(),
        paymentStatus: selectedReleaseRecord.paymentStatus,
        paidAmount: selectedReleaseRecord.paidAmount,
        coverageMode: selectedReleaseRecord.coverageMode || 'cash' as RequirementCoverageMode,
        releaseStatus: 'pending',
        releaseDate: new Date().toISOString(),
        releasedBy,
        releasedItems,
        academicYearId: selectedAcademicYearId,
        termId: selectedTermId
      };

      // If this is the final release that completes all items, add an additional history entry
      const allHistory = [...(selectedReleaseRecord.history || []), historyEntry];
      if (isFullRelease) {
        allHistory.push({
          date: new Date().toISOString(),
          paymentStatus: selectedReleaseRecord.paymentStatus,
          paidAmount: selectedReleaseRecord.paidAmount,
          coverageMode: selectedReleaseRecord.coverageMode || 'cash',
          releaseStatus: 'released',
          releaseDate: new Date().toISOString(),
          releasedBy,
          releasedItems: undefined,
          academicYearId: selectedAcademicYearId,
          termId: selectedTermId
        });
      }

      // Combine existing released items with new ones if not a full release
      const updatedReleasedItems = isFullRelease 
        ? undefined
        : [...(selectedReleaseRecord.releasedItems || []), ...releasedItems];

      const updatedRecord = {
        ...selectedReleaseRecord,
        releaseStatus: (isFullRelease ? 'released' : 'pending') as RequirementReleaseStatus,
        releaseDate: isFullRelease ? new Date().toISOString() : selectedReleaseRecord.releaseDate,
        releasedBy: isFullRelease ? releasedBy : selectedReleaseRecord.releasedBy,
        releasedItems: updatedReleasedItems,
        history: allHistory
      };

      await updateTrackingMutation.mutateAsync({
        id: selectedReleaseRecord.id,
        data: updatedRecord
      });

      handleCloseReleaseModal();
    } catch (error) {
      console.error('Error updating release status:', error);
    }
  };

  // Add this helper function to check if all items are released
  const isFullyReleased = (record: RequirementTracking) => {
    if (record.releaseStatus === 'released') return true;
    if (!record.releasedItems || !Array.isArray(record.requirementId)) return false;
    
    // For partial releases, check if all items in requirementId array are in releasedItems
    return record.requirementId.every(id => record.releasedItems?.includes(id));
  };

  // Add helper function to get released items display
  const getReleasedItemsDisplay = (record: RequirementTracking) => {
    if (!record.history) return null;
    
    // Get all release history entries
    const releaseEntries = record.history.filter(h => h.releasedItems && h.releasedItems.length > 0);
    
    if (releaseEntries.length === 0) return null;

    return (
      <div className="space-y-2">
        {releaseEntries.map((entry, index) => {
          const releasedNames = entry.releasedItems?.map(id => 
            allRequirements.find(u => u.id === id)?.name || 'Unknown Item'
          );
          
          return (
            <div key={index} className="text-xs">
              <div className="font-medium">{releasedNames?.join(', ')}</div>
              <div className="text-gray-500">
                Released on: {new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString()}
              </div>
              {entry.receivedBy && (
                <div className="text-gray-500">Released by: {entry.receivedBy}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Get the selected academic year
  const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);

  // Add sorting function for requirements
  const getSortOrder = (requirement: RequirementItem): number => {
    // First, sort by frequency
    const frequencyOrder = {
      'one-time': 0,
      'yearly': 1,
      'termly': 2
    }[requirement.frequency] || 0;

    // Then, sort by specificity (gender, class, section)
    let specificityScore = 0;
    
    // Gender specificity (all = 0, specific = 1)
    specificityScore += requirement.gender === 'all' ? 0 : 1;
    
    // Class specificity (all = 0, specific = 1)
    specificityScore += requirement.classType === 'all' ? 0 : 1;
    
    // Section specificity (all = 0, specific = 1)
    specificityScore += requirement.sectionType === 'all' ? 0 : 1;

    // Combine frequency and specificity
    // Each frequency level is separated by 10 to ensure frequency is primary sort key
    return frequencyOrder * 10 + specificityScore;
  };

  const sortRequirements = (requirements: RequirementItem[]): RequirementItem[] => {
    return [...requirements].sort((a, b) => {
      const orderA = getSortOrder(a);
      const orderB = getSortOrder(b);
      if (orderA === orderB) {
        // If same order, sort by price in descending order
        return b.price - a.price;
      }
      return orderA - orderB;
    });
  };

  // Modern year selector component
  const YearSelector = () => {
    const selectedYearData = academicYears.find(year => year.id === selectedAcademicYearId);
    const isLoading = academicYears.length === 0;
    
    const handleYearChange = (year: AcademicYear) => {
      console.log('Switching to academic year:', year);
      setSelectedAcademicYearId(year.id);
      setIsYearSelectorOpen(false);
    };

    const handleRefresh = async () => {
      try {
        console.log('Manually refreshing academic years...');
        // Academic years will be refreshed automatically via React Query
      } catch (error) {
        console.error('Error refreshing academic years:', error);
      }
    };
    
    return (
      <div className="relative" data-dropdown="year">
        <div className="flex items-center gap-1">
          <Button
            onClick={() => setIsYearSelectorOpen(!isYearSelectorOpen)}
            variant="outline"
            size="sm"
            className="flex items-center gap-1 bg-white border-gray-300 hover:bg-gray-50 shadow-sm text-xs"
            disabled={isLoading}
          >
            <Calendar className="w-3 h-3 text-gray-500" />
            <span className="font-medium">
              {isLoading 
                ? "Loading..." 
                : selectedYearData?.name || activeAcademicYear?.name || 'Select Year'
              }
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </Button>
          <Button
            onClick={handleRefresh}
            variant="ghost"
            size="sm"
            className="p-1 hover:bg-gray-100"
            title="Refresh academic years"
          >
            <RefreshCw className="w-3 h-3 text-gray-500" />
          </Button>
        </div>

        {isYearSelectorOpen && academicYears.length > 0 && (
          <div className="absolute top-full mt-1 w-64 bg-white shadow-lg rounded-md border border-gray-200 py-1 z-50">
            <div className="px-3 py-1 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-900">Academic Year</h3>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {academicYears.map((year) => (
                <button
                  key={year.id}
                  onClick={() => handleYearChange(year)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                    year.id === selectedAcademicYearId ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1">
                        <span className={`text-sm font-medium ${year.id === selectedAcademicYearId ? 'text-blue-900' : 'text-gray-900'}`}>
                          {year.name}
                        </span>
                        {year.isActive && (
                          <Badge variant="default" className="text-xs px-1 py-0 bg-green-100 text-green-800">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(year.startDate).toLocaleDateString()} - {new Date(year.endDate).toLocaleDateString()}
                      </div>
                    </div>
                    {year.id === selectedAcademicYearId && (
                      <CheckCircle className="w-3 h-3 text-blue-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Modern term selector component
  const TermSelector = () => {
    const selectedYearData = academicYears.find(year => year.id === selectedAcademicYearId);
    const selectedTermData = selectedYearData?.terms.find(term => term.id === selectedTermId);
    const isLoading = !selectedYearData || selectedYearData.terms.length === 0;
    
    const handleTermChange = (termId: string) => {
      console.log('Switching to term:', termId);
      setSelectedTermId(termId);
      setIsTermSelectorOpen(false);
    };
    
    return (
      <div className="relative" data-dropdown="term">
        <Button
          onClick={() => setIsTermSelectorOpen(!isTermSelectorOpen)}
          variant="outline"
          size="sm"
          className="flex items-center gap-1 bg-white border-gray-300 hover:bg-gray-50 shadow-sm text-xs"
          disabled={isLoading}
        >
          <Clock className="w-3 h-3 text-gray-500" />
          <span className="font-medium">
            {isLoading 
              ? "No Terms" 
              : selectedTermData?.name || 'Select Term'
            }
          </span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </Button>

        {isTermSelectorOpen && selectedYearData && selectedYearData.terms.length > 0 && (
          <div className="absolute top-full mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-200 py-1 z-50">
            <div className="px-3 py-1 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-900">Term</h3>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {selectedYearData.terms.map((term) => (
                <button
                  key={term.id}
                  onClick={() => handleTermChange(term.id)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                    term.id === selectedTermId ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1">
                        <span className={`text-sm font-medium ${term.id === selectedTermId ? 'text-blue-900' : 'text-gray-900'}`}>
                          {term.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(term.startDate).toLocaleDateString()} - {new Date(term.endDate).toLocaleDateString()}
                      </div>
                    </div>
                    {term.id === selectedTermId && (
                      <CheckCircle className="w-3 h-3 text-blue-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper function to get received quantities
  const getReceivedQuantities = (record: RequirementTracking) => {
    const totalReceived = record.itemQuantityReceived || 0;
    const receivedFromOffice = record.itemQuantityReceivedFromOffice || 0;
    const receivedFromParent = record.itemQuantityReceivedFromParent || 0;
    const details = getRequirementDetails(record);
    const totalRequired = details.totalQuantity;
    const remainingToReceive = Math.max(0, totalRequired - totalReceived);
    
    return {
      totalReceived,
      receivedFromOffice,
      receivedFromParent,
      remainingToReceive,
      totalRequired,
      receiptProgress: totalRequired > 0 ? (totalReceived / totalRequired) * 100 : 0
    };
  };

  // Helper function to format received display
  const formatReceivedDisplay = (record: RequirementTracking) => {
    const details = getRequirementDetails(record);
    const received = getReceivedQuantities(record);
    
    if (!details.hasQuantities) {
      return {
        received: 'N/A (No quantities)',
        remaining: 'N/A'
      };
    }
    
    return {
      received: `${received.totalReceived} items`,
      remaining: received.remainingToReceive > 0 ? `${received.remainingToReceive} remaining` : 'Complete'
    };
  };

  if (!pupil) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading pupil information...</p>
        </div>
      </div>
    );
  }

  // Calculate summary statistics
  const totalRequirements = trackingRecords.length;
  const paidRequirements = trackingRecords.filter(r => r.paymentStatus === 'paid').length;
  const releasedRequirements = trackingRecords.filter(r => r.releaseStatus === 'released').length;
  const totalAmount = trackingRecords.reduce((sum, record) => sum + getTotalAmount(record.requirementId), 0);
  const paidAmount = trackingRecords.reduce((sum, record) => sum + record.paidAmount, 0);
  const paymentProgress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Pupil Info */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {pupil.firstName} {pupil.lastName}
                </h1>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <School className="w-3 h-3" />
                    {pupil.section} Section
                  </span>
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" />
                    {pupil.className}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <YearSelector />
              <TermSelector />
              <Button
                onClick={cleanupDuplicateRequirements}
                disabled={isCleaningDuplicates}
                size="sm"
                variant="outline"
                className="border-orange-600 text-orange-600 hover:bg-orange-50"
              >
                {isCleaningDuplicates ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Clean
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  // Reset auto-assigned terms tracking to allow manual refresh
                  setAutoAssignedTerms(new Set());
                  autoAssignEligibleRequirements();
                }}
                disabled={isAutoAssigning}
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
              >
                {isAutoAssigning ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Auto-Assigning...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Refresh
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">
        {/* Recess Status Banner */}
        <RecessStatusBanner />
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-xs font-medium">Total</p>
                  <p className="text-lg font-bold text-blue-900">{totalRequirements}</p>
                </div>
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-xs font-medium">Paid</p>
                  <p className="text-lg font-bold text-green-900">{paidRequirements}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-600 text-xs font-medium">Released</p>
                  <p className="text-lg font-bold text-purple-900">{releasedRequirements}</p>
                </div>
                <Package className="w-5 h-5 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 text-xs font-medium">Amount</p>
                  <p className="text-sm font-bold text-orange-900">{formatCurrency(totalAmount)}</p>
                </div>
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Progress */}
        {totalAmount > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4" />
                Payment Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Paid: {formatCurrency(paidAmount)}</span>
                  <span>Total: {formatCurrency(totalAmount)}</span>
                </div>
                <Progress value={paymentProgress} className="h-2" />
                <p className="text-xs text-gray-600 text-center">
                  {paymentProgress.toFixed(1)}% completed
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auto-assignment status */}
        {isAutoAssigning && (
          <Alert className="mb-4 border-blue-200 bg-blue-50">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <AlertDescription className="text-blue-800 text-xs">
              Automatically assigning eligible requirements to this pupil...
            </AlertDescription>
          </Alert>
        )}

        {/* Requirements for Selected Term */}
        {trackingRecords.length > 0 && selectedAcademicYear && (
          <Card className="mb-4 shadow-md border-0">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b py-3">
              <CardTitle className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <Calendar className="w-3 h-3 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    {getTermLabel(selectedAcademicYear, selectedTermId)}
                  </h2>
                  <p className="text-xs text-gray-600 font-normal">
                    {trackingRecords.length} requirement{trackingRecords.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-0">
                {trackingRecords.map((record, index) => (
                    <div key={record.id} className={`p-4 ${index !== trackingRecords.length - 1 ? 'border-b border-gray-100' : ''} hover:bg-gray-50 transition-colors`}>
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        {/* Requirement Details */}
                        <div className="lg:col-span-2">
                          <div className="space-y-2">
                            {Array.isArray(record.requirementId) ? (
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  Multiple Requirements
                                </h3>
                                <div className="mt-1 space-y-1">
                                  {sortRequirements(record.requirementId.map(id => 
                                    allRequirements.find(u => u.id === id)
                                  ).filter((r): r is RequirementItem => r !== undefined))
                                    .map(requirement => (
                                      <div key={requirement.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <div>
                                          <span className="text-sm font-medium text-gray-900">{requirement.name}</span>
                                          {requirement.frequency === 'yearly' && (
                                            <p className="text-xs text-amber-600 italic">
                                              (Annual)
                                            </p>
                                          )}
                                          <div className="flex items-center gap-1 mt-1">
                                            <Badge variant="secondary" className="text-xs px-1 py-0">
                                              {requirement.group}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs px-1 py-0">
                                              {requirement.frequency}
                                            </Badge>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <span className="text-sm font-semibold text-gray-900">
                                            {formatCurrency(requirement.price)}
                                          </span>
                                          {requirement.quantity && requirement.quantity > 0 && (
                                            <div className="text-xs text-gray-500">
                                              {requirement.quantity} items @ {formatCurrency(requirement.price / requirement.quantity)} each
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                                <div className="mt-2 p-2 bg-blue-50 rounded">
                                  {(() => {
                                    const details = getRequirementDetails(record);
                                    return (
                                      <div className="space-y-1">
                                        <span className="text-xs font-medium text-blue-900">
                                          Total: {formatCurrency(details.totalAmount)}
                                        </span>
                                        {details.hasQuantities && (
                                          <div className="text-xs text-blue-700">
                                            {details.totalQuantity} items @ {formatCurrency(details.pricePerItem)} each
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : (
                              <div>
                                {(() => {
                                  const requirement = allRequirements.find(u => u.id === record.requirementId);
                                  return requirement ? (
                                    <div>
                                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                                        <FileText className="w-3 h-3" />
                                        {requirement.name}
                                      </h3>
                                      {requirement.frequency === 'yearly' && (
                                        <p className="text-xs text-amber-600 italic mt-1">
                                          (Annual)
                                        </p>
                                      )}
                                      <div className="flex items-center gap-1 mt-1">
                                        <Badge variant="secondary" className="text-xs px-1 py-0">
                                          {requirement.group}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs px-1 py-0">
                                          {requirement.frequency}
                                        </Badge>
                                      </div>
                                      <div className="mt-2 p-2 bg-blue-50 rounded">
                                        <div className="space-y-1">
                                          <span className="text-sm font-bold text-blue-900">
                                            {formatCurrency(requirement.price)}
                                          </span>
                                          {requirement.quantity && requirement.quantity > 0 && (
                                            <div className="text-xs text-blue-700">
                                              {requirement.quantity} items @ {formatCurrency(requirement.price / requirement.quantity)} each
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-red-600">
                                      <XCircle className="w-3 h-3" />
                                      <span className="text-sm">Unknown Requirement</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Payment Status (Office) */}
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            Payment (Office)
                          </h4>
                          <div className="space-y-1">
                            <Badge 
                              variant={record.paymentStatus === 'paid' ? 'default' : record.paymentStatus === 'partial' ? 'secondary' : 'destructive'}
                              className="w-full justify-center py-1 text-xs"
                            >
                              {record.paymentStatus === 'paid' && <CheckCircle className="w-2 h-2 mr-1" />}
                              {record.paymentStatus === 'partial' && <Clock className="w-2 h-2 mr-1" />}
                              {record.paymentStatus === 'pending' && <XCircle className="w-2 h-2 mr-1" />}
                              {(record.paymentStatus || 'pending').charAt(0).toUpperCase() + (record.paymentStatus || 'pending').slice(1)}
                            </Badge>
                            {record.paymentStatus !== 'pending' && (
                              <div className="text-xs text-gray-600 text-center">
                                Paid: <span className="font-medium">{formatPaymentDisplay(record).paid}</span>
                              </div>
                            )}
                            {getBalance(record) > 0 && (
                              <div className="text-xs text-red-600 text-center">
                                Balance: <span className="font-medium">{formatPaymentDisplay(record).balance}</span>
                              </div>
                            )}
                            
                            {/* Payment History */}
                            {(() => {
                              const paymentHistory = getPaymentHistoryWithTotals(record);
                              if (paymentHistory.length === 0) return null;
                              
                              return (
                                <div className="mt-2 pt-1 border-t border-gray-200">
                                  <div className="text-xs text-gray-700 font-medium mb-1 text-center">Payment History</div>
                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {paymentHistory.map((entry, index) => (
                                      <div key={index} className="text-xs bg-blue-50 rounded p-2 border border-blue-100">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center gap-1">
                                            <DollarSign className="w-3 h-3 text-green-600 flex-shrink-0" />
                                            <div className="font-medium text-green-700">
                                              {formatCurrency(entry.amount)}
                                            </div>
                                            {entry.isFromParent && (
                                              <Badge variant="outline" className="text-xs px-1 py-0 bg-green-50 text-green-700 border-green-200">
                                                From Parent
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="text-right">
                                            <div className="font-medium text-blue-700">
                                              Total: {formatCurrency(entry.runningTotal)}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {entry.remainingBalance > 0 ? (
                                          <div className="text-red-600 text-xs mb-1">
                                            Balance: {formatCurrency(entry.remainingBalance)}
                                          </div>
                                        ) : (
                                          <div className="text-green-600 text-xs mb-1 font-medium">
                                            ✓ Fully Paid
                                          </div>
                                        )}
                                        
                                        <div className="flex items-center justify-between text-xs">
                                          <div className="text-gray-500">
                                            <div>{entry.date.toLocaleDateString()}</div>
                                            <div>{entry.date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-gray-500">By:</div>
                                            <div className="font-medium text-gray-700">{entry.receivedBy}</div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                            
                            {/* Payment Action Button */}
                            {getBalance(record) > 0 && (
                              <Button
                                onClick={() => handleOpenCoverageModal(record)}
                                size="sm"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-xs py-1 mt-2"
                              >
                                <DollarSign className="w-2 h-2 mr-1" />
                                Add Payment
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Received Status (Class) */}
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            Received (Class)
                          </h4>
                          <div className="space-y-1">
                            {(() => {
                              const received = getReceivedQuantities(record);
                              const receivedDisplay = formatReceivedDisplay(record);
                              const isFullyReceived = received.remainingToReceive === 0;
                              
                              return (
                                <>
                                  <Badge 
                                    variant={isFullyReceived ? 'default' : received.totalReceived > 0 ? 'secondary' : 'destructive'}
                                    className="w-full justify-center py-1 text-xs"
                                  >
                                    {isFullyReceived && <CheckCircle className="w-2 h-2 mr-1" />}
                                    {!isFullyReceived && received.totalReceived > 0 && <Clock className="w-2 h-2 mr-1" />}
                                    {received.totalReceived === 0 && <XCircle className="w-2 h-2 mr-1" />}
                                    {isFullyReceived ? 'Complete' : received.totalReceived > 0 ? 'Partial' : 'Pending'}
                                  </Badge>
                                  
                                  {received.totalReceived > 0 && (
                                    <div className="text-xs text-gray-600 text-center">
                                      Received: <span className="font-medium">{receivedDisplay.received}</span>
                                    </div>
                                  )}
                                  
                                  {received.remainingToReceive > 0 && (
                                    <div className="text-xs text-orange-600 text-center">
                                      {receivedDisplay.remaining}
                                    </div>
                                  )}
                                  
                                  {/* Receipt Details */}
                                  {(received.receivedFromOffice > 0 || received.receivedFromParent > 0) && (
                                    <div className="mt-2 pt-1 border-t border-gray-200">
                                      <div className="text-xs text-center space-y-1">
                                        {received.receivedFromOffice > 0 && (
                                          <div className="text-blue-600">
                                            From Office: <span className="font-medium">{received.receivedFromOffice}</span>
                                          </div>
                                        )}
                                        {received.receivedFromParent > 0 && (
                                          <div className="text-green-600">
                                            From Parent: <span className="font-medium">{received.receivedFromParent}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Receipt History */}
                                  {(() => {
                                    const receiptHistory = getReceiptHistoryWithTotals(record);
                                    if (receiptHistory.length === 0) return null;
                                    
                                    return (
                                      <div className="mt-2 pt-1 border-t border-gray-200">
                                        <div className="text-xs text-gray-700 font-medium mb-1 text-center">Receipt History</div>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                          {receiptHistory.map((entry, index) => (
                                            <div key={index} className="text-xs bg-green-50 rounded p-2 border border-green-100">
                                              <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1">
                                                  <Package className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                                  <div className="font-medium text-blue-700">
                                                    +{entry.itemQuantity} items
                                                  </div>
                                                  <Badge 
                                                    variant="outline" 
                                                    className={`text-xs px-1 py-0 ${
                                                      entry.source === 'office' 
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                                        : 'bg-green-50 text-green-700 border-green-200'
                                                    }`}
                                                  >
                                                    {entry.source === 'office' ? 'Office' : 'Parent'}
                                                  </Badge>
                                                </div>
                                                <div className="text-right">
                                                  <div className="font-medium text-purple-700">
                                                    Total: {entry.runningTotal} items
                                                  </div>
                                                </div>
                                              </div>
                                              
                                              {entry.cashEquivalent > 0 && (
                                                <div className="text-green-600 text-xs mb-1">
                                                  Cash value: {formatCurrency(entry.cashEquivalent)}
                                                </div>
                                              )}
                                              
                                              {entry.remainingItems > 0 ? (
                                                <div className="text-orange-600 text-xs mb-1">
                                                  Remaining: {entry.remainingItems} items
                                                </div>
                                              ) : (
                                                <div className="text-green-600 text-xs mb-1 font-medium">
                                                  ✓ All Items Received
                                                </div>
                                              )}
                                              
                                              <div className="flex items-center justify-between text-xs">
                                                <div className="text-gray-500">
                                                  <div>{entry.date.toLocaleDateString()}</div>
                                                  <div>{entry.date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                                                </div>
                                                <div className="text-right">
                                                  <div className="text-gray-500">Received by:</div>
                                                  <div className="font-medium text-gray-700">{entry.receivedBy}</div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  
                                  {record.lastClassReceiptDate && (
                                    <div className="text-xs text-gray-500 text-center mt-1">
                                      Last received: {new Date(record.lastClassReceiptDate).toLocaleDateString()}
                                      {record.lastClassReceivedBy && (
                                        <div>By: {record.lastClassReceivedBy}</div>
                                      )}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Release Status & Actions */}
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            Release
                          </h4>
                          <div className="space-y-2">
                            <Badge 
                              variant={record.releaseStatus === 'released' ? 'default' : 'secondary'}
                              className="w-full justify-center py-1 text-xs"
                            >
                              {record.releaseStatus === 'released' ? (
                                <>
                                  <CheckCircle className="w-2 h-2 mr-1" />
                                  Released
                                </>
                              ) : record.releasedItems && record.releasedItems.length > 0 ? (
                                <>
                                  <Clock className="w-2 h-2 mr-1" />
                                  Partial
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-2 h-2 mr-1" />
                                  Pending
                                </>
                              )}
                            </Badge>
                            
                            {record.releaseStatus === 'released' && record.releaseDate && (
                              <div className="text-xs text-gray-500 text-center">
                                <div>{new Date(record.releaseDate).toLocaleDateString()}</div>
                                {record.releasedBy && <div>By: {record.releasedBy}</div>}
                              </div>
                            )}
                            
                            {record.releaseStatus === 'pending' && record.releasedItems && record.releasedItems.length > 0 && (
                              <div className="text-xs text-gray-500">
                                <p className="font-medium mb-1">Released:</p>
                                {getReleasedItemsDisplay(record)}
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-1">
                              {getBalance(record) > 0 && (
                                <Button
                                  onClick={() => handleOpenCoverageModal(record)}
                                  size="sm"
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs py-1"
                                >
                                  <DollarSign className="w-2 h-2 mr-1" />
                                  Cover
                                </Button>
                              )}
                              {!isFullyReleased(record) && (
                                <Button
                                  onClick={() => handleOpenReleaseModal(record)}
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 border-green-600 text-green-600 hover:bg-green-50 text-xs py-1"
                                >
                                  <Package className="w-2 h-2 mr-1" />
                                  Release
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
        )}

        {/* Empty State */}
        {trackingRecords.length === 0 && !isAutoAssigning && (
          <Card className="text-center py-8">
            <CardContent>
              <div className="max-w-sm mx-auto">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Requirements Found
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  No requirements have been assigned to this pupil for the selected term yet. Requirements are automatically assigned based on the pupil's gender, class, section, and term.
                </p>
                <Button
                  onClick={autoAssignEligibleRequirements}
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Check for Requirements
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modals */}
        {pupil && (
          <RequirementTrackingModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onSubmit={handleTrackingSubmit}
            pupilId={pupil.id}
            selectedRecord={selectedRecord}
            eligibleRequirements={getEligibleRequirements()}
          />
        )}

        {selectedPaymentRecord && (
          <RequirementPaymentModal
            isOpen={isPaymentModalOpen}
            onClose={handleClosePaymentModal}
            onSubmit={handlePaymentSubmit}
            fullAmount={getTotalAmount(selectedPaymentRecord.requirementId)}
            paidAmount={selectedPaymentRecord.paidAmount}
            balance={getBalance(selectedPaymentRecord)}
          />
        )}

        {selectedCoverageRecord && (
          <RequirementCoverageModal
            isOpen={isCoverageModalOpen}
            onClose={handleCloseCoverageModal}
            onSubmit={handleCoverageSubmit}
            requirements={Array.isArray(selectedCoverageRecord.requirementId) 
              ? allRequirements.filter(req => selectedCoverageRecord.requirementId.includes(req.id))
              : allRequirements.filter(req => req.id === selectedCoverageRecord.requirementId)
            }
            fullAmount={getTotalAmount(selectedCoverageRecord.requirementId)}
            paidAmount={selectedCoverageRecord.paidAmount}
            balance={getBalance(selectedCoverageRecord)}
            totalQuantityRequired={selectedCoverageRecord.totalItemQuantityRequired}
            itemQuantityProvided={selectedCoverageRecord.itemQuantityProvided}
          />
        )}

        {selectedReleaseRecord && (
          <RequirementReleaseModal
            isOpen={isReleaseModalOpen}
            onClose={handleCloseReleaseModal}
            onSubmit={handleReleaseSubmit}
            requirements={Array.isArray(selectedReleaseRecord.requirementId) 
              ? allRequirements.filter(u => selectedReleaseRecord.requirementId.includes(u.id))
              : allRequirements.filter(u => u.id === selectedReleaseRecord.requirementId)
            }
            selectionMode={selectedReleaseRecord.selectionMode || 'item'}
            previouslyReleasedItems={selectedReleaseRecord.history
              ?.flatMap(h => h.releasedItems || [])
              .filter(Boolean) || []
            }
          />
        )}
      </div>
    </div>
  );
} 