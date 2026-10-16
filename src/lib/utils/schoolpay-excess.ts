import type { AcademicYear, PaymentRecord } from '@/types';
import { schoolPayTermSlots } from './schoolpay-allocation';

export type SchoolPayLedgerPayment = PaymentRecord & {
  source?: string;
  schoolPayReceiptNumber?: string;
  schoolPayOriginTermId?: string;
  schoolPayOriginYearId?: string;
  schoolPayOriginalPupilId?: string;
  schoolPayReceivedAmount?: number;
  schoolPayTransferredAmount?: number;
};

export function schoolPayReceiptSummary(payments: SchoolPayLedgerPayment[], years: AcademicYear[]) {
  const active = payments.filter(payment => !payment.reverted);
  const slots = schoolPayTermSlots(years);
  const explicit = active.find(payment => payment.schoolPayOriginTermId);
  const paymentDate = new Date(active[0]?.paymentDate || '').getTime();
  const origin = (explicit && slots.find(slot => slot.term.id === explicit.schoolPayOriginTermId
    && (!explicit.schoolPayOriginYearId || slot.year.id === explicit.schoolPayOriginYearId)))
    || [...slots].reverse().find(slot => new Date(slot.term.startDate).getTime() <= paymentDate);
  if (!origin) return null;
  const originStart = new Date(origin.term.startDate).getTime();
  const future = active.filter(payment => {
    const slot = slots.find(item => item.term.id === payment.termId && item.year.id === payment.academicYearId);
    return slot && new Date(slot.term.startDate).getTime() > originStart;
  });
  const advance = active.filter(payment => payment.feeStructureId === 'schoolpay-general'
    && payment.termId === origin.term.id && payment.academicYearId === origin.year.id);
  const futureAmount = future.reduce((sum, payment) => sum + payment.amount, 0);
  const advanceAmount = advance.reduce((sum, payment) => sum + payment.amount, 0);
  const retainedAmount = active.reduce((sum, payment) => sum + payment.amount, 0);
  const transferredAmount = Math.max(0, ...active.map(payment => payment.schoolPayTransferredAmount || 0));
  const receivedAmount = Math.max(retainedAmount + transferredAmount, ...active.map(payment => payment.schoolPayReceivedAmount || 0));
  const futureTerms = slots.filter(slot => future.some(payment => payment.termId === slot.term.id && payment.academicYearId === slot.year.id))
    .map(slot => `${slot.term.name} ${slot.year.name}`);
  return { origin, receivedAmount, retainedAmount, transferredAmount, futureAmount, advanceAmount,
    excessAmount: futureAmount + advanceAmount, appliedThroughOrigin: retainedAmount - futureAmount - advanceAmount,
    futureTerms, excessPayments: [...future, ...advance] };
}

export interface SchoolPaySiblingBalance {
  pupilId: string;
  name: string;
  previousBalance: number;
  termBalance: number;
  balance: number;
}

export interface SchoolPayExcessPreview {
  version: string;
  pupilName: string;
  receivedAmount: number;
  excessAmount: number;
  futureAmount: number;
  futureTerms: string[];
  siblings: SchoolPaySiblingBalance[];
  canTransfer: boolean;
}

/** Divide limited funds fairly, then let each sibling clear their oldest fees first. */
export function schoolPaySiblingShares(excess: number, siblings: SchoolPaySiblingBalance[]) {
  const caps = siblings.map(sibling => Math.max(0, Math.floor(sibling.balance)));
  const totalDue = caps.reduce((sum, amount) => sum + amount, 0);
  const transferTotal = Math.max(0, Math.min(Math.floor(excess), totalDue));
  const shares = siblings.map((sibling, index) => ({ pupilId: sibling.pupilId,
    amount: totalDue > 0 ? Math.floor(transferTotal * caps[index] / totalDue) : 0 }));
  let remainder = transferTotal - shares.reduce((sum, share) => sum + share.amount, 0);
  for (let i = 0; remainder > 0 && i < shares.length; i++) {
    if (shares[i].amount < caps[i]) { shares[i].amount++; remainder--; }
  }
  return shares;
}
