"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
} from '@/components/ui/modern-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Package, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  XCircle,
  Search,
  User,
  School
} from 'lucide-react';
import { useActivePupilsByClass } from '@/lib/hooks/use-pupils';
import { useActiveAcademicYear, useAcademicYears } from '@/lib/hooks/use-academic-years';
import { 
  useRequirementTrackingByPupilAndTerm,
  useRequirementTrackingByPupilAndAcademicYear,
  useCreateRequirementTracking,
} from '@/lib/hooks/use-requirement-tracking';
import { useRequirements, useRequirementsByFilter } from '@/lib/hooks/use-requirements';
import { getCurrentTerm, getTermLabel } from '@/lib/utils/academic-year-utils';
import { formatCurrency } from '@/lib/utils';
import type { RequirementTracking, RequirementItem, RequirementPaymentStatus, RequirementReleaseStatus, RequirementCoverageMode } from '@/types';

interface ClassRequirementsOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
}

export function ClassRequirementsOverviewModal({ 
  isOpen, 
  onClose, 
  classId 
}: ClassRequirementsOverviewModalProps) {
  const { data: pupils = [] } = useActivePupilsByClass(classId);
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: allRequirements = [] } = useRequirements();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  // Initialize with active academic year and current term
  useEffect(() => {
    if (isOpen && activeAcademicYear && !selectedAcademicYearId) {
      setSelectedAcademicYearId(activeAcademicYear.id);
      const currentTerm = getCurrentTerm(activeAcademicYear);
      if (currentTerm) {
        setSelectedTermId(currentTerm.id);
      } else if (activeAcademicYear.terms.length > 0) {
        setSelectedTermId(activeAcademicYear.terms[0].id);
      }
    }
  }, [isOpen, activeAcademicYear, selectedAcademicYearId]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredPupils = pupils.filter(pupil => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      pupil.firstName.toLowerCase().includes(searchLower) ||
      pupil.lastName.toLowerCase().includes(searchLower) ||
      pupil.admissionNumber?.toLowerCase().includes(searchLower)
    );
  });

  const getRequirementDetails = (record: RequirementTracking) => {
    const requirements = Array.isArray(record.requirementId)
      ? allRequirements.filter(req => record.requirementId.includes(req.id))
      : allRequirements.filter(req => req.id === record.requirementId);
    
    const totalQuantity = requirements.reduce((sum, req) => sum + (req.quantity || 0), 0);
    const totalAmount = requirements.reduce((sum, req) => sum + (req.price || 0), 0);
    
    return {
      requirements,
      totalQuantity,
      totalAmount,
      hasQuantities: totalQuantity > 0
    };
  };

  const getReceivedQuantities = (record: RequirementTracking) => {
    const totalReceived = record.itemQuantityReceived || 0;
    const details = getRequirementDetails(record);
    const totalRequired = details.totalQuantity;
    const remainingToReceive = Math.max(0, totalRequired - totalReceived);
    
    return {
      totalReceived,
      remainingToReceive,
      totalRequired,
      isFullyReceived: remainingToReceive === 0 && totalRequired > 0
    };
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={onClose}>
      <ModernDialogContent size="full" className="max-h-[95vh] overflow-hidden flex flex-col">
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold">Class Requirements Overview</div>
              <div className="text-sm text-gray-600 font-normal">
                {selectedAcademicYearId && selectedTermId && activeAcademicYear
                  ? `${getTermLabel(activeAcademicYear, selectedTermId)} - ${pupils.length} pupils`
                  : `${pupils.length} pupils`}
              </div>
            </div>
          </ModernDialogTitle>
        </ModernDialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {/* Search and Filters */}
          <div className="mb-4 space-y-3">
            {/* Year and Term Selector */}
            <div className="flex justify-center">
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
                  {selectedAcademicYearId && (() => {
                    const selectedYear = academicYears.find(y => y.id === selectedAcademicYearId);
                    return selectedYear?.terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ));
                  })()}
                </select>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search pupils..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Pupils List */}
          <div className="space-y-3">
            {filteredPupils.map((pupil) => (
              <PupilRequirementsCard
                key={pupil.id}
                pupil={pupil}
                academicYearId={selectedAcademicYearId}
                termId={selectedTermId}
                allRequirements={allRequirements}
                academicYears={academicYears}
              />
            ))}
          </div>

          {filteredPupils.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No pupils found matching your search.' : 'No pupils in this class.'}
            </div>
          )}
        </div>
      </ModernDialogContent>
    </ModernDialog>
  );
}

interface PupilRequirementsCardProps {
  pupil: any;
  academicYearId: string;
  termId: string;
  allRequirements: RequirementItem[];
  academicYears: any[];
}

function PupilRequirementsCard({ 
  pupil, 
  academicYearId, 
  termId,
  allRequirements,
  academicYears
}: PupilRequirementsCardProps) {
  const [autoAssignedTerms, setAutoAssignedTerms] = useState<Set<string>>(new Set());
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  // Fetch term-specific records - this is the primary data we need (EXACT COPY from requirements tracking page)
  const trackingQuery = useRequirementTrackingByPupilAndTerm(
    pupil.id,
    academicYearId,
    termId
  );

  // Fetch all year records lazily - only when needed for auto-assignment (EXACT COPY from requirements tracking page)
  // Use a separate query that doesn't block the UI
  const allYearTrackingQuery = useRequirementTrackingByPupilAndAcademicYear(
    pupil.id,
    academicYearId
  );

  const trackingRecords = trackingQuery.data || [];
  const allYearTrackingRecords = allYearTrackingQuery.data || [];
  
  // Only show loading for the primary query - don't block on all-year query (EXACT COPY from requirements tracking page)
  const isLoading = trackingQuery.isLoading && !trackingQuery.data;
  
  // Ensure refetchTracking is correctly assigned for the term-specific query (EXACT COPY from requirements tracking page)
  const refetchTracking = trackingQuery.refetch;

  const createTrackingMutation = useCreateRequirementTracking();

  // Helper function to get eligible requirements (EXACT COPY from requirements tracking page)
  const getEligibleRequirements = () => {
    if (!pupil || !academicYearId || !termId) return [];

    // Get selected academic year and term
    const selectedAcademicYear = academicYears.find(year => year.id === academicYearId);
    const selectedTerm = selectedAcademicYear?.terms.find(term => term.id === termId);
    
    if (!selectedAcademicYear || !selectedTerm) return [];

    // Determine term number (1, 2, or 3) based on term name or order
    const termNumber = selectedAcademicYear.terms.findIndex(term => term.id === termId) + 1;

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
    return eligibleReqs;
  };

  // Auto-assign eligible requirements (EXACT COPY from requirements tracking page)
  const autoAssignEligibleRequirements = async () => {
    if (!pupil || !academicYearId || !termId || isAutoAssigning) return;

    console.log('Starting auto-assignment for pupil:', pupil.firstName, pupil.lastName);
    console.log('Current tracking records count:', trackingRecords.length);

    setIsAutoAssigning(true);
    try {
      const selectedAcademicYear = academicYears.find(year => year.id === academicYearId);
      if (!selectedAcademicYear) {
        console.log('No selected academic year found');
        setIsAutoAssigning(false);
        return;
      }

      const selectedTerm = selectedAcademicYear.terms.find(term => term.id === termId);
      if (!selectedTerm) {
        console.log('No selected term found');
        setIsAutoAssigning(false);
        return;
      }

      const eligibleRequirements = getEligibleRequirements();
      console.log('Eligible requirements found:', eligibleRequirements.length);
      
      // Get all year records if available, otherwise use empty array (non-blocking)
      const yearRecords = allYearTrackingRecords.length > 0 ? allYearTrackingRecords : [];
      
      // Check which requirements are not yet tracked (with proper duplicate prevention)
      const unassignedRequirements = eligibleRequirements.filter(requirement => {
        // For one-time and yearly requirements, check across all terms in the academic year
        if (requirement.frequency === 'one-time' || requirement.frequency === 'yearly') {
          // Use year records if available, otherwise skip this check (will be checked on next load)
          if (yearRecords.length === 0) {
            // If year records not loaded yet, only check term records for now
            // This allows the page to load faster
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
        
        // For termly requirements, only check within the current term
        const isAlreadyTrackedInTerm = trackingRecords.some(record => {
          const reqIds = Array.isArray(record.requirementId) 
            ? record.requirementId 
            : [record.requirementId];
          return reqIds.includes(requirement.id);
        });
        return !isAlreadyTrackedInTerm;
      });

      console.log('Unassigned requirements to create:', unassignedRequirements.length);
      
      // Auto-assign unassigned requirements
      for (const requirement of unassignedRequirements) {
        // Final safety check: verify this requirement doesn't already exist
        const existsInCurrentTerm = trackingRecords.some(record => {
          const reqIds = Array.isArray(record.requirementId) ? record.requirementId : [record.requirementId];
          return reqIds.includes(requirement.id);
        });
        
        // Skip if already exists in current term
        if (existsInCurrentTerm) {
          continue;
        }
        
        // For one-time/yearly, check year records if available
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
          academicYearId: academicYearId,
          termId: termId,
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

      // Refresh tracking records after auto-assignment
      if (unassignedRequirements.length > 0) {
        await refetchTracking();
      }
    } catch (error) {
      console.error('Error auto-assigning requirements:', error);
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // Auto-assign eligible requirements when pupil data loads (only once per term, after data is confirmed) (EXACT COPY from requirements tracking page)
  useEffect(() => {
    const termKey = `${academicYearId}-${termId}`;

    // Proceed only if all necessary data is loaded and successful
    if (
      pupil &&
      allRequirements.length > 0 &&
      academicYearId &&
      termId &&
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
    academicYearId,
    termId,
    trackingQuery.isSuccess, // Dependency for term-specific query success
    trackingQuery.data,      // Dependency for term-specific data
    allYearTrackingQuery.isSuccess, // Dependency for year-wide query success
    allYearTrackingQuery.data,    // Dependency for year-wide data
    autoAssignedTerms
  ]);

  const getRequirementDetails = (record: RequirementTracking) => {
    const requirements = Array.isArray(record.requirementId)
      ? allRequirements.filter(req => record.requirementId.includes(req.id))
      : allRequirements.filter(req => req.id === record.requirementId);
    
    const totalQuantity = requirements.reduce((sum, req) => sum + (req.quantity || 0), 0);
    const totalAmount = requirements.reduce((sum, req) => sum + (req.price || 0), 0);
    
    return {
      requirements,
      totalQuantity,
      totalAmount,
      hasQuantities: totalQuantity > 0
    };
  };

  const getReceivedQuantities = (record: RequirementTracking) => {
    const totalReceived = record.itemQuantityReceived || 0;
    const details = getRequirementDetails(record);
    const totalRequired = details.totalQuantity;
    const remainingToReceive = Math.max(0, totalRequired - totalReceived);
    
    return {
      totalReceived,
      remainingToReceive,
      totalRequired,
      isFullyReceived: remainingToReceive === 0 && totalRequired > 0
    };
  };

  const getRequirementName = (record: RequirementTracking) => {
    if (Array.isArray(record.requirementId)) {
      return `Multiple Requirements (${record.requirementId.length})`;
    }
    const requirement = allRequirements.find(req => req.id === record.requirementId);
    return requirement?.name || 'Unknown';
  };

  if (!academicYearId || !termId) {
    return (
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <div>
              <div className="font-semibold text-sm">{pupil.firstName} {pupil.lastName}</div>
              <div className="text-xs text-gray-500">Please select academic year and term</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-600" />
              <div>
                <div className="font-semibold text-sm">{pupil.firstName} {pupil.lastName}</div>
                {pupil.admissionNumber && (
                  <div className="text-xs text-gray-500">Adm: {pupil.admissionNumber}</div>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="text-xs text-gray-500">Loading requirements...</div>
            ) : trackingRecords.length === 0 ? (
              <div className="text-xs text-gray-500">No requirements assigned</div>
            ) : (
              <div className="space-y-2">
                {trackingRecords.map((record) => {
                  const requirementName = getRequirementName(record);
                  const received = getReceivedQuantities(record);
                  const details = getRequirementDetails(record);
                  
                  return (
                    <div key={record.id} className="border-l-2 border-gray-200 pl-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-900">{requirementName}</span>
                        <Badge
                          variant={received.isFullyReceived ? 'default' : received.totalReceived > 0 ? 'secondary' : 'destructive'}
                          className="text-[10px] py-0 px-1.5 h-4"
                        >
                          {received.isFullyReceived ? (
                            <>
                              <CheckCircle className="w-2 h-2 mr-0.5" />
                              Complete
                            </>
                          ) : received.totalReceived > 0 ? (
                            <>
                              <Clock className="w-2 h-2 mr-0.5" />
                              Partial
                            </>
                          ) : (
                            <>
                              <XCircle className="w-2 h-2 mr-0.5" />
                              Pending
                            </>
                          )}
                        </Badge>
                      </div>
                      {details.hasQuantities && (
                        <div className="text-[10px] text-gray-600">
                          Received: {received.totalReceived} / {received.totalRequired} items
                          {received.remainingToReceive > 0 && (
                            <span className="text-orange-600 ml-1">
                              ({received.remainingToReceive} remaining)
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-gray-600">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-2.5 h-2.5" />
                          <span>Paid: {formatCurrency(record.paidAmount)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Package className="w-2.5 h-2.5" />
                          <span>Received: {received.totalReceived} items</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

