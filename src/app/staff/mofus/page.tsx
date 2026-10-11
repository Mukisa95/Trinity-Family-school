"use client";

import * as React from 'react';
import Link from 'next/link';
import { Search, UserRoundPlus } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { SmartBackButton } from '@/components/common/SmartBackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStaff } from '@/lib/hooks/use-staff';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useAuth } from '@/lib/contexts/auth-context';
import { StaffMofus } from '@/components/staff/staff-mofus';
import { getStaffStatus } from '@/lib/utils/staff-status';

export default function MofusPage() {
  const { data: staff = [], isLoading, error } = useStaff();
  const { data: pupils = [] } = usePupils();
  const { canEdit } = useAuth();
  const [search, setSearch] = React.useState('');
  const visible = staff.filter(member => getStaffStatus(member) === 'active' || pupils.some(pupil => pupil.assignedStaffId === member.id))
    .filter(member => `${member.firstName} ${member.lastName} ${member.employeeId} ${member.email}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-4 p-3 sm:p-6">
    <PageHeader title="MOFUS" description="Staff-linked pupils and privileges by academic term" actions={<div className="flex flex-wrap gap-2"><SmartBackButton fallbackHref="/staff" className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm">Back to staff</SmartBackButton>{canEdit('pupils') && canEdit('staff') && canEdit('fees') && <Button asChild className="min-h-11"><Link href="/pupils/new?mofus=true"><UserRoundPlus className="mr-2 h-4 w-4" />Register MOFUS</Link></Button>}</div>} />
    <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search MOFUS staff" placeholder="Search staff by name, ID or email…" className="h-11 pl-10" value={search} onChange={event => setSearch(event.target.value)} /></div>
    {isLoading ? <p role="status">Loading staff…</p> : error ? <p role="alert" className="text-destructive">Could not load staff.</p> : !visible.length ? <p className="text-sm text-muted-foreground">No matching staff found.</p> : <div className="space-y-4">{visible.map(member => <section key={member.id} className="space-y-2"><h2 className="text-sm font-semibold"><Link href={`/staff/${member.id}`} className="inline-flex min-h-11 items-center text-primary hover:underline">{member.firstName} {member.lastName}</Link><span className="ml-2 text-xs font-normal text-muted-foreground">{member.employeeId}</span></h2><StaffMofus staff={member} /></section>)}</div>}
  </div>;
}
