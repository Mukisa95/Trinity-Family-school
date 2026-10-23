import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { listTableStyles } from '@/lib/printing/list-document-jspdf';
import { LIST_TABLE } from '@/lib/printing/list-document-theme';

export function drawMajorSubjectChecklist(
  doc: jsPDF,
  subjects: Array<{ name: string; code: string }>,
  startY: number,
  margin: number,
  onPage?: () => void,
) {
  if (subjects.length <= 4) return;
  const columns = 3;
  const rows: string[][] = [];
  for (let index = 0; index < subjects.length; index += columns) {
    rows.push(Array.from({ length: columns }, (_, offset) => {
      const subject = subjects[index + offset];
      return subject ? `${subject.code} - ${subject.name}` : '';
    }));
  }
  autoTable(doc, {
    startY,
    head: [[{ content: 'Choose four major subjects', colSpan: columns }]],
    body: rows,
    ...listTableStyles,
    margin: { top: 10, bottom: 22, left: margin, right: margin },
    rowPageBreak: 'avoid',
    styles: { ...listTableStyles.styles, fontSize: LIST_TABLE.detailFontSize, cellPadding: { top: 1.6, right: 1.6, bottom: 1.6, left: 6.4 }, minCellHeight: 7.2 },
    columnStyles: Object.fromEntries(Array.from({ length: columns }, (_, index) => [index, { cellWidth: (doc.internal.pageSize.width - margin * 2) / columns }])),
    didDrawCell: ({ section, cell }) => {
      if (section !== 'body' || !cell.raw) return;
      doc.setDrawColor(102);
      doc.setLineWidth(0.3);
      doc.rect(cell.x + 1.6, cell.y + (cell.height - 2.8) / 2, 2.8, 2.8);
    },
    didDrawPage: onPage,
  });
}
