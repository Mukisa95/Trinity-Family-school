"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, Calendar, Users, ArrowLeft, Award, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GraduatedPupil, Class } from "@/types";
import { usePupils } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function GraduateClassPage() {
  const params = useParams();
  const classId = params.classId as string;
  
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  
  const [selectedYear, setSelectedYear] = React.useState<string>('all');
  
  // Get the current class
  const currentClass = React.useMemo(() => 
    allClasses.find(c => c.id === classId),
    [allClasses, classId]
  );

  // Get graduated pupils from this class
  const graduatedPupils = React.useMemo(() => {
    return allPupils.filter(pupil => 
      pupil.status === 'Graduated' && 
      pupil.graduationClassId === classId
    ) as GraduatedPupil[];
  }, [allPupils, classId]);

  // Group graduates by year
  const graduatesByYear = React.useMemo(() => {
    const grouped: Record<number, GraduatedPupil[]> = {};
    graduatedPupils.forEach(pupil => {
      if (pupil.graduationYear) {
        if (!grouped[pupil.graduationYear]) {
          grouped[pupil.graduationYear] = [];
        }
        grouped[pupil.graduationYear].push(pupil);
      }
    });
    
    // Sort pupils within each year by name
    Object.keys(grouped).forEach(year => {
      grouped[parseInt(year)].sort((a, b) => 
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      );
    });
    
    return grouped;
  }, [graduatedPupils]);

  // Get available years
  const availableYears = React.useMemo(() => {
    return Object.keys(graduatesByYear)
      .map(year => parseInt(year))
      .sort((a, b) => b - a); // Most recent first
  }, [graduatesByYear]);

  // Filter graduates by selected year
  const filteredGraduates = React.useMemo(() => {
    if (selectedYear === 'all') {
      return graduatedPupils.sort((a, b) => 
        (b.graduationYear || 0) - (a.graduationYear || 0) ||
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      );
    }
    return graduatesByYear[parseInt(selectedYear)] || [];
  }, [selectedYear, graduatedPupils, graduatesByYear]);

  const handleExportGraduates = () => {
    // TODO: Implement export functionality
    console.log('Export graduates for year:', selectedYear);
  };

  if (pupilsLoading || classesLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Graduate Class" />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading graduates...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentClass) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Graduate Class" />
        <Card className="p-8 text-center">
          <div className="text-red-600 mb-4">
            <GraduationCap className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Class Not Found</h3>
          <p className="text-gray-600 mb-4">The requested class could not be found.</p>
          <Button asChild>
            <Link href="/classes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Classes
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Graduate Class</h1>
              <p className="text-sm text-gray-600">{currentClass.name} ({currentClass.code})</p>
            </div>
          </div>
        }
        description={`View all graduates from ${currentClass.name} organized by graduation year`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" asChild>
              <Link href="/classes">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Classes
              </Link>
            </Button>
            {filteredGraduates.length > 0 && (
              <Button onClick={handleExportGraduates} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export List
              </Button>
            )}
          </div>
        }
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Total Graduates</p>
                <p className="text-2xl font-bold text-green-700">{graduatedPupils.length}</p>
              </div>
              <Award className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Graduation Years</p>
                <p className="text-2xl font-bold text-blue-700">{availableYears.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Latest Batch</p>
                <p className="text-2xl font-bold text-purple-700">
                  {availableYears.length > 0 ? availableYears[0] : 'N/A'}
                </p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Year Filter Dropdown */}
      {availableYears.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border-blue-100/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Filter by Graduation Year:</span>
              </div>
              <div className="flex items-center gap-3">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select graduation year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years ({graduatedPupils.length} total)</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        Class of {year} ({graduatesByYear[year]?.length || 0} graduates)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedYear !== 'all' && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {filteredGraduates.length} graduates
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Graduates Display */}
      {graduatedPupils.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Graduates Yet</h3>
          <p className="text-gray-600 mb-4">
            {currentClass.name} doesn't have any graduated pupils yet.
          </p>
          <Button asChild variant="outline">
            <Link href="/pupils/promote">
              <GraduationCap className="mr-2 h-4 w-4" />
              Graduate Pupils
            </Link>
          </Button>
        </Card>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedYear}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                    <Award className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="flex-1">
                    {selectedYear === 'all' ? 'All Graduates' : `Class of ${selectedYear}`}
                  </CardTitle>
                  <Badge variant="secondary">{filteredGraduates.length} graduates</Badge>
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
                        <TableHead>Section</TableHead>
                        <TableHead>Graduation Year</TableHead>
                        <TableHead>Graduation Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGraduates.map((pupil, index) => (
                        <TableRow key={pupil.id} className="hover:bg-yellow-50/50">
                          <TableCell className="font-medium text-gray-500">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-medium text-sm">
                                  {pupil.firstName[0]}{pupil.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {pupil.firstName} {pupil.lastName}
                                </p>
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
                            {pupil.section ? (
                              <Badge variant="outline" className="text-xs">
                                {pupil.section}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-sm">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <GraduationCap className="w-4 h-4 text-yellow-600" />
                              <span className="font-medium text-yellow-700">
                                {pupil.graduationYear || 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {pupil.graduationDate ? 
                              new Date(pupil.graduationDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              }) : 'N/A'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
} 