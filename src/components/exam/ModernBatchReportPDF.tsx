import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { Document, Page } from '@react-pdf/renderer';
import { ModernPupilReportCardPDF } from './ModernPupilReportPDF';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';

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
  nextTermInfo?: {
    startDate: string;
    endDate: string;
  };
  classTeacherInfo?: {
    name: string;
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

// Helper function to calculate age from date of birth
const calculateAge = (dateOfBirth?: string): number => {
  if (!dateOfBirth) return 12; // Default age
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Enhanced dynamic commentary system with division-based comments
const DYNAMIC_COMMENTS = {
  class_teacher: {
    // Division I - Outstanding (Aggregate 4-12)
    division_I: [
      "I am delighted with this outstanding performance, [Name].",
      "Thank you for your consistent effort and exceptional results, [Name].",
      "[Name], your dedication has produced remarkable outcomes.",
      "I am proud of your exemplary achievement this term, [Name].",
      "Well done on maintaining such a high standard of work, [Name].",
      "Your hard work is clearly reflected in these excellent results, [Name].",
      "Congratulations on achieving such a superb aggregate, [Name].",
      "Your enthusiasm and commitment are truly commendable, [Name].",
      "I appreciate the enthusiasm you bring to every lesson, [Name].",
      "Keep up this brilliant level of performance, [Name].",
      "Your focus and determination have paid off handsomely, [Name].",
      "Thank you for setting such an impressive example for your peers, [Name].",
      "You have demonstrated exceptional mastery of the material, [Name].",
      "Your work ethic has been nothing short of inspiring, [Name].",
      "I value the positive attitude you display every day, [Name].",
      "You consistently exceed our expectations—well done, [Name].",
      "Your achievements this term are a testament to your perseverance, [Name].",
      "Keep up this wonderful momentum, [Name].",
      "I am thrilled by the quality of your contributions in class, [Name].",
      "This level of performance is truly outstanding—congratulations, [Name]!"
    ],
    
    // Division II - Very Good (Aggregate 13-25)
    division_II: [
      "Well done on this commendable performance, [Name].",
      "Your hard work is paying off nicely, [Name].",
      "[Name], you have shown good progress this term.",
      "I'm pleased with your steady improvement, [Name].",
      "Keep up the good work, [Name]—you're on the right track.",
      "Your effort and dedication are evident in these results, [Name].",
      "Good job, [Name]! Continue working at this pace.",
      "You've demonstrated solid understanding, [Name].",
      "I appreciate your consistent participation, [Name].",
      "Your performance shows promise, [Name].",
      "Well done, [Name]—maintain this level of effort.",
      "You're making good progress, [Name]. Keep it up!",
      "Your results reflect your commitment, [Name].",
      "Good work this term, [Name]. Stay focused!",
      "You've shown good improvement, [Name].",
      "I'm encouraged by your performance, [Name].",
      "[Name], your steady progress is commendable.",
      "Keep working hard, [Name]—it's paying off.",
      "Your dedication is showing positive results, [Name].",
      "Well done, [Name]. Continue with the same energy!"
    ],
    
    // Division III - Satisfactory (Aggregate 26-30)
    division_III: [
      "[Name], you have the potential to do better.",
      "More focus is needed to improve your performance, [Name].",
      "Work harder next term to achieve better results, [Name].",
      "[Name], I know you can perform better with more effort.",
      "Put in more effort to reach your full potential, [Name].",
      "With increased dedication, you can improve, [Name].",
      "[Name], focus more on your studies for better results.",
      "I encourage you to work harder next term, [Name].",
      "Your performance can improve with more effort, [Name].",
      "[Name], strive for better results next term.",
      "More commitment is needed for improvement, [Name].",
      "Work consistently to see better outcomes, [Name].",
      "[Name], your potential is higher than these results show.",
      "Apply yourself more for better performance, [Name].",
      "With determination, you can achieve more, [Name].",
      "[Name], focus on areas that need improvement.",
      "More regular study habits will help, [Name].",
      "I believe you can do better with effort, [Name].",
      "[Name], work on strengthening your weak areas.",
      "Consistent effort will lead to improvement, [Name]."
    ],
    
    // Division IV & U - Needs Improvement (Aggregate 31+)
    division_IV_U: [
      "[Name], significant improvement is needed in your studies.",
      "Please seek extra help to improve your performance, [Name].",
      "[Name], more dedicated effort is urgently required.",
      "I recommend additional support for [Name] next term.",
      "[Name], focus seriously on your academics.",
      "Extra attention and effort are needed, [Name].",
      "[Name], please take your studies more seriously.",
      "Seek help from teachers and parents, [Name].",
      "[Name], significant changes in study habits are needed.",
      "More time and effort must be devoted to studies, [Name].",
      "[Name], please utilize available academic support.",
      "Consistent daily study is essential, [Name].",
      "[Name], work closely with teachers for improvement.",
      "Regular revision and practice are crucial, [Name].",
      "[Name], don't hesitate to ask for help when needed.",
      "Form good study partnerships with classmates, [Name].",
      "[Name], create a structured study schedule.",
      "Please attend extra lessons if available, [Name].",
      "[Name], your academic success requires immediate attention.",
      "Work with your parents to create a study plan, [Name]."
    ]
  },
  
  head_teacher: {
    // Division I - Outstanding (Aggregate 4-12)
    division_I: [
      "Congratulations on this outstanding achievement, [Name].",
      "Your dedication has produced superb results, [Name].",
      "Well done on maintaining such a high standard of work, [Name].",
      "Your hard work shines through these excellent results, [Name].",
      "I'm proud of your exemplary performance this term, [Name].",
      "You've set a wonderful example for your classmates, [Name].",
      "Such consistent excellence is truly impressive, [Name].",
      "Keep up this brilliant level of achievement, [Name].",
      "Your focus and perseverance have paid off handsomely, [Name].",
      "I appreciate the enthusiasm you bring to every lesson, [Name].",
      "Your mastery of the material is outstanding, [Name].",
      "You've exceeded all expectations—congratulations, [Name]!",
      "Exceptional work like this deserves to be celebrated, [Name].",
      "Your commitment to learning is admirable, [Name].",
      "This level of success reflects your hard work, [Name].",
      "Your results are a testament to your effort, [Name].",
      "I'm thrilled by the quality of your contributions, [Name].",
      "Keep riding this wave of excellence, [Name].",
      "You've raised the bar for yourself this term, [Name].",
      "Fantastic performance—keep it going, [Name]!"
    ],
    
    // Division II - Very Good (Aggregate 13-25)
    division_II: [
      "Good work, [Name]. Continue with this positive trend.",
      "Your performance shows steady improvement, [Name].",
      "Well done, [Name]. Keep up the momentum!",
      "I'm pleased with your consistent effort, [Name].",
      "[Name], your dedication is reflected in these results.",
      "Good job this term, [Name]. Stay focused!",
      "Your hard work is beginning to pay off, [Name].",
      "[Name], continue working with this determination.",
      "You're making good progress, [Name]. Well done!",
      "Keep up the good work, [Name].",
      "Your efforts are showing positive results, [Name].",
      "[Name], maintain this level of commitment.",
      "Good performance, [Name]. Aim even higher!",
      "Your consistency is commendable, [Name].",
      "[Name], you're on the right path to success.",
      "Well done, [Name]. Keep pushing forward!",
      "Your improvement is evident, [Name].",
      "[Name], continue with this positive attitude.",
      "Good work, [Name]. Strive for excellence!",
      "Your dedication is paying off, [Name]."
    ],
    
    // Division III - Satisfactory (Aggregate 26-30)
    division_III: [
      "[Name], there's room for improvement in your performance.",
      "Work harder next term to achieve better results, [Name].",
      "[Name], I know you have the potential to do better.",
      "More consistent effort is needed, [Name].",
      "[Name], focus on improving your weak subjects.",
      "Seek additional help where needed, [Name].",
      "[Name], your performance needs enhancement.",
      "Put in extra effort to reach your potential, [Name].",
      "[Name], work more consistently for better outcomes.",
      "I expect improved performance next term, [Name].",
      "[Name], dedicate more time to your studies.",
      "Work on developing better study habits, [Name].",
      "[Name], strive for higher achievement.",
      "More focused effort will yield better results, [Name].",
      "[Name], take advantage of available academic support.",
      "Improve your time management skills, [Name].",
      "[Name], work closely with your teachers.",
      "Set higher academic goals for yourself, [Name].",
      "[Name], your results don't reflect your true ability.",
      "Apply yourself more seriously to your studies, [Name]."
    ],
    
    // Division IV & U - Needs Improvement (Aggregate 31+)
    division_IV_U: [
      "[Name], immediate improvement in academics is required.",
      "Serious academic intervention is needed for [Name].",
      "[Name], please take urgent steps to improve your performance.",
      "Academic support and counseling are recommended for [Name].",
      "[Name], your current performance is concerning.",
      "Please work closely with parents and teachers, [Name].",
      "[Name], significant changes in approach are needed.",
      "Attend remedial classes to strengthen your foundation, [Name].",
      "[Name], seek immediate academic assistance.",
      "Your academic progress requires urgent attention, [Name].",
      "[Name], develop a comprehensive improvement plan.",
      "Regular monitoring and support are essential, [Name].",
      "[Name], utilize all available academic resources.",
      "Please consider repeating challenging subjects, [Name].",
      "[Name], work with a tutor if possible.",
      "Consistent daily effort is crucial for improvement, [Name].",
      "[Name], don't lose hope—improvement is possible.",
      "Seek guidance from senior students and mentors, [Name].",
      "[Name], your academic future depends on immediate action.",
      "Create a structured study environment at home, [Name]."
    ]
  }
};

// Helper function to determine division category for comments
const getDivisionCategory = (division: string): string => {
  switch (division) {
    case 'I':
      return 'division_I';
    case 'II':
      return 'division_II';
    case 'III':
      return 'division_III';
    case 'IV':
    case 'U':
      return 'division_IV_U';
    default:
      return 'division_III'; // Default to satisfactory
  }
};

// Helper function to convert name to proper case (first letter capitalized, rest lowercase)
const toProperCase = (name: string): string => {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

// Helper function to substitute name placeholders
const substituteName = (comment: string, name: string): string => {
  const properCaseName = toProperCase(name);
  return comment.replace(/\[Name\]/g, properCaseName);
};

// Helper function to get a random comment from array
const getRandomComment = (comments: string[]): string => {
  const randomIndex = Math.floor(Math.random() * comments.length);
  return comments[randomIndex];
};

// Enhanced function to generate teacher reports with dynamic comments
const generateTeacherReports = (result: ExamResult, examTitle: string) => {
  const divisionCategory = getDivisionCategory(result.division);
  
  // Generate class teacher report
  const classTeacherComments = DYNAMIC_COMMENTS.class_teacher[divisionCategory as keyof typeof DYNAMIC_COMMENTS.class_teacher] || DYNAMIC_COMMENTS.class_teacher.division_III;
  const randomClassComment = getRandomComment(classTeacherComments);
  const classTeacherReport = substituteName(randomClassComment, result.pupilInfo.name);
  
  // Generate head teacher report
  const headTeacherComments = DYNAMIC_COMMENTS.head_teacher[divisionCategory as keyof typeof DYNAMIC_COMMENTS.head_teacher] || DYNAMIC_COMMENTS.head_teacher.division_III;
  const randomHeadComment = getRandomComment(headTeacherComments);
  const headTeacherReport = substituteName(randomHeadComment, result.pupilInfo.name);
  
  return { classTeacherReport, headTeacherReport };
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
    classTeacherInfo
  } = props;

  // Helper function to generate QR code data URL
  const generateQRCodeDataURL = async (data: string): Promise<string> => {
    try {
      const QRCode = (await import('qrcode')).default;
      
      // Generate a highly readable QR code with large particles
      const qrDataURL = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'L', // Low error correction for larger particles
        margin: 3, // Good margin for scanner recognition
        scale: 25, // Extra high scale for very large, readable particles
        width: 1000, // Very large width for maximum particle detail
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
  
  // Generate QR codes for all pupils with simplified data for better readability
  const pupilQRCodes = await Promise.all(
    processedResults.map(async (result) => {
      const age = calculateAge(result.pupilInfo.dateOfBirth);
      
      const qrData = `Name: ${result.pupilInfo.name}
Class: ${classSnap.name}
Age: ${age} years
PIN: ${result.pupilInfo.admissionNumber || 'N/A'}
Year: ${examDetails.academicYearName || new Date().getFullYear().toString()}
Term: ${examDetails.termName || 'TERM'}
Exam: ${examDetails.name}
Total Aggregates: ${result.totalAggregates}
Division: ${result.division}
Date: ${new Date().toLocaleDateString()}`;
      
      const qrCodeDataURL = await generateQRCodeDataURL(qrData);
      return { pupilId: result.pupilInfo.pupilId, qrCodeDataURL };
    })
  );

  // Create PDF document with all pupils
  const BatchReportDocument = () => (
    <Document title={`${examDetails.name} - Batch Reports`}>
      {processedResults.map((result, index) => {
        // Convert exam results to subject format expected by the template
        const subjects = subjectSnaps.map(subject => {
          const subjectResult = result.results[subject.code] || { marks: 0, grade: 'F9', aggregates: 9 };
          const isMajor = majorSubjects?.includes(subject.code) || subjectSnaps.length <= 4;
          
          return {
            name: subject.name,
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
        const { classTeacherReport, headTeacherReport } = generateTeacherReports(result, examDetails.name);

        // Calculate age
        const age = calculateAge(result.pupilInfo.dateOfBirth);

        // Find the QR code for this pupil
        const pupilQRCode = pupilQRCodes.find(qr => qr.pupilId === result.pupilInfo.pupilId);

        // Create props for the individual pupil report
        const pupilReportProps = {
          pupilName: result.pupilInfo.name,
          className: classSnap.name,
          year: examDetails.academicYearName || new Date().getFullYear().toString(),
          term: examDetails.termName || 'TERM',
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

        // Debug logging
        console.log(`PDF Debug - Pupil: ${result.pupilInfo.name}, Total Marks: ${result.totalMarks}, Total Aggregates: ${result.totalAggregates}, Division: ${result.division}`);

        return (
          <Page key={result.pupilInfo.pupilId} size="A4">
            <ModernPupilReportCardPDF {...pupilReportProps} />
          </Page>
        );
      })}
    </Document>
  );

  try {
    // Generate PDF blob
    const blob = await pdf(BatchReportDocument()).toBlob();
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${examDetails.name.replace(/\s+/g, '_')}_Modern_Batch_Reports.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error generating batch report PDF:', error);
    throw error;
  }
};

export default generateModernBatchReportPDF; 