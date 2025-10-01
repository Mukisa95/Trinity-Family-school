"use client";

import * as React from "react";
import { ArrowLeft, Save, Calculator, GraduationCap, User, Hash, Calendar } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Import Firebase hooks and types
import { 
  usePLERecord, 
  usePLEResults, 
  usePLEResultsWithCurrentData,
  useSavePLEResults 
} from "@/lib/hooks/use-ple-results";
import type { PLEPupilResult, PLERecord } from "@/lib/services/ple-results.service";
import { useRecordSignatures } from "@/lib/hooks/use-digital-signature";
import { DigitalSignatureDisplay } from "@/components/common/digital-signature-display";
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';

// PLE Aggregates
const PLE_AGGREGATES = [
  { value: 'D1', label: 'D1 (Distinction 1)', points: 1 },
  { value: 'D2', label: 'D2 (Distinction 2)', points: 2 },
  { value: 'C3', label: 'C3 (Credit 3)', points: 3 },
  { value: 'C4', label: 'C4 (Credit 4)', points: 4 },
  { value: 'C5', label: 'C5 (Credit 5)', points: 5 },
  { value: 'C6', label: 'C6 (Credit 6)', points: 6 },
  { value: 'P7', label: 'P7 (Pass 7)', points: 7 },
  { value: 'P8', label: 'P8 (Pass 8)', points: 8 },
  { value: 'F9', label: 'F9 (Fail 9)', points: 9 },
];

// PLE Divisions
const PLE_DIVISIONS = [
  { value: 'I', label: 'Division I (4-12 points)' },
  { value: 'II', label: 'Division II (13-23 points)' },
  { value: 'III', label: 'Division III (24-29 points)' },
  { value: 'IV', label: 'Division IV (30+ points)' },
];

// PLE Subjects
const PLE_SUBJECTS = [
  { id: 'english', name: 'English', code: 'ENG' },
  { id: 'mathematics', name: 'Mathematics', code: 'MATH' },
  { id: 'science', name: 'Science', code: 'SCI' },
  { id: 'social_studies', name: 'Social Studies', code: 'SST' },
];



export default function RecordPLEResultsPage({ params }: { params: Promise<{ pleId: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  
  // Unwrap params using React.use()
  const { pleId } = React.use(params);
  
  // Firebase hooks
  const { data: pleRecord, isLoading: recordLoading, error: recordError } = usePLERecord(pleId);
  const { data: existingResults = [], isLoading: resultsLoading } = usePLEResults(pleId);
  const { data: enhancedResults = [] } = usePLEResultsWithCurrentData(pleId);
  const savePLEResultsMutation = useSavePLEResults();
  
  // Digital signature hooks
  const { data: signatures } = useRecordSignatures('exam_creation', pleId);
  
  // State management
  const [mounted, setMounted] = React.useState(false);
  const [pupilResults, setPupilResults] = React.useState<PLEPupilResult[]>([]);

  // Merge enhanced pupil data with editable results for display
  const displayResults = React.useMemo(() => {
    if (enhancedResults.length === 0 || pupilResults.length === 0) {
      return pupilResults;
    }

    return pupilResults.map(result => {
      const enhanced = enhancedResults.find(e => e.pupilId === result.pupilId);
      if (enhanced) {
        return {
          ...result,
          admissionNumber: enhanced.admissionNumber || result.admissionNumber,
          indexNumber: enhanced.indexNumber,
          firstName: enhanced.firstName || result.firstName,
          lastName: enhanced.lastName || result.lastName,
          otherNames: enhanced.otherNames || result.otherNames,
        };
      }
      return result;
    });
  }, [enhancedResults, pupilResults]);

  // Mount effect
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize pupil results when data loads
  React.useEffect(() => {
    if (pleRecord && mounted) {
      // Check if we have existing results
      if (existingResults.length > 0) {
        setPupilResults(existingResults);
      } else {
        // Initialize new results from pupil snapshots
        const initialResults: PLEPupilResult[] = pleRecord.pupilsSnapshot.map(pupil => ({
          pupilId: pupil.id,
          firstName: pupil.firstName,
          lastName: pupil.lastName,
          otherNames: pupil.otherNames || '',
          admissionNumber: pupil.admissionNumber,
          gender: pupil.gender,
          status: 'participated', // Default to participated
          subjects: PLE_SUBJECTS.reduce((acc, subject) => {
            acc[subject.id] = '';
            return acc;
          }, {} as Record<string, string>),
          totalAggregate: 0,
          division: ''
        }));
        setPupilResults(initialResults);
      }
    }
  }, [pleRecord, existingResults, mounted]);

  // Handle error state
  React.useEffect(() => {
    if (recordError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load PLE record. Please try again.",
      });
    }
  }, [recordError, toast]);

  const isLoading = recordLoading || resultsLoading;

  // Calculate total aggregate for a pupil
  const calculateTotalAggregate = (subjects: Record<string, string>): number => {
    return Object.values(subjects).reduce((total, aggregate) => {
      const aggregateData = PLE_AGGREGATES.find(agg => agg.value === aggregate);
      return total + (aggregateData?.points || 0);
    }, 0);
  };

  // Get division based on total aggregate
  const getDivisionFromAggregate = (totalAggregate: number): string => {
    if (totalAggregate === 0) return '';
    if (totalAggregate >= 4 && totalAggregate <= 12) return 'I';
    if (totalAggregate >= 13 && totalAggregate <= 23) return 'II';
    if (totalAggregate >= 24 && totalAggregate <= 29) return 'III';
    if (totalAggregate >= 30) return 'IV';
    return '';
  };

  // Handle aggregate change
  const handleAggregateChange = (pupilId: string, subjectId: string, aggregate: string) => {
    setPupilResults(prev => prev.map(pupil => {
      if (pupil.pupilId === pupilId) {
        const updatedSubjects = { ...pupil.subjects, [subjectId]: aggregate };
        const totalAggregate = calculateTotalAggregate(updatedSubjects);
        const division = getDivisionFromAggregate(totalAggregate);
        
        return {
          ...pupil,
          subjects: updatedSubjects,
          totalAggregate,
          division
        };
      }
      return pupil;
    }));
  };

  // Handle division change (manual override)
  const handleDivisionChange = (pupilId: string, division: string) => {
    setPupilResults(prev => prev.map(pupil => {
      if (pupil.pupilId === pupilId) {
        return { ...pupil, division };
      }
      return pupil;
    }));
  };

  // Handle status change (participated/missed)
  const handleStatusChange = (pupilId: string, status: 'participated' | 'missed') => {
    setPupilResults(prev => prev.map(pupil => {
      if (pupil.pupilId === pupilId) {
        if (status === 'missed') {
          // Clear all subjects and aggregates when marked as missed
          const clearedSubjects = PLE_SUBJECTS.reduce((acc, subject) => {
            acc[subject.id] = '';
            return acc;
          }, {} as Record<string, string>);
          
          return {
            ...pupil,
            status,
            subjects: clearedSubjects,
            totalAggregate: 0,
            division: ''
          };
        } else {
          return { ...pupil, status };
        }
      }
      return pupil;
    }));
  };

  // Save results
  const handleSaveResults = async () => {
    try {
      // Count pupils with complete and partial results
      const completeResults = pupilResults.filter(pupil => 
        Object.values(pupil.subjects).every(aggregate => aggregate) && pupil.division
      );
      
      const partialResults = pupilResults.filter(pupil => 
        Object.values(pupil.subjects).some(aggregate => aggregate) || pupil.division
      );
      
      const noResults = pupilResults.filter(pupil => 
        Object.values(pupil.subjects).every(aggregate => !aggregate) && !pupil.division
      );

      // Always allow saving - even if some pupils have no results yet
      await savePLEResultsMutation.mutateAsync({
        recordId: pleId,
        results: pupilResults
      });
      
      // Provide detailed feedback about what was saved
      let description = "";
      if (completeResults.length > 0) {
        description += `${completeResults.length} pupils with complete results. `;
      }
      if (partialResults.length > completeResults.length) {
        const partialOnly = partialResults.length - completeResults.length;
        description += `${partialOnly} pupils with partial results. `;
      }
      if (noResults.length > 0) {
        description += `${noResults.length} pupils with no results yet.`;
      }
      
      toast({
        title: "Results Saved Successfully",
        description: description.trim() || `Results saved for ${pupilResults.length} candidates.`,
      });
      
      // Navigate back to PLE results page
      router.push('/exams/ple-results');
    } catch (error) {
      console.error('Error saving results:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save results. Please try again.",
      });
    }
  };

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
        <div className="max-w-7xl mx-auto p-3 space-y-4">
          <PageHeader title="Record PLE Results" />
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading PLE record...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!pleRecord) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
        <div className="max-w-7xl mx-auto p-3 space-y-4">
          <PageHeader title="Record PLE Results" />
          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <p className="text-red-600 mb-2">PLE record not found</p>
              <Button onClick={() => router.push('/exams/ple-results')}>
                Back to PLE Results
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-3 space-y-4">
        <PageHeader
          title={`Record Results - ${pleRecord.examName}`}
          description="Enter PLE aggregates for each subject and candidate."
          actions={
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => router.push('/exams/ple-results')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
                          <Button 
              onClick={handleSaveResults}
              disabled={savePLEResultsMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {savePLEResultsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Results
                  </>
                )}
              </Button>
            </div>
          }
        />

        {/* Compact Exam Info */}
        <div className="bg-white rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-purple-600" />
              <div>
                <h2 className="font-semibold text-lg">{pleRecord.examName}</h2>
                <p className="text-sm text-gray-600">{pleRecord.totalCandidates} candidates • {PLE_SUBJECTS.length} subjects • Year {pleRecord.year}</p>
                {signatures && signatures.length > 0 && (
                  <div className="mt-1">
                    <DigitalSignatureDisplay 
                      signature={signatures[0].signature} 
                      variant="inline" 
                      className="text-xs text-gray-500" 
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calculator className="h-4 w-4" />
              <span>Aggregate System</span>
            </div>
          </div>
        </div>

        {/* Results Entry Table */}
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-2 font-medium text-gray-700 border-r text-sm min-w-[200px]">Candidate</th>
                  <th className="text-left p-2 font-medium text-gray-700 border-r text-sm min-w-[120px]">PIN / Index</th>
                  <th className="text-center p-2 font-medium text-gray-700 border-r text-sm min-w-[100px]">Status</th>
                  {PLE_SUBJECTS.map(subject => (
                    <th key={subject.id} className="text-center p-2 font-medium text-gray-700 border-r text-sm min-w-[80px]">
                      {subject.code}
                    </th>
                  ))}
                  <th className="text-center p-2 font-medium text-gray-700 border-r text-sm min-w-[80px]">Total</th>
                  <th className="text-center p-2 font-medium text-gray-700 text-sm min-w-[80px]">Div</th>
                </tr>
              </thead>
              <tbody>
                {displayResults.map((pupil, index) => (
                  <tr key={pupil.pupilId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="p-2 border-r">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {formatPupilDisplayName(pupil)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {pupil.gender}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 border-r">
                      <div className="space-y-1">
                        <div className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                          {pupil.admissionNumber || 'N/A'}
                        </div>
                        {pupil.indexNumber && (
                          <div className="text-xs font-mono bg-blue-100 px-2 py-0.5 rounded text-blue-700">
                            {pupil.indexNumber}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-2 border-r text-center">
                      <Select
                        value={pupil.status}
                        onValueChange={(value: 'participated' | 'missed') => handleStatusChange(pupil.pupilId, value)}
                      >
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="participated">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs">Participated</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="missed">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="text-xs">Missed</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    {PLE_SUBJECTS.map(subject => (
                      <td key={subject.id} className="p-2 border-r text-center">
                        {pupil.status === 'missed' ? (
                          <div className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                            Missed
                          </div>
                        ) : (
                          <Select
                            value={pupil.subjects[subject.id] || undefined}
                            onValueChange={(value) => handleAggregateChange(pupil.pupilId, subject.id, value)}
                          >
                            <SelectTrigger className="w-full h-8 text-xs">
                              <SelectValue placeholder="--" />
                            </SelectTrigger>
                            <SelectContent>
                              {PLE_AGGREGATES.map(agg => (
                                <SelectItem 
                                  key={agg.value} 
                                  value={agg.value}
                                  className="text-xs"
                                >
                                  {agg.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    ))}
                    <td className="p-2 border-r text-center">
                      {pupil.status === 'missed' ? (
                        <div className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                          Missed
                        </div>
                      ) : (
                        <div className={`px-2 py-1 rounded text-xs font-mono font-medium ${
                          pupil.totalAggregate > 0 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {pupil.totalAggregate || '--'}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {pupil.status === 'missed' ? (
                        <div className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                          Missed
                        </div>
                      ) : (
                        <Select
                          value={pupil.division || undefined}
                          onValueChange={(value) => handleDivisionChange(pupil.pupilId, value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue placeholder="Auto" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLE_DIVISIONS.map(div => (
                              <SelectItem 
                                key={div.value} 
                                value={div.value}
                                className="text-xs"
                              >
                                {div.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compact Legend */}
        <div className="bg-white rounded-lg border p-3">
          <h4 className="font-medium text-sm text-gray-700 mb-2">PLE Grading System</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {PLE_AGGREGATES.map(agg => (
              <div key={agg.value} className="flex items-center gap-1">
                <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                  {agg.value}
                </span>
                <span className="text-gray-600">{agg.points}pts</span>
              </div>
            ))}
            <div className="w-px h-4 bg-gray-300 mx-2"></div>
            {PLE_DIVISIONS.map(div => (
              <div key={div.value} className="flex items-center gap-1">
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                  Div {div.value}
                </span>
                <span className="text-gray-600">{div.label.split('(')[1]?.replace(')', '')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 