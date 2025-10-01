"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProgressiveDashboard } from "@/lib/hooks/use-progressive-dashboard";
import { 
  ArrowLeft, 
  Activity, 
  Users, 
  Calendar, 
  Filter,
  Download,
  Search,
  ArrowUpDown,
  TrendingUp,
  BarChart3,
  Eye,
  ChevronDown,
  UserCheck,
  GraduationCap,
  Target,
  Sparkles
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart } from "recharts";

type SortField = "name" | "registrationDate" | "class";
type SortOrder = "asc" | "desc";

interface EnrollmentData {
  id: string;
  name: string;
  admissionNumber: string;
  class: string;
  registrationDate: string;
  formattedDate: string;
  year: number;
  month: string;
  gender: string;
  status: string;
}

export default function EnrollmentTrendsPage() {
  const router = useRouter();
  const { pupils, classes, pupilsLoading, classesLoading } = useProgressiveDashboard();
  
  // Filter states
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedClass, setSelectedClass] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("registrationDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(50);

  // Get available years from enrollment data
  const availableYears = useMemo(() => {
    if (!pupils) return [];
    const years = new Set<number>();
    pupils.forEach(pupil => {
      if (pupil.registrationDate) {
        const year = new Date(pupil.registrationDate).getFullYear();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [pupils]);

  // Process enrollment data
  const enrollmentData = useMemo((): EnrollmentData[] => {
    if (!pupils || !classes) return [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return pupils
      .filter(pupil => pupil.registrationDate) // This ensures registrationDate exists
      .map(pupil => {
        const regDate = new Date(pupil.registrationDate!); // Safe to use ! since we filtered above
        const classInfo = classes.find(c => c.id === pupil.classId);
        
        return {
          id: pupil.id,
          name: `${pupil.firstName} ${pupil.lastName}`,
          admissionNumber: pupil.admissionNumber,
          class: classInfo?.name || classInfo?.code || 'Unknown',
          registrationDate: pupil.registrationDate!, // Safe to use ! since we filtered above
          formattedDate: format(regDate, "MMM dd, yyyy"),
          year: regDate.getFullYear(),
          month: monthNames[regDate.getMonth()],
          gender: pupil.gender,
          status: pupil.status || 'Active'
        };
      });
  }, [pupils, classes]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = enrollmentData;

    // Filter by year
    if (selectedYear !== "all") {
      filtered = filtered.filter(item => item.year.toString() === selectedYear);
    }

    // Filter by class
    if (selectedClass !== "all") {
      filtered = filtered.filter(item => item.class === selectedClass);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(term) ||
        item.admissionNumber.toLowerCase().includes(term) ||
        item.class.toLowerCase().includes(term)
      );
    }

    // Sort data
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "registrationDate":
          aValue = new Date(a.registrationDate).getTime();
          bValue = new Date(b.registrationDate).getTime();
          break;
        case "class":
          aValue = a.class.toLowerCase();
          bValue = b.class.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [enrollmentData, selectedYear, selectedClass, searchTerm, sortField, sortOrder]);

  // Chart data for trends
  const monthlyTrendData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yearData = enrollmentData.filter(item => 
      selectedYear === "all" || item.year.toString() === selectedYear
    );

    const monthlyCount: { [key: string]: number } = {};
    monthNames.forEach(month => monthlyCount[month] = 0);

    yearData.forEach(item => {
      monthlyCount[item.month]++;
    });

    return monthNames.map(month => ({
      month,
      enrollments: monthlyCount[month]
    }));
  }, [enrollmentData, selectedYear]);

  // Class distribution data
  const classDistributionData = useMemo(() => {
    const classCount: { [key: string]: number } = {};
    
    filteredData.forEach(item => {
      classCount[item.class] = (classCount[item.class] || 0) + 1;
    });

    return Object.entries(classCount)
      .map(([className, count]) => ({
        class: className,
        count
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Statistics
  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const thisYearEnrollments = enrollmentData.filter(item => item.year === currentYear).length;
    const lastYearEnrollments = enrollmentData.filter(item => item.year === currentYear - 1).length;
    const growthRate = lastYearEnrollments > 0 ? ((thisYearEnrollments - lastYearEnrollments) / lastYearEnrollments * 100) : 0;
    
    const peakMonth = monthlyTrendData.reduce((max, curr) => 
      curr.enrollments > max.enrollments ? curr : max, 
      monthlyTrendData[0]
    );

    return {
      total: filteredData.length,
      thisYear: thisYearEnrollments,
      classesInvolved: classDistributionData.length,
      peakMonth: peakMonth?.month || 'N/A',
      growthRate
    };
  }, [filteredData, enrollmentData, monthlyTrendData, classDistributionData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredData.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentPageData = filteredData.slice(startIndex, endIndex);

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedClass, searchTerm]);

  const exportData = () => {
    const csvContent = [
      ["Name", "Admission Number", "Class", "Registration Date", "Gender", "Status"].join(","),
      ...filteredData.map(item => [
        item.name,
        item.admissionNumber,
        item.class,
        item.formattedDate,
        item.gender,
        item.status
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enrollment-trends-${selectedYear}-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
              <h3 className="text-lg font-semibold text-gray-700">Loading Enrollment Data</h3>
              <p className="text-sm text-gray-500">
                {pupilsLoading && 'Fetching pupil records... '}
                {classesLoading && 'Loading class information... '}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show a message if no data is available
  if (!pupils || pupils.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
            title="📊 Enrollment Trends"
            description="Comprehensive analysis of student enrollment patterns and insights"
          actions={
              <Button variant="outline" onClick={() => router.push("/")} className="shadow-sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          }
        />
          <div className="flex items-center justify-center min-h-[50vh]">
            <Card className="w-full max-w-md bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardContent className="p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">No Enrollment Data Available</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Start by adding student records to see comprehensive enrollment trends and analytics.
                </p>
                <Button onClick={() => router.push('/pupils')} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg">
                  <UserCheck className="w-4 h-4 mr-2" />
                  Manage Students
            </Button>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-3 md:p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Ultra Compact Header with Dropdown Filters */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
          <CardContent className="p-4">
            {/* Main Header Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">📊 Enrollment Trends</h1>
                  <p className="text-sm text-gray-600">Student enrollment analysis & insights</p>
                </div>
              </div>
              
              {/* Action Buttons Row */}
              <div className="flex items-center gap-2">
                {/* Quick Stats Display */}
                <div className="hidden sm:flex items-center gap-3 px-3 py-2 bg-white/60 rounded-lg border border-white/30">
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold text-blue-600">{stats.total}</span> total
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold text-green-600">{stats.thisYear}</span> this year
                  </div>
                </div>

                {/* Dropdown Filter Toggle */}
                <Button
                  variant="outline"
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className="bg-white/80 backdrop-blur-sm border-white/20 shadow-sm hover:bg-white/90 flex items-center gap-2 relative"
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {/* Active Filter Count */}
                  {(() => {
                    const activeFilters = [
                      selectedYear !== "all",
                      selectedClass !== "all", 
                      searchTerm !== ""
                    ].filter(Boolean).length;
                    
                    return activeFilters > 0 ? (
                      <span className="hidden md:inline text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                        {activeFilters}
                      </span>
                    ) : null;
                  })()}
                  {/* Mobile Active Filter Indicator */}
                  {(selectedYear !== "all" || selectedClass !== "all" || searchTerm !== "") && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full absolute -top-1 -right-1 md:hidden"></div>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
                </Button>

                {/* Export Button */}
                <Button 
                  onClick={exportData} 
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>

                {/* Back to Dashboard */}
                <Button 
                  variant="outline" 
                  onClick={() => router.push("/")} 
                  className="bg-white/80 backdrop-blur-sm border-white/20 shadow-sm hover:bg-white/90"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </div>
            </div>

            {/* Dropdown Filters */}
            {showMobileFilters && (
              <div className="mt-4 p-4 bg-white/60 rounded-lg border border-white/30 shadow-inner">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year-select" className="text-sm font-medium text-gray-700">Academic Year</Label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger id="year-select" className="bg-white border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {availableYears.map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="class-select" className="text-sm font-medium text-gray-700">Class Filter</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger id="class-select" className="bg-white border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {classes?.map(classItem => (
                          <SelectItem key={classItem.id} value={classItem.name || classItem.code}>
                            {classItem.name || classItem.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="search" className="text-sm font-medium text-gray-700">Search Students</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="search"
                        placeholder="Name or admission number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-white border-gray-200 placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Current Selection</Label>
                    <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Year:</span>
                          <span className="font-medium">{selectedYear === "all" ? "All" : selectedYear}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Class:</span>
                          <span className="font-medium">{selectedClass === "all" ? "All" : selectedClass}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Found:</span>
                          <span className="font-medium text-blue-600">{filteredData.length} records</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Filter Actions */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedYear("all");
                        setSelectedClass("all");
                        setSearchTerm("");
                      }}
                      className="text-xs"
                    >
                      Clear All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedYear(new Date().getFullYear().toString())}
                      className="text-xs"
                    >
                      Current Year
                    </Button>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => setShowMobileFilters(false)}
                    className="text-xs"
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compact Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-xs font-medium mb-0.5">Total Enrollments</p>
                  <p className="text-xl md:text-2xl font-bold">{stats.total.toLocaleString()}</p>
                </div>
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-xs font-medium mb-0.5">This Year</p>
                  <p className="text-xl md:text-2xl font-bold">{stats.thisYear.toLocaleString()}</p>
                  {stats.growthRate !== 0 && (
                    <p className="text-xs text-green-100">
                      {stats.growthRate > 0 ? '+' : ''}{stats.growthRate.toFixed(1)}% vs last year
                    </p>
                  )}
                </div>
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-0 shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-xs font-medium mb-0.5">Active Classes</p>
                  <p className="text-xl md:text-2xl font-bold">{stats.classesInvolved}</p>
                </div>
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white border-0 shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-xs font-medium mb-0.5">Peak Month</p>
                  <p className="text-xl md:text-2xl font-bold">{stats.peakMonth}</p>
                </div>
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compact Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm shadow-lg h-10">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs">
              <Eye className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="trends" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs">
              <Activity className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="distribution" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
              Classes
            </TabsTrigger>
            <TabsTrigger value="table" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs">
              <Users className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
              Records
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Monthly Trends Overview */}
              <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="w-4 h-4 text-blue-600" />
                    Monthly Trends
                  </CardTitle>
                  <p className="text-xs text-gray-500">
                    Enrollment patterns for {selectedYear === "all" ? "all years" : selectedYear}
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyTrendData}>
                        <defs>
                          <linearGradient id="enrollmentGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={false}
                          width={35}
                        />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 border border-white/20">
                                  <p className="font-semibold text-gray-900 text-sm">{label}</p>
                                  <p className="text-xs text-blue-600 font-medium">
                                    {payload[0].value} enrollments
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="enrollments" 
                          stroke="#3B82F6"
                          strokeWidth={2}
                          fill="url(#enrollmentGradient)"
                          dot={{ r: 3, strokeWidth: 2, fill: '#3B82F6' }}
                          activeDot={{ r: 4, strokeWidth: 2, fill: '#3B82F6' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Class Distribution Overview */}
              <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    Top Classes
                  </CardTitle>
                  <p className="text-xs text-gray-500">
                    Distribution across {classDistributionData.length} classes
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3 max-h-[240px] overflow-y-auto">
                    {classDistributionData.slice(0, 8).map((item, index) => (
                      <div key={item.class} className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-md flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-xs font-medium text-gray-900 truncate">{item.class}</p>
                            <p className="text-xs font-bold text-gray-900">{item.count}</p>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-indigo-600 h-1.5 rounded-full transition-all duration-300" 
                              style={{ width: `${(item.count / Math.max(...classDistributionData.map(d => d.count))) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="w-4 h-4 text-blue-600" />
                  Monthly Enrollment Trends
                </CardTitle>
                <p className="text-xs text-gray-500">
                  Detailed enrollment patterns for {selectedYear === "all" ? "all years" : selectedYear}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyTrendData}>
                      <defs>
                        <linearGradient id="enrollmentTrendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20">
                                <p className="font-semibold text-gray-900 mb-1">{label}</p>
                                <p className="text-sm text-blue-600 font-medium">
                                  {payload[0].value} enrollments
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="enrollments" 
                        stroke="#3B82F6"
                        strokeWidth={3}
                        fill="url(#enrollmentTrendGradient)"
                        dot={{ r: 5, strokeWidth: 2, fill: '#3B82F6' }}
                        activeDot={{ r: 7, strokeWidth: 2, fill: '#3B82F6' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  Enrollment by Class
                </CardTitle>
                <p className="text-xs text-gray-500">
                  Distribution across {classDistributionData.length} different classes
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classDistributionData} margin={{ top: 20, right: 20, left: 10, bottom: 60 }}>
                      <defs>
                        <linearGradient id="classGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.8}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis 
                        dataKey="class" 
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} 
                        axisLine={{ stroke: '#e2e8f0' }} 
                        tickLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis 
                        tick={{ fill: '#64748b', fontSize: 11 }} 
                        axisLine={{ stroke: '#e2e8f0' }} 
                        tickLine={false} 
                        width={35} 
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20">
                                <p className="font-semibold text-gray-900 mb-1">{label}</p>
                                <p className="text-sm text-purple-600 font-medium">
                                  {payload[0].value} students enrolled
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="url(#classGradient)"
                        radius={[4, 4, 0, 0]}
                        strokeWidth={1}
                        stroke="#8B5CF6"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="table" className="space-y-4">
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
              <CardHeader className="pb-3">
                                 <CardTitle className="flex items-center gap-2 text-lg">
                   <Users className="w-4 h-4 text-green-600" />
                   Enrollment Records ({filteredData.length.toLocaleString()})
                   {totalPages > 1 && (
                     <span className="text-sm font-normal text-gray-500">
                       - Page {currentPage} of {totalPages}
                     </span>
                   )}
                 </CardTitle>
                <p className="text-xs text-gray-500">
                  Detailed records with sorting and filtering
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <div className="min-w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-200">
                          <TableHead className="bg-gray-50/80 py-2">
                            <Button
                              variant="ghost"
                              onClick={() => handleSort("name")}
                              className="h-auto p-0 font-semibold hover:bg-transparent text-gray-700 text-xs"
                            >
                              Student Name
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                          <TableHead className="bg-gray-50/80 text-gray-700 font-semibold text-xs py-2">Admission #</TableHead>
                          <TableHead className="bg-gray-50/80 py-2">
                            <Button
                              variant="ghost"
                              onClick={() => handleSort("class")}
                              className="h-auto p-0 font-semibold hover:bg-transparent text-gray-700 text-xs"
                            >
                              Class
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                          <TableHead className="bg-gray-50/80 py-2">
                            <Button
                              variant="ghost"
                              onClick={() => handleSort("registrationDate")}
                              className="h-auto p-0 font-semibold hover:bg-transparent text-gray-700 text-xs"
                            >
                              Registration Date
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                          <TableHead className="bg-gray-50/80 text-gray-700 font-semibold text-xs py-2">Gender</TableHead>
                          <TableHead className="bg-gray-50/80 text-gray-700 font-semibold text-xs py-2">Status</TableHead>
                        </TableRow>
                                             </TableHeader>
                       <TableBody>
                         {currentPageData.map((student) => (
                           <TableRow key={student.id} className="hover:bg-gray-50/50 border-gray-100">
                             <TableCell className="font-medium text-gray-900 py-2 text-sm">{student.name}</TableCell>
                             <TableCell className="text-gray-700 py-2 text-sm">{student.admissionNumber}</TableCell>
                             <TableCell className="py-2">
                               <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                 {student.class}
                               </Badge>
                             </TableCell>
                             <TableCell className="text-gray-600 py-2 text-sm">{student.formattedDate}</TableCell>
                             <TableCell className="py-2">
                               <Badge variant="outline" className={`text-xs ${
                                 student.gender === 'Male' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'
                               }`}>
                                 {student.gender}
                               </Badge>
                             </TableCell>
                             <TableCell className="py-2">
                               <Badge variant={student.status === 'Active' ? 'default' : 'secondary'} className="text-xs">
                                 {student.status}
                               </Badge>
                             </TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                     
                     {/* Pagination Controls */}
                     {filteredData.length > 0 && (
                       <div className="bg-gray-50/50 border-t border-gray-200 p-4 pb-24">
                         <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                           {/* Records Info */}
                           <div className="flex items-center gap-4 text-sm text-gray-600">
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
                                 <SelectTrigger id="records-per-page" className="w-20 h-8 text-xs">
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent 
                                   side="top"
                                   align="center"
                                   sideOffset={4}
                                   className="bg-white border shadow-lg z-[999999]"
                                 >
                                   <SelectItem value="25">25</SelectItem>
                                   <SelectItem value="50">50</SelectItem>
                                   <SelectItem value="100">100</SelectItem>
                                   <SelectItem value="250">250</SelectItem>
                                   <SelectItem value={filteredData.length.toString()}>All</SelectItem>
                                 </SelectContent>
                               </Select>
                             </div>
                           </div>

                           {/* Pagination Buttons */}
                           {totalPages > 1 && (
                             <div className="flex items-center gap-2">
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => setCurrentPage(1)}
                                 disabled={currentPage === 1}
                                 className="text-xs"
                               >
                                 First
                               </Button>
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => setCurrentPage(currentPage - 1)}
                                 disabled={currentPage === 1}
                                 className="text-xs"
                               >
                                 Previous
                               </Button>
                               
                               {/* Page Numbers */}
                               <div className="flex items-center gap-1">
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
                                         className="w-8 h-8 p-0 text-xs"
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
                                 className="text-xs"
                               >
                                 Next
                               </Button>
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => setCurrentPage(totalPages)}
                                 disabled={currentPage === totalPages}
                                 className="text-xs"
                               >
                                 Last
                               </Button>
                             </div>
                           )}
                         </div>
                       </div>
                     )}
                  </div>
                </div>
                
                {filteredData.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-gray-900 mb-2">No Records Found</h3>
                    <p className="text-sm text-gray-500">
                      Try adjusting your filters or search terms to find enrollment records.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 