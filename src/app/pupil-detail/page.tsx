"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, UserSquare, BookOpen as AcademicIcon, Users as GuardianIconLucide, HeartPulse, CalendarDays, MapPin, Phone, Mail, Briefcase, Home, Edit, Trash2, Receipt, Shirt, BookOpen, MoreVertical, User, GraduationCap, Shield, CreditCard, UserPlus, ChevronDown, BarChart3, Settings, History, TrendingUp, TrendingDown, ArrowRight, Clock, Tag, Printer, Award, FileText, FileText as FileTextIcon, Check, AlertTriangle, Eye } from "lucide-react";
import { X } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { GlassPageTopBar } from "@/components/common/glass-page-top-bar";
import { GlassPageRouteSkeleton } from "@/components/common/glass-page-loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from "@/components/ui/modern-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import type { Pupil, Class, AdditionalIdentifier, PupilAssignedFee, House } from "@/types";
import { HousesService } from "@/lib/services/houses.service";
import { formatStaffRoles } from "@/lib/utils/format";
import { usePupil, usePupilsByFamily, useUpdatePupil } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { useStaff, useStaffById } from "@/lib/hooks/use-staff";
import { usePupilExamHistory, useExamResultByExamId, useExams } from "@/lib/hooks/use-exams";
import { useAcademicYears, useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import { createStaffNameMap } from "@/lib/utils/staff-names";
import { generateModernBatchReportPDF, generateTransBatchReportPDF } from '@/components/exam/ModernBatchReportPDF';
import { generateFullReport2PDF } from '@/components/exam/FullReport2PDF';
import { generatePrimaryMiniReportPDF } from '@/components/exam/PrimaryMiniReportPDF';
import { IndividualReportPrintDialog } from '@/components/exam/IndividualReportPrintDialog';
import { FullReport2PaletteSelector } from '@/components/exam/FullReport2PaletteSelector';
import { getNextTermDates } from '@/lib/utils/academic-year-utils';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';
import { ExamsService } from '@/lib/services/exams.service';
import { SchoolSettingsService } from '@/lib/services/school-settings.service';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { ManageIdCodesModal } from "@/components/pupils/manage-id-codes-modal";
import { ManagePayCodeModal } from "@/components/pupils/manage-pay-code-modal";
import { AssignmentModal } from "@/components/pupils/assignment-modal";
import { useToast } from "@/hooks/use-toast";
import { PupilPhotoDetail } from "@/components/ui/pupil-photo-detail";
import { ActionGuard } from "@/components/auth/action-guard";
import { useAuth } from "@/lib/contexts/auth-context";
import { LinkedUserAccountDialog } from "@/components/users/linked-user-account-dialog";
import { RMQRCode } from "@/components/ui/rmqr-code";
import { usePupilPLEResults } from '@/lib/hooks/use-ple-results';
import { DatePicker } from '@/components/common/date-picker';
import { format } from 'date-fns';
import PLEResultsCard from '@/components/ple/PLEResultsCard';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { getPupilClassDisplay } from '@/lib/utils/class-streams';
import { PDFViewer } from '@/components/pdf/pdf-viewer';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { usePrint } from '@/lib/contexts/print-context';
import { GENDERS, PUPIL_SECTIONS, PUPIL_STATUSES, GUARDIAN_RELATIONSHIPS } from '@/lib/constants';
import { getCurrentTerm, getActiveOrMostRecentTerm } from '@/lib/utils/academic-year-utils';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import { getSchoolPayCode } from '@/lib/utils/schoolpay';

// Import Swiper components


const formatDate = (dateString: string | undefined | null) => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

const formatDateWithoutYear = (dateString: string | undefined | null) => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

const getClassName = (classId: string | undefined, classes: Class[]) => {
  if (!classId) return "N/A";
  const cls = classes.find(c => c.id === classId);
  return cls ? cls.name : "N/A";
};

const getClassCode = (classId: string | undefined, classes: Class[]) => {
  if (!classId) return "N/A";
  const cls = classes.find(c => c.id === classId);
  return cls ? cls.code : "N/A";
};

interface DetailItemProps {
  icon?: React.ReactNode;
  label: string;
  value: string | React.ReactNode | undefined | null;
  multiline?: boolean;
  highlight?: boolean;
  compact?: boolean;
}

interface EditableDetailItemProps extends DetailItemProps {
  isEditMode?: boolean;
  fieldName?: string;
  onValueChange?: (value: string) => void;
  inputType?: 'text' | 'textarea' | 'date' | 'select';
  selectOptions?: { value: string; label: string }[];
}

const DetailItem = React.memo(function DetailItem({
  icon,
  label,
  value,
  multiline = false,
  highlight = false,
  isEditMode = false,
  fieldName,
  onValueChange,
  inputType = 'text',
  selectOptions = [],
  compact = false
}: EditableDetailItemProps) {
  const [localValue, setLocalValue] = React.useState(value || '');

  React.useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  // In edit mode, always show the field even if empty
  // In view mode, hide if value is empty, null, undefined, or "N/A"
  if (!isEditMode && (!value || value === "N/A" || (typeof value === 'string' && value.trim() === ''))) {
    return null;
  }

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  return (
    <div className={`flex ${multiline ? 'flex-col items-start' : 'items-center justify-between'} ${compact ? 'py-0.5 text-xs' : 'py-1.5 text-xs sm:text-sm'} border-b border-border/50 last:border-b-0`}>
      <div className="flex items-center">
        {icon && <span className={`mr-2 text-muted-foreground ${compact ? 'h-3.5 w-3.5 [&>svg]:h-3.5 [&>svg]:w-3.5' : ''}`}>{icon}</span>}
        <span className={`font-medium text-muted-foreground ${compact ? 'text-[11px]' : ''}`}>{label}:</span>
      </div>
      {isEditMode ? (
        <div className={`flex-1 ${multiline ? 'w-full mt-1' : 'ml-4 max-w-[65%]'}`}>
          {inputType === 'textarea' ? (
            <Textarea
              value={localValue as string}
              onChange={(e) => handleChange(e.target.value)}
              className="min-h-[60px] text-sm"
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          ) : inputType === 'date' ? (
            <DatePicker
              date={localValue ? (() => { const d = new Date(localValue as string); return isNaN(d.getTime()) ? undefined : d; })() : undefined}
              setDate={(d) => handleChange(d ? format(d, 'yyyy-MM-dd') : '')}
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          ) : inputType === 'select' ? (
            <Select
              value={localValue as string || ''}
              onValueChange={handleChange}
            >
              <SelectTrigger className="text-sm h-8">
                <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {selectOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={localValue as string}
              onChange={(e) => handleChange(e.target.value)}
              className="text-sm"
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          )}
        </div>
      ) : (
        <span className={`text-right ${multiline ? 'mt-0.5 ml-0 sm:ml-4 text-left sm:text-right' : ''} ${highlight ? 'font-semibold text-primary' : 'text-foreground'} ${compact ? 'text-[11px]' : ''}`}>
          {value}
        </span>
      )}
    </div>
  );
});



function PupilDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pupilId = searchParams?.get('id');
  const { toast } = useToast();
  const { canAccessModule } = useAuth();
  const queryClient = useQueryClient();

  // Firebase hooks - these will use cached data immediately if available
  const { data: pupil, isLoading: pupilLoading, error } = usePupil(pupilId || '');
  const { data: siblings = [], isLoading: siblingsLoading } = usePupilsByFamily(pupil?.familyId || '');
  const { data: classes = [] } = useClasses();
  const { data: allStaff = [] } = useStaff();
  const { data: assignedStaff, isLoading: staffLoading } = useStaffById(pupil?.assignedStaffId || '', { enabled: !!pupil?.assignedStaffId });

  // 🚀 CRITICAL: Only show loading if we don't have cached data
  // If we have cached data (even if stale), show it immediately
  const hasCachedData = (pupil !== undefined && pupil !== null);
  const isLoading = !hasCachedData && pupilLoading;
  const { data: schoolSettings } = useSchoolSettings();
  const updatePupilMutation = useUpdatePupil();

  // Academic years data for filters
  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();

  // PDF Viewer hook
  const pdfViewer = usePDFViewer();
  const { registerPrintHandler } = usePrint();

  // Exam loading state - start with false to load on demand
  const [shouldLoadExams, setShouldLoadExams] = React.useState(false);

  // Exam filters state - must be declared before usePupilExamHistory which references it
  const [examFilters, setExamFilters] = React.useState({
    academicYearId: 'all',
    termId: 'all'
  });

  // Fetch pupil's exam history - only when shouldLoadExams is true
  const {
    data: pupilExamHistory,
    isLoading: isLoadingExamHistory
  } = usePupilExamHistory(pupilId || '', {
    enabled: shouldLoadExams,
    academicYearId: examFilters.academicYearId,
    termId: examFilters.termId
  });

  // Print modal state
  const [showPrintModal, setShowPrintModal] = React.useState(false);
  const [selectedExamId, setSelectedExamId] = React.useState<string | null>(null);
  const [selectedExamResultId, setSelectedExamResultId] = React.useState<string | null>(null);
  const [expandedExamIds, setExpandedExamIds] = React.useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationStatus, setGenerationStatus] = React.useState('');
  const [generationProgress, setGenerationProgress] = React.useState(0);
  const [startTime, setStartTime] = React.useState<number | null>(null);
  const [eta, setEta] = React.useState<string>('');

  // TRANS report type selection state
  const [showTransTypeModal, setShowTransTypeModal] = React.useState(false);
  const [transReportType, setTransReportType] = React.useState<'grading' | 'progress' | null>(null);
  const [selectedFullReportTemplate, setSelectedFullReportTemplate] = React.useState<'standard' | 'full2'>('standard');
  const [fullReport2Palette, setFullReport2Palette] = React.useState<'blue' | 'purple' | 'orange'>('blue');
  const [showReportConfigModal, setShowReportConfigModal] = React.useState(false);
  const [showComparisonExamModal, setShowComparisonExamModal] = React.useState(false);
  const [selectedComparisonExams, setSelectedComparisonExams] = React.useState<string[]>([]);
  const [comparisonExamNames, setComparisonExamNames] = React.useState<Record<string, string>>({});

  // PLE Results dialog state
  const [showPLEDialog, setShowPLEDialog] = React.useState(false);
  const { data: pupilPLEResults = [], isLoading: isLoadingPLEResults } = usePupilPLEResults(pupilId || '');
  const [availableComparisonExams, setAvailableComparisonExams] = React.useState<any[]>([]);
  const [isLoadingComparisonExams, setIsLoadingComparisonExams] = React.useState(false);

  // Report configuration state
  const [reportConfig, setReportConfig] = React.useState({
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
  const [customDates, setCustomDates] = React.useState({
    createdOn: '',
    nextTermBegins: '',
    nextTermEnds: '',
  });

  // Fetch exams for comparison
  const { data: exams = [] } = useExams();

  // Fetch exam result data when an exam is selected for printing
  const {
    data: examResultData,
    isLoading: isLoadingExamResult
  } = useExamResultByExamId(selectedExamId || '');

  // Set default exam filters using the same centralized logic as the working
  // exams and fees-collection pages. getEffectiveTermForDataDisplay uses date-fns
  // parseISO/isWithinInterval (timezone-safe) and handles holiday periods by
  // returning the most recently completed term across ALL academic years.
  React.useEffect(() => {
    if (academicYears.length > 0) {
      const effective = getEffectiveTermForDataDisplay(academicYears);
      if (effective?.academicYear?.id && effective?.term?.id) {
        setExamFilters(prev => ({
          ...prev,
          academicYearId: effective.academicYear!.id,
          termId: effective.term!.id
        }));
      }
    }
  }, [academicYears]);

  // Get available terms based on selected academic year
  const availableTerms = React.useMemo(() => {
    if (examFilters.academicYearId === 'all') {
      return [];
    }

    const selectedYear = academicYears.find(y => y.id === examFilters.academicYearId);
    return selectedYear?.terms || [];
  }, [academicYears, examFilters.academicYearId]);

  const [isManageIdCodesModalOpen, setIsManageIdCodesModalOpen] = React.useState(false);
  const [isManagePayCodeModalOpen, setIsManagePayCodeModalOpen] = React.useState(false);
  const [isStatusChangeModalOpen, setIsStatusChangeModalOpen] = React.useState(false);
  const [isLinkedAccountOpen, setIsLinkedAccountOpen] = React.useState(false);

  // Force reset modal state on component mount to ensure clean state
  React.useEffect(() => {
    setIsStatusChangeModalOpen(false);
    setIsManageIdCodesModalOpen(false);
    setIsManagePayCodeModalOpen(false);
  }, []);


  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = React.useState(false);
  const [selectedStatus, setSelectedStatus] = React.useState('');
  const [selectedClassId, setSelectedClassId] = React.useState('');
  const [showClassSelection, setShowClassSelection] = React.useState(false);

  // Add class change modal state
  const [classChangeModal, setClassChangeModal] = React.useState<{
    isOpen: boolean;
  }>({
    isOpen: false,
  });
  const [selectedNewClassId, setSelectedNewClassId] = React.useState('');

  // Add guardian edit modal state
  const [isEditGuardiansModalOpen, setIsEditGuardiansModalOpen] = React.useState(false);
  const [editingGuardians, setEditingGuardians] = React.useState<any[]>([]);
  const [showGuardianEditButton, setShowGuardianEditButton] = React.useState(false);

  // Add state for toggling between age and date of birth
  const [showDateOfBirth, setShowDateOfBirth] = React.useState(false);

  // Edit mode state
  const [isEditMode, setIsEditMode] = React.useState(false);

  // Editable fields state
  const [editableFields, setEditableFields] = React.useState<Partial<Pupil>>({});

  // Editable guardians state
  const [editableGuardians, setEditableGuardians] = React.useState<any[]>([]);

  // Houses state
  const [houses, setHouses] = React.useState<House[]>([]);
  const [housesLoading, setHousesLoading] = React.useState<boolean>(false);
  const [isHouseChangeOpen, setIsHouseChangeOpen] = React.useState(false);
  const [isFamilyModalOpen, setIsFamilyModalOpen] = React.useState(false);
  const [selectedHouseId, setSelectedHouseId] = React.useState<string>(pupil?.houseId || '');
  const loadHouses = React.useCallback(async () => {
    setHousesLoading(true);
    try {
      const data = await HousesService.getAll();
      data.sort((a, b) => a.name.localeCompare(b.name));
      setHouses(data);
    } catch (e) {
      console.error('Failed to load houses', e);
    } finally {
      setHousesLoading(false);
    }
  }, []);
  React.useEffect(() => {
    loadHouses();
  }, [loadHouses]);
  React.useEffect(() => {
    setSelectedHouseId(pupil?.houseId || '');
  }, [pupil?.houseId]);
  const currentHouse = React.useMemo(() => houses.find(h => h.id === pupil?.houseId), [houses, pupil?.houseId]);


  // Filter out the current pupil from siblings list
  const actualSiblings = React.useMemo(() =>
    siblings.filter(sibling => sibling.id !== pupilId),
    [siblings, pupilId]
  );

  // Unlink sibling state
  const [unlinkSiblingConfirm, setUnlinkSiblingConfirm] = React.useState<{
    siblingToUnlink: typeof actualSiblings[0];
    remainingSiblings: typeof actualSiblings;
  } | null>(null);
  const [isUnlinking, setIsUnlinking] = React.useState(false);

  const handleUnlinkSibling = async () => {
    if (!unlinkSiblingConfirm) return;
    const { siblingToUnlink } = unlinkSiblingConfirm;
    setIsUnlinking(true);
    try {
      await updatePupilMutation.mutateAsync({
        id: siblingToUnlink.id,
        data: { familyId: `solo-${siblingToUnlink.id}-${Date.now()}` }
      });
      toast({
        title: 'Sibling Unlinked',
        description: `${siblingToUnlink.firstName} ${siblingToUnlink.lastName} has been unlinked and given a new family ID.`
      });
      setUnlinkSiblingConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['pupils'] });
    } catch (error) {
      console.error('Failed to unlink sibling:', error);
      toast({
        variant: 'destructive',
        title: 'Unlink Failed',
        description: 'Failed to unlink sibling. Please try again.'
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  // Memoize the getClassName function with classes
  const getClassNameMemo = React.useCallback((classId: string | undefined) => {
    return getClassName(classId, classes);
  }, [classes]);

  // Populate pupil with class name from already-loaded classes (client-side, instant)
  const pupilWithClass = React.useMemo(() => {
    if (!pupil) return null;
    const classData = classes.find(c => c.id === pupil.classId);
    const classDisplay = getPupilClassDisplay(pupil, classData);
    return {
      ...pupil,
      className: classDisplay.name,
      classCode: classDisplay.code,
    };
  }, [pupil, classes]);

  // Memoize emergency contact guardian calculation
  const emergencyContactGuardian = React.useMemo(() => {
    return pupil?.emergencyContactGuardianId
      ? pupil.guardians.find(g => g.id === pupil.emergencyContactGuardianId)
      : null;
  }, [pupil?.emergencyContactGuardianId, pupil?.guardians]);

  // Consolidate all identifiable numbers for display
  const allIdentifiers = React.useMemo(() => {
    const ids: AdditionalIdentifier[] = [];
    if (pupil?.additionalIdentifiers) {
      ids.push(...pupil.additionalIdentifiers);
    }
    // If old LIN exists and no new LIN is present, add it for display
    if (pupil?.learnerIdentificationNumber && !ids.some(id => id.idType === 'LIN')) {
      ids.push({ idType: 'LIN', idValue: pupil.learnerIdentificationNumber });
    }
    return ids;
  }, [pupil]);

  const academicIdentifiers = allIdentifiers.filter(id => id.idType === 'LIN' || id.idType === 'Index Number');
  const personalIdentifiers = allIdentifiers.filter(id => id.idType !== 'LIN' && id.idType !== 'Index Number');

  // Calculate age from date of birth with years and months
  const calculateAge = (dateOfBirth: string | undefined): string => {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);

    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();

    // Adjust if the birthday hasn't occurred yet this year
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
      years--;
      months += 12;
    }

    // Adjust months if day of month hasn't been reached
    if (today.getDate() < birthDate.getDate()) {
      months--;
      if (months < 0) {
        months = 11;
      }
    }

    // Format the output
    const yearText = years === 1 ? 'year' : 'years';
    const monthText = months === 1 ? 'month' : 'months';

    if (years === 0) {
      return `${months} ${monthText}`;
    } else if (months === 0) {
      return `${years} ${yearText}`;
    } else {
      return `${years} ${yearText} ${months} ${monthText}`;
    }
  };

  const handleSaveIdCodes = async (identifiers: AdditionalIdentifier[]) => {
    if (!pupil) return;

    try {
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: { additionalIdentifiers: identifiers },
      });
      toast({
        title: "ID Codes Updated",
        description: "Successfully updated ID codes.",
      });
    } catch (err) {
      console.error("Failed to update ID codes:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update ID codes. Please try again.",
      });
    }
  };

  const handleSavePayCode = async (payCode: string | null) => {
    if (!pupil) return;
    const existing = (pupil.additionalIdentifiers || []).filter(
      (id) => !(id.idType || '').toLowerCase().includes('pay code')
    );
    const updated = payCode
      ? [...existing, { idType: 'SchoolPay Payment Code', idValue: payCode }]
      : existing;
    try {
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: { additionalIdentifiers: updated, payCode: payCode || '' },
      });
      toast({
        title: payCode ? 'Pay Code Saved' : 'Pay Code Removed',
        description: payCode
          ? `SchoolPay payment code set to ${payCode}.`
          : `SchoolPay payment code removed.`,
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save pay code.' });
    }
  };

  const handlePhotoChange = async (photoData: string | undefined) => {
    if (!pupil) return;

    try {
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: { photo: photoData },
      });
      toast({
        title: "Photo Updated",
        description: `${pupil.firstName}'s photo has been updated successfully.`,
      });
    } catch (err) {
      console.error("Failed to update photo:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update photo. Please try again.",
      });
    }
  };

  const handleSaveAssignments = async (updatedAssignedFees: PupilAssignedFee[]) => {
    if (!pupil) return;

    try {
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: { assignedFees: updatedAssignedFees },
      });
      toast({
        title: "Assignments Updated",
        description: "Successfully updated fee assignments and discounts.",
      });
      
      // Force aggressive invalidation of fee calculation queries to refresh the Fees & Payments view
      queryClient.invalidateQueries({ queryKey: ['pupil-snapshot', pupil.id] });
      queryClient.invalidateQueries({ queryKey: ['previous-balance', pupil.id] });
      queryClient.invalidateQueries({ queryKey: ['pupil-payments-all', pupil.id] });
      
    } catch (err) {
      console.error("Failed to update assignments:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update assignments. Please try again.",
      });
    }
  };

  // Add class change handlers for individual pupil
  const handlePupilClassChange = () => {
    setClassChangeModal({ isOpen: true });
    setSelectedNewClassId(pupil?.classId || '');
  };

  const confirmClassChange = async () => {
    if (!pupil || !selectedNewClassId) return;

    if (selectedNewClassId === pupil.classId) {
      toast({
        variant: "destructive",
        title: "No Change",
        description: "Please select a different class.",
      });
      return;
    }

    try {
      const updateData: any = {
        classId: selectedNewClassId,
        className: getClassNameMemo(selectedNewClassId),
      };

      // Add promotion history entry
      const promotionHistoryEntry = {
        date: new Date().toISOString(),
        fromClassId: pupil.classId,
        fromClassName: pupil.className || getClassNameMemo(pupil.classId),
        toClassId: selectedNewClassId,
        toClassName: getClassNameMemo(selectedNewClassId),
        type: 'Transfer' as const,
        notes: `Class changed from pupil details page`,
        processedBy: "System Admin", // TODO: Replace with actual user
      };

      updateData.promotionHistory = [...(pupil.promotionHistory || []), promotionHistoryEntry];

      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: updateData,
      });

      toast({
        title: "Class Updated",
        description: `${pupil.firstName}'s class has been changed from ${getClassNameMemo(pupil.classId)} to ${getClassNameMemo(selectedNewClassId)}.`,
      });

      setClassChangeModal({ isOpen: false });
      setSelectedNewClassId('');
    } catch (err) {
      console.error("Failed to update class:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update class. Please try again.",
      });
    }
  };

  // Add section change handler for individual pupil
  const handlePupilSectionChange = async (newSection: 'Day' | 'Boarding') => {
    if (!pupil) return;

    if (pupil.section === newSection) {
      toast({
        variant: "destructive",
        title: "No Change",
        description: `${pupil.firstName} is already in ${newSection} section.`,
      });
      return;
    }

    try {
      const updateData: any = {
        section: newSection,
      };

      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: updateData,
      });

      toast({
        title: "Section Updated",
        description: `${pupil.firstName}'s section has been changed from ${pupil.section || 'N/A'} to ${newSection}.`,
      });

    } catch (err) {
      console.error("Failed to update section:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update section. Please try again.",
      });
    }
  };

  // Add guardian edit handlers
  const handleEditGuardians = () => {
    if (!pupil) return;
    // Load all existing guardians for editing
    const currentGuardians = pupil.guardians || [];
    setEditingGuardians(currentGuardians.map(g => ({ ...g })));
    setIsEditGuardiansModalOpen(true);
    // Hide the button after opening modal
    setShowGuardianEditButton(false);
  };

  const handleAddSecondaryGuardian = () => {
    // Add a new empty guardian to the editing list
    const newGuardian = {
      id: `guardian-${Date.now()}`,
      firstName: '',
      lastName: '',
      relationship: '',
      phone: '',
      secondaryPhone: '',
      email: '',
      occupation: '',
      address: '',
      nationalId: ''
    };
    setEditingGuardians([...editingGuardians, newGuardian]);
  };

  const handleRemoveGuardian = (index: number) => {
    const updated = editingGuardians.filter((_, i) => i !== index);
    setEditingGuardians(updated);
  };

  const handleUpdateGuardian = (index: number, field: string, value: string) => {
    const updated = [...editingGuardians];
    updated[index] = { ...updated[index], [field]: value };
    setEditingGuardians(updated);
  };

  const handleSaveGuardians = async () => {
    if (!pupil) return;

    // Validate that at least one guardian exists and has required fields
    const validGuardians = editingGuardians.filter(g =>
      g.firstName && g.lastName && g.phone && g.relationship
    );

    if (validGuardians.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "At least one guardian with complete information is required.",
      });
      return;
    }

    try {
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: { guardians: validGuardians },
      });

      toast({
        title: "Guardians Updated",
        description: "Guardian information has been updated successfully.",
      });

      setIsEditGuardiansModalOpen(false);
      setEditingGuardians([]);
    } catch (err) {
      console.error("Failed to save guardians:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update guardian information. Please try again.",
      });
    }
  };

  // Handle saving edits from inline edit mode
  const handleSaveEdits = async () => {
    if (!pupil) return;

    try {
      // Clean up empty strings - convert to undefined, but keep required fields
      const cleanedFields: Partial<Pupil> = {};

      // Handle name fields - these are required
      if (editableFields.firstName !== undefined) cleanedFields.firstName = editableFields.firstName || pupil.firstName;
      if (editableFields.lastName !== undefined) cleanedFields.lastName = editableFields.lastName || pupil.lastName;
      if (editableFields.otherNames !== undefined) cleanedFields.otherNames = editableFields.otherNames || undefined;

      // Handle admission number - required
      if (editableFields.admissionNumber !== undefined) cleanedFields.admissionNumber = editableFields.admissionNumber || pupil.admissionNumber;

      // Handle other fields
      Object.keys(editableFields).forEach(key => {
        if (key === 'firstName' || key === 'lastName' || key === 'admissionNumber') return; // Already handled

        const fieldKey = key as keyof Pupil;
        const value = editableFields[fieldKey];

        if (value !== undefined && value !== null && value !== '') {
          // Type-safe assignment
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            (cleanedFields as any)[fieldKey] = value;
          }
        } else if (key === 'otherNames' || key === 'classId' || key === 'section' || key === 'status') {
          // These can be empty strings, convert to undefined
          (cleanedFields as any)[fieldKey] = undefined;
        }
      });

      // If classId changed, update className too
      if (cleanedFields.classId !== undefined) {
        const selectedClass = classes.find(c => c.id === cleanedFields.classId);
        if (selectedClass) {
          cleanedFields.className = selectedClass.name;
        }
      }

      // Handle guardians - filter out empty guardians and clean up fields
      if (editableGuardians.length > 0) {
        const validGuardians = editableGuardians
          .filter(g => g.firstName || g.lastName || g.phone) // Keep if has any data
          .map(g => ({
            id: g.id || `g-${Date.now()}-${Math.random()}`,
            firstName: g.firstName || '',
            lastName: g.lastName || '',
            relationship: g.relationship || '',
            phone: g.phone || '',
            secondaryPhone: g.secondaryPhone || undefined,
            email: g.email || undefined,
            occupation: g.occupation || undefined,
            address: g.address || undefined,
            nationalId: g.nationalId || undefined,
          }));

        if (validGuardians.length > 0) {
          cleanedFields.guardians = validGuardians;
        }
      }

      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: cleanedFields,
      });

      toast({
        title: "Details Updated",
        description: "Pupil information has been updated successfully.",
      });

      setIsEditMode(false);
      setEditableFields({});
      setEditableGuardians([]);
    } catch (err) {
      console.error("Failed to save edits:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update pupil information. Please try again.",
      });
    }
  };

  // ID card PDF generation function with precise positioning
  const handleGenerateIDCard = async () => {
    if (!pupil) return;

    try {
      toast({
        title: "Generating ID Card",
        description: "Your ID card is being prepared...",
      });

      // Dynamic imports to avoid SSR issues
      const [
        { default: ReactPDF },
        { Document, Page, Text, View, StyleSheet, Image, Font },
        QRCode
      ] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@react-pdf/renderer'),
        import('qrcode')
      ]);

      // Use local fonts instead of loading from CDN
      Font.register({
        family: 'Helvetica',
        fonts: [
          { src: '/fonts/Helvetica.ttf' },
          { src: '/fonts/Helvetica-Bold.ttf', fontWeight: 'bold' }
        ]
      });

      // A4 dimensions in points (1 point = 1/72 inch)
      const A4_WIDTH = 595.28;  // 210mm
      const A4_HEIGHT = 841.89; // 297mm

      // ID card dimensions from image (in mm, converted to points)
      const ID_CARD_WIDTH = 86 * 2.83465;  // 86mm to points
      const ID_CARD_HEIGHT = 55 * 2.83465; // 55mm to points

      // Margins from image (in mm, converted to points)
      const LEFT_MARGIN = 32 * 2.83465;  // 32mm to points
      const TOP_MARGIN = 10 * 2.83465;   // 10mm to points
      const BOTTOM_MARGIN = 5 * 2.83465; // 5mm to points

      // Color constants
      const COLORS = {
        navy: '#002B5B',
        gold: '#FFB800',
        burgundy: '#8B0000',
        white: '#FFFFFF',
        pink: '#FFF5F5',
        gray: {
          text: '#374151',
          border: '#D1D5DB'
        }
      };

      // Generate QR code
      const generateQRCodeSync = async (data: object): Promise<string> => {
        try {
          const jsonString = JSON.stringify(data || {});

          return await QRCode.toDataURL(jsonString, {
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 4,
            width: 200,
            color: {
              dark: '#000000FF',
              light: '#FFFFFFFF'
            }
          });
        } catch (error) {
          console.error('QR generation error:', error);
          throw error;
        }
      };

      // Create QR code data
      const qrData = {
        id: pupil.admissionNumber || '',
        name: `${pupil.firstName || ''} ${pupil.lastName || ''}`.trim(),
        class: pupilWithClass?.className || getClassName(pupil.classId, classes),
        section: pupil.section || ''
      };

      const qrCodeDataURL = await generateQRCodeSync(qrData);

      const styles = StyleSheet.create({
        page: {
          width: A4_WIDTH,
          height: A4_HEIGHT,
          backgroundColor: COLORS.white,
          padding: 0
        },
        cardContainer: {
          position: 'absolute',
          top: TOP_MARGIN,
          left: LEFT_MARGIN,
          width: ID_CARD_WIDTH,
          height: ID_CARD_HEIGHT,
          backgroundColor: COLORS.white,
          fontFamily: 'Helvetica'
        },
        mainContainer: {
          flexDirection: 'row',
          height: '100%'
        },
        // Left section styles
        leftSection: {
          width: '35%',
          backgroundColor: COLORS.navy,
          position: 'relative',
          padding: 0,
          display: 'flex',
          alignItems: 'center'
        },
        hexagonContainer: {
          position: 'relative',
          width: '100%',
          height: 'auto',
          marginTop: 0,
          paddingTop: 8
        },
        photoContainer: {
          position: 'relative',
          width: 75,
          height: 75,
          marginLeft: 8,
          backgroundColor: COLORS.white,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2
        },
        photoBorder: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          border: `2px solid ${COLORS.gold}`,
          borderRadius: 8
        },
        photo: {
          width: '100%',
          height: '100%',
          borderRadius: 6,
          objectFit: 'cover'
        },
        dobContainer: {
          marginTop: 8,
          width: '100%',
          paddingHorizontal: 4
        },
        dobLabel: {
          fontSize: 5,
          color: COLORS.gold,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold',
          marginBottom: 1
        },
        dobValue: {
          fontSize: 6,
          color: COLORS.white,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold'
        },
        payCodeContainer: {
          marginTop: 6,
          width: '100%',
          paddingHorizontal: 4
        },
        payCodeLabel: {
          fontSize: 5,
          color: COLORS.gold,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold',
          marginBottom: 1
        },
        payCodeValue: {
          fontSize: 6,
          color: COLORS.white,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold'
        },
        decorativeDots: {
          position: 'absolute',
          bottom: 4,
          left: 4,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: 35,
          gap: 2
        },
        dot: {
          width: 2,
          height: 2,
          backgroundColor: COLORS.gold,
          borderRadius: 1
        },
        // Right section styles
        rightSection: {
          width: '65%',
          backgroundColor: COLORS.pink,
          padding: 6,
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        },
        schoolName: {
          fontSize: 8,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.gold,
          marginBottom: 0.5,
          textAlign: 'center',
          width: '100%'
        },
        schoolNameSecondLine: {
          fontSize: 9,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.navy,
          marginBottom: 1,
          textAlign: 'center',
          width: '100%'
        },
        phoneNumbers: {
          fontSize: 5,
          color: COLORS.gray.text,
          marginBottom: 4,
          textAlign: 'center',
          width: '100%'
        },
        idTitle: {
          fontSize: 9,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.burgundy,
          marginBottom: 4,
          textAlign: 'center',
          width: '100%'
        },
        infoRow: {
          borderBottom: `0.5px solid ${COLORS.gray.border}`,
          paddingVertical: 1.5,
          marginBottom: 2,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        },
        label: {
          fontSize: 6,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.gray.text,
          flex: 1
        },
        value: {
          fontSize: 6.5,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.navy,
          flex: 2,
          textAlign: 'right'
        },
        watermark: {
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 35,
          height: 35,
          opacity: 0.1
        },
        signatureImage: {
          width: 45,
          height: 20,
          objectFit: 'contain',
          marginTop: 1,
          marginLeft: 'auto'
        },
        backCardContainer: {
          position: 'absolute',
          top: TOP_MARGIN,
          left: LEFT_MARGIN,
          width: ID_CARD_WIDTH,
          height: ID_CARD_HEIGHT,
          backgroundColor: '#0284C7',
          padding: 0,
          fontFamily: 'Helvetica',
          overflow: 'hidden'
        },
        logoCircle: {
          position: 'absolute',
          left: 15,
          top: 15,
          width: 70,
          height: 70,
          backgroundColor: '#FFF1F2',
          borderRadius: 35,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        },
        backLogo: {
          width: 60,
          height: 60,
          objectFit: 'contain'
        },
        decorativeLines: {
          position: 'absolute',
          top: 0,
          right: 0,
          width: 80,
          height: 80,
          opacity: 0.2
        },
        backDecorativeDots: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 80,
          height: 80,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4
        },
        decorativeDot: {
          width: 2,
          height: 2,
          backgroundColor: COLORS.white,
          borderRadius: 1,
          opacity: 0.3
        },
        qrCodeContainer: {
          position: 'absolute',
          top: 15,
          right: 15,
          backgroundColor: COLORS.white,
          padding: 5,
          width: 70,
          height: 70,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        },
        qrCode: {
          width: 60,
          height: 60
        },
        propertyNoticeContainer: {
          position: 'absolute',
          top: 90,
          left: 15,
          right: 15
        },
        propertyNotice: {
          color: COLORS.white,
          fontSize: 7,
          marginBottom: 2,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold'
        },
        emailText: {
          color: COLORS.white,
          fontSize: 7,
          textAlign: 'center',
          opacity: 0.9,
          marginTop: 4
        },
        houseIndicator: {
          marginTop: 2,
          padding: 3,
          borderRadius: 3,
          alignSelf: 'center',
          width: '90%',
          borderWidth: 0.5,
          borderColor: COLORS.white,
          position: 'relative'
        },
        houseValue: {
          fontSize: 7,
          color: COLORS.white,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold',
          textTransform: 'uppercase',
          letterSpacing: 0.5
        },
      });

      // Get pupil's emergency contact
      const getEmergencyContact = () => {
        return emergencyContactGuardian?.phone || '';
      };

      // Calculate expiry date (3 years from now)
      const getExpiryDate = () => {
        const today = new Date();
        const expiryDate = new Date(today.setFullYear(today.getFullYear() + 3));
        return expiryDate.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      };

      // Format date of birth
      const formatDateOfBirth = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      };

      // Get school information from settings or use defaults
      const schoolInfo = {
        name: schoolSettings?.generalInfo?.name || "Trinity Family Nursery and Primary School",
        logo: schoolSettings?.generalInfo?.logo,
        signature: schoolSettings?.headTeacher?.signature,
        headTeacherName: schoolSettings?.headTeacher?.name || "Head Teacher",
        email: schoolSettings?.contact?.email || "trinityfmk@gmail.com",
        phone: schoolSettings?.contact?.phone || "0776300109 / 0774081378 / 0702957826",
        address: schoolSettings?.address?.physical || "School Address",
        website: schoolSettings?.contact?.website
      };

      // Create the PDF Document
      const PupilIDCardPDFDocument = () => (
        <Document>
          {/* Front face on first A4 page */}
          <Page size="A4" style={styles.page}>
            <View style={styles.cardContainer}>
              <View style={styles.mainContainer}>
                {/* Left Section */}
                <View style={styles.leftSection}>
                  <View style={styles.hexagonContainer}>
                    <View style={styles.photoContainer}>
                      <View style={styles.photoBorder} />
                      {pupil.photo ? (
                        <Image src={pupil.photo} style={styles.photo} />
                      ) : (
                        <Text style={{ fontSize: 6, textAlign: 'center', color: '#9ca3af' }}>
                          No Photo{'\n'}Available
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Date of Birth */}
                  <View style={styles.dobContainer}>
                    <Text style={styles.dobLabel}>DATE OF BIRTH</Text>
                    <Text style={styles.dobValue}>{formatDateOfBirth(pupil.dateOfBirth)}</Text>
                  </View>

                  {/* Pay Code */}
                  <View style={styles.payCodeContainer}>
                    <Text style={styles.payCodeLabel}>PAY CODE</Text>
                    <Text style={styles.payCodeValue}>{getSchoolPayCode(pupil) || 'N/A'}</Text>
                  </View>

                  <View style={styles.decorativeDots}>
                    {Array(15).fill(null).map((_, i) => (
                      <View key={i} style={styles.dot} />
                    ))}
                  </View>
                </View>

                {/* Right Section */}
                <View style={styles.rightSection}>
                  <Text style={styles.schoolName}>{schoolInfo.name}</Text>
                  <Text style={styles.schoolNameSecondLine}></Text>
                  <Text style={styles.phoneNumbers}>TEL: {schoolInfo.phone}</Text>

                  <Text style={styles.idTitle}>PUPIL'S ID</Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>PUPIL'S NAME:</Text>
                    <Text style={styles.value}>
                      {pupil.firstName} {pupil.lastName}
                      {pupil.otherNames && ` ${pupil.otherNames}`}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>CLASS:</Text>
                    <Text style={styles.value}>{pupilWithClass?.className || getClassName(pupil.classId, classes)}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>L.I. NUMBER:</Text>
                    <Text style={styles.value}>
                      {academicIdentifiers.find(id => id.idType === 'LIN')?.idValue || pupil.learnerIdentificationNumber || ''}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>PIN:</Text>
                    <Text style={styles.value}>{pupil.admissionNumber}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>EXPIRY DATE:</Text>
                    <Text style={styles.value}>
                      {getExpiryDate()}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>HEADTEACHER'S SIGNATURE:</Text>
                    {schoolInfo.signature ? (
                      <Image src={schoolInfo.signature} style={styles.signatureImage} />
                    ) : (
                      <Text style={styles.value}>Signature</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </Page>

          {/* Back face on second A4 page */}
          <Page size="A4" style={styles.page}>
            <View style={styles.backCardContainer}>
              {/* Logo Circle */}
              <View style={styles.logoCircle}>
                {schoolInfo.logo ? (
                  <Image src={schoolInfo.logo} style={styles.backLogo} />
                ) : (
                  <Text style={{ fontSize: 8, color: COLORS.navy, fontWeight: 'bold' }}>SCHOOL{'\n'}LOGO</Text>
                )}
              </View>

              {/* Decorative Elements */}
              <View style={styles.decorativeLines}>
                {Array(15).fill(null).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      top: i * 5,
                      right: 0,
                      width: 80,
                      height: 1,
                      backgroundColor: COLORS.white,
                      transform: 'rotate(-45deg)',
                      opacity: 0.2
                    }}
                  />
                ))}
              </View>

              <View style={styles.backDecorativeDots}>
                {Array(20).fill(null).map((_, i) => (
                  <View key={i} style={styles.decorativeDot} />
                ))}
              </View>

              {/* QR Code */}
              <View style={styles.qrCodeContainer}>
                <Image src={qrCodeDataURL} style={styles.qrCode} />
              </View>

              {/* Property Notice */}
              <View style={styles.propertyNoticeContainer}>
                <Text style={styles.propertyNotice}>
                  THIS IS A PROPERTY OF {schoolInfo.name.toUpperCase()}
                </Text>
                <Text style={styles.propertyNotice}>
                  IF FOUND, PLEASE RETURN TO THE ABOVE ADDRESS OR CONTACT US
                </Text>
                <Text style={styles.emailText}>Email: {schoolInfo.email}</Text>
                <Text style={styles.emailText}>Tel: {schoolInfo.phone}</Text>
                {schoolInfo.website && (
                  <Text style={styles.emailText}>Web: {schoolInfo.website}</Text>
                )}
              </View>
            </View>
          </Page>
        </Document>
      );

      const safeName = formatPupilDisplayName(pupil).replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_');
      const fileName = `${safeName}_ID_Card.pdf`;
      const title = 'Pupil ID Card';
      await pdfViewer.runPDFJob(
        { fileName, title, initialMessage: 'Rendering the pupil ID card…' },
        async ({ updateProgress }) => {
          updateProgress(20, 'Preparing ID card layout…');
          const blob = await ReactPDF.pdf(<PupilIDCardPDFDocument />).toBlob();
          updateProgress(96, 'Finalizing ID card…');
          return blob;
        },
      );

      toast({
        title: "ID Card Generated Successfully",
        description: `${pupil.firstName}'s ID card is ready for viewing.`,
      });

    } catch (error) {
      console.error('Error generating ID card:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate ID card. Please try again.",
      });
    }
  };

  // Pupil Details PDF generation function
  const handleGenerateDetailsPDF = async () => {
    if (!pupil) return;

    try {
      toast({
        title: "Generating Details PDF",
        description: "Preparing pupil information document...",
      });

      // Dynamic imports to avoid SSR issues
      const [
        { default: ReactPDF },
        { Document, Page, Text, View, StyleSheet, Image, Font }
      ] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@react-pdf/renderer')
      ]);

      // Register fonts
      Font.register({
        family: 'Helvetica',
        fonts: [
          { src: '/fonts/Helvetica.ttf' },
          { src: '/fonts/Helvetica-Bold.ttf', fontWeight: 'bold' }
        ]
      });

      const schoolInfo = {
        name: schoolSettings?.generalInfo?.name || 'Trinity School',
        phone: schoolSettings?.contact?.phone || '',
        email: schoolSettings?.contact?.email || '',
        address: schoolSettings?.address || {},
        logo: schoolSettings?.generalInfo?.logo || '',
        signature: schoolSettings?.headTeacher?.signature || '',
        website: schoolSettings?.contact?.website || ''
      };

      // Color scheme
      const COLORS = {
        primary: '#002B5B',
        secondary: '#FFB800',
        accent: '#8B0000',
        white: '#FFFFFF',
        gray: {
          light: '#F3F4F6',
          medium: '#9CA3AF',
          dark: '#374151'
        },
        border: '#E5E7EB'
      };

      const styles = StyleSheet.create({
        page: {
          padding: 25,
          fontFamily: 'Helvetica',
          backgroundColor: COLORS.white
        },
        header: {
          marginBottom: 15,
          borderBottom: `2px solid ${COLORS.primary}`,
          paddingBottom: 8
        },
        schoolName: {
          fontSize: 16,
          fontWeight: 'bold',
          color: COLORS.primary,
          marginBottom: 3,
          textAlign: 'center'
        },
        documentTitle: {
          fontSize: 13,
          fontWeight: 'bold',
          color: COLORS.primary,
          textAlign: 'center',
          marginTop: 5,
          marginBottom: 3
        },
        documentSubtitle: {
          fontSize: 9,
          color: COLORS.gray.dark,
          textAlign: 'center',
          marginBottom: 10
        },
        section: {
          marginBottom: 12,
          backgroundColor: COLORS.gray.light,
          padding: 8,
          borderRadius: 5,
          border: `1px solid ${COLORS.border}`
        },
        sectionTitle: {
          fontSize: 11,
          fontWeight: 'bold',
          color: COLORS.primary,
          marginBottom: 6,
          borderBottom: `1px solid ${COLORS.secondary}`,
          paddingBottom: 3
        },
        row: {
          flexDirection: 'row',
          marginBottom: 4,
          paddingBottom: 3,
          borderBottom: `0.5px solid ${COLORS.border}`
        },
        label: {
          fontSize: 8,
          fontWeight: 'bold',
          color: COLORS.gray.dark,
          width: '35%',
          fontFamily: 'Helvetica-Bold'
        },
        value: {
          fontSize: 8,
          color: COLORS.primary,
          width: '65%',
          flexWrap: 'wrap'
        },
        photoContainer: {
          alignItems: 'center',
          marginBottom: 10,
          padding: 6,
          backgroundColor: COLORS.white,
          borderRadius: 5,
          border: `1px solid ${COLORS.secondary}`
        },
        photo: {
          width: 80,
          height: 100,
          borderRadius: 5,
          objectFit: 'cover',
          border: `2px solid ${COLORS.primary}`
        },
        guardianSection: {
          marginTop: 6,
          padding: 6,
          backgroundColor: COLORS.white,
          borderRadius: 4,
          border: `1px solid ${COLORS.border}`
        },
        guardianTitle: {
          fontSize: 9,
          fontWeight: 'bold',
          color: COLORS.accent,
          marginBottom: 4
        },
        footer: {
          position: 'absolute',
          bottom: 20,
          left: 25,
          right: 25,
          textAlign: 'center',
          fontSize: 7,
          color: COLORS.gray.medium,
          borderTop: `1px solid ${COLORS.border}`,
          paddingTop: 6
        },
        signatureSection: {
          marginTop: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTop: `1px solid ${COLORS.border}`
        },
        signatureBox: {
          width: '45%',
          textAlign: 'center'
        },
        signatureLabel: {
          fontSize: 8,
          fontWeight: 'bold',
          color: COLORS.primary,
          marginBottom: 3
        },
        signatureImage: {
          width: 80,
          height: 30,
          objectFit: 'contain',
          marginBottom: 3
        },
        divider: {
          height: 0.5,
          backgroundColor: COLORS.border,
          marginVertical: 5
        }
      });

      const formatDate = (dateString: string | undefined | null): string => {
        if (!dateString) return 'N/A';
        try {
          const date = new Date(dateString);
          if (isNaN(date.getTime())) return 'N/A';
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        } catch {
          return dateString;
        }
      };

      // Helper function to format address (handles both string and object formats)
      const formatAddress = (address: string | { physical?: string; city?: string; country?: string; postal?: string } | undefined | null): string => {
        if (!address) return 'N/A';
        if (typeof address === 'string') return address;
        if (typeof address === 'object') {
          const parts: string[] = [];
          if (address.physical) parts.push(address.physical);
          if (address.city) parts.push(address.city);
          if (address.country) parts.push(address.country);
          if (address.postal) parts.push(`P.O. Box ${address.postal}`);
          return parts.length > 0 ? parts.join(', ') : 'N/A';
        }
        return 'N/A';
      };

      const PupilDetailsPDFDocument = () => (
        <Document>
          <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.schoolName}>{schoolInfo.name}</Text>
              <Text style={styles.documentTitle}>PUPIL INFORMATION DETAILS</Text>
              <Text style={styles.documentSubtitle}>
                Generated on {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </View>

            {/* Photo Section */}
            {pupil.photo && (
              <View style={styles.photoContainer}>
                <Image src={pupil.photo} style={styles.photo} />
                <Text style={{ fontSize: 8, color: COLORS.primary, marginTop: 3, fontWeight: 'bold' }}>
                  {formatPupilDisplayName(pupil)}
                </Text>
              </View>
            )}

            {/* Personal Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>

              <View style={styles.row}>
                <Text style={styles.label}>Full Name:</Text>
                <Text style={styles.value}>
                  {pupil.firstName} {pupil.lastName}
                  {pupil.otherNames && ` ${pupil.otherNames}`}
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Pay Code:</Text>
                  <Text style={styles.value}>{getSchoolPayCode(pupil) || 'Not Generated'}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Admission Number:</Text>
                <Text style={styles.value}>{pupil.admissionNumber}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Gender:</Text>
                <Text style={styles.value}>{pupil.gender || 'N/A'}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Date of Birth:</Text>
                <Text style={styles.value}>
                  {formatDate(pupil.dateOfBirth)}
                  {pupil.dateOfBirth && ` (Age: ${calculateAge(pupil.dateOfBirth)})`}
                </Text>
              </View>

              {pupil.placeOfBirth && (
                <View style={styles.row}>
                  <Text style={styles.label}>Place of Birth:</Text>
                  <Text style={styles.value}>{pupil.placeOfBirth}</Text>
                </View>
              )}

              {pupil.nationality && (
                <View style={styles.row}>
                  <Text style={styles.label}>Nationality:</Text>
                  <Text style={styles.value}>{pupil.nationality}</Text>
                </View>
              )}

              {pupil.religion && (
                <View style={styles.row}>
                  <Text style={styles.label}>Religion:</Text>
                  <Text style={styles.value}>{pupil.religion}</Text>
                </View>
              )}

              {pupil.address && (
                <View style={styles.row}>
                  <Text style={styles.label}>Address:</Text>
                  <Text style={styles.value}>{formatAddress(pupil.address)}</Text>
                </View>
              )}
            </View>

            {/* Academic Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ACADEMIC INFORMATION</Text>

              <View style={styles.row}>
                <Text style={styles.label}>Class:</Text>
                <Text style={styles.value}>{pupilWithClass?.className || getClassName(pupil.classId, classes)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Section:</Text>
                <Text style={styles.value}>{pupil.section || 'N/A'}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Status:</Text>
                <Text style={styles.value}>{pupil.status || 'N/A'}</Text>
              </View>

              {pupil.previousSchool && (
                <View style={styles.row}>
                  <Text style={styles.label}>Previous School:</Text>
                  <Text style={styles.value}>{pupil.previousSchool}</Text>
                </View>
              )}

              {pupil.registrationDate && (
                <View style={styles.row}>
                  <Text style={styles.label}>Registration Date:</Text>
                  <Text style={styles.value}>{formatDate(pupil.registrationDate)}</Text>
                </View>
              )}

              {academicIdentifiers.length > 0 && (
                <>
                  {academicIdentifiers.map((id, index) => (
                    <View key={index} style={styles.row}>
                      <Text style={styles.label}>{id.idType}:</Text>
                      <Text style={styles.value}>{id.idValue}</Text>
                    </View>
                  ))}
                </>
              )}

              {pupil.houseId && currentHouse && (
                <View style={styles.row}>
                  <Text style={styles.label}>House:</Text>
                  <Text style={styles.value}>{currentHouse.name}</Text>
                </View>
              )}
            </View>

            {/* Medical Information */}
            {(pupil.medicalConditions || pupil.allergies || pupil.medications || pupil.bloodType) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>MEDICAL INFORMATION</Text>

                {pupil.bloodType && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Blood Type:</Text>
                    <Text style={styles.value}>{pupil.bloodType}</Text>
                  </View>
                )}

                {pupil.medicalConditions && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Medical Conditions:</Text>
                    <Text style={styles.value}>{pupil.medicalConditions}</Text>
                  </View>
                )}

                {pupil.allergies && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Allergies:</Text>
                    <Text style={styles.value}>{pupil.allergies}</Text>
                  </View>
                )}

                {pupil.medications && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Medications:</Text>
                    <Text style={styles.value}>{pupil.medications}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Guardians Information */}
            {pupil.guardians && pupil.guardians.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>GUARDIAN INFORMATION</Text>

                {pupil.guardians.map((guardian, index) => (
                  <View key={index} style={styles.guardianSection}>
                    <Text style={styles.guardianTitle}>
                      Guardian {index + 1} {guardian.relationship ? `- ${guardian.relationship}` : ''}
                      {pupil.emergencyContactGuardianId === guardian.id && ' (Emergency Contact)'}
                    </Text>

                    <View style={styles.row}>
                      <Text style={styles.label}>Name:</Text>
                      <Text style={styles.value}>
                        {guardian.firstName} {guardian.lastName}
                      </Text>
                    </View>

                    {guardian.phone && (
                      <View style={styles.row}>
                        <Text style={styles.label}>Phone:</Text>
                        <Text style={styles.value}>{guardian.phone}</Text>
                      </View>
                    )}

                    {guardian.secondaryPhone && (
                      <View style={styles.row}>
                        <Text style={styles.label}>Secondary Phone:</Text>
                        <Text style={styles.value}>{guardian.secondaryPhone}</Text>
                      </View>
                    )}

                    {guardian.email && (
                      <View style={styles.row}>
                        <Text style={styles.label}>Email:</Text>
                        <Text style={styles.value}>{guardian.email}</Text>
                      </View>
                    )}

                    {guardian.occupation && (
                      <View style={styles.row}>
                        <Text style={styles.label}>Occupation:</Text>
                        <Text style={styles.value}>{guardian.occupation}</Text>
                      </View>
                    )}

                    {guardian.address && (
                      <View style={styles.row}>
                        <Text style={styles.label}>Address:</Text>
                        <Text style={styles.value}>{formatAddress(guardian.address)}</Text>
                      </View>
                    )}

                    {guardian.nationalId && (
                      <View style={styles.row}>
                        <Text style={styles.label}>National ID:</Text>
                        <Text style={styles.value}>{guardian.nationalId}</Text>
                      </View>
                    )}

                    {index < pupil.guardians.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            )}

            {/* Additional Identifiers */}
            {personalIdentifiers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>ADDITIONAL IDENTIFIERS</Text>
                {personalIdentifiers.map((id, index) => (
                  <View key={index} style={styles.row}>
                    <Text style={styles.label}>{id.idType}:</Text>
                    <Text style={styles.value}>{id.idValue}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Footer with Signatures */}
            <View style={styles.signatureSection}>
              <View style={styles.signatureBox}>
                <Text style={styles.signatureLabel}>Headteacher's Signature</Text>
                {schoolInfo.signature ? (
                  <Image src={schoolInfo.signature} style={styles.signatureImage} />
                ) : (
                  <View style={{ height: 40, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 5 }} />
                )}
                <Text style={{ fontSize: 8, color: COLORS.gray.medium }}>Date: _______________</Text>
              </View>
              <View style={styles.signatureBox}>
                <Text style={styles.signatureLabel}>Parent/Guardian's Signature</Text>
                <View style={{ height: 40, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 5 }} />
                <Text style={{ fontSize: 8, color: COLORS.gray.medium }}>Date: _______________</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text>
                {schoolInfo.name} • {formatAddress(schoolSettings?.address)} • Tel: {schoolInfo.phone || 'N/A'} • Email: {schoolInfo.email || 'N/A'}
              </Text>
              <Text style={{ marginTop: 5 }}>
                This document is computer-generated and is valid without signature.
              </Text>
            </View>
          </Page>
        </Document>
      );

      const safeName = formatPupilDisplayName(pupil).replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_');
      const fileName = `${safeName}_Details.pdf`;
      const title = 'Pupil Information Details';
      await pdfViewer.runPDFJob(
        { fileName, title, initialMessage: 'Rendering pupil information…' },
        async ({ updateProgress }) => {
          updateProgress(20, 'Preparing pupil details layout…');
          const blob = await ReactPDF.pdf(<PupilDetailsPDFDocument />).toBlob();
          updateProgress(96, 'Finalizing pupil details…');
          return blob;
        },
      );

      toast({
        title: "Details PDF Generated Successfully",
        description: `${pupil.firstName}'s information document is ready for viewing.`,
        duration: 1500,
      });

    } catch (error) {
      console.error('Error generating details PDF:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate details PDF. Please try again.",
      });
    }
  };

  const handleGeneratePaymentSlipPDF = async () => {
    if (!pupil) return;

    try {
      toast({
        title: "Generating Payment Slip",
        description: "Preparing the SchoolPay payment card...",
      });

      const [
        { default: ReactPDF },
        { Document, Page, Text, View, StyleSheet, Image, Link },
        QRCode,
      ] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@react-pdf/renderer'),
        import('qrcode'),
      ]);

      const paymentLink = 'https://www.schoolpay.co.ug/site/erp-select-channel';
      const payCode = getSchoolPayCode(pupil) || 'Not Generated';
      const schoolName = schoolSettings?.generalInfo?.name || "Trinity Family Nursery and Primary School";
      const schoolLogo = schoolSettings?.generalInfo?.logo;
      const className = pupilWithClass?.className || getClassName(pupil.classId, classes);
      const pupilName = formatPupilDisplayName(pupil);

      const qrCodeDataURL = await QRCode.toDataURL(paymentLink, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 220,
        color: {
          dark: '#111827',
          light: '#FFFFFF',
        },
      });

      const slipWidth = 4 * 72;
      const slipHeight = 6 * 72;

      const styles = StyleSheet.create({
        page: {
          width: slipWidth,
          height: slipHeight,
          paddingTop: 12,
          paddingBottom: 10,
          paddingHorizontal: 12,
          backgroundColor: '#ffffff',
          fontFamily: 'Helvetica',
          color: '#111827',
        },
        header: {
          alignItems: 'center',
          borderBottom: '1 solid #d1d5db',
          paddingBottom: 6,
          marginBottom: 6,
        },
        logo: {
          width: 32,
          height: 32,
          objectFit: 'contain',
          marginBottom: 4,
        },
        schoolName: {
          fontSize: 10.5,
          fontWeight: 'bold',
          textAlign: 'center',
          lineHeight: 1.2,
        },
        slipTitle: {
          fontSize: 7,
          textAlign: 'center',
          color: '#4b5563',
          marginTop: 2,
          letterSpacing: 0.4,
        },
        pupilBlock: {
          marginBottom: 6,
          padding: 6,
          border: '1 solid #d1d5db',
          backgroundColor: '#f9fafb',
        },
        pupilName: {
          fontSize: 9.5,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: 2,
        },
        classText: {
          fontSize: 7.5,
          textAlign: 'center',
          color: '#374151',
        },
        payCodeLabel: {
          fontSize: 7,
          textAlign: 'center',
          marginBottom: 3,
          color: '#4b5563',
          letterSpacing: 0.4,
        },
        payCodeValue: {
          fontSize: 15,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: 6,
          paddingVertical: 5,
          paddingHorizontal: 4,
          border: '1 solid #111827',
        },
        sectionTitle: {
          fontSize: 7.5,
          fontWeight: 'bold',
          marginBottom: 3,
          color: '#111827',
        },
        instruction: {
          fontSize: 6.3,
          lineHeight: 1.2,
          marginBottom: 2,
          color: '#1f2937',
        },
        qrSection: {
          marginTop: 5,
          paddingTop: 5,
          borderTop: '1 solid #e5e7eb',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        qrCode: {
          width: 74,
          height: 74,
        },
        qrMeta: {
          flex: 1,
        },
        qrText: {
          fontSize: 6.8,
          marginBottom: 4,
          color: '#374151',
          lineHeight: 1.2,
        },
        qrHint: {
          fontSize: 6.2,
          color: '#4b5563',
          marginBottom: 4,
          lineHeight: 1.2,
        },
        linkText: {
          fontSize: 5.6,
          color: '#2563eb',
          lineHeight: 1.15,
        },
      });

      const PaymentSlipDocument = () => (
        <Document>
          <Page size={[slipWidth, slipHeight]} style={styles.page}>
            <View style={styles.header}>
              {schoolLogo ? <Image src={schoolLogo} style={styles.logo} /> : null}
              <Text style={styles.schoolName}>{schoolName}</Text>
              <Text style={styles.slipTitle}>SCHOOLPAY PAYMENT SLIP</Text>
            </View>

            <View style={styles.pupilBlock}>
              <Text style={styles.pupilName}>{pupilName}</Text>
              <Text style={styles.classText}>Class: {className}</Text>
            </View>

            <Text style={styles.payCodeLabel}>PAY CODE</Text>
            <Text style={styles.payCodeValue}>{payCode}</Text>

            <Text style={styles.sectionTitle}>How to Pay Fees via SchoolPay</Text>
            <Text style={styles.instruction}>MTN: Dial *165*80# or *165*4*3*2#.</Text>
            <Text style={styles.instruction}>Airtel: Dial *185*6*2# or *185#.</Text>
            <Text style={styles.instruction}>Payment Details: Enter the unique student payment code {payCode}.</Text>
            <Text style={styles.instruction}>Confirmation: Follow the prompts to confirm student name, class, balance, and pay.</Text>

            <View style={styles.qrSection} wrap={false}>
              <Image src={qrCodeDataURL} style={styles.qrCode} />
              <View style={styles.qrMeta}>
                <Text style={styles.qrText}>Or scan this QR code</Text>
                <Text style={styles.qrHint}>Open the SchoolPay payment channel directly from your phone.</Text>
                <Link src={paymentLink} style={styles.linkText}>{paymentLink}</Link>
              </View>
            </View>
          </Page>
        </Document>
      );

      const safeName = pupilName.replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_');
      const fileName = `${safeName}_Payment_Slip.pdf`;
      await pdfViewer.runPDFJob(
        { fileName, title: 'Payment Slip', initialMessage: 'Rendering SchoolPay payment slip…' },
        async ({ updateProgress }) => {
          updateProgress(25, 'Preparing payment details and QR code…');
          const blob = await ReactPDF.pdf(<PaymentSlipDocument />).toBlob();
          updateProgress(96, 'Finalizing payment slip…');
          return blob;
        },
      );
    } catch (error) {
      console.error('Error generating payment slip PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate payment slip.',
      });
    }
  };

  const handleStatusChange = () => {
    setSelectedStatus('');
    setSelectedClassId('');
    setShowClassSelection(false);
    setIsStatusChangeModalOpen(true);
  };

  const handleStatusSelection = (status: string) => {
    setSelectedStatus(status);
    // If changing to Active from another status, show class selection
    if (status === 'Active' && pupil?.status !== 'Active') {
      setShowClassSelection(true);
      setSelectedClassId(pupil?.classId || '');
    } else {
      setShowClassSelection(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!pupil || !selectedStatus) return;

    try {
      const updateData: any = { status: selectedStatus };

      // Create status change history entry
      const statusHistoryEntry = {
        date: new Date().toISOString(),
        fromStatus: pupil.status,
        toStatus: selectedStatus,
        reason: selectedStatus === 'Active' && showClassSelection && selectedClassId !== pupil.classId
          ? `Status changed to Active with class change to ${getClassName(selectedClassId, classes)}`
          : `Status changed from ${pupil.status} to ${selectedStatus}`,
        processedBy: "System Admin", // TODO: Replace with actual user
        notes: selectedStatus === 'Active' && showClassSelection && selectedClassId !== pupil.classId ? `Class changed during status update to Active` : undefined,
      };

      // Add status history to update data
      updateData.statusChangeHistory = [...(pupil.statusChangeHistory || []), statusHistoryEntry];

      // If changing to Active and class selection was shown, update class too
      if (selectedStatus === 'Active' && showClassSelection && selectedClassId && selectedClassId !== pupil.classId) {
        updateData.classId = selectedClassId;
        updateData.className = getClassName(selectedClassId, classes);

        // Also add promotion history entry if class changed
        const promotionHistoryEntry = {
          date: new Date().toISOString(),
          fromClassId: pupil.classId,
          fromClassName: pupil.className || getClassName(pupil.classId, classes),
          toClassId: selectedClassId,
          toClassName: getClassName(selectedClassId, classes),
          type: 'Transfer' as const,
          notes: `Class changed during status update to Active`,
          processedBy: "System Admin", // TODO: Replace with actual user
        };

        updateData.promotionHistory = [...(pupil.promotionHistory || []), promotionHistoryEntry];
      }

      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: updateData,
      });

      toast({
        title: "Status Updated",
        description: `${pupil.firstName}'s status has been changed to ${selectedStatus}${updateData.classId && updateData.classId !== pupil.classId ? ` and moved to ${getClassName(selectedClassId, classes)}` : ''
          }.`,
      });

      setIsStatusChangeModalOpen(false);
    } catch (err) {
      console.error("Failed to update status:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update status. Please try again.",
      });
    }
  };


  // Function to get academic year and term names
  const getAcademicYearAndTerm = React.useCallback((academicYearId: string, termId: string) => {
    const academicYear = academicYears?.find(year => year.id === academicYearId);
    const term = academicYear?.terms?.find(term => term.id === termId);
    return {
      academicYearName: academicYear?.name || 'Unknown Year',
      termName: term?.name || 'Unknown Term'
    };
  }, [academicYears]);

  // Update progress function
  const updateProgress = React.useCallback((progress: number, status: string) => {
    setGenerationProgress(progress);
    setGenerationStatus(status);
    if (startTime) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = progress / elapsed;
      const remaining = (100 - progress) / rate;
      setEta(remaining > 60 ? `${Math.round(remaining / 60)}m ${Math.round(remaining % 60)}s` : `${Math.round(remaining)}s`);
    }
  }, [startTime]);

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
      <Dialog open={isOpen} onOpenChange={(open) => {
        // Prevent closing the modal while generating
        if (!open && isGenerating) {
          return;
        }
        onClose();
      }}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => {
          // Prevent closing by clicking outside while generating
          if (isGenerating) {
            e.preventDefault();
          }
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Printer className="h-5 w-5 text-blue-600" />
              Print Reports
            </DialogTitle>
            <DialogDescription>
              {isGenerating ? 'Generating report PDF...' : 'Select the type of report to generate'}
            </DialogDescription>
          </DialogHeader>

          {isGenerating ? (
            <div className="py-4">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4 animate-spin"></div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Generating Report</h3>
                <p className="text-sm text-blue-600 font-medium mb-4">{generationStatus}</p>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden border">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mb-4 text-sm">
                  <span className="font-semibold text-gray-800">{generationProgress}% Complete</span>
                  <span className="text-blue-600 font-medium">{eta}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">💡 Report will download automatically when ready</p>
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
                    <FileText className="h-5 w-5 text-orange-600" />
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

  // Handle print button click - navigate to pupil results page
  const handlePrintClick = React.useCallback((examId: string, examResultId: string) => {
    setSelectedExamId(examId);
    setSelectedExamResultId(examResultId);
    setShowPrintModal(true);
  }, []);

  // Register print handler to open print modal if there are exam results
  React.useEffect(() => {
    if (pupilExamHistory && pupilExamHistory.length > 0) {
      const unregister = registerPrintHandler(() => {
        // If there's a selected exam, open print modal for it
        if (selectedExamId && selectedExamResultId) {
          setShowPrintModal(true);
        } else if (pupilExamHistory.length > 0) {
          // Otherwise, open print modal for the first exam
          const firstExam = pupilExamHistory[0];
          if (firstExam.examId && firstExam.examResultId) {
            setSelectedExamId(firstExam.examId);
            setSelectedExamResultId(firstExam.examResultId);
            setShowPrintModal(true);
          }
        }
      }, 50);
      return unregister;
    }
  }, [pupilExamHistory, selectedExamId, selectedExamResultId, registerPrintHandler]);

  // Create processed result for pupil
  const createProcessedResultForPupil = React.useCallback(async () => {
    if (!pupil || !examResultData || !selectedExamId) return null;

    const pupilResults = examResultData.results?.[pupilId || ''] || {};
    const subjectSnaps = examResultData.subjectSnapshots || [];

    // Get major subjects
    const savedMajorSubjects = examResultData.majorSubjects || [];
    const majorSubjects = savedMajorSubjects.length > 0
      ? savedMajorSubjects
      : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code || s.subjectCode) : subjectSnaps.map(s => s.code || s.subjectCode));

    let totalMarks = 0;
    let totalAggregates = 0;
    const processedSubjectResults: Record<string, { marks: number; grade: string; aggregates: number }> = {};

    // Initialize all subjects first
    subjectSnaps.forEach(subject => {
      const subjectCode = subject.code || subject.subjectCode || '';
      const isMajorSubject = majorSubjects.includes(subjectCode);
      processedSubjectResults[subjectCode] = {
        marks: 0,
        grade: 'F9',
        aggregates: isMajorSubject ? 9 : 0
      };
    });

    // Populate with actual results
    subjectSnaps.forEach(subject => {
      const subjectCode = subject.code || subject.subjectCode || '';
      const subjectId = subject.subjectId || subject.id;
      const result = pupilResults[subjectId];
      const isMajorSubject = majorSubjects.includes(subjectCode);

      if (result) {
        processedSubjectResults[subjectCode] = {
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

    const calculateDivision = (totalAggs: number) => {
      if (totalAggs <= 8) return "DIV I";
      if (totalAggs <= 16) return "DIV II";
      if (totalAggs <= 24) return "DIV III";
      if (totalAggs <= 32) return "DIV IV";
      return "DIV U";
    };

    const division = typeof pupilResults.division === 'string' && pupilResults.division
      ? pupilResults.division
      : calculateDivision(totalAggregates);

    // Get pupil photo
    let pupilPhoto: string | null = pupil.photo || null;
    if (pupilPhoto && !pupilPhoto.startsWith('http') && !pupilPhoto.startsWith('data:')) {
      pupilPhoto = null;
    }

    // Get pupil snapshot data
    const pupilSnapshot = examResultData.pupilSnapshots?.find((p: any) => p.pupilId === pupilId);
    const ageAtExam = pupilSnapshot?.ageAtExam || (pupil.dateOfBirth ? Math.floor((new Date(examResultData.examDetails?.startDate || new Date()).getTime() - new Date(pupil.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : 12);

    return {
      pupilInfo: {
        pupilId: pupil.id,
        name: formatPupilDisplayName(pupil),
        admissionNumber: pupil.admissionNumber || '',
        age: ageAtExam,
        photo: pupilPhoto,
        schoolPayCode:
          (pupil as any).payCode ||
          (pupil as any).additionalIdentifiers?.find((id: any) =>
            `${id?.idType || ''}`.toLowerCase().includes('pay code')
          )?.idValue ||
          '',
        dateOfBirth: pupil.dateOfBirth
      },
      results: processedSubjectResults,
      totalMarks,
      totalAggregates,
      division
    };
  }, [pupil, examResultData, selectedExamId, pupilId]);

  // Handle Report generation
  const handleReportOne = React.useCallback(async () => {
    if (!selectedExamId || !pupil || !examResultData) {
      toast({ title: "Error", description: "Missing required data for report generation" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');
    // Keep PrintModal open to show loading state, only close other modals
    setShowReportConfigModal(false);
    setShowComparisonExamModal(false);
    setShowTransTypeModal(false);

    try {
      updateProgress(10, 'Preparing report data...');

      // 🚀 OPTIMIZED: Get exam details from pupilExamHistory (already cached) or use ExamsService
      let examDetails: any = null;
      if (pupilExamHistory?.exams) {
        examDetails = pupilExamHistory.exams.find((exam: any) => exam.id === selectedExamId);
      }

      if (!examDetails) {
        // Use ExamsService for efficient query (uses class-based optimization)
        try {
          const { ExamsService } = await import('@/lib/services/exams.service');
          examDetails = await ExamsService.getExamById(selectedExamId);
        } catch (error) {
          console.error('Failed to fetch exam details:', error);
        }
      }

      if (!examDetails) {
        throw new Error('Failed to get exam details');
      }

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

      updateProgress(30, 'Fetching data in parallel...');

      // 🚀 OPTIMIZED: Fetch all data in parallel using efficient services
      const [classData, gradingScaleData, majorSubjectsData, teacherData] = await Promise.all([
        // Fetch class data using ClassesService (more efficient)
        examResultData.classId ? (async () => {
          try {
            const { ClassesService } = await import('@/lib/services/classes.service');
            return await ClassesService.getById(examResultData.classId);
          } catch (error) {
            console.warn('Failed to fetch class:', error);
          }
          return null;
        })() : Promise.resolve(null),

        // Get grading scale
        Promise.resolve(examResultData.gradingScale && Array.isArray(examResultData.gradingScale) && examResultData.gradingScale.length > 0
          ? examResultData.gradingScale.map((item: any) => ({
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
          }))),

        // Get major subjects
        Promise.resolve(examResultData.majorSubjects || []),

        // Fetch teachers
        (() => {
          const subjectSnaps = examResultData.subjectSnapshots || [];
          const uniqueTeacherIds = [...new Set(subjectSnaps.map((s: any) => s.teacherId).filter(Boolean))];
          return createStaffNameMap(allStaff, uniqueTeacherIds);
        })()
      ]);

      updateProgress(60, 'Preparing subject data...');

      const subjectSnaps = (examResultData.subjectSnapshots || []).map((subject: any) => {
        const teacherName = subject.teacherId
          ? (teacherData.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher')
          : 'Not Assigned';

        return {
          ...subject,
          code: subject.code || subject.subjectCode || '',
          name: subject.name || subject.subjectName || '',
          teacherName,
          fullMarks: 100
        };
      });

      const classSnap = classData ? {
        id: classData.id,
        name: classData.name,
        code: classData.code || classData.name
      } : {
        id: examResultData.classId || '',
        name: 'Unknown Class',
        code: 'UNK'
      };

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
        subjectSnaps: subjectSnaps,
        processedResults: processedResults,
        schoolSettings: schoolSettings || {},
        majorSubjects: majorSubjectsData,
        gradingScale: gradingScaleData,
        nextTermInfo: nextTermDates ? {
          startDate: nextTermDates.nextTermBegins,
          endDate: nextTermDates.nextTermEnds
        } : undefined,
        classTeacherInfo: {
          name: 'Class Teacher'
        }
      };

      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${formatPupilDisplayName(pupil).replace(/\s+/g, '_')}_Report.pdf`;
      const title = 'Individual Pupil Report';
      await pdfViewer.runPDFJob(
        { fileName, title, initialMessage: 'Generating the individual pupil report…' },
        async ({ signal, updateProgress: updateWorkspaceProgress }) => {
          updateWorkspaceProgress(70, 'Rendering the pupil report…');
          const blob = await generateModernBatchReportPDF(modernBatchData);
          if (signal.aborted) throw new DOMException('PDF generation was cancelled', 'AbortError');
          return blob;
        },
      );

      updateProgress(95, 'Finalizing document...');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({
        title: "Success",
        description: "Report generated successfully!",
        duration: 1500,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        duration: 2000,
      });
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStatus('');
        setGenerationProgress(0);
        setStartTime(null);
        setEta('');
        // Close the print modal after generation completes
        setShowPrintModal(false);
      }, 1000);
    }
  }, [allStaff, selectedExamId, pupil, examResultData, pupilId, pupilExamHistory, academicYears, schoolSettings, toast, getAcademicYearAndTerm, createProcessedResultForPupil, pdfViewer, updateProgress]);

  const handleMiniReport = React.useCallback(async () => {
    if (!selectedExamId || !pupil || !examResultData) {
      toast({ title: 'Error', description: 'Missing required data for Mini Report generation' });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');

    try {
      updateProgress(10, 'Preparing Mini Report data...');
      let examDetails: any = pupilExamHistory?.exams?.find((exam: any) => exam.id === selectedExamId);
      if (!examDetails) examDetails = await ExamsService.getExamById(selectedExamId);
      if (!examDetails) throw new Error('Failed to get exam details');

      const singlePupilResult = await createProcessedResultForPupil();
      if (!singlePupilResult) throw new Error('Failed to process pupil data');

      const [classData, teachersMap] = await Promise.all([
        examResultData.classId ? (async () => {
          const { ClassesService } = await import('@/lib/services/classes.service');
          return ClassesService.getById(examResultData.classId);
        })() : Promise.resolve(null),
        Promise.resolve(createStaffNameMap(
          allStaff,
          [...new Set((examResultData.subjectSnapshots || []).map((subject: any) => subject.teacherId).filter(Boolean))],
        )),
      ]);
      const subjectSnaps = (examResultData.subjectSnapshots || []).map((subject: any) => ({
        ...subject,
        code: subject.code || subject.subjectCode || '',
        name: subject.name || subject.subjectName || '',
        teacherName: subject.teacherId
          ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher')
          : 'Not Assigned',
        fullMarks: 100,
      }));
      const { academicYearName, termName } = getAcademicYearAndTerm(
        examDetails.academicYearId || '',
        examDetails.termId || '',
      );

      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${formatPupilDisplayName(pupil).replace(/\s+/g, '_')}_Mini_Report.pdf`;
      updateProgress(65, 'Generating one half-page Mini Report...');
      await pdfViewer.runPDFJob(
        { fileName, title: 'Individual Pupil Mini Report', initialMessage: 'Generating the pupil Mini Report…' },
        async ({ signal, updateProgress: updateWorkspaceProgress }) => {
          const blob = await generatePrimaryMiniReportPDF({
            examDetails: {
              name: examDetails.name,
              examTypeName: examDetails.examTypeName || 'Exam',
              startDate: examDetails.startDate,
              academicYearName,
              termName,
            },
            classSnap: classData
              ? { name: classData.name, code: classData.code || classData.name }
              : { name: 'Unknown Class', code: 'UNK' },
            subjectSnaps,
            processedResults: [singlePupilResult],
            schoolSettings: schoolSettings || {},
            majorSubjects: examResultData.majorSubjects || [],
            backgroundImage: '/images/Primary%20Mini%20BG.png',
            onProgress: (completed, total) => {
              const progress = 65 + Math.round((completed / Math.max(total, 1)) * 30);
              const message = `Generating Mini Report (${completed}/${total})...`;
              updateProgress(progress, message);
              updateWorkspaceProgress(progress, message);
            },
          });
          if (signal.aborted) throw new DOMException('PDF generation was cancelled', 'AbortError');
          return blob;
        },
      );
      updateProgress(100, 'Complete!');
      toast({ title: 'Success', description: 'Mini Report is ready for viewing.', duration: 1500 });
    } catch (error) {
      console.error('Error generating Mini Report:', error);
      toast({ title: 'Error', description: 'Failed to generate Mini Report. Please try again.' });
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
  }, [allStaff, createProcessedResultForPupil, examResultData, getAcademicYearAndTerm, pdfViewer, pupil, pupilExamHistory, selectedExamId, schoolSettings, toast, updateProgress]);

  const openFullReport = React.useCallback((template: 'standard' | 'full2') => {
    if (!selectedExamId || !pupil || !examResultData) {
      toast({ title: "Error", description: "Missing required data for TRANS report generation" });
      return;
    }
    setSelectedFullReportTemplate(template);
    setShowPrintModal(false);
    setShowTransTypeModal(true);
  }, [selectedExamId, pupil, examResultData, toast]);

  const handleFullReport = React.useCallback(() => openFullReport('standard'), [openFullReport]);
  const handleFullReport2 = React.useCallback(() => openFullReport('full2'), [openFullReport]);

  // Handle TRANS report type selection
  const handleTransTypeSelection = React.useCallback((type: 'grading' | 'progress') => {
    setTransReportType(type);
    setShowTransTypeModal(false);

    // Show configuration modal first
    setShowReportConfigModal(true);
  }, []);

  // Load available comparison exams (same term, class, academic year)
  const loadComparisonExams = React.useCallback(async () => {
    if (!selectedExamId || !examResultData) {
      console.warn('loadComparisonExams: Missing exam data');
      return;
    }

    const effectiveClassId = examResultData.classId;
    if (!effectiveClassId) {
      console.warn('loadComparisonExams: No classId available');
      toast({ title: "Error", description: "Unable to determine class for comparison exams" });
      return;
    }

    setIsLoadingComparisonExams(true);
    try {
      // Get exam details first
      let examDetails: any = null;
      if (pupilExamHistory?.exams) {
        examDetails = pupilExamHistory.exams.find((exam: any) => exam.id === selectedExamId);
      }

      if (!examDetails) {
        try {
          const { ExamsService } = await import('@/lib/services/exams.service');
          examDetails = await ExamsService.getExamById(selectedExamId);
        } catch (error) {
          console.error('Failed to fetch exam details:', error);
        }
      }

      if (!examDetails) {
        throw new Error('Failed to get exam details');
      }

      // Fetch exams for the class
      const { ExamsService } = await import('@/lib/services/exams.service');
      const allExams = await ExamsService.getExamsByClass(effectiveClassId);

      // Filter exams: same class, same academic year, same term, but different exam
      const filteredExams = allExams.filter(exam => {
        const matchesClass = exam.classId === effectiveClassId;
        const matchesYear = exam.academicYearId === examDetails.academicYearId;
        const matchesTerm = exam.termId === examDetails.termId;
        const isNotCurrent = exam.id !== selectedExamId;

        return matchesClass && matchesYear && matchesTerm && isNotCurrent;
      });

      setAvailableComparisonExams(filteredExams);

      // Build exam names map
      const namesMap: Record<string, string> = {};
      filteredExams.forEach(exam => {
        namesMap[exam.id] = exam.name;
      });
      setComparisonExamNames(namesMap);
    } catch (error) {
      console.error('Error loading comparison exams:', error);
      toast({ title: "Error", description: "Failed to load comparison exams" });
    } finally {
      setIsLoadingComparisonExams(false);
    }
  }, [selectedExamId, examResultData, pupilExamHistory, toast]);

  // Generate TRANS report with grading scale - MUST be defined before handleReportConfigComplete
  const generateTransReportWithGrading = React.useCallback(async () => {
    if (!selectedExamId || !pupil || !examResultData) {
      toast({ title: "Error", description: "Missing required data for TRANS report generation" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');
    // Keep PrintModal open to show loading state, only close other modals
    setShowReportConfigModal(false);
    setShowComparisonExamModal(false);
    setShowTransTypeModal(false);

    try {
      updateProgress(10, 'Preparing TRANS report data...');

      // 🚀 OPTIMIZED: Get exam details from pupilExamHistory (already cached) or use ExamsService
      let examDetails: any = null;
      if (pupilExamHistory?.exams) {
        examDetails = pupilExamHistory.exams.find((exam: any) => exam.id === selectedExamId);
      }

      if (!examDetails) {
        // Use ExamsService for efficient query (uses class-based optimization)
        try {
          const { ExamsService } = await import('@/lib/services/exams.service');
          examDetails = await ExamsService.getExamById(selectedExamId);
        } catch (error) {
          console.error('Failed to fetch exam details:', error);
        }
      }

      if (!examDetails) {
        throw new Error('Failed to get exam details');
      }

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

      updateProgress(30, 'Fetching data in parallel...');

      // 🚀 OPTIMIZED: Fetch all data in parallel using efficient services
      const [classData, gradingScaleData, majorSubjectsData, teacherData] = await Promise.all([
        // Fetch class data using ClassesService (more efficient)
        examResultData.classId ? (async () => {
          try {
            const { ClassesService } = await import('@/lib/services/classes.service');
            return await ClassesService.getById(examResultData.classId);
          } catch (error) {
            console.warn('Failed to fetch class:', error);
          }
          return null;
        })() : Promise.resolve(null),

        Promise.resolve(examResultData.gradingScale && Array.isArray(examResultData.gradingScale) && examResultData.gradingScale.length > 0
          ? examResultData.gradingScale.map((item: any) => ({
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
          }))),

        Promise.resolve(examResultData.majorSubjects || []),

        (() => {
          const subjectSnaps = examResultData.subjectSnapshots || [];
          const uniqueTeacherIds = [...new Set(subjectSnaps.map((s: any) => s.teacherId).filter(Boolean))];
          return createStaffNameMap(allStaff, uniqueTeacherIds);
        })()
      ]);

      updateProgress(60, 'Preparing subject data...');

      const subjectSnaps = (examResultData.subjectSnapshots || []).map((subject: any) => {
        const teacherName = subject.teacherId
          ? (teacherData.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher')
          : 'Not Assigned';

        return {
          ...subject,
          code: subject.code || subject.subjectCode || '',
          name: subject.name || subject.subjectName || '',
          teacherName,
          fullMarks: 100
        };
      });

      const classSnap = classData ? {
        id: classData.id,
        name: classData.name,
        code: classData.code || classData.name
      } : {
        id: examResultData.classId || '',
        name: 'Unknown Class',
        code: 'UNK'
      };

      updateProgress(70, 'Generating TRANS report PDF...');

      // Use default report config
      const createdOnDate = reportConfig.createdOn.useCustom && customDates.createdOn
        ? customDates.createdOn
        : examDetails.startDate || new Date().toISOString().split('T')[0];

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
        subjectSnaps: subjectSnaps,
        processedResults: processedResults,
        schoolSettings: schoolSettings || {},
        majorSubjects: majorSubjectsData,
        gradingScale: gradingScaleData,
        nextTermInfo: nextTermDates ? {
          startDate: nextTermDates.nextTermBegins,
          endDate: nextTermDates.nextTermEnds
        } : undefined,
        classTeacherInfo: {
          name: 'Class Teacher'
        },
        reportConfig: reportConfig,
        customDates: {
          createdOn: createdOnDate,
          nextTermBegins: reportConfig.nextTermBegins.useCustom && customDates.nextTermBegins
            ? customDates.nextTermBegins
            : (nextTermDates?.nextTermBegins || ''),
          nextTermEnds: reportConfig.nextTermEnds.useCustom && customDates.nextTermEnds
            ? customDates.nextTermEnds
            : (nextTermDates?.nextTermEnds || ''),
        },
        isProgressReport: false,
      };

      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${formatPupilDisplayName(pupil).replace(/\s+/g, '_')}_${selectedFullReportTemplate === 'full2' ? 'Bespoke_Report' : 'TRANS_Report'}.pdf`;
      const title = selectedFullReportTemplate === 'full2' ? 'Individual Pupil Bespoke Report' : 'Individual Pupil TRANS Report';
      await pdfViewer.runPDFJob(
        { fileName, title, initialMessage: 'Generating the individual full report…' },
        async ({ signal, updateProgress: updateWorkspaceProgress }) => {
          updateWorkspaceProgress(70, 'Rendering the individual full report…');
          const blob = await (selectedFullReportTemplate === 'full2'
            ? generateFullReport2PDF({ ...transBatchData, palette: fullReport2Palette } as Parameters<typeof generateFullReport2PDF>[0])
            : generateTransBatchReportPDF(transBatchData));
          if (signal.aborted) throw new DOMException('PDF generation was cancelled', 'AbortError');
          return blob;
        },
      );

      updateProgress(95, 'Finalizing document...');

      setGenerationProgress(100);
      setEta('Complete!');

      toast({
        title: "Success",
        description: "TRANS report generated successfully!",
        duration: 1500,
      });
    } catch (error) {
      console.error("Error generating TRANS report:", error);
      toast({
        title: "Error",
        description: "Failed to generate TRANS report. Please try again.",
        duration: 2000,
      });
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStatus('');
        setGenerationProgress(0);
        setStartTime(null);
        setEta('');
        // Close the print modal after generation completes
        setShowPrintModal(false);
      }, 1000);
    }
  }, [allStaff, selectedExamId, pupil, examResultData, pupilId, pupilExamHistory, academicYears, schoolSettings, toast, getAcademicYearAndTerm, createProcessedResultForPupil, pdfViewer, updateProgress, reportConfig, customDates, selectedFullReportTemplate, fullReport2Palette]);

  // Handle report configuration completion - MUST be after generateTransReportWithGrading
  const handleReportConfigComplete = React.useCallback(() => {
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

  // Generate TRANS report with progress assessment
  const generateTransReportWithProgress = React.useCallback(async (comparisonExamIds: string[], customNames: Record<string, string> = {}) => {
    if (!selectedExamId || !pupil || !examResultData) {
      toast({ title: "Error", description: "Missing required data for TRANS progress report generation" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setStartTime(Date.now());
    setEta('Calculating...');
    // Keep PrintModal open to show loading state, only close other modals
    setShowComparisonExamModal(false);
    setShowReportConfigModal(false);
    setShowTransTypeModal(false);

    try {
      updateProgress(5, 'Preparing data...');

      const singlePupilResult = await createProcessedResultForPupil();
      if (!singlePupilResult) {
        throw new Error('Failed to process pupil data');
      }

      updateProgress(10, 'Fetching comparison exam data...');

      // Get exam details first
      let examDetails: any = null;
      if (pupilExamHistory?.exams) {
        examDetails = pupilExamHistory.exams.find((exam: any) => exam.id === selectedExamId);
      }

      if (!examDetails) {
        try {
          const { ExamsService } = await import('@/lib/services/exams.service');
          examDetails = await ExamsService.getExamById(selectedExamId);
        } catch (error) {
          console.error('Failed to fetch exam details:', error);
        }
      }

      if (!examDetails) {
        throw new Error('Failed to get exam details');
      }

      // 🚀 OPTIMIZED: Fetch all comparison exams and their results in parallel
      const { ExamsService } = await import('@/lib/services/exams.service');
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
        const pupilResult = comparisonResults[pupilId || ''] || {};
        const processedSubjectResults: Record<string, any> = {};

        // Initialize all subjects first to ensure all are included
        comparisonSubjectSnaps.forEach((subject: any) => {
          const subjectCode = subject.code || subject.subjectCode;
          processedSubjectResults[subjectCode] = {
            marks: 0,
            grade: 'F9',
            aggregates: 0
          };
        });

        // Then populate with actual results
        comparisonSubjectSnaps.forEach((subject: any) => {
          const subjectCode = subject.code || subject.subjectCode;
          const result = pupilResult[subject.subjectId];
          const isMajorSubject = (examResult.majorSubjects || []).includes(subjectCode);

          if (result) {
            processedSubjectResults[subjectCode] = {
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
      const subjectSnaps = examResultData.subjectSnapshots || [];
      const allSubjectCodes = new Set<string>();
      subjectSnaps.forEach((s: any) => allSubjectCodes.add(s.code || s.subjectCode));
      comparisonExamsProcessed.forEach(({ subjectSnaps: compSubjectSnaps }) => {
        compSubjectSnaps.forEach((s: any) => allSubjectCodes.add(s.code || s.subjectCode));
      });

      const uniqueTeacherIds = [...new Set([
        ...subjectSnaps.map((s: any) => s.teacherId),
        ...comparisonExamsProcessed.flatMap(({ subjectSnaps: compSubjectSnaps }) =>
          compSubjectSnaps.map((s: any) => s.teacherId)
        )
      ].filter(Boolean))];
      const teachersMap = createStaffNameMap(allStaff, uniqueTeacherIds);

      // Create single pupil processed result with comparison data
      const processedResultWithComparison = {
        ...singlePupilResult,
        comparisonDataArray: comparisonExamsProcessed.map(({ exam, examResult, results, totalMarks, totalAggregates, division, subjectSnaps }) => {
          // Convert subjectSnaps to subjects array format expected by PDF
          // The PDF expects comparisonData.subjects to be an array where each subject has a 'code' property
          // It then looks up the actual marks from comparisonData.results[subject.code]
          const subjects = subjectSnaps.map((subject: any) => {
            const subjectCode = subject.code || subject.subjectCode;
            // Get teacher name from the teachersMap we just built
            const teacherName = subject.teacherId
              ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Not Assigned')
              : 'Not Assigned';

            return {
              name: subject.name || subject.subjectName || subjectCode,
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

      const processedResults = [processedResultWithComparison];

      // Create enhanced subject snaps with all subjects from all exams
      const allSubjectsMap = new Map<string, any>();
      subjectSnaps.forEach((subject: any) => {
        allSubjectsMap.set(subject.code || subject.subjectCode, {
          ...subject,
          code: subject.code || subject.subjectCode,
          name: subject.name || subject.subjectName,
          teacherName: subject.teacherId ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher') : 'Not Assigned',
          fullMarks: 100
        });
      });
      comparisonExamsProcessed.forEach(({ subjectSnaps: compSubjectSnaps }) => {
        compSubjectSnaps.forEach((subject: any) => {
          const code = subject.code || subject.subjectCode;
          if (!allSubjectsMap.has(code)) {
            allSubjectsMap.set(code, {
              ...subject,
              code: code,
              name: subject.name || subject.subjectName,
              teacherName: subject.teacherId ? (teachersMap.get(subject.teacherId) || subject.teacherName || 'Unknown Teacher') : 'Not Assigned',
              fullMarks: 100
            });
          }
        });
      });

      const enhancedSubjectSnaps = Array.from(allSubjectsMap.values());

      updateProgress(50, 'Preparing all report data in parallel...');

      // Fetch all data in parallel
      const [classData, nextTermDates, majorSubjectsData] = await Promise.all([
        examResultData.classId ? (async () => {
          try {
            const { ClassesService } = await import('@/lib/services/classes.service');
            return await ClassesService.getById(examResultData.classId);
          } catch (error) {
            console.warn('Failed to fetch class:', error);
          }
          return null;
        })() : Promise.resolve(null),

        Promise.resolve(getNextTermDates(
          examDetails.academicYearId || '',
          examDetails.termId || '',
          academicYears
        )),

        Promise.resolve(examResultData.majorSubjects || [])
      ]);

      const { academicYearName, termName } = getAcademicYearAndTerm(
        examDetails.academicYearId || '',
        examDetails.termId || ''
      );

      const classSnap = classData ? {
        id: classData.id,
        name: classData.name,
        code: classData.code || classData.name
      } : {
        id: examResultData.classId || '',
        name: 'Unknown Class',
        code: 'UNK'
      };

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

      updateProgress(70, 'Generating TRANS progress report PDF...');

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
        processedResults: processedResults,
        schoolSettings: schoolSettings || {},
        majorSubjects: majorSubjectsData,
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

      const fileName = `${examDetails.name.replace(/\s+/g, '_')}_${formatPupilDisplayName(pupil).replace(/\s+/g, '_')}_${selectedFullReportTemplate === 'full2' ? 'Bespoke_Report' : 'TRANS_Progress_Report'}.pdf`;
      const title = selectedFullReportTemplate === 'full2' ? 'Individual Pupil Bespoke Report' : 'Individual Pupil TRANS Progress Report';
      await pdfViewer.runPDFJob(
        { fileName, title, initialMessage: 'Generating the individual progress report…' },
        async ({ signal, updateProgress: updateWorkspaceProgress }) => {
          updateWorkspaceProgress(70, 'Rendering the individual progress report…');
          const blob = await (selectedFullReportTemplate === 'full2'
            ? generateFullReport2PDF({ ...transBatchData, palette: fullReport2Palette } as Parameters<typeof generateFullReport2PDF>[0])
            : generateTransBatchReportPDF(transBatchData));
          if (signal.aborted) throw new DOMException('PDF generation was cancelled', 'AbortError');
          return blob;
        },
      );

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
        setSelectedComparisonExams([]);
        setComparisonExamNames({});
        setTransReportType(null);
      }, 1000);
    }
  }, [allStaff, selectedExamId, pupil, examResultData, pupilId, pupilExamHistory, academicYears, schoolSettings, toast, getAcademicYearAndTerm, getNextTermDates, createProcessedResultForPupil, pdfViewer, updateProgress, reportConfig, customDates, selectedFullReportTemplate, fullReport2Palette]);

  if (!pupilId) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <PageHeader title="Pupil Profile" />
        <p className="text-muted-foreground">No pupil ID provided. Please select a pupil from the pupils list.</p>
        <div className="mt-4">
          <SmartBackButton fallbackHref="/pupils" className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
          </SmartBackButton>
        </div>
      </div>
    );
  }

  // 🚀 CRITICAL: Only show loading if we don't have cached data at all (first load)
  // If we have cached data (even if stale), show it immediately even if loading in background
  if (isLoading && !hasCachedData) {
    return <GlassPageRouteSkeleton variant="default" />;
  }

  // 🚀 CRITICAL: Only show error if we've finished loading and still don't have data
  // Don't show error while loading or if we have cached data
  if (!pupil && !isLoading && !pupilLoading) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <GlassPageTopBar
          title="Pupil Profile"
          backHref="/pupils"
          backLabel="Back to pupils"
        />
        <div className="mt-8 text-muted-foreground">
          <p>The pupil you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  // ── Status-derived display flags ──────────────────────────────────────────
  // (guaranteed non-null here — all null-pupil early-returns handled above)
  const isInactivePupil = pupil?.status === 'Inactive';
  const isGraduatedPupil = pupil?.status === 'Graduated';

  return (
    <>
      <GlassPageTopBar
        title={`${formatPupilDisplayName(pupil)}'s Profile`}
        subtitle={`${pupilWithClass?.classCode || getClassCode(pupil?.classId, classes)} • ${pupil?.section || 'N/A'} • ${pupil?.admissionNumber || 'N/A'}`}
        meta={
          <Badge variant="outline" className={`text-xs border shadow-sm ${
            pupil?.status === 'Active' ? 'bg-green-100 text-green-800 border-green-300' :
            pupil?.status === 'Inactive' ? 'bg-gray-100 text-gray-800 border-gray-300' :
            pupil?.status === 'Graduated' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
            'bg-blue-100 text-blue-800 border-blue-300'
          }`}>
            {pupil?.status || 'Active'}
          </Badge>
        }
        backHref="/pupils"
        backLabel="Back to pupils"
        actions={
          <div className="flex flex-row items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 action-buttons-container">
            {isEditMode ? (
              <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1">
                {/* Save Button */}
                <ActionGuard module="pupils" page="detail" action="edit_details">
                  <button
                    onClick={handleSaveEdits}
                    className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-green-600 border border-green-400 shadow-sm hover:bg-gradient-to-br hover:from-green-400 hover:via-emerald-500 hover:to-green-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                    aria-label="Save Changes"
                  >
                    <Edit className="w-4 h-4 mb-0.5" />
                    <span className="text-[8px] font-semibold leading-tight">Save</span>
                  </button>
                </ActionGuard>

                {/* Cancel Button */}
                <button
                  onClick={() => {
                    setIsEditMode(false);
                    setEditableFields({});
                    setEditableGuardians([]);
                  }}
                  className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-red-600 border border-red-400 shadow-sm hover:bg-gradient-to-br hover:from-red-400 hover:via-pink-500 hover:to-red-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                  aria-label="Cancel Editing"
                >
                  <X className="w-4 h-4 mb-0.5" />
                  <span className="text-[8px] font-semibold leading-tight">Cancel</span>
                </button>

                {/* Form Button */}
                <button
                  onClick={() => {
                    window.location.href = `/pupils/edit?id=${pupil.id}`;
                  }}
                  className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-blue-600 border border-blue-400 shadow-sm hover:bg-gradient-to-br hover:from-blue-400 hover:via-indigo-500 hover:to-blue-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                  aria-label="Open Edit Form"
                >
                  <FileText className="w-4 h-4 mb-0.5" />
                  <span className="text-[8px] font-semibold leading-tight">Form</span>
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1">
                {/* Fees Collection Button */}
                <ActionGuard module="pupils" page="detail" action="fee_collection">
                  <Link href={`/fees/collect?pupilId=${pupil.id}`}>
                    <button
                      className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-emerald-600 border border-emerald-400 shadow-sm hover:bg-gradient-to-br hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                      aria-label="Fees"
                    >
                      <span className="font-bold text-xs mb-0.5">Shs.</span>
                      <span className="text-[8px] font-semibold leading-tight">Fees</span>
                    </button>
                  </Link>
                </ActionGuard>

                {/* Family Account Button */}
                {pupil.familyId && actualSiblings.length > 0 && (
                  <button
                    onClick={() => setIsFamilyModalOpen(true)}
                    className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-teal-600 border border-teal-400 shadow-sm hover:bg-gradient-to-br hover:from-teal-400 hover:via-teal-500 hover:to-teal-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 group"
                    aria-label="Family Account"
                  >
                    <div className="w-4 h-4 mb-0.5 flex items-center justify-center font-bold text-xs">
                      <GuardianIconLucide className="w-4 h-4 group-hover:hidden" />
                      <span className="hidden group-hover:inline font-mono">
                        {actualSiblings.length}
                      </span>
                    </div>
                    <span className="text-[8px] font-semibold leading-tight group-hover:hidden">Family</span>
                    <span className="text-[8px] font-semibold leading-tight hidden group-hover:block">Siblings</span>
                  </button>
                )}

                {/* Assignment & Discounts Button */}
                <ActionGuard module="pupils" page="detail" action="manage_assignments">
                  <button
                    onClick={() => setIsAssignmentModalOpen(true)}
                    className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-purple-600 border border-purple-400 shadow-sm hover:bg-gradient-to-br hover:from-purple-400 hover:via-violet-500 hover:to-purple-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                    aria-label="Assign"
                  >
                    <Tag className="w-4 h-4 mb-0.5" />
                    <span className="text-[8px] font-semibold leading-tight">Assign</span>
                  </button>
                </ActionGuard>

                {/* Tracking Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-blue-600 border border-blue-400 shadow-sm hover:bg-gradient-to-br hover:from-blue-400 hover:via-indigo-500 hover:to-blue-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                      aria-label="Tracking Options"
                    >
                      <BarChart3 className="w-4 h-4 mb-0.5" />
                      <span className="text-[8px] font-semibold leading-tight">Track</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Tracking Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/uniform-tracking?id=${pupil.id}`} className="cursor-pointer">
                        <Shirt className="mr-2 h-4 w-4 text-blue-600" />
                        Uniform Tracking
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/requirement-tracking?id=${pupil.id}`} className="cursor-pointer">
                        <BookOpen className="mr-2 h-4 w-4 text-purple-600" />
                        Requirements Tracking
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Print Dropdown Button */}
                <ActionGuard module="pupils" page="detail" action="print_id_card">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-amber-600 border border-amber-400 shadow-sm hover:bg-gradient-to-br hover:from-amber-400 hover:via-orange-500 hover:to-amber-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                        aria-label="Print Options"
                      >
                        <Printer className="w-4 h-4 mb-0.5" />
                        <span className="text-[8px] font-semibold leading-tight">Print</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Print Options</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleGenerateIDCard}>
                        <UserSquare className="mr-2 h-4 w-4" />
                        <span>ID</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleGenerateDetailsPDF()}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Details</span>
                      </DropdownMenuItem>
                      {pupil && getSchoolPayCode(pupil) && (
                        <DropdownMenuItem onClick={handleGeneratePaymentSlipPDF}>
                          <CreditCard className="mr-2 h-4 w-4" />
                          <span>Payment</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ActionGuard>

                {/* Back Button */}
                <SmartBackButton 
                  fallbackHref="/pupils"
                  className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-gray-600 border border-gray-400 shadow-sm hover:bg-gradient-to-br hover:from-gray-400 hover:via-gray-500 hover:to-gray-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                  aria-label="Back to List"
                >
                  <ArrowLeft className="w-4 h-4 mb-0.5" />
                  <span className="text-[8px] font-semibold leading-tight">Back</span>
                </SmartBackButton>

                {/* Settings/Edit Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white text-gray-600 border border-gray-400 shadow-sm hover:bg-gradient-to-br hover:from-gray-400 hover:via-gray-500 hover:to-gray-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
                      aria-label="Settings"
                    >
                      <Settings className="w-4 h-4 mb-0.5" />
                      <span className="text-[8px] font-semibold leading-tight">More</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Pupil Management</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <ActionGuard module="pupils" page="detail" action="edit_details">
                      <DropdownMenuItem onClick={() => {
                        setIsEditMode(true);
                        setEditableFields({
                          firstName: pupil?.firstName || '',
                          lastName: pupil?.lastName || '',
                          otherNames: pupil?.otherNames || '',
                          admissionNumber: pupil?.admissionNumber || '',
                          gender: pupil?.gender || '',
                          dateOfBirth: pupil?.dateOfBirth || '',
                          placeOfBirth: pupil?.placeOfBirth || '',
                          nationality: pupil?.nationality || '',
                          religion: pupil?.religion || '',
                          address: pupil?.address || '',
                          classId: pupil?.classId || '',
                          section: pupil?.section || '',
                          status: pupil?.status || '',
                          previousSchool: pupil?.previousSchool || '',
                          registrationDate: pupil?.registrationDate || '',
                          medicalConditions: pupil?.medicalConditions || '',
                          allergies: pupil?.allergies || '',
                          medications: pupil?.medications || '',
                          bloodType: pupil?.bloodType || '',
                        });
                        // Initialize editable guardians
                        setEditableGuardians(
                          pupil?.guardians && pupil.guardians.length > 0
                            ? pupil.guardians.map(g => ({ ...g }))
                            : [{ id: `g-${Date.now()}`, firstName: '', lastName: '', relationship: '', phone: '', secondaryPhone: '', email: '', occupation: '', address: '', nationalId: '' }]
                        );
                      }}>
                        <Edit className="mr-2 h-4 w-4 text-blue-600" />
                        Edit Pupil Details
                      </DropdownMenuItem>
                    </ActionGuard>
                    <ActionGuard module="pupils" page="detail" action="change_status">
                      <DropdownMenuItem onClick={handleStatusChange}>
                        <Shield className="mr-2 h-4 w-4 text-orange-600" />
                        Change Status
                      </DropdownMenuItem>
                    </ActionGuard>
                    <ActionGuard module="pupils" page="detail" action="manage_id_codes">
                      <DropdownMenuItem onClick={() => setIsManageIdCodesModalOpen(true)}>
                        <CreditCard className="mr-2 h-4 w-4 text-green-600" />
                        ID Codes
                      </DropdownMenuItem>
                    </ActionGuard>
                    <ActionGuard module="pupils" page="detail" action="manage_id_codes">
                      <DropdownMenuItem onClick={() => setIsManagePayCodeModalOpen(true)}>
                        <Tag className="mr-2 h-4 w-4 text-emerald-600" />
                        Pay Code (SchoolPay)
                      </DropdownMenuItem>
                    </ActionGuard>
                    {canAccessModule('users') && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsLinkedAccountOpen(true)}>
                          <UserPlus className="mr-2 h-4 w-4 text-violet-600" />
                          Parent Account
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <ActionGuard module="pupils" page="detail" action="add_sibling">
                      <DropdownMenuItem onClick={() => {
                        const siblingParams = new URLSearchParams({
                          addingSibling: 'true',
                          familyId: pupil.familyId || `fam-${Date.now()}`,
                          originalPupilId: pupil.id
                        });
                        router.push(`/pupils/new?${siblingParams.toString()}`);
                      }}>
                        <UserPlus className="mr-2 h-4 w-4 text-indigo-600" />
                        Add Sibling
                      </DropdownMenuItem>
                    </ActionGuard>
                    <DropdownMenuSeparator />
                    <ActionGuard module="pupils" page="detail" action="delete_pupil">
                      <DropdownMenuItem
                        onClick={() => alert("Delete action for " + pupil.id)}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Pupil
                      </DropdownMenuItem>
                    </ActionGuard>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        } />

      {pupil && (
        <LinkedUserAccountDialog
          target="pupil"
          targetId={pupil.id}
          targetName={formatPupilDisplayName(pupil)}
          defaultUsername={`parent_${String(pupil.admissionNumber || pupil.id).replace(/\s+/g, '').toLowerCase()}`}
          open={isLinkedAccountOpen}
          onOpenChange={setIsLinkedAccountOpen}
          onAccountChanged={() => {
            void queryClient.invalidateQueries({ queryKey: ['pupils'] });
          }}
        />
      )}

      {/* Main Content */}

      {/* Gold ring on all cards for graduated pupils (scoped via #pupil-profile-page) */}
      {isGraduatedPupil && (
        <style dangerouslySetInnerHTML={{ __html: `
          #pupil-profile-page [class~="shadow-lg"],
          #pupil-profile-page [class~="shadow-md"],
          #pupil-profile-page [class~="shadow-sm"] {
            outline: 1.5px solid rgba(212, 160, 23, 0.65) !important;
            box-shadow:
              0 0 0 1.5px rgba(212, 160, 23, 0.28),
              0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -2px rgba(0, 0, 0, 0.1) !important;
          }
        `}} />
      )}

      {/* Grayscale page content for inactive pupils */}
      <div
        id="pupil-profile-page"
        className={[
          'space-y-6',
          isInactivePupil ? 'grayscale' : '',
        ].filter(Boolean).join(' ')}
      >
        {/* Information Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
          <div className="xl:col-span-1 space-y-4 lg:space-y-6">
            <Card className="shadow-lg overflow-hidden" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
              <CardContent className="pt-6 flex flex-col items-center bg-card">
                {/* Avatar row — graduation badge sits beside it at same size when graduated */}
                <div className={isGraduatedPupil ? 'flex items-center gap-5' : ''}>
                  <PupilPhotoDetail
                    pupilPhoto={pupil.photo}
                    pupilName={formatPupilDisplayName(pupil)}
                    onPhotoChange={handlePhotoChange}
                    ringColor={currentHouse?.themeColor}
                  />

                  {/* Graduation cap badge — same visual weight as the avatar */}
                  {isGraduatedPupil && (
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-full shadow-2xl"
                      style={{
                        width: '120px',
                        height: '120px',
                        background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 50%, #92400e 100%)',
                        border: '4px solid #fef3c7',
                        boxShadow: '0 0 0 3px rgba(251,191,36,0.35), 0 8px 24px rgba(217,119,6,0.5)',
                      }}
                    >
                      <GraduationCap
                        style={{
                          width: '58px',
                          height: '58px',
                          color: '#fff',
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
                        }}
                      />
                    </div>
                  )}
                </div>
                {isEditMode ? (
                  <div className="mt-4 w-full space-y-2">
                    <Input
                      value={editableFields.firstName || pupil?.firstName || ''}
                      onChange={(e) => setEditableFields(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="First Name"
                      className="text-center text-lg font-bold"
                    />
                    <Input
                      value={editableFields.lastName || pupil?.lastName || ''}
                      onChange={(e) => setEditableFields(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Last Name"
                      className="text-center text-lg font-bold"
                    />
                    <Input
                      value={editableFields.otherNames || pupil?.otherNames || ''}
                      onChange={(e) => setEditableFields(prev => ({ ...prev, otherNames: e.target.value }))}
                      placeholder="Other Names (Optional)"
                      className="text-center text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="mt-4 text-2xl font-bold text-center text-card-foreground">
                      {formatPupilDisplayName(pupil)}
                    </h2>

                    {/* INACTIVE stamp — shown prominently below name */}
                    {isInactivePupil && (
                      <div className="mt-1.5 flex items-center justify-center">
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-[0.25em] border select-none"
                          style={{
                            background: 'rgba(55,65,81,0.92)',
                            color: '#e5e7eb',
                            borderColor: 'rgba(107,114,128,0.5)',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
                          INACTIVE
                        </span>
                      </div>
                    )}
                  </>
                )}

                <div className="mt-2 text-sm text-muted-foreground">
                  {isEditMode ? (
                    <Input
                      value={editableFields.admissionNumber || pupil?.admissionNumber || ''}
                      onChange={(e) => setEditableFields(prev => ({ ...prev, admissionNumber: e.target.value }))}
                      placeholder="Admission Number"
                      className="text-center text-sm"
                    />
                  ) : (
                    <>Admission No: {pupil.admissionNumber}</>
                  )}
                </div>

                {/* SchoolPay payment code prominent display */}
                {(() => {
                  const payCode = pupil.additionalIdentifiers?.find(
                    (id) => (id.idType || '').toLowerCase().includes('pay code')
                  )?.idValue;
                  return payCode ? (
                    <div
                      className="mt-1 flex items-center justify-center gap-1.5 cursor-pointer"
                      onClick={() => setIsManagePayCodeModalOpen(true)}
                      title="Click to manage pay code"
                    >
                      <Tag className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono tracking-wide">
                        Pay Code: {payCode}
                      </span>
                    </div>
                  ) : null;
                })()}

                {personalIdentifiers.length > 0 && (
                  <div className="mt-1 flex flex-wrap justify-center gap-1 items-center">
                    {personalIdentifiers.map((ident, index) => (
                      <Badge key={index} variant="outline" className="text-xs px-1.5 py-0.5 font-normal">
                        {ident.customIdName || ident.idType}: {ident.idValue}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap justify-center gap-2 items-center">
                  {pupil.status === 'Graduated' ? (
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge
                        variant="outline"
                        className="text-xs bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100 cursor-pointer transition-colors"
                        onClick={() => setShowPLEDialog(!showPLEDialog)}
                      >
                        <BookOpen className="mr-1 h-3 w-3" />
                        PLE
                      </Badge>
                      {pupil.graduationYear && pupil.graduationClassId ? (
                        <Link
                          href={`/classes/graduates/${pupil.graduationClassId}`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-md text-xs text-yellow-700 hover:bg-yellow-100 transition-colors duration-200"
                        >
                          <Award className="h-3 w-3" />
                          <span>Class of {pupil.graduationYear}</span>
                        </Link>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                          Class of {pupil.graduationYear || 'Unknown'}
                        </Badge>
                      )}
                      {pupil.graduationDate && (
                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                          {new Date(pupil.graduationDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <Badge variant={pupil.status === 'Active' ? 'default' : pupil.status === 'Inactive' ? 'secondary' : 'outline'} className="text-xs">{pupil.status}</Badge>
                  )}
                  <Badge variant="outline" className="text-xs">{pupil.section}</Badge>
                  {pupil.classId ? (
                    <Link href={`/class-detail?id=${pupil.classId}`}>
                      <Badge variant="outline" className="text-xs hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors">
                        {pupilWithClass?.className || getClassNameMemo(pupil.classId)}
                      </Badge>
                    </Link>
                  ) : (
                    <Badge variant="outline" className="text-xs">{pupilWithClass?.className || getClassNameMemo(pupil.classId)}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* PLE Results Card - Inline, appears when badge is clicked */}
            {showPLEDialog && (
              <Card
                className="shadow-lg border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 overflow-hidden transition-all duration-500 ease-out"
                style={{
                  animation: 'slideDown 0.5s ease-out'
                }}
              >
                <CardHeader className="pb-3 border-b border-purple-200">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-lg lg:text-xl text-purple-900">
                      <BookOpen className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
                      PLE Results - {formatPupilDisplayName(pupil)}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPLEDialog(false)}
                      className="h-8 w-8 p-0 hover:bg-purple-100"
                    >
                      <X className="h-4 w-4 text-purple-600" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {isLoadingPLEResults ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-600 mr-2" />
                      <span className="text-sm text-gray-600">Loading PLE results...</span>
                    </div>
                  ) : pupilPLEResults.length === 0 ? (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No PLE results found for this pupil.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pupilPLEResults.map(({ pleRecord, pupilResult }) => {
                        const getDivisionColor = (division: string) => {
                          switch (division) {
                            case 'I': return 'bg-green-100 text-green-800 border-green-200';
                            case 'II': return 'bg-blue-100 text-blue-800 border-blue-200';
                            case 'III': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                            case 'IV': return 'bg-orange-100 text-orange-800 border-orange-200';
                            case 'U': return 'bg-red-100 text-red-800 border-red-200';
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
                          <div key={pleRecord.id} className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Award className="h-5 w-5 text-purple-600" />
                                <h3 className="font-semibold text-lg text-gray-900">PLE {pleRecord.year}</h3>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  router.push(`/exams/ple-results/pupil/${pupilResult.pupilId}/${pleRecord.id}`);
                                }}
                                className="border-purple-200 text-purple-700 hover:bg-purple-50"
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Button>
                            </div>

                            {pupilResult.status === 'missed' ? (
                              <div className="text-center py-4">
                                <Badge variant="outline" className="text-sm bg-red-50 text-red-700 border-red-200">
                                  Missed Examination
                                </Badge>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-wrap gap-2 items-center mb-3">
                                  {pupilResult.division && (
                                    <Badge className={`${getDivisionColor(pupilResult.division)} text-sm font-bold px-3 py-1`}>
                                      Division {pupilResult.division}
                                    </Badge>
                                  )}
                                  {pupilResult.totalAggregate && (
                                    <Badge variant="outline" className={`${getAggregateColor(pupilResult.totalAggregate)} text-sm font-mono px-3 py-1`}>
                                      Aggregate: {pupilResult.totalAggregate}
                                    </Badge>
                                  )}
                                </div>

                                {pupilResult.subjects && Object.keys(pupilResult.subjects).length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">Subject Grades:</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {Object.entries(pupilResult.subjects).map(([subject, grade]) => {
                                        const subjectCodes: Record<string, string> = {
                                          'english': 'ENG',
                                          'mathematics': 'MATH',
                                          'science': 'SCI',
                                          'socialStudies': 'SST',
                                          'social_studies': 'SST'
                                        };
                                        return (
                                          <div key={subject} className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-md p-2 border border-purple-100">
                                            <p className="text-xs text-gray-600 font-medium">{subjectCodes[subject] || subject.toUpperCase()}</p>
                                            <p className="text-sm font-bold text-purple-700">{grade}</p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg lg:text-xl">
                  <UserSquare className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                  Personal Details
                  {isEditMode && (
                    <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-600 border-blue-200">
                      <Edit className="mr-1 h-3 w-3" />
                      Editing
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <DetailItem
                  key="dob"
                  icon={<CalendarDays />}
                  label="Date of Birth"
                  value={
                    isEditMode
                      ? (editableFields.dateOfBirth || pupil?.dateOfBirth || '').split('T')[0] // Format for date input
                      : (showDateOfBirth ? formatDate(pupil.dateOfBirth) : calculateAge(pupil.dateOfBirth))
                  }
                  isEditMode={isEditMode}
                  fieldName="dateOfBirth"
                  onValueChange={(value) => setEditableFields(prev => ({ ...prev, dateOfBirth: value }))}
                  inputType="date"
                />
                {!isEditMode && (
                  <button
                    onClick={() => setShowDateOfBirth(!showDateOfBirth)}
                    className="text-xs text-muted-foreground hover:text-primary hover:underline cursor-pointer transition-colors w-full text-right mt-1"
                    title={showDateOfBirth ? "Click to show age" : "Click to show date of birth"}
                  >
                    {showDateOfBirth ? "Show Age" : "Show Date of Birth"}
                  </button>
                )}
                <DetailItem
                  key="pob"
                  icon={<MapPin />}
                  label="Place of Birth"
                  value={isEditMode ? editableFields.placeOfBirth : pupil.placeOfBirth}
                  isEditMode={isEditMode}
                  fieldName="placeOfBirth"
                  onValueChange={(value) => setEditableFields(prev => ({ ...prev, placeOfBirth: value }))}
                />
                <DetailItem
                  key="gender"
                  icon={<UserSquare />}
                  label="Gender"
                  value={isEditMode ? (editableFields.gender || pupil?.gender || '') : pupil.gender}
                  isEditMode={isEditMode}
                  fieldName="gender"
                  onValueChange={(value) => setEditableFields(prev => ({ ...prev, gender: value as Pupil['gender'] }))}
                  inputType="select"
                  selectOptions={GENDERS.filter(g => g).map(g => ({ value: g, label: g }))}
                />
                <DetailItem
                  key="house"
                  icon={<Home />}
                  label="House"
                  value={
                    <button
                      onClick={() => setIsHouseChangeOpen(true)}
                      className="inline-flex items-center gap-2 text-foreground hover:text-primary hover:underline"
                      title="Click to change house"
                    >
                      {currentHouse ? (
                        <>
                          <span
                            className="inline-block w-3 h-3 rounded-full border"
                            style={{ backgroundColor: currentHouse.themeColor, borderColor: currentHouse.themeColor }}
                          />
                          <span>{currentHouse.name}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{isEditMode ? 'None - Click to set' : 'None'}</span>
                      )}
                    </button>
                  }
                />
                <DetailItem
                  key="address"
                  icon={<Home />}
                  label="Address"
                  value={isEditMode ? editableFields.address : pupil.address}
                  isEditMode={isEditMode}
                  fieldName="address"
                  onValueChange={(value) => setEditableFields(prev => ({ ...prev, address: value }))}
                  multiline={true}
                  inputType="textarea"
                />
                <DetailItem
                  key="nationality"
                  label="Nationality"
                  value={isEditMode ? editableFields.nationality : pupil.nationality}
                  isEditMode={isEditMode}
                  fieldName="nationality"
                  onValueChange={(value) => setEditableFields(prev => ({ ...prev, nationality: value }))}
                />
                <DetailItem
                  key="religion"
                  label="Religion"
                  value={isEditMode ? editableFields.religion : pupil.religion}
                  isEditMode={isEditMode}
                  fieldName="religion"
                  onValueChange={(value) => setEditableFields(prev => ({ ...prev, religion: value }))}
                />
                <DetailItem
                  key="regdate"
                  label="Registration Date"
                  value={
                    isEditMode
                      ? (editableFields.registrationDate || pupil?.registrationDate || '').split('T')[0] // Format for date input
                      : formatDate(pupil.registrationDate)
                  }
                  isEditMode={isEditMode}
                  fieldName="registrationDate"
                  onValueChange={(value) => setEditableFields(prev => ({ ...prev, registrationDate: value }))}
                  inputType="date"
                />

                {/* Medical Information Section - Show in edit mode or if data exists */}
                {(isEditMode || pupil.medicalConditions || pupil.allergies || pupil.medications || pupil.bloodType) && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <h4 className="font-semibold text-sm mb-3 flex items-center">
                      <HeartPulse className="mr-2 h-4 w-4 text-primary" />
                      Medical Information
                    </h4>
                    <DetailItem
                      key="bloodType"
                      label="Blood Type"
                      value={pupil.bloodType || (isEditMode ? '' : undefined)}
                      isEditMode={isEditMode}
                      fieldName="bloodType"
                      onValueChange={(value) => setEditableFields(prev => ({ ...prev, bloodType: value as Pupil['bloodType'] }))}
                    />
                    <DetailItem
                      key="medicalConditions"
                      label="Medical Conditions"
                      value={isEditMode ? editableFields.medicalConditions : pupil.medicalConditions}
                      isEditMode={isEditMode}
                      fieldName="medicalConditions"
                      onValueChange={(value) => setEditableFields(prev => ({ ...prev, medicalConditions: value }))}
                      multiline={true}
                      inputType="textarea"
                    />
                    <DetailItem
                      key="allergies"
                      label="Allergies"
                      value={isEditMode ? editableFields.allergies : pupil.allergies}
                      isEditMode={isEditMode}
                      fieldName="allergies"
                      onValueChange={(value) => setEditableFields(prev => ({ ...prev, allergies: value }))}
                      multiline={true}
                      inputType="textarea"
                    />
                    <DetailItem
                      key="medications"
                      label="Medications"
                      value={isEditMode ? editableFields.medications : pupil.medications}
                      isEditMode={isEditMode}
                      fieldName="medications"
                      onValueChange={(value) => setEditableFields(prev => ({ ...prev, medications: value }))}
                      multiline={true}
                      inputType="textarea"
                    />
                  </div>
                )}

                {/* rMQR Code - HIDDEN per user request */}
                {/* <div className="mt-4 pt-2 border-t border-border/50">
                <div className="flex flex-col items-center">
                  <h4 className="text-sm font-medium mb-1">Pupil ID Card</h4>
                  <RMQRCode
                    data={`Name: ${formatPupilDisplayName(pupil)}
DOB: ${formatDate(pupil.dateOfBirth)}
Admission #: ${pupil.admissionNumber || 'N/A'}
Registration: ${formatDate(pupil.registrationDate)}
Gender: ${pupil.gender || 'N/A'}
Emergency Contact: ${emergencyContactGuardian ? emergencyContactGuardian.phone : 'N/A'}`}
                    pixelSize={5}
                    className=""
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Rectangular Micro QR Code (rMQR)
                  </p>
                </div>
              </div> */}
              </CardContent>
            </Card>

            {pupil.familyId && actualSiblings.length > 0 && (
              <Card className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg lg:text-xl"><GuardianIconLucide className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-primary" /> {formatPupilDisplayName(pupil)}'s Siblings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="space-y-3">
                      {actualSiblings.map(sibling => (
                        <div key={sibling.id} className="p-3 rounded-md border bg-muted/20 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2">
                                  <Link href={`/pupil-detail?id=${sibling.id}`} className="text-primary hover:underline font-medium">
                                    {sibling.firstName} {sibling.lastName} {sibling.otherNames || ''}
                                  </Link>
                                  <Badge variant={sibling.status === 'Active' ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5 h-4">
                                    {sibling.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="h-6 rounded-full px-2 text-[10px] font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50 shrink-0"
                                  >
                                    <Link href={`/fees/collect/${sibling.id}`}>
                                      <span className="font-bold text-[10px] mr-0.5 pt-px">Shs.</span>
                                      Fees
                                    </Link>
                                  </Button>
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="h-6 rounded-full px-2 text-[10px] font-semibold border-indigo-300 text-indigo-700 hover:bg-indigo-50 shrink-0"
                                  >
                                    <Link href={`/pupil-detail?id=${sibling.id}#exams-card`}>
                                      <BookOpen className="h-2.5 w-2.5 mr-0.5" />
                                      Exams
                                    </Link>
                                  </Button>
                                  {/* Gear menu for sibling actions */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        className="flex items-center justify-center h-6 w-6 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 transition-all shrink-0"
                                        title="Sibling actions"
                                      >
                                        <Settings className="h-3 w-3" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Sibling Actions</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem asChild>
                                        <Link href={`/pupil-detail?id=${sibling.id}`} className="flex items-center cursor-pointer">
                                          <Eye className="mr-2 h-3.5 w-3.5 text-blue-600" />
                                          View Profile
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <Link href={`/fees/collect/${sibling.id}`} className="flex items-center cursor-pointer">
                                          <span className="mr-2 font-bold text-[10px] text-emerald-600">Shs.</span>
                                          Collect Fees
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                                        onClick={() => {
                                          const remaining = actualSiblings.filter(s => s.id !== sibling.id);
                                          setUnlinkSiblingConfirm({ siblingToUnlink: sibling, remainingSiblings: remaining });
                                        }}
                                      >
                                        <svg className="mr-2 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                        Unlink Sibling
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                <span className="font-mono text-gray-700 dark:text-gray-300">{sibling.admissionNumber}</span>
                                <span className="text-gray-300">•</span>
                                <span>
                                  {sibling.classId ? (
                                    <Link
                                      href={`/class-detail?id=${sibling.classId}`}
                                      className="text-primary hover:underline cursor-pointer"
                                    >
                                      {getClassCode(sibling.classId, classes)}
                                    </Link>
                                  ) : (
                                    getClassCode(sibling.classId, classes)
                                  )}
                                </span>
                                <span className="text-gray-300">•</span>
                                <span>{sibling.section || 'N/A'}</span>
                                <span className="text-gray-300">•</span>
                                <span>{sibling.gender || 'N/A'}</span>
                                {sibling.dateOfBirth && (
                                  <>
                                    <span className="text-gray-300">•</span>
                                    <span>{new Date().getFullYear() - new Date(sibling.dateOfBirth).getFullYear()} yrs</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {sibling.photo && (
                              <Avatar className="h-12 w-12 border-2 border-primary/20">
                                <AvatarImage
                                  src={sibling.photo && sibling.photo.trim() !== '' ? sibling.photo : undefined}
                                  alt={`${sibling.firstName} ${sibling.lastName}`}
                                  data-ai-hint="sibling photo"
                                />
                                <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                                  {sibling.firstName?.[0] || 'S'}{sibling.lastName?.[0] || 'S'}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Unlink Sibling Confirmation Dialog */}
            <ModernDialog
              open={unlinkSiblingConfirm !== null}
              onOpenChange={(open) => { if (!open && !isUnlinking) setUnlinkSiblingConfirm(null); }}
            >
              <ModernDialogContent size="sm">
                <ModernDialogHeader>
                  <ModernDialogTitle>Unlink Sibling</ModernDialogTitle>
                  <ModernDialogDescription>
                    {unlinkSiblingConfirm && (
                      <>
                        The system will unlink{' '}
                        <strong>{unlinkSiblingConfirm.siblingToUnlink.firstName} {unlinkSiblingConfirm.siblingToUnlink.lastName}</strong>{' '}
                        from{' '}
                        <strong>
                          {unlinkSiblingConfirm.remainingSiblings.length > 0
                            ? unlinkSiblingConfirm.remainingSiblings.map(s => `${s.firstName} ${s.lastName}`).join(', ')
                            : `${pupil?.firstName} ${pupil?.lastName}`}
                        </strong>.
                        {' '}They will be given a new independent family ID.
                      </>
                    )}
                  </ModernDialogDescription>
                </ModernDialogHeader>
                {unlinkSiblingConfirm && (
                  <div className="flex items-center gap-3 px-1 py-2">
                    <Avatar className="h-10 w-10 border-2 border-red-200">
                      {unlinkSiblingConfirm.siblingToUnlink.photo && (
                        <AvatarImage src={unlinkSiblingConfirm.siblingToUnlink.photo} alt={`${unlinkSiblingConfirm.siblingToUnlink.firstName}`} />
                      )}
                      <AvatarFallback className="text-xs bg-red-100 text-red-700">
                        {unlinkSiblingConfirm.siblingToUnlink.firstName.charAt(0)}{unlinkSiblingConfirm.siblingToUnlink.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-gray-900">{unlinkSiblingConfirm.siblingToUnlink.firstName} {unlinkSiblingConfirm.siblingToUnlink.lastName}</p>
                      <p className="text-xs text-gray-500">{unlinkSiblingConfirm.siblingToUnlink.admissionNumber}</p>
                    </div>
                  </div>
                )}
                <ModernDialogFooter className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setUnlinkSiblingConfirm(null)}
                    disabled={isUnlinking}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleUnlinkSibling}
                    disabled={isUnlinking}
                    className="w-full sm:w-auto"
                  >
                    {isUnlinking ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Unlinking...</>
                    ) : (
                      'Yes, Unlink Sibling'
                    )}
                  </Button>
                </ModernDialogFooter>
              </ModernDialogContent>
            </ModernDialog>

            {/* Staff Relative Section */}
            {pupil.assignedStaffId && assignedStaff && (
              <Card className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center text-base">
                    <Briefcase className="mr-2 h-4 w-4 text-indigo-600" /> Staff Relative
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 py-1">
                    {assignedStaff.photo && (
                      <Avatar className="h-8 w-8 border border-indigo-200">
                        <AvatarImage
                          src={assignedStaff.photo && assignedStaff.photo.trim() !== '' ? assignedStaff.photo : undefined}
                          alt={`${assignedStaff.firstName} ${assignedStaff.lastName}`}
                        />
                        <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                          {assignedStaff.firstName?.[0] || 'S'}{assignedStaff.lastName?.[0] || 'S'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-muted-foreground">Assigned: </span>
                      <Link href={`/staff/${pupil.assignedStaffId}`} className="text-primary hover:underline font-medium">
                        {assignedStaff.firstName} {assignedStaff.lastName}
                      </Link>
                      {assignedStaff.role && (
                        <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                          {formatStaffRoles(assignedStaff.role)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-gray-100">
                    {assignedStaff.employeeId && (
                      <div>
                        <span className="text-muted-foreground">ID: </span>
                        <span className="font-mono text-xs">{assignedStaff.employeeId}</span>
                      </div>
                    )}
                    {assignedStaff.department && (
                      <div>
                        <span className="text-muted-foreground">Dept: </span>
                        <span className="text-xs">{assignedStaff.department}</span>
                      </div>
                    )}
                    {assignedStaff.email && (
                      <div className="col-span-2 truncate">
                        <span className="text-muted-foreground">Email: </span>
                        <a href={`mailto:${assignedStaff.email}`} className="text-primary hover:underline truncate">
                          {assignedStaff.email}
                        </a>
                      </div>
                    )}
                    {assignedStaff.phone && (
                      <div>
                        <span className="text-muted-foreground">Phone: </span>
                        <a href={`tel:${assignedStaff.phone}`} className="text-primary hover:underline">
                          {assignedStaff.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Exams Tile - moved to appear after Family & Siblings */}
            <Card id="exams-card" className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center text-base lg:text-lg">
                    <BookOpen className="mr-2 h-4 w-4 text-primary" /> Exams
                  </CardTitle>
                  {!shouldLoadExams && (
                    <Button
                      onClick={() => setShouldLoadExams(true)}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-full h-7 px-3 text-xs font-semibold"
                    >
                      <BookOpen className="h-3.5 w-3.5 mr-1" />
                      Show
                    </Button>
                  )}
                  {shouldLoadExams && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 rounded-md border border-border/50">
                        <Select
                           value={examFilters.academicYearId}
                           onValueChange={(value) => {
                             setExamFilters(prev => ({ ...prev, academicYearId: value, termId: 'all' }));
                             // Update term filter when year changes - use smart term selector
                             const selectedYear = academicYears.find(y => y.id === value);
                             if (selectedYear) {
                               const activeTerm = getActiveOrMostRecentTerm(selectedYear);
                               setExamFilters(prev => ({ ...prev, termId: activeTerm?.id || 'all' }));
                             }
                           }}
                        >
                          <SelectTrigger className="h-6 border-0 bg-transparent text-xs font-medium px-1 py-0 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent side="top" align="start" className="max-h-[200px] overflow-y-auto">
                            <SelectItem value="all">All Years</SelectItem>
                            {academicYears.map(year => (
                              <SelectItem key={year.id} value={year.id}>
                                {year.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-muted-foreground text-xs">•</span>
                        <Select
                          value={examFilters.termId}
                          onValueChange={(value) => setExamFilters(prev => ({ ...prev, termId: value }))}
                          disabled={examFilters.academicYearId === 'all'}
                        >
                          <SelectTrigger className="h-6 border-0 bg-transparent text-xs font-medium px-1 py-0 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden min-w-fit">
                            <SelectValue placeholder="Term" />
                          </SelectTrigger>
                          <SelectContent side="top" align="start" className="max-h-[200px] overflow-y-auto">
                            <SelectItem value="all">All Terms</SelectItem>
                            {availableTerms.map(term => (
                              <SelectItem key={term.id} value={term.id}>
                                {term.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={() => setShouldLoadExams(false)}
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 rounded-full"
                        title="Hide Exams"
                        aria-label="Hide Exams"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              {shouldLoadExams && (
                <CardContent>
                  {/* PLE Results Section - Hidden because it's now shown in the inline card above */}
  
                  {/* Regular Exam Results Section - Load on demand */}
                  {pupilPLEResults.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-semibold text-lg mb-3">Other Examination Records</h3>
                    </div>
                  )}
                  {isLoadingExamHistory ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Loading exam history...</span>
                  </div>
                ) : (!pupilExamHistory || !pupilExamHistory.examResults || pupilExamHistory.examResults.length === 0) ? (
                  <div className="text-center p-4 bg-muted/30 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      {pupilPLEResults.length > 0 ? 'No other exam records found for this pupil.' : 'No exam records found for this pupil.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pupilExamHistory.examResults
                      .filter(examResult => {
                        // Find the corresponding exam data
                        const examData = pupilExamHistory.exams.find(exam => exam.id === examResult.examId);
                        if (!examData) return false;

                        // Apply academic year filter
                        if (examFilters.academicYearId !== 'all' && examData.academicYearId !== examFilters.academicYearId) {
                          return false;
                        }

                        // Apply term filter
                        if (examFilters.termId !== 'all' && examData.termId !== examFilters.termId) {
                          return false;
                        }

                        return true;
                      })
                      .map((examResult) => {
                        // Find the corresponding exam data
                        const examData = pupilExamHistory.exams.find(exam => exam.id === examResult.examId);
                        if (!examData) return null;

                        // Find pupil's data for this exam
                        const pupilData = examResult.pupilSnapshots?.find(p => p.pupilId === pupilId);
                        if (!pupilData) return null;

                        // Calculate pupil's performance
                        let totalMarks = 0;
                        let totalAggregates = 0;
                        let subjectCount = 0;

                        if (examResult.results && examResult.results[pupilId || '']) {
                          const results = examResult.results[pupilId || ''];

                          Object.values(results).forEach((result: any) => {
                            if (result.marks !== undefined) {
                              totalMarks += result.marks || 0;
                              totalAggregates += result.aggregates || 0;
                              subjectCount++;
                            }
                          });
                        }

                        const averageMarks = subjectCount > 0 ? (totalMarks / subjectCount).toFixed(1) : 'N/A';

                        // Calculate division based on aggregates
                        const getDivision = (totalAggs: number) => {
                          if (totalAggs <= 8) return "DIV I";
                          if (totalAggs <= 16) return "DIV II";
                          if (totalAggs <= 24) return "DIV III";
                          if (totalAggs <= 32) return "DIV IV";
                          return "DIV U";
                        };

                        const division = subjectCount > 0 ? getDivision(totalAggregates) : 'N/A';

                        // Format date without year
                        const examDate = examData.startDate ? formatDateWithoutYear(examData.startDate) : 'N/A';

                        // Get subject results for expandable table
                        const subjectResults: Array<{ code: string; name: string; marks: number; grade: string; aggregates: number }> = [];
                        if (examResult.results && examResult.results[pupilId || ''] && examResult.subjectSnapshots) {
                          const results = examResult.results[pupilId || ''];
                          examResult.subjectSnapshots.forEach((subject: any) => {
                            const result = results[subject.subjectId];
                            if (result && result.marks !== undefined) {
                              subjectResults.push({
                                code: subject.code || subject.subjectCode || '',
                                name: subject.name || subject.subjectName || '',
                                marks: result.marks || 0,
                                grade: result.grade || 'F9',
                                aggregates: result.aggregates || 0
                              });
                            }
                          });
                        }

                        const isExpanded = expandedExamIds.has(examResult.id);

                        return (
                          <div
                            key={examResult.id}
                            className="block p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors"
                          >
                            <div className="space-y-2">
                              {/* Line 1: Exam Name */}
                              <div className="flex items-center justify-between">
                                <Link
                                  href={`/exams/${examData.id}/pupil-results/${pupilId}?classId=${examData.classId}`}
                                  className="flex-1"
                                >
                                  <h4 className="font-medium text-primary text-sm">{examData.name}</h4>
                                </Link>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedExamId(examData.id);
                                    setSelectedExamResultId(examResult.id);
                                    setShowPrintModal(true);
                                  }}
                                  className="h-8 w-8 p-0"
                                  title="Print Report"
                                  aria-label="Print Report"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* Line 2: Date and Class Code */}
                              <div className="text-xs text-muted-foreground flex items-center gap-3">
                                <span className="flex items-center">
                                  <CalendarDays className="mr-1 h-3 w-3" /> {examDate}
                                </span>
                                <span className="flex items-center">
                                  <GraduationCap className="mr-1 h-3 w-3" /> {pupilData.classCodeAtExam || pupilData.classNameAtExam || 'N/A'}
                                </span>
                              </div>

                              {/* Line 3: Total, Avg, Division with Arrow */}
                              {subjectCount > 0 ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs">Total: {totalMarks}</span>
                                  <span className="text-xs">Avg: {averageMarks}%</span>
                                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${division === "DIV I" ? "bg-green-100 text-green-800" :
                                    division === "DIV II" ? "bg-blue-100 text-blue-800" :
                                      division === "DIV III" ? "bg-yellow-100 text-yellow-800" :
                                        division === "DIV IV" ? "bg-orange-100 text-orange-800" :
                                          "bg-red-100 text-red-800"
                                    }`}>
                                    {division} ({totalAggregates})
                                  </span>
                                  {subjectResults.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setExpandedExamIds(prev => {
                                          const newSet = new Set(prev);
                                          if (newSet.has(examResult.id)) {
                                            newSet.delete(examResult.id);
                                          } else {
                                            newSet.add(examResult.id);
                                          }
                                          return newSet;
                                        });
                                      }}
                                      className="text-muted-foreground hover:text-foreground transition-colors"
                                      title={isExpanded ? 'Hide subjects' : 'Show subjects'}
                                    >
                                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs w-fit">View Results</Badge>
                              )}

                              {/* Expandable Subject Marks Table */}
                              {isExpanded && subjectResults.length > 0 && (
                                <div className="mt-2 pt-2 border-t">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left py-1 px-2 font-medium">Subject</th>
                                        <th className="text-center py-1 px-2 font-medium">Marks</th>
                                        <th className="text-center py-1 px-2 font-medium">Grade</th>
                                        <th className="text-center py-1 px-2 font-medium">Agg</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {subjectResults.map((subject, idx) => (
                                        <tr key={idx} className="border-b last:border-b-0">
                                          <td className="py-1 px-2">{subject.code || subject.name}</td>
                                          <td className="text-center py-1 px-2">{subject.marks}</td>
                                          <td className="text-center py-1 px-2 font-medium">{subject.grade}</td>
                                          <td className="text-center py-1 px-2">{subject.aggregates || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
              )}
            </Card>

            {/* Change House Modal */}
            <ModernDialog open={isHouseChangeOpen} onOpenChange={setIsHouseChangeOpen}>
              <ModernDialogContent>
                <ModernDialogHeader>
                  <ModernDialogTitle>Change House</ModernDialogTitle>
                  <ModernDialogDescription>
                    Select a house for {formatPupilDisplayName(pupil)}. Choose "None" to clear.
                  </ModernDialogDescription>
                </ModernDialogHeader>
                <div className="space-y-3">
                  <Label>House</Label>
                  <Select
                    value={selectedHouseId || 'none'}
                    onValueChange={(value) => setSelectedHouseId(value === 'none' ? '' : value)}
                    disabled={housesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select house" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {houses.map(h => (
                        <SelectItem key={h.id} value={h.id}>
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: h.themeColor }} />
                            <span>{h.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ModernDialogFooter>
                  <Button variant="outline" onClick={() => setIsHouseChangeOpen(false)}>Cancel</Button>
                  <Button
                    onClick={async () => {
                      if (!pupil) return;
                      try {
                        await updatePupilMutation.mutateAsync({
                          id: pupil.id,
                          data: { houseId: selectedHouseId || undefined },
                        });
                        toast({ title: "House updated" });
                        setIsHouseChangeOpen(false);
                      } catch (e) {
                        toast({ variant: "destructive", title: "Failed to update house" });
                      }
                    }}
                  >
                    Save
                  </Button>
                </ModernDialogFooter>
              </ModernDialogContent>
            </ModernDialog>

            {/* Family Account & Siblings Modal */}
            <ModernDialog open={isFamilyModalOpen} onOpenChange={setIsFamilyModalOpen}>
              <ModernDialogContent className="max-w-md">
                <ModernDialogHeader>
                  <ModernDialogTitle className="flex items-center gap-2">
                    <GuardianIconLucide className="h-5 w-5 text-teal-600" />
                    Family Account Options
                  </ModernDialogTitle>
                  <ModernDialogDescription>
                    Choose whether to view the combined family account or navigate to a sibling's fee collection.
                  </ModernDialogDescription>
                </ModernDialogHeader>

                <div className="space-y-4 py-3">
                  {/* Family Account Link Button */}
                  <Link
                    href={`/fees/family/${pupil?.familyId}`}
                    onClick={() => setIsFamilyModalOpen(false)}
                    className="flex items-center justify-between p-4 rounded-xl border border-teal-100 bg-teal-50/50 hover:bg-teal-50 hover:border-teal-200 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-teal-100 text-teal-700">
                        <GuardianIconLucide className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm text-teal-900">View Family Account</p>
                        <p className="text-xs text-teal-700/80">Combined school fees statement for all siblings</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-teal-500 group-hover:translate-x-1 transition-transform" />
                  </Link>

                  {/* Sibling Fees Links */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Sibling Fees Collection</p>
                    <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                      {actualSiblings.map((sibling) => (
                        <Link
                          key={sibling.id}
                          href={`/fees/collect?pupilId=${sibling.id}`}
                          onClick={() => setIsFamilyModalOpen(false)}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-all group"
                        >
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 border">
                              <AvatarImage
                                src={sibling.photo && sibling.photo.trim() !== '' ? sibling.photo : undefined}
                                alt={`${sibling.firstName} ${sibling.lastName}`}
                              />
                              <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                                {sibling.firstName?.[0] || 'S'}{sibling.lastName?.[0] || 'S'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-left">
                              <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                                {sibling.firstName} {sibling.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {getClassCode(sibling.classId, classes)} • {sibling.admissionNumber}
                              </p>
                            </div>
                          </div>
                          <span className="font-bold text-xs text-muted-foreground group-hover:text-emerald-600 transition-colors">Shs.</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <ModernDialogFooter>
                  <Button variant="outline" onClick={() => setIsFamilyModalOpen(false)} className="w-full">
                    Close
                  </Button>
                </ModernDialogFooter>
              </ModernDialogContent>
            </ModernDialog>

          </div>

          <div className="xl:col-span-2 space-y-4 lg:space-y-6">
            <Card className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg lg:text-xl"><AcademicIcon className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-primary" /> Academic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <DetailItem
                  key="class"
                  label="Current Class"
                  value={
                    !isEditMode && pupil.classId ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-primary hover:underline font-medium cursor-pointer text-right">
                            {pupilWithClass?.className || getClassNameMemo(pupil.classId)}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Class Options</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push(`/class-detail?id=${pupil.classId}`)}>
                            <Settings className="mr-2 h-4 w-4 text-blue-600" />
                            View Class Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handlePupilClassChange}>
                            <Edit className="mr-2 h-4 w-4 text-orange-600" />
                            Change Class
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      pupilWithClass?.className || getClassNameMemo(pupil.classId)
                    )
                  }
                  isEditMode={isEditMode}
                  fieldName="classId"
                  onValueChange={(value) => {
                    const selectedClass = classes.find(c => c.id === value);
                    setEditableFields(prev => ({
                      ...prev,
                      classId: value,
                      className: selectedClass?.name || ''
                    }));
                  }}
                  inputType="select"
                  selectOptions={classes.map(c => ({ value: c.id, label: c.name }))}
                />
                <DetailItem
                  key="section"
                  label="Section"
                  value={isEditMode ? (editableFields.section || pupil?.section || '') : pupil.section}
                  isEditMode={isEditMode}
                  fieldName="section"
                  onValueChange={(value) => setEditableFields(prev => ({ ...prev, section: value as Pupil['section'] }))}
                  inputType="select"
                  selectOptions={PUPIL_SECTIONS.filter(s => s).map(s => ({ value: s, label: `${s} Scholar` }))}
                />
                <DetailItem
                  key="status"
                  label="Status"
                  value={isEditMode ? (editableFields.status || pupil?.status || '') : pupil.status}
                  isEditMode={isEditMode}
                  fieldName="status"
                  onValueChange={(value) => setEditableFields(prev => ({ ...prev, status: value as Pupil['status'] }))}
                  inputType="select"
                  selectOptions={PUPIL_STATUSES.filter(s => s).map(s => ({ value: s, label: s }))}
                />
                {academicIdentifiers.map((ident, index) => (
                  <DetailItem key={`acad-id-${index}`} label={ident.customIdName || ident.idType} value={ident.idValue} />
                ))}
                {/* Display old LIN from root if no additional LIN present and it exists */}
                {pupil.learnerIdentificationNumber && !academicIdentifiers.some(id => id.idType === 'LIN') && (
                  <DetailItem key="lin-legacy" label="Learner ID (LIN)" value={pupil.learnerIdentificationNumber} />
                )}
                <DetailItem
                  key="prevschool"
                  label="Previous School"
                  value={isEditMode ? editableFields.previousSchool : pupil.previousSchool}
                  isEditMode={isEditMode}
                  fieldName="previousSchool"
                  onValueChange={(value) => setEditableFields(prev => ({ ...prev, previousSchool: value }))}
                />
              </CardContent>
            </Card>

            <Card className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg lg:text-xl">
                  <span className="flex items-center">
                    <GuardianIconLucide className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                    Guardian Information
                    {isEditMode && (
                      <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-600 border-blue-200">
                        <Edit className="mr-1 h-3 w-3" />
                        Editing
                      </Badge>
                    )}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(isEditMode ? editableGuardians : (pupil.guardians || [])).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(isEditMode ? editableGuardians : pupil.guardians || []).map((guardian, index) => (
                    <div key={guardian.id || index} className="p-2 px-3 rounded-md border bg-muted/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="font-semibold text-sm lg:text-md text-foreground flex flex-wrap items-center gap-2">
                          {isEditMode ? (
                            <>
                              <Input
                                value={editableGuardians[index]?.firstName || ''}
                                onChange={(e) => {
                                  const updated = [...editableGuardians];
                                  updated[index] = { ...updated[index], firstName: e.target.value };
                                  setEditableGuardians(updated);
                                }}
                                placeholder="First Name"
                                className="w-32 text-sm"
                              />
                              <Input
                                value={editableGuardians[index]?.lastName || ''}
                                onChange={(e) => {
                                  const updated = [...editableGuardians];
                                  updated[index] = { ...updated[index], lastName: e.target.value };
                                  setEditableGuardians(updated);
                                }}
                                placeholder="Last Name"
                                className="w-32 text-sm"
                              />
                            </>
                          ) : (
                            <>{guardian.firstName} {guardian.lastName}</>
                          )}
                          {isEditMode ? (
                            <Select
                              value={editableGuardians[index]?.relationship || ''}
                              onValueChange={(value) => {
                                const updated = [...editableGuardians];
                                updated[index] = { ...updated[index], relationship: value };
                                setEditableGuardians(updated);
                              }}
                            >
                              <SelectTrigger className="w-40 h-7 text-xs">
                                <SelectValue placeholder="Relationship" />
                              </SelectTrigger>
                              <SelectContent>
                                {GUARDIAN_RELATIONSHIPS.filter(r => r).map(rel => (
                                  <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="text-xs">{guardian.relationship}</Badge>
                          )}
                        </h4>
                        {isEditMode && editableGuardians.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditableGuardians(editableGuardians.filter((_, i) => i !== index));
                            }}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-0.5 text-xs">
                        <DetailItem
                          key={`guardian-${index}-phone`}
                          icon={<Phone />}
                          label="Primary Phone"
                          value={isEditMode ? (editableGuardians[index]?.phone || '') : (guardian.phone ? (
                            <a
                              href={`tel:${guardian.phone}`}
                              className="text-primary hover:underline font-medium cursor-pointer"
                            >
                              {guardian.phone}
                            </a>
                          ) : guardian.phone)}
                          isEditMode={isEditMode}
                          fieldName={`guardian-${index}-phone`}
                          onValueChange={(value) => {
                            const updated = [...editableGuardians];
                            updated[index] = { ...updated[index], phone: value };
                            setEditableGuardians(updated);
                          }}
                          compact={true}
                        />
                        <DetailItem
                          key={`guardian-${index}-secondary-phone`}
                          icon={<Phone />}
                          label="Secondary Phone"
                          value={isEditMode ? (editableGuardians[index]?.secondaryPhone || '') : (guardian.secondaryPhone ? (
                            <a
                              href={`tel:${guardian.secondaryPhone}`}
                              className="text-primary hover:underline font-medium cursor-pointer"
                            >
                              {guardian.secondaryPhone}
                            </a>
                          ) : guardian.secondaryPhone)}
                          isEditMode={isEditMode}
                          fieldName={`guardian-${index}-secondary-phone`}
                          onValueChange={(value) => {
                            const updated = [...editableGuardians];
                            updated[index] = { ...updated[index], secondaryPhone: value };
                            setEditableGuardians(updated);
                          }}
                          compact={true}
                        />
                        <DetailItem
                          key={`guardian-${index}-email`}
                          icon={<Mail />}
                          label="Email"
                          value={isEditMode ? (editableGuardians[index]?.email || '') : guardian.email}
                          isEditMode={isEditMode}
                          fieldName={`guardian-${index}-email`}
                          onValueChange={(value) => {
                            const updated = [...editableGuardians];
                            updated[index] = { ...updated[index], email: value };
                            setEditableGuardians(updated);
                          }}
                          compact={true}
                        />
                        <DetailItem
                          key={`guardian-${index}-occupation`}
                          icon={<Briefcase />}
                          label="Occupation"
                          value={isEditMode ? (editableGuardians[index]?.occupation || '') : guardian.occupation}
                          isEditMode={isEditMode}
                          fieldName={`guardian-${index}-occupation`}
                          onValueChange={(value) => {
                            const updated = [...editableGuardians];
                            updated[index] = { ...updated[index], occupation: value };
                            setEditableGuardians(updated);
                          }}
                          compact={true}
                        />
                        <DetailItem
                          key={`guardian-${index}-address`}
                          icon={<Home />}
                          label="Address"
                          value={isEditMode ? (editableGuardians[index]?.address || '') : guardian.address}
                          isEditMode={isEditMode}
                          fieldName={`guardian-${index}-address`}
                          onValueChange={(value) => {
                            const updated = [...editableGuardians];
                            updated[index] = { ...updated[index], address: value };
                            setEditableGuardians(updated);
                          }}
                          multiline={true}
                          inputType="textarea"
                          compact={true}
                        />
                        <DetailItem
                          key={`guardian-${index}-nationalId`}
                          label="National ID"
                          value={isEditMode ? (editableGuardians[index]?.nationalId || '') : guardian.nationalId}
                          isEditMode={isEditMode}
                          fieldName={`guardian-${index}-nationalId`}
                          onValueChange={(value) => {
                            const updated = [...editableGuardians];
                            updated[index] = { ...updated[index], nationalId: value };
                            setEditableGuardians(updated);
                          }}
                          compact={true}
                        />
                      </div>
                    </div>
                  ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground text-sm mb-3">No guardian information available.</p>
                    {isEditMode ? (
                      <Button
                        onClick={() => {
                          setEditableGuardians([...editableGuardians, {
                            id: `g-${Date.now()}`,
                            firstName: '',
                            lastName: '',
                            relationship: '',
                            phone: '',
                            secondaryPhone: '',
                            email: '',
                            occupation: '',
                            address: '',
                            nationalId: ''
                          }]);
                        }}
                        variant="outline"
                        size="sm"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Guardian
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">Click on "Guardian Information" heading above to add a guardian</p>
                    )}
                  </div>
                )}
                {isEditMode && editableGuardians.length > 0 && (
                  <Button
                    onClick={() => {
                      setEditableGuardians([...editableGuardians, {
                        id: `g-${Date.now()}`,
                        firstName: '',
                        lastName: '',
                        relationship: '',
                        phone: '',
                        secondaryPhone: '',
                        email: '',
                        occupation: '',
                        address: '',
                        nationalId: ''
                      }]);
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Another Guardian
                  </Button>
                )}
              </CardContent>
            </Card>

            {(emergencyContactGuardian || pupil.bloodType || pupil.medicalConditions || pupil.allergies || pupil.medications) && (
              <Card className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg lg:text-xl"><HeartPulse className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-primary" /> Medical Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0.5 text-xs">
                  {emergencyContactGuardian && (
                    <DetailItem
                      key="emergency"
                      label="Emergency Contact"
                      value={
                        <span>
                          {emergencyContactGuardian.firstName} {emergencyContactGuardian.lastName} ({emergencyContactGuardian.relationship}) - Ph: {
                            emergencyContactGuardian.phone ? (
                              <a
                                href={`tel:${emergencyContactGuardian.phone}`}
                                className="text-primary hover:underline font-medium cursor-pointer"
                              >
                                {emergencyContactGuardian.phone}
                              </a>
                            ) : (
                              emergencyContactGuardian.phone
                            )
                          }
                        </span>
                      }
                      highlight
                      compact={true}
                    />
                  )}
                  <DetailItem key="bloodtype" label="Blood Type" value={pupil.bloodType} compact={true} />
                  <DetailItem key="conditions" label="Known Medical Conditions" value={pupil.medicalConditions} multiline compact={true} />
                  <DetailItem key="allergies" label="Allergies" value={pupil.allergies} multiline compact={true} />
                  <DetailItem key="medications" label="Current Medications" value={pupil.medications} multiline compact={true} />
                </CardContent>
              </Card>
            )}

            {/* Status Change History */}
            {pupil.statusChangeHistory && pupil.statusChangeHistory.length > 0 && (
              <Card className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg lg:text-xl">
                    <Shield className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-orange-600" />
                    Status Change History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pupil.statusChangeHistory
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((entry, index) => (
                      <div key={index} className="p-2 px-3 rounded-md border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-xs">
                        <div className="flex flex-row items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-orange-100 text-orange-800 border-orange-300">
                              {entry.fromStatus} → {entry.toStatus}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground flex items-center">
                              <Clock className="mr-1 h-3 w-3" />
                              {formatDate(entry.date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                            {entry.reason && (
                              <span className="truncate">Reason: {entry.reason}</span>
                            )}
                            {entry.processedBy && (
                              <span className="shrink-0 text-gray-500">By: {entry.processedBy}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}

            {/* Promotion History */}
            {pupil.promotionHistory && pupil.promotionHistory.length > 0 && (
              <Card className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg lg:text-xl">
                    <GraduationCap className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
                    Class Changes & Promotions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pupil.promotionHistory
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((entry, index) => (
                      <div key={index} className="p-2 px-3 rounded-md border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-xs">
                        <div className="flex flex-row items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center">
                              {entry.type === 'Promotion' && <TrendingUp className="mr-1 h-3 w-3 text-green-600" />}
                              {entry.type === 'Demotion' && <TrendingDown className="mr-1 h-3 w-3 text-red-600" />}
                              {entry.type === 'Graduation' && <GraduationCap className="mr-1 h-3 w-3 text-yellow-600" />}
                              {(entry.type === 'Transfer' || entry.type === 'Initial Placement') && <ArrowRight className="mr-1 h-3 w-3 text-blue-600" />}
                              <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${
                                entry.type === 'Promotion' ? 'bg-green-100 text-green-800 border-green-300' :
                                entry.type === 'Demotion' ? 'bg-red-100 text-red-800 border-red-300' :
                                entry.type === 'Graduation' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                'bg-blue-100 text-blue-800 border-blue-300'
                              }`}>
                                {entry.type}
                              </Badge>
                            </div>
                            <span className="text-[11px] text-muted-foreground flex items-center">
                              <Clock className="mr-1 h-3 w-3" />
                              {formatDate(entry.date)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-[11px] font-medium text-gray-800 dark:text-gray-200 overflow-hidden text-ellipsis whitespace-nowrap">
                            {entry.type === 'Graduation' ? (
                              <div className="flex items-center gap-2">
                                <span className="text-yellow-700">Graduated from {entry.fromClassName || 'N/A'}</span>
                                {entry.graduationYear && entry.toClassId && (
                                  <Link
                                    href={`/classes/graduates/${entry.toClassId}`}
                                    className="text-[10px] text-yellow-600 hover:text-yellow-700 underline flex items-center gap-0.5 shrink-0"
                                  >
                                    <Award className="h-2.5 w-2.5" />
                                    Class of {entry.graduationYear}
                                  </Link>
                                )}
                              </div>
                            ) : (
                              <span>
                                {entry.fromClassName || 'N/A'} → {entry.toClassName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Fees Section - HIDDEN per user request */}
        {/* <div className="space-y-6">
            <Card className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Receipt className="mr-3 h-6 w-6 text-green-600" />
                  Fee Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Fee Management</h3>
                  <p className="text-gray-600 mb-4">
                    View and manage {pupil.firstName}'s fee information, payments, and outstanding balances.
                  </p>
                  <Button className="bg-green-600 hover:bg-green-700">
                    View Fee Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div> */}

        {/* Requirements Section - HIDDEN per user request */}
        {/* <div className="space-y-6">
            <Card className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Shirt className="mr-3 h-6 w-6 text-purple-600" />
                  Requirements & Uniforms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Shirt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Requirements Tracking</h3>
                  <p className="text-gray-600 mb-4">
                    Track {pupil.firstName}'s uniform requirements, books, and other school supplies.
                  </p>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    View Requirements
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div> */}

        {/* Attendance Section - HIDDEN per user request */}
        {/* <div className="space-y-6">
            <Card className="shadow-lg" style={{ borderLeft: currentHouse?.themeColor ? `4px solid ${currentHouse.themeColor}` : undefined }}>
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <BarChart3 className="mr-3 h-6 w-6 text-orange-600" />
                  Attendance Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Attendance Tracking</h3>
                  <p className="text-gray-600 mb-4">
                    View {pupil.firstName}'s attendance records, patterns, and statistics.
                  </p>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    View Attendance
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div> */}

        {/* Results Section - HIDDEN per user request */}
        {/* <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <BookOpen className="mr-3 h-6 w-6 text-indigo-600" />
                  Examination Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pupilExamHistory && pupilExamHistory.examResults && pupilExamHistory.examResults.length > 0 ? (
                  <div className="space-y-4">
                    {pupilExamHistory.examResults.slice(0, 5).map((examResult: any) => (
                      <div key={examResult.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">Exam Result</h4>
                            <p className="text-sm text-gray-600">Result ID: {examResult.id}</p>
                          </div>
                          <Badge variant="outline">View Results</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
                    <p className="text-gray-600 mb-4">
                      {pupil.firstName} hasn't taken any exams yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div> */}
      </div>

      {/* Status Change Modal */}
      <ModernDialog open={isStatusChangeModalOpen} onOpenChange={(open) => !open && setIsStatusChangeModalOpen(false)}>
        <ModernDialogContent size="md" open={isStatusChangeModalOpen} onOpenChange={(open) => !open && setIsStatusChangeModalOpen(false)}>
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5 text-orange-600" />
              Change Pupil Status
            </ModernDialogTitle>
            <ModernDialogDescription>
              Change {formatPupilDisplayName(pupil)}'s status from <strong>{pupil.status}</strong> to a new status.
            </ModernDialogDescription>
          </ModernDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status-select">New Status</Label>
              <Select value={selectedStatus} onValueChange={handleStatusSelection}>
                <SelectTrigger id="status-select">
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Graduated">Graduated</SelectItem>
                  <SelectItem value="Transferred">Transferred</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                  <SelectItem value="Withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showClassSelection && (
              <div className="space-y-2">
                <Label htmlFor="class-select">Class Assignment</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger id="class-select">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={pupil.classId || ''}>Keep Current Class ({pupilWithClass?.className || getClassNameMemo(pupil.classId)})</SelectItem>
                    {classes
                      .filter(cls => cls.id !== pupil.classId)
                      .map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>
                          Change to {cls.name}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Since you're changing the status to Active, you can choose to keep the current class or move to a different class.
                </p>
              </div>
            )}
          </div>

          <ModernDialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsStatusChangeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStatusChange}
              disabled={!selectedStatus || updatePupilMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {updatePupilMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Update Status
                </>
              )}
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>

      <ManageIdCodesModal
        isOpen={isManageIdCodesModalOpen}
        onClose={() => setIsManageIdCodesModalOpen(false)}
        onSave={handleSaveIdCodes}
        existingIdentifiers={pupil.additionalIdentifiers || []}
        pupilName={formatPupilDisplayName(pupil)}
      />

      <AssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        pupil={pupil}
        onSave={handleSaveAssignments}
      />

      {/* Class Change Modal */}
      <ModernDialog open={classChangeModal.isOpen} onOpenChange={(isOpen) => setClassChangeModal({ isOpen })}>
        <ModernDialogContent>
          <ModernDialogHeader>
            <ModernDialogTitle>Change Class</ModernDialogTitle>
            <ModernDialogDescription>
              Select a new class for {pupil.firstName} {pupil.lastName}
            </ModernDialogDescription>
          </ModernDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-class">New Class</Label>
              <Select
                value={selectedNewClassId}
                onValueChange={setSelectedNewClassId}
              >
                <SelectTrigger id="new-class">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Current Class: <span className="font-medium text-foreground">{pupilWithClass?.className || getClassNameMemo(pupil.classId)}</span></p>
              {selectedNewClassId && selectedNewClassId !== pupil.classId && (
                <p className="mt-1">New Class: <span className="font-medium text-primary">{getClassNameMemo(selectedNewClassId)}</span></p>
              )}
            </div>
          </div>
          <ModernDialogFooter>
            <Button
              variant="outline"
              onClick={() => setClassChangeModal({ isOpen: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmClassChange}
              disabled={!selectedNewClassId || selectedNewClassId === pupil.classId}
            >
              Confirm Change
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>

      {/* Guardians Edit Modal */}
      <ModernDialog open={isEditGuardiansModalOpen} onOpenChange={setIsEditGuardiansModalOpen}>
        <ModernDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <ModernDialogHeader>
            <ModernDialogTitle>Edit Guardian Information</ModernDialogTitle>
            <ModernDialogDescription>
              Update guardian details for {pupil.firstName} {pupil.lastName}. You can edit existing guardians or add a secondary guardian.
            </ModernDialogDescription>
          </ModernDialogHeader>
          <div className="space-y-6 py-4">
            {editingGuardians.map((guardian, index) => (
              <div key={guardian.id || index} className="p-4 border border-border rounded-lg bg-muted/20 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-base">
                    {guardian.firstName || guardian.lastName ? `${guardian.firstName} ${guardian.lastName}` : `Guardian ${index + 1}`}
                  </h3>
                  {editingGuardians.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveGuardian(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`guardian-${index}-firstName`}>First Name *</Label>
                    <input
                      id={`guardian-${index}-firstName`}
                      type="text"
                      value={guardian.firstName || ''}
                      onChange={(e) => handleUpdateGuardian(index, 'firstName', e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`guardian-${index}-lastName`}>Last Name *</Label>
                    <input
                      id={`guardian-${index}-lastName`}
                      type="text"
                      value={guardian.lastName || ''}
                      onChange={(e) => handleUpdateGuardian(index, 'lastName', e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`guardian-${index}-relationship`}>Relationship *</Label>
                  <Select
                    value={guardian.relationship || ''}
                    onValueChange={(value) => handleUpdateGuardian(index, 'relationship', value)}
                  >
                    <SelectTrigger id={`guardian-${index}-relationship`}>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Father">Father</SelectItem>
                      <SelectItem value="Mother">Mother</SelectItem>
                      <SelectItem value="Guardian">Guardian</SelectItem>
                      <SelectItem value="Uncle">Uncle</SelectItem>
                      <SelectItem value="Aunt">Aunt</SelectItem>
                      <SelectItem value="Grandparent">Grandparent</SelectItem>
                      <SelectItem value="Sibling">Sibling</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`guardian-${index}-phone`}>Primary Phone *</Label>
                    <input
                      id={`guardian-${index}-phone`}
                      type="tel"
                      value={guardian.phone || ''}
                      onChange={(e) => handleUpdateGuardian(index, 'phone', e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                      placeholder="Primary phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`guardian-${index}-secondaryPhone`}>Secondary Phone</Label>
                    <input
                      id={`guardian-${index}-secondaryPhone`}
                      type="tel"
                      value={guardian.secondaryPhone || ''}
                      onChange={(e) => handleUpdateGuardian(index, 'secondaryPhone', e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                      placeholder="Secondary phone number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`guardian-${index}-email`}>Email</Label>
                  <input
                    id={`guardian-${index}-email`}
                    type="email"
                    value={guardian.email || ''}
                    onChange={(e) => handleUpdateGuardian(index, 'email', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                    placeholder="Email address"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`guardian-${index}-occupation`}>Occupation</Label>
                    <input
                      id={`guardian-${index}-occupation`}
                      type="text"
                      value={guardian.occupation || ''}
                      onChange={(e) => handleUpdateGuardian(index, 'occupation', e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                      placeholder="Occupation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`guardian-${index}-nationalId`}>National ID</Label>
                    <input
                      id={`guardian-${index}-nationalId`}
                      type="text"
                      value={guardian.nationalId || ''}
                      onChange={(e) => handleUpdateGuardian(index, 'nationalId', e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                      placeholder="National ID number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`guardian-${index}-address`}>Address</Label>
                  <textarea
                    id={`guardian-${index}-address`}
                    value={guardian.address || ''}
                    onChange={(e) => handleUpdateGuardian(index, 'address', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground min-h-[60px]"
                    placeholder="Full address"
                  />
                </div>
              </div>
            ))}

            {editingGuardians.length < 2 && (
              <Button
                variant="outline"
                onClick={handleAddSecondaryGuardian}
                className="w-full border-dashed"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Secondary Guardian
              </Button>
            )}
          </div>
          <ModernDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditGuardiansModalOpen(false);
                setEditingGuardians([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveGuardians}
            >
              Save Changes
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>

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

      {/* Individual report options */}
      <IndividualReportPrintDialog
        isOpen={showPrintModal}
        onClose={() => {
          // Only allow closing if not generating
          if (!isGenerating) {
            setShowPrintModal(false);
            setSelectedExamId(null);
            setSelectedExamResultId(null);
          }
        }}
        onPrintMini={handleMiniReport}
        onPrintFull={handleFullReport}
        onPrintFullReport2={handleFullReport2}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
        generationProgress={generationProgress}
        eta={eta}
        pupilName={pupil ? formatPupilDisplayName(pupil) : undefined}
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

      {/* Manage Pay Code Modal */}
      <ManagePayCodeModal
        isOpen={isManagePayCodeModalOpen}
        onClose={() => setIsManagePayCodeModalOpen(false)}
        onSave={handleSavePayCode}
        currentPayCode={
          getSchoolPayCode(pupil) || null
        }
        pupilName={pupil ? `${pupil.firstName} ${pupil.lastName}` : ''}
      />
    </>
  );
}

export default function PupilDetailPage() {
  return (
    <Suspense fallback={
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Loading Pupil Details..." />
        <Card>
          <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center"> <Skeleton className="h-32 w-32 rounded-full" /></div>
            <Skeleton className="h-6 w-1/2 mx-auto mt-2" /> <Skeleton className="h-4 w-1/3 mx-auto" />
            <div className="mt-4 space-y-2"> <Skeleton className="h-4 w-full" /> <Skeleton className="h-4 w-2/3" /> <Skeleton className="h-4 w-full" /> </div>
          </CardContent>
        </Card>
      </div>
    }>
      <PupilDetailContent />
    </Suspense>
  );
} 
