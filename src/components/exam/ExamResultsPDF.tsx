import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface ExamResultsPDFProps {
  examDetails: {
    name: string;
    examTypeName: string;
    startDate: string;
    endDate: string;
  };
  classSnap: {
    name: string;
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
      pupilId: string;
    };
    results: Record<string, {
      marks: number;
      grade: string;
      aggregates: number;
    }>;
    totalMarks: number;
    totalAggregates: number;
    division: string;
    position: number;
  }>;
  schoolSettings?: {
    generalInfo?: {
      name?: string;
    };
  };
  majorSubjects?: string[];
}

const calculateDivision = (aggregates: number): string => {
  if (aggregates >= 4 && aggregates <= 12) return 'I';
  if (aggregates >= 13 && aggregates <= 24) return 'II';
  if (aggregates >= 25 && aggregates <= 28) return 'III';
  if (aggregates >= 29 && aggregates <= 32) return 'IV';
  return 'U';
};

export const generateExamPDF = (props: ExamResultsPDFProps) => {
  const { examDetails, classSnap, subjectSnaps, processedResults, schoolSettings, majorSubjects } = props;
  
  try {
    // Create new document
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Add header content to first page BEFORE creating table
    doc.setFontSize(20);
    doc.text(schoolSettings?.generalInfo?.name || 'School Name', doc.internal.pageSize.width / 2, 15, { align: 'center' });

    doc.setFontSize(16);
    doc.text(`${examDetails.name} - Results`, doc.internal.pageSize.width / 2, 25, { align: 'center' });

    doc.setFontSize(12);
    doc.text(
      `${examDetails.examTypeName} | ${classSnap.name} | ${new Date(examDetails.startDate).toLocaleDateString()} - ${new Date(examDetails.endDate).toLocaleDateString()}`,
      doc.internal.pageSize.width / 2,
      35,
      { align: 'center' }
    );

    // Find best and worst pupils
    const bestPupil = processedResults.length > 0 ? processedResults[0] : null;
    const worstPupil = processedResults.length > 0 ? processedResults[processedResults.length - 1] : null;

    // Add major subjects legend and performance summary with proper positioning
    let currentY = 45;
    
    // Add major subjects legend if more than 4 subjects
    if (subjectSnaps.length > 4 && majorSubjects && majorSubjects.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 139);
      doc.text('★ Major Subjects (with grades):', 15, currentY);
      doc.setTextColor(0, 0, 0);
      
      // Handle long major subjects list by splitting if necessary
      const majorSubjectsText = majorSubjects.join(', ');
      const maxWidth = doc.internal.pageSize.width - 85; // Leave space for the label
      
      // Check if text is too wide and split if necessary
      const textWidth = doc.getStringUnitWidth(majorSubjectsText) * 10 / doc.internal.scaleFactor;
      if (textWidth > maxWidth) {
        const splitText = doc.splitTextToSize(majorSubjectsText, maxWidth);
        doc.text(splitText, 85, currentY);
        // Add extra spacing based on number of lines
        currentY += (splitText.length * 4) + 3;
      } else {
        doc.text(majorSubjectsText, 85, currentY);
        currentY += 7; // Standard spacing for single line
      }
    }
    
    // Add performance summary (without aggregates display)
    if (bestPupil) {
      doc.setFontSize(11);
      doc.setTextColor(0, 100, 0);
      doc.text('Best Performing Pupil:', 15, currentY);
      doc.setTextColor(0, 0, 0);
      doc.text(`${bestPupil.pupilInfo.name} (${bestPupil.pupilInfo.admissionNumber}) - Total Marks: ${bestPupil.totalMarks}%`, 60, currentY);
      currentY += 7; // Move down for next line
    }
    
    if (worstPupil) {
      doc.setFontSize(11);
      doc.setTextColor(139, 0, 0);
      doc.text('Needs Improvement:', 15, currentY);
      doc.setTextColor(0, 0, 0);
      doc.text(`${worstPupil.pupilInfo.name} (${worstPupil.pupilInfo.admissionNumber}) - Total Marks: ${worstPupil.totalMarks}%`, 60, currentY);
      currentY += 7; // Move down for next line
    }

    // Add separator line (adjust position based on content above)
    const separatorY = currentY + 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, separatorY, doc.internal.pageSize.width - 15, separatorY);

    // Get available page width for the table
    const pageWidth = doc.internal.pageSize.width;
    const marginLeft = 15;
    const marginRight = 15;
    const availableWidth = pageWidth - marginLeft - marginRight;
    
    // Calculate dynamic column widths based on number of subjects
    const subjectCount = subjectSnaps.length;
    let posWidth = 12;
    let studentWidth = 40;
    let marksWidth = 15;
    let aggWidth = 15;
    let divWidth = 12;
    
    // Calculate width available for subjects (including AGG column)
    const fixedColumnsWidth = posWidth + studentWidth + marksWidth + aggWidth + divWidth;
    const availableForSubjects = availableWidth - fixedColumnsWidth;
    
    // Minimum width per subject column (will show horizontal scrollbar if needed)
    const minSubjectWidth = 15;
    const subjectWidth = Math.max(minSubjectWidth, availableForSubjects / subjectCount);

    // Determine major subjects
    const determinedMajorSubjects = majorSubjects && majorSubjects.length > 0 
      ? majorSubjects 
      : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));

    // Prepare table headers with abbreviated headings (including AGG column)
    const headers = [
      'POS',
      'Student Details',
      ...subjectSnaps.map(s => s.code),
      'Total',
      'Total AGG',
      'DIV'
    ];

    // Prepare table data
    const data = processedResults.map(result => {
      return [
        result.position.toString(),
        `${result.pupilInfo.name}\n${result.pupilInfo.admissionNumber}`,
        ...subjectSnaps.map(subject => {
          const subjectResult = result.results[subject.code] || { marks: 0, grade: 'F9' };
          const isMajor = determinedMajorSubjects.includes(subject.code);
          
          // Only show grades for major subjects, only marks for non-major
          if (isMajor) {
            return `${subjectResult.marks} ${subjectResult.grade}`;
          } else {
            return subjectResult.marks.toString();
          }
        }),
        result.totalMarks.toString(),
        result.totalAggregates.toString(),
        result.division
      ];
    });

    // Generate table using jspdf-autotable
    autoTable(doc, {
      head: [headers],
      body: data,
      startY: separatorY + 4, // Start after the separator line
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [0, 0, 0],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8,
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { // POS
          cellWidth: posWidth,
          halign: 'center'
        },
        1: { // Student Details
          cellWidth: studentWidth,
          halign: 'left'
        },
        [headers.length - 3]: { // Total Marks
          cellWidth: marksWidth
        },
        [headers.length - 2]: { // Total AGG
          cellWidth: aggWidth
        },
        [headers.length - 1]: { // DIV
          cellWidth: divWidth
        }
      },
      // Create a columnStyle for each subject column
      didParseCell: function(data) {
        const col = data.column.index;
        // Apply to subject columns only (between student details and total marks)
        if (col > 1 && col < headers.length - 3) {
          data.cell.styles.cellWidth = subjectWidth;
          
          // Apply different styling for major vs non-major subjects
          const subjectIndex = col - 2;
          const subject = subjectSnaps[subjectIndex];
          const isMajor = determinedMajorSubjects.includes(subject.code);
          
          if (isMajor) {
            // Major subjects: slightly blue background
            data.cell.styles.fillColor = [230, 240, 255];
          } else {
            // Non-major subjects: neutral background
            data.cell.styles.fillColor = [245, 245, 245];
          }
        }
      },
      margin: { 
        top: 15, // Small consistent margin for ALL pages
        left: marginLeft, 
        right: marginRight 
      },
      pageBreak: 'auto',
      rowPageBreak: 'avoid',
      didDrawPage: function(data: any) {
        // Only add simple header on continuation pages (page 2+)
        if (data.pageNumber > 1) {
          doc.setFontSize(12);
          doc.setTextColor(0, 0, 0);
          doc.text(`${examDetails.name} - Results (Continued)`, doc.internal.pageSize.width / 2, 10, { align: 'center' });
        }
        
        // Add footer on each page
        doc.setFontSize(10);
        doc.text(
          `Generated on ${new Date().toLocaleString()}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
        
        // Add page number
        doc.text(
          `Page ${data.pageNumber}`,
          doc.internal.pageSize.width - 20,
          doc.internal.pageSize.height - 10
        );
      }
    });

    // Save the PDF
    doc.save(`${examDetails.name.replace(/\s+/g, '_')}_results.pdf`);
  } catch (error) {
    console.error("PDF generation error:", error);
    throw error;
  }
}; 