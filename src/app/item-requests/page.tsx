'use client';

import { useMemo, useState } from 'react';
import { ClipboardList, Loader2, PackagePlus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/contexts/auth-context';
import { useSchoolItemCatalog } from '@/lib/hooks/use-item-catalog';
import { useCreateItemRequest, useMyItemRequests } from '@/lib/hooks/use-item-requests';
import type { CreateItemRequestData, ItemRequestStatus } from '@/types';

const statusStyles: Record<ItemRequestStatus, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  pending_available: 'bg-amber-50 text-amber-800 border-amber-200',
  pending_restock: 'bg-amber-50 text-amber-800 border-amber-200',
  restock_in_progress: 'bg-violet-50 text-violet-800 border-violet-200',
  ready_to_release: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  released: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  declined: 'bg-rose-50 text-rose-800 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-700 border-slate-200',
};

const statusLabels: Record<ItemRequestStatus, string> = {
  submitted: 'Awaiting review',
  pending_available: 'Waiting for release',
  pending_restock: 'Waiting for restock',
  restock_in_progress: 'Restocking in progress',
  ready_to_release: 'Ready for release',
  released: 'Released',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

function operationId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `item-request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ItemRequestsPage() {
  const { canAccessPage, canPerformAction } = useAuth();
  const { toast } = useToast();
  const canRequest = canAccessPage('item_requests', 'request')
    && canPerformAction('item_requests', 'request', 'create_request');
  const canView = canAccessPage('item_requests', 'request')
    && canPerformAction('item_requests', 'request', 'view_own_requests');
  const { data: requests = [], isLoading: loadingRequests } = useMyItemRequests(canView);
  const { data: catalog = [], isLoading: loadingCatalog } = useSchoolItemCatalog({ enabled: canRequest });
  const createRequest = useCreateItemRequest();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<'catalog' | 'other'>('catalog');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogItemId, setCatalogItemId] = useState('');
  const [otherItemName, setOtherItemName] = useState('');
  const [otherItemUnit, setOtherItemUnit] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [useLocation, setUseLocation] = useState('');

  const selectedCatalogItem = catalog.find(item => item.id === catalogItemId);
  const filteredCatalog = useMemo(() => {
    const term = catalogSearch.trim().toLowerCase();
    return catalog
      .filter(item => item.isActive)
      .filter(item => !term || `${item.name} ${item.standardUnit}`.toLowerCase().includes(term))
      .slice(0, 12);
  }, [catalog, catalogSearch]);

  const reset = () => {
    setSource('catalog');
    setCatalogSearch('');
    setCatalogItemId('');
    setOtherItemName('');
    setOtherItemUnit('');
    setQuantity('1');
    setReason('');
    setNeededBy('');
    setUseLocation('');
  };

  const submit = async () => {
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      toast({ title: 'Check the quantity', description: 'Enter a whole number greater than zero.', variant: 'destructive' });
      return;
    }
    if (reason.trim().length < 3) {
      toast({ title: 'Add a reason', description: 'Explain why the item is needed.', variant: 'destructive' });
      return;
    }
    if (source === 'catalog' && !selectedCatalogItem) {
      toast({ title: 'Choose an item', description: 'Select an item from the shared list, or choose Other item.', variant: 'destructive' });
      return;
    }
    if (source === 'other' && (!otherItemName.trim() || !otherItemUnit.trim())) {
      toast({ title: 'Complete the item details', description: 'Enter the item name and the unit you need.', variant: 'destructive' });
      return;
    }

    const data: CreateItemRequestData = {
      source,
      ...(source === 'catalog'
        ? { catalogItemId: selectedCatalogItem!.id }
        : { otherItemName: otherItemName.trim(), otherItemUnit: otherItemUnit.trim() }),
      quantity: parsedQuantity,
      reason: reason.trim(),
      neededBy: neededBy || undefined,
      useLocation: useLocation.trim() || undefined,
      operationId: operationId(),
    };
    try {
      await createRequest.mutateAsync(data);
      toast({ title: 'Request sent', description: 'A release officer has been notified.' });
      setOpen(false);
      reset();
    } catch (error) {
      toast({ title: 'Request not sent', description: error instanceof Error ? error.message : 'Try again shortly.', variant: 'destructive' });
    }
  };

  if (!canView) {
    return <div className="p-6 text-sm text-slate-600">You do not have permission to use Item Requests.</div>;
  }

  return (
    <div className="min-h-screen pb-10">
      <GlassPageTopBar
        title="Item Requests"
        subtitle="Request shared school items and follow the response without opening Inventory."
        backHref="/"
        backLabel="Dashboard"
        actions={
          <Button onClick={() => setOpen(true)} disabled={!canRequest} className="min-h-11 gap-2 bg-emerald-600 hover:bg-emerald-700">
            <PackagePlus className="h-4 w-4" />
            New request
          </Button>
        }
      />

      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5 sm:px-6">
        <Card className="border-emerald-100 bg-emerald-50/50">
          <CardContent className="flex gap-3 p-4 text-sm text-emerald-950">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <p>Choose a shared item when it is listed. If it is not listed, choose <strong>Other item</strong>; a release officer will review it before it is added to the shared catalogue.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">My requests</CardTitle>
            <CardDescription>Responses and reasons from the release team appear here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingRequests ? (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading requests…</div>
            ) : requests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">You have not requested any items yet.</div>
            ) : requests.map(item => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-slate-900">{item.quantity} {item.unit} of {item.itemName}</h2>
                    <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                  </div>
                  <Badge variant="outline" className={statusStyles[item.status]}>{statusLabels[item.status]}</Badge>
                </div>
                {(item.statusReason || item.neededBy || item.useLocation) && (
                  <div className="mt-3 grid gap-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {item.statusReason && <p><span className="font-medium">Response:</span> {item.statusReason}</p>}
                    {item.neededBy && <p><span className="font-medium">Needed by:</span> {item.neededBy}</p>}
                    {item.useLocation && <p><span className="font-medium">Use location:</span> {item.useLocation}</p>}
                  </div>
                )}
              </article>
            ))}
          </CardContent>
        </Card>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Request an item</DialogTitle>
            <DialogDescription>Only the item, quantity and reason are required. You will receive a notification when the request changes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Item source">
              <Button type="button" variant={source === 'catalog' ? 'default' : 'outline'} className="min-h-11" onClick={() => setSource('catalog')}>Shared items</Button>
              <Button type="button" variant={source === 'other' ? 'default' : 'outline'} className="min-h-11" onClick={() => setSource('other')}>Other item</Button>
            </div>

            {source === 'catalog' ? (
              <div className="space-y-2">
                <Label htmlFor="catalog-search">Choose from shared items</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input id="catalog-search" value={catalogSearch} onChange={event => setCatalogSearch(event.target.value)} placeholder="Search items" className="min-h-11 pl-9" autoComplete="off" />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200" role="listbox" aria-label="Shared items">
                  {loadingCatalog ? <p className="p-3 text-sm text-slate-500">Loading shared items…</p> : filteredCatalog.length === 0 ? <p className="p-3 text-sm text-slate-500">No matching item. Choose Other item if it is not listed.</p> : filteredCatalog.map(item => (
                    <button key={item.id} type="button" role="option" aria-selected={item.id === catalogItemId} onClick={() => { setCatalogItemId(item.id); setCatalogSearch(item.name); }} className={`flex min-h-11 w-full items-center justify-between gap-3 border-b border-slate-100 px-3 text-left text-sm last:border-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${item.id === catalogItemId ? 'bg-emerald-50 text-emerald-950' : 'hover:bg-slate-50'}`}>
                      <span className="font-medium">{item.name}</span><span className="text-slate-500">{item.standardUnit}</span>
                    </button>
                  ))}
                </div>
                {selectedCatalogItem && <p className="text-sm text-emerald-700">Selected: {selectedCatalogItem.name} ({selectedCatalogItem.standardUnit})</p>}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="other-name">Item name</Label><Input id="other-name" value={otherItemName} onChange={event => setOtherItemName(event.target.value)} placeholder="For example, whiteboard markers" className="min-h-11" /></div>
                <div className="space-y-2"><Label htmlFor="other-unit">Unit</Label><Input id="other-unit" value={otherItemUnit} onChange={event => setOtherItemUnit(event.target.value)} placeholder="For example, boxes" className="min-h-11" /></div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="quantity">Quantity</Label><Input id="quantity" value={quantity} onChange={event => setQuantity(event.target.value)} type="number" min="1" step="1" inputMode="numeric" className="min-h-11" /></div>
              <div className="space-y-2"><Label htmlFor="needed-by">Needed by <span className="font-normal text-slate-500">(optional)</span></Label><Input id="needed-by" value={neededBy} onChange={event => setNeededBy(event.target.value)} type="date" className="min-h-11" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="reason">Reason</Label><textarea id="reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain what the item will be used for." className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
            <div className="space-y-2"><Label htmlFor="location">Use location <span className="font-normal text-slate-500">(optional)</span></Label><Input id="location" value={useLocation} onChange={event => setUseLocation(event.target.value)} placeholder="For example, Primary Four classroom" className="min-h-11" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)} disabled={createRequest.isPending}>Cancel</Button>
            <Button type="button" className="min-h-11 bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={createRequest.isPending}>
              {createRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
