'use client';

import { useQuery } from '@tanstack/react-query';

export function SavedPupilDataNotice() {
  const { data } = useQuery({
    queryKey: ['pupils', 'hydration'],
    queryFn: async () => 'loading',
    enabled: false,
    staleTime: Infinity,
  });
  if (data !== 'saved') return null;
  return (
    <p role="status" className="my-2 px-1 text-xs text-slate-500 dark:text-slate-400 print:hidden">
      Showing saved pupil data. Updates appear automatically when connected.
    </p>
  );
}
