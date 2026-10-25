"use client";

import * as React from "react";
import { layoutTimetablePrintText } from "@/lib/utils/timetable-print-layout";

type FittedTimetableActivityLabelProps = {
    text: string;
    className?: string;
};

/**
 * Mirrors the PDF label fitter for a shared activity card. A one-word activity
 * always stays on one line; longer names only split when that increases the
 * largest readable font size.
 */
export function FittedTimetableActivityLabel({ text, className = "" }: FittedTimetableActivityLabelProps) {
    const boxRef = React.useRef<HTMLDivElement>(null);
    const [layout, setLayout] = React.useState({ lines: [text], fontSize: 12 });

    React.useLayoutEffect(() => {
        const box = boxRef.current;
        if (!box || !text) return;
        let active = true;
        const update = () => {
            if (!active) return;
            const width = box.clientWidth;
            const height = box.clientHeight;
            if (!width || !height) return;

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) return;
            context.font = "900 100px Arial, Helvetica, sans-serif";
            const measure = (line: string) => {
                const metrics = context.measureText(line || " ");
                return {
                    width: metrics.width,
                    height: (metrics.actualBoundingBoxAscent || 72) + (metrics.actualBoundingBoxDescent || 0),
                };
            };
            const next = layoutTimetablePrintText(text, width, height, measure);
            setLayout(current => (
                current.fontSize === next.fontSize && current.lines.join("\n") === next.lines.join("\n")
                    ? current
                    : next
            ));
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(box);
        void document.fonts?.ready.then(update);
        return () => {
            active = false;
            observer.disconnect();
        };
    }, [text]);

    return (
        <div ref={boxRef} className={`flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden ${className}`}>
            {layout.lines.map((line, index) => (
                <span
                    key={`${line}-${index}`}
                    className="block max-w-full whitespace-nowrap"
                    style={{ fontSize: layout.fontSize, lineHeight: 1.1 }}
                >
                    {line}
                </span>
            ))}
        </div>
    );
}
