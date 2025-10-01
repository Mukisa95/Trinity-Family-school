import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFSignatureService } from '@/lib/services/pdf-signature.service';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface Subject {
  name: string;
  code: string;
  fullMarks: number;
  marksGained: number;
  grade: string;
  aggregates?: number;
  remarks: string;
  teacherInitials: string;
}

interface PupilReportData {
  pupilInfo: {
    name: string;
    admissionNumber: string;
    pupilId: string;
    age?: number;
    className?: string;
  };
  subjects: Subject[];
  totalMarks: number;
  totalAggregates: number;
  division: string;
  position: number;
  classTeacherReport?: string;
  headTeacherReport?: string;
  promotionStatus?: string;
}

interface ComprehensiveReportsProps {
  examDetails: {
    name: string;
    examTypeName: string;
    startDate: string;
    endDate: string;
    academicYearId: string;
    termId: string;
  };
  classSnap: {
    name: string;
  };
  subjectSnaps: Array<{
    subjectId: string;
    code: string;
    name: string;
  }>;
  pupilReports: PupilReportData[];
  schoolSettings?: {
    generalInfo?: {
      name?: string;
      physicalAddress?: string;
      phone?: string;
      email?: string;
      motto?: string;
    };
  };
  termDates?: {
    nextTermBegins?: string;
    nextTermEnds?: string;
  };
}

const getGradeColor = (grade: string): [number, number, number] => {
  if (grade.startsWith('D')) return [0, 150, 0]; // Green
  if (grade.startsWith('C')) return [0, 100, 200]; // Blue
  if (grade.startsWith('P')) return [200, 150, 0]; // Orange
  return [200, 0, 0]; // Red for F9
};

const getDivisionDescription = (division: string): string => {
  switch (division) {
    case 'I': return 'FIRST CLASS';
    case 'II': return 'SECOND CLASS';
    case 'III': return 'THIRD CLASS';
    case 'IV': return 'FOURTH CLASS';
    default: return 'UNGRADED';
  }
};

const generateGradingScale = (): Array<{grade: string, minMark: number, maxMark: number, aggregates: number}> => {
  return [
    { grade: 'D1', minMark: 80, maxMark: 100, aggregates: 1 },
    { grade: 'D2', minMark: 70, maxMark: 79, aggregates: 2 },
    { grade: 'C3', minMark: 65, maxMark: 69, aggregates: 3 },
    { grade: 'C4', minMark: 60, maxMark: 64, aggregates: 4 },
    { grade: 'C5', minMark: 55, maxMark: 59, aggregates: 5 },
    { grade: 'C6', minMark: 50, maxMark: 54, aggregates: 6 },
    { grade: 'P7', minMark: 45, maxMark: 49, aggregates: 7 },
    { grade: 'P8', minMark: 40, maxMark: 44, aggregates: 8 },
    { grade: 'F9', minMark: 0, maxMark: 39, aggregates: 9 }
  ];
};

export const generateComprehensiveReportsPDF = (props: ComprehensiveReportsProps) => {
  const { examDetails, classSnap, subjectSnaps, pupilReports, schoolSettings, termDates } = props;
  
  try {
    // Create new document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    
    // Remove the first page since we'll add content immediately
    let isFirstReport = true;

    pupilReports.forEach((pupilReport, reportIndex) => {
      if (!isFirstReport) {
        doc.addPage();
      }
      isFirstReport = false;

      // School Header
      doc.setFillColor(30, 58, 138); // Navy blue
      doc.rect(margin, margin, pageWidth - 2 * margin, 25, 'F');
      
      // School Name
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text(schoolSettings?.generalInfo?.name || 'SCHOOL NAME', pageWidth / 2, margin + 10, { align: 'center' });
      
      // School Contact Info
      doc.setFontSize(10);
      let contactY = margin + 18;
      if (schoolSettings?.generalInfo?.physicalAddress) {
        doc.text(schoolSettings.generalInfo.physicalAddress, pageWidth / 2, contactY, { align: 'center' });
        contactY += 4;
      }
      
      const contactInfo = [];
      if (schoolSettings?.generalInfo?.phone) contactInfo.push(`Tel: ${schoolSettings.generalInfo.phone}`);
      if (schoolSettings?.generalInfo?.email) contactInfo.push(`Email: ${schoolSettings.generalInfo.email}`);
      
      if (contactInfo.length > 0) {
        doc.text(contactInfo.join(' | '), pageWidth / 2, contactY, { align: 'center' });
      }

      // Report Title
      doc.setFillColor(30, 58, 138);
      const titleY = margin + 30;
      doc.rect(margin + 40, titleY, pageWidth - 2 * margin - 80, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text('TERMINAL REPORT', pageWidth / 2, titleY + 8, { align: 'center' });

      // Student Information Section
      const studentInfoY = titleY + 20;
      doc.setFillColor(243, 244, 246); // Light gray
      doc.rect(margin, studentInfoY, pageWidth - 2 * margin, 25, 'F');
      doc.setDrawColor(30, 58, 138);
      doc.rect(margin, studentInfoY, pageWidth - 2 * margin, 25);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      
      // First row of student info
      let infoY = studentInfoY + 8;
      doc.text('Pupil:', margin + 5, infoY);
      doc.setFont('helvetica', 'bold');
      doc.text(pupilReport.pupilInfo.name, margin + 25, infoY);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Class:', margin + 90, infoY);
      doc.setFont('helvetica', 'bold');
      doc.text(classSnap.name, margin + 105, infoY);
      
      doc.setFont('helvetica', 'normal');
      doc.text('PIN:', margin + 140, infoY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28); // Red
      doc.text(pupilReport.pupilInfo.admissionNumber, margin + 155, infoY);

      // Second row of student info
      infoY += 8;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text('Year:', margin + 5, infoY);
      doc.setFont('helvetica', 'bold');
      doc.text(examDetails.academicYearId || '2025', margin + 25, infoY);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Term:', margin + 60, infoY);
      doc.setFont('helvetica', 'bold');
      doc.text(`Term ${examDetails.termId?.split('-')[1] || '1'}`, margin + 75, infoY);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Position:', margin + 110, infoY);
      doc.setFont('helvetica', 'bold');
      doc.text(`${pupilReport.position} of ${pupilReports.length}`, margin + 130, infoY);

      // Performance Table
      const tableY = studentInfoY + 35;
      
      // Table title
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${examDetails.name.toUpperCase()} PERFORMANCE`, pageWidth / 2, tableY, { align: 'center' });

      // Prepare table data
      const tableHeaders = ['SUBJECT', 'TOTAL', 'MARKS', 'GRADE', 'REMARKS', 'INIT.'];
      const tableData = pupilReport.subjects.map(subject => [
        subject.name,
        subject.fullMarks.toString(),
        subject.marksGained.toString(),
        subject.grade,
        subject.remarks || 'Good',
        subject.teacherInitials || '-'
      ]);

      // Add totals row
      const totalFullMarks = pupilReport.subjects.reduce((sum, s) => sum + s.fullMarks, 0);
      tableData.push([
        'TOTALS',
        totalFullMarks.toString(),
        pupilReport.totalMarks.toString(),
        `AGG: ${pupilReport.totalAggregates}`,
        pupilReport.promotionStatus || '-',
        '-'
      ]);

      // Generate results table
      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: tableY + 8,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 9,
          halign: 'center',
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 45 }, // Subject
          1: { cellWidth: 20 }, // Total
          2: { cellWidth: 20 }, // Marks
          3: { cellWidth: 20 }, // Grade
          4: { cellWidth: 40 }, // Remarks
          5: { cellWidth: 15 }, // Initials
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        didParseCell: function(data) {
          // Style the totals row
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [254, 242, 242];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [185, 28, 28];
          }
          
          // Color grades
          if (data.column.index === 3 && data.row.index < tableData.length - 1) {
            const grade = data.cell.text[0];
            if (grade) {
              const color = getGradeColor(grade);
              data.cell.styles.textColor = color;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: margin, right: margin }
      });

      // Division Section
      const finalY = (doc as any).lastAutoTable.finalY || tableY + 60;
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('DIVISION:', pageWidth - margin - 60, finalY + 10);
      doc.setTextColor(185, 28, 28);
      doc.text(`${pupilReport.division} - ${getDivisionDescription(pupilReport.division)}`, pageWidth - margin - 35, finalY + 10);

      // Grading Scale (only if 4 or fewer subjects)
      if (pupilReport.subjects.length <= 4) {
        const gradeScale = generateGradingScale();
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('GRADING SCALE USED', margin, finalY + 20);
        
        const scaleY = finalY + 25;
        const scaleWidth = (pageWidth - 2 * margin) / gradeScale.length;
        
        gradeScale.forEach((scale, index) => {
          const x = margin + index * scaleWidth;
          doc.setFillColor(248, 250, 252);
          doc.rect(x, scaleY, scaleWidth, 8, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.rect(x, scaleY, scaleWidth, 8);
          
          doc.setTextColor(30, 58, 138);
          doc.setFontSize(7);
          doc.text(`${scale.grade}(${scale.minMark}-${scale.maxMark})`, x + scaleWidth/2, scaleY + 5, { align: 'center' });
        });
      }

      // Teacher Reports Section
      const reportsY = finalY + (pupilReport.subjects.length <= 4 ? 40 : 25);
      
      // Class Teacher Report
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, reportsY, pageWidth - 2 * margin, 20, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, reportsY, pageWidth - 2 * margin, 20);
      
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('CLASS TEACHER\'S REPORT:', margin + 5, reportsY + 8);
      
      doc.setTextColor(21, 128, 61); // Green
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const classReport = pupilReport.classTeacherReport || 'Good performance. Keep it up!';
      doc.text(classReport, margin + 60, reportsY + 8, { maxWidth: pageWidth - margin - 65 });
      
      // Signature line
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text('Sign:', pageWidth - margin - 40, reportsY + 15);
      doc.line(pageWidth - margin - 35, reportsY + 15, pageWidth - margin - 5, reportsY + 15);

      // Head Teacher Report
      const headReportY = reportsY + 25;
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, headReportY, pageWidth - 2 * margin, 20, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, headReportY, pageWidth - 2 * margin, 20);
      
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('HEAD TEACHER\'S REPORT:', margin + 5, headReportY + 8);
      
      doc.setTextColor(185, 28, 28); // Red
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const headReport = pupilReport.headTeacherReport || 'Excellent progress shown.';
      doc.text(headReport, margin + 60, headReportY + 8, { maxWidth: pageWidth - margin - 65 });
      
      // Signature line
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text('Sign:', pageWidth - margin - 40, headReportY + 15);
      doc.line(pageWidth - margin - 35, headReportY + 15, pageWidth - margin - 5, headReportY + 15);

      // Footer Section
      const footerY = headReportY + 30;
      
      // Term dates
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, footerY, pageWidth - 2 * margin, 15, 'F');
      doc.setDrawColor(30, 58, 138);
      doc.rect(margin, footerY, pageWidth - 2 * margin, 15);
      
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('NEXT TERM BEGINS:', margin + 5, footerY + 8);
      doc.setTextColor(51, 65, 85);
      doc.text(termDates?.nextTermBegins || 'TBA', margin + 50, footerY + 8);
      
      doc.setTextColor(30, 58, 138);
      doc.text('TERM ENDS:', margin + 100, footerY + 8);
      doc.setTextColor(51, 65, 85);
      doc.text(termDates?.nextTermEnds || 'TBA', margin + 130, footerY + 8);

      // School Motto
      if (schoolSettings?.generalInfo?.motto) {
        doc.setTextColor(30, 58, 138);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bolditalic');
        doc.text(`"${schoolSettings.generalInfo.motto}"`, pageWidth / 2, footerY + 25, { align: 'center' });
      }

      // Add digital signatures for this exam report
      if (examDetails && pupilReport.pupilInfo.pupilId) {
        PDFSignatureService.addSignaturesToJsPDF(
          doc,
          'exam_result',
          `${examDetails.name}-${pupilReport.pupilInfo.pupilId}`,
          {
            position: 'footer',
            fontSize: 8,
            showTimestamp: true,
            showUserRole: true,
            maxSignatures: 2,
            includeActions: ['created', 'recorded', 'approved']
          }
        );
      }
    });

    // Save the PDF
    doc.save(`${examDetails.name.replace(/\s+/g, '_')}_comprehensive_reports.pdf`);
  } catch (error) {
    console.error("Comprehensive reports PDF generation error:", error);
    throw error;
  }
}; 