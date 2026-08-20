"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { format } from 'date-fns';
import { DatePicker } from '@/components/common/date-picker';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Loader2,
  FileText,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Printer,
  Trophy,
  AlertTriangle,
  TrendingUp,
  BookOpen,
  ArrowUpDown,
  Filter,
  Edit3,
  Grid3X3,
  List,
  ChevronUp,
  ChevronDown,
  FileSpreadsheet,
  FileText as FileTextIcon,
  BarChart3,
  PieChart,
  Users as UsersIcon,
  Award,
  Target,
  TrendingDown,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
} from '@/components/ui/select';
import { useExam, useExams, useExamResultByExamId } from '@/lib/hooks/use-exams';
import { useClasses } from '@/lib/hooks/use-classes';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useStaff } from '@/lib/hooks/use-staff';
import { createStaffNameMap } from '@/lib/utils/staff-names';
import { useQuery } from '@tanstack/react-query';
import { SchoolSettingsService } from '@/lib/services/school-settings.service';
import Link from 'next/link';
import type { ExamResult, ExamRecordPupilInfo } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { generateExamPDF } from '@/components/exam/ExamResultsPDF';
import ComprehensiveReportsPDF, { generateComprehensiveReactPDF } from '@/components/exam/ComprehensiveReactPDF';
import { generateModernBatchReportPDF, generateTransBatchReportPDF, preGenerateQRCodesForBatch } from '@/components/exam/ModernBatchReportPDF';
import { generateFullReport2PDF } from '@/components/exam/FullReport2PDF';
import { generatePrimaryMiniReportPDF } from '@/components/exam/PrimaryMiniReportPDF';
import { FullReport2PaletteSelector } from '@/components/exam/FullReport2PaletteSelector';
import { generateNurseryAssessmentPDF } from '@/components/exam/NurseryAssessmentPDF';
import { generateNurseryMiniReportPDF } from '@/components/exam/NurseryMiniReportPDF';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PDFViewer } from '@/components/pdf/pdf-viewer';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { ExamSignatureDisplay } from '@/components/exam/ExamSignatureDisplay';
import { usePrint } from '@/lib/contexts/print-context';
import { useReleaseInfo, useReleaseResults, useRevokeResults, useReleaseAllResults } from '@/lib/hooks/use-results-release';
import { useAuth } from '@/lib/contexts/auth-context';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Unlock, Send, Users } from 'lucide-react';
import { AdminPasswordModal } from '@/components/exam/AdminPasswordModal';
import { getNextTermDates } from '@/lib/utils/academic-year-utils';
import TerminalReport from '@/components/exam/PupilReportCardPDF2';
import { pdf } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
// QRCode is imported dynamically when needed (it's a Node.js package)
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ExamsService } from '@/lib/services/exams.service';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { cleanSubjectName } from '@/lib/utils/html-entities';
import { formatTeacherNameWithTitle } from '@/lib/utils/teacher-formatter';
import { calculatePromotionStatus, isTermThree } from '@/lib/utils/promotion-ranking';
import { getSchoolPayCode } from '@/lib/utils/schoolpay';
import {
  GlassActionButton,
  GlassActionDock,
  GlassPageSearchInput,
  GlassPageTopBar,
} from '@/components/common/glass-page-top-bar';
import { GlassSummaryBar } from '@/components/common/glass-summary-bar';
import {
  isNurseryAssessment,
  isNurseryCommentary,
  NURSERY_COMMENTARY_OPTIONS,
} from '@/lib/exam-assessment';

// Utility functions
const getGradeColor = (grade: string): string => {
  if (grade === 'MISSED') return 'bg-orange-100 text-orange-800 border-orange-200';
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

interface PupilResultData {
  pupilInfo: ExamRecordPupilInfo;
  results: Record<string, { marks: number; grade: string; aggregates: number; comment?: string }>;
  totalMarks: number;
  totalAggregates: number;
  division: string;
  position: number;
}

interface Analytics {
  bestPupil: {
    name: string;
    admissionNumber: string;
    totalMarks: number;
    totalAggregates: number;
  };
  worstPupil: {
    name: string;
    admissionNumber: string;
    totalMarks: number;
    totalAggregates: number;
  };
  bestSubject: {
    name: string;
    code: string;
    averageMarks: number;
  };
  worstSubject: {
    name: string;
    code: string;
    averageMarks: number;
  };
  classAverage: number;
  passRate: number;
}

// Function to adapt exam data to the PDF format required
const adaptExamDataForPDF = (
  examDetails: any,
  classSnap: any,
  subjectSnaps: any[],
  processedResults: any[],
  majorSubjects?: string[]
) => {
  return {
    examDetails: {
      name: examDetails?.name || '',
      examTypeName: examDetails?.examTypeName || '',
      startDate: examDetails?.startDate || '',
      endDate: examDetails?.endDate || ''
    },
    classSnap: {
      name: classSnap?.name || ''
    },
    subjectSnaps,
    processedResults,
    majorSubjects
  };
};

// Helper function to validate if a photo is a real photo (not placeholder)
const isRealPhoto = (photo?: string): boolean => {
  return !!(photo &&
    photo !== 'NO PHOTO' &&
    photo.trim() !== '' &&
    photo !== 'https://placehold.co/128x128.png' &&
    !photo.includes('ui-avatars.com') && // Exclude generated avatars
    (photo.startsWith('http') || photo.startsWith('data:') || photo.startsWith('blob:') || photo.startsWith('/uploads/')));
};

const pickRealPupilPhoto = (pupilInfo: any, fetchedPupil?: any): string => {
  const candidates = [
    pupilInfo?.photo,
    pupilInfo?.photoUrl,
    pupilInfo?.avatar,
    fetchedPupil?.photo,
    fetchedPupil?.photoUrl,
    fetchedPupil?.avatar,
  ];

  return candidates.find((photo) => typeof photo === 'string' && isRealPhoto(photo)) || '';
};

const prepareResultsWithLivePupilData = async <T extends { pupilInfo: any }>(results: T[], cachedPupils?: any[]): Promise<T[]> => {
  const pupilIds = [...new Set(results.map((result) => result.pupilInfo?.pupilId).filter(Boolean))];
  let fetchedPupilsMap: Record<string, any> = {};

  if (cachedPupils && cachedPupils.length > 0) {
    cachedPupils.forEach((p) => {
      if (p?.id) fetchedPupilsMap[p.id] = p;
    });
  } else if (pupilIds.length > 0) {
    try {
      const batchResponse = await fetch('/api/pupils/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pupilIds }),
      });

      if (batchResponse.ok) {
        fetchedPupilsMap = await batchResponse.json();
      }
    } catch (error) {
      console.warn('Failed to fetch live pupil data for report photos:', error);
    }
  }

  return results.map((result) => {
    const pupilId = result.pupilInfo?.pupilId;
    const fetchedPupil = pupilId ? fetchedPupilsMap[pupilId] : undefined;
    return {
      ...result,
      pupilInfo: {
        ...result.pupilInfo,
        photo: pickRealPupilPhoto(result.pupilInfo, fetchedPupil),
        schoolPayCode: getSchoolPayCode(fetchedPupil) || result.pupilInfo?.schoolPayCode || '',
      },
    } as T;
  });
};

// Promotion Ranking Configuration Dialog (for Term 3 only)
const PromotionRankingDialog = ({
  isOpen,
  onClose,
  onConfirm,
  config,
  onConfigChange
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  config: {
    enabled: boolean;
    ranges: {
      promoted: { min: number; max: number };
      probation: { min: number; max: number };
      repeat: { min: number; max: number };
    };
  };
  onConfigChange: (config: any) => void;
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Term 3 Promotion Ranking</DialogTitle>
          <DialogDescription>
            Configure promotion ranking ranges based on total aggregates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={config.enabled}
              onCheckedChange={(checked) => {
                console.log('🔄 Checkbox changed, checked:', checked, 'enabled will be:', !!checked);
                onConfigChange({ ...config, enabled: !!checked });
              }}
            />
            <Label>Enable promotion ranking for this report</Label>
          </div>

          {config.enabled && (
            <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
              {/* Promoted Range */}
              <div>
                <Label className="text-green-700 font-semibold">PROMOTED</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={config.ranges.promoted.min}
                    onChange={(e) => onConfigChange({
                      ...config,
                      ranges: {
                        ...config.ranges,
                        promoted: { ...config.ranges.promoted, min: parseInt(e.target.value) || 4 }
                      }
                    })}
                    className="w-20"
                  />
                  <span className="self-center">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={config.ranges.promoted.max}
                    onChange={(e) => onConfigChange({
                      ...config,
                      ranges: {
                        ...config.ranges,
                        promoted: { ...config.ranges.promoted, max: parseInt(e.target.value) || 25 }
                      }
                    })}
                    className="w-20"
                  />
                </div>
              </div>

              {/* Promoted on Probation Range */}
              <div>
                <Label className="text-orange-700 font-semibold">PROMOTED ON PROBATION</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={config.ranges.probation.min}
                    onChange={(e) => onConfigChange({
                      ...config,
                      ranges: {
                        ...config.ranges,
                        probation: { ...config.ranges.probation, min: parseInt(e.target.value) || 26 }
                      }
                    })}
                    className="w-20"
                  />
                  <span className="self-center">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={config.ranges.probation.max}
                    onChange={(e) => onConfigChange({
                      ...config,
                      ranges: {
                        ...config.ranges,
                        probation: { ...config.ranges.probation, max: parseInt(e.target.value) || 30 }
                      }
                    })}
                    className="w-20"
                  />
                </div>
              </div>

              {/* Advised to Repeat Range */}
              <div>
                <Label className="text-red-700 font-semibold">ADVISED TO REPEAT</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={config.ranges.repeat.min}
                    onChange={(e) => onConfigChange({
                      ...config,
                      ranges: {
                        ...config.ranges,
                        repeat: { ...config.ranges.repeat, min: parseInt(e.target.value) || 31 }
                      }
                    })}
                    className="w-20"
                  />
                  <span className="self-center">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={config.ranges.repeat.max}
                    onChange={(e) => onConfigChange({
                      ...config,
                      ranges: {
                        ...config.ranges,
                        repeat: { ...config.ranges.repeat, max: parseInt(e.target.value) || 36 }
                      }
                    })}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Add new PrintModal component
const PrintModal = ({
  isOpen,
  onClose,
  onPrintAssessment,
  onPrintNurseryReport,
  onPrintTrans,
  onPrintFullReport2,
  isGenerating,
  generationStatus,
  generationProgress,
  eta,
  isNursery,
  omitNurseryTeacherComment,
  onOmitNurseryTeacherCommentChange,
  individualPupilName,
  isIndividual = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onPrintAssessment: () => void;
  onPrintNurseryReport: () => void;
  onPrintTrans: () => void;
  onPrintFullReport2: () => void;
  isGenerating: boolean;
  generationStatus: string;
  generationProgress: number;
  eta: string;
  isNursery?: boolean;
  omitNurseryTeacherComment: boolean;
  onOmitNurseryTeacherCommentChange: (omit: boolean) => void;
  individualPupilName?: string;
  isIndividual?: boolean;
}) => {
  const isIndividualPrint = isIndividual || Boolean(individualPupilName);
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Printer className="h-5 w-5 text-blue-600" />
            Print Reports{individualPupilName ? ` - ${individualPupilName}` : ''}
          </DialogTitle>
          <DialogDescription>
            {isIndividualPrint ? 'Select a report to generate for this pupil' : 'Select the type of report to generate'}
          </DialogDescription>
        </DialogHeader>

        {isGenerating ? (
          <div className="py-4">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Generating Report</h3>
              <p className="text-sm text-blue-600 font-medium mb-4">{generationStatus}</p>

              {/* Compact Progress Bar */}
              <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden border">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>

              {/* Progress and ETA */}
              <div className="flex justify-between items-center mb-4 text-sm">
                <span className="font-semibold text-gray-800">{generationProgress}% Complete</span>
                <span className="text-blue-600 font-medium">{eta}</span>
              </div>

              {/* Compact Status Info */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-semibold text-gray-700">Step: </span>
                    <span className="text-gray-600">
                      {generationProgress < 20 ? 'Data Prep' :
                        generationProgress < 50 ? 'Processing' :
                          generationProgress < 80 ? 'PDF Gen' : 'Finalizing'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Status: </span>
                    <span className="text-green-600">Active</span>
                  </div>
                </div>
              </div>

              {/* Compact Progress Steps */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`p-2 rounded border ${generationProgress >= 10 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${generationProgress >= 10 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                      {generationProgress >= 10 ? '✓' : '1'}
                    </div>
                    <span className="font-medium">Initialize</span>
                  </div>
                </div>

                <div className={`p-2 rounded border ${generationProgress >= 30 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${generationProgress >= 30 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                      {generationProgress >= 30 ? '✓' : '2'}
                    </div>
                    <span className="font-medium">Process</span>
                  </div>
                </div>

                <div className={`p-2 rounded border ${generationProgress >= 60 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${generationProgress >= 60 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                      {generationProgress >= 60 ? '✓' : '3'}
                    </div>
                    <span className="font-medium">Generate</span>
                  </div>
                </div>

                <div className={`p-2 rounded border ${generationProgress >= 90 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${generationProgress >= 90 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                      {generationProgress >= 90 ? '✓' : '4'}
                    </div>
                    <span className="font-medium">Complete</span>
                  </div>
                </div>
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
            {!isIndividualPrint && <button
              onClick={onPrintAssessment}
              className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Assessment Report</h3>
                  <p className="text-sm text-gray-600">Class-wide assessment summary</p>
                </div>
              </div>
            </button>}

            <button
              onClick={onPrintNurseryReport}
              className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileTextIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Mini Report</h3>
                  <p className="text-sm text-gray-600">
                    {isIndividualPrint
                      ? (isNursery ? 'Playful nursery report card for one pupil' : 'Professional half-page report card for one pupil')
                      : (isNursery ? 'Playful nursery report cards (2 per page)' : 'Professional primary report cards (2 per page)')}
                  </p>
                </div>
              </div>
            </button>

            {isNursery && !isIndividualPrint && (
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                <Checkbox
                  id="omit-nursery-teacher-comment"
                  checked={omitNurseryTeacherComment}
                  onCheckedChange={(checked) => onOmitNurseryTeacherCommentChange(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="omit-nursery-teacher-comment" className="cursor-pointer text-sm font-medium text-gray-900">
                    Leave class teacher&apos;s comment blank
                  </Label>
                  <p className="text-xs text-gray-600">
                    Show two writing lines and place the signature on the second line.
                  </p>
                </div>
              </div>
            )}

            {!isNursery && <button
              onClick={onPrintTrans}
              className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <FileTextIcon className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Full Report</h3>
                  <p className="text-sm text-gray-600">{isIndividualPrint ? 'Comprehensive report card for this pupil' : 'Individual pupil report cards (Comprehensive design)'}</p>
                </div>
              </div>
            </button>}

            {!isNursery && <button
              onClick={onPrintFullReport2}
              className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileTextIcon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Bespoke Report</h3>
                  <p className="text-sm text-gray-600">{isIndividualPrint ? 'Fully customisable Trinity blue-and-gold report for this pupil' : 'Individual pupil report cards (fully customisable Trinity blue-and-gold design)'}</p>
                </div>
              </div>
            </button>}
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

// Print Assessment Options Dialog Component
const PrintAssessmentOptionsDialog = ({
  isOpen,
  onClose,
  onConfirm,
  gradingScale,
  reportType,
  isNursery,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: {
    showPin: boolean;
    showIndexNumber: boolean;
    showLinNumber: boolean;
    showMarks: boolean;
    showAgg: boolean;
    showTotal: boolean;
    showDiv: boolean;
    orientation: 'landscape' | 'portrait';
    fillMarks: boolean;
    fillAgg: boolean;
    fillTotal: boolean;
    fillDiv: boolean;
    showMajorSubjects: boolean;
    showBestPupil: boolean;
    showNeedsImprovement: boolean;
    showAggregateAnalysis: boolean;
  }) => void;
  gradingScale?: Array<{ minMark: number; maxMark: number; grade: string; aggregates: number }>;
  reportType?: 'table' | 'detailed';
  isNursery?: boolean;
}) => {
  const [showPin, setShowPin] = useState(true);
  const [showIndexNumber, setShowIndexNumber] = useState(true);
  const [showLinNumber, setShowLinNumber] = useState(true);
  const [showMarks, setShowMarks] = useState(true);
  const [showAgg, setShowAgg] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [showDiv, setShowDiv] = useState(true);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [fillMarks, setFillMarks] = useState(true);
  const [fillAgg, setFillAgg] = useState(true);
  const [fillTotal, setFillTotal] = useState(true);
  const [fillDiv, setFillDiv] = useState(true);
  const [showMajorSubjects, setShowMajorSubjects] = useState(true);
  const [showBestPupil, setShowBestPupil] = useState(true);
  const [showNeedsImprovement, setShowNeedsImprovement] = useState(true);
  const [showAggregateAnalysis, setShowAggregateAnalysis] = useState(true);

  const handleConfirm = () => {
    const options = {
      showPin,
      showIndexNumber,
      showLinNumber,
      showMarks,
      showAgg: isNursery ? false : showAgg,
      showTotal: isNursery ? false : showTotal,
      showDiv: isNursery ? false : showDiv,
      orientation,
      fillMarks,
      fillAgg: isNursery ? false : fillAgg,
      fillTotal: isNursery ? false : fillTotal,
      fillDiv: isNursery ? false : fillDiv,
      showMajorSubjects: isNursery ? false : showMajorSubjects,
      showBestPupil: isNursery ? false : showBestPupil,
      showNeedsImprovement: isNursery ? false : showNeedsImprovement,
      showAggregateAnalysis: isNursery ? false : showAggregateAnalysis,
    };
    console.log('📋 Print Assessment Options - Generate PDF clicked with options:', options);
    console.log('✅ showAggregateAnalysis =', showAggregateAnalysis);
    onConfirm(options);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Printer className="h-5 w-5 text-blue-600" />
            Print Assessment Options
          </DialogTitle>
          <DialogDescription>
            {isNursery
              ? 'Choose the pupil identifiers and nursery assessment columns to include.'
              : 'Configure which columns to display and which data to include in the assessment report'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Column Visibility Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Column Visibility</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showPin"
                    checked={showPin}
                    onCheckedChange={(checked) => setShowPin(checked === true)}
                  />
                  <Label htmlFor="showPin" className="font-medium cursor-pointer">
                    PIN (Admission Number)
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showIndexNumber"
                    checked={showIndexNumber}
                    onCheckedChange={(checked) => setShowIndexNumber(checked === true)}
                  />
                  <Label htmlFor="showIndexNumber" className="font-medium cursor-pointer">
                    Index Number
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showLinNumber"
                    checked={showLinNumber}
                    onCheckedChange={(checked) => setShowLinNumber(checked === true)}
                  />
                  <Label htmlFor="showLinNumber" className="font-medium cursor-pointer">
                    LIN Number
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showMarks"
                    checked={showMarks}
                    onCheckedChange={(checked) => setShowMarks(checked === true)}
                  />
                  <Label htmlFor="showMarks" className="font-medium cursor-pointer">
                    {isNursery ? 'Subject Assessments' : 'Marks'}
                  </Label>
                </div>
              </div>

              {!isNursery && <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showAgg"
                    checked={showAgg}
                    onCheckedChange={(checked) => setShowAgg(checked === true)}
                  />
                  <Label htmlFor="showAgg" className="font-medium cursor-pointer">
                    AGG (Aggregates)
                  </Label>
                </div>
              </div>}

              {!isNursery && <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showTotal"
                    checked={showTotal}
                    onCheckedChange={(checked) => setShowTotal(checked === true)}
                  />
                  <Label htmlFor="showTotal" className="font-medium cursor-pointer">
                    Total
                  </Label>
                </div>
              </div>}

              {!isNursery && <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showDiv"
                    checked={showDiv}
                    onCheckedChange={(checked) => setShowDiv(checked === true)}
                  />
                  <Label htmlFor="showDiv" className="font-medium cursor-pointer">
                    DIV (Division)
                  </Label>
                </div>
              </div>}
            </div>
          </div>

          {reportType !== 'detailed' && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Page Orientation</h3>
              <RadioGroup
                value={orientation}
                onValueChange={(value) => setOrientation(value as 'landscape' | 'portrait')}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <Label htmlFor="orientation-landscape" className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                  <RadioGroupItem id="orientation-landscape" value="landscape" />
                  <span className="font-medium">Landscape</span>
                </Label>
                <Label htmlFor="orientation-portrait" className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                  <RadioGroupItem id="orientation-portrait" value="portrait" />
                  <span className="font-medium">Portrait</span>
                </Label>
              </RadioGroup>
            </div>
          )}

          {/* Data Fill Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Data Fill Options</h3>
            <p className="text-xs text-gray-500 mb-3">
              Choose which columns should be filled with data or left empty
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label htmlFor="fillMarks" className="font-medium cursor-pointer">
                  {isNursery ? 'Fill Assessment Columns' : 'Fill Marks Column'}
                </Label>
                <Checkbox
                  id="fillMarks"
                  checked={fillMarks}
                  onCheckedChange={(checked) => setFillMarks(checked === true)}
                  disabled={!showMarks}
                />
              </div>

              {!isNursery && <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label htmlFor="fillAgg" className="font-medium cursor-pointer">
                  Fill AGG Column
                </Label>
                <Checkbox
                  id="fillAgg"
                  checked={fillAgg}
                  onCheckedChange={(checked) => setFillAgg(checked === true)}
                  disabled={!showAgg}
                />
              </div>}

              {!isNursery && <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label htmlFor="fillTotal" className="font-medium cursor-pointer">
                  Fill Total Column
                </Label>
                <Checkbox
                  id="fillTotal"
                  checked={fillTotal}
                  onCheckedChange={(checked) => setFillTotal(checked === true)}
                  disabled={!showTotal}
                />
              </div>}

              {!isNursery && <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label htmlFor="fillDiv" className="font-medium cursor-pointer">
                  Fill DIV Column
                </Label>
                <Checkbox
                  id="fillDiv"
                  checked={fillDiv}
                  onCheckedChange={(checked) => setFillDiv(checked === true)}
                  disabled={!showDiv}
                />
              </div>}
            </div>
          </div>

          {/* Additional Display Options */}
          {!isNursery && <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Display Options</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showMajorSubjects"
                    checked={showMajorSubjects}
                    onCheckedChange={(checked) => setShowMajorSubjects(checked === true)}
                  />
                  <Label htmlFor="showMajorSubjects" className="font-medium cursor-pointer">
                    Show Major Subjects Legend
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showBestPupil"
                    checked={showBestPupil}
                    onCheckedChange={(checked) => setShowBestPupil(checked === true)}
                  />
                  <Label htmlFor="showBestPupil" className="font-medium cursor-pointer">
                    Show Best Performing Pupil
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showNeedsImprovement"
                    checked={showNeedsImprovement}
                    onCheckedChange={(checked) => setShowNeedsImprovement(checked === true)}
                  />
                  <Label htmlFor="showNeedsImprovement" className="font-medium cursor-pointer">
                    Show Needs Improvement
                  </Label>
                </div>
              </div>

              {reportType !== 'detailed' && (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="showAggregateAnalysis"
                      checked={showAggregateAnalysis}
                      onCheckedChange={(checked) => setShowAggregateAnalysis(checked === true)}
                    />
                    <Label htmlFor="showAggregateAnalysis" className="font-medium cursor-pointer">
                      Show Aggregate Analysis Table (First Page)
                    </Label>
                  </div>
                  <Badge variant="secondary" className="text-xs">New!</Badge>
                </div>
              )}
            </div>
          </div>}

          {/* Grading Scale Preview */}
          {!isNursery && gradingScale && gradingScale.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Grading Scale (Will be included in PDF: First row = Marks Range, Second row = Grade)</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center text-xs">Marks Range</TableHead>
                      {gradingScale.slice(0, 9).map((_, i) => (
                        <TableHead key={i} className="text-center text-xs"></TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Row 1: All Marks Ranges */}
                    <TableRow>
                      {gradingScale.slice(0, 10).map((scale, i) => (
                        <TableCell key={`range-${i}`} className="text-center text-xs">
                          {scale.minMark === 0 ? `0-${scale.maxMark}` : `${scale.minMark}-${scale.maxMark}`}
                        </TableCell>
                      ))}
                    </TableRow>
                    {/* Row 2: All Grades */}
                    <TableRow>
                      {gradingScale.slice(0, 10).map((scale, i) => (
                        <TableCell key={`grade-${i}`} className="text-center text-xs font-semibold text-blue-700">
                          {scale.grade}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface ViewResultsViewProps {
  analysisMode?: boolean;
}

export default function ViewResultsView({ analysisMode = false }: ViewResultsViewProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  // PDF Viewer hook
  const pdfViewer = usePDFViewer();

  // Keep results switching in-place rather than remounting this page through navigation.
  const routeExamId = params.examId as string;
  const routeClassId = searchParams.get('classId');
  const [examId, setExamId] = useState(routeExamId);
  const [classId, setClassId] = useState<string | null>(routeClassId);
  const [isSwitchingExam, setIsSwitchingExam] = useState(false);
  const switchStartedAtRef = useRef(0);
  const shouldAutoOpenPrint = searchParams.get('openPrint') === '1';

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('position');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minMarks: '',
    maxMarks: '',
    grade: 'all',
    division: 'all'
  });
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedPupilIdForPopup, setSelectedPupilIdForPopup] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showProgressiveExamModal, setShowProgressiveExamModal] = useState(false);
  const [selectedProgressiveExam, setSelectedProgressiveExam] = useState<string | null>(null);
  const [progressiveExams, setProgressiveExams] = useState<any[]>([]);

  // Results release state
  const [selectedPupils, setSelectedPupils] = useState<string[]>([]);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');

  // Individual print mode state
  const [isPrintMode, setIsPrintMode] = useState(true);
  const [selectedPupilForPrint, setSelectedPupilForPrint] = useState<string | null>(null);
  const [showIndividualPrintModal, setShowIndividualPrintModal] = useState(false);

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [omitNurseryTeacherComment, setOmitNurseryTeacherComment] = useState(false);
  const [showPrintAssessmentOptionsDialog, setShowPrintAssessmentOptionsDialog] = useState(false);
  const [assessmentReportType, setAssessmentReportType] = useState<'table' | 'detailed'>('table'); // Track which assessment type
  const [printAssessmentOptions, setPrintAssessmentOptions] = useState<{
    showPin: boolean;
    showIndexNumber: boolean;
    showLinNumber: boolean;
    showMarks: boolean;
    showAgg: boolean;
    showTotal: boolean;
    showDiv: boolean;
    orientation: 'landscape' | 'portrait';
    fillMarks: boolean;
    fillAgg: boolean;
    fillTotal: boolean;
    fillDiv: boolean;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [eta, setEta] = useState<string>('');
  const [hasHandledAutoOpenPrint, setHasHandledAutoOpenPrint] = useState(false);

  // PDF pupil selection state — "Select Pupils" filter mode
  const [isPupilSelectMode, setIsPupilSelectMode] = useState(false);
  const [selectedPdfPupilIds, setSelectedPdfPupilIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!shouldAutoOpenPrint || hasHandledAutoOpenPrint) return;

    setShowPrintModal(true);
    setHasHandledAutoOpenPrint(true);

    const nextUrl = classId
      ? `/exams/${examId}/view-results?classId=${classId}`
      : `/exams/${examId}/view-results`;

    router.replace(nextUrl);
  }, [shouldAutoOpenPrint, hasHandledAutoOpenPrint, classId, examId, router]);

  // TRANS report type selection state
  const [showTransTypeModal, setShowTransTypeModal] = useState(false);
  const [transReportType, setTransReportType] = useState<'grading' | 'progress' | null>(null);
  const [selectedFullReportTemplate, setSelectedFullReportTemplate] = useState<'standard' | 'full2'>('standard');
  const [fullReport2Palette, setFullReport2Palette] = useState<'blue' | 'purple' | 'orange'>('blue');
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
    palette: 'blue' as 'blue' | 'purple' | 'orange',
  });

  // Custom dates state
  const [customDates, setCustomDates] = useState({
    createdOn: '',
    nextTermBegins: '',
    nextTermEnds: '',
  });

  // Promotion ranking state (for Term 3 only)
  const [showPromotionRankingModal, setShowPromotionRankingModal] = useState(false);
  const [promotionRankingConfig, setPromotionRankingConfig] = useState({
    enabled: true, // Default to enabled (checkbox starts checked)
    ranges: {
      promoted: { min: 4, max: 25 },
      probation: { min: 26, max: 30 },
      repeat: { min: 31, max: 36 }
    }
  });


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

  const { data: exams = [], isLoading: isLoadingExams } = useExams();
  const { data: selectedExam, isLoading: isLoadingSelectedExam } = useExam(examId);
  const { data: allClasses = [] } = useClasses();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: allPupils = [] } = usePupils(); // Fetch all pupils to get dateOfBirth
  const { data: allStaff = [] } = useStaff(); // Fetch staff to get class teacher info
  const {
    data: examResultData,
    isLoading: isLoadingExamResult,
    error: examResultError
  } = useExamResultByExamId(examId, selectedExam ?? undefined);

  // Results release hooks
  const { data: releaseInfo } = useReleaseInfo(examId, classId || '');
  const releaseResultsMutation = useReleaseResults();
  const revokeResultsMutation = useRevokeResults();
  const releaseAllMutation = useReleaseAllResults();

  const examDetails = useMemo(() => {
    if (!examId) return undefined;
    const exam = selectedExam ?? exams.find(exam => exam.id === examId);

    // Add termName to examDetails for easy access
    if (exam && exam.termId && academicYears.length > 0) {
      const academicYear = academicYears.find(year => year.id === exam.academicYearId);
      const term = academicYear?.terms?.find(t => t.id === exam.termId);
      return {
        ...exam,
        termName: term?.name
      };
    }

    return exam;
  }, [academicYears, exams, examId, selectedExam]);

  const classSnap = useMemo(() => examResultData?.classSnapshot, [examResultData]);
  const isNurseryExam = useMemo(
    () => isNurseryAssessment(examDetails, examResultData, classSnap),
    [classSnap, examDetails, examResultData]
  );

  const examSwitcher = useMemo(() => {
    if (!examDetails) {
      return { label: 'Classes', options: [] as Array<{ id: string; classId: string; label: string }> };
    }

    const isContinuousAssessment = examDetails.examTypeId === 'et_cat';
    const classOrder = new Map(allClasses.map((schoolClass, index) => [schoolClass.id, index]));
    const classLabel = (targetClassId: string) => {
      const schoolClass = allClasses.find((item) => item.id === targetClassId);
      return schoolClass?.code || schoolClass?.name || 'Unnamed class';
    };

    if (isContinuousAssessment) {
      const assessmentName = examDetails.baseName || examDetails.name.split(' - ')[0];
      const currentClassId = classId || examDetails.classId;
      const setsByNumber = new Map<number, typeof examDetails>();

      exams
        .filter((exam) =>
          exam.examTypeId === 'et_cat' &&
          (exam.baseName || exam.name.split(' - ')[0]) === assessmentName &&
          exam.academicYearId === examDetails.academicYearId &&
          exam.termId === examDetails.termId &&
          exam.classId === currentClassId
        )
        .forEach((exam) => {
          const match = exam.name.match(/SET\s+(\d+)$/i);
          const setNumber = match ? Number(match[1]) : 1;
          if (!setsByNumber.has(setNumber)) setsByNumber.set(setNumber, exam);
        });

      return {
        label: 'Sets',
        options: [...setsByNumber.entries()]
          .sort(([first], [second]) => first - second)
          .map(([setNumber, exam]) => ({ id: exam.id, classId: exam.classId, label: `Set ${setNumber}` })),
      };
    }

    if (!examDetails.batchId) {
      return { label: 'Classes', options: [] as Array<{ id: string; classId: string; label: string }> };
    }

    return {
      label: 'Classes',
      options: exams
        .filter((exam) => exam.batchId === examDetails.batchId)
        .sort((first, second) => (classOrder.get(first.classId) ?? Number.MAX_SAFE_INTEGER) - (classOrder.get(second.classId) ?? Number.MAX_SAFE_INTEGER))
        .map((exam) => ({ id: exam.id, classId: exam.classId, label: classLabel(exam.classId) })),
    };
  }, [allClasses, classId, examDetails, exams]);

  const handleExamSwitch = useCallback((targetExamId: string, targetClassId: string) => {
    if (targetExamId === examId) return;

    switchStartedAtRef.current = performance.now();
    setIsSwitchingExam(true);
    setSearchTerm('');
    setSelectedPupils([]);
    setSelectedPupilForPrint(null);
    setExamId(targetExamId);
    setClassId(targetClassId);

    if (typeof window !== 'undefined') {
      window.history.replaceState(
        window.history.state,
        '',
        `/exams/${targetExamId}/view-results?classId=${targetClassId}`
      );
    }
  }, [examId]);

  useEffect(() => {
    if (!isSwitchingExam) return;

    if (examDetails?.id === examId && examResultData?.examId === examId) {
      const elapsed = performance.now() - switchStartedAtRef.current;
      const remaining = Math.max(0, 140 - elapsed);
      const timer = window.setTimeout(() => setIsSwitchingExam(false), remaining);
      return () => window.clearTimeout(timer);
    }
  }, [examDetails?.id, examId, examResultData?.examId, isSwitchingExam]);

  // Enhance pupil snapshots with dateOfBirth from actual pupils data
  const pupilSnaps = useMemo(() => {
    const snaps = examResultData?.pupilSnapshots || [];
    return snaps.map(snap => {
      const actualPupil = allPupils.find(p => p.id === snap.pupilId);
      return {
        ...snap,
        dateOfBirth: snap.dateOfBirth || actualPupil?.dateOfBirth,
        ageAtExam: snap.ageAtExam,
        schoolPayCode: getSchoolPayCode(actualPupil)
      };
    });
  }, [examResultData, allPupils]);

  // Clean subject names to remove any trailing '&' from database
  const subjectSnaps = useMemo(() => {
    const snaps = examResultData?.subjectSnapshots || [];
    return snaps.map(snap => ({
      ...snap,
      name: cleanSubjectName(snap.name)
    }));
  }, [examResultData]);

  // Get class teacher information with proper title based on gender
  const classTeacherInfo = useMemo(() => {
    if (!classSnap?.classTeacherId || !allStaff.length) {
      return { name: 'Class Teacher', gender: undefined };
    }
    const teacher = allStaff.find(s => s.id === classSnap.classTeacherId);
    if (!teacher) return { name: classSnap.classTeacherName || 'Class Teacher', gender: undefined };
    const formattedName = formatTeacherNameWithTitle(`${teacher.firstName} ${teacher.lastName}`, teacher.gender);
    return { name: formattedName, gender: teacher.gender };
  }, [classSnap, allStaff]);

  // Function to get academic year and term names
  const getAcademicYearAndTerm = useCallback((academicYearId: string, termId: string) => {
    const academicYear = academicYears?.find(year => year.id === academicYearId);
    const term = academicYear?.terms?.find(term => term.id === termId);
    return {
      academicYearName: academicYear?.name || 'Unknown Year',
      termName: term?.name || 'Unknown Term'
    };
  }, [academicYears]);

  // Process results data
  const processedResults = useMemo((): PupilResultData[] => {
    if (!examResultData?.results || !pupilSnaps.length || !subjectSnaps.length) return [];

    // Log data to help with debugging
    console.log('Processing results with:', {
      pupilCount: pupilSnaps.length,
      subjectCount: subjectSnaps.length,
      resultsKeys: Object.keys(examResultData.results).length
    });

    // Debug log subject info to verify Math is included
    console.log('Subject snapshots:', subjectSnaps.map(s => ({
      code: s.code,
      name: s.name,
      id: s.subjectId
    })));

    // Get major subjects from the saved exam result data
    const savedMajorSubjects = examResultData.majorSubjects || [];
    const majorSubjects = savedMajorSubjects.length > 0
      ? savedMajorSubjects
      : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));

    console.log('Major subjects for aggregates calculation:', majorSubjects);

    const results: PupilResultData[] = [];

    pupilSnaps.forEach(pupil => {
      // Get the raw pupil results from the database
      const pupilResults = examResultData.results[pupil.pupilId] || {};

      console.log(`Processing pupil ${pupil.name} (${pupil.pupilId}):`,
        Object.keys(pupilResults).length > 0
          ? `Found ${Object.keys(pupilResults).length} subject results`
          : 'No results found'
      );

      let totalMarks = 0;
      let totalAggregates = 0;
      const processedSubjectResults: Record<string, { marks: number; grade: string; aggregates: number; comment?: string }> = {};

      // Initialize all subjects first to ensure none are missed (especially Math)
      subjectSnaps.forEach(subject => {
        const isMajorSubject = majorSubjects.includes(subject.code);
        processedSubjectResults[subject.code] = {
          marks: 0,
          grade: isNurseryExam ? '' : 'F9',
          comment: '',
          aggregates: isNurseryExam ? 0 : (isMajorSubject ? 9 : 0) // Nursery assessments do not use aggregates
        };
      });

      // Now populate with actual results where available
      subjectSnaps.forEach(subject => {
        const result = pupilResults[subject.subjectId];
        const isMajorSubject = majorSubjects.includes(subject.code);

        if (result) {
          console.log(`Found result for subject ${subject.name} (${subject.code}):`,
            result.marks !== undefined ? `Marks: ${result.marks}` : 'No marks',
            result.grade !== undefined ? `Grade: ${result.grade}` : 'No grade',
            result.status !== undefined ? `Status: ${result.status}` : 'No status',
            `Major subject: ${isMajorSubject}`
          );

          const savedCommentary = result.comment || result.grade;
          processedSubjectResults[subject.code] = isNurseryExam ? {
            marks: 0,
            grade: result.status === 'missed' ? 'MISSED' : (isNurseryCommentary(savedCommentary) ? savedCommentary : ''),
            comment: result.status === 'missed' ? 'MISSED' : (isNurseryCommentary(savedCommentary) ? savedCommentary : ''),
            aggregates: 0,
          } : {
            marks: result.status === 'missed' ? 0 : (result.marks || 0),
            grade: result.status === 'missed' ? 'MISSED' : (result.grade || 'F9'),
            comment: result.comment,
            aggregates: isMajorSubject ? (result.status === 'missed' ? 9 : (result.aggregates || 9)) : 0 // Only major subjects get aggregates
          };
        } else {
          console.log(`No result found for subject ${subject.name} (${subject.code})`);
        }
      });

      // Calculate marks and aggregates from individual subject results
      let calculatedTotalMarks = 0;
      let calculatedTotalAggregates = 0;

      for (const subjectCode in processedSubjectResults) {
        calculatedTotalMarks += processedSubjectResults[subjectCode].marks || 0;
        // Only add aggregates if it's a major subject (non-zero aggregates)
        if (processedSubjectResults[subjectCode].aggregates > 0) {
          calculatedTotalAggregates += processedSubjectResults[subjectCode].aggregates || 0;
        }
      }

      // Use pupil totals from the database if available, otherwise use calculated values
      if (typeof pupilResults.totalMarks === 'number') {
        console.log(`Using totalMarks from database: ${pupilResults.totalMarks}`);
        totalMarks = pupilResults.totalMarks;
      } else {
        console.log(`Using calculated totalMarks: ${calculatedTotalMarks}`);
        totalMarks = calculatedTotalMarks;
      }

      if (typeof pupilResults.totalAggregates === 'number') {
        console.log(`Using totalAggregates from database: ${pupilResults.totalAggregates}`);
        totalAggregates = pupilResults.totalAggregates;
      } else {
        console.log(`Using calculated totalAggregates: ${calculatedTotalAggregates}`);
        totalAggregates = calculatedTotalAggregates;
      }

      // Use the division from the database if available, otherwise calculate it
      let division = '';
      if (typeof pupilResults.division === 'string' && pupilResults.division) {
        console.log(`Using division from database: ${pupilResults.division}`);
        division = pupilResults.division;
      } else {
        division = calculateDivision(totalAggregates);
        console.log(`Calculated division: ${division}`);
      }

      // Use position from database if available
      let position = 0;
      if (typeof pupilResults.position === 'number') {
        console.log(`Using position from database: ${pupilResults.position}`);
        position = pupilResults.position;
      }

      results.push({
        pupilInfo: pupil,
        results: processedSubjectResults,
        totalMarks,
        totalAggregates,
        division,
        position
      });
    });

    // Only sort and assign positions if they weren't already in the database
    const needToAssignPositions = results.some(r => r.position === 0);

    if (needToAssignPositions && !isNurseryExam) {
      console.log('Recalculating positions based on total marks');
      // Sort by total marks (descending) and assign positions
      results.sort((a, b) => b.totalMarks - a.totalMarks);
      results.forEach((result, index) => {
        result.position = index + 1;
      });
    }

    return results;
  }, [examResultData, isNurseryExam, pupilSnaps, subjectSnaps]);

  // Calculate analytics
  const analytics = useMemo<Analytics | null>(() => {
    if (isNurseryExam || !processedResults.length || !subjectSnaps.length) return null;

    // Find best and worst pupils
    const sortedByTotal = [...processedResults].sort((a, b) => b.totalMarks - a.totalMarks);
    const bestPupil = sortedByTotal[0];
    const worstPupil = sortedByTotal[sortedByTotal.length - 1];

    // Calculate subject averages
    const subjectAverages = subjectSnaps.map(subject => {
      const marks = processedResults.map(r => r.results[subject.code]?.marks || 0);
      const average = marks.reduce((a, b) => a + b, 0) / (marks.length || 1);
      return { ...subject, averageMarks: average };
    });

    // Find best and worst subjects
    const sortedSubjects = [...subjectAverages].sort((a, b) => b.averageMarks - a.averageMarks);
    const bestSubject = sortedSubjects[0];
    const worstSubject = sortedSubjects[sortedSubjects.length - 1];

    // Calculate class average and pass rate
    const classAverage = processedResults.reduce((sum, r) => sum + r.totalMarks, 0) / (processedResults.length || 1);
    const passRate = (processedResults.filter(r => r.totalMarks >= (examDetails?.passingMarks || 40)).length / (processedResults.length || 1)) * 100;

    return {
      bestPupil: {
        name: bestPupil?.pupilInfo?.name || 'N/A',
        admissionNumber: bestPupil?.pupilInfo?.admissionNumber || 'N/A',
        totalMarks: bestPupil?.totalMarks || 0,
        totalAggregates: bestPupil?.totalAggregates || 0
      },
      worstPupil: {
        name: worstPupil?.pupilInfo?.name || 'N/A',
        admissionNumber: worstPupil?.pupilInfo?.admissionNumber || 'N/A',
        totalMarks: worstPupil?.totalMarks || 0,
        totalAggregates: worstPupil?.totalAggregates || 0
      },
      bestSubject: {
        name: bestSubject?.name || 'N/A',
        code: bestSubject?.code || 'N/A',
        averageMarks: bestSubject?.averageMarks || 0
      },
      worstSubject: {
        name: worstSubject?.name || 'N/A',
        code: worstSubject?.code || 'N/A',
        averageMarks: worstSubject?.averageMarks || 0
      },
      classAverage,
      passRate
    };
  }, [processedResults, subjectSnaps, examDetails, isNurseryExam]);

  const selectedPupilData = useMemo(() => {
    if (!selectedPupilIdForPopup) return null;
    return processedResults.find(r => r.pupilInfo.pupilId === selectedPupilIdForPopup);
  }, [selectedPupilIdForPopup, processedResults]);

  // Filter and sort results
  const filteredAndSortedResults = useMemo(() => {
    if (!processedResults) return [];

    let filtered = processedResults.filter(result => {
      const pupilName = result.pupilInfo?.name || '';
      const admissionNumber = result.pupilInfo?.admissionNumber || '';

      const matchesSearch = pupilName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admissionNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMarks = isNurseryExam || ((!filters.minMarks || result.totalMarks >= Number(filters.minMarks)) &&
        (!filters.maxMarks || result.totalMarks <= Number(filters.maxMarks)));

      const matchesGrade = filters.grade === 'all' || !filters.grade || Object.values(result.results).some(subject => (subject?.comment || subject?.grade) === filters.grade);

      const matchesDivision = isNurseryExam || filters.division === 'all' || !filters.division || result.division === filters.division;

      return matchesSearch && matchesMarks && matchesGrade && matchesDivision;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.pupilInfo.name.localeCompare(b.pupilInfo.name);
          break;
        case 'marks':
          comparison = a.totalMarks - b.totalMarks;
          break;
        case 'aggregates':
          comparison = a.totalAggregates - b.totalAggregates;
          break;
        case 'position':
          comparison = a.position - b.position;
          break;
        default:
          // Check if sorting by subject
          if (sortField.startsWith('subject_')) {
            const subjectCode = sortField.replace('subject_', '');
            const aSubjectResult = a.results[subjectCode];
            const bSubjectResult = b.results[subjectCode];
            const aMarks = aSubjectResult?.marks || 0;
            const bMarks = bSubjectResult?.marks || 0;
            comparison = aMarks - bMarks;
          } else {
            comparison = 0;
          }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [processedResults, searchTerm, filters, sortField, sortDirection, isNurseryExam]);

  // No pagination - show all results
  const displayedResults = filteredAndSortedResults;

  // The list of pupils that batch PDF exports will operate on:
  // • If the user has manually selected pupils → only those
  // • Otherwise → the current filtered + sorted page view
  const pdfTargetResults = selectedPdfPupilIds.size > 0
    ? processedResults.filter(r => selectedPdfPupilIds.has(r.pupilInfo.pupilId))
    : filteredAndSortedResults;

  const handleViewDetails = useCallback((pupilId: string) => {
    router.push(`/exams/${examId}/pupil-results/${pupilId}`);
  }, [examId, router]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Register print handler to open print modal
  const { registerPrintHandler } = usePrint();
  useEffect(() => {
    const unregister = registerPrintHandler(() => {
      // If individual print modal is open, trigger that
      if (selectedPupilForPrint) {
        setShowIndividualPrintModal(true);
      } else {
        // Otherwise, open the main print modal
        setShowPrintModal(true);
      }
    }, 50);
    return unregister;
  }, [registerPrintHandler, selectedPupilForPrint]);

  // 🚀 OPTIMIZED: Pre-generate QR codes in background while user views results
  useEffect(() => {
    if (isSwitchingExam || !examDetails || !classSnap || !processedResults.length) return;
    const idleHandle = (window as any).requestIdleCallback
      ? (window as any).requestIdleCallback(() => {
          preGenerateQRCodesForBatch(processedResults, examDetails, classSnap).catch(() => {});
        })
      : setTimeout(() => {
          preGenerateQRCodesForBatch(processedResults, examDetails, classSnap).catch(() => {});
        }, 1000);

    return () => {
      if ((window as any).cancelIdleCallback && idleHandle) {
        (window as any).cancelIdleCallback(idleHandle);
      } else {
        clearTimeout(idleHandle);
      }
    };
  }, [isSwitchingExam, examDetails, classSnap, processedResults]);

  // Results release handlers
  const handlePupilSelection = (pupilId: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedPupils(prev => [...prev, pupilId]);
    } else {
      setSelectedPupils(prev => prev.filter(id => id !== pupilId));
    }
  };

  const handleSelectAll = (isChecked: boolean) => {
    if (isChecked) {
      const allPupilIds = displayedResults.map(result => result.pupilInfo.pupilId);
      setSelectedPupils(allPupilIds);
    } else {
      setSelectedPupils([]);
    }
  };

  const handleReleaseResults = async (password: string, notes?: string) => {
    if (!user?.id || !classId || selectedPupils.length === 0) return;

    try {
      await releaseResultsMutation.mutateAsync({
        examId,
        classId,
        pupilIds: selectedPupils,
        adminUserId: user.id,
        adminPassword: password,
        releaseNotes: notes,
      });

      setSelectedPupils([]);
    } catch (error) {
      console.error('Failed to release results:', error);
      throw error; // Re-throw to let the modal handle the error
    }
  };

  const handleRevokeResults = async (pupilIds: string[], password: string) => {
    if (!user?.id || !classId) return;

    try {
      await revokeResultsMutation.mutateAsync({
        examId,
        classId,
        pupilIds,
        adminUserId: user.id,
        adminPassword: password,
      });
    } catch (error) {
      console.error('Failed to revoke results:', error);
      throw error;
    }
  };

  const handleReleaseAll = async (password: string, notes?: string) => {
    if (!user?.id || !classId) return;

    try {
      await releaseAllMutation.mutateAsync({
        examId,
        classId,
        adminUserId: user.id,
        adminPassword: password,
        releaseNotes: notes,
      });
    } catch (error) {
      console.error('Failed to release all results:', error);
      throw error;
    }
  };

  const isResultReleased = (pupilId: string): boolean => {
    return releaseInfo?.releasedPupils.includes(pupilId) || false;
  };

  // Update progress function for individual reports
  const updateProgressForIndividual = useCallback((progress: number, status: string) => {
    setGenerationProgress(progress);
    setGenerationStatus(status);
    if (startTime) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = progress / elapsed;
      const remaining = (100 - progress) / rate;
      setEta(remaining > 60 ? `${Math.round(remaining / 60)}m ${Math.round(remaining % 60)}s` : `${Math.round(remaining)}s`);
    }
  }, [startTime]);

  // Handle individual pupil Report generation - OPTIMIZED
  const handleIndividualReportOne = useCallback(async () => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !selectedPupilForPrint || !processedResults.length) {
      toast({ title: "Error", description: "Missing required data for report generation" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgressForIndividual(5, 'Preparing report data...');

      // Find the selected pupil from processedResults
      const selectedPupilResult = processedResults.find(r => r.pupilInfo.pupilId === selectedPupilForPrint);
      if (!selectedPupilResult) {
        throw new Error('Pupil not found in results');
      }

      // Create single pupil processed result
      const singlePupilResult = {
        ...selectedPupilResult,
        pupilInfo: selectedPupilResult.pupilInfo,
        subjectResults: (selectedPupilResult as any).subjectResults || {}
      };

      const processedResultsForReport = await prepareResultsWithLivePupilData([singlePupilResult], allPupils);

      updateProgressForIndividual(10, 'Preparing all data in parallel...');

      // 🚀 OPTIMIZED: Prepare all data in parallel (synchronous operations)
      const [academicInfo, nextTermDates, gradingScaleData, majorSubjectsData] = await Promise.all([
        // These are synchronous, but using Promise.all for consistency
        Promise.resolve(getAcademicYearAndTerm(examDetails.academicYearId || '', examDetails.termId || '')),
        Promise.resolve(getNextTermDates(examDetails.academicYearId || '', examDetails.termId || '', academicYears)),
        Promise.resolve(
          examResultData?.gradingScale && Array.isArray(examResultData.gradingScale) && examResultData.gradingScale.length > 0
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
            }))
        ),
        Promise.resolve(
          examResultData?.majorSubjects && examResultData.majorSubjects.length > 0
            ? examResultData.majorSubjects
            : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code))
        )
      ]);

      const { academicYearName, termName } = academicInfo;
      const actualGradingScale = gradingScaleData;
      const majorSubjects = majorSubjectsData;

      updateProgressForIndividual(20, 'Fetching teacher information...');

      // 🚀 OPTIMIZED: Batch fetch all teachers in parallel
      const uniqueTeacherIds = [...new Set(subjectSnaps.map(s => s.teacherId).filter((teacherId): teacherId is string => Boolean(teacherId)))];
      const teachersMap = createStaffNameMap(allStaff, uniqueTeacherIds);

      const enhancedSubjectSnaps = subjectSnaps.map((subject) => {
        const teacherName = subject.teacherId
          ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher')
          : 'Not Assigned';

        return {
          ...subject,
          teacherName,
          fullMarks: 100
        };
      });

      updateProgressForIndividual(50, 'Generating report PDF...');

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
        processedResults: processedResultsForReport,
        schoolSettings,
        majorSubjects: majorSubjects, // Send major subjects for grade display
        gradingScale: actualGradingScale,
        nextTermInfo: nextTermDates ? {
          startDate: nextTermDates.nextTermBegins,
          endDate: nextTermDates.nextTermEnds
        } : undefined,
        classTeacherInfo: classTeacherInfo,
        promotionRankingConfig: promotionRankingConfig.enabled ? promotionRankingConfig : undefined,
        onProgress: (progress: number, status: string) => {
          // Map internal progress (0-100) to our progress range (50-95)
          const mappedProgress = 50 + Math.round(progress * 0.45); // 50-95 range
          updateProgressForIndividual(mappedProgress, status);
        }
      };

      const blob = await generateModernBatchReportPDF(modernBatchData);

      const pupilName = selectedPupilResult.pupilInfo.name || 'Pupil';
      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${pupilName.replace(/\s+/g, '_')}_Report.pdf`;
      const title = 'Individual Pupil Report';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      updateProgressForIndividual(100, 'Complete!');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({
        title: "Success",
        description: "Report generated successfully!",
        duration: 1500,
      });
    } catch (error) {
      console.error("Error generating individual report:", error);
      toast({ title: "Error", description: "Failed to generate report. Please try again." });
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStatus('');
        setGenerationProgress(0);
        setStartTime(null);
        setEta('');
        setShowIndividualPrintModal(false);
        setSelectedPupilForPrint(null);
      }, 1000);
    }
  }, [examDetails, classSnap, subjectSnaps, selectedPupilForPrint, processedResults, academicYears, schoolSettings, examResultData, toast, getAcademicYearAndTerm, getNextTermDates, updateProgressForIndividual, pdfViewer]);

  const handleIndividualMiniReport = useCallback(async () => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !selectedPupilForPrint || !processedResults.length) {
      toast({ title: 'Error', description: 'Missing required data for Mini Report generation' });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgressForIndividual(10, 'Preparing Mini Report data...');
      const selectedPupilResult = processedResults.find(result => result.pupilInfo.pupilId === selectedPupilForPrint);
      if (!selectedPupilResult) throw new Error('Pupil not found in results');

      const resultsForReport = await prepareResultsWithLivePupilData([selectedPupilResult], allPupils);
      const teachersMap = createStaffNameMap(
        allStaff,
        [...new Set(subjectSnaps.map(subject => subject.teacherId).filter((teacherId): teacherId is string => Boolean(teacherId)))],
      );
      const enhancedSubjectSnaps = subjectSnaps.map(subject => ({
        ...subject,
        teacherName: subject.teacherId
          ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher')
          : 'Not Assigned',
        fullMarks: 100,
      }));
      const { academicYearName, termName } = getAcademicYearAndTerm(
        examDetails.academicYearId || '',
        examDetails.termId || '',
      );

      updateProgressForIndividual(65, 'Generating one half-page Mini Report...');
      const blob = await generatePrimaryMiniReportPDF({
        examDetails: {
          name: examDetails.name,
          examTypeName: examDetails.examTypeName || 'Exam',
          startDate: examDetails.startDate,
          endDate: examDetails.endDate,
          academicYearId: examDetails.academicYearId,
          termId: examDetails.termId,
          academicYearName,
          termName,
        },
        classSnap,
        subjectSnaps: enhancedSubjectSnaps,
        processedResults: resultsForReport,
        schoolSettings,
        majorSubjects: examResultData?.majorSubjects,
        backgroundImage: '/images/Primary%20Mini%20BG.png',
        onProgress: (completed, total) => updateProgressForIndividual(
          65 + Math.round((completed / Math.max(total, 1)) * 30),
          `Generating Mini Report (${completed}/${total})...`,
        ),
      });

      const pupilName = selectedPupilResult.pupilInfo.name || 'Pupil';
      pdfViewer.openPDFFromBlob(
        blob,
        `${examDetails.name.replace(/\s+/g, '_')}_${pupilName.replace(/\s+/g, '_')}_Mini_Report.pdf`,
        'Individual Pupil Mini Report',
      );
      updateProgressForIndividual(100, 'Complete!');
      toast({ title: 'Success', description: 'Mini Report is ready for viewing.', duration: 1500 });
    } catch (error) {
      console.error('Error generating individual Mini Report:', error);
      toast({ title: 'Error', description: 'Failed to generate Mini Report. Please try again.' });
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStatus('');
        setGenerationProgress(0);
        setStartTime(null);
        setEta('');
        setShowIndividualPrintModal(false);
        setSelectedPupilForPrint(null);
      }, 1000);
    }
  }, [allPupils, allStaff, classSnap, examDetails, examResultData, getAcademicYearAndTerm, pdfViewer, processedResults, schoolSettings, selectedPupilForPrint, subjectSnaps, toast, updateProgressForIndividual]);

  const openIndividualFullReport = useCallback((template: 'standard' | 'full2') => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !selectedPupilForPrint || !processedResults.length) {
      toast({ title: "Error", description: "Missing required data for TRANS report generation" });
      return;
    }
    setSelectedFullReportTemplate(template);
    setShowIndividualPrintModal(false);
    setShowTransTypeModal(true);
  }, [examDetails, classSnap, subjectSnaps, selectedPupilForPrint, processedResults, toast]);

  const handleIndividualFullReport = useCallback(
    () => openIndividualFullReport('standard'),
    [openIndividualFullReport],
  );

  const handleIndividualFullReport2 = useCallback(
    () => openIndividualFullReport('full2'),
    [openIndividualFullReport],
  );

  // Generate individual TRANS report with grading scale - OPTIMIZED
  const generateIndividualTransReportWithGrading = useCallback(async () => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !selectedPupilForPrint || !processedResults.length) {
      toast({ title: "Error", description: "Missing required data for TRANS report generation" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgressForIndividual(5, 'Preparing TRANS report data...');

      // Find the selected pupil from processedResults
      const selectedPupilResult = processedResults.find(r => r.pupilInfo.pupilId === selectedPupilForPrint);
      if (!selectedPupilResult) {
        throw new Error('Pupil not found in results');
      }

      // Create single pupil processed result
      const singlePupilResult = {
        ...selectedPupilResult,
        pupilInfo: selectedPupilResult.pupilInfo,
        subjectResults: (selectedPupilResult as any).subjectResults || {}
      };

      const processedResultsForReport = await prepareResultsWithLivePupilData([singlePupilResult], allPupils);

      updateProgressForIndividual(10, 'Preparing all data in parallel...');

      // 🚀 OPTIMIZED: Prepare all data in parallel
      const [academicInfo, nextTermDates, gradingScaleData, majorSubjectsData] = await Promise.all([
        Promise.resolve(getAcademicYearAndTerm(examDetails.academicYearId || '', examDetails.termId || '')),
        Promise.resolve(getNextTermDates(examDetails.academicYearId || '', examDetails.termId || '', academicYears)),
        Promise.resolve(
          examResultData?.gradingScale && Array.isArray(examResultData.gradingScale) && examResultData.gradingScale.length > 0
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
            }))
        ),
        Promise.resolve(
          examResultData?.majorSubjects && examResultData.majorSubjects.length > 0
            ? examResultData.majorSubjects
            : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code))
        )
      ]);

      const { academicYearName, termName } = academicInfo;
      const actualGradingScale = gradingScaleData;
      const majorSubjects = majorSubjectsData;

      updateProgressForIndividual(20, 'Fetching teacher information...');

      // Fetch teachers
      const uniqueTeacherIds = [...new Set(subjectSnaps.map(s => s.teacherId).filter((teacherId): teacherId is string => Boolean(teacherId)))];
      const teachersMap = createStaffNameMap(allStaff, uniqueTeacherIds);

      const enhancedSubjectSnaps = subjectSnaps.map((subject) => {
        const teacherName = subject.teacherId
          ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher')
          : 'Not Assigned';

        return {
          ...subject,
          teacherName,
          fullMarks: 100
        };
      });

      updateProgressForIndividual(50, 'Generating TRANS report PDF...');

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
        processedResults: processedResultsForReport,
        schoolSettings,
        majorSubjects: majorSubjects, // Send major subjects for grade display
        gradingScale: actualGradingScale,
        nextTermInfo: nextTermDates ? {
          startDate: nextTermBeginsDate,
          endDate: nextTermEndsDate
        } : undefined,
        classTeacherInfo: classTeacherInfo,
        promotionRankingConfig: promotionRankingConfig.enabled ? promotionRankingConfig : undefined,
        reportConfig: reportConfig,
        customDates: {
          createdOn: createdOnDate,
          nextTermBegins: nextTermBeginsDate,
          nextTermEnds: nextTermEndsDate,
        },
        onProgress: (progress: number, status: string) => {
          // Map internal progress (0-100) to our progress range (50-95)
          const mappedProgress = 50 + Math.round(progress * 0.45); // 50-95 range
          updateProgressForIndividual(mappedProgress, status);
        }
      };

      const blob = await (selectedFullReportTemplate === 'full2'
        ? generateFullReport2PDF({ ...transBatchData, palette: fullReport2Palette } as Parameters<typeof generateFullReport2PDF>[0])
        : generateTransBatchReportPDF(transBatchData));

      const pupilName = selectedPupilResult.pupilInfo.name || 'Pupil';
      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${pupilName.replace(/\s+/g, '_')}_${selectedFullReportTemplate === 'full2' ? 'Bespoke_Report' : 'TRANS_Report'}.pdf`;
      const title = selectedFullReportTemplate === 'full2' ? 'Individual Pupil Bespoke Report' : 'Individual Pupil TRANS Report';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      updateProgressForIndividual(95, 'Finalizing document...');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({
        title: "Success",
        description: "TRANS report generated successfully!",
        duration: 1500,
      });
    } catch (error) {
      console.error("Error generating individual TRANS report:", error);
      toast({ title: "Error", description: "Failed to generate TRANS report. Please try again." });
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStatus('');
        setGenerationProgress(0);
        setStartTime(null);
        setEta('');
        setShowIndividualPrintModal(false);
        setShowTransTypeModal(false);
        setTransReportType(null);
        setSelectedPupilForPrint(null);
      }, 1000);
    }
  }, [examDetails, classSnap, subjectSnaps, selectedPupilForPrint, processedResults, academicYears, schoolSettings, examResultData, toast, getAcademicYearAndTerm, getNextTermDates, updateProgressForIndividual, pdfViewer, reportConfig, customDates, selectedFullReportTemplate, fullReport2Palette]);

  // Generate individual TRANS report with progress assessment
  const generateIndividualTransReportWithProgress = useCallback(async (comparisonExamIds: string[], customNames: Record<string, string> = {}) => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !selectedPupilForPrint || !processedResults.length) {
      toast({ title: "Error", description: "Missing required data for TRANS progress reports generation" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgressForIndividual(5, 'Preparing data...');

      // Find the selected pupil from processedResults
      const selectedPupilResult = processedResults.find(r => r.pupilInfo.pupilId === selectedPupilForPrint);
      if (!selectedPupilResult) {
        throw new Error('Pupil not found in results');
      }

      updateProgressForIndividual(10, 'Fetching comparison exam data...');

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

      updateProgressForIndividual(20, 'Processing comparison exam results...');

      // Process each comparison exam's results for the selected pupil
      const comparisonExamsProcessed = comparisonExamsData.map(({ exam, examResult }) => {
        const comparisonPupilSnaps = examResult.pupilSnapshots || [];
        const comparisonSubjectSnaps = examResult.subjectSnapshots || [];
        const comparisonResults = examResult.results || {};

        // Get the selected pupil's results from this comparison exam
        const pupilResult = comparisonResults[selectedPupilForPrint] || {};
        const processedSubjectResults: Record<string, any> = {};

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

      updateProgressForIndividual(30, 'Preparing pupil data and fetching teachers...');

      // Create single pupil processed result with comparison data
      const singlePupilResult = {
        ...selectedPupilResult,
        comparisonDataArray: comparisonExamsProcessed.map(({ exam, results, totalMarks, totalAggregates, division, subjectSnaps }) => ({
          exam: {
            name: customNames[exam.id] || exam.name,
            examTypeName: exam.examTypeName || 'Exam',
            startDate: exam.startDate,
            endDate: exam.endDate,
          },
          results,
          totalMarks,
          totalAggregates,
          division,
          subjectSnaps
        }))
      };

      const processedResultsForReport = await prepareResultsWithLivePupilData([singlePupilResult], allPupils);

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
      const teachersMap = createStaffNameMap(allStaff, uniqueTeacherIds);

      // Create enhanced subject snaps with all subjects from all exams
      const allSubjectsMap = new Map<string, any>();
      subjectSnaps.forEach(subject => {
        allSubjectsMap.set(subject.code, {
          ...subject,
          teacherName: subject.teacherId ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher') : 'Not Assigned',
          fullMarks: 100
        });
      });
      comparisonExamsProcessed.forEach(({ subjectSnaps: compSubjectSnaps }) => {
        compSubjectSnaps.forEach((subject: any) => {
          if (!allSubjectsMap.has(subject.code)) {
            allSubjectsMap.set(subject.code, {
              ...subject,
              teacherName: subject.teacherId ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher') : 'Not Assigned',
              fullMarks: 100
            });
          }
        });
      });

      const enhancedSubjectSnaps = Array.from(allSubjectsMap.values());

      updateProgressForIndividual(50, 'Preparing all report data in parallel...');

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
        classTeacherInfo: classTeacherInfo,
        promotionRankingConfig: promotionRankingConfig.enabled ? promotionRankingConfig : undefined,
        reportConfig: reportConfig,
        customDates: {
          createdOn: createdOnDate,
          nextTermBegins: nextTermBeginsDate,
          nextTermEnds: nextTermEndsDate,
        }
      };

      updateProgressForIndividual(70, 'Generating TRANS progress report PDF...');

      const blob = await (selectedFullReportTemplate === 'full2'
        ? generateFullReport2PDF({ ...transBatchData, palette: fullReport2Palette } as Parameters<typeof generateFullReport2PDF>[0])
        : generateTransBatchReportPDF(transBatchData));

      const pupilName = selectedPupilResult.pupilInfo.name || 'Pupil';
      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${pupilName.replace(/\s+/g, '_')}_${selectedFullReportTemplate === 'full2' ? 'Bespoke_Report' : 'TRANS_Progress_Report'}.pdf`;
      const title = selectedFullReportTemplate === 'full2' ? 'Individual Pupil Bespoke Report' : 'Individual Pupil TRANS Progress Report';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      updateProgressForIndividual(95, 'Finalizing document...');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({
        title: "Success",
        description: "TRANS progress report generated successfully!",
        duration: 1500,
      });
    } catch (error) {
      console.error("Error generating individual TRANS progress reports:", error);
      toast({ title: "Error", description: "Failed to generate TRANS progress reports. Please try again." });
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStatus('');
        setGenerationProgress(0);
        setStartTime(null);
        setEta('');
        setShowIndividualPrintModal(false);
        setShowComparisonExamModal(false);
        setSelectedComparisonExams([]);
        setTransReportType(null);
        setSelectedPupilForPrint(null);
      }, 1000);
    }
  }, [examDetails, classSnap, subjectSnaps, selectedPupilForPrint, processedResults, academicYears, schoolSettings, examResultData, toast, getAcademicYearAndTerm, getNextTermDates, updateProgressForIndividual, pdfViewer, reportConfig, customDates, selectedFullReportTemplate, fullReport2Palette]);

  const handleExportCSV = useCallback(() => {
    if (!processedResults.length || !subjectSnaps.length) return;

    // Create CSV content
    let csv = 'Position,Name,Admission No,';

    // Add subject headers
    subjectSnaps.forEach(subject => {
      csv += `${subject.code} Marks,${subject.code} Grade,`;
    });

    csv += 'Total Marks,Aggregates,Division\n';

    // Add data rows
    processedResults.forEach(result => {
      csv += `${result.position},"${result.pupilInfo.name}",${result.pupilInfo.admissionNumber},`;

      subjectSnaps.forEach(subject => {
        const subjectResult = result.results[subject.code] || { marks: 0, grade: '' };
        csv += `${subjectResult.marks},${subjectResult.grade},`;
      });

      csv += `${result.totalMarks},${result.totalAggregates},${result.division}\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${examDetails?.name || 'exam'}_${classSnap?.name || 'class'}_results.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({ title: "Success", description: "Results exported successfully!" });
  }, [processedResults, subjectSnaps, examDetails, classSnap, toast]);

  // Function to calculate ETA
  const calculateETA = useCallback((currentProgress: number, startTime: number) => {
    if (currentProgress <= 0) return 'Calculating...';

    const elapsed = Date.now() - startTime;
    const estimatedTotal = (elapsed / currentProgress) * 100;
    const remaining = estimatedTotal - elapsed;

    if (remaining <= 0) return 'Almost done...';

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s remaining`;
    } else {
      return `${seconds}s remaining`;
    }
  }, []);

  // Function to update progress smoothly
  const updateProgress = useCallback((targetProgress: number, status: string) => {
    setGenerationStatus(status);

    // Smooth progress animation
    const currentProgress = generationProgress;
    const increment = (targetProgress - currentProgress) / 10;
    let current = currentProgress;

    const interval = setInterval(() => {
      current += increment;
      if (current >= targetProgress) {
        setGenerationProgress(targetProgress);
        clearInterval(interval);
      } else {
        setGenerationProgress(Math.floor(current));
      }
    }, 100);
  }, [generationProgress]);

  // Show print options dialog first
  const handleExportAssessment = useCallback(() => {
    console.log('🎯 Assessment Report (Table) clicked - Opening options dialog');
    if (!examDetails || !classSnap || !subjectSnaps.length || !pdfTargetResults.length) {
      toast({ title: "Error", description: pdfTargetResults.length === 0 ? 'No pupils match the current filter / selection — adjust filters before printing.' : 'Missing required data for PDF generation' });
      return;
    }
    setAssessmentReportType('table');
    setShowPrintAssessmentOptionsDialog(true);
  }, [examDetails, classSnap, subjectSnaps, pdfTargetResults, toast]);

  // Actually generate the PDF with the selected options
  const generateAssessmentPDF = useCallback(async (options: {
    showPin: boolean;
    showIndexNumber: boolean;
    showLinNumber: boolean;
    showMarks: boolean;
    showAgg: boolean;
    showTotal: boolean;
    showDiv: boolean;
    orientation: 'landscape' | 'portrait';
    fillMarks: boolean;
    fillAgg: boolean;
    fillTotal: boolean;
    fillDiv: boolean;
    showMajorSubjects: boolean;
    showBestPupil: boolean;
    showNeedsImprovement: boolean;
    showAggregateAnalysis: boolean;
  }) => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !pdfTargetResults.length) {
      toast({ title: "Error", description: pdfTargetResults.length === 0 ? 'No pupils match the current filter / selection — adjust filters before printing.' : 'Missing required data for PDF generation' });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');
    setShowPrintAssessmentOptionsDialog(false);

    try {
      updateProgress(15, 'Preparing assessment data...');

      // Get major subjects from the saved exam result data
      const savedMajorSubjects = examResultData?.majorSubjects || [];
      const majorSubjects = savedMajorSubjects.length > 0
        ? savedMajorSubjects
        : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));

      // Nursery assessments use commentary instead of a marks-based grading scale.
      const gradingScale = isNurseryExam
        ? []
        : examResultData?.gradingScale && Array.isArray(examResultData.gradingScale) && examResultData.gradingScale.length > 0
          ? examResultData.gradingScale.map(item => ({
              minMark: item.minMark,
              maxMark: item.maxMark || (item.minMark === 0 ? 29 : item.minMark - 1),
              grade: item.grade,
              aggregates: item.aggregates || 9,
            }))
          : DEFAULT_GRADING_SCALE.map(item => ({
              minMark: item.minMark,
              maxMark: item.maxMark,
              grade: item.grade,
              aggregates: item.aggregates || 9,
            }));

      updateProgress(35, 'Processing exam results...');

      const adaptedData = adaptExamDataForPDF(examDetails, classSnap, subjectSnaps, pdfTargetResults, majorSubjects);

      updateProgress(65, 'Generating PDF document...');

      // Generate a commentary table for nursery and keep the existing marks table for other classes.
      const blob = isNurseryExam
        ? generateNurseryAssessmentPDF({
            examDetails,
            classSnap,
            subjectSnaps,
            processedResults: pdfTargetResults,
            schoolSettings,
            printOptions: options,
          })
        : await generateExamPDF({
            ...adaptedData,
            schoolSettings,
            printOptions: options,
            gradingScale,
          });

      // Open in PDF viewer
      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${isNurseryExam ? 'nursery_assessment' : 'results'}.pdf`;
      const title = isNurseryExam ? 'Nursery Assessment Report' : 'Exam Results';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      updateProgress(95, 'Finalizing document...');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({ title: "Success", description: "Assessment PDF is ready for viewing!" });
    } catch (error) {
      console.error("Error generating assessment PDF:", error);
      toast({ title: "Error", description: "Failed to generate assessment PDF. Please try again." });
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
  }, [examDetails, classSnap, subjectSnaps, processedResults, schoolSettings, examResultData, toast, updateProgress, pdfViewer, isNurseryExam]);

  const handleReportOne = useCallback(async () => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !pdfTargetResults.length) {
      toast({ title: "Error", description: pdfTargetResults.length === 0 ? 'No pupils match the current filter / selection — please adjust filters before printing.' : 'Missing required data for batch reports generation' });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgress(5, 'Preparing all data in parallel...');

      // 🚀 OPTIMIZED: Prepare all synchronous data in parallel
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

      updateProgress(10, 'Fetching pupil photos and data...');

      // 🚀 OPTIMIZED: Batch fetch all pupils in one request instead of individual calls
      const resultsToProcess = pdfTargetResults; // respects page filters and manual selection
      const prepareProcessedResults = async () => {
        console.log(`🚀 OPTIMIZED: Processing ${resultsToProcess.length} pupils with batch fetching`);
        const startTime = performance.now();

        // First, identify which pupils need photos fetched (don't have real photos in snapshot)
        const pupilsNeedingPhotos: string[] = resultsToProcess.map((result) => result.pupilInfo.pupilId);
        const pupilsWithPhotos = new Map<string, string>();

        resultsToProcess.forEach((result) => {
          const pupilPhoto = (result.pupilInfo as any).photo;
          if (isRealPhoto(pupilPhoto)) {
            // Photo already in snapshot, use it
            pupilsWithPhotos.set(result.pupilInfo.pupilId, pupilPhoto);
          }
        });

        console.log(`📊 OPTIMIZED: ${pupilsWithPhotos.size} pupils have photos in snapshot, ${pupilsNeedingPhotos.length} need fetching`);

        // Batch fetch all missing photos - check allPupils cache first
        let fetchedPupilsMap: Record<string, any> = {};
        const missingFromCache: string[] = [];
        pupilsNeedingPhotos.forEach((id) => {
          const cached = allPupils.find((p) => p.id === id);
          if (cached) {
            fetchedPupilsMap[id] = cached;
          } else {
            missingFromCache.push(id);
          }
        });

        if (missingFromCache.length > 0) {
          try {
            const batchResponse = await fetch('/api/pupils/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ pupilIds: [...new Set(missingFromCache)] }),
            });

            if (batchResponse.ok) {
              const apiFetched = await batchResponse.json();
              fetchedPupilsMap = { ...fetchedPupilsMap, ...apiFetched };
              console.log(`✅ OPTIMIZED: Batch fetched ${Object.keys(apiFetched).length} pupils in one request`);
            } else {
              console.warn('⚠️ OPTIMIZED: Batch fetch failed, continuing without photos');
            }
          } catch (error) {
            console.warn('⚠️ OPTIMIZED: Batch fetch error (non-critical):', error);
          }
        }

        const duration = performance.now() - startTime;
        console.log(`⚡ OPTIMIZED: Photo processing completed in ${duration.toFixed(2)}ms`);

        // Map the fetched photos back to results
        return resultsToProcess.map((result) => {
          const pupilId = result.pupilInfo.pupilId;
          let pupilPhoto: string | null = null;

          // First check if we already have photo from snapshot
          if (pupilsWithPhotos.has(pupilId)) {
            pupilPhoto = pupilsWithPhotos.get(pupilId)!;
          }
          // Otherwise check batch fetched data
          else if (fetchedPupilsMap[pupilId]) {
            const fetchedPupil = fetchedPupilsMap[pupilId];
            pupilPhoto = fetchedPupil.photo || fetchedPupil.photoUrl || null;
            if (!isRealPhoto(pupilPhoto)) {
              pupilPhoto = null;
            }
          }

          return {
            ...result,
            pupilInfo: {
              ...result.pupilInfo,
              age: result.pupilInfo.ageAtExam || 12,
              photo: pupilPhoto,
              dateOfBirth: result.pupilInfo.dateOfBirth || undefined,
              schoolPayCode: getSchoolPayCode(fetchedPupilsMap[pupilId]) || result.pupilInfo.schoolPayCode || ''
            }
          };
        });
      };

      const enhancedProcessedResults = await prepareProcessedResults();

      updateProgress(50, 'Fetching teacher information...');

      // 🚀 OPTIMIZED: Look up teachers from allStaff cache first
      const uniqueTeacherIds = [...new Set(subjectSnaps.map(s => s.teacherId).filter(Boolean))];
      const teachersMap = createStaffNameMap(allStaff, uniqueTeacherIds);

      // Map teachers to subjects
      const enhancedSubjectSnaps = subjectSnaps.map((subject) => {
        const teacherName = subject.teacherId
          ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher')
          : 'Not Assigned';

        return {
          ...subject,
          teacherName,
          fullMarks: 100
        };
      });

      updateProgress(70, 'Preparing grading scale...');

      // Use the actual exam grading scale or fall back to default
      const actualGradingScale = examResultData?.gradingScale && Array.isArray(examResultData.gradingScale) && examResultData.gradingScale.length > 0
        ? examResultData.gradingScale.map(item => ({
          minMark: item.minMark,
          maxMark: item.maxMark || (item.minMark === 0 ? 29 : item.minMark - 1), // Calculate maxMark if missing
          grade: item.grade,
          aggregates: item.aggregates || 9
        }))
        : DEFAULT_GRADING_SCALE.map(item => ({
          minMark: item.minMark,
          maxMark: item.maxMark,
          grade: item.grade,
          aggregates: item.aggregates || 9
        }));

      console.log('📊 Using grading scale:', actualGradingScale);

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
        processedResults: enhancedProcessedResults,
        schoolSettings,
        majorSubjects: majorSubjects, // Send major subjects for grade display
        gradingScale: actualGradingScale,
        nextTermInfo: nextTermDates ? {
          startDate: nextTermDates.nextTermBegins,
          endDate: nextTermDates.nextTermEnds
        } : undefined,
        classTeacherInfo: classTeacherInfo,
        promotionRankingConfig: promotionRankingConfig.enabled ? promotionRankingConfig : undefined
      };

      updateProgress(85, 'Generating modern batch report PDF...');

      // Generate the modern batch report PDF with progress tracking
      const blob = await generateModernBatchReportPDF({
        ...modernBatchData,
        onProgress: (progress, status) => {
          // Map internal progress (0-100) to our progress range (85-95)
          const mappedProgress = 85 + Math.round(progress * 0.1); // 85-95 range
          updateProgress(mappedProgress, status);
        }
      });

      // Open in PDF viewer
      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_Modern_Batch_Reports.pdf`;
      const title = 'Modern Batch Reports';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      updateProgress(95, 'Finalizing document...');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({
        title: "Success",
        description: `Generated modern batch reports for ${processedResults.length} pupils successfully!`
      });
    } catch (error) {
      console.error("Error generating modern batch reports:", error);
      toast({ title: "Error", description: "Failed to generate modern batch reports. Please try again." });
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
  }, [examDetails, classSnap, subjectSnaps, processedResults, schoolSettings, examResultData, academicYears, toast, getAcademicYearAndTerm, getNextTermDates, updateProgress]);

  const handleTransReport = useCallback(() => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !processedResults.length) {
      toast({ title: "Error", description: "Missing required data for TRANS batch reports generation" });
      return;
    }
    setSelectedFullReportTemplate('standard');
    // Show type selection modal first
    setShowTransTypeModal(true);
  }, [examDetails, classSnap, subjectSnaps, processedResults, toast]);

  const handleFullReport2 = useCallback(() => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !processedResults.length) {
      toast({ title: 'Error', description: 'Missing required data for Bespoke Report generation' });
      return;
    }
    setSelectedFullReportTemplate('full2');
    setShowTransTypeModal(true);
  }, [examDetails, classSnap, subjectSnaps, processedResults, toast]);

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
      console.warn('loadComparisonExams: No classId available from any source', {
        classIdFromURL: classId,
        classIdFromExam: examDetails.classId,
        classIdFromResult: examResultData?.classId
      });
      toast({ title: "Error", description: "Unable to determine class for comparison exams" });
      return;
    }

    setIsLoadingComparisonExams(true);
    try {
      console.log('🔍 Loading comparison exams:', {
        classIdFromURL: classId,
        classIdFromExam: examDetails.classId,
        classIdFromResult: examResultData?.classId,
        effectiveClassId,
        examId,
        academicYearId: examDetails.academicYearId,
        termId: examDetails.termId,
        totalExamsLoaded: exams.length
      });

      // Always fetch from API to ensure we get all exams (not just cached ones)
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

      // Log all exams for debugging
      console.log('📋 All exams found:', allExams.map(e => ({
        id: e.id,
        name: e.name,
        classId: e.classId,
        academicYearId: e.academicYearId,
        termId: e.termId
      })));

      // Filter exams: same class, same academic year, same term, but different exam
      const filteredExams = allExams.filter(exam => {
        const matchesClass = exam.classId === effectiveClassId;
        const matchesYear = exam.academicYearId === examDetails.academicYearId;
        const matchesTerm = exam.termId === examDetails.termId;
        const isNotCurrent = exam.id !== examId;

        const shouldInclude = matchesClass && matchesYear && matchesTerm && isNotCurrent;

        // Always log exclusion reasons for debugging
        if (!shouldInclude) {
          console.log(`❌ Excluding exam "${exam.name}" (${exam.id}):`, {
            matchesClass: matchesClass ? '✅' : `❌ (exam: ${exam.classId}, required: ${effectiveClassId})`,
            matchesYear: matchesYear ? '✅' : `❌ (exam: ${exam.academicYearId}, required: ${examDetails.academicYearId})`,
            matchesTerm: matchesTerm ? '✅' : `❌ (exam: ${exam.termId}, required: ${examDetails.termId})`,
            isNotCurrent: isNotCurrent ? '✅' : '❌ (is current exam)'
          });
        }

        return shouldInclude;
      });

      console.log(`✅ Filtered to ${filteredExams.length} comparison exams:`, filteredExams.map(e => e.name));
      setAvailableComparisonExams(filteredExams);

      if (filteredExams.length === 0) {
        console.warn('⚠️ No comparison exams found after filtering. Summary:', {
          totalExamsForClass: allExams.length,
          currentExamId: examId,
          requiredAcademicYear: examDetails.academicYearId,
          requiredTerm: examDetails.termId,
          requiredClass: effectiveClassId
        });
      }
    } catch (error) {
      console.error('❌ Error loading comparison exams:', error);
      toast({ title: "Error", description: "Failed to load comparison exams. Check console for details." });
    } finally {
      setIsLoadingComparisonExams(false);
    }
  }, [examDetails, classId, examId, exams, examResultData, toast]);

  // Generate TRANS report with grading scale
  const generateTransReportWithGrading = useCallback(async () => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !processedResults.length) {
      toast({ title: "Error", description: "Missing required data for TRANS batch reports generation" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgress(5, 'Preparing all data in parallel...');

      // 🚀 OPTIMIZED: Prepare all synchronous data in parallel
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

      updateProgress(10, 'Fetching pupil photos and data...');

      // 🚀 OPTIMIZED: Batch fetch all pupils in one request instead of individual calls
      const resultsToProcess = pdfTargetResults; // respects page filters and manual selection
      const prepareProcessedResults = async () => {
        console.log(`🚀 OPTIMIZED: Processing ${resultsToProcess.length} pupils with batch fetching`);
        const startTime = performance.now();

        // First, identify which pupils need photos fetched (don't have real photos in snapshot)
        const pupilsNeedingPhotos: string[] = resultsToProcess.map((result) => result.pupilInfo.pupilId);
        const pupilsWithPhotos = new Map<string, string>();

        resultsToProcess.forEach((result) => {
          const pupilPhoto = (result.pupilInfo as any).photo;
          if (isRealPhoto(pupilPhoto)) {
            // Photo already in snapshot, use it
            pupilsWithPhotos.set(result.pupilInfo.pupilId, pupilPhoto);
          }
        });

        console.log(`📊 OPTIMIZED: ${pupilsWithPhotos.size} pupils have photos in snapshot, ${pupilsNeedingPhotos.length} need fetching`);

        // Batch fetch all missing photos - check allPupils cache first
        let fetchedPupilsMap: Record<string, any> = {};
        const missingFromCache: string[] = [];
        pupilsNeedingPhotos.forEach((id) => {
          const cached = allPupils.find((p) => p.id === id);
          if (cached) {
            fetchedPupilsMap[id] = cached;
          } else {
            missingFromCache.push(id);
          }
        });

        if (missingFromCache.length > 0) {
          try {
            const batchResponse = await fetch('/api/pupils/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ pupilIds: [...new Set(missingFromCache)] }),
            });

            if (batchResponse.ok) {
              const apiFetched = await batchResponse.json();
              fetchedPupilsMap = { ...fetchedPupilsMap, ...apiFetched };
              console.log(`✅ OPTIMIZED: Batch fetched ${Object.keys(apiFetched).length} pupils in one request`);
            } else {
              console.warn('⚠️ OPTIMIZED: Batch fetch failed, continuing without photos');
            }
          } catch (error) {
            console.warn('⚠️ OPTIMIZED: Batch fetch error (non-critical):', error);
          }
        }

        const duration = performance.now() - startTime;
        console.log(`⚡ OPTIMIZED: Photo processing completed in ${duration.toFixed(2)}ms`);

        // Map the fetched photos back to results
        return resultsToProcess.map((result) => {
          const pupilId = result.pupilInfo.pupilId;
          let pupilPhoto: string | null = null;

          // First check if we already have photo from snapshot
          if (pupilsWithPhotos.has(pupilId)) {
            pupilPhoto = pupilsWithPhotos.get(pupilId)!;
          }
          // Otherwise check batch fetched data
          else if (fetchedPupilsMap[pupilId]) {
            const fetchedPupil = fetchedPupilsMap[pupilId];
            pupilPhoto = fetchedPupil.photo || fetchedPupil.photoUrl || null;
            if (!isRealPhoto(pupilPhoto)) {
              pupilPhoto = null;
            }
          }

          return {
            ...result,
            pupilInfo: {
              ...result.pupilInfo,
              age: result.pupilInfo.ageAtExam || 12,
              photo: pupilPhoto,
              dateOfBirth: result.pupilInfo.dateOfBirth || undefined,
              schoolPayCode: getSchoolPayCode(fetchedPupilsMap[pupilId]) || result.pupilInfo.schoolPayCode || ''
            }
          };
        });
      };

      const enhancedProcessedResults = await prepareProcessedResults();

      updateProgress(50, 'Fetching teacher information...');

      // 🚀 OPTIMIZED: Look up teachers from allStaff cache first
      const uniqueTeacherIds = [...new Set(subjectSnaps.map(s => s.teacherId).filter(Boolean))];
      const teachersMap = createStaffNameMap(allStaff, uniqueTeacherIds);

      // Map teachers to subjects
      const enhancedSubjectSnaps = subjectSnaps.map((subject) => {
        const teacherName = subject.teacherId
          ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher')
          : 'Not Assigned';

        return {
          ...subject,
          teacherName,
          fullMarks: 100
        };
      });

      updateProgress(70, 'Preparing grading scale...');

      // Use the actual exam grading scale or fall back to default
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

      console.log('📊 Using grading scale:', actualGradingScale);

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
        processedResults: enhancedProcessedResults,
        schoolSettings,
        majorSubjects: majorSubjects, // Send major subjects for grade display
        gradingScale: actualGradingScale,
        nextTermInfo: nextTermDates ? {
          startDate: nextTermBeginsDate,
          endDate: nextTermEndsDate
        } : undefined,
        classTeacherInfo: classTeacherInfo,
        promotionRankingConfig: promotionRankingConfig.enabled ? promotionRankingConfig : undefined,
        reportConfig: reportConfig,
        customDates: {
          createdOn: createdOnDate,
          nextTermBegins: nextTermBeginsDate,
          nextTermEnds: nextTermEndsDate,
        }
      };

      updateProgress(85, 'Generating TRANS batch report PDF...');

      // Generate the TRANS batch report PDF with progress tracking
      const reportDataWithProgress = {
        ...transBatchData,
        onProgress: (progress: number, status: string) => {
          // Map internal progress (0-100) to our progress range (85-95)
          const mappedProgress = 85 + Math.round(progress * 0.1); // 85-95 range
          updateProgress(mappedProgress, status);
        }
      };
      const blob = await (selectedFullReportTemplate === 'full2'
        ? generateFullReport2PDF({ ...reportDataWithProgress, palette: fullReport2Palette } as Parameters<typeof generateFullReport2PDF>[0])
        : generateTransBatchReportPDF(reportDataWithProgress as Parameters<typeof generateTransBatchReportPDF>[0]));

      // Open in PDF viewer
      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${selectedFullReportTemplate === 'full2' ? 'Bespoke_Report' : 'TRANS_Batch_Reports'}.pdf`;
      const title = selectedFullReportTemplate === 'full2' ? 'Bespoke Report' : 'TRANS Batch Reports';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      updateProgress(95, 'Finalizing document...');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({
        title: "Success",
        description: `Generated TRANS batch reports for ${processedResults.length} pupils successfully!`
      });
    } catch (error) {
      console.error("Error generating TRANS batch reports:", error);
      toast({ title: "Error", description: "Failed to generate TRANS batch reports. Please try again." });
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
  }, [examDetails, classSnap, subjectSnaps, processedResults, schoolSettings, examResultData, academicYears, toast, getAcademicYearAndTerm, getNextTermDates, updateProgress, selectedFullReportTemplate, fullReport2Palette]);

  // Handle report configuration completion (defined after loadComparisonExams and generateTransReportWithGrading)
  const handleReportConfigComplete = useCallback(() => {
    setShowReportConfigModal(false);

    if (transReportType === 'progress') {
      // Show comparison exam selection modal
      loadComparisonExams();
      setShowComparisonExamModal(true);
    } else {
      // Generate with grading scale
      if (selectedPupilForPrint) {
        generateIndividualTransReportWithGrading();
      } else {
        generateTransReportWithGrading();
      }
    }
  }, [transReportType, loadComparisonExams, generateTransReportWithGrading, selectedPupilForPrint, generateIndividualTransReportWithGrading]);

  // Generate TRANS report with progress assessment
  const generateTransReportWithProgress = useCallback(async (comparisonExamIds: string[], customNames: Record<string, string> = {}) => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !processedResults.length) {
      toast({ title: "Error", description: "Missing required data for TRANS progress reports generation" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgress(5, 'Fetching comparison exam data...');

      // 🚀 OPTIMIZED: Fetch all comparison exams and their results in parallel (both calls per exam in parallel)
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

      // Process each comparison exam's results
      const comparisonExamsProcessed = comparisonExamsData.map(({ exam, examResult }) => {
        const comparisonPupilSnaps = examResult.pupilSnapshots || [];
        const comparisonSubjectSnaps = examResult.subjectSnapshots || [];
        const comparisonResults = examResult.results || {};

        // Create a map of pupil results from this comparison exam
        const comparisonPupilResultsMap = new Map<string, any>();

        comparisonPupilSnaps.forEach((pupil: any) => {
          const pupilResults = comparisonResults[pupil.pupilId] || {};
          const processedSubjectResults: Record<string, any> = {};

          comparisonSubjectSnaps.forEach((subject: any) => {
            const result = pupilResults[subject.subjectId];
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

          const division = pupilResults.division || calculateDivision(totalAggregates);

          comparisonPupilResultsMap.set(pupil.pupilId, {
            pupilInfo: pupil,
            results: processedSubjectResults,
            totalMarks,
            totalAggregates,
            division,
            subjects: comparisonSubjectSnaps
          });
        });

        return {
          exam,
          examResult,
          pupilResultsMap: comparisonPupilResultsMap,
          subjectSnaps: comparisonSubjectSnaps
        };
      });

      updateProgress(30, 'Fetching pupil photos and data...');

      // Prepare processed results with comparison data from all selected exams
      const resultsToProcess = pdfTargetResults; // respects page filters and manual selection
      const prepareProcessedResultsWithProgress = async () => {
        const pupilsNeedingPhotos: string[] = resultsToProcess.map((result) => result.pupilInfo.pupilId);
        const pupilsWithPhotos = new Map<string, string>();

        resultsToProcess.forEach((result) => {
          const pupilPhoto = (result.pupilInfo as any).photo;
          if (isRealPhoto(pupilPhoto)) {
            pupilsWithPhotos.set(result.pupilInfo.pupilId, pupilPhoto);
          }
        });

        let fetchedPupilsMap: Record<string, any> = {};
        if (pupilsNeedingPhotos.length > 0) {
          try {
            const batchResponse = await fetch('/api/pupils/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pupilIds: [...new Set(pupilsNeedingPhotos)] }),
            });

            if (batchResponse.ok) {
              fetchedPupilsMap = await batchResponse.json();
            }
          } catch (error) {
            console.warn('Batch fetch error:', error);
          }
        }

        return resultsToProcess.map((result) => {
          const pupilId = result.pupilInfo.pupilId;
          let pupilPhoto: string | null = null;

          if (pupilsWithPhotos.has(pupilId)) {
            pupilPhoto = pupilsWithPhotos.get(pupilId)!;
          } else if (fetchedPupilsMap[pupilId]) {
            const fetchedPupil = fetchedPupilsMap[pupilId];
            pupilPhoto = fetchedPupil.photo || fetchedPupil.photoUrl || null;
            if (!isRealPhoto(pupilPhoto)) {
              pupilPhoto = null;
            }
          }

          // Get comparison exam results for this pupil from all selected comparison exams
          const comparisonDataArray = comparisonExamsProcessed.map(({ pupilResultsMap, exam, subjectSnaps: compSubjectSnaps }) => {
            const pupilData = pupilResultsMap.get(pupilId);
            return pupilData ? {
              exam: {
                name: exam.name,
                examTypeName: exam.examTypeName || 'Exam',
                startDate: exam.startDate,
                endDate: exam.endDate,
              },
              results: pupilData.results,
              totalMarks: pupilData.totalMarks,
              totalAggregates: pupilData.totalAggregates,
              division: pupilData.division,
              subjects: compSubjectSnaps
            } : null;
          }).filter(Boolean);

          return {
            ...result,
            pupilInfo: {
              ...result.pupilInfo,
              age: result.pupilInfo.ageAtExam || 12,
              photo: pupilPhoto,
              dateOfBirth: result.pupilInfo.dateOfBirth || undefined,
              schoolPayCode: getSchoolPayCode(fetchedPupilsMap[pupilId]) || result.pupilInfo.schoolPayCode || ''
            },
            comparisonDataArray: comparisonDataArray // Array of comparison exam data (up to 2)
          };
        });
      };

      const enhancedProcessedResults = await prepareProcessedResultsWithProgress();

      updateProgress(50, 'Fetching teacher information...');

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
      const teachersMap = createStaffNameMap(allStaff, uniqueTeacherIds);

      // Create enhanced subject snaps with all subjects from all exams
      const allSubjectsMap = new Map<string, any>();
      subjectSnaps.forEach(subject => {
        allSubjectsMap.set(subject.code, {
          ...subject,
          teacherName: subject.teacherId ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher') : 'Not Assigned',
          fullMarks: 100
        });
      });
      comparisonExamsProcessed.forEach(({ subjectSnaps: compSubjectSnaps }) => {
        compSubjectSnaps.forEach((subject: any) => {
          if (!allSubjectsMap.has(subject.code)) {
            allSubjectsMap.set(subject.code, {
              ...subject,
              teacherName: subject.teacherId ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher') : 'Not Assigned',
              fullMarks: 100
            });
          }
        });
      });

      const enhancedSubjectSnaps = Array.from(allSubjectsMap.values());

      updateProgress(70, 'Preparing progress data...');

      const { academicYearName, termName } = getAcademicYearAndTerm(
        examDetails.academicYearId || '',
        examDetails.termId || ''
      );

      const nextTermDates = getNextTermDates(
        examDetails.academicYearId || '',
        examDetails.termId || '',
        academicYears
      );

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

      const savedMajorSubjects = examResultData?.majorSubjects || [];
      const majorSubjects = savedMajorSubjects.length > 0
        ? savedMajorSubjects
        : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));

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
          name: customNames[exam.id] || exam.name, // Use custom name if provided
          examTypeName: exam.examTypeName || 'Exam',
          startDate: exam.startDate,
          endDate: exam.endDate,
        })),
        classSnap,
        subjectSnaps: enhancedSubjectSnaps,
        processedResults: enhancedProcessedResults,
        schoolSettings,
        majorSubjects: majorSubjects, // Send major subjects for grade display
        gradingScale: undefined, // No grading scale for progress reports
        isProgressReport: true,
        nextTermInfo: nextTermDates ? {
          startDate: nextTermBeginsDate,
          endDate: nextTermEndsDate
        } : undefined,
        classTeacherInfo: classTeacherInfo,
        promotionRankingConfig: promotionRankingConfig.enabled ? promotionRankingConfig : undefined,
        reportConfig: reportConfig,
        customDates: {
          createdOn: createdOnDate,
          nextTermBegins: nextTermBeginsDate,
          nextTermEnds: nextTermEndsDate,
        }
      };

      updateProgress(85, 'Generating TRANS progress report PDF...');

      // Generate the TRANS progress batch report PDF with progress tracking
      const reportDataWithProgress = {
        ...transBatchData,
        onProgress: (progress: number, status: string) => {
          // Map internal progress (0-100) to our progress range (85-95)
          const mappedProgress = 85 + Math.round(progress * 0.1); // 85-95 range
          updateProgress(mappedProgress, status);
        }
      };
      const blob = await (selectedFullReportTemplate === 'full2'
        ? generateFullReport2PDF({ ...reportDataWithProgress, palette: fullReport2Palette } as Parameters<typeof generateFullReport2PDF>[0])
        : generateTransBatchReportPDF(reportDataWithProgress as Parameters<typeof generateTransBatchReportPDF>[0]));

      // Open in PDF viewer
      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${selectedFullReportTemplate === 'full2' ? 'Bespoke_Report' : 'TRANS_Progress_Reports'}.pdf`;
      const title = selectedFullReportTemplate === 'full2' ? 'Bespoke Report' : 'TRANS Progress Reports';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      updateProgress(95, 'Finalizing document...');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({
        title: "Success",
        description: `Generated TRANS progress reports for ${processedResults.length} pupils successfully!`
      });
    } catch (error) {
      console.error("Error generating TRANS progress reports:", error);
      toast({ title: "Error", description: "Failed to generate TRANS progress reports. Please try again." });
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
        setTransReportType(null);
      }, 1000);
    }
  }, [examDetails, classSnap, subjectSnaps, processedResults, schoolSettings, examResultData, academicYears, toast, getAcademicYearAndTerm, getNextTermDates, updateProgress, selectedFullReportTemplate, fullReport2Palette]);

  const generateDetailedAssessmentReport = useCallback(async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgress(20, 'Preparing detailed assessment data...');

      // 🚀 OPTIMIZED: Batch fetch all pupils in one request instead of individual calls
      const resultsToProcess = pdfTargetResults; // respects page filters and manual selection
      const prepareProcessedResults = async () => {
        console.log(`🚀 OPTIMIZED: Processing ${resultsToProcess.length} pupils with batch fetching`);
        const startTime = performance.now();

        // First, identify which pupils need photos fetched (don't have real photos in snapshot)
        const pupilsNeedingPhotos: string[] = resultsToProcess.map((result) => result.pupilInfo.pupilId);
        const pupilsWithPhotos = new Map<string, string>();

        resultsToProcess.forEach((result) => {
          const pupilPhoto = (result.pupilInfo as any).photo;
          if (isRealPhoto(pupilPhoto)) {
            // Photo already in snapshot, use it
            pupilsWithPhotos.set(result.pupilInfo.pupilId, pupilPhoto);
          }
        });

        console.log(`📊 OPTIMIZED: ${pupilsWithPhotos.size} pupils have photos in snapshot, ${pupilsNeedingPhotos.length} need fetching`);

        // Batch fetch all missing photos in ONE request
        let fetchedPupilsMap: Record<string, any> = {};
        if (pupilsNeedingPhotos.length > 0) {
          try {
            const batchResponse = await fetch('/api/pupils/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ pupilIds: [...new Set(pupilsNeedingPhotos)] }),
            });

            if (batchResponse.ok) {
              fetchedPupilsMap = await batchResponse.json();
              console.log(`✅ OPTIMIZED: Batch fetched ${Object.keys(fetchedPupilsMap).length} pupils in one request`);
            } else {
              console.warn('⚠️ OPTIMIZED: Batch fetch failed, continuing without photos');
            }
          } catch (error) {
            console.warn('⚠️ OPTIMIZED: Batch fetch error (non-critical):', error);
          }
        }

        const duration = performance.now() - startTime;
        console.log(`⚡ OPTIMIZED: Photo processing completed in ${duration.toFixed(2)}ms`);

        // Map the fetched photos back to results
        return resultsToProcess.map((result) => {
          const pupilId = result.pupilInfo.pupilId;
          let pupilPhoto: string | null = null;

          // First check if we already have photo from snapshot
          if (pupilsWithPhotos.has(pupilId)) {
            pupilPhoto = pupilsWithPhotos.get(pupilId)!;
          }
          // Otherwise check batch fetched data
          else if (fetchedPupilsMap[pupilId]) {
            const fetchedPupil = fetchedPupilsMap[pupilId];
            pupilPhoto = fetchedPupil.photo || fetchedPupil.photoUrl || null;
            if (!isRealPhoto(pupilPhoto)) {
              pupilPhoto = null;
            }
          }

          return {
            ...result,
            pupilInfo: {
              ...result.pupilInfo,
              age: result.pupilInfo.ageAtExam || 12,
              photo: pupilPhoto,
              dateOfBirth: result.pupilInfo.dateOfBirth || undefined,
              schoolPayCode: getSchoolPayCode(fetchedPupilsMap[pupilId]) || result.pupilInfo.schoolPayCode || ''
            }
          };
        });
      };

      const enhancedProcessedResults = await prepareProcessedResults();

      updateProgress(50, 'Processing pupil information...');

      // 🚀 OPTIMIZED: Look up teachers from allStaff cache first
      const uniqueTeacherIds = [...new Set(subjectSnaps.map(s => s.teacherId).filter(Boolean))];
      const teachersMap = createStaffNameMap(allStaff, uniqueTeacherIds);

      // Map teachers to subjects
      const enhancedSubjectSnaps = subjectSnaps.map((subject) => {
        const teacherName = subject.teacherId
          ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher')
          : 'Not Assigned';

        return {
          ...subject,
          teacherName,
          fullMarks: 100
        };
      });

      updateProgress(70, 'Designing professional primary mini reports...');

      // Get academic year and term names like Modern Report does
      const { academicYearName, termName } = getAcademicYearAndTerm(
        examDetails?.academicYearId || '',
        examDetails?.termId || ''
      );

      const blob = await generatePrimaryMiniReportPDF({
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
        processedResults: enhancedProcessedResults,
        schoolSettings,
        majorSubjects: examResultData?.majorSubjects,
        backgroundImage: '/images/Primary%20Mini%20BG.png',
        onProgress: (completed, total) => {
          const reportProgress = 70 + Math.round((completed / Math.max(total, 1)) * 23);
          updateProgress(reportProgress, `Generating primary mini reports (${completed}/${total})...`);
        },
      });

      // Open in PDF viewer
      updateProgress(95, 'Finalizing primary mini reports...');
      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_primary_mini_reports.pdf`;
      const title = 'Primary Mini Reports';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      setGenerationProgress(100);
      setEta('Complete!');

      toast({ title: "Success", description: "Primary Mini Reports are ready for viewing!" });
    } catch (error) {
      console.error("Error generating primary mini reports:", error);
      toast({ title: "Error", description: "Failed to generate primary mini reports. Please try again." });
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
  }, [allStaff, examDetails, classSnap, subjectSnaps, processedResults, schoolSettings, examResultData, academicYears, toast, getAcademicYearAndTerm, updateProgress, pdfViewer]);

  const generateNurseryMiniReport = useCallback(async () => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !pdfTargetResults.length) {
      toast({ title: 'Error', description: pdfTargetResults.length === 0 ? 'No pupils match the current filter — adjust filters before printing.' : 'Missing required nursery report data.' });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgress(20, 'Preparing nursery pupil information...');
      const enhancedResults = await prepareResultsWithLivePupilData(pdfTargetResults, allPupils);

      const teacherInitials = (teacherName: string): string => teacherName
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part[0]?.toUpperCase() || '')
        .slice(0, 3)
        .join('');

      const enhancedSubjects = subjectSnaps.map(subject => {
        const assignedTeacher = subject.teacherId
          ? allStaff.find(staff => staff.id === subject.teacherId)
          : undefined;
        const teacherName = assignedTeacher
          ? `${assignedTeacher.firstName || ''} ${assignedTeacher.lastName || ''}`.trim()
          : subject.teacherName || '';

        return {
          ...subject,
          teacherInitials: teacherInitials(teacherName),
        };
      });

      const { academicYearName, termName } = getAcademicYearAndTerm(
        examDetails.academicYearId || '',
        examDetails.termId || ''
      );

      updateProgress(65, 'Designing playful nursery mini reports...');
      const blob = await generateNurseryMiniReportPDF({
        examDetails: {
          name: examDetails.name,
          startDate: examDetails.startDate,
          academicYearName,
          termName,
        },
        classSnap,
        subjectSnaps: enhancedSubjects,
        processedResults: enhancedResults,
        schoolSettings,
        backgroundImage: '/images/Nursery%20Background.png',
        includeTeacherComment: !omitNurseryTeacherComment,
        onProgress: (completed, total) => {
          const reportProgress = 65 + Math.round((completed / Math.max(total, 1)) * 28);
          updateProgress(reportProgress, `Generating nursery reports (${completed}/${total})...`);
        },
      });

      updateProgress(95, 'Finalizing nursery mini reports...');
      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_nursery_mini_reports.pdf`;
      pdfViewer.openPDFFromBlob(blob, fileName, 'Nursery Mini Reports');
      setGenerationProgress(100);
      setEta('Complete!');
      toast({ title: 'Success', description: 'Nursery mini reports are ready for viewing.' });
    } catch (error) {
      console.error('Error generating nursery mini reports:', error);
      toast({ title: 'Error', description: 'Failed to generate nursery mini reports. Please try again.' });
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
  }, [allPupils, allStaff, classSnap, examDetails, getAcademicYearAndTerm, omitNurseryTeacherComment, pdfViewer, processedResults, schoolSettings, subjectSnaps, toast, updateProgress]);

  const handleNurseryReport = useCallback(() => {
    console.log('📊 Mini Report clicked - Generating directly without options dialog');
    if (!examDetails || !classSnap || !subjectSnaps.length || !processedResults.length) {
      toast({ title: "Error", description: "Missing required data for report generation" });
      return;
    }
    if (isNurseryExam) {
      generateNurseryMiniReport();
      return;
    }
    generateDetailedAssessmentReport();
  }, [examDetails, classSnap, subjectSnaps, processedResults, toast, isNurseryExam, generateNurseryMiniReport, generateDetailedAssessmentReport]);

  // Effect to update ETA in real-time
  useEffect(() => {
    if (isGenerating && startTime && generationProgress > 0) {
      const interval = setInterval(() => {
        setEta(calculateETA(generationProgress, startTime));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isGenerating, startTime, generationProgress, calculateETA]);

  // Progressive exam handler functions
  const handleSelectProgressiveExam = useCallback((examId: string) => {
    setSelectedProgressiveExam(examId);
  }, []);

  const handleConfirmProgressiveExam = useCallback(() => {
    setShowProgressiveExamModal(false);
    generatePupilReports(selectedProgressiveExam === 'none' ? null : selectedProgressiveExam);
  }, [selectedProgressiveExam]);

  const generatePupilReports = useCallback((progressiveExamId: string | null) => {
    // Implementation for generating pupil reports with progressive exam
    console.log('Generating pupil reports with progressive exam:', progressiveExamId);
    toast({ title: "Success", description: "Pupil reports generated successfully!", duration: 1500 });
  }, [toast]);

  // Check for mobile screen size and auto-switch views
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Auto-switch to cards on mobile, table on desktop
      if (mobile && viewMode === 'table') {
        setViewMode('cards');
      } else if (!mobile && viewMode === 'cards') {
        setViewMode('table');
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, [viewMode]);

  // Handle column sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon for column headers
  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ?
      <ChevronUp className="w-3 h-3 text-blue-600" /> :
      <ChevronDown className="w-3 h-3 text-blue-600" />;
  };

  // 🚀 OPTIMIZED: Only show loading spinner if we have no cached data at all
  const showLoadingSpinner = !examId
    || (!examDetails && (isLoadingExams || isLoadingSelectedExam))
    || (isLoadingExamResult && !examResultData);

  // Loading state
  if (showLoadingSpinner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-lg text-gray-700">Loading exam results...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (examResultError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <X className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Error loading exam results</h2>
          <p className="mt-2 text-gray-500">{(examResultError as Error)?.message || "Please try again later."}</p>
          <Button onClick={() => router.push('/exams')} className="mt-6">Back to Exams</Button>
        </div>
      </div>
    );
  }

  // No data state - but allow rendering even if processedResults is empty to show the UI
  if (!examDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-orange-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Exam Not Found</h2>
          <p className="mt-2 text-gray-500">The exam you're looking for could not be found.</p>
          <Button onClick={() => router.push('/exams')} className="mt-6">Back to Exams</Button>
        </div>
      </div>
    );
  }

  // If no results data but exam exists, show empty state but still render the UI
  if (!examResultData || !processedResults.length) {
    return (
      <div className="min-h-screen p-2">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 border-b border-gray-200">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-bold text-white truncate">
                    {examDetails?.name || 'Loading...'} - RESULTS
                  </h1>
                </div>
              </div>
            </div>
            <div className="p-6 text-center">
              <FileText className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Results Found</h2>
              <p className="text-gray-500 mb-6">
                {!examResultData ? "No results have been recorded for this exam yet." : "No pupil results found."}
              </p>
              <Button onClick={() => router.push('/exams')}>Back to Exams</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const academicInfo = getAcademicYearAndTerm(examDetails?.academicYearId || '', examDetails?.termId || '');

  if (analysisMode) {
    const resultsHref = `/exams/${examId}/view-results${classId ? `?classId=${encodeURIComponent(classId)}` : ''}`;
    return (
      <PerformanceAnalysisPage
        processedResults={processedResults}
        subjectSnaps={subjectSnaps || []}
        examDetails={examDetails}
        className={classSnap?.code || classSnap?.name || 'Class'}
        academicYearName={academicInfo.academicYearName}
        termName={academicInfo.termName}
        resultsHref={resultsHref}
      />
    );
  }

  return (
    <div
      className={`min-h-screen transition-[transform,opacity] duration-200 ease-out motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:transition-none ${isSwitchingExam ? 'pointer-events-none opacity-70' : 'opacity-100'}`}
      style={{
        transform: isSwitchingExam
          ? 'perspective(1400px) rotateX(2deg)'
          : 'perspective(1400px) rotateX(0deg)',
        transformOrigin: 'center top',
        backfaceVisibility: 'hidden',
        willChange: isSwitchingExam ? 'transform, opacity' : 'auto',
      }}
      aria-busy={isSwitchingExam}
    >
        <GlassPageTopBar
          title={examDetails?.name || 'Loading...'}
          subtitle={`${classSnap?.code || classSnap?.name || 'Loading...'} | ${academicInfo.academicYearName} - ${academicInfo.termName} | ${examDetails?.startDate ? new Date(examDetails.startDate).toLocaleDateString() : ''} - ${examDetails?.endDate ? new Date(examDetails.endDate).toLocaleDateString() : ''}`}
          backHref="/exams"
          className="mb-1.5"
          meta={
            <span className="rounded-full border border-blue-200/60 bg-blue-50/80 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              {filteredAndSortedResults.length} of {processedResults.length} pupils
            </span>
          }
          center={
            <GlassPageSearchInput
              placeholder="Search pupils..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          }
          actionsLeading={
            <GlassPageSearchInput
              placeholder="Search pupils..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              containerClassName="lg:hidden"
            />
          }
          actions={
            <GlassActionDock>
              {examSwitcher.options.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <GlassActionButton
                      label={examSwitcher.label}
                      icon={examSwitcher.label === 'Sets' ? <Grid3X3 className="h-4 w-4" /> : <UsersIcon className="h-4 w-4" />}
                      tone="blue"
                      aria-label={`Switch ${examSwitcher.label.toLowerCase()}`}
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 rounded-xl border border-blue-100 bg-white/95 p-2 shadow-xl backdrop-blur">
                    <div className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Choose {examSwitcher.label === 'Classes' ? 'class' : 'set'}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {examSwitcher.options.map((option) => {
                        const isCurrentExam = option.id === examId;

                        return (
                          <DropdownMenuItem key={option.id} asChild>
                            <button
                              type="button"
                              onClick={() => handleExamSwitch(option.id, option.classId)}
                              className={`flex h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                                isCurrentExam
                                  ? 'cursor-default border-blue-600 bg-blue-600 text-white'
                                  : 'border-blue-100 bg-blue-50/70 text-blue-700 hover:border-blue-300 hover:bg-blue-100'
                              }`}
                              aria-current={isCurrentExam ? 'page' : undefined}
                            >
                              {examSwitcher.label === 'Sets' ? <Grid3X3 className="h-3.5 w-3.5" /> : <UsersIcon className="h-3.5 w-3.5" />}
                              <span className="truncate">{option.label}</span>
                              {isCurrentExam && <Check className="h-3.5 w-3.5" />}
                            </button>
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <GlassActionButton
                label="Edit"
                icon={<Edit3 className="h-4 w-4" />}
                tone="orange"
                href={`/exams/${examId}/record-results?classId=${classId}`}
              />
              <GlassActionButton
                label={viewMode === 'table' ? 'Cards' : 'Table'}
                icon={viewMode === 'table' ? <Grid3X3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
                tone="slate"
                onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
              />
              <GlassActionButton
                label={showFilters ? 'Hide Filters' : selectedPdfPupilIds.size > 0 ? `Filter (${selectedPdfPupilIds.size} selected)` : pdfTargetResults.length < processedResults.length ? `Filter (${pdfTargetResults.length}/${processedResults.length})` : 'Filter'}
                icon={<Filter className="h-4 w-4" />}
                tone={selectedPdfPupilIds.size > 0 || pdfTargetResults.length < processedResults.length ? 'blue' : 'slate'}
                onClick={() => setShowFilters(!showFilters)}
              />
              <GlassActionButton
                label="Print"
                icon={<Printer className="h-4 w-4" />}
                tone="blue"
                onClick={() => {
                  const isTerm3 = isTermThree(academicInfo.termName);
                  if (isTerm3) {
                    setShowPromotionRankingModal(true);
                  } else {
                    setShowPrintModal(true);
                  }
                }}
              />
              {!isNurseryExam && (
                <GlassActionButton
                  label="Analysis"
                  icon={<TrendingUp className="h-4 w-4" />}
                  tone="purple"
                  href={`/exams/${examId}/view-results/analysis${classId ? `?classId=${encodeURIComponent(classId)}` : ''}`}
                />
              )}
            </GlassActionDock>
          }
        />
      <GlassSummaryBar
        left={
          <div className="flex items-center gap-2">
            {isNurseryExam ? <BookOpen className="h-4 w-4 text-emerald-600" /> : <Trophy className="h-4 w-4 text-amber-500" />}
            <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 dark:text-indigo-200 uppercase">
              {isNurseryExam ? 'Nursery Assessment Scale' : 'Exam Analytics'}
            </span>
          </div>
        }
        right={
          isNurseryExam ? (
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
              {NURSERY_COMMENTARY_OPTIONS.map(option => (
                <span key={option} className="whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 sm:text-xs">
                  {option}
                </span>
              ))}
            </div>
          ) : analytics ? (
            <>
              <div 
                className="flex items-center gap-1 bg-green-50/80 dark:bg-green-950/20 border border-green-100/50 dark:border-green-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-900/30 hover:border-green-300 dark:hover:border-green-800 transition-all duration-200"
                onClick={() => {
                  const p = processedResults.find(r => r.pupilInfo.admissionNumber === analytics.bestPupil.admissionNumber);
                  if (p) setSelectedPupilIdForPopup(p.pupilInfo.pupilId);
                }}
              >
                <span className="text-green-700/85 dark:text-indigo-300 font-medium">Best Pupil:</span>
                <span className="font-bold text-green-600 dark:text-green-400 truncate max-w-[120px]" title={analytics.bestPupil.name}>
                  {analytics.bestPupil.name} ({analytics.bestPupil.totalMarks}m / Agg {analytics.bestPupil.totalAggregates})
                </span>
              </div>
              <div 
                className="flex items-center gap-1 bg-red-50/80 dark:bg-red-950/20 border border-red-100/50 dark:border-red-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs cursor-pointer hover:bg-red-100/50 dark:hover:bg-red-900/30 hover:border-red-300 dark:hover:border-red-800 transition-all duration-200"
                onClick={() => {
                  const p = processedResults.find(r => r.pupilInfo.admissionNumber === analytics.worstPupil.admissionNumber);
                  if (p) setSelectedPupilIdForPopup(p.pupilInfo.pupilId);
                }}
              >
                <span className="text-red-700/85 dark:text-indigo-300 font-medium">Needs Imp:</span>
                <span className="font-bold text-red-600 dark:text-red-400 truncate max-w-[120px]" title={analytics.worstPupil.name}>
                  {analytics.worstPupil.name} ({analytics.worstPupil.totalMarks}m / Agg {analytics.worstPupil.totalAggregates})
                </span>
              </div>
              <div className="flex items-center gap-1 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="text-blue-700/85 dark:text-indigo-300 font-medium">Best Subj:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 truncate max-w-[100px]" title={analytics.bestSubject.name}>
                  {analytics.bestSubject.code} ({analytics.bestSubject.averageMarks.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center gap-1 bg-purple-50/80 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="text-purple-700/85 dark:text-indigo-300 font-medium">Worst Subj:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400 truncate max-w-[100px]" title={analytics.worstSubject.name}>
                  {analytics.worstSubject.code} ({analytics.worstSubject.averageMarks.toFixed(1)}%)
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground">Calculating analytics...</div>
          )
        }
      />

      <div className="max-w-none px-4 sm:px-6 lg:px-8 pb-12">

          {/* Filters Section */}
          {showFilters && (
            <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {!isNurseryExam && <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Min Marks</label>
                  <Input
                    type="number"
                    value={filters.minMarks}
                    onChange={(e) => setFilters(prev => ({ ...prev, minMarks: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Min..."
                  />
                </div>}
                {!isNurseryExam && <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Max Marks</label>
                  <Input
                    type="number"
                    value={filters.maxMarks}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxMarks: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Max..."
                  />
                </div>}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{isNurseryExam ? 'Assessment' : 'Grade'}</label>
                  <Select value={filters.grade} onValueChange={(value) => setFilters(prev => ({ ...prev, grade: value === "all" ? "" : value }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={isNurseryExam ? 'All Assessments' : 'All Grades'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isNurseryExam ? 'All Assessments' : 'All Grades'}</SelectItem>
                      {(isNurseryExam ? NURSERY_COMMENTARY_OPTIONS : ['D1', 'D2', 'C3', 'C4', 'C5', 'C6', 'P7', 'P8', 'F9']).map(grade => (
                        <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!isNurseryExam && <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Division</label>
                  <Select value={filters.division} onValueChange={(value) => setFilters(prev => ({ ...prev, division: value === "all" ? "" : value }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All Divisions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Divisions</SelectItem>
                      {['I', 'II', 'III', 'IV', 'U'].map(division => (
                        <SelectItem key={division} value={division}>Division {division}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>}
              </div>

              {/* Major Subjects Legend */}
              {!isNurseryExam && subjectSnaps && subjectSnaps.length > 4 && (examResultData?.majorSubjects && examResultData.majorSubjects.length > 0) && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <div className="flex items-center gap-2 text-xs text-blue-700">
                    <span className="font-semibold">★</span>
                    <span>Major subjects (used for aggregates and division calculation)</span>
                    {examResultData?.majorSubjects && (
                      <span className="ml-2 text-gray-600">
                        [{examResultData.majorSubjects.join(', ')}]
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ===== Select Pupils for PDF ===== */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPupilSelectMode(prev => !prev);
                        if (isPupilSelectMode) setSelectedPdfPupilIds(new Set());
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                        isPupilSelectMode
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <UsersIcon className="h-3.5 w-3.5" />
                      {isPupilSelectMode ? 'Selecting Pupils' : 'Select Pupils'}
                    </button>
                    {isPupilSelectMode && (
                      <span className="text-xs text-gray-500">
                        {selectedPdfPupilIds.size === 0
                          ? `All ${filteredAndSortedResults.length} visible pupils will be printed`
                          : `${selectedPdfPupilIds.size} of ${filteredAndSortedResults.length} selected for print`}
                      </span>
                    )}
                  </div>
                  {isPupilSelectMode && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPdfPupilIds(new Set(filteredAndSortedResults.map(r => r.pupilInfo.pupilId)))}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Select all
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPdfPupilIds(new Set())}
                        className="text-xs text-gray-500 hover:text-gray-700 font-semibold"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {isPupilSelectMode && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white shadow-inner">
                    {filteredAndSortedResults.length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-4">No pupils to display — adjust other filters first.</p>
                    ) : (
                      filteredAndSortedResults.map((result) => {
                        const pid = result.pupilInfo.pupilId;
                        const isChecked = selectedPdfPupilIds.size === 0 || selectedPdfPupilIds.has(pid);
                        return (
                          <label
                            key={pid}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                              selectedPdfPupilIds.size === 0
                                ? 'hover:bg-gray-50'
                                : isChecked
                                  ? 'bg-indigo-50 hover:bg-indigo-100'
                                  : 'opacity-50 hover:bg-gray-50'
                            }`}
                          >
                            <Checkbox
                              checked={selectedPdfPupilIds.size === 0 ? true : selectedPdfPupilIds.has(pid)}
                              onCheckedChange={(checked) => {
                                setSelectedPdfPupilIds(prev => {
                                  // If currently "all selected" (empty set means all), initialise the set with ALL then toggle
                                  const base: Set<string> = prev.size === 0
                                    ? new Set(filteredAndSortedResults.map(r => r.pupilInfo.pupilId))
                                    : new Set(prev);
                                  if (checked) {
                                    base.add(pid);
                                  } else {
                                    base.delete(pid);
                                  }
                                  // If everything is selected again, collapse back to "all" (empty set)
                                  if (base.size === filteredAndSortedResults.length) return new Set();
                                  return base;
                                });
                              }}
                              className="h-4 w-4 rounded"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-medium text-gray-800 truncate block">{result.pupilInfo.name}</span>
                              {result.pupilInfo.admissionNumber && (
                                <span className="text-[10px] text-gray-400">{result.pupilInfo.admissionNumber}</span>
                              )}
                            </div>
                            {!isNurseryExam && (
                              <span className="text-[10px] text-gray-500 flex-shrink-0">#{result.position}</span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Compact Results Table */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-3">
            {viewMode === 'cards' && (
              <div className="flex justify-end mb-3">
                <div className="flex items-center gap-1">
                  <Select value={sortField} onValueChange={setSortField}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue placeholder="Sort..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="position">Position</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      {!isNurseryExam && <SelectItem value="marks">Marks</SelectItem>}
                      {!isNurseryExam && <SelectItem value="aggregates">Agg</SelectItem>}
                      {subjectSnaps?.map(subject => (
                        <SelectItem key={`subject_${subject.code}`} value={`subject_${subject.code}`}>
                          {subject.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    {sortDirection === 'asc' ?
                      <ChevronUp className="w-3 h-3" /> :
                      <ChevronDown className="w-3 h-3" />
                    }
                  </Button>
                </div>
              </div>
            )}
            {/* Compact Results Display - Table or Cards */}
            {displayedResults.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500 text-sm">No results found for this exam.</p>
              </div>
            ) : viewMode === 'cards' ? (
              // Compact Card View for Mobile/Small Screens
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {displayedResults.map((result, index) => {
                  const division = result.division;

                  return (
                    <div
                      key={result.pupilInfo.pupilId}
                      onClick={() => handleViewDetails(result.pupilInfo.pupilId)}
                      className="bg-white border border-gray-200 rounded-md p-2 shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-300 hover:-translate-y-0.5 cursor-pointer"
                    >
                      {/* Ultra Compact Header */}
                      {!isNurseryExam && <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 px-1.5 py-0.5 rounded text-xs">
                            #{result.position}
                          </span>
                          <Badge
                            variant="outline"
                            className={`${getDivisionColor(division)} text-xs px-1 py-0 border-0`}
                          >
                            {division}
                          </Badge>
                        </div>
                      </div>}

                      {/* Compact Pupil Info */}
                      <div className="mb-2">
                        <h3 className="font-bold text-gray-900 text-xs leading-tight truncate">
                          {result.pupilInfo?.name}
                        </h3>
                        <p className="text-xs text-gray-600 font-medium">
                          {result.pupilInfo?.admissionNumber}
                        </p>
                      </div>

                      {/* Ultra Compact Performance Summary */}
                      {!isNurseryExam && <div className="grid grid-cols-2 gap-1 mb-2">
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded p-1 text-center">
                          <div className="text-sm font-bold text-blue-900">
                            {result.totalMarks}
                          </div>
                          <div className="text-xs text-blue-700 font-medium">
                            Marks
                          </div>
                        </div>
                        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded p-1 text-center">
                          <div className="text-sm font-bold text-purple-900">
                            {result.totalAggregates}
                          </div>
                          <div className="text-xs text-purple-700 font-medium">
                            Agg
                          </div>
                        </div>
                      </div>}

                      {/* Ultra Compact Subject Results */}
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          Subjects
                        </div>

                        {/* Grid layout for better space utilization */}
                        <div className="grid grid-cols-2 gap-1">
                          {subjectSnaps?.slice(0, 6).map(subject => {
                            const subjectResult = result.results[subject.code];
                            // Get major subjects from the saved exam result data for consistency
                            const savedMajorSubjects = examResultData?.majorSubjects || [];
                            const majorSubjects = savedMajorSubjects.length > 0
                              ? savedMajorSubjects
                              : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));
                            const isMajorSubject = majorSubjects.includes(subject.code);

                            return (
                              <div key={subject.code} className="bg-gray-50 rounded px-1 py-0.5 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-medium text-gray-700 truncate">
                                      {subject.code}
                                    </span>
                                    {!isNurseryExam && isMajorSubject && (
                                      <span className="text-xs text-blue-600 font-semibold" title="Major Subject">
                                        ★
                                      </span>
                                    )}
                                  </div>
                                  {!isNurseryExam && isMajorSubject && subjectResult?.grade && (
                                    <Badge
                                      variant="outline"
                                      className={`${getGradeColor(subjectResult.grade)} text-xs px-1 py-0 border-0 font-semibold ml-1`}
                                    >
                                      {subjectResult.grade}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-bold text-gray-900">
                                    {isNurseryExam
                                      ? (subjectResult?.comment || subjectResult?.grade || '-')
                                      : (subjectResult?.marks !== undefined ? subjectResult.marks : '-')}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Compact remaining subjects indicator */}
                        {subjectSnaps && subjectSnaps.length > 6 && (
                          <div className="text-center">
                            <span className="text-xs text-gray-500 bg-gray-100 px-1 py-0.5 rounded">
                              +{subjectSnaps.length - 6} more
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Compact Table View for Desktop with Column Sorting
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-gray-50 to-blue-50">
                      <TableHead className="text-xs font-medium text-gray-600 uppercase tracking-wider sticky left-0 bg-gradient-to-r from-gray-50 to-blue-50 shadow-sm py-2 px-1 w-12">
                        <div
                          className="flex flex-col items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!isPrintMode ? (
                            <>
                              <Checkbox
                                checked={selectedPupils.length === displayedResults.length && displayedResults.length > 0}
                                onCheckedChange={handleSelectAll}
                                onClick={(e) => e.stopPropagation()}
                                className="h-3 w-3"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPrintMode(true);
                                  setSelectedPupils([]);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                title="Switch to Print Mode"
                              >
                                Release
                              </button>
                            </>
                          ) : (
                            <>
                              <Printer className="h-3 w-3 text-blue-600" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPrintMode(false);
                                  setSelectedPupilForPrint(null);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                title="Switch to Release Mode"
                              >
                                Print
                              </button>
                            </>
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-xs font-medium text-gray-600 uppercase tracking-wider sticky left-8 bg-gradient-to-r from-gray-50 to-blue-50 shadow-sm cursor-pointer hover:bg-blue-100 transition-colors py-2 px-2"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Pupil
                          {getSortIcon('name')}
                        </div>
                      </TableHead>
                      {subjectSnaps?.map(subject => (
                        <TableHead
                          key={subject.code}
                          className="text-xs font-medium text-gray-600 uppercase tracking-wider text-center cursor-pointer hover:bg-blue-100 transition-colors py-2 px-1"
                          onClick={() => handleSort(`subject_${subject.code}`)}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              {subject.name.length > 8 ? subject.code : subject.name}
                              {getSortIcon(`subject_${subject.code}`)}
                            </div>
                            {subject.name.length > 8 && <span className="text-blue-400 text-xs">{subject.code}</span>}
                          </div>
                        </TableHead>
                      ))}
                      {!isNurseryExam && <TableHead
                        className="text-xs font-medium text-gray-600 uppercase tracking-wider text-center cursor-pointer hover:bg-blue-100 transition-colors py-2 px-2"
                        onClick={() => handleSort('marks')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Total
                          {getSortIcon('marks')}
                        </div>
                      </TableHead>}
                      {!isNurseryExam && <TableHead
                        className="text-xs font-medium text-gray-600 uppercase tracking-wider text-center cursor-pointer hover:bg-blue-100 transition-colors py-2 px-2"
                        onClick={() => handleSort('aggregates')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Agg
                          {getSortIcon('aggregates')}
                        </div>
                      </TableHead>}
                      {!isNurseryExam && <TableHead className="text-xs font-medium text-gray-600 uppercase tracking-wider text-center py-2 px-2">
                        Div
                      </TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedResults.map((result, index) => {
                      const division = result.division;

                      return (
                        <TableRow
                          key={result.pupilInfo.pupilId}
                          onClick={() => handleViewDetails(result.pupilInfo.pupilId)}
                          className={`
                            ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                            hover:bg-blue-50 transition-colors cursor-pointer
                          `}
                        >
                          <TableCell className="sticky left-0 bg-inherit font-medium text-xs py-2 px-1 w-12 text-center">
                            <div
                              className="flex flex-col items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {!isPrintMode ? (
                                <>
                                  <Checkbox
                                    checked={selectedPupils.includes(result.pupilInfo.pupilId)}
                                    onCheckedChange={(checked) => handlePupilSelection(result.pupilInfo.pupilId, checked as boolean)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-3 w-3"
                                  />
                                  {isResultReleased(result.pupilInfo.pupilId) ? (
                                    <div title="Released to Parents">
                                      <Unlock className="h-3 w-3 text-green-600" />
                                    </div>
                                  ) : (
                                    <div title="Not Released">
                                      <Lock className="h-3 w-3 text-gray-400" />
                                    </div>
                                  )}
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPupilForPrint(result.pupilInfo.pupilId);
                                    setShowIndividualPrintModal(true);
                                  }}
                                  className="h-6 w-6 p-0"
                                  title="Print Report"
                                >
                                  <Printer className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="sticky left-8 bg-inherit py-2 px-2">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-blue-600 whitespace-nowrap">
                                {result.pupilInfo?.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {result.pupilInfo?.admissionNumber}
                              </span>
                            </div>
                          </TableCell>
                          {subjectSnaps?.map(subject => {
                            const subjectResult = result.results[subject.code];
                            // Get major subjects from the saved exam result data for consistency
                            const savedMajorSubjects = examResultData?.majorSubjects || [];
                            const majorSubjects = savedMajorSubjects.length > 0
                              ? savedMajorSubjects
                              : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));
                            const isMajorSubject = majorSubjects.includes(subject.code);

                            return (
                              <TableCell key={subject.code} className="text-center py-2 px-1">
                                <div className="flex flex-col items-center space-y-0.5">
                                  <div className="text-xs font-medium text-gray-900">
                                    {isNurseryExam
                                      ? (subjectResult?.comment || subjectResult?.grade || '-')
                                      : (subjectResult?.marks !== undefined ? subjectResult.marks : '-')}
                                  </div>
                                  {!isNurseryExam && isMajorSubject && (
                                    <div className="flex items-center gap-1">
                                      {subjectResult?.grade && (
                                        <Badge
                                          variant="outline"
                                          className={`${getGradeColor(subjectResult.grade)} text-xs px-1 py-0`}
                                        >
                                          {subjectResult.grade}
                                        </Badge>
                                      )}
                                      <span className="text-xs text-blue-600 font-semibold" title="Major Subject">
                                        ★
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                          {!isNurseryExam && <TableCell className="text-center py-2 px-2">
                            <span className="text-xs font-medium text-gray-900 bg-blue-50 px-1.5 py-0.5 rounded">
                              {result.totalMarks}
                            </span>
                          </TableCell>}
                          {!isNurseryExam && <TableCell className="text-center py-2 px-2">
                            <span className="text-xs font-medium text-gray-900 bg-purple-50 px-1.5 py-0.5 rounded">
                              {result.totalAggregates}
                            </span>
                          </TableCell>}
                          {!isNurseryExam && <TableCell className="text-center py-2 px-2">
                            <Badge
                              variant="outline"
                              className={`${getDivisionColor(division)} text-xs px-1 py-0`}
                            >
                              {division}
                            </Badge>
                          </TableCell>}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Release Controls Section */}
        {selectedPupils.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow-lg border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Release Selected Results
                </h3>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <span>{selectedPupils.length} student{selectedPupils.length !== 1 ? 's' : ''} selected</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setShowReleaseModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={releaseResultsMutation.isPending}
              >
                {releaseResultsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Releasing...
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4 mr-2" />
                    Release Selected ({selectedPupils.length})
                  </>
                )}
              </Button>

              <Button
                onClick={() => setSelectedPupils([])}
                variant="outline"
                className="text-gray-600 hover:text-gray-800"
              >
                Clear Selection
              </Button>
            </div>

            <div className="mt-3 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Released results will be immediately visible to parents in their dashboard.
                This action requires admin authentication and cannot be undone without admin intervention.
              </p>
            </div>
          </div>
        )}

        {/* Bulk Release Controls */}
        <div className="mt-4 bg-white rounded-lg shadow-lg border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Bulk Release Options</h3>
              <p className="text-sm text-gray-600">Release all results for this exam at once</p>
            </div>
            <div className="text-sm text-gray-600">
              {releaseInfo?.releasedPupils.length || 0} of {processedResults.length} results released
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setSelectedPupils([]);
                setShowReleaseModal(true);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={releaseAllMutation.isPending}
            >
              {releaseAllMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Releasing All...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Release All Results
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Promotion Ranking Configuration Dialog (Term 3 only) */}
      <PromotionRankingDialog
        isOpen={showPromotionRankingModal}
        onClose={() => setShowPromotionRankingModal(false)}
        config={promotionRankingConfig}
        onConfigChange={setPromotionRankingConfig}
        onConfirm={() => {
          console.log('📊 Promotion Ranking Dialog - Continue clicked');
          console.log('🔧 Current config:', promotionRankingConfig);
          setShowPromotionRankingModal(false);
          setShowPrintModal(true);
        }}
      />

      {/* Admin Password Modal */}
      <AdminPasswordModal
        isOpen={showReleaseModal}
        onClose={() => setShowReleaseModal(false)}
        onConfirm={async (password, notes) => {
          if (selectedPupils.length > 0) {
            await handleReleaseResults(password, notes);
          } else {
            await handleReleaseAll(password, notes);
          }
        }}
        title={selectedPupils.length > 0 ? "Release Selected Results" : "Release All Results"}
        description={
          selectedPupils.length > 0
            ? `You are about to release results for ${selectedPupils.length} selected student${selectedPupils.length !== 1 ? 's' : ''} to their parents.`
            : `You are about to release all exam results (${processedResults.length} students) to parents.`
        }
        selectedCount={selectedPupils.length > 0 ? selectedPupils.length : processedResults.length}
        isLoading={releaseResultsMutation.isPending || releaseAllMutation.isPending}
      />

      {/* Progressive Exam Selection Modal */}
      <Dialog open={showProgressiveExamModal} onOpenChange={setShowProgressiveExamModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Progressive Assessment</DialogTitle>
            <DialogDescription>
              Choose an exam to display in the Progressive Assessment Records section of the report.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <RadioGroup value={selectedProgressiveExam || ''} onValueChange={handleSelectProgressiveExam}>
              {progressiveExams.map((exam) => (
                <div key={exam.id} className="flex items-center space-x-2 mb-2 p-2 border rounded-md">
                  <RadioGroupItem value={exam.id} id={exam.id} />
                  <Label htmlFor={exam.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{exam.name}</div>
                    <div className="text-xs text-gray-500">
                      {exam.examTypeName} | {new Date(exam.startDate).toLocaleDateString()} - {new Date(exam.endDate).toLocaleDateString()}
                    </div>
                  </Label>
                </div>
              ))}
              <div className="flex items-center space-x-2 mb-2 p-2 border rounded-md">
                <RadioGroupItem value="none" id="none" />
                <Label htmlFor="none" className="flex-1 cursor-pointer">
                  <div className="font-medium">None</div>
                  <div className="text-xs text-gray-500">Do not include progressive assessment records</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowProgressiveExamModal(false);
                // Continue without progressive assessment
                generatePupilReports(null);
              }}
            >
              Skip
            </Button>
            <Button
              type="button"
              onClick={handleConfirmProgressiveExam}
              disabled={!selectedProgressiveExam && selectedProgressiveExam !== 'none'}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Modal */}
      <PrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        onPrintAssessment={handleExportAssessment}
        onPrintNurseryReport={handleNurseryReport}
        onPrintTrans={handleTransReport}
        onPrintFullReport2={handleFullReport2}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
        generationProgress={generationProgress}
        eta={eta}
        isNursery={isNurseryExam}
        omitNurseryTeacherComment={omitNurseryTeacherComment}
        onOmitNurseryTeacherCommentChange={setOmitNurseryTeacherComment}
      />

      {/* Print Assessment Options Dialog */}
      <PrintAssessmentOptionsDialog
        isOpen={showPrintAssessmentOptionsDialog}
        onClose={() => setShowPrintAssessmentOptionsDialog(false)}
        reportType={assessmentReportType}
        isNursery={isNurseryExam}
        onConfirm={(options) => {
          console.log('📋 Options confirmed, report type:', assessmentReportType, 'options:', options);
          if (assessmentReportType === 'detailed') {
            // Breakdown = Detailed Assessment (no analysis tables, just pupil cards)
            generateDetailedAssessmentReport();
          } else {
            // Assessment Report = Table with optional analysis page
            generateAssessmentPDF(options);
          }
        }}
        gradingScale={
          isNurseryExam
            ? []
            : examResultData?.gradingScale && Array.isArray(examResultData.gradingScale) && examResultData.gradingScale.length > 0
              ? examResultData.gradingScale.map(item => ({
                  minMark: item.minMark,
                  maxMark: item.maxMark || (item.minMark === 0 ? 29 : item.minMark - 1),
                  grade: item.grade,
                  aggregates: item.aggregates || 9,
                }))
              : DEFAULT_GRADING_SCALE.map(item => ({
                  minMark: item.minMark,
                  maxMark: item.maxMark,
                  grade: item.grade,
                  aggregates: item.aggregates || 9,
                }))
        }
      />

      {/* TRANS Report Type Selection Modal */}
      <Dialog open={showTransTypeModal} onOpenChange={setShowTransTypeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <FileTextIcon className="h-5 w-5 text-orange-600" />
              Select Full Report Type
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
            {selectedFullReportTemplate === 'full2' && (
              <FullReport2PaletteSelector palette={fullReport2Palette} onPaletteChange={setFullReport2Palette} />
            )}
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
                  if (selectedPupilForPrint) {
                    generateIndividualTransReportWithProgress(selectedComparisonExams, comparisonExamNames);
                  } else {
                    generateTransReportWithProgress(selectedComparisonExams, comparisonExamNames);
                  }
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

      {/* Individual Pupil Performance Popup */}
      <Dialog open={!!selectedPupilIdForPopup} onOpenChange={(open) => !open && setSelectedPupilIdForPopup(null)}>
        <DialogContent className="max-w-md rounded-2xl border-2 border-primary/10 bg-gradient-to-br from-card via-card to-muted/5 p-6 backdrop-blur-sm shadow-2xl">
          {selectedPupilData && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {selectedPupilData.pupilInfo.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <DialogTitle className="text-base font-bold text-indigo-950 dark:text-white">
                      {selectedPupilData.pupilInfo.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Admission: {selectedPupilData.pupilInfo.admissionNumber} | Class: {classSnap?.code || classSnap?.name || 'N/A'}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {/* Summary Badges */}
                {!isNurseryExam && <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 border rounded-xl bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 border-indigo-100 text-center">
                    <div className="text-xs text-indigo-700/80 font-medium">Total Marks</div>
                    <div className="text-lg font-black text-indigo-900 dark:text-indigo-200">{selectedPupilData.totalMarks}</div>
                  </div>
                  <div className="p-2 border rounded-xl bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 border-emerald-100 text-center">
                    <div className="text-xs text-emerald-700/80 font-medium">Aggregates / Div</div>
                    <div className="text-lg font-black text-indigo-900 dark:text-indigo-200">
                      {selectedPupilData.totalAggregates} (Div {selectedPupilData.division})
                    </div>
                  </div>
                </div>}

                {/* Subject-wise Marks Table */}
                <div className="border border-border/50 rounded-xl overflow-hidden shadow-sm">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase">Subject</th>
                          {isNurseryExam ? (
                            <th className="px-3 py-2 text-center font-semibold text-muted-foreground uppercase">Assessment</th>
                          ) : (
                            <>
                              <th className="px-3 py-2 text-center font-semibold text-muted-foreground uppercase">Marks</th>
                              <th className="px-3 py-2 text-center font-semibold text-muted-foreground uppercase">Grade</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {subjectSnaps.map((subject) => {
                          const res = selectedPupilData.results[subject.code];
                          return (
                            <tr key={subject.code} className="hover:bg-muted/10">
                              <td className="px-3 py-2 text-left font-medium text-foreground">{subject.name}</td>
                              {isNurseryExam ? (
                                <td className="px-3 py-2 text-center font-bold text-emerald-800">
                                  {res?.comment || res?.grade || '-'}
                                </td>
                              ) : <>
                              <td className="px-3 py-2 text-center font-bold text-indigo-950 dark:text-white">{res ? `${res.marks}%` : '-'}</td>
                              <td className="px-3 py-2 text-center">
                                {res ? (
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${getGradeColor(res.grade)}`}>
                                    {res.grade}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td></>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Rank and Class Position */}
                <div className="flex items-center justify-between px-3 py-2 border rounded-xl bg-muted/20">
                  <span className="text-xs font-semibold text-muted-foreground">Class Position</span>
                  <span className="text-sm font-black text-indigo-900 dark:text-indigo-300">
                    #{selectedPupilData.position} of {processedResults.length}
                  </span>
                </div>
              </div>
            </>
          )}
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

      {/* Individual Print Modal - shares the same option surface and PDF generators as batch printing */}
      <PrintModal
        isOpen={showIndividualPrintModal}
        onClose={() => {
          setShowIndividualPrintModal(false);
          setSelectedPupilForPrint(null);
        }}
        onPrintAssessment={handleIndividualReportOne}
        onPrintNurseryReport={handleIndividualMiniReport}
        onPrintTrans={handleIndividualFullReport}
        onPrintFullReport2={handleIndividualFullReport2}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
        generationProgress={generationProgress}
        eta={eta}
        isNursery={isNurseryExam}
        omitNurseryTeacherComment={omitNurseryTeacherComment}
        onOmitNurseryTeacherCommentChange={setOmitNurseryTeacherComment}
        isIndividual={Boolean(selectedPupilForPrint)}
        individualPupilName={selectedPupilForPrint ? processedResults.find(r => r.pupilInfo.pupilId === selectedPupilForPrint)?.pupilInfo?.name : undefined}
      />
    </div>
  );
}

// Full-page performance analysis view
interface PerformanceAnalysisPageProps {
  processedResults: PupilResultData[];
  subjectSnaps: any[];
  examDetails: any;
  className: string;
  academicYearName: string;
  termName: string;
  resultsHref: string;
}

function PerformanceAnalysisPage({
  processedResults,
  subjectSnaps,
  examDetails,
  className,
  academicYearName,
  termName,
  resultsHref,
}: PerformanceAnalysisPageProps) {
  const [expandedDivisions, setExpandedDivisions] = useState<string[]>([]);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [expandedGrades, setExpandedGrades] = useState<string[]>([]);

  // Division Analysis
  const divisionAnalysis = useMemo(() => {
    const divisions = ['I', 'II', 'III', 'IV', 'U', 'X'];
    return divisions.map(div => {
      const pupils = processedResults.filter(r => r.division === div);
      const percentage = processedResults.length > 0 ? (pupils.length / processedResults.length) * 100 : 0;
      return {
        division: div,
        count: pupils.length,
        percentage: percentage.toFixed(1),
        pupils: pupils.map(p => ({
          name: p.pupilInfo?.name,
          admissionNumber: p.pupilInfo?.admissionNumber,
          totalMarks: p.totalMarks,
          totalAggregates: p.totalAggregates,
          pupilId: p.pupilInfo?.pupilId
        }))
      };
    }).filter(d => d.count > 0);
  }, [processedResults]);

  // Subject-wise Grade Analysis
  const subjectGradeAnalysis = useMemo(() => {
    return subjectSnaps.map(subject => {
      const grades = ['D1', 'D2', 'C3', 'C4', 'C5', 'C6', 'P7', 'P8', 'F9'];
      const gradeDistribution = grades.map(grade => {
        const pupils = processedResults.filter(r => {
          const subjectResult = r.results[subject.code];
          return subjectResult?.grade === grade;
        });

        return {
          grade,
          count: pupils.length,
          percentage: processedResults.length > 0 ? (pupils.length / processedResults.length) * 100 : 0,
          pupils: pupils.map(p => ({
            name: p.pupilInfo?.name,
            admissionNumber: p.pupilInfo?.admissionNumber,
            marks: p.results[subject.code]?.marks,
            grade: p.results[subject.code]?.grade,
            pupilId: p.pupilInfo?.pupilId
          }))
        };
      }).filter(g => g.count > 0);

      const totalPupils = processedResults.filter(r => r.results[subject.code]?.marks !== undefined).length;
      const averageMarks = totalPupils > 0
        ? processedResults.reduce((sum, r) => sum + (r.results[subject.code]?.marks || 0), 0) / totalPupils
        : 0;

      return {
        subject: subject.name,
        code: subject.code,
        gradeDistribution,
        totalPupils,
        averageMarks: averageMarks.toFixed(1)
      };
    });
  }, [processedResults, subjectSnaps]);

  // Overall Statistics
  const overallStats = useMemo(() => {
    const totalPupils = processedResults.length;
    const passRate = totalPupils > 0
      ? ((processedResults.filter(r => ['I', 'II', 'III', 'IV'].includes(r.division)).length / totalPupils) * 100).toFixed(1)
      : '0';

    const averageMarks = totalPupils > 0
      ? (processedResults.reduce((sum, r) => sum + r.totalMarks, 0) / totalPupils).toFixed(1)
      : '0';

    const averageAggregates = totalPupils > 0
      ? (processedResults.reduce((sum, r) => sum + r.totalAggregates, 0) / totalPupils).toFixed(1)
      : '0';

    const topPerformer = processedResults.length > 0
      ? processedResults.reduce((top, current) =>
        current.totalMarks > top.totalMarks ? current : top
      )
      : null;

    const worstPerformer = processedResults.length > 0
      ? processedResults.reduce((worst, current) =>
        current.totalMarks < worst.totalMarks ? current : worst
      )
      : null;

    return {
      totalPupils,
      passRate,
      averageMarks,
      averageAggregates,
      topPerformer,
      worstPerformer
    };
  }, [processedResults]);

  const getDivisionColor = (division: string) => {
    switch (division) {
      case 'I': return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
      case 'II': return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
      case 'III': return 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white';
      case 'IV': return 'bg-gradient-to-r from-orange-500 to-red-500 text-white';
      case 'U': return 'bg-gradient-to-r from-red-600 to-red-700 text-white';
      case 'X': return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const getGradeColor = (grade: string) => {
    if (['D1', 'D2'].includes(grade)) return 'bg-green-100 text-green-800 border-green-300';
    if (['C3', 'C4', 'C5', 'C6'].includes(grade)) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (['P7', 'P8'].includes(grade)) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/50">
      <GlassPageTopBar
        title="Performance Analysis"
        subtitle={`${examDetails?.name || 'Exam'} | ${className} | ${academicYearName} - ${termName}`}
        backHref={resultsHref}
        className="mb-2"
        meta={
          <span className="rounded-full border border-purple-200/70 bg-purple-50/90 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
            {processedResults.length} pupils
          </span>
        }
      />

      <main className="mx-auto max-w-7xl space-y-4 px-3 pb-8 sm:px-4 lg:px-6">
          {/* Overall Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-blue-900">{overallStats.totalPupils}</div>
                <div className="text-xs text-blue-700">Total Pupils</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-900">{overallStats.passRate}%</div>
                <div className="text-xs text-green-700">Pass Rate (I-IV)</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-purple-900">{overallStats.averageMarks}</div>
                <div className="text-xs text-purple-700">Avg. Marks</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-amber-900">{overallStats.averageAggregates}</div>
                <div className="text-xs text-amber-700">Avg. Aggregates</div>
              </CardContent>
            </Card>
          </div>

          {/* Top and Bottom Performers */}
          {overallStats.topPerformer && overallStats.worstPerformer && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Top Performer */}
              <Card className="bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 border border-amber-300">
                <CardContent className="p-2.5 sm:p-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 ring-1 ring-amber-200">
                      <Trophy className="h-5 w-5 text-yellow-600" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <p className="shrink-0 text-xs font-medium text-amber-700">Top Performer</p>
                        <p className="truncate text-sm font-bold text-amber-900">{overallStats.topPerformer.pupilInfo?.name}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold tabular-nums text-amber-900">
                        <span>{overallStats.topPerformer.totalMarks} marks</span>
                        <span aria-hidden="true" className="text-amber-400">•</span>
                        <span>Agg {overallStats.topPerformer.totalAggregates}</span>
                        <span aria-hidden="true" className="text-amber-400">•</span>
                        <span>Div {overallStats.topPerformer.division}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Worst Performer */}
              <Card className="bg-gradient-to-r from-red-50 via-pink-50 to-gray-50 border border-red-300">
                <CardContent className="p-2.5 sm:p-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 ring-1 ring-red-200">
                      <TrendingDown className="h-5 w-5 text-red-600" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <p className="shrink-0 text-xs font-medium text-red-700">Worst Performer</p>
                        <p className="truncate text-sm font-bold text-red-900">{overallStats.worstPerformer.pupilInfo?.name}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold tabular-nums text-red-900">
                        <span>{overallStats.worstPerformer.totalMarks} marks</span>
                        <span aria-hidden="true" className="text-red-400">•</span>
                        <span>Agg {overallStats.worstPerformer.totalAggregates}</span>
                        <span aria-hidden="true" className="text-red-400">•</span>
                        <span>Div {overallStats.worstPerformer.division}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Division Distribution */}
          <Card className="overflow-hidden border-purple-200/80 bg-white/90 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-gray-900 sm:text-lg">
                <PieChart className="h-5 w-5 text-purple-600" />
                Class Division Breakdown
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Performance distribution by division</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-1 sm:p-4 sm:pt-1">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {divisionAnalysis.map((div) => {
                  const isExpanded = expandedDivisions.includes(div.division);
                  return (
                    <div
                      key={div.division}
                      className={`overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none ${
                        isExpanded
                          ? 'border-purple-300 shadow-md'
                          : 'border-slate-200 shadow-sm hover:border-purple-200 hover:shadow-md'
                      }`}
                    >
                      <button
                        type="button"
                        className="relative flex h-11 w-full cursor-pointer items-center overflow-hidden bg-slate-100 px-3 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-inset"
                        onClick={() => {
                          setExpandedDivisions(prev =>
                            isExpanded
                              ? prev.filter(d => d !== div.division)
                              : [...prev, div.division]
                          );
                        }}
                        aria-expanded={isExpanded}
                        aria-label={`Division ${div.division}: ${div.count} pupils, ${div.percentage} percent. ${isExpanded ? 'Collapse pupil details' : 'Expand pupil details'}.`}
                      >
                        <span
                          className={`absolute inset-y-0 left-0 ${getDivisionColor(div.division)}`}
                          style={{ width: `${div.percentage}%` }}
                          aria-hidden="true"
                        />
                        <span className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/35 to-white/90" aria-hidden="true" />
                        <span className="relative flex w-full items-center justify-between gap-2">
                          <span className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-xs font-black text-slate-900 shadow-sm">
                            Div {div.division}
                          </span>
                          <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-800">
                            <strong className="text-sm text-slate-950">{div.count}</strong> pupils · {div.percentage}%
                          </span>
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="p-2 border-t border-purple-200 bg-white">
                          <div className="space-y-1">
                            {(() => {
                              const divisionData = divisionAnalysis.find(d => d.division === div.division);
                              return divisionData?.pupils.map((pupil) => {
                                const pupilResult = processedResults.find(r => r.pupilInfo?.pupilId === pupil.pupilId);
                                return (
                                  <div key={pupil.pupilId} className="bg-gray-50 p-1.5 rounded border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="font-semibold text-gray-900 text-xs">{pupil.name}</div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs bg-blue-100 px-1 rounded">T:{pupil.totalMarks}</span>
                                        <span className="text-xs bg-purple-100 px-1 rounded">A:{pupil.totalAggregates}</span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                      {subjectSnaps?.slice(0, 4).map(subject => {
                                        const subjectResult = pupilResult?.results[subject.code];
                                        const marks = subjectResult?.marks !== undefined ? subjectResult.marks : '-';
                                        const grade = subjectResult?.grade;
                                        return (
                                          <div key={subject.code} className="bg-white p-1 rounded text-xs">
                                            <div className="flex items-center justify-between">
                                              <span className="font-medium text-gray-700">{subject.code}</span>
                                              <span className="font-bold text-gray-900">{marks}</span>
                                              {grade && (
                                                <Badge className={`${getGradeColor(grade)} text-xs px-1 py-0`}>
                                                  {grade}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Subject-wise Grade Distribution */}
          <Card className="overflow-hidden border-blue-200/80 bg-white/90 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-gray-900 sm:text-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Subject Performance Analysis
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Performance analysis sorted by average marks (best to worst)</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-1 sm:p-4 sm:pt-1">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {subjectGradeAnalysis
                  .sort((a, b) => parseFloat(b.averageMarks) - parseFloat(a.averageMarks))
                  .map((subject) => {
                    const isExpanded = expandedSubjects.includes(subject.code);
                    return (
                      <div
                        key={subject.code}
                        className={`overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none ${
                          isExpanded
                            ? 'border-blue-300 shadow-md'
                            : 'border-slate-200 shadow-sm hover:border-blue-200 hover:shadow-md'
                        }`}
                      >
                        <button
                          type="button"
                          className="flex h-11 w-full cursor-pointer items-center justify-between gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 text-left outline-none transition-colors hover:from-blue-100 hover:to-indigo-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                          onClick={() => {
                            setExpandedSubjects(prev =>
                              isExpanded
                                ? prev.filter(s => s !== subject.code)
                                : [...prev, subject.code]
                            );
                          }}
                          aria-expanded={isExpanded}
                          aria-label={`${subject.subject}, code ${subject.code}: average ${subject.averageMarks} marks across ${subject.totalPupils} pupils. ${isExpanded ? 'Collapse grade details' : 'Expand grade details'}.`}
                        >
                          <span className="rounded-md border border-blue-200 bg-white/90 px-2 py-1 text-xs font-black text-blue-950 shadow-sm">
                            {subject.code}
                          </span>
                          <span className="ml-auto whitespace-nowrap text-xs font-semibold tabular-nums text-slate-700">
                            <strong className="text-sm text-blue-950">{subject.averageMarks}</strong> avg · {subject.totalPupils} pupils
                          </span>
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                            : <ChevronDown className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />}
                        </button>

                        {isExpanded && (
                          <div className="border-t border-blue-200 bg-blue-50/30 p-2">
                          <div className="space-y-3">
                            {subject.gradeDistribution.map((gradeData) => {
                              const gradeKey = `${subject.code}-${gradeData.grade}`;
                              const isExpanded = expandedGrades.includes(gradeKey);

                              return (
                                <div key={gradeData.grade} className="bg-gray-50 rounded-lg p-2">
                                  <div
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors p-2 rounded"
                                    onClick={() => {
                                      setExpandedGrades(prev =>
                                        isExpanded
                                          ? prev.filter(g => g !== gradeKey)
                                          : [...prev, gradeKey]
                                      );
                                    }}
                                  >
                                    <div className="flex items-center gap-3 flex-1">
                                      <Badge className={`${getGradeColor(gradeData.grade)} px-3 py-1 font-bold ${isExpanded ? 'ring-2 ring-blue-300' : ''}`}>
                                        {gradeData.grade}
                                      </Badge>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <div className="text-lg font-bold text-gray-900">{gradeData.count}</div>
                                          <div className="text-sm text-gray-500">pupils ({gradeData.percentage.toFixed(1)}%)</div>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                          <div
                                            className={`h-1.5 rounded-full ${getGradeColor(gradeData.grade).split(' ')[0].replace('bg-', 'bg-').replace('-100', '-500')}`}
                                            style={{ width: `${gradeData.percentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </div>

                                  {isExpanded && (
                                    <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                                      <div className="grid grid-cols-1 gap-2">
                                        {gradeData.pupils.map((pupil) => (
                                          <div key={pupil.pupilId} className="bg-gray-50 p-2 rounded text-xs">
                                            <div className="font-semibold text-gray-900">{pupil.name}</div>
                                            <div className="text-xs text-gray-500">{pupil.admissionNumber}</div>
                                            <Badge variant="outline" className="text-xs mt-1">
                                              {pupil.marks} marks
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
      </main>
    </div>
  );
}
