import type { PupilFeesInfo } from '@/lib/hooks/use-progressive-fees';

/** Sum the amounts displayed for the current rows, including a selected fee item. */
export function calculateFeesCollectionTotals(
  pupils: ReadonlyArray<{ id: string }>,
  pupilFeesInfo: Readonly<Record<string, PupilFeesInfo | undefined>>,
  selectedFeeId = '',
) {
  const totals = { totalFees: 0, totalPaid: 0, balance: 0 };

  for (const pupil of pupils) {
    const feesInfo = pupilFeesInfo[pupil.id];
    if (!feesInfo) continue;

    if (selectedFeeId) {
      const fee = feesInfo.applicableFees.find(item => item.feeStructureId === selectedFeeId);
      if (!fee) continue;
      totals.totalFees += fee.amount;
      totals.totalPaid += fee.paid;
      totals.balance += fee.balance;
    } else {
      totals.totalFees += feesInfo.totalFees;
      totals.totalPaid += feesInfo.totalPaid;
      totals.balance += feesInfo.balance;
    }
  }

  return totals;
}
