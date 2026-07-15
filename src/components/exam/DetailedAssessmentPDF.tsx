import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';
import { cleanSubjectName } from '@/lib/utils/html-entities';
import { formatTermName, calculateAccurateAge } from '@/lib/utils/term-formatter';

import { AggregateCommentPicker } from '@/lib/exam-report-commentary';

interface ExamResult {
  pupilInfo: {
    name: string;
    admissionNumber: string;
    pupilId: string;
    age?: number;
    photo?: string;
    dateOfBirth?: string;
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
}

interface Subject {
  subjectId: string;
  code: string;
  name: string;
  fullMarks?: number;
  teacherName?: string;
}

interface DetailedAssessmentProps {
  examDetails: {
    name: string;
    examTypeName: string;
    startDate: string;
    endDate: string;
    academicYearId?: string;
    termId?: string;
    academicYearName?: string;
    termName?: string;
  };
  classSnap: {
    name: string;
  };
  subjectSnaps: Subject[];
  processedResults: ExamResult[];
  schoolSettings?: {
    generalInfo?: {
      name?: string;
      physicalAddress?: string;
      postalAddress?: string;
      phoneNumber?: string;
      alternativePhoneNumber?: string;
      email?: string;
      motto?: string;
      city?: string;
      country?: string;
      logo?: string;
    };
    address?: {
      physical?: string;
      postal?: string;
      poBox?: string;
      city?: string;
      country?: string;
    };
    contact?: {
      phone?: string;
      alternativePhone?: string;
      email?: string;
    };
  };
  majorSubjects?: string[];
  gradingScale?: Array<{
    minMark: number;
    maxMark?: number;
    grade: string;
    aggregates: number;
  }>;
}

// Helper function to calculate age from date of birth using exam date
const calculateAge = (dateOfBirth?: string, examDate?: string, ageAtExam?: number): number => {
  console.log('🔍 calculateAge called with:', { dateOfBirth, examDate, ageAtExam });
  
  // If ageAtExam is already provided and valid, use it
  if (ageAtExam && ageAtExam > 0 && ageAtExam < 100) {
    console.log('✅ Using ageAtExam:', ageAtExam);
    return ageAtExam;
  }
  
  // Otherwise calculate from date of birth
  try {
    const calculatedAge = calculateAccurateAge(dateOfBirth, examDate || new Date());
    console.log('✅ Calculated age:', calculatedAge);
    return calculatedAge;
  } catch (error) {
    console.error('❌ Age calculation failed:', error);
    // As last resort, if we have a date of birth string, try simple year subtraction
    if (dateOfBirth) {
      const year = parseInt(dateOfBirth.substring(0, 4));
      if (year > 1900 && year < 2030) {
        const refYear = examDate ? new Date(examDate).getFullYear() : new Date().getFullYear();
        const simpleAge = refYear - year;
        console.log('⚠️ Using simple age calculation:', simpleAge);
        return simpleAge > 0 ? simpleAge : 0;
      }
    }
    throw error; // Re-throw if all methods fail
  }
};

// Helper function to generate remarks based on marks - Compact version
const generateRemarks = (marks: number): string => {
  if (marks >= 95) return 'EXCELLENT';
  if (marks >= 80) return 'VERY GOOD';
  if (marks >= 70) return 'GOOD';
  if (marks >= 60) return 'FAIR';
  if (marks >= 45) return 'TRIED';
  return 'POOR';
};

// Helper function to validate if a photo is a real photo (not placeholder)
const isRealPhoto = (photo?: string): boolean => {
  return !!(photo && 
    photo !== 'NO PHOTO' && 
    photo.trim() !== '' && 
    photo !== 'https://placehold.co/128x128.png' &&
    !photo.includes('ui-avatars.com') && // Exclude generated avatars
    (photo.startsWith('http') || photo.startsWith('data:') || photo.startsWith('blob:')));
};

// Helper function to generate teacher initials
const generateTeacherInitials = (teacherName: string): string => {
  if (!teacherName) return 'N/A';
  return teacherName
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
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
  contentContainer: {
    position: 'relative',
    zIndex: 10,
    margin: 28, // Keep each cut-ready report 1cm from the page edge.
    height: 842 - (28 * 2),
    maxWidth: 595 - (28 * 2),
    maxHeight: 842 - (28 * 2),
    justifyContent: 'space-between',
    overflow: 'hidden',
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
  schoolName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2,
    textAlign: 'center',
  },
  schoolDetails: {
    fontSize: 7,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  headerTitle: {
    backgroundColor: '#1e40af',
    padding: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: -2,
    marginBottom: 6,
    alignSelf: 'center',
    // Modern gradient-like effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  titleText: {
    color: 'white',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  examDetails: {
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 6,
  },
  pupilSection: {
    position: 'relative',
    marginBottom: 0,
    height: '48%',
    borderWidth: 3,
    borderColor: '#1e40af',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#ffffff',
    // Modern shadow effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  pupilSectionSecond: {
    position: 'relative',
    marginBottom: 0,
    height: '48%',
    borderWidth: 3,
    borderColor: '#1e40af',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#ffffff',
    // Modern shadow effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  pupilInnerBorder: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderWidth: 1,
    borderColor: '#60a5fa',
    borderRadius: 7,
  },
  pupilContent: {
    position: 'relative',
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 0,
    minHeight: 60,
  },
  logoSection: {
    width: '15%',
    alignItems: 'center',
    marginLeft: -15, // Equal distance from border, not touching
  },
  schoolSection: {
    width: '70%', // Increased width for more school info space
    alignItems: 'center',
    marginLeft: 10, // Add some space from the logo/photo section
  },
  photoSection: {
    width: '15%',
    alignItems: 'center',
    position: 'relative',
    marginLeft: -5, // Equal distance from border, adjacent to logo
  },
  photoFrame: {
    width: 45,
    height: 45,
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: 22.5,
    padding: 2,
    borderWidth: 2,
    borderColor: '#1e40af',
    // Modern shadow effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  logo: {
    width: 55,
    height: 55,
    objectFit: 'contain',
  },
  pupilPhoto: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: 22.5,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  qrCode: {
    width: 25,
    height: 25,
    marginLeft: 5,
  },
  studentInfo: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    // Modern subtle shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
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
    fontSize: 9,
    color: '#6b7280',
    marginRight: 4,
  },
  infoValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a', // Green color to make information stand out
  },
  resultsTable: {
    marginTop: 2,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    // Modern shadow effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    padding: 8,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  tableHeaderCell: {
    color: 'white',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#60a5fa',
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  tableRowAlt: {
    backgroundColor: 'white',
  },
  tableCell: {
    fontSize: 9,
    textAlign: 'center',
    color: '#334155',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  subjectCell: {
    width: '25%',
    textAlign: 'left',
  },
  totalMarksCell: {
    width: '15%',
  },
  marksCell: {
    width: '15%',
  },
  gradeCell: {
    width: '15%',
  },
  remarksCell: {
    width: '18%',
    textAlign: 'left',
  },
  initialsCell: {
    width: '12%',
  },
  marksContent: {
    color: '#2563eb',
    fontFamily: 'Helvetica-Bold',
  },
  remarksContent: {
    color: '#15803d',
    fontSize: 8, // Smaller font for compact remarks
  },
  tableHeading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  totalsRow: {
    backgroundColor: '#fef2f2',
    borderTopWidth: 2,
    borderTopColor: '#dc2626',
    // Modern shadow effect for totals
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  totalsCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#dc2626',
  },
  gradeRed: {
    color: '#dc2626',
    fontFamily: 'Helvetica-Bold',
  },
  redValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#b91c1c',
  },
  // Footer section styles
  footerSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    // Modern subtle shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  divisionSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
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
  teacherCommentSection: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
    marginRight: 4,
  },
  commentContent: {
    fontSize: 10,
    color: '#334155',
    lineHeight: 1.3,
    marginBottom: 6,
    flex: 1,
  },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 15, // Increased spacing for signature line
    marginBottom: 8,
    paddingRight: 10,
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
  motto: {
    fontSize: 10,
    fontFamily: 'Helvetica-Oblique',
    textAlign: 'center',
    color: '#1e3a8a',
    marginTop: 8,
  },
});

// Individual Pupil Component
            const PupilAssessmentCard: React.FC<{
              pupil: ExamResult;
              subjects: Subject[];
              majorSubjects?: string[];
              schoolName: string;
              examTitle: string;
              className: string;
              schoolInfo: any;
              examDetails: any;
              commentPicker: AggregateCommentPicker;
            }> = ({ pupil, subjects, majorSubjects, schoolName, examTitle, className, schoolInfo, examDetails, commentPicker }) => {
              // Calculate age using ageAtExam if available, otherwise calculate from dateOfBirth
              const age = calculateAge(pupil.pupilInfo.dateOfBirth, examDetails.startDate, pupil.pupilInfo.ageAtExam);

              // Generate QR code data - match Modern Report exactly
              const qrData = `Name: ${pupil.pupilInfo.name}
            Class: ${className}
            Age: ${age} years
            PIN: ${pupil.pupilInfo.admissionNumber || 'N/A'}
            Year: ${examDetails.academicYearName || new Date().getFullYear().toString()}
            Term: ${formatTermName(examDetails.termName || 'TERM')}
            Exam: ${examTitle}
            Total Aggregates: ${pupil.totalAggregates}
            Division: ${pupil.division}
            Date: ${new Date().toLocaleDateString()}`;

  return (
    <View>
      {/* Compact School Information at Top */}
      <View style={styles.headerRow}>
        <View style={styles.logoSection}>
          <Image 
            src={schoolInfo.logo || '/images/default-logo.png'} 
            style={styles.logo}
          />
        </View>
                            <View style={styles.schoolSection}>
                      <Text style={styles.schoolName}>{schoolName}</Text>
                      {schoolInfo.physicalAddress && (
                        <Text style={styles.schoolDetails}>{schoolInfo.physicalAddress}</Text>
                      )}
                      <Text style={styles.schoolDetails}>
                        {schoolInfo.phone && `Tel: ${schoolInfo.phone}`}
                        {schoolInfo.altPhone && schoolInfo.phone && ` / ${schoolInfo.altPhone}`}
                        {!schoolInfo.phone && schoolInfo.altPhone && `Tel: ${schoolInfo.altPhone}`}
                        {schoolInfo.email && ` | Email: ${schoolInfo.email}`}
                        {schoolInfo.postalAddress && ` | P.O. Box: ${schoolInfo.postalAddress}`}
                      </Text>
                    </View>
        <View style={styles.photoSection}>
          {isRealPhoto(pupil.pupilInfo.photo) && (
            <View style={styles.photoFrame}>
              <Image 
                src={pupil.pupilInfo.photo} 
                style={styles.pupilPhoto}
              />
            </View>
          )}
        </View>
      </View>

      {/* Exam Title Below School Information */}
      <View style={styles.headerTitle}>
        <Text style={styles.titleText}>{examDetails.examTypeName?.toUpperCase() || 'EXAM'} - DETAILED ASSESSMENT</Text>
      </View>

                        {/* Student Information Section - Match Modern Report exactly */}
                  <View style={styles.studentInfo}>
                    <View style={styles.studentInfoRow}>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Pupil:</Text>
                        <Text style={styles.infoValue}>{pupil.pupilInfo.name}</Text>
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
                        <Text style={[styles.infoValue, styles.redValue]}>{pupil.pupilInfo.admissionNumber}</Text>
                      </View>
                    </View>
                    <View style={[styles.studentInfoRow, styles.studentInfoRowLast]}>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Year:</Text>
                        <Text style={styles.infoValue}>{examDetails.academicYearName || new Date().getFullYear().toString()}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Term:</Text>
                        <Text style={styles.infoValue}>{formatTermName(examDetails.termName || 'TERM')}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Created On:</Text>
                        <Text style={styles.infoValue}>{new Date().toLocaleDateString()}</Text>
                      </View>
                    </View>
                  </View>

                        {/* Results Table - Match Modern Report exactly */}
                  <View style={styles.resultsTable}>
                    {/* Table Heading */}
                    <Text style={styles.tableHeading}>{examTitle?.toUpperCase()} PERFORMANCE</Text>

                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, styles.subjectCell]}>SUBJECT</Text>
                      <Text style={[styles.tableHeaderCell, styles.totalMarksCell]}>TOTAL</Text>
                      <Text style={[styles.tableHeaderCell, styles.marksCell]}>MARKS</Text>
                      <Text style={[styles.tableHeaderCell, styles.gradeCell]}>GRADE</Text>
                      <Text style={[styles.tableHeaderCell, styles.remarksCell]}>REMARKS</Text>
                      <Text style={[styles.tableHeaderCell, styles.initialsCell]}>INIT.</Text>
                    </View>

                    {subjects.map((subject, index) => {
                      const isMajor = subject.isMajorSubject;
                      
                      return (
                        <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
                          <Text style={[styles.tableCell, styles.subjectCell, { 
                            fontFamily: 'Helvetica-Bold',
                            textTransform: 'uppercase',
                            color: isMajor ? '#1e40af' : '#6b7280' // Highlight major subjects
                          }]}>
                            {cleanSubjectName(subject.name)}
                          </Text>
                          <Text style={[styles.tableCell, styles.totalMarksCell]}>
                            {subject.fullMarks}
                          </Text>
                          <Text style={[styles.tableCell, styles.marksCell, styles.marksContent]}>
                            {subject.marksGained}
                          </Text>
                          <Text style={[styles.tableCell, styles.gradeCell, { color: '#dc2626', fontFamily: 'Helvetica-Bold' }]}>
                            {isMajor ? subject.grade : '-'}
                          </Text>
                          <Text style={[styles.tableCell, styles.remarksCell, styles.remarksContent]}>
                            {subject.remarks}
                          </Text>
                          <Text style={[styles.tableCell, styles.initialsCell]}>
                            {subject.teacherInitials}
                          </Text>
                        </View>
                      );
                    })}

                    {/* Totals Row */}
                    <View style={[styles.tableRow, styles.totalsRow]}>
                      <Text style={[styles.tableCell, styles.subjectCell, styles.totalsCell]}>TOTAL</Text>
                      <Text style={[styles.tableCell, styles.totalMarksCell, styles.totalsCell]}>
                        {subjects.reduce((sum, subject) => sum + (subject.fullMarks || 100), 0)}
                      </Text>
                      <Text style={[styles.tableCell, styles.marksCell, styles.totalsCell]}>{pupil.totalMarks}</Text>
                      <Text style={[styles.tableCell, styles.gradeCell, styles.totalsCell]}>{pupil.totalAggregates}</Text>
                      <Text style={[styles.tableCell, styles.remarksCell, styles.totalsCell]}>-</Text>
                      <Text style={[styles.tableCell, styles.initialsCell, styles.totalsCell]}>-</Text>
                                         </View>
                   </View>

                   {/* Footer Section - Division, Teacher Comment, Signature, and Motto */}
                   <View style={styles.footerSection}>
                     {/* Division - Right Aligned */}
                     <View style={styles.divisionSection}>
                       <Text style={styles.divisionLabel}>DIVISION:</Text>
                       <Text style={styles.divisionValue}>{pupil.division}</Text>
                     </View>

                     {/* Class Teacher's Comment */}
                     <View style={styles.teacherCommentSection}>
                       <Text style={styles.commentTitle}>CLASS TEACHER'S COMMENT: </Text>
                       <Text style={styles.commentContent}>
                         {commentPicker.classTeacher(pupil.pupilInfo.name, pupil.totalAggregates)}
                       </Text>
                     </View>

                     {/* Class Teacher Signature */}
                     <View style={styles.signatureSection}>
                       <Text style={styles.signatureText}>Class Teacher - Sign: </Text>
                       <View style={styles.signatureLine}></View>
                     </View>

                     {/* School Motto */}
                     {schoolInfo.motto && (
                       <Text style={styles.motto}>"{schoolInfo.motto}"</Text>
                     )}
                   </View>
                 </View>
               );
             };

// Main export function
export const generateDetailedAssessmentPDF = async (props: DetailedAssessmentProps) => {
  const { 
    examDetails, 
    classSnap, 
    subjectSnaps, 
    processedResults, 
    schoolSettings, 
    majorSubjects,
    gradingScale
  } = props;

  

  

                // School information - match Modern Report exactly
              const schoolInfo = {
                name: schoolSettings?.generalInfo?.name || 'School Name',
                logo: schoolSettings?.generalInfo?.logo || '',
                physicalAddress: schoolSettings?.generalInfo?.physicalAddress || 
                                schoolSettings?.address?.physical || '',
                postalAddress: schoolSettings?.address?.poBox || 
                              schoolSettings?.generalInfo?.postalAddress || 
                              schoolSettings?.address?.postal || '',
                phone: schoolSettings?.generalInfo?.phoneNumber || 
                       schoolSettings?.contact?.phone || '',
                altPhone: schoolSettings?.generalInfo?.alternativePhoneNumber || 
                          schoolSettings?.contact?.alternativePhone || '',
                email: schoolSettings?.generalInfo?.email || 
                       schoolSettings?.contact?.email || '',
                motto: schoolSettings?.generalInfo?.motto || '',
                city: schoolSettings?.generalInfo?.city || 
                      schoolSettings?.address?.city || '',
                country: schoolSettings?.generalInfo?.country || 
                         schoolSettings?.address?.country || ''
              };

  // Actual grading scale to use
  const actualGradingScale = gradingScale || DEFAULT_GRADING_SCALE;

  const commentPicker = new AggregateCommentPicker();

  // Create the document
  const DetailedAssessmentDocument = () => (
    <Document>
      {/* Group pupils into pairs for 2 per page */}
      {processedResults.reduce((pages: React.ReactElement[], result, index) => {
        const pageIndex = Math.floor(index / 2);
        const isFirstPupil = index % 2 === 0;
        
        // Process subjects data exactly like Modern Report
        const processedSubjects = subjectSnaps.map(subject => {
          const subjectResult = result.results[subject.code] || { marks: 0, grade: 'F9', aggregates: 9 };
          const isMajor = majorSubjects?.includes(subject.code) || subjectSnaps.length <= 4;
          
          return {
            name: cleanSubjectName(subject.name),
            code: subject.code,
            fullMarks: subject.fullMarks || 100,
            marksGained: subjectResult.marks,
            grade: subjectResult.grade,
            aggregates: subjectResult.aggregates,
            remarks: generateRemarks(subjectResult.marks),
            teacherInitials: generateTeacherInitials(subject.teacherName || ''),
            isMajorSubject: isMajor
          };
        });
        
        if (isFirstPupil) {
          // Start new page
          const nextResult = processedResults[index + 1];
          
          // Process subjects for next pupil if exists
          let nextProcessedSubjects = null;
          if (nextResult) {
            nextProcessedSubjects = subjectSnaps.map(subject => {
              const subjectResult = nextResult.results[subject.code] || { marks: 0, grade: 'F9', aggregates: 9 };
              const isMajor = majorSubjects?.includes(subject.code) || subjectSnaps.length <= 4;
              
              return {
                name: cleanSubjectName(subject.name),
                code: subject.code,
                fullMarks: subject.fullMarks || 100,
                marksGained: subjectResult.marks,
                grade: subjectResult.grade,
                aggregates: subjectResult.aggregates,
                remarks: generateRemarks(subjectResult.marks),
                teacherInitials: generateTeacherInitials(subject.teacherName || ''),
                isMajorSubject: isMajor
              };
            });
          }
          
          pages.push(
            <Page key={pageIndex} size="A4" style={styles.page}>
              <View style={styles.contentContainer}>
                {/* Each mini report has its own complete, cut-ready double border. */}
                <View style={styles.pupilSection}>
                  <View style={styles.pupilInnerBorder} />
                  <View style={styles.pupilContent}>
                              <PupilAssessmentCard
                                pupil={result}
                                subjects={processedSubjects}
                                majorSubjects={majorSubjects}
                                schoolName={schoolInfo.name}
                                examTitle={examDetails.name}
                                className={classSnap.name}
                                schoolInfo={schoolInfo}
                                examDetails={examDetails}
                                commentPicker={commentPicker}
                              />
                  </View>
                </View>

                {nextResult && (
                  <View style={styles.pupilSectionSecond}>
                    <View style={styles.pupilInnerBorder} />
                    <View style={styles.pupilContent}>
                                <PupilAssessmentCard
                                  pupil={nextResult}
                                  subjects={nextProcessedSubjects}
                                  majorSubjects={majorSubjects}
                                  schoolName={schoolInfo.name}
                                  examTitle={examDetails.name}
                                  className={classSnap.name}
                                  schoolInfo={schoolInfo}
                                  examDetails={examDetails}
                                  commentPicker={commentPicker}
                                />
                    </View>
                  </View>
                )}
              </View>
            </Page>
          );
        }
        
        return pages;
      }, [])}
    </Document>
  );

  try {
    // Generate PDF blob
    const blob = await pdf(DetailedAssessmentDocument()).toBlob();
    
    // Return blob instead of downloading
    return blob;
  } catch (error) {
    console.error("Detailed Assessment PDF generation error:", error);
    throw error;
  }
};
