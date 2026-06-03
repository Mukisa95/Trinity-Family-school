"use client";

import { useMemo, useState } from "react";
import { format, parseISO, isValid, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, differenceInYears, compareAsc, isSameDay } from "date-fns";
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Clock, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePupils } from "@/lib/hooks/use-pupils";
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
          className: pupil.className || pupil.classCode || "Unassigned",
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
  const { user, canAccessPage } = useAuth();
  const [viewMode, setViewMode] = useState<BirthdayViewMode>("day");
  const [anchorDate, setAnchorDate] = useState(() => format(new Date(), ISO_DATE_FORMAT));
  const [selectedClass, setSelectedClass] = useState(ALL_CLASSES_VALUE);

  const hasAccess = user?.role === "Admin" || canAccessPage("pupils", "birthdays");

  const normalizedPupils = useMemo(() => normalizeBirthdayPupils(pupils), [pupils]);

  const classOptions = useMemo(
    () => Array.from(new Set(normalizedPupils.map((pupil) => pupil.className))).sort((left, right) => left.localeCompare(right)),
    [normalizedPupils]
  );

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

    filteredPupils.forEach((pupil) => {
      const nextBirthday = getNextValidBirthdayDate(pupil.birthDate, anchor);
      if (!nextBirthday) return;

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
        return;
      }

      if (candidate.daysAway < closest.daysAway) {
        closest = candidate;
        return;
      }

      if (candidate.daysAway === closest.daysAway && candidate.fullName.localeCompare(closest.fullName) < 0) {
        closest = candidate;
      }
    });

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
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50">
        <div className="container mx-auto px-4 py-6">
          <PageHeader
            title="Birthdays"
            description="Birthday tracking for active pupils"
          />
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto space-y-6 px-4 py-6">
        <PageHeader
          title="Birthdays"
          description="Active pupil birthdays powered by cached pupil data"
          actions={
            <Badge variant="outline" className="bg-white/80 text-xs">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              {filteredPupils.length} pupils in {selectedClassLabel}
            </Badge>
          }
        />

        <Card className="border-white/20 bg-white/85 shadow-lg backdrop-blur-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as BirthdayViewMode)}>
                <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm lg:w-[320px]">
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex items-center gap-2 rounded-lg bg-white/80 px-2 py-2 shadow-sm">
                  <Button variant="outline" size="icon" onClick={goToPreviousPeriod}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-[180px] text-center">
                    <p className="text-sm font-semibold text-gray-900">{period.label}</p>
                    <p className="text-xs text-gray-500">{pageDescription}</p>
                  </div>
                  <Button variant="outline" size="icon" onClick={goToNextPeriod}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
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
                    className="w-full bg-white md:w-[180px]"
                  />
                ) : (
                  <Input
                    type="date"
                    value={anchorDate}
                    onChange={(event) => setAnchorDate(event.target.value)}
                    className="w-full bg-white md:w-[180px]"
                  />
                )}

                <select
                  value={selectedClass}
                  onChange={(event) => setSelectedClass(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background md:w-[200px]"
                >
                  <option value={ALL_CLASSES_VALUE}>All classes</option>
                  {classOptions.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>

                <Button variant="outline" onClick={resetToCurrentPeriod} className="bg-white">
                  {viewMode === "day" ? "Today" : viewMode === "week" ? "This Week" : "This Month"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-100">Selected Period</p>
                  <p className="text-2xl font-bold">{birthdaysInPeriod.length}</p>
                </div>
                <Calendar className="h-7 w-7 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-100">Today</p>
                  <p className="text-2xl font-bold">{todayCount}</p>
                </div>
                <CalendarDays className="h-7 w-7 text-emerald-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-violet-100">This Week</p>
                  <p className="text-2xl font-bold">{weekCount}</p>
                </div>
                <Users className="h-7 w-7 text-violet-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-100">Nearest Upcoming</p>
                  <p className="text-base font-bold leading-tight">
                    {nearestUpcomingBirthday ? nearestUpcomingBirthday.fullName : "None"}
                  </p>
                  <p className="text-xs text-amber-100">
                    {nearestUpcomingBirthday
                      ? `${format(nearestUpcomingBirthday.birthdayDate, "MMM dd, yyyy")} (${nearestUpcomingBirthday.daysAway === 0 ? "today" : `${nearestUpcomingBirthday.daysAway} day${nearestUpcomingBirthday.daysAway === 1 ? "" : "s"}`})`
                      : `${monthCount} this month`}
                  </p>
                </div>
                <Clock className="h-7 w-7 text-amber-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/20 bg-white/85 shadow-lg backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
              Birthday Results
              <Badge variant="outline" className="ml-2 border-blue-200 bg-blue-50 text-blue-700">
                {birthdaysInPeriod.length} matches
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                {selectedClassLabel}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead>Birthday</TableHead>
                      <TableHead>Pupil</TableHead>
                      <TableHead>Admission Number</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Turning Age</TableHead>
                      <TableHead>Period Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {birthdaysInPeriod.map((birthday) => {
                      const isBirthdayToday = isSameDay(birthday.birthdayDate, today);
                      return (
                        <TableRow key={birthday.id} className="hover:bg-blue-50/40">
                          <TableCell>
                            <div className="font-medium text-gray-900">
                              {format(birthday.birthdayDate, "EEE, MMM dd")}
                            </div>
                            <div className="text-xs text-gray-500">DOB: {birthday.birthdayLabel}</div>
                          </TableCell>
                          <TableCell className="font-medium text-gray-900">{birthday.fullName}</TableCell>
                          <TableCell className="text-gray-700">{birthday.admissionNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                              {birthday.className}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-violet-700">{birthday.turningAge}</span>
                          </TableCell>
                          <TableCell>
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
