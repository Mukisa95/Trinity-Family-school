import type jsPDF from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import { listSchoolHeading } from './list-document-theme';

export const listTableStyles: Pick<UserOptions, 'theme' | 'styles' | 'headStyles' | 'alternateRowStyles' | 'footStyles' | 'tableLineWidth' | 'tableLineColor'> = {
  theme: 'grid',
  styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, textColor: [34, 34, 34], lineColor: [221, 221, 221], lineWidth: .15, overflow: 'linebreak' },
  headStyles: { fillColor: [241, 241, 241], textColor: [34, 34, 34], fontSize: 7.5, fontStyle: 'bold', lineColor: [102, 102, 102], lineWidth: .2 },
  alternateRowStyles: { fillColor: [248, 248, 248] },
  footStyles: { fillColor: [241, 241, 241], textColor: [34, 34, 34], fontStyle: 'bold' },
  tableLineWidth: .25, tableLineColor: [102, 102, 102],
};

/** All coordinates use the document's mm units. Returns the content baseline. */
export function drawListDocumentHeader(doc: jsPDF, options: {
  schoolName: string; title: string; context?: string; date?: string; count?: string; margin?: number; compact?: boolean;
}) {
  const { title, context = '', date = '', count = '', margin = 12, compact = false } = options;
  const school = listSchoolHeading(options.schoolName);
  const width = doc.internal.pageSize.width, available = width - margin * 2;
  const fitText = (value: string, size: number, maxWidth: number) => {
    doc.setFontSize(size);
    while (doc.getTextWidth(value) > maxWidth && size > 6) doc.setFontSize(size -= .5);
  };
  doc.setTextColor(34); doc.setFont('helvetica', 'bold');
  fitText(school.name, compact ? 13 : 21, available);
  doc.text(school.name, width / 2, compact ? 8 : 13, { align: 'center' });
  if (school.subtitle) {
    doc.setFont('helvetica', 'normal'); fitText(school.subtitle, compact ? 7 : 10, available);
    doc.text(school.subtitle, width / 2, compact ? 12 : 19, { align: 'center' });
  }
  const ruleY = compact ? 15 : 23;
  doc.setDrawColor(102); doc.setLineWidth(.4); doc.line(margin, ruleY, width - margin, ruleY);
  doc.setFont('helvetica', 'bold'); fitText(title.toUpperCase(), compact ? 9 : 12, available);
  doc.text(title.toUpperCase(), margin, ruleY + (compact ? 4 : 7));
  const metaY = ruleY + (compact ? 8 : 13);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(85);
  fitText(context, 7, available * .45); doc.text(context, margin, metaY);
  fitText(date, 7, available * .35); doc.text(date, margin + available * .62, metaY, { align: 'center' });
  fitText(count, 7, available * .2); doc.text(count, width - margin, metaY, { align: 'right' });
  doc.setDrawColor(221); doc.setLineWidth(.15); doc.line(margin, metaY + 3, width - margin, metaY + 3);
  return metaY + 8;
}

export function drawListDocumentFooters(doc: jsPDF, label = '', margin = 12) {
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page);
    const width = doc.internal.pageSize.width, height = doc.internal.pageSize.height;
    doc.setDrawColor(221); doc.setLineWidth(.15); doc.line(margin, height - 13, width - margin, height - 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(85);
    doc.text(label, margin, height - 8, { maxWidth: width - margin * 2 - 25 });
    doc.text(`${page} / ${count}`, width - margin, height - 8, { align: 'right' });
  }
}
