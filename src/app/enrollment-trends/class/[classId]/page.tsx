"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import * as React from "react";
import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useProgressiveDashboard } from "@/lib/hooks/use-progressive-dashboard";
import {
    ArrowLeft,
    Users,
    Search,
    ArrowUpDown,
    Download,
    Filter,
    UserCheck,
    Sparkles,
    Activity
} from "lucide-react";
import { format, differenceInYears, parseISO } from "date-fns";

type SortField = "name" | "admissionNumber" | "registrationDate" | "age";
type SortOrder = "asc" | "desc";

export default function ClassEnrollmentDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const classId = params.classId as string;

    const { pupils, classes, pupilsLoading, classesLoading } = useProgressiveDashboard();

    // Filter states
    const [searchTerm, setSearchTerm] = useState("");
    const [genderFilter, setGenderFilter] = useState("all");
    const [sectionFilter, setSectionFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    const [sortField, setSortField] = useState<SortField>("name");
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
    const [currentPage, setCurrentPage] = useState(1);
    const [recordsPerPage, setRecordsPerPage] = useState(50);

    // Get current class info
    const currentClass = useMemo(() => {
        if (!classes || !classId) return null;
        return classes.find(c => c.id === classId);
    }, [classes, classId]);

    // Process and filter pupils for this class
    const classPupils = useMemo(() => {
        if (!pupils || !classId) return [];

        return pupils
            .filter(p => p.classId === classId)
            .map(pupil => {
                let age = "N/A";
                let ageNum = -1;
                if (pupil.dateOfBirth) {
                    const dob = parseISO(pupil.dateOfBirth);
                    ageNum = differenceInYears(new Date(), dob);
                    age = `${ageNum} yrs`;
                }

                const regDate = pupil.registrationDate ? new Date(pupil.registrationDate) : null;

                return {
                    id: pupil.id,
                    name: `${pupil.lastName} ${pupil.firstName} ${pupil.otherNames || ""}`.trim(),
                    firstName: pupil.firstName,
                    lastName: pupil.lastName,
                    admissionNumber: pupil.admissionNumber || 'N/A',
                    gender: pupil.gender || 'N/A',
                    section: pupil.section || 'N/A',
                    age: age,
                    ageNum: ageNum,
                    status: pupil.status || 'Active',
                    registrationDate: pupil.registrationDate,
                    formattedDate: regDate ? format(regDate, "MMM dd, yyyy") : 'Unknown'
                };
            });
    }, [pupils, classId]);

    // Filter and sort data
    const filteredData = useMemo(() => {
        let filtered = classPupils;

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(item =>
                item.name.toLowerCase().includes(term) ||
                item.admissionNumber.toLowerCase().includes(term)
            );
        }

        if (genderFilter !== "all") {
            filtered = filtered.filter(item => item.gender.toLowerCase() === genderFilter.toLowerCase());
        }

        if (sectionFilter !== "all") {
            filtered = filtered.filter(item => item.section.toLowerCase() === sectionFilter.toLowerCase());
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter(item => item.status.toLowerCase() === statusFilter.toLowerCase());
        }

        // Sort data
        filtered.sort((a, b) => {
            let aValue, bValue;

            switch (sortField) {
                case "name":
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case "admissionNumber":
                    aValue = a.admissionNumber.toLowerCase();
                    bValue = b.admissionNumber.toLowerCase();
                    break;
                case "registrationDate":
                    aValue = a.registrationDate ? new Date(a.registrationDate).getTime() : 0;
                    bValue = b.registrationDate ? new Date(b.registrationDate).getTime() : 0;
                    break;
                case "age":
                    aValue = a.ageNum;
                    bValue = b.ageNum;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
            if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [classPupils, searchTerm, genderFilter, sectionFilter, statusFilter, sortField, sortOrder]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
        setCurrentPage(1);
    };

    // Pagination calculations
    const totalPages = Math.ceil(filteredData.length / recordsPerPage);
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    const currentPageData = filteredData.slice(startIndex, endIndex);

    // Reset pagination when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, genderFilter, sectionFilter, statusFilter]);

    const exportData = () => {
        const csvContent = [
            ["Name", "Admission Number", "Gender", "Section", "Age", "Status", "Registration Date"].join(","),
            ...filteredData.map(item => [
                `"${item.name}"`,
                item.admissionNumber,
                item.gender,
                item.section,
                item.age,
                item.status,
                item.formattedDate
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `class-${currentClass?.name || 'enrollment'}-students-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (pupilsLoading || classesLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center space-y-4">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                            <Sparkles className="w-6 h-6 text-blue-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-gray-700">Loading Class Data</h3>
                            <p className="text-sm text-gray-500">Fetching pupil records...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const classNameStr = currentClass?.name || currentClass?.code || "Class Details";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-3 md:p-4 pb-24">
            <div className="max-w-7xl mx-auto space-y-4">
                {/* Header styling consistent with other pages */}
                <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <SmartBackButton fallbackHref="/enrollment-trends" className="bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full w-10 h-10 shadow-sm">
  <ArrowLeft className="w-5 h-5" />
  
</SmartBackButton>
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                                        <Users className="w-6 h-6 text-blue-600" />
                                        {classNameStr} Enrollment
                                    </h1>
                                    <p className="text-sm text-gray-600">{classPupils.length} Total Enrolled Pupils</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={exportData}
                                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-sm"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    <span className="hidden sm:inline">Export List</span>
                                </Button>
                            </div>
                        </div>

                        {/* Filters Row */}
                        <div className="mt-4 p-4 bg-white/60 rounded-xl border border-white/30 shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="search" className="text-sm font-medium text-gray-700">Search Pupils</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            id="search"
                                            placeholder="Name or admission #"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 bg-white border-gray-200"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="gender-select" className="text-sm font-medium text-gray-700">Gender</Label>
                                    <Select value={genderFilter} onValueChange={setGenderFilter}>
                                        <SelectTrigger id="gender-select" className="bg-white border-gray-200">
                                            <SelectValue placeholder="All Genders" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Genders</SelectItem>
                                            <SelectItem value="male">Male</SelectItem>
                                            <SelectItem value="female">Female</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="section-select" className="text-sm font-medium text-gray-700">Section</Label>
                                    <Select value={sectionFilter} onValueChange={setSectionFilter}>
                                        <SelectTrigger id="section-select" className="bg-white border-gray-200">
                                            <SelectValue placeholder="All Sections" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Sections</SelectItem>
                                            <SelectItem value="day">Day</SelectItem>
                                            <SelectItem value="boarding">Boarding</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="status-select" className="text-sm font-medium text-gray-700">Status</Label>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger id="status-select" className="bg-white border-gray-200">
                                            <SelectValue placeholder="All Statuses" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Statuses</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Table Content */}
                <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-gray-200 bg-gray-50/80">
                                        <TableHead className="py-3">
                                            <Button
                                                variant="ghost"
                                                onClick={() => handleSort("name")}
                                                className="h-auto p-0 font-semibold hover:bg-transparent text-gray-700 text-sm"
                                            >
                                                Pupil Name
                                                <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-gray-400" />
                                            </Button>
                                        </TableHead>
                                        <TableHead className="py-3">
                                            <Button
                                                variant="ghost"
                                                onClick={() => handleSort("admissionNumber")}
                                                className="h-auto p-0 font-semibold hover:bg-transparent text-gray-700 text-sm"
                                            >
                                                Admission #
                                                <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-gray-400" />
                                            </Button>
                                        </TableHead>
                                        <TableHead className="text-gray-700 font-semibold text-sm py-3">Gender</TableHead>
                                        <TableHead className="text-gray-700 font-semibold text-sm py-3">Section</TableHead>
                                        <TableHead className="py-3">
                                            <Button
                                                variant="ghost"
                                                onClick={() => handleSort("age")}
                                                className="h-auto p-0 font-semibold hover:bg-transparent text-gray-700 text-sm"
                                            >
                                                Age
                                                <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-gray-400" />
                                            </Button>
                                        </TableHead>
                                        <TableHead className="text-gray-700 font-semibold text-sm py-3">Status</TableHead>
                                        <TableHead className="py-3">
                                            <Button
                                                variant="ghost"
                                                onClick={() => handleSort("registrationDate")}
                                                className="h-auto p-0 font-semibold hover:bg-transparent text-gray-700 text-sm"
                                            >
                                                Enrolled On
                                                <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-gray-400" />
                                            </Button>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentPageData.length > 0 ? (
                                        currentPageData.map((student) => (
                                            <TableRow key={student.id} className="hover:bg-blue-50/50 border-gray-100 transition-colors">
                                                <TableCell className="font-semibold text-gray-900 py-3">{student.name}</TableCell>
                                                <TableCell className="text-gray-600 py-3 font-medium">{student.admissionNumber}</TableCell>
                                                <TableCell className="py-3">
                                                    <Badge variant="outline" className={`text-xs ${student.gender === 'Male'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : student.gender === 'Female'
                                                                ? 'bg-pink-50 text-pink-700 border-pink-200'
                                                                : 'bg-gray-50 text-gray-700 border-gray-200'
                                                        }`}>
                                                        {student.gender}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <Badge variant="outline" className={`text-xs ${student.section === 'Boarding'
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        }`}>
                                                        {student.section}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-gray-600 py-3">{student.age}</TableCell>
                                                <TableCell className="py-3">
                                                    <Badge variant={student.status === 'Active' ? 'default' : 'secondary'} className="text-xs font-medium">
                                                        {student.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-gray-500 py-3 text-sm">{student.formattedDate}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-48 text-center">
                                                <div className="flex flex-col items-center justify-center text-gray-500">
                                                    <UserCheck className="w-10 h-10 mb-3 text-gray-400" />
                                                    <p className="text-base font-medium text-gray-900">No pupils found</p>
                                                    <p className="text-sm">Try adjusting your filters or search terms.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination Controls */}
                        {filteredData.length > 0 && (
                            <div className="bg-gray-50/80 border-t border-gray-200 p-4 rounded-b-xl">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 text-sm text-gray-600 font-medium">
                                        <div>
                                            Showing {startIndex + 1}-{Math.min(endIndex, filteredData.length)} of {filteredData.length} records
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="records-per-page" className="text-xs">Show:</Label>
                                            <Select
                                                value={recordsPerPage.toString()}
                                                onValueChange={(value) => {
                                                    setRecordsPerPage(parseInt(value));
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                <SelectTrigger id="records-per-page" className="w-20 h-8 text-xs bg-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent
                                                    side="top"
                                                    align="center"
                                                    position="popper"
                                                >
                                                    <SelectItem value="25">25</SelectItem>
                                                    <SelectItem value="50">50</SelectItem>
                                                    <SelectItem value="100">100</SelectItem>
                                                    <SelectItem value="250">250</SelectItem>
                                                    <SelectItem value={Math.max(filteredData.length, 1).toString()}>All</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(1)}
                                                disabled={currentPage === 1}
                                                className="text-xs h-8 bg-white"
                                            >
                                                First
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="text-xs h-8 bg-white"
                                            >
                                                Prev
                                            </Button>

                                            <div className="flex items-center gap-1 mx-1 hidden sm:flex">
                                                {(() => {
                                                    const pages = [];
                                                    const maxVisible = 5;
                                                    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                                                    let end = Math.min(totalPages, start + maxVisible - 1);

                                                    if (end - start + 1 < maxVisible) {
                                                        start = Math.max(1, end - maxVisible + 1);
                                                    }

                                                    for (let i = start; i <= end; i++) {
                                                        pages.push(
                                                            <Button
                                                                key={i}
                                                                variant={currentPage === i ? "default" : "outline"}
                                                                size="sm"
                                                                onClick={() => setCurrentPage(i)}
                                                                className={`w-8 h-8 p-0 text-xs ${currentPage !== i ? 'bg-white' : 'bg-blue-600'}`}
                                                            >
                                                                {i}
                                                            </Button>
                                                        );
                                                    }
                                                    return pages;
                                                })()}
                                            </div>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="text-xs h-8 bg-white"
                                            >
                                                Next
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(totalPages)}
                                                disabled={currentPage === totalPages}
                                                className="text-xs h-8 bg-white"
                                            >
                                                Last
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
