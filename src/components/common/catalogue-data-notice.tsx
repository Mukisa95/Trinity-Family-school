'use client';

export function CatalogueDataNotice({ label, saved, refreshing, error, hasData, retry }: {
  label: string; saved?: boolean; refreshing?: boolean; error?: unknown; hasData: boolean; retry: () => unknown;
}) {
  if (!saved && !refreshing && !error) return null;
  return <div role="status" className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground print:hidden">
    {error ? hasData ? `Showing saved ${label}. Updates will retry when connected.` : `${label} could not load. Please reconnect or retry.`
      : saved ? `Showing saved ${label}. Updates appear automatically when connected.` : `Checking for ${label} updates…`}
    {!!error && <button type="button" className="ml-2 min-h-10 underline" disabled={refreshing} onClick={() => void retry()}>Retry</button>}
  </div>;
}
