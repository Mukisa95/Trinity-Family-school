"use client";

import * as React from 'react';
import { fitTimetablePrintText, layoutTimetablePrintText } from '@/lib/utils/timetable-print-layout';

type Props = {
    text: string;
    direction?: 'horizontal' | 'vertical' | 'rotated';
    weight?: number;
};

/** Absolute label sizing does not change row heights or create wider table columns. */
export function TimetablePrintLabel({ text, direction = 'horizontal', weight = 700 }: Props) {
    const boxRef = React.useRef<HTMLDivElement>(null);
    const [layout, setLayout] = React.useState({ lines: [text], fontSize: 10 });
    const lines = React.useMemo(() => direction === 'vertical' ? Array.from(text.toUpperCase()) : [text], [direction, text]);

    React.useLayoutEffect(() => {
        const box = boxRef.current;
        if (!box) return;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;
        context.font = `${weight} 100px Arial, Helvetica, sans-serif`;
        let active = true;
        const update = () => {
            if (!active) return;
            const measure = (line: string) => {
                const measured = context.measureText(line || ' ');
                return { width: measured.width, height: (measured.actualBoundingBoxAscent || 72) + (measured.actualBoundingBoxDescent || 0) };
            };
            setLayout(direction === 'horizontal'
                ? layoutTimetablePrintText(text, box.clientWidth, box.clientHeight, measure)
                : { lines, fontSize: fitTimetablePrintText(lines, box.clientWidth, box.clientHeight, measure, direction) });
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(box);
        // Font loading must settle before the html2canvas capture.
        void document.fonts.ready.then(update);
        return () => { active = false; observer.disconnect(); };
    }, [direction, lines, text, weight]);

    return (
        <div ref={boxRef} data-printable-fit-box="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {direction === 'vertical' ? (
                <div data-printable-fit-text="true" aria-label={text} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', width: '100%', height: '100%', padding: '6% 0', boxSizing: 'border-box', fontSize: layout.fontSize, fontWeight: weight, lineHeight: 1 }}>
                    {lines.map((letter, index) => <span key={index} aria-hidden="true">{letter === ' ' ? '\u00a0' : letter}</span>)}
                </div>
            ) : (
                <span data-printable-fit-text="true" aria-label={text} style={{ display: 'block', whiteSpace: 'nowrap', textAlign: 'center', fontSize: layout.fontSize, fontWeight: weight, lineHeight: 1, transform: direction === 'rotated' ? 'rotate(-90deg)' : undefined }}>{layout.lines.map((line, index) => <span key={index} style={{ display: 'block' }}>{line}</span>)}</span>
            )}
        </div>
    );
}
