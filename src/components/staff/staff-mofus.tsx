"use client";

import * as React from 'react';
import Link from 'next/link';
import { Plus, UserRoundPlus, CalendarDays } from 'lucide-react';
import type { Staff, Pupil, FeesHoliday } from '@/types';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useFeesHolidays } from '@/lib/hooks/use-fees-holiday';
import { useAcademicYears, useAcademicNow } from '@/lib/hooks/use-academic-years';
import { useAuth } from '@/lib/contexts/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StaffPupilAssignmentModal } from './staff-pupil-assignment-modal';
import { FeesHolidayModal } from '@/components/fees/fees-holiday-modal';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { currentHolidayTerm, resolveFeesHoliday, feesHolidayLabel } from '@/lib/utils/fees-holiday-terms';

export function StaffMofus({ staff }: { staff: Staff }) {
  const { canEdit, canAccessModule } = useAuth();
  const { data: pupils = [], isLoading: pupilsLoading, error: pupilsError } = usePupils();
  const { data: holidays = [], isLoading: holidaysLoading, error: holidaysError } = useFeesHolidays({ enabled: canAccessModule('fees') });
  const { data: years = [], isLoading: yearsLoading, error: yearsError } = useAcademicYears();
  const now = useAcademicNow();
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Pupil | null>(null);
  const activePupils = pupils.filter(pupil => pupil.assignedStaffId === staff.id && pupil.status === 'Active');
  const term = currentHolidayTerm(years, now);
  const latestHoliday = (id: string): FeesHoliday | undefined => [...holidays].filter(holiday => holiday.pupilId === id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  const loading = pupilsLoading || holidaysLoading || yearsLoading;
  const error = pupilsError || holidaysError || yearsError;
  const canAssign = canEdit('staff') && canEdit('pupils');
  return <>
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-4"><h2 className="text-sm font-semibold">MOFUS · active assignments</h2>
        {canAssign && <div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={loading || !!error} onClick={() => setAssignOpen(true)}><Plus className="mr-2 h-4 w-4" />Assign MOFUS</Button>{canEdit('fees') && <Button variant="outline" className="min-h-11" asChild><Link href={`/pupils/new?mofus=true&staffId=${encodeURIComponent(staff.id)}`}><UserRoundPlus className="mr-2 h-4 w-4" />Register MOFUS</Link></Button>}</div>}
      </div>
      <CardContent className="p-4">
        {loading ? <p role="status" className="text-sm text-muted-foreground">Loading MOFUS assignments…</p> : error ? <p role="alert" className="text-sm text-destructive">Could not load MOFUS assignments.</p> : <>
          <p className="mb-3 text-xs text-muted-foreground">{term ? `Privileges for ${term.label}` : 'No current or upcoming academic term is configured.'}</p>
          {!activePupils.length ? <p className="text-sm text-muted-foreground">No active MOFUS pupils assigned.</p> : <div className="divide-y divide-border">{activePupils.map(pupil => {
            const holiday = latestHoliday(pupil.id);
            const effective = holiday && term ? resolveFeesHoliday(holiday, term.academicYearId, term.termId, years) : null;
            return <div key={pupil.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1"><Link href={`/pupil-detail?id=${pupil.id}`} className="inline-flex min-h-11 items-center break-words text-sm font-medium text-primary hover:underline">{formatPupilDisplayName(pupil)}</Link><p className="text-xs text-muted-foreground">{pupil.admissionNumber}{pupil.className ? ` · ${pupil.className}` : ''}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="secondary">{effective ? feesHolidayLabel(effective) : 'No privilege'}</Badge>{effective?.isActive && <span className="text-xs text-muted-foreground">{effective.categories.map(category => category === 'required' ? 'Required fees' : 'Non-required fees').join(' & ')}</span>}</div></div>
              {canAccessModule('fees') && canEdit('fees') && <Button variant="outline" className="min-h-11" onClick={() => setSelected(pupil)}><CalendarDays className="mr-2 h-4 w-4" />{holiday ? 'Edit privilege' : 'Add privilege'}</Button>}
            </div>;
          })}</div>}
        </>}
      </CardContent>
    </Card>
    <StaffPupilAssignmentModal open={assignOpen} onOpenChange={setAssignOpen} staff={staff} />
    {selected && <FeesHolidayModal open onOpenChange={open => { if (!open) setSelected(null); }} pupilId={selected.id} pupilName={formatPupilDisplayName(selected)} existingHoliday={latestHoliday(selected.id)} />}
  </>;
}
