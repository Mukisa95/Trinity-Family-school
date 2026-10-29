'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requestStaffClocking, useOwnStaffId, useStaffIds } from '@/lib/hooks/use-staff-clocking';

type StaffId = { id: string; name: string; employeeId: string; status: string; revision: number };
type Credential = { token?: string; status?: string; revision?: number };

export function OwnStaffClockingId({ available }: { available: boolean }) {
  const id = useOwnStaffId(available);
  const issue = useMutation({ mutationFn: () => requestStaffClocking<Credential>('/api/staff-clocking/my-id', { method: 'POST' }) });
  const token = id.data?.token;
  return <div className="space-y-4 text-center">
    <p className="text-sm text-muted-foreground">Show this ID to an authorised timekeeper to record your attendance.</p>
    {token ? <div className="mx-auto inline-block rounded-xl bg-white p-5"><QRCode value={token} size={230} level="M" /></div> : <p className="text-sm">{id.data?.status === 'revoked' ? 'Your ID was revoked. Ask a manager to issue a replacement.' : id.isPending ? 'Loading your ID…' : 'Your staff ID has not been issued yet.'}</p>}
    {!token && id.data?.status === 'unissued' && <Button type="button" onClick={() => issue.mutate()} disabled={issue.isPending}>Create my staff ID</Button>}
    {(id.error || issue.error) && <p role="alert" className="text-sm text-destructive">{(id.error || issue.error)?.message}</p>}
  </div>;
}

async function downloadCard(person: StaffId, token: string) {
  const [{ jsPDF }, qr] = await Promise.all([import('jspdf'), import('qrcode')]);
  const image = await qr.toDataURL(token, { errorCorrectionLevel: 'M', margin: 4, width: 600 });
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] });
  pdf.setFontSize(11); pdf.text('STAFF CLOCKING ID', 5, 8);
  pdf.setFontSize(10); pdf.text(pdf.splitTextToSize(person.name, 43), 5, 18);
  pdf.setFontSize(8); pdf.text(person.employeeId || person.id, 5, 32);
  pdf.addImage(image, 'PNG', 51, 14, 30, 30);
  pdf.text('Present to an authorised timekeeper', 5, 48);
  pdf.save(`staff-id-${person.id}.pdf`);
}

export function StaffClockingIdManager() {
  const people = useStaffIds(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const action = useMutation({ mutationFn: async ({ person, operation }: { person: StaffId; operation: 'issue' | 'read' | 'replace' | 'revoke' }) => {
    const result = await requestStaffClocking<Credential>('/api/staff-clocking/staff-ids', { method: 'POST', body: JSON.stringify({ staffId: person.id, operation, revision: person.revision }) });
    if ((operation === 'issue' || operation === 'read' || operation === 'replace') && result.token) await downloadCard(person, result.token);
    return { person, operation };
  }, onSuccess: ({ person, operation }) => setMessage(`${person.name}: ${operation === 'revoke' ? 'ID revoked.' : 'ID ready for printing.'}`) });
  const batch = useMutation({ mutationFn: async (members: StaffId[]) => {
    const [{ jsPDF }, qr] = await Promise.all([import('jspdf'), import('qrcode')]);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    for (let index = 0; index < members.length; index++) {
      const person = members[index];
      const result = await requestStaffClocking<Credential>('/api/staff-clocking/staff-ids', { method: 'POST', body: JSON.stringify({ staffId: person.id, operation: person.status === 'active' ? 'read' : 'issue', revision: person.revision }) });
      if (!result.token) throw new Error(`No active ID is available for ${person.name}.`);
      if (index && index % 10 === 0) pdf.addPage();
      const x = 12 + (index % 2) * 90, y = 12 + (Math.floor(index % 10 / 2)) * 55;
      const image = await qr.toDataURL(result.token, { errorCorrectionLevel: 'M', margin: 4, width: 600 });
      pdf.rect(x, y, 85.6, 54); pdf.setFontSize(10); pdf.text('STAFF CLOCKING ID', x + 5, y + 8);
      pdf.setFontSize(9); pdf.text(pdf.splitTextToSize(person.name, 43), x + 5, y + 18);
      pdf.setFontSize(8); pdf.text(person.employeeId || person.id, x + 5, y + 32);
      pdf.addImage(image, 'PNG', x + 51, y + 14, 30, 30);
      pdf.text('Present to an authorised timekeeper', x + 5, y + 48);
    }
    pdf.save('staff-clocking-ids.pdf');
  }, onSuccess: () => setMessage('Selected IDs are ready for printing.'), onError: () => setMessage('Some IDs may have been issued before the batch stopped. Refresh the list and print again.') });
  const matches = people.data?.filter(person => `${person.name} ${person.employeeId}`.toLowerCase().includes(search.toLowerCase())) || [];
  return <section className="space-y-4"><div><h3 className="font-semibold">Staff clocking IDs</h3><p className="text-sm text-muted-foreground">Issue a printable ID for any active staff member, including staff without an app account. Replacing or revoking an ID immediately disables the previous code.</p></div>
    <Input aria-label="Search staff IDs" placeholder="Search staff by name or ID" value={search} onChange={event => setSearch(event.target.value)} />
    {(people.error || action.error || batch.error) && <p role="alert" className="text-sm text-destructive">{(people.error || action.error || batch.error)?.message}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <Button type="button" variant="outline" disabled={!selected.length || batch.isPending || action.isPending || people.isPlaceholderData} onClick={() => batch.mutate((people.data || []).filter(person => selected.includes(person.id)))}>Issue and print selected ({selected.length})</Button>
    {people.isPending ? <p>Loading staff…</p> : <ul className="space-y-2">{matches.map(person => <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div className="flex items-center gap-3"><input type="checkbox" aria-label={`Select ${person.name}`} checked={selected.includes(person.id)} onChange={event => setSelected(current => event.target.checked ? [...current, person.id] : current.filter(id => id !== person.id))} /><div><p className="font-semibold">{person.name}</p><p className="text-xs text-muted-foreground">{person.employeeId || person.id} · {person.status}</p></div></div><div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={action.isPending || batch.isPending || people.isPlaceholderData} onClick={() => action.mutate({ person, operation: person.status === 'active' ? 'read' : 'issue' })}>{person.status === 'active' ? 'Print' : 'Issue & print'}</Button>
      {person.status === 'active' && <><Button size="sm" variant="outline" disabled={action.isPending || batch.isPending || people.isPlaceholderData} onClick={() => { if (window.confirm(`Replace ${person.name}'s ID? The old code will stop working.`)) action.mutate({ person, operation: 'replace' }); }}>Replace</Button><Button size="sm" variant="outline" disabled={action.isPending || batch.isPending || people.isPlaceholderData} onClick={() => { if (window.confirm(`Revoke ${person.name}'s ID?`)) action.mutate({ person, operation: 'revoke' }); }}>Revoke</Button></>}
    </div></li>)}</ul>}
  </section>;
}
