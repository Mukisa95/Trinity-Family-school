'use client';

import { Loader2, PackagePlus, ReceiptText, ShoppingCart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useProcurementRestockQueue } from '@/lib/hooks/use-procurement-restock';
import { ProcurementRestockService } from '@/lib/services/procurement-restock.service';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProcurementRestockRequest } from '@/types';

interface RestockRequestPanelProps {
  onRecordPurchase: (request: ProcurementRestockRequest) => void;
}

function formatDate(value?: string) {
  if (!value) return 'Recently';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function RestockRequestPanel({ onRecordPurchase }: RestockRequestPanelProps) {
  const { data: requests = [], isLoading, isError, error, refetch, isFetching } = useProcurementRestockQueue();
  const queryClient = useQueryClient();
  const confirmPurchase = useMutation({
    mutationFn: ({ restockRequestId, purchaseId }: { restockRequestId: string; purchaseId: string }) => ProcurementRestockService.linkPurchase(restockRequestId, purchaseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procurement', 'restock-queue'] }),
  });
  const waitingForReceipt = requests.filter(request => request.status === 'purchased');
  const waitingForPurchase = requests.filter(request => request.status === 'submitted');

  return (
    <section className="space-y-4" aria-label="Restock instructions">
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-amber-950">
        <div className="flex items-start gap-3">
          <PackagePlus className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-base font-bold">Staff-requested restocks</h2>
            <p className="mt-1 text-sm leading-5">Record the real purchase here first. When the goods arrive, receive them in Inventory; the release officer will then be reminded to issue them to the staff member.</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center rounded-xl border bg-white text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading restock work…</div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p>{error instanceof Error ? error.message : 'The restock queue could not be loaded.'}</p>
          <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">There are no staff-requested restocks waiting for Procurement.</div>
      ) : (
        <>
          {waitingForPurchase.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Needs a purchase ({waitingForPurchase.length})</h3>
              {waitingForPurchase.map(request => <RestockCard key={request.id} request={request} onRecordPurchase={onRecordPurchase} onConfirmPurchase={(restockRequestId, purchaseId) => confirmPurchase.mutate({ restockRequestId, purchaseId })} confirming={confirmPurchase.isPending} />)}
            </div>
          )}
          {waitingForReceipt.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Purchased — waiting to receive in Inventory ({waitingForReceipt.length})</h3>
              {waitingForReceipt.map(request => <RestockCard key={request.id} request={request} onRecordPurchase={onRecordPurchase} />)}
            </div>
          )}
        </>
      )}
      {!isLoading && !isError && (
        <Button type="button" variant="ghost" className="min-h-11" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Refresh list
        </Button>
      )}
      {confirmPurchase.isError && (
        <p role="alert" className="text-sm text-destructive">{confirmPurchase.error instanceof Error ? confirmPurchase.error.message : 'The purchase could not be confirmed. Try again without creating another purchase.'}</p>
      )}
    </section>
  );
}

function RestockCard({ request, onRecordPurchase, onConfirmPurchase, confirming }: { request: ProcurementRestockRequest; onRecordPurchase: (request: ProcurementRestockRequest) => void; onConfirmPurchase: (restockRequestId: string, purchaseId: string) => void; confirming: boolean }) {
  const purchased = request.status === 'purchased';
  return (
    <article className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-slate-950">{request.itemName}</h4>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${purchased ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-900'}`}>
              {purchased ? 'Purchase recorded' : 'Needs purchase'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-700"><strong>{request.requestedQuantity} {request.unit}</strong> for {request.requestedByName}</p>
          <p className="mt-1 text-xs text-muted-foreground">Restock instruction created {formatDate(request.createdAt)}.</p>
        </div>
        {purchased ? (
          <div className="flex min-h-11 items-center gap-2 rounded-md bg-sky-50 px-3 text-sm font-medium text-sky-900"><ReceiptText className="h-4 w-4" aria-hidden="true" /> Receive the stock in Inventory</div>
        ) : request.unlinkedPurchaseId ? (
          <Button type="button" className="min-h-11 shrink-0" disabled={confirming} onClick={() => onConfirmPurchase(request.id, request.unlinkedPurchaseId!)}>
            {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" aria-hidden="true" />}Confirm recorded purchase
          </Button>
        ) : (
          <Button type="button" className="min-h-11 shrink-0" onClick={() => onRecordPurchase(request)}>
            <ShoppingCart className="mr-2 h-4 w-4" aria-hidden="true" />Record purchase
          </Button>
        )}
      </div>
    </article>
  );
}
