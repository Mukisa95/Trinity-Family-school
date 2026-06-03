"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { DatePicker } from '@/components/common/date-picker';
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
  PrinterIcon,
  Printer,
  FileText as FileTextIcon,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from '@/components/ui/input';
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
import { useQuery } from '@tanstack/react-query';
import { SchoolSettingsService } from '@/lib/services/school-settings.service';
import { generateModernBatchReportPDF, generateTransBatchReportPDF } from '@/components/exam/ModernBatchReportPDF';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { PDFViewer } from '@/components/pdf/pdf-viewer';
import { getNextTermDates } from '@/lib/utils/academic-year-utils';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';
import { ExamsService } from '@/lib/services/exams.service';

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

// Helper function to check if photo is real
const isRealPhoto = (photo?: string): boolean => {
  return !!(photo &&
    photo !== 'NO PHOTO' &&
    photo.trim() !== '' &&
    photo !== 'https://placehold.co/128x128.png' &&
    !photo.includes('ui-avatars.com'));
};

// PrintModal component
const PrintModal = ({
  isOpen,
  onClose,
  onPrintTrans,
  isGenerating,
  generationStatus,
  generationProgress,
  eta
}: {
  isOpen: boolean;
  onClose: () => void;
  onPrintTrans: () => void;
  isGenerating: boolean;
  generationStatus: string;
  generationProgress: number;
  eta: string;
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Printer className="h-5 w-5 text-blue-600" />
            Print Reports
          </DialogTitle>
          <DialogDescription>
            Select the type of report to generate
          </DialogDescription>
        </DialogHeader>

        {isGenerating ? (
          <div className="py-4">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4 animate-spin"></div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Generating Report</h3>
              <p className="text-sm text-blue-600 font-medium mb-4">{generationStatus}</p>

              {/* Compact Progress Bar */}
              <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden border">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>

              {/* Progress and ETA */}
              <div className="flex justify-between items-center mb-4 text-sm">
                <span className="font-semibold text-gray-800">{generationProgress}% Complete</span>
                <span className="text-blue-600 font-medium">{eta}</span>
              </div>

              {/* Compact Tip */}
              <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                <div className="text-xs text-blue-800">
                  <span className="font-semibold">💡</span> Report will download automatically when ready
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={onPrintTrans}
              className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <FileTextIcon className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">TRANS</h3>
                  <p className="text-sm text-gray-600">Individual pupil reports (Enhanced design)</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {!isGenerating && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
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

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [eta, setEta] = useState<string>('');

  // TRANS report type selection state
  const [showTransTypeModal, setShowTransTypeModal] = useState(false);
  const [transReportType, setTransReportType] = useState<'grading' | 'progress' | null>(null);
  const [showReportConfigModal, setShowReportConfigModal] = useState(false);
  const [showComparisonExamModal, setShowComparisonExamModal] = useState(false);
  const [selectedComparisonExams, setSelectedComparisonExams] = useState<string[]>([]); // Up to 2 exams
  const [comparisonExamNames, setComparisonExamNames] = useState<Record<string, string>>({}); // Custom names for exams
  const [availableComparisonExams, setAvailableComparisonExams] = useState<any[]>([]);
  const [isLoadingComparisonExams, setIsLoadingComparisonExams] = useState(false);

  // Report configuration state
  const [reportConfig, setReportConfig] = useState({
    pupilAge: { show: true, fill: true },
    className: { show: true, fill: true },
    pin: { show: true, fill: true },
    year: { show: true, fill: true },
    term: { show: true, fill: true },
    promoted: { show: false, fill: false },
    schoolPayCode: { show: false, fill: true },
    createdOn: { show: true, fill: true, useCustom: false },
    nextTermBegins: { show: true, fill: true, useCustom: false },
    nextTermEnds: { show: true, fill: true, useCustom: false },
  });

  // Custom dates state
  const [customDates, setCustomDates] = useState({
    createdOn: '',
    nextTermBegins: '',
    nextTermEnds: '',
  });

  // PDF viewer hook
  const pdfViewer = usePDFViewer();

  // Fetch school settings
  const { data: schoolSettings } = useQuery({
    queryKey: ['schoolSettings'],
    queryFn: async () => {
      try {
        const settingsDoc = await SchoolSettingsService.getSchoolSettings();
        return settingsDoc || { generalInfo: { name: 'School Name' } };
      } catch (error) {
        console.error("Error fetching school settings:", error);
        return { generalInfo: { name: 'School Name' } };
      }
    }
  });

  // Replace the mock history hook with the real data hook
  const {
    data: examHistoryData,
    isLoading: isLoadingHistory,
    error: historyError
  } = usePupilExamHistory(pupilId, examId);

  // Progress update helper - MUST be before any early returns
  const updateProgress = useCallback((progress: number, status: string) => {
    setGenerationProgress(progress);
    setGenerationStatus(status);

    if (startTime) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = progress / elapsed;
      const remaining = (100 - progress) / rate;

      if (remaining < 60) {
        setEta(`${Math.round(remaining)}s remaining`);
      } else {
        setEta(`${Math.round(remaining / 60)}m remaining`);
      }
    }
  }, [startTime]);

  // Create processedResults structure for single pupil - MUST be before any early returns
  const createProcessedResultForPupil = useCallback(async () => {
    if (!pupilDetails || !actualResults || !subjectSnaps.length || !examResultData) return null;

    const pupilResults = actualResults[pupilId] || {};

    // Get major subjects from the saved exam result data
    const savedMajorSubjects = examResultData.majorSubjects || [];
    const majorSubjects = savedMajorSubjects.length > 0
      ? savedMajorSubjects
      : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));

    let totalMarks = 0;
    let totalAggregates = 0;
    const processedSubjectResults: Record<string, { marks: number; grade: string; aggregates: number }> = {};

    // Initialize all subjects first
    subjectSnaps.forEach(subject => {
      const isMajorSubject = majorSubjects.includes(subject.code);
      processedSubjectResults[subject.code] = {
        marks: 0,
        grade: 'F9',
        aggregates: isMajorSubject ? 9 : 0
      };
    });

    // Populate with actual results
    subjectSnaps.forEach(subject => {
      const result = pupilResults[subject.subjectId];
      const isMajorSubject = majorSubjects.includes(subject.code);

      if (result) {
        processedSubjectResults[subject.code] = {
          marks: result.status === 'missed' ? 0 : (result.marks || 0),
          grade: result.status === 'missed' ? 'MISSED' : (result.grade || 'F9'),
          aggregates: isMajorSubject ? (result.status === 'missed' ? 9 : (result.aggregates || 9)) : 0
        };
      }
    });

    // Calculate totals
    for (const subjectCode in processedSubjectResults) {
      totalMarks += processedSubjectResults[subjectCode].marks || 0;
      if (processedSubjectResults[subjectCode].aggregates > 0) {
        totalAggregates += processedSubjectResults[subjectCode].aggregates || 0;
      }
    }

    // Use database values if available
    if (typeof pupilResults.totalMarks === 'number') {
      totalMarks = pupilResults.totalMarks;
    }
    if (typeof pupilResults.totalAggregates === 'number') {
      totalAggregates = pupilResults.totalAggregates;
    }

    const division = typeof pupilResults.division === 'string' && pupilResults.division
      ? pupilResults.division
      : calculateDivision(totalAggregates);

    // Fetch pupil photo if needed
    let pupilPhoto: string | null = null;
    const pupilPhotoFromSnapshot = (pupilDetails as any).photo;

    if (isRealPhoto(pupilPhotoFromSnapshot)) {
      pupilPhoto = pupilPhotoFromSnapshot;
    } else {
      try {
        const pupilResponse = await fetch(`/api/pupils/${pupilId}`);
        if (pupilResponse.ok) {
          const pupilData = await pupilResponse.json();
          pupilPhoto = pupilData.photo || pupilData.photoUrl || null;
          if (!isRealPhoto(pupilPhoto)) {
            pupilPhoto = null;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch pupil photo:', error);
      }
    }

    return {
      pupilInfo: {
        ...pupilDetails,
        pupilId: pupilDetails.pupilId,
        name: pupilDetails.name,
        admissionNumber: pupilDetails.admissionNumber,
        age: (pupilDetails as any).ageAtExam || 12,
        photo: pupilPhoto,
        dateOfBirth: (pupilDetails as any).dateOfBirth || undefined,
        schoolPayCode:
          (pupilDetails as any).payCode ||
          (pupilDetails as any).additionalIdentifiers?.find((id: any) =>
            `${id?.idType || ''}`.toLowerCase().includes('pay code')
          )?.idValue ||
          ''
      },
      results: processedSubjectResults,
      totalMarks,
      totalAggregates,
      division
    };
  }, [pupilDetails, actualResults, subjectSnaps, pupilId, examResultData]);

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

  // Handle Report generation - MUST be before early returns
  const handleReportOne = useCallback(async () => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !pupilDetails) {
      toast({ title: "Error", description: "Missing required data for report generation" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgress(10, 'Preparing report data...');

      const singlePupilResult = await createProcessedResultForPupil();
      if (!singlePupilResult) {
        throw new Error('Failed to process pupil data');
      }

      const processedResults = [singlePupilResult];

      updateProgress(20, 'Processing academic year and term data...');

      const { academicYearName, termName } = getAcademicYearAndTerm(
        examDetails.academicYearId || '',
        examDetails.termId || ''
      );

      const nextTermDates = getNextTermDates(
        examDetails.academicYearId || '',
        examDetails.termId || '',
        academicYears
      );

      updateProgress(30, 'Fetching teacher information...');

      // Fetch teachers
      const uniqueTeacherIds = [...new Set(subjectSnaps.map(s => s.teacherId).filter(Boolean))];
      const teachersMap = new Map<string, string>();

      if (uniqueTeacherIds.length > 0) {
        try {
          const teacherPromises = uniqueTeacherIds.map(async (teacherId) => {
            try {
              const teacherResponse = await fetch(`/api/staff/${teacherId}`);
              if (teacherResponse.ok) {
                const teacherData = await teacherResponse.json();
                const teacherName = `${teacherData.firstName} ${teacherData.lastName}`.trim();
                return { teacherId, teacherName };
              }
            } catch (error) {
              console.warn(`Failed to fetch teacher ${teacherId}:`, error);
            }
            return { teacherId, teacherName: 'Unknown Teacher' };
          });

          const teacherResults = await Promise.all(teacherPromises);
          teacherResults.forEach(({ teacherId, teacherName }) => {
            teachersMap.set(teacherId, teacherName);
          });
        } catch (error) {
          console.warn('Error batch fetching teachers:', error);
        }
      }

      const enhancedSubjectSnaps = subjectSnaps.map((subject) => {
        const teacherName = subject.teacherId
          ? (teachersMap.get(subject.teacherId) || 'Unknown Teacher')
          : 'Not Assigned';

        return {
          ...subject,
          teacherName,
          fullMarks: 100
        };
      });

      updateProgress(50, 'Preparing grading scale...');

      const savedMajorSubjects = examResultData?.majorSubjects || [];
      const majorSubjects = savedMajorSubjects.length > 0
        ? savedMajorSubjects
        : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));

      const actualGradingScale = examResultData?.gradingScale && Array.isArray(examResultData.gradingScale) && examResultData.gradingScale.length > 0
        ? examResultData.gradingScale.map(item => ({
          minMark: item.minMark,
          maxMark: item.maxMark || (item.minMark === 0 ? 29 : item.minMark - 1),
          grade: item.grade,
          aggregates: item.aggregates || 9
        }))
        : DEFAULT_GRADING_SCALE.map(item => ({
          minMark: item.minMark,
          maxMark: item.maxMark,
          grade: item.grade,
          aggregates: item.aggregates || 9
        }));

      updateProgress(70, 'Generating report PDF...');

      const modernBatchData = {
        examDetails: {
          name: examDetails.name,
          examTypeName: examDetails.examTypeName || 'Exam',
          startDate: examDetails.startDate,
          endDate: examDetails.endDate,
          academicYearId: examDetails.academicYearId,
          termId: examDetails.termId,
          academicYearName: academicYearName,
          termName: termName,
        },
        classSnap,
        subjectSnaps: enhancedSubjectSnaps,
        processedResults: processedResults,
        schoolSettings,
        majorSubjects: majorSubjects, // Send major subjects for grade display
        gradingScale: actualGradingScale,
        nextTermInfo: nextTermDates ? {
          startDate: nextTermDates.nextTermBegins,
          endDate: nextTermDates.nextTermEnds
        } : undefined,
        classTeacherInfo: {
          name: 'Class Teacher'
        }
      };

      const blob = await generateModernBatchReportPDF(modernBatchData);

      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${pupilDetails.name.replace(/\s+/g, '_')}_Report.pdf`;
      const title = 'Individual Pupil Report';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      updateProgress(95, 'Finalizing document...');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({
        title: "Success",
        description: "Report generated successfully!"
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({ title: "Error", description: "Failed to generate report. Please try again." });
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStatus('');
        setGenerationProgress(0);
        setStartTime(null);
        setEta('');
        setShowPrintModal(false);
      }, 1000);
    }
  }, [examDetails, classSnap, subjectSnaps, pupilDetails, examResultData, academicYears, schoolSettings, toast, getAcademicYearAndTerm, getNextTermDates, updateProgress, createProcessedResultForPupil, pdfViewer]);

  // Handle TRANS report - show type selection modal first
  const handleTransReport = useCallback(() => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !pupilDetails) {
      toast({ title: "Error", description: "Missing required data for TRANS report generation" });
      return;
    }
    // Show type selection modal first
    setShowTransTypeModal(true);
  }, [examDetails, classSnap, subjectSnaps, pupilDetails, toast]);

  // Handle TRANS report type selection
  const handleTransTypeSelection = useCallback((type: 'grading' | 'progress') => {
    setTransReportType(type);
    setShowTransTypeModal(false);

    // Show configuration modal first
    setShowReportConfigModal(true);
  }, []);

  // Load available comparison exams (same term, class, academic year)
  const loadComparisonExams = useCallback(async () => {
    if (!examDetails) {
      console.warn('loadComparisonExams: examDetails is missing');
      return;
    }

    // Get classId from multiple sources: URL, examDetails, or examResultData
    const effectiveClassId = classId || examDetails.classId || examResultData?.classId;
    if (!effectiveClassId) {
      console.warn('loadComparisonExams: No classId available from any source');
      toast({ title: "Error", description: "Unable to determine class for comparison exams" });
      return;
    }

    setIsLoadingComparisonExams(true);
    try {
      // Always fetch from API to ensure we get all exams
      let allExams: any[] = [];
      try {
        allExams = await ExamsService.getExamsByClass(effectiveClassId);
        console.log(`✅ Found ${allExams.length} exams for class ${effectiveClassId} from API`);
      } catch (apiError) {
        console.error('❌ API fetch failed, trying loaded exams:', apiError);
        // Fallback to loaded exams if API fails
        if (exams.length > 0) {
          allExams = exams.filter(exam => exam.classId === effectiveClassId);
          console.log(`📦 Using ${allExams.length} exams from loaded array as fallback`);
        }
      }

      if (allExams.length === 0) {
        console.warn('⚠️ No exams found for class:', effectiveClassId);
        setAvailableComparisonExams([]);
        return;
      }

      // Filter exams: same class, same academic year, same term, but different exam
      const filteredExams = allExams.filter(exam => {
        const matchesClass = exam.classId === effectiveClassId;
        const matchesYear = exam.academicYearId === examDetails.academicYearId;
        const matchesTerm = exam.termId === examDetails.termId;
        const isNotCurrent = exam.id !== examId;

        return matchesClass && matchesYear && matchesTerm && isNotCurrent;
      });

      console.log(`📊 Filtered to ${filteredExams.length} comparison exams`);
      setAvailableComparisonExams(filteredExams);
    } catch (error) {
      console.error('Error loading comparison exams:', error);
      toast({ title: "Error", description: "Failed to load comparison exams" });
    } finally {
      setIsLoadingComparisonExams(false);
    }
  }, [examDetails, classId, examResultData, examId, exams, toast]);

  // Generate TRANS report with grading scale - MUST be before handleReportConfigComplete
  const generateTransReportWithGrading = useCallback(async () => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !pupilDetails) {
      toast({ title: "Error", description: "Missing required data for TRANS report generation" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgress(10, 'Preparing TRANS report data...');

      const singlePupilResult = await createProcessedResultForPupil();
      if (!singlePupilResult) {
        throw new Error('Failed to process pupil data');
      }

      const processedResults = [singlePupilResult];

      updateProgress(20, 'Processing academic year and term data...');

      const savedMajorSubjects = examResultData?.majorSubjects || [];
      const majorSubjects = savedMajorSubjects.length > 0
        ? savedMajorSubjects
        : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));

      const { academicYearName, termName } = getAcademicYearAndTerm(
        examDetails.academicYearId || '',
        examDetails.termId || ''
      );

      const nextTermDates = getNextTermDates(
        examDetails.academicYearId || '',
        examDetails.termId || '',
        academicYears
      );

      updateProgress(30, 'Fetching teacher information...');

      // Fetch teachers
      const uniqueTeacherIds = [...new Set(subjectSnaps.map(s => s.teacherId).filter(Boolean))];
      const teachersMap = new Map<string, string>();

      if (uniqueTeacherIds.length > 0) {
        try {
          const teacherPromises = uniqueTeacherIds.map(async (teacherId) => {
            try {
              const teacherResponse = await fetch(`/api/staff/${teacherId}`);
              if (teacherResponse.ok) {
                const teacherData = await teacherResponse.json();
                const teacherName = `${teacherData.firstName} ${teacherData.lastName}`.trim();
                return { teacherId, teacherName };
              }
            } catch (error) {
              console.warn(`Failed to fetch teacher ${teacherId}:`, error);
            }
            return { teacherId, teacherName: 'Unknown Teacher' };
          });

          const teacherResults = await Promise.all(teacherPromises);
          teacherResults.forEach(({ teacherId, teacherName }) => {
            teachersMap.set(teacherId, teacherName);
          });
        } catch (error) {
          console.warn('Error batch fetching teachers:', error);
        }
      }

      const enhancedSubjectSnaps = subjectSnaps.map((subject) => {
        const teacherName = subject.teacherId
          ? (teachersMap.get(subject.teacherId) || 'Unknown Teacher')
          : 'Not Assigned';

        return {
          ...subject,
          teacherName,
          fullMarks: 100
        };
      });

      updateProgress(50, 'Preparing grading scale...');

      const actualGradingScale = examResultData?.gradingScale && Array.isArray(examResultData.gradingScale) && examResultData.gradingScale.length > 0
        ? examResultData.gradingScale.map(item => ({
          minMark: item.minMark,
          maxMark: item.maxMark || (item.minMark === 0 ? 29 : item.minMark - 1),
          grade: item.grade,
          aggregates: item.aggregates || 9
        }))
        : DEFAULT_GRADING_SCALE.map(item => ({
          minMark: item.minMark,
          maxMark: item.maxMark,
          grade: item.grade,
          aggregates: item.aggregates || 9
        }));

      updateProgress(70, 'Generating TRANS report PDF...');

      // Use custom dates if configured, otherwise use system dates
      const createdOnDate = reportConfig.createdOn.useCustom && customDates.createdOn
        ? customDates.createdOn
        : examDetails.startDate || new Date().toISOString().split('T')[0];

      const nextTermBeginsDate = reportConfig.nextTermBegins.useCustom && customDates.nextTermBegins
        ? customDates.nextTermBegins
        : nextTermDates?.nextTermBegins || '';

      const nextTermEndsDate = reportConfig.nextTermEnds.useCustom && customDates.nextTermEnds
        ? customDates.nextTermEnds
        : nextTermDates?.nextTermEnds || '';

      const transBatchData = {
        examDetails: {
          name: examDetails.name,
          examTypeName: examDetails.examTypeName || 'Exam',
          startDate: examDetails.startDate,
          endDate: examDetails.endDate,
          academicYearId: examDetails.academicYearId,
          termId: examDetails.termId,
          academicYearName: academicYearName,
          termName: termName,
        },
        classSnap,
        subjectSnaps: enhancedSubjectSnaps,
        processedResults: processedResults,
        schoolSettings,
        majorSubjects: majorSubjects, // Send major subjects for grade display
        gradingScale: actualGradingScale,
        nextTermInfo: nextTermDates ? {
          startDate: nextTermBeginsDate,
          endDate: nextTermEndsDate
        } : undefined,
        classTeacherInfo: {
          name: 'Class Teacher'
        },
        reportConfig: reportConfig,
        customDates: {
          createdOn: createdOnDate,
          nextTermBegins: nextTermBeginsDate,
          nextTermEnds: nextTermEndsDate,
        }
      };

      const blob = await generateTransBatchReportPDF(transBatchData);

      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${pupilDetails.name.replace(/\s+/g, '_')}_TRANS_Report.pdf`;
      const title = 'Individual Pupil TRANS Report';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      updateProgress(95, 'Finalizing document...');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({
        title: "Success",
        description: "TRANS report generated successfully!"
      });
    } catch (error) {
      console.error("Error generating TRANS report:", error);
      toast({ title: "Error", description: "Failed to generate TRANS report. Please try again." });
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStatus('');
        setGenerationProgress(0);
        setStartTime(null);
        setEta('');
        setShowPrintModal(false);
        setTransReportType(null);
      }, 1000);
    }
  }, [examDetails, classSnap, subjectSnaps, pupilDetails, examResultData, academicYears, schoolSettings, toast, getAcademicYearAndTerm, getNextTermDates, updateProgress, createProcessedResultForPupil, pdfViewer, reportConfig, customDates]);

  // Generate TRANS report with progress assessment - MUST be before handleReportConfigComplete
  const generateTransReportWithProgress = useCallback(async (comparisonExamIds: string[], customNames: Record<string, string> = {}) => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !pupilDetails) {
      toast({ title: "Error", description: "Missing required data for TRANS progress report generation" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');
    setShowComparisonExamModal(false);

    try {
      updateProgress(5, 'Preparing data...');

      const singlePupilResult = await createProcessedResultForPupil();
      if (!singlePupilResult) {
        throw new Error('Failed to process pupil data');
      }

      updateProgress(10, 'Fetching comparison exam data...');

      // 🚀 OPTIMIZED: Fetch all comparison exams and their results in parallel
      const comparisonExamsData = await Promise.all(
        comparisonExamIds.map(async (examId) => {
          const [exam, examResult] = await Promise.all([
            ExamsService.getExamById(examId),
            ExamsService.getExamResultByExamId(examId)
          ]);

          if (!exam) {
            throw new Error(`Comparison exam ${examId} not found`);
          }
          if (!examResult) {
            throw new Error(`Comparison exam results for ${examId} not found`);
          }

          return { exam, examResult };
        })
      );

      updateProgress(20, 'Processing comparison exam results...');

      // Process each comparison exam's results for the pupil
      const comparisonExamsProcessed = comparisonExamsData.map(({ exam, examResult }) => {
        const comparisonSubjectSnaps = examResult.subjectSnapshots || [];
        const comparisonResults = examResult.results || {};

        // Get the pupil's results from this comparison exam
        // Try both pupilId from URL and pupilDetails.pupilId
        const effectivePupilId = pupilId || pupilDetails?.pupilId;
        const pupilResult = comparisonResults[effectivePupilId] || {};
        const processedSubjectResults: Record<string, any> = {};

        // Initialize all subjects first to ensure all are included
        comparisonSubjectSnaps.forEach((subject: any) => {
          const subjectCode = subject.code;
          processedSubjectResults[subjectCode] = {
            marks: 0,
            grade: 'F9',
            aggregates: 0
          };
        });

        // Then populate with actual results
        comparisonSubjectSnaps.forEach((subject: any) => {
          const result = pupilResult[subject.subjectId];
          const isMajorSubject = (examResult.majorSubjects || []).includes(subject.code);

          if (result) {
            processedSubjectResults[subject.code] = {
              marks: result.status === 'missed' ? 0 : (result.marks || 0),
              grade: result.status === 'missed' ? 'MISSED' : (result.grade || 'F9'),
              aggregates: isMajorSubject ? (result.status === 'missed' ? 9 : (result.aggregates || 9)) : 0
            };
          }
        });

        // Calculate totals
        let totalMarks = 0;
        let totalAggregates = 0;
        for (const subjectCode in processedSubjectResults) {
          totalMarks += processedSubjectResults[subjectCode].marks || 0;
          if (processedSubjectResults[subjectCode].aggregates > 0) {
            totalAggregates += processedSubjectResults[subjectCode].aggregates || 0;
          }
        }

        const division = pupilResult.division || (totalAggregates <= 8 ? 'I' : totalAggregates <= 16 ? 'II' : totalAggregates <= 24 ? 'III' : totalAggregates <= 32 ? 'IV' : 'U');

        return {
          exam,
          examResult,
          results: processedSubjectResults,
          totalMarks,
          totalAggregates,
          division,
          subjectSnaps: comparisonSubjectSnaps
        };
      });

      updateProgress(30, 'Preparing pupil data and fetching teachers...');

      // Get all unique subjects from all comparison exams
      const allSubjectCodes = new Set<string>();
      subjectSnaps.forEach(s => allSubjectCodes.add(s.code));
      comparisonExamsProcessed.forEach(({ subjectSnaps: compSubjectSnaps }) => {
        compSubjectSnaps.forEach((s: any) => allSubjectCodes.add(s.code));
      });

      const uniqueTeacherIds = [...new Set([
        ...subjectSnaps.map(s => s.teacherId),
        ...comparisonExamsProcessed.flatMap(({ subjectSnaps: compSubjectSnaps }) =>
          compSubjectSnaps.map((s: any) => s.teacherId)
        )
      ].filter(Boolean))];
      const teachersMap = new Map<string, string>();

      if (uniqueTeacherIds.length > 0) {
        try {
          const teacherPromises = uniqueTeacherIds.map(async (teacherId) => {
            try {
              const teacherResponse = await fetch(`/api/staff/${teacherId}`);
              if (teacherResponse.ok) {
                const teacherData = await teacherResponse.json();
                const teacherName = `${teacherData.firstName} ${teacherData.lastName}`.trim();
                return { teacherId, teacherName };
              }
            } catch (error) {
              console.warn(`Failed to fetch teacher ${teacherId}:`, error);
            }
            return { teacherId, teacherName: 'Unknown Teacher' };
          });

          const teacherResults = await Promise.all(teacherPromises);
          teacherResults.forEach(({ teacherId, teacherName }) => {
            teachersMap.set(teacherId, teacherName);
          });
        } catch (error) {
          console.warn('Error batch fetching teachers:', error);
        }
      }

      // Create single pupil processed result with comparison data
      const processedResultWithComparison = {
        ...singlePupilResult,
        comparisonDataArray: comparisonExamsProcessed.map(({ exam, examResult, results, totalMarks, totalAggregates, division, subjectSnaps }) => {
          // Convert subjectSnaps to subjects array format expected by PDF
          // The PDF expects comparisonData.subjects to be an array where each subject has a 'code' property
          // It then looks up the actual marks from comparisonData.results[subject.code]
          const subjects = subjectSnaps.map((subject: any) => {
            const subjectCode = subject.code;
            // Get teacher name from the teachersMap we just built
            const teacherName = subject.teacherId
              ? (teachersMap.get(subject.teacherId) || 'Not Assigned')
              : 'Not Assigned';

            return {
              name: subject.name || subjectCode,
              code: subjectCode,
              teacherName: teacherName
            };
          });

          return {
            exam: {
              name: customNames[exam.id] || exam.name,
              examTypeName: exam.examTypeName || 'Exam',
              startDate: exam.startDate,
              endDate: exam.endDate,
            },
            results, // This is used by PDF: comparisonData.results[subject.code]
            subjects, // This is used by PDF: comparisonData.subjects (array to iterate over)
            totalMarks,
            totalAggregates,
            division,
            subjectSnaps
          };
        })
      };

      const processedResultsForReport = [processedResultWithComparison];

      // Create enhanced subject snaps with all subjects from all exams
      const allSubjectsMap = new Map<string, any>();
      subjectSnaps.forEach(subject => {
        allSubjectsMap.set(subject.code, {
          ...subject,
          teacherName: subject.teacherId ? (teachersMap.get(subject.teacherId) || 'Unknown Teacher') : 'Not Assigned',
          fullMarks: 100
        });
      });
      comparisonExamsProcessed.forEach(({ subjectSnaps: compSubjectSnaps }) => {
        compSubjectSnaps.forEach((subject: any) => {
          if (!allSubjectsMap.has(subject.code)) {
            allSubjectsMap.set(subject.code, {
              ...subject,
              teacherName: subject.teacherId ? (teachersMap.get(subject.teacherId) || 'Unknown Teacher') : 'Not Assigned',
              fullMarks: 100
            });
          }
        });
      });

      const enhancedSubjectSnaps = Array.from(allSubjectsMap.values());

      updateProgress(50, 'Preparing all report data in parallel...');

      // 🚀 OPTIMIZED: Prepare all data in parallel
      const [academicInfo, nextTermDates, majorSubjectsData] = await Promise.all([
        Promise.resolve(getAcademicYearAndTerm(examDetails.academicYearId || '', examDetails.termId || '')),
        Promise.resolve(getNextTermDates(examDetails.academicYearId || '', examDetails.termId || '', academicYears)),
        Promise.resolve(
          examResultData?.majorSubjects && examResultData.majorSubjects.length > 0
            ? examResultData.majorSubjects
            : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code))
        )
      ]);

      const { academicYearName, termName } = academicInfo;
      const majorSubjects = majorSubjectsData;

      // Use custom dates if configured, otherwise use system dates
      const createdOnDate = reportConfig.createdOn.useCustom && customDates.createdOn
        ? customDates.createdOn
        : examDetails.startDate || new Date().toISOString().split('T')[0];

      const nextTermBeginsDate = reportConfig.nextTermBegins.useCustom && customDates.nextTermBegins
        ? customDates.nextTermBegins
        : nextTermDates?.nextTermBegins || '';

      const nextTermEndsDate = reportConfig.nextTermEnds.useCustom && customDates.nextTermEnds
        ? customDates.nextTermEnds
        : nextTermDates?.nextTermEnds || '';

      const transBatchData = {
        examDetails: {
          name: examDetails.name,
          examTypeName: examDetails.examTypeName || 'Exam',
          startDate: examDetails.startDate,
          endDate: examDetails.endDate,
          academicYearId: examDetails.academicYearId,
          termId: examDetails.termId,
          academicYearName: academicYearName,
          termName: termName,
        },
        comparisonExams: comparisonExamsProcessed.map(({ exam }) => ({
          name: customNames[exam.id] || exam.name,
          examTypeName: exam.examTypeName || 'Exam',
          startDate: exam.startDate,
          endDate: exam.endDate,
        })),
        classSnap,
        subjectSnaps: enhancedSubjectSnaps,
        processedResults: processedResultsForReport,
        schoolSettings,
        majorSubjects: majorSubjects, // Send major subjects for grade display
        gradingScale: undefined, // No grading scale for progress reports
        isProgressReport: true,
        nextTermInfo: nextTermDates ? {
          startDate: nextTermBeginsDate,
          endDate: nextTermEndsDate
        } : undefined,
        classTeacherInfo: {
          name: 'Class Teacher'
        },
        reportConfig: reportConfig,
        customDates: {
          createdOn: createdOnDate,
          nextTermBegins: nextTermBeginsDate,
          nextTermEnds: nextTermEndsDate,
        }
      };

      updateProgress(70, 'Generating TRANS progress report PDF...');

      const blob = await generateTransBatchReportPDF(transBatchData);

      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${pupilDetails.name.replace(/\s+/g, '_')}_TRANS_Progress_Report.pdf`;
      const title = 'Individual Pupil TRANS Progress Report';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      updateProgress(95, 'Finalizing document...');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({
        title: "Success",
        description: "TRANS progress report generated successfully!",
        duration: 1500,
      });
    } catch (error) {
      console.error("Error generating TRANS progress report:", error);
      toast({
        title: "Error",
        description: "Failed to generate TRANS progress report. Please try again.",
        duration: 2000,
      });
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStatus('');
        setGenerationProgress(0);
        setStartTime(null);
        setEta('');
        setShowPrintModal(false);
        setShowComparisonExamModal(false);
        setSelectedComparisonExams([]);
        setComparisonExamNames({});
        setTransReportType(null);
      }, 1000);
    }
  }, [examDetails, classSnap, subjectSnaps, pupilDetails, pupilId, examResultData, academicYears, schoolSettings, toast, getAcademicYearAndTerm, getNextTermDates, updateProgress, createProcessedResultForPupil, pdfViewer, reportConfig, customDates]);

  // Handle report configuration completion
  const handleReportConfigComplete = useCallback(() => {
    setShowReportConfigModal(false);

    if (transReportType === 'progress') {
      // Show comparison exam selection modal
      loadComparisonExams();
      setShowComparisonExamModal(true);
    } else {
      // Generate with grading scale
      generateTransReportWithGrading();
    }
  }, [transReportType, loadComparisonExams, generateTransReportWithGrading]);

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
                  onClick={() => setShowPrintModal(true)}
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

      {/* Print Modal */}
      <PrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        onPrintTrans={handleTransReport}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
        generationProgress={generationProgress}
        eta={eta}
      />

      {/* TRANS Report Type Selection Modal */}
      <Dialog open={showTransTypeModal} onOpenChange={setShowTransTypeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <FileTextIcon className="h-5 w-5 text-orange-600" />
              Select TRANS Report Type
            </DialogTitle>
            <DialogDescription>
              Choose between grading scale or progress assessment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <button
              onClick={() => handleTransTypeSelection('grading')}
              className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Grading Scale</h3>
                  <p className="text-sm text-gray-600">Show grading scale on reports</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleTransTypeSelection('progress')}
              className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Progress Assessment</h3>
                  <p className="text-sm text-gray-600">Compare with previous exam results</p>
                </div>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransTypeModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Configuration Modal */}
      <Dialog open={showReportConfigModal} onOpenChange={setShowReportConfigModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <FileTextIcon className="h-5 w-5 text-orange-600" />
              Configure Report Elements
            </DialogTitle>
            <DialogDescription>
              Choose which elements to show and whether to fill in the information
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Item</TableHead>
                  <TableHead className="text-center w-[20%]">Show</TableHead>
                  <TableHead className="text-center w-[20%]">Fill</TableHead>
                  <TableHead className="text-center w-[30%]">Add Custom Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Pupil's Age</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.pupilAge.show}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          pupilAge: { ...prev.pupilAge, show: checked === true }
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.pupilAge.fill}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          pupilAge: { ...prev.pupilAge, fill: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.pupilAge.show}
                    />
                  </TableCell>
                  <TableCell className="text-center">-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Class</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.className.show}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          className: { ...prev.className, show: checked === true }
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.className.fill}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          className: { ...prev.className, fill: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.className.show}
                    />
                  </TableCell>
                  <TableCell className="text-center">-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">PIN</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.pin.show}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          pin: { ...prev.pin, show: checked === true }
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.pin.fill}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          pin: { ...prev.pin, fill: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.pin.show}
                    />
                  </TableCell>
                  <TableCell className="text-center">-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Year</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.year.show}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          year: { ...prev.year, show: checked === true }
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.year.fill}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          year: { ...prev.year, fill: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.year.show}
                    />
                  </TableCell>
                  <TableCell className="text-center">-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Term</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.term.show}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          term: { ...prev.term, show: checked === true }
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.term.fill}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          term: { ...prev.term, fill: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.term.show}
                    />
                  </TableCell>
                  <TableCell className="text-center">-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">School Pay Code</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.schoolPayCode.show}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          schoolPayCode: { ...prev.schoolPayCode, show: checked === true }
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.schoolPayCode.fill}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          schoolPayCode: { ...prev.schoolPayCode, fill: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.schoolPayCode.show}
                    />
                  </TableCell>
                  <TableCell className="text-center">-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Promoted</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.promoted.show}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          promoted: { ...prev.promoted, show: checked === true }
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.promoted.fill}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          promoted: { ...prev.promoted, fill: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.promoted.show}
                    />
                  </TableCell>
                  <TableCell className="text-center">-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Created On</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.createdOn.show}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          createdOn: { ...prev.createdOn, show: checked === true }
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.createdOn.fill}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          createdOn: { ...prev.createdOn, fill: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.createdOn.show}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.createdOn.useCustom || false}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          createdOn: { ...prev.createdOn, useCustom: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.createdOn.show || !reportConfig.createdOn.fill}
                    />
                  </TableCell>
                </TableRow>
                {reportConfig.createdOn.useCustom && reportConfig.createdOn.show && reportConfig.createdOn.fill && (
                  <TableRow>
                    <TableCell colSpan={4} className="pt-0 pb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 w-32">Custom Date:</label>
                        <DatePicker
                          date={customDates.createdOn ? new Date(customDates.createdOn) : undefined}
                          setDate={(d) => setCustomDates(prev => ({ ...prev, createdOn: d ? format(d, 'yyyy-MM-dd') : '' }))}
                          placeholder="Select date"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="font-medium">Next Term Begins On</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.nextTermBegins.show}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          nextTermBegins: { ...prev.nextTermBegins, show: checked === true }
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.nextTermBegins.fill}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          nextTermBegins: { ...prev.nextTermBegins, fill: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.nextTermBegins.show}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.nextTermBegins.useCustom || false}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          nextTermBegins: { ...prev.nextTermBegins, useCustom: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.nextTermBegins.show || !reportConfig.nextTermBegins.fill}
                    />
                  </TableCell>
                </TableRow>
                {reportConfig.nextTermBegins.useCustom && reportConfig.nextTermBegins.show && reportConfig.nextTermBegins.fill && (
                  <TableRow>
                    <TableCell colSpan={4} className="pt-0 pb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 w-32">Custom Date:</label>
                        <DatePicker
                          date={customDates.nextTermBegins ? new Date(customDates.nextTermBegins) : undefined}
                          setDate={(d) => setCustomDates(prev => ({ ...prev, nextTermBegins: d ? format(d, 'yyyy-MM-dd') : '' }))}
                          placeholder="Select date"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="font-medium">Term Ends On</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.nextTermEnds.show}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          nextTermEnds: { ...prev.nextTermEnds, show: checked === true }
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.nextTermEnds.fill}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          nextTermEnds: { ...prev.nextTermEnds, fill: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.nextTermEnds.show}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={reportConfig.nextTermEnds.useCustom || false}
                      onCheckedChange={(checked) => {
                        setReportConfig(prev => ({
                          ...prev,
                          nextTermEnds: { ...prev.nextTermEnds, useCustom: checked === true }
                        }));
                      }}
                      disabled={!reportConfig.nextTermEnds.show || !reportConfig.nextTermEnds.fill}
                    />
                  </TableCell>
                </TableRow>
                {reportConfig.nextTermEnds.useCustom && reportConfig.nextTermEnds.show && reportConfig.nextTermEnds.fill && (
                  <TableRow>
                    <TableCell colSpan={4} className="pt-0 pb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 w-32">Custom Date:</label>
                        <DatePicker
                          date={customDates.nextTermEnds ? new Date(customDates.nextTermEnds) : undefined}
                          setDate={(d) => setCustomDates(prev => ({ ...prev, nextTermEnds: d ? format(d, 'yyyy-MM-dd') : '' }))}
                          placeholder="Select date"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowReportConfigModal(false);
              setTransReportType(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleReportConfigComplete}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comparison Exam Selection Modal */}
      <Dialog open={showComparisonExamModal} onOpenChange={setShowComparisonExamModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Select Comparison Exams
            </DialogTitle>
            <DialogDescription>
              Select up to 2 exams from the same term, class, and academic year to compare progress
            </DialogDescription>
          </DialogHeader>

          {isLoadingComparisonExams ? (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-sm text-gray-600">Loading available exams...</p>
            </div>
          ) : availableComparisonExams.length === 0 ? (
            <div className="py-8 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-yellow-600 mb-2" />
              <p className="text-sm text-gray-600">No comparison exams found for this term, class, and academic year.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto py-4">
              {availableComparisonExams.map((exam) => {
                const isSelected = selectedComparisonExams.includes(exam.id);
                const canSelect = selectedComparisonExams.length < 2 || isSelected;

                return (
                  <div
                    key={exam.id}
                    onClick={() => {
                      if (!canSelect) return;
                      if (isSelected) {
                        setSelectedComparisonExams(selectedComparisonExams.filter(id => id !== exam.id));
                      } else if (selectedComparisonExams.length < 2) {
                        setSelectedComparisonExams([...selectedComparisonExams, exam.id]);
                      } else {
                        toast({
                          title: "Limit Reached",
                          description: "You can only select up to 2 comparison exams"
                        });
                      }
                    }}
                    className={`w-full p-3 border rounded-lg text-left transition-colors cursor-pointer ${isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : canSelect
                          ? 'border-gray-200 hover:bg-gray-50'
                          : 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked && selectedComparisonExams.length < 2) {
                                setSelectedComparisonExams([...selectedComparisonExams, exam.id]);
                              } else if (!checked) {
                                setSelectedComparisonExams(selectedComparisonExams.filter(id => id !== exam.id));
                              }
                            }}
                            disabled={!canSelect}
                            className="h-4 w-4"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{exam.name}</h3>
                          <p className="text-sm text-gray-600">
                            {exam.examTypeName || 'Exam'} • {exam.startDate ? new Date(exam.startDate).toLocaleDateString() : 'No date'}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="ml-2 text-blue-600">
                          <Check className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedComparisonExams.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800 mb-3">
                  <span className="font-semibold">{selectedComparisonExams.length}</span> of 2 exams selected
                </p>
                <p className="text-xs text-blue-700 mb-2">Customize exam names (optional):</p>
                <div className="space-y-2">
                  {selectedComparisonExams.map((examId, index) => {
                    const exam = availableComparisonExams.find(e => e.id === examId);
                    return (
                      <div key={examId} className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">
                          Exam {index + 1}:
                        </label>
                        <Input
                          placeholder={exam?.name || 'Enter custom name'}
                          value={comparisonExamNames[examId] || ''}
                          onChange={(e) => {
                            setComparisonExamNames({
                              ...comparisonExamNames,
                              [examId]: e.target.value
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-8 text-sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowComparisonExamModal(false);
              setSelectedComparisonExams([]);
              setComparisonExamNames({});
              setTransReportType(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedComparisonExams.length > 0) {
                  setShowComparisonExamModal(false);
                  generateTransReportWithProgress(selectedComparisonExams, comparisonExamNames);
                } else {
                  toast({ title: "Error", description: "Please select at least one comparison exam" });
                }
              }}
              disabled={selectedComparisonExams.length === 0 || isLoadingComparisonExams}
            >
              Generate Report ({selectedComparisonExams.length}/2)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer */}
      <PDFViewer
        isOpen={pdfViewer.isOpen}
        onClose={pdfViewer.closePDF}
        pdfBlob={pdfViewer.pdfBlob}
        fileName={pdfViewer.fileName}
        title={pdfViewer.title}
        showDownload={true}
        showPrint={true}
      />
    </div>
  );
} 
