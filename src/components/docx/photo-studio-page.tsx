"use client";

import { useEffect, useMemo, useRef } from 'react';
import { Loader2, WandSparkles } from 'lucide-react';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { usePhotoStudioWorkspace } from '@/lib/contexts/photo-studio-workspace-context';
import type { Pupil } from '@/types';
import { Button } from '@/components/ui/button';

const EMPTY_PUPILS: Pupil[] = [];

export function PhotoStudioPage() {
  const { data: pupils = EMPTY_PUPILS, isLoading, isError, refetch } = usePupils();
  const { data: schoolSettings } = useSchoolSettings();
  const { openStudio, syncStudioData, suspended } = usePhotoStudioWorkspace();
  const launched = useRef(false);
  const data = useMemo(() => ({ pupils, schoolSettings, schoolBadge: schoolSettings?.generalInfo?.logo || '/icons/trinity-badge-72.png' }), [pupils, schoolSettings]);
  useEffect(() => {
    if (isLoading || isError || suspended) return;
    if (!launched.current) { launched.current = true; openStudio(data); }
    else syncStudioData(data);
  }, [isLoading, isError, suspended, data, openStudio, syncStudioData]);

  return <div className="grid min-h-[40dvh] place-items-center">
    {isLoading ? <Loader2 role="status" aria-label="Loading Photo Studio" className="h-7 w-7 animate-spin" /> : isError ? <Button variant="outline" onClick={() => refetch()}>Retry loading pupils</Button> : <Button aria-label="Custom Photo Studio" onClick={() => openStudio(data)}><WandSparkles className="mr-2 h-4 w-4" />Photo Studio</Button>}
  </div>;
}
