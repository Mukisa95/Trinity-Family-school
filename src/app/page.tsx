"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserCheck,
  User,
  UserX,
  Briefcase,
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
  Info,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Building2,
  Phone,
  ImageIcon,
  ChevronLeft,
  Pause,
  Play,
  Minimize2,
  Maximize2
} from 'lucide-react';
import quotes from '@/data/quotes.json';
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
import { PillBar, VIBRANT_COLORS } from '@/components/ui/charts/pill-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QuickActionButton } from '@/components/ui/quick-action-button';
import { useDashboardData } from '@/lib/hooks/use-dashboard-data';
import { usePupils, useUpdatePupil } from '@/lib/hooks/use-pupils';
import { useAttendanceByDateRange, useUpdateAttendanceRecord } from '@/lib/hooks/use-attendance';
import { useExcludedDays } from '@/lib/hooks/use-excluded-days';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import { isSchoolDay } from '@/lib/utils/attendance-academic-utils';
import Head from 'next/head';
import { format, addDays, getDay, startOfWeek, startOfMonth } from 'date-fns';
import { useAuth } from '@/lib/contexts/auth-context';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { RecessStatusBanner } from '@/components/common/recess-status-banner';
import { TermScheduleCard } from '@/components/dashboard/TermScheduleCard';
import { MonthCalendarCard } from '@/components/dashboard/MonthCalendarCard';
import { DashboardLiveTracker } from '@/components/dashboard/DashboardLiveTracker';

// CountUp component for animated numbers
// CountUp component for animated numbers
const CountUp = ({ end, duration = 0.8 }: { end: number; duration?: number }) => {
  const [count, setCount] = useState(0);

  React.useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      // Simple linear easing — cheaper than easeOutQuart
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

// Reusable Animated Doughnut Component for Stat Cards
const AnimatedDoughnut = ({
  segments,
  progress, // Fallback for single segment
  color
}: {
  segments?: { percentage: number; color: string }[];
  progress?: number;
  color: { text: string };
}) => {
  // If no segments are provided, create a single segment from progress
  const activeSegments = segments || (progress !== undefined ? [{ percentage: progress, color: color.text }] : [{ percentage: 100, color: color.text }]);

  return (
    <svg className="absolute inset-0 w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 36 36">
      {/* Definitions for 3D Glow and Drop Shadow Effects */}
      <defs>
        <filter id="doughnut-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="currentColor" floodOpacity="0.4" />
        </filter>
        <filter id="inner-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Richer Background Track */}
      <path
        className="text-gray-200/50 dark:text-gray-700/50"
        d="M18 3 a 15 15 0 0 1 0 30 a 15 15 0 0 1 0 -30"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        style={{ filter: 'url(#inner-glow)' }}
      />
      {activeSegments.map((segment, index) => {
        // Calculate the starting offset for this segment
        const previousTotal = activeSegments
          .slice(0, index)
          .reduce((sum, s) => sum + s.percentage, 0);

        const dashoffset = 100 - previousTotal;

        return (
          <motion.path
            key={index}
            className={`${segment.color}`}
            d="M18 3 a 15 15 0 0 1 0 30 a 15 15 0 0 1 0 -30"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ strokeDasharray: "0, 100" }}
            animate={{ strokeDasharray: `${segment.percentage}, 100` }}
            transition={{
              duration: 0.4,
              ease: "easeOut",
              delay: 0
            }}
            style={{
              strokeDashoffset: -previousTotal,
              filter: 'url(#doughnut-shadow)'
            }}
          />
        );
      })}
    </svg>
  );
};

// Modern Stat Card Component - Optimized for Performance
const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
  onClick,
  subtitle,
  trend,
  progress,
  segments,
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
  progress?: number;
  segments?: { percentage: number; color: string }[];
  isLoading?: boolean;
}) => {
  const handleClick = () => {
    if (!onClick) return;
    onClick();
  };

  return (
    <motion.div
      initial={false}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.12 }}
      className={`stat-card relative overflow-hidden rounded-xl border border-l-4 ${onClick ? 'cursor-pointer' : ''
        } group`}
      style={{
        borderLeftColor: color.accent,
        background: color.gradient,
        willChange: 'transform',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 -3px 0 rgba(0, 0, 0, 0.1)',
        transform: 'translateZ(0)',
      }}
      onClick={handleClick}
    >
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />
      {/* 3D Depth Effect - Top highlight */}
      <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
      {/* 3D Depth Effect - Bottom shadow */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />

      {/* Icon with Doughnut Graph - Positioned in top-right corner */}
      <div className="absolute top-2.5 right-2.5 w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 z-20">
        {/* Animated Doughnut SVG Background */}
        <AnimatedDoughnut segments={segments} progress={progress} color={color} />

        {/* Inner Icon */}
        <div
          className="relative z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-white"
          style={{
            boxShadow: '0 2px 4px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.8)'
          }}
        >
          <Icon className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${color.text}`} />
        </div>
      </div>

      <div className="relative p-2.5 sm:p-3.5 pr-10 sm:pr-12 h-full flex flex-col justify-between min-h-[85px] sm:min-h-[96px] z-10">
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-tight ${color.text} mb-0.5 sm:mb-1 truncate`}>
            {title}
          </p>
          <div className="min-h-[1.75rem] sm:min-h-[2rem] flex items-center">
            {isLoading ? (
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 leading-none tracking-tight">
                  <CountUp end={value} />
                </h3>
                {subtitle && (
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1 font-medium truncate leading-tight">{subtitle}</p>
                )}
              </motion.div>
            )}
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
                className={`h-1 rounded-full transition-all duration-1000 ${trend.isPositive ? 'bg-green-500' : 'bg-red-500'
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

// Pupil Row with Click-to-Open Sub-menu
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
  const updateAttendanceMutation = useUpdateAttendanceRecord();
  const updatePupilMutation = useUpdatePupil();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const attendanceStatus = pupil.attendanceRecord?.status;
  const generalStatus = pupil.status;

  // Calculate date range for history — must match how View Attendance page defines periods
  const { data: activeYear } = useActiveAcademicYear();
  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    if (historyDuration === 'week') {
      // Current Mon-Sun academic week (same as View Attendance weekly view)
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      return { start: format(weekStart, 'yyyy-MM-dd'), end: todayStr };
    }

    if (historyDuration === 'month') {
      // Current calendar month from 1st (same as View Attendance monthly view)
      const monthStart = startOfMonth(today);
      return { start: format(monthStart, 'yyyy-MM-dd'), end: todayStr };
    }

    // 'term' — use the active term's start date if available, else fall back to 90 days
    const currentTerm = activeYear?.terms?.find(t => {
      if (!t.startDate || !t.endDate) return false;
      const s = new Date(t.startDate.includes('T') ? t.startDate : t.startDate + 'T00:00:00');
      const e = new Date(t.endDate.includes('T') ? t.endDate : t.endDate + 'T23:59:59');
      return today >= s && today <= e;
    });

    if (currentTerm?.startDate) {
      const termStart = currentTerm.startDate.includes('T')
        ? currentTerm.startDate.split('T')[0]
        : currentTerm.startDate;
      return { start: termStart, end: todayStr };
    }

    // Fallback: last 90 days if no active term found
    const fallback = new Date(today);
    fallback.setDate(fallback.getDate() - 90);
    return { start: format(fallback, 'yyyy-MM-dd'), end: todayStr };
  }, [historyDuration, activeYear]);

  // Fetch attendance history for this pupil
  const { data: historyRecords = [], isLoading: historyLoading } = useAttendanceByDateRange(dateRange.start, dateRange.end);

  // Calculate stats — deduplicate first (re-recorded attendance creates multiple docs per day)
  const stats = useMemo(() => {
    const forThisPupil = historyRecords.filter(r => r.pupilId === pupil.id);

    // Keep only the latest record per calendar date (handles re-recording)
    const dedupByDate = new Map<string, typeof forThisPupil[0]>();
    forThisPupil.forEach(r => {
      const dateKey = (r.date as string)?.split('T')[0] || '';
      if (!dateKey) return;
      const existing = dedupByDate.get(dateKey);
      const existingTime = existing?.recordedAt ? new Date(existing.recordedAt as string).getTime() : 0;
      const newTime = r.recordedAt ? new Date(r.recordedAt as string).getTime() : 0;
      if (!existing || newTime >= existingTime) {
        dedupByDate.set(dateKey, r);
      }
    });

    const pupilRecords = Array.from(dedupByDate.values());
    const present = pupilRecords.filter(r => r.status === 'Present').length;
    const absent = pupilRecords.filter(r => r.status === 'Absent').length;
    const late = pupilRecords.filter(r => r.status === 'Late' || r.status === 'Delayed').length;
    const total = pupilRecords.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, late, total, rate };
  }, [pupil.id, historyRecords]);

  const attendanceBadgeColor =
    attendanceStatus === 'Absent' ? 'bg-red-100 text-red-700' :
      attendanceStatus === 'Delayed' ? 'bg-amber-100 text-amber-700' :
        attendanceStatus === 'Late' ? 'bg-orange-100 text-orange-700' :
          attendanceStatus === 'Present' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-500';

  const generalBadgeColor =
    generalStatus === 'Active' ? 'bg-indigo-100 text-indigo-700' :
      generalStatus === 'Inactive' ? 'bg-slate-100 text-slate-600' :
        generalStatus === 'Graduated' ? 'bg-emerald-100 text-emerald-700' :
          generalStatus === 'Transferred' ? 'bg-orange-100 text-orange-700' :
            generalStatus === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-500';

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Pupil Name Row — click to toggle sub-menu */}
      <div
        className="p-2 sm:p-3 hover:bg-blue-50 cursor-pointer flex items-center gap-2 group transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setIsMenuOpen((prev) => !prev);
        }}
      >
        <UserCheck className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 truncate flex-1">
          {pupil.firstName} {pupil.lastName}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {generalStatus && (
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${generalBadgeColor}`}>
              {generalStatus}
            </span>
          )}
          {attendanceStatus && (
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${attendanceBadgeColor}`}>
              {attendanceStatus}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Compact Expandable Sub-menu */}
      {isMenuOpen && (
        <div className="border-t border-gray-100 bg-gray-50 px-2.5 py-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>

          {/* Row 1: Status selects side by side */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* General Status */}
            <div>
              <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wide">Enrolment</span>
              <select
                className={`w-full text-[10px] font-semibold rounded-md border border-gray-200 py-0.5 pl-1.5 pr-4 cursor-pointer focus:ring-1 focus:ring-blue-400 bg-white mt-0.5 ${generalBadgeColor}`}
                value={generalStatus || ''}
                onChange={async (e) => {
                  if (!pupil.id) return;
                  try { await updatePupilMutation.mutateAsync({ id: pupil.id, data: { status: e.target.value as any } }); } catch { }
                }}
                disabled={updatePupilMutation.isPending}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Graduated">Graduated</option>
                <option value="Transferred">Transferred</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            {/* Attendance Status */}
            {pupil.attendanceRecord ? (
              <div>
                <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wide">Attendance</span>
                <select
                  className={`w-full text-[10px] font-semibold rounded-md border border-gray-200 py-0.5 pl-1.5 pr-4 cursor-pointer focus:ring-1 focus:ring-blue-400 bg-white mt-0.5 ${attendanceBadgeColor}`}
                  value={attendanceStatus}
                  onChange={async (e) => {
                    if (!pupil.attendanceRecord?.id) return;
                    try { await updateAttendanceMutation.mutateAsync({ id: pupil.attendanceRecord.id, data: { status: e.target.value as any } }); } catch { }
                  }}
                  disabled={updateAttendanceMutation.isPending}
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Late">Late</option>
                </select>
              </div>
            ) : <div />}
          </div>

          {/* Row 2: View Attendance pills + Details button — all in one row */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wide mr-0.5">View:</span>
            {(['week', 'month', 'term'] as const).map((period) => (
              <button
                key={period}
                onClick={() => {
                  const today = new Date();
                  let from = new Date();
                  if (period === 'week') from.setDate(today.getDate() - 7);
                  else if (period === 'month') from.setMonth(today.getMonth() - 1);
                  else from.setMonth(today.getMonth() - 3);
                  router.push(`/pupil-detail?id=${pupil.id}&tab=attendance&from=${format(from, 'yyyy-MM-dd')}&to=${format(today, 'yyyy-MM-dd')}`);
                }}
                className="capitalize text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
              >
                {period}
              </button>
            ))}
            <button
              onClick={() => router.push(`/pupil-detail?id=${pupil.id}`)}
              className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition-colors flex items-center gap-1"
            >
              <UserCheck className="w-2.5 h-2.5" />
              Details
            </button>
          </div>

          {/* Guardian Info — compact grid */}
          {showInfo && (
            <div className="pt-1.5 border-t border-gray-200">
              <span className="text-[9px] font-bold uppercase text-blue-600 tracking-wide flex items-center gap-1 mb-1">
                <Info className="w-2.5 h-2.5" /> Guardians
              </span>
              {pupil.guardians && pupil.guardians.length > 0 ? (
                <div className="space-y-0.5">
                  {pupil.guardians.map((guardian: any, idx: number) => {
                    const guardianName = guardian.name || `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim() || 'Guardian';
                    const phones = [guardian.phone, guardian.secondaryPhone, ...(guardian.additionalPhones || [])].filter(Boolean);
                    return (
                      <div key={idx} className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] font-medium text-gray-600 mr-1 shrink-0">{guardianName}{guardian.relationship ? ` (${guardian.relationship})` : ''}:</span>
                        {phones.length > 0 ? phones.map((phone, pIdx) => (
                          <a
                            key={pIdx}
                            href={`tel:${phone}`}
                            className="px-1.5 py-0.5 bg-green-100 hover:bg-green-200 text-green-700 rounded font-mono text-[10px] transition-colors inline-flex items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            📞 {phone}
                          </a>
                        )) : <span className="text-[10px] text-gray-400">No contact</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-gray-400 italic">No guardian info</p>
              )}
            </div>
          )}

          {/* Attendance History — single compact row */}
          {showHistory && (
            <div className="pt-1.5 border-t border-gray-200 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase text-amber-600 tracking-wide flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {historyDuration}
              </span>
              {historyLoading ? (
                <div className="flex items-center gap-2 text-[10px] animate-pulse">
                  <span className="w-6 h-3 bg-green-200 rounded" />
                  <span className="w-6 h-3 bg-red-200 rounded" />
                  <span className="w-6 h-3 bg-amber-200 rounded" />
                  <span className="w-10 h-4 bg-gray-200 rounded" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="flex items-center gap-0.5 text-green-700 font-semibold"><CheckCircle className="w-2.5 h-2.5" />{stats.present}</span>
                  <span className="flex items-center gap-0.5 text-red-700 font-semibold"><XCircle className="w-2.5 h-2.5" />{stats.absent}</span>
                  <span className="flex items-center gap-0.5 text-amber-700 font-semibold"><Clock className="w-2.5 h-2.5" />{stats.late}</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${stats.rate >= 90 ? 'bg-green-100 text-green-700' : stats.rate >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {stats.rate}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Expandable Staff Card Component
const ExpandableStaffCard = ({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  isLoading = false,
  staff,
  progress,
  segments
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
  staff?: any[];
  progress?: number;
  segments?: { percentage: number; color: string }[];
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Filter staff based on search
  const filteredStaff = useMemo(() => {
    if (!staff || staff.length === 0) return [];
    if (!searchQuery.trim()) return staff;

    const query = searchQuery.toLowerCase();
    return staff.filter((member: any) =>
      member.firstName?.toLowerCase().includes(query) ||
      member.lastName?.toLowerCase().includes(query) ||
      member.contactNumber?.includes(query) ||
      member.alternativePhone?.includes(query) ||
      (Array.isArray(member.department) ? member.department : [member.department]).some((d: string) => d?.toLowerCase().includes(query)) ||
      (Array.isArray(member.role) ? member.role : [member.role]).some((r: string) => r?.toLowerCase().includes(query))
    );
  }, [staff, searchQuery]);

  // Group staff by role (primary grouping)
  const groupedStaff = useMemo(() => {
    if (filteredStaff.length === 0) return {};

    const groups: any = {};

    filteredStaff.forEach((member: any) => {
      // Handle multiple roles - but only add staff once per role
      const roles = Array.isArray(member.role) ? member.role : [member.role || 'Staff'];
      const departments = Array.isArray(member.department) ? member.department : [member.department || 'General'];

      roles.forEach((role: string) => {
        if (!groups[role]) {
          groups[role] = [];
        }

        // Add member with their departments info
        groups[role].push({
          ...member,
          departmentsList: departments.join(', ')
        });
      });
    });

    return groups;
  }, [filteredStaff]);

  // Toggle role expansion
  const toggleDepartment = (role: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(role)) {
      newExpanded.delete(role);
    } else {
      newExpanded.add(role);
    }
    setExpandedDepartments(newExpanded);
  };

  // Expand all when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedDepartments(new Set(Object.keys(groupedStaff)));
    }
  }, [searchQuery, groupedStaff]);

  return (
    <>
      <motion.div
        initial={false}
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ duration: 0.12 }}
        className="stat-card relative overflow-visible rounded-xl border border-l-4 cursor-pointer group"
        style={{
          borderLeftColor: color.accent,
          background: color.gradient,
          willChange: 'transform',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 -3px 0 rgba(0, 0, 0, 0.1)',
          transform: 'translateZ(0)',
        }}
      >
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl" />
        {/* 3D Depth Effect - Top highlight */}
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-xl" />
        {/* 3D Depth Effect - Bottom shadow */}
        <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-b-xl" />

        {/* Icon with Doughnut Graph - Positioned in top-right corner */}
        <div className="absolute top-2.5 right-2.5 w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 z-20">
          {/* Animated Doughnut SVG Background */}
          <AnimatedDoughnut segments={segments} progress={progress} color={color} />
          <div
            className="relative z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-white"
            style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.8)' }}
          >
            <Icon className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${color.text}`} />
          </div>
        </div>

        {/* Expand/Collapse Icon - Positioned at bottom right */}
        <div className="absolute bottom-1.5 right-1.5 sm:bottom-2.5 sm:right-2.5 z-10 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-300">
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
          )}
        </div>

        <div className="relative z-10">
          <div
            className="p-2.5 sm:p-3.5 pr-10 sm:pr-12 flex flex-col justify-between min-h-[85px] sm:min-h-[96px]"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-tight ${color.text} mb-0.5 sm:mb-1 truncate`}>
                {title}
              </p>
              <div className="min-h-[1.75rem] sm:min-h-[2rem] flex items-center">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-baseline space-x-1">
                      <span className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 leading-none tracking-tight">
                        <CountUp end={value} />
                      </span>
                    </div>
                    {subtitle && (
                      <p className="text-[10px] sm:text-xs text-gray-500 mt-1 font-medium truncate leading-tight">{subtitle}</p>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating Staff Directory Panel */}
      <AnimatePresence mode="wait">
        {isExpanded && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setIsExpanded(false)}
              style={{ willChange: 'opacity' }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{
                duration: 0.15,
                type: "spring",
                stiffness: 500,
                damping: 30
              }}
              className="fixed z-50 
                left-4 right-4 top-16
                sm:left-1/2 sm:-translate-x-1/2 sm:top-16 sm:w-[75vw] sm:max-w-xl
                lg:w-[60vw] lg:max-w-lg
                xl:w-[50vw] xl:max-w-md"
            >
              <Card className="rounded-xl flex flex-col max-h-[calc(100vh-8rem)] relative" style={{
                borderColor: color.accent,
                borderWidth: '2px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                transform: 'translateZ(0)',
              }}>
                {/* 3D Depth Effect */}
                <div className="absolute top-0 left-0 right-0 h-1/4 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-xl z-10" />
                <CardHeader className="pb-3 border-b flex-shrink-0 relative z-20" style={{ background: color.gradient }}>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color.text}`} />
                      <span>Staff Directory</span>
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(false);
                        setSearchQuery('');
                        setExpandedDepartments(new Set());
                      }}
                      className="h-7 w-7 p-0 hover:bg-white/50"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search staff by name, phone, department..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {searchQuery && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchQuery('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto flex-1 min-h-0">
                  {Object.keys(groupedStaff).length === 0 ? (
                    <div className="p-8 text-center">
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">
                        {searchQuery ? 'No staff found matching your search' : 'No staff data available'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {Object.entries(groupedStaff).map(([role, members]: [string, any]) => {
                        const isExpanded = expandedDepartments.has(role);

                        return (
                          <div key={role}>
                            {/* Role Header - Clickable */}
                            <div
                              className="p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDepartment(role);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                  <Users className="w-4 h-4 text-purple-600" />
                                  {role}
                                  <span className="text-xs font-normal text-gray-500">({members.length} staff)</span>
                                </h3>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                            </div>

                            {/* Role Content - Collapsible */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{
                                    duration: 0.2,
                                    ease: [0.4, 0.0, 0.2, 1]
                                  }}
                                  className="overflow-hidden"
                                  style={{ willChange: 'height, opacity' }}
                                >
                                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-1.5">
                                    {members.map((member: any) => (
                                      <div key={member.id} className="bg-gray-50 rounded-lg p-3">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <UserCheck className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                            <div className="min-w-0">
                                              <p className="text-sm font-semibold text-gray-900 truncate">
                                                {member.firstName} {member.lastName}
                                              </p>
                                              {member.departmentsList && (
                                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                  <Building2 className="w-3 h-3" />
                                                  {member.departmentsList}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 ml-6">
                                          {member.contactNumber && (
                                            <a
                                              href={`tel:${member.contactNumber}`}
                                              className="px-2.5 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-md font-mono text-xs transition-colors inline-flex items-center gap-1.5"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <Phone className="w-3.5 h-3.5" />
                                              <span>{member.contactNumber}</span>
                                            </a>
                                          )}
                                          {member.alternativePhone && (
                                            <a
                                              href={`tel:${member.alternativePhone}`}
                                              className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md font-mono text-xs transition-colors inline-flex items-center gap-1.5"
                                              onClick={(e) => e.stopPropagation()}
                                              title="Alternative phone"
                                            >
                                              <Phone className="w-3.5 h-3.5" />
                                              <span>{member.alternativePhone}</span>
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
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
  filterType,
  progress,
  segments,
  animateConfigs,
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
  filterType: 'present' | 'absent' | 'delayed';
  progress?: number;
  segments?: { percentage: number; color: string }[];
  animateConfigs?: {
    title: string;
    value: number;
    icon: any;
    color: { bg: string; text: string; accent: string; gradient: string; }
    subtitle?: string;
    filterType: 'present' | 'absent' | 'delayed';
    progress?: number;
    segments?: { percentage: number; color: string }[];
  }[];
}) => {
  const [activeConfigIndex, setActiveConfigIndex] = useState(0);
  const activeConfig = animateConfigs ? animateConfigs[activeConfigIndex] : {
    title, value, icon: Icon, color, subtitle, filterType, progress, segments
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDuration, setHistoryDuration] = useState<'week' | 'month' | 'term'>('week');
  const [currentPopupFilter, setCurrentPopupFilter] = useState<'present' | 'absent' | 'delayed' | null>(null);
  const router = useRouter();

  // Animation effect - auto-cycle between configs
  useEffect(() => {
    if (!animateConfigs || animateConfigs.length <= 1 || isExpanded) return;
    const interval = setInterval(() => {
      setActiveConfigIndex((prev) => (prev + 1) % animateConfigs.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [animateConfigs, isExpanded]);

  // Derived active properties
  const currentTitle = activeConfig.title;
  const currentValue = activeConfig.value;
  const currentIcon = activeConfig.icon;
  const currentColor = activeConfig.color;
  const currentSubtitle = activeConfig.subtitle;
  const currentProgress = activeConfig.progress;
  const currentSegments = activeConfig.segments;

  const actualFilterType = currentPopupFilter || activeConfig.filterType;

  // Calculate class breakdown with pupils
  const classBreakdown = useMemo(() => {
    if (!attendanceData?.byClass || !pupils || !attendanceData?.records) return [];

    const pupilsByClass = pupils.reduce((acc: any, pupil: any) => {
      if (!pupil.classId) return acc;
      if (!acc[pupil.classId]) {
        acc[pupil.classId] = {
          classId: pupil.classId,
          className: pupil.classCode || pupil.className || 'Unknown',
          total: 0,
          pupils: []
        };
      }
      acc[pupil.classId].total++;
      acc[pupil.classId].pupils.push(pupil);
      return acc;
    }, {});

    const recordsByPupil = attendanceData.records.reduce((acc: any, record: any) => {
      acc[record.pupilId] = record;
      return acc;
    }, {});

    const breakdown = attendanceData.byClass.map((classData: any) => {
      const pupilData = pupilsByClass[classData.classId] || { total: 0, pupils: [], className: 'Unknown' };

      const filteredPupils = pupilData.pupils.filter((pupil: any) => {
        const record = recordsByPupil[pupil.id];
        const status = record?.status;
        if (actualFilterType === 'present') {
          return status === 'Present' || status === 'Late';
        } else if (actualFilterType === 'delayed') {
          return status === 'Delayed';
        } else {
          return status === 'Absent';
        }
      });

      return {
        classId: classData.classId,
        className: pupilData.className,
        present: classData.present,
        absent: classData.absent,
        late: classData.late,
        delayed: classData.delayed || 0,
        total: pupilData.total,
        recorded: classData.total,
        pupils: filteredPupils.map((p: any) => ({ ...p, attendanceRecord: recordsByPupil[p.id] }))
      };
    });

    return breakdown.sort((a: any, b: any) => {
      const aNum = parseInt(a.className.match(/\d+/)?.[0] || '0');
      const bNum = parseInt(b.className.match(/\d+/)?.[0] || '0');
      return aNum - bNum;
    });
  }, [attendanceData, pupils, actualFilterType]);

  return (
    <>
      <motion.div
        initial={false}
        whileHover={{ scale: 1.03, y: -4 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
          duration: 0.15
        }}
        className="stat-card relative overflow-visible rounded-xl border border-l-4 cursor-pointer transition-all duration-300 group"
        style={{
          borderLeftColor: currentColor.accent,
          background: currentColor.gradient,
          willChange: 'transform',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 -3px 0 rgba(0, 0, 0, 0.1)',
          transform: 'translateZ(0)',
        }}
      >
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl" />
        {/* 3D Depth Effect - Top highlight */}
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-xl" />
        {/* 3D Depth Effect - Bottom shadow */}
        <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-b-xl" />

        {/* Icon with Doughnut Graph - Positioned in top-right corner */}
        <div className="absolute top-2.5 right-2.5 w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 z-20">
          <AnimatedDoughnut segments={currentSegments} progress={currentProgress} color={currentColor} />
          <div
            className="relative z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-white"
            style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.8)' }}
          >
            <currentIcon className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${currentColor.text}`} />
          </div>
        </div>

        {/* Expand/Collapse Icon - Positioned at bottom right */}
        <div className="absolute bottom-1.5 right-1.5 sm:bottom-2.5 sm:right-2.5 z-10 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-300">
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
          )}
        </div>

        <div className="relative z-10">
          {/* Card Content - Always Visible */}
          <div
            className="p-2.5 sm:p-3.5 pr-10 sm:pr-12 flex flex-col justify-between min-h-[85px] sm:min-h-[96px]"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.p
                  key={`title-${currentTitle}`}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.2 }}
                  className={`text-[10px] sm:text-xs font-bold uppercase tracking-tight ${currentColor.text} mb-0.5 sm:mb-1 truncate`}
                >
                  {currentTitle}
                </motion.p>
              </AnimatePresence>
              <div className="min-h-[1.75rem] sm:min-h-[2rem] flex items-center">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 1.2 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: 0.8,
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0.1
                    }}
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`value-${currentValue}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-baseline space-x-1"
                      >
                        <span className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 leading-none tracking-tight">
                          <CountUp end={currentValue} />
                        </span>
                      </motion.div>
                    </AnimatePresence>
                    {currentSubtitle && (
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={`sub-${currentSubtitle}`}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.2, delay: 0.1 }}
                          className="text-[10px] sm:text-xs text-gray-500 mt-1 font-medium truncate leading-tight"
                        >
                          {currentSubtitle}
                        </motion.p>
                      </AnimatePresence>
                    )}
                  </motion.div>
                )}
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
                setCurrentPopupFilter(null);
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
              <Card className="rounded-xl flex flex-col max-h-[calc(100vh-8rem)] relative" style={{
                borderColor: currentColor.accent,
                borderWidth: '2px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                transform: 'translateZ(0)',
              }}>
                {/* 3D Depth Effect */}
                <div className="absolute top-0 left-0 right-0 h-1/4 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-xl z-10" />
                <CardHeader className="pb-2 border-b flex-shrink-0 relative z-20" style={{ background: currentColor.gradient }}>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                      <currentIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${currentColor.text}`} />
                      <span className="hidden sm:inline">{currentTitle} - By Class</span>
                      <span className="sm:hidden">{currentTitle}</span>
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
                        setCurrentPopupFilter(null);
                      }}
                      className="h-7 w-7 p-0 hover:bg-white/50"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Filter toggle buttons (shown when animateConfigs present) */}
                  {animateConfigs && animateConfigs.length > 1 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {animateConfigs.map((config, idx) => (
                        <Button
                          key={idx}
                          size="sm"
                          variant={actualFilterType === config.filterType ? 'default' : 'outline'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentPopupFilter(config.filterType);
                            setActiveConfigIndex(idx);
                          }}
                          className={`h-7 text-xs ${actualFilterType === config.filterType ? config.color.bg + ' ' + config.color.text : ''}`}
                        >
                          <config.icon className="w-3 h-3 mr-1" />
                          {config.title}
                        </Button>
                      ))}
                    </div>
                  )}

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
                        const displayValue = actualFilterType === 'present' ? classData.present : (actualFilterType === 'delayed' ? classData.delayed : classData.absent);
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
                                    className={`h-full rounded-full ${currentColor.bg.startsWith('rgba') && currentColor.bg.indexOf('34, 197, 94') !== -1 ? 'bg-green-500' :
                                      currentColor.bg.indexOf('239, 68, 68') !== -1 ? 'bg-red-500' :
                                        currentColor.bg.indexOf('245, 158, 11') !== -1 ? 'bg-amber-500' : 'bg-red-500'
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
                                    <p className="text-xs sm:text-sm text-gray-500 italic py-3">No pupils {actualFilterType}</p>
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

// Animated Bar Label Component for counting numbers
const AnimatedBarLabel = ({ x, y, width, value }: any) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    let timer: NodeJS.Timeout;

    // Start immediately with 0
    setDisplayValue(0);

    // Add 200ms delay to match bar animation start exactly
    timer = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / 1200, 1); // Match bar duration (1200ms)
        const easedProgress = 1 - Math.pow(1 - progress, 4);
        setDisplayValue(Math.floor(value * easedProgress));

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        }
      };

      animationFrame = requestAnimationFrame(animate);
    }, 200); // 200ms matches animationBegin={200} on Bar

    return () => {
      clearTimeout(timer);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [value]);

  if (!value || value === 0) return null;

  return (
    <text
      x={(x as number) + (width as number) / 2}
      y={(y as number) - 8}
      fill="#1f2937"
      textAnchor="middle"
      fontSize={13}
      fontWeight={700}
      style={{
        filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
      }}
    >
      {displayValue}
    </text>
  );
};

// Class Enrollment Chart Component - Modernized
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full rounded-xl transition-all duration-300 relative group overflow-visible" style={{
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 -3px 0 rgba(0, 0, 0, 0.1)',
        transform: 'translateZ(0)',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(249, 250, 251, 1) 100%)',
      }}>
        {/* 3D Depth Effect - Top highlight */}
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-xl z-10" />
        {/* 3D Depth Effect - Bottom shadow */}
        <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-b-xl" />

        {/* Decorative gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-t-xl opacity-60" />

        <CardHeader className="pb-2 pt-3 relative z-20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                Class Enrollment
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/classes')}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            >
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="relative z-20 px-2 pb-2 pt-0">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 25, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {/* 3D Cylindrical gradients with highlights and shadows */}
                  <linearGradient id="maleGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6D28D9" stopOpacity={0.7} />
                    <stop offset="30%" stopColor="#8B5CF6" stopOpacity={1} />
                    <stop offset="50%" stopColor="#A78BFA" stopOpacity={1} />
                    <stop offset="70%" stopColor="#8B5CF6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#6D28D9" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="femaleGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#DB2777" stopOpacity={0.7} />
                    <stop offset="30%" stopColor="#EC4899" stopOpacity={1} />
                    <stop offset="50%" stopColor="#F9A8D4" stopOpacity={1} />
                    <stop offset="70%" stopColor="#EC4899" stopOpacity={1} />
                    <stop offset="100%" stopColor="#DB2777" stopOpacity={0.8} />
                  </linearGradient>
                  {/* Enhanced 3D shadow filter */}
                  <filter id="glow3D" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feOffset dx="0" dy="4" result="offsetBlur" />
                    <feComponentTransfer>
                      <feFuncA type="linear" slope="0.5" />
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode in="offsetBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  {/* Inner glow for depth */}
                  <filter id="innerGlow">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feComposite in="blur" in2="SourceAlpha" operator="in" result="innerGlow" />
                    <feComposite in="SourceGraphic" in2="innerGlow" operator="over" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: '#d1d5db', strokeWidth: 1.5 }}
                  tickLine={false}
                  height={25}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                  axisLine={{ stroke: '#d1d5db', strokeWidth: 1.5 }}
                  tickLine={false}
                  width={35}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(199, 210, 254, 0.15)', radius: 8 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const male = payload[0].value as number;
                      const female = payload[1].value as number;
                      const total = male + female;

                      return (
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="bg-white/95 backdrop-blur-md rounded-xl p-4 border border-gray-200 relative"
                          style={{
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                            transform: 'translateZ(0)',
                          }}
                        >
                          {/* Glassmorphic top gradient */}
                          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/60 to-transparent pointer-events-none rounded-t-xl" />

                          <p className="font-bold text-gray-800 mb-3 relative z-10 text-base">
                            Class {label}
                          </p>
                          <div className="space-y-2 relative z-10">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm font-medium text-violet-600 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-violet-400 to-purple-600" />
                                Boys
                              </span>
                              <span className="font-bold text-violet-700 text-base">{male}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm font-medium text-pink-600 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-pink-400 to-pink-600" />
                                Girls
                              </span>
                              <span className="font-bold text-pink-700 text-base">{female}</span>
                            </div>
                            <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent my-2"></div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm font-semibold text-gray-700">Total</span>
                              <span className="font-bold text-gray-900 text-lg">{total}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="Male"
                  fill="url(#maleGradient)"
                  radius={[20, 20, 20, 20]}
                  name="Boys"
                  stackId="a"
                  onClick={handleBarClick}
                  cursor="pointer"
                  animationDuration={1200}
                  animationBegin={200}
                  style={{ filter: 'url(#glow3D)' }}
                />
                <Bar
                  dataKey="Female"
                  fill="url(#femaleGradient)"
                  radius={[20, 20, 20, 20]}
                  name="Girls"
                  stackId="a"
                  onClick={handleBarClick}
                  cursor="pointer"
                  animationDuration={1200}
                  animationBegin={200}
                  label={AnimatedBarLabel}
                  style={{ filter: 'url(#glow3D)' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Today's Attendance Chart - Modernized
const TodaysAttendanceChart = ({ classes, pupils, attendanceData }: { classes: any[]; pupils: any[]; attendanceData?: any }) => {
  const router = useRouter();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentDate = new Date();

  // Use the live attendance records passed from the parent instead of fetching again
  const attendanceRecords = attendanceData?.records || [];
  const attendanceLoading = !attendanceData;

  // Get excluded days and academic year data
  const { data: excludedDays = [] } = useExcludedDays();
  const { data: allAcademicYears = [] } = useAcademicYears();
  // Use the globally correct year (two-pass cross-year scan, no isActive bias)
  const activeAcademicYear = useMemo(
    () => getEffectiveTermForDataDisplay(allAcademicYears).academicYear ?? null,
    [allAcademicYears]
  );

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

    // CRITICAL FIX: Deduplicate attendance records by pupilId
    // If a pupil has multiple records for the same day (from re-recording),
    // keep only the latest one
    const dedupMap = new Map<string, any>();
    attendanceRecords.forEach((record: any) => {
      const key = `${record.pupilId}_${record.classId}`;
      const existing = dedupMap.get(key);
      if (!existing) {
        dedupMap.set(key, record);
      } else {
        // Keep the record with the latest recordedAt
        const existingTime = typeof existing.recordedAt === 'string'
          ? new Date(existing.recordedAt).getTime()
          : (existing.recordedAt?.seconds || 0) * 1000;
        const newTime = typeof record.recordedAt === 'string'
          ? new Date(record.recordedAt).getTime()
          : (record.recordedAt?.seconds || 0) * 1000;
        if (newTime > existingTime) {
          dedupMap.set(key, record);
        }
      }
    });
    const uniqueRecords = Array.from(dedupMap.values());

    return classes.map(classItem => {
      const classPupils = pupils.filter(p => p.classId === classItem.id && p.status === 'Active');
      const totalPupils = classPupils.length;

      if (totalPupils === 0) return null;

      // Get deduplicated attendance records for this class today
      const classAttendance = uniqueRecords.filter((record: any) => record.classId === classItem.id);

      const present = classAttendance.filter((r: any) => r.status === 'Present').length;
      const absent = classAttendance.filter((r: any) => r.status === 'Absent').length;
      const late = classAttendance.filter((r: any) => r.status === 'Late').length;
      const excused = classAttendance.filter((r: any) => r.status === 'Excused').length;
      const delayed = classAttendance.filter((r: any) => r.status === 'Delayed').length;
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
        delayed,
        notRecorded,
        totalPupils,
        attendanceRate,
        displayValue: notRecorded === totalPupils ? '-' : present,
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

  const handleBarClick = (data: any, _index: number, event?: any) => {
    // Prevent card-level click from also firing
    if (event?.stopPropagation) event.stopPropagation();
    if (!data?.id) return;
    // If no attendance has been recorded for this class at all → go to record page with class pre-selected
    const isFullyUnrecorded = data.notRecorded === data.totalPupils && data.totalPupils > 0;
    if (isFullyUnrecorded) {
      router.push(`/attendance/record?classId=${data.id}`);
    } else {
      // Attendance exists (even partially) → view what's been recorded
      router.push(`/attendance/view?classId=${data.id}&date=${today}`);
    }
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className="h-full rounded-xl transition-all duration-300 relative group overflow-visible" style={{
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 -3px 0 rgba(0, 0, 0, 0.1)',
        transform: 'translateZ(0)',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(239, 246, 255, 0.5) 100%)',
      }}>
        {/* 3D Depth Effect - Top highlight */}
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-xl z-10" />
        {/* 3D Depth Effect - Bottom shadow */}
        <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-b-xl" />

        {/* Decorative gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-green-500 rounded-t-xl opacity-60" />

        <CardHeader className="pb-2 pt-3 relative z-20">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="flex-1 min-w-0 pr-2">
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2 leading-tight">
                <UserCheck className="w-6 h-6 text-blue-600 flex-shrink-0" />
                <span className="truncate">
                  {isRecessMode ? 'Recess Period' : 'Today\'s Attendance'}
                </span>
              </CardTitle>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 self-start">
              {isRecessMode && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 border-amber-200">
                  🎓 Recess
                </Badge>
              )}
              <Badge variant="outline" className="text-xs px-2 py-0.5 bg-blue-50 border-blue-200 text-blue-700">
                {overallStats.recorded}/{overallStats.total}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/attendance/view');
                }}
                className="text-blue-600 hover:text-blue-700 p-1 h-auto hover:bg-blue-50"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-2 pt-0 relative z-20">
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
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 25, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    angle={0}
                    textAnchor="middle"
                    height={25}
                    dy={10}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.05))]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const isUnrecorded = data.notRecorded === data.totalPupils;
                        return (
                          <div
                            className="bg-white rounded-lg border border-blue-100 p-2.5 text-xs shadow-xl"
                            style={{ minWidth: 140, zIndex: 9999 }}
                          >
                            <p className="font-bold text-gray-800 mb-1.5 leading-tight">{data.name}</p>
                            <div className="space-y-0.5">
                              {data.present > 0 && (
                                <div className="flex justify-between gap-3">
                                  <span className="text-gray-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Present</span>
                                  <span className="font-semibold text-green-700">{data.present}</span>
                                </div>
                              )}
                              {data.late > 0 && (
                                <div className="flex justify-between gap-3">
                                  <span className="text-gray-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />Late</span>
                                  <span className="font-semibold text-yellow-700">{data.late}</span>
                                </div>
                              )}
                              {data.absent > 0 && (
                                <div className="flex justify-between gap-3">
                                  <span className="text-gray-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />Absent</span>
                                  <span className="font-semibold text-red-700">{data.absent}</span>
                                </div>
                              )}
                              {data.excused > 0 && (
                                <div className="flex justify-between gap-3">
                                  <span className="text-gray-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />Excused</span>
                                  <span className="font-semibold text-blue-700">{data.excused}</span>
                                </div>
                              )}
                              {data.delayed > 0 && (
                                <div className="flex justify-between gap-3">
                                  <span className="text-gray-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />Delayed</span>
                                  <span className="font-semibold text-purple-700">{data.delayed}</span>
                                </div>
                              )}
                              {data.notRecorded > 0 && (
                                <div className="flex justify-between gap-3">
                                  <span className="text-gray-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />Not recorded</span>
                                  <span className="font-semibold text-gray-600">{data.notRecorded}</span>
                                </div>
                              )}
                            </div>
                            <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center justify-between gap-2">
                              {!isUnrecorded && (
                                <span className="font-bold text-blue-600">{data.attendanceRate}%</span>
                              )}
                              <span className="text-gray-400 text-[10px] ml-auto">
                                {isUnrecorded ? '📋 Tap to record' : '👆 Tap to view'}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                    wrapperStyle={{ zIndex: 9999 }}
                  />
                  <Bar
                    dataKey="present"
                    className="cursor-pointer drop-shadow-sm transition-opacity hover:opacity-90"
                    shape={<PillBar />}
                    background={{ fill: '#e2e8f0', radius: 40 }}
                    onClick={handleBarClick}
                  >
                    {chartData.map((entry, index) => {
                      const rate = entry.attendanceRate;
                      const isFullyUnrecorded = entry.notRecorded === entry.totalPupils;
                      let fill: string;

                      if (isFullyUnrecorded) {
                        fill = '#94A3B8'; // Slate-400 — clearly "not yet done"
                      } else if (rate >= 90) {
                        fill = '#10B981'; // Green
                      } else if (rate >= 75) {
                        fill = '#F59E0B'; // Amber
                      } else {
                        fill = '#EF4444'; // Red
                      }

                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={fill}
                          opacity={isFullyUnrecorded ? 0.65 : 1}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Beautiful Modern Photo Slideshow Component
const PhotoSlideshow = ({ photos }: { photos: any[] }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [direction, setDirection] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Filter active photos
  const activePhotos = useMemo(() => {
    return photos?.filter(photo => photo.isActive) || [];
  }, [photos]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || activePhotos.length === 0) return;

    const interval = setInterval(() => {
      setDirection(1);
      setQuoteIndex(prev => prev + 1);
      setCurrentSlide((prev) => (prev + 1) % activePhotos.length);
    }, 5000); // 5 seconds for cinematic feel

    return () => clearInterval(interval);
  }, [isPlaying, activePhotos.length]);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setQuoteIndex(prev => prev + 1);
    setCurrentSlide((prev) => (prev + newDirection + activePhotos.length) % activePhotos.length);
  };

  if (!activePhotos.length) {
    return (
      <Card className="h-full border-0 rounded-xl bg-gradient-to-br from-slate-50 via-white to-blue-50 relative overflow-visible group" style={{
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 -3px 0 rgba(0, 0, 0, 0.1)',
        transform: 'translateZ(0)',
      }}>
        {/* 3D Depth Effect */}
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/60 to-transparent pointer-events-none rounded-t-xl z-10" />
        {/* 3D Depth Effect - Bottom shadow */}
        <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-b-xl" />

        {/* Decorative accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-t-xl opacity-50" />

        <CardContent className="flex flex-col items-center justify-center h-64 relative z-20 overflow-hidden rounded-xl">
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(#3b82f6 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }} />

          <motion.div
            className="w-20 h-20 mb-4 bg-white rounded-2xl flex items-center justify-center shadow-xl border border-gray-100 relative group"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
            <ImageIcon className="w-10 h-10 text-gray-300 relative z-10" />
          </motion.div>
          <h3 className="text-gray-900 font-semibold mb-1 relative z-10">No Moments Yet</h3>
          <p className="text-sm text-gray-500 relative z-10">Capture and upload school memories</p>
        </CardContent>
      </Card>
    );
  }

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 1 // Keep fully opaque for seamless push
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 1 // Keep fully opaque for seamless push
    })
  };

  return (
    <Card className="h-full border-0 rounded-xl bg-gray-900 group relative overflow-visible" style={{
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 -3px 0 rgba(0, 0, 0, 0.1)',
      transform: 'translateZ(0)',
    }}>
      {/* 3D Depth Highlight */}
      <div className="absolute top-0 left-0 right-0 h-1/4 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl z-20" />
      {/* 3D Depth Effect - Bottom shadow */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-b-xl" />

      <CardContent className="p-0 relative z-10 h-full overflow-hidden rounded-xl">
        <div className="relative w-full h-[280px] overflow-hidden bg-gray-900 rounded-xl">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={currentSlide}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "tween", duration: 0.8, ease: "easeInOut" }, // Slower, smoother push
                opacity: { duration: 0 } // No opacity transition
              }}
              className="absolute inset-0 w-full h-full"
            >
              <div className="relative w-full h-full overflow-hidden">
                {/* Image with Ken Burns effect - Optimized for smoothness */}
                <motion.img
                  src={activePhotos[currentSlide].url}
                  alt={activePhotos[currentSlide].title || 'School moment'}
                  className="w-full h-full object-cover"
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.08 }} // Reduced scale slightly for smoother effect
                  transition={{ duration: 8, ease: "linear" }} // Longer duration = slower, smoother movement
                  style={{ willChange: 'transform' }} // Hint browser for optimization
                />

                {/* Modern Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                {/* Content Overlay - More compact */}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white text-center">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    {(() => {
                      const quote = quotes[quoteIndex % quotes.length];
                      const parts = quote.split(' - ');
                      const text = parts[0];
                      const author = parts.slice(1).join(' - '); // Handle cases with multiple dashes if any, though unlikely

                      return (
                        <>
                          <h3 className="text-sm md:text-base font-medium mb-1 tracking-wide drop-shadow-md italic leading-snug px-4">
                            "{text}"
                          </h3>
                          {author && (
                            <p className="text-[10px] md:text-xs text-blue-100 font-medium uppercase tracking-wider opacity-80">
                              — {author}
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Glassmorphic Controls - Visible on Hover */}
          <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 pointer-events-none">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => paginate(-1)}
              className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 border border-white/10 pointer-events-auto transition-transform hover:scale-110"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => paginate(1)}
              className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 border border-white/10 pointer-events-auto transition-transform hover:scale-110"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>

          {/* Progress Indicators */}
          <div className="absolute bottom-6 right-6 flex items-center gap-1.5 z-30">
            {activePhotos.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setDirection(index > currentSlide ? 1 : -1);
                  setCurrentSlide(index);
                }}
                className={`transition-all duration-300 rounded-full shadow-sm ${index === currentSlide
                  ? 'w-6 h-1.5 bg-white'
                  : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'
                  }`}
              />
            ))}
          </div>

          {/* Action Buttons Top Right */}
          <div className="absolute top-4 right-4 flex gap-2 z-30">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 border border-white/10 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>
          </div>
        </div>
      </CardContent>
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
      className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white pb-10 md:pb-16 overflow-hidden cursor-pointer transition-all duration-500"
      style={{
        maskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleHeaderClick}
    >
      {/* Click Ripple Effect - Smooth */}
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
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: isMobile ? 12 : 15, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1,
              ease: [0.4, 0.0, 0.2, 1]
            }}
          />
        )}
      </AnimatePresence>

      {/* Animated Background Gradient - Simplified */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 opacity-90" />

      {/* Enhanced Particles Background - Ultra-smooth performance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: particleCount }, (_, i) => {
          const size = Math.random() * 2 + 1;
          const leftPos = Math.random() * 100;
          const topPos = Math.random() * 100;
          const duration = Math.random() * 8 + 12;
          const delay = Math.random() * 3;

          return (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white transform-gpu will-change-transform"
              style={{
                left: `${leftPos}%`,
                top: `${topPos}%`,
                width: `${size}px`,
                height: `${size}px`,
              }}
              animate={{
                y: [0, -120],
                opacity: [0.4, 0],
              }}
              transition={{
                duration: duration,
                delay: delay,
                repeat: Infinity,
                ease: [0.4, 0.0, 0.6, 1],
                repeatDelay: 0,
              }}
            />
          );
        })}
      </div>

      {/* Enhanced Floating Icons - Ultra-smooth performance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {icons.map(({ Icon, color, delay }, index) => (
          <motion.div
            key={index}
            className={`absolute ${color} transform-gpu will-change-transform`}
            style={{
              left: isMobile ? `${20 + index * 25}%` : `${10 + index * 20}%`,
              top: `${20 + (index % 2) * (isMobile ? 20 : 40)}%`,
              opacity: 0.2,
            }}
            animate={{
              y: [-6, 6],
              rotate: [0, 360],
            }}
            transition={{
              y: {
                duration: 4 + index,
                repeat: Infinity,
                ease: [0.4, 0.0, 0.6, 1],
                repeatType: "reverse"
              },
              rotate: {
                duration: 20 + index * 5,
                repeat: Infinity,
                ease: "linear",
                repeatDelay: 0,
              }
            }}
          >
            <Icon size={isMobile ? 18 : 24} />
          </motion.div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-2 sm:px-3 lg:px-6 py-2 sm:py-3 md:py-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 1,
            ease: [0.4, 0.0, 0.2, 1]
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
              transition={{
                duration: 0.8,
                ease: [0.4, 0.0, 0.2, 1] // Custom cubic-bezier for smooth fade
              }}
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
              transition={{
                duration: 0.8,
                delay: 0.2,
                ease: [0.4, 0.0, 0.2, 1]
              }}
            >
              <span>
                {schoolSettings?.generalInfo?.motto || 'GUIDING GROWTH, INSPIRING GREATNESS'}
              </span>
            </motion.p>

            {/* Greeting overlay - positioned absolutely over both lines */}
            <AnimatePresence mode="wait">
              {showGreeting && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{
                    duration: 0.8,
                    ease: [0.4, 0.0, 0.2, 1]
                  }}
                  style={{ top: 0, bottom: 0 }}
                >
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">
                    {greetingMessage}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Badges removed based on user request */}

          {/* Enhanced Decorative Line - Smooth & Subtle */}
          <motion.div
            className="mt-2 sm:mt-3 md:mt-4 mx-auto"
            initial={{ width: 0, opacity: 0 }}
            animate={{
              width: isMobile ? "60px" : "80px",
              opacity: 1
            }}
            transition={{
              duration: 1,
              delay: 0.8,
              ease: [0.4, 0.0, 0.2, 1]
            }}
          >
            <div
              className="bg-gradient-to-r from-transparent via-white to-transparent rounded-full"
              style={{ height: '2px', opacity: 0.6 }}
            />
          </motion.div>
        </motion.div>
      </div>

    </div>
  );
};

export default function DashboardPage() {
  const router = useRouter();

  const { user } = useAuth();

  const canViewTotalPupils = GranularPermissionService.canPerformAction(user, 'reports', 'dashboard', 'view_stat_total_pupils');
  const canViewGenderBreakdown = GranularPermissionService.canPerformAction(user, 'reports', 'dashboard', 'view_stat_gender_breakdown');
  const canViewTotalStaff = GranularPermissionService.canPerformAction(user, 'reports', 'dashboard', 'view_stat_total_staff');
  const canViewAttendanceToday = GranularPermissionService.canPerformAction(user, 'reports', 'dashboard', 'view_stat_attendance_today');
  const canViewClassEnrollment = GranularPermissionService.canPerformAction(user, 'reports', 'dashboard', 'view_chart_class_enrollment');
  const canViewAttendanceChart = GranularPermissionService.canPerformAction(user, 'reports', 'dashboard', 'view_chart_attendance');
  const canViewCalendarSchedule = GranularPermissionService.canPerformAction(user, 'reports', 'dashboard', 'view_calendar_schedule');

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
    basicStatsLoading, // For first 4 cards
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 relative" style={{
      background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 50%, #eff6ff 100%)',
    }}>
      {/* Subtle background depth pattern */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0,0,0,0.15) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }} />
      <Head>
        <title>Dashboard - Trinity School Online</title>
        <meta name="description" content="Trinity School Online Dashboard - Comprehensive overview of school activities and statistics." />
      </Head>

      {/* Enhanced Header */}
      <EnhancedHeader schoolSettings={schoolSettings} />

      <div className="container mx-auto px-3 sm:px-6 lg:px-8 pb-6 -mt-14 md:-mt-20 relative z-20">
        {/* Loading Indicator - Simple cached loading */}
        {isLoading && (
          <Card className="mb-6 border-blue-200 bg-blue-50 rounded-xl" style={{
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            transform: 'translateZ(0)',
          }}>
            {/* 3D Depth Effect */}
            <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent pointer-events-none rounded-t-xl" />
            <CardContent className="py-4 relative z-10">
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
          <Card className="mb-6 border-red-200 bg-red-50 rounded-xl" style={{
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            transform: 'translateZ(0)',
          }}>
            {/* 3D Depth Effect */}
            <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent pointer-events-none rounded-t-xl" />
            <CardContent className="py-4 relative z-10">
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

        {/* Holiday/Recess Status Banner */}
        <RecessStatusBanner className="mb-4" />

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {canViewTotalPupils && (
            <StatCard
              title="Total Pupils"
              value={stats.totalPupils}
              icon={GraduationCap}
              color={cardColors.pupils}
              onClick={() => handleCardClick('/pupils?classId=all&status=Active')}
              subtitle="Active students"
              segments={stats.totalPupils ? [
                { percentage: (stats.malePupils / stats.totalPupils) * 100, color: 'text-blue-500' },
                { percentage: (stats.femalePupils / stats.totalPupils) * 100, color: 'text-pink-500' }
              ] : [{ percentage: 100, color: cardColors.pupils.text }]}
              isLoading={basicStatsLoading}
            />
          )}
          {canViewGenderBreakdown && (
            <>
              <StatCard
                title="Male Pupils"
                value={stats.malePupils}
                icon={User}
                color={cardColors.male}
                onClick={() => handleCardClick('/pupils?classId=all&gender=Male')}
                subtitle={`${stats.totalPupils ? Math.round((stats.malePupils / stats.totalPupils) * 100) : 0}% of total`}
                progress={stats.totalPupils ? Math.round((stats.malePupils / stats.totalPupils) * 100) : 0}
                isLoading={basicStatsLoading}
              />
              <StatCard
                title="Female Pupils"
                value={stats.femalePupils}
                icon={User}
                color={cardColors.female}
                onClick={() => handleCardClick('/pupils?classId=all&gender=Female')}
                subtitle={`${stats.totalPupils ? Math.round((stats.femalePupils / stats.totalPupils) * 100) : 0}% of total`}
                progress={stats.totalPupils ? Math.round((stats.femalePupils / stats.totalPupils) * 100) : 0}
                isLoading={basicStatsLoading}
              />
            </>
          )}
          {canViewTotalStaff && (
            <ExpandableStaffCard
              title="Staff Members"
              value={stats.totalStaff}
              icon={Briefcase}
              color={cardColors.staff}
              subtitle="Total staff"
              segments={staff && staff.length > 0 ? [
                { percentage: (staff.filter(s => s.gender === 'Male').length / staff.length) * 100, color: 'text-blue-500' },
                { percentage: (staff.filter(s => s.gender === 'Female').length / staff.length) * 100, color: 'text-pink-500' }
              ] : [{ percentage: 100, color: cardColors.staff.text }]}
              isLoading={basicStatsLoading}
              staff={staff}
            />
          )}
          {canViewAttendanceToday && (
            <>
              <ExpandableAttendanceCard
                title="Present Today"
                value={stats.presentToday}
                icon={UserCheck}
                color={cardColors.classes}
                subtitle="In attendance"
                progress={stats.presentToday + stats.absentToday ? Math.round((stats.presentToday / (stats.presentToday + stats.absentToday)) * 100) : 0}
                isLoading={attendanceLoading}
                attendanceData={attendanceData}
                pupils={pupils}
                filterType="present"
              />
              <ExpandableAttendanceCard
                title="Absent Today"
                value={stats.absentToday}
                icon={UserX}
                color={{
                  bg: 'rgba(239, 68, 68, 0.1)',
                  text: 'text-red-600',
                  accent: '#EF4444',
                  gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(252, 165, 165, 0.1) 100%)'
                }}
                subtitle="Not present"
                progress={stats.presentToday + stats.absentToday ? Math.round((stats.absentToday / (stats.presentToday + stats.absentToday)) * 100) : 0}
                isLoading={attendanceLoading}
                attendanceData={attendanceData}
                pupils={pupils}
                filterType="absent"
                animateConfigs={[
                  {
                    title: "Absent Today",
                    value: stats.absentToday,
                    icon: UserX,
                    color: {
                      bg: 'rgba(239, 68, 68, 0.1)',
                      text: 'text-red-600',
                      accent: '#EF4444',
                      gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(252, 165, 165, 0.1) 100%)'
                    },
                    subtitle: "Not present",
                    filterType: "absent",
                    progress: stats.presentToday + stats.absentToday ? Math.round((stats.absentToday / (stats.presentToday + stats.absentToday)) * 100) : 0,
                    segments: [{ percentage: stats.presentToday + stats.absentToday ? Math.round((stats.absentToday / (stats.presentToday + stats.absentToday)) * 100) : 0, color: 'text-red-500' }]
                  },
                  {
                    title: "Delayed Today",
                    value: stats.delayedToday,
                    icon: Clock,
                    color: {
                      bg: 'rgba(245, 158, 11, 0.1)',
                      text: 'text-amber-600',
                      accent: '#F59E0B',
                      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(253, 230, 138, 0.1) 100%)'
                    },
                    subtitle: "Not yet returned",
                    filterType: "delayed",
                    progress: stats.attendanceTotal ? Math.round((stats.delayedToday / stats.attendanceTotal) * 100) : 0,
                    segments: [{ percentage: stats.attendanceTotal ? Math.round((stats.delayedToday / stats.attendanceTotal) * 100) : 0, color: 'text-amber-500' }]
                  }
                ]}
              />
            </>
          )}

        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="flex flex-col gap-6">
            {canViewClassEnrollment && <ClassEnrollmentChart classes={classes} pupils={pupils} />}
            <div className="block lg:hidden">
              <DashboardLiveTracker />
            </div>
            <PhotoSlideshow photos={photos || []} />
          </div>
          <div className="flex flex-col gap-6">
            {canViewAttendanceChart && <TodaysAttendanceChart classes={classes} pupils={pupils} attendanceData={attendanceData} />}
            {canViewCalendarSchedule && <MonthCalendarCard />}
          </div>
          <div className="flex flex-col gap-6">
            <div className="hidden lg:block w-full">
              <DashboardLiveTracker />
            </div>
            {canViewCalendarSchedule && <TermScheduleCard />}
          </div>
        </div>

        {/* Quick Actions (Ribbon Links) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto px-4">
          <QuickActionButton
            title="Attendance"
            icon={Activity}
            // Red Theme (like 'Subscribe')
            baseColor="#E11D25"
            darkColor="#A01111"
            onClick={() => router.push('/attendance')}
          />

          <QuickActionButton
            title="Fee Management"
            icon={Target}
            // Orange Theme (like 'Add To Chart')
            baseColor="#FF7A18"
            darkColor="#CF5704"
            onClick={() => router.push('/fees')}
          />

          <QuickActionButton
            title="Examinations"
            icon={Award}
            // Green Theme (like 'Download Now')
            baseColor="#16A34A"
            darkColor="#14532D"
            onClick={() => router.push('/exams')}
          />

          <QuickActionButton
            title="Reports"
            icon={Zap}
            // Blue Theme (like 'Learn More')
            baseColor="#6366F1"
            darkColor="#1D4ED8"
            onClick={() => router.push('/reports')}
          />
        </div>
      </div>

      <style jsx global>{`
        /* GPU Acceleration for better performance */
        .stat-card {
          transform: translateZ(0);
          backface-visibility: hidden;
          perspective: 1000px;
        }
        
        /* Enhanced 3D depth for all cards */
        .stat-card,
        [class*="Card"] {
          position: relative;
        }
        
        /* Smooth transitions for hover states with enhanced depth */
        .stat-card:hover {
          transform: scale(1.03) translateY(-4px) translateZ(0);
        }
        
        /* Add depth to background */
        body {
          background: linear-gradient(to bottom right, #f9fafb, #ffffff, #eff6ff);
        }
        
        /* Optimize animations */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
