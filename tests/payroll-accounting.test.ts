import assert from "node:assert/strict";
import test from "node:test";
import { summarizePayrollSpend } from "../src/lib/payroll/payroll-accounting";

test("summarizes recorded salary spending by staff and payment method", () => {
  const result = summarizePayrollSpend(
    [
      {
        id: "pay-1",
        staffId: "staff-a",
        amount: 500_000,
        paymentDate: "2026-08-01",
        method: "bank",
      },
      {
        id: "pay-2",
        staffId: "staff-a",
        amount: 100_000,
        paymentDate: "2026-08-15",
        method: "cash",
      },
      {
        id: "pay-3",
        staffId: "staff-b",
        amount: 300_000,
        paymentDate: "2026-08-12",
        method: "bank",
      },
    ],
    new Map([
      ["staff-a", "Amina N."],
      ["staff-b", "Ben K."],
    ]),
  );

  assert.equal(result.totalAmount, 900_000);
  assert.equal(result.paymentCount, 3);
  assert.equal(result.staffPaidCount, 2);
  assert.deepEqual(result.byStaff[0], {
    staffId: "staff-a",
    staffName: "Amina N.",
    amount: 600_000,
    paymentCount: 2,
    lastPaymentDate: "2026-08-15",
  });
  assert.deepEqual(result.paymentMethods, [
    { method: "bank", amount: 800_000, paymentCount: 2 },
    { method: "cash", amount: 100_000, paymentCount: 1 },
  ]);
});
