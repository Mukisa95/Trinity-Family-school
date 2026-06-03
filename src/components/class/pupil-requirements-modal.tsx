"use client";

import React, { useState, useEffect } from 'react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
} from '@/components/ui/modern-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Edit, 
  DollarSign, 
  Package, 
  BookOpen,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  FileText,
  User,
  School,
  GraduationCap
} from 'lucide-react';
import { formatCurrency, parseFormattedMoney } from '@/lib/utils';
import { usePupil } from '@/lib/hooks/use-pupils';
import { useRequirements, useRequirementsByFilter } from '@/lib/hooks/use-requirements';
import { useAcademicYears, useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { useAuth } from '@/lib/contexts/auth-context';
import { 
  useRequirementTrackingByPupilAndTerm,
  useRequirementTrackingByPupilAndAcademicYear, 
  useCreateRequirementTracking, 
  useUpdateRequirementTracking 
} from '@/lib/hooks/use-requirement-tracking';
import { RequirementTrackingService } from '@/lib/services/requirement-tracking.service';
import { RequirementReceiveModal } from '@/components/common/requirement-receive-modal';
import { 
  getCurrentTerm, 
  getTermLabel
} from '@/lib/utils/academic-year-utils';
import type { 
  RequirementItem, 
  RequirementTracking,
  RequirementTrackingFormData,
  RequirementHistory,
  RequirementPaymentStatus,
  RequirementReleaseStatus,
  RequirementCoverageMode,
  AcademicYear
} from '@/types';

interface PupilRequirementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupilId: string;
}

export function PupilRequirementsModal({ 
  isOpen, 
  onClose, 
  pupilId 
}: PupilRequirementsModalProps) {
  const { user } = useAuth();
  const { data: pupil, isLoading: pupilLoading } = usePupil(pupilId);
  const { data: allRequirements = [] } = useRequirements();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedReceiveRecord, setSelectedReceiveRecord] = useState<RequirementTracking | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [autoAssignedTerms, setAutoAssignedTerms] = useState<Set<string>>(new Set());

  const createTrackingMutation = useCreateRequirementTracking();
  const updateTrackingMutation = useUpdateRequirementTracking();

  // Helper function to get current user's display name
  const getCurrentUserName = () => {
    if (!user) return 'Class Teacher';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username || 'Class Teacher';
  };

  // 🚀 CRITICAL: Only show loading if we don't have cached data
  // If we have cached data (even if stale), show it immediately
  const hasCachedPupilData = (pupil !== undefined && pupil !== null);
  
  // 🚀 OPTIMIZED: Fetch term-specific records exactly like Requirements Tracking page
  // This ensures consistent behavior and uses cached data immediately
  const trackingQuery = useRequirementTrackingByPupilAndTerm(
    pupilId, 
    selectedAcademicYearId, 
    selectedTermId
  );
  
  // Fetch all year records lazily - only when needed for auto-assignment
  // 🚀 OPTIMIZED: Uses cached data immediately
  const allYearTrackingQuery = useRequirementTrackingByPupilAndAcademicYear(pupilId, selectedAcademicYearId);

  const trackingRecords = trackingQuery.data || [];
  const allYearTrackingRecords = allYearTrackingQuery.data || [];
  
  // 🚀 CRITICAL: Only show loading if we don't have cached data at all
  // If we have cached data (even if stale), show it immediately even if loading in background
  // This matches the Requirements Tracking page behavior exactly
  const hasCachedTrackingData = (trackingRecords.length > 0 || trackingQuery.data !== undefined);
  const trackingLoading = !hasCachedTrackingData && trackingQuery.isLoading; 
  
  // Ensure refetchTracking is correctly assigned for the term-specific query
  const refetchTracking = trackingQuery.refetch;

  // Get eligible requirements for this pupil
  const { data: eligibleRequirements = [] } = useRequirementsByFilter(
    pupil ? {
      gender: pupil.gender === 'Male' ? 'male' : pupil.gender === 'Female' ? 'female' : 'all',
      classId: pupil.classId,
      section: pupil.section === 'Day' ? 'Day' : pupil.section === 'Boarding' ? 'Boarding' : undefined
    } : {},
    !!pupil
  );

  // Reset auto-assigned terms when modal closes or pupil changes
  useEffect(() => {
    if (!isOpen) {
      setAutoAssignedTerms(new Set());
    }
  }, [isOpen, pupilId]);

  // Initialize with active academic year and current term when modal opens
  useEffect(() => {
    if (isOpen && activeAcademicYear && !selectedAcademicYearId) {
      setSelectedAcademicYearId(activeAcademicYear.id);
      const currentTerm = getCurrentTerm(activeAcademicYear);
      if (currentTerm && !selectedTermId) {
        setSelectedTermId(currentTerm.id);
      } else if (!selectedTermId && activeAcademicYear.terms.length > 0) {
        setSelectedTermId(activeAcademicYear.terms[0].id);
      }
    }
  }, [isOpen, activeAcademicYear, selectedAcademicYearId, selectedTermId]);

  // Update term when academic year changes
  useEffect(() => {
    const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);
    if (selectedAcademicYear && selectedAcademicYear.terms.length > 0) {
      const termExists = selectedAcademicYear.terms.some(term => term.id === selectedTermId);
      if (!termExists) {
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
      isOpen && // Only run when modal is open
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
        console.log(`[Modal] Auto-assigning for term (data loaded and empty): ${termKey}`);
        autoAssignEligibleRequirements().then(() => {
          setAutoAssignedTerms(prev => new Set(prev).add(termKey));
        })
        .catch(error => {
          console.error('Error from autoAssignEligibleRequirements in useEffect:', error);
        });
      } else if (trackingQuery.data && trackingQuery.data.length > 0) {
        // Data loaded, records exist, mark as processed to prevent re-assignment attempts
        console.log(`[Modal] Term ${termKey} already has ${trackingQuery.data.length} records. Marking as processed.`);
        setAutoAssignedTerms(prev => new Set(prev).add(termKey));
      } else if (trackingQuery.data === undefined) {
        // This case should ideally be caught by isSuccess, but as a safeguard:
        console.log(`[Modal] Term ${termKey} data is undefined even after success, skipping auto-assign.`);
      }
    }
  }, [
    isOpen, // Add isOpen as dependency
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

  const getEligibleRequirements = () => {
    if (!pupil || !selectedAcademicYearId || !selectedTermId) return [];

    const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);
    const selectedTerm = selectedAcademicYear?.terms.find(term => term.id === selectedTermId);
    
    if (!selectedAcademicYear || !selectedTerm) return [];

    const termNumber = selectedAcademicYear.terms.findIndex(term => term.id === selectedTermId) + 1;

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
          const hasBeenTrackedThisTerm = trackingRecords.some(record => {
            const reqIds = Array.isArray(record.requirementId) 
              ? record.requirementId 
              : [record.requirementId];
            return reqIds.includes(requirement.id);
          });
          return !hasBeenTrackedThisTerm;
        case 'yearly':
          if (termNumber !== 1) return false;
          const hasBeenTrackedThisYear = allYearTrackingRecords.some(record => {
            const reqIds = Array.isArray(record.requirementId) 
              ? record.requirementId 
              : [record.requirementId];
            return reqIds.includes(requirement.id);
          });
          return !hasBeenTrackedThisYear;
        case 'one-time':
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

    return sortRequirements(eligibleReqs);
  };

  const getSortOrder = (requirement: RequirementItem): number => {
    const frequencyOrder = {
      'one-time': 0,
      'yearly': 1,
      'termly': 2
    }[requirement.frequency] || 0;

    let specificityScore = 0;
    specificityScore += requirement.gender === 'all' ? 0 : 1;
    specificityScore += requirement.classType === 'all' ? 0 : 1;
    specificityScore += requirement.sectionType === 'all' ? 0 : 1;

    return frequencyOrder * 10 + specificityScore;
  };

  const sortRequirements = (requirements: RequirementItem[]): RequirementItem[] => {
    return [...requirements].sort((a, b) => {
      const orderA = getSortOrder(a);
      const orderB = getSortOrder(b);
      if (orderA === orderB) {
        return b.price - a.price;
      }
      return orderA - orderB;
    });
  };

  const autoAssignEligibleRequirements = async () => {
    if (!pupil || !selectedAcademicYearId || !selectedTermId || isAutoAssigning) return;

    setIsAutoAssigning(true);
    try {
      const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);
      if (!selectedAcademicYear) {
        setIsAutoAssigning(false);
        return;
      }

      const selectedTerm = selectedAcademicYear.terms.find(term => term.id === selectedTermId);
      if (!selectedTerm) {
        setIsAutoAssigning(false);
        return;
      }

      const eligibleRequirements = getEligibleRequirements();
      const yearRecords = allYearTrackingRecords.length > 0 ? allYearTrackingRecords : [];
      
      const unassignedRequirements = eligibleRequirements.filter(requirement => {
        if (requirement.frequency === 'one-time' || requirement.frequency === 'yearly') {
          if (yearRecords.length === 0) {
            const isAlreadyTracked = trackingRecords.some(record => {
              const reqIds = Array.isArray(record.requirementId) 
                ? record.requirementId 
                : [record.requirementId];
              return reqIds.includes(requirement.id);
            });
            return !isAlreadyTracked;
          }
          const isAlreadyTracked = yearRecords.some(record => {
            const reqIds = Array.isArray(record.requirementId) 
              ? record.requirementId 
              : [record.requirementId];
            return reqIds.includes(requirement.id);
          });
          return !isAlreadyTracked;
        }
        const isAlreadyTrackedInTerm = trackingRecords.some(record => {
          const reqIds = Array.isArray(record.requirementId) 
            ? record.requirementId 
            : [record.requirementId];
          return reqIds.includes(requirement.id);
        });
        return !isAlreadyTrackedInTerm;
      });

      for (const requirement of unassignedRequirements) {
        const existsInCurrentTerm = trackingRecords.some(record => {
          const reqIds = Array.isArray(record.requirementId) ? record.requirementId : [record.requirementId];
          return reqIds.includes(requirement.id);
        });
        
        if (existsInCurrentTerm) {
          continue;
        }
        
        if ((requirement.frequency === 'one-time' || requirement.frequency === 'yearly') && yearRecords.length > 0) {
          const existsInYear = yearRecords.some(record => {
            const reqIds = Array.isArray(record.requirementId) ? record.requirementId : [record.requirementId];
            return reqIds.includes(requirement.id);
          });
          if (existsInYear) {
            continue;
          }
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
        } catch (error) {
          console.error('Error creating tracking record for', requirement.name, ':', error);
        }
      }

      if (unassignedRequirements.length > 0) {
        await refetchTracking();
      }
    } catch (error) {
      console.error('Error auto-assigning requirements:', error);
    } finally {
      setIsAutoAssigning(false);
    }
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

  const formatPaymentDisplay = (record: RequirementTracking) => {
    const details = getRequirementDetails(record);
    const balance = getBalance(record);
    
    if (!details.hasQuantities) {
      return {
        paid: formatCurrency(record.paidAmount),
        balance: formatCurrency(balance)
      };
    }
    
    const paidItemEquivalent = details.pricePerItem > 0 ? Math.floor(record.paidAmount / details.pricePerItem) : 0;
    const balanceItemEquivalent = details.pricePerItem > 0 ? Math.floor(balance / details.pricePerItem) : 0;
    
    return {
      paid: `${formatCurrency(record.paidAmount)} (${paidItemEquivalent} items)`,
      balance: `${formatCurrency(balance)} (${balanceItemEquivalent} items)`
    };
  };

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

  const getPaymentHistoryWithTotals = (record: RequirementTracking) => {
    if (!record.history || record.history.length === 0) return [];
    
    const paymentHistory = record.history
      .filter(entry => {
        const isPaymentEntry = entry.receiptType === 'payment_only' || entry.receiptType === 'payment_and_receipt';
        const hasPaymentAmount = (entry.paidAmount || 0) > 0;
        const noReceiptType = !entry.receiptType;
        return isPaymentEntry || (hasPaymentAmount && noReceiptType);
      })
      .map(entry => {
        const date = new Date(entry.date);
        return {
          date,
          amount: entry.paidAmount || 0,
          paymentStatus: entry.paymentStatus,
          location: entry.receiptLocation || 'office',
          isFromParent: entry.receiptLocation === 'class' && !entry.isOfficePayment,
          receivedBy: entry.receivedBy || entry.releasedBy || getCurrentUserName(),
          itemQuantity: entry.itemQuantityProvided || 0,
          cashEquivalent: entry.paidAmount || 0
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const details = getRequirementDetails(record);
    const totalRequired = details.totalAmount;
    
    const sortedOldestFirst = [...paymentHistory].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    let runningTotal = 0;
    const withTotals = sortedOldestFirst.map(entry => {
      runningTotal += entry.amount;
      const remainingBalance = Math.max(0, totalRequired - runningTotal);
      
      return {
        ...entry,
        runningTotal,
        remainingBalance,
        isFullPayment: remainingBalance === 0
      };
    });
    
    return withTotals.reverse();
  };

  const getReceiptHistoryWithTotals = (record: RequirementTracking) => {
    if (!record.history || record.history.length === 0) return [];
    
    const receiptHistory = record.history
      .filter(entry => entry.receiptType === 'receipt_only' || entry.receiptType === 'payment_and_receipt')
      .map(entry => {
        const date = new Date(entry.classReceiptDate || entry.date);
        return {
          date,
          itemQuantity: entry.itemQuantityReceived || 0,
          source: entry.isOfficePayment ? 'office' : 'parent',
          receivedBy: entry.classReceivedBy || getCurrentUserName(),
          cashEquivalent: entry.receiptType === 'payment_and_receipt' ? entry.paidAmount : 0,
          receiptType: entry.receiptType
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const details = getRequirementDetails(record);
    const totalRequired = details.totalQuantity;
    
    const sortedOldestFirst = [...receiptHistory].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    let runningTotal = 0;
    const withTotals = sortedOldestFirst.map(entry => {
      runningTotal += entry.itemQuantity;
      const remainingItems = Math.max(0, totalRequired - runningTotal);
      
      return {
        ...entry,
        runningTotal,
        remainingItems,
        isFullReceipt: remainingItems === 0
      };
    });
    
    return withTotals.reverse();
  };

  const handleOpenReceiveModal = (record: RequirementTracking) => {
    setSelectedReceiveRecord(record);
    setIsReceiveModalOpen(true);
  };

  const handleCloseReceiveModal = () => {
    setSelectedReceiveRecord(null);
    setIsReceiveModalOpen(false);
  };

  const handleReceiveInClass = async (quantity: number) => {
    if (!selectedReceiveRecord) return;

    try {
      const record = selectedReceiveRecord;
      const details = getRequirementDetails(record);
      const totalRequired = details.totalQuantity;
      const currentReceived = record.itemQuantityReceived || 0;
      const remainingToReceive = Math.max(0, totalRequired - currentReceived);
      
      if (quantity <= 0) {
        alert('Please enter a valid quantity');
        return;
      }

      if (details.hasQuantities && quantity > remainingToReceive) {
        alert(`Quantity cannot exceed remaining items (${remainingToReceive})`);
        return;
      }

      const currentDate = new Date().toISOString();
      const currentUserName = getCurrentUserName();
      const totalAmount = getTotalAmount(record.requirementId);
      
      const needsPaymentUpdate = record.paymentStatus !== 'paid';
      
      let paymentAmountToAdd = 0;
      if (needsPaymentUpdate && details.hasQuantities) {
        const pricePerItem = totalRequired > 0 ? totalAmount / totalRequired : 0;
        paymentAmountToAdd = quantity * pricePerItem;
        paymentAmountToAdd = Math.min(paymentAmountToAdd, totalAmount - record.paidAmount);
      } else if (needsPaymentUpdate && !details.hasQuantities) {
        paymentAmountToAdd = totalAmount - record.paidAmount;
      }
      
      const newPaidAmount = record.paidAmount + paymentAmountToAdd;
      const newPaymentStatus: RequirementPaymentStatus = newPaidAmount >= totalAmount ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'pending');
      
      const newTotalReceived = details.hasQuantities ? (currentReceived + quantity) : (currentReceived + 1);
      
      const historyEntry: RequirementHistory = {
        date: currentDate,
        paymentStatus: needsPaymentUpdate ? newPaymentStatus : record.paymentStatus,
        paidAmount: paymentAmountToAdd,
        coverageMode: details.hasQuantities ? ('item' as RequirementCoverageMode) : ('cash' as RequirementCoverageMode),
        itemQuantityProvided: details.hasQuantities ? quantity : undefined,
        releaseStatus: record.releaseStatus,
        releaseDate: record.releaseDate,
        receivedBy: currentUserName,
        academicYearId: selectedAcademicYearId,
        termId: selectedTermId,
        receiptType: needsPaymentUpdate ? 'payment_and_receipt' as const : 'receipt_only' as const,
        itemQuantityReceived: details.hasQuantities ? quantity : undefined,
        receiptLocation: 'class' as const,
        isOfficePayment: false,
        classReceiptDate: currentDate,
        classReceivedBy: currentUserName
      };

      const updateData: Partial<RequirementTracking> = {
        lastClassReceiptDate: currentDate,
        lastClassReceivedBy: currentUserName,
        history: [...(record.history || []), historyEntry]
      };

      if (details.hasQuantities) {
        updateData.itemQuantityReceived = newTotalReceived;
        updateData.itemQuantityReceivedFromParent = (record.itemQuantityReceivedFromParent || 0) + quantity;
      }

      if (needsPaymentUpdate) {
        updateData.paidAmount = newPaidAmount;
        updateData.paymentStatus = newPaymentStatus;
        updateData.paymentDate = currentDate;
        updateData.receivedBy = currentUserName;
      }

      await updateTrackingMutation.mutateAsync({
        id: record.id,
        data: updateData
      });

      handleCloseReceiveModal();
      refetchTracking();
    } catch (error) {
      console.error('Error recording receipt in class:', error);
      alert('Failed to record receipt. Please try again.');
    }
  };

  const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);
  const selectedYearTerms = selectedAcademicYear?.terms || [];

  if (!isOpen) {
    return null;
  }

  // 🚀 CRITICAL: Only show loading if we don't have cached data at all (first load)
  // If we have cached data (even if stale), show it immediately even if loading in background
  if (!pupil && !hasCachedPupilData && pupilLoading) {
    return (
      <ModernDialog open={isOpen} onOpenChange={onClose}>
        <ModernDialogContent size="xl" open={isOpen} onOpenChange={onClose}>
          <ModernDialogHeader>
            <ModernDialogTitle>Loading Pupil Information...</ModernDialogTitle>
          </ModernDialogHeader>
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-4"></div>
            <p className="text-sm text-gray-600">Loading pupil data...</p>
          </div>
        </ModernDialogContent>
      </ModernDialog>
    );
  }
  
  // 🚀 CRITICAL: If we still don't have pupil after loading, return early
  // This prevents errors when trying to access pupil properties
  if (!pupil) {
    return null;
  }

  // Calculate summary statistics
  const totalRequirements = trackingRecords.length;
  const paidRequirements = trackingRecords.filter(r => r.paymentStatus === 'paid').length;
  const totalAmount = trackingRecords.reduce((sum, record) => sum + getTotalAmount(record.requirementId), 0);
  const paidAmount = trackingRecords.reduce((sum, record) => sum + record.paidAmount, 0);
  const paymentProgress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  return (
    <>
      <ModernDialog open={isOpen} onOpenChange={onClose}>
        <ModernDialogContent size="xl" open={isOpen} onOpenChange={onClose} className="max-h-[90vh] overflow-hidden flex flex-col">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-600" />
                  <span className="font-bold">{pupil.firstName} {pupil.lastName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
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
            </ModernDialogTitle>
          </ModernDialogHeader>

          <div className="flex-1 overflow-y-auto px-1">
            {/* Academic Year & Term Selector - consolidated like requirements tracking page */}
            <div className="mb-4 flex justify-center">
              <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1 h-10">
                <select
                  value={selectedAcademicYearId}
                  onChange={(e) => {
                    const yearId = e.target.value;
                    setSelectedAcademicYearId(yearId);
                    const year = academicYears.find(y => y.id === yearId);
                    const currentTerm = year?.terms.find(t => t.isCurrent);
                    setSelectedTermId(currentTerm?.id || year?.terms[0]?.id || '');
                  }}
                  className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full"
                  style={{ width: 'auto', minWidth: 'fit-content' }}
                >
                  <option value="">Select Year</option>
                  {[...academicYears].reverse().map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
                <div className="w-px h-4 bg-gray-300"></div>
                <select
                  value={selectedTermId}
                  onChange={(e) => setSelectedTermId(e.target.value)}
                  disabled={!selectedAcademicYearId}
                  className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  style={{ width: 'auto', minWidth: 'fit-content' }}
                >
                  {selectedYearTerms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* (Removed verbose Payment Progress block to keep modal compact) */}

            {/* Auto-assignment status */}
            {isAutoAssigning && (
              <Alert className="mb-4 border-blue-200 bg-blue-50">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <AlertDescription className="text-blue-800 text-xs">
                  Automatically assigning eligible requirements to this pupil...
                </AlertDescription>
              </Alert>
            )}

            {/* Requirements List */}
            {trackingLoading || isAutoAssigning ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-4"></div>
                <p className="text-sm text-gray-600">
                  {isAutoAssigning ? 'Checking and assigning requirements...' : 'Loading requirements...'}
                </p>
              </div>
            ) : trackingRecords.length > 0 && selectedAcademicYear ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700 mb-1">
                  {getTermLabel(selectedAcademicYear, selectedTermId)} - {trackingRecords.length} requirement{trackingRecords.length !== 1 ? 's' : ''}
                </div>
                {trackingRecords.map((record) => {
                  const details = getRequirementDetails(record);
                  const received = getReceivedQuantities(record);
                  const receivedDisplay = formatReceivedDisplay(record);
                  const paymentDisplay = formatPaymentDisplay(record);
                  const isFullyReceived = received.remainingToReceive === 0;
                  
                  return (
                    <Card key={record.id} className="border border-gray-200">
                      <CardContent className="p-3 space-y-2">
                        {/* Requirement Name */}
                        {Array.isArray(record.requirementId) ? (
                          <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            Multiple Requirements ({record.requirementId.length})
                          </h3>
                        ) : (
                          (() => {
                            const requirement = allRequirements.find(u => u.id === record.requirementId);
                            return requirement ? (
                              <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {requirement.name}
                              </h3>
                            ) : null;
                          })()
                        )}

                        {/* Two Columns - Payment and Received */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {/* Payment Status */}
                          <div>
                            <h4 className="text-[10px] font-medium text-gray-700 mb-1 flex items-center gap-1">
                              <DollarSign className="w-2.5 h-2.5" />
                              Payment (Office)
                            </h4>
                            <div className="space-y-1">
                              <Badge 
                                variant={record.paymentStatus === 'paid' ? 'default' : record.paymentStatus === 'partial' ? 'secondary' : 'destructive'}
                                className="w-full justify-center py-0.5 px-1.5 text-[10px] h-5"
                              >
                                {record.paymentStatus === 'paid' && <CheckCircle className="w-2.5 h-2.5 mr-0.5" />}
                                {record.paymentStatus === 'partial' && <Clock className="w-2.5 h-2.5 mr-0.5" />}
                                {record.paymentStatus === 'pending' && <XCircle className="w-2.5 h-2.5 mr-0.5" />}
                                {(record.paymentStatus || 'pending').charAt(0).toUpperCase() + (record.paymentStatus || 'pending').slice(1)}
                              </Badge>
                              {record.paymentStatus !== 'pending' && (
                                <div className="text-xs text-gray-600 text-center">
                                  Paid: <span className="font-medium">{paymentDisplay.paid}</span>
                                </div>
                              )}
                              {getBalance(record) > 0 && (
                                <div className="text-xs text-red-600 text-center">
                                  Balance: <span className="font-medium">{paymentDisplay.balance}</span>
                                </div>
                              )}
                              
                              {/* Payment Records */}
                              {(() => {
                                const paymentHistory = getPaymentHistoryWithTotals(record);
                                
                                if (paymentHistory.length === 0 && record.paidAmount > 0 && record.paymentDate) {
                                  const paymentDate = new Date(record.paymentDate);
                                  const receivedBy = record.receivedBy || getCurrentUserName();
                                  
                                  return (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                      <div className="text-xs text-gray-700 font-medium mb-1 text-center">Payment Records</div>
                                      <div className="space-y-1">
                                        <div className="text-xs bg-blue-50 rounded p-2 border border-blue-100">
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1">
                                              <DollarSign className="w-3 h-3 text-green-600 flex-shrink-0" />
                                              <div className="font-medium text-green-700">
                                                {formatCurrency(record.paidAmount)}
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <div className="font-medium text-blue-700">
                                                Total: {formatCurrency(record.paidAmount)}
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {getBalance(record) > 0 ? (
                                            <div className="text-red-600 text-xs mb-1">
                                              Balance: {formatCurrency(getBalance(record))}
                                            </div>
                                          ) : (
                                            <div className="text-green-600 text-xs mb-1 font-medium">
                                              ✓ Fully Paid
                                            </div>
                                          )}
                                          
                                          <div className="flex items-center justify-between text-xs">
                                            <div className="text-gray-500">
                                              <div>{paymentDate.toLocaleDateString()}</div>
                                              <div>{paymentDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                                            </div>
                                            <div className="text-right">
                                              <div className="text-gray-500">By:</div>
                                              <div className="font-medium text-gray-700">{receivedBy}</div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                if (paymentHistory.length === 0) return null;
                                
                                return (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <div className="text-xs text-gray-700 font-medium mb-1 text-center">Payment Records</div>
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
                                              <div className="font-medium text-gray-700">{entry.receivedBy || getCurrentUserName()}</div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Received Status */}
                          <div>
                            <h4 className="text-[10px] font-medium text-gray-700 mb-1 flex items-center gap-1">
                              <Package className="w-2.5 h-2.5" />
                              Received (Class)
                            </h4>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Badge 
                                  variant={isFullyReceived ? 'default' : received.totalReceived > 0 ? 'secondary' : 'destructive'}
                                  className="flex-1 justify-center py-0.5 px-1.5 text-[10px] h-5"
                                >
                                  {isFullyReceived && <CheckCircle className="w-2.5 h-2.5 mr-0.5" />}
                                  {!isFullyReceived && received.totalReceived > 0 && <Clock className="w-2.5 h-2.5 mr-0.5" />}
                                  {received.totalReceived === 0 && <XCircle className="w-2.5 h-2.5 mr-0.5" />}
                                  {isFullyReceived ? 'Complete' : received.totalReceived > 0 ? 'Partial' : 'Pending'}
                                </Badge>
                                {/* Receive Button - same line as status badge */}
                                {(() => {
                                  const hasRemaining = details.hasQuantities ? received.remainingToReceive > 0 : true;
                                  if (!hasRemaining) return null;
                                  
                                  return (
                                    <button
                                      onClick={() => handleOpenReceiveModal(record)}
                                      className="flex flex-col items-center justify-center w-7 h-7 rounded-full bg-white text-green-600 border border-green-400 shadow-sm hover:bg-gradient-to-br hover:from-green-400 hover:via-green-500 hover:to-green-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0"
                                      title="Receive Items"
                                      type="button"
                                    >
                                      <Package className="w-3 h-3 mb-0.5" />
                                      <span className="text-[6px] font-semibold leading-tight">Receive</span>
                                    </button>
                                  );
                                })()}
                              </div>
                              
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
                              
                              {/* Receipt Records */}
                              {(() => {
                                const receiptHistory = getReceiptHistoryWithTotals(record);
                                
                                if (receiptHistory.length === 0 && (record.itemQuantityReceived || 0) > 0 && record.lastClassReceiptDate) {
                                  const receiptDate = new Date(record.lastClassReceiptDate);
                                  const receivedBy = record.lastClassReceivedBy || getCurrentUserName();
                                  const totalReceived = record.itemQuantityReceived || 0;
                                  
                                  return (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                      <div className="text-xs text-gray-700 font-medium mb-1 text-center">Receipt Records</div>
                                      <div className="space-y-1">
                                        <div className="text-xs bg-green-50 rounded p-2 border border-green-100">
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1">
                                              <Package className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                              <div className="font-medium text-blue-700">
                                                +{totalReceived} items
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <div className="font-medium text-purple-700">
                                                Total: {totalReceived} items
                                              </div>
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center justify-between text-xs">
                                            <div className="text-gray-500">
                                              <div>{receiptDate.toLocaleDateString()}</div>
                                              <div>{receiptDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                                            </div>
                                            <div className="text-right">
                                              <div className="text-gray-500">Received by:</div>
                                              <div className="font-medium text-gray-700">{receivedBy}</div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                if (receiptHistory.length === 0) return null;
                                
                                return (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <div className="text-xs text-gray-700 font-medium mb-1 text-center">Receipt Records</div>
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
                                              <div className="font-medium text-gray-700">{entry.receivedBy || getCurrentUserName()}</div>
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
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : !trackingLoading && selectedAcademicYearId && selectedTermId ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No requirements have been assigned to this pupil for the selected term yet.
              </div>
            ) : !selectedAcademicYearId || !selectedTermId ? (
              <div className="text-center py-8 text-gray-500">
                <p>Please select an academic year and term.</p>
              </div>
            ) : null}
          </div>
        </ModernDialogContent>
      </ModernDialog>

      {/* Receive Modal */}
      {selectedReceiveRecord && (
        <RequirementReceiveModal
          isOpen={isReceiveModalOpen}
          onClose={handleCloseReceiveModal}
          onSubmit={handleReceiveInClass}
          totalRequired={(() => {
            const details = getRequirementDetails(selectedReceiveRecord);
            return details.totalQuantity;
          })()}
          currentReceived={selectedReceiveRecord.itemQuantityReceived || 0}
          hasQuantities={(() => {
            const details = getRequirementDetails(selectedReceiveRecord);
            return details.hasQuantities;
          })()}
        />
      )}
    </>
  );
}
