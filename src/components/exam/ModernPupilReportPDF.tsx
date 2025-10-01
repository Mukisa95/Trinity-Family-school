import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Font registration - Using built-in Helvetica fonts for better compatibility
Font.register({
  family: 'Helvetica',
  src: 'Helvetica',
  fontStyle: 'normal',
  fontWeight: 'normal'
});

Font.register({
  family: 'Helvetica-Bold',
  src: 'Helvetica-Bold',
  fontStyle: 'normal',
  fontWeight: 'bold'
});

Font.register({
  family: 'Helvetica-Oblique',
  src: 'Helvetica-Oblique',
  fontStyle: 'italic',
  fontWeight: 'normal'
});

Font.register({
  family: 'Helvetica-BoldOblique',
  src: 'Helvetica-BoldOblique',
  fontStyle: 'italic',
  fontWeight: 'bold'
});

// Proper margin system - Border at 1cm from page edge, content 0.5cm inside border
const PAGE_MARGIN = 28.3; // 1cm from page edge to border
const CONTENT_PADDING = 14.2; // 0.5cm from border to content  
const TOTAL_CONTENT_MARGIN = PAGE_MARGIN + CONTENT_PADDING; // Total space from edge to content = 1.5cm
const HALF_MARGIN = PAGE_MARGIN / 2;
const QUARTER_MARGIN = PAGE_MARGIN / 4;

// Dynamic sizing calculation helper
const calculateDynamicSizes = (subjectCount: number) => {
  // Base measurements for A4 page (595 x 842 points)
  // Available height calculation: 
  // - Page padding: 1cm top + 1cm bottom = 2cm (56.6 points)
  // - Content padding: 0.5cm top + 0.5cm bottom = 1cm (28.4 points)  
  // - Total: 3cm (85 points) removed from 842 = 757 points available
  const availableHeight = 842 - ((PAGE_MARGIN + CONTENT_PADDING) * 2);
  
  // Fixed elements heights (approximate)
  const headerHeight = 200; // Header with school info, photo, student info
  const tableHeaderHeight = 30; // Table header
  const summaryHeight = 50; // Performance summary
  const gradingScaleHeight = 35; // Grading scale (always shown)
  const teacherReportsHeight = 120; // Teacher reports
  const footerHeight = 50; // Footer with term dates
  
  // Calculate available height for table rows
  const fixedElementsHeight = headerHeight + tableHeaderHeight + summaryHeight + gradingScaleHeight + teacherReportsHeight + footerHeight;
  const availableRowHeight = availableHeight - fixedElementsHeight;
  
  // Calculate row height based on available space
  const baseRowHeight = Math.max(18, Math.min(28, availableRowHeight / subjectCount));
  
  // Calculate font sizes and spacing
  const baseFontSize = subjectCount <= 4 ? 10 : 
                      subjectCount <= 6 ? 9 : 
                      subjectCount <= 8 ? 8.5 : 8;
  
  const headerFontSize = baseFontSize + 1;
  const cellPadding = Math.max(3, Math.min(6, baseRowHeight / 4));
  
  return {
    rowHeight: baseRowHeight,
    baseFontSize,
    headerFontSize,
    cellPadding,
    // Compact grading scale when many subjects
    gradingScaleCompact: subjectCount > 6,
    // Reduce spacing between sections when many subjects
    sectionSpacing: subjectCount <= 4 ? 8 : 
                   subjectCount <= 6 ? 6 : 4
  };
};

// Function to determine if pupil name is too long and needs special layout
const calculateStudentInfoLayout = (pupilName: string) => {
  const nameLength = pupilName.length;
  const hasLongName = nameLength > 25; // Names longer than 25 characters need special handling
  const hasVeryLongName = nameLength > 35; // Very long names need even more space
  
  return {
    hasLongName,
    hasVeryLongName,
    useMultiRowLayout: hasLongName,
    pupilNameFlex: hasVeryLongName ? 3 : hasLongName ? 2.5 : 1.5,
    otherItemsFlex: hasLongName ? 1 : 1,
    fontSize: hasVeryLongName ? 10 : 11,
    spacing: hasLongName ? 8 : 6,
  };
};

// Create styles
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 0, // NO automatic padding - we control everything manually
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  // Beautiful Official Border Styles - positioned EXACTLY 1cm from ALL page edges
  borderContainer: {
    position: 'absolute',
    top: PAGE_MARGIN,     // EXACTLY 1cm from top page edge
    left: PAGE_MARGIN,    // EXACTLY 1cm from left page edge  
    right: PAGE_MARGIN,   // EXACTLY 1cm from right page edge
    bottom: PAGE_MARGIN,  // EXACTLY 1cm from bottom page edge
    borderWidth: 2,
    borderColor: '#1e3a8a',
    borderRadius: 8,
    backgroundColor: 'transparent',
    // Prevent border from extending beyond page
    maxWidth: 595 - (PAGE_MARGIN * 2), // A4 width minus margins
    maxHeight: 842 - (PAGE_MARGIN * 2), // A4 height minus margins
  },
  innerBorder: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  decorativeCorners: {
    position: 'absolute',
    width: 20,
    height: 20,
  },
  topLeftCorner: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopColor: '#1e3a8a',
    borderLeftColor: '#1e3a8a',
    borderTopLeftRadius: 8,
  },
  topRightCorner: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopColor: '#1e3a8a',
    borderRightColor: '#1e3a8a',
    borderTopRightRadius: 8,
  },
  bottomLeftCorner: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomColor: '#1e3a8a',
    borderLeftColor: '#1e3a8a',
    borderBottomLeftRadius: 8,
  },
  bottomRightCorner: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomColor: '#1e3a8a',
    borderRightColor: '#1e3a8a',
    borderBottomRightRadius: 8,
  },
  contentContainer: {
    position: 'relative',
    zIndex: 10,
    margin: TOTAL_CONTENT_MARGIN, // 1.5cm margin on ALL sides (1cm to border + 0.5cm inside border)
    // Strict bounds to prevent page overflow  
    maxWidth: 595 - (TOTAL_CONTENT_MARGIN * 2),
    maxHeight: 842 - (TOTAL_CONTENT_MARGIN * 2),
    overflow: 'hidden',
  },
  // Additional decorative elements - simple positioning relative to border
  topBorderAccent: {
    position: 'absolute',
    top: 8,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: '#3b82f6',
    borderRadius: 1,
  },
  bottomBorderAccent: {
    position: 'absolute',
    bottom: 8,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: '#3b82f6',
    borderRadius: 1,
  },
  leftBorderAccent: {
    position: 'absolute',
    left: 8,
    top: '20%',
    bottom: '20%',
    width: 2,
    backgroundColor: '#3b82f6',
    borderRadius: 1,
  },
  rightBorderAccent: {
    position: 'absolute',
    right: 8,
    top: '20%',
    bottom: '20%',
    width: 2,
    backgroundColor: '#3b82f6',
    borderRadius: 1,
  },
  header: {
    flexDirection: 'column',
    marginBottom: 15,
    marginTop: 5,
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 12,
  },
  schoolInfo: {
    flex: 1,
    alignItems: 'center',
  },
  schoolLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  schoolDetails: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 1.3,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 4,
  },
  examDetails: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
  },
  pupilPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
    objectFit: 'cover',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    minHeight: 80,
  },
  logoSection: {
    width: '20%', // Reduced width to move logo outward
    alignItems: 'center',
    marginLeft: -21, // Move 0.75cm (21px) outward to the left
  },
  schoolSection: {
    width: '55%', // Increased width to use the extra space
    alignItems: 'center',
  },
  photoSection: {
    width: '25%',
    alignItems: 'center',
    position: 'relative',
  },
  photoFrame: {
    width: 75,
    height: 75,
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: 37.5,
    padding: 3,
    borderWidth: 2,
    borderColor: '#1e3a8a',
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: 'contain',
  },
  schoolContact: {
    fontSize: 9,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 2,
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: 38,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerTitle: {
    backgroundColor: '#1e3a8a',
    padding: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginBottom: 12,
    alignSelf: 'center',
  },
  titleText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  studentInfo: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  studentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  studentInfoRowLast: {
    marginBottom: 0,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginRight: 5,
  },
  infoValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a', // Green color to make information stand out
  },
  // Dynamic styles for long names
  studentInfoRowDynamic: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  studentInfoRowMultiLine: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 8,
  },
  infoItemLongName: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginRight: 8,
    minWidth: 0, // Allow shrinking
  },
  infoItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    marginRight: 6,
    minWidth: 0,
  },
  pupilNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    width: '100%',
  },
  pupilNameValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a', // Green color to make pupil name stand out
    flexWrap: 'wrap',
    lineHeight: 1.2,
  },
  redValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#b91c1c',
  },
  table: {
    marginTop: 2,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    padding: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tableHeaderCell: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#2563eb',
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#1e3a8a',
  },
  tableRowAlt: {
    backgroundColor: 'white',
  },
  tableCell: {
    fontSize: 10,
    textAlign: 'center',
    color: '#334155',
    borderRightWidth: 1,
    borderRightColor: '#1e3a8a',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  remarksCell: {
    width: '35%',
    borderRightWidth: 1,
    borderRightColor: '#1e3a8a',
  },
  remarksContent: {
    color: '#15803d',
  },
  subjectCell: { 
    width: '25%', 
    textAlign: 'left' 
  },
  marksCell: { 
    width: '15%',
  },
  marksContent: {
    color: '#2563eb',
    fontFamily: 'Helvetica-Bold',
  },
  gradeCell: { width: '15%' },
  initialsCell: { width: '10%' },
  // Improved grading scale styles
  gradeScaleContainer: {
    marginVertical: 6,
  },
  gradeScaleTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  gradeScale: {
    flexDirection: 'row',
    justifyContent: 'space-evenly', // Better distribution
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexWrap: 'wrap', // Allow wrapping if needed
    gap: 4, // Space between items
  },
  gradeScaleCompact: {
    padding: 6,
    gap: 3,
  },
  gradeItem: {
    fontSize: 9,
    backgroundColor: 'white',
    padding: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    color: '#1e3a8a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlign: 'center',
    flex: 1, // Equal distribution
    minWidth: 45, // Minimum width in points
    maxWidth: 70, // Maximum width to prevent overflow
  },
  gradeItemCompact: {
    fontSize: 8,
    padding: 3,
    paddingHorizontal: 4,
    minWidth: 40,
    maxWidth: 60,
  },
  // Improved teacher reports
  teacherReports: {
    marginVertical: 6,
    gap: 0,
  },
  reportSection: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    marginBottom: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reportTitleSection: {
    flexDirection: 'row',
    width: '35%',
    whiteSpace: 'nowrap',
  },
  teacherReportTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
  },
  reportContent: {
    fontSize: 10,
    color: '#334155',
    lineHeight: 1.3,
    width: '65%',
    flexWrap: 'wrap',
    marginLeft: 4,
  },
  classTeacherReport: {
    color: '#15803d',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold'
  },
  headTeacherReport: {
    color: '#b91c1c',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold'
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 0,
    paddingRight: 0,
  },
  signatureSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'flex-end',
  },
  signatureText: {
    fontSize: 9,
    color: '#64748b',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
    width: '35%',
    marginLeft: 4,
  },
  footer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  termDates: {
    marginBottom: 6,
  },
  termDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
  },
  termDateLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
  },
  termDateValue: {
    fontSize: 11,
    color: '#334155',
    fontFamily: 'Helvetica-Bold',
  },
  motto: {
    fontSize: 10,
    fontFamily: 'Helvetica-Oblique',
    textAlign: 'center',
    color: '#1e3a8a',
    marginTop: 8,
  },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingRight: 10,
    gap: 20,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginRight: 5,
  },
  summaryValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#b91c1c',
  },
  totalRow: {
    backgroundColor: '#f3f4f6',
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  totalCell: {
    fontFamily: 'Helvetica-Bold',
    color: '#b91c1c',
  },
  legend: {
    marginTop: 6,
    paddingHorizontal: 8,
  },
  legendText: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: 'Helvetica-Oblique',
  },
  divisionSection: {
    marginTop: 4,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 10,
  },
  divisionLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
    marginRight: 5,
  },
  divisionValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#b91c1c',
  },
  tableHeading: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
});

interface Subject {
  name: string;
  code: string;
  fullMarks: number;
  marksGained: number;
  grade: string;
  aggregates: number;
  remarks: string;
  teacherInitials: string;
  isMajorSubject: boolean;
}

interface GradeScale {
  minMark: number;
  grade: string;
  aggregates: number;
  maxMark?: number; // Added maxMark for better clarity
}

interface PupilReportCardProps {
  pupilName: string;
  className: string;
  year: string;
  term: string;
  age: number;
  date: string;
  position: number;
  totalPupils: number;
  pupilIdentificationNumber: string;
  subjects: Subject[];
  classTeacherReport: string;
  headTeacherReport: string;
  nextTermBegins: string;
  nextTermEnds: string;
  pupilPhoto?: string;
  schoolLogo?: string;
  schoolName: string;
  schoolPhysicalAddress?: string;
  schoolPostalAddress?: string;
  schoolPhone?: string;
  schoolAltPhone?: string;
  schoolEmail?: string;
  schoolMotto?: string;
  schoolCity?: string;
  schoolCountry?: string;
  gradingScale: GradeScale[];
  totalMarks: number;
  totalAggregates: number;
  division: string;
  examTitle: string;
  examTypeName?: string; // Added for dynamic report heading
  classTeacherName?: string;
  promotionStatus?: string;
  examSnapshot: {
    academicYearId: string;
    termId: string;
  };
  majorSubjects?: string[];
  // Additional props for QR code generation
  pupilDateOfBirth?: string;
  pupilGender?: string;
  pupilRegistrationDate?: string;
  emergencyContactPhone?: string;
  qrCodeDataURL?: string; // Pre-generated QR code data URL
}

// Export the main component for reuse
// Helper function to validate if a photo is a real photo (not placeholder)
const isRealPhoto = (photo?: string): boolean => {
  return !!(photo && 
    photo !== 'NO PHOTO' && 
    photo.trim() !== '' && 
    photo !== 'https://placehold.co/128x128.png' &&
    !photo.includes('ui-avatars.com') && // Exclude generated avatars
    (photo.startsWith('http') || photo.startsWith('data:') || photo.startsWith('blob:')));
};

// Helper function to format date for QR code
const formatDateForQR = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (e) {
    return 'N/A';
  }
};



export const ModernPupilReportCardPDF: React.FC<PupilReportCardProps> = (props) => {
  const {
    pupilName,
    className,
    year,
    term,
    age,
    date,
    position,
    totalPupils,
    pupilIdentificationNumber,
    subjects,
    classTeacherReport,
    headTeacherReport,
    nextTermBegins,
    nextTermEnds,
    pupilPhoto,
    schoolLogo,
    schoolName,
    schoolPhysicalAddress,
    schoolPostalAddress,
    schoolPhone,
    schoolAltPhone,
    schoolEmail,
    schoolMotto,
    schoolCity,
    schoolCountry,
    gradingScale,
    totalMarks,
    totalAggregates,
    division,
    examTitle,
    examTypeName,
    classTeacherName,
    promotionStatus,
    examSnapshot,
    majorSubjects,
    pupilDateOfBirth,
    pupilGender,
    pupilRegistrationDate,
    emergencyContactPhone,
    qrCodeDataURL
  } = props;

  // Calculate dynamic sizes based on subject count
  const dynamicSizes = calculateDynamicSizes(subjects.length);
  const studentInfoLayout = calculateStudentInfoLayout(pupilName);

  // Generate simplified QR code data for better particle readability
  const qrCodeData = `Name: ${pupilName}
Class: ${className}
Age: ${age} years
PIN: ${pupilIdentificationNumber || 'N/A'}
Year: ${year}
Term: ${term}
Exam: ${examTitle}
Total Aggregates: ${totalAggregates}
Division: ${division}
Date: ${date}`;

  // Create dynamic styles based on calculated sizes
  const dynamicStyles = StyleSheet.create({
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#1e3a8a',
      padding: dynamicSizes.cellPadding + 2,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
    },
    tableHeaderCell: {
      color: 'white',
      fontSize: dynamicSizes.headerFontSize,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      textAlign: 'center',
      borderRightWidth: 1,
      borderRightColor: '#2563eb',
      paddingHorizontal: 4,
    },
    tableRow: {
      flexDirection: 'row',
      backgroundColor: '#f8fafc',
      borderTopWidth: 1,
      borderTopColor: '#1e3a8a',
      minHeight: dynamicSizes.rowHeight,
    },
    tableCell: {
      fontSize: dynamicSizes.baseFontSize,
      textAlign: 'center',
      color: '#334155',
      borderRightWidth: 1,
      borderRightColor: '#1e3a8a',
      paddingHorizontal: 4,
      paddingVertical: dynamicSizes.cellPadding,
      justifyContent: 'center',
    },
    remarksCell: {
      width: '30%',
      borderRightWidth: 1,
      borderRightColor: '#1e3a8a',
    },
    subjectCell: { 
      width: '25%', 
      textAlign: 'left',
      paddingLeft: 8,
    },
    marksCell: { 
      width: '15%',
    },
    totalMarksCell: { 
      width: '15%',
    },
    gradeCell: { 
      width: '15%' 
    },
    initialsCell: { 
      width: '10%',
      borderRightWidth: 0,
    },
    // Section spacing styles
    sectionSpacing: {
      marginVertical: dynamicSizes.sectionSpacing,
    }
  });

  return (
    <View style={styles.page}>
      {/* Beautiful Official Border */}
      <View style={styles.borderContainer}>
        <View style={styles.innerBorder} />
        {/* Decorative Corner Elements */}
        <View style={[styles.decorativeCorners, styles.topLeftCorner]} />
        <View style={[styles.decorativeCorners, styles.topRightCorner]} />
        <View style={[styles.decorativeCorners, styles.bottomLeftCorner]} />
        <View style={[styles.decorativeCorners, styles.bottomRightCorner]} />
        {/* Decorative Border Accents */}
        <View style={styles.topBorderAccent} />
        <View style={styles.bottomBorderAccent} />
        <View style={styles.leftBorderAccent} />
        <View style={styles.rightBorderAccent} />
      </View>
      
      {/* Main Content Container */}
      <View style={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.logoSection}>
            {schoolLogo && <Image src={schoolLogo} style={styles.logo} />}
          </View>
          <View style={styles.schoolSection}>
            <Text style={styles.schoolName}>{schoolName}</Text>
            {schoolPhysicalAddress && (
              <Text style={styles.schoolDetails}>{schoolPhysicalAddress}</Text>
            )}
            <Text style={styles.schoolDetails}>
              {schoolPhone && `Tel: ${schoolPhone}`}
              {schoolAltPhone && schoolPhone && ` / ${schoolAltPhone}`}
              {!schoolPhone && schoolAltPhone && `Tel: ${schoolAltPhone}`}
              {schoolEmail && ` | Email: ${schoolEmail}`}
              {schoolPostalAddress && ` | P.O. Box: ${schoolPostalAddress}`}
            </Text>
          </View>
          <View style={styles.photoSection}>
            {isRealPhoto(pupilPhoto) && (
              <View style={{ alignItems: 'center' }}>
                <View style={styles.photoFrame}>
                  {/* Gradient border effect */}
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    left: -2,
                    right: -2,
                    bottom: -2,
                    borderRadius: 39.5,
                    backgroundColor: '#1e3a8a',
                    opacity: 0.1,
                  }} />
                  
                  {/* Inner photo container */}
                  <View style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 35,
                    overflow: 'hidden',
                    backgroundColor: '#f8fafc',
                  }}>
                    <Image src={pupilPhoto} style={styles.pupilPhoto} />
                  </View>
                  
                  {/* Decorative corner accents */}
                  <View style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: '#10b981',
                    borderWidth: 2,
                    borderColor: '#ffffff',
                  }} />
                  
                  {/* Additional decorative ring */}
                  <View style={{
                    position: 'absolute',
                    top: -1,
                    left: -1,
                    right: -1,
                    bottom: -1,
                    borderRadius: 38.5,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    opacity: 0.6,
                  }} />
                </View>
                
                {/* Photo label */}
                <Text style={{
                  fontSize: 7,
                  color: '#6b7280',
                  marginTop: 4,
                  textAlign: 'center',
                  fontFamily: 'Helvetica',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                  PUPIL PHOTO
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Rectangular QR Code Overlay - positioned absolutely relative to content container */}
        {qrCodeDataURL && (
          <View style={{
            position: 'absolute',
            top: 50, // Move it much higher to be completely above pupil info section
            left: 259, // Move it 0.25cm (7px) further inside for perfect positioning
            width: 380, // 90% larger (200 * 1.9)
            height: 114, // Back to original height
            zIndex: 999, // Very high z-index to ensure it appears above everything
            overflow: 'hidden',
            backgroundColor: 'transparent', // Ensure transparent background
          }}>
            <Image 
              src={qrCodeDataURL} 
              style={{
                width: 380, // 90% larger
                height: 380, // Keep square for proper QR code
                objectFit: 'contain',
                transform: 'scaleY(0.3)', // Back to original compression for same size
              }}
            />
          </View>
        )}

        {/* Report Title */}
        <View style={styles.headerTitle}>
          <Text style={styles.reportTitle}>{examTypeName?.toUpperCase() || 'TERMINAL'} REPORT</Text>
        </View>

        {/* Student Info - Dynamic Layout */}
        <View style={styles.studentInfo}>
          {studentInfoLayout.useMultiRowLayout ? (
            // Multi-row layout for long names
            <>
              {/* First row - Pupil name gets full width */}
              <View style={styles.pupilNameContainer}>
                <Text style={styles.infoLabel}>Pupil:</Text>
                <Text style={[styles.pupilNameValue, { fontSize: studentInfoLayout.fontSize }]}>
                  {pupilName}
                </Text>
              </View>
              
              {/* Second row - Other info items */}
              <View style={styles.studentInfoRowDynamic}>
                <View style={styles.infoItemCompact}>
                  <Text style={styles.infoLabel}>Class:</Text>
                  <Text style={styles.infoValue}>{className}</Text>
                </View>
                <View style={styles.infoItemCompact}>
                  <Text style={styles.infoLabel}>Age:</Text>
                  <Text style={styles.infoValue}>{age} years</Text>
                </View>
                <View style={styles.infoItemCompact}>
                  <Text style={styles.infoLabel}>PIN:</Text>
                  <Text style={[styles.infoValue, styles.redValue]}>{pupilIdentificationNumber}</Text>
                </View>
              </View>
              
              {/* Third row - Remaining info */}
              <View style={[styles.studentInfoRowDynamic, styles.studentInfoRowLast]}>
                <View style={styles.infoItemCompact}>
                  <Text style={styles.infoLabel}>Year:</Text>
                  <Text style={styles.infoValue}>{year}</Text>
                </View>
                <View style={styles.infoItemCompact}>
                  <Text style={styles.infoLabel}>Term:</Text>
                  <Text style={styles.infoValue}>{term}</Text>
                </View>
                <View style={styles.infoItemCompact}>
                  <Text style={styles.infoLabel}>Created On:</Text>
                  <Text style={styles.infoValue}>{date}</Text>
                </View>
              </View>
            </>
          ) : (
            // Standard layout for normal names
            <>
              <View style={styles.studentInfoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Pupil:</Text>
                  <Text style={styles.infoValue}>{pupilName}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Class:</Text>
                  <Text style={styles.infoValue}>{className}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Age:</Text>
                  <Text style={styles.infoValue}>{age} years</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>PIN:</Text>
                  <Text style={[styles.infoValue, styles.redValue]}>{pupilIdentificationNumber}</Text>
                </View>
              </View>
              <View style={[styles.studentInfoRow, styles.studentInfoRowLast]}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Year:</Text>
                  <Text style={styles.infoValue}>{year}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Term:</Text>
                  <Text style={styles.infoValue}>{term}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Created On:</Text>
                  <Text style={styles.infoValue}>{date}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Results Table */}
      <View style={styles.table}>
        {/* Table Heading */}
        <Text style={styles.tableHeading}>{examTitle?.toUpperCase()} PERFORMANCE</Text>

        <View style={dynamicStyles.tableHeader}>
          <Text style={[dynamicStyles.tableHeaderCell, dynamicStyles.subjectCell]}>SUBJECT</Text>
          <Text style={[dynamicStyles.tableHeaderCell, dynamicStyles.totalMarksCell]}>TOTAL</Text>
          <Text style={[dynamicStyles.tableHeaderCell, dynamicStyles.marksCell]}>MARKS</Text>
          <Text style={[dynamicStyles.tableHeaderCell, dynamicStyles.gradeCell]}>GRADE</Text>
          <Text style={[dynamicStyles.tableHeaderCell, dynamicStyles.remarksCell]}>REMARKS</Text>
          <Text style={[dynamicStyles.tableHeaderCell, dynamicStyles.initialsCell]}>INIT.</Text>
        </View>
        {subjects.map((subject, index) => {
          // Check if this is a major subject for display purposes
          const isMajor = majorSubjects?.includes(subject.code) || subjects.length <= 4;
          
          return (
            <View key={index} style={[dynamicStyles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.subjectCell, { 
                fontFamily: 'Helvetica-Bold',
                textTransform: 'uppercase',
                color: isMajor ? '#1e3a8a' : '#6b7280' // Highlight major subjects
              }]}>
                {subject.name} {isMajor && subjects.length > 4 ? '★' : ''}
              </Text>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.totalMarksCell]}>
                {subject.fullMarks}
              </Text>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.marksCell, styles.marksContent]}>
                {subject.marksGained}
              </Text>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.gradeCell, { color: '#dc2626', fontFamily: 'Helvetica-Bold' }]}>
                {isMajor ? subject.grade : '-'}
              </Text>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.remarksCell, styles.remarksContent]}>
                {subject.remarks}
              </Text>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.initialsCell]}>
                {subject.teacherInitials}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Performance Summary Section */}
      <View style={[{
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1e3a8a',
      }, dynamicStyles.sectionSpacing]}>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: '#1e3a8a',
            padding: 8,
            borderRadius: 6,
            flex: 1,
            marginRight: 4,
          }}>
            <Text style={{
              color: 'white',
              fontSize: 10,
              fontFamily: 'Helvetica-Bold',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}>Total Marks</Text>
            <Text style={{
              color: 'white',
              fontSize: 16,
              fontFamily: 'Helvetica-Bold',
              textAlign: 'center',
              marginTop: 2,
            }}>{totalMarks}</Text>
          </View>
          
          <View style={{
            backgroundColor: '#7c3aed',
            padding: 8,
            borderRadius: 6,
            flex: 1,
            marginHorizontal: 2,
          }}>
            <Text style={{
              color: 'white',
              fontSize: 10,
              fontFamily: 'Helvetica-Bold',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}>Total Aggregates</Text>
            <Text style={{
              color: 'white',
              fontSize: 16,
              fontFamily: 'Helvetica-Bold',
              textAlign: 'center',
              marginTop: 2,
            }}>
              {totalAggregates !== undefined && totalAggregates > 0 ? totalAggregates : 
               majorSubjects && majorSubjects.length > 0 ? 'N/A' : 'All Subjects'}
            </Text>
          </View>
          
          <View style={{
            backgroundColor: division === 'I' ? '#16a34a' : 
                           division === 'II' ? '#2563eb' : 
                           division === 'III' ? '#f59e0b' : '#dc2626',
            padding: 8,
            borderRadius: 6,
            flex: 1,
            marginLeft: 4,
          }}>
            <Text style={{
              color: 'white',
              fontSize: 10,
              fontFamily: 'Helvetica-Bold',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}>Division</Text>
            <Text style={{
              color: 'white',
              fontSize: 16,
              fontFamily: 'Helvetica-Bold',
              textAlign: 'center',
              marginTop: 2,
            }}>{division}</Text>
          </View>
        </View>
      </View>

      {/* Always show grading scale with dynamic sizing */}
      <View style={[styles.gradeScaleContainer, dynamicStyles.sectionSpacing]}>
        <Text style={styles.gradeScaleTitle}>Grading Scale Used</Text>
        <View style={[
          styles.gradeScale, 
          ...(dynamicSizes.gradingScaleCompact ? [styles.gradeScaleCompact] : [])
        ]}>
          {gradingScale
            .sort((a, b) => b.minMark - a.minMark)
            .map((scale, index, sortedArray) => {
              // Use the actual maxMark if available, otherwise calculate from next item
              const maxMark = scale.maxMark !== undefined 
                ? scale.maxMark 
                : (index === 0 ? 100 : sortedArray[index - 1].minMark - 1);
              return (
                <View 
                  key={scale.grade}
                  style={[
                    styles.gradeItem,
                    ...(dynamicSizes.gradingScaleCompact ? [styles.gradeItemCompact] : [])
                  ]}
                >
                  <Text style={{
                    fontSize: dynamicSizes.gradingScaleCompact ? 8 : 9,
                    color: '#1e3a8a',
                    fontFamily: 'Helvetica-Bold',
                    textAlign: 'center',
                  }}>
                    {scale.grade}
                  </Text>
                  <Text style={{
                    fontSize: dynamicSizes.gradingScaleCompact ? 7 : 8,
                    color: '#64748b',
                    textAlign: 'center',
                    marginTop: 1,
                  }}>
                    ({scale.minMark}-{maxMark})
                  </Text>
                </View>
              );
            })}
        </View>
      </View>

      {/* Teacher Reports */}
      <View style={[styles.teacherReports, dynamicStyles.sectionSpacing]}>
        <View style={styles.reportSection}>
          <View style={styles.reportRow}>
            <View style={styles.reportTitleSection}>
              <Text style={styles.teacherReportTitle}>CLASS TEACHER'S REPORT:</Text>
            </View>
            <Text style={[styles.reportContent, styles.classTeacherReport]}>{classTeacherReport}</Text>
          </View>
          <View style={styles.signatureRow}>
            <View style={styles.signatureSection}>
              {classTeacherName && (
                <Text style={[styles.signatureText, { marginRight: 4 }]}>
                  {classTeacherName} - 
                </Text>
              )}
              <Text style={styles.signatureText}>Sign: </Text>
              <View style={styles.signatureLine}></View>
            </View>
          </View>
        </View>
        <View style={styles.reportSection}>
          <View style={styles.reportRow}>
            <View style={styles.reportTitleSection}>
              <Text style={styles.teacherReportTitle}>HEAD TEACHER'S REPORT:</Text>
            </View>
            <Text style={[styles.reportContent, styles.headTeacherReport]}>{headTeacherReport}</Text>
          </View>
          <View style={styles.signatureRow}>
            <Text style={styles.signatureText}>Sign: </Text>
            <View style={styles.signatureLine}></View>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, dynamicStyles.sectionSpacing]}>
        <View style={styles.termDates}>
          <View style={styles.termDateRow}>
            <View style={styles.infoItem}>
              <Text style={styles.termDateLabel}>NEXT TERM BEGINS:</Text>
              <Text style={styles.termDateValue}>{nextTermBegins}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.termDateLabel}>TERM ENDS:</Text>
              <Text style={styles.termDateValue}>{nextTermEnds}</Text>
            </View>
          </View>
        </View>
        {schoolMotto && (
          <Text style={styles.motto}>"{schoolMotto}"</Text>
        )}
      </View>
      </View>
    </View>
  );
};

export default ModernPupilReportCardPDF; 