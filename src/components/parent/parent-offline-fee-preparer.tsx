'use client';

import { useEffect, useState } from 'react';
import type { AcademicYear, Term } from '@/types';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { usePupil } from '@/lib/hooks/use-pupils';
import { useParentOfflineFees } from '@/lib/hooks/use-parent-offline-fees';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import { usePupilFees } from '@/app/fees/collect/[id]/hooks/usePupilFees';

/** Prepares every term in the current academic year without rendering a second screen. */
export function ParentOfflineFeePreparer({ accountId, pupilId }: { accountId?: string; pupilId: string }) {
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null);
  const { data: academicYears = [] } = useAcademicYears();

  useEffect(() => {
    if (academicYear || !academicYears.length) return;
    const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
    if (!effectiveTerm?.academicYear) return;
    setAcademicYear(effectiveTerm.academicYear);
  }, [academicYear, academicYears]);

  if (!academicYear) return null;
  return (
    <>
      {academicYear.terms.map(term => (
        <ParentOfflineFeeTermPreparer
          key={term.id}
          accountId={accountId}
          pupilId={pupilId}
          academicYear={academicYear}
          term={term}
        />
      ))}
    </>
  );
}

function ParentOfflineFeeTermPreparer({
  accountId,
  pupilId,
  academicYear,
  term,
}: {
  accountId?: string;
  pupilId: string;
  academicYear: AcademicYear;
  term: Term;
}) {
  const { data: pupil } = usePupil(pupilId);
  const { pupilFees, termTotals, isLoading } = usePupilFees({
    pupilId,
    pupil: pupil || undefined,
    selectedTermId: term.id,
    selectedAcademicYear: academicYear,
    lastPaymentTimestamp: 0,
  });
  const { save } = useParentOfflineFees(accountId, pupilId, academicYear.id, term.id);

  useEffect(() => {
    if (!accountId || isLoading) return;
    void save(pupilFees, termTotals)
      .catch(error => console.warn('Could not prepare parent fees for offline use:', error));
  }, [accountId, isLoading, pupilFees, save, termTotals]);

  return null;
}
