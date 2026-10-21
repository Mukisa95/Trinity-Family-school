import { drawListDocumentHeader, drawListDocumentFooters, listTableStyles } from '@/lib/printing/list-document-jspdf';
import { applyMonochromePDF } from '@/lib/printing/monochrome-jspdf';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BLANK_ASSESSMENT_OPTIONS } from '@/lib/utils/assessment-print-options';
import { drawMajorSubjectChecklist } from './assessment-print-layout';

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
    blankAssessment?: boolean;
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
  printOptions: requestedOptions,
}: NurseryAssessmentPDFProps): Blob => {
  const printOptions = requestedOptions.blankAssessment ? BLANK_ASSESSMENT_OPTIONS : requestedOptions;
  const doc = new jsPDF({
    orientation: printOptions.orientation || 'landscape',
    unit: 'mm',
    format: 'a4',
  });
  applyMonochromePDF(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const schoolName = schoolSettings?.generalInfo?.name || 'School Name';
  const className = classSnap.code || classSnap.name;

  const registerHeader = { schoolName, title: examDetails.name,
    context: classSnap.name,
    date: `${new Date(examDetails.startDate).toLocaleDateString('en-GB')} - ${new Date(examDetails.endDate).toLocaleDateString('en-GB')}`,
    count: `${processedResults.length} PUPILS`, margin };
  let currentY = drawListDocumentHeader(doc, registerHeader);
    const headerPages = new Set<number>([1]);
    const drawContinuationHeader = () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      if (headerPages.has(page)) return;
      headerPages.add(page);
      drawListDocumentHeader(doc, { ...registerHeader, compact: true });
    };


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
  const showNumber = !requestedOptions.blankAssessment;
  const nameColumn = showNumber ? 1 : 0;
  const headers: string[] = [...(showNumber ? ['NO.'] : []), printOptions.showPin ? 'PUPIL / PIN' : 'PUPIL'];
  if (printOptions.showIndexNumber) headers.push('INDEX NO.');
  if (printOptions.showLinNumber) headers.push('LIN');
  headers.push(...visibleSubjects.map(subject => subject.code));

  const body = processedResults.map((result, index) => {
    const row: Array<string | number> = [
      ...(showNumber ? [index + 1] : []),
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
    margin: { top: 33, left: margin, right: margin, bottom: 18 },
    rowPageBreak: 'avoid',
    horizontalPageBreak: requestedOptions.blankAssessment ? 48 + visibleSubjects.length * 12 > availableLegendWidth + 0.1 : true,
    horizontalPageBreakRepeat: showNumber ? [0, 1] : [0],
    ...listTableStyles,
    headStyles: { ...listTableStyles.headStyles, halign: 'center' },
    bodyStyles: { fontSize: 7.5, halign: 'center', cellPadding: 1.6, ...(requestedOptions.blankAssessment ? { minCellHeight: 8 } : {}) },
    columnStyles: {
      ...(showNumber ? { 0: { cellWidth: 10, halign: 'center' as const } } : {}),
      [nameColumn]: { cellWidth: printOptions.showPin ? 43 : 48, halign: 'left', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      const fixedColumnCount = nameColumn + 1 + (printOptions.showIndexNumber ? 1 : 0) + (printOptions.showLinNumber ? 1 : 0);
      if (data.column.index >= fixedColumnCount) {
        data.cell.styles.minCellWidth = requestedOptions.blankAssessment ? 12 : 24;
        if (requestedOptions.blankAssessment) data.cell.styles.cellWidth = Math.max(12, (availableLegendWidth - 48) / visibleSubjects.length);
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [6, 95, 70];
      }
    },

    didDrawPage: drawContinuationHeader,
  });
  if (requestedOptions.blankAssessment) drawMajorSubjectChecklist(doc, subjectSnaps, (doc as any).lastAutoTable.finalY + 5, margin, drawContinuationHeader);
  drawListDocumentFooters(doc, 'Nursery commentary assessment', margin);
  return doc.output('blob');
};
