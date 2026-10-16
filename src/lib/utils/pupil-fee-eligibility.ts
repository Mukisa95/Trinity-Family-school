import type { AcademicYear, Pupil } from '@/types';

// ─── Fees-active status helpers ────────────────────────────────────────────
// These are intentionally separate from attendance wasPupilActiveOnDate so that
// 'Suspended' (fees owed but barred from class) counts as fees-active without
// affecting attendance calculations.

/** Statuses that make a pupil liable for fees */
const FEES_ACTIVE_STATUSES = new Set(['Active', 'Suspended', 'Pending', '']);

/**
 * Reconstructs a pupil's status on a specific date by replaying statusChangeHistory.
 * Returns the raw status string (not boolean) so the caller can validate against
 * a fees-specific active-set that may differ from the attendance active-set.
 */
function getPupilStatusOnDate(pupil: Pupil, dateStr: string): string {
  const targetDate = dateStr.split('T')[0];

  if (!pupil.statusChangeHistory || pupil.statusChangeHistory.length === 0) {
    return pupil.status;
  }

  const sortedHistory = [...pupil.statusChangeHistory].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  let current: string =
    sortedHistory[0].fromStatus === 'N/A' ? 'Active' : sortedHistory[0].fromStatus;

  for (const entry of sortedHistory) {
    const entryDate = entry.date.split('T')[0];
    if (entryDate <= targetDate) {
      current = entry.toStatus;
    } else {
      break;
    }
  }

  return current;
}

/**
 * Returns true if the pupil is fees-eligible during a given term.
 *
 * Two-point check (START date OR END date):
 *
 *   • Check START DATE first: handles normal active terms AND the graduation
 *     term itself. A pupil who graduates at the very end of T3 2025 was still
 *     fully enrolled at T3's start — so T3 must be included in their fees.
 *
 *   • Also check END DATE: handles mid-term enrolment / re-activation.
 *     If a pupil was inactive at T1 2026 start but reactivated before T1
 *     ends, T1 is included (user-confirmed requirement).
 *
 *   • A pupil with no history: current status is assumed for all terms.
 *
 * Result matrix:
 *   Start=Active,  End=Active     → ✅ included (normal term)
 *   Start=Active,  End=Graduated  → ✅ included (graduation term — T3 2025)
 *   Start=Graduated, End=Graduated → ❌ excluded (post-graduation terms)
 *   Start=Inactive, End=Active    → ✅ included (mid-term activation)
 */
function hasStatusTransitionDuringTerm(
  pupil: Pupil,
  term: { startDate: string; endDate: string },
  toStatus: string
): boolean {
  const termStart = term.startDate.split('T')[0];
  const termEnd = term.endDate.split('T')[0];

  return (pupil.statusChangeHistory || []).some(entry => {
    const entryDate = entry.date.split('T')[0];
    return entry.toStatus === toStatus && entryDate >= termStart && entryDate <= termEnd;
  });
}

export function isPupilFeesActiveForTerm(
  pupil: Pupil,
  term: { startDate: string; endDate: string }
): boolean {
  if (!pupil.statusChangeHistory || pupil.statusChangeHistory.length === 0) {
    return FEES_ACTIVE_STATUSES.has(pupil.status);
  }

  // Active at term start → include (catches normal terms + graduation term)
  const statusAtTermStart = getPupilStatusOnDate(pupil, term.startDate);
  const statusAtTermEnd = getPupilStatusOnDate(pupil, term.endDate);

  // Active by term end covers normal, newly activated, and reactivated terms.
  // Graduation keeps its term as the only start-date exception.
  if (FEES_ACTIVE_STATUSES.has(statusAtTermEnd)) return true;

  // Active at term end → include (catches mid-term re-activation)
  return (
    FEES_ACTIVE_STATUSES.has(statusAtTermStart) &&
    hasStatusTransitionDuringTerm(pupil, term, 'Graduated')
  );
}
// ────────────────────────────────────────────────────────────────────────────

/** Whether a pupil can owe fees in this term, using enrolment and status history. */
export function isPupilValidForTerm(
  pupil: Pupil,
  term: { id: string; name: string; startDate: string; endDate: string },
  academicYear: AcademicYear
): boolean {
  if (!isPupilFeesActiveForTerm(pupil, term)) return false;

  if (!pupil.registrationDate) return true; // If no registration date, show in all fees-active terms

  const registrationDate = new Date(pupil.registrationDate);
  const termEndDate = new Date(term.endDate);

  // Pupil should appear if the term ended on or after their registration date
  return termEndDate >= registrationDate;
}
