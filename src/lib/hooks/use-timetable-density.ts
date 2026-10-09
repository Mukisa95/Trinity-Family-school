"use client";

import { useEffect, useState } from 'react';

/** Match the toolbar's mobile breakpoint without changing the user's zoom. */
export function useTimetableDensity() {
    const [compact, setCompact] = useState(false);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 639px)');
        const update = () => setCompact(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);
    return compact;
}
