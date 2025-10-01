"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useMemo } from "react";
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc, 
  Users, 
  Package, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Eye,
  Download,
  RefreshCw,
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Phone,
  MapPin,
  List,
  Grid,
  ToggleLeft,
  ToggleRight,
  BarChart3,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";

import type { Class, Pupil, RequirementItem, RequirementTracking } from "@/types";
import { useClass } from "@/lib/hooks/use-classes";
import { usePupilsByClass } from "@/lib/hooks/use-pupils";
import { useRequirements, useEnhancedRequirementsByFilter } from "@/lib/hooks/use-requirements";
import { useRequirementTracking, useEnhancedRequirementTrackingByPupilAndTerm } from "@/lib/hooks/use-requirement-tracking";
import { useActiveAcademicYear, useAcademicYears } from "@/lib/hooks/use-academic-years";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { RequirementReceptionModal } from "@/components/class/requirement-reception-modal";
import { PupilRequirementStatusButton } from "@/components/class/pupil-requirement-status-button";
import { getCurrentTerm } from "@/lib/utils/academic-year-utils";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";

interface RequirementTrackingFilters {
  search: string;
  section: string;
  status: 'all' | 'complete' | 'partial' | 'pending';
  requirementGroup: string;
  sortBy: 'name' | 'progress' | 'received' | 'pending';
  sortOrder: 'asc' | 'desc';
}

interface DetailedRequirementInfo {
  requirement: RequirementItem;
  required: number;
  received: number;
  progress: number;
  status: 'complete' | 'partial' | 'pending';
  trackingRecords: RequirementTracking[];
}

interface PupilRequirementSummary {
  pupil: Pupil;
  detailedRequirements: DetailedRequirementInfo[];
  trackingRecords: RequirementTracking[];
  totalRequired: number;
  totalReceived: number;
  overallProgress: number;
  overallStatus: 'complete' | 'partial' | 'pending';
}

type ViewMode = 'detailed' | 'compact';

function RequirementTrackingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams?.get('classId');
  const className = searchParams?.get('className') || 'Unknown Class';

  // Academic year and term selection state
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  // Data hooks
  const { data: classDetail, refetch: refetchClass } = useClass(classId || '');
  const { data: pupils = [], refetch: refetchPupils } = usePupilsByClass(classId || '');
  const { data: allRequirements = [], refetch: refetchRequirements } = useRequirements();
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  
  // Term status for recess awareness
  const { isInRecess, currentTerm, nextTerm, daysUntilNextTerm } = useTermStatus();

  // Initialize with active academic year and current term
  React.useEffect(() => {
    if (activeAcademicYear && !selectedAcademicYearId) {
      setSelectedAcademicYearId(activeAcademicYear.id);
      
      // When in recess, show the current term data (previous term)
      if (isInRecess && currentTerm) {
        setSelectedTermId(currentTerm.id);
      } else {
        const currentTerm = getCurrentTerm(activeAcademicYear);
        if (currentTerm && !selectedTermId) {
          setSelectedTermId(currentTerm.id);
        } else if (activeAcademicYear.terms.length > 0 && !selectedTermId) {
          setSelectedTermId(activeAcademicYear.terms[0].id);
        }
      }
    }
  }, [activeAcademicYear, selectedAcademicYearId, selectedTermId, isInRecess, currentTerm]);

  // Use the requirement tracking hook
  const { data: trackingData = [], refetch: refetchTracking, isLoading: trackingLoading } = useRequirementTracking();

  // Filter tracking data by selected academic year and term
  const filteredTrackingData = useMemo(() => {
    if (!selectedAcademicYearId && !selectedTermId) return trackingData;
    
    return trackingData.filter((record: RequirementTracking) => {
      const matchesYear = !selectedAcademicYearId || record.academicYearId === selectedAcademicYearId;
      const matchesTerm = !selectedTermId || record.termId === selectedTermId;
      return matchesYear && matchesTerm;
    });
  }, [trackingData, selectedAcademicYearId, selectedTermId]);

  // Modal state
  const [selectedPupil, setSelectedPupil] = useState<Pupil | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // View mode state - default to summary
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // Filter and search state
  const [filters, setFilters] = useState<RequirementTrackingFilters>({
    search: '',
    section: 'all',
    status: 'all',
    requirementGroup: 'all',
    sortBy: 'name',
    sortOrder: 'asc'
  });

  // Get requirements applicable to this class for the selected period with enhanced data integrity
  const { data: classRequirements = [] } = useEnhancedRequirementsByFilter(
    classDetail ? {
      id: classDetail.id,
      classId: classDetail.id,
      section: 'Day', // Default section for class-level requirements
      gender: 'all',
      registrationDate: undefined // Class-level requirements don't depend on individual pupil registration
    } as any : null,
    selectedTermId,
    activeAcademicYear || null,
    academicYears
  );

  // Calculate pupil requirement summaries with enhanced data integrity
  const pupilSummaries = useMemo(() => {
    return pupils.map((pupil: Pupil) => {
      // Use enhanced tracking data for this pupil
      const pupilTrackingRecords = filteredTrackingData.filter((t: RequirementTracking) => t.pupilId === pupil.id);

      // Create detailed requirement info with enhanced filtering
      const detailedRequirements: DetailedRequirementInfo[] = classRequirements.map((requirement: RequirementItem) => {
        // Find tracking records for this specific requirement
        const requirementTrackingRecords = pupilTrackingRecords.filter((t: RequirementTracking) => {
          if (Array.isArray(t.requirementId)) {
            return t.requirementId.includes(requirement.id);
          }
          return t.requirementId === requirement.id;
        });

        const required = requirement.quantity || 1;
        const received = requirementTrackingRecords.reduce((sum: number, t: RequirementTracking) => sum + (t.itemQuantityReceived || 0), 0);
        const progress = required > 0 ? Math.min((received / required) * 100, 100) : 0;
        
        let status: 'complete' | 'partial' | 'pending' = 'pending';
        if (progress >= 100) status = 'complete';
        else if (progress > 0) status = 'partial';

        return {
          requirement,
          required,
          received,
          progress,
          status,
          trackingRecords: requirementTrackingRecords
        };
      });

      const totalRequired = pupilTrackingRecords.reduce((sum: number, t: RequirementTracking) => sum + (t.totalItemQuantityRequired || 0), 0);
      const totalReceived = pupilTrackingRecords.reduce((sum: number, t: RequirementTracking) => sum + (t.itemQuantityReceived || 0), 0);
      const overallProgress = totalRequired > 0 ? (totalReceived / totalRequired) * 100 : 0;
      
      let overallStatus: 'complete' | 'partial' | 'pending' = 'pending';
      if (overallProgress >= 100) overallStatus = 'complete';
      else if (overallProgress > 0) overallStatus = 'partial';

      return {
        pupil,
        detailedRequirements,
        trackingRecords: pupilTrackingRecords,
        totalRequired,
        totalReceived,
        overallProgress,
        overallStatus
      };
    });
  }, [pupils, filteredTrackingData, classRequirements]);

  // Apply filters and sorting
  const filteredAndSortedSummaries = useMemo(() => {
    let filtered = pupilSummaries.filter(summary => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const pupilName = `${summary.pupil.firstName} ${summary.pupil.lastName}`.toLowerCase();
        const admissionNumber = summary.pupil.admissionNumber?.toLowerCase() || '';
        if (!pupilName.includes(searchLower) && !admissionNumber.includes(searchLower)) {
          return false;
        }
      }

      // Section filter
      if (filters.section !== 'all' && summary.pupil.section !== filters.section) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all' && summary.overallStatus !== filters.status) {
        return false;
      }

      // Requirement group filter
      if (filters.requirementGroup !== 'all') {
        const hasRequirementInGroup = summary.detailedRequirements.some(r => 
          r.requirement.group === filters.requirementGroup
        );
        if (!hasRequirementInGroup) return false;
      }

      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (filters.sortBy) {
        case 'name':
          aValue = `${a.pupil.firstName} ${a.pupil.lastName}`;
          bValue = `${b.pupil.firstName} ${b.pupil.lastName}`;
          break;
        case 'progress':
          aValue = a.overallProgress;
          bValue = b.overallProgress;
          break;
        case 'received':
          aValue = a.totalReceived;
          bValue = b.totalReceived;
          break;
        case 'pending':
          aValue = a.totalRequired - a.totalReceived;
          bValue = b.totalRequired - b.totalReceived;
          break;
        default:
          aValue = `${a.pupil.firstName} ${a.pupil.lastName}`;
          bValue = `${b.pupil.firstName} ${b.pupil.lastName}`;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return filters.sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return filters.sortOrder === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return filtered;
  }, [pupilSummaries, filters]);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    const totalPupils = pupilSummaries.length;
    const completePupils = pupilSummaries.filter(s => s.overallStatus === 'complete').length;
    const partialPupils = pupilSummaries.filter(s => s.overallStatus === 'partial').length;
    const pendingPupils = pupilSummaries.filter(s => s.overallStatus === 'pending').length;
    
    const totalItemsRequired = pupilSummaries.reduce((sum, s) => sum + s.totalRequired, 0);
    const totalItemsReceived = pupilSummaries.reduce((sum, s) => sum + s.totalReceived, 0);
    const overallProgress = totalItemsRequired > 0 ? (totalItemsReceived / totalItemsRequired) * 100 : 0;

    return {
      totalPupils,
      completePupils,
      partialPupils,
      pendingPupils,
      totalItemsRequired,
      totalItemsReceived,
      overallProgress
    };
  }, [pupilSummaries]);

  // Get unique sections and requirement groups for filters
  const uniqueSections = useMemo(() => {
    return [...new Set(pupils.map(p => p.section).filter(Boolean))];
  }, [pupils]);

  const uniqueRequirementGroups = useMemo(() => {
    return [...new Set(classRequirements.map(r => r.group).filter(Boolean))];
  }, [classRequirements]);

  // Get selected academic year and term data for display
  const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);
  const selectedTerm = selectedAcademicYear?.terms.find(term => term.id === selectedTermId);

  // Academic year and term filter handlers
  const handleAcademicYearChange = (yearId: string) => {
    setSelectedAcademicYearId(yearId);
    // Reset term when year changes
    const year = academicYears.find(y => y.id === yearId);
    if (year && year.terms.length > 0) {
      const currentTerm = getCurrentTerm(year);
      setSelectedTermId(currentTerm?.id || year.terms[0].id);
    } else {
      setSelectedTermId('');
    }
  };

  const handleTermChange = (termId: string) => {
    setSelectedTermId(termId);
  };

  const handleFilterChange = (key: keyof RequirementTrackingFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      section: 'all',
      status: 'all',
      requirementGroup: 'all',
      sortBy: 'name',
      sortOrder: 'asc'
    });
  };

  const handlePupilClick = (pupil: Pupil) => {
    setSelectedPupil(pupil);
    setIsModalOpen(true);
  };

  const getStatusIcon = (status: 'complete' | 'partial' | 'pending') => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: 'complete' | 'partial' | 'pending') => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'pending':
        return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  if (!classId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Class Not Found</h1>
          <p className="text-muted-foreground mt-2">Please select a valid class to view requirements tracking.</p>
          <Button 
            onClick={() => router.back()} 
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Recess Status Banner */}
        <RecessStatusBanner />
        
        {/* Compact Collapsible Header Card */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-0">
                         {/* Header Row - Always Visible */}
             <div className="p-4 border-b border-gray-100">
               <div className="flex flex-col gap-3">
                                   {/* Title, Search, and Stats Row */}
                  <div className="flex items-center justify-between gap-4">
                                         <div className="flex items-center gap-3">
                       <div className="p-2 bg-blue-100 rounded-lg">
                         <BarChart3 className="h-4 w-4 text-blue-600" />
                       </div>
                       <div>
                         <h1 className="text-lg font-bold text-gray-900">{className}</h1>
                         <p className="text-sm text-gray-600">
                           Track requirement items • {filteredAndSortedSummaries.length} pupils
                         </p>
                         {isInRecess && currentTerm && (
                           <div className="flex items-center gap-1 mt-1">
                             <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                             <span className="text-xs text-amber-700 font-medium">
                               Showing {currentTerm.name} Data ({daysUntilNextTerm} days until {nextTerm?.name})
                             </span>
                           </div>
                         )}
                       </div>
                     </div>
              
                    {/* Search Bar - Middle */}
                    <div className="flex-1 max-w-md">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search pupils..."
                          value={filters.search}
                          onChange={(e) => handleFilterChange('search', e.target.value)}
                          className="pl-10 bg-gray-50 border-gray-200 focus:border-blue-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Quick Stats */}
                      <div className="hidden sm:flex items-center gap-4 text-xs">
                <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{overallStats.completePupils}</div>
                          <div className="text-gray-500">Complete</div>
                </div>
                <div className="text-center">
                          <div className="text-lg font-bold text-amber-600">{overallStats.partialPupils}</div>
                          <div className="text-gray-500">Partial</div>
                </div>
                <div className="text-center">
                          <div className="text-lg font-bold text-red-600">{overallStats.pendingPupils}</div>
                          <div className="text-gray-500">Pending</div>
              </div>
            </div>

                      {/* Mobile Stats */}
                      <div className="sm:hidden flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                          {overallStats.completePupils} Complete
                      </span>
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          {overallStats.partialPupils} Partial
                        </span>
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                          {overallStats.pendingPupils} Pending
                        </span>
        </div>

                      {/* Filter, Sort, and View Controls */}
                      <div className="flex items-center gap-2">
                        {/* Filter Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 px-3">
                              <Filter className="h-3 w-3 mr-1" />
                              Filter
                      {(filters.section !== 'all' || filters.status !== 'all' || filters.requirementGroup !== 'all') && (
                                <Badge variant="secondary" className="ml-1 h-4 w-4 rounded-full p-0 text-xs bg-blue-100 text-blue-700">
                          {[filters.section !== 'all', filters.status !== 'all', filters.requirementGroup !== 'all'].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            {/* Section Filter */}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Users className="mr-2 h-4 w-4" />
                                <span>Section</span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup value={filters.section} onValueChange={(value) => handleFilterChange('section', value)}>
                                  <DropdownMenuRadioItem value="all">All Sections</DropdownMenuRadioItem>
                            {uniqueSections.map(section => (
                                    <DropdownMenuRadioItem key={section} value={section}>{section}</DropdownMenuRadioItem>
                                  ))}
                                </DropdownMenuRadioGroup>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            
                            {/* Status Filter */}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Package className="mr-2 h-4 w-4" />
                                <span>Status</span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                                  <DropdownMenuRadioItem value="all">All Status</DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="complete">Complete</DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="partial">Partial</DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="pending">Pending</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            
                            {/* Requirement Group Filter */}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Package className="mr-2 h-4 w-4" />
                                <span>Requirement Group</span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup value={filters.requirementGroup} onValueChange={(value) => handleFilterChange('requirementGroup', value)}>
                                  <DropdownMenuRadioItem value="all">All Groups</DropdownMenuRadioItem>
                            {uniqueRequirementGroups.map(group => (
                                    <DropdownMenuRadioItem key={group} value={group}>{group}</DropdownMenuRadioItem>
                                  ))}
                                </DropdownMenuRadioGroup>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                      <DropdownMenuSeparator />
                      
                            <div className="flex items-center justify-between p-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearFilters}
                          className="text-gray-600 hover:text-red-600 hover:border-red-300"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear All
                        </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                        {/* Sort Button */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 px-3">
                              {filters.sortOrder === 'asc' ? <SortAsc className="h-3 w-3 mr-1" /> : <SortDesc className="h-3 w-3 mr-1" />}
                              Sort
                  </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Sort Options</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup value={`${filters.sortBy}-${filters.sortOrder}`} onValueChange={(value) => {
                              const [sortBy, sortOrder] = value.split('-');
                              handleFilterChange('sortBy', sortBy);
                              handleFilterChange('sortOrder', sortOrder);
                            }}>
                              <DropdownMenuRadioItem value="name-asc">Name A-Z</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="name-desc">Name Z-A</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="progress-asc">Progress Low-High</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="progress-desc">Progress High-Low</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="received-asc">Received Low-High</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="received-desc">Received High-Low</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="pending-asc">Pending Low-High</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="pending-desc">Pending High-Low</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        {/* View Mode Toggle */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 px-3">
                              {viewMode === 'detailed' ? <List className="h-3 w-3 mr-1" /> : <Grid className="h-3 w-3 mr-1" />}
                              {viewMode === 'detailed' ? 'Detailed' : 'Summary'}
                  </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuLabel>View Mode</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
                              <DropdownMenuRadioItem value="detailed">Detailed View</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="compact">Summary View</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                </div>

                      {/* Collapse Toggle */}
                <Button
                        variant="ghost"
                  size="sm"
                        onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                        className="h-8 w-8 p-0"
                      >
                        {isHeaderCollapsed ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                </Button>
              </div>
            </div>
                </div>
              </div>

            {/* Collapsible Content */}
            {!isHeaderCollapsed && (
              <div className="p-4 space-y-4">
                {/* Period Selection */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">Period:</span>
                    </div>

                  <div className="flex flex-1 items-center gap-2 flex-wrap">
                    <Select 
                      value={selectedAcademicYearId} 
                      onValueChange={handleAcademicYearChange}
                      disabled={academicYearsLoading}
                    >
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue placeholder="Academic Year" />
                        </SelectTrigger>
                        <SelectContent>
                        {academicYears.map(year => (
                          <SelectItem key={year.id} value={year.id}>
                            {year.name} {year.isActive ? '(Current)' : ''}
                          </SelectItem>
                        ))}
                        </SelectContent>
                      </Select>

                    <Select 
                      value={selectedTermId} 
                      onValueChange={handleTermChange}
                      disabled={!selectedAcademicYear || selectedAcademicYear.terms.length === 0}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue placeholder="Term" />
                        </SelectTrigger>
                        <SelectContent>
                        {selectedAcademicYear?.terms.map(term => (
                          <SelectItem key={term.id} value={term.id}>
                            {term.name} {term.isCurrent ? '(Current)' : ''}
                          </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                      onClick={() => refetchTracking()}
                        variant="outline"
                        size="sm"
                      disabled={trackingLoading}
                      className="h-8 px-2"
                    >
                      {trackingLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      </Button>

                    {selectedAcademicYear && selectedTerm && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
                        <span className="font-medium">
                          {selectedAcademicYear.name} - {selectedTerm.name}
                        </span>
                        {selectedTerm.startDate && selectedTerm.endDate && (
                          <span className="hidden sm:inline">
                            ({new Date(selectedTerm.startDate).toLocaleDateString()} - {new Date(selectedTerm.endDate).toLocaleDateString()})
                          </span>
                        )}
                    </div>
                    )}
                  </div>
              </div>

                {/* Mobile Stats */}
                <div className="sm:hidden">
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="text-center p-2 bg-green-50 rounded">
                      <div className="text-lg font-bold text-green-600">{overallStats.completePupils}</div>
                      <div className="text-gray-500">Complete</div>
                </div>
                    <div className="text-center p-2 bg-amber-50 rounded">
                      <div className="text-lg font-bold text-amber-600">{overallStats.partialPupils}</div>
                      <div className="text-gray-500">Partial</div>
              </div>
                    <div className="text-center p-2 bg-red-50 rounded">
                      <div className="text-lg font-bold text-red-600">{overallStats.pendingPupils}</div>
                      <div className="text-gray-500">Pending</div>
            </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>



        {/* Enhanced Table Section */}
        <Card className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <CardContent className="p-0">
            {/* Mobile Card View for very small screens */}
            <div className="block sm:hidden">
              <div className="space-y-3 p-3">
                {filteredAndSortedSummaries.map((summary) => (
                  <div
                    key={summary.pupil.id}
                    onClick={() => handlePupilClick(summary.pupil)}
                    className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 border-2 border-gray-200">
                        {summary.pupil.photo && (
                          <AvatarImage src={summary.pupil.photo} alt={`${summary.pupil.firstName} ${summary.pupil.lastName}`} />
                        )}
                        <AvatarFallback className="text-sm bg-blue-100 text-blue-700">
                          {summary.pupil.firstName[0]}{summary.pupil.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900 truncate">
                              {summary.pupil.firstName} {summary.pupil.lastName}
                            </h3>
                            <p className="text-sm text-gray-500">{summary.pupil.admissionNumber}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{summary.pupil.section}</Badge>
                        </div>
                        
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Progress</span>
                            <span className="font-medium">{summary.overallProgress.toFixed(1)}%</span>
                          </div>
                          <Progress value={summary.overallProgress} className="h-2" />
                          
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Items</span>
                            <span className="font-medium">
                              <span className="text-green-600">{summary.totalReceived}</span>
                              <span className="text-gray-400 mx-1">/</span>
                              <span className="text-blue-600">{summary.totalRequired}</span>
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {summary.detailedRequirements.length} requirements
                            </span>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(summary.overallStatus)}
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getStatusColor(summary.overallStatus)}`}
                              >
                                {summary.overallStatus}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block">
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader className="bg-gray-50 sticky top-0 z-10">
                    <TableRow className="border-b border-gray-200">
                      <TableHead className="w-64 font-semibold text-gray-700 py-4">Pupil</TableHead>
                      <TableHead className="font-semibold text-gray-700">Requirement</TableHead>
                      <TableHead className="font-semibold text-gray-700">Group</TableHead>
                      <TableHead className="font-semibold text-gray-700">Section</TableHead>
                      <TableHead className="font-semibold text-gray-700">Required</TableHead>
                      <TableHead className="font-semibold text-gray-700">Received</TableHead>
                      <TableHead className="font-semibold text-gray-700">Progress</TableHead>
                      <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewMode === 'detailed' ? (
                      // Detailed view - pupil name spans multiple rows, one row per requirement
                      filteredAndSortedSummaries.flatMap((summary) => {
                        if (summary.detailedRequirements.length === 0) {
                          // Single row for pupils with no requirements
                          return [
                            <TableRow key={`pupil-${summary.pupil.id}`} className="hover:bg-blue-50/50 border-b border-gray-100">
                              <TableCell 
                                className="cursor-pointer hover:bg-blue-100/50 transition-colors py-4 border-r border-gray-100"
                                onClick={() => handlePupilClick(summary.pupil)}
                              >
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9 border-2 border-gray-200">
                                    {summary.pupil.photo && (
                                      <AvatarImage src={summary.pupil.photo} alt={`${summary.pupil.firstName} ${summary.pupil.lastName}`} />
                                    )}
                                    <AvatarFallback className="text-sm bg-blue-100 text-blue-700">
                                      {summary.pupil.firstName[0]}{summary.pupil.lastName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-gray-900">{summary.pupil.firstName} {summary.pupil.lastName}</p>
                                    <p className="text-sm text-gray-500">{summary.pupil.admissionNumber}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <span className="text-gray-500 italic">No requirements found</span>
                              </TableCell>
                              <TableCell className="py-4">
                                <span className="text-gray-400">-</span>
                              </TableCell>
                              <TableCell className="py-4">
                                <Badge variant="outline" className="border-gray-300">{summary.pupil.section}</Badge>
                              </TableCell>
                              <TableCell className="py-4">
                                <span className="text-gray-400">-</span>
                              </TableCell>
                              <TableCell className="py-4">
                                <span className="text-gray-400">-</span>
                              </TableCell>
                              <TableCell className="py-4">
                                <span className="text-gray-400">-</span>
                              </TableCell>
                              <TableCell className="py-4">
                                <Badge variant="outline" className="text-gray-500 border-gray-300">
                                  No Data
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ];
                        }

                        // Multiple rows for pupils with requirements - pupil name spans all rows
                        return summary.detailedRequirements.map((req, index) => (
                          <TableRow key={`${summary.pupil.id}-${req.requirement.id}`} className="hover:bg-blue-50/50 border-b border-gray-100">
                            {/* Pupil info - only show in first row, spans multiple rows */}
                            {index === 0 && (
                              <TableCell 
                                rowSpan={summary.detailedRequirements.length} 
                                className="border-r-2 border-r-blue-200 bg-gradient-to-r from-blue-50/30 to-transparent cursor-pointer hover:from-blue-100/50 transition-all py-4"
                                onClick={() => handlePupilClick(summary.pupil)}
                              >
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9 border-2 border-blue-200">
                                    {summary.pupil.photo && (
                                      <AvatarImage src={summary.pupil.photo} alt={`${summary.pupil.firstName} ${summary.pupil.lastName}`} />
                                    )}
                                    <AvatarFallback className="text-sm bg-blue-100 text-blue-700">
                                      {summary.pupil.firstName[0]}{summary.pupil.lastName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-gray-900">{summary.pupil.firstName} {summary.pupil.lastName}</p>
                                    <p className="text-sm text-gray-500">{summary.pupil.admissionNumber}</p>
                                  </div>
                                </div>
                              </TableCell>
                            )}
                            
                            {/* Requirement details */}
                            <TableCell className="py-4">
                              <div>
                                <p className="font-medium text-gray-900">{req.requirement.name}</p>
                                {req.requirement.description && (
                                  <p className="text-sm text-gray-500 mt-1">{req.requirement.description}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge variant="outline" className="text-xs border-purple-200 text-purple-700 bg-purple-50">{req.requirement.group}</Badge>
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge variant="outline" className="border-gray-300">{summary.pupil.section}</Badge>
                            </TableCell>
                            <TableCell className="py-4">
                              <span className="font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{req.required}</span>
                            </TableCell>
                            <TableCell className="py-4">
                              <span className="font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md">{req.received}</span>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium">{req.progress.toFixed(1)}%</span>
                                </div>
                                <Progress value={req.progress} className="w-20 h-2" />
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(req.status)}
                                <Badge 
                                  variant="outline" 
                                  className={getStatusColor(req.status)}
                                >
                                  {req.status}
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        ));
                      })
                    ) : (
                      // Compact view - show summary per pupil
                      filteredAndSortedSummaries.map((summary) => (
                        <TableRow key={summary.pupil.id} className="hover:bg-blue-50/50 border-b border-gray-100">
                          <TableCell 
                            className="cursor-pointer hover:bg-blue-100/50 transition-colors py-4"
                            onClick={() => handlePupilClick(summary.pupil)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border-2 border-gray-200">
                                {summary.pupil.photo && (
                                  <AvatarImage src={summary.pupil.photo} alt={`${summary.pupil.firstName} ${summary.pupil.lastName}`} />
                                )}
                                <AvatarFallback className="text-sm bg-blue-100 text-blue-700">
                                  {summary.pupil.firstName[0]}{summary.pupil.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-gray-900">{summary.pupil.firstName} {summary.pupil.lastName}</p>
                                <p className="text-sm text-gray-500">{summary.pupil.admissionNumber}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="text-sm text-gray-600 italic">
                              {summary.detailedRequirements.length} requirements
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant="outline" className="text-xs border-purple-200 text-purple-700 bg-purple-50">Summary</Badge>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant="outline" className="border-gray-300">{summary.pupil.section}</Badge>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="font-medium">{summary.totalRequired}</span>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="font-medium text-green-600">{summary.totalReceived}</span>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{summary.overallProgress.toFixed(1)}%</span>
                              </div>
                              <Progress value={summary.overallProgress} className="w-20 h-2" />
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(summary.overallStatus)}
                              <Badge 
                                variant="outline" 
                                className={getStatusColor(summary.overallStatus)}
                              >
                                {summary.overallStatus}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Requirement Reception Modal */}
        {selectedPupil && (
          <RequirementReceptionModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedPupil(null);
            }}
            pupil={selectedPupil}
            classId={classId || ''}
            className={className}
          />
        )}
      </div>
    </div>
  );
}

export default function RequirementTrackingPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading requirements tracking...</span>
        </div>
      </div>
    }>
      <RequirementTrackingContent />
    </Suspense>
  );
} 