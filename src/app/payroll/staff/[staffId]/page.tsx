"use client";

import { use, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarClock,
  History,
  Loader2,
  ReceiptText,
} from "lucide-react";
import {
  GlassActionButton,
  GlassActionDock,
  GlassPageTopBar,
} from "@/components/common/glass-page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/contexts/auth-context";
import {
  useRecordSalaryPayment,
  useScheduleSalaryIncrease,
  useStaffPayroll,
} from "@/lib/hooks/use-payroll";
import { useStaffById } from "@/lib/hooks/use-staff";
import { getNextSalaryDate } from "@/lib/payroll/salary-schedule";
import { cn, formatCurrency } from "@/lib/utils";

function kampalaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function badgeTone(status: string) {
  return status === "paid"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "partial"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-700";
}

export default function StaffPayrollDetailPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = use(params);
  const { toast } = useToast();
  const { canAccessPage, canPerformAction } = useAuth();
  const { data: staff } = useStaffById(staffId);
  const canView = canAccessPage("payroll", "detail");
  const { data, isLoading, error } = useStaffPayroll(staffId, canView);
  const paymentMutation = useRecordSalaryPayment(staffId);
  const increaseMutation = useScheduleSalaryIncrease(staffId);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [increaseOpen, setIncreaseOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(kampalaToday());
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [allocationAmounts, setAllocationAmounts] = useState<
    Record<string, string>
  >({});
  const [increaseMode, setIncreaseMode] = useState<"increase_by" | "set_to">(
    "increase_by",
  );
  const [increaseAmount, setIncreaseAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(kampalaToday());
  const [reason, setReason] = useState("");

  const today = data?.today || kampalaToday();
  const activeComponents = useMemo(
    () =>
      (data?.components || []).filter(
        (component: any) =>
          component.status !== "ended" &&
          component.effectiveFrom <= today &&
          (!component.effectiveTo || component.effectiveTo >= today),
      ),
    [data?.components, today],
  );
  const dueDate = data?.nextDueDate || "";
  const dueComponents = useMemo(
    () =>
      activeComponents.filter(
        (component: any) =>
          getNextSalaryDate(component.schedule, today, true) === dueDate,
      ),
    [activeComponents, dueDate, today],
  );
  const currentBase = activeComponents.find(
    (component: any) => component.type === "base_salary",
  );
  const totalSelected = dueComponents.reduce(
    (sum: number, component: any) =>
      sum + Number(allocationAmounts[component.id] ?? component.amount),
    0,
  );
  const canRecord = canPerformAction("payroll", "detail", "record_payment");
  const canIncrease = canPerformAction("payroll", "detail", "increase_salary");

  useEffect(() => {
    if (!paymentOpen) return;
    setAllocationAmounts(
      Object.fromEntries(
        dueComponents.map((component: any) => [
          component.id,
          String(component.amount),
        ]),
      ),
    );
    setPaymentDate(today);
  }, [paymentOpen, dueComponents, today]);

  const recordPayment = async () => {
    if (!dueDate || dueComponents.length === 0) return;
    try {
      await paymentMutation.mutateAsync({
        paymentDate,
        method,
        reference: reference || undefined,
        note: note || undefined,
        idempotencyKey: `salary_${staffId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        allocations: dueComponents
          .map((component: any) => ({
            componentId: component.id,
            scheduledDueDate: dueDate,
            expectedAmount: component.amount,
            paidAmount: Number(allocationAmounts[component.id] ?? 0),
          }))
          .filter((allocation: any) => allocation.paidAmount > 0),
      });
      toast({
        title: "Salary payment recorded",
        description: `${formatCurrency(totalSelected)} has been added to the staff payment history.`,
      });
      setPaymentOpen(false);
      setReference("");
      setNote("");
    } catch (recordError) {
      toast({
        variant: "destructive",
        title: "Payment not recorded",
        description:
          recordError instanceof Error
            ? recordError.message
            : "Please try again.",
      });
    }
  };
  const submitIncrease = async () => {
    if (!currentBase || !increaseAmount || !reason.trim()) return;
    try {
      await increaseMutation.mutateAsync({
        componentId: currentBase.id,
        mode: increaseMode,
        amount: Number(increaseAmount),
        effectiveDate,
        reason,
      });
      toast({
        title: "Salary increase scheduled",
        description:
          "The new amount will apply from the selected effective date.",
      });
      setIncreaseOpen(false);
      setIncreaseAmount("");
      setReason("");
    } catch (increaseError) {
      toast({
        variant: "destructive",
        title: "Increase not scheduled",
        description:
          increaseError instanceof Error
            ? increaseError.message
            : "Please try again.",
      });
    }
  };

  if (!canView)
    return (
      <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
        You do not have permission to view staff salary details.
      </div>
    );
  if (isLoading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-2xl p-6 text-sm text-red-700">
        {error instanceof Error ? error.message : "Salary profile not found."}
      </div>
    );

  const staffName = staff
    ? `${staff.firstName} ${staff.lastName}`
    : data.profile.staffId;
  return (
    <div className="min-h-screen">
      <GlassPageTopBar
        title={staffName}
        subtitle={`Salary profile · ${staff?.employeeId || "Staff payroll"}`}
        backHref="/payroll"
        backLabel="Back to payroll"
        meta={
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700"
          >
            {data.profile.status}
          </Badge>
        }
        actions={
          <GlassActionDock>
            {canRecord && (
              <GlassActionButton
                label="Record payment"
                icon={<ReceiptText className="h-4 w-4" />}
              tone="emerald"
                onClick={() => setPaymentOpen(true)}
                aria-label="Record salary payment"
              />
            )}
            {canIncrease && (
              <GlassActionButton
                label="Increase salary"
                icon={<ArrowUpRight className="h-4 w-4" />}
                tone="blue"
                onClick={() => setIncreaseOpen(true)}
                aria-label="Increase salary"
              />
            )}
          </GlassActionDock>
        }
      />
      <main className="mx-auto max-w-6xl space-y-4 px-4 pb-12 pt-4 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                Current base salary
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {formatCurrency(data.profile.currentBaseAmount)}{" "}
                <span className="font-normal text-muted-foreground">
                  /{data.profile.currentBaseFrequency}
                </span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Active allowances</p>
              <p className="mt-1 font-semibold">
                {data.profile.activeAllowanceCount || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Next due date</p>
              <p className="mt-1 font-semibold">
                {dueDate || "No future date"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Last payment</p>
              <p className="mt-1 font-semibold">
                {data.profile.lastPaymentDate
                  ? `${formatCurrency(data.profile.lastPaymentAmount)} · ${data.profile.lastPaymentDate}`
                  : "None recorded"}
              </p>
            </CardContent>
          </Card>
        </div>
        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">Payment history</TabsTrigger>
            <TabsTrigger value="timeline">Compensation timeline</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-blue-600" />
                  Upcoming payment
                </CardTitle>
                <CardDescription>
                  The next release date is calculated from each salary and
                  allowance schedule.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dueComponents.length ? (
                  <div className="space-y-3">
                    {dueComponents.map((component: any) => (
                      <div
                        key={component.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{component.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Due {dueDate} · every {component.schedule.interval}{" "}
                            {component.schedule.unit}
                            {component.schedule.interval === 1 ? "" : "s"}
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums">
                          {formatCurrency(component.amount)}
                        </p>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-3 font-semibold">
                      <span>Total due</span>
                      <span>
                        {formatCurrency(
                          dueComponents.reduce(
                            (sum: number, component: any) =>
                              sum + component.amount,
                            0,
                          ),
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    There is no scheduled amount due after the current date.
                  </p>
                )}
              </CardContent>
            </Card>
            <div className="grid gap-3 lg:grid-cols-2">
              {activeComponents.map((component: any) => (
                <Card key={component.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{component.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {component.type === "base_salary"
                            ? "Base salary"
                            : "Allowance"}{" "}
                          · from {component.effectiveFrom}
                        </p>
                      </div>
                      <p className="font-semibold tabular-nums">
                        {formatCurrency(component.amount)}
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Every {component.schedule.interval}{" "}
                      {component.schedule.unit}
                      {component.schedule.interval === 1 ? "" : "s"} · first
                      release {component.schedule.anchorDate}
                    </p>
                    {component.schedule.excludedDates?.length ||
                    component.schedule.excludedMonths?.length ? (
                      <p className="mt-1 text-xs text-amber-700">
                        {component.schedule.excludedDates?.length || 0} date(s)
                        and {component.schedule.excludedMonths?.length || 0}{" "}
                        month(s) skipped
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-600" />
                  Payment history
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No salary payments have been recorded yet.
                  </p>
                ) : (
                  data.payments.map((payment: any) => (
                    <div key={payment.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {formatCurrency(payment.amount)} ·{" "}
                            {payment.paymentDate}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.method.replace("_", " ")}
                            {payment.reference ? ` · ${payment.reference}` : ""}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            badgeTone(payment.status),
                          )}
                        >
                          {payment.status}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-1 text-sm">
                        {payment.allocations.map((allocation: any) => (
                          <div
                            key={allocation.occurrenceKey}
                            className="flex justify-between"
                          >
                            <span>
                              {allocation.componentName} · due{" "}
                              {allocation.scheduledDueDate}
                            </span>
                            <span className="tabular-nums">
                              {formatCurrency(allocation.paidAmount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {payment.note && (
                        <p className="mt-3 text-sm text-muted-foreground">
                          {payment.note}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="timeline">
            <div className="space-y-3">
              {data.adjustments.map((adjustment: any) => (
                <Card key={adjustment.id}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <ArrowUpRight className="mt-0.5 h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-medium">
                        Salary{" "}
                        {adjustment.mode === "increase_by"
                          ? "increase"
                          : "change"}{" "}
                        effective {adjustment.effectiveDate}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(adjustment.previousAmount)} →{" "}
                        {formatCurrency(adjustment.nextAmount)} ·{" "}
                        {adjustment.reason}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {data.adjustments.length === 0 && (
                <Card>
                  <CardContent className="p-5 text-sm text-muted-foreground">
                    No salary increases have been scheduled.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record salary payment</DialogTitle>
            <DialogDescription>
              Record the amount paid for the next due release on{" "}
              {dueDate || "—"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {dueComponents.map((component: any) => (
              <div
                key={component.id}
                className="grid grid-cols-[1fr_minmax(120px,180px)] items-end gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{component.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Expected {formatCurrency(component.amount)}
                  </p>
                </div>
                <div>
                  <Label htmlFor={`payment-${component.id}`}>Amount paid</Label>
                  <Input
                    id={`payment-${component.id}`}
                    className="mt-1"
                    type="number"
                    min="0"
                    max={component.amount}
                    inputMode="numeric"
                    value={allocationAmounts[component.id] ?? ""}
                    onChange={(event) =>
                      setAllocationAmounts((current) => ({
                        ...current,
                        [component.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Payment date</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
              <div>
                <Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  Reference{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  className="mt-1"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </div>
              <div>
                <Label>Total payment</Label>
                <p className="mt-2 font-semibold tabular-nums">
                  {formatCurrency(totalSelected)}
                </p>
              </div>
            </div>
            <div>
              <Label>
                Note{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                className="mt-1"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                paymentMutation.isPending ||
                totalSelected <= 0 ||
                dueComponents.length === 0
              }
              onClick={recordPayment}
            >
              {paymentMutation.isPending ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={increaseOpen} onOpenChange={setIncreaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Increase salary</DialogTitle>
            <DialogDescription>
              The current salary remains in history. The new amount starts on
              the selected effective date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Change type</Label>
              <Select
                value={increaseMode}
                onValueChange={(value: "increase_by" | "set_to") =>
                  setIncreaseMode(value)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase_by">Add an increment</SelectItem>
                  <SelectItem value="set_to">Set a new salary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                {increaseMode === "increase_by"
                  ? "Increase amount (UGX)"
                  : "New salary amount (UGX)"}
              </Label>
              <Input
                className="mt-1"
                type="number"
                min="1"
                inputMode="numeric"
                value={increaseAmount}
                onChange={(event) => setIncreaseAmount(event.target.value)}
              />
            </div>
            <div>
              <Label>Effective date</Label>
              <Input
                className="mt-1"
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                className="mt-1"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Annual salary review"
              />
            </div>
            {currentBase && increaseAmount && (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                {formatCurrency(currentBase.amount)} →{" "}
                {formatCurrency(
                  increaseMode === "increase_by"
                    ? currentBase.amount + Number(increaseAmount || 0)
                    : Number(increaseAmount || 0),
                )}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIncreaseOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                increaseMutation.isPending ||
                !increaseAmount ||
                reason.trim().length < 3
              }
              onClick={submitIncrease}
            >
              {increaseMutation.isPending ? "Scheduling…" : "Schedule increase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
