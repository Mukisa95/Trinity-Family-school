"use client";

import type { AcademicYear, FeesHolidayDraft, Staff } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { FeesHolidayForm } from '@/components/fees/fees-holiday-form';

export function MofusRegistrationOptions({ enabled, onEnabledChange, staffId, onStaffChange, privilege, onPrivilegeChange, staff, years, loading, error }: {
  enabled: boolean; onEnabledChange: (value: boolean) => void; staffId: string; onStaffChange: (id: string) => void;
  privilege: FeesHolidayDraft; onPrivilegeChange: (value: FeesHolidayDraft) => void; staff: Staff[]; years: AcademicYear[];
  loading: boolean; error?: boolean;
}) {
  return <Card><CardHeader><CardTitle className="text-base">MOFUS registration</CardTitle></CardHeader><CardContent className="space-y-4">
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium"><Checkbox checked={enabled} onCheckedChange={checked => onEnabledChange(checked === true)} />Register this pupil as a MOFUS</label>
    {enabled && <>{loading ? <p role="status">Loading staff and academic terms…</p> : error ? <p role="alert" className="text-destructive">Could not load MOFUS options.</p> : <>
      <div className="space-y-1"><label htmlFor="mofus-staff" className="text-sm font-medium">Staff member</label><Select value={staffId} onValueChange={onStaffChange}><SelectTrigger id="mofus-staff" className="h-11"><SelectValue placeholder="Choose staff member" /></SelectTrigger><SelectContent>{staff.map(member => <SelectItem key={member.id} value={member.id}>{member.firstName} {member.lastName} · {member.employeeId}</SelectItem>)}</SelectContent></Select></div>
      <FeesHolidayForm value={privilege} onChange={onPrivilegeChange} years={years} />
      <p className="text-xs text-muted-foreground">The staff assignment and privilege are saved with the pupil registration.</p>
    </>}</>}
  </CardContent></Card>;
}
