"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { X, ArrowLeft, Settings, Loader2, ChevronDown, Save, BookOpen, ChevronRight, ChevronLeft, Search, ArrowUpDown, AlertTriangle, BellRing, Users, Grid3X3, Check, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useExam, useExams, useExamResultByExamId, useUpdateExamResult } from '@/lib/hooks/use-exams';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import type { Exam, Pupil, Class, ExamResult as ImportedExamResult, ExamRecordPupilInfo, ExamRecordSubjectInfo, ExamClassInfoSnapshot, PupilSubjectResult, GradingScaleItem } from '@/types';
import { useExamResultLease } from '@/lib/hooks/use-exam-result-lease';
import { usePushSubscribe } from '@/lib/hooks/use-push-subscribe';
import { useAuth } from '@/lib/contexts/auth-context';
import { auth } from '@/lib/firebase';
import { ExamSignatureDisplay } from '@/components/exam/ExamSignatureDisplay';
import { cleanSubjectName } from '@/lib/utils/html-entities';
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
  type NurseryCommentary,
} from '@/lib/exam-assessment';
import { filterExamPupilsByStream } from '@/lib/utils/class-streams';

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

const DEFAULT_GRADING_SCALE_ITEMS: GradingScaleItem[] = [
  { minMark: 90, maxMark: 100, grade: 'D1', aggregates: 1, comment: 'Distinction 1' },
  { minMark: 75, maxMark: 89, grade: 'D2', aggregates: 2, comment: 'Distinction 2' },
  { minMark: 65, maxMark: 74, grade: 'C3', aggregates: 3, comment: 'Credit 3' },
  { minMark: 60, maxMark: 64, grade: 'C4', aggregates: 4, comment: 'Credit 4' },
  { minMark: 50, maxMark: 59, grade: 'C5', aggregates: 5, comment: 'Credit 5' },
  { minMark: 40, maxMark: 49, grade: 'C6', aggregates: 6, comment: 'Credit 6' },
  { minMark: 35, maxMark: 39, grade: 'P7', aggregates: 7, comment: 'Pass 7' },
  { minMark: 30, maxMark: 34, grade: 'P8', aggregates: 8, comment: 'Pass 8' },
  { minMark: 0, maxMark: 29, grade: 'F9', aggregates: 9, comment: 'Fail 9' },
];

interface EditableExamDraft {
  results: Record<string, Record<string, number>>;
  commentaryResults: Record<string, Record<string, NurseryCommentary | ''>>;
  missedSubjects: Record<string, Record<string, boolean>>;
  gradingScale: GradingScaleItem[];
  majorSubjects: string[];
}

type PendingNavigation =
  | { kind: 'back' }
  | { kind: 'view'; href: string }
  | { kind: 'switch'; examId: string; classId: string; label: string };

const normalizeNestedRecord = <T,>(record: Record<string, Record<string, T>>) =>
  Object.fromEntries(
    Object.entries(record)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([pupilId, values]) => [
        pupilId,
        Object.fromEntries(Object.entries(values).sort(([first], [second]) => first.localeCompare(second))),
      ])
  );

const createDraftFingerprint = (draft: EditableExamDraft) => JSON.stringify({
  results: normalizeNestedRecord(draft.results),
  commentaryResults: normalizeNestedRecord(draft.commentaryResults),
  missedSubjects: normalizeNestedRecord(draft.missedSubjects),
  gradingScale: draft.gradingScale,
  majorSubjects: [...draft.majorSubjects].sort(),
});

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
  onSave: (newScale?: GradingScaleItem[]) => void;
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
      // Pass the entire new grading scale to the parent
      console.log('🔄 Modal passing new grading scale to parent:', localGradingScale);
      onSave(localGradingScale);
    }
  }, [localGradingScale, validateGradingScale, onSave]);

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
  const { user } = useAuth();
  const pushSubscription = usePushSubscribe();

  const routeExamId = params?.examId as string;
  const routeClassId = searchParams?.get('classId');
  const routeStreamId = searchParams?.get('streamId');
  const [examId, setExamId] = useState(routeExamId);
  const [classId, setClassId] = useState<string | null>(routeClassId);
  const [isSwitchingExam, setIsSwitchingExam] = useState(false);
  const switchStartedAtRef = useRef(0);
  const isEditMode = searchParams?.get('edit') === 'true' && searchParams?.get('mode') === 'edit';

  const [results, setResults] = useState<Record<string, Record<string, number>>>({});
  const [commentaryResults, setCommentaryResults] = useState<Record<string, Record<string, NurseryCommentary | ''>>>({});
  const [missedSubjects, setMissedSubjects] = useState<Record<string, Record<string, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [hydratedExamId, setHydratedExamId] = useState<string | null>(null);
  const [acknowledgedBlockedLease, setAcknowledgedBlockedLease] = useState<string | null>(null);
  const [unlockNotificationStatus, setUnlockNotificationStatus] = useState<'idle' | 'requesting' | 'requested'>('idle');
  const [overrideSaveDialogOpen, setOverrideSaveDialogOpen] = useState(false);
  const [overrideSaveAcknowledged, setOverrideSaveAcknowledged] = useState(false);
  const [remoteUpdateWhileEditing, setRemoteUpdateWhileEditing] = useState(false);
  const [streamChooserOpen, setStreamChooserOpen] = useState(false);
  const localDraftDirtyRef = useRef(false);
  
  const [gradingScaleItems, setGradingScaleItems] = useState<GradingScaleItem[]>(
    DEFAULT_GRADING_SCALE_ITEMS.map((item) => ({ ...item }))
  );
  const [selectedMajorSubjects, setSelectedMajorSubjects] = useState<string[]>([]);
  const [showMajorSubjectSelector, setShowMajorSubjectSelector] = useState(false);
  
  // Search and Sort functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'name' | 'admissionNumber' | 'totalMarks'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const updateExamResultMutation = useUpdateExamResult();
  const resultLease = useExamResultLease(examId);
  const blockedLeaseKey = resultLease.holder ? `${examId}:${resultLease.holder.leaseId}` : null;
  const needsLockedEditorAcknowledgement =
    resultLease.status === 'blocked' &&
    blockedLeaseKey !== null &&
    acknowledgedBlockedLease !== blockedLeaseKey;

  useEffect(() => {
    setUnlockNotificationStatus('idle');
    setOverrideSaveDialogOpen(false);
    setOverrideSaveAcknowledged(false);
  }, [blockedLeaseKey]);

  const handleNotifyWhenReady = useCallback(async () => {
    if (!user || !blockedLeaseKey) return;

    setUnlockNotificationStatus('requesting');
    try {
      const isPushActive = pushSubscription.isSubscribed || await pushSubscription.subscribe(user.id);
      if (!isPushActive) {
        throw new Error(pushSubscription.error || 'Push notifications are not active on this device.');
      }

      const firebaseUser = auth.currentUser;
      if (!firebaseUser || firebaseUser.uid !== user.id) {
        throw new Error('Your signed-in session has expired. Please sign in again.');
      }
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/exams/unlock-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ examId }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload?.error === 'EXAM_UNLOCKED') {
          setUnlockNotificationStatus('idle');
          toast({ title: 'Results recording is ready', description: 'This page has already been unlocked.' });
          return;
        }
        if (payload?.error === 'EXAM_LOCK_OWNED') {
          setUnlockNotificationStatus('idle');
          toast({ title: 'You already have this page', description: 'You can record marks now.' });
          return;
        }
        if (payload?.error === 'PUSH_NOT_ACTIVE') {
          throw new Error('Push notifications are not active on this device.');
        }
        throw new Error(payload?.error || 'Unable to request an unlock notification.');
      }

      setUnlockNotificationStatus('requested');
      toast({ title: 'Notification requested', description: 'We will notify you when this Record Results page is ready.' });
    } catch (error) {
      setUnlockNotificationStatus('idle');
      toast({
        variant: 'destructive',
        title: 'Notification unavailable',
        description: error instanceof Error ? error.message : 'Unable to request an unlock notification.',
      });
    }
  }, [blockedLeaseKey, examId, pushSubscription, toast, user]);

  const { data: exams = [], isLoading: isLoadingExams } = useExams();
  const { data: selectedExam, isLoading: isLoadingSelectedExam } = useExam(examId);
  const { data: allClasses = [] } = useClasses();
  const { data: allPupils = [] } = usePupils(); // Fetch all pupils to get dateOfBirth
  const { 
    data: examResultData, 
    isLoading: isLoadingExamResult, 
    error: examResultError
  } = useExamResultByExamId(examId, selectedExam ?? undefined);

  const examDetails = useMemo(() => {
    if (!examId) return undefined;
    return selectedExam ?? exams.find(exam => exam.id === examId);
  }, [exams, examId, selectedExam]);

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
      const setsByNumber = new Map<number, Exam>();

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
  
  const classSnap = useMemo(() => examResultData?.classSnapshot, [examResultData]);
  const isNurseryExam = useMemo(
    () => isNurseryAssessment(examDetails, examResultData, classSnap),
    [classSnap, examDetails, examResultData]
  );
  
  // Enhance pupil snapshots with dateOfBirth from actual pupils data
  const allPupilSnaps = useMemo(() => {
    const snaps = examResultData?.pupilSnapshots || [];
    return snaps.map(snap => {
      // Find the actual pupil to get their dateOfBirth if not in snapshot
      const actualPupil = allPupils.find(p => p.id === snap.pupilId);
      return {
        ...snap,
        dateOfBirth: snap.dateOfBirth || actualPupil?.dateOfBirth, // Use snapshot first, fallback to actual pupil
        ageAtExam: snap.ageAtExam // Keep the ageAtExam from snapshot
      };
    });
  }, [examResultData, allPupils]);

  const examStreams = useMemo(
    () => examDetails?.streamScope?.streams || classSnap?.streamScope?.streams || [],
    [classSnap?.streamScope?.streams, examDetails?.streamScope?.streams],
  );
  const selectedStreamId = useMemo(() => {
    if (routeStreamId === 'all') return 'all';
    if (routeStreamId && examStreams.some(stream => stream.id === routeStreamId)) return routeStreamId;
    return examStreams.length === 1 ? examStreams[0].id : 'all';
  }, [examStreams, routeStreamId]);
  const pupilSnaps = useMemo(
    () => filterExamPupilsByStream(allPupilSnaps, selectedStreamId),
    [allPupilSnaps, selectedStreamId],
  );

  useEffect(() => {
    if (examStreams.length <= 1) {
      setStreamChooserOpen(false);
      return;
    }
    const routeIsValid = routeStreamId === 'all' || examStreams.some(stream => stream.id === routeStreamId);
    setStreamChooserOpen(!routeIsValid);
  }, [examId, examStreams, routeStreamId]);

  const selectStreamScope = useCallback((streamId: string) => {
    const nextParams = new URLSearchParams(searchParams?.toString() || '');
    nextParams.set('streamId', streamId);
    if (classId || examDetails?.classId) nextParams.set('classId', classId || examDetails!.classId);
    router.replace(`/exams/${examId}/record-results?${nextParams.toString()}`);
    setStreamChooserOpen(false);
  }, [classId, examDetails, examId, router, searchParams]);
  
  // Clean subject names to remove any trailing '&' from database
  const subjectSnaps = useMemo(() => {
    const snaps = examResultData?.subjectSnapshots || [];
    return snaps.map(snap => ({
      ...snap,
      name: cleanSubjectName(snap.name)
    }));
  }, [examResultData]);

  useEffect(() => {
    if (examResultData?.examId !== examId) return;

    // A revision-triggered refresh should hydrate a clean page immediately,
    // but must not erase marks the current editor has already typed.
    if (hydratedExamId === examId && localDraftDirtyRef.current) {
      setRemoteUpdateWhileEditing(true);
      return;
    }

    setRemoteUpdateWhileEditing(false);

    if (examResultData?.gradingScale && examResultData.gradingScale.length > 0) {
      console.log('📊 Loading grading scale from database:', examResultData.gradingScale);
      setGradingScaleItems(examResultData.gradingScale);
    } else {
      console.log('⚠️ No grading scale found in examResultData, using default');
    }
    if (!examResultData?.gradingScale?.length) {
      setGradingScaleItems(DEFAULT_GRADING_SCALE_ITEMS.map((item) => ({ ...item })));
    }

    if (examResultData?.results && subjectSnaps.length > 0) {
      const initialMarks: Record<string, Record<string, number>> = {};
      const initialCommentary: Record<string, Record<string, NurseryCommentary | ''>> = {};
      const initialMissed: Record<string, Record<string, boolean>> = {};
      for (const pupilId in examResultData.results) {
        if (Object.prototype.hasOwnProperty.call(examResultData.results, pupilId)) {
          initialMarks[pupilId] = {};
          initialCommentary[pupilId] = {};
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
                const savedCommentary = markEntry?.comment || markEntry?.grade;
                initialCommentary[pupilId][subjectCode] = isNurseryCommentary(savedCommentary) ? savedCommentary : '';
              }
            }
          }
        }
      }
      setResults(initialMarks);
      setCommentaryResults(initialCommentary);
      setMissedSubjects(initialMissed);
    }
  }, [examId, examResultData, hydratedExamId, subjectSnaps]);

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

  const persistedDraft = useMemo<EditableExamDraft | null>(() => {
    if (!examResultData || examResultData.examId !== examId) return null;

    const savedResults: Record<string, Record<string, number>> = {};
    const savedCommentaryResults: Record<string, Record<string, NurseryCommentary | ''>> = {};
    const savedMissedSubjects: Record<string, Record<string, boolean>> = {};

    Object.entries(examResultData.results || {}).forEach(([pupilId, pupilResults]) => {
      savedResults[pupilId] = {};
      savedCommentaryResults[pupilId] = {};
      savedMissedSubjects[pupilId] = {};

      Object.entries(pupilResults || {}).forEach(([subjectId, result]) => {
        const subjectCode = subjectSnaps.find((subject) => subject.subjectId === subjectId)?.code;
        if (!subjectCode) return;

        savedResults[pupilId][subjectCode] = result?.status === 'missed' ? 0 : (result?.marks || 0);
        const savedCommentary = result?.comment || result?.grade;
        savedCommentaryResults[pupilId][subjectCode] = isNurseryCommentary(savedCommentary) ? savedCommentary : '';
        savedMissedSubjects[pupilId][subjectCode] = result?.status === 'missed';
      });
    });

    return {
      results: savedResults,
      commentaryResults: savedCommentaryResults,
      missedSubjects: savedMissedSubjects,
      gradingScale: examResultData.gradingScale?.length
        ? examResultData.gradingScale.map((item) => ({ ...item }))
        : DEFAULT_GRADING_SCALE_ITEMS.map((item) => ({ ...item })),
      majorSubjects: subjectSnaps.length > 4
        ? [...(examResultData.majorSubjects || [])]
        : subjectSnaps.map((subject) => subject.code),
    };
  }, [examId, examResultData, subjectSnaps]);

  const currentDraft = useMemo<EditableExamDraft>(() => ({
    results,
    commentaryResults,
    missedSubjects,
    gradingScale: gradingScaleItems,
    majorSubjects: selectedMajorSubjects,
  }), [commentaryResults, gradingScaleItems, missedSubjects, results, selectedMajorSubjects]);

  const hasUnsavedChanges = useMemo(() => {
    if (!persistedDraft || hydratedExamId !== examId || isSwitchingExam) return false;
    return createDraftFingerprint(currentDraft) !== createDraftFingerprint(persistedDraft);
  }, [currentDraft, examId, hydratedExamId, isSwitchingExam, persistedDraft]);

  useEffect(() => {
    if (!hasUnsavedChanges && hydratedExamId === examId) {
      localDraftDirtyRef.current = false;
      setRemoteUpdateWhileEditing(false);
    }
  }, [examId, hasUnsavedChanges, hydratedExamId]);

  const unsavedChangeSummary = useMemo(() => {
    if (!persistedDraft) return [] as string[];

    let markChanges = 0;
    let commentaryChanges = 0;
    let missedStatusChanges = 0;
    const pupilIds = new Set([...Object.keys(persistedDraft.results), ...Object.keys(currentDraft.results)]);

    pupilIds.forEach((pupilId) => {
      const subjectCodes = new Set([
        ...Object.keys(persistedDraft.results[pupilId] || {}),
        ...Object.keys(currentDraft.results[pupilId] || {}),
      ]);

      subjectCodes.forEach((subjectCode) => {
        if (persistedDraft.results[pupilId]?.[subjectCode] !== currentDraft.results[pupilId]?.[subjectCode]) {
          markChanges += 1;
        }
        if (persistedDraft.commentaryResults[pupilId]?.[subjectCode] !== currentDraft.commentaryResults[pupilId]?.[subjectCode]) {
          commentaryChanges += 1;
        }

        if (Boolean(persistedDraft.missedSubjects[pupilId]?.[subjectCode]) !== Boolean(currentDraft.missedSubjects[pupilId]?.[subjectCode])) {
          missedStatusChanges += 1;
        }
      });
    });

    const summary: string[] = [];
    if (!isNurseryExam && markChanges > 0) summary.push(`${markChanges} mark ${markChanges === 1 ? 'entry' : 'entries'} changed`);
    if (isNurseryExam && commentaryChanges > 0) summary.push(`${commentaryChanges} assessment ${commentaryChanges === 1 ? 'entry' : 'entries'} changed`);
    if (missedStatusChanges > 0) summary.push(`${missedStatusChanges} missed-subject ${missedStatusChanges === 1 ? 'status' : 'statuses'} changed`);
    if (JSON.stringify(persistedDraft.gradingScale) !== JSON.stringify(currentDraft.gradingScale)) summary.push('Grading scale changed');
    if ([...persistedDraft.majorSubjects].sort().join('|') !== [...currentDraft.majorSubjects].sort().join('|')) summary.push('Major-subject selection changed');

    return summary;
  }, [currentDraft, isNurseryExam, persistedDraft]);

  const calculateGrade = useCallback((marks: number): { grade: string; aggregates: number } => {
    if (!Array.isArray(gradingScaleItems) || gradingScaleItems.length === 0) return { grade: 'N/A', aggregates: 0 };
    const sortedScale = [...gradingScaleItems].sort((a, b) => b.minMark - a.minMark);
    const scale = sortedScale.find(s => typeof s?.minMark === 'number' && marks >= s.minMark);
    return scale ? { grade: scale.grade, aggregates: scale.aggregates ?? 0 } : { grade: 'F9', aggregates: 9 };
  }, [gradingScaleItems]);

  useEffect(() => {
    if (examResultData?.examId !== examId) return;
    if (hydratedExamId === examId && localDraftDirtyRef.current) return;

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
    setHydratedExamId(examId);
  }, [examId, examSubjects, examResultData?.examId, examResultData?.majorSubjects, hydratedExamId]);

  const handleMajorSubjectSelection = useCallback((subjectCode: string) => {
    localDraftDirtyRef.current = true;
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
    localDraftDirtyRef.current = true;
    const numValue = value === '' ? 0 : Math.min(100, Math.max(0, Number(value)));
    setResults(prev => ({ ...prev, [pupilId]: { ...(prev[pupilId] || {}), [subjectCode]: numValue }}));
    // Clear missed status when marks are entered
    setMissedSubjects(prev => ({ ...prev, [pupilId]: { ...(prev[pupilId] || {}), [subjectCode]: false }}));
  }, []);

  const handleCommentaryChange = useCallback((pupilId: string, subjectCode: string, value: NurseryCommentary) => {
    localDraftDirtyRef.current = true;
    setCommentaryResults(prev => ({
      ...prev,
      [pupilId]: { ...(prev[pupilId] || {}), [subjectCode]: value },
    }));
    setMissedSubjects(prev => ({
      ...prev,
      [pupilId]: { ...(prev[pupilId] || {}), [subjectCode]: false },
    }));
  }, []);

  const handleToggleMissedStatus = useCallback((pupilId: string, subjectCode: string) => {
    localDraftDirtyRef.current = true;
    setMissedSubjects(prev => {
      const currentMissed = prev[pupilId]?.[subjectCode] || false;
      const newMissed = !currentMissed;
      
      // If marking as missed, set marks to 0
      if (newMissed) {
        setResults(prevResults => ({ 
          ...prevResults, 
          [pupilId]: { ...(prevResults[pupilId] || {}), [subjectCode]: 0 }
        }));
        setCommentaryResults(prevCommentary => ({
          ...prevCommentary,
          [pupilId]: { ...(prevCommentary[pupilId] || {}), [subjectCode]: '' },
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

  const handleSubmit = useCallback(async (options?: { overrideLock?: boolean }) => {
    if (!resultLease.canSave && !options?.overrideLock) {
      if (resultLease.canOverride) {
        setOverrideSaveAcknowledged(false);
        setOverrideSaveDialogOpen(true);
      } else {
        toast({ variant: 'destructive', title: 'Editing is unavailable', description: 'Your account cannot save these results.' });
      }
      return false;
    }
    if (isSubmitting || !examResultData || !examDetails || !classSnap) {
        toast({variant: "destructive", title: "Error", description: "Missing critical data to save results."})
        return false;
    }
    setIsSubmitting(true);
    try {
      const updatedResultsPayload: Record<string, Record<string, PupilSubjectResult>> = {
        ...(examResultData.results || {}),
      };
      pupilSnaps.forEach(pupil => {
        updatedResultsPayload[pupil.pupilId] = {};
        subjectSnaps.forEach(subjectSnapshot => {
          const isMissed = missedSubjects[pupil.pupilId]?.[subjectSnapshot.code] || false;
          if (isNurseryExam) {
            const commentary = commentaryResults[pupil.pupilId]?.[subjectSnapshot.code] || '';
            updatedResultsPayload[pupil.pupilId][subjectSnapshot.subjectId] = {
              subjectId: subjectSnapshot.subjectId,
              comment: isMissed ? 'MISSED' : commentary,
              grade: isMissed ? 'MISSED' : commentary,
              status: isMissed ? 'missed' : 'present',
            };
            return;
          }
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

      const overrideLease = options?.overrideLock ? resultLease.override : undefined;
      if (options?.overrideLock && !overrideLease) {
        throw new Error('The editing lock could not be transferred to this device. Please reload and try again.');
      }

      await updateExamResultMutation.mutateAsync({
        id: examResultData.id,
        lease: options?.overrideLock ? undefined : resultLease.token,
        overrideLease,
        data: { 
          examId: examResultData.examId, // Include examId for proper cache invalidation
          academicYearId: examDetails.academicYearId,
          termId: examDetails.termId,
          assessmentMode: isNurseryExam ? 'nursery_commentary' : 'marks',
          results: updatedResultsPayload, 
          gradingScale: isNurseryExam ? [] : gradingScaleItems,
          majorSubjects: isNurseryExam ? [] : (examSubjects.length > 4 ? selectedMajorSubjects : examSubjects.map(s => s.code)),
          lastUpdatedAt: new Date().toISOString() 
        }
      });
      localDraftDirtyRef.current = false;
      setRemoteUpdateWhileEditing(false);
      toast({
        title: options?.overrideLock ? 'Results saved with override' : 'Success',
        description: options?.overrideLock
          ? 'This device now owns the editing lock and the results were saved.'
          : 'Results saved successfully',
      });
      return true;
    } catch (error) {
      console.error('Error saving results:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ variant: "destructive", title: "Error", description: `Failed to save results: ${errorMessage}` });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, examResultData, examDetails, classSnap, pupilSnaps, subjectSnaps, examSubjects, results, commentaryResults, missedSubjects, calculateGrade, updateExamResultMutation, toast, gradingScaleItems, selectedMajorSubjects, isNurseryExam, resultLease.canOverride, resultLease.canSave, resultLease.override, resultLease.token]);

  const canSaveDraft = isNurseryExam || examSubjects.length <= 4 || selectedMajorSubjects.length === 4;

  const viewResultsHref = useMemo(() => {
    const targetClassId = classId || examDetails?.classId;
    return examId && targetClassId
      ? `/exams/${examId}/view-results?classId=${targetClassId}&streamId=${selectedStreamId}`
      : null;
  }, [classId, examDetails?.classId, examId, selectedStreamId]);

  const performExamSwitch = useCallback((targetExamId: string, targetClassId: string) => {
    if (targetExamId === examId) return;

    switchStartedAtRef.current = performance.now();
    setIsSwitchingExam(true);
    setHydratedExamId(null);
    setSearchTerm('');
    setIsGradingModalOpen(false);
    localDraftDirtyRef.current = false;
    setRemoteUpdateWhileEditing(false);
    setExamId(targetExamId);
    setClassId(targetClassId);

    if (typeof window !== 'undefined') {
      const editModeQuery = isEditMode ? '&edit=true&mode=edit' : '';
      window.history.replaceState(
        window.history.state,
        '',
        `/exams/${targetExamId}/record-results?classId=${targetClassId}${editModeQuery}`
      );
    }
  }, [examId, isEditMode]);

  const continueNavigation = useCallback((target: PendingNavigation) => {
    if (target.kind === 'back') {
      router.push('/exams');
      return;
    }

    if (target.kind === 'view') {
      router.push(target.href);
      return;
    }

    performExamSwitch(target.examId, target.classId);
  }, [performExamSwitch, router]);

  const requestBackNavigation = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingNavigation({ kind: 'back' });
      return;
    }

    router.push('/exams');
  }, [hasUnsavedChanges, router]);

  const requestExamSwitch = useCallback((targetExamId: string, targetClassId: string, label: string) => {
    if (targetExamId === examId) return;

    if (hasUnsavedChanges) {
      setPendingNavigation({ kind: 'switch', examId: targetExamId, classId: targetClassId, label });
      return;
    }

    performExamSwitch(targetExamId, targetClassId);
  }, [examId, hasUnsavedChanges, performExamSwitch]);

  const requestViewResults = useCallback(() => {
    if (!viewResultsHref) return;

    if (hasUnsavedChanges) {
      setPendingNavigation({ kind: 'view', href: viewResultsHref });
      return;
    }

    router.push(viewResultsHref);
  }, [hasUnsavedChanges, router, viewResultsHref]);

  const handleSaveAndContinue = useCallback(async () => {
    if (!pendingNavigation || !canSaveDraft) return;

    const target = pendingNavigation;
    const didSave = await handleSubmit();
    if (!didSave) return;

    setPendingNavigation(null);
    continueNavigation(target);
  }, [canSaveDraft, continueNavigation, handleSubmit, pendingNavigation]);

  const handleDiscardAndContinue = useCallback(() => {
    if (!pendingNavigation) return;

    const target = pendingNavigation;
    setPendingNavigation(null);
    continueNavigation(target);
  }, [continueNavigation, pendingNavigation]);

  useEffect(() => {
    if (!isSwitchingExam) return;

    if (examDetails?.id === examId && examResultData?.examId === examId) {
      const elapsed = performance.now() - switchStartedAtRef.current;
      const remaining = Math.max(0, 140 - elapsed);
      const timer = window.setTimeout(() => setIsSwitchingExam(false), remaining);
      return () => window.clearTimeout(timer);
    }
  }, [examDetails?.id, examId, examResultData?.examId, isSwitchingExam]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleGradeScaleItemChange = useCallback((index: number, field: keyof GradingScaleItem, value: string | number) => {
    localDraftDirtyRef.current = true;
    setGradingScaleItems((prevScale: GradingScaleItem[]) => {
      const newScale = [...prevScale];
      const numericValue = (field === 'minMark' || field === 'maxMark' || field === 'aggregates') ? Number(value) : value;
      newScale[index] = { ...newScale[index], [field]: numericValue };
      return newScale;
    });
  }, []);

  const handleSaveGradingScale = useCallback(async (newScale?: GradingScaleItem[]) => {
    if (!resultLease.canSave) {
      toast({ variant: 'destructive', title: 'Editing is unavailable', description: `This result is being edited by ${resultLease.holder?.lockedByName || 'another editor'}.` });
      return;
    }
    if (!examResultData) {
        toast({variant: "destructive", title: "Error", description: "Exam result data not found."})
        return;
    }
    
    // Use the passed scale or fall back to state
    const scaleToSave = newScale || gradingScaleItems;
    console.log('🎯 handleSaveGradingScale received scale:', scaleToSave);
    
    // Update the state immediately with the new scale
    if (newScale) {
      setGradingScaleItems(newScale);
    }
    
    try {
      // Helper function to calculate grade with new grading scale
      const recalculateGrade = (marks: number): { grade: string; aggregates: number } => {
        if (!Array.isArray(scaleToSave) || scaleToSave.length === 0) return { grade: 'N/A', aggregates: 0 };
        const sortedScale = [...scaleToSave].sort((a, b) => b.minMark - a.minMark);
        const scale = sortedScale.find(s => typeof s?.minMark === 'number' && marks >= s.minMark);
        return scale ? { grade: scale.grade, aggregates: scale.aggregates ?? 0 } : { grade: 'F9', aggregates: 9 };
      };

      // Recalculate all grades based on the new grading scale
      const recalculatedResults: Record<string, Record<string, PupilSubjectResult>> = {};
      
      for (const pupilId in examResultData.results) {
        if (Object.prototype.hasOwnProperty.call(examResultData.results, pupilId)) {
          recalculatedResults[pupilId] = {};
          const pupilResultEntries = examResultData.results[pupilId];
          
          for (const subjectId in pupilResultEntries) {
            if (Object.prototype.hasOwnProperty.call(pupilResultEntries, subjectId)) {
              const existingResult = pupilResultEntries[subjectId];
              const marks = existingResult.marks;
              const isMissed = existingResult.status === 'missed';
              
              // Recalculate grade and aggregates based on new scale
              const gradeInfo = isMissed || typeof marks !== 'number'
                ? { grade: 'F9', aggregates: 9 }
                : recalculateGrade(marks);
              
              recalculatedResults[pupilId][subjectId] = {
                ...existingResult,
                grade: gradeInfo.grade,
                aggregates: gradeInfo.aggregates
              };
            }
          }
        }
      }

      // Update exam result with new grading scale AND recalculated results
      console.log('💾 Saving grading scale to database:', scaleToSave);
      console.log('💾 Exam Result ID:', examResultData.id);
      console.log('💾 Exam ID:', examResultData.examId);
      
      await updateExamResultMutation.mutateAsync({
        id: examResultData.id,
        lease: resultLease.token,
        data: { 
            examId: examResultData.examId, // Include examId for proper cache invalidation
            academicYearId: examDetails?.academicYearId,
            termId: examDetails?.termId,
            gradingScale: scaleToSave,
            results: recalculatedResults,
            lastUpdatedAt: new Date().toISOString() 
        }
      });
      
      console.log('✅ Grading scale saved successfully');
      
      // Update local state to reflect changes immediately
      // The results state uses subject codes, so we need to map subjectId to code
      const updatedLocalResults: Record<string, Record<string, number>> = {};
      const updatedLocalMissed: Record<string, Record<string, boolean>> = {};
      
      for (const pupilId in recalculatedResults) {
        if (Object.prototype.hasOwnProperty.call(recalculatedResults, pupilId)) {
          updatedLocalResults[pupilId] = {};
          updatedLocalMissed[pupilId] = {};
          
          for (const subjectId in recalculatedResults[pupilId]) {
            if (Object.prototype.hasOwnProperty.call(recalculatedResults[pupilId], subjectId)) {
              const result = recalculatedResults[pupilId][subjectId];
              const subjectCode = subjectSnaps.find(s => s.subjectId === subjectId)?.code;
              
              if (subjectCode) {
                updatedLocalResults[pupilId][subjectCode] = result.marks ?? 0;
                updatedLocalMissed[pupilId][subjectCode] = result.status === 'missed';
              }
            }
          }
        }
      }
      
      setResults(updatedLocalResults);
      setMissedSubjects(updatedLocalMissed);
      localDraftDirtyRef.current = false;
      setRemoteUpdateWhileEditing(false);
      
      toast({ title: "Success", description: "Grading scale and grades updated successfully" });
      setIsGradingModalOpen(false);
      
      // Refetch to get updated data from database
      const refetchResult = { data: { gradingScale: scaleToSave } };
      console.log('🔄 Refetched exam result data:', refetchResult.data?.gradingScale);
    } catch (error) {
      console.error('Error saving grading scale:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ variant: "destructive", title: "Error", description: `Failed to update grading scale: ${errorMessage}` });
    }
  }, [gradingScaleItems, examResultData, updateExamResultMutation, toast, subjectSnaps, resultLease.canSave, resultLease.holder, resultLease.token]);

  const getHeaderContent = useCallback(() => {
    const examNameStr = examDetails?.name || 'Exam';
    if (isEditMode) return { title: `${examNameStr} - Edit Results`, buttonText: 'Update Results', description: 'Edit existing results. Changes will be saved.' };
    return {
      title: `${examNameStr} - Record Results`,
      buttonText: 'Save Results',
      description: isNurseryExam
        ? 'Select one nursery assessment for every subject.'
        : 'Enter marks (0-100). Grades and aggregates are auto-calculated.'
    };
  }, [isEditMode, examDetails, isNurseryExam]);

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

  // 🚀 OPTIMIZED: Only show loading spinner if we have no cached data at all
  const showLoadingSpinner = !examId
    || (!examDetails && (isLoadingExams || isLoadingSelectedExam))
    || (isLoadingExamResult && !examResultData);
  
  if (showLoadingSpinner) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-sm text-gray-700">Loading exam data...</p>
        </div>
      </div>
    );
  }

  if (examResultError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
      <div className="flex items-center justify-center min-h-screen">
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
    if (isNurseryExam || !showMajorSubjectSelector) return null;

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
                {isNurseryExam ? 'Assessment' : 'Mark'}
              </th>
              {!isNurseryExam && (
                <th className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase">
                  Grade
                </th>
              )}
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
                    {isNurseryExam ? (
                      <Select
                        value={isMissed ? undefined : (commentaryResults[pupil.pupilId]?.[currentSubject.code] || undefined)}
                        onValueChange={(value) => handleCommentaryChange(pupil.pupilId, currentSubject.code, value as NurseryCommentary)}
                        disabled={isMissed}
                      >
                        <SelectTrigger className="h-8 min-w-44 text-xs mx-auto">
                          <SelectValue placeholder={isMissed ? 'MISSED' : 'Select assessment'} />
                        </SelectTrigger>
                        <SelectContent>
                          {NURSERY_COMMENTARY_OPTIONS.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
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
                    )}
                  </td>
                  {!isNurseryExam && <td className="px-2 py-1 whitespace-nowrap text-center">
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
                  </td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {!isNurseryExam && <div className="p-2 border-t bg-gray-50">
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
        </div>}
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
              {!isNurseryExam && <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">
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
              </th>}
              {!isNurseryExam && (examSubjects.length === 4 ||
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
                        {isNurseryExam ? (
                          <Select
                            value={isMissed ? undefined : (commentaryResults[pupil.pupilId]?.[subject.code] || undefined)}
                            onValueChange={(value) => handleCommentaryChange(pupil.pupilId, subject.code, value as NurseryCommentary)}
                            disabled={isMissed}
                          >
                            <SelectTrigger className="h-8 min-w-44 text-xs">
                              <SelectValue placeholder={isMissed ? 'MISSED' : 'Select assessment'} />
                            </SelectTrigger>
                            <SelectContent>
                              {NURSERY_COMMENTARY_OPTIONS.map(option => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : <Input
                          type="number"
                          min="0"
                          max={subject.totalMarks || 100}
                          value={isMissed ? '' : (results[pupil.pupilId]?.[subject.code] || '')}
                          onChange={(e) => handleMarksChange(pupil.pupilId, subject.code, e.target.value)}
                          disabled={isMissed}
                          placeholder={isMissed ? 'Missed' : ''}
                          className={`w-12 h-7 text-center text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isMissed ? 'bg-red-50 text-red-600 placeholder-red-400' : ''}`}
                        />}
                        {!isNurseryExam && isRelevantForAggregates && (
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
                {!isNurseryExam && <td className="px-2 py-1 whitespace-nowrap">
                  <div className="text-xs font-medium text-gray-900">
                    {pupilTotals[pupil.pupilId]?.total || 0}
                  </div>
                </td>}
                {!isNurseryExam && (examSubjects.length === 4 ||
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

  if (needsLockedEditorAcknowledgement && resultLease.holder) {
    const editorName = resultLease.holder.lockedByName || 'Another user';

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-lg border-amber-200 shadow-lg">
          <CardHeader className="space-y-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-xl text-slate-900">Marks are being recorded</CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-600">
                {editorName} is currently recording marks for this exam. You can continue entering marks. When you save, you will either wait for {editorName} or explicitly override the lock after a final warning.
              </CardDescription>
            </div>
          </CardHeader>
          <CardFooter className="flex flex-col-reverse gap-2 border-t bg-amber-50/50 p-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => router.push('/exams')} className="w-full sm:w-auto">
              Back to Exams
            </Button>
            <Button
              variant="outline"
              onClick={handleNotifyWhenReady}
              disabled={unlockNotificationStatus !== 'idle' || pushSubscription.isLoading}
              className="w-full border-amber-300 bg-white text-amber-800 hover:bg-amber-100 sm:w-auto"
            >
              {unlockNotificationStatus === 'requesting' || pushSubscription.isLoading
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <BellRing className="mr-2 h-4 w-4" />}
              {unlockNotificationStatus === 'requested' ? 'Notification requested' : 'Notify me when ready'}
            </Button>
            <Button
              onClick={() => setAcknowledgedBlockedLease(blockedLeaseKey)}
              className="w-full bg-amber-600 text-white hover:bg-amber-700 sm:w-auto"
            >
              Continue anyway
            </Button>
          </CardFooter>
        </Card>
      </div>
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
      <Dialog
        open={streamChooserOpen}
        onOpenChange={setStreamChooserOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose pupils to record</DialogTitle>
            <DialogDescription>
              This exam includes more than one stream. Load one stream for focused entry, or load all streams together.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Button type="button" variant="outline" className="h-11 justify-between" onClick={() => selectStreamScope('all')}>
              <span>All streams</span>
              <Badge variant="secondary">{allPupilSnaps.length} pupils</Badge>
            </Button>
            {examStreams.map(stream => {
              const count = filterExamPupilsByStream(allPupilSnaps, stream.id).length;
              return (
                <Button key={stream.id} type="button" variant="outline" className="h-11 justify-between" onClick={() => selectStreamScope(stream.id)}>
                  <span>{stream.name} <span className="text-muted-foreground">({stream.code})</span></span>
                  <Badge variant="secondary">{count} pupils</Badge>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <GlassPageTopBar
          title={examDetails?.name || getHeaderContent().title}
          subtitle={`${classSnap?.code || classSnap?.name || 'N/A'} | ${examDetails?.startDate ? new Date(examDetails.startDate).toLocaleDateString() : 'N/A'} - ${examDetails?.endDate ? new Date(examDetails.endDate).toLocaleDateString() : 'N/A'}`}
        leading={
          <button
            type="button"
            onClick={requestBackNavigation}
            aria-label="Back to exams"
            title="Back to exams"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-200/60 bg-blue-50/80 text-blue-600 shadow-sm transition-all duration-300 hover:scale-105 hover:bg-blue-100 hover:text-blue-700 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        }
        className="mb-1.5"
        meta={
          <span className="rounded-full border border-blue-200/60 bg-blue-50/80 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
            {filteredAndSortedPupils.length} of {pupilSnaps.length} pupils
          </span>
        }
        badges={hasUnsavedChanges ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Unsaved changes
          </span>
        ) : examStreams.length > 1 ? (
          <button
            type="button"
            onClick={() => setStreamChooserOpen(true)}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            {selectedStreamId === 'all' ? 'All streams' : examStreams.find(stream => stream.id === selectedStreamId)?.name}
          </button>
        ) : undefined}
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
                      icon={examSwitcher.label === 'Sets' ? <Grid3X3 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
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
                              onClick={() => requestExamSwitch(option.id, option.classId, option.label)}
                              className={`flex h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                                isCurrentExam
                                  ? 'cursor-default border-blue-600 bg-blue-600 text-white'
                                  : 'border-blue-100 bg-blue-50/70 text-blue-700 hover:border-blue-300 hover:bg-blue-100'
                              }`}
                              aria-current={isCurrentExam ? 'page' : undefined}
                            >
                              {examSwitcher.label === 'Sets' ? <Grid3X3 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
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
                label="View"
                icon={<Eye className="h-4 w-4" />}
                tone="emerald"
                onClick={requestViewResults}
                disabled={!viewResultsHref}
                title="View results for this class or set"
              />
              {!isNurseryExam && (
                <GlassActionButton
                  label="Scale"
                  icon={<Settings className="h-4 w-4" />}
                  tone="slate"
                onClick={() => setIsGradingModalOpen(true)}
                disabled={!resultLease.canSave}
                />
              )}
              <GlassActionButton
                label={isSubmitting ? 'Saving' : resultLease.canOverride ? 'Override' : 'Save'}
                icon={isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : resultLease.canOverride ? <AlertTriangle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                tone={resultLease.canOverride ? 'orange' : 'blue'}
                disabled={(!resultLease.canSave && !resultLease.canOverride) || isSubmitting || (!isNurseryExam && examSubjects.length > 4 && selectedMajorSubjects.length < 4)}
                title={
                  isSubmitting
                    ? "Saving results..."
                    : resultLease.canOverride
                      ? `Save anyway and take over from ${resultLease.holder?.lockedByName || 'the current editor'}`
                    : !resultLease.canSave
                      ? 'Waiting for an editing lease'
                    : (!isNurseryExam && examSubjects.length > 4 && selectedMajorSubjects.length < 4)
                      ? `Select 4 major subjects above to enable saving (${selectedMajorSubjects.length}/4 selected)`
                      : "Save exam results"
                }
                onClick={() => { void handleSubmit(); }}
              />
            </GlassActionDock>
          }
        />

      {resultLease.canOverride && acknowledgedBlockedLease === blockedLeaseKey && (
        <div className="mx-3 mb-2 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-950 shadow-sm sm:mx-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="min-w-0 text-xs leading-5">
            <span className="font-bold">Editing lock active:</span>{' '}
            {resultLease.holder?.lockedByName || 'Another editor'} may have unsaved marks. The Override button will show a final confirmation before taking control and saving this device's version.
          </div>
        </div>
      )}

      {remoteUpdateWhileEditing && (
        <div className="mx-3 mb-2 flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-rose-950 shadow-sm sm:mx-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
          <div className="min-w-0 text-xs leading-5">
            <span className="font-bold">Newer saved results arrived:</span>{' '}
            Your unsaved entries were kept instead of being replaced. Review them carefully before saving or overriding the other device.
          </div>
        </div>
      )}

      <GlassSummaryBar
        left={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 dark:text-indigo-200 uppercase">
              {isNurseryExam ? 'Nursery Assessment Scale' : 'Grading Scale'}
            </span>
          </div>
        }
        right={
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            {isNurseryExam ? NURSERY_COMMENTARY_OPTIONS.map(option => (
              <div key={option} className="border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold text-emerald-800 whitespace-nowrap">
                {option}
              </div>
            )) : [...gradingScaleItems]
              .sort((a, b) => a.minMark - b.minMark)
              .map((scale, index) => (
                <div
                  key={index}
                  className={`border px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold whitespace-nowrap ${
                    scale.grade === 'MISSED' ? 'bg-orange-50/80 text-orange-700 border-orange-200' :
                    scale.grade.startsWith('D') ? 'bg-green-50/80 text-green-700 border-green-200' :
                    scale.grade.startsWith('C') ? 'bg-blue-50/80 text-blue-700 border-blue-200' :
                    scale.grade.startsWith('P') ? 'bg-yellow-50/80 text-yellow-700 border-yellow-200' :
                    'bg-red-50/80 text-red-700 border-red-200'
                  }`}
                >
                  <span className="opacity-80 font-medium">{scale.grade}:</span> {scale.minMark}-{scale.maxMark}
                </div>
              ))}
          </div>
        }
      />

      <div className="max-w-none px-4 sm:px-6 lg:px-8 pb-12">
        <Card className="shadow-sm overflow-hidden">
          <CardContent className="p-0">

            <MajorSubjectsSelectorComponent />
          
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

      <Dialog
        open={overrideSaveDialogOpen}
        onOpenChange={(open) => {
          if (isSubmitting) return;
          setOverrideSaveDialogOpen(open);
          if (!open) setOverrideSaveAcknowledged(false);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-800">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100">
                <AlertTriangle className="h-5 w-5 text-rose-700" aria-hidden="true" />
              </span>
              Override active editing lock?
            </DialogTitle>
            <DialogDescription className="leading-6">
              {resultLease.holder?.lockedByName || 'Another editor'} currently owns this exam. This can also be another device or an older tab using the same account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-950">
              Saving with override will take control on this device and replace the currently saved result with the marks shown here. Unsaved work on the other device will not be included, and its next save will be rejected unless it takes control again.
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 hover:bg-slate-50">
              <Checkbox
                checked={overrideSaveAcknowledged}
                onCheckedChange={(checked) => setOverrideSaveAcknowledged(checked === true)}
                className="mt-0.5"
                aria-label="Acknowledge the risk of overriding the active result editor"
              />
              <span>I understand that this device's results will become the saved version.</span>
            </label>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setOverrideSaveDialogOpen(false)} disabled={isSubmitting}>
              Keep waiting
            </Button>
            <Button
              variant="destructive"
              disabled={!overrideSaveAcknowledged || isSubmitting}
              onClick={async () => {
                const didSave = await handleSubmit({ overrideLock: true });
                if (!didSave) return;
                setOverrideSaveDialogOpen(false);
                setOverrideSaveAcknowledged(false);
                if (pendingNavigation) {
                  const target = pendingNavigation;
                  setPendingNavigation(null);
                  continueNavigation(target);
                }
              }}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Overriding and saving...' : 'Override and save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingNavigation !== null} onOpenChange={(open) => !open && !isSubmitting && setPendingNavigation(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unsaved result changes
            </DialogTitle>
            <DialogDescription>
              {pendingNavigation?.kind === 'switch'
                ? `You are about to switch to ${pendingNavigation.label}. The current class has changes that have not been saved.`
                : pendingNavigation?.kind === 'view'
                  ? 'You are about to open View Results with changes that have not been saved.'
                : 'You are about to leave the Record Results page with changes that have not been saved.'}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-800">Current changes</p>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {(unsavedChangeSummary.length > 0 ? unsavedChangeSummary : ['Result information changed']).map((change) => (
                <li key={change} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>

          {!canSaveDraft && (
            <p className="text-xs font-medium text-rose-600">
              Select exactly four major subjects before these results can be saved. You can still discard the changes or cancel.
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setPendingNavigation(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDiscardAndContinue} disabled={isSubmitting}>
              Discard
            </Button>
            <Button onClick={handleSaveAndContinue} disabled={isSubmitting || !canSaveDraft}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isNurseryExam && <GradingScaleModal
        isOpen={isGradingModalOpen}
        onClose={() => setIsGradingModalOpen(false)}
        gradingScale={gradingScaleItems}
        onGradeScaleChange={handleGradeScaleItemChange}
        onSave={handleSaveGradingScale}
      />}
    </div>
  );
}
