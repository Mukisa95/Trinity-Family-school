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
      indexNumber?: string;
      learnerIdentificationNumber?: string;
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
  printOptions?: {
    showPin: boolean;
    showIndexNumber?: boolean;
    showLinNumber?: boolean;
    showMarks: boolean;
    showAgg: boolean;
    showTotal: boolean;
    showDiv: boolean;
    orientation?: 'landscape' | 'portrait';
    fillMarks: boolean;
    fillAgg: boolean;
    fillTotal: boolean;
    fillDiv: boolean;
    showMajorSubjects?: boolean;
    showBestPupil?: boolean;
    showNeedsImprovement?: boolean;
    showAggregateAnalysis?: boolean;
  };
  gradingScale?: Array<{
    minMark: number;
    maxMark: number;
    grade: string;
    aggregates: number;
  }>;
}

const calculateDivision = (aggregates: number): string => {
  if (aggregates >= 4 && aggregates <= 12) return 'I';
  if (aggregates >= 13 && aggregates <= 24) return 'II';
  if (aggregates >= 25 && aggregates <= 28) return 'III';
  if (aggregates >= 29 && aggregates <= 32) return 'IV';
  return 'U';
};

export const generateExamPDF = (props: ExamResultsPDFProps) => {
  const { examDetails, classSnap, subjectSnaps, processedResults, schoolSettings, majorSubjects, printOptions, gradingScale } = props;
  
  // Default print options (all enabled)
  const options = printOptions || {
    showPin: true,
    showIndexNumber: true,
    showLinNumber: true,
    showMarks: true,
    showAgg: true,
    showTotal: true,
    showDiv: true,
    orientation: 'landscape' as const,
    fillMarks: true,
    fillAgg: true,
    fillTotal: true,
    fillDiv: true,
    showMajorSubjects: true,
    showBestPupil: true,
    showNeedsImprovement: true,
    showAggregateAnalysis: true,
  };
  
  console.log('📊 ExamResultsPDF - options.showAggregateAnalysis:', options.showAggregateAnalysis);
  
  // Modern color scheme
  const colors = {
    primary: [30, 58, 138],      // Deep blue
    secondary: [59, 130, 246],   // Bright blue
    accent: [16, 185, 129],      // Green
    warning: [245, 158, 11],     // Amber
    danger: [239, 68, 68],       // Red
    lightBg: [249, 250, 251],    // Light gray
    darkText: [17, 24, 39],     // Dark gray
    border: [229, 231, 235],     // Light border
    headerBg: [30, 58, 138],     // Header background
  };
  
  try {
    // Create new document
    const doc = new jsPDF({
      orientation: options.orientation || 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 12;

    // ========== AGGREGATE ANALYSIS PAGE (FIRST PAGE IF ENABLED) ==========
    if (options.showAggregateAnalysis) {
      console.log('✅✅✅ Adding Aggregate Analysis as first page');
      
      // School Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text(schoolSettings?.generalInfo?.name || 'School Name', pageWidth / 2, 20, { align: 'center' });
      
      // Exam name and PERFORMANCE ANALYSIS on same line
      doc.setFontSize(12);
      doc.setTextColor(30, 64, 175);
      // Hide class name for PLE (when gradingScale is empty)
      const examNameText = (!gradingScale || gradingScale.length === 0) 
        ? `${examDetails.name.toUpperCase()}`
        : `${examDetails.name.toUpperCase()} - CLASS ${classSnap.name}`;
      const performanceText = 'PERFORMANCE ANALYSIS';
      const examNameWidth = doc.getTextWidth(examNameText);
      const performanceWidth = doc.getTextWidth(performanceText);
      const totalTextWidth = examNameWidth + performanceWidth;
      const spacing = 15;
      const startX = (pageWidth - totalTextWidth - spacing) / 2;
      
      doc.text(examNameText, startX, 30, { align: 'left' });
      doc.setTextColor(100, 116, 139);
      doc.text(performanceText, startX + examNameWidth + spacing, 30, { align: 'left' });
      
      let currentY = 38;
      
      // Calculate aggregate analysis data
      const aggregateAnalysis: { [division: string]: { [agg: number]: number } } = {
        'I': {}, 'II': {}, 'III': {}, 'IV': {}, 'U': {}
      };
      
      processedResults.forEach(result => {
        const division = result.division || 'U';
        const agg = result.totalAggregates || 0;
        if (!aggregateAnalysis[division][agg]) {
          aggregateAnalysis[division][agg] = 0;
        }
        aggregateAnalysis[division][agg]++;
      });
      
      // Calculate available space for tables
      const bottomMargin = 15;
      const availableHeight = pageHeight - currentY - bottomMargin;
      
      // AGGREGATE ANALYSIS TABLE
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('AGGREGATE ANALYSIS', pageWidth / 2, currentY, { align: 'center' });
      currentY += 5;
      
      // Define division aggregate ranges
      const divisionRanges: { [key: string]: number[] } = {
        'I': [4, 5, 6, 7, 8, 9, 10, 11, 12],
        'II': [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
        'III': [25, 26, 27, 28],
        'IV': [29, 30, 31, 32],
        'U': [33, 34, 35, 36]
      };
      
      const divisions = [
        { key: 'I', label: 'DIV I' },
        { key: 'II', label: 'DIV II' },
        { key: 'III', label: 'DIV III' },
        { key: 'IV', label: 'DIV IV' },
        { key: 'U', label: 'UNGRADED' }
      ];
      
      // Create a map of all aggregates (4-36) to column index
      const allAggregates: number[] = [];
      for (let i = 4; i <= 36; i++) {
        allAggregates.push(i);
      }
      
      // Calculate how many rows we'll have (5 divisions * 2 rows each = 10 rows)
      const aggregateTableRows = divisions.length * 2; // AGG and PUPILS rows for each division
      
      // Estimate space needed for Major Subject Analysis table
      const majorSubjectsList = majorSubjects || [];
      const subjectTableRows = majorSubjectsList.length + 1; // +1 for header
      const subjectTableTitleHeight = 7;
      const spacingBetweenTables = 8;
      
      // Calculate optimal row heights - ensure both tables fit on one page
      // Reserve space for titles and spacing first
      const reservedSpace = subjectTableTitleHeight + spacingBetweenTables;
      const usableHeight = availableHeight - reservedSpace;
      
      // Allocate space: 50% for aggregate, 50% for subject (more balanced)
      const aggregateTableAllocatedHeight = usableHeight * 0.5;
      const subjectTableAllocatedHeight = usableHeight * 0.5;
      
      // Calculate row heights with constraints
      const minRowHeight = 5;
      const maxRowHeight = 11;
      
      let aggregateRowHeight = aggregateTableAllocatedHeight / aggregateTableRows;
      let subjectRowHeight = subjectTableAllocatedHeight / subjectTableRows;
      
      // Clamp row heights
      aggregateRowHeight = Math.max(minRowHeight, Math.min(aggregateRowHeight, maxRowHeight));
      subjectRowHeight = Math.max(minRowHeight, Math.min(subjectRowHeight, maxRowHeight));
      
      // Verify total height doesn't exceed available space
      const totalAggregateHeight = aggregateRowHeight * aggregateTableRows;
      const totalSubjectHeight = subjectRowHeight * subjectTableRows;
      const totalNeeded = totalAggregateHeight + totalSubjectHeight + reservedSpace;
      
      // If we exceed, scale down proportionally
      if (totalNeeded > availableHeight) {
        const scaleFactor = availableHeight / totalNeeded;
        aggregateRowHeight *= scaleFactor;
        subjectRowHeight *= scaleFactor;
        // Re-clamp after scaling
        aggregateRowHeight = Math.max(minRowHeight, aggregateRowHeight);
        subjectRowHeight = Math.max(minRowHeight, subjectRowHeight);
      }
      
      // Calculate font sizes based on row heights - increased for better readability
      const aggregateDivisionFontSize = Math.min(10, Math.max(8, aggregateRowHeight * 1.5));
      const aggregateTypeFontSize = Math.min(9, Math.max(7, aggregateRowHeight * 1.3));
      const aggregateValueFontSize = Math.min(8, Math.max(6, aggregateRowHeight * 1.1));
      
      // Calculate table dimensions - make columns more compact
      const tableStartX = margin;
      const tableWidth = pageWidth - (margin * 2);
      const divColWidth = 20; // Reduced from 30
      const typeColWidth = 20;
      const totalColWidth = 15; // Reduced from 25 (only needs 2 digits)
      const availableWidth = tableWidth - divColWidth - typeColWidth - totalColWidth;
      const aggColWidth = availableWidth / allAggregates.length;
      
      const tableStartY = currentY;
      let currentRowY = tableStartY;
      
      // Draw data rows for each division
      divisions.forEach((division, divIndex) => {
        const divisionKey = division.key;
        const divisionLabel = division.label;
        const aggValues = divisionRanges[divisionKey];
        const divisionData = aggregateAnalysis[divisionKey] || {};
        const divisionTotal = Object.values(divisionData).reduce((sum: number, count) => sum + (count as number), 0);
        
        // Calculate merged cell height (both AGG and PUPILS rows)
        const mergedCellHeight = aggregateRowHeight * 2;
        const aggRowY = currentRowY;
        const pupilRowY = currentRowY + aggregateRowHeight;
        
        // Draw background for both rows
        if (divIndex % 2 === 0) {
          doc.setFillColor(248, 250, 252);
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.setDrawColor(203, 213, 225);
        doc.rect(tableStartX, aggRowY, tableWidth, mergedCellHeight, 'FD');
        
        // Draw vertical grid lines - skip division and total columns (they're merged)
        doc.setDrawColor(203, 213, 225);
        let gridX = tableStartX + divColWidth;
        // Line after division column (spans both rows)
        doc.line(gridX, aggRowY, gridX, aggRowY + mergedCellHeight);
        gridX += typeColWidth;
        // Line after type column (only for AGG row)
        doc.line(gridX, aggRowY, gridX, aggRowY + aggregateRowHeight);
        // Line after type column (only for PUPILS row)
        doc.line(gridX, pupilRowY, gridX, pupilRowY + aggregateRowHeight);
        // Lines for aggregate columns
        allAggregates.forEach(() => {
          gridX += aggColWidth;
          doc.line(gridX, aggRowY, gridX, aggRowY + aggregateRowHeight);
          doc.line(gridX, pupilRowY, gridX, pupilRowY + aggregateRowHeight);
        });
        // Line before total column (spans both rows)
        doc.line(gridX, aggRowY, gridX, aggRowY + mergedCellHeight);
        
        // Draw horizontal line between AGG and PUPILS rows
        doc.line(tableStartX + divColWidth, pupilRowY, tableStartX + tableWidth - totalColWidth, pupilRowY);
        
        let cellX = tableStartX;
        
        // DIVISION column - merged across both rows
        doc.setFontSize(aggregateDivisionFontSize);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
        // Center text vertically in merged cell
        doc.text(divisionLabel, cellX + divColWidth / 2, aggRowY + mergedCellHeight / 2, { align: 'center' });
        cellX += divColWidth;
        
        // TYPE: AGG
        doc.setFontSize(aggregateTypeFontSize);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('AGG', cellX + typeColWidth / 2, aggRowY + aggregateRowHeight / 2, { align: 'center' });
        cellX += typeColWidth;
        
        // Aggregate values - populate only relevant columns
        doc.setFontSize(aggregateValueFontSize);
        allAggregates.forEach(agg => {
          if (aggValues.includes(agg)) {
            doc.text(agg.toString(), cellX + aggColWidth / 2, aggRowY + aggregateRowHeight / 2, { align: 'center' });
          }
          cellX += aggColWidth;
        });
        
        // TOTAL column - merged across both rows (drawn after PUPILS row)
        // Will be drawn after PUPILS row data
        
        // PUPILS row data
        cellX = tableStartX + divColWidth;
        
        // TYPE: PUPILS
        doc.setFontSize(aggregateTypeFontSize);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('PUPILS', cellX + typeColWidth / 2, pupilRowY + aggregateRowHeight / 2, { align: 'center' });
        cellX += typeColWidth;
        
        // Pupil counts for each aggregate - populate only relevant columns
        doc.setFontSize(aggregateValueFontSize);
        allAggregates.forEach(agg => {
          if (aggValues.includes(agg)) {
            const count = divisionData[agg] || 0;
            doc.text(count > 0 ? count.toString() : '-', cellX + aggColWidth / 2, pupilRowY + aggregateRowHeight / 2, { align: 'center' });
          }
          cellX += aggColWidth;
        });
        
        // TOTAL column - merged across both rows
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(aggregateDivisionFontSize);
        doc.setTextColor(30, 64, 175);
        // Center text vertically in merged cell
        doc.text(divisionTotal > 0 ? divisionTotal.toString() : '-', cellX + totalColWidth / 2, aggRowY + mergedCellHeight / 2, { align: 'center' });
        
        currentRowY += mergedCellHeight;
      });
      
      currentY = currentRowY + spacingBetweenTables;
      
      // MAJOR SUBJECT ANALYSIS TABLE
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('MAJOR SUBJECT ANALYSIS', pageWidth / 2, currentY, { align: 'center' });
      currentY += subjectTableTitleHeight;
      
      // Calculate grade distribution for major subjects
      const grades = ['D1', 'D2', 'C3', 'C4', 'C5', 'C6', 'P7', 'P8', 'F9'];
      const subjectGradeAnalysis: { [subjectCode: string]: { [grade: string]: number } } = {};
      
      majorSubjectsList.forEach(subjectCode => {
        subjectGradeAnalysis[subjectCode] = {};
        grades.forEach(grade => {
          subjectGradeAnalysis[subjectCode][grade] = 0;
        });
        
        processedResults.forEach(result => {
          const subjectResult = result.results[subjectCode];
          if (subjectResult && subjectResult.grade) {
            const grade = subjectResult.grade;
            if (subjectGradeAnalysis[subjectCode][grade] !== undefined) {
              subjectGradeAnalysis[subjectCode][grade]++;
            }
          }
        });
      });
      
      const subjectTableData: any[] = [];
      majorSubjectsList.forEach(subjectCode => {
        const subject = subjectSnaps.find(s => s.code === subjectCode);
        if (subject) {
          const row = [subject.name.toUpperCase()];
          grades.forEach(grade => {
            const count = subjectGradeAnalysis[subjectCode][grade] || 0;
            row.push(count > 0 ? count.toString() : '-');
          });
          subjectTableData.push(row);
        }
      });
      
      // Calculate font sizes and padding for subject table - increased for better readability
      const subjectHeaderFontSize = Math.min(11, Math.max(9, subjectRowHeight * 1.2));
      const subjectBodyFontSize = Math.min(10, Math.max(8, subjectRowHeight * 1.1));
      // Calculate padding to achieve desired row height (row height = font size + 2 * padding)
      const subjectCellPadding = Math.max(2, (subjectRowHeight - subjectBodyFontSize) / 2);
      
      // Calculate maximum table height to ensure it fits
      const maxTableEndY = pageHeight - bottomMargin;
      const maxTableHeight = maxTableEndY - currentY;
      
      // Draw Major Subject Analysis table with autoTable (dynamically sized)
      autoTable(doc, {
        startY: currentY,
        head: [['SUBJECT', ...grades]],
        body: subjectTableData,
        theme: 'grid',
        pageBreak: 'avoid',
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: [255, 255, 255],
          fontSize: subjectHeaderFontSize,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: subjectCellPadding
        },
        bodyStyles: {
          fontSize: subjectBodyFontSize,
          halign: 'center',
          cellPadding: subjectCellPadding
        },
        columnStyles: {
          0: { 
            cellWidth: 60, 
            fontStyle: 'bold', 
            fillColor: [248, 250, 252], 
            halign: 'left', 
            fontSize: subjectBodyFontSize
          }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        styles: {
          cellPadding: subjectCellPadding,
          lineWidth: 0.3
        }
      });
      
      // Check if table exceeded page - if so, we need to adjust
      const finalY = (doc as any).lastAutoTable?.finalY || currentY;
      if (finalY > maxTableEndY) {
        console.warn('Subject table exceeded page height. Adjusting calculations...');
      }
      
      // Add new page for the assessment table
      doc.addPage();
    }

    // ========== MODERN HEADER DESIGN ==========
    // Header background rectangle
    doc.setFillColor(...colors.headerBg);
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    // School name - large, white, bold
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(schoolSettings?.generalInfo?.name || 'School Name', pageWidth / 2, 10, { align: 'center' });
    
    // Exam name - medium, white
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(examDetails.name, pageWidth / 2, 18, { align: 'center' });
    
    // Exam details - small, light blue
    // Hide class name and dates for PLE (when gradingScale is empty)
    if (!gradingScale || gradingScale.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(200, 220, 255);
      const detailsText = `${examDetails.examTypeName} | ${classSnap.name} | ${new Date(examDetails.startDate).toLocaleDateString()} - ${new Date(examDetails.endDate).toLocaleDateString()}`;
      doc.text(detailsText, pageWidth / 2, 23, { align: 'center' });
    }

    // Find best and worst pupils
    const bestPupil = processedResults.length > 0 ? processedResults[0] : null;
    const worstPupil = processedResults.length > 0 ? processedResults[processedResults.length - 1] : null;

    // ========== INFORMATION CARDS SECTION ==========
    let currentY = 32;
    
    // Major subjects card
    if (options.showMajorSubjects && subjectSnaps.length > 4 && majorSubjects && majorSubjects.length > 0) {
      // Card background
      doc.setFillColor(...colors.lightBg);
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 8, 2, 2, 'FD');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.primary);
      doc.text('Major Subjects (with grades):', margin + 2, currentY + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.darkText);
      const majorSubjectsText = majorSubjects.join(', ');
      const maxWidth = pageWidth - (margin * 2) - 50;
      const textWidth = doc.getStringUnitWidth(majorSubjectsText) * 9 / doc.internal.scaleFactor;
      if (textWidth > maxWidth) {
        const splitText = doc.splitTextToSize(majorSubjectsText, maxWidth);
        doc.text(splitText, margin + 50, currentY + 5);
        currentY += (splitText.length * 4) + 2;
      } else {
        doc.text(majorSubjectsText, margin + 50, currentY + 5);
        currentY += 10;
      }
    }
    
    // Performance cards in a row
    if (options.showBestPupil && bestPupil || options.showNeedsImprovement && worstPupil) {
      const cardWidth = (pageWidth - (margin * 2) - 5) / 2;
      
      // Best Performing Pupil Card
      if (options.showBestPupil && bestPupil) {
        doc.setFillColor(236, 253, 245); // Light green
        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, currentY, cardWidth, 8, 2, 2, 'FD');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text('🏆 Best Performing:', margin + 2, currentY + 4);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...colors.darkText);
        const bestText = `${bestPupil.pupilInfo.name} (${bestPupil.pupilInfo.admissionNumber})`;
        doc.text(bestText, margin + 2, currentY + 7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text(`Total: ${bestPupil.totalMarks}%`, margin + cardWidth - 30, currentY + 7);
      }
      
      // Needs Improvement Card
      if (options.showNeedsImprovement && worstPupil) {
        doc.setFillColor(254, 242, 242); // Light red
        doc.setDrawColor(239, 68, 68);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin + cardWidth + 5, currentY, cardWidth, 8, 2, 2, 'FD');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text('📈 Needs Improvement:', margin + cardWidth + 7, currentY + 4);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...colors.darkText);
        const worstText = `${worstPupil.pupilInfo.name} (${worstPupil.pupilInfo.admissionNumber})`;
        doc.text(worstText, margin + cardWidth + 7, currentY + 7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text(`Total: ${worstPupil.totalMarks}%`, margin + (cardWidth * 2) + 5 - 30, currentY + 7);
      }
      
      currentY += 10;
    }

    // ========== GRADING SCALE (Rounded Rectangle Design) ==========
    if (gradingScale && gradingScale.length > 0) {
      currentY += 3;
      
      // Section title
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.primary);
      doc.text('Grading Scale', margin, currentY);
      currentY += 6;
      
      // Display grading scale in a row with rounded rectangles
      const sorted = gradingScale.sort((a, b) => b.minMark - a.minMark);
      let scaleX = margin;
      sorted.forEach((scale) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(scaleX, currentY, 25, 6, 1, 1, 'FD');
        doc.text(`${scale.minMark}-${scale.maxMark}: ${scale.grade}`, scaleX + 12.5, currentY + 4, { align: 'center' });
        scaleX += 27;
        if (scaleX > pageWidth - margin - 25) {
          scaleX = margin;
          currentY += 8;
        }
      });
      
      currentY += 10;
    }

    // ========== MAIN RESULTS TABLE ==========
    // Calculate dynamic column widths
    const availableWidth = pageWidth - (margin * 2);
    const showIndexNumber = options.showIndexNumber !== false;
    const showLinNumber = options.showLinNumber !== false;
    const visibleSubjectSnaps = options.showMarks ? subjectSnaps : [];
    const subjectCount = visibleSubjectSnaps.length;
    const posWidth = 12;
    const studentWidth = options.showPin ? 50 : 60; // Keep name width stable across orientation changes
    const indexWidth = showIndexNumber ? 30 : 0; // Index Number column - increased to prevent wrapping
    const linWidth = showLinNumber ? 30 : 0; // LIN column - increased to prevent wrapping
    let totalWidth = options.showTotal ? 18 : 0;
    let aggWidth = options.showAgg ? 15 : 0; // Reduced since we'll use "T. AGG"
    let divWidth = options.showDiv ? 15 : 0;
    
    const fixedColumnsWidth = posWidth + studentWidth + indexWidth + linWidth + totalWidth + aggWidth + divWidth;
    const availableForSubjects = availableWidth - fixedColumnsWidth;
    
    // Calculate minimum width needed for subject codes (e.g., "ENG", "MATH", "SCI", "SST")
    // Minimum width to fit subject code and grade comfortably
    const maxSubjectCodeLength = subjectCount > 0 ? Math.max(...visibleSubjectSnaps.map(s => s.code.length)) : 0;
    const minSubjectWidth = Math.max(12, maxSubjectCodeLength * 2.5); // Minimum width for readability
    
    // Distribute available space evenly among subject columns
    // Use all available space, but ensure minimum width for readability
    const subjectWidth = subjectCount > 0 ? Math.max(minSubjectWidth, availableForSubjects / subjectCount) : 0;

    // Determine major subjects
    const determinedMajorSubjects = majorSubjects && majorSubjects.length > 0 
      ? majorSubjects 
      : (subjectSnaps.length > 4 ? subjectSnaps.slice(0, 4).map(s => s.code) : subjectSnaps.map(s => s.code));

    // Prepare headers - ensure all fit on one line
    const headers: string[] = [
      'POS',
      options.showPin ? 'Student Details' : 'Student Name',
    ];
    if (showIndexNumber) headers.push('Index No');
    if (showLinNumber) headers.push('LIN');
    headers.push(...visibleSubjectSnaps.map(s => s.code));
    
    if (options.showTotal) headers.push('Total');
    if (options.showAgg) headers.push('T. AGG'); // Abbreviated to fit on one line
    if (options.showDiv) headers.push('DIV');

    // Prepare data
    const data = processedResults.map(result => {
      const row: (string | number)[] = [
        result.position.toString(),
        options.showPin 
          ? `${result.pupilInfo.name}\n${result.pupilInfo.admissionNumber}`
          : result.pupilInfo.name,
      ];
      if (showIndexNumber) row.push(result.pupilInfo.indexNumber || '');
      if (showLinNumber) row.push(result.pupilInfo.learnerIdentificationNumber || '');
      row.push(...visibleSubjectSnaps.map(subject => {
          const subjectResult = result.results[subject.code] || { marks: 0, grade: 'F9' };
          const isMajor = determinedMajorSubjects.includes(subject.code);
          
          if (!options.fillMarks) {
            return '';
          }
          
          if (isMajor) {
            // For PLE (marks = 0), show only the grade, not "0 D1"
            if (subjectResult.marks === 0 && subjectResult.grade) {
              return subjectResult.grade;
            }
            return `${subjectResult.marks} ${subjectResult.grade}`;
          } else {
            return subjectResult.marks > 0 ? subjectResult.marks.toString() : '';
          }
        }));
      
      if (options.showTotal) {
        row.push(options.fillTotal ? result.totalMarks.toString() : '');
      }
      if (options.showAgg) {
        row.push(options.fillAgg ? result.totalAggregates.toString() : '');
      }
      if (options.showDiv) {
        row.push(options.fillDiv ? result.division : '');
      }
      
      return row;
    });

    // Generate table using jspdf-autotable with original design
    autoTable(doc, {
      head: [headers],
      body: data,
      startY: currentY,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [0, 0, 0],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      bodyStyles: {
        fontSize: 8,
        halign: 'center',
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      styles: {
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      tableLineWidth: 0.5,
      tableLineColor: [0, 0, 0],
      columnStyles: (() => {
        const styles: Record<number, any> = {
          0: { // POS
            cellWidth: posWidth,
            halign: 'center'
          },
          1: { // Student Name
            cellWidth: studentWidth,
            halign: 'left'
          }
        };

        let colIndex = 2;
        if (showIndexNumber) {
          styles[colIndex] = {
            cellWidth: indexWidth,
            halign: 'center',
            overflow: 'ellipsize',
            cellPadding: 2
          };
          colIndex++;
        }

        if (showLinNumber) {
          styles[colIndex] = {
            cellWidth: linWidth,
            halign: 'center',
            overflow: 'ellipsize',
            cellPadding: 2
          };
          colIndex++;
        }
        
        // Add styles for subject columns (evenly sized)
        for (let i = 0; i < visibleSubjectSnaps.length; i++) {
          styles[colIndex] = {
            cellWidth: subjectWidth,
            halign: 'center'
          };
          colIndex++;
        }
        
        // Add styles for conditional columns
        if (options.showTotal) {
          styles[colIndex] = { cellWidth: totalWidth, halign: 'center' };
          colIndex++;
        }
        if (options.showAgg) {
          styles[colIndex] = { cellWidth: aggWidth, halign: 'center' };
          colIndex++;
        }
        if (options.showDiv) {
          styles[colIndex] = { cellWidth: divWidth, halign: 'center' };
        }
        
        return styles;
      })(),
      // Create a columnStyle for each subject column
      didParseCell: function(data) {
        const col = data.column.index;
        // Make all lines more opaque
        data.cell.styles.lineWidth = 0.5;
        data.cell.styles.lineColor = [0, 0, 0];
        
        // Apply to subject columns only (between student details and total marks)
        const subjectStartCol = 2 + (showIndexNumber ? 1 : 0) + (showLinNumber ? 1 : 0);
        const subjectEndCol = subjectStartCol + visibleSubjectSnaps.length;
        if (col >= subjectStartCol && col < subjectEndCol) {
          data.cell.styles.cellWidth = subjectWidth;
          
          // Apply different styling for major vs non-major subjects
          const subjectIndex = col - subjectStartCol;
          const subject = visibleSubjectSnaps[subjectIndex];
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
      // Slim continuation header height — used as margin.top for ALL pages.
      // Page 1's full header is already drawn above startY so it doesn't consume margin space.
      const continuationHeaderH = 14;
      margin: { 
        top: continuationHeaderH,
        left: margin, 
        right: margin 
      },
      pageBreak: 'auto',
      rowPageBreak: 'avoid',
      willDrawPage: function(data: any) {
        if (data.pageNumber === 1) {
          // Page 1: the full header is already drawn above startY — just draw a minimal
          // top bar so the table header row doesn't sit flush against the page edge.
          // (The table startY already positions it correctly below the real header.)
          return;
        }
        // Pages 2+: draw only the slim branded bar at the very top
        doc.setFillColor(...colors.headerBg);
        doc.rect(0, 0, pageWidth, continuationHeaderH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        const schoolNameShort = (schoolSettings?.generalInfo?.name || 'School').toUpperCase();
        doc.text(
          `${schoolNameShort}  ·  ${examDetails.name}  ·  ${classSnap.name}`,
          pageWidth / 2,
          continuationHeaderH / 2 + 2,
          { align: 'center' }
        );
      },
      didDrawPage: function(data: any) {
        // Get total number of pages
        const totalPages = doc.getNumberOfPages();
        
        // Only show date/time on the last page
        if (data.pageNumber === totalPages) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(107, 114, 128);
          doc.text(
            `Generated on ${new Date().toLocaleString()}`,
            pageWidth / 2,
            pageHeight - 8,
            { align: 'center' }
          );
        }
        
        // Show page number on all pages
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(
          `Page ${data.pageNumber}`,
          pageWidth - margin,
          pageHeight - 8,
          { align: 'right' }
        );
      }
    });

    // Return blob
    const blob = doc.output('blob');
    return blob;
  } catch (error) {
    console.error("PDF generation error:", error);
    throw error;
  }
};
