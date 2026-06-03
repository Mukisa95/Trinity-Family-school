"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar, 
  BookOpen,
  BarChart3,
  PieChart as PieChartIcon,
  FileText,
  Printer,
  ArrowLeft
} from 'lucide-react';
import { useActivePupils } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { useStaff } from '@/lib/hooks/use-staff';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  purple: '#A855F7',
  pink: '#EC4899',
  orange: '#F97316',
  teal: '#14B8A6'
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.success,
  COLORS.warning,
  COLORS.danger,
  COLORS.info,
  COLORS.purple,
  COLORS.pink,
  COLORS.orange,
  COLORS.teal
];

export default function ReportsPage() {
  const [reportType, setReportType] = useState<'overview' | 'pupils' | 'fees' | 'attendance' | 'staff'>('overview');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'term' | 'year'>('term');
  
  const { data: pupils = [], isLoading: loadingPupils } = useActivePupils();
  const { data: classes = [], isLoading: loadingClasses } = useClasses();
  const { data: staff = [], isLoading: loadingStaff } = useStaff();
  const { data: schoolSettings } = useSchoolSettings();

  // Calculate statistics
  const stats = useMemo(() => {
    const malePupils = pupils.filter(p => p.gender === 'Male').length;
    const femalePupils = pupils.filter(p => p.gender === 'Female').length;
    const totalPupils = pupils.length;
    const totalClasses = classes.length;
    const totalStaff = staff.length;

    // Class distribution
    const classDist = classes.map(cls => {
      const classSize = pupils.filter(p => p.classId === cls.id).length;
      return {
        name: cls.code || cls.name,
        pupils: classSize,
        capacity: cls.capacity || classSize + 10
      };
    }).sort((a, b) => b.pupils - a.pupils);

    // Gender distribution
    const genderData = [
      { name: 'Male', value: malePupils, percentage: ((malePupils / totalPupils) * 100).toFixed(1) },
      { name: 'Female', value: femalePupils, percentage: ((femalePupils / totalPupils) * 100).toFixed(1) }
    ];

    // Age distribution
    const ageGroups = pupils.reduce((acc: any, pupil) => {
      if (!pupil.dateOfBirth) return acc;
      const age = Math.floor((new Date().getTime() - new Date(pupil.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      const ageGroup = age < 6 ? 'Under 6' : age < 9 ? '6-8' : age < 12 ? '9-11' : age < 15 ? '12-14' : '15+';
      acc[ageGroup] = (acc[ageGroup] || 0) + 1;
      return acc;
    }, {});

    const ageData = Object.entries(ageGroups).map(([name, value]) => ({
      name,
      pupils: value as number
    }));

    // Section distribution
    const dayPupils = pupils.filter(p => p.section === 'Day').length;
    const boardingPupils = pupils.filter(p => p.section === 'Boarding').length;
    const sectionData = [
      { name: 'Day', value: dayPupils, percentage: ((dayPupils / totalPupils) * 100).toFixed(1) },
      { name: 'Boarding', value: boardingPupils, percentage: ((boardingPupils / totalPupils) * 100).toFixed(1) }
    ];

    // Mock enrollment trend data (in production, this would come from historical data)
    const enrollmentTrend = [
      { month: 'Jan', pupils: Math.max(0, totalPupils - 45) },
      { month: 'Feb', pupils: Math.max(0, totalPupils - 38) },
      { month: 'Mar', pupils: Math.max(0, totalPupils - 30) },
      { month: 'Apr', pupils: Math.max(0, totalPupils - 22) },
      { month: 'May', pupils: Math.max(0, totalPupils - 15) },
      { month: 'Jun', pupils: Math.max(0, totalPupils - 8) },
      { month: 'Jul', pupils: totalPupils }
    ];

    // Staff by role
    const staffByRole = staff.reduce((acc: any, member) => {
      const role = member.role || 'Other';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    const staffRoleData = Object.entries(staffByRole).map(([name, value]) => ({
      name,
      count: value as number
    }));

    return {
      totalPupils,
      malePupils,
      femalePupils,
      totalClasses,
      totalStaff,
      classDist,
      genderData,
      ageData,
      sectionData,
      enrollmentTrend,
      staffRoleData,
      averageClassSize: totalClasses > 0 ? (totalPupils / totalClasses).toFixed(1) : 0
    };
  }, [pupils, classes, staff]);

  const handleExportPDF = () => {
    // In production, implement PDF generation
    alert('PDF Export functionality will be implemented');
  };

  const handlePrint = () => {
    window.print();
  };

  const isLoading = loadingPupils || loadingClasses || loadingStaff;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-4 sm:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <SmartBackButton 
              fallbackHref="/"
              className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium border border-gray-200 bg-white hover:bg-gray-100 hover:text-gray-900 rounded-md px-3 h-8 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </SmartBackButton>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                Reports & Analytics
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {schoolSettings?.schoolName || 'School Management System'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="default" size="sm" onClick={handleExportPDF}>
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="pupils">Pupils Analysis</SelectItem>
              <SelectItem value="fees">Fees Collection</SelectItem>
              <SelectItem value="attendance">Attendance</SelectItem>
              <SelectItem value="staff">Staff Analysis</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="term">This Term</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading reports data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="w-8 h-8 opacity-80" />
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <p className="text-blue-100 text-sm">Total Pupils</p>
                    <p className="text-3xl font-bold mt-1">{stats.totalPupils}</p>
                    <p className="text-xs text-blue-100 mt-2">
                      Avg. {stats.averageClassSize} per class
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <BookOpen className="w-8 h-8 opacity-80" />
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <p className="text-purple-100 text-sm">Total Classes</p>
                    <p className="text-3xl font-bold mt-1">{stats.totalClasses}</p>
                    <p className="text-xs text-purple-100 mt-2">
                      Active academic year
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="w-8 h-8 opacity-80" />
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <p className="text-green-100 text-sm">Staff Members</p>
                    <p className="text-3xl font-bold mt-1">{stats.totalStaff}</p>
                    <p className="text-xs text-green-100 mt-2">
                      Teaching & support staff
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <Calendar className="w-8 h-8 opacity-80" />
                      <FileText className="w-5 h-5" />
                    </div>
                    <p className="text-orange-100 text-sm">Report Period</p>
                    <p className="text-2xl font-bold mt-1">{timeRange.charAt(0).toUpperCase() + timeRange.slice(1)}</p>
                    <p className="text-xs text-orange-100 mt-2">
                      {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Enrollment Trend */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      Enrollment Trend
                    </CardTitle>
                    <CardDescription>Pupil enrollment over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={stats.enrollmentTrend}>
                        <defs>
                          <linearGradient id="colorPupils" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" stroke="#6b7280" />
                        <YAxis stroke="#6b7280" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="pupils" 
                          stroke={COLORS.primary} 
                          fillOpacity={1} 
                          fill="url(#colorPupils)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Gender Distribution */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5 text-purple-600" />
                      Gender Distribution
                    </CardTitle>
                    <CardDescription>Male vs Female pupils</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={stats.genderData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {stats.genderData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.primary : COLORS.pink} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{stats.malePupils}</p>
                        <p className="text-xs text-gray-600">Male Pupils</p>
                      </div>
                      <div className="text-center p-3 bg-pink-50 rounded-lg">
                        <p className="text-2xl font-bold text-pink-600">{stats.femalePupils}</p>
                        <p className="text-xs text-gray-600">Female Pupils</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Class Distribution */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-green-600" />
                      Class Size Distribution
                    </CardTitle>
                    <CardDescription>Pupils per class</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.classDist.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" stroke="#6b7280" />
                        <YAxis stroke="#6b7280" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        />
                        <Legend />
                        <Bar dataKey="pupils" fill={COLORS.success} radius={[8, 8, 0, 0]} />
                        <Bar dataKey="capacity" fill={COLORS.warning} opacity={0.3} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Section Distribution */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-orange-600" />
                      Section Distribution
                    </CardTitle>
                    <CardDescription>Day vs Boarding pupils</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={stats.sectionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {stats.sectionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.info : COLORS.orange} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {stats.sectionData.map((section, index) => (
                        <div key={section.name} className={`text-center p-3 rounded-lg ${index === 0 ? 'bg-cyan-50' : 'bg-orange-50'}`}>
                          <p className={`text-2xl font-bold ${index === 0 ? 'text-cyan-600' : 'text-orange-600'}`}>
                            {section.value}
                          </p>
                          <p className="text-xs text-gray-600">{section.name} Pupils</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Age Distribution */}
              {stats.ageData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-teal-600" />
                        Age Distribution
                      </CardTitle>
                      <CardDescription>Pupils by age group</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.ageData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" stroke="#6b7280" />
                          <YAxis stroke="#6b7280" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                          />
                          <Bar dataKey="pupils" fill={COLORS.teal} radius={[8, 8, 0, 0]}>
                            {stats.ageData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Staff Distribution */}
              {stats.staffRoleData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.0 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-600" />
                        Staff by Role
                      </CardTitle>
                      <CardDescription>Staff distribution by role</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.staffRoleData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis type="number" stroke="#6b7280" />
                          <YAxis dataKey="name" type="category" stroke="#6b7280" width={100} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                          />
                          <Bar dataKey="count" fill={COLORS.purple} radius={[0, 8, 8, 0]}>
                            {stats.staffRoleData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>

            {/* Summary Report */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Summary Report
                  </CardTitle>
                  <CardDescription>Key insights and statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total Enrollment</p>
                      <p className="text-2xl font-bold text-blue-600">{stats.totalPupils}</p>
                      <p className="text-xs text-gray-500 mt-1">Active pupils</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Average Class Size</p>
                      <p className="text-2xl font-bold text-green-600">{stats.averageClassSize}</p>
                      <p className="text-xs text-gray-500 mt-1">Pupils per class</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total Classes</p>
                      <p className="text-2xl font-bold text-purple-600">{stats.totalClasses}</p>
                      <p className="text-xs text-gray-500 mt-1">Active classes</p>
                    </div>
                    <div className="p-4 bg-pink-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Gender Ratio</p>
                      <p className="text-2xl font-bold text-pink-600">
                        {stats.malePupils}:{stats.femalePupils}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Male : Female</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Staff Members</p>
                      <p className="text-2xl font-bold text-orange-600">{stats.totalStaff}</p>
                      <p className="text-xs text-gray-500 mt-1">Teaching & support</p>
                    </div>
                    <div className="p-4 bg-teal-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Staff-Pupil Ratio</p>
                      <p className="text-2xl font-bold text-teal-600">
                        1:{stats.totalStaff > 0 ? Math.round(stats.totalPupils / stats.totalStaff) : 0}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Staff to pupils</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          button, .no-print {
            display: none !important;
          }
          .print-break {
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}

