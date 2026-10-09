"use client";

import * as React from "react";
import { format } from "date-fns";

export function TimetableClock() {
    const [now, setNow] = React.useState<Date | null>(null);
    React.useEffect(() => {
        const update = () => setNow(new Date());
        update();
        const interval = window.setInterval(update, 1000);
        document.addEventListener('visibilitychange', update);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', update);
        };
    }, []);
    return <time aria-label="Current time" dateTime={now?.toISOString()} className="shrink-0 whitespace-nowrap font-mono text-[10px] font-semibold tabular-nums text-slate-600">
        {now ? format(now, 'HH:mm:ss') : '--:--:--'}
    </time>;
}
