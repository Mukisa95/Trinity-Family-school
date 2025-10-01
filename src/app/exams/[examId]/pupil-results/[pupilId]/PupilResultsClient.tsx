"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Loader2, 
  X, 
  Trophy, 
  AlertTriangle, 
  BookOpen, 
  BarChart3,
  User,
  Calendar,
  GraduationCap,
  Medal,
  Bookmark,
  Download,
  ChevronLeft,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  LineChart,
  Scale,
  Check,
  Star,
  TrendingUp,
  Award,
  Target,
  ChevronRight,
  Eye,
  PrinterIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useExams, useExamResultByExamId, usePupilExamHistory } from '@/lib/hooks/use-exams';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import type { 
  Exam, 
  ExamResult, 
  GradingScaleItem, 
  ExamRecordPupilInfo,
  ExamRecordSubjectInfo,
  PupilSubjectResult,
  ExamClassInfoSnapshot
} from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Utility functions for results calculation
const getGradeColor = (grade: string): string => {
  if (grade.startsWith('D')) return 'bg-green-100 text-green-800 border-green-200';
  if (grade.startsWith('C')) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (grade.startsWith('P')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200'; // For F9
};

const getDivisionColor = (division: string): string => {
  switch (division) {
    case 'I': return 'bg-green-100 text-green-800 border-green-200';
    case 'II': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'III': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'IV': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-red-100 text-red-800 border-red-200'; // For 'U'
  }
};

const calculateDivision = (aggregates: number): string => {
  if (aggregates >= 4 && aggregates <= 12) return 'I';
  if (aggregates >= 13 && aggregates <= 24) return 'II';
  if (aggregates >= 25 && aggregates <= 28) return 'III';
  if (aggregates >= 29 && aggregates <= 32) return 'IV';
  return 'U'; // Ungraded (33-36)
};

const getRemarks = (marks: number): string => {
  if (marks >= 90) return 'Excellent';
  if (marks >= 80) return 'Very Good';
  if (marks >= 70) return 'Good';
  if (marks >= 60) return 'Fair';
  if (marks >= 50) return 'Average';
  if (marks >= 40) return 'Below Average';
  return 'Poor';
};

export default function PupilResultsClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Get IDs directly from params (works perfectly on Vercel)
  const examId = params.examId as string;
  const pupilId = params.pupilId as string;
  const classId = searchParams.get('classId') as string;

  // Fetch data with the same hooks used in ViewResultsView
  const { data: exams = [], isLoading: isLoadingExams } = useExams();
  const { data: academicYears = [] } = useAcademicYears();
  const examDetails = useMemo(() => exams.find((exam: Exam) => exam.id === examId), [exams, examId]);

  const { 
    data: examResultData, 
    isLoading: isLoadingExamResult, 
    error: examResultError 
  } = useExamResultByExamId(examId);

  // Extract data from exam results
  const classSnap: ExamClassInfoSnapshot | undefined = useMemo(() => examResultData?.classSnapshot, [examResultData]);
  const pupilSnaps: ExamRecordPupilInfo[] = useMemo(() => examResultData?.pupilSnapshots || [], [examResultData]);
  const subjectSnaps: ExamRecordSubjectInfo[] = useMemo(() => examResultData?.subjectSnapshots || [], [examResultData]);
  const actualResults: Record<string, Record<string, PupilSubjectResult>> = useMemo(() => examResultData?.results || {}, [examResultData]);

  // Get current pupil's details
  const pupilDetails = useMemo(() => 
    pupilSnaps.find(pupil => pupil.pupilId === pupilId), 
  [pupilSnaps, pupilId]);

  // Function to get academic year and term names
  const getAcademicYearAndTerm = useCallback((academicYearId: string, termId: string) => {
    const academicYear = academicYears?.find(year => year.id === academicYearId);
    const term = academicYear?.terms?.find(term => term.id === termId);
    return {
      academicYearName: academicYear?.name || 'Unknown Year',
      termName: term?.name || 'Unknown Term'
    };
  }, [academicYears]);

  // Calculate pupil's results and performance
  const pupilResults = useMemo(() => {
    if (!actualResults || !pupilId || !subjectSnaps.length) return null;

    const pupilResults = actualResults[pupilId] || {};
    
    let totalMarks = 0;
    let totalAggregates = 0;
    const subjectResults = [];
    
    for (const subject of subjectSnaps) {
      const result = pupilResults[subject.subjectId] || { marks: 0, grade: 'F9', aggregates: 9 };
      totalMarks += result.marks || 0;
      
      // Only count aggregates for major subjects (first 4 if more than 4 subjects)
      if (subjectSnaps.length <= 4 || subjectSnaps.indexOf(subject) < 4) {
      totalAggregates += result.aggregates || 0;
      }
      
      subjectResults.push({
        ...subject,
        ...result
      });
    }

    const division = calculateDivision(totalAggregates);
    
    return {
      totalMarks,
      totalAggregates,
      division,
      subjectResults,
      averageMarks: totalMarks / subjectSnaps.length
    };
  }, [actualResults, pupilId, subjectSnaps]);

  // Calculate position among classmates
  const position = useMemo(() => {
    if (!pupilSnaps.length || !actualResults) return 'N/A';
    
    const pupilTotals = pupilSnaps.map(pupil => {
      const results = actualResults[pupil.pupilId] || {};
      let total = 0;
      
      for (const subject of subjectSnaps) {
        const result = results[subject.subjectId] || { marks: 0 };
        total += result.marks || 0;
      }
      
      return { pupilId: pupil.pupilId, total };
    }).sort((a, b) => b.total - a.total);
    
    const currentPosition = pupilTotals.findIndex(p => p.pupilId === pupilId) + 1;
    return `${currentPosition} out of ${pupilSnaps.length}`;
  }, [pupilSnaps, actualResults, subjectSnaps, pupilId]);

  // Add state for the exam history tab
  const [activeTab, setActiveTab] = useState<string>("current");
  
  // Replace the mock history hook with the real data hook
  const { 
    data: examHistoryData, 
    isLoading: isLoadingHistory, 
    error: historyError 
  } = usePupilExamHistory(pupilId, examId);

  // Process history data
  const examHistory = useMemo(() => {
    if (!examHistoryData || !pupilResults) return [];
    
    const { examResults, exams } = examHistoryData;
    
    type ProcessedHistory = {
      examId: string;
      examName: string;
      examDate: string;
      totalMarks: number;
      averageMarks: number;
      totalAggregates: number;
      division: string;
      position: string;
      subjects: Record<string, any>;
      trend: 'up' | 'down' | 'same';
    };
    
    const processed = examResults.map((result, index) => {
      // Find matching exam
      const examInfo = exams.find(exam => exam.id === result.examId);
      if (!examInfo) return null;
      
      // Calculate totals for this exam
      let totalMarks = 0;
      let totalAggregates = 0;
      const subjects: Record<string, any> = {};
      
      if (result.results && result.results[pupilId]) {
        const pupilResult = result.results[pupilId];
        
        Object.entries(pupilResult).forEach(([subjectId, subjectResult]) => {
          const subjectInfo = result.subjectSnapshots?.find(s => s.subjectId === subjectId);
          if (subjectInfo && subjectResult) {
        totalMarks += subjectResult.marks || 0;
        totalAggregates += subjectResult.aggregates || 0;
            subjects[subjectInfo.code] = {
              name: subjectInfo.name,
              marks: subjectResult.marks || 0,
              grade: subjectResult.grade || 'F9',
              aggregates: subjectResult.aggregates || 9
            };
          }
        });
      }
      
      const division = calculateDivision(totalAggregates);
      const averageMarks = Object.keys(subjects).length > 0 ? totalMarks / Object.keys(subjects).length : 0;

      // Calculate trend compared to previous exam
      let trend: 'up' | 'down' | 'same' = 'same';
      if (index > 0) {
        const prevTotal = examResults[index - 1] ? 
          Object.values(examResults[index - 1].results?.[pupilId] || {})
            .reduce((sum: number, result: any) => sum + (result?.marks || 0), 0) : 0;
        
        if (totalMarks > prevTotal) trend = 'up';
        else if (totalMarks < prevTotal) trend = 'down';
      }
      
      // Calculate position
      const classResults = Object.entries(result.results || {}).map(([pId, pResults]) => {
        const total = Object.values(pResults as Record<string, any>).reduce((sum, res) => sum + (res?.marks || 0), 0);
        return { pupilId: pId, total };
      }).sort((a, b) => b.total - a.total);
      
      const pos = classResults.findIndex(p => p.pupilId === pupilId) + 1;
      const position = `${pos} out of ${classResults.length}`;
      
      return {
        examId: result.examId,
        examName: examInfo.name,
        examDate: examInfo.startDate,
        totalMarks,
        averageMarks,
        totalAggregates,
        division,
        position,
        subjects,
        trend
      };
    }).filter(Boolean) as ProcessedHistory[];

    return processed.sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());
  }, [examHistoryData, pupilId, pupilResults]);

  const isLoading = isLoadingExams || isLoadingExamResult;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-lg text-gray-700">Loading pupil results...</p>
        </div>
      </div>
    );
  }

  if (examResultError || !pupilDetails || !pupilResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <X className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Error loading results</h2>
          <p className="mt-2 text-gray-500">Unable to load pupil results. Please try again.</p>
          <Button 
            onClick={() => router.back()} 
            className="mt-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const academicInfo = getAcademicYearAndTerm(examDetails?.academicYearId || '', examDetails?.termId || '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-3 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Modern Header with Gradient */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden backdrop-blur-sm backdrop-filter mb-6">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => router.back()}
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-10 w-10 p-0 rounded-full"
                  variant="outline"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white">
                    Individual Results
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-blue-100">
                    {examDetails?.name || 'Loading...'} | {academicInfo.academicYearName} - {academicInfo.termName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
              <Button
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-8 text-xs"
                variant="outline"
                >
                  <PrinterIcon className="w-3 h-3 mr-1" />
                  Print Report
                </Button>
                <Button
                size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-8 text-xs"
                  variant="outline"
              >
                  <Download className="w-3 h-3 mr-1" />
                  Export
              </Button>
              </div>
            </div>
          </div>

          {/* Pupil Information Card */}
          <div className="p-4 sm:p-6">
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 sm:p-6 border border-gray-100">
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                {/* Pupil Avatar */}
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                    <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-md">
                    <Award className="w-4 h-4 text-yellow-500" />
                  </div>
                </div>

                {/* Pupil Details */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Student Name</p>
                    <p className="text-sm sm:text-base font-bold text-gray-900">{pupilDetails.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Admission No.</p>
                    <p className="text-sm sm:text-base font-semibold text-gray-700">{pupilDetails.admissionNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Class</p>
                    <p className="text-sm sm:text-base font-semibold text-gray-700">{classSnap?.name}</p>
                  </div>
              <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Position</p>
                    <div className="flex items-center gap-2">
                      <Medal className="w-4 h-4 text-yellow-500" />
                      <p className="text-sm sm:text-base font-semibold text-gray-700">{position}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Analytics Tiles - Enhanced */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* Total Marks */}
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Marks</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">{pupilResults.totalMarks}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Average: {pupilResults.averageMarks.toFixed(1)}%</span>
              <div className="flex items-center text-green-600">
                <TrendingUp className="w-3 h-3 mr-1" />
                <span className="font-medium">Above average</span>
              </div>
              </div>
            </div>
            
          {/* Total Aggregates */}
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2 rounded-lg">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Aggregates</p>
                <p className="text-2xl sm:text-3xl font-bold text-purple-600">{pupilResults.totalAggregates}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Out of {subjectSnaps.length * 9}</span>
              <Badge className={`${getDivisionColor(pupilResults.division)} text-xs px-2 py-1 border-0`}>
                Division {pupilResults.division}
              </Badge>
            </div>
          </div>

          {/* Best Subject */}
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-2 rounded-lg">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Best Subject</p>
                <p className="text-sm sm:text-base font-bold text-green-600">
                  {pupilResults.subjectResults.sort((a, b) => (b.marks || 0) - (a.marks || 0))[0]?.code || 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {pupilResults.subjectResults.sort((a, b) => (b.marks || 0) - (a.marks || 0))[0]?.marks || 0}%
              </span>
              <Badge className={`${getGradeColor(pupilResults.subjectResults.sort((a, b) => (b.marks || 0) - (a.marks || 0))[0]?.grade || 'F9')} text-xs px-2 py-1 border-0`}>
                {pupilResults.subjectResults.sort((a, b) => (b.marks || 0) - (a.marks || 0))[0]?.grade || 'F9'}
              </Badge>
            </div>
          </div>

          {/* Weakest Subject */}
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-gradient-to-br from-orange-500 to-red-500 p-2 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Needs Focus</p>
                <p className="text-sm sm:text-base font-bold text-orange-600">
                  {pupilResults.subjectResults.sort((a, b) => (a.marks || 0) - (b.marks || 0))[0]?.code || 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {pupilResults.subjectResults.sort((a, b) => (a.marks || 0) - (b.marks || 0))[0]?.marks || 0}%
              </span>
              <Badge className={`${getGradeColor(pupilResults.subjectResults.sort((a, b) => (a.marks || 0) - (b.marks || 0))[0]?.grade || 'F9')} text-xs px-2 py-1 border-0`}>
                {pupilResults.subjectResults.sort((a, b) => (a.marks || 0) - (b.marks || 0))[0]?.grade || 'F9'}
              </Badge>
          </div>
        </div>
      </div>

        {/* Modern Tabs with Enhanced Styling */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
              <TabsList className="w-full h-auto p-2 bg-transparent">
                <TabsTrigger 
                  value="current" 
                  className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-200 rounded-lg py-3 px-6 text-sm font-medium transition-all duration-200"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Current Results
            </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-200 rounded-lg py-3 px-6 text-sm font-medium transition-all duration-200"
                >
                  <History className="w-4 h-4 mr-2" />
                  Exam History
            </TabsTrigger>
          </TabsList>
                    </div>

            {/* Current Results Tab */}
            <TabsContent value="current" className="p-0 mt-0">
              <div className="p-4 sm:p-6">
                <div className="grid gap-4">
                  {pupilResults.subjectResults.map((subject, index) => (
                    <div
                      key={subject.subjectId}
                      className="group bg-gradient-to-r from-white via-gray-50 to-white p-4 sm:p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        {/* Subject Info */}
                        <div className="flex items-center gap-4 flex-1">
                          <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-3 rounded-lg">
                            <BookOpen className="w-5 h-5 text-white" />
                  </div>
                    <div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {subject.name}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-500 font-medium">
                              {subject.code}
                            </p>
                    </div>
                  </div>

                        {/* Performance Metrics */}
                        <div className="flex items-center gap-4 sm:gap-6">
                          {/* Marks */}
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Marks</p>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{subject.marks || 0}</p>
                  </div>

                          {/* Grade & Aggregates */}
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Grade</p>
                            <div className="flex items-center gap-2">
                              <Badge className={`${getGradeColor(subject.grade || 'F9')} text-sm px-3 py-1 border-0 font-bold`}>
                                {subject.grade || 'F9'}
                              </Badge>
                              <span className="text-xs text-gray-500 font-medium">({subject.aggregates || 9})</span>
                    </div>
                  </div>

                          {/* Remarks */}
                          <div className="text-center hidden sm:block">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Remarks</p>
                            <p className="text-sm font-medium text-gray-700">{getRemarks(subject.marks || 0)}</p>
            </div>
                        </div>
                      </div>

                      {/* Mobile Remarks */}
                      <div className="mt-3 sm:hidden">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Remarks</p>
                        <p className="text-sm font-medium text-gray-700">{getRemarks(subject.marks || 0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
          </TabsContent>

            {/* Exam History Tab */}
            <TabsContent value="history" className="p-0 mt-0">
              <div className="p-4 sm:p-6">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="ml-2 text-gray-600">Loading exam history...</span>
                  </div>
                ) : examHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Exam History</h3>
                    <p className="text-gray-500">This pupil has no previous exam records.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {examHistory.map((exam, index) => (
                      <div
                        key={exam.examId}
                        className="group bg-gradient-to-r from-white via-gray-50 to-white p-4 sm:p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-300"
                      >
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                          {/* Exam Info */}
                          <div className="flex items-center gap-4 flex-1">
                            <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-3 rounded-lg">
                              <GraduationCap className="w-5 h-5 text-white" />
                            </div>
                          <div>
                              <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {exam.examName}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-500 font-medium">
                              {new Date(exam.examDate).toLocaleDateString()}
                            </p>
                            </div>
                            {/* Trend Indicator */}
                            <div className="flex items-center">
                              {exam.trend === 'up' && (
                                <div className="bg-green-100 p-1 rounded-full">
                                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                                </div>
                              )}
                              {exam.trend === 'down' && (
                                <div className="bg-red-100 p-1 rounded-full">
                                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                                </div>
                              )}
                              {exam.trend === 'same' && (
                                <div className="bg-gray-100 p-1 rounded-full">
                                  <Minus className="w-4 h-4 text-gray-600" />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Performance Metrics */}
                          <div className="flex items-center gap-4 sm:gap-6">
                            <div className="text-center">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total</p>
                              <p className="text-lg sm:text-xl font-bold text-gray-900">{exam.totalMarks}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Agg</p>
                              <p className="text-lg sm:text-xl font-bold text-gray-900">{exam.totalAggregates}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Division</p>
                              <Badge className={`${getDivisionColor(exam.division)} text-sm px-3 py-1 border-0 font-bold`}>
                                {exam.division}
                            </Badge>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Position</p>
                              <p className="text-sm font-medium text-gray-700">{exam.position}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Subject Performance - Expandable */}
                        <div className="mt-4 border-t border-gray-100 pt-4">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Subject Performance</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(exam.subjects).slice(0, 6).map(([code, subject]: [string, any]) => (
                              <div key={code} className="bg-gray-100 rounded-lg px-3 py-1 flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-700">{code}</span>
                                <span className="text-xs text-gray-600">{subject.marks}</span>
                                <Badge className={`${getGradeColor(subject.grade)} text-xs px-1 py-0 border-0`}>
                                  {subject.grade}
                                </Badge>
                          </div>
                            ))}
                            {Object.keys(exam.subjects).length > 6 && (
                              <div className="bg-gray-100 rounded-lg px-3 py-1">
                                <span className="text-xs text-gray-500">
                                  +{Object.keys(exam.subjects).length - 6} more
                                </span>
                          </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
} 