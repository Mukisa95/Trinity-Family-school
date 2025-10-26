"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserCheck, 
  GraduationCap, 
  BookOpen, 
  TrendingUp, 
  Activity, 
  Loader2,
  ChevronRight,
  BarChart3,
  Calendar,
  Award,
  Target,
  Zap,
  RotateCcw,
  Sparkles,
  Star,
  Heart,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  MessageCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardData } from '@/lib/hooks/use-dashboard-data';
import { useAttendanceByDateRange } from '@/lib/hooks/use-attendance';
import { useExcludedDays } from '@/lib/hooks/use-excluded-days';
import { useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { isSchoolDay } from '@/lib/utils/attendance-academic-utils';
import Head from 'next/head';
import { format, addDays, getDay } from 'date-fns';
import { useAuth } from '@/lib/contexts/auth-context';

// CountUp component for animated numbers
const CountUp = ({ end, duration = 1.5 }: { end: number; duration?: number }) => {
  const [count, setCount] = useState(0);

  React.useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      setCount(Math.floor(end * progress));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <span>{count.toLocaleString()}</span>;
};

// Modern Stat Card Component
const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  onClick, 
  subtitle,
  trend,
  isLoading = false
}: { 
  title: string; 
  value: number; 
  icon: any;
  color: {
    bg: string;
    text: string;
    accent: string;
    gradient: string;
  };
  onClick?: () => void;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  isLoading?: boolean;
}) => {
  const handleClick = () => {
    if (!onClick) return;
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(card => card.classList.add('animate-exit'));
    setTimeout(() => onClick(), 400);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`stat-card relative overflow-hidden rounded-lg shadow-sm border border-l-4 ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      } transition-all duration-300 transform hover:scale-[1.02] group`}
      style={{ 
        borderLeftColor: color.accent,
        background: color.gradient
      }}
      onClick={handleClick}
    >
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />
      <div className="relative p-3 h-full flex flex-col justify-between min-h-[100px]">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium uppercase tracking-wider ${color.text} mb-1 truncate`}>
              {title}
            </p>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 leading-tight">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CountUp end={value} />
              )}
            </h3>
            {subtitle && (
              <p className="text-xs text-gray-600 truncate">{subtitle}</p>
            )}
          </div>
          <div 
            className={`p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform duration-300 flex-shrink-0 ml-2`}
            style={{ backgroundColor: color.bg }}
          >
            <Icon className={`w-4 h-4 md:w-5 md:h-5 ${color.text}`} />
          </div>
        </div>
        
        {trend && (
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center space-x-1">
              <TrendingUp 
                className={`w-3 h-3 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`} 
              />
              <span className={`text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.value}%
              </span>
            </div>
            <div className="h-1 w-12 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-1 rounded-full transition-all duration-1000 ${
                  trend.isPositive ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(Math.abs(trend.value), 100)}%` }}
              />
            </div>
          </div>
        )}
        
        {onClick && (
          <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ChevronRight className="w-3 h-3 text-gray-400" />
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Pupil Row with Inline Info and History
const PupilRowWithDetails = ({
  pupil,
  showInfo,
  showHistory,
  historyDuration,
  router
}: {
  pupil: any;
  showInfo: boolean;
  showHistory: boolean;
  historyDuration: 'week' | 'month' | 'term';
  router: any;
}) => {
  // Calculate date range for history
  const dateRange = useMemo(() => {
    const end = new Date();
    let start = new Date();
    
    if (historyDuration === 'week') {
      start.setDate(end.getDate() - 7);
    } else if (historyDuration === 'month') {
      start.setMonth(end.getMonth() - 1);
    } else {
      start.setMonth(end.getMonth() - 3);
    }
    
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    };
  }, [historyDuration]);

  // Fetch attendance history for this pupil
  const { data: historyRecords = [] } = useAttendanceByDateRange(
    dateRange.start,
    dateRange.end
  );

  // Calculate stats
  const stats = useMemo(() => {
    const pupilRecords = historyRecords.filter(r => r.pupilId === pupil.id);
    const present = pupilRecords.filter(r => r.status === 'Present').length;
    const absent = pupilRecords.filter(r => r.status === 'Absent').length;
    const late = pupilRecords.filter(r => r.status === 'Late').length;
    const total = pupilRecords.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { present, absent, late, total, rate };
  }, [pupil.id, historyRecords]);

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Pupil Name - Always Visible */}
      <div 
        className="p-2 sm:p-3 hover:bg-blue-50 cursor-pointer flex items-center gap-2 group"
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/attendance/view?pupilId=${pupil.id}`);
        }}
      >
        <UserCheck className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">
          {pupil.firstName} {pupil.lastName}
        </span>
      </div>

      {/* Guardian Info - Shows when Info toggle is ON */}
      {showInfo && (
        <div className="px-3 sm:px-4 pb-2 space-y-1.5 bg-blue-50/50 border-t border-blue-100">
          {pupil.guardians && pupil.guardians.length > 0 ? (
            pupil.guardians.map((guardian: any, idx: number) => {
              const guardianName = guardian.name || `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim() || 'Guardian';
              const phones = [guardian.phone, guardian.secondaryPhone, ...(guardian.additionalPhones || [])].filter(Boolean);
              
              return phones.length > 0 ? (
                <div key={idx} className="space-y-0.5">
                  <div className="text-xs font-medium text-gray-700">
                    {guardianName} {guardian.relationship && <span className="text-gray-500">({guardian.relationship})</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {phones.map((phone, pIdx) => (
                      <a
                        key={pIdx}
                        href={`tel:${phone}`}
                        className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-md font-mono text-xs transition-colors inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px]">📞</span>
                        {phone}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={idx} className="text-xs text-gray-500">
                  {guardianName} - No contact
                </div>
              );
            })
          ) : (
            <p className="text-xs text-gray-500 italic py-1">No guardian information available</p>
          )}
        </div>
      )}

      {/* Attendance History - Shows when History toggle is ON */}
      {showHistory && (
        <div className="px-3 sm:px-4 pb-2 bg-amber-50/30">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-600" />
                <span>{stats.present}</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-600" />
                <span>{stats.absent}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>{stats.late}</span>
              </div>
            </div>
            <span className={`font-bold px-1.5 py-0.5 rounded ${
              stats.rate >= 90 ? 'bg-green-100 text-green-700' :
              stats.rate >= 75 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {stats.rate}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Expandable Attendance Stat Card Component
const ExpandableAttendanceCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  subtitle,
  isLoading = false,
  attendanceData,
  pupils,
  filterType
}: { 
  title: string; 
  value: number; 
  icon: any;
  color: {
    bg: string;
    text: string;
    accent: string;
    gradient: string;
  };
  subtitle?: string;
  isLoading?: boolean;
  attendanceData?: any;
  pupils?: any[];
  filterType: 'present' | 'absent';
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDuration, setHistoryDuration] = useState<'week' | 'month' | 'term'>('week');
  const router = useRouter();

  // Calculate class breakdown with pupils
  const classBreakdown = useMemo(() => {
    if (!attendanceData?.byClass || !pupils || !attendanceData?.records) return [];
    
    // Group pupils by class to get totals, names, and class codes
    const pupilsByClass = pupils.reduce((acc: any, pupil: any) => {
      if (!pupil.classId) return acc;
      if (!acc[pupil.classId]) {
        acc[pupil.classId] = {
          classId: pupil.classId,
          className: pupil.classCode || pupil.className || 'Unknown', // Use classCode preferentially
          total: 0,
          pupils: []
        };
      }
      acc[pupil.classId].total++;
      acc[pupil.classId].pupils.push(pupil);
      return acc;
    }, {});

    // Get attendance records for filtering
    const recordsByPupil = attendanceData.records.reduce((acc: any, record: any) => {
      acc[record.pupilId] = record.status;
      return acc;
    }, {});

    // Merge with attendance data and enrich with class names from pupils
    const breakdown = attendanceData.byClass.map((classData: any) => {
      const pupilData = pupilsByClass[classData.classId] || { total: 0, pupils: [], className: 'Unknown' };
      
      // Filter pupils by status
      const filteredPupils = pupilData.pupils.filter((pupil: any) => {
        const status = recordsByPupil[pupil.id];
        if (filterType === 'present') {
          return status === 'Present' || status === 'Late';
        } else {
          // For absent: only show pupils explicitly marked as Absent
          return status === 'Absent';
        }
      });

      return {
        classId: classData.classId,
        className: pupilData.className, // Use className from pupils data
        present: classData.present,
        absent: classData.absent,
        late: classData.late,
        total: pupilData.total,
        recorded: classData.total,
        pupils: filteredPupils
      };
    });

    // Sort by class name
    return breakdown.sort((a: any, b: any) => {
      const aNum = parseInt(a.className.match(/\d+/)?.[0] || '0');
      const bNum = parseInt(b.className.match(/\d+/)?.[0] || '0');
      return aNum - bNum;
    });
  }, [attendanceData, pupils, filterType]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="stat-card relative overflow-visible rounded-lg shadow-sm border border-l-4 cursor-pointer hover:shadow-md transition-all duration-300 group"
        style={{ 
          borderLeftColor: color.accent,
          background: color.gradient
        }}
      >
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />
        <div className="relative">
          {/* Expand/Collapse Icon - Top Right */}
          <div className="absolute top-2 right-2 z-10 pointer-events-none">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>

          {/* Card Header - Always Visible */}
          <div 
            className="p-3 flex flex-col justify-between min-h-[100px]"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0 pr-6">
                <p className={`text-xs font-medium uppercase tracking-wider ${color.text} mb-1 truncate`}>
                  {title}
                </p>
                {isLoading ? (
                  <div className="flex items-center space-x-2 mt-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="text-sm text-gray-500">Loading...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline space-x-1 mt-1">
                      <span className="text-2xl md:text-3xl font-bold text-gray-900">
                        <CountUp end={value} />
                      </span>
                    </div>
                    {subtitle && (
                      <p className="text-xs text-gray-600 mt-1 truncate">{subtitle}</p>
                    )}
                  </>
                )}
              </div>
              <div 
                className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                style={{ backgroundColor: color.bg }}
              >
                <Icon className={`w-4 h-4 md:w-5 md:h-5 ${color.text}`} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating Expansion Panel */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => {
                setIsExpanded(false);
                setExpandedClass(null);
              }}
            />
            
            {/* Floating Panel - Responsive */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 
                left-4 right-4 top-16
                sm:left-1/2 sm:-translate-x-1/2 sm:top-16 sm:w-[75vw] sm:max-w-xl
                lg:w-[60vw] lg:max-w-lg
                xl:w-[50vw] xl:max-w-md"
            >
              <Card className="shadow-2xl border-2 flex flex-col max-h-[calc(100vh-8rem)]" style={{ borderColor: color.accent }}>
                <CardHeader className="pb-2 border-b flex-shrink-0" style={{ background: color.gradient }}>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color.text}`} />
                      <span className="hidden sm:inline">{title} - By Class</span>
                      <span className="sm:hidden">{title}</span>
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(false);
                        setExpandedClass(null);
                        setShowInfo(false);
                        setShowHistory(false);
                      }}
                      className="h-7 w-7 p-0 hover:bg-white/50"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                  {expandedClass && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={showInfo ? 'default' : 'outline'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowInfo(!showInfo);
                        }}
                        className="h-7 text-xs"
                      >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Info
                      </Button>
                      <Button
                        size="sm"
                        variant={showHistory ? 'default' : 'outline'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowHistory(!showHistory);
                        }}
                        className="h-7 text-xs"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        History
                      </Button>
                      {showHistory && (
                        <div className="ml-auto flex gap-1">
                          {(['week', 'month', 'term'] as const).map((duration) => (
                            <Button
                              key={duration}
                              size="sm"
                              variant={historyDuration === duration ? 'default' : 'ghost'}
                              onClick={(e) => {
                                e.stopPropagation();
                                setHistoryDuration(duration);
                              }}
                              className="h-7 text-xs px-2 capitalize"
                            >
                              {duration}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto flex-1 min-h-0">
                  {classBreakdown.length === 0 ? (
                    <div className="p-8 text-center">
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No attendance data available</p>
                    </div>
                  ) : (
                    <div>
                      {classBreakdown.map((classData: any) => {
                        const displayValue = filterType === 'present' ? classData.present : classData.absent;
                        const percentage = classData.total > 0 
                          ? Math.round((displayValue / classData.total) * 100) 
                          : 0;
                        const isClassExpanded = expandedClass === classData.classId;
                        
                        return (
                          <div key={classData.classId} className="border-b last:border-b-0">
                            <div 
                              className="flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isClassExpanded) {
                                  setExpandedClass(null);
                                } else {
                                  setExpandedClass(classData.classId);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <span className="text-sm sm:text-base font-bold text-gray-900 min-w-[50px] sm:min-w-[70px]">
                                  {classData.className}
                                </span>
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      filterType === 'present' ? 'bg-green-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm sm:text-base font-bold text-gray-900">
                                  {displayValue}/{classData.total}
                                </span>
                                {isClassExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                            </div>
                            
                            {/* Pupil List with Info and History Inline */}
                            {isClassExpanded && (
                              <div className="bg-gray-50 border-t">
                                <div className="px-3 sm:px-4 pb-3">
                                  {classData.pupils.length === 0 ? (
                                    <p className="text-xs sm:text-sm text-gray-500 italic py-3">No pupils {filterType}</p>
                                  ) : (
                                    <div className="space-y-2 pt-2">
                                      {classData.pupils.map((pupil: any) => (
                                        <PupilRowWithDetails
                                          key={pupil.id}
                                          pupil={pupil}
                                          showInfo={showInfo}
                                          showHistory={showHistory}
                                          historyDuration={historyDuration}
                                          router={router}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// Class Enrollment Chart Component
const ClassEnrollmentChart = ({ classes, pupils }: { classes: any[]; pupils: any[] }) => {
  const router = useRouter();
  
  const chartData = useMemo(() => {
    if (!classes || !pupils) return [];
    
    return classes.map(classItem => {
      const classPupils = pupils.filter(p => p.classId === classItem.id && p.status === 'Active');
      const male = classPupils.filter(p => p.gender === 'Male').length;
      const female = classPupils.filter(p => p.gender === 'Female').length;
      
      return {
        name: classItem.code || classItem.name,
        Male: male,
        Female: female,
        Total: male + female,
        id: classItem.id
      };
    }).sort((a, b) => {
      const codeA = parseInt(a.name.replace(/\D/g, '') || '0');
      const codeB = parseInt(b.name.replace(/\D/g, '') || '0');
      return codeA - codeB;
    });
  }, [classes, pupils]);

  const handleBarClick = (data: any) => {
    if (data && data.id) {
      router.push(`/class-detail?id=${data.id}`);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Class Enrollment
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/classes')}
            className="text-indigo-600 hover:text-indigo-700"
          >
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="maleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                </linearGradient>
                <linearGradient id="femaleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EC4899" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#F472B6" stopOpacity={0.8}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 500 }} 
                axisLine={{ stroke: '#e5e7eb' }} 
                tickLine={false}
                height={25}
              />
              <YAxis 
                tick={{ fill: '#6b7280', fontSize: 11 }} 
                axisLine={{ stroke: '#e5e7eb' }} 
                tickLine={false} 
                width={30} 
              />
              <Tooltip 
                cursor={{ fill: 'rgba(243, 244, 246, 0.4)' }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const male = payload[0].value as number;
                    const female = payload[1].value as number;
                    const total = male + female;
                    
                    return (
                      <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-100">
                        <p className="font-semibold text-gray-700 mb-2">Class {label}</p>
                        <div className="space-y-1">
                          <p className="text-sm text-violet-600 font-medium flex justify-between gap-3">
                            <span>Boys:</span>
                            <span className="font-semibold">{male}</span>
                          </p>
                          <p className="text-sm text-pink-600 font-medium flex justify-between gap-3">
                            <span>Girls:</span>
                            <span className="font-semibold">{female}</span>
                          </p>
                          <div className="h-px bg-gray-100 my-1"></div>
                          <p className="text-sm text-gray-600 font-medium flex justify-between gap-3">
                            <span>Total:</span>
                            <span className="font-semibold">{total}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="Male" 
                fill="url(#maleGradient)" 
                radius={[4, 4, 0, 0]} 
                name="Boys" 
                stackId="a"
                onClick={handleBarClick}
                cursor="pointer"
              />
              <Bar 
                dataKey="Female" 
                fill="url(#femaleGradient)" 
                radius={[4, 4, 0, 0]} 
                name="Girls" 
                stackId="a"
                onClick={handleBarClick}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Today's Attendance Chart - Shows attendance by class
const TodaysAttendanceChart = ({ classes, pupils }: { classes: any[]; pupils: any[] }) => {
  const router = useRouter();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentDate = new Date();
  
  // Get today's attendance records
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useAttendanceByDateRange(today, today);
  
  // Get excluded days and academic year data
  const { data: excludedDays = [] } = useExcludedDays();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  
  // Use the new term status system for recess information
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  
  // Check if today is a school day
  const isToday = useMemo(() => {
    return isSchoolDay(currentDate, activeAcademicYear || null, excludedDays);
  }, [currentDate, activeAcademicYear, excludedDays]);
  
  // Function to get the next school day
  const getNextSchoolDay = useMemo(() => {
    if (isToday) return null;
    
    let nextDay = addDays(currentDate, 1);
    let attempts = 0;
    
    // Look for the next school day within 14 days
    while (attempts < 14) {
      if (isSchoolDay(nextDay, activeAcademicYear || null, excludedDays)) {
        return nextDay;
      }
      nextDay = addDays(nextDay, 1);
      attempts++;
    }
    
    return null;
  }, [isToday, currentDate, activeAcademicYear, excludedDays]);
  
  // Function to get holiday/non-school day message
  const getNonSchoolDayMessage = useMemo(() => {
    if (isToday) return null;
    
    const dayOfWeek = getDay(currentDate);
    const nextSchoolDay = getNextSchoolDay;
    
    // Check if it's a weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const dayName = dayOfWeek === 0 ? 'Sunday' : 'Saturday';
      if (nextSchoolDay) {
        return {
          title: `Happy ${dayName}!`,
          message: `Enjoy your weekend. See you on ${format(nextSchoolDay, 'EEEE')}.`,
          icon: '🎉'
        };
      }
      return {
        title: `Happy ${dayName}!`,
        message: 'Enjoy your weekend.',
        icon: '🎉'
      };
    }
    
    // Check for specific holidays
    const todayExcluded = excludedDays.find(day => {
      if (day.type === 'specific_date' && day.date) {
        return day.date === today;
      }
      return false;
    });
    
    if (todayExcluded?.description) {
      if (nextSchoolDay) {
        return {
          title: `Happy ${todayExcluded.description}!`,
          message: `Enjoy your holiday. See you on ${format(nextSchoolDay, 'EEEE')}.`,
          icon: '🎊'
        };
      }
      return {
        title: `Happy ${todayExcluded.description}!`,
        message: 'Enjoy your holiday.',
        icon: '🎊'
      };
    }
    
    // Generic non-school day message
    if (nextSchoolDay) {
      return {
        title: 'No School Today',
        message: `See you on ${format(nextSchoolDay, 'EEEE')}.`,
        icon: '📚'
      };
    }
    
    return {
      title: 'No School Today',
      message: 'Enjoy your day off.',
      icon: '📚'
    };
  }, [isToday, currentDate, excludedDays, today, getNextSchoolDay]);
  
  const chartData = useMemo(() => {
    if (!classes || !pupils || !attendanceRecords) return [];
    
    return classes.map(classItem => {
      const classPupils = pupils.filter(p => p.classId === classItem.id && p.status === 'Active');
      const totalPupils = classPupils.length;
      
      if (totalPupils === 0) return null;
      
      // Get attendance records for this class today
      const classAttendance = attendanceRecords.filter(record => record.classId === classItem.id);
      
      const present = classAttendance.filter(r => r.status === 'Present').length;
      const absent = classAttendance.filter(r => r.status === 'Absent').length;
      const late = classAttendance.filter(r => r.status === 'Late').length;
      const excused = classAttendance.filter(r => r.status === 'Excused').length;
      const notRecorded = Math.max(0, totalPupils - classAttendance.length);
      
      const attendanceRate = totalPupils > 0 ? Math.round(((present + late) / totalPupils) * 100) : 0;
      
      const displayName = classItem.code || classItem.name;
      const shortName = displayName.length > 10 ? 
        displayName.substring(0, 10) + '...' : 
        displayName;
      
      return {
        name: shortName,
        className: classItem.name,
        present,
        absent,
        late,
        excused,
        notRecorded,
        totalPupils,
        attendanceRate,
        id: classItem.id
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      const codeA = parseInt(a.name.replace(/\D/g, '') || '0');
      const codeB = parseInt(b.name.replace(/\D/g, '') || '0');
      return codeA - codeB;
    });
  }, [classes, pupils, attendanceRecords]);

  const handleBarClick = (data: any) => {
    if (data && data.id) {
      router.push(`/attendance/view?classId=${data.id}&date=${today}`);
    }
  };

  const handleChartClick = () => {
    router.push('/attendance/view');
  };

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const totals = chartData.reduce((acc, item) => ({
      present: acc.present + (item?.present || 0),
      total: acc.total + (item?.totalPupils || 0),
      recorded: acc.recorded + ((item?.totalPupils || 0) - (item?.notRecorded || 0))
    }), { present: 0, total: 0, recorded: 0 });
    
    const overallRate = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0;
    const recordingRate = totals.total > 0 ? Math.round((totals.recorded / totals.total) * 100) : 0;
    
    return { ...totals, overallRate, recordingRate };
  }, [chartData]);

  const getBarColor = (attendanceRate: number) => {
    if (attendanceRate >= 90) return '#10B981'; // Green
    if (attendanceRate >= 75) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  };

  return (
    <Card className="h-full cursor-pointer hover:shadow-lg transition-shadow duration-200" onClick={handleChartClick}>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex-1 min-w-0 pr-2">
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2 leading-tight">
              <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
              <span className="truncate">
                {isRecessMode ? 'Recess Period' : 'Today\'s Attendance'}
              </span>
            </CardTitle>
            <p className="text-xs sm:text-sm text-gray-500 truncate mt-0.5">
              {isRecessMode ? (
                <span className="text-amber-600">
                  Learners enjoying their break • Showing {effectiveTerm.term?.name || 'previous term'} data
                </span>
              ) : (
                `${format(new Date(), 'EEE, MMM d')} • ${overallStats.overallRate}% rate`
              )}
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 self-start sm:self-center">
            {isRecessMode && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 border-amber-200">
                🎓 Recess
              </Badge>
            )}
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              {overallStats.recorded}/{overallStats.total}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push('/attendance/view');
              }}
              className="text-blue-600 hover:text-blue-700 p-1 h-auto"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {attendanceLoading ? (
          <div className="h-[180px] flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : !isToday && getNonSchoolDayMessage ? (
          <div className="h-[180px] flex flex-col items-center justify-center text-center px-4">
            {isRecessMode ? (
              // Compact recess message
              <>
                <div className="text-3xl mb-2">🎓</div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  Learners on Recess
                </h3>
                <p className="text-xs text-gray-600 mb-2">
                  Attendance not being taken - learners enjoying their break
                </p>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-md p-2 mb-2">
                  <div className="text-xs text-amber-700 font-medium">
                    Showing {effectiveTerm.term?.name || 'previous term'} data
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {format(currentDate, 'MMM d, yyyy')}
                </div>
              </>
            ) : (
              // Regular non-school day message
              <>
                <div className="text-4xl mb-3">{getNonSchoolDayMessage.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {getNonSchoolDayMessage.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {getNonSchoolDayMessage.message}
                </p>
                <div className="mt-4 text-xs text-gray-500">
                  {format(currentDate, 'EEEE, MMMM d, yyyy')}
                </div>
              </>
            )}
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[180px] flex flex-col items-center justify-center text-gray-500">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm">No attendance data available</p>
          </div>
        ) : (
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 35 }}>
                <defs>
                  <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  height={35}
                  interval={0}
                />
                <YAxis 
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                  width={25}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white rounded-lg shadow-lg p-3 border max-w-xs">
                          <p className="font-semibold text-gray-900 mb-2 text-sm">{data.className}</p>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                              <span>Present: {data.present}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-yellow-600 flex-shrink-0" />
                              <span>Late: {data.late}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <XCircle className="w-3 h-3 text-red-600 flex-shrink-0" />
                              <span>Absent: {data.absent}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-3 h-3 text-blue-600 flex-shrink-0" />
                              <span>Excused: {data.excused}</span>
                            </div>
                            {data.notRecorded > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0"></span>
                                <span>Not recorded: {data.notRecorded}</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 pt-2 border-t">
                            <p className="font-medium text-blue-600 text-xs">
                              Rate: {data.attendanceRate}%
                            </p>
                            {isRecessMode && (
                              <p className="text-xs text-amber-600 mt-1 font-medium">
                                Showing {effectiveTerm.term?.name || 'previous term'} data
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">Click bar to view details</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="present" 
                  fill="url(#attendanceGradient)"
                  onClick={handleBarClick}
                  cursor="pointer"
                  radius={[2, 2, 0, 0]}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.attendanceRate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Beautiful Modern Photo Slideshow Component
const PhotoSlideshow = ({ photos }: { photos: any[] }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filter active photos
  const activePhotos = useMemo(() => {
    return photos?.filter(photo => photo.isActive) || [];
  }, [photos]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || activePhotos.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activePhotos.length);
    }, 4000); // Change slide every 4 seconds

    return () => clearInterval(interval);
  }, [isPlaying, activePhotos.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % activePhotos.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + activePhotos.length) % activePhotos.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleCenterClick = () => {
    setIsPlaying(!isPlaying);
    toggleFullscreen();
  };

  if (!activePhotos.length) {
    return (
      <Card className="h-full border-0 shadow-xl bg-gradient-to-br from-slate-50 via-white to-blue-50 overflow-hidden">
        <CardContent className="flex items-center justify-center h-64 relative">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, #3b82f6 2px, transparent 2px),
                               radial-gradient(circle at 75% 75%, #8b5cf6 2px, transparent 2px)`,
              backgroundSize: '24px 24px'
            }} />
          </div>
          
          <div className="text-center text-gray-400 relative z-10">
            <motion.div 
              className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center shadow-lg"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </motion.div>
            <p className="text-sm font-medium">No photos available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-0 shadow-xl bg-white overflow-hidden group">
      <CardContent className="p-0 relative">
        <div className="relative h-64 overflow-hidden cursor-pointer">
          {/* Main slideshow */}
          <div className="relative w-full h-full">
            {activePhotos.map((photo, index) => (
              <motion.div
                key={photo.id}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{
                  opacity: index === currentSlide ? 1 : 0,
                  scale: index === currentSlide ? 1 : 1.05,
                }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <img
                  src={photo.url}
                  alt={photo.title || 'School moment'}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {/* Modern gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
                
                {/* Subtle corner accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/10 to-transparent" />
              </motion.div>
            ))}
          </div>

          {/* Invisible Click Zones */}
          {activePhotos.length > 1 && (
            <>
              {/* Left click zone for previous */}
              <div 
                className="absolute left-0 top-0 w-1/3 h-full z-10 cursor-pointer"
                onClick={prevSlide}
              />
              
              {/* Right click zone for next */}
              <div 
                className="absolute right-0 top-0 w-1/3 h-full z-10 cursor-pointer"
                onClick={nextSlide}
              />
            </>
          )}

          {/* Center click zone for pause/play and fullscreen */}
          <div 
            className="absolute left-1/3 top-0 w-1/3 h-full z-10 cursor-pointer"
            onClick={handleCenterClick}
          />
        </div>
      </CardContent>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Close button */}
              <motion.button
                className="absolute top-4 right-4 w-12 h-12 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all duration-300 z-20"
                onClick={toggleFullscreen}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>

              {/* Fullscreen slideshow */}
              <div className="relative w-full h-full max-w-6xl max-h-[90vh] mx-4">
                {activePhotos.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{
                      opacity: index === currentSlide ? 1 : 0,
                      scale: index === currentSlide ? 1 : 0.9,
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <img
                      src={photo.url}
                      alt={photo.title || 'School moment'}
                      className="w-full h-full object-contain"
                    />
                  </motion.div>
                ))}

                {/* Fullscreen navigation */}
                {activePhotos.length > 1 && (
                  <>
                    {/* Left navigation area */}
                    <div 
                      className="absolute left-0 top-0 w-1/3 h-full z-10 cursor-pointer flex items-center justify-start pl-8"
                      onClick={prevSlide}
                    >
                      <motion.div
                        className="w-12 h-12 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity duration-300"
                        whileHover={{ scale: 1.1 }}
                      >
                        <ChevronRight className="w-6 h-6 rotate-180" />
                      </motion.div>
                    </div>
                    
                    {/* Right navigation area */}
                    <div 
                      className="absolute right-0 top-0 w-1/3 h-full z-10 cursor-pointer flex items-center justify-end pr-8"
                      onClick={nextSlide}
                    >
                      <motion.div
                        className="w-12 h-12 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity duration-300"
                        whileHover={{ scale: 1.1 }}
                      >
                        <ChevronRight className="w-6 h-6" />
                      </motion.div>
                    </div>
                  </>
                )}

                {/* Fullscreen play/pause area */}
                <div 
                  className="absolute left-1/3 top-0 w-1/3 h-full z-10 cursor-pointer flex items-center justify-center"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  <motion.div
                    className="w-16 h-16 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity duration-300"
                    whileHover={{ scale: 1.1 }}
                  >
                    {isPlaying ? (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </motion.div>
                </div>

                {/* Photo info */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/20 text-white text-sm font-medium">
                  {currentSlide + 1} / {activePhotos.length}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

// Particles Component for Background Animation
const Particles = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      delay: Math.random() * 2,
      duration: Math.random() * 20 + 10,
      opacity: Math.random() * 0.5 + 0.2,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
          }}
          animate={{
            y: [-20, -100],
            x: [0, Math.random() * 100 - 50],
            opacity: [particle.opacity, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};

// Floating Icons Component
const FloatingIcons = () => {
  const icons = [
    { Icon: Sparkles, color: 'text-yellow-300', delay: 0 },
    { Icon: Star, color: 'text-blue-200', delay: 0.5 },
    { Icon: Heart, color: 'text-pink-300', delay: 1 },
    { Icon: Award, color: 'text-purple-200', delay: 1.5 },
    { Icon: GraduationCap, color: 'text-green-200', delay: 2 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {icons.map(({ Icon, color, delay }, index) => (
        <motion.div
          key={index}
          className={`absolute ${color} opacity-30`}
          style={{
            left: `${10 + index * 20}%`,
            top: `${20 + (index % 2) * 40}%`,
          }}
          animate={{
            y: [-10, 10],
            rotate: [0, 360],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 4 + index,
            delay: delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Icon size={24} />
        </motion.div>
      ))}
    </div>
  );
};

// Enhanced Header Component
const EnhancedHeader = ({ schoolSettings }: { schoolSettings: any }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [clickRipple, setClickRipple] = useState({ x: 0, y: 0, show: false });
  const [isMobile, setIsMobile] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);
  const [greetingMessage, setGreetingMessage] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate greeting ONCE when component mounts or user changes
  useEffect(() => {
    // Get user's actual name from staff data
    const getUserDisplayName = () => {
      if (user?.firstName) return user.firstName;
      if (user?.username) {
        const username = user.username;
        if (username.includes(' ')) return username.split(' ')[0];
        if (username.includes('_') || username.includes('.')) return username.split(/[_.]/)[0];
        return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
      }
      return "Friend";
    };

    const hour = new Date().getHours();
    const name = getUserDisplayName();
    
    // Time-based greetings
    let timeGreeting = "Good day";
    if (hour < 12) timeGreeting = "Good morning";
    else if (hour < 17) timeGreeting = "Good afternoon";
    else timeGreeting = "Good evening";
    
    // Friendly variations - randomly selected ONCE
    const variations = [
      `Hello and welcome, ${name}! ${timeGreeting} ✨`,
      `Hey ${name}! ${timeGreeting} 🌟`,
      `Welcome back, ${name}! ${timeGreeting} 👋`,
      `${timeGreeting}, ${name}! Great to see you! 😊`,
      `Hi ${name}! ${timeGreeting} and welcome! 🎉`,
      `${timeGreeting}, ${name}! Ready to make magic? ✨`,
      `Hello ${name}! ${timeGreeting}! Let's do this! 💪`,
      `Welcome, ${name}! ${timeGreeting} 🌈`,
      `Hey there, ${name}! ${timeGreeting}! 🚀`,
      `${timeGreeting}, ${name}! Welcome aboard! ⭐`,
    ];
    
    // Select random variation ONCE and store it
    const selectedGreeting = variations[Math.floor(Math.random() * variations.length)];
    setGreetingMessage(selectedGreeting);
  }, [user]); // Only regenerate when user changes (login/logout)

  // Greeting stays visible for 6 seconds (longer for better UX)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowGreeting(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  const handleHeaderClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setClickRipple({ x, y, show: true });
    setTimeout(() => setClickRipple(prev => ({ ...prev, show: false })), 600);
  };

  // Mobile-optimized particle count
  const particleCount = isMobile ? (isHovered ? 30 : 20) : (isHovered ? 80 : 50);
  
  // Mobile-optimized icon count
  const icons = isMobile ? [
    { Icon: Sparkles, color: 'text-yellow-300', delay: 0 },
    { Icon: Award, color: 'text-purple-200', delay: 0.5 },
    { Icon: GraduationCap, color: 'text-green-200', delay: 1 },
  ] : [
    { Icon: Sparkles, color: 'text-yellow-300', delay: 0 },
    { Icon: Star, color: 'text-blue-200', delay: 0.5 },
    { Icon: Heart, color: 'text-pink-300', delay: 1 },
    { Icon: Award, color: 'text-purple-200', delay: 1.5 },
    { Icon: GraduationCap, color: 'text-green-200', delay: 2 },
  ];

  return (
    <div 
      className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white mb-4 md:mb-6 overflow-hidden cursor-pointer transition-all duration-500"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleHeaderClick}
    >
      {/* Click Ripple Effect */}
      <AnimatePresence>
        {clickRipple.show && (
          <motion.div
            className="absolute bg-white/20 rounded-full pointer-events-none"
            style={{
              left: clickRipple.x - 25,
              top: clickRipple.y - 25,
              width: 50,
              height: 50,
            }}
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: isMobile ? 15 : 20, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Animated Background Gradient - Simplified */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 opacity-90" />
      
      {/* Enhanced Particles Background - Optimized for smooth performance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: particleCount }, (_, i) => {
          const size = Math.random() * (isMobile ? 3 : 4) + 1;
          const leftPos = Math.random() * 100;
          const topPos = Math.random() * 100;
          const duration = Math.random() * 5 + 8;
          const delay = Math.random() * 2;
          
          return (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white transform-gpu"
              style={{
                left: `${leftPos}%`,
                top: `${topPos}%`,
                width: `${size}px`,
                height: `${size}px`,
                willChange: 'transform, opacity',
              }}
              animate={{
                y: [0, -100],
                opacity: [0.6, 0],
              }}
              transition={{
                duration: duration,
                delay: delay,
                repeat: Infinity,
                ease: "linear",
                repeatDelay: 0,
              }}
            />
          );
        })}
      </div>
      
      {/* Enhanced Floating Icons - Optimized for smooth performance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {icons.map(({ Icon, color, delay }, index) => (
          <motion.div
            key={index}
            className={`absolute ${color} transform-gpu`}
            style={{
              left: isMobile ? `${20 + index * 25}%` : `${10 + index * 20}%`,
              top: `${20 + (index % 2) * (isMobile ? 20 : 40)}%`,
              opacity: 0.25,
              willChange: 'transform',
            }}
            animate={{
              y: [-8, 8],
              scale: [0.9, 1.1, 0.9],
              rotate: [0, 360],
            }}
            transition={{
              duration: 8 + index * 2,
              delay: delay,
              repeat: Infinity,
              ease: "linear",
              repeatDelay: 0,
            }}
          >
            <Icon size={isMobile ? 18 : 24} />
          </motion.div>
        ))}
      </div>
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-2 sm:px-3 lg:px-6 py-2 sm:py-3 md:py-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            scale: isHovered ? (isMobile ? 1.01 : 1.02) : 1,
          }}
          transition={{ 
            duration: 0.8, 
            ease: "easeOut",
            scale: { duration: 0.3 }
          }}
          className="text-center"
        >
          {/* Main Title - With overlay greeting - Fixed height container */}
          <div className="relative">
            {/* Reserve space for school name (always present, controls height) */}
            <motion.h1 
              className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold mb-1 sm:mb-2 md:mb-3 leading-tight"
              initial={{ opacity: 0 }}
              animate={{ opacity: showGreeting ? 0 : 1 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-block">
                {schoolSettings?.generalInfo?.name || 'TRINITY FAMILY NURSERY AND PRIMARY SCHOOL'}
              </span>
            </motion.h1>
            
            {/* Reserve space for motto (always present, controls height) */}
            <motion.p 
              className="text-xs sm:text-sm md:text-sm lg:text-base font-medium px-1 mb-2 sm:mb-3 md:mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: showGreeting ? 0 : 0.9 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <span>
                {schoolSettings?.generalInfo?.motto || 'GUIDING GROWTH, INSPIRING GREATNESS'}
              </span>
            </motion.p>
            
            {/* Greeting overlay - positioned absolutely over both lines */}
            <AnimatePresence>
              {showGreeting && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  style={{ top: 0, bottom: 0 }}
                >
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">
                    {greetingMessage}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Enhanced Animated Badges - Made More Compact */}
          <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
            <motion.div
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              whileHover={{ 
                scale: isMobile ? 1.05 : 1.1, 
                backgroundColor: "rgba(255,255,255,0.3)",
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/20 backdrop-blur-sm text-white border border-white/30 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium flex items-center gap-1 hover:bg-white/30 transition-all duration-300 cursor-pointer"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: isHovered ? (isMobile ? 15 : 10) : (isMobile ? 25 : 20), repeat: Infinity, ease: "linear" }}
                whileHover={{ scale: isMobile ? 1.1 : 1.2 }}
              >
                <Calendar className="w-3 h-3" />
              </motion.div>
              <span className="hidden xs:inline sm:inline">Academic Year </span>
              <span>{new Date().getFullYear()}</span>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
              whileHover={{ 
                scale: isMobile ? 1.05 : 1.1, 
                backgroundColor: "rgba(255,255,255,0.3)",
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/20 backdrop-blur-sm text-white border border-white/30 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium flex items-center gap-1 hover:bg-white/30 transition-all duration-300 cursor-pointer"
            >
              <motion.div
                animate={{ 
                  scale: isHovered ? [1, isMobile ? 1.2 : 1.4, 1] : [1, isMobile ? 1.1 : 1.2, 1],
                  rotate: [0, 8, -8, 0],
                }}
                transition={{ duration: isHovered ? (isMobile ? 1.5 : 1) : (isMobile ? 2.5 : 2), repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: isMobile ? 1.2 : 1.3 }}
              >
                <Award className="w-3 h-3" />
              </motion.div>
              <span className="hidden xs:inline">Excellence</span>
              <span className="xs:hidden">Excel.</span>
            </motion.div>
            
            {/* WhatsApp Group Badge */}
            <motion.a
              href="https://chat.whatsapp.com/LfKtwT6Qn5eDImR4gagwU3?mode=ac_t"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              whileHover={{ 
                scale: isMobile ? 1.05 : 1.1, 
                backgroundColor: "rgba(34, 197, 94, 0.3)",
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.95 }}
              className="bg-green-500/30 backdrop-blur-sm text-white border border-green-400/50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium flex items-center gap-1 hover:bg-green-500/40 transition-all duration-300 cursor-pointer"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: isMobile ? 1.2 : 1.3 }}
              >
                <MessageCircle className="w-3 h-3" />
              </motion.div>
              <span className="hidden xs:inline sm:inline">WhatsApp Group</span>
              <span className="xs:hidden sm:hidden">WhatsApp</span>
            </motion.a>
          </div>
          
          {/* Enhanced Decorative Line - Made More Compact */}
          <motion.div
            className="mt-2 sm:mt-3 md:mt-4 mx-auto"
            initial={{ width: 0 }}
            animate={{ width: isHovered ? (isMobile ? "60px" : "100px") : (isMobile ? "40px" : "80px") }}
            transition={{ duration: 1, delay: 1.2 }}
          >
            <motion.div
              className="bg-gradient-to-r from-transparent via-white to-transparent rounded-full"
              animate={{
                opacity: isHovered ? [0.7, 1, 0.7] : [0.5, 1, 0.5],
                height: isHovered ? (isMobile ? [1.5, 2.5, 1.5] : [2, 4, 2]) : (isMobile ? [1, 1.5, 1] : [1.5, 3, 1.5]),
              }}
              transition={{
                duration: isHovered ? (isMobile ? 1.5 : 1) : (isMobile ? 2.5 : 2),
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        </motion.div>
      </div>
      
      {/* Compact Feather Effect at Bottom - Made Even More Compact */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden">
        {/* Simplified feathers for mobile */}
        {Array.from({ length: isMobile ? 4 : 8 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute bottom-0"
            style={{
              left: `${i * (isMobile ? 25 : 12.5)}%`,
              width: isMobile ? '15%' : '10%',
              height: isMobile ? '12px' : '24px',
            }}
            animate={{
              y: [0, isMobile ? -1 : -3, 0],
              rotate: [0, isMobile ? 0.5 : 1, isMobile ? -0.5 : -1, 0],
              scaleY: isHovered ? [1, isMobile ? 1.05 : 1.1, 1] : [1, isMobile ? 1.02 : 1.05, 1],
            }}
            transition={{
              duration: isMobile ? 1.5 + i * 0.1 : 2.5 + i * 0.15,
              delay: i * (isMobile ? 0.03 : 0.08),
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <svg
              viewBox="0 0 100 24"
              className="w-full h-full"
              style={{ filter: isMobile ? 'none' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.05))' }}
            >
              <path
                d="M10,20 Q20,8 50,4 Q80,8 90,20 Q70,15 50,12 Q30,15 10,20"
                fill="rgba(255,255,255,0.06)"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="0.3"
              />
              <path
                d="M15,18 Q25,10 50,8 Q75,10 85,18 Q65,13 50,11 Q35,13 15,18"
                fill="rgba(255,255,255,0.02)"
              />
            </svg>
          </motion.div>
        ))}
        
        {/* Reduced floating feather elements for mobile */}
        {!isMobile && Array.from({ length: 3 }, (_, i) => (
          <motion.div
            key={`float-${i}`}
            className="absolute"
            style={{
              left: `${25 + i * 25}%`,
              bottom: '4px',
              width: '4px',
              height: '10px',
            }}
            animate={{
              y: [-2, -6, -2],
              x: [-0.5, 0.5, -0.5],
              rotate: [0, 5, -5, 0],
              opacity: [0.15, 0.3, 0.15],
            }}
            transition={{
              duration: 2 + i * 0.2,
              delay: i * 0.15,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <svg viewBox="0 0 4 10" className="w-full h-full">
              <path
                d="M2,0 Q2.5,2 2,4 Q1.5,6 2,10 Q1.8,6 2,4 Q2.2,2 2,0"
                fill="rgba(255,255,255,0.1)"
              />
            </svg>
          </motion.div>
        ))}
        
        {/* Soft gradient overlay for seamless blending - Made More Compact */}
        <motion.div
          className={`absolute bottom-0 left-0 w-full bg-gradient-to-t from-gray-50 to-transparent ${isMobile ? 'h-2' : 'h-4'}`}
          animate={{
            opacity: isHovered ? [0.7, 0.9, 0.7] : [0.5, 0.7, 0.5],
          }}
          transition={{
            duration: isMobile ? 2 : 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const router = useRouter();
  
  // 🚀 OPTIMIZED: Fetch data with caching (no refetch on navigation)
  const {
    pupils,
    staff,
    classes,
    attendanceData,
    schoolSettings,
    photos,
    stats,
    pupilsLoading,
    staffLoading,
    classesLoading,
    attendanceLoading,
    isLoading,
    hasError,
    refetchAll
  } = useDashboardData();

  const handleCardClick = (path: string) => {
    router.push(path);
  };

  // Color schemes for stat cards
  const cardColors = {
    pupils: {
      bg: 'rgba(59, 130, 246, 0.1)',
      text: 'text-blue-600',
      accent: '#3B82F6',
      gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 197, 253, 0.1) 100%)'
    },
    male: {
      bg: 'rgba(124, 58, 237, 0.1)',
      text: 'text-violet-600',
      accent: '#7C3AED',
      gradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(196, 181, 253, 0.1) 100%)'
    },
    female: {
      bg: 'rgba(236, 72, 153, 0.1)',
      text: 'text-pink-600',
      accent: '#EC4899',
      gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.05) 0%, rgba(249, 168, 212, 0.1) 100%)'
    },
    staff: {
      bg: 'rgba(168, 85, 247, 0.1)',
      text: 'text-purple-600',
      accent: '#A855F7',
      gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(216, 180, 254, 0.1) 100%)'
    },
    classes: {
      bg: 'rgba(34, 197, 94, 0.1)',
      text: 'text-green-600',
      accent: '#22C55E',
      gradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(134, 239, 172, 0.1) 100%)'
    },
    subjects: {
      bg: 'rgba(251, 146, 60, 0.1)',
      text: 'text-orange-600',
      accent: '#FB923C',
      gradient: 'linear-gradient(135deg, rgba(251, 146, 60, 0.05) 0%, rgba(254, 215, 170, 0.1) 100%)'
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <Head>
        <title>Dashboard - Trinity School Online</title>
        <meta name="description" content="Trinity School Online Dashboard - Comprehensive overview of school activities and statistics." />
      </Head>

      {/* Enhanced Header */}
      <EnhancedHeader schoolSettings={schoolSettings} />

      <div className="container mx-auto px-3 sm:px-6 lg:px-8 pb-6">
        {/* Loading Indicator - Simple cached loading */}
        {isLoading && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    ⚡ Loading dashboard data...
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Data will be cached for faster subsequent loads
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Error Indicator */}
        {hasError && !isLoading && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-900">
                      Error loading dashboard data
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      Please try refreshing the page
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={refetchAll}
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard
            title="Total Pupils"
            value={stats.totalPupils}
            icon={Users}
            color={cardColors.pupils}
            onClick={() => handleCardClick('/pupils')}
            subtitle="Active students"
            isLoading={pupilsLoading}
          />
          <StatCard
            title="Male Pupils"
            value={stats.malePupils}
            icon={UserCheck}
            color={cardColors.male}
            onClick={() => handleCardClick('/pupils')}
            subtitle={`${stats.totalPupils ? Math.round((stats.malePupils / stats.totalPupils) * 100) : 0}% of total`}
            isLoading={pupilsLoading}
          />
          <StatCard
            title="Female Pupils"
            value={stats.femalePupils}
            icon={UserCheck}
            color={cardColors.female}
            onClick={() => handleCardClick('/pupils')}
            subtitle={`${stats.totalPupils ? Math.round((stats.femalePupils / stats.totalPupils) * 100) : 0}% of total`}
            isLoading={pupilsLoading}
          />
          <StatCard
            title="Staff Members"
            value={stats.totalStaff}
            icon={Users}
            color={cardColors.staff}
            onClick={() => handleCardClick('/staff')}
            subtitle="Total staff"
            isLoading={staffLoading}
          />
          <ExpandableAttendanceCard
            title="Present Today"
            value={stats.presentToday}
            icon={CheckCircle}
            color={cardColors.classes}
            subtitle="In attendance"
            isLoading={attendanceLoading}
            attendanceData={attendanceData}
            pupils={pupils}
            filterType="present"
          />
          <ExpandableAttendanceCard
            title="Absent Today"
            value={stats.absentToday}
            icon={XCircle}
            color={{
              bg: 'rgba(239, 68, 68, 0.1)',
              text: 'text-red-600',
              accent: '#EF4444',
              gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(252, 165, 165, 0.1) 100%)'
            }}
            subtitle="Not present"
            isLoading={attendanceLoading}
            attendanceData={attendanceData}
            pupils={pupils}
            filterType="absent"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <ClassEnrollmentChart classes={classes} pupils={pupils} />
          <TodaysAttendanceChart classes={classes} pupils={pupils} />
          <PhotoSlideshow photos={photos || []} />
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <Card className="p-4 text-center hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => router.push('/attendance')}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-1 text-sm sm:text-base">Attendance</h3>
            <p className="text-xs sm:text-sm text-gray-600">Track daily attendance</p>
          </Card>
          
          <Card className="p-4 text-center hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => router.push('/fees')}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-1 text-sm sm:text-base">Fee Management</h3>
            <p className="text-xs sm:text-sm text-gray-600">Manage school fees</p>
          </Card>
          
          <Card className="p-4 text-center hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => router.push('/exams')}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-1 text-sm sm:text-base">Examinations</h3>
            <p className="text-xs sm:text-sm text-gray-600">Exam management</p>
          </Card>
          
          <Card className="p-4 text-center hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => router.push('/reports')}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            </div>
            <h3 className="font-semibold mb-1 text-sm sm:text-base">Reports</h3>
            <p className="text-xs sm:text-sm text-gray-600">Generate reports</p>
          </Card>
        </motion.div>
      </div>

      <style jsx>{`
        @keyframes slideAndFade {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-20px) scale(0.95); opacity: 0; }
        }
        .animate-exit {
          animation: slideAndFade 0.4s ease-in-out forwards;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
