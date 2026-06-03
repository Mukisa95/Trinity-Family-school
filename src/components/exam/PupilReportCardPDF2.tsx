import React, { useEffect, useState } from 'react';
import { Document, Page, View, Text, StyleSheet, Image, Font, PDFViewer } from '@react-pdf/renderer';

// Register modern fonts
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf', fontWeight: 300 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 700 },
  ],
});

// Types
export interface Subject {
  name: string;
  code: string;
  fullMarks: number;
  marksGained: number;
  grade: string;
  aggregates: number;
  remarks: string;
  teacherInitials: string;
}

// Updated ProgressiveAssessmentSubject interface
export interface ProgressiveAssessmentSubject {
  name: string; // Name of the subject from the progressive exam
  code: string; // Code of the subject from the progressive exam (can be an ID or actual code)
  marks: number;
  aggregates: number | string;
  grade: string; // Grade for this subject in the progressive exam
}

export interface ProgressiveAssessment {
  id: string;
  name: string;
  subjects: ProgressiveAssessmentSubject[]; // Use the updated interface
  totalMarks: number;
  average: number;
  totalAggregates: number;
  division: string;
}

export interface PupilReportCardProps {
  // School information
  schoolName: string;
  schoolLogo?: string;
  schoolPhysicalAddress?: string;
  schoolCity?: string;
  schoolCountry?: string;
  schoolPhone?: string;
  schoolAltPhone?: string;
  schoolEmail?: string;
  examTypeName?: string;

  // Pupil information
  pupilName: string;
  pupilPhoto?: string;
  pupilIdentificationNumber?: string;
  pupilRMQRCode?: string;
  dateOfBirth?: string;
  className: string;
  position: number;
  date: string;
  nextTermBegins?: string;
  examDate?: string;
  pupilInfo?: {
    ageAtExam?: number | string;
    [key: string]: any;
  };

  // Exam data
  subjects: Subject[];
  totalMarks: number;
  totalAggregates: number;
  division: string;
  classTeacherReport?: string;
  headTeacherReport?: string;
  
  // Exam snapshot
  examSnapshot?: {
    termId?: string;
    academicYearId?: string;
    termName?: string;
    academicYearName?: string;
    termEndDate?: string;
    nextTermStartDate?: string;
  };
  
  // Progressive assessments
  progressiveAssessments?: ProgressiveAssessment[];
  nextTermBeginsOn?: string;
  nextTermEndsOn?: string;
}

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#2D3748',
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logoContainer: {
    width: 70,
    height: 70,
  },
  schoolLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  pupilPhotoContainer: {
    alignItems: 'center',
    width: 70,
    height: 70,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  pupilPhoto: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  rMQRContainer: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 40,
    height: 40,
    zIndex: 999,
  },
  rMQRCode: {
    width: 40,
    height: 40,
    objectFit: 'contain',
  },
  schoolInfoContainer: {
    flex: 1,
    marginHorizontal: 15,
    alignItems: 'center',
  },
  schoolName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
    color: '#3182CE',
  },
  schoolContact: {
    fontSize: 7,
    marginBottom: 1,
    textAlign: 'center',
    color: '#4A5568',
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 8,
    textTransform: 'uppercase',
    color: '#3182CE',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
  },
  studentInfoContainer: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#F7FAFC',
    position: 'relative',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    marginRight: 4,
    color: '#4A5568',
  },
  infoValue: {
    fontSize: 8,
    flex: 1,
    color: '#10B981',
    fontWeight: 500,
  },
  table: {
    width: '100%',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  examTypeHeading: {
    backgroundColor: '#EBF8FF',
    color: '#3182CE',
    fontWeight: 'bold',
    padding: 6,
    fontSize: 11,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#3182CE',
    color: '#FFFFFF',
    fontWeight: 'bold',
    padding: 3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 18,
  },
  evenRow: {
    backgroundColor: '#F7FAFC',
  },
  tableCell: {
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    justifyContent: 'center',
  },
  headerCell: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: 'bold',
    padding: 3,
    textAlign: 'center',
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cellText: {
    fontSize: 8,
    padding: 3,
    textAlign: 'left',
  },
  subjectCol: {
    width: '30%',
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    fontSize: 8,
  },
  markCol: {
    width: '12%',
    padding: 3,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    fontSize: 8,
  },
  marksScored: {
    fontWeight: 'bold',
    color: '#10B981',
  },
  aggCol: {
    width: '8%',
    padding: 3,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    fontSize: 8,
  },
  remarksCol: {
    width: '30%',
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    fontSize: 8,
  },
  remarksText: {
    color: '#3182CE',
  },
  initialsCol: {
    width: '8%',
    padding: 3,
    textAlign: 'center',
    fontSize: 8,
  },
  promotionRemark: {
    fontWeight: 'bold',
    color: '#38A169',
  },
  summaryContainer: {
    marginTop: 10,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryBox: {
    width: '23%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
  },
  summaryLabel: {
    fontSize: 8,
    marginBottom: 4,
    color: '#4A5568',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  summaryValueRed: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  progressiveTable: {
    width: '100%',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressiveHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#3182CE',
  },
  progressiveHeaderCell: {
    fontSize: 7,
    color: '#FFFFFF',
    fontWeight: 'bold',
    padding: 3,
    textAlign: 'center',
  },
  progressiveRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 18,
  },
  progressiveCell: {
    fontSize: 7,
    padding: 2,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  assessmentNameCell: {
    width: '15%',
    fontWeight: 'bold',
  },
  subjectMarkCell: {
    width: '8%',
  },
  aggregateGrade: {
    fontSize: 6,
    color: '#10B981',
    fontWeight: 'bold',
  },
  summaryCell: {
    width: '10%',
    fontWeight: 'bold',
  },
  commentsContainer: {
    marginTop: 20,
  },
  commentBox: {
    marginBottom: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    backgroundColor: '#F7FAFC',
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  commentLabelContainer: {
    width: '25%',
  },
  commentLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#4A5568',
  },
  commentTextContainer: {
    flex: 1,
  },
  commentText: {
    fontSize: 8,
    lineHeight: 1.4,
  },
  classTeacherComment: {
    fontSize: 8,
    lineHeight: 1.4,
    color: '#3B82F6',
  },
  headTeacherComment: {
    fontSize: 8,
    lineHeight: 1.4,
    color: '#EF4444',
  },
  signatureContainer: {
    width: '30%',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  signatureLine: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#718096',
    marginBottom: 2,
  },
  signatureText: {
    fontSize: 6,
    color: '#4A5568',
    textAlign: 'center',
  },
  dateSection: {
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateBox: {
    width: '45%',
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#4A5568',
  },
  dateValue: {
    fontSize: 9,
    color: '#2D3748',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 2,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#3182CE',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 3,
  },
  footer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  aggValue: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  ageSection: {
    marginTop: 5,
    marginBottom: 5,
    padding: 4,
    backgroundColor: '#F0FDF4',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ageLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#4A5568',
  },
  ageValue: {
    fontSize: 8,
    color: '#10B981',
    fontWeight: 'bold',
  },
});

// Create the PDF document component
const TerminalReport: React.FC<PupilReportCardProps> = (props) => {
  // Add debugging
  console.log('PupilReportCardPDF2 props:', {
    examSnapshot: props.examSnapshot,
    progressiveAssessments: props.progressiveAssessments,
    pupilName: props.pupilName,
    dateOfBirth: props.dateOfBirth,
    pupilAge: props.pupilInfo?.ageAtExam || 'Not provided'
  });

  // Use termName if available, otherwise try to extract term number from termId
  const termNumber = props.examSnapshot?.termName 
    ? props.examSnapshot.termName 
    : props.examSnapshot?.termId 
      ? props.examSnapshot.termId.split('-')[1] 
      : '';
      
  // Use academicYearName if available, otherwise use academicYearId
  const academicYear = props.examSnapshot?.academicYearName 
    ? props.examSnapshot.academicYearName 
    : props.examSnapshot?.academicYearId || '';

  // State for term dates
  const [termDates, setTermDates] = useState({
    termEndDate: props.date || '________________',
    nextTermStartDate: props.nextTermBegins || '________________'
  });

  const [examSnapshotWithDates, setExamSnapshotWithDates] = useState(props.examSnapshot);

  useEffect(() => {
    const fetchTermDates = async () => {
      try {
        // First try to use the dates from props
        if (props.date && props.nextTermBegins) {
          const dates = {
            termEndDate: props.date,
            nextTermStartDate: props.nextTermBegins
          };
          setTermDates(dates);
          setExamSnapshotWithDates({
            ...props.examSnapshot,
            termEndDate: dates.termEndDate,
            nextTermStartDate: dates.nextTermStartDate
          });
          return;
        }

        // If no props dates, try to fetch from API
        const response = await fetch('/api/academic-years');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const years = await response.json();
        
        if (!Array.isArray(years) || years.length === 0) {
          throw new Error('No academic years data available');
        }
        
        // Find the exam's academic year
        const examYear = years.find((year: any) => year.id === academicYear);
        if (!examYear || !Array.isArray(examYear.terms)) {
          throw new Error('Academic year or terms not found');
        }

        // Find the exam's term
        const examTerm = examYear.terms.find((term: any) => term.id === props.examSnapshot?.termId);
        if (!examTerm) {
          throw new Error('Term not found');
        }

        // Get the term end date
        let termEndDate = examTerm.endDate ? new Date(examTerm.endDate).toLocaleDateString() : '________________';
        let nextTermStartDate = '________________';

        // Find the next term
        const termIndex = examYear.terms.indexOf(examTerm);
        if (termIndex < examYear.terms.length - 1) {
          // Next term is in the same year
          const nextTerm = examYear.terms[termIndex + 1];
          if (nextTerm.startDate) {
            nextTermStartDate = new Date(nextTerm.startDate).toLocaleDateString();
          }
        } else {
          // Need to find first term of next year
          const nextYear = years.find((year: any) => parseInt(year.id) === parseInt(academicYear) + 1);
          if (nextYear && Array.isArray(nextYear.terms) && nextYear.terms.length > 0) {
            const nextTerm = nextYear.terms[0];
            if (nextTerm.startDate) {
              nextTermStartDate = new Date(nextTerm.startDate).toLocaleDateString();
            }
          }
        }

        const dates = { termEndDate, nextTermStartDate };
        setTermDates(dates);
        setExamSnapshotWithDates({
          ...props.examSnapshot,
          termEndDate: dates.termEndDate,
          nextTermStartDate: dates.nextTermStartDate
        });
      } catch (error) {
        console.error('Error fetching term dates:', error);
        // Use the props dates as fallback
        const dates = {
          termEndDate: props.date || '________________',
          nextTermStartDate: props.nextTermBegins || '________________'
        };
        setTermDates(dates);
        setExamSnapshotWithDates({
          ...props.examSnapshot,
          termEndDate: dates.termEndDate,
          nextTermStartDate: dates.nextTermStartDate
        });
      }
    };

    fetchTermDates();
  }, [academicYear, props.examSnapshot?.termId, props.date, props.nextTermBegins, props.examSnapshot]);

  // Helper function to normalize subject codes for better matching
  const normalizeSubjectCode = (code: string): string => {
    if (!code) return '';
    // Remove any non-alphanumeric characters and convert to uppercase
    return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  };

  // Helper function to extract common subject abbreviations
  const getSubjectAbbreviation = (fullName: string): string => {
    // Common subject abbreviations mapping
    const commonSubjects: {[key: string]: string} = {
      'MATHEMATICS': 'MATH',
      'MATHS': 'MATH',
      'MATH': 'MATH',
      'ENGLISH': 'ENG',
      'ENGLISH LANGUAGE': 'ENG',
      'SCIENCE': 'SCI',
      'GENERAL SCIENCE': 'SCI',
      'SOCIAL STUDIES': 'SST',
      'SOCIAL STUDY': 'SST',
      'RELIGIOUS EDUCATION': 'RE',
      'CHRISTIAN RELIGIOUS EDUCATION': 'CRE',
      'RELIGIOUS STUDIES': 'RS',
      'PHYSICAL EDUCATION': 'PE',
      'COMPUTER STUDIES': 'CS',
      'INFORMATION TECHNOLOGY': 'IT',
      'BIOLOGY': 'BIO',
      'CHEMISTRY': 'CHEM',
      'PHYSICS': 'PHY',
      'HISTORY': 'HIST',
      'GEOGRAPHY': 'GEO',
      'AGRICULTURE': 'AGRIC',
      'BUSINESS STUDIES': 'BS',
      'KISWAHILI': 'KIS',
      'SWAHILI': 'SWA',
      'FRENCH': 'FRE',
    };

    // Normalize the full name
    const normalizedName = fullName.toUpperCase();
    
    // Check if the full name exactly matches any of the common subjects
    for (const [subject, abbr] of Object.entries(commonSubjects)) {
      if (normalizedName === subject) {
        return abbr;
      }
    }
    
    // Check if the full name contains any of the common subjects
    for (const [subject, abbr] of Object.entries(commonSubjects)) {
      if (normalizedName.includes(subject)) {
        return abbr;
      }
    }

    // If no match found, use the first word or first letters of multiple words
    const words = fullName.split(' ');
    if (words.length === 1) {
      // Single word - use first 3-4 characters
      return words[0].substring(0, Math.min(4, words[0].length)).toUpperCase();
    } else {
      // Multiple words - use first letter of each word (up to 3 words)
      return words.slice(0, 3).map(word => word.charAt(0)).join('').toUpperCase();
    }
  };

  // Get unique subject codes with normalized codes and multiple matching options
  const subjectCodes = props.subjects
    .map(subject => {
      const normalizedCode = normalizeSubjectCode(subject.code);
      const displayCode = subject.code;
      const abbreviation = getSubjectAbbreviation(subject.name);
      
      // Create a list of alternative codes for matching
      const alternativeCodes = [];
      
      // Add common alternatives for Math
      if (
        normalizedCode === 'MTC' || 
        normalizedCode === 'MATH' || 
        normalizedCode === 'MATHS' || 
        normalizedCode === 'MATHEMATICS' ||
        subject.name.toUpperCase().includes('MATH')
      ) {
        alternativeCodes.push('MTC', 'MATH', 'MATHS', 'MATHEMATICS');
      }
      
      // Add common alternatives for English
      if (
        normalizedCode === 'ENG' || 
        normalizedCode === 'ENGLISH' || 
        normalizedCode === 'ENGLISHLANGUAGE' ||
        subject.name.toUpperCase().includes('ENGLISH')
      ) {
        alternativeCodes.push('ENG', 'ENGLISH', 'ENGLISHLANGUAGE');
      }
      
      // Add the subject's own code and abbreviation
      if (!alternativeCodes.includes(normalizedCode)) alternativeCodes.push(normalizedCode);
      if (abbreviation && !alternativeCodes.includes(normalizeSubjectCode(abbreviation))) {
        alternativeCodes.push(normalizeSubjectCode(abbreviation));
      }
      
      return {
        originalCode: subject.code,
        normalizedCode,
        displayCode,
        abbreviation,
        alternativeCodes,
        subjectName: subject.name
      };
    });

  // Debug log to check what subject codes are available
  console.log('Processed subject codes for matching:', subjectCodes.map(s => ({
    subject: s.subjectName,
    normalizedCode: s.normalizedCode,
    alternativeCodes: s.alternativeCodes
  })));
  
  // Also log progressive assessment subjects for debugging
  if (props.progressiveAssessments && props.progressiveAssessments.length > 0) {
    const assessment = props.progressiveAssessments[0];
    console.log('Progressive assessment subjects:', assessment.subjects.map(s => ({
      code: s.code,
      normalizedCode: normalizeSubjectCode(s.code)
    })));
  }

  // Calculate age based on date of birth (fetched directly from pupils data) and exam date
  const calculateAge = (dateOfBirth: string | undefined, examDate: string | undefined): string => {
    if (!dateOfBirth) {
      console.log('No date of birth provided for age calculation');
      return 'N/A';
    }
    
    // Try different date formats (YYYY-MM-DD or MM/DD/YYYY)
    let birthDate: Date;
    try {
      // Try ISO format
      birthDate = new Date(dateOfBirth);
      
      // If date is invalid, try to parse MM/DD/YYYY format
      if (isNaN(birthDate.getTime())) {
        const parts = dateOfBirth.split(/[\/\-]/);
        if (parts.length === 3) {
          // Try different combinations
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            birthDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          } else {
            // MM/DD/YYYY or DD/MM/YYYY
            birthDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
          }
        }
      }
      
      // If still invalid, return N/A
      if (isNaN(birthDate.getTime())) {
        console.error(`Invalid date of birth format: ${dateOfBirth}`);
        return 'N/A';
      }
    } catch (error) {
      console.error(`Error parsing date of birth: ${error}`);
      return 'N/A';
    }
    
    // Use exam date, term end date, or current date in that order of preference
    const referenceDate = examDate 
      ? new Date(examDate) 
      : props.examSnapshot?.termEndDate 
        ? new Date(props.examSnapshot.termEndDate) 
        : props.date 
          ? new Date(props.date) 
          : new Date();
    
    // If parsing failed, return N/A
    if (isNaN(referenceDate.getTime())) {
      console.error(`Invalid reference date: ${examDate || props.examSnapshot?.termEndDate || props.date}`);
      return 'N/A';
    }
    
    let age = referenceDate.getFullYear() - birthDate.getFullYear();
    const monthDifference = referenceDate.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred yet in the reference year
    if (monthDifference < 0 || (monthDifference === 0 && referenceDate.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age.toString();
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            {/* School Logo */}
            <View style={styles.logoContainer}>
              {props.schoolLogo && <Image src={props.schoolLogo} style={styles.schoolLogo} />}
            </View>

            {/* School Information */}
            <View style={styles.schoolInfoContainer}>
              <Text style={styles.schoolName}>{props.schoolName}</Text>
              <Text style={styles.schoolContact}>
                {props.schoolPhysicalAddress}, {props.schoolCity}, {props.schoolCountry}
              </Text>
              <Text style={styles.schoolContact}>
                Tel: {props.schoolPhone} {props.schoolAltPhone && `/ ${props.schoolAltPhone}`}
              </Text>
              <Text style={styles.schoolContact}>
                {props.schoolEmail && `Email: ${props.schoolEmail}`}
              </Text>
              <Text style={styles.reportTitle}>
                {props.examTypeName ? props.examTypeName.toUpperCase() + ' REPORT CARD' : 'REPORT CARD'}
              </Text>
            </View>

            {/* Pupil Photo */}
            <View>
              <View style={styles.pupilPhotoContainer}>
                {props.pupilPhoto && <Image src={props.pupilPhoto} style={styles.pupilPhoto} />}
              </View>
            </View>
          </View>
        </View>

        {/* Student Information */}
        <View style={styles.studentInfoContainer}>
          {/* QR Code positioned in top-right */}
          {props.pupilRMQRCode && (
            <View style={styles.rMQRContainer}>
              <Image src={props.pupilRMQRCode} style={styles.rMQRCode} />
            </View>
          )}
          
          <View style={styles.infoRow}>
            <View style={[styles.infoItem, { flex: 2 }]}>
              <Text style={styles.infoLabel}>NAME:</Text>
              <Text style={styles.infoValue}>{props.pupilName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>CLASS:</Text>
              <Text style={styles.infoValue}>{props.className}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>TERM:</Text>
              <Text style={styles.infoValue}>{termNumber}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>AGE:</Text>
              <Text style={styles.infoValue}>
                {calculateAge(props.dateOfBirth, props.examDate) === 'N/A' 
                  ? (props.pupilInfo?.ageAtExam || '10') + ' Years' 
                  : calculateAge(props.dateOfBirth, props.examDate) + ' Years'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>YEAR:</Text>
              <Text style={styles.infoValue}>{academicYear}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>PIN:</Text>
              <Text style={styles.infoValue}>{props.pupilIdentificationNumber || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* End of Term Performance Table */}
        <View style={styles.table}>
          {/* Exam Type Heading */}
          <Text style={styles.examTypeHeading}>
            {props.examTypeName ? props.examTypeName.toUpperCase() + ' RESULTS' : 'RESULTS'}
          </Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.subjectCol]}>SUBJECT</Text>
            <Text style={[styles.headerText, styles.markCol]}>FULL MARK</Text>
            <Text style={[styles.headerText, styles.markCol]}>MARKS SCORED</Text>
            <Text style={[styles.headerText, styles.aggCol]}>AGG.</Text>
            <Text style={[styles.headerText, styles.remarksCol]}>REMARKS</Text>
            <Text style={[styles.headerText, styles.initialsCol]}>INITIALS</Text>
          </View>
          {props.subjects.map((subject: Subject, index: number) => (
            <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.evenRow : {}]}>
              <Text style={styles.subjectCol}>{subject.name}</Text>
              <Text style={styles.markCol}>{subject.fullMarks}</Text>
              <Text style={[styles.markCol, styles.marksScored]}>{subject.marksGained}</Text>
              <Text style={[styles.aggCol, styles.aggValue]}>{subject.aggregates}</Text>
              <Text style={[styles.remarksCol, styles.remarksText]}>{subject.remarks}</Text>
              <Text style={styles.initialsCol}>{subject.teacherInitials}</Text>
            </View>
          ))}

          {/* Promotion Remark - Only show for Term 3 */}
          {props.examSnapshot?.termId?.includes('TERM-3') && (
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.subjectCol, { borderRightWidth: 0, color: 'transparent' }]}>-</Text>
              <Text style={[styles.markCol, { borderRightWidth: 0, color: 'transparent' }]}>-</Text>
              <Text style={[styles.markCol, { borderRightWidth: 0, color: 'transparent' }]}>-</Text>
              <Text style={[styles.aggCol, { borderRightWidth: 0, color: 'transparent' }]}>-</Text>
              <Text style={[styles.remarksCol, styles.promotionRemark, { borderRightWidth: 0 }]}>
                {props.totalAggregates >= 4 && props.totalAggregates <= 25 
                  ? 'PROMOTED'
                  : props.totalAggregates >= 26 && props.totalAggregates <= 30
                  ? 'PROMOTED ON PROBATION'
                  : props.totalAggregates >= 31 && props.totalAggregates <= 36
                  ? 'ADVISED TO REPEAT'
                  : ''}
              </Text>
              <Text style={[styles.initialsCol, { color: 'transparent' }]}>-</Text>
            </View>
          )}
        </View>

        {/* Summary Section */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>TOTAL MARK</Text>
            <Text style={styles.summaryValueRed}>{props.totalMarks}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>TOTAL AGGREGATE</Text>
            <Text style={styles.summaryValueRed}>{props.totalAggregates}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>DIVISION</Text>
            <Text style={styles.summaryValueRed}>{props.division}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>PASS RATE</Text>
            <Text style={styles.summaryValue}>
              {Math.round((props.subjects.filter(s => s.marksGained >= s.fullMarks * 0.5).length / props.subjects.length) * 100)}%
            </Text>
          </View>
        </View>

        {/* Progressive Assessment Records */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROGRESSIVE ASSESSMENT RECORDS</Text>
          
          {props.progressiveAssessments && props.progressiveAssessments.length > 0 ? (
            <View style={styles.progressiveTable}>
              {/* Header Row */}
              <View style={styles.progressiveHeaderRow}>
                <Text style={[styles.progressiveHeaderCell, styles.assessmentNameCell]}>ASSESSMENT</Text>
                
                {/* Subject Headers - Using abbreviated subject names */}
                {subjectCodes.map((subject, index) => (
                  <Text 
                    key={`subject-${index}`}
                    style={[styles.progressiveHeaderCell, styles.subjectMarkCell]}
                  >
                    {subject.displayCode}
                  </Text>
                ))}
                
                {/* Summary Headers */}
                <Text style={[styles.progressiveHeaderCell, styles.summaryCell]}>TOTAL</Text>
                <Text style={[styles.progressiveHeaderCell, styles.summaryCell]}>AVG</Text>
                <Text style={[styles.progressiveHeaderCell, styles.summaryCell]}>AGG</Text>
                <Text style={[styles.progressiveHeaderCell, styles.summaryCell]}>DIV</Text>
              </View>
              
              {/* Data Rows */}
              {props.progressiveAssessments.map((assessment, index) => (
                <View key={index} style={[styles.progressiveRow, index % 2 === 1 ? styles.evenRow : {}]}>
                  {/* Assessment Name */}
                  <Text style={[styles.progressiveCell, styles.assessmentNameCell]}>
                    {assessment.name}
                  </Text>
                  
                  {/* Subject Marks */}
                  {subjectCodes.map((subject, subIndex) => {
                    // Find the matching subject in the assessment using multiple strategies
                    let subjectResult;
                    const subjectMatchLog = [];
                    
                    // Try exact match with normalized code
                    subjectResult = assessment.subjects.find(s => 
                      normalizeSubjectCode(s.code) === subject.normalizedCode
                    );
                    
                    if (subjectResult) {
                      subjectMatchLog.push(`Exact match found for ${subject.displayCode} with ${subjectResult.code}`);
                    } else {
                      // Try matching with abbreviation
                      if (subject.abbreviation) {
                        subjectResult = assessment.subjects.find(s => 
                          normalizeSubjectCode(s.code) === normalizeSubjectCode(subject.abbreviation)
                        );
                        
                        if (subjectResult) {
                          subjectMatchLog.push(`Abbreviation match found for ${subject.displayCode} with ${subjectResult.code}`);
                        }
                      }
                      
                      // Try matching with any of the alternative codes
                      if (!subjectResult) {
                        for (const altCode of subject.alternativeCodes) {
                          // Look for exact match first
                          subjectResult = assessment.subjects.find(s_prog => 
                            normalizeSubjectCode(s_prog.code) === altCode
                          );
                          
                          if (subjectResult) {
                            subjectMatchLog.push(`Alternative code exact match found for ${subject.displayCode} with ${subjectResult.code} using ${altCode}`);
                            break;
                          }
                          
                          // Try partial match on codes
                          subjectResult = assessment.subjects.find(s_prog => {
                            const normalizedAssessmentProgCode = normalizeSubjectCode(s_prog.code);
                            return normalizedAssessmentProgCode.includes(altCode) || altCode.includes(normalizedAssessmentProgCode);
                          });
                          
                          if (subjectResult) {
                            subjectMatchLog.push(`Alternative code partial match on codes found for ${subject.displayCode} with ${subjectResult.code} using ${altCode}`);
                            break;
                          }
                        }
                      }
                      
                      // Special handling for Math: if current column is Math, try to find Math in progressive subjects by code or name
                      if (!subjectResult && 
                         (subject.normalizedCode === 'MTC' || subject.normalizedCode === 'MATH' || subject.subjectName.toUpperCase().includes('MATH'))) {
                        subjectMatchLog.push(`Attempting special Math match for column: ${subject.displayCode} (${subject.subjectName})`);
                        subjectResult = assessment.subjects.find(s_prog => {
                          const progNormCode = normalizeSubjectCode(s_prog.code);
                          const progNormName = s_prog.name ? s_prog.name.toUpperCase() : '';

                          const isMatch = progNormCode === 'MTC' || 
                                         progNormCode === 'MATH' || 
                                         progNormCode === 'MATHS' || 
                                         progNormCode === 'MATHEMATICS' || 
                                         progNormName.includes('MATH') || // Check progressive subject's name
                                         progNormName === 'MTC'; // Explicitly check for MTC in name
                          if (isMatch) {
                            subjectMatchLog.push(`Special Math match found: Main column ${subject.displayCode} with Progressive subject ${s_prog.name} (code: ${s_prog.code})`);
                          }
                          return isMatch;
                        });
                      }
                    }
                    
                    // Log the matching process for debugging
                    console.log(`Subject matching for ${subject.displayCode}:`, 
                      subjectMatchLog.length > 0 ? subjectMatchLog : 'No match found');
                    
                    return (
                      <Text 
                        key={`mark-${subIndex}`}
                        style={[styles.progressiveCell, styles.subjectMarkCell]}
                      >
                        {subjectResult ? subjectResult.marks : '-'}
                      </Text>
                    );
                  })}
                  
                  {/* Summary Data */}
                  <Text style={[styles.progressiveCell, styles.summaryCell, { color: '#10B981', fontWeight: 'bold' }]}>
                    {assessment.totalMarks}
                  </Text>
                  <Text style={[styles.progressiveCell, styles.summaryCell, { color: '#10B981', fontWeight: 'bold' }]}>
                    {assessment.average}
                  </Text>
                  <Text style={[styles.progressiveCell, styles.summaryCell, { color: '#10B981', fontWeight: 'bold' }]}>
                    {assessment.totalAggregates}
                  </Text>
                  <Text style={[styles.progressiveCell, styles.summaryCell, { color: '#10B981', fontWeight: 'bold', borderRightWidth: 0 }]}>
                    {assessment.division}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.commentBox, { alignItems: 'center', justifyContent: 'center', padding: 10 }]}>
              <Text style={{ fontSize: 9, color: '#718096' }}>No progressive assessment records available</Text>
            </View>
          )}
        </View>

        {/* Comments Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COMMENTS</Text>
          
          {/* Class Teacher's Comment */}
          <View style={styles.commentBox}>
            <View style={styles.commentRow}>
              <View style={styles.commentLabelContainer}>
                <Text style={styles.commentLabel}>CLASS TEACHER'S COMMENT:</Text>
              </View>
              <View style={styles.commentTextContainer}>
                <Text style={styles.classTeacherComment}>{props.classTeacherReport || 'No comment provided.'}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={styles.signatureContainer}>
                <View style={styles.signatureLine}></View>
                <Text style={styles.signatureText}>SIGNATURE</Text>
              </View>
            </View>
          </View>
          
          {/* Head Teacher's Comment */}
          <View style={styles.commentBox}>
            <View style={styles.commentRow}>
              <View style={styles.commentLabelContainer}>
                <Text style={styles.commentLabel}>HEAD TEACHER'S COMMENT:</Text>
              </View>
              <View style={styles.commentTextContainer}>
                <Text style={styles.headTeacherComment}>{props.headTeacherReport || 'No comment provided.'}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={styles.signatureContainer}>
                <View style={styles.signatureLine}></View>
                <Text style={styles.signatureText}>SIGNATURE</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Date Section */}
        <View style={styles.dateSection}>
          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>NEXT TERM BEGINS ON:</Text>
            <Text style={styles.dateValue}>{props.nextTermBeginsOn || 'TBA'}</Text>
          </View>
          
          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>NEXT TERM ENDS ON:</Text>
            <Text style={styles.dateValue}>{props.nextTermEndsOn || 'TBA'}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={{ fontSize: 7 }}>Generated by Trinity Family School • {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
};

// Create the viewer component
export const PupilReportCardPDF2Viewer: React.FC<PupilReportCardProps> = (props) => {
  return (
    <PDFViewer width="100%" height="600px">
      <TerminalReport {...props} />
    </PDFViewer>
  );
};

// Add default export
export default TerminalReport; 