'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Link2, Loader2, PackagePlus, PackageSearch, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/contexts/auth-context';
import { useCreateAndLinkLegacyItems, useLinkLegacyItemsToCatalog, useSchoolItemCatalog } from '@/lib/hooks/use-item-catalog';
import { InventoryService } from '@/lib/services/inventory.service';
import { buildItemCatalogAudit, normalizeCatalogName } from '@/lib/utils/item-catalog';
import type { ItemCatalogMatchCandidate, ItemCatalogMatchStatus, ProcurementItem } from '@/types';

interface CatalogAuditPanelProps {
  procurementItems: ProcurementItem[];
  onProcurementItemsLinked: (itemIds: string[], catalogItemId: string) => void;
}

const statusLabel: Record<ItemCatalogMatchStatus, string> = {
  linked: 'Already linked',
  'catalog-link-conflict': 'Conflicting links',
  'exact-match': 'Ready to review',
  'unit-conflict': 'Unit conflict',
  'unmatched-procurement': 'Procurement only',
  'unmatched-inventory': 'Inventory only',
};

const statusTone: Record<ItemCatalogMatchStatus, string> = {
  linked: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200',
  'catalog-link-conflict': 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200',
  'exact-match': 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200',
  'unit-conflict': 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200',
  'unmatched-procurement': 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200',
  'unmatched-inventory': 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200',
};

/**
 * This panel is deliberately read-only. It only requests the legacy Inventory
 * list after staff choose to run the audit, then keeps the result in the
 * shared query cache instead of fetching again while the panel is viewed.
 */
export function CatalogAuditPanel({ procurementItems, onProcurementItemsLinked }: CatalogAuditPanelProps) {
  const { user } = useAuth();
  const [auditRequested, setAuditRequested] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<ItemCatalogMatchCandidate | null>(null);
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState('create');
  const [linkingError, setLinkingError] = useState<string | null>(null);
  const {
    data: inventoryItems = [],
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['item-catalog', 'legacy-audit', 'inventory-items'],
    queryFn: () => InventoryService.getItems(),
    enabled: auditRequested,
    staleTime: 5 * 60 * 1000,
  });
  const { data: catalogItems = [], isFetching: isCatalogFetching } = useSchoolItemCatalog({ enabled: auditRequested });
  const createAndLinkLegacyItems = useCreateAndLinkLegacyItems();
  const linkLegacyItems = useLinkLegacyItemsToCatalog();

  const audit = useMemo(
    () => auditRequested && !isError ? buildItemCatalogAudit(procurementItems, inventoryItems) : null,
    [auditRequested, inventoryItems, isError, procurementItems]
  );

  const needsReview = audit?.candidates.filter((candidate) => candidate.status !== 'linked') || [];

  const runAudit = () => {
    if (auditRequested) {
      void refetch();
      return;
    }
    setAuditRequested(true);
  };

  const openLinkDialog = (candidate: ItemCatalogMatchCandidate) => {
    setSelectedCandidate(candidate);
    setSelectedCatalogItemId('create');
    setLinkingError(null);
  };

  const closeLinkDialog = () => {
    if (createAndLinkLegacyItems.isPending || linkLegacyItems.isPending) return;
    setSelectedCandidate(null);
    setLinkingError(null);
  };

  const candidateUnit = selectedCandidate
    ? [...selectedCandidate.procurementItems, ...selectedCandidate.inventoryItems][0]?.unit
    : undefined;
  const compatibleCatalogItems = candidateUnit
    ? catalogItems.filter((item) => normalizeCatalogName(item.standardUnit) === candidateUnit)
    : [];
  const isLinking = createAndLinkLegacyItems.isPending || linkLegacyItems.isPending;

  const createOrLinkCandidate = async () => {
    if (!selectedCandidate || !candidateUnit) return;
    try {
      setLinkingError(null);
      const sourceItem = [...selectedCandidate.procurementItems, ...selectedCandidate.inventoryItems][0];
      if (!sourceItem) throw new Error('This catalogue candidate no longer has a legacy item to link. Refresh the audit.');

      const catalogItemId = selectedCatalogItemId === 'create'
        ? await createAndLinkLegacyItems.mutateAsync({
          name: sourceItem.name,
          standardUnit: candidateUnit,
          isStockTracked: selectedCandidate.inventoryItems.length > 0,
          isActive: [...selectedCandidate.procurementItems, ...selectedCandidate.inventoryItems].every((item) => item.isActive),
          createdBy: user?.username,
          procurementItemIds: selectedCandidate.procurementItems.map((item) => item.legacyItemId),
          inventoryItemIds: selectedCandidate.inventoryItems.map((item) => item.legacyItemId),
          linkedBy: user?.username,
          linkedByUserId: user?.id,
        })
        : selectedCatalogItemId;

      if (selectedCatalogItemId !== 'create') {
        await linkLegacyItems.mutateAsync({
          catalogItemId,
          procurementItemIds: selectedCandidate.procurementItems.map((item) => item.legacyItemId),
          inventoryItemIds: selectedCandidate.inventoryItems.map((item) => item.legacyItemId),
          linkedBy: user?.username,
          linkedByUserId: user?.id,
        });
      }

      onProcurementItemsLinked(
        selectedCandidate.procurementItems.map((item) => item.legacyItemId),
        catalogItemId
      );
      await refetch();
      setSelectedCandidate(null);
      toast({
        title: 'Catalogue link saved',
        description: 'The reviewed legacy items now point to one shared catalogue item. No purchase, stock, or movement data was changed.',
      });
    } catch (error) {
      setLinkingError(error instanceof Error ? error.message : 'The catalogue link could not be saved. No legacy item was changed.');
    }
  };

  return (
    <Card className="border-blue-100 bg-gradient-to-br from-white to-blue-50/60 shadow-sm dark:border-blue-950 dark:from-slate-950 dark:to-blue-950/20">
      <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageSearch className="h-4 w-4 text-blue-700 dark:text-blue-300" />
            Shared item catalogue audit
          </CardTitle>
          <CardDescription>
            Compare existing Procurement and Inventory item names without changing, merging, or deleting any data.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant={auditRequested ? 'outline' : 'default'}
          className="w-full shrink-0 sm:w-auto"
          onClick={runAudit}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : auditRequested ? <RefreshCw className="mr-2 h-4 w-4" /> : <PackageSearch className="mr-2 h-4 w-4" />}
          {isFetching ? 'Checking items' : auditRequested ? 'Refresh audit' : 'Run audit'}
        </Button>
      </CardHeader>

      {isError && (
        <CardContent className="pt-0">
          <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Inventory items could not be loaded. No data was changed; try the audit again when the connection is available.
          </div>
        </CardContent>
      )}

      {audit && !isError && (
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            {(Object.keys(statusLabel) as ItemCatalogMatchStatus[]).map((status) => (
              <div key={status} className={`rounded-lg border p-3 ${statusTone[status]}`}>
                <p className="text-[11px] font-medium leading-tight">{statusLabel[status]}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{audit.counts[status]}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Procurement duplicates {audit.duplicateProcurementItems.length}</Badge>
            <Badge variant="outline">Inventory duplicates {audit.duplicateInventoryItems.length}</Badge>
            <span className="self-center">A matching name is only a review suggestion. Different units are never merged automatically.</span>
          </div>

          {needsReview.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                First items requiring a decision
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {needsReview.slice(0, 8).map((candidate) => (
                  <div key={candidate.key} className="rounded-md border bg-background/80 p-3 text-sm dark:bg-slate-950/50">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium capitalize">{candidate.normalizedName}</p>
                      <Badge variant="outline" className="shrink-0">{statusLabel[candidate.status]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{candidate.recommendedAction}</p>
                    {(candidate.status === 'exact-match' || candidate.status === 'unmatched-procurement' || candidate.status === 'unmatched-inventory') && (
                      <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={() => openLinkDialog(candidate)}>
                        <Link2 className="mr-2 h-3.5 w-3.5" />
                        Review and link
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {needsReview.length > 8 && (
                <p className="text-xs text-muted-foreground">Showing 8 of {needsReview.length} items requiring review.</p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              All audited records are already linked to one shared catalogue identity.
            </div>
          )}

          {audit.counts.linked > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
              Linked records remain visible in their legacy lists while the catalogue migration is reviewed.
            </div>
          )}
        </CardContent>
      )}

      <Dialog open={Boolean(selectedCandidate)} onOpenChange={(open) => !open && closeLinkDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review shared catalogue link</DialogTitle>
            <DialogDescription>
              This links reviewed legacy item records to one shared catalogue identity. It does not change quantities, purchase totals, receipts, or transaction history.
            </DialogDescription>
          </DialogHeader>

          {selectedCandidate && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">{selectedCandidate.procurementItems[0]?.name || selectedCandidate.inventoryItems[0]?.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Unit {candidateUnit} · Procurement records {selectedCandidate.procurementItems.length} · Inventory records {selectedCandidate.inventoryItems.length}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="catalogue-target">Shared catalogue item</Label>
                <Select value={selectedCatalogItemId} onValueChange={setSelectedCatalogItemId} disabled={isLinking || isCatalogFetching}>
                  <SelectTrigger id="catalogue-target">
                    <SelectValue placeholder="Choose how to link this item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create">Create a new shared catalogue item</SelectItem>
                    {compatibleCatalogItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name} · {item.standardUnit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only existing catalogue items with the same standard unit are shown. Unit conversions need a separate review.
                </p>
              </div>

              {linkingError && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {linkingError}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeLinkDialog} disabled={isLinking}>Cancel</Button>
            <Button type="button" onClick={() => void createOrLinkCandidate()} disabled={isLinking || isCatalogFetching}>
              {isLinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}
              {selectedCatalogItemId === 'create' ? 'Create and link' : 'Link selected item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
