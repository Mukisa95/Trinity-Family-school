'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clipboard, Link2, Loader2, Search, UserRoundPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { getSchoolPayCode } from '@/lib/utils/schoolpay';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Pupil } from '@/types';
import type { SchoolPayInboxRecord } from '@/types/schoolpay-inbox';

const money = (amount: number) => new Intl.NumberFormat('en-UG', {
  style: 'currency', currency: 'UGX', maximumFractionDigits: 0,
}).format(amount || 0);

const dateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-UG', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kampala',
  });
};

async function copyCode(code: string, toast: ReturnType<typeof useToast>['toast']) {
  try {
    await navigator.clipboard.writeText(code);
    toast({ title: 'SchoolPay code copied', description: code });
  } catch {
    toast({ title: 'Could not copy code', description: 'Select and copy the code manually.', variant: 'destructive' });
  }
}

function AssignSchoolPayCodeDialog({
  record,
  open,
  onOpenChange,
}: {
  record: SchoolPayInboxRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: pupils = [] } = usePupils();
  const { data: classes = [] } = useClasses();
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('all');
  const [section, setSection] = useState('all');
  const [gender, setGender] = useState('all');
  const [selected, setSelected] = useState<Pupil | null>(null);
  const [saving, setSaving] = useState(false);

  const classNames = useMemo(() => new Map(classes.map(item => [item.id, item.name || item.code])), [classes]);
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pupils.filter(pupil => {
      if (classId !== 'all' && pupil.classId !== classId) return false;
      if (section !== 'all' && pupil.section !== section) return false;
      if (gender !== 'all' && pupil.gender !== gender) return false;
      if (!term) return true;
      const text = [
        pupil.firstName, pupil.lastName, pupil.otherNames, pupil.admissionNumber,
        pupil.learnerIdentificationNumber, getSchoolPayCode(pupil),
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(term);
    }).slice(0, 80);
  }, [classId, gender, pupils, search, section]);

  const assign = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Your session is not ready. Refresh the page and try again.');
      const response = await fetch(`/api/schoolpay/inbox/${encodeURIComponent(record.id)}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pupilId: selected.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Could not assign this payment.');

      toast({
        title: 'Payment assigned and recorded',
        description: `${money(record.amount)} was added to ${selected.firstName} ${selected.lastName}.`,
      });
      onOpenChange(false);
      router.push(`/fees/collect/${selected.id}`);
    } catch (error) {
      toast({
        title: 'Assignment was not completed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const currentCode = selected ? getSchoolPayCode(selected) : '';
  const incomingCode = record.studentPaymentCode || '';

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b bg-amber-50/80">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserRoundPlus className="h-5 w-5 text-amber-700" /> Assign SchoolPay code
          </DialogTitle>
          <DialogDescription>
            Find the pupil who owns code <strong className="font-mono text-slate-900">{incomingCode || 'not supplied'}</strong>.
            Assigning it immediately retries receipt {record.receiptNumber} and records the payment once.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-4">
              <Label htmlFor={`schoolpay-search-${record.id}`}>Search pupil</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id={`schoolpay-search-${record.id}`}
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Name, admission number, LIN or pay code"
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All classes</SelectItem>{classes.map(item => (
                  <SelectItem key={item.id} value={item.id}>{item.name || item.code}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Section</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All sections</SelectItem><SelectItem value="Day">Day</SelectItem><SelectItem value="Boarding">Boarding</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All genders</SelectItem><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-slate-500" aria-live="polite">{matches.length} pupil{matches.length === 1 ? '' : 's'} shown</p>
          <div className="max-h-[38vh] overflow-y-auto rounded-xl border divide-y bg-white">
            {matches.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">No pupil matches these filters.</p>
            ) : matches.map(pupil => {
              const isSelected = selected?.id === pupil.id;
              const payCode = getSchoolPayCode(pupil);
              return (
                <button
                  type="button"
                  key={pupil.id}
                  onClick={() => setSelected(pupil)}
                  className={`w-full min-h-14 px-3 py-2 text-left flex items-center gap-3 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 ${isSelected ? 'bg-amber-50' : ''}`}
                >
                  <span className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300'}`}>
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-sm text-slate-900 truncate">{pupil.firstName} {pupil.lastName} {pupil.otherNames || ''}</span>
                    <span className="block text-xs text-slate-500 truncate">{pupil.admissionNumber} · {classNames.get(pupil.classId) || pupil.className || 'No class'} · {pupil.section || 'No section'} · {pupil.gender || 'No gender'}</span>
                  </span>
                  {payCode && <span className="text-[11px] font-mono text-slate-600">Current: {payCode}</span>}
                </button>
              );
            })}
          </div>

          {selected && currentCode && currentCode !== incomingCode && (
            <div role="alert" className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
              This pupil currently has code <strong className="font-mono">{currentCode}</strong>. Continuing replaces it with <strong className="font-mono">{incomingCode}</strong>.
            </div>
          )}
        </div>

        <DialogFooter className="m-0 px-5 py-4 bg-slate-50">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={assign} disabled={!selected || saving} className="bg-amber-700 hover:bg-amber-800">
            {saving ? <Loader2 className="animate-spin" /> : <Link2 />}
            {saving ? 'Assigning and recording…' : 'Assign code and record payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SchoolPayInboxCard({
  record,
  onDismiss,
  compact = false,
}: {
  record: SchoolPayInboxRecord;
  onDismiss?: () => void;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [assigning, setAssigning] = useState(false);
  const code = record.studentPaymentCode || '';
  const missingPupil = record.status === 'unmatched';

  return (
    <>
      <article className={`relative overflow-hidden rounded-2xl border shadow-lg ${missingPupil ? 'border-amber-300 bg-white' : 'border-red-300 bg-white'} ${compact ? 'p-4' : 'p-5'}`}>
        <div className={`absolute inset-y-0 left-0 w-1.5 ${missingPupil ? 'bg-amber-500' : 'bg-red-500'}`} />
        <div className="pl-2 space-y-3">
          <div className="flex items-start gap-3 pr-7">
            <span className={`mt-0.5 rounded-full p-2 ${missingPupil ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}><AlertTriangle className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-950">SchoolPay payment needs attention</h3>
              <p className="mt-0.5 text-sm text-slate-600">
                {missingPupil
                  ? 'The payment was received, but its SchoolPay code does not match a pupil in this system, so it has not been added to pupil fees.'
                  : 'The payment was safely received, but recording it failed. It remains in this recovery inbox.'}
              </p>
            </div>
            {onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss this prompt" className="absolute right-3 top-3 rounded-full p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"><X className="h-4 w-4" /></button>}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
            <div><dt className="text-slate-500">Amount received</dt><dd className="font-bold text-slate-950 text-sm">{money(record.amount)}</dd></div>
            <div><dt className="text-slate-500">SchoolPay code</dt><dd className="font-mono font-bold text-slate-950 break-all">{code || 'Not supplied'}</dd></div>
            <div><dt className="text-slate-500">Receipt</dt><dd className="font-mono font-semibold text-slate-800 break-all">{record.receiptNumber}</dd></div>
            <div><dt className="text-slate-500">Student sent by SchoolPay</dt><dd className="font-semibold text-slate-800">{record.studentName || 'Not supplied'}</dd></div>
            <div><dt className="text-slate-500">Class sent by SchoolPay</dt><dd className="font-semibold text-slate-800">{record.studentClass || 'Not supplied'}</dd></div>
            <div><dt className="text-slate-500">Paid</dt><dd className="font-semibold text-slate-800">{dateTime(record.paymentDate || record.receivedAt)}</dd></div>
          </dl>

          {(record.reason || record.lastError) && <p className="text-xs text-slate-600"><strong>Reason:</strong> {record.reason || record.lastError}</p>}

          <div className="flex flex-wrap gap-2">
            {code && <Button type="button" variant="outline" size="sm" onClick={() => copyCode(code, toast)}><Clipboard /> Copy code</Button>}
            {missingPupil && code && <Button type="button" size="sm" onClick={() => setAssigning(true)} className="bg-amber-700 hover:bg-amber-800"><UserRoundPlus /> Assign code</Button>}
            {onDismiss && <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>Dismiss prompt</Button>}
          </div>
          {onDismiss && <p className="text-[11px] text-slate-500">Dismiss only hides this prompt on this device. The payment remains visible in the SchoolPay Live Feed until resolved.</p>}
        </div>
      </article>
      <AssignSchoolPayCodeDialog record={record} open={assigning} onOpenChange={setAssigning} />
    </>
  );
}
