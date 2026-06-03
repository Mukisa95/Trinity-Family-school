import { useState, useEffect } from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font, pdf, PDFViewer } from '@react-pdf/renderer';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Define API constants directly since we're having import issues
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create API instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Using only standard PDF fonts that are guaranteed to work
// Disable hyphenation to avoid text issues
Font.registerHyphenationCallback(word => [word]);

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 24,
    backgroundColor: 'white',
    fontFamily: 'Times-Roman',
  },
  header: {
    marginBottom: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoSection: {
    width: '25%',
    alignItems: 'center',
  },
  schoolSection: {
    width: '50%',
    alignItems: 'center',
  },
  photoSection: {
    width: '25%',
    alignItems: 'center',
    position: 'relative',
  },
  photoFrame: {
    width: 80,
    height: 80,
    position: 'relative',
    backgroundColor: '#f8fafc',
    borderRadius: 40,
    padding: 2,
    borderWidth: 2,
    borderColor: '#1e3a8a',
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: 'contain',
  },
  schoolName: {
    fontSize: 16,
    fontFamily: 'Times-Bold',
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 5,
  },
  schoolContact: {
    fontSize: 9,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 2,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#3b82f6',
    objectFit: 'cover',
  },
  headerTitle: {
    backgroundColor: '#1e3a8a',
    padding: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginBottom: 15,
    alignSelf: 'center',
  },
  titleText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  studentInfo: {
    backgroundColor: '#f3f4f6',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e3a8a', // dark blue color
  },
  studentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    fontFamily: 'Times-Bold',
    color: '#111827',
  },
  redValue: {
    fontSize: 11,
    fontFamily: 'Times-Bold',
    color: '#b91c1c',  // red-700
  },
  table: {
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#1e3a8a', // Dark blue border
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    padding: 10,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tableHeaderCell: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'Times-Bold',
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
    color: '#15803d',  // green-700
  },
  subjectCell: { 
    width: '25%', 
    textAlign: 'left' 
  },
  marksCell: { 
    width: '15%',
  },
  marksContent: {
    color: '#2563eb',  // bright blue-600
    fontFamily: 'Times-Bold',
  },
  gradeCell: { width: '15%' },
  initialsCell: { width: '10%' },
  gradeScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    marginVertical: 10,
  },
  gradeItem: {
    fontSize: 8,
    backgroundColor: 'white',
    padding: 4,
    borderRadius: 4,
    color: '#1e3a8a',
    border: '1px solid #e2e8f0',
    textAlign: 'center',
    width: '10%',  // Since we typically have 9-10 grades, each takes about 10%
  },
  teacherReports: {
    marginVertical: 10,
    gap: 0,
  },
  reportSection: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    marginBottom: 2,
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
  reportTitle: {
    fontSize: 11,
    fontFamily: 'Times-Bold',
    color: '#1e3a8a',
  },
  reportContent: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 1.4,
    width: '65%',
    flexWrap: 'wrap',
    marginLeft: 4,
  },
  classTeacherReport: {
    color: '#15803d',  // green-700
    fontSize: 11,
    fontFamily: 'Times-Bold'
  },
  headTeacherReport: {
    color: '#b91c1c',  // red-700
    fontSize: 11,
    fontFamily: 'Times-Bold'
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
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  termDates: {
    marginBottom: 8,
  },
  termDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 6,
  },
  termDateLabel: {
    fontSize: 12,
    fontFamily: 'Times-Bold',
    color: '#1e3a8a',
  },
  termDateValue: {
    fontSize: 12,
    color: '#334155',
    fontFamily: 'Times-Bold',
  },
  motto: {
    fontSize: 11,
    // Changed from italic style to normal to avoid font issues
    fontStyle: 'normal', 
    textAlign: 'center',
    color: '#1e3a8a',
    marginTop: 10,
    fontFamily: 'Times-Roman', // Changed from Times-Bold to Times-Roman
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
    fontFamily: 'Times-Bold',
    color: '#b91c1c',  // red-700
  },
  totalRow: {
    backgroundColor: '#f3f4f6',
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  totalCell: {
    fontFamily: 'Times-Bold',
    color: '#b91c1c',  // red-700
  },
  legend: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  legendText: {
    fontSize: 9,
    color: '#64748b',
    // Changed from italic style to normal to avoid font issues
    fontStyle: 'normal',
    fontFamily: 'Times-Roman',
  },
  divisionSection: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 10,
  },
  divisionLabel: {
    fontSize: 10,
    fontFamily: 'Times-Bold',
    color: '#1e3a8a',
    marginRight: 5,
  },
  divisionValue: {
    fontSize: 11,
    fontFamily: 'Times-Bold',
    color: '#b91c1c', // red-700
  },
  tableHeading: {
    fontSize: 12,
    fontFamily: 'Times-Bold',
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 10,
    right: 15,
    color: '#64748b',
    textAlign: 'right',
  },
  schoolLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    objectFit: 'contain',
  },
});

interface Subject {
  name: string;
  fullMarks: number;
  marksGained: number;
  grade: string;
  aggregate?: number;
  remarks: string;
  teacherInitials: string;
  isMajorSubject: boolean;
}

interface GradeScale {
  minMark: number;
  grade: string;
  aggregates: number;
  maxMark?: number; // Added maxMark for accurate rendering
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
  classTeacherName?: string;
  promotionStatus?: string;
  examSnapshot: {
    academicYearId: string;
    termId: string;
  };
}

interface BatchPDFProps {
  pupils: PupilReportCardProps[];
  title: string;
}

interface PDFError extends Error {
  name: string;
  message: string;
}

// Single Pupil Report Card Component
const PupilReportCard: React.FC<PupilReportCardProps> = (props) => {
  const {
    pupilName,
    className,
    age,
    date,
    position,
    totalPupils,
    pupilIdentificationNumber,
    subjects = [], // Provide default empty array if subjects is undefined
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
    classTeacherName,
    promotionStatus,
    examSnapshot
  } = props;

  // Force subjects to be an array even if it comes as null or undefined
  const subjectsToRender = Array.isArray(subjects) ? subjects : [];

  // Determine if we should show grading scale and legend (only for exams with 4 or fewer subjects)
  const shouldShowGradingInfo = subjectsToRender.length <= 4;

  // Determine if we need compact layout (more than 4 subjects)
  const useCompactLayout = subjectsToRender.length > 4;

  // Create dynamic styles based on layout
  const dynamicStyles = StyleSheet.create({
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#1e3a8a',
      padding: useCompactLayout ? 6 : 8,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
    },
    tableHeaderCell: {
      color: 'white',
      fontSize: useCompactLayout ? 9 : 10,
      fontFamily: 'Times-Bold',
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
    },
    tableCell: {
      fontSize: useCompactLayout ? 9 : 10,
      textAlign: 'center',
      color: '#334155',
      borderRightWidth: 1,
      borderRightColor: '#1e3a8a',
      paddingHorizontal: 4,
      paddingVertical: useCompactLayout ? 4 : 6,
    },
    remarksCell: {
      width: useCompactLayout ? '30%' : '35%',
      borderRightWidth: 1,
      borderRightColor: '#1e3a8a',
    },
    subjectCell: { 
      width: useCompactLayout ? '22%' : '25%', 
      textAlign: 'left',
      paddingLeft: 8,
    },
    marksCell: { 
      width: useCompactLayout ? '12%' : '15%',
    },
    totalMarksCell: { 
      width: useCompactLayout ? '12%' : '15%',
    },
    gradeCell: { 
      width: useCompactLayout ? '14%' : '16%' 
    },
    initialsCell: { 
      width: useCompactLayout ? '10%' : '12%',
      borderRightWidth: 0,
    }
  });

  // Simplified school motto display to avoid font issues
  const renderSchoolMotto = () => {
    if (!schoolMotto) return null;
    return (
      <Text style={{
        fontSize: 11,
        fontFamily: 'Times-Roman',
        textAlign: 'center',
        color: '#1e3a8a',
        marginTop: 10
      }}>
        "{schoolMotto}"
      </Text>
    );
  };

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.logoSection}>
            {schoolLogo && <Image src={schoolLogo} style={styles.logo} />}
          </View>
          <View style={styles.schoolSection}>
            <Text style={styles.schoolName}>{schoolName}</Text>
            {schoolPhysicalAddress && (
              <Text style={styles.schoolContact}>{schoolPhysicalAddress}</Text>
            )}
            <Text style={styles.schoolContact}>
              {schoolPhone && `Tel: ${schoolPhone}`}
              {schoolEmail && ` | Email: ${schoolEmail}`}
            </Text>
          </View>
          <View style={styles.photoSection}>
            {pupilPhoto && (
              <View style={styles.photoFrame}>
                <Image src={pupilPhoto} style={styles.photo} />
              </View>
            )}
          </View>
        </View>

        {/* Report Title */}
        <View style={styles.headerTitle}>
          <Text style={styles.titleText}>TERM {examSnapshot?.termId ? examSnapshot.termId.split('-')[1] : ''} TERMINAL REPORT</Text>
        </View>

        {/* Student Info */}
        <View style={styles.studentInfo}>
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
              <Text style={styles.infoValue}>{examSnapshot?.academicYearId}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Term:</Text>
              <Text style={styles.infoValue}>Term {examSnapshot?.termId ? examSnapshot.termId.split('-')[1] : ''}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Created On:</Text>
              <Text style={styles.infoValue}>{date}</Text>
            </View>
          </View>
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
        
        {/* If no subjects, show placeholder row */}
        {subjectsToRender.length === 0 ? (
          <View style={dynamicStyles.tableRow}>
            <Text style={[dynamicStyles.tableCell, { width: '100%', textAlign: 'center', color: '#b91c1c' }]}>
              No subject data available
            </Text>
          </View>
        ) : (
          subjectsToRender.map((subject, index) => (
            <View key={index} style={[dynamicStyles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.subjectCell, { 
                fontFamily: 'Times-Bold',
                textTransform: 'uppercase',
                color: '#1e3a8a'
              }]}>
                {subject?.name || 'Unknown Subject'}
              </Text>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.totalMarksCell]}>
                {typeof subject?.fullMarks === 'number' ? subject.fullMarks : '-'}
              </Text>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.marksCell, styles.marksContent]}>
                {typeof subject?.marksGained === 'number' ? subject.marksGained : '-'}
              </Text>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.gradeCell]}>
                {subject?.grade || '-'}
              </Text>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.remarksCell, styles.remarksContent]}>
                {subject?.remarks || '-'}
              </Text>
              <Text style={[dynamicStyles.tableCell, dynamicStyles.initialsCell]}>
                {subject?.teacherInitials || '-'}
              </Text>
            </View>
          ))
        )}

        {/* Totals Row */}
        <View style={[dynamicStyles.tableRow, { 
          backgroundColor: '#fef2f2',
          borderTopWidth: 2,
          borderTopColor: '#1e3a8a'
        }]}>
          <Text style={[dynamicStyles.tableCell, dynamicStyles.subjectCell, { 
            fontFamily: 'Times-Bold', 
            color: '#111827',
            textTransform: 'uppercase'
          }]}>
            TOTALS
          </Text>
          <Text style={[dynamicStyles.tableCell, dynamicStyles.totalMarksCell, { 
            fontFamily: 'Times-Bold', 
            color: '#b91c1c',
            textTransform: 'uppercase'
          }]}>
            {subjectsToRender.reduce((sum, subject) => sum + (typeof subject?.fullMarks === 'number' ? subject.fullMarks : 0), 0)}
          </Text>
          <Text style={[dynamicStyles.tableCell, dynamicStyles.marksCell, { 
            fontFamily: 'Times-Bold', 
            color: '#b91c1c',
            textTransform: 'uppercase'
          }]}>
            {typeof totalMarks === 'number' ? totalMarks : '-'}
          </Text>
          <Text style={[dynamicStyles.tableCell, dynamicStyles.gradeCell, { 
            fontFamily: 'Times-Bold', 
            color: '#b91c1c',
            textTransform: 'uppercase'
          }]}>
            AGG: {typeof totalAggregates === 'number' ? totalAggregates : '-'}
          </Text>
          <Text style={[dynamicStyles.tableCell, dynamicStyles.remarksCell, { 
            color: '#b91c1c',
            borderRightWidth: 1,
            textTransform: 'uppercase',
            fontFamily: 'Times-Bold'
          }]}>
            {promotionStatus || '-'}
          </Text>
          <Text style={[dynamicStyles.tableCell, dynamicStyles.initialsCell, { 
            color: '#b91c1c',
            borderRightWidth: 0,
            textTransform: 'uppercase',
            fontFamily: 'Times-Bold'
          }]}>-</Text>
        </View>
        {/* Promotion Remark - Only show for Term 3 */}
        {props.examSnapshot?.termId?.includes('TERM-3') && (
          <View style={[dynamicStyles.tableRow, { 
            backgroundColor: '#fef2f2',
            borderTopWidth: 2,
            borderTopColor: '#1e3a8a'
          }]}>
            <Text style={[dynamicStyles.tableCell, { 
              fontFamily: 'Times-Bold', 
              color: '#dc2626',
              textTransform: 'uppercase',
              width: '100%',
              textAlign: 'center'
            }]}>
              {props.totalAggregates >= 4 && props.totalAggregates <= 25 
                ? 'PROMOTED'
                : props.totalAggregates >= 26 && props.totalAggregates <= 30
                ? 'PROMOTED ON PROBATION'
                : props.totalAggregates >= 31 && props.totalAggregates <= 36
                ? 'ADVISED TO REPEAT'
                : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Division Section */}
      <View style={styles.divisionSection}>
        <Text style={[styles.divisionLabel, { textTransform: 'uppercase' }]}>DIVISION:</Text>
        <Text style={[styles.divisionValue, { 
          textTransform: 'uppercase',
          fontFamily: 'Times-Bold'
        }]}>{division}</Text>
      </View>

      {/* Add legend for major subjects only when showing grading info */}
      {shouldShowGradingInfo && (
        <View style={styles.legend}>
          <Text style={styles.legendText}>GRADING SCALE USED</Text>
        </View>
      )}

      {/* Only show grade scale for exams with 4 or fewer subjects */}
      {shouldShowGradingInfo && (
        <View style={styles.gradeScale}>
          {gradingScale.sort((a, b) => b.minMark - a.minMark).map((scale, index, sortedArray) => {
            // Use the actual maxMark if available, otherwise calculate from next item
            const maxMark = scale.maxMark !== undefined 
              ? scale.maxMark 
              : (index === 0 ? 100 : sortedArray[index - 1].minMark - 1);
            return (
              <Text key={scale.grade} style={styles.gradeItem}>
                {scale.grade}({scale.minMark}-{maxMark})
              </Text>
            );
          })}
        </View>
      )}

      {/* Teacher Reports */}
      <View style={styles.teacherReports}>
        <View style={styles.reportSection}>
          <View style={styles.reportRow}>
            <View style={styles.reportTitleSection}>
              <Text style={styles.reportTitle}>CLASS TEACHER'S REPORT:</Text>
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
              <Text style={styles.reportTitle}>HEAD TEACHER'S REPORT:</Text>
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
      <View style={styles.footer}>
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
        {renderSchoolMotto()}
      </View>
    </View>
  );
};

// Batch PDF Document Component
export const PupilReportCardBatchPDF: React.FC<BatchPDFProps> = ({ pupils, title }) => {
  return (
    <Document title={title || "Student Report Cards"}>
      {pupils.map((pupil, index) => (
        <Page key={index} size="A4" style={styles.page}>
          <PupilReportCard {...pupil} />
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
            `Page ${index + 1} of ${pupils.length}`
          )} />
        </Page>
      ))}
    </Document>
  );
};

// PDF Viewer wrapper for standalone use
export const PupilReportCardPDFViewer: React.FC<PupilReportCardProps> = (props) => {
  const [error, setError] = useState<PDFError | null>(null);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 p-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading PDF</h3>
          <p className="text-sm text-red-600">{error.message}</p>
          <button
            onClick={() => setError(null)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <PDFViewer 
      style={{ width: '100%', height: '100vh' }} 
      showToolbar={true}
    >
      <Document title="Student Report Card">
        <Page size="A4" style={styles.page}>
          <PupilReportCard {...props} />
        </Page>
      </Document>
    </PDFViewer>
  );
};

// Function to fetch pupil report data
export const usePupilReportData = (examId: string, classId: string, pupilId?: string) => {
  return useQuery({
    queryKey: ['pupilReportData', examId, classId, pupilId],
    queryFn: async () => {
      let endpoint = `${API_BASE_URL}/reports/exam/${examId}/class/${classId}`;
      
      if (pupilId) {
        endpoint += `/pupil/${pupilId}`;
      }
      
      const response = await api.get(endpoint);
      return response.data;
    },
    enabled: !!examId && !!classId,
  });
};

// Generate function for batch PDF
export const generateBatchPupilReportsPDF = async (pupils: PupilReportCardProps[], title: string): Promise<Blob> => {
  return await pdf(
    <PupilReportCardBatchPDF pupils={pupils} title={title} />
  ).toBlob();
};

export default PupilReportCardBatchPDF; 