import type {
  AcademicYear,
  ProcurementCategory,
  ProcurementPurchase,
  ProcurementSummary,
  Term,
  ViewPeriodType,
} from '@/types';

export interface ProcurementPeriodSelection {
  academicYear?: AcademicYear;
  termId?: string;
  month?: number;
  week?: number;
  viewPeriod: ViewPeriodType;
}

/**
 * Resolves the period selected in a purchase form. This must use the form's
 * ids, rather than the Procurement page's current reporting period: staff may
 * legitimately record a future-term purchase while viewing the current term.
 */
export const resolveProcurementPurchasePeriod = (
  academicYears: AcademicYear[],
  academicYearId: string,
  termId: string,
): { academicYear: AcademicYear; term: Term } | null => {
  const academicYear = academicYears.find((candidate) => candidate.id === academicYearId);
  const term = academicYear?.terms.find((candidate) => candidate.id === termId);
  return academicYear && term ? { academicYear, term } : null;
};

const getCalendarWeek = (date: Date): number => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const daysSinceStartOfYear = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );

  return Math.ceil((daysSinceStartOfYear + startOfYear.getDay() + 1) / 7);
};

const isPurchaseInAcademicYear = (purchase: ProcurementPurchase, academicYear: AcademicYear) =>
  purchase.academicYearId === academicYear.id ||
  purchase.academicYearName === academicYear.name;

const isPurchaseInTerm = (purchase: ProcurementPurchase, term?: Term) => {
  if (!term) return false;

  return purchase.termId === term.id || purchase.termName === term.name;
};

/**
 * Filters an already loaded procurement list. It deliberately does not mutate
 * the source list: child screens must never turn a period view into the cache.
 */
export const selectPurchasesForPeriod = (
  purchases: ProcurementPurchase[],
  selection: ProcurementPeriodSelection
): ProcurementPurchase[] => {
  const { academicYear, termId, month, week, viewPeriod } = selection;
  if (!academicYear) return [];

  const term = academicYear.terms.find((candidate) => candidate.id === termId);

  return purchases.filter((purchase) => {
    if (!isPurchaseInAcademicYear(purchase, academicYear)) return false;

    if (viewPeriod === 'Year') return true;
    if (viewPeriod === 'Term') return isPurchaseInTerm(purchase, term);

    const purchaseDate = new Date(`${purchase.purchaseDate}T00:00:00`);
    if (Number.isNaN(purchaseDate.getTime())) return false;

    if (viewPeriod === 'Month') return purchaseDate.getMonth() + 1 === month;
    if (viewPeriod === 'Week') return getCalendarWeek(purchaseDate) === week;

    return false;
  });
};

/** Builds the on-screen summary from the page-owned list without another read. */
export const buildProcurementSummary = (
  purchases: ProcurementPurchase[]
): ProcurementSummary => {
  const categorySummary: Record<string, {
    itemCount: number;
    purchaseCount: number;
    totalSpent: number;
    averagePrice: number;
  }> = {};
  const itemTotals = new Map<string, { itemName: string; totalSpent: number; purchaseCount: number }>();
  const supplierSummary: Record<string, { purchaseCount: number; totalSpent: number }> = {};

  for (const purchase of purchases) {
    const category = purchase.itemCategory || 'Other';
    const totalCost = purchase.totalCost || 0;
    const categoryEntry = categorySummary[category] || {
      itemCount: 0,
      purchaseCount: 0,
      totalSpent: 0,
      averagePrice: 0,
    };

    categoryEntry.purchaseCount += 1;
    categoryEntry.totalSpent += totalCost;
    categorySummary[category] = categoryEntry;

    const itemEntry = itemTotals.get(purchase.itemId) || {
      itemName: purchase.itemName || 'Unknown item',
      totalSpent: 0,
      purchaseCount: 0,
    };
    itemEntry.totalSpent += totalCost;
    itemEntry.purchaseCount += 1;
    itemTotals.set(purchase.itemId, itemEntry);

    if (purchase.supplierName) {
      const supplierEntry = supplierSummary[purchase.supplierName] || { purchaseCount: 0, totalSpent: 0 };
      supplierEntry.purchaseCount += 1;
      supplierEntry.totalSpent += totalCost;
      supplierSummary[purchase.supplierName] = supplierEntry;
    }
  }

  for (const category of Object.values(categorySummary)) {
    category.averagePrice = category.purchaseCount > 0 ? category.totalSpent / category.purchaseCount : 0;
  }

  for (const [category, itemIds] of Object.entries(
    purchases.reduce<Record<string, Set<string>>>((result, purchase) => {
      const key = purchase.itemCategory || 'Other';
      (result[key] ||= new Set()).add(purchase.itemId);
      return result;
    }, {})
  )) {
    if (categorySummary[category]) categorySummary[category].itemCount = itemIds.size;
  }

  return {
    totalItems: itemTotals.size,
    totalPurchases: purchases.length,
    totalAmountSpent: purchases.reduce((total, purchase) => total + (purchase.totalCost || 0), 0),
    categorySummary: categorySummary as ProcurementSummary['categorySummary'],
    topExpenseItems: [...itemTotals.entries()]
      .map(([itemId, item]) => ({ itemId, ...item }))
      .sort((left, right) => right.totalSpent - left.totalSpent),
    supplierSummary,
  };
};
