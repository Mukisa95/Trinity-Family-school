"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus, Trash2, X } from "lucide-react";
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
import { FieldError, FormErrorSummary } from "@/components/ui/form-feedback";
import { createFieldValidation, useFormValidation } from "@/lib/utils/form-validation";

type ScheduleDraft = {
  unit: "once" | "day" | "week" | "month" | "year";
  interval: number;
  anchorDate: string;
  endDate: string;
  excludedDates: string[];
  excludedMonths: string[];
  excludedMonthNumbers: number[];
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
const calendarMonths = [
  { number: 1, label: "January" },
  { number: 2, label: "February" },
  { number: 3, label: "March" },
  { number: 4, label: "April" },
  { number: 5, label: "May" },
  { number: 6, label: "June" },
  { number: 7, label: "July" },
  { number: 8, label: "August" },
  { number: 9, label: "September" },
  { number: 10, label: "October" },
  { number: 11, label: "November" },
  { number: 12, label: "December" },
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
    excludedDates: [],
    excludedMonths: [],
    excludedMonthNumbers: [],
  };
}
function schedulePayload(schedule: ScheduleDraft) {
  return {
    unit: schedule.unit,
    interval: Number(schedule.interval),
    anchorDate: schedule.anchorDate,
    endDate: schedule.endDate || undefined,
    excludedDates: schedule.excludedDates,
    excludedMonths: schedule.excludedMonths,
    excludedMonthNumbers: schedule.excludedMonthNumbers,
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
  const [skipDate, setSkipDate] = useState("");
  const [skipMonth, setSkipMonth] = useState("");
  const update = (
    field: keyof ScheduleDraft,
    next: ScheduleDraft[keyof ScheduleDraft],
  ) => onChange({ ...value, [field]: next } as ScheduleDraft);
  const toggleRecurringMonth = (month: number) => {
    const next = value.excludedMonthNumbers.includes(month)
      ? value.excludedMonthNumbers.filter((item) => item !== month)
      : [...value.excludedMonthNumbers, month].sort((a, b) => a - b);
    update("excludedMonthNumbers", next);
  };
  const addExcludedDate = () => {
    if (!skipDate || value.excludedDates.includes(skipDate)) return;
    update("excludedDates", [...value.excludedDates, skipDate].sort());
    setSkipDate("");
  };
  const addExcludedMonth = () => {
    if (!skipMonth || value.excludedMonths.includes(skipMonth)) return;
    update("excludedMonths", [...value.excludedMonths, skipMonth].sort());
    setSkipMonth("");
  };
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
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <Input
            id={`${title}-skip-dates`}
            type="date"
            value={skipDate}
            onChange={(event) => setSkipDate(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={addExcludedDate}
          >
            Add date
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Skipping does not change the future schedule.
        </p>
        {value.excludedDates.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {value.excludedDates.map((date) => (
              <Button
                key={date}
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 gap-1"
                onClick={() =>
                  update(
                    "excludedDates",
                    value.excludedDates.filter((item) => item !== date),
                  )
                }
                aria-label={`Stop skipping ${date}`}
              >
                {date}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="sm:col-span-2">
        {value.unit === "month" && (
          <fieldset className="rounded-lg border bg-background p-3">
            <legend className="px-1 text-sm font-medium">
              Skip months every year
            </legend>
            <p className="mb-3 text-xs text-muted-foreground">
              Choose a month such as November to skip that monthly payment every
              year.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {calendarMonths.map((month) => {
                const selected = value.excludedMonthNumbers.includes(
                  month.number,
                );
                return (
                  <Button
                    key={month.number}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    className="min-h-11 justify-start"
                    aria-pressed={selected}
                    onClick={() => toggleRecurringMonth(month.number)}
                  >
                    {month.label}
                  </Button>
                );
              })}
            </div>
          </fieldset>
        )}
        <div className={value.unit === "month" ? "mt-3" : ""}>
          <Label htmlFor={`${title}-skip-months`}>
            Skip one calendar month{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <Input
              id={`${title}-skip-months`}
              type="month"
              value={skipMonth}
              onChange={(event) => setSkipMonth(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={addExcludedMonth}
            >
              Add month
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Use this for a one-off month, for example November 2026.
          </p>
          {value.excludedMonths.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {value.excludedMonths.map((month) => (
                <Button
                  key={month}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-11 gap-1"
                  onClick={() =>
                    update(
                      "excludedMonths",
                      value.excludedMonths.filter((item) => item !== month),
                    )
                  }
                  aria-label={`Stop skipping ${month}`}
                >
                  {month}
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              ))}
            </div>
          )}
        </div>
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
  const formValidation = useFormValidation([
    createFieldValidation('payrollStaff', staffId, 'Staff member', true, { message: 'Choose the staff member.' }),
    createFieldValidation('baseAmount', baseAmount, 'Base salary', true, {
      message: 'Enter the base salary.',
      validate: (value) => Number(value) > 0 ? undefined : 'Enter a base salary greater than zero.',
    }),
  ]);
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
    if (!formValidation.validateAll().isValid) return;
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
      const message = submissionError instanceof Error ? submissionError.message : "Unable to create the salary profile.";
      setError(message);
      formValidation.setSubmissionError(message);
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
        <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
        <Card>
          <CardHeader>
            <CardTitle>1. Choose staff member</CardTitle>
            <CardDescription>
              The salary profile stays linked to this existing staff record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="payrollStaff" className={formValidation.getFieldError('payrollStaff') ? 'text-destructive' : undefined}>Staff member <span className="text-destructive">*</span></Label>
            <Select value={staffId} onValueChange={(value) => { setStaffId(value); formValidation.handleFieldChange('payrollStaff'); }}>
              <SelectTrigger id="payrollStaff" className="mt-1" {...formValidation.getFieldProps('payrollStaff')}>
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
            <FieldError error={formValidation.getFieldError('payrollStaff')} />
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
              <Label htmlFor="baseAmount" className={formValidation.getFieldError('baseAmount') ? 'text-destructive' : undefined}>Salary amount (UGX) <span className="text-destructive">*</span></Label>
              <Input
                id="baseAmount"
                className="mt-1"
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="e.g. 1200000"
                value={baseAmount}
                onChange={(event) => { setBaseAmount(event.target.value); formValidation.handleFieldChange('baseAmount'); }}
                {...formValidation.getFieldProps('baseAmount')}
              />
              <FieldError error={formValidation.getFieldError('baseAmount')} />
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
