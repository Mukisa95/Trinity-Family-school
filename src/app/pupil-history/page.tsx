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
import { 
  ArrowLeft, 
  Users, 
  Calendar, 
  Filter,
  Download,
  Search,
  ArrowUpDown,
  TrendingUp,
  Clock,
  Eye,
  ChevronDown,
  ChevronRight,
  UserCheck,
  GraduationCap,
  Target,
  BookOpen,
  Award,
  MapPin,
  Phone,
  Mail,
  User,
  History,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  DollarSign
} from "lucide-react";
import { format, parseISO, differenceInYears, differenceInMonths, differenceInDays } from "date-fns";
import { useProgressiveDashboard } from "@/lib/hooks/use-progressive-dashboard";

interface ClassHistory {
  class: string;
  startDate: string;
  endDate?: string;
  year: number;
  duration: string;
  status: 'completed' | 'current' | 'incomplete';
}

interface StatusHistory {
  status: string;
  startDate: string;
  endDate?: string;
  duration: string;
  reason?: string;
  isCurrent: boolean;
}

interface PupilHistoryData {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  admissionNumber: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  currentClass?: string;
  currentStatus: string;
  joinedDate: string;
  leftDate?: string;
  totalYearsInSchool: string;
  contact: {
    phone?: string;
    email?: string;
    address?: string;
  };
  guardian: {
    name: string;
    relationship: string;
    phone: string;
  };
  classHistory: ClassHistory[];
  statusHistory: StatusHistory[];
  achievements: string[];
  fees: {
    totalPaid: number;
    outstanding: number;
    lastPayment?: string;
  };
}



export default function PupilHistoryPage() {
  const router = useRouter();
  const { pupils, classes, pupilsLoading, classesLoading } = useProgressiveDashboard();
  
  // State management
  const [selectedClass, setSelectedClass] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Get available classes from real data
  const availableClasses = useMemo(() => {
    if (!classes) return [];
    return classes.map(cls => cls.name || cls.code).filter(Boolean).sort();
  }, [classes]);
  
  // Process real pupil data into history format
  const pupilHistoryData = useMemo((): PupilHistoryData[] => {
    if (!pupils || !classes) return [];

    return pupils.map(pupil => {
      const currentClass = classes.find(cls => cls.id === pupil.classId);
      const registrationDate = pupil.registrationDate || new Date().toISOString();
      const dobDate = pupil.dateOfBirth ? new Date(pupil.dateOfBirth) : new Date();
      const regDate = new Date(registrationDate);
      const today = new Date();
      
      // Calculate age
      const age = differenceInYears(today, dobDate);
      
      // Calculate total years in school
      const yearsInSchool = differenceInYears(today, regDate);
      const monthsInSchool = differenceInMonths(today, regDate) % 12;
      const totalYearsInSchool = yearsInSchool > 0 ? 
        `${yearsInSchool} year${yearsInSchool > 1 ? 's' : ''}${monthsInSchool > 0 ? `, ${monthsInSchool} month${monthsInSchool > 1 ? 's' : ''}` : ''}` :
        `${monthsInSchool} month${monthsInSchool > 1 ? 's' : ''}`;

      // Use real promotion history data to build class history
      const classHistory: ClassHistory[] = [];
      
      if (pupil.promotionHistory && pupil.promotionHistory.length > 0) {
        // Process real promotion history
        pupil.promotionHistory.forEach((promotion, index) => {
          const isLastEntry = index === pupil.promotionHistory!.length - 1;
          const startDate = promotion.date;
          const endDate = isLastEntry ? undefined : pupil.promotionHistory![index + 1]?.date;
          
          // Calculate duration for this class
          const classStartDate = new Date(startDate);
          const classEndDate = endDate ? new Date(endDate) : today;
          const years = differenceInYears(classEndDate, classStartDate);
          const months = differenceInMonths(classEndDate, classStartDate) % 12;
          const duration = years > 0 ? 
            `${years} year${years !== 1 ? 's' : ''}${months > 0 ? ` ${months} month${months !== 1 ? 's' : ''}` : ''}` :
            `${months} month${months !== 1 ? 's' : ''}`;
          
          classHistory.push({
            class: promotion.toClassName || promotion.toClassId || 'Unknown',
            startDate: startDate,
            endDate: endDate,
            year: new Date(startDate).getFullYear(),
            duration: duration,
            status: isLastEntry && pupil.status === 'Active' ? 'current' : 'completed'
          });
        });
      } else {
        // Enhanced fallback for class history
        if (pupil.status === 'Graduated' && pupil.graduationClassId && pupil.graduationClassName) {
          // Use graduation class information for graduated pupils
          classHistory.push({
            class: pupil.graduationClassName,
            startDate: registrationDate,
            endDate: pupil.graduationDate,
            year: regDate.getFullYear(),
            duration: (() => {
              if (pupil.graduationDate) {
                const classStart = new Date(registrationDate);
                const classEnd = new Date(pupil.graduationDate);
                const years = differenceInYears(classEnd, classStart);
                const months = differenceInMonths(classEnd, classStart) % 12;
                return years > 0 ? 
                  `${years} year${years !== 1 ? 's' : ''}${months > 0 ? ` ${months} month${months !== 1 ? 's' : ''}` : ''}` :
                  `${months} month${months !== 1 ? 's' : ''}`;
              }
              return totalYearsInSchool;
            })(),
            status: 'completed'
          });
        } else if (currentClass) {
          // Fallback to current class for active pupils
          classHistory.push({
            class: currentClass.name || currentClass.code || 'Unknown',
            startDate: registrationDate,
            year: regDate.getFullYear(),
            duration: totalYearsInSchool,
            status: pupil.status === 'Active' ? 'current' : 'completed'
          });
        }
      }

      // Use real status change history data
      const statusHistory: StatusHistory[] = [];
      
      if (pupil.statusChangeHistory && pupil.statusChangeHistory.length > 0) {
        // Process real status change history
        pupil.statusChangeHistory.forEach((statusChange, index) => {
          const isLastEntry = index === pupil.statusChangeHistory!.length - 1;
          const startDate = statusChange.date;
          const endDate = isLastEntry ? undefined : pupil.statusChangeHistory![index + 1]?.date;
          
          // Calculate duration for this status
          const statusStartDate = new Date(startDate);
          const statusEndDate = endDate ? new Date(endDate) : today;
          const years = differenceInYears(statusEndDate, statusStartDate);
          const months = differenceInMonths(statusEndDate, statusStartDate) % 12;
          const duration = years > 0 ? 
            `${years} year${years !== 1 ? 's' : ''}${months > 0 ? ` ${months} month${months !== 1 ? 's' : ''}` : ''}` :
            `${months} month${months !== 1 ? 's' : ''}`;
          
          statusHistory.push({
            status: statusChange.toStatus,
            startDate: startDate,
            endDate: endDate,
            duration: duration,
            reason: statusChange.reason,
            isCurrent: isLastEntry
          });
        });
      } else {
        // Enhanced fallback: create a more complete status history
        // If pupil is graduated, create initial Active status + graduation
        if (pupil.status === 'Graduated' && pupil.graduationDate) {
          // Add initial Active status
          statusHistory.push({
            status: 'Active',
            startDate: registrationDate,
            endDate: pupil.graduationDate,
            duration: (() => {
              const activeStart = new Date(registrationDate);
              const activeEnd = new Date(pupil.graduationDate);
              const years = differenceInYears(activeEnd, activeStart);
              const months = differenceInMonths(activeEnd, activeStart) % 12;
              return years > 0 ? 
                `${years} year${years !== 1 ? 's' : ''}${months > 0 ? ` ${months} month${months !== 1 ? 's' : ''}` : ''}` :
                `${months} month${months !== 1 ? 's' : ''}`;
            })(),
            reason: 'Initial enrollment',
            isCurrent: false
          });
          
          // Add graduation status
          statusHistory.push({
            status: 'Graduated',
            startDate: pupil.graduationDate,
            endDate: undefined,
            duration: (() => {
              const gradStart = new Date(pupil.graduationDate);
              const years = differenceInYears(today, gradStart);
              const months = differenceInMonths(today, gradStart) % 12;
              return years > 0 ? 
                `${years} year${years !== 1 ? 's' : ''}${months > 0 ? ` ${months} month${months !== 1 ? 's' : ''}` : ''}` :
                `${months} month${months !== 1 ? 's' : ''}`;
            })(),
            reason: 'Completed education',
            isCurrent: true
          });
        } else {
          // Single status entry for currently active pupils
          statusHistory.push({
            status: pupil.status || 'Active',
            startDate: registrationDate,
            duration: totalYearsInSchool,
            reason: 'Initial enrollment',
            isCurrent: true
          });
        }
      }

      return {
        id: pupil.id,
        firstName: pupil.firstName,
        lastName: pupil.lastName,
        fullName: `${pupil.firstName} ${pupil.lastName}`,
        admissionNumber: pupil.admissionNumber,
        dateOfBirth: pupil.dateOfBirth || '',
        age,
        gender: pupil.gender,
        currentClass: currentClass?.name || currentClass?.code,
        currentStatus: pupil.status || 'Active',
        joinedDate: registrationDate,
        totalYearsInSchool,
        contact: {
          phone: pupil.guardians?.[0]?.phone,
          email: pupil.guardians?.[0]?.email,
          address: pupil.address
        },
        guardian: {
          name: pupil.guardians?.[0] ? `${pupil.guardians[0].firstName} ${pupil.guardians[0].lastName}` : 'Not specified',
          relationship: pupil.guardians?.[0]?.relationship || 'Guardian',
          phone: pupil.guardians?.[0]?.phone || 'Not provided'
        },
        classHistory,
        statusHistory,
        achievements: [], // Real achievements would come from achievements system if implemented
        fees: {
          totalPaid: 0, // Real fees would come from fees system  
          outstanding: 0,
          lastPayment: undefined
        }
      };
    });
  }, [pupils, classes]);

  // Filter data based on selected class and search term
  const filteredData = useMemo(() => {
    let filtered = pupilHistoryData;

    // Filter by class - check if pupil was ever in the selected class
    if (selectedClass !== "all") {
      filtered = filtered.filter(pupil => 
        pupil.classHistory.some(history => history.class === selectedClass) ||
        pupil.currentClass === selectedClass
      );
    }

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter(pupil => pupil.currentStatus.toLowerCase() === selectedStatus.toLowerCase());
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(pupil => 
        pupil.fullName.toLowerCase().includes(term) ||
        pupil.admissionNumber.toLowerCase().includes(term) ||
        pupil.guardian.name.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [pupilHistoryData, selectedClass, selectedStatus, searchTerm]);

  const toggleRowExpansion = (pupilId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(pupilId)) {
      newExpanded.delete(pupilId);
    } else {
      newExpanded.add(pupilId);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'graduated': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'on leave': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'transferred': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return <CheckCircle className="w-3 h-3" />;
      case 'graduated': return <Award className="w-3 h-3" />;
      case 'inactive': return <XCircle className="w-3 h-3" />;
      case 'on leave': return <AlertCircle className="w-3 h-3" />;
      case 'transferred': return <ArrowUpDown className="w-3 h-3" />;
      default: return <Activity className="w-3 h-3" />;
    }
  };

  const exportData = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Admission Number,Current Status,Joined Date,Total Years,Current Class,Guardian,Phone\n" +
      filteredData.map(pupil => 
        `"${pupil.fullName}","${pupil.admissionNumber}","${pupil.currentStatus}","${pupil.joinedDate}","${pupil.totalYearsInSchool}","${pupil.currentClass || 'N/A'}","${pupil.guardian.name}","${pupil.guardian.phone}"`
      ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pupil-history-${selectedClass}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    const totalPupils = filteredData.length;
    const activePupils = filteredData.filter(p => p.currentStatus === 'Active').length;
    const graduatedPupils = filteredData.filter(p => p.currentStatus === 'Graduated').length;
    const inactivePupils = filteredData.filter(p => p.currentStatus === 'Inactive').length;
    const averageStay = filteredData.reduce((acc, pupil) => {
      const years = parseFloat(pupil.totalYearsInSchool.split(' ')[0]);
      return acc + years;
    }, 0) / totalPupils || 0;

    return {
      total: totalPupils,
      active: activePupils,
      graduated: graduatedPupils,
      inactive: inactivePupils,
      averageStay: averageStay.toFixed(1)
    };
  }, [filteredData]);

  // Loading state
  if (pupilsLoading || classesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 py-6 space-y-6">
          <PageHeader
            title="Pupil History"
            description="Comprehensive tracking of pupils' academic journey and status changes"
          />
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
            <p className="mt-4 text-gray-600">Loading pupil history data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <PageHeader
          title="Pupil History"
          description="Comprehensive tracking of pupils' academic journey and status changes"
        />

        {/* Filters and Controls */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="class-select" className="text-sm font-medium whitespace-nowrap">Class:</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger id="class-select" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="bg-white border shadow-lg z-[999999]">
                      <SelectItem value="all">All Classes</SelectItem>
                      {availableClasses.map(className => (
                        <SelectItem key={className} value={className}>{className}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="status-select" className="text-sm font-medium whitespace-nowrap">Status:</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger id="status-select" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="bg-white border shadow-lg z-[999999]">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="graduated">Graduated</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search pupils, admission number, or guardian..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportData}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="h-8"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                    className="h-8"
                  >
                    <Users className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-xs font-medium mb-0.5">Total Pupils</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Users className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-xs font-medium mb-0.5">Active</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-xs font-medium mb-0.5">Graduated</p>
                  <p className="text-2xl font-bold">{stats.graduated}</p>
                </div>
                <Award className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-500 to-slate-600 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-100 text-xs font-medium mb-0.5">Inactive</p>
                  <p className="text-2xl font-bold">{stats.inactive}</p>
                </div>
                <XCircle className="w-8 h-8 text-gray-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-xs font-medium mb-0.5">Avg. Stay</p>
                  <p className="text-2xl font-bold">{stats.averageStay}y</p>
                </div>
                <Clock className="w-8 h-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Pupil History Records
              <Badge variant="outline" className="ml-2">{filteredData.length} pupils</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 bg-gray-50/80">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="font-semibold text-gray-700">Personal Information</TableHead>
                    <TableHead className="font-semibold text-gray-700">Joining Data</TableHead>
                    <TableHead className="font-semibold text-gray-700">Status History</TableHead>
                    <TableHead className="font-semibold text-gray-700">Class History</TableHead>
                    <TableHead className="font-semibold text-gray-700">Guardian</TableHead>

                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((pupil) => (
                    <React.Fragment key={pupil.id}>
                      <TableRow className="hover:bg-gray-50/50 border-gray-100">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpansion(pupil.id)}
                            className="h-6 w-6 p-0"
                          >
                            {expandedRows.has(pupil.id) ? 
                              <ChevronDown className="w-4 h-4" /> : 
                              <ChevronRight className="w-4 h-4" />
                            }
                          </Button>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900">{pupil.fullName}</div>
                            <div className="text-sm text-gray-500">{pupil.admissionNumber}</div>
                            <div className="text-xs text-gray-400">
                              Age: {pupil.age} • {pupil.gender}
                            </div>
                            {pupil.currentClass && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {pupil.currentClass}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              Joined: {format(new Date(pupil.joinedDate), "MMM dd, yyyy")}
                            </div>
                            <div className="text-xs text-gray-500">
                              {pupil.currentStatus === 'Active' ? 
                                `Active for ${pupil.totalYearsInSchool}` :
                                `Stayed for ${pupil.totalYearsInSchool}`
                              }
                            </div>
                            {pupil.leftDate && (
                              <div className="text-xs text-gray-400">
                                Left: {format(new Date(pupil.leftDate), "MMM dd, yyyy")}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-2">
                            {pupil.statusHistory.map((status, index) => (
                              <div key={index} className="flex items-start gap-2">
                                <div className="flex items-center gap-1">
                                  <Badge className={`${getStatusBadgeColor(status.status)} flex items-center gap-1 text-xs`}>
                                    {getStatusIcon(status.status)}
                                    {status.status}
                                  </Badge>
                                  {status.isCurrent && (
                                    <span className="text-xs text-green-600 font-medium">Current</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-gray-600">
                                    {format(new Date(status.startDate), "MMM yyyy")} - {
                                      status.endDate ? format(new Date(status.endDate), "MMM yyyy") : "Present"
                                    }
                                  </div>
                                  <div className="text-xs text-gray-500">Duration: {status.duration}</div>
                                  {status.reason && (
                                    <div className="text-xs text-gray-400 italic">Reason: {status.reason}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-3">
                            {pupil.classHistory.map((history, index) => (
                              <div key={index} className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                  history.status === 'current' ? 'bg-green-500' :
                                  history.status === 'completed' ? 'bg-blue-500' : 'bg-gray-400'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">{history.class}</span>
                                    <Badge variant="outline" className={`text-xs ${
                                      history.status === 'current' ? 'bg-green-50 text-green-700 border-green-200' :
                                      history.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}>
                                      {history.status}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {format(new Date(history.startDate), "MMM yyyy")} - {
                                      history.endDate ? format(new Date(history.endDate), "MMM yyyy") : "Present"
                                    }
                                  </div>
                                  <div className="text-xs text-gray-500">Duration: {history.duration}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{pupil.guardian.name}</div>
                            <div className="text-xs text-gray-500">{pupil.guardian.relationship}</div>
                            <div className="text-xs text-gray-400">{pupil.guardian.phone}</div>
                          </div>
                        </TableCell>


                      </TableRow>

                      {/* Expanded Row Content */}
                      {expandedRows.has(pupil.id) && (
                        <TableRow>
                                                    <TableCell colSpan={6} className="bg-gray-50/30 p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              
                              {/* Left Column - Contact & Fees Information */}
                               <div className="space-y-4">

                                {/* Contact Information */}
                                <Card>
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-green-600" />
                                      Contact Info
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    {pupil.contact.phone && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Phone className="w-3 h-3 text-gray-400" />
                                        {pupil.contact.phone}
                                      </div>
                                    )}
                                    {pupil.contact.email && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Mail className="w-3 h-3 text-gray-400" />
                                        {pupil.contact.email}
                                      </div>
                                    )}
                                    {pupil.contact.address && (
                                      <div className="flex items-start gap-2 text-sm">
                                        <MapPin className="w-3 h-3 text-gray-400 mt-0.5" />
                                        <span className="text-xs">{pupil.contact.address}</span>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>

                                {/* Fees Information */}
                                <Card>
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                      <DollarSign className="w-4 h-4 text-green-600" />
                                      Fees Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                        <div className="text-xs text-gray-500">Total Paid</div>
                                        <div className="text-lg font-semibold text-green-600">
                                          ₵{pupil.fees.totalPaid.toLocaleString()}
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="text-xs text-gray-500">Outstanding</div>
                                        <div className={`text-lg font-semibold ${
                                          pupil.fees.outstanding > 0 ? 'text-red-600' : 'text-gray-400'
                                        }`}>
                                          ₵{pupil.fees.outstanding.toLocaleString()}
                                        </div>
                                      </div>
                                    </div>
                                    {pupil.fees.lastPayment && (
                                      <div className="space-y-1">
                                        <div className="text-xs text-gray-500">Last Payment</div>
                                        <div className="text-sm text-gray-700">
                                          {format(new Date(pupil.fees.lastPayment), "MMM dd, yyyy")}
                                        </div>
                                      </div>
                                    )}
                                    <div className="pt-2 border-t border-gray-100">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Payment Status</span>
                                        <Badge className={`${
                                          pupil.fees.outstanding === 0 
                                            ? 'bg-green-50 text-green-700 border-green-200' 
                                            : 'bg-red-50 text-red-700 border-red-200'
                                        }`}>
                                          {pupil.fees.outstanding === 0 ? 'Paid Up' : 'Outstanding'}
                                        </Badge>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                              </div>

                              {/* Right Column - Achievements & Additional Info */}
                              <div className="space-y-4">
                                {/* Achievements */}
                                {pupil.achievements.length > 0 ? (
                                  <Card>
                                    <CardHeader className="pb-3">
                                      <CardTitle className="text-base flex items-center gap-2">
                                        <Award className="w-4 h-4 text-yellow-600" />
                                        Achievements
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-1">
                                        {pupil.achievements.map((achievement, index) => (
                                          <div key={index} className="text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded">
                                            {achievement}
                                          </div>
                                        ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ) : (
                                  <Card>
                                    <CardHeader className="pb-3">
                                      <CardTitle className="text-base flex items-center gap-2">
                                        <Award className="w-4 h-4 text-gray-400" />
                                        Achievements
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="text-sm text-gray-500 italic">
                                        No achievements recorded yet
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}

                                {/* Academic Summary */}
                                <Card>
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                      <BarChart3 className="w-4 h-4 text-blue-600" />
                                      Academic Summary
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-500">Total Classes:</span>
                                      <span className="font-medium">{pupil.classHistory.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-500">Status Changes:</span>
                                      <span className="font-medium">{pupil.statusHistory.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-500">Years in School:</span>
                                      <span className="font-medium">{pupil.totalYearsInSchool}</span>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredData.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pupils Found</h3>
                <p className="text-sm text-gray-500">
                  Try adjusting your filters to find pupil history records.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}