"use client";

import { useMemo, useState } from "react";
import { format, parseISO, isValid, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, differenceInYears, compareAsc, isSameDay } from "date-fns";
import { ArrowLeft, Calendar, CalendarDays, ChevronLeft, ChevronRight, Clock, Sparkles, Users } from "lucide-react";
import { GlassPageTopBar } from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";
import { SmartBackButton } from "@/components/common/SmartBackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePupils } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { useAuth } from "@/lib/contexts/auth-context";
import type { Pupil } from "@/types";

type BirthdayViewMode = "day" | "week" | "month";

type NormalizedBirthdayPupil = {
  id: string;
  fullName: string;
  admissionNumber: string;
  className: string;
  birthDate: Date;
  birthdayKey: string;
};

type BirthdayResult = {
  id: string;
  fullName: string;
  admissionNumber: string;
  className: string;
  birthdayDate: Date;
  birthdayLabel: string;
  turningAge: number;
};

type PeriodDetails = {
  start: Date;
  end: Date;
  label: string;
  dates: Date[];
};

const ISO_DATE_FORMAT = "yyyy-MM-dd";
const MONTH_KEY_FORMAT = "MM-dd";
const ALL_CLASSES_VALUE = "all-classes";

function parsePupilBirthDate(value?: string) {
  if (!value) return null;

  const parsed = parseISO(value);
  if (isValid(parsed)) {
    return parsed;
  }

  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

function normalizeBirthdayPupils(pupils: Pupil[]): NormalizedBirthdayPupil[] {
  return pupils
    .filter((pupil) => pupil.status === "Active")
    .flatMap((pupil) => {
      const birthDate = parsePupilBirthDate(pupil.dateOfBirth);
      if (!birthDate) return [];

      return [
        {
          id: pupil.id,
          fullName: `${pupil.firstName} ${pupil.lastName}`.trim(),
          admissionNumber: pupil.admissionNumber,
          className: pupil.classCode || pupil.className || "Unassigned",
          birthDate,
          birthdayKey: format(birthDate, MONTH_KEY_FORMAT),
        },
      ];
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function buildPeriod(anchor: Date, viewMode: BirthdayViewMode): PeriodDetails {
  if (viewMode === "day") {
    return {
      start: anchor,
      end: anchor,
      label: format(anchor, "EEEE, MMM dd, yyyy"),
      dates: [anchor],
    };
  }

  if (viewMode === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = endOfWeek(anchor, { weekStartsOn: 1 });
    return {
      start,
      end,
      label: `${format(start, "MMM dd")} - ${format(end, "MMM dd, yyyy")}`,
      dates: eachDayOfInterval({ start, end }),
    };
  }

  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  return {
    start,
    end,
    label: format(start, "MMMM yyyy"),
    dates: eachDayOfInterval({ start, end }),
  };
}

function countBirthdaysInDates(pupils: NormalizedBirthdayPupil[], dates: Date[]) {
  const keys = new Set(dates.map((date) => format(date, MONTH_KEY_FORMAT)));
  return pupils.filter((pupil) => keys.has(pupil.birthdayKey)).length;
}

function getNextValidBirthdayDate(birthDate: Date, anchor: Date) {
  const month = birthDate.getMonth();
  const day = birthDate.getDate();

  for (let offset = 0; offset <= 8; offset += 1) {
    const year = anchor.getFullYear() + offset;
    const candidate = new Date(year, month, day);

    if (candidate.getMonth() !== month || candidate.getDate() !== day) {
      continue;
    }

    if (candidate >= anchor || offset > 0) {
      return candidate;
    }
  }

  return null;
}

export default function BirthdaysPage() {
  const { data: pupils = [], isLoading } = usePupils();
  const { data: classes = [] } = useClasses();
  const { user, canAccessPage } = useAuth();
  const [viewMode, setViewMode] = useState<BirthdayViewMode>("day");
  const [anchorDate, setAnchorDate] = useState(() => format(new Date(), ISO_DATE_FORMAT));
  const [selectedClass, setSelectedClass] = useState(ALL_CLASSES_VALUE);

  const hasAccess = user?.role === "Admin" || canAccessPage("pupils", "birthdays");

  const normalizedPupils = useMemo(() => normalizeBirthdayPupils(pupils), [pupils]);

  const classOptions = useMemo(() => {
    const classOrderMap = new Map(classes.map((c) => [c.name, typeof c.order === "number" ? c.order : Infinity]));
    return Array.from(new Set(normalizedPupils.map((pupil) => pupil.className))).sort((left, right) => {
      const orderA = classOrderMap.get(left) ?? Infinity;
      const orderB = classOrderMap.get(right) ?? Infinity;
      return orderA - orderB;
    });
  }, [normalizedPupils, classes]);

  const filteredPupils = useMemo(() => {
    if (selectedClass === ALL_CLASSES_VALUE) {
      return normalizedPupils;
    }

    return normalizedPupils.filter((pupil) => pupil.className === selectedClass);
  }, [normalizedPupils, selectedClass]);

  const anchor = useMemo(() => {
    const parsed = parseISO(anchorDate);
    return isValid(parsed) ? parsed : new Date();
  }, [anchorDate]);

  const period = useMemo(() => buildPeriod(anchor, viewMode), [anchor, viewMode]);

  const birthdaysInPeriod = useMemo(() => {
    const datesByBirthdayKey = new Map(
      period.dates.map((date) => [format(date, MONTH_KEY_FORMAT), date])
    );

    return filteredPupils
      .flatMap((pupil) => {
        const matchedDate = datesByBirthdayKey.get(pupil.birthdayKey);
        if (!matchedDate) return [];

        return [
          {
            id: pupil.id,
            fullName: pupil.fullName,
            admissionNumber: pupil.admissionNumber,
            className: pupil.className,
            birthdayDate: matchedDate,
            birthdayLabel: format(pupil.birthDate, "MMM dd"),
            turningAge: differenceInYears(matchedDate, pupil.birthDate),
          },
        ];
      })
      .sort((left, right) => {
        const dateComparison = compareAsc(left.birthdayDate, right.birthdayDate);
        if (dateComparison !== 0) return dateComparison;
        return left.fullName.localeCompare(right.fullName);
      });
  }, [filteredPupils, period.dates]);

  const today = useMemo(() => new Date(), []);
  const todayCount = useMemo(() => countBirthdaysInDates(filteredPupils, [today]), [filteredPupils, today]);
  const weekCount = useMemo(() => {
    const weekDates = eachDayOfInterval({
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: endOfWeek(today, { weekStartsOn: 1 }),
    });
    return countBirthdaysInDates(filteredPupils, weekDates);
  }, [filteredPupils, today]);
  const monthCount = useMemo(() => {
    const monthDates = eachDayOfInterval({
      start: startOfMonth(today),
      end: endOfMonth(today),
    });
    return countBirthdaysInDates(filteredPupils, monthDates);
  }, [filteredPupils, today]);

  const nearestUpcomingBirthday = useMemo(() => {
    let closest: (BirthdayResult & { daysAway: number }) | null = null;

    for (const pupil of filteredPupils) {
      const nextBirthday = getNextValidBirthdayDate(pupil.birthDate, anchor);
      if (!nextBirthday) continue;

      const daysAway = Math.round((nextBirthday.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      const candidate = {
        id: pupil.id,
        fullName: pupil.fullName,
        admissionNumber: pupil.admissionNumber,
        className: pupil.className,
        birthdayDate: nextBirthday,
        birthdayLabel: format(pupil.birthDate, "MMM dd"),
        turningAge: differenceInYears(nextBirthday, pupil.birthDate),
        daysAway,
      };

      if (!closest) {
        closest = candidate;
        continue;
      }

      if (candidate.daysAway < closest.daysAway) {
        closest = candidate;
        continue;
      }

      if (candidate.daysAway === closest.daysAway && candidate.fullName.localeCompare(closest.fullName) < 0) {
        closest = candidate;
      }
    }

    return closest;
  }, [anchor, filteredPupils]);

  const pageDescription =
    viewMode === "day"
      ? "Birthdays for a single calendar day"
      : viewMode === "week"
        ? "Birthdays across the selected Monday-start week"
        : "Birthdays across the selected calendar month";

  const monthInputValue = format(anchor, "yyyy-MM");
  const selectedClassLabel = selectedClass === ALL_CLASSES_VALUE ? "All classes" : selectedClass;

  const goToPreviousPeriod = () => {
    const nextAnchor =
      viewMode === "day"
        ? subDays(anchor, 1)
        : viewMode === "week"
          ? subWeeks(anchor, 1)
          : subMonths(anchor, 1);

    setAnchorDate(format(nextAnchor, ISO_DATE_FORMAT));
  };

  const goToNextPeriod = () => {
    const nextAnchor =
      viewMode === "day"
        ? addDays(anchor, 1)
        : viewMode === "week"
          ? addWeeks(anchor, 1)
          : addMonths(anchor, 1);

    setAnchorDate(format(nextAnchor, ISO_DATE_FORMAT));
  };

  const resetToCurrentPeriod = () => {
    setAnchorDate(format(new Date(), ISO_DATE_FORMAT));
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Birthdays"
          subtitle="Birthday tracking for active pupils"
          backHref="/pupils"
          backLabel="Back to pupils"
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card className="border-rose-200 bg-white/90 shadow-lg">
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
                <Users className="h-6 w-6 text-rose-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Access restricted</h2>
              <p className="mt-2 text-sm text-gray-600">
                Your account does not currently have permission to view the birthdays page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen animate-in fade-in duration-500">
      <GlassPageTopBar
        title="Birthdays"
        subtitle="Birthday tracking for active pupils"
        backHref="/pupils"
        backLabel="Back to pupils"
        className="mb-1.5"
        meta={
          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100/80 whitespace-nowrap">
            {birthdaysInPeriod.length} matches
          </span>
        }
        titleControls={
          <div className="flex items-center gap-1.5 lg:hidden">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-[34px] min-w-[80px] max-w-[110px] rounded-full border-blue-200/60 bg-white/90 px-2 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden shrink-0">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value={ALL_CLASSES_VALUE} className="rounded-lg text-sm">All classes</SelectItem>
                {classOptions.map((className) => (
                  <SelectItem key={className} value={className} className="rounded-lg text-sm">
                    {className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={viewMode} onValueChange={(val: BirthdayViewMode) => setViewMode(val)}>
              <SelectTrigger className="h-[34px] min-w-[75px] max-w-[100px] rounded-full border-blue-200/60 bg-white/90 px-2 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden shrink-0">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="day" className="rounded-lg text-xs">Day</SelectItem>
                <SelectItem value="week" className="rounded-lg text-xs">Week</SelectItem>
                <SelectItem value="month" className="rounded-lg text-xs">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        center={
          <div className="hidden lg:flex items-center gap-2">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-[34px] min-w-[90px] max-w-[125px] rounded-full border-blue-200/60 bg-white/90 px-2.5 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden shrink-0">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value={ALL_CLASSES_VALUE} className="rounded-lg text-sm">All classes</SelectItem>
                {classOptions.map((className) => (
                  <SelectItem key={className} value={className} className="rounded-lg text-sm">
                    {className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={viewMode} onValueChange={(val: BirthdayViewMode) => setViewMode(val)}>
              <SelectTrigger className="h-[34px] min-w-[85px] max-w-[110px] rounded-full border-blue-200/60 bg-white/90 px-2.5 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 [&>svg]:hidden shrink-0">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="day" className="rounded-lg text-xs">Day</SelectItem>
                <SelectItem value="week" className="rounded-lg text-xs">Week</SelectItem>
                <SelectItem value="month" className="rounded-lg text-xs">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={goToPreviousPeriod}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-white/80 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-600 shadow-sm"
                title="Previous Period"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={resetToCurrentPeriod}
                className="h-7 px-2.5 rounded-full bg-white/80 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-[10px] font-medium text-gray-700 whitespace-nowrap shadow-sm"
              >
                {viewMode === "day" ? "Today" : viewMode === "week" ? "This Week" : "This Month"}
              </button>

              <button
                onClick={goToNextPeriod}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-white/80 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-600 shadow-sm"
                title="Next Period"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {viewMode === "month" ? (
              <Input
                type="month"
                value={monthInputValue}
                onChange={(event) => {
                  if (event.target.value) {
                    setAnchorDate(`${event.target.value}-01`);
                  }
                }}
                className="h-7 w-[110px] sm:w-[130px] bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 transition-all rounded-full text-[10px] sm:text-xs py-0 px-2 shadow-sm"
              />
            ) : (
              <Input
                type="date"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
                className="h-7 w-[120px] sm:w-[140px] bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 transition-all rounded-full text-[10px] sm:text-xs py-0 px-2 shadow-sm"
              />
            )}
          </div>
        }
      />

      <GlassSummaryBar
        left={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 dark:text-indigo-200 uppercase">
              Birthday Summary
            </span>
          </div>
        }
        right={
          <>
            <div className="flex items-center gap-1 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-blue-600 dark:text-blue-400">{birthdaysInPeriod.length}</span>
              <span className="text-blue-700/85 dark:text-blue-300 font-medium">Selected Period</span>
            </div>
            <div className="flex items-center gap-1 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{todayCount}</span>
              <span className="text-emerald-700/85 dark:text-emerald-300 font-medium">Today</span>
            </div>
            <div className="flex items-center gap-1 bg-purple-50/80 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-purple-600 dark:text-purple-400">{weekCount}</span>
              <span className="text-purple-700/85 dark:text-purple-300 font-medium">This Week</span>
            </div>
            {nearestUpcomingBirthday && (
              <div className="flex items-center gap-1 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="text-amber-700/85 dark:text-amber-300 font-medium">Nearest:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {nearestUpcomingBirthday.fullName}
                </span>
                <span className="text-amber-500/85 text-[9px] sm:text-[10px]">
                  ({format(nearestUpcomingBirthday.birthdayDate, "MMM dd")} – {nearestUpcomingBirthday.daysAway === 0 ? "today" : `${nearestUpcomingBirthday.daysAway}d`})
                </span>
              </div>
            )}
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        <Card className="border-white/20 bg-white/85 shadow-lg backdrop-blur-sm">
          <CardContent className="p-4 sm:p-6">
            {isLoading ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
                <p className="mt-4 text-sm text-gray-600">Loading cached pupil birthdays...</p>
              </div>
            ) : birthdaysInPeriod.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                  <CalendarDays className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">No birthdays in this period</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Try a different {viewMode}, date, or class filter to explore more birthdays.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop and Tablet Layout (Table) */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80">
                        <TableHead className="text-xs sm:text-sm">Birthday</TableHead>
                        <TableHead className="text-xs sm:text-sm">Pupil</TableHead>
                        <TableHead className="text-xs sm:text-sm">Class</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right sm:text-left">Age</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Period Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {birthdaysInPeriod.map((birthday) => {
                        const isBirthdayToday = isSameDay(birthday.birthdayDate, today);
                        return (
                          <TableRow key={birthday.id} className="hover:bg-blue-50/40">
                            <TableCell className="p-2 sm:p-4">
                              <div className="font-medium text-gray-900 text-xs sm:text-sm">
                                {format(birthday.birthdayDate, "EEE, MMM dd")}
                              </div>
                              <div className="text-[10px] text-gray-500">DOB: {birthday.birthdayLabel}</div>
                            </TableCell>
                            <TableCell className="p-2 sm:p-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-gray-900 text-xs sm:text-sm">{birthday.fullName}</span>
                                {isBirthdayToday && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap animate-pulse">
                                    Today! 🎉
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="p-2 sm:p-4">
                              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px] sm:text-xs">
                                {birthday.className}
                              </Badge>
                            </TableCell>
                            <TableCell className="p-2 sm:p-4 text-right sm:text-left text-xs sm:text-sm">
                              <span className="font-semibold text-violet-700 whitespace-nowrap">Turns {birthday.turningAge}</span>
                            </TableCell>
                            <TableCell className="p-2 sm:p-4 hidden md:table-cell text-xs sm:text-sm">
                              <Badge
                                variant="outline"
                                className={isBirthdayToday ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-700"}
                              >
                                {isBirthdayToday ? "Today" : viewMode === "day" ? "Selected day" : viewMode === "week" ? "Selected week" : "Selected month"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Layout (Card-based list) */}
                <div className="sm:hidden space-y-3">
                  {birthdaysInPeriod.map((birthday) => {
                    const isBirthdayToday = isSameDay(birthday.birthdayDate, today);
                    return (
                      <div 
                        key={birthday.id} 
                        className={`p-3.5 rounded-xl border backdrop-blur-sm transition-all duration-300 ${
                          isBirthdayToday 
                            ? "bg-emerald-50/70 dark:bg-emerald-950/10 border-emerald-200/80 shadow-[0_4px_12px_rgba(16,185,129,0.08)]" 
                            : "bg-white/80 dark:bg-gray-900/80 border-gray-100 dark:border-gray-800 shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          {/* Left Section: Name and Date */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs sm:text-sm">
                                {birthday.fullName}
                              </span>
                              {isBirthdayToday && (
                                <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200/50 text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap animate-pulse">
                                  Today! 🎉
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-blue-500" />
                                {format(birthday.birthdayDate, "EEE, MMM dd")}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span>DOB: {birthday.birthdayLabel}</span>
                            </div>
                          </div>

                          {/* Right Section: Age Info */}
                          <div className="text-right">
                            <span className="text-[10px] sm:text-xs font-bold bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full border border-violet-100 dark:border-violet-900/50 whitespace-nowrap">
                              Turns {birthday.turningAge}
                            </span>
                          </div>
                        </div>

                        {/* Bottom Section: Class */}
                        <div className="mt-3 pt-2.5 border-t border-gray-100/50 dark:border-gray-800/50 flex items-center gap-1.5 text-[10px]">
                          <span className="text-gray-400">Class:</span>
                          <Badge variant="outline" className="border-blue-100 bg-blue-50/50 text-blue-700 text-[9px] font-medium py-0 px-1.5">
                            {birthday.className}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
