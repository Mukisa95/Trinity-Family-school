"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  Plus,
  Search,
  Users,
} from "lucide-react";
import {
  GlassActionButton,
  GlassActionDock,
  GlassPageSearchInput,
  GlassPageTopBar,
} from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";
import { GlassPageRouteSkeleton } from "@/components/common/glass-page-loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/contexts/auth-context";
import { usePayrollOverview } from "@/lib/hooks/use-payroll";
import { cn, formatCurrency } from "@/lib/utils";

function dueTone(kind: string) {
  if (kind === "overdue") return "border-red-200 bg-red-50 text-red-700";
  if (kind === "today") return "border-amber-200 bg-amber-50 text-amber-800";
  if (kind === "upcoming")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function PayrollPage() {
  const { canAccessPage, canPerformAction } = useAuth();
  const allowed = canAccessPage("payroll", "overview");
  const { data, isLoading, error } = usePayrollOverview(allowed);
  const [search, setSearch] = useState("");
  const canCreate = canPerformAction("payroll", "setup", "create_salary");

  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter((row: any) =>
        `${row.staffName} ${row.employeeId} ${row.department || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [data?.rows, search],
  );
  const totals = useMemo(() => {
    const all = data?.rows ?? [];
    return {
      active: all.filter((row: any) => row.status === "active").length,
      dueSoon: all.filter(
        (row: any) =>
          row.dueStatus?.kind === "today" || (row.dueStatus?.days ?? 99) <= 7,
      ).length,
      overdue: all.filter((row: any) => row.dueStatus?.kind === "overdue")
        .length,
      expected: all.reduce(
        (sum: number, row: any) => sum + Number(row.expectedThisMonth || 0),
        0,
      ),
    };
  }, [data?.rows]);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="flex gap-3 p-6 text-amber-900">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>You do not have permission to view staff payroll.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (isLoading) return <GlassPageRouteSkeleton variant="list" />;

  return (
    <div className="min-h-screen">
      <GlassPageTopBar
        title="Staff Payroll"
        subtitle="Track salary schedules, allowances, due dates, and payment history."
        backHref="/"
        backLabel="Back to dashboard"
        center={
          <GlassPageSearchInput
            placeholder="Search staff, employee ID, or department..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        }
        actionsLeading={
          <GlassPageSearchInput
            containerClassName="lg:hidden"
            placeholder="Search payroll..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="Salary Spending"
              icon={<BarChart3 className="h-4 w-4" />}
              tone="emerald"
              onClick={() => window.location.assign("/payroll/accounting")}
              aria-label="View salary spending accounting"
            />
            {canCreate && (
              <GlassActionButton
                label="Set Up Salary"
                icon={<Plus className="h-4 w-4" />}
                tone="blue"
                onClick={() => window.location.assign("/payroll/new")}
                aria-label="Set up staff salary"
              />
            )}
          </GlassActionDock>
        }
      />

      <main className="mx-auto max-w-7xl space-y-4 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <GlassSummaryBar
          left={
            <>
              <p className="text-sm font-semibold">Payroll snapshot</p>
              <p className="text-xs text-muted-foreground">
                Expected salary release totals for this calendar month.
              </p>
            </>
          }
          right={
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <span className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <Users className="mr-1 inline h-3.5 w-3.5" />
                {totals.active} active
              </span>
              <span className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
                {totals.dueSoon} due soon
              </span>
              <span className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
                {totals.overdue} overdue
              </span>
              <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                <CircleDollarSign className="mr-1 inline h-3.5 w-3.5" />
                {formatCurrency(totals.expected)}
              </span>
            </div>
          }
        />

        {error ? (
          <Card className="border-red-200">
            <CardContent className="p-6 text-red-700">
              {error instanceof Error
                ? error.message
                : "Unable to load payroll."}
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center">
              <CircleDollarSign className="mx-auto mb-3 h-10 w-10 text-slate-400" />
              <h2 className="font-semibold">No salary profiles yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Set up a salary to begin tracking payments and due dates.
              </p>
              {canCreate && (
                <Button asChild className="mt-5">
                  <Link href="/payroll/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Set up first salary
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {rows.map((row: any) => (
                <Link
                  key={row.id}
                  href={`/payroll/staff/${row.staffId}`}
                  className="group"
                >
                  <Card className="transition-colors group-hover:border-blue-200">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{row.staffName}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.employeeId} ·{" "}
                            {row.department || "No department"}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Base salary
                          </p>
                          <p className="font-semibold tabular-nums">
                            {formatCurrency(row.currentBaseAmount)}{" "}
                            <span className="font-normal text-muted-foreground">
                              /{row.currentBaseFrequency}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Last payment
                          </p>
                          <p className="font-medium">
                            {row.lastPaymentDate || "None recorded"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Next: {row.nextDueDate || "—"}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            dueTone(row.dueStatus?.kind),
                          )}
                        >
                          {row.dueStatus?.label}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            <Card className="hidden overflow-hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff member</TableHead>
                    <TableHead>Base salary</TableHead>
                    <TableHead>Allowances</TableHead>
                    <TableHead>Last payment</TableHead>
                    <TableHead>Next salary date</TableHead>
                    <TableHead className="text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className="font-medium">{row.staffName}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.employeeId} · {row.department || "No department"}
                        </p>
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {formatCurrency(row.currentBaseAmount)}{" "}
                        <span className="font-normal text-muted-foreground">
                          /{row.currentBaseFrequency}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.activeAllowanceCount || 0} active
                      </TableCell>
                      <TableCell>
                        {row.lastPaymentDate ? (
                          <>
                            <p>{formatCurrency(row.lastPaymentAmount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.lastPaymentDate}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            None recorded
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p>{row.nextDueDate || "—"}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "mt-1 text-xs",
                            dueTone(row.dueStatus?.kind),
                          )}
                        >
                          {row.dueStatus?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/payroll/staff/${row.staffId}`}>
                            View <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
