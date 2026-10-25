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
        const context = document.createElement("canvas").getContext("2d");
        if (!context) return;
        let active = true;
        const update = () => {
            if (!active) return;
            const width = box.clientWidth;
            const height = box.clientHeight;
            if (!width || !height) return;

            const style = getComputedStyle(box);
            const displayText = style.textTransform === "uppercase" ? text.toUpperCase() : text;
            context.font = `${style.fontWeight} 100px ${style.fontFamily}`;
            const measure = (line: string) => {
                const metrics = context.measureText(line || " ");
                return {
                    width: metrics.width,
                    height: (metrics.actualBoundingBoxAscent || 72) + (metrics.actualBoundingBoxDescent || 0),
                };
            };
            const next = layoutTimetablePrintText(displayText, width, height, measure);
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
        <div
            ref={boxRef}
            data-timetable-activity-label="true"
            className={`flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center self-stretch overflow-hidden ${className}`}
            style={{ letterSpacing: 'normal' }}
        >
            {layout.lines.map((line, index) => (
                <span
                    key={`${line}-${index}`}
                    className="block max-w-full shrink-0 whitespace-nowrap"
                    style={{ fontSize: layout.fontSize, lineHeight: 1.1 }}
                >
                    {line}
                </span>
            ))}
        </div>
    );
}
