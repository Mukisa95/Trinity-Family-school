"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Calendar, Users, ArrowLeft, User, Loader2, Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { Pupil, Class, AcademicYear } from "@/types";
import { usePupils } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { detectCurrentAcademicYear } from "@/lib/utils/academic-year-utils";
import Link from "next/link";

interface HistoricalPupil {
  pupil: Pupil;
  wasInClassDuringYear: boolean;
  termsInClass: string[]; // Term IDs where pupil was in this class
}

export default function ClassHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;

  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  const { data: academicYears = [], isLoading: yearsLoading } = useAcademicYears();

  const [selectedAcademicYearId, setSelectedAcademicYearId] = React.useState<string>('');
  const [searchQuery, setSearchQuery] = React.useState('');

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
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only

    return academicYears
      .filter(year => {
        const yearStartDate = new Date(year.startDate);
        yearStartDate.setHours(0, 0, 0, 0);
        // Only include years that have started (including today)
        return yearStartDate <= today;
      })
      .sort((a, b) => {
        const dateA = new Date(a.startDate).getTime();
        const dateB = new Date(b.startDate).getTime();
        return dateB - dateA; // Newest first
      });
  }, [academicYears]);

  // Function to check if a pupil was in the class during the selected academic year
  const getHistoricalPupils = React.useMemo((): HistoricalPupil[] => {
    if (!selectedAcademicYear || !classId) return [];

    const historicalPupils: HistoricalPupil[] = [];
    const academicYearStart = new Date(selectedAcademicYear.startDate);
    const academicYearEnd = new Date(selectedAcademicYear.endDate);

    allPupils.forEach(pupil => {
      // Get all terms in the selected academic year
      const termsInYear = selectedAcademicYear.terms || [];
      const termsInClass: string[] = [];

      // Check if pupil was registered before or during the academic year
      const registrationDate = pupil.registrationDate ? new Date(pupil.registrationDate) : null;
      const academicYearEnd = new Date(selectedAcademicYear.endDate);
      const wasRegisteredDuringYear = !registrationDate || registrationDate <= academicYearEnd;

      if (!wasRegisteredDuringYear) {
        // Skip this pupil - they weren't registered during this academic year
        return;
      }

      // Check each term in the academic year
      for (const term of termsInYear) {
        const termStart = new Date(term.startDate);
        const termEnd = new Date(term.endDate);

        // Check if pupil was registered before or during this term
        const wasRegisteredDuringTerm = !registrationDate || registrationDate <= termEnd;

        if (!wasRegisteredDuringTerm) {
          // Pupil wasn't registered yet during this term - skip this term
          continue;
        }

        // Determine which class the pupil was in during this term
        let classIdDuringTerm: string | null = null;

        if (pupil.promotionHistory && pupil.promotionHistory.length > 0) {
          // Sort promotion history by date
          const sortedPromotions = [...pupil.promotionHistory].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          // Start with the class they were in before any promotions (if available)
          // or their current class as fallback
          let classIdAtTermStart = pupil.classId;

          // Find the last promotion before or at the start of the term
          for (const promotion of sortedPromotions) {
            const promotionDate = new Date(promotion.date);

            if (promotionDate <= termStart) {
              // Promotion happened before or at term start
              classIdAtTermStart = promotion.toClassId;
            } else if (promotionDate > termStart && promotionDate <= termEnd) {
              // Promotion happened during the term
              // For most of the term, they were in the "from" class
              classIdAtTermStart = promotion.fromClassId || promotion.toClassId;
              break;
            } else {
              // Promotion happened after term ended - stop looking
              break;
            }
          }

          classIdDuringTerm = classIdAtTermStart;
        } else {
          // No promotion history - check if they were registered during the term
          // If registered, assume they were in their current class (or initial placement class)
          classIdDuringTerm = pupil.classId;
        }

        // Check if pupil was in this class during this term
        if (classIdDuringTerm === classId) {
          termsInClass.push(term.id);
        }
      }

      // If pupil was in the class during any term of the academic year
      if (termsInClass.length > 0) {
        historicalPupils.push({
          pupil,
          wasInClassDuringYear: true,
          termsInClass
        });
      }
    });

    // Sort by pupil name
    return historicalPupils.sort((a, b) => {
      const nameA = `${a.pupil.firstName} ${a.pupil.lastName}`.toLowerCase();
      const nameB = `${b.pupil.firstName} ${b.pupil.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [allPupils, selectedAcademicYear, classId]);

  // Filter pupils by search query
  const filteredPupils = React.useMemo(() => {
    if (!searchQuery.trim()) return getHistoricalPupils;

    const query = searchQuery.toLowerCase();
    return getHistoricalPupils.filter(hp => {
      const p = hp.pupil;
      const fullName = `${p.firstName} ${p.lastName} ${p.otherNames || ''}`.toLowerCase();
      const admissionNumber = p.admissionNumber.toLowerCase();
      const currentClassName = p.className?.toLowerCase() || '';

      return fullName.includes(query) ||
        admissionNumber.includes(query) ||
        currentClassName.includes(query);
    });
  }, [getHistoricalPupils, searchQuery]);

  // Set default academic year to the current active year, or most recent past year
  React.useEffect(() => {
    if (sortedAcademicYears.length > 0 && !selectedAcademicYearId) {
      // First try to find the active academic year
      const activeYear = detectCurrentAcademicYear(sortedAcademicYears);
      if (activeYear) {
        setSelectedAcademicYearId(activeYear.id);
      } else {
        // Otherwise use the most recent year (first in sorted list)
        setSelectedAcademicYearId(sortedAcademicYears[0].id);
      }
    }
  }, [sortedAcademicYears, selectedAcademicYearId]);

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
      ) : filteredPupils.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pupils Found</h3>
          <p className="text-gray-600">
            {searchQuery
              ? `No pupils found matching "${searchQuery}" in ${currentClass.name} for ${selectedAcademicYear.name}.`
              : `No pupils were in ${currentClass.name} during ${selectedAcademicYear.name}.`
            }
          </p>
          {searchQuery && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setSearchQuery('')}
            >
              Clear Search
            </Button>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <CardTitle>
                  Class History - {selectedAcademicYear.name}
                </CardTitle>
              </div>
              <Badge variant="secondary">{filteredPupils.length} pupil{filteredPupils.length !== 1 ? 's' : ''}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Pupil</TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Current Status</TableHead>
                    <TableHead>Current Class</TableHead>
                    <TableHead>Terms in Class</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPupils.map((historicalPupil, index) => {
                    const pupil = historicalPupil.pupil;
                    const currentClass = allClasses.find(c => c.id === pupil.classId);
                    const statusColors = {
                      'Active': 'bg-green-100 text-green-800 border-green-200',
                      'Inactive': 'bg-gray-100 text-gray-800 border-gray-200',
                      'Graduated': 'bg-yellow-100 text-yellow-800 border-yellow-200',
                      'Transferred': 'bg-blue-100 text-blue-800 border-blue-200',
                    };
                    const statusColor = statusColors[pupil.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';

                    return (
                      <TableRow key={pupil.id} className="hover:bg-blue-50/50">
                        <TableCell className="font-medium text-gray-500">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
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
                                className="font-semibold text-gray-900 hover:text-blue-600 hover:underline transition-colors"
                              >
                                {pupil.firstName} {pupil.lastName}
                              </Link>
                              {pupil.otherNames && (
                                <p className="text-sm text-gray-500">{pupil.otherNames}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {pupil.admissionNumber}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {pupil.gender || 'N/A'}
                          </Badge>
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
                          {currentClass ? (
                            <Link
                              href={`/class-detail?id=${currentClass.id}`}
                              className="text-sm font-medium text-blue-600 hover:underline"
                            >
                              {currentClass.code || currentClass.name}
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-400">Not Assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {historicalPupil.termsInClass.map(termId => {
                              const term = selectedAcademicYear.terms.find(t => t.id === termId);
                              return term ? (
                                <Badge
                                  key={termId}
                                  variant="outline"
                                  className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                >
                                  {term.name}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

