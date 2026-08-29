type AcademicYearSchedule = Record<string, unknown> & {
  terms?: unknown;
};

function dateValue(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return '';
}

/**
 * Find the academic year whose term actually contains the supplied school date.
 * An academic year being marked active is not enough: recess dates normally sit
 * inside the year boundaries but outside every term.
 */
export function findAcademicYearForTermDate<T extends AcademicYearSchedule>(
  years: T[],
  date: string,
): T | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  return years.find(year => {
    if (!Array.isArray(year.terms)) return false;
    return year.terms.some(term => {
      if (!term || typeof term !== 'object') return false;
      const termRecord = term as Record<string, unknown>;
      const startDate = dateValue(termRecord.startDate);
      const endDate = dateValue(termRecord.endDate);
      return Boolean(startDate && endDate && date >= startDate && date <= endDate);
    });
  }) || null;
}
