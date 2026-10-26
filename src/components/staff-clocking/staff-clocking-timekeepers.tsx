'use client';

import { useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useStaffClockingTimekeepers, useUpdateStaffClockingTimekeeper } from '@/lib/hooks/use-staff-clocking';

export function StaffClockingTimekeepers() {
  const people = useStaffClockingTimekeepers(true);
  const update = useUpdateStaffClockingTimekeeper();
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const matches = people.data?.filter(person => `${person.name} ${person.username}`.toLowerCase().includes(search.trim().toLowerCase())) || [];
  const error = people.error || update.error;
  return <section className="space-y-4" aria-labelledby="timekeepers-title">
    <div><h3 id="timekeepers-title" className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5 text-primary" />Record Station access</h3>
      <p className="mt-1 text-sm text-muted-foreground">Choose staff who can open Record and display the school QR. Their other permissions stay unchanged. Staff need an active linked login before they appear here.</p></div>
    <div className="space-y-2"><Label htmlFor="timekeeper-search">Find staff</Label><Input id="timekeeper-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or username" /></div>
    {error && <p role="alert" className="text-sm text-destructive dark:text-red-300">{error.message === 'CLOCKING_ACCESS_CHANGED_REVIEW_AND_RETRY' ? 'Another manager changed this access. Review the current setting and try again.' : error.message}</p>}
    <p role="status" className="text-sm text-muted-foreground">{message}</p>
    {people.isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading linked staff…</p> : <ul className="space-y-3">{matches.map(person => <li key={person.accountId} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/70 p-4">
      <div className="min-w-0"><Label htmlFor={`timekeeper-${person.accountId}`} className="break-words font-semibold">{person.name}</Label><p className="mt-1 break-words text-xs text-muted-foreground">{person.username} · {person.allowed ? 'Timekeeper' : 'Record Station not assigned'}</p></div>
      <Switch id={`timekeeper-${person.accountId}`} aria-label={`Record Station access for ${person.name}`} checked={person.allowed} disabled={update.isPending || people.isPlaceholderData} onCheckedChange={allowed => {
        setMessage('');
        update.mutate({ accountId: person.accountId, allowed, revision: person.revision }, { onSuccess: () => setMessage(`${person.name}: Record Station access ${allowed ? 'granted' : 'removed'}.`) });
      }} />
    </li>)}</ul>}
    {!people.isPending && !matches.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{search ? 'No matching staff accounts.' : 'No active linked staff logins are available.'}</p>}
    {update.isPending && <Button type="button" variant="ghost" disabled><Loader2 className="h-4 w-4 animate-spin" />Saving access…</Button>}
  </section>;
}
