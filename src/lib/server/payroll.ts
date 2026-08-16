import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { AuthenticatedAppUser } from "@/lib/server/app-auth";
import { GranularPermissionService } from "@/lib/services/granular-permissions.service";
import {
  buildSalaryOccurrenceKey,
  getExpectedAmountForMonth,
  getNextSalaryDate,
  getPayrollDueStatus,
  getSalaryDatesBetween,
} from "@/lib/payroll/salary-schedule";
import { summarizePayrollSpend } from "@/lib/payroll/payroll-accounting";
import type { SalaryComponent, SalarySchedule } from "@/types/payroll";

export const PAYROLL_COLLECTIONS = {
  profiles: "staffSalaryProfiles",
  components: "staffSalaryComponents",
  payments: "staffSalaryPayments",
  occurrences: "staffSalaryOccurrences",
  adjustments: "staffSalaryAdjustments",
  history: "historyLogs",
  staff: "staff",
} as const;

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid YYYY-MM-DD date.");
export const payrollAccountingRangeSchema = z
  .object({ startDate: dateString, endDate: dateString })
  .superRefine((value, context) => {
    if (value.endDate < value.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
      return;
    }
    const span =
      new Date(`${value.endDate}T12:00:00Z`).getTime() -
      new Date(`${value.startDate}T12:00:00Z`).getTime();
    if (span > 3_660 * 24 * 60 * 60 * 1000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Choose an accounting period of ten years or less.",
      });
    }
  });
const amount = z.coerce
  .number()
  .finite()
  .positive("Amount must be greater than zero.")
  .max(1_000_000_000);
const scheduleSchema = z
  .object({
    unit: z.enum(["once", "day", "week", "month", "year"]),
    interval: z.coerce.number().int().min(1).max(120),
    anchorDate: dateString,
    endDate: dateString.optional(),
    excludedDates: z.array(dateString).max(240).optional().default([]),
    excludedMonths: z
      .array(z.string().regex(/^\d{4}-\d{2}$/))
      .max(120)
      .optional()
      .default([]),
    excludedMonthNumbers: z
      .array(z.coerce.number().int().min(1).max(12))
      .max(12)
      .optional()
      .default([]),
    timezone: z.literal("Africa/Kampala").default("Africa/Kampala"),
  })
  .superRefine((value, context) => {
    if (value.endDate && value.endDate < value.anchorDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the release date.",
      });
    }
  });

const allowanceSchema = z
  .object({
    name: z.enum([
      "Housing",
      "Transport",
      "Medical",
      "Meals",
      "Responsibility",
      "Airtime",
      "Other",
    ]),
    customName: z.string().trim().min(2).max(60).optional(),
    amount,
    schedule: scheduleSchema,
  })
  .superRefine((value, context) => {
    if (value.name === "Other" && !value.customName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customName"],
        message: "Enter a name for the custom allowance.",
      });
    }
  });

export const createSalaryProfileSchema = z.object({
  staffId: z.string().trim().min(1).max(120),
  baseSalary: z.object({ amount, schedule: scheduleSchema }),
  allowances: z.array(allowanceSchema).max(20).default([]),
});

export const recordSalaryPaymentSchema = z.object({
  staffId: z.string().trim().min(1).max(120),
  paymentDate: dateString,
  method: z.enum(["cash", "bank", "mobile_money", "cheque", "other"]),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{12,120}$/),
  allocations: z
    .array(
      z.object({
        componentId: z.string().trim().min(1).max(120),
        scheduledDueDate: dateString,
        expectedAmount: amount,
        paidAmount: amount,
      }),
    )
    .min(1)
    .max(30),
});

export const salaryIncreaseSchema = z.object({
  staffId: z.string().trim().min(1).max(120),
  componentId: z.string().trim().min(1).max(120),
  mode: z.enum(["increase_by", "set_to"]),
  amount,
  effectiveDate: dateString,
  reason: z.string().trim().min(3).max(300),
});

function actorLabel(actor: AuthenticatedAppUser) {
  const name = [actor.user.firstName, actor.user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    id: actor.user.id,
    name: name || actor.user.username || "Unknown user",
    role: actor.user.role,
  };
}

function formatKampalaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function previousDay(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function toJson(value: unknown): any {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        toJson(nested),
      ]),
    );
  }
  return value;
}

/**
 * Firestore rejects undefined values. Optional payroll fields must be absent
 * from a document rather than present with an undefined value.
 */
function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefined(item)) as T;
  }

  if (
    value &&
    typeof value === "object" &&
    !(value instanceof Timestamp) &&
    !(value instanceof Date)
  ) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, omitUndefined(item)]),
    ) as T;
  }

  return value;
}

function readComponent(
  id: string,
  data: Record<string, unknown>,
): SalaryComponent {
  return { id, ...toJson(data) } as SalaryComponent;
}

function currentComponent(component: SalaryComponent, today: string) {
  return (
    component.status !== "ended" &&
    component.effectiveFrom <= today &&
    (!component.effectiveTo || component.effectiveTo >= today)
  );
}

function nextComponentDueDate(components: SalaryComponent[], today: string) {
  const candidates = components
    .filter((component) => currentComponent(component, today))
    .map((component) => getNextSalaryDate(component.schedule, today, true))
    .filter((date): date is string => Boolean(date));
  return candidates.sort()[0];
}

function currentProfileValues(
  profile: Record<string, any>,
  components: SalaryComponent[],
  today: string,
) {
  const active = components.filter((component) =>
    currentComponent(component, today),
  );
  const base = active.find((component) => component.type === "base_salary");
  return {
    ...profile,
    ...(base
      ? {
          currentBaseAmount: base.amount,
          currentBaseFrequency: base.schedule.unit,
        }
      : {}),
    activeAllowanceCount: active.filter(
      (component) => component.type === "allowance",
    ).length,
  };
}

function auditPayload(
  action: "create" | "update" | "revert",
  entity: string,
  recordId: string,
  label: string,
  actor: ReturnType<typeof actorLabel>,
  meta: Record<string, string | number | boolean>,
) {
  return {
    a: action,
    e: entity,
    rid: recordId,
    rl: label.slice(0, 80),
    uid: actor.id,
    un: actor.name.slice(0, 40),
    ur: actor.role,
    m: { ...meta, module: "payroll", sensitive: true, outcome: "success" },
    ts: Timestamp.now(),
  };
}

export function requirePayrollAccess(
  actor: AuthenticatedAppUser,
  page: "overview" | "setup" | "detail",
  action?: string,
) {
  const canAccess = GranularPermissionService.canAccessPage(
    actor.user,
    "payroll",
    page,
  );
  const canAct =
    !action ||
    GranularPermissionService.canPerformAction(
      actor.user,
      "payroll",
      page,
      action,
    );
  if (!canAccess || !canAct) throw new Error("PERMISSION_DENIED");
}

export async function createSalaryProfile(
  db: Firestore,
  actor: AuthenticatedAppUser,
  input: z.infer<typeof createSalaryProfileSchema>,
) {
  const payload = createSalaryProfileSchema.parse(input);
  const actorData = actorLabel(actor);
  const now = new Date().toISOString();
  const profileRef = db
    .collection(PAYROLL_COLLECTIONS.profiles)
    .doc(payload.staffId);
  const staffRef = db
    .collection(PAYROLL_COLLECTIONS.staff)
    .doc(payload.staffId);
  const components = [
    {
      type: "base_salary" as const,
      name: "Base salary",
      amount: payload.baseSalary.amount,
      schedule: payload.baseSalary.schedule,
    },
    ...payload.allowances.map((allowance) => ({
      type: "allowance" as const,
      name: allowance.name === "Other" ? allowance.customName! : allowance.name,
      allowanceName: allowance.name,
      customName: allowance.name === "Other" ? allowance.customName : undefined,
      amount: allowance.amount,
      schedule: allowance.schedule,
    })),
  ];

  await db.runTransaction(async (transaction) => {
    const [existing, staff] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(staffRef),
    ]);
    if (
      existing.exists &&
      ["active", "paused"].includes(String(existing.data()?.status))
    ) {
      throw new Error(
        "A payroll profile already exists for this staff member.",
      );
    }
    if (!staff.exists)
      throw new Error("The selected staff member no longer exists.");

    const componentRecords = components.map((component) => {
      const ref = db.collection(PAYROLL_COLLECTIONS.components).doc();
      return { ref, component };
    });
    const componentValues = componentRecords.map(({ ref, component }) => ({
      id: ref.id,
      staffId: payload.staffId,
      type: component.type,
      name: component.name,
      allowanceName:
        "allowanceName" in component ? component.allowanceName : undefined,
      customName: "customName" in component ? component.customName : undefined,
      amount: component.amount,
      currency: "UGX",
      schedule: component.schedule,
      effectiveFrom: component.schedule.anchorDate,
      status:
        component.schedule.anchorDate > formatKampalaDate()
          ? "scheduled"
          : "active",
      versionGroupId: ref.id,
      createdAt: now,
      createdBy: actorData.id,
    }));
    const nextDueDate = nextComponentDueDate(
      componentValues as SalaryComponent[],
      formatKampalaDate(),
    );
    transaction.set(profileRef, {
      id: payload.staffId,
      staffId: payload.staffId,
      status: "active",
      currency: "UGX",
      currentBaseAmount: payload.baseSalary.amount,
      currentBaseFrequency: payload.baseSalary.schedule.unit,
      activeAllowanceCount: payload.allowances.length,
      nextDueDate: nextDueDate || null,
      createdAt: now,
      createdBy: actorData.id,
      updatedAt: now,
    });
    componentRecords.forEach(({ ref }, index) =>
      transaction.set(ref, omitUndefined(componentValues[index])),
    );
    transaction.set(
      db.collection(PAYROLL_COLLECTIONS.history).doc(),
      auditPayload(
        "create",
        "payroll_profile",
        payload.staffId,
        "Staff payroll profile created",
        actorData,
        {
          componentCount: componentValues.length,
          baseAmount: payload.baseSalary.amount,
        },
      ),
    );
  });

  return getStaffPayroll(db, payload.staffId);
}

export async function getPayrollOverview(db: Firestore) {
  const today = formatKampalaDate();
  const yearMonth = today.slice(0, 7);
  const [profilesSnapshot, componentsSnapshot, staffSnapshot] =
    await Promise.all([
      db
        .collection(PAYROLL_COLLECTIONS.profiles)
        .orderBy("updatedAt", "desc")
        .get(),
      db.collection(PAYROLL_COLLECTIONS.components).get(),
      db.collection(PAYROLL_COLLECTIONS.staff).get(),
    ]);
  const staffById = new Map(
    staffSnapshot.docs.map((item) => [item.id, item.data()]),
  );
  const componentsByStaff = new Map<string, SalaryComponent[]>();
  componentsSnapshot.docs.forEach((item) => {
    const component = readComponent(item.id, item.data());
    componentsByStaff.set(component.staffId, [
      ...(componentsByStaff.get(component.staffId) || []),
      component,
    ]);
  });

  const rows = profilesSnapshot.docs.map((item) => {
    const profile = toJson({ id: item.id, ...item.data() });
    const staff = staffById.get(String(profile.staffId)) || {};
    const components = componentsByStaff.get(String(profile.staffId)) || [];
    const nextDueDate = nextComponentDueDate(components, today);
    return {
      ...currentProfileValues(profile, components, today),
      staffName:
        `${String(staff.firstName || "")} ${String(staff.lastName || "")}`.trim() ||
        "Unknown staff member",
      employeeId: String(staff.employeeId || "—"),
      department: Array.isArray(staff.department)
        ? staff.department.join(", ")
        : String(staff.department || ""),
      nextDueDate: nextDueDate || null,
      dueStatus: getPayrollDueStatus(nextDueDate, today),
      expectedThisMonth: getExpectedAmountForMonth(
        components.filter((component) => currentComponent(component, today)),
        yearMonth,
      ),
    };
  });
  return { today, rows };
}

export async function getPayrollAccounting(
  db: Firestore,
  input: z.infer<typeof payrollAccountingRangeSchema>,
) {
  const range = payrollAccountingRangeSchema.parse(input);
  const paymentsSnapshot = await db
    .collection(PAYROLL_COLLECTIONS.payments)
    .where("paymentDate", ">=", range.startDate)
    .where("paymentDate", "<=", range.endDate)
    .orderBy("paymentDate", "desc")
    .get();
  const staffRefs = [
    ...new Set(
      paymentsSnapshot.docs
        .map((item) => String(item.data().staffId || ""))
        .filter(Boolean),
    ),
  ].map((staffId) => db.collection(PAYROLL_COLLECTIONS.staff).doc(staffId));
  const staffSnapshot = staffRefs.length ? await db.getAll(...staffRefs) : [];
  const staffNames = new Map(
    staffSnapshot.map((item) => {
      const staff = item.data() || {};
      const name =
        `${String(staff.firstName || "")} ${String(staff.lastName || "")}`.trim();
      return [item.id, name || "Unknown staff member"];
    }),
  );
  const payments = paymentsSnapshot.docs.map((item) => {
    const payment = item.data();
    return {
      id: item.id,
      staffId: String(payment.staffId || ""),
      amount: Number(payment.amount || 0),
      paymentDate: String(payment.paymentDate || ""),
      method: String(payment.method || "other"),
    };
  });

  return {
    range,
    ...summarizePayrollSpend(payments, staffNames),
  };
}

export async function getStaffPayroll(db: Firestore, staffId: string) {
  const [
    profileSnapshot,
    componentsSnapshot,
    paymentsSnapshot,
    adjustmentsSnapshot,
  ] = await Promise.all([
    db.collection(PAYROLL_COLLECTIONS.profiles).doc(staffId).get(),
    db
      .collection(PAYROLL_COLLECTIONS.components)
      .where("staffId", "==", staffId)
      .orderBy("effectiveFrom", "desc")
      .get(),
    db
      .collection(PAYROLL_COLLECTIONS.payments)
      .where("staffId", "==", staffId)
      .orderBy("paymentDate", "desc")
      .limit(100)
      .get(),
    db
      .collection(PAYROLL_COLLECTIONS.adjustments)
      .where("staffId", "==", staffId)
      .orderBy("effectiveDate", "desc")
      .limit(100)
      .get(),
  ]);
  if (!profileSnapshot.exists) return null;
  const today = formatKampalaDate();
  const components = componentsSnapshot.docs.map((item) =>
    readComponent(item.id, item.data()),
  );
  const profile = currentProfileValues(
    toJson({ id: profileSnapshot.id, ...profileSnapshot.data() }),
    components,
    today,
  );
  return {
    today,
    profile,
    components,
    nextDueDate: nextComponentDueDate(components, today),
    payments: paymentsSnapshot.docs.map((item) =>
      toJson({ id: item.id, ...item.data() }),
    ),
    adjustments: adjustmentsSnapshot.docs.map((item) =>
      toJson({ id: item.id, ...item.data() }),
    ),
  };
}

export async function recordSalaryPayment(
  db: Firestore,
  actor: AuthenticatedAppUser,
  input: z.infer<typeof recordSalaryPaymentSchema>,
) {
  const payload = recordSalaryPaymentSchema.parse(input);
  const actorData = actorLabel(actor);
  const paymentRef = db
    .collection(PAYROLL_COLLECTIONS.payments)
    .doc(payload.idempotencyKey);
  const profileRef = db
    .collection(PAYROLL_COLLECTIONS.profiles)
    .doc(payload.staffId);
  const componentRefs = payload.allocations.map((allocation) =>
    db.collection(PAYROLL_COLLECTIONS.components).doc(allocation.componentId),
  );
  const now = new Date().toISOString();
  const total = payload.allocations.reduce(
    (sum, allocation) => sum + allocation.paidAmount,
    0,
  );

  await db.runTransaction(async (transaction) => {
    const [profile, existingPayment, ...componentSnapshots] = await Promise.all(
      [
        transaction.get(profileRef),
        transaction.get(paymentRef),
        ...componentRefs.map((reference) => transaction.get(reference)),
      ],
    );
    if (!profile.exists || profile.data()?.status !== "active")
      throw new Error(
        "This staff member does not have an active payroll profile.",
      );
    if (existingPayment.exists) return;

    payload.allocations.forEach((allocation, index) => {
      const component = componentSnapshots[index];
      if (!component.exists || component.data()?.staffId !== payload.staffId) {
        throw new Error(
          "A selected salary component does not belong to this staff member.",
        );
      }
      const componentData = readComponent(component.id, component.data()!);
      const isScheduledDate = getSalaryDatesBetween(
        componentData.schedule,
        allocation.scheduledDueDate,
        allocation.scheduledDueDate,
        1,
      ).includes(allocation.scheduledDueDate);
      const isInEffectiveRange =
        componentData.effectiveFrom <= allocation.scheduledDueDate &&
        (!componentData.effectiveTo ||
          componentData.effectiveTo >= allocation.scheduledDueDate);
      if (!isScheduledDate || !isInEffectiveRange) {
        throw new Error(
          "A selected salary item is not due on the specified release date.",
        );
      }
      if (allocation.expectedAmount !== componentData.amount) {
        throw new Error(
          "The expected salary amount does not match the active salary component.",
        );
      }
    });

    const occurrenceRefs = payload.allocations.map((allocation) => {
      const occurrenceKey = buildSalaryOccurrenceKey(
        payload.staffId,
        allocation.componentId,
        allocation.scheduledDueDate,
      );
      return {
        occurrenceKey,
        ref: db.collection(PAYROLL_COLLECTIONS.occurrences).doc(occurrenceKey),
      };
    });
    // Firestore transactions require every read to finish before the first
    // write. Read all occurrence balances before recording allocations.
    const occurrenceSnapshots = await Promise.all(
      occurrenceRefs.map((item) => transaction.get(item.ref)),
    );
    const allocations = [] as Array<Record<string, unknown>>;
    for (const [index, allocation] of payload.allocations.entries()) {
      const occurrenceKey = occurrenceRefs[index].occurrenceKey;
      const occurrenceRef = occurrenceRefs[index].ref;
      const existingOccurrence = occurrenceSnapshots[index];
      const alreadyPaid = Number(existingOccurrence.data()?.paidAmount || 0);
      if (alreadyPaid + allocation.paidAmount > allocation.expectedAmount) {
        throw new Error(
          "The payment amount exceeds the outstanding amount for one of the selected salary items.",
        );
      }
      const component = componentSnapshots[index].data()!;
      const paidAmount = alreadyPaid + allocation.paidAmount;
      transaction.set(
        occurrenceRef,
        {
          id: occurrenceKey,
          staffId: payload.staffId,
          componentId: allocation.componentId,
          scheduledDueDate: allocation.scheduledDueDate,
          expectedAmount: allocation.expectedAmount,
          paidAmount,
          status: paidAmount === allocation.expectedAmount ? "paid" : "partial",
          updatedAt: now,
          ...(existingOccurrence.exists
            ? {}
            : { createdAt: now, componentName: component.name }),
        },
        { merge: true },
      );
      allocations.push({
        ...allocation,
        occurrenceKey,
        componentName: component.name,
      });
    }

    const paymentStatus = payload.allocations.some(
      (allocation) => allocation.paidAmount < allocation.expectedAmount,
    )
      ? "partial"
      : "paid";
    transaction.set(paymentRef, {
      id: paymentRef.id,
      staffId: payload.staffId,
      paymentDate: payload.paymentDate,
      amount: total,
      currency: "UGX",
      method: payload.method,
      reference: payload.reference || null,
      note: payload.note || null,
      status: paymentStatus,
      allocations,
      idempotencyKey: payload.idempotencyKey,
      recordedBy: actorData,
      createdAt: now,
    });
    transaction.update(profileRef, {
      lastPaymentDate: payload.paymentDate,
      lastPaymentAmount: total,
      updatedAt: now,
    });
    transaction.set(
      db.collection(PAYROLL_COLLECTIONS.history).doc(),
      auditPayload(
        "create",
        "salary_payment",
        paymentRef.id,
        "Staff salary payment recorded",
        actorData,
        {
          staffId: payload.staffId,
          amount: total,
          allocationCount: allocations.length,
        },
      ),
    );
  });

  return getStaffPayroll(db, payload.staffId);
}

export async function scheduleSalaryIncrease(
  db: Firestore,
  actor: AuthenticatedAppUser,
  input: z.infer<typeof salaryIncreaseSchema>,
) {
  const payload = salaryIncreaseSchema.parse(input);
  const actorData = actorLabel(actor);
  const componentRef = db
    .collection(PAYROLL_COLLECTIONS.components)
    .doc(payload.componentId);
  const adjustmentRef = db.collection(PAYROLL_COLLECTIONS.adjustments).doc();
  const now = new Date().toISOString();

  await db.runTransaction(async (transaction) => {
    const componentSnapshot = await transaction.get(componentRef);
    if (
      !componentSnapshot.exists ||
      componentSnapshot.data()?.staffId !== payload.staffId ||
      componentSnapshot.data()?.type !== "base_salary"
    ) {
      throw new Error("The selected base salary could not be found.");
    }
    const component = readComponent(componentRef.id, componentSnapshot.data()!);
    if (
      component.effectiveTo &&
      component.effectiveTo < payload.effectiveDate
    ) {
      throw new Error(
        "This salary version has already ended. Choose the current salary version.",
      );
    }
    if (payload.effectiveDate < component.effectiveFrom) {
      throw new Error(
        "The increase cannot start before the current salary version begins.",
      );
    }
    const nextAmount =
      payload.mode === "increase_by"
        ? component.amount + payload.amount
        : payload.amount;
    if (nextAmount <= component.amount && payload.mode === "set_to") {
      throw new Error(
        "Set a higher salary amount or use the schedule editor for a decrease.",
      );
    }
    const nextComponentRef = db
      .collection(PAYROLL_COLLECTIONS.components)
      .doc();
    transaction.update(componentRef, {
      effectiveTo: previousDay(payload.effectiveDate),
      updatedAt: now,
    });
    transaction.set(nextComponentRef, {
      ...component,
      id: nextComponentRef.id,
      amount: nextAmount,
      effectiveFrom: payload.effectiveDate,
      effectiveTo: null,
      status:
        payload.effectiveDate > formatKampalaDate() ? "scheduled" : "active",
      versionGroupId: component.versionGroupId,
      createdAt: now,
      createdBy: actorData.id,
      updatedAt: now,
    });
    transaction.set(adjustmentRef, {
      id: adjustmentRef.id,
      staffId: payload.staffId,
      componentId: componentRef.id,
      mode: payload.mode,
      previousAmount: component.amount,
      nextAmount,
      effectiveDate: payload.effectiveDate,
      reason: payload.reason,
      status:
        payload.effectiveDate > formatKampalaDate() ? "scheduled" : "applied",
      createdAt: now,
      createdBy: actorData,
    });
    transaction.update(
      db.collection(PAYROLL_COLLECTIONS.profiles).doc(payload.staffId),
      {
        currentBaseAmount:
          payload.effectiveDate <= formatKampalaDate()
            ? nextAmount
            : component.amount,
        updatedAt: now,
      },
    );
    transaction.set(
      db.collection(PAYROLL_COLLECTIONS.history).doc(),
      auditPayload(
        "update",
        "salary_adjustment",
        adjustmentRef.id,
        "Staff salary increase scheduled",
        actorData,
        {
          staffId: payload.staffId,
          previousAmount: component.amount,
          nextAmount,
        },
      ),
    );
  });

  return getStaffPayroll(db, payload.staffId);
}
