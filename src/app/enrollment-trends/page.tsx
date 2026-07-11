"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import * as React from "react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart, Cell } from "recharts";
import { PillBar, VIBRANT_COLORS } from "@/components/ui/charts/pill-bar";

type SortField = "name" | "registrationDate" | "class";
type SortOrder = "asc" | "desc";

interface EnrollmentData {
  id: string;
  name: string;
  admissionNumber: string;
  class: string;
  classCode: string;
  classId: string;
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
          classCode: classInfo?.code || classInfo?.name || 'Unknown',
          classId: pupil.classId || 'unknown',
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
    const classMap: { [key: string]: { id: string, name: string, count: number } } = {};

    // Ensure all classes are represented even if they have 0 students
    if (classes && classes.length > 0) {
      classes.forEach(c => {
        const classCode = c.code || c.name;
        if (classCode) {
          classMap[c.id] = { id: c.id, name: classCode, count: 0 };
        }
      });
    }

    filteredData.forEach(item => {
      // Use classId from item to find the correct entry in classMap
      if (classMap[item.classId]) {
        classMap[item.classId].count += 1;
      } else {
        // Handle cases where classId might not be in the initial classes list (e.g., 'unknown')
        // Create a new entry if it doesn't exist, using item.classId as the key
        classMap[item.classId] = { id: item.classId, name: item.classCode, count: 1 };
      }
    });

    return Object.values(classMap)
      .map(data => ({
        class: data.name,
        classId: data.id,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredData, classes]);

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
      <div className="min-h-screen">
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
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Enrollment Trends"
          subtitle="Comprehensive analysis of student enrollment patterns and insights"
          backHref="/"
          backLabel="Dashboard"
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card className="w-full max-w-md bg-white/80 backdrop-blur-sm border-0 shadow-xl mx-auto">
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
    );
  }

  const activeFiltersCount = [
    selectedYear !== "all",
    selectedClass !== "all",
    searchTerm !== ""
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen animate-in fade-in duration-500">
      <GlassPageTopBar
        title="Enrollment Trends"
        subtitle="Student enrollment analysis & insights"
        backHref="/"
        backLabel="Dashboard"
        className="mb-1.5"
        meta={
          <div className="flex items-center gap-3">
            <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100/80 whitespace-nowrap">
              {stats.total} total
            </span>
            <span className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-100/80 whitespace-nowrap">
              {stats.thisYear} this year
            </span>
          </div>
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="Filters"
              tone="blue"
              icon={<Filter className="h-4 w-4" />}
              badge={activeFiltersCount > 0 ? activeFiltersCount : undefined}
              onClick={() => setShowMobileFilters(!showMobileFilters)}
            />
            <GlassActionButton
              label="Export"
              tone="green"
              icon={<Download className="h-4 w-4" />}
              onClick={exportData}
            />
          </GlassActionDock>
        }
      />

      <GlassSummaryBar
        left={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 dark:text-indigo-200 uppercase">
              Enrollment Summary
            </span>
          </div>
        }
        right={
          <>
            <div className="flex items-center gap-1 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-blue-600 dark:text-blue-400">{stats.total.toLocaleString()}</span>
              <span className="text-blue-700/85 dark:text-blue-300 font-medium">Total Enrollments</span>
            </div>
            <div className="flex items-center gap-1 bg-green-50/80 dark:bg-green-950/20 border border-green-100/50 dark:border-green-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-green-600 dark:text-green-400">{stats.thisYear.toLocaleString()}</span>
              <span className="text-green-700/85 dark:text-green-300 font-medium">This Year</span>
              {stats.growthRate !== 0 && (
                <span className="text-green-600 dark:text-green-400 text-[9px] sm:text-[10px] font-bold">
                  ({stats.growthRate > 0 ? '+' : ''}{stats.growthRate.toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 bg-purple-50/80 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-purple-600 dark:text-purple-400">{stats.classesInvolved}</span>
              <span className="text-purple-700/85 dark:text-purple-300 font-medium">Active Classes</span>
            </div>
            <div className="flex items-center gap-1 bg-orange-50/80 dark:bg-orange-950/20 border border-orange-100/50 dark:border-orange-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="text-orange-700/85 dark:text-orange-300 font-medium">Peak Month:</span>
              <span className="font-bold text-orange-600 dark:text-orange-400">{stats.peakMonth}</span>
            </div>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

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



        {/* Compact Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 bg-white/80 backdrop-blur-sm shadow-lg h-10">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs">
              <Eye className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
              Overview
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
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.1} />
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
              <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    Class Enrollment
                  </CardTitle>
                  <p className="text-xs text-gray-500">
                    Distribution across {classDistributionData.length} classes
                  </p>
                </CardHeader>
                <CardContent className="pt-0 flex-1 relative">
                  <div className="h-[250px] w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={classDistributionData}
                        margin={{ top: 5, right: 10, left: -20, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" opacity={0.6} />
                        <XAxis
                          dataKey="class"
                          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                          axisLine={false}
                          tickLine={false}
                          angle={0}
                          textAnchor="middle"
                          dy={4}
                          height={25}
                          interval={0}
                        />
                        <YAxis
                          type="number"
                          tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.05))]}
                        />
                        <Tooltip
                          cursor={{ fill: 'transparent' }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg p-3 border border-white/50 ring-1 ring-black/5">
                                  <p className="font-semibold text-gray-900 mb-1.5">{label}</p>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: payload[0].color }}></div>
                                    <p className="text-sm font-medium" style={{ color: payload[0].color }}>
                                      {payload[0].value} students
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar
                          dataKey="count"
                          className="cursor-pointer drop-shadow-sm transition-opacity hover:opacity-90"
                          shape={<PillBar />}
                          background={{ fill: '#e2e8f0', radius: 40 }}
                          onClick={(data) => {
                            if (data && data.classId) {
                              router.push(`/enrollment-trends/class/${data.classId}`);
                            }
                          }}
                        >
                          {classDistributionData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={VIBRANT_COLORS[index % VIBRANT_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
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
                              <Badge variant="outline" className={`text-xs ${student.gender === 'Male' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'
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