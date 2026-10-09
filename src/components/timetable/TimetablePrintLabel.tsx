"use client";

import * as React from 'react';
import { fitTimetablePrintText, layoutTimetablePrintText } from '@/lib/utils/timetable-print-layout';

type Props = {
    text: string;
    direction?: 'horizontal' | 'vertical' | 'rotated';
    weight?: number;
};

/** The preview and html2canvas export share these exact pixels and glyph positions. */
export function TimetablePrintLabel({ text, direction = 'horizontal', weight = 700 }: Props) {
    const boxRef = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    React.useLayoutEffect(() => {
        const box = boxRef.current;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!box || !canvas || !context) return;
        let active = true;
        const update = () => {
            if (!active) return;
            const width = box.clientWidth;
            const height = box.clientHeight;
            if (!width || !height) return;
            // Fixed resolution keeps even a scaled mobile preview sharp in the PDF.
            canvas.width = width * 2;
            canvas.height = height * 2;
            context.scale(2, 2);
            context.font = `${weight} 100px Arial, Helvetica, sans-serif`;
            const measure = (line: string) => {
                const metrics = context.measureText(line || ' ');
                return { width: metrics.width, height: (metrics.actualBoundingBoxAscent || 72) + (metrics.actualBoundingBoxDescent || 0) };
            };
            const letters = Array.from(text.toUpperCase());
            const layout = direction === 'horizontal'
                ? layoutTimetablePrintText(text, width, height, measure)
                : { lines: direction === 'vertical' ? letters : [text], fontSize: fitTimetablePrintText(direction === 'vertical' ? letters : [text], width, height, measure, direction) };
            context.font = `${weight} ${layout.fontSize}px Arial, Helvetica, sans-serif`;
            context.fillStyle = getComputedStyle(box).color;
            context.textAlign = 'center';
            context.textBaseline = 'alphabetic';
            canvas.dataset.fontSize = String(layout.fontSize);
            canvas.dataset.lineCount = String(layout.lines.length);
            const drawCentered = (line: string, x: number, y: number) => {
                const metrics = context.measureText(line);
                // Center the actual ink, including descenders, rather than the CSS line box.
                const ascent = metrics.actualBoundingBoxAscent;
                const descent = metrics.actualBoundingBoxDescent;
                context.fillText(line, x, y + (ascent - descent) / 2);
            };
            if (direction === 'vertical') {
                const inset = height * 0.08;
                const step = (height - inset * 2) / Math.max(1, letters.length);
                letters.forEach((letter, index) => drawCentered(letter, width / 2, inset + step * (index + 0.5)));
            } else {
                context.translate(width / 2, height / 2);
                if (direction === 'rotated') context.rotate(-Math.PI / 2);
                const step = layout.fontSize * 1.15;
                layout.lines.forEach((line, index) => drawCentered(line, 0, (index - (layout.lines.length - 1) / 2) * step));
            }
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(box);
        void document.fonts.ready.then(update);
        return () => { active = false; observer.disconnect(); };
    }, [direction, text, weight]);

    return (
        <div ref={boxRef} data-printable-fit-box="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 1 }}>
            <canvas ref={canvasRef} data-printable-fit-text="true" data-printable-label-canvas="true" role="img" aria-label={text} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
        </div>
    );
}
