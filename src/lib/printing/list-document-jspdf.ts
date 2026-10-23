import type jsPDF from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import { listSchoolHeading, listDocumentCopyright, LIST_TABLE } from './list-document-theme';

const documentTitles = new WeakMap<jsPDF, Set<string>>();

export const listTableStyles: Pick<UserOptions, 'theme' | 'styles' | 'headStyles' | 'alternateRowStyles' | 'footStyles' | 'tableLineWidth' | 'tableLineColor'> = {
  theme: 'grid',
  styles: { font: 'helvetica', fontSize: LIST_TABLE.bodyFontSize, cellPadding: LIST_TABLE.cellPaddingMm, textColor: [34, 34, 34], lineColor: [221, 221, 221], lineWidth: .15, overflow: 'linebreak' },
  headStyles: { fillColor: [34, 34, 34], textColor: [255, 255, 255], fontSize: LIST_TABLE.detailFontSize, fontStyle: 'bold', lineColor: [102, 102, 102], lineWidth: .2 },
  alternateRowStyles: { fillColor: [241, 241, 241] },
  footStyles: { fillColor: [241, 241, 241], textColor: [34, 34, 34], fontStyle: 'bold' },
  tableLineWidth: .25, tableLineColor: [102, 102, 102],
};

/** All coordinates use the document's mm units. Returns the content baseline. */
export function drawListDocumentHeader(doc: jsPDF, options: {
  schoolName: string; title: string; context?: string; date?: string; count?: string; margin?: number; compact?: boolean;
}) {
  const { title, context = '', date = '', count = '', margin = 10, compact = false } = options;
  const school = listSchoolHeading(options.schoolName);
  const width = doc.internal.pageSize.width, available = width - margin * 2;
  const titles = documentTitles.get(doc);
  if (titles) {
    // A new analysis section keeps its identity; continuation pages repeat column labels only.
    if (titles.has(title)) return margin;
    titles.add(title);
    doc.setTextColor(34); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.3);
    const lines = doc.splitTextToSize(title.toUpperCase(), available);
    doc.text(lines, margin, margin + 5);
    const y = margin + 5 + lines.length * 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    const metadata = doc.splitTextToSize([context, date, count].filter(Boolean).join(' | '), available);
    if (metadata.length) doc.text(metadata, margin, y);
    return y + metadata.length * 4 + 4;
  }
  // Use the first rendered section, even when a temporary blank page is removed afterwards.
  documentTitles.set(doc, new Set([title]));
  const fitText = (value: string, size: number, maxWidth: number) => {
    doc.setFontSize(size);
    while (doc.getTextWidth(value) > maxWidth && size > 9.5) doc.setFontSize(size -= .5);
  };
  doc.setTextColor(34); doc.setFont('helvetica', 'bold');
  fitText(school.name, compact ? 13 : 19, available);
  doc.text(school.name, width / 2, margin + (compact ? 4.5 : 6.5), { align: 'center' });
  if (school.subtitle) {
    doc.setFont('helvetica', 'normal'); fitText(school.subtitle, compact ? 9.5 : 10, available);
    doc.text(school.subtitle, width / 2, margin + (compact ? 9 : 12), { align: 'center' });
  }
  const ruleY = margin + (compact ? 12 : 16);
  doc.setDrawColor(102); doc.setLineWidth(.4); doc.line(margin, ruleY, width - margin, ruleY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 11 : 17);
  const titleLines = doc.splitTextToSize(title.toUpperCase(), available);
  doc.text(titleLines, margin, ruleY + (compact ? 5 : 9));
  const extraTitleHeight = (titleLines.length - 1) * doc.getFontSize() / doc.internal.scaleFactor * doc.getLineHeightFactor();
  const metaY = ruleY + (compact ? 11 : 16) + extraTitleHeight;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(85);
  fitText(context, 9.5, available * .45); doc.text(doc.splitTextToSize(context, available * .43), margin, metaY);
  fitText(date, 9.5, available * .35); doc.text(doc.splitTextToSize(date, available * .33), margin + available * .62, metaY, { align: 'center' });
  fitText(count, 9.5, available * .2); doc.text(doc.splitTextToSize(count, available * .18), width - margin, metaY, { align: 'right' });
  const metaLines = Math.max(...[context, date, count].map((value, i) => doc.splitTextToSize(value, available * [.43, .33, .18][i]).length), 1);
  const metaBottom = metaY + (metaLines - 1) * 4;
  doc.setDrawColor(221); doc.setLineWidth(.15); doc.line(margin, metaBottom + 3, width - margin, metaBottom + 3);
  return metaBottom + 9;
}

export function drawListDocumentFooters(doc: jsPDF, schoolName = 'Trinity Family School', margin = 10) {
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page);
    const width = doc.internal.pageSize.width, height = doc.internal.pageSize.height;
    doc.setDrawColor(221); doc.setLineWidth(.15); doc.line(margin, height - 17, width - margin, height - 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(85);
    doc.text(listDocumentCopyright(schoolName), width / 2, height - 11, { align: 'center', maxWidth: width - margin * 2 - 25 });
    doc.text(`${page} / ${count}`, width - margin, height - 11, { align: 'right' });
  }
}
