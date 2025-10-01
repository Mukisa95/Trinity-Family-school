import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DutyRota, DutyTimeline, DutyPeriod, DutyAssignment } from '@/types/duty-service';
import { format } from 'date-fns';
import { SchoolSettingsService } from '../services/school-settings.service';

interface PDFGeneratorOptions {
  dutyRota: DutyRota;
  timeline: DutyTimeline;
  staff: any[];
  pupils: any[];
  academicYear?: { id: string; name: string };
  term?: { id: string; name: string };
}

export const generateDutyRotaPDF = async ({
  dutyRota,
  timeline,
  staff,
  pupils,
  academicYear,
  term
}: PDFGeneratorOptions) => {
  // Validate timeline data
  if (!timeline || !timeline.periods) {
    throw new Error('Invalid timeline data: missing periods');
  }

  console.log('Timeline data:', {
    rotaId: timeline.rotaId,
    rotaName: timeline.rotaName,
    periodsCount: timeline.periods.length,
    periods: timeline.periods.map(p => ({ name: p.periodName, assignmentsCount: p.assignments?.length || 0 }))
  });

  // Fetch school name from settings
  let schoolName = 'Trinity Family Schools'; // Default fallback
  try {
    const schoolSettings = await SchoolSettingsService.getSchoolSettings();
    if (schoolSettings?.generalInfo?.name) {
      schoolName = schoolSettings.generalInfo.name;
    }
  } catch (error) {
    console.warn('Could not fetch school settings, using default name:', error);
  }

  const doc = new jsPDF();
  
  // Add header with school name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName, 105, 20, { align: 'center' });
  
  // Add duty rota name and academic year/term in the same line
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  
  const academicYearText = academicYear ? academicYear.name : dutyRota.academicYearId;
  const termText = term ? term.name : dutyRota.termId;
  
  let reportTitle = `${dutyRota.dutyName}`;
  if (dutyRota.termId) {
    reportTitle += ` (${academicYearText} - ${termText})`;
  } else {
    reportTitle += ` (${academicYearText})`;
  }
  
  doc.text(reportTitle, 105, 30, { align: 'center' });
  
  // Function to get member name (compact format)
  const getMemberName = (memberId: string, memberType: string) => {
    if (memberType === 'staff') {
      const member = staff.find(s => s.id === memberId);
      return member ? `${member.firstName} ${member.lastName}` : `Staff ID: ${memberId}`;
    } else if (memberType === 'prefects' || memberType === 'pupils') {
      const member = pupils.find(p => p.id === memberId);
      if (member) {
        // Try different possible class field names
        const classInfo = member.classCode || member.className || member.class || 'No Class';
        return `${member.firstName} ${member.lastName} (${classInfo})`;
      }
      return `Pupil ID: ${memberId}`;
    }
    return `Unknown ID: ${memberId}`;
  };
  
  // Function to get status text
  const getStatusText = (period: DutyPeriod) => {
    if (period.isCompleted) return 'Completed';
    if (period.isCurrent) return 'Current';
    return 'Upcoming';
  };
  
  // Function to format date range (compact single line)
  const formatDateRange = (startDate: string, endDate: string) => {
    return `${format(new Date(startDate), 'MMM dd')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`;
  };
  
  // Analyze all periods to determine which columns are needed
  const allAssignments = timeline.periods.flatMap(period => period.assignments || []);
  const hasSupervisors = allAssignments.some(a => a.isSupervisor);
  const hasStaff = allAssignments.some(a => a.memberType === 'staff');
  const hasPrefects = allAssignments.some(a => a.memberType === 'prefects');

  // Define column structure based on what's actually used
  const columns = [
    { key: 'period', title: 'Period', width: '25%' },
    ...(hasSupervisors ? [{ key: 'supervisors', title: 'Supervisors', width: '25%' }] : []),
    ...(hasStaff ? [{ key: 'staff', title: 'Staff', width: '25%' }] : []),
    ...(hasPrefects ? [{ key: 'prefects', title: 'Prefects', width: '25%' }] : [])
  ];

  // Adjust column widths to use available space
  const totalColumns = columns.length;
  const equalWidth = `${100 / totalColumns}%`;
  columns.forEach(col => col.width = equalWidth);

  // Debug logging for column structure
  console.log('Dynamic columns:', {
    totalColumns,
    hasSupervisors,
    hasStaff,
    hasPrefects,
    columns: columns.map(col => ({ title: col.title, width: col.width }))
  });

  // Prepare data for the table
  const tableData = timeline.periods.filter(period => period).map(period => {
    // Each period has its own assignments array
    const assignments = period.assignments || [];
    
    // Debug logging
    console.log('Processing period:', period.periodName, 'with assignments:', assignments.length);
    
    // Group assignments by type
    const staffAssignments = assignments.filter(a => a.memberType === 'staff');
    const prefectAssignments = assignments.filter(a => a.memberType === 'prefects');
    
    // Get supervisors
    const supervisors = assignments.filter(a => a.isSupervisor).map(a => 
      getMemberName(a.memberId, a.memberType)
    );
    
    // Format assigned members
    const formatMembers = (assignments: DutyAssignment[]) => {
      if (assignments.length === 0) return 'None';
      return assignments.map(a => getMemberName(a.memberId, a.memberType)).join('\n');
    };
    
    // Build row data dynamically based on available columns
    const rowData = [
      `${period.periodName}\n${formatDateRange(period.startDate, period.endDate)}`
    ];
    
    if (hasSupervisors) {
      rowData.push(supervisors.join(', ') || 'None');
    }
    
    if (hasStaff) {
      rowData.push(formatMembers(staffAssignments));
    }
    
    if (hasPrefects) {
      rowData.push(formatMembers(prefectAssignments));
    }
    
    return rowData;
  });
  
  // Calculate optimal font size based on available space and content
  const pageHeight = doc.internal.pageSize.height;
  const headerHeight = 40; // Space taken by header
  const footerHeight = 20; // Space for page number
  const availableHeight = pageHeight - headerHeight - footerHeight;
  const rowCount = tableData.length;
  const minRowHeight = 12; // Reduced minimum height per row
  const maxRowHeight = availableHeight / rowCount;
  const optimalRowHeight = Math.max(minRowHeight, Math.min(maxRowHeight, 18)); // Reduced cap to 18px
  
  // Calculate font size based on row height (more conservative)
  const baseFontSize = 7;
  const fontSizeMultiplier = optimalRowHeight / minRowHeight;
  const dynamicFontSize = Math.min(Math.max(baseFontSize * fontSizeMultiplier, 6), 10); // Between 6-10pt
  
  // Calculate cell padding based on font size (reduced)
  const dynamicCellPadding = Math.max(1, Math.floor(dynamicFontSize / 5));

  // Add the table
  autoTable(doc, {
    head: [
      columns.map(col => col.title)
    ],
    body: tableData.length > 0 ? tableData : [columns.map(() => 'No periods available')],
    startY: 40,
    styles: {
      fontSize: dynamicFontSize,
      cellPadding: dynamicCellPadding,
      minCellHeight: optimalRowHeight,
      lineWidth: 0.1, // Thinner lines
      overflow: 'linebreak',
      halign: 'left',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: dynamicFontSize,
      cellPadding: dynamicCellPadding,
      minCellHeight: optimalRowHeight * 0.8, // Smaller header row
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: columns.reduce((styles, col, index) => {
      styles[index] = { cellWidth: col.width };
      return styles;
    }, {} as any),
    margin: { top: 20, right: 10, bottom: 0, left: 10 },
    didDrawPage: function (data) {
      // Add page number
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(10);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
    },
    tableWidth: 'auto',
    theme: 'grid',
    pageBreak: 'avoid', // Prevent page breaks
    showFoot: 'lastPage',
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'normal',
    },
  });
  
  // Footer removed - table now extends to bottom of page
  
  // Save the PDF
  const fileName = `${dutyRota.dutyName.replace(/[^a-zA-Z0-9]/g, '_')}_Duty_Rota_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};
