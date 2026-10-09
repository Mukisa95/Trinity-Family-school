"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import type { TimetableEntry, GeneratedPeriod, Class, Subject, Staff, TimetableProfile } from "@/types";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import { usePDFViewer } from "@/lib/hooks/use-pdf-viewer";
import { buildTimetableClassRowsForDay } from "@/lib/utils/timetable-streams";
import { buildTimetablePrintDayCells, isTimetablePrintBreak } from "@/lib/utils/timetable-print-layout";
import { TimetablePrintLabel } from "@/components/timetable/TimetablePrintLabel";

const DAYS = [
    { id: 1, label: "MON" },
    { id: 2, label: "TUE" },
    { id: 3, label: "WED" },
    { id: 4, label: "THUR" },
    { id: 5, label: "FRI" },
    { id: 6, label: "SAT" },
];

function parseTimeStr(t: string): number {
    const parts = (t || "").split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

interface PrintableTimetableProps {
    entries: TimetableEntry[];
    periods: GeneratedPeriod[];
    classes: Class[];
    subjects: Subject[];
    staffList: Staff[];
    academicYearId: string;
    profile?: Pick<TimetableProfile, "streamLayouts">;
    timeFormat?: "12h" | "24h";
    onClose: () => void;
}

// Fixed canvas renders at this size for crisp PDF output
// RENDER_HEIGHT is calculated to match A4 landscape with 5mm margins: 287/200 aspect
const RENDER_WIDTH = 1400;
const RENDER_HEIGHT = 976;
const DAY_COLUMN_WIDTH = 65;
const CLASS_COLUMN_WIDTH = 118;
const BREAK_COLUMN_WIDTH = 64;

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}

export function PrintableTimetable({
    entries,
    periods,
    classes,
    subjects,
    staffList,
    academicYearId,
    profile,
    timeFormat,
    onClose,
}: PrintableTimetableProps) {
    const { data: schoolSettings } = useSchoolSettings();
    const pdfViewer = usePDFViewer();
    const captureRef = React.useRef<HTMLDivElement>(null);
    const [status, setStatus] = React.useState<"idle" | "generating" | "done" | "error">("idle");

    // ── Scale preview to fit the screen ───────────────────────────────────────
    const [scale, setScale] = React.useState(1);
    React.useEffect(() => {
        function compute() {
            const MARGIN = 80; // screen preview padding
            const sx = (window.innerWidth - MARGIN * 2) / RENDER_WIDTH;
            const sy = (window.innerHeight - MARGIN * 2) / RENDER_HEIGHT;
            setScale(Math.min(sx, sy, 1));
        }
        compute();
        window.addEventListener("resize", compute);
        return () => window.removeEventListener("resize", compute);
    }, []);

    // ── Data helpers ──────────────────────────────────────────────────────────
    const fmt = (t: string) => {
        if (!t) return "";
        try { return format(parse(t, "HH:mm", new Date()), "h:mm a"); } catch { return t; }
    };
    const fmtShort = (t: string) => {
        if (!t) return "";
        try { return format(parse(t, "HH:mm", new Date()), "h:mm"); } catch { return t; }
    };

    const templatePeriods = React.useMemo(
        () =>
            periods
                .filter((p) => p.dayOfWeek === 1)
                .sort((a, b) => parseTimeStr(a.startTime) - parseTimeStr(b.startTime)),
        [periods]
    );

    const visibleDays = React.useMemo(
        () => DAYS.filter((day) => periods.some((period) => period.dayOfWeek === day.id)),
        [periods],
    );

    const rowsByDay = React.useMemo(
        () => new Map(visibleDays.map(day => ([
            day.id,
            buildTimetableClassRowsForDay(classes, profile, academicYearId, day.id, periods),
        ] as const))),
        [academicYearId, classes, periods, profile, visibleDays],
    );

    const cellsByDay = React.useMemo(() => new Map(visibleDays.map(day => ([
        day.id,
        buildTimetablePrintDayCells(rowsByDay.get(day.id) || [], templatePeriods, periods, entries, day.id, profile),
    ] as const))), [entries, periods, profile, rowsByDay, templatePeriods, visibleDays]);

    const generatePDF = async () => {
        if (!captureRef.current || status === "generating") return;
        setStatus("generating");
        try {
            const date = new Date().toISOString().slice(0, 10);
            await pdfViewer.runPDFJob(
                {
                    fileName: `school-timetable-${date}.pdf`,
                    title: 'School Timetable',
                    initialMessage: 'Preparing timetable canvas…',
                },
                async ({ updateProgress }) => {
                    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                        import("html2canvas"),
                        import("jspdf"),
                    ]);
                    updateProgress(18, 'Capturing timetable layout…');
                    if (!captureRef.current) throw new Error('Timetable preview is no longer available.');
                    await document.fonts.ready;
                    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
                    const canvas = await html2canvas(captureRef.current, {
                        scale: 1.5,
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: "#ffffff",
                        logging: false,
                        width: RENDER_WIDTH,
                        height: RENDER_HEIGHT,
                    });

                    // The capture is now independent of this overlay, so the app can be used
                    // while the PDF is finalized in the persistent workspace.
                    onClose();
                    updateProgress(72, 'Building the landscape PDF page…');
                    const PAGE_W = 297;
                    const PAGE_H = 210;
                    const MARGIN = 5;
                    const availW = PAGE_W - MARGIN * 2;
                    const availH = PAGE_H - MARGIN * 2;
                    const canvasAspect = canvas.width / canvas.height;
                    let imgW = availW;
                    let imgH = availW / canvasAspect;
                    if (imgH > availH) {
                        imgH = availH;
                        imgW = availH * canvasAspect;
                    }
                    const offsetX = MARGIN + (availW - imgW) / 2;
                    const offsetY = MARGIN + (availH - imgH) / 2;
                    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
                    pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", offsetX, offsetY, imgW, imgH);
                    updateProgress(96, 'Finalizing timetable…');
                    return pdf.output("blob");
                },
            );

            setStatus("done");
        } catch (err) {
            console.error("PDF generation error:", err);
            setStatus("error");
        }
    };

    // ── Auto-generate on mount ────────────────────────────────────────────────
    React.useEffect(() => {
        // Short delay so the hidden div renders before we capture it
        const t = setTimeout(() => generatePDF(), 700);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (templatePeriods.length === 0 || visibleDays.length === 0) {
        return (
            <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center gap-4">
                <p>No timetable data.</p>
                <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded">Close</button>
            </div>
        );
    }

    // ── Shared inline styles ──────────────────────────────────────────────────
    const bd = "1px solid #000";
    const bdBold = "2px solid #000";
    const bdClass = "1px solid #666";
    const bdDay = "2.5px solid #000";
    const bdStream = "0.5px solid #555";

    const logoUrl = schoolSettings?.generalInfo?.logo;

    // ── Dynamic sizing based on both table dimensions ─────────────────────────
    const totalRows = Array.from(rowsByDay.values()).reduce((sum, dayRows) => sum + dayRows.length, 0);
    const breakPeriodCount = templatePeriods.filter(isTimetablePrintBreak).length;
    const lessonPeriodCount = Math.max(1, templatePeriods.length - breakPeriodCount);
    const availableLessonWidth = RENDER_WIDTH - 24 - DAY_COLUMN_WIDTH - CLASS_COLUMN_WIDTH - (breakPeriodCount * BREAK_COLUMN_WIDTH);
    const estimatedLessonColumnWidth = Math.max(48, availableLessonWidth / lessonPeriodCount);
    const timeFs = clamp(Math.round(estimatedLessonColumnWidth / 6.2), 11, 22);
    const breakTimeFs = clamp(Math.round(BREAK_COLUMN_WIDTH / 4.8), 10, 14);
    const headerHeight = clamp(Math.round(timeFs * 2.35 + 12), 54, 72);
    const estimatedBodyHeight = RENDER_HEIGHT - 20 - 42 - headerHeight;
    const estimatedRowHeight = estimatedBodyHeight / Math.max(1, totalRows);
    const rowBorder = (dayRows: ReturnType<typeof buildTimetableClassRowsForDay>, lastRowIndex: number) => {
        if (lastRowIndex === dayRows.length - 1) return bdDay;
        return dayRows[lastRowIndex]?.classItem.id === dayRows[lastRowIndex + 1]?.classItem.id ? bdStream : bdClass;
    };

    const timetableContent = (
        <div
            style={{
                width: RENDER_WIDTH,
                height: RENDER_HEIGHT,
                display: "flex",
                flexDirection: "column",
                fontFamily: "Arial, Helvetica, sans-serif",
                background: "#fff",
                color: "#000",
                padding: "10px 12px",
                boxSizing: "border-box",
                position: "relative",
            }}
        >
            {/* Watermark logo - properly aligned, grayscale, prominent */}
            {logoUrl && (
                <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    zIndex: 0,
                    opacity: 0.12,
                    filter: "grayscale(100%)",
                }}>
                    <img src={logoUrl} alt="Watermark" crossOrigin="anonymous" style={{ maxWidth: "60%", maxHeight: "60%", width: "auto", height: "auto" }} />
                </div>
            )}

            {/* Header — name only, no logo */}
            <div style={{ textAlign: "center", marginBottom: 12, position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
                    {schoolSettings?.generalInfo?.name || "SCHOOL NAME"}
                </div>
            </div>

            {/* Table */}
            <table
                style={{
                    flex: 1,
                    width: "100%",
                    borderCollapse: "collapse",
                    border: bdBold,
                    tableLayout: "fixed",
                    fontSize: 12,
                    lineHeight: 1.2,
                    position: "relative",
                    zIndex: 1,
                }}
            >
                <colgroup>
                    <col style={{ width: DAY_COLUMN_WIDTH }} /> {/* Day — wider for big rotated text */}
                    <col style={{ width: CLASS_COLUMN_WIDTH }} /> {/* Composite class / stream labels */}
                    {templatePeriods.map((p) => {
                        const isBreak = p.type === "break" || p.type === "lunch" || p.type === "assembly";
                        return <col key={p.id} style={{ width: isBreak ? BREAK_COLUMN_WIDTH : undefined }} />;
                    })}
                </colgroup>

                <thead>
                    <tr style={{ height: headerHeight / 2 }}>
                        <th rowSpan={2} style={{ border: bdBold, height: headerHeight, padding: 0 }} />
                        <th rowSpan={2} style={{ border: bd, height: headerHeight, padding: 0 }}>
                            {/* Intentionally left blank */}
                        </th>
                        {templatePeriods.map((p) => {
                            const isBreak = p.type === "break" || p.type === "lunch" || p.type === "assembly";
                            const periodTimeFs = isBreak ? breakTimeFs : timeFs;
                            return (
                                <th
                                    key={p.id}
                                    data-printable-time-cell="start"
                                    style={{
                                        border: bd,
                                        height: headerHeight / 2,
                                        padding: 0,
                                        position: "relative",
                                        boxSizing: "border-box",
                                        fontWeight: 700,
                                        fontSize: periodTimeFs,
                                        lineHeight: 1.2,
                                        textAlign: "center",
                                        verticalAlign: "middle",
                                        whiteSpace: "nowrap",
                                        background: isBreak ? "#e8e8e8" : "#fff",
                                    }}
                                >
                                    <TimetablePrintLabel text={isBreak ? fmtShort(p.startTime) : fmt(p.startTime)} />
                                </th>
                            );
                        })}
                    </tr>
                    <tr style={{ height: headerHeight / 2 }}>
                        {templatePeriods.map((p) => {
                            const isBreak = p.type === "break" || p.type === "lunch" || p.type === "assembly";
                            const periodTimeFs = isBreak ? breakTimeFs : timeFs;
                            return (
                                <th
                                    key={p.id}
                                    data-printable-time-cell="end"
                                    style={{
                                        border: bd,
                                        height: headerHeight / 2,
                                        padding: 0,
                                        position: "relative",
                                        boxSizing: "border-box",
                                        fontWeight: 700,
                                        fontSize: periodTimeFs,
                                        lineHeight: 1.2,
                                        textAlign: "center",
                                        verticalAlign: "middle",
                                        whiteSpace: "nowrap",
                                        background: isBreak ? "#e8e8e8" : "#fff",
                                    }}
                                >
                                    <TimetablePrintLabel text={isBreak ? fmtShort(p.endTime) : fmt(p.endTime)} />
                                </th>
                            );
                        })}
                    </tr>
                </thead>

                <tbody>
                    {/* Stream rows are day-aware: a class expands only when that day contains a separated lesson. */}
                    {visibleDays.map((day, dayIdx) => {
                        const dayRows = rowsByDay.get(day.id) || [];
                        return (
                            <React.Fragment key={day.id}>
                                {dayRows.map((row, rowIdx) => {
                                    const cls = row.classItem;
                                    const classStreamRows = row.stream
                                        ? dayRows.filter(candidate => candidate.classItem.id === cls.id && candidate.stream)
                                        : [];
                                    const rowBottomBorder = rowBorder(dayRows, rowIdx);
                                    const spanningBottomBorder = rowBorder(dayRows, rowIdx + row.streamCount - 1);
                                    return (
                                        <tr key={`${day.id}-${cls.id}-${row.stream?.id || 'all'}`} style={{ height: estimatedRowHeight }}>
                                            {rowIdx === 0 && (
                                                <td
                                                    rowSpan={dayRows.length}
                                                    style={{
                                                        borderTop: dayIdx === 0 ? bdBold : "none",
                                                        borderBottom: bdDay,
                                                        borderLeft: bdBold,
                                                        borderRight: bdBold,
                                                        fontWeight: 900,
                                                        textAlign: "center",
                                                        verticalAlign: "middle",
                                                        padding: 0,
                                                        overflow: "hidden",
                                                        position: "relative",
                                                    }}
                                                >
                                                    <TimetablePrintLabel text={day.label} direction="rotated" weight={900} />
                                                </td>
                                            )}

                                            {(!row.stream || row.streamIndex === 0) && (
                                                <td
                                                    rowSpan={row.stream ? row.streamCount : undefined}
                                                    style={{
                                                        borderTop: "none",
                                                        borderBottom: row.stream ? spanningBottomBorder : rowBottomBorder,
                                                        borderLeft: bd,
                                                        borderRight: bd,
                                                        fontWeight: 700,
                                                        textAlign: "center",
                                                        padding: 0,
                                                        position: "relative",
                                                        whiteSpace: "normal",
                                                        verticalAlign: "middle",
                                                    }}
                                                >
                                                    {row.stream ? (
                                                        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                                                            <div style={{ flex: "0 0 67%", minWidth: 0, position: "relative", borderRight: bdStream }}>
                                                                <TimetablePrintLabel text={cls.code || cls.name} />
                                                            </div>
                                                            <div style={{ flex: "1 1 33%", minWidth: 0, display: "flex", flexDirection: "column", background: "#eef2ff" }}>
                                                                {classStreamRows.map((streamRow, streamRowIndex) => (
                                                                    <div key={streamRow.stream!.id} data-printable-stream-label="true" style={{ flex: "1 1 0", minHeight: 0, position: "relative", color: "#4338ca", borderBottom: streamRowIndex < classStreamRows.length - 1 ? bdStream : "none" }}>
                                                                        <TimetablePrintLabel text={streamRow.stream!.code || streamRow.stream!.name} />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div data-printable-class-label="true" style={{ position: "absolute", inset: 0 }}>
                                                            <TimetablePrintLabel text={cls.code || cls.name} />
                                                        </div>
                                                    )}
                                                </td>
                                            )}

                                            {templatePeriods.map((tp, templatePeriodIndex) => {
                                                if (isTimetablePrintBreak(tp)) {
                                                    if (dayIdx !== 0 || rowIdx !== 0) return null;
                                                    return (
                                                        <td key={tp.id} rowSpan={totalRows} data-printable-break-cell="true" style={{ borderTop: bdBold, borderBottom: bdBold, borderLeft: bd, borderRight: bd, background: "#e8e8e8", padding: 0, position: "relative" }}>
                                                            <div data-printable-break-label="true" style={{ position: "absolute", inset: 0 }}>
                                                                <TimetablePrintLabel text={tp.customLabel || tp.type} direction="vertical" weight={900} />
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                const cell = cellsByDay.get(day.id)?.[rowIdx].find(candidate => candidate.periodIndex === templatePeriodIndex);
                                                if (!cell) return null;
                                                const entry = cell.entry;
                                                const subject = entry ? subjects.find(candidate => candidate.id === entry.subjectId) : undefined;
                                                const optional = entry?.optionalSubjectId ? subjects.find(candidate => candidate.id === entry.optionalSubjectId) : undefined;
                                                const label = entry?.entryType === "activity"
                                                    ? entry.activityName || "ACT"
                                                    : subject ? `${subject.code || subject.name}${optional ? `/${optional.code || optional.name}` : ''}` : '';
                                                return (
                                                    <td
                                                        key={tp.id}
                                                        rowSpan={cell.rowSpan}
                                                        colSpan={cell.colSpan}
                                                        data-printable-lesson-cell="true"
                                                        data-period-column={templatePeriodIndex}
                                                        style={{ borderTop: "none", borderBottom: rowBorder(dayRows, rowIdx + cell.rowSpan - 1), borderLeft: bd, borderRight: bd, background: entry?.entryType === "activity" ? "#e8e8e8" : undefined, padding: 0, position: "relative" }}
                                                    >
                                                        {label && <TimetablePrintLabel text={label} weight={entry?.entryType === "activity" ? 700 : 600} />}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <>
            {/* ── Off-screen div that html2canvas captures ── */}
            <div
                ref={captureRef}
                aria-hidden="true"
                style={{
                    position: "fixed",
                    left: -(RENDER_WIDTH + 200),
                    top: 0,
                    width: RENDER_WIDTH,
                    height: RENDER_HEIGHT,
                    overflow: "hidden",
                    zIndex: -1,
                    pointerEvents: "none",
                }}
            >
                {timetableContent}
            </div>

            {/* ── Fullscreen overlay with preview + controls ── */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 9999,
                    background: "rgba(17,24,39,0.85)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                }}
            >
                {/* Control bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, zIndex: 10000 }}>
                    <button
                        onClick={generatePDF}
                        disabled={status === "generating"}
                        style={{
                            padding: "8px 20px",
                            background: status === "generating" ? "#9ca3af" : "#2563eb",
                            color: "#fff",
                            border: "none",
                            borderRadius: 7,
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: status === "generating" ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                        }}
                    >
                        {status === "generating" ? (
                            <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Generating PDF…</>
                        ) : (
                            <><span>📄</span> {status === "done" ? "Re-Generate PDF" : "Generate & Open PDF"}</>
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            padding: "8px 18px",
                            background: "#1f2937",
                            color: "#e5e7eb",
                            border: "1px solid #374151",
                            borderRadius: 7,
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: "pointer",
                        }}
                    >
                        ✕ Close
                    </button>
                    {status === "done" && (
                        <span style={{ color: "#86efac", fontWeight: 600, fontSize: 13 }}>
                            ✓ PDF opened in a new tab — print or download from there
                        </span>
                    )}
                    {status === "error" && (
                        <span style={{ color: "#fca5a5", fontWeight: 600, fontSize: 13 }}>
                            ✕ PDF generation failed. Try again.
                        </span>
                    )}
                </div>

                {/* Scaled preview */}
                <div
                    style={{
                        width: RENDER_WIDTH * scale,
                        height: RENDER_HEIGHT * scale,
                        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
                        borderRadius: 4,
                        overflow: "hidden",
                        background: "#fff",
                        flexShrink: 0,
                    }}
                >
                    <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: RENDER_WIDTH, height: RENDER_HEIGHT }}>
                        {timetableContent}
                    </div>
                </div>

                <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 0 }}>
                    Preview — the generated PDF will have 5 mm margins on all sides
                </p>
            </div>
        </>
    );
}
