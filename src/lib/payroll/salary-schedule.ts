import type {
  PayrollDueStatus,
  SalaryComponent,
  SalarySchedule,
} from "@/types/payroll";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const MAX_OCCURRENCES = 10_000;

function assertDate(value: string, label = "date") {
  if (!DATE_PATTERN.test(value)) throw new Error(`Invalid ${label}: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

function formatDate(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
}

function addDays(date: Date, amount: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function addMonthsFromAnchor(anchor: Date, amount: number) {
  const targetMonth = anchor.getUTCMonth() + amount;
  const targetYear = anchor.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const day = Math.min(
    anchor.getUTCDate(),
    lastDayOfMonth(targetYear, normalizedMonth),
  );
  return new Date(Date.UTC(targetYear, normalizedMonth, day, 12));
}

function addYearsFromAnchor(anchor: Date, amount: number) {
  const year = anchor.getUTCFullYear() + amount;
  const month = anchor.getUTCMonth();
  const day = Math.min(anchor.getUTCDate(), lastDayOfMonth(year, month));
  return new Date(Date.UTC(year, month, day, 12));
}

function occurrenceAt(schedule: SalarySchedule, index: number) {
  const anchor = assertDate(schedule.anchorDate, "anchor date");
  const interval = Number(schedule.interval);
  if (!Number.isInteger(interval) || interval < 1)
    throw new Error("Schedule interval must be a positive whole number.");

  if (schedule.unit === "once") return index === 0 ? anchor : null;
  if (schedule.unit === "day") return addDays(anchor, interval * index);
  if (schedule.unit === "week") return addDays(anchor, interval * 7 * index);
  if (schedule.unit === "month")
    return addMonthsFromAnchor(anchor, interval * index);
  return addYearsFromAnchor(anchor, interval * index);
}

export function isSalaryDateExcluded(schedule: SalarySchedule, date: string) {
  if (!DATE_PATTERN.test(date)) return false;
  return (
    new Set(schedule.excludedDates ?? []).has(date) ||
    new Set(schedule.excludedMonths ?? []).has(date.slice(0, 7)) ||
    (schedule.unit === "month" &&
      new Set(schedule.excludedMonthNumbers ?? []).has(Number(date.slice(5, 7))))
  );
}

export function getSalaryDatesBetween(
  schedule: SalarySchedule,
  startDate: string,
  endDate: string,
  limit = 500,
) {
  const start = assertDate(startDate, "start date");
  const end = assertDate(endDate, "end date");
  const scheduleEnd = schedule.endDate
    ? assertDate(schedule.endDate, "schedule end date")
    : null;
  if (start > end || (scheduleEnd && scheduleEnd < start)) return [];

  const dates: string[] = [];
  for (
    let index = 0;
    index < MAX_OCCURRENCES && dates.length < limit;
    index += 1
  ) {
    const occurrence = occurrenceAt(schedule, index);
    if (!occurrence) break;
    if (scheduleEnd && occurrence > scheduleEnd) break;
    if (occurrence > end) break;
    if (occurrence >= start) {
      const value = formatDate(occurrence);
      if (!isSalaryDateExcluded(schedule, value)) dates.push(value);
    }
  }
  return dates;
}

export function getNextSalaryDate(
  schedule: SalarySchedule,
  afterDate: string,
  inclusive = false,
) {
  const after = assertDate(afterDate, "comparison date");
  const scheduleEnd = schedule.endDate
    ? assertDate(schedule.endDate, "schedule end date")
    : null;

  for (let index = 0; index < MAX_OCCURRENCES; index += 1) {
    const occurrence = occurrenceAt(schedule, index);
    if (!occurrence || (scheduleEnd && occurrence > scheduleEnd)) return null;
    const matchesAfter = inclusive ? occurrence >= after : occurrence > after;
    if (matchesAfter) {
      const value = formatDate(occurrence);
      if (!isSalaryDateExcluded(schedule, value)) return value;
    }
  }
  throw new Error(
    "Unable to find a future salary date within the supported schedule range.",
  );
}

export function getPayrollDueStatus(
  nextDueDate: string | undefined,
  today: string,
): PayrollDueStatus {
  if (!nextDueDate)
    return { kind: "none", days: null, label: "No future payment date" };
  const due = assertDate(nextDueDate, "next due date");
  const now = assertDate(today, "today");
  const difference = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  if (difference === 0) return { kind: "today", days: 0, label: "Due today" };
  if (difference < 0)
    return {
      kind: "overdue",
      days: Math.abs(difference),
      label: `Overdue by ${Math.abs(difference)} day${difference === -1 ? "" : "s"}`,
    };
  return {
    kind: "upcoming",
    days: difference,
    label: `${difference} day${difference === 1 ? "" : "s"} left`,
  };
}

export function getExpectedAmountForMonth(
  components: SalaryComponent[],
  yearMonth: string,
) {
  if (!MONTH_PATTERN.test(yearMonth))
    throw new Error(`Invalid year-month: ${yearMonth}`);
  const [year, month] = yearMonth.split("-").map(Number);
  const start = `${yearMonth}-01`;
  const end = `${yearMonth}-${String(lastDayOfMonth(year, month - 1)).padStart(2, "0")}`;
  return components
    .filter((component) => component.status !== "ended")
    .reduce(
      (total, component) =>
        total +
        getSalaryDatesBetween(component.schedule, start, end).length *
          component.amount,
      0,
    );
}

export function buildSalaryOccurrenceKey(
  staffId: string,
  componentId: string,
  dueDate: string,
) {
  if (!staffId || !componentId)
    throw new Error("A staff and component identifier are required.");
  assertDate(dueDate, "due date");
  return `${staffId}_${componentId}_${dueDate}`;
}
