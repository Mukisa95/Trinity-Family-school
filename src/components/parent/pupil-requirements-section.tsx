"use client";

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
  const trackingQuery = useEnhancedRequirementTrackingByPupilAndTerm(pupil, selectedTermId, activeAcademicYear);
  const allYearTrackingQuery = useRequirementTrackingByPupilAndAcademicYear(pupilId, selectedAcademicYearId);

  // Get eligible requirements for this pupil with enhanced data integrity
  const { data: eligibleRequirements = [], isFetching: isFetchingEligibleRequirements } = useEnhancedRequirementsByFilter(
    pupil,
    selectedTermId,
    activeAcademicYear,
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

  // Helper function to get complete payment history
  const getPaymentHistory = (record: RequirementTracking) => {
    if (!record.history || record.history.length === 0) return [];
    
    // Filter and sort payment history entries
    const paymentEntries = record.history
      .filter((entry: any) => entry.paidAmount > 0) // Only entries with payments
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort chronologically
    
    const details = getRequirementDetailsWithQuantities(record);
    const totalAmount = details.totalAmount;
    
    // Calculate running balances for each entry
    let runningTotal = 0;
    return paymentEntries.map((entry: any) => {
      runningTotal += entry.paidAmount;
      const balanceAtThisPoint = totalAmount - runningTotal;
      return formatHistoryEntry(entry, record, balanceAtThisPoint);
    });
  };

  const getStatusIcon = (status: RequirementWithStatus['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'partial':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'not_assigned':
        return null;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: RequirementWithStatus['status'], balance: number) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Partially Paid</Badge>;
      case 'pending':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Pending</Badge>;
      case 'not_assigned':
        return <Badge variant="outline" className="border-gray-300 text-gray-600">Not Assigned</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getRequirementIcon = (group: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'fees': <DollarSign className="w-4 h-4 text-green-600" />,
      'uniforms': <Package className="w-4 h-4 text-blue-600" />,
      'stationery': <BookOpen className="w-4 h-4 text-purple-600" />,
      'books': <BookOpen className="w-4 h-4 text-orange-600" />,
      'equipment': <Package className="w-4 h-4 text-gray-600" />,
      'other': <ClipboardList className="w-4 h-4 text-gray-600" />
    };
    return iconMap[group.toLowerCase()] || <ClipboardList className="w-4 h-4 text-gray-600" />;
  };

  // Main component render
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
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
              alt={`${pupil.firstName} ${pupil.lastName}`}
              onError={(e) => {
                console.log('Avatar image failed to load:', pupil.photo);
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <AvatarFallback className="text-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
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
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Requirements Found
              </h3>
              <p className="text-sm text-gray-500 mb-4">
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
                            <h4 className="font-semibold text-gray-900">
                                {requirement.name}
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="hidden sm:block text-right flex-shrink-0">
                              <p className="text-xs text-gray-500">Status</p>
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
                            <p className="text-gray-600">Total Amount</p>
                             <p className="font-semibold text-gray-800">{formatCurrency(totalAmount)}</p>
                          </div>
                           <div>
                            <p className="text-gray-600">Paid</p>
                            <p className="font-semibold text-green-600">{formatCurrency(paidAmount)}</p>
                          </div>
                           <div>
                            <p className="text-gray-600">Balance</p>
                            <p className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(balance)}
                            </p>
                          </div>
                          {requirement.quantity && requirement.quantity > 0 && (
                            <div>
                              <p className="text-gray-600">Items Received</p>
                              <p className="font-semibold text-gray-800">
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
                    className="px-6 pb-4 bg-gray-50/50"
                  >
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold mb-2">Payment History</h4>
                      {trackingRecord && trackingRecord.history && trackingRecord.history.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {trackingRecord.history.map((entry: RequirementHistory, idx: number) => (
                            <li key={idx} className="flex justify-between items-center p-2 bg-white rounded-md shadow-sm">
                              <div>
                                <span className="font-medium">{formatCurrency(entry.paidAmount)}</span>
                                <span className="text-gray-500 text-xs ml-2">({formatDateForDisplay(entry.date)})</span>
                              </div>
                              <Badge variant="secondary" className="text-xs">{entry.coverageMode}</Badge>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500">No payment history available.</p>
                      )}
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