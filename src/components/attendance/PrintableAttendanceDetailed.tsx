"use client";

import * as React from "react";
import { format, eachDayOfInterval, isWeekend } from "date-fns";
import type { Pupil, AttendanceRecord, Class, SchoolSettings, ExcludedDay } from "@/types";
import { wasPupilActiveInDateRange } from "@/lib/utils/pupil-status-utils";

interface PrintableAttendanceDetailedProps {
  config: { startDate: string; endDate: string; classId: string; excludedDays: ExcludedDay[] };
  pupils: Pupil[];
  records: AttendanceRecord[];
  targetClass: Class | undefined;
  schoolSettings: SchoolSettings | null;
  onClose: () => void;
}

export function PrintableAttendanceDetailed({
  config,
  pupils,
  records,
  targetClass,
  schoolSettings,
  onClose,
}: PrintableAttendanceDetailedProps) {
  React.useEffect(() => {
    // ── Build date interval ──────────────────────────────────────────
    let days: Date[] = [];
    try {
      const s = new Date(config.startDate);
      const e = new Date(config.endDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        days = eachDayOfInterval({ start: s, end: e });
      }
    } catch { /* ignore */ }

    // ── Build per-pupil data ─────────────────────────────────────────
    const filteredPupils = pupils.filter(p => wasPupilActiveInDateRange(p, config.startDate, config.endDate));
    const data = filteredPupils.map(pupil => {
      const pr = records.filter(r => r.pupilId === pupil.id);
      const daily: Record<string, string> = {};
      let P = 0, A = 0, E = 0, T = 0;
      pr.forEach(r => {
        let key: string;
        try { key = typeof r.date === "string" ? r.date.split("T")[0] : format(new Date(r.date as unknown as string), "yyyy-MM-dd"); }
        catch { return; }
        switch (r.status) {
          case "Present": daily[key] = "&#10004;"; P++; break;
          case "Absent":  daily[key] = "0";        A++; break;
          case "Late":    daily[key] = "x";        T++; break;
          case "Excused": daily[key] = "e";        E++; break;
          default:        daily[key] = "";         break;
        }
      });
      return {
        name: `${pupil.lastName || ""} ${pupil.firstName || ""}`.trim().toUpperCase(),
        daily,
        P, A, E, T,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    // ── Dynamic sizing ───────────────────────────────────────────────
    const colCount = days.length;
    // day-cell font: bigger for fewer cols, smaller for many
    const dayFontPt = colCount > 28 ? 7 : colCount > 20 ? 8 : colCount > 14 ? 9 : colCount > 7 ? 10 : 11;
    // day-cell width in mm (A4 landscape usable ~267mm, name=40, #=8, totals=6*4=24 → 267-72=195 for days)
    const USABLE_MM = 267;
    const FIXED_MM  = 8 + 40 + 6 * 4;  // # + name + 4 totals
    const dayCellMm = colCount > 0 ? Math.max(3, (USABLE_MM - FIXED_MM) / colCount).toFixed(1) : "6";

    // Helper to check if a day is explicitly an excluded holiday
    const isHoliday = (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dOfWeek = date.getDay();
      const dOfMonth = date.getDate();
      const mOfYear = date.getMonth() + 1;
      
      return (config.excludedDays || []).some(ed => {
        if (ed.type === 'specific_date' && ed.date === dateStr) return true;
        if (ed.type === 'recurring_day_of_week' && ed.dayOfWeek === dOfWeek) return true;
        if (ed.type === 'recurring_monthly' && ed.dayOfMonth === dOfMonth) return true;
        if (ed.type === 'recurring_annual' && ed.dayOfMonth === dOfMonth && ed.monthOfYear === mOfYear) return true;
        return false;
      });
    };

    // ── Build table header cols ──────────────────────────────────────
    const dayHeaders1 = days.map(d => {
      const excluded = isWeekend(d) || isHoliday(d);
      const rightBorder = d.getDay() === 0 ? "border-right: 2px solid #000;" : "";
      return `<th style="background:${excluded ? "#d1d5db" : "#e5e7eb"};width:${dayCellMm}mm;${rightBorder}">${format(d,"EEE").charAt(0)}</th>`;
    }).join("");
    
    const dayHeaders2 = days.map(d => {
      const holiday = isHoliday(d);
      const excluded = isWeekend(d) || holiday;
      const rightBorder = d.getDay() === 0 ? "border-right: 2px solid #000;" : "";
      const content = holiday 
        ? `<span style="display:inline-block; border: 2px solid #dc2626; border-radius: 50%; min-width: 1.8em; height: 1.8em; line-height: 1.5em; color: #dc2626;">${format(d,"d")}</span>` 
        : format(d,"d");
      return `<th style="background:${excluded ? "#d1d5db" : "#fff"};width:${dayCellMm}mm;${rightBorder}">${content}</th>`;
    }).join("");

    // ── Build rows ──────────────────────────────────────────────────
    const bodyRows = data.map((p, i) => {
      const dayCells = days.map(d => {
        const key  = format(d, "yyyy-MM-dd");
        const code = p.daily[key] ?? "";
        const excluded = isWeekend(d) || isHoliday(d);
        const bg   = excluded ? "#e5e7eb" : "#fff";
        const color= code === "&#10004;" ? "#166534" : code === "0" ? "#991b1b" : "#000";
        const rightBorder = d.getDay() === 0 ? "border-right: 2px solid #000;" : "";
        return `<td style="background:${bg};color:${color};font-weight:bold;${rightBorder}">${code}</td>`;
      }).join("");
      const rowBg = i % 2 === 0 ? "#fff" : "#f9fafb";
      return `
        <tr style="background:${rowBg};page-break-inside:avoid">
          <td style="border-right: 2px solid #000;">${i + 1}</td>
          <td style="text-align:left;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-right: 2px solid #000;">${p.name}</td>
          ${dayCells}
          <td style="color:#166534;font-weight:bold;border-left: 2px solid #000;">${p.P}</td>
          <td style="color:#991b1b;font-weight:bold">${p.A}</td>
          <td style="font-weight:bold">${p.E}</td>
          <td style="font-weight:bold">${p.T}</td>
        </tr>`;
    }).join("");

    const schoolName = schoolSettings?.generalInfo?.name || "School Name";
    const className  = targetClass?.name || "Unknown";
    const startFmt   = format(new Date(config.startDate), "MMMM d, yyyy");
    const endFmt     = format(new Date(config.endDate),   "MMMM d, yyyy");

    let totalDays = 0;
    let weekendCount = 0;
    
    // Safely calculate days
    const startDateObj = new Date(config.startDate);
    const endDateObj = new Date(config.endDate);
    if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
       const msDiff = endDateObj.getTime() - startDateObj.getTime();
       totalDays = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)) + 1);
       
       let current = new Date(startDateObj);
       while(current <= endDateObj) {
           const day = current.getDay();
           if(day === 0 || day === 6) weekendCount++;
           current.setDate(current.getDate() + 1);
       }
    }
    
    const hasExplicitExcluded = Array.isArray(config.excludedDays) && config.excludedDays.length > 0;
    const explicitExcludedCount = hasExplicitExcluded ? config.excludedDays.length : 0;
    const totalExcluded = hasExplicitExcluded ? weekendCount + explicitExcludedCount : weekendCount; 
    const schoolDays = Math.max(0, totalDays - totalExcluded);
    const excludedBreakdownText = `Sundays: ${Math.floor(totalDays/7) + (startDateObj.getDay()===0?1:0)}, Saturdays: ${Math.floor(totalDays/7) + (startDateObj.getDay()===6?1:0)}${explicitExcludedCount > 0 ? `, Holidays/Other: ${explicitExcludedCount}` : ''}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Attendance Register – ${className}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: ${dayFontPt}pt; color: #000; padding: 8mm; }
    .header { display: flex; justify-content: space-between; align-items: flex-end;
              border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .header h1 { font-size: ${Math.round(dayFontPt * 1.6)}pt; text-transform: uppercase; }
    .header p  { font-size: ${Math.round(dayFontPt * 1.1)}pt; color: #555; margin-top: 3px; }
    .header .meta { text-align: right; font-size: ${dayFontPt}pt; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 3px 2px; text-align: center;
             font-size: ${dayFontPt}pt; overflow: hidden; }
    .name-col { text-align: left; min-width: 40mm; max-width: 40mm; white-space: nowrap;
                overflow: hidden; text-overflow: ellipsis; }
    .no-col   { width: 8mm; }
    .tot-col  { width: 6mm; }
    thead tr  { page-break-inside: avoid; }
    tbody tr  { page-break-inside: avoid; }
    .day-summary { display: flex; justify-content: space-between; font-size: ${dayFontPt}pt; background: #f9fafb; padding: 6px 12px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 10px; }
    .day-summary div { display: flex; gap: 8px; }
    .legend   { margin-top: 12px; display: flex; justify-content: space-between;
                font-size: ${dayFontPt}pt; }
    .legend .items { display: flex; gap: 12px; flex-wrap: wrap; max-width: 60%; }
    .excluded-notes { flex-basis: 100%; margin-top: 8px; color: #666; font-style: italic; font-size: ${Math.max(6, dayFontPt - 1)}pt; }
    @media print {
      body { padding: 5mm; }
      @page { size: A4 landscape; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${schoolName}</h1>
      <p>Daily Attendance Register</p>
    </div>
    <div class="meta">
      <p><strong>Class:</strong> ${className} &nbsp;|&nbsp; <strong>Year:</strong> ${new Date(config.startDate).getFullYear()}</p>
      <p><strong>Period:</strong> ${startFmt} – ${endFmt}</p>
    </div>
  </div>
  
  <div class="day-summary">
    <div><strong>Range:</strong> <span>${totalDays} days</span></div>
    <div><strong>School Days:</strong> <span style="color:#166534;font-weight:bold">${schoolDays} days</span></div>
    <div><strong>Excluded:</strong> <span style="color:#991b1b;font-weight:bold">${totalExcluded} days</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="no-col"   rowspan="2" style="background:#e5e7eb;border-right: 2px solid #000;">#</th>
        <th class="name-col" rowspan="2" style="background:#e5e7eb;text-align:left;border-right: 2px solid #000;">Student Name</th>
        ${dayHeaders1}
        <th colspan="4" style="background:#d1d5db;border-left: 2px solid #000;">Totals</th>
      </tr>
      <tr>
        ${dayHeaders2}
        <th class="tot-col" style="background:#e5e7eb;border-left: 2px solid #000;">P</th>
        <th class="tot-col" style="background:#e5e7eb">A</th>
        <th class="tot-col" style="background:#e5e7eb">E</th>
        <th class="tot-col" style="background:#e5e7eb">T</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows || `<tr><td colspan="${2 + days.length + 4}" style="padding:12px;font-style:italic">No pupils found.</td></tr>`}
    </tbody>
  </table>

  <div class="legend">
    <div class="items">
      <strong>Legend:</strong>
      <span>&#10004; = Present</span>
      <span>0 = Absent</span>
      <span>e = Excused</span>
      <span>x = Late / Unexcused</span>
      <span style="font-style:italic">Blank = Delayed / No Record</span>
      <div class="excluded-notes"><strong>Note:</strong> Excluded breakdown: ${excludedBreakdownText}</div>
    </div>
    <div style="text-align:right">
      Teacher's Signature: _______________________
    </div>
  </div>

  <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; }<\/script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    setTimeout(onClose, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", padding: "32px 40px", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", textAlign: "center" }}>
        <p style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "8px" }}>⏳ Opening Print Dialog…</p>
        <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>A print window is being prepared. Please allow pop-ups if prompted.</p>
      </div>
    </div>
  );
}
