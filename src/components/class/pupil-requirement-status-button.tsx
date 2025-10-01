"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Package 
} from 'lucide-react';
import { Pupil } from '@/types';
import { useRequirementTrackingByPupilAndTerm } from '@/lib/hooks/use-requirement-tracking';
import { useRequirements } from '@/lib/hooks/use-requirements';
import { useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { getCurrentTerm } from '@/lib/utils/academic-year-utils';
import { formatCurrency } from '@/lib/utils';
import { useTermStatus } from '@/lib/hooks/use-term-status';

interface PupilRequirementStatusButtonProps {
  pupil: Pupil;
  onClick?: () => void;
  isCompact?: boolean;
}

export function PupilRequirementStatusButton({ 
  pupil, 
  onClick, 
  isCompact = false 
}: PupilRequirementStatusButtonProps) {
  const { data: activeAcademicYear, isLoading: academicYearLoading } = useActiveAcademicYear();
  const currentTerm = activeAcademicYear ? getCurrentTerm(activeAcademicYear) : null;
  const { data: allRequirements = [], isLoading: requirementsLoading } = useRequirements();
  
  // Use the current academic year and term specific hook for dynamic data
  const { data: trackingRecords = [], isLoading: trackingLoading, refetch } = useRequirementTrackingByPupilAndTerm(
    pupil.id,
    activeAcademicYear?.id || '',
    currentTerm?.id || ''
  );

  // Check if we're in recess mode and show appropriate message - MOVED TO TOP TO FIX HOOKS ORDER
  const { isRecessMode, effectiveTerm } = useTermStatus();

  // Add a timeout fallback to prevent infinite loading - MOVED TO TOP TO FIX HOOKS ORDER
  const [showTimeoutFallback, setShowTimeoutFallback] = React.useState(false);

  // Add timeout effect to prevent infinite loading - MOVED TO TOP TO FIX HOOKS ORDER
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (trackingLoading || academicYearLoading || requirementsLoading) {
        setShowTimeoutFallback(true);
      }
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(timeout);
  }, [trackingLoading, academicYearLoading, requirementsLoading]);

  // Debug logging
  React.useEffect(() => {
    console.log('PupilRequirementStatusButton Debug:', {
      pupilId: pupil.id,
      activeAcademicYear: activeAcademicYear?.id,
      currentTerm: currentTerm?.id,
      academicYearLoading,
      requirementsLoading,
      trackingLoading,
      trackingRecordsCount: trackingRecords.length,
      allRequirementsCount: allRequirements.length
    });
  }, [pupil.id, activeAcademicYear?.id, currentTerm?.id, academicYearLoading, requirementsLoading, trackingLoading, trackingRecords.length, allRequirements.length]);

  // Refetch data every 30 seconds to ensure real-time updates
  React.useEffect(() => {
    if (!activeAcademicYear || !currentTerm) return;
    
    const interval = setInterval(() => {
      refetch();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [refetch, activeAcademicYear, currentTerm]);

  // Calculate comprehensive requirement statistics for current period
  const calculateStats = () => {
    if (!trackingRecords.length || !activeAcademicYear || !currentTerm) {
      return {
        totalRequirements: 0,
        completedRequirements: 0,
        partialRequirements: 0,
        pendingRequirements: 0,
        totalReceived: 0,
        totalRequired: 0,
        completionPercentage: 0,
        status: 'none' as const
      };
    }

    // Get requirements applicable to this pupil for the current term
    const applicableRequirements = allRequirements.filter(req => {
      // Check if requirement applies to this pupil's class
      if (req.classType === 'all') return true;
      if (req.classType === 'specific' && req.classIds?.includes(pupil.classId)) return true;
      return false;
    }).filter(req => {
      // Check if requirement applies to current term
      return req.frequency === 'termly' || req.frequency === 'yearly' || req.frequency === 'one-time';
    }).filter(req => {
      // Check gender and section requirements
      const matchesGender = req.gender === 'all' || 
        (req.gender === 'male' && pupil.gender === 'Male') ||
        (req.gender === 'female' && pupil.gender === 'Female');
      
      const matchesSection = req.sectionType === 'all' ||
        (req.sectionType === 'specific' && req.section === pupil.section);
      
      return matchesGender && matchesSection;
    });

    let totalRequirements = 0;
    let completedRequirements = 0;
    let partialRequirements = 0;
    let pendingRequirements = 0;
    let totalReceived = 0;
    let totalRequired = 0;

    // Process each applicable requirement
    applicableRequirements.forEach(requirement => {
      totalRequirements++;
      
      // Find tracking records for this specific requirement
      const requirementTrackingRecords = trackingRecords.filter(t => {
        if (Array.isArray(t.requirementId)) {
          return t.requirementId.includes(requirement.id);
        }
        return t.requirementId === requirement.id;
      });

      const requiredQuantity = requirement.quantity || 1;
      const receivedQuantity = requirementTrackingRecords.reduce((sum, t) => sum + (t.itemQuantityReceived || 0), 0);
      
      totalReceived += receivedQuantity;
      totalRequired += requiredQuantity;

      if (receivedQuantity >= requiredQuantity) {
        completedRequirements++;
      } else if (receivedQuantity > 0) {
        partialRequirements++;
      } else {
        pendingRequirements++;
      }
    });

    const completionPercentage = totalRequired > 0 
      ? Math.round((totalReceived / totalRequired) * 100)
      : 0;

    let status: 'complete' | 'partial' | 'pending' | 'none' = 'none';
    if (completedRequirements === totalRequirements && totalRequirements > 0) {
      status = 'complete';
    } else if (partialRequirements > 0 || completedRequirements > 0) {
      status = 'partial';
    } else if (pendingRequirements > 0) {
      status = 'pending';
    }

    return {
      totalRequirements,
      completedRequirements,
      partialRequirements,
      pendingRequirements,
      totalReceived,
      totalRequired,
      completionPercentage,
      status
    };
  };

  const stats = calculateStats();

  if (trackingLoading || academicYearLoading || requirementsLoading) {
    return (
      <Button 
        variant="outline" 
        size={isCompact ? "sm" : "default"}
        disabled
        className="w-full"
      >
        <Clock className="w-3 h-3 mr-1" />
        Loading...
      </Button>
    );
  }

  // If no active academic year or current term, show a fallback state
  if (!activeAcademicYear || !currentTerm) {
    return (
      <Button 
        variant="outline" 
        size={isCompact ? "sm" : "default"}
        disabled
        className="w-full"
        onClick={onClick}
      >
        <Package className="w-3 h-3 mr-1" />
        No Active Term
      </Button>
    );
  }

  // Check if we're in recess mode and show appropriate message
  if (isRecessMode && effectiveTerm.term) {
    return (
      <Button 
        variant="outline" 
        size={isCompact ? "sm" : "default"}
        className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
        onClick={onClick}
      >
        <Package className="w-3 h-3 mr-1" />
        {isCompact ? `${effectiveTerm.term.name} Data` : `Showing ${effectiveTerm.term.name} Data`}
      </Button>
    );
  }

  // Check for timeout fallback
  if (showTimeoutFallback) {
    return (
      <Button 
        variant="outline" 
        size={isCompact ? "sm" : "default"}
        className="w-full"
        onClick={onClick}
      >
        <Package className="w-3 h-3 mr-1" />
        Check Requirements
      </Button>
    );
  }

  // Get status configuration
  const getStatusConfig = () => {
    switch (stats.status) {
      case 'complete':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: <CheckCircle className="w-3 h-3" />,
          label: 'All Received',
          buttonVariant: 'default' as const,
          buttonClass: 'bg-green-600 hover:bg-green-700 text-white'
        };
      case 'partial':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: <TrendingUp className="w-3 h-3" />,
          label: 'Partial Receipt',
          buttonVariant: 'outline' as const,
          buttonClass: 'border-blue-300 text-blue-700 hover:bg-blue-50'
        };
      case 'pending':
        return {
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <Clock className="w-3 h-3" />,
          label: 'Not Received',
          buttonVariant: 'outline' as const,
          buttonClass: 'border-amber-300 text-amber-700 hover:bg-amber-50'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-600 border-gray-200',
          icon: <Package className="w-3 h-3" />,
          label: 'No Requirements',
          buttonVariant: 'outline' as const,
          buttonClass: 'border-gray-300 text-gray-600 hover:bg-gray-50'
        };
    }
  };

  const statusConfig = getStatusConfig();

  if (isCompact) {
    return (
      <Button
        variant={statusConfig.buttonVariant}
        size="sm"
        onClick={onClick}
        className={`w-full ${statusConfig.buttonClass}`}
      >
        <div className="flex items-center gap-1 w-full">
          {statusConfig.icon}
          <span className="flex-1 text-left">
            {stats.completionPercentage}%
          </span>
          <Badge variant="outline" className="text-xs px-1">
            {stats.totalReceived}/{stats.totalRequired}
          </Badge>
        </div>
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant={statusConfig.buttonVariant}
        size="sm"
        onClick={onClick}
        className={`w-full ${statusConfig.buttonClass}`}
      >
        <div className="flex items-center gap-2 w-full">
          {statusConfig.icon}
          <span className="flex-1 text-left font-medium">
            {statusConfig.label}
          </span>
          <Badge variant="outline" className="text-xs">
            {stats.completionPercentage}%
          </Badge>
        </div>
      </Button>
      
      {stats.totalRequirements > 0 && (
        <div className="space-y-1">
          <Progress 
            value={stats.completionPercentage} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-gray-600">
            <span>{stats.totalReceived}/{stats.totalRequired} items received</span>
            <span>{stats.completionPercentage}%</span>
          </div>
          
          {stats.partialRequirements > 0 && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <TrendingUp className="w-3 h-3" />
              <span>{stats.partialRequirements} partially received</span>
            </div>
          )}
          
          {stats.pendingRequirements > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <Clock className="w-3 h-3" />
              <span>{stats.pendingRequirements} not received</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 