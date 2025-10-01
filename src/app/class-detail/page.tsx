'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/common/page-header';
import { DetailItem } from '@/components/common/detail-item';
import { PupilRequirementStatusButton } from '@/components/class/pupil-requirement-status-button';
import { RequirementReceptionModal } from '@/components/class/requirement-reception-modal';
import { useClassDetail } from '@/lib/hooks/use-class-detail';
import { useClassPupilsManager } from '@/lib/hooks/use-class-pupils';
import { useExamsByClass } from '@/lib/hooks/use-exams';
import { useActiveAcademicYear, useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useTerms } from '@/lib/hooks/use-terms';
import { useStaff } from '@/lib/hooks/use-staff';
import { useSubjectsByClass } from '@/lib/hooks/use-subjects';
import { Pupil, Class } from '@/types';
import { 
  ArrowLeft, 
  Edit, 
  Search, 
  Filter, 
  Info, 
  Users, 
  BookOpen, 
  Calendar,
  ChevronDown,
  ChevronRight,
  User,
  Loader2,
  X
} from 'lucide-react';

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
function PupilCard({ pupil }: { pupil: Pupil }) {
  const age = pupil.dateOfBirth ? calculateAge(pupil.dateOfBirth) : null;

  const getInitials = () => {
    return `${pupil.firstName.charAt(0)}${pupil.lastName.charAt(0)}`;
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary/40 group">
      <CardContent className="p-4">
        {/* Header Section */}
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-full flex items-center justify-center font-medium text-sm flex-shrink-0 shadow-sm">
            {getInitials()}
          </div>
          <div className="min-w-0 flex-1">
            <Link 
              href={`/pupil-detail?id=${pupil.id}`}
              className="font-semibold text-sm hover:text-primary hover:underline cursor-pointer transition-colors block truncate"
              title={`${pupil.firstName} ${pupil.lastName}`}
            >
              {pupil.firstName} {pupil.lastName}
            </Link>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {pupil.admissionNumber}
            </p>
          </div>
        </div>

        {/* Info Grid - No Labels */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          <div className="text-center">
            <Badge variant="outline" className="text-xs px-2 py-0.5">
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

        {/* Requirements Button - Bottom */}
        <div className="flex justify-center">
          <PupilRequirementStatusButton 
            pupil={pupil}
            onClick={() => {}}
            isCompact={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Pupil List Row for desktop view
function PupilListRow({ pupil, onRequirementClick }: { pupil: Pupil; onRequirementClick: (pupil: Pupil) => void }) {
  const age = pupil.dateOfBirth ? calculateAge(pupil.dateOfBirth) : null;

  return (
    <tr className="hover:bg-muted/30 transition-colors group">
      <td className="px-3 py-3">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-full flex items-center justify-center font-medium text-xs flex-shrink-0 shadow-sm">
            {pupil.firstName.charAt(0)}{pupil.lastName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <Link 
              href={`/pupil-detail?id=${pupil.id}`}
              className="font-medium text-sm truncate hover:text-primary hover:underline cursor-pointer transition-colors block"
            >
              {pupil.firstName} {pupil.lastName}
            </Link>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {pupil.admissionNumber}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          {pupil.section || 'N/A'}
        </Badge>
      </td>
      <td className="px-3 py-3 text-xs font-medium">{pupil.gender}</td>
      <td className="px-3 py-3 text-xs font-medium">{age ? `${age}y` : 'N/A'}</td>
      <td className="px-3 py-3">
        <PupilRequirementStatusButton 
          pupil={pupil}
          onClick={() => onRequirementClick(pupil)}
          isCompact={true}
        />
      </td>
    </tr>
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
  const [searchExpanded, setSearchExpanded] = React.useState(false);
  
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

  // State for requirement modal
  const [isRequirementModalOpen, setIsRequirementModalOpen] = React.useState(false);
  const [selectedPupilForRequirements, setSelectedPupilForRequirements] = React.useState<Pupil | null>(null);

  // State for filters
  const [filters, setFilters] = React.useState({
    search: '',
    section: 'all',
    status: 'all',
    gender: 'all',
    ageMin: '',
    ageMax: ''
  });

  // Fetch data
  const { data: classDetail, isLoading: classLoading } = useClassDetail(classId || '');
  const { pupils: pupilsInClass, isLoading: pupilsLoading } = useClassPupilsManager(classId || '');
  const { data: classExams = [], isLoading: examsLoading } = useExamsByClass(classId || '', { enabled: shouldLoadExams });
  const { data: classSubjects = [], isLoading: subjectsLoading } = useSubjectsByClass(classId || '', { enabled: shouldLoadSubjects });
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: terms = [] } = useTerms();
  const { data: allStaff = [] } = useStaff();

  // Set default exam filters to current term
  React.useEffect(() => {
    if (activeAcademicYear && terms.length > 0) {
      const currentTerm = terms.find(term => 
        term.academicYearId === activeAcademicYear.id && 
        term.isCurrent
      );
      if (currentTerm) {
        setExamFilters({
          academicYearId: activeAcademicYear.id,
          termId: currentTerm.id
        });
      }
    }
  }, [activeAcademicYear, terms]);

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
      const teacher = allStaff.find(staff => staff.id === subject.teacherId);
      return {
        ...subject,
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Not Assigned'
      };
    });
  }, [classSubjects, allStaff, shouldLoadSubjects]);

  const handleExamFilterChange = (field: 'academicYearId' | 'termId', value: string) => {
    setExamFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRequirementClick = (pupil: Pupil) => {
    setSelectedPupilForRequirements(pupil);
    setIsRequirementModalOpen(true);
  };

  const handleCloseRequirementModal = () => {
    setIsRequirementModalOpen(false);
    setSelectedPupilForRequirements(null);
  };

  // Sort pupils based on current sort settings
  const sortedPupils = React.useMemo(() => {
    if (!pupilsInClass.length) return [];
    
    return [...pupilsInClass].sort((a, b) => {
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
  }, [pupilsInClass, sortBy, sortOrder]);
  
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
  
  // Get unique sections for filter
  const sections = React.useMemo(() => {
    const uniqueSections = [...new Set(pupilsInClass.map(pupil => pupil.section).filter(Boolean))];
    return uniqueSections.sort();
  }, [pupilsInClass]);

  if (classLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Loading Class Details..." />
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading class details...</span>
        </div>
      </div>
    );
  }

  if (!classDetail) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Class Not Found" />
        <div className="text-center py-8">
          <p className="text-muted-foreground">The requested class could not be found.</p>
          <Button asChild className="mt-4">
            <Link href="/classes">Back to Classes</Link>
          </Button>
        </div>
      </div>
    );
  }

  const classTeacher = allStaff.find((s: any) => s.id === classDetail.classTeacherId);

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          {/* Class Name */}
          <div className={`transition-all duration-300 ease-out ${
            searchExpanded ? 'scale-75 opacity-60' : 'scale-100 opacity-100'
          }`}>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{classDetail.name}</h1>
          </div>
          
          {/* Search and Actions */}
          <div className="flex items-center gap-2">
            {/* Back and Edit buttons */}
            <div className="flex gap-1 sm:gap-2">
              <Button 
                asChild 
                variant="outline" 
                size="icon" 
                title="Back to Classes"
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                <Link href="/classes"><ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" /></Link>
              </Button>
              
              <Button 
                variant="outline" 
                size="icon" 
                title="Edit Class"
                className="h-8 w-8 sm:h-10 sm:w-10"
                onClick={() => router.push(`/class/edit?id=${classDetail.id}`)}
              >
                <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
            
            {/* Search Container */}
            <div 
              className={`transition-all duration-300 ease-out ${
                searchExpanded 
                  ? 'w-48 sm:w-64 md:w-80' 
                  : 'w-10'
              }`}
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pupils..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10 pr-10 h-8 sm:h-10"
                  onFocus={() => setSearchExpanded(true)}
                  onBlur={() => setSearchExpanded(false)}
                />
                {filters.search && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                    onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Filter Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
        
        {/* Description */}
        <p className="text-muted-foreground hidden lg:block mt-2">Details for class: {classDetail.name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-12rem)]">
        {/* Left Column: Basic Class Info */}
        <div className="lg:col-span-1 space-y-3 lg:space-y-6 lg:overflow-y-auto lg:pr-2">
          <Card className="shadow-lg">
            <CardContent className="space-y-0.5 lg:space-y-1 text-xs lg:text-sm pt-6">
              <DetailItem 
                label="Class Teacher" 
                value={<span className="text-sm lg:text-base font-semibold">{classTeacher ? `${classTeacher.firstName} ${classTeacher.lastName}` : classDetail.classTeacherName || "N/A"}</span>} 
              />
              
              {/* Requirements and Subjects Buttons */}
              <div className="py-2 border-b border-border/50">
                <div className="flex gap-2">
                  <Button
                    onClick={() => router.push(`/class-requirements-tracking?classId=${classDetail.id}&className=${encodeURIComponent(classDetail.name)}`)}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                  >
                    <BookOpen className="mr-1 h-3 w-3" />
                    Requirements
                  </Button>
                  <Button
                    onClick={() => setShouldLoadSubjects(!shouldLoadSubjects)}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                  >
                    <BookOpen className="mr-1 h-3 w-3" />
                    {shouldLoadSubjects ? 'Hide Subjects' : 'Subjects'}
                  </Button>
                </div>
              </div>
              
              {/* Subjects List */}
              {shouldLoadSubjects && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Subjects & Teachers</div>
                  {subjectsLoading ? (
                    <div className="text-center py-4">
                      <div className="text-xs text-muted-foreground">Loading subjects...</div>
                    </div>
                  ) : subjectsWithTeacherNames.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {subjectsWithTeacherNames.map((subject) => (
                        <div key={subject.id} className="p-2 border rounded text-xs">
                          <div className="font-medium">{subject.name}</div>
                          <div className="text-muted-foreground">
                            <span className="font-medium">Code:</span> {subject.code} • 
                            <span className="font-medium"> Type:</span> {subject.type} • 
                            <span className="font-medium"> Teacher:</span> {subject.teacherName}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-xs text-muted-foreground">No subjects assigned to this class</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Exams Card - Desktop */}
          <Card className="shadow-lg hidden lg:block">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center">
                  <Calendar className="mr-2 h-4 w-4 text-primary" />
                  Class Exams
                </div>
                {shouldLoadExams && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShouldLoadExams(false)}
                    className="h-6 px-2 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Hide
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {!shouldLoadExams ? (
                <div className="text-center py-4">
                  <Button
                    onClick={() => setShouldLoadExams(true)}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    View Class Exams
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Click to load exam history for this class
                  </p>
                </div>
              ) : (
                <>
                  {/* Academic Year and Term filters */}
                  <div className="space-y-3 mb-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Academic Year</Label>
                      <Select 
                        value={examFilters.academicYearId} 
                        onValueChange={(value) => handleExamFilterChange('academicYearId', value)}
                        disabled={academicYears.length === 0}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-[200px] overflow-y-auto">
                          <SelectItem value="all">All Academic Years</SelectItem>
                          {academicYears.map(year => (
                            <SelectItem key={year.id} value={year.id}>
                              {year.name}{year.isActive ? ' (Active)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Term</Label>
                      <Select 
                        value={examFilters.termId} 
                        onValueChange={(value) => handleExamFilterChange('termId', value)}
                        disabled={terms.length === 0}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select Term" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-[200px] overflow-y-auto">
                          <SelectItem value="all">All Terms</SelectItem>
                          {terms
                            .filter(term => !examFilters.academicYearId || term.academicYearId === examFilters.academicYearId)
                            .map(term => (
                              <SelectItem key={term.id} value={term.id}>
                                {term.name}{term.isCurrent ? ' (Current)' : ''}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Exams List */}
                  {examsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-xs text-muted-foreground">Loading exams...</span>
                    </div>
                  ) : filteredExams.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {filteredExams.map((exam) => (
                        <div key={exam.id} className="p-2 border rounded text-xs">
                          <div className="font-medium">{exam.name}</div>
                          <div className="text-muted-foreground">
                            {exam.startDate ? new Date(exam.startDate).toLocaleDateString() : 'No date set'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-muted-foreground">No exams found for the selected filters.</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Exams Dropdown - Mobile */}
          <div className="block lg:hidden mt-4">
            <DetailItem
              label="Exams"
              value={
                <div className="flex items-center gap-1 lg:gap-2">
                  <span>{shouldLoadExams ? classExams.length : 'View'}</span>
                  {showExamsDropdown ? <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4" /> : <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4" />}
                </div>
              }
              clickable
              onClick={() => {
                if (!shouldLoadExams) {
                  setShouldLoadExams(true);
                }
                setShowExamsDropdown(!showExamsDropdown);
              }}
            />
            {showExamsDropdown && (
              <div className="mt-2 space-y-2">
                {/* Academic Year and Term filters - Mobile */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs font-medium">Academic Year</Label>
                    <Select 
                      value={examFilters.academicYearId} 
                      onValueChange={(value) => handleExamFilterChange('academicYearId', value)}
                      disabled={academicYears.length === 0}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-[200px] overflow-y-auto">
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
                    <Label className="text-xs font-medium">Term</Label>
                    <Select 
                      value={examFilters.termId} 
                      onValueChange={(value) => handleExamFilterChange('termId', value)}
                      disabled={terms.length === 0}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select Term" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-[200px] overflow-y-auto">
                        <SelectItem value="all">All Terms</SelectItem>
                        {terms
                          .filter(term => !examFilters.academicYearId || term.academicYearId === examFilters.academicYearId)
                          .map(term => (
                            <SelectItem key={term.id} value={term.id}>
                              {term.name}{term.isCurrent ? ' (Current)' : ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Hide Exams Button - Mobile */}
                {shouldLoadExams && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShouldLoadExams(false)}
                    className="w-full h-8 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Hide Exams
                  </Button>
                )}

                {/* Exams List - Mobile */}
                {shouldLoadExams && (
                  <>
                    {examsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-xs text-muted-foreground">Loading exams...</span>
                      </div>
                    ) : filteredExams.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {filteredExams.map((exam) => (
                          <div key={exam.id} className="p-2 border rounded text-xs">
                            <div className="font-medium">{exam.name}</div>
                            <div className="text-muted-foreground">
                              {exam.startDate ? new Date(exam.startDate).toLocaleDateString() : 'No date set'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground">No exams found for the selected filters.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Subjects Dropdown - Mobile */}
          <div className="block lg:hidden mt-4">
            <DetailItem
              label="Subjects"
              value={
                <div className="flex items-center gap-1 lg:gap-2">
                  <span>{shouldLoadSubjects ? subjectsWithTeacherNames.length : 'View'}</span>
                  <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4" />
                </div>
              }
              clickable
              onClick={() => setShouldLoadSubjects(!shouldLoadSubjects)}
            />
            {shouldLoadSubjects && (
              <div className="mt-2 space-y-2">
                {/* Hide Subjects Button - Mobile */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShouldLoadSubjects(false)}
                  className="w-full h-8 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Hide Subjects
                </Button>

                {/* Subjects List - Mobile */}
                {subjectsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-xs text-muted-foreground">Loading subjects...</span>
                  </div>
                ) : subjectsWithTeacherNames.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {subjectsWithTeacherNames.map((subject) => (
                      <div key={subject.id} className="p-2 border rounded text-xs">
                        <div className="font-medium">{subject.name}</div>
                        <div className="text-muted-foreground">
                          <span className="font-medium">Code:</span> {subject.code} • 
                          <span className="font-medium"> Type:</span> {subject.type} • 
                          <span className="font-medium"> Teacher:</span> {subject.teacherName}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground">No subjects assigned to this class.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Pupils List */}
        <div className="lg:col-span-2 space-y-3 lg:space-y-6 lg:overflow-y-auto">
          <Card className="shadow-lg">
            <CardHeader className="pb-2 lg:pb-6">
              <CardTitle className="flex items-center justify-between text-base lg:text-xl">
                <div className="flex items-center">
                  <Users className="mr-1.5 lg:mr-3 h-4 w-4 lg:h-6 lg:w-6 text-primary" />
                  Pupils ({filteredPupils.length})
                  <span className="lg:hidden ml-2 text-xs text-muted-foreground">
                    ({viewMode === 'list' ? 'List' : 'Tiles'} view)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Mode Toggle - Desktop Only */}
                  <div className="hidden lg:flex border rounded-md">
                    <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-r-none">List</Button>
                    <Button variant={viewMode === 'tiles' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('tiles')} className="rounded-l-none">Tiles</Button>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {pupilsLoading ? (
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
                      className="mt-2"
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
                      <div className="overflow-x-auto max-h-[calc(100vh-20rem)]">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-gradient-to-r from-muted/50 to-muted/30 sticky top-0 z-10">
                            <tr>
                              <th className="px-3 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider w-1/2">
                                <button 
                                  onClick={() => {
                                    if (sortBy === 'name') {
                                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                      setSortBy('name');
                                      setSortOrder('asc');
                                    }
                                  }}
                                  className="flex items-center space-x-2 hover:text-foreground transition-colors"
                                >
                                  <span>Pupil Details</span>
                                  <div className="w-1 h-1 bg-muted-foreground/30 rounded-full"></div>
                                  {sortBy === 'name' && (
                                    <span className="text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider w-20">
                                <button 
                                  onClick={() => {
                                    if (sortBy === 'section') {
                                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                      setSortBy('section');
                                      setSortOrder('asc');
                                    }
                                  }}
                                  className="hover:text-foreground transition-colors flex items-center space-x-1"
                                >
                                  <span>Section</span>
                                  {sortBy === 'section' && (
                                    <span className="text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider w-16">
                                <button 
                                  onClick={() => {
                                    if (sortBy === 'gender') {
                                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                      setSortBy('gender');
                                      setSortOrder('asc');
                                    }
                                  }}
                                  className="hover:text-foreground transition-colors flex items-center space-x-1"
                                >
                                  <span>Gender</span>
                                  {sortBy === 'gender' && (
                                    <span className="text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider w-12">
                                <button 
                                  onClick={() => {
                                    if (sortBy === 'age') {
                                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                      setSortBy('age');
                                      setSortOrder('asc');
                                    }
                                  }}
                                  className="hover:text-foreground transition-colors flex items-center space-x-1"
                                >
                                  <span>Age</span>
                                  {sortBy === 'age' && (
                                    <span className="text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider w-24">
                                Requirements
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {filteredPupils.map((pupil) => (
                              <PupilListRow 
                                key={pupil.id} 
                                pupil={pupil} 
                                onRequirementClick={handleRequirementClick}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Enhanced footer with better organization */}
                      <div className="px-3 py-2 bg-gradient-to-r from-muted/20 to-muted/10 border-t border-border/50">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
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
                    <div className="p-4 lg:p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredPupils.map((pupil) => (
                          <PupilCard key={pupil.id} pupil={pupil} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Requirement Reception Modal */}
      {selectedPupilForRequirements && (
        <RequirementReceptionModal
          isOpen={isRequirementModalOpen}
          onClose={handleCloseRequirementModal}
          pupil={selectedPupilForRequirements}
          classId={classId || ''}
          className={classDetail?.name || ''}
        />
      )}
    </>
  );
}

export default function ClassDetailPage() {
  return (
    <Suspense fallback={
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Loading Class Details..." />
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading class details...</span>
        </div>
      </div>
    }>
      <ClassDetailContent />
    </Suspense>
  );
}
