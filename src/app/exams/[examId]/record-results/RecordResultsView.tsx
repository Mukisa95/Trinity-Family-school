"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { X, ArrowLeft, Settings, Loader2, ChevronDown, Save, BookOpen, ChevronRight, ChevronLeft, Search, ArrowUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useExams } from '@/lib/hooks/use-exams';

import { useClasses } from '@/lib/hooks/use-classes';
import type { Exam, Pupil, Class, ExamResult as ImportedExamResult, ExamRecordPupilInfo, ExamRecordSubjectInfo, ExamClassInfoSnapshot, PupilSubjectResult, GradingScaleItem } from '@/types';
import { useExamResultByExamId, useUpdateExamResult } from '@/lib/hooks/use-exams';
import { ExamSignatureDisplay } from '@/components/exam/ExamSignatureDisplay';

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

// Compact Grading Scale Modal Component
function GradingScaleModal({ 
  isOpen, 
  onClose, 
  gradingScale, 
  onGradeScaleChange, 
  onSave 
}: {
  isOpen: boolean;
  onClose: () => void;
  gradingScale: GradingScaleItem[];
  onGradeScaleChange: (index: number, field: keyof GradingScaleItem, value: string | number) => void;
  onSave: () => void;
}) {
  const [localGradingScale, setLocalGradingScale] = useState<GradingScaleItem[]>(gradingScale);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [isValid, setIsValid] = useState(true);

  // Initialize local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalGradingScale([...gradingScale]);
      setValidationErrors({});
      setIsValid(true);
    }
  }, [isOpen, gradingScale]);

  // Validate grading scale for overlaps and gaps
  const validateGradingScale = useCallback((scale: GradingScaleItem[]) => {
    const errors: Record<number, string> = {};
    let hasErrors = false;

    // Sort by minMark for validation
    const sortedScale = [...scale].sort((a, b) => b.minMark - a.minMark);

    for (let i = 0; i < sortedScale.length; i++) {
      const current = sortedScale[i];
      const next = sortedScale[i + 1];

      // Check for invalid min/max values
      if (current.minMark < 0 || current.maxMark > 100) {
        errors[i] = "Min must be 0-100, Max must be 0-100";
        hasErrors = true;
      }

      // Check for min > max
      if (current.minMark > current.maxMark) {
        errors[i] = "Min cannot be greater than Max";
        hasErrors = true;
      }

      // Check for overlaps with next grade
      if (next && current.minMark <= next.maxMark) {
        const overlapMessage = `Overlaps with ${next.grade} (${next.minMark}-${next.maxMark})`;
        errors[i] = errors[i] ? `${errors[i]}; ${overlapMessage}` : overlapMessage;
        hasErrors = true;
      }

      // Check for overlaps with previous grade (if exists)
      const prev = sortedScale[i - 1];
      if (prev && current.maxMark >= prev.minMark) {
        const overlapMessage = `Overlaps with ${prev.grade} (${prev.minMark}-${prev.maxMark})`;
        errors[i] = errors[i] ? `${errors[i]}; ${overlapMessage}` : overlapMessage;
        hasErrors = true;
      }

      // Check for gaps with next grade
      if (next && current.minMark > next.maxMark + 1) {
        const gapMessage = `Gap with ${next.grade} (${next.minMark}-${next.maxMark})`;
        errors[i] = errors[i] ? `${errors[i]}; ${gapMessage}` : gapMessage;
        hasErrors = true;
      }
    }

    setValidationErrors(errors);
    setIsValid(!hasErrors);
    return !hasErrors;
  }, []);

  // Handle local changes without affecting the main state
  const handleLocalChange = useCallback((index: number, field: keyof GradingScaleItem, value: string | number) => {
    setLocalGradingScale(prev => {
      const newScale = [...prev];
      const numericValue = (field === 'minMark' || field === 'maxMark' || field === 'aggregates') ? Number(value) : value;
      newScale[index] = { ...newScale[index], [field]: numericValue };
      
      // Validate after each change
      setTimeout(() => validateGradingScale(newScale), 0);
      
      return newScale;
    });
  }, [validateGradingScale]);

  // Handle save with validation
  const handleSave = useCallback(() => {
    if (validateGradingScale(localGradingScale)) {
      // Apply changes to main state
      localGradingScale.forEach((scale, index) => {
        onGradeScaleChange(index, 'minMark', scale.minMark);
        onGradeScaleChange(index, 'maxMark', scale.maxMark);
        onGradeScaleChange(index, 'grade', scale.grade);
        onGradeScaleChange(index, 'aggregates', scale.aggregates || 0);
      });
      onSave();
    }
  }, [localGradingScale, validateGradingScale, onGradeScaleChange, onSave]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-semibold text-gray-900">Grading Scale Configuration</DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-1">
            Configure the grading scale for this exam. All changes are validated before saving.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header Row */}
          <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-gray-50 border-b sticky top-0 z-10">
            <div className="text-sm font-semibold text-gray-700">Minimum Score</div>
            <div className="text-sm font-semibold text-gray-700">Maximum Score</div>
            <div className="text-sm font-semibold text-gray-700">Grade</div>
            <div className="text-sm font-semibold text-gray-700">Aggregates</div>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-2 p-4">
              {localGradingScale.map((scale, index) => (
                <div key={index} className={`grid grid-cols-4 gap-4 p-4 rounded-lg border transition-all duration-200 ${
                  validationErrors[index] 
                    ? 'bg-red-50 border-red-300 shadow-sm' 
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Min</label>
                    <Input
                      type="number"
                      value={scale.minMark}
                      onChange={(e) => handleLocalChange(index, 'minMark', parseInt(e.target.value) || 0)}
                      className="h-10 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      min="0"
                      max="100"
                      placeholder="0"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Max</label>
                    <Input
                      type="number"
                      value={scale.maxMark}
                      onChange={(e) => handleLocalChange(index, 'maxMark', parseInt(e.target.value) || 0)}
                      className="h-10 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      min="0"
                      max="100"
                      placeholder="100"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Grade</label>
                    <Input
                      type="text"
                      value={scale.grade}
                      onChange={(e) => handleLocalChange(index, 'grade', e.target.value.toUpperCase())}
                      className="h-10 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 font-semibold"
                      placeholder="A1"
                      maxLength={3}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Aggregates</label>
                    <Input
                      type="number"
                      value={scale.aggregates ?? ''}
                      onChange={(e) => handleLocalChange(index, 'aggregates', parseInt(e.target.value) || 0)}
                      className="h-10 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      min="0"
                      max="9"
                      placeholder="1"
                    />
                  </div>
                  
                  {validationErrors[index] && (
                    <div className="col-span-4 mt-3 p-3 bg-red-100 border border-red-300 rounded-md">
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">!</span>
                        </div>
                        <p className="text-sm text-red-700">{validationErrors[index]}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Validation Summary */}
          {!isValid && (
            <div className="border-t bg-red-50 p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-800 mb-2">Validation Issues Found</h4>
                  <div className="space-y-1">
                    {Object.entries(validationErrors).map(([index, error]) => (
                      <div key={index} className="text-sm text-red-700 flex items-start space-x-2">
                        <span className="text-red-500 font-bold">•</span>
                        <span>Row {parseInt(index) + 1}: {error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <DialogFooter className="border-t bg-gray-50 px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {isValid ? (
              <span className="flex items-center space-x-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>All validations passed</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2 text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>{Object.keys(validationErrors).length} validation error(s)</span>
              </span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="px-6 py-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!isValid}
              className={`px-6 py-2 ${
                isValid 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RecordResultsView() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Get exam ID directly from params (works perfectly on Vercel)
  const examId = params?.examId as string;
  const isEditMode = searchParams?.get('edit') === 'true' && searchParams?.get('mode') === 'edit';

  const [results, setResults] = useState<Record<string, Record<string, number>>>({});
  const [missedSubjects, setMissedSubjects] = useState<Record<string, Record<string, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  
  const [gradingScaleItems, setGradingScaleItems] = useState<GradingScaleItem[]>([
    { minMark: 90, maxMark:100, grade: 'D1', aggregates: 1, comment: 'Distinction 1' },
    { minMark: 75, maxMark:89, grade: 'D2', aggregates: 2, comment: 'Distinction 2' },
    { minMark: 65, maxMark:74, grade: 'C3', aggregates: 3, comment: 'Credit 3' },
    { minMark: 60, maxMark:64, grade: 'C4', aggregates: 4, comment: 'Credit 4' },
    { minMark: 50, maxMark:59, grade: 'C5', aggregates: 5, comment: 'Credit 5' },
    { minMark: 40, maxMark:49, grade: 'C6', aggregates: 6, comment: 'Credit 6' },
    { minMark: 35, maxMark:39, grade: 'P7', aggregates: 7, comment: 'Pass 7' },
    { minMark: 30, maxMark:34, grade: 'P8', aggregates: 8, comment: 'Pass 8' },
    { minMark: 0, maxMark:29, grade: 'F9', aggregates: 9, comment: 'Fail 9' },
  ]);
  const [selectedMajorSubjects, setSelectedMajorSubjects] = useState<string[]>([]);
  const [showMajorSubjectSelector, setShowMajorSubjectSelector] = useState(false);
  
  // Search and Sort functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'name' | 'admissionNumber' | 'totalMarks'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const updateExamResultMutation = useUpdateExamResult();

  const { data: exams = [], isLoading: isLoadingExams } = useExams();
  const { 
    data: examResultData, 
    isLoading: isLoadingExamResult, 
    error: examResultError,
    refetch: refetchExamResult
  } = useExamResultByExamId(examId);

  const examDetails = useMemo(() => {
    if (!examId || exams.length === 0) return undefined;
    return exams.find(exam => exam.id === examId);
  }, [exams, examId]);
  
  const classSnap = useMemo(() => examResultData?.classSnapshot, [examResultData]);
  const pupilSnaps = useMemo(() => examResultData?.pupilSnapshots || [], [examResultData]);
  const subjectSnaps = useMemo(() => examResultData?.subjectSnapshots || [], [examResultData]);

  useEffect(() => {
    if (examResultData?.gradingScale && examResultData.gradingScale.length > 0) {
      setGradingScaleItems(examResultData.gradingScale);
    }
    if (examResultData?.results && subjectSnaps.length > 0) {
      const initialMarks: Record<string, Record<string, number>> = {};
      const initialMissed: Record<string, Record<string, boolean>> = {};
      for (const pupilId in examResultData.results) {
        if (Object.prototype.hasOwnProperty.call(examResultData.results, pupilId)) {
          initialMarks[pupilId] = {};
          initialMissed[pupilId] = {};
          const pupilResultEntries = examResultData.results[pupilId];
          for (const subjectId in pupilResultEntries) {
            if (Object.prototype.hasOwnProperty.call(pupilResultEntries, subjectId)) {
              const markEntry = pupilResultEntries[subjectId];
              const subjectCode = subjectSnaps.find(s => s.subjectId === subjectId)?.code;
              if (subjectCode) {
                // Load marks (default to 0 if missed)
                initialMarks[pupilId][subjectCode] = markEntry?.status === 'missed' ? 0 : (markEntry?.marks || 0);
                // Load missed status
                initialMissed[pupilId][subjectCode] = markEntry?.status === 'missed';
              }
            }
          }
        }
      }
      setResults(initialMarks);
      setMissedSubjects(initialMissed);
    }
  }, [examResultData, subjectSnaps]);

  useEffect(() => {
    if (!isLoadingExams && !isLoadingExamResult) {
      if (!examId) {
        toast({ variant: "destructive", title: "Missing Exam ID", description: "Exam ID is missing from URL." });
        router.push('/exams');
      } else if (!examDetails) {
        toast({ variant: "destructive", title: "Exam Not Found", description: `Details for exam ID '${examId}' could not be found.` });
        router.push('/exams');
      } else if (examResultData === null && !isLoadingExamResult) {
        toast({ variant: "destructive", title: "Exam Results Not Found", description: `Results for exam ID '${examId}' could not be loaded or do not exist.` });
        router.push('/exams');
      }
    }
  }, [examId, examDetails, examResultData, isLoadingExams, isLoadingExamResult, router, toast]);

  const examSubjects = useMemo(() => {
    if (!subjectSnaps || subjectSnaps.length === 0) return [];
    return subjectSnaps.map(s => ({ code: s.code, name: s.name, totalMarks: s.maxMarks, teacherId: s.teacherId }));
  }, [subjectSnaps]);

  const calculateGrade = useCallback((marks: number): { grade: string; aggregates: number } => {
    if (!Array.isArray(gradingScaleItems) || gradingScaleItems.length === 0) return { grade: 'N/A', aggregates: 0 };
    const sortedScale = [...gradingScaleItems].sort((a, b) => b.minMark - a.minMark);
    const scale = sortedScale.find(s => typeof s?.minMark === 'number' && marks >= s.minMark);
    return scale ? { grade: scale.grade, aggregates: scale.aggregates ?? 0 } : { grade: 'F9', aggregates: 9 };
  }, [gradingScaleItems]);

  useEffect(() => {
    if (examSubjects.length > 4) {
      setShowMajorSubjectSelector(true);
      // Load existing major subjects if they exist, otherwise start with empty array
      const existingMajorSubjects = examResultData?.majorSubjects || [];
      if (existingMajorSubjects.length === 4) {
        setSelectedMajorSubjects(existingMajorSubjects);
      } else {
        setSelectedMajorSubjects([]);
      }
    } else {
      setShowMajorSubjectSelector(false);
      setSelectedMajorSubjects(examSubjects.map(s => s.code));
    }
  }, [examSubjects, examResultData?.majorSubjects]);

  const handleMajorSubjectSelection = useCallback((subjectCode: string) => {
    setSelectedMajorSubjects(prev => {
      if (prev.includes(subjectCode)) return prev.filter(code => code !== subjectCode);
      if (prev.length < 4) return [...prev, subjectCode];
      return prev;
    });
  }, []);

  const pupilTotals = useMemo(() => {
    const currentTotals: Record<string, { total: number; aggregates: number }> = {};
    if (!pupilSnaps || pupilSnaps.length === 0 || !examSubjects || examSubjects.length === 0) return currentTotals;

    pupilSnaps.forEach(pupil => {
      if (!pupil || typeof pupil.pupilId === 'undefined') return;
      let totalMarks = 0;
      let totalAggregates = 0;
      const currentPupilResults = results[pupil.pupilId] || {};
      const currentPupilMissed = missedSubjects[pupil.pupilId] || {};

      examSubjects.forEach(subject => {
        if (!subject || typeof subject.code === 'undefined') return;
        const isMissed = currentPupilMissed[subject.code] || false;
        const marks = isMissed ? 0 : (currentPupilResults[subject.code] ?? 0);
        totalMarks += marks;
        
        const isMajor = selectedMajorSubjects.includes(subject.code);
        if (examSubjects.length === 4 || (examSubjects.length > 4 && selectedMajorSubjects.length === 4 && isMajor)) {
            // If missed, use 9 aggregates (fail grade), otherwise calculate from marks
            totalAggregates += isMissed ? 9 : calculateGrade(marks).aggregates;
        }
      });
      currentTotals[pupil.pupilId] = { total: totalMarks, aggregates: totalAggregates };
    });
    return currentTotals;
  }, [results, missedSubjects, pupilSnaps, examSubjects, calculateGrade, selectedMajorSubjects]);

  // Filtered and sorted pupils
  const filteredAndSortedPupils = useMemo(() => {
    if (!pupilSnaps || pupilSnaps.length === 0) return [];
    
    // Filter pupils based on search term
    let filtered = pupilSnaps;
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = pupilSnaps.filter(pupil => 
        pupil.name.toLowerCase().includes(searchLower) ||
        pupil.admissionNumber.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort pupils
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'admissionNumber':
          comparison = a.admissionNumber.localeCompare(b.admissionNumber);
          break;
        case 'totalMarks':
          const aTotal = pupilTotals[a.pupilId]?.total || 0;
          const bTotal = pupilTotals[b.pupilId]?.total || 0;
          comparison = aTotal - bTotal;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [pupilSnaps, searchTerm, sortField, sortDirection, pupilTotals]);

  const handleMarksChange = useCallback((pupilId: string, subjectCode: string, value: string) => {
    const numValue = value === '' ? 0 : Math.min(100, Math.max(0, Number(value)));
    setResults(prev => ({ ...prev, [pupilId]: { ...(prev[pupilId] || {}), [subjectCode]: numValue }}));
    // Clear missed status when marks are entered
    setMissedSubjects(prev => ({ ...prev, [pupilId]: { ...(prev[pupilId] || {}), [subjectCode]: false }}));
  }, []);

  const handleToggleMissedStatus = useCallback((pupilId: string, subjectCode: string) => {
    setMissedSubjects(prev => {
      const currentMissed = prev[pupilId]?.[subjectCode] || false;
      const newMissed = !currentMissed;
      
      // If marking as missed, set marks to 0
      if (newMissed) {
        setResults(prevResults => ({ 
          ...prevResults, 
          [pupilId]: { ...(prevResults[pupilId] || {}), [subjectCode]: 0 }
        }));
      }
      
      return { 
        ...prev, 
        [pupilId]: { ...(prev[pupilId] || {}), [subjectCode]: newMissed }
      };
    });
  }, []);

  const handleSort = useCallback((field: 'name' | 'admissionNumber' | 'totalMarks') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || !examResultData || !examDetails || !classSnap) {
        toast({variant: "destructive", title: "Error", description: "Missing critical data to save results."})
        return;
    }
    setIsSubmitting(true);
    try {
      const updatedResultsPayload: Record<string, Record<string, PupilSubjectResult>> = {};
      pupilSnaps.forEach(pupil => {
        updatedResultsPayload[pupil.pupilId] = {};
        subjectSnaps.forEach(subjectSnapshot => {
          const isMissed = missedSubjects[pupil.pupilId]?.[subjectSnapshot.code] || false;
          const marks = isMissed ? 0 : (results[pupil.pupilId]?.[subjectSnapshot.code] ?? 0);
          const gradeInfo = isMissed ? { grade: 'F9', aggregates: 9 } : calculateGrade(marks);
          updatedResultsPayload[pupil.pupilId][subjectSnapshot.subjectId] = { 
            subjectId: subjectSnapshot.subjectId, 
            marks, 
            grade: gradeInfo.grade, 
            aggregates: gradeInfo.aggregates, 
            comment: 'N/A',
            status: isMissed ? 'missed' : 'present'
          };
        });
      });

      await updateExamResultMutation.mutateAsync({
        id: examResultData.id,
        data: { 
          results: updatedResultsPayload, 
          gradingScale: gradingScaleItems,
          majorSubjects: examSubjects.length > 4 ? selectedMajorSubjects : examSubjects.map(s => s.code),
          lastUpdatedAt: new Date().toISOString() 
        }
      });
      toast({ title: "Success", description: "Results saved successfully" });
      refetchExamResult();
    } catch (error) {
      console.error('Error saving results:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ variant: "destructive", title: "Error", description: `Failed to save results: ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, examResultData, examDetails, classSnap, pupilSnaps, subjectSnaps, results, calculateGrade, updateExamResultMutation, toast, refetchExamResult, gradingScaleItems, selectedMajorSubjects]);

  const handleGradeScaleItemChange = useCallback((index: number, field: keyof GradingScaleItem, value: string | number) => {
    setGradingScaleItems((prevScale: GradingScaleItem[]) => {
      const newScale = [...prevScale];
      const numericValue = (field === 'minMark' || field === 'maxMark' || field === 'aggregates') ? Number(value) : value;
      newScale[index] = { ...newScale[index], [field]: numericValue };
      return newScale;
    });
  }, []);

  const handleSaveGradingScale = useCallback(async () => {
    if (!examResultData) {
        toast({variant: "destructive", title: "Error", description: "Exam result data not found."})
        return;
    }
    try {
      await updateExamResultMutation.mutateAsync({
        id: examResultData.id,
        data: { 
            gradingScale: gradingScaleItems,
            lastUpdatedAt: new Date().toISOString() 
        }
      });
      toast({ title: "Success", description: "Grading scale updated successfully" });
      setIsGradingModalOpen(false);
      refetchExamResult();
    } catch (error) {
      console.error('Error saving grading scale:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ variant: "destructive", title: "Error", description: `Failed to update grading scale: ${errorMessage}` });
    }
  }, [gradingScaleItems, examResultData, updateExamResultMutation, toast, refetchExamResult]);

  const getHeaderContent = useCallback(() => {
    const examNameStr = examDetails?.name || 'Exam';
    if (isEditMode) return { title: `${examNameStr} - Edit Results`, buttonText: 'Update Results', description: 'Edit existing results. Changes will be saved.' };
    return { title: `${examNameStr} - Record Results`, buttonText: 'Save Results', description: 'Enter marks (0-100). Grades and aggregates are auto-calculated.' };
  }, [isEditMode, examDetails]);

  const [activeSubjectIndex, setActiveSubjectIndex] = useState(0);
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isMobile = windowWidth < 768;

  const nextSubject = useCallback(() => {
    if (examSubjects.length > 0) {
      setActiveSubjectIndex(prev => (prev + 1) % examSubjects.length);
    }
  }, [examSubjects.length]);

  const prevSubject = useCallback(() => {
    if (examSubjects.length > 0) {
      setActiveSubjectIndex(prev => (prev - 1 + examSubjects.length) % examSubjects.length);
    }
  }, [examSubjects.length]);

  if (!examId || isLoadingExams || isLoadingExamResult) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-sm text-gray-700">Loading exam data...</p>
        </div>
      </div>
    );
  }

  if (examResultError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <X className="h-8 w-8 text-red-500 mx-auto" />
          <p className="mt-2 text-sm text-red-700">Error loading exam results.</p>
          <p className="text-xs text-gray-500">{(examResultError as Error)?.message || "Please try again later."}</p>
          <Button onClick={() => router.push('/exams')} className="mt-4" size="sm">Back to Exams</Button>
        </div>
      </div>
    );
  }

  if (!examDetails || !examResultData) {
    let message = "Exam data could not be loaded. It might have been deleted or an unexpected error occurred.";
    if (!examId) {
        message = "Exam ID is missing from URL."
    } else if (!isLoadingExams && !examDetails) { 
        message = `Exam details for ID '${examId}' were not found. The exam might have been deleted.`;
    } else if (!isLoadingExamResult && examResultData === null) {
        message = `Exam results for ID '${examId}' were not found. Result data might be missing or an error occurred fetching it.`;
    }
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <X className="h-8 w-8 text-orange-500 mx-auto" />
          <p className="mt-2 text-sm text-orange-700">Exam Data Not Available</p>
          <p className="text-xs text-gray-500">{message}</p>
          <Button onClick={() => router.push('/exams')} className="mt-4" size="sm">Back to Exams</Button>
        </div>
      </div>
    );
  }

  const MajorSubjectsSelectorComponent = () => {
    if (!showMajorSubjectSelector) return null;

    return (
      <Card className="mb-3 border-blue-100">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium text-blue-700">
            Select 4 Major Subjects for Aggregates Calculation
          </CardTitle>
        </CardHeader>
        <CardContent className="py-1 px-3">
          <div className="flex flex-wrap gap-1">
            {examSubjects.map((subject) => (
              <Button
                key={subject.code}
                variant={selectedMajorSubjects.includes(subject.code) ? "default" : "outline"}
                size="sm"
                onClick={() => handleMajorSubjectSelection(subject.code)}
                disabled={selectedMajorSubjects.length >= 4 && !selectedMajorSubjects.includes(subject.code)}
                className="text-xs h-6 px-2"
              >
                {subject.code}
              </Button>
            ))}
          </div>
          {selectedMajorSubjects.length < 4 && showMajorSubjectSelector && (
            <p className="text-xs text-orange-600 mt-1">
              Select {4 - selectedMajorSubjects.length} more
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderMobileTable = () => {
    if (examSubjects.length === 0) return null;
    const currentSubject = examSubjects[activeSubjectIndex];
    
    return (
      <div className="flex flex-col">
        <div className="flex justify-between items-center p-2 bg-blue-50 border-b sticky top-0 z-20">
          <Button variant="ghost" size="sm" onClick={prevSubject} className="h-7 px-2">
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <div className="text-xs font-medium text-blue-700">
            {currentSubject.code} ({activeSubjectIndex + 1}/{examSubjects.length})
          </div>
          <Button variant="ghost" size="sm" onClick={nextSubject} className="h-7 px-2">
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
        
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-9 z-10">
            <tr>
              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">
                <button 
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 hover:text-gray-700"
                >
                  Pupil
                  {sortField === 'name' && (
                    <span className="text-blue-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase">
                Mark
              </th>
              <th className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase">
                Grade
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredAndSortedPupils.map((pupil, idx) => {
              const isMissed = missedSubjects[pupil.pupilId]?.[currentSubject.code] || false;
              const marks = isMissed ? 0 : (results[pupil.pupilId]?.[currentSubject.code] ?? 0);
              const isRelevantForAggregates = examSubjects.length === 4 || 
                (examSubjects.length > 4 && selectedMajorSubjects.length === 4 && 
                selectedMajorSubjects.includes(currentSubject.code));
              const gradeInfo = isRelevantForAggregates ? (isMissed ? { grade: 'F9', aggregates: 9 } : calculateGrade(marks)) : { grade: '', aggregates: 0 };
              
              return (
                <tr key={pupil.pupilId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <div className="text-xs font-medium text-gray-900">
                      {pupil.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {pupil.admissionNumber}
                    </div>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-center">
                    <Input
                      type="number"
                      min="0"
                      max={currentSubject.totalMarks || 100}
                      value={isMissed ? '' : (results[pupil.pupilId]?.[currentSubject.code] || '')}
                      onChange={(e) => handleMarksChange(pupil.pupilId, currentSubject.code, e.target.value)}
                      disabled={isMissed}
                      placeholder={isMissed ? 'Missed' : ''}
                      className={`w-12 h-7 text-center mx-auto text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isMissed ? 'bg-red-50 text-red-600 placeholder-red-400' : ''}`}
                    />
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-center">
                    {isRelevantForAggregates && (
                      <button
                        onClick={() => handleToggleMissedStatus(pupil.pupilId, currentSubject.code)}
                        className={`text-xs px-1 py-0 border rounded cursor-pointer hover:shadow-sm transition-all ${
                          isMissed 
                            ? 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200' 
                            : gradeInfo.grade && gradeInfo.grade !== 'N/A'
                              ? `${getGradeColor(gradeInfo.grade)} hover:opacity-80`
                              : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                        }`}
                        title={isMissed ? 'Click to mark as present' : 'Click to mark as missed'}
                      >
                        {isMissed ? 'MISSED' : (gradeInfo.grade || 'N/A')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        <div className="p-2 border-t bg-gray-50">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-1 bg-white rounded border text-xs">
              <div className="text-gray-500">Avg Marks</div>
              <div className="font-medium">
                {Math.round(Object.values(pupilTotals).reduce((sum, pupil) => sum + pupil.total, 0) / (filteredAndSortedPupils.length || 1))}
              </div>
            </div>
            {(examSubjects.length === 4 || 
              (examSubjects.length > 4 && selectedMajorSubjects.length === 4)) && (
              <div className="text-center p-1 bg-white rounded border text-xs">
                <div className="text-gray-500">Avg Agg</div>
                <div className="font-medium">
                  {Math.round(Object.values(pupilTotals).reduce((sum, pupil) => sum + pupil.aggregates, 0) / (filteredAndSortedPupils.length || 1))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDesktopTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 border-r">
                <button 
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 hover:text-gray-700"
                >
                  Pupil
                  {sortField === 'name' && (
                    <span className="text-blue-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              {examSubjects.map(subject => (
                <th key={subject.code} className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">
                  <div className="text-center">
                    {subject.code}
                  </div>
                </th>
              ))}
              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">
                <button 
                  onClick={() => handleSort('totalMarks')}
                  className="flex items-center gap-1 hover:text-gray-700"
                >
                  Total
                  {sortField === 'totalMarks' && (
                    <span className="text-blue-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              {(examSubjects.length === 4 || 
                (examSubjects.length > 4 && selectedMajorSubjects.length === 4)) && (
                <>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">
                    Agg
                  </th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">
                    Div
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredAndSortedPupils.map((pupil, idx) => (
              <tr key={pupil.pupilId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1 whitespace-nowrap sticky left-0 bg-inherit z-10 border-r">
                  <div className="text-xs font-medium text-gray-900">
                    {pupil.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {pupil.admissionNumber}
                  </div>
                </td>
                {examSubjects.map(subject => {
                  const isMissed = missedSubjects[pupil.pupilId]?.[subject.code] || false;
                  const marks = isMissed ? 0 : (results[pupil.pupilId]?.[subject.code] ?? 0);
                  const isRelevantForAggregates = examSubjects.length === 4 || 
                    (examSubjects.length > 4 && selectedMajorSubjects.length === 4 && 
                     selectedMajorSubjects.includes(subject.code));
                  const gradeInfo = isRelevantForAggregates ? (isMissed ? { grade: 'F9', aggregates: 9 } : calculateGrade(marks)) : { grade: '', aggregates: 0 };
                  
                  return (
                    <td key={subject.code} className="px-2 py-1 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max={subject.totalMarks || 100}
                          value={isMissed ? '' : (results[pupil.pupilId]?.[subject.code] || '')}
                          onChange={(e) => handleMarksChange(pupil.pupilId, subject.code, e.target.value)}
                          disabled={isMissed}
                          placeholder={isMissed ? 'Missed' : ''}
                          className={`w-12 h-7 text-center text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isMissed ? 'bg-red-50 text-red-600 placeholder-red-400' : ''}`}
                        />
                        {isRelevantForAggregates && (
                          <button
                            onClick={() => handleToggleMissedStatus(pupil.pupilId, subject.code)}
                            className={`text-xs px-1 py-0 border rounded cursor-pointer hover:shadow-sm transition-all ${
                              isMissed 
                                ? 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200' 
                                : gradeInfo.grade && gradeInfo.grade !== 'N/A'
                                  ? `${getGradeColor(gradeInfo.grade)} hover:opacity-80`
                                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                            }`}
                            title={isMissed ? 'Click to mark as present' : 'Click to mark as missed'}
                          >
                            {isMissed ? 'MISSED' : (gradeInfo.grade || 'N/A')}
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-1 whitespace-nowrap">
                  <div className="text-xs font-medium text-gray-900">
                    {pupilTotals[pupil.pupilId]?.total || 0}
                  </div>
                </td>
                {(examSubjects.length === 4 || 
                  (examSubjects.length > 4 && selectedMajorSubjects.length === 4)) && (
                  <>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <div className="text-xs font-medium text-gray-900">
                        {pupilTotals[pupil.pupilId]?.aggregates || 0}
                      </div>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <Badge variant="outline" className={`${getDivisionColor(calculateDivision(pupilTotals[pupil.pupilId]?.aggregates || 0))} text-xs px-1 py-0`}>
                        {calculateDivision(pupilTotals[pupil.pupilId]?.aggregates || 0)}
                      </Badge>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="max-w-7xl mx-auto">
        <Card className="shadow-sm overflow-hidden">
          {/* Compact Header */}
          <CardHeader className="p-3 border-b bg-gradient-to-r from-blue-50 to-white">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg font-bold text-blue-900 truncate">{getHeaderContent().title}</CardTitle>
                <CardDescription className="text-xs text-gray-600 truncate">
                  {examDetails?.examTypeName || 'N/A'} | {classSnap?.name || 'N/A'} | {examDetails?.startDate ? new Date(examDetails.startDate).toLocaleDateString() : 'N/A'} - {examDetails?.endDate ? new Date(examDetails.endDate).toLocaleDateString() : 'N/A'}
                </CardDescription>
                {examDetails && (
                  <div className="mt-1">
                    <ExamSignatureDisplay exam={examDetails} variant="inline" className="text-xs" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.back()}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Back</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsGradingModalOpen(true)}
                        className="h-7 w-7 p-0"
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Grading Scale</TooltipContent>
                  </Tooltip>

                  {/* SAVE BUTTON - PROMINENT */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (examSubjects.length > 4 && selectedMajorSubjects.length < 4)}
                        className="!bg-blue-800 hover:!bg-blue-900 !text-white !font-bold !px-6 !py-2 !h-9 !ml-3 !border-2 !border-blue-900 !shadow-lg disabled:!bg-gray-500 disabled:!text-gray-200 disabled:!border-gray-400"
                        size="sm"
                        style={{
                          backgroundColor: isSubmitting || (examSubjects.length > 4 && selectedMajorSubjects.length < 4) ? '#6b7280' : '#1e40af',
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            SAVE RESULTS
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isSubmitting 
                        ? "Saving results..." 
                        : (examSubjects.length > 4 && selectedMajorSubjects.length < 4)
                          ? `Select 4 major subjects above to enable saving (${selectedMajorSubjects.length}/4 selected)`
                          : "Save exam results"
                      }
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Compact Grading Scale Display */}
            <div className="p-2 bg-blue-50 border-b overflow-x-auto">
              <p className="text-xs text-blue-700 mb-1">Grading Scale:</p>
              <div className="flex gap-1 min-w-max">
                {gradingScaleItems
                  .sort((a, b) => a.minMark - b.minMark)
                  .map((scale, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className={`${getGradeColor(scale.grade)} text-xs px-1 py-0 whitespace-nowrap`}
                    >
                      {scale.grade}: {scale.minMark}-{scale.maxMark}
                    </Badge>
                  ))
                }
              </div>
            </div>

            <MajorSubjectsSelectorComponent />

            {/* Search and Sort Controls */}
            <div className="p-2 bg-white border-b flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-1">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name or admission number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-8 text-xs"
                  />
                </div>
                
                {/* Sort Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                      <ArrowUpDown className="h-3 w-3 mr-1" />
                      Sort: {sortField === 'name' ? 'Name' : sortField === 'admissionNumber' ? 'Admission' : 'Total Marks'}
                      {sortDirection === 'desc' ? ' ↓' : ' ↑'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => handleSort('name')}>
                      Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSort('admissionNumber')}>
                      Admission Number {sortField === 'admissionNumber' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSort('totalMarks')}>
                      Total Marks {sortField === 'totalMarks' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Results count */}
              <div className="text-xs text-gray-500">
                Showing {filteredAndSortedPupils.length} of {pupilSnaps.length} pupils
              </div>
            </div>
          
            {filteredAndSortedPupils.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-gray-500 text-sm">
                  {searchTerm.trim() ? 'No pupils found matching your search.' : 'No pupils found in this class.'}
                </p>
                {searchTerm.trim() && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => setSearchTerm('')}
                    className="text-xs mt-2"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <>
                {isMobile ? renderMobileTable() : renderDesktopTable()}
              </>
            )}
          </CardContent>

          {/* Compact Footer */}
          <CardFooter className="p-2 border-t bg-gray-50 flex justify-end">
            <div className="text-xs text-gray-500">
              Updated: {examResultData.lastUpdatedAt ? new Date(examResultData.lastUpdatedAt).toLocaleString() : 'N/A'}
            </div>
          </CardFooter>
        </Card>
      </div>

      <GradingScaleModal
        isOpen={isGradingModalOpen}
        onClose={() => setIsGradingModalOpen(false)}
        gradingScale={gradingScaleItems}
        onGradeScaleChange={handleGradeScaleItemChange}
        onSave={handleSaveGradingScale}
      />
    </div>
  );
}