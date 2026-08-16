import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextSalaryDate,
  getPayrollDueStatus,
  getSalaryDatesBetween,
} from "../src/lib/payroll/salary-schedule";

const monthlyOn31st = {
  unit: "month" as const,
  interval: 1,
  anchorDate: "2026-01-31",
  timezone: "Africa/Kampala" as const,
};

test("monthly schedules clamp to the last day in shorter months and recover the anchor day", () => {
  assert.deepEqual(
    getSalaryDatesBetween(monthlyOn31st, "2026-01-01", "2026-04-30"),
    ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"],
  );
});

test("custom day schedules respect exact-date and whole-month exclusions", () => {
  const schedule = {
    unit: "day" as const,
    interval: 10,
    anchorDate: "2026-01-01",
    excludedDates: ["2026-01-11"],
    excludedMonths: ["2026-02"],
    timezone: "Africa/Kampala" as const,
  };
  assert.deepEqual(
    getSalaryDatesBetween(schedule, "2026-01-01", "2026-03-15"),
    ["2026-01-01", "2026-01-21", "2026-01-31", "2026-03-02", "2026-03-12"],
  );
});

test("next due date skips excluded occurrences without shifting the cadence", () => {
  assert.equal(
    getNextSalaryDate(
      { ...monthlyOn31st, excludedMonths: ["2026-02"] },
      "2026-01-31",
    ),
    "2026-03-31",
  );
});

test("due labels distinguish upcoming, today, and overdue dates", () => {
  assert.deepEqual(getPayrollDueStatus("2026-08-20", "2026-08-16"), {
    kind: "upcoming",
    days: 4,
    label: "4 days left",
  });
  assert.deepEqual(getPayrollDueStatus("2026-08-16", "2026-08-16"), {
    kind: "today",
    days: 0,
    label: "Due today",
  });
  assert.deepEqual(getPayrollDueStatus("2026-08-14", "2026-08-16"), {
    kind: "overdue",
    days: 2,
    label: "Overdue by 2 days",
  });
});
