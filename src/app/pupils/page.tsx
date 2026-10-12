"use client";

import { Suspense, startTransition, useEffect, useState, type ComponentType } from 'react';
import { CachedPupilsList } from '@/components/pupils/cached-pupils-list';

export default function PupilsPage() {
  const [Management, setManagement] = useState<ComponentType | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    // Mount the canonical cached list first. Optional management code cannot
    // hold it behind a route skeleton, including when its chunk is unavailable.
    import('./pupils-management').then(module => {
      if (!cancelled) startTransition(() => setManagement(() => module.default));
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [attempt]);

  return <Suspense fallback={<CachedPupilsList />}>
    {Management ? <Management /> : <>
      <CachedPupilsList preparingManagement={!loadError} />
      {loadError && <div className="mx-auto max-w-7xl px-3 pb-6 text-sm text-muted-foreground sm:px-6">
        <p>Additional management tools could not open. You can still use the pupil list.</p>
        <button type="button" className="mt-2 rounded-lg border bg-card px-3 py-2" onClick={() => {
          setLoadError(false); setAttempt(value => value + 1);
        }}>Retry management tools</button>
      </div>}
    </>}
  </Suspense>;
}
