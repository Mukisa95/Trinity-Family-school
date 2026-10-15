import type { AcademicYear, FeesHoliday, FeesHolidayDraft, FeesHolidayPhase, FeesHolidayTermSnapshot } from '@/types';

const schoolDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' });

/** School calendar dates use Africa/Nairobi; a term ends after its final day. */
export function schoolDate(now = new Date()): string {
  return schoolDateFormatter.format(now);
}

export function holidayTerms(years: AcademicYear[], now = new Date()) {
  const today = schoolDate(now);
  return years.flatMap(year => year.terms.map(term => ({
    academicYearId: year.id, termId: term.id, label: `${year.name} · ${term.name}`,
    startDate: term.startDate.slice(0, 10), endDate: term.endDate.slice(0, 10),
    ended: term.endDate.slice(0, 10) < today,
  }))).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function currentHolidayTerm(years: AcademicYear[], now = new Date()) {
  const today = schoolDate(now);
  const terms = holidayTerms(years, now);
  return terms.find(term => term.startDate <= today && term.endDate >= today)
    ?? terms.find(term => !term.ended);
}

export function holidayCategories(holiday: Pick<FeesHoliday, 'categories'>): FeesHoliday['categories'] {
  const legacy = (holiday as { category?: FeesHoliday['categories'][number] }).category;
  return Array.isArray(holiday.categories) ? holiday.categories : legacy ? [legacy] : ['required'];
}

/** Resolve the selected fee term, including stopped holidays with preserved history. */
export function resolveFeesHoliday(holiday: FeesHoliday, academicYearId: string, termId: string, years: AcademicYear[]): FeesHoliday {
  const saved = holiday.termHistory?.find(item => item.academicYearId === academicYearId && item.termId === termId);
  if (saved) return { ...holiday, ...saved };
  if (!holiday.schedule) return { ...holiday, categories: holidayCategories(holiday) };
  const findTerm = (yearId: string, id: string) => years.find(year => year.id === yearId)?.terms.find(term => term.id === id);
  const target = findTerm(academicYearId, termId);
  if (!target) return { ...holiday, isActive: false };
  const phases = holiday.schedule.map(phase => ({
    phase, term: findTerm(phase.academicYearId, phase.termId) ?? (phase.startDate ? { startDate: phase.startDate } : undefined),
  })).filter(item => item.term && item.term.startDate <= target.startDate)
    .sort((a, b) => a.term!.startDate.localeCompare(b.term!.startDate));
  const phase = phases.at(-1)?.phase;
  if (!phase || phase.discountType === 'off') return { ...holiday, isActive: false };
  return { ...holiday, categories: holidayCategories(holiday), discountType: phase.discountType,
    discountValue: phase.discountValue, isActive: holiday.isActive };
}

export function feesHolidayLabel(holiday: Pick<FeesHoliday, 'isActive' | 'discountType' | 'discountValue'>): string {
  if (!holiday.isActive) return 'Off';
  return holiday.discountType === 'full' ? 'Full (100%)' : holiday.discountType === 'half' ? 'Half (50%)'
    : holiday.discountType === 'quarter' ? 'Quarter (25%)' : `${holiday.discountValue ?? 0}%`;
}

export function initialFeesHolidayDraft(years: AcademicYear[], existing?: FeesHoliday | null): FeesHolidayDraft {
  const first = currentHolidayTerm(years);
  return { categories: existing ? holidayCategories(existing) : ['required'],
    discountType: existing?.discountType ?? 'full', discountValue: existing?.discountValue,
    isActive: existing?.isActive ?? true,
    schedule: existing?.schedule?.map(phase => ({ ...phase })) ?? (first ? [{ academicYearId: first.academicYearId, termId: first.termId, discountType: existing?.discountType ?? 'full', ...(existing?.discountValue !== undefined ? { discountValue: existing.discountValue } : {}) }] : []),
  };
}

/** Validate calendar references and capture effective ended-term values before writing. */
export function prepareFeesHolidayWrite(
  existing: FeesHoliday | null, changes: Partial<FeesHoliday>, years: AcademicYear[], now = new Date(),
): Omit<FeesHoliday, 'id'> {
  if (!years.length) throw new Error('Academic years must be loaded before changing privileges.');
  if (existing && changes.pupilId && changes.pupilId !== existing.pupilId) throw new Error('A privilege cannot be moved to another pupil.');
  const next = { ...existing, ...changes } as FeesHoliday;
  const terms = holidayTerms(years, now);
  if (!next.categories?.length || next.categories.some(category => !['required', 'non-required'].includes(category))) throw new Error('Select at least one valid fee category.');
  const validateDiscount = (type: string, value?: number) => {
    if (!['full', 'half', 'quarter', 'percentage', 'off'].includes(type)) throw new Error('Choose a valid privilege.');
    if (type === 'percentage' && (value === undefined || !Number.isFinite(value) || value < 0 || value > 100)) throw new Error('Percentage must be between 0 and 100.');
  };
  validateDiscount(next.discountType, next.discountValue);
  if (next.schedule) {
    if (!next.schedule.length) throw new Error('Add at least one term to the privilege schedule.');
    const seen = new Set<string>();
    next.schedule = next.schedule.map(phase => {
      const term = terms.find(term => term.academicYearId === phase.academicYearId && term.termId === phase.termId);
      if (!term) throw new Error('A scheduled term no longer exists. Choose a valid term.');
      const key = `${phase.academicYearId}:${phase.termId}`;
      if (seen.has(key)) throw new Error('Only one privilege change can start in each term.');
      seen.add(key);
      // Existing past phases can remain, but users cannot add or change them.
      if (term.ended) {
        const original = existing?.schedule?.find(item => item.academicYearId === phase.academicYearId && item.termId === phase.termId);
        if (!original || original.discountType !== phase.discountType || original.discountValue !== phase.discountValue) throw new Error('Ended terms cannot be edited.');
      }
      validateDiscount(phase.discountType, phase.discountValue);
      return { academicYearId: phase.academicYearId, termId: phase.termId, startDate: term.startDate, discountType: phase.discountType,
        ...(phase.discountType === 'percentage' ? { discountValue: phase.discountValue } : {}) } as FeesHolidayPhase;
    }).sort((a, b) => terms.findIndex(term => term.academicYearId === a.academicYearId && term.termId === a.termId)
      - terms.findIndex(term => term.academicYearId === b.academicYearId && term.termId === b.termId));
  }
  const history = [...(existing?.termHistory || [])];
  for (const term of terms.filter(term => term.ended)) {
    if (history.some(item => item.academicYearId === term.academicYearId && item.termId === term.termId)) continue;
    const before = existing ? resolveFeesHoliday(existing, term.academicYearId, term.termId, years) : null;
    const saved: FeesHolidayTermSnapshot = { academicYearId: term.academicYearId, termId: term.termId,
      categories: before ? holidayCategories(before) : [], discountType: before?.discountType || 'full', isActive: before?.isActive ?? false,
      ...(before?.discountValue !== undefined ? { discountValue: before.discountValue } : {}) };
    history.push(saved);
  }
  // Ignore caller-provided history. Only values resolved from the stored record are frozen.
  const { id: _id, ...data } = next;
  return { ...data, termHistory: history };
}
