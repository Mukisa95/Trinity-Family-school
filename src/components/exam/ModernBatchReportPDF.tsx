import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { Document, Page } from '@react-pdf/renderer';
import { ModernPupilReportCardPDF } from './ModernPupilReportPDF';
import { TransPupilReportCardPDF } from './TransPupilReportPDF';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';
import { cleanSubjectName } from '@/lib/utils/html-entities';
import { formatTermName, calculateAccurateAge } from '@/lib/utils/term-formatter';
import { calculatePromotionStatus } from '@/lib/utils/promotion-ranking';
import { AggregateCommentPicker } from '@/lib/exam-report-commentary';

interface ExamResult {
  pupilInfo: {
    name: string;
    admissionNumber: string;
    pupilId: string;
    age?: number;
    photo?: string;
    dateOfBirth?: string;
    schoolPayCode?: string;
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
  teacherName?: string; // Added for teacher initials generation
}

interface ModernBatchReportProps {
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
  comparisonExams?: Array<{
    name: string;
    examTypeName: string;
    startDate: string;
    endDate: string;
  }>;
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
  isProgressReport?: boolean;
  nextTermInfo?: {
    startDate: string;
    endDate: string;
  };
  classTeacherInfo?: {
    name: string;
  };
  promotionRankingConfig?: {
    enabled: boolean;
    ranges: {
      promoted: { min: number; max: number };
      probation: { min: number; max: number };
      repeat: { min: number; max: number };
    };
  };
  reportConfig?: {
    pupilAge: { show: boolean; fill: boolean };
    className: { show: boolean; fill: boolean };
    pin: { show: boolean; fill: boolean };
    year: { show: boolean; fill: boolean };
    term: { show: boolean; fill: boolean };
    promoted: { show: boolean; fill: boolean };
    schoolPayCode: { show: boolean; fill: boolean };
    createdOn: { show: boolean; fill: boolean; useCustom?: boolean };
    nextTermBegins: { show: boolean; fill: boolean; useCustom?: boolean };
    nextTermEnds: { show: boolean; fill: boolean; useCustom?: boolean };
  };
  customDates?: {
    createdOn?: string;
    nextTermBegins?: string;
    nextTermEnds?: string;
  };
}

// Helper function to generate remarks based on marks (not grade)
const generateRemarks = (marks: number): string => {
  if (marks >= 95) return 'EXCELLENT';
  if (marks >= 80) return 'VERY GOOD';
  if (marks >= 70) return 'GOOD';
  if (marks >= 60) return 'FAIR GOOD';
  if (marks >= 45) return 'TRIED';
  return 'NEEDS IMPROVEMENT'; // 0-44
};

// Helper function to generate teacher initials from full name
const generateTeacherInitials = (teacherName: string): string => {
  if (!teacherName || teacherName.trim() === '') return 'T.I.';
  
  return teacherName
    .trim()
    .split(' ')
    .filter(name => name.length > 0) // Remove empty strings
    .map(name => name.charAt(0).toUpperCase())
    .join('.');
};

// Helper function to calculate age from date of birth using exam date
const calculateAge = (dateOfBirth?: string, examDate?: string, ageAtExam?: number): number => {
  // If ageAtExam is already provided and valid, use it
  if (ageAtExam && ageAtExam > 0 && ageAtExam < 100) {
    return ageAtExam;
  }
  
  // Otherwise calculate from date of birth
  try {
    return calculateAccurateAge(dateOfBirth, examDate || new Date());
  } catch (error) {
    // As last resort, if we have a date of birth string, try simple year subtraction
    if (dateOfBirth) {
      const year = parseInt(dateOfBirth.substring(0, 4));
      if (year > 1900 && year < 2030) {
        const refYear = examDate ? new Date(examDate).getFullYear() : new Date().getFullYear();
        const simpleAge = refYear - year;
        return simpleAge > 0 ? simpleAge : 0;
      }
    }
    throw error; // Re-throw if all methods fail
  }
};

// Aggregate-based teacher reports shared with Commentary Box ranges
const generateTeacherReports = (result: ExamResult, _examTitle: string, picker: AggregateCommentPicker) => {
  const classTeacherReport = picker.classTeacher(result.pupilInfo.name, result.totalAggregates);
  const headTeacherReport = picker.headTeacher(result.pupilInfo.name, result.totalAggregates);
  return { classTeacherReport, headTeacherReport };
};

export const globalQRCodeCache = new Map<string, string>();

export const preGenerateQRCodesForBatch = async (
  results: any[],
  examDetails: any,
  classSnap: any
): Promise<void> => {
  if (!results || !examDetails || !classSnap) return;
  for (const result of results) {
    if (!result?.pupilInfo?.pupilId) continue;
    const cacheKey = `${examDetails.name}-${result.pupilInfo.pupilId}-${result.totalAggregates}`;
    if (globalQRCodeCache.has(cacheKey)) continue;
    try {
      const age = calculateAge(result.pupilInfo.dateOfBirth, examDetails.startDate, result.pupilInfo.ageAtExam);
      const qrData = `Name: ${result.pupilInfo.name}\nClass: ${classSnap.name}\nAge: ${age} years\nPIN: ${result.pupilInfo.admissionNumber || 'N/A'}\nYear: ${examDetails.academicYearName || new Date().getFullYear().toString()}\nTerm: ${examDetails.termName || 'TERM'}\nAggregates: ${result.totalAggregates || 'N/A'}\nDivision: ${result.division || 'N/A'}`;
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'L',
        margin: 1,
        width: 100
      });
      globalQRCodeCache.set(cacheKey, qrCodeDataURL);
    } catch {
      // Ignore background generation errors
    }
  }
};

export const generateModernBatchReportPDF = async (props: ModernBatchReportProps) => {
  const { 
    examDetails, 
    classSnap, 
    subjectSnaps, 
    processedResults, 
    schoolSettings, 
    majorSubjects,
    gradingScale,
    nextTermInfo,
    classTeacherInfo,
    promotionRankingConfig,
    onProgress
  } = props;

  // Helper function to generate QR code data URL - OPTIMIZED for speed
  const generateQRCodeDataURL = async (data: string): Promise<string> => {
    try {
      const QRCode = (await import('qrcode')).default;
      
      // 🚀 OPTIMIZED: Reduced resolution for faster generation while maintaining readability
      // Scale 8 and width 400 is sufficient for PDF printing and much faster
      const qrDataURL = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'L', // Low error correction for faster generation
        margin: 2, // Reduced margin for faster processing
        scale: 8, // Reduced from 25 - still high quality but much faster
        width: 400, // Reduced from 1000 - sufficient for PDF printing
        color: {
          dark: '#000000FF',
          light: '#FFFFFFFF'
        }
      });
      
      return qrDataURL;
    } catch (error) {
      console.error('QR code generation error:', error);
      return '';
    }
  };

  // Extract school information from settings
  const schoolInfo = {
    name: schoolSettings?.generalInfo?.name || 'School Name',
    logo: schoolSettings?.generalInfo?.logo || '',
    physicalAddress: schoolSettings?.generalInfo?.physicalAddress || 
                    schoolSettings?.address?.physical || '',
    postalAddress: schoolSettings?.generalInfo?.postalAddress || 
                  schoolSettings?.address?.postal || '',
    poBox: schoolSettings?.address?.poBox || '',
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

  // Default grading scale if not provided - use the same as constants
  const defaultGradingScale = DEFAULT_GRADING_SCALE.map(item => ({
    minMark: item.minMark,
    maxMark: item.maxMark,
    grade: item.grade,
    aggregates: item.aggregates || 9
  }));

  const actualGradingScale = gradingScale || defaultGradingScale;
  
  // 🚀 OPTIMIZED: Generate QR codes in batches with progress tracking
  // This prevents browser freezing and allows for better performance
  const generateQRCodesInBatches = async (
    results: typeof processedResults,
    batchSize: number = 10,
    onProgress?: (current: number, total: number) => void
  ): Promise<Array<{ pupilId: string; qrCodeDataURL: string }>> => {
    const pupilQRCodes: Array<{ pupilId: string; qrCodeDataURL: string }> = [];
    const total = results.length;
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      // Generate QR codes for this batch in parallel
      const batchQRCodes = await Promise.all(
        batch.map(async (result) => {
          const cacheKey = `${examDetails.name}-${result.pupilInfo.pupilId}-${result.totalAggregates}`;
          if (globalQRCodeCache.has(cacheKey)) {
            return { pupilId: result.pupilInfo.pupilId, qrCodeDataURL: globalQRCodeCache.get(cacheKey)! };
          }
          const age = calculateAge(result.pupilInfo.dateOfBirth, examDetails.startDate, result.pupilInfo.ageAtExam);
          const qrData = `Name: ${result.pupilInfo.name}
Class: ${classSnap.name}
Age: ${age} years
PIN: ${result.pupilInfo.admissionNumber || 'N/A'}
Year: ${examDetails.academicYearName || new Date().getFullYear().toString()}
Term: ${formatTermName(examDetails.termName || 'TERM')}
Exam: ${examDetails.name}
Total Aggregates: ${result.totalAggregates}
Division: ${result.division}
Date: ${new Date().toLocaleDateString()}`;
          const qrCodeDataURL = await generateQRCodeDataURL(qrData);
          globalQRCodeCache.set(cacheKey, qrCodeDataURL);
          return { pupilId: result.pupilInfo.pupilId, qrCodeDataURL };
        })
      );
      
      pupilQRCodes.push(...batchQRCodes);
      
      // Report progress if callback provided
      if (onProgress) {
        onProgress(Math.min(i + batchSize, total), total);
      }
      
      // Small delay between batches to prevent browser freezing
      if (i + batchSize < results.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return pupilQRCodes;
  };
  
  // Generate QR codes with progress tracking
  const totalPupils = processedResults.length;
  const qrCodeProgressWeight = 0.3; // QR codes take ~30% of total time
  
  if (onProgress) {
    onProgress(0, `Generating QR codes for ${totalPupils} pupils...`);
  }
  
  const pupilQRCodes = await generateQRCodesInBatches(
    processedResults,
    10, // Process 10 QR codes at a time
    (current, total) => {
      const progress = Math.round((current / total) * 100 * qrCodeProgressWeight);
      if (onProgress) {
        onProgress(progress, `Generating QR codes: ${current}/${total} (${Math.round((current / total) * 100)}%)`);
      }
      if (process.env.NODE_ENV === 'development') {
        console.log(`QR Code Progress: ${current}/${total} (${Math.round((current / total) * 100)}%)`);
      }
    }
  );
  
  if (onProgress) {
    onProgress(30, 'QR codes generated. Creating PDF document...');
  }

  const commentPicker = new AggregateCommentPicker();

  // Create PDF document with all pupils
  const BatchReportDocument = () => (
    <Document title={`${examDetails.name} - Batch Reports`}>
      {processedResults.map((result, index) => {
        // Convert exam results to subject format expected by the template
        const subjects = subjectSnaps.map(subject => {
          const subjectResult = result.results[subject.code] || { marks: 0, grade: 'F9', aggregates: 9 };
          const isMajor = majorSubjects?.includes(subject.code) || subjectSnaps.length <= 4;
          
          return {
            name: cleanSubjectName(subject.name),
            code: subject.code,
            fullMarks: subject.fullMarks || 100,
            marksGained: subjectResult.marks,
            grade: subjectResult.grade,
            aggregates: subjectResult.aggregates,
            remarks: generateRemarks(subjectResult.marks), // Use marks instead of grade
            teacherInitials: generateTeacherInitials(subject.teacherName || ''), // Generate from teacher name
            isMajorSubject: isMajor
          };
        });

        // Generate teacher reports
        const { classTeacherReport, headTeacherReport } = generateTeacherReports(result, examDetails.name, commentPicker);

        // Calculate age based on exam date
        const age = calculateAge(result.pupilInfo.dateOfBirth, examDetails.startDate);

        // Find the QR code for this pupil
        const pupilQRCode = pupilQRCodes.find(qr => qr.pupilId === result.pupilInfo.pupilId);

        // Create props for the individual pupil report
        const pupilReportProps = {
          pupilName: result.pupilInfo.name,
          className: classSnap.name,
          classCode: classSnap.code, // Pass class code for compact display
          year: examDetails.academicYearName || new Date().getFullYear().toString(),
          term: formatTermName(examDetails.termName || 'TERM'),
          age: age,
          date: new Date().toLocaleDateString(),
          position: result.position,
          totalPupils: processedResults.length,
          pupilIdentificationNumber: result.pupilInfo.admissionNumber,
          subjects: subjects,
          classTeacherReport: classTeacherReport,
          headTeacherReport: headTeacherReport,
          nextTermBegins: nextTermInfo?.startDate ? new Date(nextTermInfo.startDate).toLocaleDateString() : 'TBA',
          nextTermEnds: nextTermInfo?.endDate ? new Date(nextTermInfo.endDate).toLocaleDateString() : 'TBA',
          pupilPhoto: result.pupilInfo.photo,
          schoolLogo: schoolInfo.logo,
          schoolName: schoolInfo.name,
          schoolPhysicalAddress: schoolInfo.physicalAddress,
          schoolPostalAddress: schoolInfo.postalAddress || schoolInfo.poBox,
          schoolPhone: schoolInfo.phone,
          examTypeName: examDetails.examTypeName, // Added for dynamic report heading
          schoolAltPhone: schoolInfo.altPhone,
          schoolEmail: schoolInfo.email,
          schoolMotto: schoolInfo.motto,
          schoolCity: schoolInfo.city,
          schoolCountry: schoolInfo.country,
          gradingScale: actualGradingScale,
          totalMarks: result.totalMarks,
          totalAggregates: result.totalAggregates,
          division: result.division,
          examTitle: examDetails.name,
          classTeacherName: classTeacherInfo?.name,
          promotionStatus: result.division === 'I' || result.division === 'II' ? 'PROMOTED' : 
                          result.division === 'III' ? 'PROMOTED ON PROBATION' : 'REPEAT',
          promotionRanking: promotionRankingConfig ? calculatePromotionStatus(
            result.totalAggregates,
            promotionRankingConfig,
            classSnap.code
          ) : null,
          examSnapshot: {
            academicYearId: examDetails.academicYearId || new Date().getFullYear().toString(),
            termId: examDetails.termId || 'TERM'
          },
          majorSubjects: majorSubjects,
          // Additional props for QR code generation
          pupilDateOfBirth: result.pupilInfo.dateOfBirth,
          pupilGender: 'N/A', // Not available in current data structure
          pupilRegistrationDate: 'N/A', // Not available in current data structure  
          emergencyContactPhone: 'N/A', // Not available in current data structure
          qrCodeDataURL: pupilQRCode?.qrCodeDataURL || '' // Pass the generated QR code
        };

        return (
          <Page key={result.pupilInfo.pupilId} size="A4">
            <ModernPupilReportCardPDF {...pupilReportProps} />
          </Page>
        );
      })}
    </Document>
  );

  try {
    if (onProgress) {
      onProgress(70, 'Rendering PDF pages...');
    }
    
    // Yield to browser main thread so UI progress bar updates before heavy PDF serialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Generate PDF blob
    const blob = await pdf(BatchReportDocument()).toBlob();
    
    if (onProgress) {
      onProgress(100, 'PDF generation complete!');
    }
    
    // Return blob instead of downloading
    return blob;
  } catch (error) {
    console.error('Error generating batch report PDF:', error);
    if (onProgress) {
      onProgress(0, 'Error generating PDF');
    }
    throw error;
  }
};

// TRANS Batch Report Generator - Enhanced design version
export const generateTransBatchReportPDF = async (props: ModernBatchReportProps) => {
  const { 
    examDetails, 
    comparisonExams,
    classSnap, 
    subjectSnaps, 
    processedResults, 
    schoolSettings, 
    majorSubjects,
    gradingScale,
    isProgressReport = false,
    nextTermInfo,
    classTeacherInfo,
    promotionRankingConfig,
    reportConfig,
    onProgress
  } = props;

  // Helper function to generate QR code data URL - OPTIMIZED for speed
  const generateQRCodeDataURL = async (data: string): Promise<string> => {
    try {
      const QRCode = (await import('qrcode')).default;
      
      // 🚀 OPTIMIZED: Reduced resolution for faster generation while maintaining readability
      const qrDataURL = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'L',
        margin: 2, // Reduced margin
        scale: 8, // Reduced from 25 - still high quality but much faster
        width: 400, // Reduced from 1000 - sufficient for PDF printing
        color: {
          dark: '#000000FF',
          light: '#FFFFFFFF'
        }
      });
      
      return qrDataURL;
    } catch (error) {
      console.error('QR code generation error:', error);
      return '';
    }
  };

  // Extract school information from settings
  const schoolInfo = {
    name: schoolSettings?.generalInfo?.name || 'School Name',
    logo: schoolSettings?.generalInfo?.logo || '',
    physicalAddress: schoolSettings?.generalInfo?.physicalAddress || 
                    schoolSettings?.address?.physical || '',
    postalAddress: schoolSettings?.generalInfo?.postalAddress || 
                  schoolSettings?.address?.postal || '',
    poBox: schoolSettings?.address?.poBox || '',
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

  // Default grading scale if not provided
  const defaultGradingScale = DEFAULT_GRADING_SCALE.map(item => ({
    minMark: item.minMark,
    maxMark: item.maxMark,
    grade: item.grade,
    aggregates: item.aggregates || 9
  }));

  const actualGradingScale = gradingScale || defaultGradingScale;
  
  // 🚀 OPTIMIZED: Generate QR codes in batches for TRANS reports
  const generateQRCodesInBatchesTrans = async (
    results: typeof processedResults,
    batchSize: number = 10,
    onProgress?: (current: number, total: number) => void
  ): Promise<Array<{ pupilId: string; qrCodeDataURL: string }>> => {
    const pupilQRCodes: Array<{ pupilId: string; qrCodeDataURL: string }> = [];
    const total = results.length;
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      // Generate QR codes for this batch in parallel
      const batchQRCodes = await Promise.all(
        batch.map(async (result) => {
          const cacheKey = `${examDetails.name}-${result.pupilInfo.pupilId}-${result.totalAggregates}`;
          if (globalQRCodeCache.has(cacheKey)) {
            return { pupilId: result.pupilInfo.pupilId, qrCodeDataURL: globalQRCodeCache.get(cacheKey)! };
          }
          const age = calculateAge(result.pupilInfo.dateOfBirth, examDetails.startDate, result.pupilInfo.ageAtExam);
          const qrData = `Name: ${result.pupilInfo.name}
Class: ${classSnap.name}
Age: ${age} years
PIN: ${result.pupilInfo.admissionNumber || 'N/A'}
Year: ${examDetails.academicYearName || new Date().getFullYear().toString()}
Term: ${formatTermName(examDetails.termName || 'TERM')}
Exam: ${examDetails.name}
Total Aggregates: ${result.totalAggregates}
Division: ${result.division}
Date: ${new Date().toLocaleDateString()}`;
          const qrCodeDataURL = await generateQRCodeDataURL(qrData);
          globalQRCodeCache.set(cacheKey, qrCodeDataURL);
          return { pupilId: result.pupilInfo.pupilId, qrCodeDataURL };
        })
      );
      
      pupilQRCodes.push(...batchQRCodes);
      
      // Report progress if callback provided
      if (onProgress) {
        onProgress(Math.min(i + batchSize, total), total);
      }
      
      // Small delay between batches to prevent browser freezing
      if (i + batchSize < results.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return pupilQRCodes;
  };
  
  // Generate QR codes with progress tracking
  const totalPupils = processedResults.length;
  const qrCodeProgressWeight = 0.3; // QR codes take ~30% of total time
  
  if (onProgress) {
    onProgress(0, `Generating QR codes for ${totalPupils} pupils...`);
  }
  
  const pupilQRCodes = await generateQRCodesInBatchesTrans(
    processedResults,
    10, // Process 10 QR codes at a time
    (current, total) => {
      const progress = Math.round((current / total) * 100 * qrCodeProgressWeight);
      if (onProgress) {
        onProgress(progress, `Generating QR codes: ${current}/${total} (${Math.round((current / total) * 100)}%)`);
      }
      if (process.env.NODE_ENV === 'development') {
        console.log(`TRANS QR Code Progress: ${current}/${total} (${Math.round((current / total) * 100)}%)`);
      }
    }
  );
  
  if (onProgress) {
    onProgress(30, 'QR codes generated. Creating PDF document...');
  }

  const transCommentPicker = new AggregateCommentPicker();

  // Create PDF document with all pupils using TRANS design
  const TransBatchReportDocument = () => (
    <Document title={`${examDetails.name} - TRANS Batch Reports`}>
      {processedResults.map((result, index) => {
        // Convert exam results to subject format expected by the template
        const subjects = subjectSnaps.map(subject => {
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

        // Generate teacher reports
        const { classTeacherReport, headTeacherReport } = generateTeacherReports(result, examDetails.name, transCommentPicker);

        // Calculate age based on exam date
        const age = calculateAge(result.pupilInfo.dateOfBirth, examDetails.startDate);

        // Find the QR code for this pupil
        const pupilQRCode = pupilQRCodes.find(qr => qr.pupilId === result.pupilInfo.pupilId);

        // Prepare progress data if this is a progress report
        let progressData = null;
        if (isProgressReport && comparisonExams && comparisonExams.length > 0) {
          const comparisonDataArray = (result as any).comparisonDataArray || [];
          
          // Process each comparison exam (up to 2)
          const comparisonExamsData = comparisonExams.slice(0, 2).map((comparisonExam, index) => {
            const comparisonData = comparisonDataArray[index] || null;
            
            // If pupil exists in comparison exam, use their data; otherwise use empty data
            const comparisonSubjects = comparisonData 
              ? (comparisonData.subjects || []).map((subject: any) => {
                  const subjectResult = comparisonData.results[subject.code] || { marks: 0, grade: 'F9', aggregates: 9 };
                  return {
                    name: cleanSubjectName(subject.name),
                    code: subject.code,
                    fullMarks: 100,
                    marksGained: subjectResult.marks,
                    grade: subjectResult.grade,
                    aggregates: subjectResult.aggregates,
                    remarks: generateRemarks(subjectResult.marks),
                    teacherInitials: generateTeacherInitials(subject.teacherName || ''),
                    isMajorSubject: (majorSubjects || []).includes(subject.code)
                  };
                })
              : [];

            return {
              name: comparisonExam.name || 'Unknown Exam',
              subjects: comparisonSubjects || [],
              totalMarks: comparisonData?.totalMarks ?? '-',
              totalAggregates: comparisonData?.totalAggregates ?? '-',
              division: comparisonData?.division || '-'
            };
          });

          // Get all subject codes from all comparison exams
          const allSubjectCodes = Array.from(new Set(
            comparisonExamsData.flatMap(exam => (exam.subjects || []).map((s: any) => s.code).filter(Boolean))
          ));

          progressData = {
            comparisonExams: comparisonExamsData,
            allSubjectCodes: allSubjectCodes
          };
        }

        // Create props for the individual pupil report
        const pupilReportProps = {
          pupilName: result.pupilInfo.name,
          className: classSnap.name,
          classCode: classSnap.code, // Pass class code for compact display
          year: examDetails.academicYearName || new Date().getFullYear().toString(),
          term: formatTermName(examDetails.termName || 'TERM'),
          age: age,
          date: new Date().toLocaleDateString(),
          position: result.position,
          totalPupils: processedResults.length,
          pupilIdentificationNumber: result.pupilInfo.admissionNumber,
          subjects: subjects,
          classTeacherReport: classTeacherReport,
          headTeacherReport: headTeacherReport,
          nextTermBegins: nextTermInfo?.startDate ? new Date(nextTermInfo.startDate).toLocaleDateString() : 'TBA',
          nextTermEnds: nextTermInfo?.endDate ? new Date(nextTermInfo.endDate).toLocaleDateString() : 'TBA',
          pupilPhoto: result.pupilInfo.photo,
          schoolLogo: schoolInfo.logo,
          schoolName: schoolInfo.name,
          schoolPhysicalAddress: schoolInfo.physicalAddress,
          schoolPostalAddress: schoolInfo.postalAddress || schoolInfo.poBox,
          schoolPhone: schoolInfo.phone,
          examTypeName: examDetails.examTypeName,
          schoolAltPhone: schoolInfo.altPhone,
          schoolEmail: schoolInfo.email,
          schoolMotto: schoolInfo.motto,
          schoolCity: schoolInfo.city,
          schoolCountry: schoolInfo.country,
          gradingScale: isProgressReport ? undefined : actualGradingScale,
          isProgressReport: isProgressReport,
          progressData: progressData,
          totalMarks: result.totalMarks,
          totalAggregates: result.totalAggregates,
          division: result.division,
          examTitle: examDetails.name,
          classTeacherName: classTeacherInfo?.name,
          promotionStatus: result.division === 'I' || result.division === 'II' ? 'PROMOTED' : 
                          result.division === 'III' ? 'PROMOTED ON PROBATION' : 'REPEAT',
          promotionRanking: promotionRankingConfig ? calculatePromotionStatus(
            result.totalAggregates,
            promotionRankingConfig,
            classSnap.code
          ) : null,
          examSnapshot: {
            academicYearId: examDetails.academicYearId || new Date().getFullYear().toString(),
            termId: examDetails.termId || 'TERM'
          },
          majorSubjects: majorSubjects,
          pupilDateOfBirth: result.pupilInfo.dateOfBirth,
          pupilGender: 'N/A',
          pupilRegistrationDate: 'N/A',
          emergencyContactPhone: 'N/A',
          qrCodeDataURL: pupilQRCode?.qrCodeDataURL || '',
          schoolPayCode: result.pupilInfo.schoolPayCode || '',
          reportConfig: reportConfig,
          customDates: props.customDates
        };

        return (
          <Page key={result.pupilInfo.pupilId} size="A4">
            <TransPupilReportCardPDF {...pupilReportProps} />
          </Page>
        );
      })}
    </Document>
  );

  try {
    // Yield to browser main thread so UI progress bar updates before heavy PDF serialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Generate PDF blob
    const blob = await pdf(TransBatchReportDocument()).toBlob();
    
    // Return blob instead of downloading
    return blob;
  } catch (error) {
    console.error('Error generating TRANS batch report PDF:', error);
    throw error;
  }
};

export default generateModernBatchReportPDF; 
