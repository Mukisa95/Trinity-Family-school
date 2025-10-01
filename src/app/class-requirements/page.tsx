"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { 
  ArrowLeft, 
  BookOpen, 
  Users, 
  Calendar, 
  School,
  TrendingUp,
  CheckCircle,
  Clock,
  Package,
  Filter,
  Download,
  RefreshCw,
  Eye,
  User,
  GraduationCap,
  AlertTriangle
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useClass } from "@/lib/hooks/use-classes";
import { usePupilsByClass } from "@/lib/hooks/use-pupils";
import { useRequirementTrackingByClass } from "@/lib/hooks/use-requirement-tracking";
import { useRequirements } from "@/lib/hooks/use-requirements";
import { useAcademicYears, useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { getCurrentTerm } from "@/lib/utils/academic-year-utils";
import { formatCurrency } from "@/lib/utils";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";
import { PupilRequirementStatusButton } from "@/components/class/pupil-requirement-status-button";
import { RequirementReceptionModal } from "@/components/class/requirement-reception-modal";
import type { Pupil, RequirementTracking } from "@/types";

interface PupilRequirementStats {
  pupil: Pupil;
  totalRequirements: number;
  completedRequirements: number;
  partialRequirements: number;
  pendingRequirements: number;
  totalValue: number;
  paidValue: number;
  completionPercentage: number;
  lastActivity?: string;
  trackingRecords: RequirementTracking[];
}

function ClassRequirementsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('id');
  
  const [selectedAcademicYear, setSelectedAcademicYear] = React.useState<string>('');
  const [selectedTerm, setSelectedTerm] = React.useState<string>('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [selectedPupil, setSelectedPupil] = React.useState<Pupil | null>(null);
  const [isReceptionModalOpen, setIsReceptionModalOpen] = React.useState(false);

  // Data fetching
  const { data: classDetail, isLoading: classLoading } = useClass(classId || '');
  const { data: pupilsInClass = [], isLoading: pupilsLoading } = usePupilsByClass(classId || '');
  const { data: allRequirements = [] } = useRequirements();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  
  const currentTerm = activeAcademicYear ? getCurrentTerm(activeAcademicYear) : null;

  // Initialize filters with current academic year and term
  React.useEffect(() => {
    if (activeAcademicYear && !selectedAcademicYear) {
      setSelectedAcademicYear(activeAcademicYear.id);
      if (currentTerm && !selectedTerm) {
        setSelectedTerm(currentTerm.id);
      }
    }
  }, [activeAcademicYear, currentTerm, selectedAcademicYear, selectedTerm]);

  // Get tracking data for the selected period
  const { data: trackingRecords = [], isLoading: trackingLoading, refetch } = useRequirementTrackingByClass(
    classId || '',
    selectedAcademicYear,
    selectedTerm
  );

  // Calculate statistics for each pupil
  const pupilStats: PupilRequirementStats[] = React.useMemo(() => {
    return pupilsInClass.map(pupil => {
      const pupilRecords = trackingRecords.filter(record => record.pupilId === pupil.id);
      
      let totalRequirements = pupilRecords.length;
      let completedRequirements = 0;
      let partialRequirements = 0;
      let pendingRequirements = 0;
      let totalValue = 0;
      let paidValue = 0;
      let lastActivity = '';

      pupilRecords.forEach(record => {
        const totalRequired = record.totalItemQuantityRequired || 1;
        const received = record.itemQuantityProvided || 0;
        
        // Get requirement details from allRequirements array
        const requirementIds = Array.isArray(record.requirementId) ? record.requirementId : [record.requirementId];
        const requirementPrice = requirementIds.reduce((sum, reqId) => {
          const requirement = allRequirements.find(req => req.id === reqId);
          return sum + (requirement?.price || 0);
        }, 0);
        
        totalValue += requirementPrice;
        paidValue += record.paidAmount || 0;

        if (received >= totalRequired) {
          completedRequirements++;
        } else if (received > 0) {
          partialRequirements++;
        } else {
          pendingRequirements++;
        }

        // Find latest activity
        const latestHistory = record.history?.[record.history.length - 1];
        if (latestHistory && (!lastActivity || latestHistory.date > lastActivity)) {
          lastActivity = latestHistory.date;
        }
      });

      const completionPercentage = totalRequirements > 0 
        ? Math.round((completedRequirements / totalRequirements) * 100)
        : 0;

      return {
        pupil,
        totalRequirements,
        completedRequirements,
        partialRequirements,
        pendingRequirements,
        totalValue,
        paidValue,
        completionPercentage,
        lastActivity,
        trackingRecords: pupilRecords
      };
    });
  }, [pupilsInClass, trackingRecords, allRequirements]);

  // Filter pupils based on search and status
  const filteredPupilStats = React.useMemo(() => {
    return pupilStats.filter(stat => {
      const matchesSearch = !searchQuery || 
        stat.pupil.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stat.pupil.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stat.pupil.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'complete' && stat.completionPercentage === 100) ||
        (statusFilter === 'partial' && stat.completionPercentage > 0 && stat.completionPercentage < 100) ||
        (statusFilter === 'pending' && stat.completionPercentage === 0);

      return matchesSearch && matchesStatus;
    });
  }, [pupilStats, searchQuery, statusFilter]);

  // Calculate class overview statistics
  const classStats = React.useMemo(() => {
    const totalPupils = pupilStats.length;
    const completedPupils = pupilStats.filter(s => s.completionPercentage === 100).length;
    const partialPupils = pupilStats.filter(s => s.completionPercentage > 0 && s.completionPercentage < 100).length;
    const pendingPupils = pupilStats.filter(s => s.completionPercentage === 0).length;
    
    const totalValue = pupilStats.reduce((sum, s) => sum + s.totalValue, 0);
    const totalPaid = pupilStats.reduce((sum, s) => sum + s.paidValue, 0);
    const classCompletionPercentage = totalPupils > 0 
      ? Math.round((completedPupils / totalPupils) * 100)
      : 0;

    return {
      totalPupils,
      completedPupils,
      partialPupils,
      pendingPupils,
      totalValue,
      totalPaid,
      classCompletionPercentage
    };
  }, [pupilStats]);

  const handleOpenReceptionModal = (pupil: Pupil) => {
    setSelectedPupil(pupil);
    setIsReceptionModalOpen(true);
  };

  const handleCloseReceptionModal = () => {
    setSelectedPupil(null);
    setIsReceptionModalOpen(false);
    refetch(); // Refresh data after modal closes
  };

  const getStatusBadge = (stat: PupilRequirementStats) => {
    if (stat.completionPercentage === 100) {
      return <Badge className="bg-green-100 text-green-800">Complete</Badge>;
    } else if (stat.completionPercentage > 0) {
      return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
    } else if (stat.totalRequirements > 0) {
      return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
    } else {
      return <Badge variant="outline">No Requirements</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!classId) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <PageHeader title="Class Requirements" />
        <p className="text-muted-foreground">No class ID provided.</p>
        <Button asChild className="mt-4">
          <Link href="/classes"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Classes</Link>
        </Button>
      </div>
    );
  }

  if (classLoading || pupilsLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Loading Class Requirements..." />
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    );
  }

  const selectedAcademicYearData = academicYears.find(y => y.id === selectedAcademicYear);
  const selectedTermData = selectedAcademicYearData?.terms.find(t => t.id === selectedTerm);

  return (
    <>
      <div className="space-y-6">
        {/* Recess Status Banner */}
        <RecessStatusBanner />
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <Button asChild variant="outline">
                <Link href={`/class-detail?id=${classId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class Detail
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{classDetail?.name} Requirements</h1>
                <p className="text-muted-foreground">
                  Comprehensive requirement tracking and management
                </p>
              </div>
            </div>
          </div>
          <Button onClick={() => refetch()} disabled={trackingLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${trackingLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Academic Year and Term Selection */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Academic Period Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Academic Year</Label>
                <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Academic Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map(year => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name} {year.isActive ? '(Current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Term</Label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Term" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedAcademicYearData?.terms.map(term => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name} {term.isCurrent ? '(Current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedAcademicYearData && selectedTermData && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Viewing:</strong> {selectedAcademicYearData.name} - {selectedTermData.name}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {new Date(selectedTermData.startDate).toLocaleDateString()} - {new Date(selectedTermData.endDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Class Overview Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Pupils</p>
                  <p className="text-2xl font-bold">{classStats.totalPupils}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{classStats.completedPupils}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold text-blue-600">{classStats.partialPupils}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-amber-600">{classStats.pendingPupils}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Overview */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Class Completion</p>
                <div className="mt-2">
                  <div className="text-3xl font-bold">{classStats.classCompletionPercentage}%</div>
                  <Progress value={classStats.classCompletionPercentage} className="mt-2" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Value</p>
                <div className="text-2xl font-bold mt-2">{formatCurrency(classStats.totalValue)}</div>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Amount Paid</p>
                <div className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(classStats.totalPaid)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Search Pupils</Label>
                <Input
                  placeholder="Search by name or admission number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status Filter</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                    <SelectItem value="partial">In Progress</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Actions</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Advanced
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pupils Requirements Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Pupil Requirements Overview ({filteredPupilStats.length} pupils)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pupil</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Requirements</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPupilStats.map((stat) => (
                    <TableRow key={stat.pupil.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {stat.pupil.photo && (
                              <AvatarImage src={stat.pupil.photo} alt={`${stat.pupil.firstName} ${stat.pupil.lastName}`} />
                            )}
                            <AvatarFallback>
                              {stat.pupil.firstName[0]}{stat.pupil.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {stat.pupil.firstName} {stat.pupil.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {stat.pupil.admissionNumber}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(stat)}
                            <span className="text-sm font-medium">{stat.completionPercentage}%</span>
                          </div>
                          <Progress value={stat.completionPercentage} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            {stat.completedRequirements}/{stat.totalRequirements} items
                          </div>
                          {stat.partialRequirements > 0 && (
                            <div className="text-xs text-blue-600">
                              {stat.partialRequirements} partial
                            </div>
                          )}
                          {stat.pendingRequirements > 0 && (
                            <div className="text-xs text-amber-600">
                              {stat.pendingRequirements} pending
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {formatCurrency(stat.paidValue)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            of {formatCurrency(stat.totalValue)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(stat.lastActivity)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReceptionModal(stat.pupil)}
                          >
                            <Package className="mr-1 h-3 w-3" />
                            Receive
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <Link href={`/requirement-tracking?id=${stat.pupil.id}`}>
                              <Eye className="mr-1 h-3 w-3" />
                              View
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {filteredPupilStats.length === 0 && (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No pupils match the current filters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Requirement Reception Modal */}
      {selectedPupil && (
        <RequirementReceptionModal
          isOpen={isReceptionModalOpen}
          onClose={handleCloseReceptionModal}
          pupil={selectedPupil}
          classId={classId}
          className={classDetail?.name || ''}
        />
      )}
    </>
  );
}

export default function ClassRequirementsPage() {
  return (
    <div className="p-4 sm:p-6">
      <Suspense fallback={
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading class requirements...</span>
        </div>
      }>
        <ClassRequirementsContent />
      </Suspense>
    </div>
  );
} 