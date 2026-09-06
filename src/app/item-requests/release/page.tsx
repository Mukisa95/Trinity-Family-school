'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Compatibility route for old bookmarks and already-delivered notifications.
 * The release workflow now lives inside Inventory.
 */
export default function LegacyItemReleaseQueuePage() {
  const router = useRouter();

  useEffect(() => {
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set('tab', 'release');
    router.replace(`/inventory?${nextParams.toString()}`);
  }, [router]);

  return (
    <div className="flex min-h-[50dvh] items-center justify-center gap-2 px-4 text-sm text-slate-600" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> Opening the Inventory release queue…
    </div>
  );
}
