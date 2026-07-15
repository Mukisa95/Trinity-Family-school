"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import type { TimetableEntry, GeneratedPeriod, Class, Subject, Staff } from "@/types";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";

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
    timeFormat?: "12h" | "24h";
    onClose: () => void;
}

// Fixed canvas renders at this size for crisp PDF output
// RENDER_HEIGHT is calculated to match A4 landscape with 5mm margins: 287/200 aspect
const RENDER_WIDTH = 1400;
const RENDER_HEIGHT = 976;

export function PrintableTimetable({
    entries,
    periods,
    classes,
    subjects,
    staffList,
    timeFormat,
    onClose,
}: PrintableTimetableProps) {
    const { data: schoolSettings } = useSchoolSettings();
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

    const visibleDays = DAYS.filter((d) => periods.some((p) => p.dayOfWeek === d.id));

    const getEntry = (classId: string, dayId: number, tp: GeneratedPeriod): TimetableEntry | undefined => {
        const dayPeriod = periods.find(
            (p) => p.dayOfWeek === dayId && p.type === tp.type && p.periodNumber === tp.periodNumber
        );
        if (!dayPeriod) return undefined;
        return entries.find((e) => e.classId === classId && e.periodId === dayPeriod.id);
    };

    // ── PDF generation ────────────────────────────────────────────────────────
    const generatePDF = async () => {
        if (!captureRef.current || status === "generating") return;
        setStatus("generating");
        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import("html2canvas"),
                import("jspdf"),
            ]);

            // Capture the off-screen div at 1.5× for high-quality, faster PDF rendering
            const canvas = await html2canvas(captureRef.current, {
                scale: 1.5,
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#ffffff",
                logging: false,
                width: RENDER_WIDTH,
                height: RENDER_HEIGHT,
            });

            // A4 landscape: 297 × 210 mm, 5 mm margins
            const PAGE_W = 297;
            const PAGE_H = 210;
            const MARGIN = 5;
            const availW = PAGE_W - MARGIN * 2;
            const availH = PAGE_H - MARGIN * 2;

            // Scale image to fill the available area, preserving aspect ratio
            const canvasAspect = canvas.width / canvas.height;
            const availAspect = availW / availH;
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

            // Open in new tab so user can print or download
            const blob = pdf.output("blob");
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");

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

    const logoUrl = schoolSettings?.generalInfo?.logo;

    // ── Dynamic sizing based on table dimensions ──────────────────────────────
    const totalRows = visibleDays.length * classes.length;
    // Lesson cells: bigger when fewer rows, capped so text always fits
    const lessonFs = Math.max(11, Math.min(18, Math.round(900 / totalRows)));
    // Class name column: slightly smaller than lesson
    const classFs  = Math.max(10, Math.min(16, Math.round(820 / totalRows)));
    // Day label: scaled by number of days
    const dayFs    = Math.max(18, Math.min(36, Math.round(240 / visibleDays.length)));
    // Break text: single rotated word with letter-spacing that fills the column height
    const breakFs = Math.max(18, Math.min(36, Math.round(280 / visibleDays.length)));
    // Letter spacing grows with more rows so the word spans the full cell height
    const breakLs = Math.max(10, Math.min(120, Math.round(totalRows * 5)));
    // Header time labels — bigger cap, always uses fmt() so 12h/24h is correct
    const timeFs   = Math.max(10, Math.min(17, Math.round(800 / templatePeriods.length)));
    // Table-level base size (also controls thead CLASS cell)
    const tableFs  = lessonFs;

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
                    fontSize: tableFs,
                    lineHeight: 1.2,
                    position: "relative",
                    zIndex: 1,
                }}
            >
                <colgroup>
                    <col style={{ width: 65 }} /> {/* Day — wider for big rotated text */}
                    <col style={{ width: 56 }} /> {/* Class */}
                    {templatePeriods.map((p) => {
                        const isBreak = p.type === "break" || p.type === "lunch" || p.type === "assembly";
                        return <col key={p.id} style={{ width: isBreak ? 58 : undefined }} />;
                    })}
                </colgroup>

                <thead>
                    <tr>
                        <th style={{ border: bdBold }} />
                        <th style={{ border: bd, fontSize: 12, fontWeight: 700, textAlign: "center", padding: "2px 2px", verticalAlign: "bottom" }}>
                            {/* Intentionally left blank */}
                        </th>
                        {templatePeriods.map((p) => {
                            const isBreak = p.type === "break" || p.type === "lunch" || p.type === "assembly";
                            return (
                                <th key={p.id} style={{ border: bd, fontWeight: 700, textAlign: "center", padding: "2px 3px", verticalAlign: "middle", background: isBreak ? "#e8e8e8" : "#fff" }}>
                                    <div style={{ fontSize: timeFs, borderBottom: "1px solid #aaa", paddingBottom: 1, marginBottom: 1 }}>
                                        {isBreak ? fmtShort(p.startTime) : fmt(p.startTime)}
                                    </div>
                                    <div style={{ fontSize: timeFs }}>
                                        {isBreak ? fmtShort(p.endTime) : fmt(p.endTime)}
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>

                <tbody>
                    {/* tr has NO borderBottom — each td manages its own bottom border
                         so that spanning day/break cells don't get internal row lines */}
                    {visibleDays.map((day, dayIdx) => (
                        <React.Fragment key={day.id}>
                            {classes.map((cls, clsIdx) => {
                                const isLastClassInDay = clsIdx === classes.length - 1;
                                const rowBottomBorder = isLastClassInDay ? bdBold : bd;
                                let skipCells = 0;
                                return (
                                    <tr key={`${day.id}-${cls.id}`}>
                                        {/* Day label — spans all class rows, no internal row lines */}
                                        {clsIdx === 0 && (
                                            <td
                                                rowSpan={classes.length}
                                                style={{
                                                    borderTop: dayIdx === 0 ? bdBold : "none",
                                                    borderBottom: bdBold,
                                                    borderLeft: bdBold,
                                                    borderRight: bdBold,
                                                    fontWeight: 900,
                                                    textAlign: "center",
                                                    verticalAlign: "middle",
                                                    padding: 0,
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {/* CSS rotate is more reliable than writing-mode for html2canvas */}
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 60 }}>
                                                    <span style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap", display: "inline-block", fontSize: dayFs, letterSpacing: 3, fontWeight: 900 }}>
                                                        {day.label}
                                                    </span>
                                                </div>
                                            </td>
                                        )}

                                        {/* Class name */}
                                        <td style={{ borderTop: "none", borderBottom: rowBottomBorder, borderLeft: bd, borderRight: bd, fontWeight: 700, textAlign: "center", padding: "0 2px", fontSize: classFs, whiteSpace: "nowrap", overflow: "hidden", verticalAlign: "middle" }}>
                                            {cls.code || cls.name}
                                        </td>

                                        {/* Period cells */}
                                        {templatePeriods.map((tp) => {
                                            if (skipCells > 0) { skipCells--; return null; }
                                            const isBreak = tp.type === "break" || tp.type === "lunch" || tp.type === "assembly";

                                            if (isBreak) {
                                                // ── Render once spanning ALL days (dayIdx===0 && clsIdx===0) ──
                                                if (dayIdx === 0 && clsIdx === 0) {
                                                    return (
                                                        <td
                                                            key={tp.id}
                                                            rowSpan={visibleDays.length * classes.length}
                                                            style={{
                                                                borderTop: bdBold,
                                                                borderBottom: bdBold,
                                                                borderLeft: bd,
                                                                borderRight: bd,
                                                                background: "#e8e8e8",
                                                                textAlign: "center",
                                                                verticalAlign: "middle",
                                                                padding: 0,
                                                                overflow: "hidden",
                                                            }}
                                                        >
                                                            {/* Single rotated word, letter-spacing fills the column height */}
                                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                                                                <span style={{
                                                                    transform: "rotate(-90deg)",
                                                                    display: "inline-block",
                                                                    whiteSpace: "nowrap",
                                                                    letterSpacing: breakLs,
                                                                    fontSize: breakFs,
                                                                    fontWeight: 900,
                                                                    textTransform: "uppercase",
                                                                    lineHeight: 1,
                                                                }}>
                                                                    {(tp.customLabel || tp.type).toUpperCase()}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                // Already rendered — skip for all other rows
                                                return null;
                                            }

                                            // Group activities
                                            const groupEntry = classes
                                                .map((c) => getEntry(c.id, day.id, tp))
                                                .find((e) => e?.entryType === "activity" && e?.linkedClassIds && e.linkedClassIds.length > 0);

                                            if (groupEntry) {
                                                const groupIds = [groupEntry.classId, ...(groupEntry.linkedClassIds || [])];
                                                if (groupIds.includes(cls.id)) {
                                                    const firstIdx = classes.findIndex((c) => groupIds.includes(c.id));
                                                    if (clsIdx === firstIdx) {
                                                        const span = classes.filter((c) => groupIds.includes(c.id)).length;
                                                        if (groupEntry.periodSpan && groupEntry.periodSpan > 1) {
                                                            skipCells = groupEntry.periodSpan - 1;
                                                        }
                                                        return (
                                                            <td key={tp.id} rowSpan={span} colSpan={groupEntry.periodSpan || 1} style={{ borderTop: "none", borderBottom: rowBottomBorder, borderLeft: bd, borderRight: bd, background: "#e8e8e8", textAlign: "center", fontWeight: 700, verticalAlign: "middle", fontSize: lessonFs }}>
                                                                {groupEntry.activityName || "ACT"}
                                                            </td>
                                                        );
                                                    }
                                                    return null;
                                                }
                                            }

                                            const entry = getEntry(cls.id, day.id, tp);
                                            const subject = entry ? subjects.find((s) => s.id === entry.subjectId) : null;

                                            if (entry && entry.periodSpan && entry.periodSpan > 1) {
                                                skipCells = entry.periodSpan - 1;
                                            }

                                            if (entry?.entryType === "activity") {
                                                return (
                                                    <td key={tp.id} colSpan={entry.periodSpan || 1} style={{ borderTop: "none", borderBottom: rowBottomBorder, borderLeft: bd, borderRight: bd, background: "#e8e8e8", textAlign: "center", fontWeight: 700, verticalAlign: "middle", fontSize: lessonFs }}>
                                                        {entry.activityName || "ACT"}
                                                    </td>
                                                );
                                            }

                                            if (entry && subject) {
                                                // Split subject — render inline as MAIN/OPT
                                                if (entry.optionalSubjectId) {
                                                    const optSub = subjects.find((s) => s.id === entry.optionalSubjectId);
                                                    const mainCode = subject.code || subject.name.substring(0, 5);
                                                    const optCode = optSub?.code || optSub?.name?.substring(0, 5) || "";
                                                    return (
                                                        <td key={tp.id} colSpan={entry.periodSpan || 1} style={{ borderTop: "none", borderBottom: rowBottomBorder, borderLeft: bd, borderRight: bd, textAlign: "center", verticalAlign: "middle", fontWeight: 600, fontSize: lessonFs, padding: "2px 3px" }}>
                                                            {mainCode}/{optCode}
                                                        </td>
                                                    );
                                                }
                                                return (
                                                    <td key={tp.id} colSpan={entry.periodSpan || 1} style={{ borderTop: "none", borderBottom: rowBottomBorder, borderLeft: bd, borderRight: bd, textAlign: "center", verticalAlign: "middle", fontWeight: 600, fontSize: lessonFs, padding: "2px 3px" }}>
                                                        {subject.code || subject.name}
                                                    </td>
                                                );
                                            }

                                            return <td key={tp.id} style={{ borderTop: "none", borderBottom: rowBottomBorder, borderLeft: bd, borderRight: bd }} />;
                                        })}
                                    </tr>
                                );
                            })}
                        </React.Fragment>
                    ))}
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
                    Preview — the generated PDF will have 10 mm margins on all sides
                </p>
            </div>
        </>
    );
}
