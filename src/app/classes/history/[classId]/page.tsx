"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import * as React from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Calendar, Users, ArrowLeft, User, Loader2, Search, X, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { Pupil, Class, AcademicYear } from "@/types";
import { usePupils } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { detectCurrentAcademicYear } from "@/lib/utils/academic-year-utils";
import Link from "next/link";
import { format } from "date-fns";

interface HistoricalPupil {
  pupil: Pupil;
  wasInClassDuringYear: boolean;
  termsInClass: string[]; // Term IDs where pupil was in this class
  joinedDate: string | null; // registrationDate
  joinedClassId: string | null; // class at registration time
}

type SortField = 'name' | 'admissionNumber' | 'gender' | 'terms' | 'status' | 'joined';
type SortDir = 'asc' | 'desc';

export default function ClassHistoryPage() {
  const params = useParams();
  const classId = params.classId as string;

  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  const { data: academicYears = [], isLoading: yearsLoading } = useAcademicYears();

  const [selectedAcademicYearId, setSelectedAcademicYearId] = React.useState<string>('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortField, setSortField] = React.useState<SortField>('name');
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');
  const [filterGender, setFilterGender] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [showFilters, setShowFilters] = React.useState(false);

  // Get the current class
  const currentClass = React.useMemo(() =>
    allClasses.find(c => c.id === classId),
    [allClasses, classId]
  );

  // Get selected academic year
  const selectedAcademicYear = React.useMemo(() =>
    academicYears.find(y => y.id === selectedAcademicYearId),
    [academicYears, selectedAcademicYearId]
  );

  // Filter and sort academic years - only show current and past years (not future)
  const sortedAcademicYears = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return academicYears
      .filter(year => {
        const yearStartDate = new Date(year.startDate);
        yearStartDate.setHours(0, 0, 0, 0);
        return yearStartDate <= today;
      })
      .sort((a, b) => {
        const dateA = new Date(a.startDate).getTime();
        const dateB = new Date(b.startDate).getTime();
        return dateB - dateA; // Newest first
      });
  }, [academicYears]);

  // Helper: get the class a pupil was in at a specific date, using their promotionHistory
  const getClassIdAtDate = (pupil: Pupil, targetDate: Date): string => {
    if (!pupil.promotionHistory || pupil.promotionHistory.length === 0) {
      return pupil.classId;
    }
    const sorted = [...pupil.promotionHistory].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let classIdAtDate = pupil.classId;
    for (const p of sorted) {
      if (new Date(p.date) <= targetDate) {
        classIdAtDate = p.toClassId;
      } else {
        break;
      }
    }
    return classIdAtDate;
  };

  // Build historical pupils list
  const getHistoricalPupils = React.useMemo((): HistoricalPupil[] => {
    if (!selectedAcademicYear || !classId) return [];

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const historicalPupils: HistoricalPupil[] = [];
    const academicYearEnd = new Date(selectedAcademicYear.endDate);

    allPupils.forEach(pupil => {
      const termsInYear = selectedAcademicYear.terms || [];
      const termsInClass: string[] = [];

      const registrationDate = pupil.registrationDate ? new Date(pupil.registrationDate) : null;
      const wasRegisteredDuringYear = !registrationDate || registrationDate <= academicYearEnd;

      if (!wasRegisteredDuringYear) return;

      // Check each term
      for (const term of termsInYear) {
        const termStart = new Date(term.startDate);
        const termEnd = new Date(term.endDate);

        // Don't include terms that haven't started yet (relative to today)
        if (termStart > today) continue;

        // Skip if pupil wasn't registered before the term ended
        const wasRegisteredDuringTerm = !registrationDate || registrationDate <= termEnd;
        if (!wasRegisteredDuringTerm) continue;

        // Determine which class the pupil was in during this term
        let classIdDuringTerm: string | null = null;

        if (pupil.promotionHistory && pupil.promotionHistory.length > 0) {
          const sortedPromotions = [...pupil.promotionHistory].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          let classIdAtTermStart = pupil.classId;

          for (const promotion of sortedPromotions) {
            const promotionDate = new Date(promotion.date);
            if (promotionDate <= termStart) {
              classIdAtTermStart = promotion.toClassId;
            } else if (promotionDate > termStart && promotionDate <= termEnd) {
              classIdAtTermStart = promotion.fromClassId || promotion.toClassId;
              break;
            } else {
              break;
            }
          }

          classIdDuringTerm = classIdAtTermStart;
        } else {
          classIdDuringTerm = pupil.classId;
        }

        if (classIdDuringTerm === classId) {
          termsInClass.push(term.id);
        }
      }

      if (termsInClass.length > 0) {
        // Determine which class the pupil was in when they first joined the school
        const joinedDate = pupil.registrationDate ?? null;
        let joinedClassId: string | null = null;

        if (joinedDate) {
          const regDate = new Date(joinedDate);
          // Class at registration = earliest promotion "toClassId" at or just after registration,
          // or simply the class before any promotions
          if (pupil.promotionHistory && pupil.promotionHistory.length > 0) {
            const sorted = [...pupil.promotionHistory].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            // Initial placement is before first promotion
            const firstPromotion = sorted[0];
            const firstPromotionDate = new Date(firstPromotion.date);
            if (regDate < firstPromotionDate) {
              // Registered before first promotion — initial class is fromClassId of first promotion
              joinedClassId = firstPromotion.fromClassId ?? firstPromotion.toClassId;
            } else {
              // Registered at or after first promotion — find class at registration date
              joinedClassId = getClassIdAtDate(pupil, regDate);
            }
          } else {
            joinedClassId = pupil.classId;
          }
        }

        historicalPupils.push({
          pupil,
          wasInClassDuringYear: true,
          termsInClass,
          joinedDate,
          joinedClassId,
        });
      }
    });

    return historicalPupils;
  }, [allPupils, selectedAcademicYear, classId]);

  // Sort helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-blue-600" />
      : <ArrowDown className="h-3 w-3 text-blue-600" />;
  };

  // Filter & sort
  const filteredAndSorted = React.useMemo(() => {
    let list = [...getHistoricalPupils];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(hp => {
        const p = hp.pupil;
        const full = `${p.firstName} ${p.lastName} ${p.otherNames || ''}`.toLowerCase();
        return full.includes(q) || p.admissionNumber.toLowerCase().includes(q);
      });
    }

    // Gender filter
    if (filterGender !== 'all') {
      list = list.filter(hp => hp.pupil.gender === filterGender);
    }

    // Status filter
    if (filterStatus !== 'all') {
      list = list.filter(hp => hp.pupil.status === filterStatus);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = `${a.pupil.firstName} ${a.pupil.lastName}`.localeCompare(`${b.pupil.firstName} ${b.pupil.lastName}`);
          break;
        case 'admissionNumber':
          cmp = a.pupil.admissionNumber.localeCompare(b.pupil.admissionNumber);
          break;
        case 'gender':
          cmp = (a.pupil.gender || '').localeCompare(b.pupil.gender || '');
          break;
        case 'terms':
          cmp = a.termsInClass.length - b.termsInClass.length;
          break;
        case 'status':
          cmp = (a.pupil.status || '').localeCompare(b.pupil.status || '');
          break;
        case 'joined':
          cmp = (a.joinedDate || '').localeCompare(b.joinedDate || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [getHistoricalPupils, searchQuery, filterGender, filterStatus, sortField, sortDir]);

  // Set default academic year to current active year
  React.useEffect(() => {
    if (sortedAcademicYears.length > 0 && !selectedAcademicYearId) {
      const activeYear = detectCurrentAcademicYear(sortedAcademicYears);
      if (activeYear) {
        setSelectedAcademicYearId(activeYear.id);
      } else {
        setSelectedAcademicYearId(sortedAcademicYears[0].id);
      }
    }
  }, [sortedAcademicYears, selectedAcademicYearId]);

  // Helper: extract term number from term name or ID
  const getTermNumber = (termId: string): string => {
    if (!selectedAcademicYear) return termId;
    const term = selectedAcademicYear.terms.find(t => t.id === termId);
    if (!term) return termId;
    // Extract digit from name e.g. "Term 1" -> "1", "Term Two" -> use position
    const match = term.name.match(/\d+/);
    if (match) return match[0];
    // Fallback: position in terms array
    const idx = selectedAcademicYear.terms.findIndex(t => t.id === termId);
    return idx >= 0 ? String(idx + 1) : termId;
  };

  if (pupilsLoading || classesLoading || yearsLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Class History" />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading class history...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentClass) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Class History" />
        <Card className="p-8 text-center">
          <div className="text-red-600 mb-4">
            <History className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Class Not Found</h3>
          <p className="text-gray-600 mb-4">The requested class could not be found.</p>
          <SmartBackButton fallbackHref="/classes" className="mr-2 h-4 w-4">
  <ArrowLeft className="mr-2 h-4 w-4" />
  Back to Classes
</SmartBackButton>
        </Card>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    'Active': 'bg-green-100 text-green-800 border-green-200',
    'Inactive': 'bg-gray-100 text-gray-800 border-gray-200',
    'Graduated': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Transferred': 'bg-blue-100 text-blue-800 border-blue-200',
    'Suspended': 'bg-red-100 text-red-800 border-red-200',
    'Pending': 'bg-amber-100 text-amber-800 border-amber-200',
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <History className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Class History</h1>
              <p className="text-sm text-gray-600">{currentClass.name} ({currentClass.code})</p>
            </div>
          </div>
        }
        description={`View pupils who were in ${currentClass.name} during past academic years`}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/class-detail?id=${classId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Class Details
            </Link>
          </Button>
        }
      />

      {/* Filters */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="academicYear" className="text-sm font-medium text-gray-700">
                Academic Year
              </Label>
              <Select
                value={selectedAcademicYearId}
                onValueChange={setSelectedAcademicYearId}
              >
                <SelectTrigger id="academicYear" className="bg-white">
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {sortedAcademicYears.map(year => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name} {year.isActive ? '(Active)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search" className="text-sm font-medium text-gray-700">
                Search Pupils
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by name, admission number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 bg-white"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {selectedAcademicYear && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Pupils</p>
                  <p className="text-2xl font-bold text-blue-700">{getHistoricalPupils.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Still Active</p>
                  <p className="text-2xl font-bold text-green-700">
                    {getHistoricalPupils.filter(hp => hp.pupil.status === 'Active').length}
                  </p>
                </div>
                <User className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Selected Year</p>
                  <p className="text-lg font-bold text-purple-700">
                    {selectedAcademicYear.name}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pupils Table */}
      {!selectedAcademicYear ? (
        <Card className="p-8 text-center">
          <History className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select an Academic Year</h3>
          <p className="text-gray-600">Please select an academic year to view class history.</p>
        </Card>
      ) : filteredAndSorted.length === 0 && getHistoricalPupils.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pupils Found</h3>
          <p className="text-gray-600">
            No pupils were in {currentClass.name} during {selectedAcademicYear.name}.
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <CardTitle>
                  Class History — {selectedAcademicYear.name}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{filteredAndSorted.length} / {getHistoricalPupils.length} pupil{getHistoricalPupils.length !== 1 ? 's' : ''}</Badge>
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="h-8 gap-1.5 text-xs rounded-full"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                </Button>
              </div>
            </div>

            {/* Inline filter row */}
            {showFilters && (
              <div className="mt-3 flex items-end gap-3 flex-wrap animate-in slide-in-from-top-1 fade-in duration-150">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Gender</Label>
                  <Select value={filterGender} onValueChange={setFilterGender}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Graduated">Graduated</SelectItem>
                      <SelectItem value="Transferred">Transferred</SelectItem>
                      <SelectItem value="Suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(filterGender !== 'all' || filterStatus !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs rounded-full text-muted-foreground"
                    onClick={() => { setFilterGender('all'); setFilterStatus('all'); }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-0">
            {filteredAndSorted.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No pupils match the current filters.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearchQuery(''); setFilterGender('all'); setFilterStatus('all'); }}>
                  Clear all filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead className="w-[40px] text-xs">#</TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('name')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors font-semibold text-xs uppercase tracking-wide"
                        >
                          Pupil <SortIcon field="name" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('admissionNumber')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors font-semibold text-xs uppercase tracking-wide"
                        >
                          Adm. No. <SortIcon field="admissionNumber" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('gender')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors font-semibold text-xs uppercase tracking-wide"
                        >
                          Gender <SortIcon field="gender" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('joined')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors font-semibold text-xs uppercase tracking-wide"
                        >
                          Joined School <SortIcon field="joined" />
                        </button>
                      </TableHead>
                      <TableHead>Current Class</TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('status')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors font-semibold text-xs uppercase tracking-wide"
                        >
                          Status <SortIcon field="status" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('terms')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors font-semibold text-xs uppercase tracking-wide"
                        >
                          Terms in Class <SortIcon field="terms" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSorted.map((historicalPupil, index) => {
                      const pupil = historicalPupil.pupil;
                      const pupilCurrentClass = allClasses.find(c => c.id === pupil.classId);
                      const joinedClass = historicalPupil.joinedClassId
                        ? allClasses.find(c => c.id === historicalPupil.joinedClassId)
                        : null;
                      const statusColor = statusColors[pupil.status as string] || 'bg-gray-100 text-gray-800';

                      return (
                        <TableRow key={pupil.id} className="hover:bg-blue-50/50">
                          <TableCell className="font-medium text-gray-400 text-xs">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 flex-shrink-0">
                                {pupil.photo && pupil.photo.trim() !== '' ? (
                                  <AvatarImage
                                    src={pupil.photo}
                                    alt={`${pupil.firstName} ${pupil.lastName}`}
                                    className="object-cover"
                                  />
                                ) : null}
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-medium text-sm">
                                  {pupil.firstName[0]}{pupil.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <Link
                                  href={`/pupil-detail?id=${pupil.id}`}
                                  className="font-semibold text-gray-900 hover:text-blue-600 hover:underline transition-colors text-sm"
                                >
                                  {pupil.firstName} {pupil.lastName}
                                </Link>
                                {pupil.otherNames && (
                                  <p className="text-xs text-gray-400">{pupil.otherNames}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-gray-600">
                            {pupil.admissionNumber}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {pupil.gender || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {historicalPupil.joinedDate ? (
                              <div className="text-xs">
                                <div className="font-medium text-gray-800">
                                  {(() => {
                                    try {
                                      return format(new Date(historicalPupil.joinedDate), 'dd MMM yyyy');
                                    } catch {
                                      return historicalPupil.joinedDate;
                                    }
                                  })()}
                                </div>
                                {joinedClass && (
                                  <div className="text-gray-500 mt-0.5">
                                    in{' '}
                                    <Link
                                      href={`/class-detail?id=${joinedClass.id}`}
                                      className="text-blue-500 hover:underline font-medium"
                                    >
                                      {joinedClass.name}
                                    </Link>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Not recorded</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {pupilCurrentClass ? (
                              <Link
                                href={`/class-detail?id=${pupilCurrentClass.id}`}
                                className="text-sm font-medium text-blue-600 hover:underline"
                              >
                                {pupilCurrentClass.name}
                              </Link>
                            ) : (
                              <span className="text-sm text-gray-400">Not Assigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs border ${statusColor}`}
                            >
                              {pupil.status || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {historicalPupil.termsInClass.map(termId => {
                                const termNum = getTermNumber(termId);
                                return (
                                  <Badge
                                    key={termId}
                                    variant="outline"
                                    className="text-xs bg-blue-50 text-blue-700 border-blue-200 min-w-[1.5rem] justify-center"
                                    title={selectedAcademicYear.terms.find(t => t.id === termId)?.name}
                                  >
                                    {termNum}
                                  </Badge>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
