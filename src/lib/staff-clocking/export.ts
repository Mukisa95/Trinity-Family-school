import type { StaffClockingDailyRecord } from './contracts';

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportStaffClockingCsv(records: StaffClockingDailyRecord[]): string {
  const rows = [
    ['Staff', 'Staff ID', 'Date', 'Clock in', 'Clock out', 'Arrival', 'Record status', 'Review status'],
    ...records.map(record => [record.staffName || '', record.staffId, record.localDate,
      record.effectiveClockInTime || record.clockInTime || '', record.effectiveClockOutTime || record.clockOutTime || '',
      record.arrivalStatus || '', record.status, record.reviewStatus || '']),
  ];
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
