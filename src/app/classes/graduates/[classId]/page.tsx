"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import * as React from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, Calendar, Users, ArrowLeft, Award, Download, BookOpen, Eye, Edit, ChevronDown, ChevronRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { GraduatedPupil, Class } from "@/types";
import { usePupils } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { usePLERecords, usePupilPLEResults } from "@/lib/hooks/use-ple-results";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Link from "next/link";

// Component to display expanded PLE results for a pupil in compact single-row format
function PupilPLEResultsExpanded({ pupilId }: { pupilId: string }) {
  const { data: pupilPLEResults = [], isLoading } = usePupilPLEResults(pupilId);
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-purple-600 mr-2" />
        <span className="text-xs text-gray-600">Loading PLE results...</span>
      </div>
    );
  }

  if (pupilPLEResults.length === 0) {
    return (
      <div className="text-center py-2">
        <p className="text-xs text-gray-500">No PLE results found for this pupil.</p>
      </div>
    );
  }

  const getDivisionColor = (division: string) => {
    switch (division) {
      case 'I': return 'bg-green-100 text-green-800 border-green-200';
      case 'II': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'III': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'IV': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAggregateColor = (aggregate: string | number | undefined) => {
    if (!aggregate) return 'bg-gray-100 text-gray-800';
    const aggregateStr = String(aggregate);
    if (aggregateStr.startsWith('D')) return 'bg-green-100 text-green-800';
    if (aggregateStr.startsWith('C')) return 'bg-blue-100 text-blue-800';
    if (aggregateStr.startsWith('P')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="py-2">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="h-3 w-3 text-purple-600" />
        <span className="text-xs font-semibold text-gray-700">PLE Results:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {pupilPLEResults.map(({ pleRecord, pupilResult }) => (
          <div
            key={pleRecord.id}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-gray-700">{pleRecord.year}</span>
              {pupilResult.status === 'missed' ? (
                <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                  Missed
                </Badge>
              ) : (
                <>
                  {pupilResult.division && (
                    <Badge className={`${getDivisionColor(pupilResult.division)} text-xs font-bold px-1.5 py-0.5`}>
                      Div {pupilResult.division}
                    </Badge>
                  )}
                  {pupilResult.totalAggregate && (
                    <Badge variant="outline" className={`${getAggregateColor(pupilResult.totalAggregate)} text-xs font-mono px-1.5 py-0.5`}>
                      {pupilResult.totalAggregate}
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    {Object.entries(pupilResult.subjects || {}).map(([subject, grade]) => (
                      <span key={subject} className="font-mono">
                        {subject === 'english' ? 'ENG' : subject === 'mathematics' ? 'MATH' : subject === 'science' ? 'SCI' : 'SST'}: {grade}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => router.push(`/exams/ple-results/pupil/${pupilResult.pupilId}/${pleRecord.id}`)}
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GraduateClassPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  const { data: allPLERecords = [], isLoading: pleRecordsLoading } = usePLERecords();
  
  const [expandedYears, setExpandedYears] = React.useState<string[]>([]);
  const [expandedPupils, setExpandedPupils] = React.useState<Set<string>>(new Set());
  const [expandAllPupils, setExpandAllPupils] = React.useState<Record<number, boolean>>({});
  
  // Get the current class
  const currentClass = React.useMemo(() => 
    allClasses.find(c => c.id === classId),
    [allClasses, classId]
  );

  // Get graduated pupils from this class
  const graduatedPupils = React.useMemo(() => {
    return allPupils.filter(pupil => 
      pupil.status === 'Graduated' && 
      pupil.graduationClassId === classId
    ) as GraduatedPupil[];
  }, [allPupils, classId]);

  // Group graduates by year
  const graduatesByYear = React.useMemo(() => {
    const grouped: Record<number, GraduatedPupil[]> = {};
    graduatedPupils.forEach(pupil => {
      if (pupil.graduationYear) {
        if (!grouped[pupil.graduationYear]) {
          grouped[pupil.graduationYear] = [];
        }
        grouped[pupil.graduationYear].push(pupil);
      }
    });
    
    // Sort pupils within each year by name
    Object.keys(grouped).forEach(year => {
      grouped[parseInt(year)].sort((a, b) => 
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      );
    });
    
    return grouped;
  }, [graduatedPupils]);

  // Get available years (sorted, most recent first)
  const availableYears = React.useMemo(() => {
    return Object.keys(graduatesByYear)
      .map(year => parseInt(year))
      .sort((a, b) => b - a); // Most recent first
  }, [graduatesByYear]);

  // Sync expand all state with individual expansions for each year
  React.useEffect(() => {
    availableYears.forEach(year => {
      const yearGraduates = graduatesByYear[year] || [];
      if (yearGraduates.length === 0) return;
      
      const allExpanded = yearGraduates.every(p => expandedPupils.has(p.id));
      const noneExpanded = yearGraduates.every(p => !expandedPupils.has(p.id));
      
      if (allExpanded) {
        setExpandAllPupils(prev => ({ ...prev, [year]: true }));
      } else if (noneExpanded) {
        setExpandAllPupils(prev => ({ ...prev, [year]: false }));
      }
    });
  }, [expandedPupils, availableYears, graduatesByYear]);

  const handleExportGraduates = () => {
    // TODO: Implement export functionality
    console.log('Export all graduates');
  };

  if (pupilsLoading || classesLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Graduate Class" />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading graduates...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentClass) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Graduate Class" />
        <Card className="p-8 text-center">
          <div className="text-red-600 mb-4">
            <GraduationCap className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Class Not Found</h3>
          <p className="text-gray-600 mb-4">The requested class could not be found.</p>
          <SmartBackButton fallbackHref="/classes" className="mr-2 h-4 w-4">
  <ArrowLeft className="mr-2 h-4 w-4" />
  Back to Classes
</SmartBackButton>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Graduate Class</h1>
              <p className="text-sm text-gray-600">{currentClass.name} ({currentClass.code})</p>
            </div>
          </div>
        }
        description={`View all graduates from ${currentClass.name} organized by graduation year`}
        actions={
          <div className="flex items-center gap-2">
            {/* Action Buttons Container */}
            <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1">
              <button
                onClick={() => router.push('/classes')}
                className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-gray-600 border border-gray-400 shadow-sm hover:bg-gradient-to-br hover:from-gray-400 hover:via-gray-500 hover:to-gray-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <ArrowLeft className="w-4 h-4 mb-0.5" />
                <span className="text-[8px] font-semibold leading-tight">Back</span>
              </button>
              
              {graduatedPupils.length > 0 && (
                <button
                  onClick={handleExportGraduates}
                  className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-blue-600 border border-blue-400 shadow-sm hover:bg-gradient-to-br hover:from-blue-400 hover:via-indigo-500 hover:to-blue-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <Download className="w-4 h-4 mb-0.5" />
                  <span className="text-[8px] font-semibold leading-tight">Export</span>
                </button>
              )}
            </div>
          </div>
        }
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Total Graduates</p>
                <p className="text-2xl font-bold text-green-700">{graduatedPupils.length}</p>
              </div>
              <Award className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Graduation Years</p>
                <p className="text-2xl font-bold text-blue-700">{availableYears.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Latest Batch</p>
                <p className="text-2xl font-bold text-purple-700">
                  {availableYears.length > 0 ? availableYears[0] : 'N/A'}
                </p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Graduates Display */}
      {graduatedPupils.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Graduates Yet</h3>
          <p className="text-gray-600 mb-4">
            {currentClass.name} doesn't have any graduated pupils yet.
          </p>
          <Button asChild variant="outline">
            <Link href="/pupils/promote">
              <GraduationCap className="mr-2 h-4 w-4" />
              Graduate Pupils
            </Link>
          </Button>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Accordion 
              type="multiple" 
              value={expandedYears} 
              onValueChange={setExpandedYears}
              className="w-full"
            >
              {availableYears.map((year) => {
                const yearGraduates = graduatesByYear[year] || [];
                // Find PLE record for this year
                const pleRecordForYear = allPLERecords.find(record => record.year === year);
                // Filter PLE records to only include those with pupils from this class
                const classPupilsInPLE = pleRecordForYear 
                  ? pleRecordForYear.pupilsSnapshot.filter(p => p.classId === classId)
                  : [];
                
                return (
                  <AccordionItem key={year} value={year.toString()} className="border-b border-gray-200">
                    <AccordionTrigger className="hover:no-underline px-6 py-4 bg-gradient-to-r from-yellow-50 to-orange-50 hover:from-yellow-100 hover:to-orange-100 transition-colors">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-lg font-bold text-gray-900">
                              CLASS OF {year}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {yearGraduates.length} {yearGraduates.length === 1 ? 'graduate' : 'graduates'}
                              {pleRecordForYear && classPupilsInPLE.length > 0 && (
                                <span className="ml-2">• {classPupilsInPLE.length} PLE candidate{classPupilsInPLE.length !== 1 ? 's' : ''}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {pleRecordForYear && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
                              <BookOpen className="w-3 h-3 mr-1" />
                              PLE {year}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            {yearGraduates.length}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-4 space-y-4">
                      {/* PLE Results Management Section */}
                      {pleRecordForYear && classPupilsInPLE.length > 0 && (
                        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                  <BookOpen className="w-5 h-5 text-purple-600" />
                                  <h4 className="font-semibold text-lg text-gray-900">
                                    {pleRecordForYear.examName}
                                  </h4>
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                    {pleRecordForYear.year}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Total Candidates</p>
                                    <p className="text-lg font-semibold text-gray-900">
                                      {classPupilsInPLE.length}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Male</p>
                                    <p className="text-lg font-semibold text-gray-900">
                                      {classPupilsInPLE.filter(p => p.gender === 'Male').length}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Female</p>
                                    <p className="text-lg font-semibold text-gray-900">
                                      {classPupilsInPLE.filter(p => p.gender === 'Female').length}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">All Candidates</p>
                                    <p className="text-lg font-semibold text-gray-900">
                                      {pleRecordForYear.totalCandidates}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-4">
                                {/* Action Buttons Container */}
                                <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1">
                                  <Link href={`/exams/ple-results/${pleRecordForYear.id}/view-results`}>
                                    <button
                                      className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-blue-600 border border-blue-400 shadow-sm hover:bg-gradient-to-br hover:from-blue-400 hover:via-indigo-500 hover:to-blue-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                                    >
                                      <Eye className="w-4 h-4 mb-0.5" />
                                      <span className="text-[8px] font-semibold leading-tight">View</span>
                                    </button>
                                  </Link>
                                  <Link href={`/exams/ple-results/${pleRecordForYear.id}/record-results`}>
                                    <button
                                      className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-purple-600 border border-purple-400 shadow-sm hover:bg-gradient-to-br hover:from-purple-400 hover:via-violet-500 hover:to-purple-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                                    >
                                      <Edit className="w-4 h-4 mb-0.5" />
                                      <span className="text-[8px] font-semibold leading-tight">Record</span>
                                    </button>
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Graduates Table */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[30px]">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    const isCurrentlyExpanded = expandAllPupils[year] || false;
                                    setExpandAllPupils(prev => ({
                                      ...prev,
                                      [year]: !isCurrentlyExpanded
                                    }));
                                    
                                    // Expand or collapse all pupils for this year
                                    if (!isCurrentlyExpanded) {
                                      // Expand all
                                      setExpandedPupils(prev => {
                                        const newSet = new Set(prev);
                                        yearGraduates.forEach(pupil => newSet.add(pupil.id));
                                        return newSet;
                                      });
                                    } else {
                                      // Collapse all
                                      setExpandedPupils(prev => {
                                        const newSet = new Set(prev);
                                        yearGraduates.forEach(pupil => newSet.delete(pupil.id));
                                        return newSet;
                                      });
                                    }
                                  }}
                                  title={expandAllPupils[year] ? "Collapse All" : "Expand All"}
                                >
                                  {expandAllPupils[year] ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableHead>
                              <TableHead className="w-[50px]">#</TableHead>
                              <TableHead>Pupil</TableHead>
                              <TableHead>Admission No.</TableHead>
                              <TableHead>Gender</TableHead>
                              <TableHead>Section</TableHead>
                              <TableHead>Graduation Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {yearGraduates.map((pupil, index) => {
                              const isExpanded = expandedPupils.has(pupil.id);
                              return (
                                <React.Fragment key={pupil.id}>
                                  <TableRow className="hover:bg-yellow-50/50">
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => {
                                          setExpandedPupils(prev => {
                                            const newSet = new Set(prev);
                                            if (isExpanded) {
                                              newSet.delete(pupil.id);
                                            } else {
                                              newSet.add(pupil.id);
                                            }
                                            return newSet;
                                          });
                                        }}
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TableCell>
                                    <TableCell className="font-medium text-gray-500">
                                      {index + 1}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                          <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-medium text-sm">
                                            {pupil.firstName[0]}{pupil.lastName[0]}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <Link 
                                            href={`/pupil-detail?id=${pupil.id}`}
                                            className="font-semibold text-gray-900 hover:text-primary hover:underline cursor-pointer transition-colors"
                                          >
                                            {pupil.firstName} {pupil.lastName}
                                          </Link>
                                          {pupil.otherNames && (
                                            <p className="text-sm text-gray-500">{pupil.otherNames}</p>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                      {pupil.admissionNumber}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs">
                                        {pupil.gender || 'N/A'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {pupil.section ? (
                                        <Badge variant="outline" className="text-xs">
                                          {pupil.section}
                                        </Badge>
                                      ) : (
                                        <span className="text-gray-400 text-sm">N/A</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {pupil.graduationDate ? 
                                        new Date(pupil.graduationDate).toLocaleDateString('en-US', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric'
                                        }) : 'N/A'
                                      }
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={7} className="bg-purple-50/30 p-4">
                                        <PupilPLEResultsExpanded pupilId={pupil.id} />
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 