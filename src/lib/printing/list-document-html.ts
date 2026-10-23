import { listSchoolHeading, listDocumentCopyright, LIST_TABLE } from './list-document-theme';

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

export function listDocumentHeaderHTML({ schoolName, title, context = '', date = '', count = '' }: {
  schoolName: string; title: string; context?: string; date?: string; count?: string;
}) {
  const school = listSchoolHeading(schoolName);
  const copyright = JSON.stringify(listDocumentCopyright(schoolName)).replace(/</g, '\\3c ').replace(/>/g, '\\3e ');
  return `<style>@page { @bottom-center { content: ${copyright}; } @bottom-right { content: counter(page) " / " counter(pages); } }</style><header class="list-document-header"><div class="list-school"><div class="list-school-name">${escape(school.name)}</div>${school.subtitle ? `<div class="list-school-subtitle">${escape(school.subtitle)}</div>` : ''}</div><div class="list-document-title">${escape(title.toUpperCase())}</div><div class="list-document-context"><span>${escape(context)}</span><span>${escape(date)}</span><span>${escape(count)}</span></div></header>`;
}

/** Appended after the monochrome policy and template CSS; applies only to list output. */
export const LIST_DOCUMENT_CSS = `
  @page { size: A4; margin: 10mm 10mm 20mm;
    @bottom-center { vertical-align: bottom; padding-bottom: 11mm; font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #555; }
    @bottom-right { vertical-align: bottom; padding-bottom: 11mm; padding-right: 1mm; font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #555; }
  }
  body { font-family: Arial, Helvetica, sans-serif; color: #222; font-size: 11.3pt; }
  .list-document-header { display: block; margin: 0 0 12pt; padding: 0; border: 0; }
  .list-school { text-align: center; border-bottom: 1pt solid #666 !important; padding-bottom: 7pt; margin-bottom: 8pt; }
  .list-school-name { font-size: 19pt; line-height: 1.1; font-weight: 700; letter-spacing: 0; }
  .list-school-subtitle { font-size: 10pt; margin-top: 3pt; }
  .list-document-title { text-align: left; font-size: 17pt; font-weight: 700; margin-bottom: 7pt; }
  .list-document-context { display: flex; gap: 8pt; justify-content: space-between; border-bottom: .3pt solid #ddd !important; padding-bottom: 7pt; font-size: 9.5pt; }
  .list-document-context span { flex: 1; }
  .list-document-context span:nth-child(2) { text-align: center; }
  .list-document-context span:last-child { text-align: right; }
  table { width: 100%; border-collapse: collapse; border: .6pt solid #666 !important; border-radius: 0 !important; font-size: ${LIST_TABLE.bodyFontSize}pt; }
  thead { display: table-header-group; }
  :root table th { background: #222 !important; color: #fff !important; border: .3pt solid #ccc !important; border-bottom: .6pt solid #666 !important; font-size: ${LIST_TABLE.detailFontSize}pt !important; font-weight: 700; padding: 4pt !important; }
  :root table th * { color: #fff !important; font-size: inherit !important; }
  :root table td { border: .3pt solid #ddd !important; padding: 3.2pt 4pt !important; font-size: ${LIST_TABLE.bodyFontSize}pt !important; }
  :root table td *, :root table td [class], :root table td [style] { font-size: inherit !important; }
  :root table td .fee-type, :root table td .fee-type-badge, :root table td .status-badge { font-size: ${LIST_TABLE.detailFontSize}pt !important; }
  tbody tr:nth-child(even) > td { background: #f8f8f8 !important; }
  tr { break-inside: avoid; }
  :root .list-attendance-detailed th, :root .list-attendance-detailed td { font-size: ${LIST_TABLE.detailFontSize}pt !important; padding: 2.4px 1.6px !important; }
  .info-label, .info-value, .stat-label, .summary-label, .pupil-meta, .balance-details { font-size: 9.5pt !important; }
  .student-info, .family-info, .family-summary, .summary-section, .totals, .day-summary, .payment-summary { border: .3pt solid #ddd !important; border-radius: 0 !important; padding: 8pt; margin-bottom: 12pt; }
  .summary-card, .summary-item, .info-item, .stat-card { border-radius: 0 !important; box-shadow: none !important; }
  .table-container, .pupil-section, .pupil-header, .pupil-summary, .student-section, .status-badge, .fee-type, .fee-type-badge { border-radius: 0 !important; }
  .pupil-section { border: .3pt solid #ddd !important; padding: 8pt; margin-bottom: 12pt; }
  .pupil-header { border: 0 !important; border-bottom: .3pt solid #ddd !important; padding: 0 0 7pt; margin-bottom: 8pt; }
  .pupil-summary { padding: 6pt; margin-top: 8pt; }
  .fees-table { margin-bottom: 8pt; }
  .section-title, .table-title, .summary-title { font-size: 11.3pt !important; margin-bottom: 8pt; }
  .section-title::before, .table-title::before, .pupil-header::before, .student-info::before { content: none !important; }
  .footer { display: none !important; }
  .statement-notes, .attendance-notes { font-size: 9.5pt; margin-top: 10pt; break-inside: avoid; }
  @media print {
    body { margin: 0 !important; padding: 0 !important; }
    .list-document-header { break-inside: avoid; }
  }
`;
