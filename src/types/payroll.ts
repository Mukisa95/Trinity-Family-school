export type PayrollFrequencyUnit = "once" | "day" | "week" | "month" | "year";

export type SalarySchedule = {
  unit: PayrollFrequencyUnit;
  interval: number;
  /** First date on which this component is due, stored as YYYY-MM-DD. */
  anchorDate: string;
  endDate?: string;
  /** Exact dates that are not due, stored as YYYY-MM-DD. */
  excludedDates?: string[];
  /** Whole calendar months that are not due, stored as YYYY-MM. */
  excludedMonths?: string[];
  timezone: "Africa/Kampala";
};

export type AllowanceName =
  | "Housing"
  | "Transport"
  | "Medical"
  | "Meals"
  | "Responsibility"
  | "Airtime"
  | "Other";

export type SalaryComponentType = "base_salary" | "allowance";

export type SalaryComponent = {
  id: string;
  staffId: string;
  type: SalaryComponentType;
  name: string;
  allowanceName?: AllowanceName;
  customName?: string;
  amount: number;
  currency: "UGX";
  schedule: SalarySchedule;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "active" | "scheduled" | "ended";
  versionGroupId: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
};

export type SalaryProfile = {
  id: string;
  staffId: string;
  status: "active" | "paused" | "ended";
  currency: "UGX";
  currentBaseAmount: number;
  currentBaseFrequency: PayrollFrequencyUnit;
  activeAllowanceCount: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  nextDueDate?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
};

export type SalaryPaymentMethod =
  | "cash"
  | "bank"
  | "mobile_money"
  | "cheque"
  | "other";

export type SalaryPaymentAllocation = {
  occurrenceKey: string;
  componentId: string;
  componentName: string;
  scheduledDueDate: string;
  expectedAmount: number;
  paidAmount: number;
};

export type SalaryPayment = {
  id: string;
  staffId: string;
  paymentDate: string;
  amount: number;
  currency: "UGX";
  method: SalaryPaymentMethod;
  reference?: string;
  note?: string;
  status: "paid" | "partial" | "reversed";
  allocations: SalaryPaymentAllocation[];
  idempotencyKey: string;
  recordedBy: { id: string; name: string; role: string };
  createdAt: string;
  reversedAt?: string;
  reversalReason?: string;
  reversedBy?: { id: string; name: string; role: string };
};

export type SalaryAdjustment = {
  id: string;
  staffId: string;
  componentId: string;
  mode: "increase_by" | "set_to";
  previousAmount: number;
  nextAmount: number;
  effectiveDate: string;
  reason: string;
  status: "scheduled" | "applied" | "cancelled";
  createdAt: string;
  createdBy: { id: string; name: string; role: string };
};

export type PayrollDueStatus =
  | { kind: "upcoming"; days: number; label: string }
  | { kind: "today"; days: 0; label: string }
  | { kind: "overdue"; days: number; label: string }
  | { kind: "none"; days: null; label: string };

export type PayrollOverviewRow = SalaryProfile & {
  staffName: string;
  employeeId: string;
  department?: string;
  dueStatus: PayrollDueStatus;
  expectedThisMonth: number;
};
