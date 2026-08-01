export interface ExistingSchoolPayPaymentCandidate {
  id: string;
  pupilId?: string;
  amount: number;
}

export interface ExistingLocalPaymentMatch {
  pupilId?: string;
  localPaymentIds: string[];
  totalAmount: number;
  conflict?: string;
}

export function assessExistingSchoolPayPayments(
  receiptNumber: string,
  providerAmount: number,
  candidates: ExistingSchoolPayPaymentCandidate[],
): ExistingLocalPaymentMatch | null {
  if (candidates.length === 0) return null;

  const pupilIds = new Set(candidates.map(item => `${item.pupilId || ''}`.trim()).filter(Boolean));
  const localPaymentIds = candidates.map(item => item.id);
  const totalAmount = candidates.reduce((sum, item) => sum + item.amount, 0);

  if (pupilIds.size !== 1) {
    return {
      localPaymentIds,
      totalAmount,
      conflict: `Receipt ${receiptNumber} matches local payments assigned to ${pupilIds.size} pupils; automatic replay was stopped for review.`,
    };
  }

  const pupilId = Array.from(pupilIds)[0];
  if (Math.abs(totalAmount - providerAmount) > 0.01) {
    return {
      pupilId,
      localPaymentIds,
      totalAmount,
      conflict: `Receipt ${receiptNumber} already matches local payments totalling ${totalAmount}, but SchoolPay reports ${providerAmount}; automatic replay was stopped to prevent a duplicate or incorrect balance.`,
    };
  }

  return { pupilId, localPaymentIds, totalAmount };
}
