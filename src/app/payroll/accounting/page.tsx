"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  Users,
} from "lucide-react";
import { GlassPageRouteSkeleton } from "@/components/common/glass-page-loading";
import { GlassPageTopBar } from "@/components/common/glass-page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useAuth } from "@/lib/contexts/auth-context";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { usePayrollAccounting } from "@/lib/hooks/use-payroll";
import { formatCurrency } from "@/lib/utils";

type PeriodKind = "month" | "term" | "year" | "custom";

function kampalaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function calendarMonthRange(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${value}-01`,
    endDate: `${value}-${String(end).padStart(2, "0")}`,
  };
}

function formatPeriodDate(value: string) {
  return new Intl.DateTimeFormat("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatMethod(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PayrollAccountingPage() {
  const { canAccessPage } = useAuth();
  const allowed = canAccessPage("payroll", "overview");
  const { data: academicYears = [] } = useAcademicYears();
  const today = kampalaToday();
  const [period, setPeriod] = useState<PeriodKind>("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [academicYearId, setAcademicYearId] = useState("");
  const [termId, setTermId] = useState("");
  const [customStart, setCustomStart] = useState(`${today.slice(0, 7)}-01`);
  const [customEnd, setCustomEnd] = useState(today);

  const selectedYear =
    academicYears.find((year) => year.id === academicYearId) ||
    academicYears.find((year) => year.isActive) ||
    academicYears[0];
  const selectedTerm =
    selectedYear?.terms.find((term) => term.id === termId) ||
    selectedYear?.terms.find(
      (term) => term.startDate <= today && term.endDate >= today,
    ) ||
    selectedYear?.terms[0];
  const range = useMemo(() => {
    if (period === "month") return calendarMonthRange(month);
    if (period === "term" && selectedYear && selectedTerm) {
      return {
        startDate: selectedTerm.startDate,
        endDate: selectedTerm.endDate,
        label: `${selectedYear.name} · ${selectedTerm.name}`,
      };
    }
    if (period === "year" && selectedYear) {
      return {
        startDate: selectedYear.startDate,
        endDate: selectedYear.endDate,
        label: selectedYear.name,
      };
    }
    if (
      period === "custom" &&
      customStart &&
      customEnd &&
      customStart <= customEnd
    ) {
      return {
        startDate: customStart,
        endDate: customEnd,
        label: "Custom period",
      };
    }
    return null;
  }, [customEnd, customStart, month, period, selectedTerm, selectedYear]);
  const accounting = usePayrollAccounting(
    range?.startDate || "",
    range?.endDate || "",
    allowed && Boolean(range),
  );

  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
        You do not have permission to view salary spending.
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GlassPageTopBar
        title="Salary Spending"
        subtitle="See recorded salary payments for a calendar or academic period."
        backHref="/payroll"
        backLabel="Back to payroll"
      />
      <main className="mx-auto max-w-6xl space-y-4 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-emerald-700" />
              Accounting period
            </CardTitle>
            <CardDescription>
              Spending is based on payments recorded in the selected period.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="payroll-period">Period</Label>
              <Select
                value={period}
                onValueChange={(value: PeriodKind) => setPeriod(value)}
              >
                <SelectTrigger id="payroll-period" className="mt-1 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Calendar month</SelectItem>
                  <SelectItem value="term">Academic term</SelectItem>
                  <SelectItem value="year">Academic year</SelectItem>
                  <SelectItem value="custom">Custom date range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {period === "month" && (
              <div>
                <Label htmlFor="payroll-month">Month</Label>
                <Input
                  id="payroll-month"
                  className="mt-1 min-h-11"
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </div>
            )}

            {(period === "term" || period === "year") && (
              <div>
                <Label htmlFor="payroll-academic-year">Academic year</Label>
                <Select
                  value={selectedYear?.id || ""}
                  onValueChange={setAcademicYearId}
                >
                  <SelectTrigger
                    id="payroll-academic-year"
                    className="mt-1 min-h-11"
                    disabled={academicYears.length === 0}
                  >
                    <SelectValue placeholder="Choose an academic year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {period === "term" && (
              <div>
                <Label htmlFor="payroll-term">Term</Label>
                <Select
                  value={selectedTerm?.id || ""}
                  onValueChange={setTermId}
                >
                  <SelectTrigger
                    id="payroll-term"
                    className="mt-1 min-h-11"
                    disabled={!selectedYear || selectedYear.terms.length === 0}
                  >
                    <SelectValue placeholder="Choose a term" />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedYear?.terms || []).map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {period === "custom" && (
              <>
                <div>
                  <Label htmlFor="payroll-custom-start">Start date</Label>
                  <Input
                    id="payroll-custom-start"
                    className="mt-1 min-h-11"
                    type="date"
                    value={customStart}
                    onChange={(event) => setCustomStart(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="payroll-custom-end">End date</Label>
                  <Input
                    id="payroll-custom-end"
                    className="mt-1 min-h-11"
                    type="date"
                    value={customEnd}
                    onChange={(event) => setCustomEnd(event.target.value)}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {!range && (
          <Card className="border-amber-200 bg-amber-50/70">
            <CardContent role="alert" className="p-5 text-sm text-amber-900">
              {period === "custom"
                ? "Choose an end date on or after the start date."
                : "Set up an academic year and its terms to report on this period."}
            </CardContent>
          </Card>
        )}

        {range && accounting.isLoading && (
          <GlassPageRouteSkeleton variant="list" />
        )}

        {range && accounting.error && (
          <Card className="border-red-200">
            <CardContent role="alert" className="p-5 text-sm text-red-700">
              {accounting.error instanceof Error
                ? accounting.error.message
                : "Unable to load salary spending."}
            </CardContent>
          </Card>
        )}

        {range && accounting.data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-emerald-200 bg-emerald-50/60">
                <CardContent className="p-5">
                  <CircleDollarSign className="mb-3 h-5 w-5 text-emerald-700" />
                  <p className="text-xs font-medium text-emerald-800">
                    Salary spending
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-950">
                    {formatCurrency(accounting.data.totalAmount)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <BarChart3 className="mb-3 h-5 w-5 text-blue-700" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Payments recorded
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {accounting.data.paymentCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <Users className="mb-3 h-5 w-5 text-violet-700" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Staff paid
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {accounting.data.staffPaidCount}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Payment breakdown</CardTitle>
                <CardDescription>
                  {range.label || "Selected period"} ·{" "}
                  {formatPeriodDate(range.startDate)} to{" "}
                  {formatPeriodDate(range.endDate)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accounting.data.paymentMethods.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {accounting.data.paymentMethods.map((method: any) => (
                      <Badge
                        key={method.method}
                        variant="secondary"
                        className="px-3 py-2"
                      >
                        {formatMethod(method.method)} ·{" "}
                        {formatCurrency(method.amount)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No salary payments were recorded in this period.
                  </p>
                )}
              </CardContent>
            </Card>

            {accounting.data.byStaff.length > 0 && (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff member</TableHead>
                      <TableHead>Payments</TableHead>
                      <TableHead>Last payment</TableHead>
                      <TableHead className="text-right">Amount paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounting.data.byStaff.map((staff: any) => (
                      <TableRow key={staff.staffId}>
                        <TableCell className="font-medium">
                          {staff.staffName}
                        </TableCell>
                        <TableCell>{staff.paymentCount}</TableCell>
                        <TableCell>
                          {formatPeriodDate(staff.lastPaymentDate)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(staff.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </>
        )}

        <Button asChild variant="outline">
          <Link href="/payroll">Back to payroll</Link>
        </Button>
      </main>
    </div>
  );
}
