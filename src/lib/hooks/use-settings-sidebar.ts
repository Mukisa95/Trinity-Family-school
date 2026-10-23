'use client';

import { useEffect, useRef } from 'react';

/** Give settings its own navigation column, then restore the workspace sidebar on exit. */
export function useSettingsSidebar(enabled: boolean, open: boolean, setOpen?: (open: boolean) => void) {
  const latest = useRef({ open, setOpen });
  latest.current = { open, setOpen };
  useEffect(() => {
    if (!enabled || !latest.current.setOpen) return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    let previous: boolean | undefined;
    const update = () => {
      if (desktop.matches && previous === undefined) {
        previous = latest.current.open;
        latest.current.setOpen?.(false);
      } else if (!desktop.matches && previous !== undefined) {
        const restore = previous; previous = undefined;
        latest.current.setOpen?.(restore);
      }
    };
    update();
    desktop.addEventListener('change', update);
    return () => {
      desktop.removeEventListener('change', update);
      if (previous !== undefined) latest.current.setOpen?.(previous);
    };
  }, [enabled, Boolean(setOpen)]);
}
