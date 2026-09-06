'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Clock3, Loader2, PackageCheck, PackagePlus, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/contexts/auth-context';
import { useItemRequestDecision, useStartItemRequestRestock } from '@/lib/hooks/use-item-requests';
import { defaultRestockPendingReason } from '@/lib/utils/item-request-state';
import { cn } from '@/lib/utils';
import type { ItemRequest } from '@/types';

type DecisionAction = 'release' | 'pending' | 'decline';

interface ItemReleaseQueuePanelProps {
  requests: ItemRequest[];
  isLoading: boolean;
  focusRequestId?: string | null;
}

function operationId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `item-release-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ItemReleaseQueuePanel({ requests, isLoading, focusRequestId }: ItemReleaseQueuePanelProps) {
  const { canAccessPage, canPerformAction } = useAuth();
  const { toast } = useToast();
  const canView = canAccessPage('item_requests', 'release') && canPerformAction('item_requests', 'release', 'view_release_queue');
  const canRelease = canAccessPage('item_requests', 'release') && canPerformAction('item_requests', 'release', 'release_items');
  const canPend = canAccessPage('item_requests', 'release') && canPerformAction('item_requests', 'release', 'pend_requests');
  const canDecline = canAccessPage('item_requests', 'release') && canPerformAction('item_requests', 'release', 'decline_requests');
  const canStartRestock = canAccessPage('item_requests', 'release') && canPerformAction('item_requests', 'release', 'start_restock');
  const decision = useItemRequestDecision();
  const startRestock = useStartItemRequestRestock();
  const [selected, setSelected] = useState<ItemRequest | null>(null);
  const [action, setAction] = useState<DecisionAction>('pending');
  const [pendingMode, setPendingMode] = useState<'available' | 'restock'>('available');
  const [reason, setReason] = useState('');

  const orderedRequests = useMemo(() => {
    if (!focusRequestId) return requests;
    const focused = requests.find(item => item.id === focusRequestId);
    return focused ? [focused, ...requests.filter(item => item.id !== focusRequestId)] : requests;
  }, [focusRequestId, requests]);

  const openDecision = (item: ItemRequest, nextAction: DecisionAction) => {
    setSelected(item);
    setAction(nextAction);
    const mode = item.canRelease ? 'available' : 'restock';
    setPendingMode(mode);
    setReason(nextAction === 'pending' && mode === 'restock' ? defaultRestockPendingReason(item.itemName) : '');
  };

  const submitDecision = async () => {
    if (!selected) return;
    if ((action === 'pending' || action === 'decline') && !reason.trim()) {
      toast({ title: 'Add a clear reason', description: 'The requester needs to understand this response.', variant: 'destructive' });
      return;
    }
    try {
      await decision.mutateAsync({
        id: selected.id,
        decision: {
          action,
          ...(action === 'pending' ? { pendingMode, reason: reason.trim() } : action === 'decline' ? { reason: reason.trim() } : {}),
          operationId: operationId(),
        },
      });
      toast({ title: action === 'release' ? 'Item released' : action === 'decline' ? 'Request declined' : 'Request updated', description: 'The requester has been notified.' });
      setSelected(null);
    } catch (error) {
      toast({ title: 'Decision not saved', description: error instanceof Error ? error.message : 'Refresh the queue and try again.', variant: 'destructive' });
    }
  };

  const beginRestock = async (item: ItemRequest) => {
    try {
      const outcome = await startRestock.mutateAsync({ id: item.id, operationId: operationId() });
      toast({
        title: 'Restocking started',
        description: outcome.createdCatalogItem
          ? 'The proposed item was added to shared items and Procurement.'
          : 'A linked Procurement restock instruction was created.',
      });
    } catch (error) {
      toast({ title: 'Restocking not started', description: error instanceof Error ? error.message : 'Try again shortly.', variant: 'destructive' });
    }
  };

  if (!canView) {
    return <Card><CardContent className="py-10 text-center text-sm text-slate-600">You do not have permission to view release requests.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-blue-100 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
        <CardContent className="flex gap-3 p-4 text-sm text-blue-950 dark:text-blue-100">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />
          <p>Requests and releases use the everyday stock unit, such as one pen or one kilogram—not a procurement box or sack. A release creates an Inventory issue record only after current stock is sufficient. Pending and declined responses never reduce stock.</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the release queue…
        </div>
      ) : orderedRequests.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-slate-500">There are no active item requests right now.</CardContent></Card>
      ) : orderedRequests.map(item => (
        <Card
          key={item.id}
          id={`release-request-${item.id}`}
          className={cn('overflow-hidden', item.id === focusRequestId && 'border-violet-400 ring-2 ring-violet-200 dark:ring-violet-900')}
        >
          <CardHeader className="gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg">{item.quantity} {item.unit} of {item.itemName}</CardTitle>
              <CardDescription>Requested by {item.requesterName}{item.requesterDepartment ? ` · ${item.requesterDepartment}` : ''}</CardDescription>
            </div>
            <Badge variant="outline" className={item.canRelease ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}>
              {item.canRelease ? 'Available to release' : item.catalogItemId ? 'Stock unavailable' : 'Not yet in shared items'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900/60 dark:text-slate-200 sm:grid-cols-2">
              <p><span className="font-medium">Reason:</span> {item.reason}</p>
              <p><span className="font-medium">Current stock:</span> {item.catalogItemId ? `${item.availableQuantity ?? 0} ${item.unit}` : 'No shared item yet'}</p>
              {item.neededBy && <p><span className="font-medium">Needed by:</span> {item.neededBy}</p>}
              {item.useLocation && <p><span className="font-medium">Use location:</span> {item.useLocation}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {canRelease && item.canRelease && <Button className="min-h-11 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => openDecision(item, 'release')}><PackageCheck className="h-4 w-4" /> Release</Button>}
              {canStartRestock && !item.canRelease && <Button variant="outline" className="min-h-11 gap-2 border-violet-200 text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950/40" onClick={() => beginRestock(item)} disabled={startRestock.isPending}><PackagePlus className="h-4 w-4" /> Start restocking</Button>}
              {canPend && <Button variant="outline" className="min-h-11 gap-2" onClick={() => openDecision(item, 'pending')}><Clock3 className="h-4 w-4" /> Put on pending</Button>}
              {canDecline && <Button variant="outline" className="min-h-11 gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950/40" onClick={() => openDecision(item, 'decline')}><XCircle className="h-4 w-4" /> Decline</Button>}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open && !decision.isPending) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === 'release' ? 'Release item' : action === 'decline' ? 'Decline request' : 'Put request on pending'}</DialogTitle>
            <DialogDescription>{selected ? `${selected.quantity} ${selected.unit} of ${selected.itemName} for ${selected.requesterName}.` : ''}</DialogDescription>
          </DialogHeader>
          {action === 'release' ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"><CheckCircle2 className="mb-2 h-5 w-5 text-emerald-700 dark:text-emerald-300" /> Confirming will reduce stock, create an Inventory issue record, and notify the requester. Stock is checked again before anything is recorded.</div>
          ) : (
            <div className="space-y-4">
              {action === 'pending' && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Button type="button" variant={pendingMode === 'available' ? 'default' : 'outline'} className="min-h-11" onClick={() => { setPendingMode('available'); setReason(''); }}>Item available</Button><Button type="button" variant={pendingMode === 'restock' ? 'default' : 'outline'} className="min-h-11" onClick={() => { setPendingMode('restock'); if (selected) setReason(defaultRestockPendingReason(selected.itemName)); }}>Needs restocking</Button></div>}
              <div className="space-y-2"><Label htmlFor="decision-reason">{action === 'decline' ? 'Reason for declining' : 'Message to the requester'}</Label><textarea id="decision-reason" value={reason} onChange={event => setReason(event.target.value)} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm" placeholder={action === 'decline' ? 'Explain why this request cannot be approved.' : 'Explain what is happening next.'} /></div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setSelected(null)} disabled={decision.isPending}>Cancel</Button>
            <Button type="button" className={`min-h-11 ${action === 'release' ? 'bg-emerald-600 hover:bg-emerald-700' : action === 'decline' ? 'bg-rose-600 hover:bg-rose-700' : ''}`} onClick={submitDecision} disabled={decision.isPending}>{decision.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{action === 'release' ? 'Confirm release' : action === 'decline' ? 'Decline request' : 'Save pending response'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
