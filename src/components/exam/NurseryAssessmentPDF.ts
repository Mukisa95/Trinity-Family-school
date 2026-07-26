import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { NURSERY_COMMENTARY_OPTIONS } from '@/lib/exam-assessment';

interface NurseryAssessmentPDFProps {
  examDetails: {
    name: string;
    examTypeName?: string;
    startDate: string;
    endDate: string;
  };
  classSnap: {
    name: string;
    code?: string;
  };
  subjectSnaps: Array<{
    subjectId: string;
    code: string;
    name: string;
  }>;
  processedResults: Array<{
    pupilInfo: {
      name: string;
      admissionNumber: string;
      indexNumber?: string;
      learnerIdentificationNumber?: string;
    };
    results: Record<string, {
      grade?: string;
      comment?: string;
    }>;
  }>;
  schoolSettings?: {
    generalInfo?: {
      name?: string;
    };
  };
  printOptions: {
    showPin: boolean;
    showIndexNumber: boolean;
    showLinNumber: boolean;
    showMarks: boolean;
    orientation: 'landscape' | 'portrait';
    fillMarks: boolean;
  };
}

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

export const generateNurseryAssessmentPDF = ({
  examDetails,
  classSnap,
  subjectSnaps,
  processedResults,
  schoolSettings,
  printOptions,
}: NurseryAssessmentPDFProps): Blob => {
  const doc = new jsPDF({
    orientation: printOptions.orientation || 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const schoolName = schoolSettings?.generalInfo?.name || 'School Name';
  const className = classSnap.code || classSnap.name;

  doc.setFillColor(15, 63, 133);
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(schoolName, pageWidth / 2, 10, { align: 'center' });

  doc.setFontSize(12);
  doc.text('NURSERY ASSESSMENT REPORT', pageWidth / 2, 17, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `${examDetails.name} | ${className} | ${formatDate(examDetails.startDate)} - ${formatDate(examDetails.endDate)}`,
    pageWidth / 2,
    24,
    { align: 'center' }
  );

  let currentY = 35;
  doc.setTextColor(15, 63, 133);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ASSESSMENT SCALE', margin, currentY);
  currentY += 4;

  const availableLegendWidth = pageWidth - (margin * 2);
  const legendGap = 2;
  const legendWidth = (availableLegendWidth - (legendGap * (NURSERY_COMMENTARY_OPTIONS.length - 1))) / NURSERY_COMMENTARY_OPTIONS.length;

  NURSERY_COMMENTARY_OPTIONS.forEach((option, index) => {
    const x = margin + index * (legendWidth + legendGap);
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(110, 231, 183);
    doc.roundedRect(x, currentY, legendWidth, 7, 1.2, 1.2, 'FD');
    doc.setTextColor(6, 95, 70);
    doc.setFontSize(7.5);
    doc.text(option, x + legendWidth / 2, currentY + 4.6, { align: 'center', maxWidth: legendWidth - 2 });
  });

  currentY += 11;

  const visibleSubjects = printOptions.showMarks ? subjectSnaps : [];
  const headers: string[] = ['NO.', printOptions.showPin ? 'PUPIL / PIN' : 'PUPIL'];
  if (printOptions.showIndexNumber) headers.push('INDEX NO.');
  if (printOptions.showLinNumber) headers.push('LIN');
  headers.push(...visibleSubjects.map(subject => subject.code));

  const body = processedResults.map((result, index) => {
    const row: Array<string | number> = [
      index + 1,
      printOptions.showPin
        ? `${result.pupilInfo.name}\n${result.pupilInfo.admissionNumber}`
        : result.pupilInfo.name,
    ];

    if (printOptions.showIndexNumber) row.push(result.pupilInfo.indexNumber || '');
    if (printOptions.showLinNumber) row.push(result.pupilInfo.learnerIdentificationNumber || '');

    visibleSubjects.forEach(subject => {
      const savedResult = result.results[subject.code];
      row.push(printOptions.fillMarks ? (savedResult?.comment || savedResult?.grade || '') : '');
    });

    return row;
  });

  autoTable(doc, {
    head: [headers],
    body,
    startY: currentY,
    theme: 'grid',
    margin: { top: 12, left: margin, right: margin, bottom: 14 },
    rowPageBreak: 'avoid',
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: [0, 1],
    headStyles: {
      fillColor: [219, 234, 254],
      textColor: [15, 63, 133],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      lineColor: [15, 63, 133],
      lineWidth: 0.35,
    },
    bodyStyles: {
      textColor: [31, 41, 55],
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      lineColor: [148, 163, 184],
      lineWidth: 0.25,
      cellPadding: 1.6,
      overflow: 'linebreak',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: printOptions.showPin ? 43 : 48, halign: 'left', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      const fixedColumnCount = 2 + (printOptions.showIndexNumber ? 1 : 0) + (printOptions.showLinNumber ? 1 : 0);
      if (data.column.index >= fixedColumnCount) {
        data.cell.styles.minCellWidth = 24;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [6, 95, 70];
      }
    },
    willDrawPage: (data) => {
      if (data.pageNumber <= 1) return;

      doc.setFillColor(15, 63, 133);
      doc.rect(0, 0, pageWidth, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`${schoolName} - NURSERY ASSESSMENT REPORT`, margin, 6.5);
    },
    didDrawPage: (data) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${data.pageNumber}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
      doc.text('Nursery commentary assessment', margin, pageHeight - 7);
    },
  });

  return doc.output('blob');
};
