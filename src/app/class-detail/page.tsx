'use client';
import { GlassActionButton, GlassActionDock, GlassPageSearchInput, GlassPageTopBar } from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";

import React, { Suspense } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DetailItem } from '@/components/common/detail-item';
import { useClassDetail } from '@/lib/hooks/use-class-detail';
import { useExamsByClass } from '@/lib/hooks/use-exams';
import { useActiveAcademicYear, useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useTerms } from '@/lib/hooks/use-terms';
import { useStaff } from '@/lib/hooks/use-staff';
import { useSubjectsByClass, useSubjects } from '@/lib/hooks/use-subjects';
import { useActivePupilsByClass, usePupilsByStatus, usePupilPhotos, usePupils } from '@/lib/hooks/use-pupils';
import { useUpdateClass } from '@/lib/hooks/use-classes';
import { getCurrentTerm } from '@/lib/utils/academic-year-utils';
import { Pupil, Class, ClassLevel, ClassStream, Staff, SubjectAssignment, AcademicYear, Term } from '@/types';
import { CLASS_LEVELS } from '@/lib/constants';
import {
  ArrowLeft,
  Edit,
  Search,
  Filter,
  AlertTriangle,
  Info,
  Users,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  User,
  Loader2,
  X,
  Crown,
  Award,
  History,
  GraduationCap,
  Clock,
  Save,
  School,
  Book,
  Baby,
  Check,
  FileText,
  List,
  Grid3X3,
  GitBranch,
  LockKeyhole,
  Plus,
  Trash2
} from 'lucide-react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogHeader,
  ModernDialogTitle,
} from "@/components/ui/modern-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PupilRequirementsModal } from "@/components/class/pupil-requirements-modal";
import { ClassRequirementsOverviewModal } from "@/components/class/class-requirements-overview-modal";
import { assertUniqueStreams, getActiveClassStreams, normaliseStreamValue } from '@/lib/utils/class-streams';

// Searchable Pupil Selector Component
function SearchablePupilSelector({
  value,
  onValueChange,
  pupils,
  editingClass,
  disabledIds = [],
  icon: Icon,
  iconClassName,
  buttonClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  pupils: any[];
  editingClass: Class | null;
  disabledIds?: string[];
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const availablePupils = editingClass
    ? pupils.filter((pupil: any) => pupil.classId === editingClass.id && pupil.status === 'Active' && !disabledIds.includes(pupil.id))
    : pupils.filter((pupil: any) => pupil.status === 'Active' && !disabledIds.includes(pupil.id));

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn("h-8 w-8 p-0 rounded-lg border-2 border-amber-300 bg-white hover:border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200 flex-shrink-0", buttonClassName)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <Icon className={cn("h-4 w-4 text-amber-600", iconClassName)} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-0 !z-[100000]"
        align="end"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]')) {
            e.preventDefault();
          }
        }}
      >
        <Command>
          <CommandInput placeholder="Search pupil..." />
          <CommandList>
            <CommandEmpty>No pupils found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={(currentValue) => {
                  if (currentValue === "none") {
                    onValueChange("");
                    setOpen(false);
                  }
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                None
              </CommandItem>
              {availablePupils.map((pupil: any) => {
                const searchValue = `${pupil.firstName} ${pupil.lastName} ${pupil.admissionNumber} ${pupil.className || ''}`;
                const label = editingClass
                  ? `${pupil.firstName} ${pupil.lastName} (${pupil.admissionNumber})`
                  : `${pupil.firstName} ${pupil.lastName} (${pupil.admissionNumber}) - ${pupil.className || 'Unassigned'}`;
                return (
                  <CommandItem
                    key={pupil.id}
                    value={searchValue}
                    onSelect={() => {
                      onValueChange(pupil.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === pupil.id ? "opacity-100" : "opacity-0")} />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Searchable Teacher Selector Component
function SearchableTeacherSelector({
  value,
  onValueChange,
  teachers,
  disabledIds = [],
  allowNone = false,
  icon: Icon,
  iconClassName,
  buttonClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  teachers: any[];
  disabledIds?: string[];
  allowNone?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const availableTeachers = teachers.filter((teacher: any) => !disabledIds.includes(teacher.id));

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn("h-8 w-8 p-0 rounded-lg border-2 border-green-300 bg-white hover:border-green-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-200 flex-shrink-0", buttonClassName)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <Icon className={cn("h-4 w-4 text-green-600", iconClassName)} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-0 !z-[100000]"
        align="end"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]')) {
            e.preventDefault();
          }
        }}
      >
        <Command>
          <CommandInput placeholder="Search teacher..." />
          <CommandList>
            <CommandEmpty>No teachers found.</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="none"
                  onSelect={(currentValue) => {
                    if (currentValue === "none") {
                      onValueChange("");
                      setOpen(false);
                    }
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  None
                </CommandItem>
              )}
              {availableTeachers.length === 0 && (
                <CommandItem value="no-teachers" disabled>
                  No teaching staff available
                </CommandItem>
              )}
              {availableTeachers.map((teacher: any) => {
                const searchValue = `${teacher.firstName} ${teacher.lastName}`;
                const label = `${teacher.firstName} ${teacher.lastName}`;
                return (
                  <CommandItem
                    key={teacher.id}
                    value={searchValue}
                    onSelect={() => {
                      onValueChange(teacher.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === teacher.id ? "opacity-100" : "opacity-0")} />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Searchable Subject-Teacher Selector Component
function SearchableSubjectTeacherSelector({
  subjectId,
  assignedTeacherIds = [],
  onTeacherToggle,
  teachers,
  buttonClassName,
}: {
  subjectId: string;
  assignedTeacherIds: string[];
  onTeacherToggle: (subjectId: string, teacherId: string, isChecked: boolean) => void;
  teachers: any[];
  buttonClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-7 w-7 p-0 rounded-lg border border-purple-200 bg-white hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 flex-shrink-0", buttonClassName)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <User className="h-3.5 w-3.5 text-purple-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[260px] p-0 !z-[100000]"
        align="end"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]')) {
            e.preventDefault();
          }
        }}
      >
        <Command className="rounded-xl">
          <CommandInput placeholder="Search teacher..." className="h-8 text-xs" />
          <CommandList className="max-h-48">
            <CommandEmpty className="py-2 text-xs text-center text-gray-500">No teachers found.</CommandEmpty>
            <CommandGroup>
              {teachers.length === 0 && (
                <CommandItem value="no-teachers" disabled className="text-xs text-gray-500">
                  No teaching staff available
                </CommandItem>
              )}
              {teachers.map((teacher: any) => {
                const isChecked = assignedTeacherIds.includes(teacher.id);
                const name = `${teacher.firstName} ${teacher.lastName}`;
                return (
                  <CommandItem
                    key={teacher.id}
                    value={name}
                    onSelect={() => {
                      onTeacherToggle(subjectId, teacher.id, !isChecked);
                    }}
                    className="flex items-center gap-2 py-1.5 px-2 text-xs"
                  >
                    <Checkbox
                      checked={isChecked}
                      className="h-3.5 w-3.5 rounded-sm"
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={(checked) => {
                        onTeacherToggle(subjectId, teacher.id, checked === true);
                      }}
                    />
                    <span className="font-medium text-gray-700">{name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Calculate age from date of birth
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

// Pupil Card for tiles view
function PupilCard({
  pupil,
  classDetail,
  isLoadingPhoto = false
}: {
  pupil: Pupil;
  classDetail?: Class;
  isLoadingPhoto?: boolean;
}) {
  const age = pupil.dateOfBirth ? calculateAge(pupil.dateOfBirth) : null;

  const getInitials = () => {
    return `${pupil.firstName.charAt(0)}${pupil.lastName.charAt(0)}`;
  };

  return (
    <Card className="shadow-md hover:shadow-xl transition-all duration-300 border-2 border-primary/10 hover:border-primary/30 group rounded-xl overflow-hidden bg-gradient-to-br from-card via-card to-muted/5 backdrop-blur-sm">
      <CardContent className="p-4">
        {/* Header Section */}
        <div className="flex items-center space-x-3 mb-3">
          <div className="relative">
            <Avatar className={`w-10 h-10 flex-shrink-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 ${isLoadingPhoto ? 'animate-pulse' : ''
              }`}>
              {pupil.photo && pupil.photo.trim() !== '' ? (
                <>
                  <AvatarImage
                    src={pupil.photo}
                    alt={`${pupil.firstName} ${pupil.lastName}`}
                    className={`object-cover transition-opacity duration-500 ${isLoadingPhoto ? 'opacity-30' : 'opacity-100'
                      }`}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {isLoadingPhoto && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-200/50 via-indigo-200/50 to-purple-200/50 animate-pulse">
                      <div className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
                    </div>
                  )}
                </>
              ) : null}
              <AvatarFallback className={`transition-all duration-300 ${isLoadingPhoto
                ? 'bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 text-gray-400 animate-pulse'
                : 'bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground'
                } font-medium text-sm`}>
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            {isLoadingPhoto && (
              <div
                className="absolute -inset-1 rounded-full border-2 border-blue-400 border-dashed animate-spin opacity-50"
                style={{ animationDuration: '2s' }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/pupil-detail?id=${pupil.id}`}
                className="font-semibold text-sm hover:text-primary hover:underline cursor-pointer transition-colors truncate"
                title={`${pupil.firstName} ${pupil.lastName}`}
              >
                {pupil.firstName} {pupil.lastName}
              </Link>
              {classDetail?.classCaptainId === pupil.id && (
                <span title="Class Captain"><Crown className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" /></span>
              )}
              {classDetail?.assistantClassCaptainId === pupil.id && (
                <span title="Assistant Class Captain"><Award className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" /></span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {pupil.admissionNumber}
            </p>
          </div>
        </div>

        {/* Info Grid - No Labels */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          <div className="text-center">
            <Badge variant="outline" className="text-xs px-2.5 py-1 rounded-lg border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              {pupil.section || 'N/A'}
            </Badge>
          </div>
          <div className="text-center">
            <span className="font-medium">{pupil.gender}</span>
          </div>
          <div className="text-center">
            <span className="font-medium">{age ? `${age}y` : 'N/A'}</span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

// Pupil List Row for desktop view
function PupilListRow({
  pupil,
  classDetail,
  isLoadingPhoto = false,
  onOpenRequirements
}: {
  pupil: Pupil;
  classDetail?: Class;
  isLoadingPhoto?: boolean;
  onOpenRequirements?: (pupilId: string) => void;
}) {
  const age = pupil.dateOfBirth ? calculateAge(pupil.dateOfBirth) : null;

  return (
    <tr className="hover:bg-muted/30 transition-colors group">
      <td className="px-3 py-3">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Avatar className={`w-7 h-7 flex-shrink-0 shadow-md hover:shadow-lg transition-all duration-300 ${isLoadingPhoto ? 'animate-pulse' : ''
              }`}>
              {pupil.photo && pupil.photo.trim() !== '' ? (
                <>
                  <AvatarImage
                    src={pupil.photo}
                    alt={`${pupil.firstName} ${pupil.lastName}`}
                    className={`object-cover transition-opacity duration-500 ${isLoadingPhoto ? 'opacity-30' : 'opacity-100'
                      }`}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {isLoadingPhoto && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-200/50 via-indigo-200/50 to-purple-200/50 animate-pulse">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
                    </div>
                  )}
                </>
              ) : null}
              <AvatarFallback className={`transition-all duration-300 ${isLoadingPhoto
                ? 'bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 text-gray-400 animate-pulse'
                : 'bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground'
                } font-medium text-xs`}>
                {pupil.firstName.charAt(0)}{pupil.lastName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            {isLoadingPhoto && (
              <div
                className="absolute -inset-0.5 rounded-full border border-blue-400 border-dashed animate-spin opacity-50"
                style={{ animationDuration: '2s' }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/pupil-detail?id=${pupil.id}`}
                className="font-medium text-sm truncate hover:text-primary hover:underline cursor-pointer transition-colors"
              >
                {pupil.firstName} {pupil.lastName}
              </Link>
              {classDetail?.classCaptainId === pupil.id && (
                <span title="Class Captain"><Crown className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" /></span>
              )}
              {classDetail?.assistantClassCaptainId === pupil.id && (
                <span title="Assistant Class Captain"><Award className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" /></span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {pupil.admissionNumber}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <Badge variant="outline" className="text-xs px-2.5 py-1 rounded-lg border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          {pupil.section || 'N/A'}
        </Badge>
      </td>
      <td className="px-3 py-3 text-xs font-medium">{pupil.gender}</td>
      <td className="px-3 py-3 text-xs font-medium">{age ? `${age}y` : 'N/A'}</td>
      <td className="px-3 py-3">
        {onOpenRequirements && (
          <Button
            onClick={() => onOpenRequirements(pupil.id)}
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2"
          >
            <FileText className="w-3 h-3 mr-1" />
            Open
          </Button>
        )}
      </td>
    </tr>
  );
}

function PupilRosterTable({
  pupils,
  classDetail,
  photosLoading,
  onOpenRequirements,
  sortBy,
  sortOrder,
  onSort,
}: {
  pupils: Pupil[];
  classDetail: Class;
  photosLoading: boolean;
  onOpenRequirements: (pupilId: string) => void;
  sortBy: 'name' | 'section' | 'gender' | 'age';
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'name' | 'section' | 'gender' | 'age') => void;
}) {
  const header = (field: 'name' | 'section' | 'gender' | 'age', label: string) => (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span>{label}</span>
      {sortBy === field ? <span className="font-bold text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span> : null}
    </button>
  );

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 border-b-2 border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-muted/30 backdrop-blur-sm">
        <tr>
          <th className="w-1/2 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">{header('name', 'Pupil Details')}</th>
          <th className="w-20 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">{header('section', 'Section')}</th>
          <th className="w-16 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">{header('gender', 'Gender')}</th>
          <th className="w-12 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">{header('age', 'Age')}</th>
          <th className="w-24 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1 px-2 py-1"><FileText className="h-3 w-3" /> Requirements</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/30">
        {pupils.map(pupil => (
          <PupilListRow
            key={pupil.id}
            pupil={pupil}
            classDetail={classDetail}
            isLoadingPhoto={photosLoading && !pupil.photo}
            onOpenRequirements={onOpenRequirements}
          />
        ))}
      </tbody>
    </table>
  );
}

function ClassDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams?.get('id') || null;
  const [showSubjects, setShowSubjects] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'tiles' | 'list'>('list');
  const [sortBy, setSortBy] = React.useState<'name' | 'section' | 'gender' | 'age'>('name');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');

  // Responsive view mode - automatically switch based on screen size
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // Large screens
        setViewMode('list');
      } else { // Small screens
        setViewMode('tiles');
      }
    };
    handleResize(); // Set initial view mode
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // State for exam loading
  const [shouldLoadExams, setShouldLoadExams] = React.useState(false);
  const [showExamsDropdown, setShowExamsDropdown] = React.useState(false);

  // State for subjects loading
  const [shouldLoadSubjects, setShouldLoadSubjects] = React.useState(false);
  const [examFilters, setExamFilters] = React.useState({
    academicYearId: '',
    termId: ''
  });

  // State for filters
  const [filters, setFilters] = React.useState({
    search: '',
    section: 'all',
    status: 'all',
    gender: 'all',
    ageMin: '',
    ageMax: ''
  });

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (filters.section !== 'all') count++;
    if (filters.status !== 'all') count++;
    if (filters.gender !== 'all') count++;
    if (filters.ageMin) count++;
    if (filters.ageMax) count++;
    return count;
  }, [filters]);

  // State for requirements modal
  const [isRequirementsModalOpen, setIsRequirementsModalOpen] = React.useState(false);
  const [selectedPupilIdForRequirements, setSelectedPupilIdForRequirements] = React.useState<string | null>(null);

  // State for class requirements overview modal
  const [isClassRequirementsModalOpen, setIsClassRequirementsModalOpen] = React.useState(false);

  const handleOpenRequirements = (pupilId: string) => {
    setSelectedPupilIdForRequirements(pupilId);
    setIsRequirementsModalOpen(true);
  };

  const handleCloseRequirements = () => {
    setIsRequirementsModalOpen(false);
    setSelectedPupilIdForRequirements(null);
  };

  // 🚀 OPTIMIZED: Fetch data using cache-first strategy
  const { data: classDetail, isLoading: classLoading } = useClassDetail(classId || '');

  // 🚀 REAL-TIME: Use the main usePupils hook which has the Firestore listener
  // This ensures we get real-time updates when pupils are added/removed/changed
  const { data: allPupils = [], isLoading: allPupilsLoading } = usePupils();

  // Filter for ACTIVE pupils in this class on the client side
  // This is instant and keeps the UI in sync with the global pupil state
  const pupilsInClass = React.useMemo(() => {
    if (!classId) return [];
    return allPupils.filter(p => p.classId === classId && p.status === 'Active');
  }, [allPupils, classId]);

  // 🚀 CRITICAL: Only show loading if we don't have cached data
  // If we have cached data (even if stale), show it immediately
  const hasCachedData = (classDetail && pupilsInClass.length > 0);
  // Only consider loading if we really have no data to show
  const isLoading = !hasCachedData && (classLoading || (allPupilsLoading && allPupils.length === 0));

  // Check if this class has any graduated pupils (for showing the Graduated Class button)
  // Only fetch graduated pupils to check if the button should be shown
  const { data: graduatedPupils = [] } = usePupilsByStatus('Graduated');
  const hasGraduates = React.useMemo(() => {
    if (!classId) return false;
    return graduatedPupils.some((pupil: any) =>
      pupil.graduationClassId === classId
    );
  }, [graduatedPupils, classId]);

  // 🚀 CRITICAL: Use flushSync to force immediate DOM update when data arrives
  const [showContent, setShowContent] = React.useState(false);
  React.useEffect(() => {
    // If we have pupils (or if loaded and empty), show content
    if ((pupilsInClass.length > 0 || !isLoading) && !showContent) {
      flushSync(() => {
        setShowContent(true);
      });
    }
  }, [pupilsInClass.length, isLoading, showContent]);

  const { data: allSubjects = [] } = useSubjects();
  const { data: allStaff = [] } = useStaff();
  const updateClassMutation = useUpdateClass();
  const { toast } = useToast();

  // 🚀 OPTIMIZED: Batch fetch all requirement tracking data for the class
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const { data: allAcademicYears = [] } = useAcademicYears();
  const currentTerm = activeAcademicYear ? getCurrentTerm(activeAcademicYear) : null;

  // Filter teaching staff
  const teachingStaff: Staff[] = allStaff.filter((s: Staff) => {
    const hasTeachingDepartment = Array.isArray(s.department)
      ? s.department.includes('Teaching')
      : s.department === 'Teaching';
    const hasTeachingRoles = Array.isArray(s.role) && s.role.some(role =>
      ['TEACHER', 'HEAD TEACHER', 'DEPUTY HEAD TEACHER', 'DIRECTOR OF STUDIES',
        'HEAD OF DEPARTMENT', 'SENIOR TEACHER', 'TEACHING ASSISTANT'].includes(role)
    );
    return hasTeachingDepartment || hasTeachingRoles;
  });

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [className, setClassName] = React.useState("");
  const [classCode, setClassCode] = React.useState("");
  const [level, setLevel] = React.useState<ClassLevel>("Lower Primary");
  const [classOrder, setClassOrder] = React.useState<string>("");
  const [classTeacherId, setClassTeacherId] = React.useState("");
  const [coClassTeacherId, setCoClassTeacherId] = React.useState("");
  const [classCaptainId, setClassCaptainId] = React.useState("");
  const [assistantClassCaptainId, setAssistantClassCaptainId] = React.useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<string[]>([]);
  const [subjectTeacherAssignments, setSubjectTeacherAssignments] = React.useState<Record<string, string[]>>({});
  const [expandedSubjects, setExpandedSubjects] = React.useState<Set<string>>(new Set());
  const [isSubjectAssignmentsOpen, setIsSubjectAssignmentsOpen] = React.useState(false);
  const [streams, setStreams] = React.useState<ClassStream[]>([]);
  const [streamError, setStreamError] = React.useState("");

  const assignedStreamIds = React.useMemo(
    () => new Set(
      allPupils
        .filter(pupil => pupil.classId === classId && pupil.streamId)
        .map(pupil => pupil.streamId as string),
    ),
    [allPupils, classId],
  );

  // 🖼️ OPTIMIZED: Load photos separately after pupils data is loaded
  // Priority: Load photos for visible pupils first (first 30 pupils)
  const pupilIds = React.useMemo(() => pupilsInClass.map(p => p.id), [pupilsInClass]);
  const priorityPhotoIds = React.useMemo(() => {
    // Prioritize first 30 pupils (typically visible on screen)
    return pupilIds.slice(0, 30);
  }, [pupilIds]);

  const { data: pupilPhotosMap = new Map<string, string>(), isLoading: isLoadingPhotos, isFetching: isFetchingPhotos } = usePupilPhotos(pupilIds, {
    priorityIds: priorityPhotoIds,
  });

  // Merge photos into pupils array
  const pupilsInClassWithPhotos = React.useMemo(() => {
    return pupilsInClass.map(pupil => ({
      ...pupil,
      photo: pupil.photo || pupilPhotosMap.get(pupil.id) || undefined
    }));
  }, [pupilsInClass, pupilPhotosMap]);

  // Track if photos are still loading
  const photosLoading = isLoadingPhotos || isFetchingPhotos;

  const { data: classExams = [], isLoading: examsLoading } = useExamsByClass(classId || '', { enabled: shouldLoadExams });
  const { data: classSubjects = [], isLoading: subjectsLoading } = useSubjectsByClass(classId || '', { enabled: shouldLoadSubjects });
  // Reuse activeAcademicYear and allAcademicYears from above (lines 590-591)
  const academicYears = allAcademicYears;
  const { data: terms = [] } = useTerms();

  // Set default exam filters to current term using date-based detection.
  // Avoids relying on the brittle `term.isCurrent` flag which may not be set.
  React.useEffect(() => {
    if (!activeAcademicYear) return;
    const currentTerm = getCurrentTerm(activeAcademicYear);
    if (currentTerm) {
      setExamFilters({
        academicYearId: activeAcademicYear.id,
        termId: currentTerm.id
      });
    }
  }, [activeAcademicYear]);

  // Filter exams based on selected filters
  const filteredExams = React.useMemo(() => {
    if (!shouldLoadExams) return [];

    return classExams.filter(exam => {
      const matchesYear = !examFilters.academicYearId || exam.academicYearId === examFilters.academicYearId;
      const matchesTerm = !examFilters.termId || exam.termId === examFilters.termId;
      return matchesYear && matchesTerm;
    });
  }, [classExams, examFilters, shouldLoadExams]);

  // Enhance subjects with teacher names
  const subjectsWithTeacherNames = React.useMemo(() => {
    if (!shouldLoadSubjects || !classSubjects.length) return [];

    return classSubjects.map(subject => {
      // Support both old format (teacherId) and new format (teacherIds)
      const teacherIds = Array.isArray(subject.teacherIds)
        ? subject.teacherIds
        : (subject.teacherId ? [subject.teacherId] : []);

      const teachers = teacherIds
        .map(teacherId => allStaff.find(staff => staff.id === teacherId))
        .filter(Boolean)
        .map(teacher => `${teacher!.firstName} ${teacher!.lastName}`);

      return {
        ...subject,
        teacherNames: teachers,
        teacherName: teachers.length > 0 ? teachers.join(', ') : 'Not Assigned',
        teacherIds: teacherIds
      };
    });
  }, [classSubjects, allStaff, shouldLoadSubjects]);

  const handleExamFilterChange = (field: 'academicYearId' | 'termId', value: string) => {
    setExamFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };


  // Edit dialog handlers
  const handleOpenEditDialog = React.useCallback(() => {
    if (!classDetail) return;
    setClassName(classDetail.name);
    setClassCode(classDetail.code);
    setLevel(classDetail.level);
    setClassOrder(classDetail.order.toString());
    setClassTeacherId(classDetail.classTeacherId);
    setCoClassTeacherId((classDetail as any).coClassTeacherId || "");
    setClassCaptainId(classDetail.classCaptainId || "");
    setAssistantClassCaptainId(classDetail.assistantClassCaptainId || "");
    setStreams(classDetail.streams || []);
    setStreamError("");

    const initialAssignments: Record<string, string[]> = {};
    const initialSelectedSubjects: string[] = [];
    classDetail.subjectAssignments?.forEach(sa => {
      initialSelectedSubjects.push(sa.subjectId);
      if (Array.isArray(sa.teacherIds)) {
        initialAssignments[sa.subjectId] = sa.teacherIds;
      } else if ('teacherId' in sa && sa.teacherId) {
        initialAssignments[sa.subjectId] = [sa.teacherId];
      } else {
        initialAssignments[sa.subjectId] = [];
      }
    });
    setSelectedSubjectIds(initialSelectedSubjects);
    setSubjectTeacherAssignments(initialAssignments);
    setIsEditDialogOpen(true);
  }, [classDetail]);

  React.useEffect(() => {
    if (searchParams?.get('edit') !== '1' || !classDetail) return;
    handleOpenEditDialog();
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('edit');
    router.replace(`/class-detail?${nextParams.toString()}`, { scroll: false });
  }, [classDetail, handleOpenEditDialog, router, searchParams]);

  const addStream = () => {
    setStreamError("");
    setStreams(current => [
      ...current,
      {
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `stream-${Date.now()}-${current.length}`,
        name: '',
        code: '',
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const updateStream = (streamId: string, field: 'name' | 'code', value: string) => {
    setStreamError("");
    setStreams(current => current.map(stream => (
      stream.id === streamId
        ? { ...stream, [field]: value, updatedAt: new Date().toISOString() }
        : stream
    )));
  };

  const removeStream = (streamId: string) => {
    if (assignedStreamIds.has(streamId)) return;
    setStreamError("");
    setStreams(current => current.filter(stream => stream.id !== streamId));
  };

  const handleSubjectToggle = (subjectId: string) => {
    const isSelected = selectedSubjectIds.includes(subjectId);
    if (isSelected) {
      setSelectedSubjectIds(prev => prev.filter(id => id !== subjectId));
      setSubjectTeacherAssignments(prev => {
        const newState = { ...prev };
        delete newState[subjectId];
        return newState;
      });
    } else {
      setSelectedSubjectIds(prev => [...prev, subjectId]);
      setSubjectTeacherAssignments(prev => ({ ...prev, [subjectId]: [] }));
    }
  };

  const handleSubjectTeacherChange = (subjectId: string, teacherId: string, isChecked: boolean) => {
    setSubjectTeacherAssignments(prev => {
      const currentTeachers = prev[subjectId] || [];
      if (isChecked) {
        return {
          ...prev,
          [subjectId]: currentTeachers.includes(teacherId) ? currentTeachers : [...currentTeachers, teacherId],
        };
      } else {
        return {
          ...prev,
          [subjectId]: currentTeachers.filter(id => id !== teacherId),
        };
      }
    });
  };

  const handleUpdateClass = async () => {
    if (!classDetail) return;
    const orderNumber = parseInt(classOrder, 10);
    if (classOrder.trim() === "" || isNaN(orderNumber)) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Order number is compulsory and must be a valid number." });
      return;
    }
    if (!className.trim()) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Class Name is compulsory." });
      return;
    }
    if (!classCode.trim()) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Class Code is compulsory." });
      return;
    }
    if (!classTeacherId) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Class Teacher is compulsory." });
      return;
    }

    try {
      assertUniqueStreams(streams);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check the stream names and codes.';
      setStreamError(message);
      requestAnimationFrame(() => {
        const summary = document.getElementById('class-stream-error-summary');
        summary?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        summary?.focus();
      });
      return;
    }

    const teacher = teachingStaff.find(s => s.id === classTeacherId);
    const classTeacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : undefined;

    const coTeacher = teachingStaff.find(s => s.id === coClassTeacherId);
    const coClassTeacherName = coTeacher ? `${coTeacher.firstName} ${coTeacher.lastName}` : undefined;

    const finalSubjectAssignments: SubjectAssignment[] = selectedSubjectIds.map(subjectId => ({
      subjectId,
      teacherIds: subjectTeacherAssignments[subjectId] || [],
    }));

    const classData = {
      name: className.trim(),
      code: classCode.trim(),
      level,
      order: orderNumber,
      classTeacherId,
      classTeacherName,
      coClassTeacherId: coClassTeacherId || undefined,
      coClassTeacherName: coClassTeacherName || undefined,
      classCaptainId: classCaptainId || undefined,
      assistantClassCaptainId: assistantClassCaptainId || undefined,
      subjectAssignments: finalSubjectAssignments,
      streams: streams.map(stream => ({
        ...stream,
        name: normaliseStreamValue(stream.name),
        code: normaliseStreamValue(stream.code).toUpperCase(),
      })),
    };

    try {
      await updateClassMutation.mutateAsync({ id: classDetail.id, data: classData });
      toast({ title: "Class Updated", description: "Class has been successfully updated." });
      setIsEditDialogOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update class. Please try again.",
      });
    }
  };

  // Sort pupils based on current sort settings
  const sortedPupils = React.useMemo(() => {
    if (!pupilsInClassWithPhotos.length) return [];

    return [...pupilsInClassWithPhotos].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case 'section':
          comparison = (a.section || '').localeCompare(b.section || '');
          break;
        case 'gender':
          comparison = a.gender.localeCompare(b.gender);
          break;
        case 'age':
          const ageA = a.dateOfBirth ? calculateAge(a.dateOfBirth) : 0;
          const ageB = b.dateOfBirth ? calculateAge(b.dateOfBirth) : 0;
          comparison = ageA - ageB;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [pupilsInClassWithPhotos, sortBy, sortOrder]);

  // Filter pupils based on current filters
  const filteredPupils = React.useMemo(() => {
    return sortedPupils.filter(pupil => {
      const matchesSearch = !filters.search ||
        `${pupil.firstName} ${pupil.lastName}`.toLowerCase().includes(filters.search.toLowerCase()) ||
        pupil.guardians?.[0]?.email?.toLowerCase().includes(filters.search.toLowerCase());

      const matchesSection = filters.section === 'all' || pupil.section === filters.section;
      const matchesStatus = filters.status === 'all' || pupil.status === filters.status;
      const matchesGender = filters.gender === 'all' || pupil.gender === filters.gender;

      let matchesAge = true;
      if (filters.ageMin || filters.ageMax) {
        const age = pupil.dateOfBirth ? calculateAge(pupil.dateOfBirth) : null;
        if (age !== null) {
          if (filters.ageMin && age < parseInt(filters.ageMin)) matchesAge = false;
          if (filters.ageMax && age > parseInt(filters.ageMax)) matchesAge = false;
        } else {
          matchesAge = false;
        }
      }

      return matchesSearch && matchesSection && matchesStatus && matchesGender && matchesAge;
    });
  }, [sortedPupils, filters]);

  const handlePupilSort = React.useCallback((field: 'name' | 'section' | 'gender' | 'age') => {
    if (sortBy === field) setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }, [sortBy]);

  const pupilStreamGroups = React.useMemo(() => {
    const configuredStreams = getActiveClassStreams(classDetail, activeAcademicYear?.id);
    if (!configuredStreams.length) {
      return [{ id: 'all', name: '', code: '', pupils: filteredPupils, isUnassigned: false }];
    }
    const configuredIds = new Set(configuredStreams.map(stream => stream.id));
    const groups = configuredStreams.map(stream => ({
      id: stream.id,
      name: stream.name,
      code: stream.code,
      pupils: filteredPupils.filter(pupil => pupil.streamId === stream.id && (!pupil.streamClassId || pupil.streamClassId === classDetail?.id)),
      isUnassigned: false,
    }));
    const unassigned = filteredPupils.filter(pupil => !pupil.streamId || !configuredIds.has(pupil.streamId) || (pupil.streamClassId && pupil.streamClassId !== classDetail?.id));
    if (unassigned.length) groups.push({ id: 'unassigned', name: 'Unassigned', code: '', pupils: unassigned, isUnassigned: true });
    return groups.filter(group => group.pupils.length > 0);
  }, [activeAcademicYear?.id, classDetail, filteredPupils]);

  // Count pending pupils in this class
  const pendingPupilsCount = React.useMemo(() => {
    if (!pupilsInClassWithPhotos.length || !classId) return 0;
    return pupilsInClassWithPhotos.filter(pupil => pupil.status === 'Pending').length;
  }, [pupilsInClassWithPhotos, classId]);

  // Get unique sections for filter
  const sections = React.useMemo(() => {
    const uniqueSections = [...new Set(pupilsInClassWithPhotos.map(pupil => pupil.section).filter(Boolean))];
    return uniqueSections.sort();
  }, [pupilsInClassWithPhotos]);

  // 🚀 OPTIMIZED: Only show loading if we have no cached data at all (first load)
  // If we have cached data (even if stale), show it immediately even if loading in background
  const showLoadingSpinner = isLoading && !hasCachedData;

  if (showLoadingSpinner) {
    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Loading Class Details..."
          backHref="/classes"
        />
        <div className="max-w-7xl mx-auto px-4 py-12 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-muted-foreground font-medium">Loading class details...</p>
          </div>
        </div>
      </div>
    );
  }

  // 🚀 CRITICAL: Only show error if we've finished loading and still don't have data
  // Don't show error while loading or if we have cached data
  if (!classDetail && !isLoading && !classLoading) {
    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Class Not Found"
          backHref="/classes"
        />
        <div className="container mx-auto px-4 py-12 max-w-md">
          <Card>
            <CardContent className="text-center p-8">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Class Not Found</h2>
              <p className="text-muted-foreground mb-4">The requested class could not be found.</p>
              <Button asChild className="w-full">
                <Link href="/classes">Back to Classes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 🚀 CRITICAL: If we don't have classDetail yet but are loading, show loading
  // This handles the case where we don't have cached data
  if (!classDetail && isLoading) {
    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Loading Class Details..."
          backHref="/classes"
        />
        <div className="max-w-7xl mx-auto px-4 py-12 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-muted-foreground font-medium">Loading class details...</p>
          </div>
        </div>
      </div>
    );
  }

  // 🚀 CRITICAL: If we still don't have classDetail after loading, return early
  // This prevents errors when trying to access classDetail properties
  if (!classDetail) {
    return null;
  }

  const classTeacher = allStaff.find((s: any) => s.id === classDetail.classTeacherId);

  const teacherName = classTeacher ? `${classTeacher.firstName} ${classTeacher.lastName}` : classDetail.classTeacherName || "Not Assigned";
  const captain = classDetail.classCaptainId ? pupilsInClassWithPhotos.find(p => p.id === classDetail.classCaptainId) : null;
  const assistantCaptain = classDetail.assistantClassCaptainId ? pupilsInClassWithPhotos.find(p => p.id === classDetail.assistantClassCaptainId) : null;

  return (
    <div className="min-h-screen animate-in fade-in duration-500">
      <GlassPageTopBar
        title={classDetail.name}
        subtitle="Class overview, teacher, leaders, and pupil roster"
        backHref="/classes"
        backLabel="Back to classes"
        className="mb-1.5"
        meta={
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap rounded-full border border-indigo-100/80 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              {classDetail.level}
            </span>
            <span className="whitespace-nowrap rounded-full border border-emerald-100/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              {filteredPupils.length} {filteredPupils.length === 1 ? 'Pupil' : 'Pupils'}
            </span>
          </div>
        }
        center={
          <GlassPageSearchInput
            placeholder="Search pupils..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        }
        actionsLeading={
          <GlassPageSearchInput
            placeholder="Search pupils..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            containerClassName="lg:hidden"
          />
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label={shouldLoadSubjects ? "Hide Subjects" : "Subjects"}
              icon={<BookOpen className="h-4 w-4" />}
              tone={shouldLoadSubjects ? "orange" : "slate"}
              onClick={() => setShouldLoadSubjects(!shouldLoadSubjects)}
            />
            <GlassActionButton
              label={shouldLoadExams ? "Hide Exams" : "Exams"}
              icon={<Calendar className="h-4 w-4" />}
              tone={shouldLoadExams ? "orange" : "slate"}
              onClick={() => setShouldLoadExams(!shouldLoadExams)}
            />
            <GlassActionButton
              label="Req"
              icon={<FileText className="h-4 w-4" />}
              tone="slate"
              onClick={() => setIsClassRequirementsModalOpen(true)}
            />
            <GlassActionButton
              label="History"
              icon={<History className="h-4 w-4" />}
              tone="slate"
              href={`/classes/history/${classDetail.id}`}
            />
            {hasGraduates && (
              <GlassActionButton
                label="Graduated"
                icon={<GraduationCap className="h-4 w-4" />}
                tone="slate"
                href={`/classes/graduates/${classDetail.id}`}
              />
            )}
            {pendingPupilsCount > 0 && (
              <GlassActionButton
                label={`Pending (${pendingPupilsCount})`}
                icon={<Clock className="h-4 w-4 text-amber-600" />}
                tone="orange"
                href={`/classes/pending?classId=${classDetail.id}`}
              />
            )}
            {(classDetail.streams?.length || 0) > 0 && (
              <GlassActionButton
                label="Streams"
                icon={<GitBranch className="h-4 w-4" />}
                tone="slate"
                href={`/classes/${classDetail.id}/streams`}
                aria-label="Open Stream Setup"
              />
            )}
            <GlassActionButton
              label={viewMode === 'tiles' ? "List" : "Tiles"}
              icon={viewMode === 'tiles' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              tone="slate"
              onClick={() => setViewMode(viewMode === 'tiles' ? 'list' : 'tiles')}
              aria-label={viewMode === 'tiles' ? "Switch to List View" : "Switch to Tiles View"}
            />
            <GlassActionButton
              label="Filters"
              tone="blue"
              icon={<Filter className="h-4 w-4" />}
              badge={activeFiltersCount > 0 ? activeFiltersCount : undefined}
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Toggle Filters"
            />
            <GlassActionButton
              label="Edit"
              tone="slate"
              icon={<Edit className="h-4 w-4" />}
              onClick={handleOpenEditDialog}
              aria-label="Edit Class"
            />
          </GlassActionDock>
        }
      />

      <GlassSummaryBar
        left={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 dark:text-indigo-200 uppercase">
              Class Leaders & Teacher
            </span>
          </div>
        }
        right={
          <>
            <div className="flex items-center gap-1 bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="text-indigo-700/85 dark:text-indigo-300 font-medium">Class Teacher:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{teacherName}</span>
            </div>
            <div className="flex items-center gap-1 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="text-amber-700/85 dark:text-amber-300 font-medium">Class Captain:</span>
              {captain ? (
                <Link href={`/pupil-detail?id=${captain.id}`} className="font-bold text-amber-600 dark:text-amber-400 hover:underline">
                  {captain.firstName} {captain.lastName}
                </Link>
              ) : (
                <span className="font-bold text-amber-600 dark:text-amber-400">Not Assigned</span>
              )}
            </div>
            <div className="flex items-center gap-1 bg-orange-50/80 dark:bg-orange-950/20 border border-orange-100/50 dark:border-orange-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="text-orange-700/85 dark:text-orange-300 font-medium">Assistant Class Captain:</span>
              {assistantCaptain ? (
                <Link href={`/pupil-detail?id=${assistantCaptain.id}`} className="font-bold text-orange-600 dark:text-orange-400 hover:underline">
                  {assistantCaptain.firstName} {assistantCaptain.lastName}
                </Link>
              ) : (
                <span className="font-bold text-orange-600 dark:text-orange-400">Not Assigned</span>
              )}
            </div>
          </>
        }
      />

      <div className="max-w-none px-4 sm:px-6 lg:px-8 pb-12">

      {/* Filter Panel - shown when filter button is clicked */}
      {showFilters && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-200 rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-muted/10 backdrop-blur-sm shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              Filter Pupils
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ search: filters.search, section: 'all', status: 'all', gender: 'all', ageMin: '', ageMax: '' })}
              className="h-7 text-xs rounded-full hover:bg-primary/10 text-muted-foreground"
            >
              Reset
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Gender */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Gender</Label>
              <Select value={filters.gender} onValueChange={(v) => setFilters(prev => ({ ...prev, gender: v }))}>
                <SelectTrigger className="h-8 text-xs rounded-xl border-2 border-primary/20 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Section */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Section</Label>
              <Select value={filters.section} onValueChange={(v) => setFilters(prev => ({ ...prev, section: v }))}>
                <SelectTrigger className="h-8 text-xs rounded-xl border-2 border-primary/20 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  <SelectItem value="Day">Day</SelectItem>
                  <SelectItem value="Boarding">Boarding</SelectItem>
                  {sections.filter(s => s !== 'Day' && s !== 'Boarding').map(s => (
                    <SelectItem key={s} value={s!}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
                <SelectTrigger className="h-8 text-xs rounded-xl border-2 border-primary/20 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Age Range */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Age Range</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.ageMin}
                  onChange={(e) => setFilters(prev => ({ ...prev, ageMin: e.target.value }))}
                  className="h-8 text-xs rounded-xl border-2 border-primary/20 bg-background w-full"
                />
                <span className="text-xs text-muted-foreground">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.ageMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, ageMax: e.target.value }))}
                  className="h-8 text-xs rounded-xl border-2 border-primary/20 bg-background w-full"
                />
              </div>
            </div>
          </div>
          {/* Active filter summary */}
          {(filters.gender !== 'all' || filters.section !== 'all' || filters.status !== 'all' || filters.ageMin || filters.ageMax) && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Active:</span>
              {filters.gender !== 'all' && <Badge variant="secondary" className="text-xs">{filters.gender}</Badge>}
              {filters.section !== 'all' && <Badge variant="secondary" className="text-xs">{filters.section}</Badge>}
              {filters.status !== 'all' && <Badge variant="secondary" className="text-xs">{filters.status}</Badge>}
              {(filters.ageMin || filters.ageMax) && <Badge variant="secondary" className="text-xs">Age {filters.ageMin || '0'}–{filters.ageMax || '∞'}</Badge>}
              <span className="text-xs font-medium text-primary">{filteredPupils.length} result{filteredPupils.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:h-[calc(100vh-12rem)]">
        {/* Left Column: Basic Class Info / Exams / Subjects */}
        {(shouldLoadExams || shouldLoadSubjects) && (
          <div className="lg:col-span-1 space-y-3 lg:space-y-6 lg:overflow-y-auto lg:pr-2 animate-in slide-in-from-left duration-300">
            <Card className="shadow-xl border-2 border-primary/10 bg-gradient-to-br from-card via-card to-muted/5 rounded-2xl overflow-hidden backdrop-blur-sm">
              <CardContent className="space-y-4 text-xs lg:text-sm p-4 sm:p-6">
                {/* Exams List */}
                {shouldLoadExams && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Class Exams
                    </div>
                    {examsLoading ? (
                      <div className="text-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />
                        <div className="text-xs text-muted-foreground mt-2">Loading exams...</div>
                      </div>
                    ) : (
                      <>
                        {/* Academic Year and Term filters - always visible when exams loaded */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="space-y-1 flex-1">
                            <Label className="text-xs font-medium text-muted-foreground">Academic Year</Label>
                            <Select
                              value={examFilters.academicYearId}
                              onValueChange={(value) => handleExamFilterChange('academicYearId', value)}
                              disabled={academicYears.length === 0}
                            >
                              <SelectTrigger className="h-8 text-xs rounded-xl border-2 border-primary/20 focus:border-primary/50 shadow-sm bg-gradient-to-br from-background to-muted/10">
                                <SelectValue placeholder="Select Year" />
                              </SelectTrigger>
                              <SelectContent position="popper" className="max-h-[200px] overflow-y-auto rounded-xl border-2">
                                <SelectItem value="all">All Academic Years</SelectItem>
                                {academicYears.map(year => (
                                  <SelectItem key={year.id} value={year.id}>
                                    {year.name}{year.isActive ? ' (Active)' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1 flex-1">
                            <Label className="text-xs font-medium text-muted-foreground">Term</Label>
                            <Select
                              value={examFilters.termId}
                              onValueChange={(value) => handleExamFilterChange('termId', value)}
                              disabled={terms.length === 0}
                            >
                              <SelectTrigger className="h-8 text-xs rounded-xl border-2 border-primary/20 focus:border-primary/50 shadow-sm bg-gradient-to-br from-background to-muted/10">
                                <SelectValue placeholder="Select Term" />
                              </SelectTrigger>
                              <SelectContent position="popper" className="max-h-[200px] overflow-y-auto rounded-xl border-2">
                                <SelectItem value="all">All Terms</SelectItem>
                                {terms
                                  .filter(term => !examFilters.academicYearId || examFilters.academicYearId === 'all' || term.academicYearId === examFilters.academicYearId)
                                  .map(term => (
                                    <SelectItem key={term.id} value={term.id}>
                                      {term.name}{term.isCurrent ? ' (Current)' : ''}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {filteredExams.length > 0 ? (
                          <div className="space-y-2 max-h-60 lg:max-h-80 overflow-y-auto pr-1">
                            {filteredExams.map((exam) => (
                              <Link
                                key={exam.id}
                                href={`/exams/${exam.id}`}
                                className="block p-3 border-2 border-primary/10 rounded-xl hover:border-primary/30 hover:shadow-md transition-all duration-200 bg-gradient-to-br from-card to-muted/5 group/exam"
                              >
                                <div className="font-semibold text-foreground text-xs group-hover/exam:text-primary transition-colors">{exam.name}</div>
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  {exam.startDate ? new Date(exam.startDate).toLocaleDateString() : 'No date set'}
                                </div>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-xl border border-dashed">
                            No exams found for the selected filters.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Divider if both shown */}
                {shouldLoadExams && shouldLoadSubjects && (
                  <div className="border-t border-border/50 my-2" />
                )}

                {/* Subjects List */}
                {shouldLoadSubjects && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      Subjects & Teachers
                    </div>
                    {subjectsLoading ? (
                      <div className="text-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />
                        <div className="text-xs text-muted-foreground mt-2">Loading subjects...</div>
                      </div>
                    ) : subjectsWithTeacherNames.length > 0 ? (
                      <div className="space-y-2 max-h-60 lg:max-h-80 overflow-y-auto pr-1">
                        {subjectsWithTeacherNames.map((subject) => (
                          <div
                            key={subject.id}
                            className="p-3 border-2 border-primary/10 rounded-xl bg-gradient-to-br from-card to-muted/5 text-xs"
                          >
                            <div className="font-semibold text-foreground">{subject.name}</div>
                            <div className="text-muted-foreground text-[10px] mt-1">
                              <span className="font-medium">Teacher:</span> {subject.teacherName}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-xl border border-dashed">
                        No subjects assigned to this class
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Right Column: Pupils List */}
        <div className={cn(
          "space-y-3 lg:space-y-6 lg:overflow-y-auto",
          (shouldLoadExams || shouldLoadSubjects) ? "lg:col-span-3" : "lg:col-span-4"
        )}>
          <Card className="shadow-xl border-2 border-primary/10 bg-gradient-to-br from-card via-card to-muted/5 rounded-2xl overflow-hidden backdrop-blur-sm">
            <CardContent className="p-0">
              {pupilsInClass.length === 0 && allPupilsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading pupils...</span>
                </div>
              ) : filteredPupils.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No pupils found.</p>
                  {filters.search && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                      className="mt-3 rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/30 hover:border-primary/50 shadow-md hover:shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 font-semibold px-4 py-1.5 h-auto"
                    >
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop List View - Show on large screens when viewMode is list */}
                  {viewMode === 'list' && (
                    <div className="hidden lg:block">
                      <div className="max-h-[calc(100vh-13.5rem)] space-y-4 overflow-y-auto p-3">
                        {pupilStreamGroups.map(group => (
                          <section key={group.id} className={`overflow-hidden rounded-xl border ${group.isUnassigned ? 'border-amber-300 bg-amber-50/30' : 'border-cyan-200 bg-white'}`}>
                            {group.name ? (
                              <div className={`flex items-center justify-between border-b px-4 py-2 ${group.isUnassigned ? 'border-amber-200 bg-amber-100/70 text-amber-950' : 'border-cyan-200 bg-cyan-50 text-cyan-950'}`}>
                                <div className="flex items-center gap-2"><GitBranch className="h-4 w-4" /><h3 className="font-bold">{group.name}{group.code ? ` (${group.code})` : ''}</h3></div>
                                <Badge variant="outline" className="bg-white tabular-nums">{group.pupils.length} pupils</Badge>
                              </div>
                            ) : null}
                            <div className="overflow-x-auto">
                              <PupilRosterTable pupils={group.pupils} classDetail={classDetail} photosLoading={photosLoading} onOpenRequirements={handleOpenRequirements} sortBy={sortBy} sortOrder={sortOrder} onSort={handlePupilSort} />
                            </div>
                          </section>
                        ))}
                      </div>
                      {/* Enhanced footer with better organization */}
                      <div className="px-3 py-3 bg-gradient-to-r from-primary/10 via-primary/5 to-muted/10 border-t-2 border-primary/20 backdrop-blur-sm rounded-b-lg">
                        <div className="flex items-center justify-between text-xs text-foreground font-medium">
                          <div className="flex items-center space-x-4">
                            <span className="font-medium">
                              {filteredPupils.length} of {pupilsInClass.length} pupils
                            </span>
                            {filteredPupils.length !== pupilsInClass.length && (
                              <span className="flex items-center space-x-1">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                <span>{pupilsInClass.filter((p: Pupil) => p.status === 'Active').length} active</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="flex items-center space-x-1">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                              <span>{pupilsInClass.filter((p: Pupil) => p.gender === 'Male').length} male</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <div className="w-1.5 h-1.5 bg-pink-500 rounded-full"></div>
                              <span>{pupilsInClass.filter((p: Pupil) => p.gender === 'Female').length} female</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tiles View - Show on small screens OR when viewMode is tiles on large screens */}
                  {(viewMode === 'tiles' || window.innerWidth < 1024) && (
                    <div className="space-y-5 p-4 lg:p-6">
                      {pupilStreamGroups.map(group => (
                        <section key={group.id} className="space-y-3">
                          {group.name ? (
                            <div className={`flex items-center justify-between rounded-xl border px-3 py-2 ${group.isUnassigned ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-cyan-200 bg-cyan-50 text-cyan-950'}`}>
                              <div className="flex items-center gap-2"><GitBranch className="h-4 w-4" /><h3 className="font-bold">{group.name}{group.code ? ` (${group.code})` : ''}</h3></div>
                              <Badge variant="outline" className="bg-white">{group.pupils.length}</Badge>
                            </div>
                          ) : null}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {group.pupils.map(pupil => <PupilCard key={pupil.id} pupil={pupil} classDetail={classDetail} isLoadingPhoto={photosLoading && !pupil.photo} />)}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Edit Class Dialog */}
      <ModernDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <ModernDialogContent
          size="xl"
          className="w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden relative"
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        >
          {/* Floating Save/Update Button */}
          <Button
            type="button"
            onClick={handleUpdateClass}
            className="absolute right-12 top-2 sm:right-16 sm:top-4 rounded-full w-10 h-10 p-0 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 border-2 border-white/30 backdrop-blur-md z-50 flex items-center justify-center group overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.95) 0%, rgba(147, 51, 234, 0.95) 50%, rgba(79, 70, 229, 0.95) 100%)',
              boxShadow: '0 8px 32px rgba(37, 99, 235, 0.5), 0 4px 16px rgba(147, 51, 234, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 -1px 0 rgba(0, 0, 0, 0.15)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(37, 99, 235, 0.6), 0 6px 20px rgba(147, 51, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(37, 99, 235, 0.5), 0 4px 16px rgba(147, 51, 234, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 -1px 0 rgba(0, 0, 0, 0.15)';
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>
            <Save className="h-5 w-5 relative z-10 group-hover:scale-110 transition-transform duration-300" />
            <span className="sr-only">Update Class</span>
          </Button>
          <ModernDialogHeader className="p-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <School className="h-4 w-4 text-white" />
              </div>
              <div>
                <ModernDialogTitle className="text-base font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Edit Class
                </ModernDialogTitle>
                <ModernDialogDescription className="text-xs text-gray-600 hidden">
                  Update class details, subjects and teacher assignments.
                </ModernDialogDescription>
              </div>
            </div>
          </ModernDialogHeader>

          <ScrollArea className="flex-grow min-h-0 overflow-y-auto px-3">
            <div className="space-y-3 pb-3">
              {/* Basic Information Section */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-3 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1 bg-blue-100 rounded-md">
                    <Book className="h-3 w-3 text-blue-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Basic Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="className" className="text-xs font-medium text-gray-700">
                      Class Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="className"
                      value={className}
                      onChange={(e) => setClassName(e.target.value.toUpperCase())}
                      placeholder="e.g., PRIMARY ONE"
                      className="h-8 rounded-xl border-2 border-gray-300 bg-white/90 hover:border-gray-400 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 backdrop-blur-sm text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="classCode" className="text-xs font-medium text-gray-700">
                      Class Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="classCode"
                      value={classCode}
                      onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                      placeholder="e.g., P.1"
                      className="h-8 rounded-xl border-2 border-gray-300 bg-white/90 hover:border-gray-400 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 backdrop-blur-sm text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="order" className="text-xs font-medium text-gray-700">
                      Order <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="order"
                      type="number"
                      value={classOrder}
                      onChange={(e) => setClassOrder(e.target.value)}
                      placeholder="1"
                      className="h-8 rounded-xl border-2 border-gray-300 bg-white/90 hover:border-gray-400 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 backdrop-blur-sm text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="level" className="text-xs font-medium text-gray-700">
                      Level <span className="text-red-500">*</span>
                    </Label>
                    <Select value={level} onValueChange={(value) => setLevel(value as ClassLevel)}>
                      <SelectTrigger className="h-8 rounded-xl border-2 border-gray-300 bg-white/90 hover:border-gray-400 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 backdrop-blur-sm text-sm">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        sideOffset={4}
                        avoidCollisions={true}
                        className="z-50"
                      >
                        {CLASS_LEVELS.map(lvl => (
                          <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Class Teacher Section */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex-shrink-0">
                    <Users className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Label htmlFor="classTeacherId" className="text-sm font-semibold text-green-900 flex items-center gap-2 flex-shrink-0">
                      Class Teacher
                      <span className="text-red-500">*</span>
                    </Label>
                    {classTeacherId && (() => {
                      const selectedTeacher = teachingStaff.find(t => t.id === classTeacherId);
                      if (selectedTeacher) {
                        return (
                          <>
                            <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                            <span className="text-sm text-green-700 font-medium truncate">{selectedTeacher.firstName} {selectedTeacher.lastName}</span>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <SearchableTeacherSelector
                    value={classTeacherId}
                    onValueChange={setClassTeacherId}
                    teachers={teachingStaff}
                    allowNone={false}
                    icon={Users}
                  />
                </div>
              </div>

              {/* Co-Class Teacher Section */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex-shrink-0">
                    <Users className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Label htmlFor="coClassTeacherId" className="text-sm font-semibold text-green-900 flex items-center gap-2 flex-shrink-0">
                      Co-Class Teacher
                    </Label>
                    {coClassTeacherId && (() => {
                      const selectedTeacher = teachingStaff.find(t => t.id === coClassTeacherId);
                      if (selectedTeacher) {
                        return (
                          <>
                            <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                            <span className="text-sm text-green-700 font-medium truncate">{selectedTeacher.firstName} {selectedTeacher.lastName}</span>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <SearchableTeacherSelector
                    value={coClassTeacherId}
                    onValueChange={setCoClassTeacherId}
                    teachers={teachingStaff}
                    allowNone={true}
                    icon={Users}
                  />
                </div>
              </div>

              {/* Class Captains Section */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex-shrink-0">
                    <Crown className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Class Leadership</h3>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  {/* Class Captain */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="p-1 bg-amber-100 rounded-md flex-shrink-0">
                      <Crown className="h-3 w-3 text-amber-600" />
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Label htmlFor="classCaptainId" className="text-sm font-semibold text-amber-900 flex-shrink-0">
                        Class Captain
                      </Label>
                      {classCaptainId ? (() => {
                        const selectedPupil = pupilsInClass.find((p: any) => p.id === classCaptainId);
                        if (selectedPupil) {
                          return (
                            <>
                              <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                              <span className="text-sm text-amber-700 font-medium truncate">{selectedPupil.firstName} {selectedPupil.lastName}</span>
                            </>
                          );
                        }
                        return null;
                      })() : (
                        <>
                          <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                          <span className="text-sm text-gray-500 italic">None</span>
                        </>
                      )}
                    </div>
                    <SearchablePupilSelector
                      value={classCaptainId}
                      onValueChange={(value) => setClassCaptainId(value)}
                      pupils={pupilsInClass}
                      editingClass={classDetail}
                      disabledIds={assistantClassCaptainId ? [assistantClassCaptainId] : []}
                      icon={Crown}
                    />
                  </div>

                  {/* Assistant Class Captain */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="p-1 bg-amber-100 rounded-md flex-shrink-0">
                      <Award className="h-3 w-3 text-amber-600" />
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Label htmlFor="assistantClassCaptainId" className="text-sm font-semibold text-amber-900 flex-shrink-0">
                        Assistant
                      </Label>
                      {assistantClassCaptainId ? (() => {
                        const selectedPupil = pupilsInClass.find((p: any) => p.id === assistantClassCaptainId);
                        if (selectedPupil) {
                          return (
                            <>
                              <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                              <span className="text-sm text-amber-700 font-medium truncate">{selectedPupil.firstName} {selectedPupil.lastName}</span>
                            </>
                          );
                        }
                        return null;
                      })() : (
                        <>
                          <span className="text-xs text-gray-400 mx-1 flex-shrink-0">-</span>
                          <span className="text-sm text-gray-500 italic">None</span>
                        </>
                      )}
                    </div>
                    <SearchablePupilSelector
                      value={assistantClassCaptainId}
                      onValueChange={(value) => setAssistantClassCaptainId(value)}
                      pupils={pupilsInClass}
                      editingClass={classDetail}
                      disabledIds={classCaptainId ? [classCaptainId] : []}
                      icon={Award}
                    />
                  </div>
                </div>
                {(classCaptainId || assistantClassCaptainId) && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Note:</span> A pupil cannot be both Class Captain and Assistant Class Captain.
                    </p>
                  </div>
                )}
              </div>

              {/* Subjects Assignment Section */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-200">
                {/* Header with expand/collapse trigger */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex-shrink-0">
                      <GraduationCap className="h-3.5 w-3.5 text-white" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-800">Subject Assignments</h3>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-purple-600 hover:bg-purple-100/50 rounded-lg"
                    onClick={() => setIsSubjectAssignmentsOpen(!isSubjectAssignmentsOpen)}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isSubjectAssignmentsOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </div>

                {/* Always visible collapsed view: Selected Subjects & Teachers list */}
                {!isSubjectAssignmentsOpen && (
                  <div className="mt-3">
                    {selectedSubjectIds.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedSubjectIds.map(subjectId => {
                          const subject = allSubjects.find(s => s.id === subjectId);
                          if (!subject) return null;
                          const assignedTeachers = (subjectTeacherAssignments[subjectId] || []);
                          const teacherNames = assignedTeachers
                            .map(teacherId => {
                              const teacher = teachingStaff.find(t => t.id === teacherId);
                              return teacher ? `${teacher.firstName} ${teacher.lastName}` : null;
                            })
                            .filter(Boolean)
                            .join(', ');
                          return (
                            <div key={subjectId} className="flex items-center justify-between gap-2 p-2 bg-white/80 hover:bg-white border border-purple-100 rounded-lg shadow-sm transition-all">
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-xs text-purple-900 block truncate">{subject.name}</span>
                                <span className="text-[10px] text-gray-500 block truncate">
                                  {teacherNames || 'No teacher assigned'}
                                </span>
                              </div>
                              <SearchableSubjectTeacherSelector
                                subjectId={subjectId}
                                assignedTeacherIds={assignedTeachers}
                                onTeacherToggle={handleSubjectTeacherChange}
                                teachers={teachingStaff}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic mt-1 pl-8">No subjects selected. Click expand to assign subjects.</p>
                    )}
                  </div>
                )}

                {/* Expanded view: Subject Selection Checklist */}
                {isSubjectAssignmentsOpen && (
                  <div className="mt-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
                    <ScrollArea className="h-64">
                      <div className="p-3">
                        {allSubjects.length === 0 ? (
                          <div className="text-center text-gray-500 py-6">
                            <Book className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                            <p className="text-sm">No subjects available.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {allSubjects.map(subject => {
                              const isSelected = selectedSubjectIds.includes(subject.id);

                              return (
                                <div
                                  key={subject.id}
                                  className={`rounded-lg p-2.5 border transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer ${
                                    isSelected
                                      ? 'border-purple-300 bg-purple-50/60 shadow-sm'
                                      : 'border-gray-200 hover:bg-gray-50/80 bg-white'
                                  }`}
                                  onClick={() => handleSubjectToggle(subject.id)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`p-1 rounded-md flex-shrink-0 ${
                                      isSelected ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                      <Book className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-xs font-semibold text-gray-900 block truncate">{subject.name}</span>
                                      <span className="text-[10px] text-gray-400 block font-mono">{subject.code}</span>
                                    </div>
                                  </div>
                                  <Checkbox
                                    id={`subject-${subject.id}`}
                                    checked={isSelected}
                                    onCheckedChange={() => handleSubjectToggle(subject.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-3.5 w-3.5 rounded-sm flex-shrink-0"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              {/* Stream Definitions Section */}
              <div className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-2">
                    <div className="rounded-lg bg-cyan-600 p-1.5 text-white">
                      <GitBranch className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">Class Streams</h3>
                      <p className="mt-0.5 text-xs leading-5 text-cyan-900">
                        Create names and codes here. Nothing changes on the pupil roster until Stream Setup is completed.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addStream}
                    className="h-11 shrink-0 border-cyan-300 bg-white text-cyan-800 hover:bg-cyan-100"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Stream
                  </Button>
                </div>

                {streamError ? (
                  <div
                    id="class-stream-error-summary"
                    role="alert"
                    tabIndex={-1}
                    className="mt-3 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{streamError}</span>
                  </div>
                ) : null}

                {streams.length === 0 ? (
                  <button
                    type="button"
                    onClick={addStream}
                    className="mt-3 flex min-h-24 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-300 bg-white/70 px-4 text-center transition-colors hover:border-cyan-500 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  >
                    <GitBranch className="mb-2 h-5 w-5 text-cyan-700" />
                    <span className="text-sm font-semibold text-cyan-950">No streams created</span>
                    <span className="mt-1 text-xs text-cyan-800">Add the first stream without affecting current pupil data.</span>
                  </button>
                ) : (
                  <div className="mt-3 space-y-2">
                    {streams.map((stream, index) => {
                      const isAssigned = assignedStreamIds.has(stream.id);
                      const describedBy = [
                        isAssigned ? `class-stream-lock-${stream.id}` : '',
                        streamError ? 'class-stream-error-summary' : '',
                      ].filter(Boolean).join(' ') || undefined;

                      return (
                        <div key={stream.id} className="grid gap-2 rounded-xl border border-cyan-100 bg-white p-3 sm:grid-cols-[2rem_minmax(0,1fr)_10rem_2.75rem] sm:items-end">
                          <div className="flex h-11 w-8 items-center justify-center rounded-lg bg-cyan-50 text-sm font-bold text-cyan-800" aria-hidden="true">
                            {index + 1}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`class-stream-name-${stream.id}`} className="text-xs font-medium text-gray-700">Stream name</Label>
                            <Input
                              id={`class-stream-name-${stream.id}`}
                              value={stream.name}
                              onChange={event => updateStream(stream.id, 'name', event.target.value)}
                              placeholder="e.g., East"
                              disabled={isAssigned}
                              aria-invalid={Boolean(streamError)}
                              aria-describedby={describedBy}
                              className="h-11 bg-white"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`class-stream-code-${stream.id}`} className="text-xs font-medium text-gray-700">Stream code</Label>
                            <Input
                              id={`class-stream-code-${stream.id}`}
                              value={stream.code}
                              onChange={event => updateStream(stream.id, 'code', event.target.value.toUpperCase())}
                              placeholder="e.g., E"
                              maxLength={12}
                              disabled={isAssigned}
                              aria-invalid={Boolean(streamError)}
                              aria-describedby={describedBy}
                              className="h-11 bg-white"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeStream(stream.id)}
                            disabled={isAssigned}
                            aria-label={isAssigned ? `${stream.name || 'Stream'} is assigned and cannot be removed` : `Remove ${stream.name || 'stream'}`}
                            className="h-11 w-11 border-rose-200 text-rose-700 hover:bg-rose-50"
                          >
                            {isAssigned ? <LockKeyhole className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                          {isAssigned ? (
                            <p id={`class-stream-lock-${stream.id}`} className="text-xs leading-5 text-slate-500 sm:col-start-2 sm:col-span-3">
                              This stream is assigned to pupils, so its identity is locked to protect current and historical records.
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </ModernDialogContent>
      </ModernDialog>

      {/* Requirements Modal */}
      {selectedPupilIdForRequirements && (
        <PupilRequirementsModal
          key={selectedPupilIdForRequirements} // Force re-mount when pupil changes
          isOpen={isRequirementsModalOpen}
          onClose={handleCloseRequirements}
          pupilId={selectedPupilIdForRequirements}
        />
      )}

      {/* Class Requirements Overview Modal */}
      {classDetail && (
        <ClassRequirementsOverviewModal
          isOpen={isClassRequirementsModalOpen}
          onClose={() => setIsClassRequirementsModalOpen(false)}
          classId={classDetail.id}
        />
      )}
      </div>
    </div>
  );
}

export default function ClassDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Loading Class Details..."
          backHref="/classes"
        />
        <div className="max-w-7xl mx-auto px-4 py-12 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-muted-foreground font-medium">Loading class details...</p>
          </div>
        </div>
      </div>
    }>
      <ClassDetailContent />
    </Suspense>
  );
}
