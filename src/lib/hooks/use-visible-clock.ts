'use client';

import { useEffect, useState } from 'react';

/** Keep live time accurate, without waking every hidden dashboard/profile. */
export function useVisibleClock(intervalMs = 1_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (timer) clearTimeout(timer);
      if (document.visibilityState === 'hidden') return;
      setNow(new Date());
      timer = setTimeout(tick, intervalMs - Date.now() % intervalMs);
    };
    const visibility = () => { if (timer) clearTimeout(timer); tick(); };
    tick();
    document.addEventListener('visibilitychange', visibility);
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [intervalMs]);
  return now;
}
