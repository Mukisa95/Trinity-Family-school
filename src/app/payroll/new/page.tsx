"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { GlassPageTopBar } from "@/components/common/glass-page-top-bar";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/contexts/auth-context";
import {
  useCreateSalaryProfile,
  usePayrollOverview,
} from "@/lib/hooks/use-payroll";
import { useStaff } from "@/lib/hooks/use-staff";

type ScheduleDraft = {
  unit: "once" | "day" | "week" | "month" | "year";
  interval: number;
  anchorDate: string;
  endDate: string;
  excludedDates: string;
  excludedMonths: string;
};
type AllowanceDraft = {
  id: string;
  name: string;
  customName: string;
  amount: string;
  schedule: ScheduleDraft;
};

const allowanceNames = [
  "Housing",
  "Transport",
  "Medical",
  "Meals",
  "Responsibility",
  "Airtime",
  "Other",
];
function kampalaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function newSchedule(): ScheduleDraft {
  return {
    unit: "month",
    interval: 1,
    anchorDate: kampalaToday(),
    endDate: "",
    excludedDates: "",
    excludedMonths: "",
  };
}
function schedulePayload(schedule: ScheduleDraft) {
  return {
    unit: schedule.unit,
    interval: Number(schedule.interval),
    anchorDate: schedule.anchorDate,
    endDate: schedule.endDate || undefined,
    excludedDates: schedule.excludedDates
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    excludedMonths: schedule.excludedMonths
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    timezone: "Africa/Kampala" as const,
  };
}

function ScheduleFields({
  value,
  onChange,
  title = "Release schedule",
}: {
  value: ScheduleDraft;
  onChange: (next: ScheduleDraft) => void;
  title?: string;
}) {
  const update = (
    field: keyof ScheduleDraft,
    next: ScheduleDraft[keyof ScheduleDraft],
  ) => onChange({ ...value, [field]: next } as ScheduleDraft);
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          The release date is the first day this amount becomes due.
        </p>
      </div>
      <div>
        <Label>Frequency</Label>
        <Select
          value={value.unit}
          onValueChange={(next: ScheduleDraft["unit"]) => update("unit", next)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="once">Once</SelectItem>
            <SelectItem value="day">Every number of days</SelectItem>
            <SelectItem value="week">Every number of weeks</SelectItem>
            <SelectItem value="month">Every number of months</SelectItem>
            <SelectItem value="year">Every number of years</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${title}-interval`}>Every</Label>
        <Input
          id={`${title}-interval`}
          className="mt-1"
          type="number"
          min="1"
          max="120"
          inputMode="numeric"
          value={value.interval}
          disabled={value.unit === "once"}
          onChange={(event) => update("interval", event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${title}-date`}>First release date</Label>
        <Input
          id={`${title}-date`}
          className="mt-1"
          type="date"
          value={value.anchorDate}
          onChange={(event) => update("anchorDate", event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${title}-end`}>
          End date{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${title}-end`}
          className="mt-1"
          type="date"
          value={value.endDate}
          onChange={(event) => update("endDate", event.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${title}-skip-dates`}>
          Skip exact dates{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${title}-skip-dates`}
          className="mt-1"
          placeholder="2026-12-25, 2027-01-01"
          value={value.excludedDates}
          onChange={(event) => update("excludedDates", event.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Comma-separated dates. Skipping does not change the future schedule.
        </p>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${title}-skip-months`}>
          Skip full months{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${title}-skip-months`}
          className="mt-1"
          placeholder="2026-12, 2027-08"
          value={value.excludedMonths}
          onChange={(event) => update("excludedMonths", event.target.value)}
        />
      </div>
    </div>
  );
}

export default function NewSalaryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { canAccessPage, canPerformAction } = useAuth();
  const { data: staff = [] } = useStaff();
  const { data: payroll } = usePayrollOverview(
    canAccessPage("payroll", "overview"),
  );
  const createProfile = useCreateSalaryProfile();
  const [staffId, setStaffId] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [baseSchedule, setBaseSchedule] =
    useState<ScheduleDraft>(newSchedule());
  const [allowances, setAllowances] = useState<AllowanceDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canCreate = canPerformAction("payroll", "setup", "create_salary");
  const profiles = new Set(
    (payroll?.rows ?? [])
      .filter((row: any) => row.status !== "ended")
      .map((row: any) => row.staffId),
  );
  const availableStaff = useMemo(
    () => staff.filter((member) => !profiles.has(member.id)),
    [staff, payroll?.rows],
  );

  const addAllowance = () =>
    setAllowances((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "Housing",
        customName: "",
        amount: "",
        schedule: newSchedule(),
      },
    ]);
  const updateAllowance = (id: string, patch: Partial<AllowanceDraft>) =>
    setAllowances((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!staffId || !baseAmount || Number(baseAmount) <= 0) {
      setError("Choose a staff member and enter a valid base salary.");
      return;
    }
    try {
      await createProfile.mutateAsync({
        staffId,
        baseSalary: {
          amount: Number(baseAmount),
          schedule: schedulePayload(baseSchedule),
        },
        allowances: allowances.map((item) => ({
          name: item.name,
          customName: item.name === "Other" ? item.customName : undefined,
          amount: Number(item.amount),
          schedule: schedulePayload(item.schedule),
        })),
      });
      toast({
        title: "Salary profile created",
        description:
          "The salary schedule and allowances are now ready for tracking.",
      });
      router.push(`/payroll/staff/${staffId}`);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to create the salary profile.",
      );
    }
  };

  if (!canCreate)
    return (
      <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
        You do not have permission to set up staff salaries.
      </div>
    );
  return (
    <div className="min-h-screen">
      <GlassPageTopBar
        title="Set Up Staff Salary"
        subtitle="Create a base salary, a flexible release schedule, and optional allowances."
        backHref="/payroll"
        backLabel="Back to payroll"
      />
      <form
        onSubmit={submit}
        className="mx-auto max-w-4xl space-y-4 px-4 pb-12 pt-4 sm:px-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>1. Choose staff member</CardTitle>
            <CardDescription>
              The salary profile stays linked to this existing staff record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="staff">Staff member</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger id="staff" className="mt-1">
                <SelectValue placeholder="Choose a staff member" />
              </SelectTrigger>
              <SelectContent>
                {availableStaff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.firstName} {member.lastName} · {member.employeeId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>2. Base salary</CardTitle>
            <CardDescription>
              Set what this staff member earns before allowances.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="baseAmount">Salary amount (UGX)</Label>
              <Input
                id="baseAmount"
                className="mt-1"
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="e.g. 1200000"
                value={baseAmount}
                onChange={(event) => setBaseAmount(event.target.value)}
              />
            </div>
            <ScheduleFields
              title="Base salary schedule"
              value={baseSchedule}
              onChange={setBaseSchedule}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>3. Allowances</CardTitle>
              <CardDescription>
                Each allowance can use its own amount, schedule, and skipped
                dates.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={addAllowance}>
              <Plus className="mr-2 h-4 w-4" />
              Add allowance
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {allowances.length === 0 && (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No allowances added. You can add Housing, Transport, Medical, or
                a custom allowance.
              </p>
            )}
            {allowances.map((allowance, index) => (
              <div
                key={allowance.id}
                className="space-y-3 rounded-xl border p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">Allowance {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-600"
                    onClick={() =>
                      setAllowances((current) =>
                        current.filter((item) => item.id !== allowance.id),
                      )
                    }
                    aria-label="Remove allowance"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Allowance name</Label>
                    <Select
                      value={allowance.name}
                      onValueChange={(name) =>
                        updateAllowance(allowance.id, { name })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allowanceNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount (UGX)</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={allowance.amount}
                      onChange={(event) =>
                        updateAllowance(allowance.id, {
                          amount: event.target.value,
                        })
                      }
                    />
                  </div>
                  {allowance.name === "Other" && (
                    <div className="sm:col-span-2">
                      <Label>Custom allowance name</Label>
                      <Input
                        className="mt-1"
                        value={allowance.customName}
                        onChange={(event) =>
                          updateAllowance(allowance.id, {
                            customName: event.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
                <ScheduleFields
                  title={`Allowance ${index + 1} schedule`}
                  value={allowance.schedule}
                  onChange={(schedule) =>
                    updateAllowance(allowance.id, { schedule })
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="sticky bottom-3 flex justify-end rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur dark:bg-slate-950/95">
          <Button type="submit" disabled={createProfile.isPending}>
            {createProfile.isPending
              ? "Saving salary profile…"
              : "Save salary profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
