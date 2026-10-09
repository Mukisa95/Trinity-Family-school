"use client";

import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ClipboardList,
  DollarSign,
  Package,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  Calendar,
  RefreshCw,
  Loader2,
  Info
} from 'lucide-react';
import { useRequirements, useRequirementsByFilter, useEnhancedRequirementsByFilter } from '@/lib/hooks/use-requirements';
import { useRequirementTrackingByPupilAndTerm, useRequirementTrackingByPupilAndAcademicYear, useEnhancedRequirementTrackingByPupilAndTerm } from '@/lib/hooks/use-requirement-tracking';
import { useAcademicYears, useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { usePupil } from '@/lib/hooks/use-pupils';
import { formatCurrency } from '@/lib/utils';
import { getCurrentTerm, getTermLabel } from '@/lib/utils/academic-year-utils';
import { formatDateForDisplay } from "@/lib/utils/date-utils";
import type { RequirementTracking, RequirementItem, RequirementPaymentStatus, RequirementHistory } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PupilRequirementsSectionProps {
  pupilId: string;
}

interface RequirementWithStatus {
  requirement: RequirementItem;
  trackingRecord?: RequirementTracking;
  status: 'not_assigned' | 'pending' | 'partial' | 'paid';
  totalAmount: number;
  paidAmount: number;
  balance: number;
  isEligible: boolean;
}

export function PupilRequirementsSection({ pupilId }: PupilRequirementsSectionProps) {
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [isYearSelectorOpen, setIsYearSelectorOpen] = useState(false);
  const [isTermSelectorOpen, setIsTermSelectorOpen] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  // Hooks
  const { data: pupil, isLoading: isPupilLoading } = usePupil(pupilId);
  const { data: allRequirements = [], isFetching: isFetchingRequirements } = useRequirements();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  
  // Use enhanced tracking with data integrity
  const trackingQuery = useEnhancedRequirementTrackingByPupilAndTerm(pupil || null, selectedTermId, activeAcademicYear || null);
  const allYearTrackingQuery = useRequirementTrackingByPupilAndAcademicYear(pupilId, selectedAcademicYearId);

  // Get eligible requirements for this pupil with enhanced data integrity
  const { data: eligibleRequirements = [], isFetching: isFetchingEligibleRequirements } = useEnhancedRequirementsByFilter(
    pupil || null,
    selectedTermId,
    activeAcademicYear || null,
    academicYears
  );

  const trackingRecords = trackingQuery.data || [];
  const allYearTrackingRecords = allYearTrackingQuery.data || [];
  const isLoading = trackingQuery.isLoading || isPupilLoading;
  const isFetchingData = trackingQuery.isFetching || allYearTrackingQuery.isFetching || isFetchingRequirements || isFetchingEligibleRequirements;

  // Add refresh functionality
  const handleRefresh = async () => {
    try {
      await Promise.all([
        trackingQuery.refetch(),
        allYearTrackingQuery.refetch()
      ]);
    } catch (error) {
      console.error('Error refreshing requirements data:', error);
    }
  };

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

  // Process requirements with their tracking status
  const requirementsWithStatus = useMemo((): RequirementWithStatus[] => {
    if (!pupil || !selectedAcademicYearId || !selectedTermId) return [];

    const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);
    const selectedTerm = selectedAcademicYear?.terms.find(term => term.id === selectedTermId);
    if (!selectedAcademicYear || !selectedTerm) return [];

    // Determine term number (1, 2, or 3) based on term order
    const termNumber = selectedAcademicYear.terms.findIndex(term => term.id === selectedTermId) + 1;

    return eligibleRequirements
      .filter(requirement => {
        // Filter requirements based on frequency for the selected term
        switch (requirement.frequency) {
          case 'termly':
            return true; // Show termly requirements for all terms
          case 'yearly':
            return termNumber === 1; // Show yearly requirements only in first term
          case 'one-time':
            return true; // Show one-time requirements (but check if already fulfilled)
          default:
            return true;
        }
      })
      .map(requirement => {
        // Find tracking record for this requirement
        const trackingRecord = trackingRecords.find(record => {
          const reqIds = Array.isArray(record.requirementId) 
            ? record.requirementId 
            : [record.requirementId];
          return reqIds.includes(requirement.id);
        });

        // Check if requirement was already fulfilled in this academic year (for yearly/one-time requirements)
        const wasAlreadyFulfilled = requirement.frequency === 'yearly' || requirement.frequency === 'one-time' 
          ? allYearTrackingRecords.some(record => {
              const reqIds = Array.isArray(record.requirementId) 
                ? record.requirementId 
                : [record.requirementId];
              return reqIds.includes(requirement.id) && record.paymentStatus === 'paid';
            })
          : false;

        const totalAmount = requirement.price || 0;
        const paidAmount = trackingRecord?.paidAmount || 0;
        const balance = totalAmount - paidAmount;

        let status: RequirementWithStatus['status'] = 'not_assigned';
        if (trackingRecord) {
          if (trackingRecord.paymentStatus === 'paid' && balance <= 0) {
            status = 'paid';
          } else if (paidAmount > 0) {
            status = 'partial';
          } else {
            status = 'pending';
          }
        } else if (wasAlreadyFulfilled) {
          status = 'paid';
        }

        return {
          requirement,
          trackingRecord,
          status,
          totalAmount,
          paidAmount,
          balance,
          isEligible: true
        };
      })
      .sort((a, b) => {
        // Sort by group first, then by name
        if (a.requirement.group !== b.requirement.group) {
          return a.requirement.group.localeCompare(b.requirement.group);
        }
        return a.requirement.name.localeCompare(b.requirement.name);
      });
  }, [pupil, eligibleRequirements, trackingRecords, allYearTrackingRecords, selectedAcademicYearId, selectedTermId, academicYears]);

  const summary = useMemo(() => {
    const totalRequirements = requirementsWithStatus.length;
    const completedRequirements = requirementsWithStatus.filter(r => r.status === 'paid').length;
    const totalAmount = requirementsWithStatus.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalPaid = requirementsWithStatus.reduce((sum, r) => sum + r.paidAmount, 0);
    const totalBalance = totalAmount - totalPaid;

    return {
      totalRequirements,
      completedRequirements,
      totalAmount,
      totalPaid,
      totalBalance,
      progress: totalRequirements > 0 ? (completedRequirements / totalRequirements) * 100 : 0
    };
  }, [requirementsWithStatus]);

  // Helper functions
  const getRequirementDetails = (requirementId: string | string[]) => {
    if (Array.isArray(requirementId)) {
      return requirementId.map(id => allRequirements.find(r => r.id === id)).filter(Boolean) as RequirementItem[];
    }
    const requirement = allRequirements.find(r => r.id === requirementId);
    return requirement ? [requirement] : [];
  };

  const getTotalAmount = (requirementId: string | string[]) => {
    const requirements = getRequirementDetails(requirementId);
    return requirements.reduce((total, req) => total + (req?.price || 0), 0);
  };

  const getBalance = (record: RequirementTracking) => {
    const totalAmount = getTotalAmount(record.requirementId);
    return totalAmount - record.paidAmount;
  };

  // Helper function to get requirement details with quantities
  const getRequirementDetailsWithQuantities = (record: RequirementTracking) => {
    const requirements = getRequirementDetails(record.requirementId);
    const totalQuantity = requirements.reduce((sum, req) => sum + (req?.quantity || 0), 0);
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
    const details = getRequirementDetailsWithQuantities(record);
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
  const formatHistoryEntry = (entry: any, record: RequirementTracking, currentBalance: number) => {
    const details = getRequirementDetailsWithQuantities(record);
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
      receivedBy: entry.receivedBy
    };
  };

  // Helper function to get complete payment history filtered by term
  const getPaymentHistory = (record: RequirementTracking, filterByTerm: boolean = true) => {
    if (!record.history || record.history.length === 0) return [];
    
    // Filter history entries by selected term if filterByTerm is true
    let filteredHistory = record.history;
    if (filterByTerm && selectedTermId) {
      filteredHistory = record.history.filter((entry: RequirementHistory) => {
        // Include entries that match the selected term, or entries without term info (legacy data)
        return !entry.termId || entry.termId === selectedTermId;
      });
    }
    
    // Filter and sort payment history entries
    const paymentEntries = filteredHistory
      .filter((entry: any) => entry.paidAmount > 0 || entry.itemQuantityReceived > 0) // Entries with payments or items received
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort newest first
    
    const details = getRequirementDetailsWithQuantities(record);
    const totalAmount = details.totalAmount;
    
    // Calculate running balances for each entry (reverse order for display)
    let runningTotal = 0;
    const sortedEntries = [...paymentEntries].reverse(); // Reverse to calculate from oldest to newest
    sortedEntries.forEach((entry: any) => {
      runningTotal += entry.paidAmount || 0;
    });
    
    // Now map in display order (newest first)
    return paymentEntries.map((entry: any) => {
      const entryAmount = entry.paidAmount || 0;
      runningTotal -= entryAmount; // Subtract from running total (going backwards)
      const balanceAtThisPoint = totalAmount - runningTotal;
      return formatHistoryEntry(entry, record, balanceAtThisPoint);
    });
  };

  const getStatusIcon = (status: RequirementWithStatus['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />;
      case 'partial':
        return <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />;
      case 'not_assigned':
        return null;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-400 dark:text-slate-400" />;
    }
  };

  const getStatusBadge = (status: RequirementWithStatus['status'], balance: number) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800/60">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-800/60">Partially Paid</Badge>;
      case 'pending':
        return <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800/60">Pending</Badge>;
      case 'not_assigned':
        return <Badge variant="outline" className="border-gray-300 text-gray-600 dark:border-slate-700 dark:text-slate-300">Not Assigned</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getRequirementIcon = (group: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'fees': <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />,
      'uniforms': <Package className="w-4 h-4 text-brand-ink-600 dark:text-brand-ink-400" />,
      'stationery': <BookOpen className="w-4 h-4 text-brand-secondary-ink-600 dark:text-brand-secondary-ink-400" />,
      'books': <BookOpen className="w-4 h-4 text-orange-600 dark:text-orange-400" />,
      'equipment': <Package className="w-4 h-4 text-gray-600 dark:text-slate-300" />,
      'other': <ClipboardList className="w-4 h-4 text-gray-600 dark:text-slate-300" />
    };
    return iconMap[group.toLowerCase()] || <ClipboardList className="w-4 h-4 text-gray-600 dark:text-slate-300" />;
  };

  // Main component render
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 dark:text-slate-400" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header with Avatar */}
      <div className="flex items-center space-x-3 mb-4">
        <Avatar className="h-12 w-12">
          {pupil?.photo && pupil.photo.trim() !== '' ? (
            <AvatarImage 
              src={pupil.photo} 
              alt={`${formatPupilDisplayName(pupil)}`}
              onError={(e) => {
                console.log('Avatar image failed to load:', pupil.photo);
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <AvatarFallback className="text-lg bg-gradient-to-br from-brand-surface-500 to-brand-secondary-surface-600 text-white font-semibold">
            {pupil?.firstName?.charAt(0)}{pupil?.lastName?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-lg md:text-xl font-semibold tracking-tight">
          Requirements Information
        </h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Progress</CardTitle>
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg md:text-xl font-bold">{summary.completedRequirements} of {summary.totalRequirements}</div>
            <p className="text-xs text-muted-foreground">Received</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Financial</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg md:text-xl font-bold">{formatCurrency(summary.totalPaid)}</div>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(summary.totalAmount)}
            </p>
          </CardContent>
        </Card>
        
        <div className="col-span-2 md:col-span-1">
        <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Academic Period</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 flex gap-2">
                <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map(year => (
                        <SelectItem key={year.id} value={year.id} className="text-xs">{year.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Term" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.find(y => y.id === selectedAcademicYearId)?.terms.map(term => (
                        <SelectItem key={term.id} value={term.id} className="text-xs">{term.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
          </CardContent>
        </Card>
            </div>
      </div>

      {/* Requirements List */}
      <div className="space-y-4">
        {requirementsWithStatus.length === 0 && !isFetchingData && (
          <div className="text-center py-10">
            <div className="max-w-sm mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-slate-900">
                <ClipboardList className="w-8 h-8 text-gray-400 dark:text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-slate-100">
                No Requirements Found
              </h3>
              <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
                No requirements are applicable for the selected term. This could be because:
                <br />• No requirements have been created for this term yet
                <br />• All requirements for this term have been completed
                <br />• Requirements may be configured for different terms
              </p>
              <Button
                onClick={() => {
                  trackingQuery.refetch();
                }}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </div>
      )}
          {requirementsWithStatus.map((reqWithStatus, index) => {
            const { requirement, trackingRecord, status, totalAmount, paidAmount, balance } = reqWithStatus;
            const paymentHistory = trackingRecord ? getPaymentHistory(trackingRecord) : [];
          const isExpanded = expandedCard === index;

            return (
              <motion.div
                key={requirement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="p-3">
                     <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getRequirementIcon(requirement.group)}
                            <h4 className="font-semibold text-gray-900 dark:text-slate-100">
                                {requirement.name}
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="hidden sm:block text-right flex-shrink-0">
                              <p className="text-xs text-gray-500 dark:text-slate-400">Status</p>
                              {getStatusBadge(status, balance)}
                           </div>
                           <div className="flex-shrink-0">
                              {getStatusIcon(status)}
                           </div>
                           <Button variant="ghost" size="icon" onClick={() => setExpandedCard(isExpanded ? null : index)}>
                              <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                           </Button>
                        </div>
                     </div>
                  </CardHeader>

                  <CardContent className="p-3 pt-0">
                    <div className="space-y-3">
                        {/* Enhanced Summary */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-slate-300">Total Amount</p>
                             <p className="font-semibold text-gray-800 dark:text-slate-100">{formatCurrency(totalAmount)}</p>
                          </div>
                           <div>
                            <p className="text-gray-600 dark:text-slate-300">Paid</p>
                            <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(paidAmount)}</p>
                          </div>
                           <div>
                            <p className="text-gray-600 dark:text-slate-300">Balance</p>
                            <p className={`font-semibold ${balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {formatCurrency(balance)}
                            </p>
                          </div>
                          {requirement.quantity && requirement.quantity > 0 && (
                            <div>
                              <p className="text-gray-600 dark:text-slate-300">Items Received</p>
                              <p className="font-semibold text-gray-800 dark:text-slate-100">
                                {trackingRecord?.itemQuantityReceived || 0} of {requirement.quantity}
                              </p>
                            </div>
                          )}
                        </div>
                    </div>
                  </CardContent>

                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="px-6 pb-4 bg-gray-50/50 dark:bg-slate-900/50"
                  >
                    <div className="border-t pt-4 space-y-4">
                      {/* Payment History Section */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Transaction History
                            {selectedTermId && (
                              <Badge variant="outline" className="text-xs">
                                {academicYears.find(y => y.id === selectedAcademicYearId)?.terms.find(t => t.id === selectedTermId)?.name || 'Current Term'}
                              </Badge>
                            )}
                          </h4>
                          {trackingRecord && trackingRecord.history && trackingRecord.history.length > 0 && (
                            <span className="text-xs text-gray-500 dark:text-slate-400">
                              {getPaymentHistory(trackingRecord, true).length} entries
                            </span>
                          )}
                        </div>
                        {trackingRecord ? (
                          (() => {
                            const historyEntries = getPaymentHistory(trackingRecord, true);
                            return historyEntries.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {historyEntries.map((historyItem: any, idx: number) => {
                                  const entry = trackingRecord.history?.find((h: RequirementHistory) => 
                                    new Date(h.date).getTime() === historyItem.date.getTime()
                                  );
                                  const termInfo = entry?.termId 
                                    ? academicYears
                                        .flatMap(y => y.terms.map(t => ({ ...t, yearId: y.id, yearName: y.name })))
                                        .find(t => t.id === entry.termId)
                                    : null;
                                  
                                  return (
                                    <div key={idx} className="bg-white rounded-md border p-3 hover:shadow-sm transition-shadow dark:bg-slate-900">
                                      <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                          <Calendar className="w-3 h-3 text-gray-400 dark:text-slate-400" />
                                          <span className="text-xs text-gray-600 dark:text-slate-300">
                                            {historyItem.date.toLocaleDateString('en-GB', {
                                              day: '2-digit',
                                              month: 'short',
                                              year: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </span>
                                          {termInfo && (
                                            <Badge variant="outline" className="text-xs">
                                              {termInfo.name}
                                            </Badge>
                                          )}
                                        </div>
                                        {(entry?.paidAmount || 0) > 0 && (
                                          <span className="font-medium text-green-600 text-sm dark:text-green-400">
                                            {formatCurrency(entry?.paidAmount || 0)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-700 mb-1 dark:text-slate-200">
                                        {historyItem.actionText}
                                      </div>
                                      {historyItem.balanceText && (
                                        <div className="text-xs text-gray-500 dark:text-slate-400">
                                          {historyItem.balanceText}
                                        </div>
                                      )}
                                      {entry?.receivedBy && (
                                        <div className="text-xs text-gray-500 mt-1 dark:text-slate-400">
                                          Received by: {entry.receivedBy}
                                        </div>
                                      )}
                                      {entry?.itemQuantityReceived && entry.itemQuantityReceived > 0 && (
                                        <div className="text-xs text-brand-ink-600 mt-1 dark:text-brand-ink-400">
                                          Items received: {entry.itemQuantityReceived}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md text-center dark:text-slate-400 dark:bg-slate-900">
                                No transaction history for this term.
                                {trackingRecord.history && trackingRecord.history.length > 0 && (
                                  <div className="text-xs mt-1">
                                    (History exists for other terms)
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md text-center dark:text-slate-400 dark:bg-slate-900">
                            No payment history available.
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
                </Card>
              </motion.div>
            );
          })}
        </div>
    </motion.div>
  );
}
