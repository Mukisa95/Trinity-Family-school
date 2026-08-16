export type PayrollAccountingPayment = {
  id: string;
  staffId: string;
  amount: number;
  paymentDate: string;
  method?: string;
};

export type PayrollSpendSummary = {
  totalAmount: number;
  paymentCount: number;
  staffPaidCount: number;
  paymentMethods: Array<{
    method: string;
    amount: number;
    paymentCount: number;
  }>;
  byStaff: Array<{
    staffId: string;
    staffName: string;
    amount: number;
    paymentCount: number;
    lastPaymentDate: string;
  }>;
};

export function summarizePayrollSpend(
  payments: PayrollAccountingPayment[],
  staffNames = new Map<string, string>(),
): PayrollSpendSummary {
  const byStaff = new Map<
    string,
    {
      staffId: string;
      staffName: string;
      amount: number;
      paymentCount: number;
      lastPaymentDate: string;
    }
  >();
  const byMethod = new Map<string, { amount: number; paymentCount: number }>();
  let totalAmount = 0;

  payments.forEach((payment) => {
    const amount = Number(payment.amount) || 0;
    const method = payment.method || "other";
    totalAmount += amount;

    const staff = byStaff.get(payment.staffId) || {
      staffId: payment.staffId,
      staffName: staffNames.get(payment.staffId) || "Unknown staff member",
      amount: 0,
      paymentCount: 0,
      lastPaymentDate: payment.paymentDate,
    };
    staff.amount += amount;
    staff.paymentCount += 1;
    if (payment.paymentDate > staff.lastPaymentDate) {
      staff.lastPaymentDate = payment.paymentDate;
    }
    byStaff.set(payment.staffId, staff);

    const paymentMethod = byMethod.get(method) || {
      amount: 0,
      paymentCount: 0,
    };
    paymentMethod.amount += amount;
    paymentMethod.paymentCount += 1;
    byMethod.set(method, paymentMethod);
  });

  return {
    totalAmount,
    paymentCount: payments.length,
    staffPaidCount: byStaff.size,
    paymentMethods: [...byMethod.entries()]
      .map(([method, values]) => ({ method, ...values }))
      .sort((left, right) => right.amount - left.amount),
    byStaff: [...byStaff.values()].sort(
      (left, right) => right.amount - left.amount,
    ),
  };
}
