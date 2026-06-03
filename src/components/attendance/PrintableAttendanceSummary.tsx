"use client";

import * as React from "react";
import { format } from "date-fns";
import type { Pupil, AttendanceRecord, Class, SchoolSettings, ExcludedDay } from "@/types";
import { wasPupilActiveInDateRange } from "@/lib/utils/pupil-status-utils";

interface PrintableAttendanceSummaryProps {
  config: { startDate: string; endDate: string; classId: string; excludedDays: ExcludedDay[] };
  pupils: Pupil[];
  records: AttendanceRecord[];
  targetClass: Class | undefined;
  schoolSettings: SchoolSettings | null;
  onClose: () => void;
}

export function PrintableAttendanceSummary({
  config,
  pupils,
  records,
  targetClass,
  schoolSettings,
  onClose,
}: PrintableAttendanceSummaryProps) {
  React.useEffect(() => {
    const filteredPupils = pupils.filter(p => wasPupilActiveInDateRange(p, config.startDate, config.endDate));
    const summaryData = filteredPupils.map(pupil => {
      const pr = records.filter(r => r.pupilId === pupil.id);
      return {
        name: `${pupil.lastName || ""} ${pupil.firstName || ""} ${pupil.otherNames || ""}`.trim().toUpperCase(),
        genderExt: pupil.gender ? ` (${pupil.gender.charAt(0).toUpperCase()})` : " (-)",
        present: pr.filter(r => r.status === "Present").length,
        absent:  pr.filter(r => r.status === "Absent").length,
        late:    pr.filter(r => r.status === "Late").length,
        excused: pr.filter(r => r.status === "Excused").length,
        delayed: pr.filter(r => r.status === "Delayed").length,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const rows = summaryData.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td style="text-align:left;font-weight:bold">${p.name}<span style="font-weight:normal;color:#555">${p.genderExt}</span></td>
        <td>${p.present}</td>
        <td>${p.absent}</td>
        <td>${p.late}</td>
        <td>${p.excused}</td>
        <td>${p.delayed}</td>
      </tr>
    `).join("");

    const schoolName = schoolSettings?.generalInfo?.name || "School Name";
    const className  = targetClass?.name || "Unknown Class";
    
    // Day Calculations
    const startDateObj = new Date(config.startDate);
    const endDateObj = new Date(config.endDate);
    const period = `${format(startDateObj, "MMM d, yyyy")} – ${format(endDateObj, "MMM d, yyyy")}`;
    const generated = format(new Date(), "MMM d, yyyy 'at' h:mm a");

    let totalDays = 0;
    let weekendCount = 0;
    
    // Safely calculate days since some dates might be invalid
    if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
       const msDiff = endDateObj.getTime() - startDateObj.getTime();
       totalDays = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)) + 1);
       
       // Count weekends
       let current = new Date(startDateObj);
       while(current <= endDateObj) {
           const day = current.getDay();
           if(day === 0 || day === 6) weekendCount++;
           current.setDate(current.getDate() + 1);
       }
    }
    
    // We expect excludedDays to be properly handled by a hook/service. For simplicity, we just use the length of actual dates overlapping, or fallback to weekends if the array is empty.
    const hasExplicitExcluded = Array.isArray(config.excludedDays) && config.excludedDays.length > 0;
    // Simplistic breakdown for print
    const explicitExcludedCount = hasExplicitExcluded ? config.excludedDays.length : 0;
    const totalExcluded = hasExplicitExcluded ? weekendCount + explicitExcludedCount : weekendCount; // this might double count if weekends are in excludedDays, but typically they are distinct
    const schoolDays = Math.max(0, totalDays - totalExcluded);

    const excludedBreakdownText = `Sundays: ${Math.floor(totalDays/7) + (startDateObj.getDay()===0?1:0)}, Saturdays: ${Math.floor(totalDays/7) + (startDateObj.getDay()===6?1:0)}${explicitExcludedCount > 0 ? `, Holidays/Other: ${explicitExcludedCount}` : ''}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Attendance Summary – ${className}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; padding: 20mm; }
    h1 { font-size: 16pt; text-transform: uppercase; text-align: center; }
    h2 { font-size: 13pt; text-transform: uppercase; text-align: center; color: #444; margin: 6px 0; }
    .meta { text-align: center; font-size: 11pt; margin-bottom: 12px; color: #555; }
    .day-summary { display: flex; justify-content: center; gap: 24px; font-size: 10pt; background: #f9fafb; padding: 8px 16px; border: 1px solid #e5e7eb; border-radius: 6px; margin: 0 auto 16px; max-width: 600px; }
    .day-summary div { display: flex; align-items: center; gap: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #e5e7eb; border: 1px solid #9ca3af; padding: 7px; font-size: 10pt; }
    td { border: 1px solid #9ca3af; padding: 6px; font-size: 10pt; text-align: center; }
    tr { page-break-inside: avoid; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 9pt; color: #555; align-items: flex-end; }
    .excluded-notes { font-style: italic; max-width: 50%; }
    @media print {
      body { padding: 10mm; }
      @page { size: A4 portrait; margin: 12mm; }
    }
  </style>
</head>
<body>
  <h1>${schoolName}</h1>
  <h2>Attendance Summary Report</h2>
  <p class="meta"><strong>Class:</strong> ${className} &nbsp;|&nbsp; <strong>Period:</strong> ${period}</p>
  
  <div class="day-summary">
    <div><strong>Total Days:</strong> <span>${totalDays}</span></div>
    <div><strong>School Days:</strong> <span style="color:#166534;font-weight:bold">${schoolDays}</span></div>
    <div><strong>Excluded:</strong> <span style="color:#991b1b;font-weight:bold">${totalExcluded}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:36px">No.</th>
        <th style="text-align:left">Pupil Name (Gender)</th>
        <th>Present</th>
        <th>Absent</th>
        <th>Late</th>
        <th>Excused</th>
        <th>Delayed</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="7" style="font-style:italic;text-align:center;padding:16px">No pupils found.</td></tr>'}</tbody>
  </table>
  <div class="footer">
    <div class="excluded-notes">
      <strong>Note:</strong> Excluded days breakdown:<br/>
      ${excludedBreakdownText}
    </div>
    <div style="text-align:right">
      <div style="margin-bottom: 12px"><strong>Generated:</strong> ${generated}</div>
      <div>______________________________</div>
      <div style="margin-top:4px; text-align:center">Class Teacher Signature</div>
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
    // Close overlay shortly after launching the print window
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
