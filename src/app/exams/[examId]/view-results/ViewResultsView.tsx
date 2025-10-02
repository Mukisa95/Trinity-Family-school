"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  TrendingDown
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
import { useExams } from '@/lib/hooks/use-exams';
import { useExamResultByExamId } from '@/lib/hooks/use-exams';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
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
import { generateModernBatchReportPDF } from '@/components/exam/ModernBatchReportPDF';
import { generateDetailedAssessmentPDF } from '@/components/exam/DetailedAssessmentPDF';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ExamSignatureDisplay } from '@/components/exam/ExamSignatureDisplay';
import { useReleaseInfo, useReleaseResults, useRevokeResults, useReleaseAllResults } from '@/lib/hooks/use-results-release';
import { useAuth } from '@/lib/contexts/auth-context';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Unlock, Send, Users } from 'lucide-react';
import { AdminPasswordModal } from '@/components/exam/AdminPasswordModal';
import { getNextTermDates } from '@/lib/utils/academic-year-utils';
import TerminalReport from '@/components/exam/PupilReportCardPDF2';
import { pdf } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
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
  results: Record<string, { marks: number; grade: string; aggregates: number }>;
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

// Enhanced dynamic commentary system with division-based comments
const DYNAMIC_COMMENTS = {
  class_teacher: {
    // Division I - Outstanding (Aggregate 4-12)
    division_I: [
      "I am delighted with this outstanding performance, [Name].",
      "Thank you for your consistent effort and exceptional results, [Name].",
      "[Name], your dedication has produced remarkable outcomes.",
      "I am proud of your exemplary achievement this term, [Name].",
      "Well done on maintaining such a high standard of work, [Name].",
      "Your hard work is clearly reflected in these excellent results, [Name].",
      "Congratulations on achieving such a superb aggregate, [Name].",
      "Your enthusiasm and commitment are truly commendable, [Name].",
      "I appreciate the enthusiasm you bring to every lesson, [Name].",
      "Keep up this brilliant level of performance, [Name].",
      "Your focus and determination have paid off handsomely, [Name].",
      "Thank you for setting such an impressive example for your peers, [Name].",
      "You have demonstrated exceptional mastery of the material, [Name].",
      "Your work ethic has been nothing short of inspiring, [Name].",
      "I value the positive attitude you display every day, [Name].",
      "You consistently exceed our expectations—well done, [Name].",
      "Your achievements this term are a testament to your perseverance, [Name].",
      "Keep up this wonderful momentum, [Name].",
      "I am thrilled by the quality of your contributions in class, [Name].",
      "This level of performance is truly outstanding—congratulations, [Name]!"
    ],
    
    // Division II - Very Good (Aggregate 13-25)
    division_II: [
      "Well done on this commendable performance, [Name].",
      "Your hard work is paying off nicely, [Name].",
      "[Name], you have shown good progress this term.",
      "I'm pleased with your steady improvement, [Name].",
      "Keep up the good work, [Name]—you're on the right track.",
      "Your effort and dedication are evident in these results, [Name].",
      "Good job, [Name]! Continue working at this pace.",
      "You've demonstrated solid understanding, [Name].",
      "I appreciate your consistent participation, [Name].",
      "Your performance shows promise, [Name].",
      "Well done, [Name]—maintain this level of effort.",
      "You're making good progress, [Name]. Keep it up!",
      "Your results reflect your commitment, [Name].",
      "Good work this term, [Name]. Stay focused!",
      "You've shown good improvement, [Name].",
      "I'm encouraged by your performance, [Name].",
      "[Name], your steady progress is commendable.",
      "Keep working hard, [Name]—it's paying off.",
      "Your dedication is showing positive results, [Name].",
      "Well done, [Name]. Continue with the same energy!"
    ],
    
    // Division III - Satisfactory (Aggregate 26-30)
    division_III: [
      "[Name], you have the potential to do better.",
      "More focus is needed to improve your performance, [Name].",
      "Work harder next term to achieve better results, [Name].",
      "[Name], I know you can perform better with more effort.",
      "Put in more effort to reach your full potential, [Name].",
      "With increased dedication, you can improve, [Name].",
      "[Name], focus more on your studies for better results.",
      "I encourage you to work harder next term, [Name].",
      "Your performance can improve with more effort, [Name].",
      "[Name], strive for better results next term.",
      "More commitment is needed for improvement, [Name].",
      "Work consistently to see better outcomes, [Name].",
      "[Name], your potential is higher than these results show.",
      "Apply yourself more for better performance, [Name].",
      "With determination, you can achieve more, [Name].",
      "[Name], focus on areas that need improvement.",
      "More regular study habits will help, [Name].",
      "I believe you can do better with effort, [Name].",
      "[Name], work on strengthening your weak areas.",
      "Consistent effort will lead to improvement, [Name]."
    ],
    
    // Division IV & U - Needs Improvement (Aggregate 31+)
    division_IV_U: [
      "[Name], significant improvement is needed in your studies.",
      "Please seek extra help to improve your performance, [Name].",
      "[Name], more dedicated effort is urgently required.",
      "I recommend additional support for [Name] next term.",
      "[Name], focus seriously on your academics.",
      "Extra attention and effort are needed, [Name].",
      "[Name], please take your studies more seriously.",
      "Seek help from teachers and parents, [Name].",
      "[Name], significant changes in study habits are needed.",
      "More time and effort must be devoted to studies, [Name].",
      "[Name], please utilize available academic support.",
      "Consistent daily study is essential, [Name].",
      "[Name], work closely with teachers for improvement.",
      "Regular revision and practice are crucial, [Name].",
      "[Name], don't hesitate to ask for help when needed.",
      "Form good study partnerships with classmates, [Name].",
      "[Name], create a structured study schedule.",
      "Please attend extra lessons if available, [Name].",
      "[Name], your academic success requires immediate attention.",
      "Work with your parents to create a study plan, [Name]."
    ]
  },
  
  head_teacher: {
    // Division I - Outstanding (Aggregate 4-12)
    division_I: [
      "Congratulations on this outstanding achievement, [Name].",
      "Your dedication has produced superb results, [Name].",
      "Well done on maintaining such a high standard of work, [Name].",
      "Your hard work shines through these excellent results, [Name].",
      "I'm proud of your exemplary performance this term, [Name].",
      "You've set a wonderful example for your classmates, [Name].",
      "Such consistent excellence is truly impressive, [Name].",
      "Keep up this brilliant level of achievement, [Name].",
      "Your focus and perseverance have paid off handsomely, [Name].",
      "I appreciate the enthusiasm you bring to every lesson, [Name].",
      "Your mastery of the material is outstanding, [Name].",
      "You've exceeded all expectations—congratulations, [Name]!",
      "Exceptional work like this deserves to be celebrated, [Name].",
      "Your commitment to learning is admirable, [Name].",
      "This level of success reflects your hard work, [Name].",
      "Your results are a testament to your effort, [Name].",
      "I'm thrilled by the quality of your contributions, [Name].",
      "Keep riding this wave of excellence, [Name].",
      "You've raised the bar for yourself this term, [Name].",
      "Fantastic performance—keep it going, [Name]!"
    ],
    
    // Division II - Very Good (Aggregate 13-25)
    division_II: [
      "Good work, [Name]. Continue with this positive trend.",
      "Your performance shows steady improvement, [Name].",
      "Well done, [Name]. Keep up the momentum!",
      "I'm pleased with your consistent effort, [Name].",
      "[Name], your dedication is reflected in these results.",
      "Good job this term, [Name]. Stay focused!",
      "Your hard work is beginning to pay off, [Name].",
      "[Name], continue working with this determination.",
      "You're making good progress, [Name]. Well done!",
      "Keep up the good work, [Name].",
      "Your efforts are showing positive results, [Name].",
      "[Name], maintain this level of commitment.",
      "Good performance, [Name]. Aim even higher!",
      "Your consistency is commendable, [Name].",
      "[Name], you're on the right path to success.",
      "Well done, [Name]. Keep pushing forward!",
      "Your improvement is evident, [Name].",
      "[Name], continue with this positive attitude.",
      "Good work, [Name]. Strive for excellence!",
      "Your dedication is paying off, [Name]."
    ],
    
    // Division III - Satisfactory (Aggregate 26-30)
    division_III: [
      "[Name], there's room for improvement in your performance.",
      "Work harder next term to achieve better results, [Name].",
      "[Name], I know you have the potential to do better.",
      "More consistent effort is needed, [Name].",
      "[Name], focus on improving your weak subjects.",
      "Seek additional help where needed, [Name].",
      "[Name], your performance needs enhancement.",
      "Put in extra effort to reach your potential, [Name].",
      "[Name], work more consistently for better outcomes.",
      "I expect improved performance next term, [Name].",
      "[Name], dedicate more time to your studies.",
      "Work on developing better study habits, [Name].",
      "[Name], strive for higher achievement.",
      "More focused effort will yield better results, [Name].",
      "[Name], take advantage of available academic support.",
      "Improve your time management skills, [Name].",
      "[Name], work closely with your teachers.",
      "Set higher academic goals for yourself, [Name].",
      "[Name], your results don't reflect your true ability.",
      "Apply yourself more seriously to your studies, [Name]."
    ],
    
    // Division IV & U - Needs Improvement (Aggregate 31+)
    division_IV_U: [
      "[Name], immediate improvement in academics is required.",
      "Serious academic intervention is needed for [Name].",
      "[Name], please take urgent steps to improve your performance.",
      "Academic support and counseling are recommended for [Name].",
      "[Name], your current performance is concerning.",
      "Please work closely with parents and teachers, [Name].",
      "[Name], significant changes in approach are needed.",
      "Attend remedial classes to strengthen your foundation, [Name].",
      "[Name], seek immediate academic assistance.",
      "Your academic progress requires urgent attention, [Name].",
      "[Name], develop a comprehensive improvement plan.",
      "Regular monitoring and support are essential, [Name].",
      "[Name], utilize all available academic resources.",
      "Please consider repeating challenging subjects, [Name].",
      "[Name], work with a tutor if possible.",
      "Consistent daily effort is crucial for improvement, [Name].",
      "[Name], don't lose hope—improvement is possible.",
      "Seek guidance from senior students and mentors, [Name].",
      "[Name], your academic future depends on immediate action.",
      "Create a structured study environment at home, [Name]."
    ]
  }
};

// Helper function to determine division category for comments
const getDivisionCategory = (division: string): string => {
  switch (division) {
    case 'I':
      return 'division_I';
    case 'II':
      return 'division_II';
    case 'III':
      return 'division_III';
    case 'IV':
    case 'U':
      return 'division_IV_U';
    default:
      return 'division_III'; // Default to satisfactory
  }
};

// Helper function to properly capitalize names
const toProperCase = (name: string): string => {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

// Helper function to substitute name placeholders
const substituteName = (comment: string, name: string): string => {
  const properCaseName = toProperCase(name);
  return comment.replace(/\[Name\]/g, properCaseName);
};

// Helper function to get a random comment from array
const getRandomComment = (comments: string[]): string => {
  const randomIndex = Math.floor(Math.random() * comments.length);
  return comments[randomIndex];
};

// Enhanced function to generate class teacher report with dynamic comments
const generateClassTeacherReport = (result: any): string => {
  const divisionCategory = getDivisionCategory(result.division);
  const comments = DYNAMIC_COMMENTS.class_teacher[divisionCategory] || DYNAMIC_COMMENTS.class_teacher.division_III;
  const randomComment = getRandomComment(comments);
  return substituteName(randomComment, result.pupilInfo.name);
};

// Enhanced function to generate head teacher report with dynamic comments
const generateHeadTeacherReport = (result: any): string => {
  const divisionCategory = getDivisionCategory(result.division);
  const comments = DYNAMIC_COMMENTS.head_teacher[divisionCategory] || DYNAMIC_COMMENTS.head_teacher.division_III;
  const randomComment = getRandomComment(comments);
  return substituteName(randomComment, result.pupilInfo.name);
};

// Helper function to validate if a photo is a real photo (not placeholder)
const isRealPhoto = (photo?: string): boolean => {
  return !!(photo && 
    photo !== 'NO PHOTO' && 
    photo.trim() !== '' && 
    photo !== 'https://placehold.co/128x128.png' &&
    !photo.includes('ui-avatars.com') && // Exclude generated avatars
    (photo.startsWith('http') || photo.startsWith('data:') || photo.startsWith('blob:')));
};

// Add new PrintModal component
const PrintModal = ({ 
  isOpen, 
  onClose, 
  onPrintAssessment, 
  onPrintReportOne, 
  onPrintNurseryReport,
  isGenerating,
  generationStatus,
  generationProgress,
  eta
}: {
  isOpen: boolean;
  onClose: () => void;
  onPrintAssessment: () => void;
  onPrintReportOne: () => void;
  onPrintNurseryReport: () => void;
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
            <button
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
            </button>
            
            <button
              onClick={onPrintReportOne}
              className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileTextIcon className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Report</h3>
                  <p className="text-sm text-gray-600">Individual pupil reports</p>
                </div>
              </div>
            </button>
            
            <button
              onClick={onPrintNurseryReport}
              className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileTextIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Breakdown</h3>
                  <p className="text-sm text-gray-600">Detailed subject breakdown</p>
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

export default function ViewResultsView() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  // Get exam ID directly from params
  const examId = params.examId as string;
  const classId = searchParams.get('classId');

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
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showProgressiveExamModal, setShowProgressiveExamModal] = useState(false);
  const [selectedProgressiveExam, setSelectedProgressiveExam] = useState<string | null>(null);
  const [progressiveExams, setProgressiveExams] = useState<any[]>([]);

  // Results release state
  const [selectedPupils, setSelectedPupils] = useState<string[]>([]);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [eta, setEta] = useState<string>('');

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
  const { data: academicYears = [] } = useAcademicYears();
  const { 
    data: examResultData, 
    isLoading: isLoadingExamResult, 
    error: examResultError 
  } = useExamResultByExamId(examId);

  // Results release hooks
  const { data: releaseInfo } = useReleaseInfo(examId, classId || '');
  const releaseResultsMutation = useReleaseResults();
  const revokeResultsMutation = useRevokeResults();
  const releaseAllMutation = useReleaseAllResults();

  const examDetails = useMemo(() => {
    if (!examId || exams.length === 0) return undefined;
    return exams.find(exam => exam.id === examId);
  }, [exams, examId]);

  const classSnap = useMemo(() => examResultData?.classSnapshot, [examResultData]);
  const pupilSnaps = useMemo(() => examResultData?.pupilSnapshots || [], [examResultData]);
  const subjectSnaps = useMemo(() => examResultData?.subjectSnapshots || [], [examResultData]);

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
      const processedSubjectResults: Record<string, { marks: number; grade: string; aggregates: number }> = {};

      // Initialize all subjects first to ensure none are missed (especially Math)
      subjectSnaps.forEach(subject => {
        const isMajorSubject = majorSubjects.includes(subject.code);
        processedSubjectResults[subject.code] = {
          marks: 0,
          grade: 'F9',
          aggregates: isMajorSubject ? 9 : 0 // Only major subjects get aggregates > 0
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
          
          processedSubjectResults[subject.code] = {
            marks: result.status === 'missed' ? 0 : (result.marks || 0),
            grade: result.status === 'missed' ? 'MISSED' : (result.grade || 'F9'),
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
    
    if (needToAssignPositions) {
      console.log('Recalculating positions based on total marks');
    // Sort by total marks (descending) and assign positions
    results.sort((a, b) => b.totalMarks - a.totalMarks);
    results.forEach((result, index) => {
      result.position = index + 1;
    });
    }

    return results;
  }, [examResultData, pupilSnaps, subjectSnaps]);

  // Calculate analytics
  const analytics = useMemo<Analytics | null>(() => {
    if (!processedResults.length || !subjectSnaps.length) return null;

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
  }, [processedResults, subjectSnaps, examDetails]);

  // Filter and sort results
  const filteredAndSortedResults = useMemo(() => {
    if (!processedResults) return [];

    let filtered = processedResults.filter(result => {
      const pupilName = result.pupilInfo?.name || '';
      const admissionNumber = result.pupilInfo?.admissionNumber || '';
      
      const matchesSearch = pupilName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          admissionNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesMarks = (!filters.minMarks || result.totalMarks >= Number(filters.minMarks)) &&
                          (!filters.maxMarks || result.totalMarks <= Number(filters.maxMarks));
      
      const matchesGrade = filters.grade === 'all' || !filters.grade || Object.values(result.results).some(subject => subject?.grade === filters.grade);
      
      const matchesDivision = filters.division === 'all' || !filters.division || result.division === filters.division;
      
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
  }, [processedResults, searchTerm, filters, sortField, sortDirection]);

  // No pagination - show all results
  const displayedResults = filteredAndSortedResults;

  const handleViewDetails = useCallback((pupilId: string) => {
    router.push(`/exams/${examId}/pupil-results/${pupilId}`);
  }, [examId, router]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

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

  const handleExportAssessment = useCallback(async () => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !processedResults.length) {
      toast({ title: "Error", description: "Missing required data for PDF generation" });
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');
    
    try {
      updateProgress(15, 'Preparing assessment data...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get major subjects from the saved exam result data
      const savedMajorSubjects = examResultData?.majorSubjects || [];
      const majorSubjects = savedMajorSubjects.length > 0 
        ? savedMajorSubjects 
        : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));
      
      updateProgress(35, 'Processing exam results...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const adaptedData = adaptExamDataForPDF(examDetails, classSnap, subjectSnaps, processedResults, majorSubjects);
      
      updateProgress(65, 'Generating PDF document...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate the PDF with school settings
      await generateExamPDF({
        ...adaptedData,
        schoolSettings
      });
      
      updateProgress(95, 'Finalizing document...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setGenerationProgress(100);
      setEta('Complete!');
      
      toast({ title: "Success", description: "Assessment PDF generated successfully!" });
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
  }, [examDetails, classSnap, subjectSnaps, processedResults, schoolSettings, examResultData, toast, updateProgress]);

  const handleReportOne = useCallback(async () => {
    if (!examDetails || !classSnap || !subjectSnaps.length || !processedResults.length) {
      toast({ title: "Error", description: "Missing required data for modern batch reports generation" });
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');
    
    try {
      updateProgress(10, 'Preparing modern report data...');
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Get major subjects from the saved exam result data
      const savedMajorSubjects = examResultData?.majorSubjects || [];
      const majorSubjects = savedMajorSubjects.length > 0 
        ? savedMajorSubjects 
        : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));

      updateProgress(20, 'Processing academic year and term data...');
      await new Promise(resolve => setTimeout(resolve, 400));

      // Get the exact academic year and term information that was saved with the exam
      const { academicYearName, termName } = getAcademicYearAndTerm(
        examDetails.academicYearId || '',
        examDetails.termId || ''
      );

      // Calculate dynamic next term dates based on exam's academic year and term
      const nextTermDates = getNextTermDates(
        examDetails.academicYearId || '',
        examDetails.termId || '',
        academicYears
      );

      updateProgress(30, 'Fetching pupil photos and data...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Prepare data for modern batch report
      const prepareProcessedResults = async () => {
        console.log('📷 Starting photo fetching process for', processedResults.length, 'pupils');
        
        return await Promise.all(processedResults.map(async (result, index) => {
          // Fetch pupil photo if not available in the snapshot
          let pupilPhoto = (result.pupilInfo as any).photo;
          const pupilName = result.pupilInfo.name;
          const pupilId = result.pupilInfo.pupilId;
          
          console.log(`📷 [${index + 1}] Processing ${pupilName} (ID: ${pupilId})`);
          console.log(`📷 [${index + 1}] Photo in snapshot:`, pupilPhoto ? 'YES' : 'NO');
          
          // If no real photo in snapshot, try to fetch from the database
          if (!isRealPhoto(pupilPhoto)) {
            try {
              console.log(`📷 [${index + 1}] Fetching from API: /api/pupils/${pupilId}`);
              
              const pupilResponse = await fetch(`/api/pupils/${pupilId}`);
              console.log(`📷 [${index + 1}] API Response status:`, pupilResponse.status);
              
              if (pupilResponse.ok) {
                const pupilData = await pupilResponse.json();
                console.log(`📷 [${index + 1}] API returned data keys:`, Object.keys(pupilData));
                
                pupilPhoto = pupilData.photo || pupilData.photoUrl;
                
                if (isRealPhoto(pupilPhoto)) {
                  console.log(`📷 [${index + 1}] ✅ Real photo found via API:`, pupilPhoto.substring(0, 50) + '...');
                } else {
                  console.log(`📷 [${index + 1}] ⚠️ No real photo found, leaving empty`);
                  pupilPhoto = null; // Set to null instead of creating placeholder
                }
              } else {
                console.warn(`📷 [${index + 1}] ❌ API call failed. Status: ${pupilResponse.status}, leaving photo empty`);
                pupilPhoto = null; // Set to null instead of creating placeholder
              }
            } catch (fetchError) {
              console.error(`📷 [${index + 1}] ❌ Fetch failed for ${pupilName}:`, fetchError);
              pupilPhoto = null; // Set to null instead of creating placeholder
            }
          } else {
            console.log(`📷 [${index + 1}] ✅ Real photo already in snapshot:`, pupilPhoto.substring(0, 50) + '...');
            // Keep the existing real photo
          }
          
          console.log(`📷 [${index + 1}] Final photo result:`, pupilPhoto);
          
          return {
            ...result,
            pupilInfo: {
              ...result.pupilInfo,
              age: result.pupilInfo.ageAtExam || 12,
              photo: pupilPhoto,
              dateOfBirth: result.pupilInfo.dateOfBirth || undefined
            }
          };
        }));
      };

      const enhancedProcessedResults = await prepareProcessedResults();

      updateProgress(50, 'Fetching teacher information...');
      await new Promise(resolve => setTimeout(resolve, 800));

      // Fetch teacher names for subjects that have teacherId
      const enhancedSubjectSnaps = await Promise.all(
        subjectSnaps.map(async (subject) => {
          if (subject.teacherId) {
            try {
              const teacherResponse = await fetch(`/api/staff/${subject.teacherId}`);
              if (teacherResponse.ok) {
                const teacherData = await teacherResponse.json();
                const teacherName = `${teacherData.firstName} ${teacherData.lastName}`.trim();
                return {
                  ...subject,
                  teacherName,
                  fullMarks: 100 // Default full marks
                };
              } else {
                console.warn(`Failed to fetch teacher data for teacherId: ${subject.teacherId}`);
                return {
                  ...subject,
                  teacherName: 'Unknown Teacher',
                  fullMarks: 100
                };
              }
            } catch (error) {
              console.error(`Error fetching teacher data for teacherId: ${subject.teacherId}:`, error);
              return {
                ...subject,
                teacherName: 'Unknown Teacher',
                fullMarks: 100
              };
            }
          } else {
            return {
              ...subject,
              teacherName: 'Not Assigned',
              fullMarks: 100
            };
          }
        })
      );

      updateProgress(70, 'Preparing grading scale...');
      await new Promise(resolve => setTimeout(resolve, 300));

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
        majorSubjects,
        gradingScale: actualGradingScale,
        nextTermInfo: nextTermDates ? {
          startDate: nextTermDates.nextTermBegins,
          endDate: nextTermDates.nextTermEnds
        } : undefined,
        classTeacherInfo: {
          name: 'Class Teacher' // Default name, can be enhanced with actual teacher data
        }
      };

      updateProgress(85, 'Generating modern batch report PDF...');
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Generate the modern batch report PDF
      await generateModernBatchReportPDF(modernBatchData);
      
      updateProgress(95, 'Finalizing document...');
      await new Promise(resolve => setTimeout(resolve, 400));
      
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

  const handleNurseryReport = useCallback(async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');
    
    try {
      updateProgress(20, 'Preparing detailed assessment data...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Prepare enhanced processed results with photos
      const prepareProcessedResults = async () => {
        return await Promise.all(processedResults.map(async (result, index) => {
          // Fetch pupil photo if not available in the snapshot
          let pupilPhoto = (result.pupilInfo as any).photo;
          const pupilName = result.pupilInfo.name;
          const pupilId = result.pupilInfo.pupilId;
          
          // If no real photo in snapshot, try to fetch from the database
          if (!isRealPhoto(pupilPhoto)) {
            try {
              const pupilResponse = await fetch(`/api/pupils/${pupilId}`);
              if (pupilResponse.ok) {
                const pupilData = await pupilResponse.json();
                pupilPhoto = pupilData.photo || pupilData.photoUrl;
                
                if (!isRealPhoto(pupilPhoto)) {
                  pupilPhoto = null;
                }
              } else {
                pupilPhoto = null;
              }
            } catch (fetchError) {
              pupilPhoto = null;
            }
          }
          
          return {
            ...result,
            pupilInfo: {
              ...result.pupilInfo,
              age: result.pupilInfo.ageAtExam || 12,
              photo: pupilPhoto,
              dateOfBirth: result.pupilInfo.dateOfBirth || undefined
            }
          };
        }));
      };

      const enhancedProcessedResults = await prepareProcessedResults();
      
      updateProgress(50, 'Processing pupil information...');
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Fetch teacher names for subjects that have teacherId
      const enhancedSubjectSnaps = await Promise.all(
        subjectSnaps.map(async (subject) => {
          if (subject.teacherId) {
            try {
              const teacherResponse = await fetch(`/api/staff/${subject.teacherId}`);
              if (teacherResponse.ok) {
                const teacherData = await teacherResponse.json();
                const teacherName = `${teacherData.firstName} ${teacherData.lastName}`.trim();
                return {
                  ...subject,
                  teacherName,
                  fullMarks: 100 // Default full marks
                };
              } else {
                return {
                  ...subject,
                  teacherName: 'Unknown Teacher',
                  fullMarks: 100
                };
              }
            } catch (error) {
              return {
                ...subject,
                teacherName: 'Unknown Teacher',
                fullMarks: 100
              };
            }
          } else {
            return {
              ...subject,
              teacherName: 'Not Assigned',
              fullMarks: 100
            };
          }
        })
      );
      
      updateProgress(75, 'Generating detailed assessment PDF...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updateProgress(90, 'Finalizing detailed assessment...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get academic year and term names like Modern Report does
      const { academicYearName, termName } = getAcademicYearAndTerm(
        examDetails?.academicYearId || '', 
        examDetails?.termId || ''
      );
      
      // Generate the Detailed Assessment PDF with same data as Modern Report
      await generateDetailedAssessmentPDF({
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
        gradingScale: DEFAULT_GRADING_SCALE
      });
      
      setGenerationProgress(100);
      setEta('Complete!');
      
      toast({ title: "Success", description: "Detailed Assessment PDF generated successfully!" });
    } catch (error) {
      console.error("Error generating detailed assessment:", error);
      toast({ title: "Error", description: "Failed to generate detailed assessment. Please try again." });
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
  }, [examDetails, classSnap, subjectSnaps, processedResults, schoolSettings, examResultData, academicYears, toast, getAcademicYearAndTerm, updateProgress]);

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
    toast({ title: "Success", description: "Pupil reports generated successfully!" });
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

  if (!examId || isLoadingExams || isLoadingExamResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-lg text-gray-700">Loading exam results...</p>
        </div>
      </div>
    );
  }

  if (examResultError) {
     return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <X className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Error loading exam results</h2>
          <p className="mt-2 text-gray-500">{(examResultError as Error)?.message || "Please try again later."}</p>
        <Button onClick={() => router.push('/exams')} className="mt-6">Back to Exams</Button>
        </div>
      </div>
    );
  }
  
  if (!examDetails || !examResultData || !processedResults.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-orange-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">No Results Found</h2>
          <p className="mt-2 text-gray-500">
          {!examResultData ? "No results have been recorded for this exam yet." : "No pupil results found."}
        </p>
        <Button onClick={() => router.push('/exams')} className="mt-6">Back to Exams</Button>
        </div>
      </div>
    );
  }

  const academicInfo = getAcademicYearAndTerm(examDetails?.academicYearId || '', examDetails?.termId || '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-2">
      <div className="max-w-7xl mx-auto">
        {/* Compact Header Card */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 border-b border-gray-200">
            <div className="flex justify-between items-start gap-2">
            <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold text-white truncate">
                  {examDetails?.name || 'Loading...'} - {examDetails?.examTypeName ? examDetails.examTypeName.toUpperCase() + ' RESULTS' : 'RESULTS'}
                </h1>
                <p className="text-xs text-blue-100 truncate">
                  {examDetails?.examTypeName || 'Loading...'} | Class: {classSnap?.name || 'Loading...'} | 
                  {' '}{academicInfo.academicYearName} - {academicInfo.termName} |
                  {' '}{examDetails?.startDate ? new Date(examDetails.startDate).toLocaleDateString() : ''} - 
                  {examDetails?.endDate ? new Date(examDetails.endDate).toLocaleDateString() : ''}
                </p>
                {examDetails && (
                  <div className="mt-1">
                    <ExamSignatureDisplay exam={examDetails} variant="inline" className="text-xs text-blue-100" />
                  </div>
                )}
            </div>
              <div className="flex flex-wrap items-center gap-1">
                <Button 
                  onClick={() => router.back()}
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-7 text-xs px-2"
                  variant="outline"
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                        Back
                </Button>
                <Link href={`/exams/${examId}/record-results?classId=${classId}`}>
                <Button 
                        size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white h-7 text-xs px-2"
                      >
                    <Edit3 className="w-3 h-3 mr-1" />
                    Edit
                </Button>
                </Link>
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-7 text-xs px-2"
                        variant="outline"
                      >
                  <Filter className="w-3 h-3 mr-1" />
                  {showFilters ? 'Hide' : 'Show'}
                </Button>
                <Button
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-7 text-xs px-2"
                  variant="outline"
                  onClick={() => setShowPrintModal(true)}
                >
                  <Printer className="w-3 h-3 mr-1" />
                  Print
                </Button>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs px-2"
                  onClick={() => setShowAnalysis(true)}
                >
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Analysis
                </Button>
              </div>
            </div>
          </div>

          {/* Compact Analytics Tiles */}
          {analytics && (
            <div className="p-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-md p-2 border border-green-100">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-medium text-green-800">Best</h3>
                  <Trophy className="w-3 h-3 text-green-600" />
                </div>
                <div className="text-sm font-semibold text-green-900 truncate">{analytics.bestPupil.name}</div>
                <div className="text-xs text-green-600">
                  {analytics.bestPupil.totalMarks} marks | Agg: {analytics.bestPupil.totalAggregates} | Div {calculateDivision(analytics.bestPupil.totalAggregates)}
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-2 sm:p-3 border border-red-100">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-medium text-red-800">Needs Improvement</h3>
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                </div>
                <div className="text-sm sm:text-base font-semibold text-red-900 truncate">{analytics.worstPupil.name}</div>
                <div className="text-xs text-red-600">
                  {analytics.worstPupil.totalMarks} marks | Agg: {analytics.worstPupil.totalAggregates} | Div {calculateDivision(analytics.worstPupil.totalAggregates)}
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-2 sm:p-3 border border-blue-100">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-medium text-blue-800">Best Subject</h3>
                  <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                </div>
                <div className="text-sm sm:text-base font-semibold text-blue-900 truncate">{analytics.bestSubject.name}</div>
                <div className="text-xs text-blue-600">
                  Avg: {analytics.bestSubject.averageMarks.toFixed(1)}%
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-2 sm:p-3 border border-purple-100">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-medium text-purple-800">Worst Subject</h3>
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600" />
                </div>
                <div className="text-sm sm:text-base font-semibold text-purple-900 truncate">{analytics.worstSubject.name}</div>
                <div className="text-xs text-purple-600">
                  Avg: {analytics.worstSubject.averageMarks.toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {/* Filters Section */}
          {showFilters && (
            <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Min Marks</label>
                  <Input
                    type="number"
                    value={filters.minMarks}
                    onChange={(e) => setFilters(prev => ({ ...prev, minMarks: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Min..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Max Marks</label>
                  <Input
                    type="number"
                    value={filters.maxMarks}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxMarks: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Max..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Grade</label>
                  <Select value={filters.grade} onValueChange={(value) => setFilters(prev => ({ ...prev, grade: value === "all" ? "" : value }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {['D1', 'D2', 'C3', 'C4', 'C5', 'C6', 'P7', 'P8', 'F9'].map(grade => (
                        <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
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
                </div>
              </div>
              
              {/* Major Subjects Legend */}
              {subjectSnaps && subjectSnaps.length > 4 && (examResultData?.majorSubjects && examResultData.majorSubjects.length > 0) && (
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
            </div>
          )}
        </div>

        {/* Compact Results Table */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
              <div className="relative flex-1 max-w-sm">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <Search className="h-3 w-3 text-gray-400" />
                </div>
                <Input
                  type="text"
                  placeholder="Search pupils..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-7 h-8 text-xs"
                />
                <div className="text-xs text-gray-600 mt-1">
                  Showing {filteredAndSortedResults.length} of {processedResults.length} pupils
                </div>
                </div>

              <div className="flex items-center gap-2">
                {/* Compact View Mode Toggle - only show on desktop */}
                {!isMobile && (
                  <div className="flex items-center border rounded-md overflow-hidden">
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                      className="h-8 px-2 rounded-none"
                    >
                      <List className="w-3 h-3" />
                    </Button>
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('cards')}
                      className="h-8 px-2 rounded-none"
                    >
                      <Grid3X3 className="w-3 h-3" />
                    </Button>
              </div>
                )}

                {/* Compact Mobile Sorting - only show in card view */}
                {viewMode === 'cards' && (
                  <div className="flex items-center gap-1">
                    <Select value={sortField} onValueChange={setSortField}>
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue placeholder="Sort..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="position">Position</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="marks">Marks</SelectItem>
                        <SelectItem value="aggregates">Agg</SelectItem>
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
                )}
                </div>
                </div>

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
                      <div className="flex items-center justify-between mb-2">
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
                      </div>

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
                      <div className="grid grid-cols-2 gap-1 mb-2">
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
                      </div>

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
                                    {isMajorSubject && (
                                      <span className="text-xs text-blue-600 font-semibold" title="Major Subject">
                                        ★
                                      </span>
                                    )}
                                  </div>
                                  {isMajorSubject && subjectResult?.grade && (
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
                                  {subjectResult?.marks !== undefined ? subjectResult.marks : '-'}
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
                      <Checkbox
                        checked={selectedPupils.length === displayedResults.length && displayedResults.length > 0}
                        onCheckedChange={handleSelectAll}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3 w-3"
                      />
                      <span className="text-xs">Release</span>
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
                      <TableHead 
                        className="text-xs font-medium text-gray-600 uppercase tracking-wider text-center cursor-pointer hover:bg-blue-100 transition-colors py-2 px-2"
                        onClick={() => handleSort('marks')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Total
                          {getSortIcon('marks')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-xs font-medium text-gray-600 uppercase tracking-wider text-center cursor-pointer hover:bg-blue-100 transition-colors py-2 px-2"
                        onClick={() => handleSort('aggregates')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Agg
                          {getSortIcon('aggregates')}
                        </div>
                      </TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 uppercase tracking-wider text-center py-2 px-2">
                        Div
                      </TableHead>
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
                            </div>
                      </TableCell>
                          <TableCell className="sticky left-8 bg-inherit py-2 px-2">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-blue-600 truncate max-w-32">
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
                                    {subjectResult?.marks !== undefined ? subjectResult.marks : '-'}
                                  </div>
                              {isMajorSubject && (
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
                          <TableCell className="text-center py-2 px-2">
                            <span className="text-xs font-medium text-gray-900 bg-blue-50 px-1.5 py-0.5 rounded">
                        {result.totalMarks}
                            </span>
                      </TableCell>
                          <TableCell className="text-center py-2 px-2">
                            <span className="text-xs font-medium text-gray-900 bg-purple-50 px-1.5 py-0.5 rounded">
                        {result.totalAggregates}
                            </span>
                      </TableCell>
                      <TableCell className="text-center py-2 px-2">
                        <Badge 
                          variant="outline" 
                              className={`${getDivisionColor(division)} text-xs px-1 py-0`}
                        >
                          {division}
                        </Badge>
                      </TableCell>
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
        onPrintReportOne={handleReportOne}
        onPrintNurseryReport={handleNurseryReport}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
        generationProgress={generationProgress}
        eta={eta}
      />

      {/* Performance Analysis Modal */}
      <PerformanceAnalysisModal
        isOpen={showAnalysis}
        onClose={() => setShowAnalysis(false)}
        processedResults={processedResults}
        subjectSnaps={subjectSnaps || []}
        examDetails={examDetails}
      />
    </div>
  );
}

// Performance Analysis Modal Component
interface PerformanceAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  processedResults: any[];
  subjectSnaps: any[];
  examDetails: any;
}

function PerformanceAnalysisModal({ isOpen, onClose, processedResults, subjectSnaps, examDetails }: PerformanceAnalysisModalProps) {
  const [expandedDivision, setExpandedDivision] = useState<string | null>(null);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [expandedGrade, setExpandedGrade] = useState<string | null>(null);

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

    return {
      totalPupils,
      passRate,
      averageMarks,
      averageAggregates,
      topPerformer
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

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Performance Analysis
              </DialogTitle>
              <DialogDescription className="text-base mt-1">
                {examDetails?.name} - Comprehensive Performance Insights
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Overall Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4 text-center">
                <UsersIcon className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                <div className="text-xl font-bold text-blue-900">{overallStats.totalPupils}</div>
                <div className="text-xs text-blue-700">Total Pupils</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4 text-center">
                <Target className="h-5 w-5 text-green-600 mx-auto mb-2" />
                <div className="text-xl font-bold text-green-900">{overallStats.passRate}%</div>
                <div className="text-xs text-green-700">Pass Rate (I-IV)</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                <div className="text-xl font-bold text-purple-900">{overallStats.averageMarks}</div>
                <div className="text-xs text-purple-700">Avg. Marks</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="p-4 text-center">
                <Award className="h-5 w-5 text-amber-600 mx-auto mb-2" />
                <div className="text-xl font-bold text-amber-900">{overallStats.averageAggregates}</div>
                <div className="text-xs text-amber-700">Avg. Aggregates</div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performer Card */}
          {overallStats.topPerformer && (
            <Card className="bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 border-2 border-amber-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-6 w-6 text-yellow-600" />
                    <div>
                      <p className="text-xs font-medium text-amber-700">Top Performer</p>
                      <p className="text-lg font-bold text-amber-900">{overallStats.topPerformer.pupilInfo?.name}</p>
                      <p className="text-sm text-amber-600">{overallStats.topPerformer.pupilInfo?.admissionNumber}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-900">{overallStats.topPerformer.totalMarks}</p>
                    <p className="text-sm text-amber-700">marks</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Division Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-purple-600" />
                Class Division Breakdown
              </CardTitle>
              <CardDescription>Performance distribution by division</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {divisionAnalysis.map((div) => (
                  <div 
                    key={div.division} 
                    className="rounded-lg cursor-pointer hover:shadow-md transition-all p-3 bg-gradient-to-br from-purple-50 to-indigo-50"
                    onClick={() => setExpandedDivision(expandedDivision === div.division ? null : div.division)}
                  >
                    <div className="text-center">
                      <Badge className={`${getDivisionColor(div.division)} px-3 py-1 text-sm font-bold mb-2 w-full`}>
                        Div {div.division}
                      </Badge>
                      <div className="text-xl font-bold text-gray-900">{div.count}</div>
                      <div className="text-xs text-gray-500 mb-2">pupils</div>
                      <div className="text-sm font-semibold text-gray-700">{div.percentage}%</div>
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                        <div 
                          className={`h-1 rounded-full ${getDivisionColor(div.division)}`}
                          style={{ width: `${div.percentage}%` }}
                        />
                      </div>
                      {expandedDivision === div.division ? <ChevronUp className="h-4 w-4 mx-auto mt-2" /> : <ChevronDown className="h-4 w-4 mx-auto mt-2" />}
                    </div>
                  </div>
                ))}
              </div>

              {expandedDivision && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {(() => {
                    const divisionData = divisionAnalysis.find(d => d.division === expandedDivision);
                    if (!divisionData) return null;
                    
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-gray-900">
                            Division {expandedDivision} - {divisionData.count} pupils ({divisionData.percentage}%)
                          </span>
                          <button
                            onClick={() => setExpandedDivision(null)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                          {divisionData.pupils.map((pupil) => (
                            <div key={pupil.pupilId} className="bg-white p-2 rounded border border-gray-200">
                              <p className="font-semibold text-gray-900 text-xs">{pupil.name}</p>
                              <p className="text-xs text-gray-500">{pupil.admissionNumber}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {pupil.totalMarks}m
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {pupil.totalAggregates}a
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subject-wise Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Subject Performance Analysis
              </CardTitle>
              <CardDescription>Performance analysis sorted by average marks (best to worst)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {subjectGradeAnalysis
                  .sort((a, b) => parseFloat(b.averageMarks) - parseFloat(a.averageMarks))
                  .map((subject) => (
                  <div key={subject.code} className="border border-gray-200 rounded-lg p-3 bg-gradient-to-br from-blue-50 to-indigo-50 hover:shadow-md transition-all">
                    <div 
                      className="cursor-pointer"
                      onClick={() => setExpandedSubject(expandedSubject === subject.code ? null : subject.code)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-gray-900">{subject.subject}</div>
                        {expandedSubject === subject.code ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                      <p className="text-xs text-gray-500">{subject.code}</p>
                      <div className="mt-2 text-center">
                        <p className="text-2xl font-bold text-blue-900">{subject.averageMarks}</p>
                        <p className="text-xs text-gray-500">avg marks</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 text-center">{subject.totalPupils} pupils</p>
                    </div>

                    {expandedSubject === subject.code && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <div className="grid grid-cols-6 gap-1 mb-3">
                          {['D1', 'D2', 'C3', 'C4', 'C5', 'C6', 'P7', 'P8', 'F9'].map((grade) => {
                            const gradeData = subject.gradeDistribution.find(g => g.grade === grade);
                            const count = gradeData ? gradeData.count : 0;
                            const percentage = gradeData ? gradeData.percentage : 0;
                            
                            return (
                              <div key={grade} className="text-center">
                                <Badge 
                                  className={`${getGradeColor(grade)} px-2 py-1 text-xs font-bold mb-1 w-full`}
                                >
                                  {grade}
                                </Badge>
                                <div 
                                  className="text-sm font-bold text-gray-900 cursor-pointer hover:text-blue-600"
                                  onClick={() => setExpandedGrade(expandedGrade === `${subject.code}-${grade}` ? null : `${subject.code}-${grade}`)}
                                  title={gradeData ? `${count} pupils (${percentage.toFixed(1)}%)` : '0 pupils'}
                                >
                                  {count}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {expandedGrade && expandedGrade.startsWith(`${subject.code}-`) && (
                          <div className="bg-white rounded-lg border border-blue-200 p-2">
                            {(() => {
                              const expandedGradeData = subject.gradeDistribution.find(g => `${subject.code}-${g.grade}` === expandedGrade);
                              if (!expandedGradeData) return null;
                              
                              return (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-sm text-gray-900">
                                      {expandedGradeData.grade} Grade ({expandedGradeData.count} pupils)
                                    </span>
                                    <button
                                      onClick={() => setExpandedGrade(null)}
                                      className="text-gray-500 hover:text-gray-700"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                                    {expandedGradeData.pupils.map((pupil) => (
                                      <div key={pupil.pupilId} className="bg-gray-50 p-1 rounded text-xs">
                                        <p className="font-semibold text-gray-900 truncate">{pupil.name}</p>
                                        <p className="text-xs text-gray-500">{pupil.admissionNumber}</p>
                                        <Badge variant="outline" className="text-xs mt-1">
                                          {pupil.marks} marks
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="mt-6">
          <Button onClick={onClose} className="bg-purple-600 hover:bg-purple-700">
            Close Analysis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 