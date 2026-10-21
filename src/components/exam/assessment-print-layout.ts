import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function drawMajorSubjectChecklist(
  doc: jsPDF,
  subjects: Array<{ name: string; code: string }>,
  startY: number,
  margin: number,
) {
  if (subjects.length <= 4) return;
  autoTable(doc, {
    startY,
    head: [['Choose four major subjects', 'Subject']],
    body: subjects.map(subject => ['', `${subject.code} - ${subject.name}`]),
    theme: 'grid',
    margin: { top: 12, bottom: 18, left: margin, right: margin },
    rowPageBreak: 'avoid',
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [17, 24, 39] },
    headStyles: { fillColor: [241, 245, 249], textColor: [30, 58, 138] },
    columnStyles: { 0: { cellWidth: 55 } },
    didDrawCell: ({ section, column, cell }) => {
      if (section !== 'body' || column.index !== 0) return;
      doc.setDrawColor(30, 58, 138);
      doc.setLineWidth(0.3);
      doc.rect(cell.x + 3, cell.y + (cell.height - 3.5) / 2, 3.5, 3.5);
    },
  });
}
