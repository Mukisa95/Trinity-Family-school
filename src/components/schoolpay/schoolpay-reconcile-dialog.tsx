'use client';

import { useMemo, useState } from 'react';
import { CalendarSearch, Loader2, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

interface ReconcileTotals {
  processed: number;
  duplicates: number;
  skipped: number;
  failed: number;
}

function kampalaDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function SchoolPayReconcileDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => kampalaDate(-6));
  const [dateTo, setDateTo] = useState(() => kampalaDate());
  const [recovering, setRecovering] = useState(false);
  const [result, setResult] = useState<ReconcileTotals | null>(null);
  const [error, setError] = useState('');

  const rangeError = useMemo(() => {
    if (!dateFrom || !dateTo) return 'Choose both the first and last date.';
    const start = new Date(`${dateFrom}T00:00:00Z`);
    const end = new Date(`${dateTo}T00:00:00Z`);
    if (start > end) return 'The first date cannot be after the last date.';
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (days > 14) return 'Recover no more than 14 days at a time.';
    return '';
  }, [dateFrom, dateTo]);

  const recover = async () => {
    if (rangeError) {
      setError(rangeError);
      return;
    }
    setRecovering(true);
    setError('');
    setResult(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Your session is not ready. Refresh and try again.');
      const response = await fetch('/api/schoolpay/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dateFrom, dateTo }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'SchoolPay recovery failed.');

      const totals = payload.totals as ReconcileTotals;
      setResult(totals);
      toast({
        title: totals.failed > 0 ? 'Recovery completed with items needing attention' : 'SchoolPay recovery completed',
        description: `${totals.processed} added, ${totals.duplicates} already recorded, ${totals.failed} needing review.`,
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'SchoolPay recovery failed.';
      setError(message);
      toast({ title: 'Could not recover SchoolPay payments', description: message, variant: 'destructive' });
    } finally {
      setRecovering(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={recovering ? undefined : setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="bg-white/90 border-violet-200 text-violet-800 hover:bg-violet-50">
          <CalendarSearch /> Recover missing payments
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarSearch className="text-violet-700" /> Recover SchoolPay payments</DialogTitle>
          <DialogDescription>
            Fetch successful SchoolPay transactions for a date range and add only those that are genuinely missing.
            Existing receipts and transaction IDs are checked before any pupil balance changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="schoolpay-date-from">First payment date</Label>
              <Input id="schoolpay-date-from" type="date" value={dateFrom} max={kampalaDate()} onChange={event => { setDateFrom(event.target.value); setResult(null); setError(''); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schoolpay-date-to">Last payment date</Label>
              <Input id="schoolpay-date-to" type="date" value={dateTo} min={dateFrom} max={kampalaDate()} onChange={event => { setDateTo(event.target.value); setResult(null); setError(''); }} />
            </div>
          </div>

          <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Duplicate protection compares receipt number, transaction ID, pupil, and total amount. Conflicts are stopped and shown for review.</p>
          </div>

          {(error || rangeError) && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error || rangeError}</p>}
          {result && (
            <div aria-live="polite" className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
              <div><p className="text-lg font-bold text-emerald-700">{result.processed}</p><p className="text-[11px] text-slate-600">Added</p></div>
              <div><p className="text-lg font-bold text-blue-700">{result.duplicates}</p><p className="text-[11px] text-slate-600">Already recorded</p></div>
              <div><p className="text-lg font-bold text-amber-700">{result.failed}</p><p className="text-[11px] text-slate-600">Need review</p></div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={recovering}>Close</Button>
          <Button type="button" onClick={recover} disabled={recovering || !!rangeError} className="bg-violet-700 hover:bg-violet-800">
            {recovering ? <Loader2 className="animate-spin" /> : <CalendarSearch />}
            {recovering ? 'Checking SchoolPay…' : 'Recover selected dates'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
