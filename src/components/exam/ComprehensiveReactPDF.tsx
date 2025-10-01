import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font, pdf } from '@react-pdf/renderer';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';

// Font registration - using standard fonts for better compatibility
Font.register({
  family: 'Inter',
  src: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
});

/**
 * Compact, beautiful, and professional student report design
 * 
 * Design principles:
 * 1. Maximized content density with strategic spacing
 * 2. Sophisticated color palette with subtle gradients
 * 3. Clean typography with improved hierarchy
 * 4. Card-based layouts with minimal margins
 * 5. Professional yet contemporary appearance
 */

// Modern color palette with sophisticated tones
const colors = {
  primary: '#1e40af',      // Deep blue
  primaryLight: '#3b82f6', // Lighter blue
  secondary: '#6366f1',    // Indigo
  accent: '#0891b2',       // Cyan-600
  success: '#059669',      // Emerald-600
  warning: '#d97706',      // Amber-600
  danger: '#dc2626',       // Red-600
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a'
  }
};

// Compact styles with improved spacing
const styles = StyleSheet.create({
  page: {
    padding: 0,
    backgroundColor: 'white',
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.3,
  },
  
  // Compact header
  header: {
    backgroundColor: colors.primary,
    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
    padding: 16,
    marginBottom: 12,
  },
  
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  logoSection: {
    width: '15%',
    alignItems: 'center',
  },
  
  schoolSection: {
    width: '70%',
    alignItems: 'center',
  },
  
  photoSection: {
    width: '15%',
    alignItems: 'center',
  },
  
  schoolName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  
  schoolContact: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 1,
  },
  
  reportTitle: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
    alignSelf: 'center',
    backdropFilter: 'blur(10px)',
  },
  
  titleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  
  // Compact student info
  studentCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    padding: 12,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  
  studentInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
  },
  
  studentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.neutral[900],
  },
  
  studentPosition: {
    backgroundColor: colors.primary,
    color: 'white',
    padding: '4 8',
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  studentInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  
  infoItem: {
    flex: 1,
    minWidth: '28%',
  },
  
  infoLabel: {
    fontSize: 7,
    color: colors.neutral[500],
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  
  infoValue: {
    fontSize: 9,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  
  infoValueHighlight: {
    fontSize: 9,
    color: colors.danger,
    fontWeight: 'bold',
  },
  
  // Compact performance section
  performanceSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.neutral[900],
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  
  // Compact summary cards
  summaryContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  
  summaryLabel: {
    fontSize: 7,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  
  // Compact table styles
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
    padding: 8,
  },
  
  tableHeaderCell: {
    color: 'white',
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    padding: 6,
  },
  
  tableRowAlt: {
    backgroundColor: colors.neutral[50],
  },
  
  tableCell: {
    fontSize: 7,
    textAlign: 'center',
    color: colors.neutral[700],
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  
  subjectCell: {
    width: '25%',
    textAlign: 'left',
    fontWeight: '600',
    color: colors.primary,
    fontSize: 8,
  },
  
  totalMarksCell: {
    width: '15%',
  },
  
  marksCell: {
    width: '15%',
    fontWeight: 'bold',
    color: colors.success,
  },
  
  gradeCell: {
    width: '15%',
    fontWeight: 'bold',
  },
  
  remarksCell: {
    width: '25%',
    color: colors.neutral[600],
    fontStyle: 'italic',
    fontSize: 6,
  },
  
  initialsCell: {
    width: '5%',
    fontSize: 6,
    color: colors.neutral[500],
  },
  
  totalsRow: {
    backgroundColor: colors.neutral[100],
    borderTopWidth: 2,
    borderTopColor: colors.primary,
  },
  
  totalCell: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  
  // Compact grade scale
  gradeScaleContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  
  gradeScaleTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.neutral[700],
    marginBottom: 4,
    textAlign: 'center',
  },
  
  gradeScale: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 6,
    gap: 2,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  
  gradeItem: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    padding: 3,
    borderRadius: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  
  gradeText: {
    fontSize: 6,
    color: colors.primary,
    fontWeight: 'bold',
  },
  
  // Compact teacher reports
  reportsSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    borderLeftWidth: 3,
  },
  
  classTeacherCard: {
    borderLeftColor: colors.success,
  },
  
  headTeacherCard: {
    borderLeftColor: colors.warning,
  },
  
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  reportTitleText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.neutral[800],
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  
  reportContent: {
    fontSize: 8,
    color: colors.neutral[700],
    lineHeight: 1.3,
    marginBottom: 4,
  },
  
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[300],
    width: 60,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  
  // Compact footer
  footer: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  
  termDatesCard: {
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  
  termDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  termDateItem: {
    alignItems: 'center',
  },
  
  termDateLabel: {
    fontSize: 7,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  
  termDateValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.primary,
  },
  
  motto: {
    fontSize: 8,
    fontStyle: 'italic',
    textAlign: 'center',
    color: colors.secondary,
    marginTop: 8,
    fontWeight: '500',
  },
  
  // Utility classes
  textPrimary: { color: colors.primary },
  textSuccess: { color: colors.success },
  textWarning: { color: colors.warning },
  textDanger: { color: colors.danger },
});

// Grade color mapping
const getGradeColor = (grade: string) => {
  if (grade.startsWith('D')) return colors.success;
  if (grade.startsWith('C')) return colors.primary;
  if (grade.startsWith('P')) return colors.warning;
  return colors.danger;
};

// Division description mapping
const getDivisionDescription = (division: string): string => {
  const descriptions = {
    'I': 'DISTINCTION',
    'II': 'CREDIT',
    'III': 'PASS',
    'IV': 'PASS',
    'U': 'UNGRADED'
  };
  return descriptions[division as keyof typeof descriptions] || 'UNGRADED';
};

interface Subject {
  name: string;
  code: string;
  fullMarks: number;
  marksGained: number;
  grade: string;
  aggregates?: number;
  remarks: string;
  teacherInitials: string;
  isMajorSubject?: boolean;
}

interface GradeScale {
  minMark: number;
  grade: string;
  aggregates: number;
  maxMark?: number; // Added maxMark for accurate range calculation
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
      logo?: string;
      motto?: string;
      establishedYear?: string;
      registrationNumber?: string;
    };
    contact?: {
      email?: string;
      phone?: string;
      alternativePhone?: string;
    };
    address?: {
      physical?: string;
      postal?: string;
      poBox?: string;
      city?: string;
      country?: string;
    };
    headTeacher?: {
      name?: string;
      signature?: string;
    };
  };
  termDates?: {
    nextTermBegins?: string;
    nextTermEnds?: string;
  };
  gradingScale?: GradeScale[];
}

/**
 * Compact modern pupil report card component
 */
const CompactPupilReportCard = ({
  pupilReport,
  examDetails,
  classSnap,
  schoolSettings,
  termDates,
  gradingScale
}: {
  pupilReport: PupilReportData;
  examDetails: ComprehensiveReportsProps['examDetails'];
  classSnap: ComprehensiveReportsProps['classSnap'];
  schoolSettings?: ComprehensiveReportsProps['schoolSettings'];
  termDates?: ComprehensiveReportsProps['termDates'];
  gradingScale?: GradeScale[];
}) => {
  const shouldShowGradingInfo = pupilReport.subjects.length <= 6;

  return (
    <View style={styles.page}>
      {/* Enhanced Header with Full School Information */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {/* School Logo Section */}
          <View style={styles.logoSection}>
            {schoolSettings?.generalInfo?.logo ? (
              <Image 
                style={{ width: 50, height: 50, borderRadius: 4 }} 
                src={schoolSettings.generalInfo.logo} 
              />
            ) : (
              <View style={{ 
                width: 50, 
                height: 50, 
                backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                borderRadius: 4,
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text style={{ fontSize: 8, color: 'white', textAlign: 'center' }}>LOGO</Text>
              </View>
            )}
          </View>
          
          {/* School Information Section */}
          <View style={styles.schoolSection}>
            <Text style={styles.schoolName}>
              {schoolSettings?.generalInfo?.name || 'Excellence Academy'}
            </Text>
            
            {/* Contact Information */}
            {(schoolSettings?.contact?.phone || schoolSettings?.contact?.email) && (
              <Text style={styles.schoolContact}>
                {schoolSettings?.contact?.phone && `Tel: ${schoolSettings.contact.phone}`}
                {schoolSettings?.contact?.alternativePhone && ` | Alt: ${schoolSettings.contact.alternativePhone}`}
                {schoolSettings?.contact?.phone && schoolSettings?.contact?.email && ' | '}
                {schoolSettings?.contact?.email && `Email: ${schoolSettings.contact.email}`}
              </Text>
            )}
            
            {/* Address Information */}
            {schoolSettings?.address?.physical && (
              <Text style={styles.schoolContact}>
                {schoolSettings.address.physical}
              </Text>
            )}
            
            {/* P.O Box Information */}
            {schoolSettings?.address?.poBox && (
              <Text style={styles.schoolContact}>
                {schoolSettings.address.poBox}
                {schoolSettings?.address?.city && `, ${schoolSettings.address.city}`}
                {schoolSettings?.address?.country && `, ${schoolSettings.address.country}`}
              </Text>
            )}
            
            {/* Registration Number */}
            {schoolSettings?.generalInfo?.registrationNumber && (
              <Text style={[styles.schoolContact, { fontSize: 7, marginTop: 2 }]}>
                Reg. No: {schoolSettings.generalInfo.registrationNumber}
              </Text>
            )}
          </View>
          
          {/* Student Photo Section */}
          <View style={styles.photoSection}>
            {/* Pupil photo placeholder - in real implementation, this would come from pupil data */}
            <View style={{ 
              width: 50, 
              height: 60, 
              backgroundColor: 'rgba(255, 255, 255, 0.2)', 
              borderRadius: 4,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Text style={{ fontSize: 7, color: 'white', textAlign: 'center' }}>STUDENT{'\n'}PHOTO</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.reportTitle}>
          <Text style={styles.titleText}>
            Term {examDetails?.termId ? examDetails.termId.split('-')[1] : ''} Academic Report - {examDetails.academicYearId}
          </Text>
        </View>
      </View>

      {/* Enhanced Student Information Using Historical Snapshots */}
      <View style={styles.studentCard}>
        <View style={styles.studentInfoHeader}>
          <Text style={styles.studentName}>{pupilReport.pupilInfo.name}</Text>
          <Text style={styles.studentPosition}>#{pupilReport.position}</Text>
        </View>
        
        <View style={styles.studentInfoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Class (At Exam)</Text>
            <Text style={styles.infoValue}>{classSnap.name}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Student ID</Text>
            <Text style={styles.infoValueHighlight}>{pupilReport.pupilInfo.admissionNumber}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Academic Year</Text>
            <Text style={styles.infoValue}>{examDetails.academicYearId}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Term</Text>
            <Text style={styles.infoValue}>Term {examDetails?.termId ? examDetails.termId.split('-')[1] : ''}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Age (At Exam)</Text>
            <Text style={styles.infoValue}>{pupilReport.pupilInfo.age || '10'} years</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Printed On</Text>
            <Text style={styles.infoValue}>{new Date().toLocaleDateString()}</Text>
          </View>
        </View>
      </View>

      {/* Compact Performance Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            {pupilReport.totalMarks}%
          </Text>
          <Text style={styles.summaryLabel}>Total Score</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            {pupilReport.totalAggregates}
          </Text>
          <Text style={styles.summaryLabel}>Aggregates</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: colors.secondary }]}>
            {pupilReport.division}
          </Text>
          <Text style={styles.summaryLabel}>Division</Text>
        </View>
      </View>

      {/* Compact Performance Table */}
      <View style={styles.performanceSection}>
        <Text style={styles.sectionTitle}>
          {examDetails.name} Performance Analysis
        </Text>
        
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.subjectCell]}>Subject</Text>
            <Text style={[styles.tableHeaderCell, styles.totalMarksCell]}>Total</Text>
            <Text style={[styles.tableHeaderCell, styles.marksCell]}>Score</Text>
            <Text style={[styles.tableHeaderCell, styles.gradeCell]}>Grade</Text>
            <Text style={[styles.tableHeaderCell, styles.remarksCell]}>Remarks</Text>
            <Text style={[styles.tableHeaderCell, styles.initialsCell]}>Init.</Text>
          </View>
          
          {pupilReport.subjects.map((subject, index) => (
            <View 
              key={subject.code} 
              style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, styles.subjectCell]}>
                {subject.name}
              </Text>
              <Text style={[styles.tableCell, styles.totalMarksCell]}>
                {subject.fullMarks}
              </Text>
              <Text style={[styles.tableCell, styles.marksCell]}>
                {subject.marksGained}
              </Text>
              <Text style={[
                styles.tableCell, 
                styles.gradeCell, 
                { color: getGradeColor(subject.grade), fontWeight: 'bold' }
              ]}>
                {subject.grade}
              </Text>
              <Text style={[styles.tableCell, styles.remarksCell]}>
                {subject.remarks}
              </Text>
              <Text style={[styles.tableCell, styles.initialsCell]}>
                {subject.teacherInitials}
              </Text>
            </View>
          ))}
          
          {/* Totals Row */}
          <View style={[styles.tableRow, styles.totalsRow]}>
            <Text style={[styles.tableCell, styles.subjectCell, styles.totalCell]}>
              TOTAL
            </Text>
            <Text style={[styles.tableCell, styles.totalMarksCell, styles.totalCell]}>
              {pupilReport.subjects.reduce((sum, subject) => sum + subject.fullMarks, 0)}
            </Text>
            <Text style={[styles.tableCell, styles.marksCell, styles.totalCell]}>
              {pupilReport.totalMarks}
            </Text>
            <Text style={[styles.tableCell, styles.gradeCell, styles.totalCell]}>
              AGG: {pupilReport.totalAggregates}
            </Text>
            <Text style={[styles.tableCell, styles.remarksCell, styles.totalCell]}>
              {getDivisionDescription(pupilReport.division)}
            </Text>
            <Text style={[styles.tableCell, styles.initialsCell, styles.totalCell]}>
              -
            </Text>
          </View>
        </View>
      </View>

      {/* Compact Grading Scale */}
      {shouldShowGradingInfo && gradingScale && (
        <View style={styles.gradeScaleContainer}>
          <Text style={styles.gradeScaleTitle}>Grading Scale</Text>
          <View style={styles.gradeScale}>
            {gradingScale.sort((a, b) => b.minMark - a.minMark).map((scale, index, sortedArray) => {
              // Use the actual maxMark if available, otherwise calculate from next item
              const maxMark = scale.maxMark !== undefined 
                ? scale.maxMark 
                : (index === 0 ? 100 : sortedArray[index - 1].minMark - 1);
              return (
                <View key={scale.grade} style={styles.gradeItem}>
                  <Text style={styles.gradeText}>
                    {scale.grade}
                  </Text>
                  <Text style={[styles.gradeText, { fontSize: 5, color: colors.neutral[600] }]}>
                    {scale.minMark}-{maxMark}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Compact Teacher Reports */}
      <View style={styles.reportsSection}>
        <Text style={styles.sectionTitle}>Teacher Assessments</Text>
        
        <View style={[styles.reportCard, styles.classTeacherCard]}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitleText}>Class Teacher's Report</Text>
          </View>
          <Text style={styles.reportContent}>
            {pupilReport.classTeacherReport || 'Excellent progress demonstrated throughout the term. Continue with the same dedication.'}
          </Text>
          <View style={styles.signatureLine} />
        </View>
        
        <View style={[styles.reportCard, styles.headTeacherCard]}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitleText}>Head Teacher's Report</Text>
          </View>
          <Text style={styles.reportContent}>
            {pupilReport.headTeacherReport || 'Outstanding academic performance. A role model for other students.'}
          </Text>
          <View style={styles.signatureLine} />
        </View>
      </View>

      {/* Enhanced Footer with Dynamic Next Term Dates */}
      <View style={styles.footer}>
        <View style={styles.termDatesCard}>
          <View style={styles.termDatesRow}>
            <View style={styles.termDateItem}>
              <Text style={styles.termDateLabel}>Next Term Begins</Text>
              <Text style={styles.termDateValue}>
                {termDates?.nextTermBegins || 'TBA'}
              </Text>
            </View>
            <View style={styles.termDateItem}>
              <Text style={styles.termDateLabel}>Next Term Ends</Text>
              <Text style={styles.termDateValue}>
                {termDates?.nextTermEnds || 'TBA'}
              </Text>
            </View>
          </View>
        </View>
        
        {schoolSettings?.generalInfo?.motto && (
          <Text style={styles.motto}>
            "{schoolSettings.generalInfo.motto}"
          </Text>
        )}
      </View>
    </View>
  );
};

/**
 * Compact comprehensive reports PDF document
 */
export const ComprehensiveReportsPDF = ({ data }: { data: ComprehensiveReportsProps }) => {
  const { pupilReports, examDetails, classSnap, schoolSettings, termDates } = data;
  
  const gradingScale: GradeScale[] = data.gradingScale || DEFAULT_GRADING_SCALE.map(item => ({
    minMark: item.minMark,
    maxMark: item.maxMark,
    grade: item.grade,
    aggregates: item.aggregates || 9
  }));
  
  return (
    <Document title={`${examDetails.name} - Compact Student Reports`}>
      {pupilReports.map((pupilReport) => (
        <Page key={pupilReport.pupilInfo.pupilId} size="A4" style={styles.page}>
          <CompactPupilReportCard
            pupilReport={pupilReport}
            examDetails={examDetails}
            classSnap={classSnap}
            schoolSettings={schoolSettings}
            termDates={termDates}
            gradingScale={gradingScale}
          />
        </Page>
      ))}
    </Document>
  );
};

/**
 * Generate compact PDF reports
 */
export const generateComprehensiveReactPDF = async (props: ComprehensiveReportsProps): Promise<Blob> => {
  try {
    const pdfDocument = <ComprehensiveReportsPDF data={props} />;
    const blob = await pdf(pdfDocument).toBlob();
    return blob;
  } catch (error) {
    console.error("Error generating compact PDF:", error);
    throw error;
  }
};

export default ComprehensiveReportsPDF; 