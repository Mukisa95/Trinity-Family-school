import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';

// Enhanced dynamic commentary system using Commentary Box logic with specific aggregate ranges
const DYNAMIC_COMMENTS = {
  class_teacher: {
    aggregate_4: [
      "I am delighted with this outstanding performance, [Name].",
      "Thank you for your consistent effort and exceptional results.",
      "[Name], your dedication has produced remarkable outcomes.",
      "I am proud of your exemplary achievement this term.",
      "Well done on maintaining such a high standard of work.",
      "Your hard work is clearly reflected in these excellent results.",
      "Congratulations on achieving such a superb aggregate.",
      "Your enthusiasm and commitment are truly commendable.",
      "I appreciate the enthusiasm you bring to every lesson.",
      "Keep up this brilliant level of performance, [Name].",
      "Your focus and determination have paid off handsomely.",
      "Thank you for setting such an impressive example for your peers.",
      "You have demonstrated exceptional mastery of the material.",
      "Your work ethic has been nothing short of inspiring.",
      "I value the positive attitude you display every day.",
      "You consistently exceed our expectations—well done.",
      "Your achievements this term are a testament to your perseverance.",
      "Keep up this wonderful momentum, [Name].",
      "I am thrilled by the quality of your contributions in class.",
      "This level of performance is truly outstanding—congratulations!"
    ],
    aggregate_5_6: [
      "Thank you, [Name], for your commendable effort this term.",
      "Your work shows real promise—aiming for aggregate 4 is within reach.",
      "Well done on this encouraging performance.",
      "I can see your progress; let's push toward that top grade.",
      "Your dedication is evident—keep striving for aggregate 4.",
      "I appreciate your focus and growing confidence.",
      "You have made good strides; continue to build on this.",
      "This result is promising—keep working hard.",
      "Your determination will help you close the gap to aggregate 4.",
      "Thank you for your steady effort—let's aim higher next term.",
      "You are on the right track; consistency will lead to excellence.",
      "Keep up this positive attitude, [Name].",
      "I encourage you to maintain this level of effort.",
      "You have the ability; continue to challenge yourself.",
      "This performance is solid—strive to make it even stronger.",
      "Your improvement is clear—let's keep the momentum going.",
      "Aim for precision in your work to reach the next level.",
      "I appreciate your willingness to learn and improve.",
      "You are making good progress—let's target aggregate 4 next.",
      "Your effort is commendable; I believe you can do even better."
    ],
    aggregate_7_12: [
      "[Name], your progress this term is encouraging.",
      "I am pleased with the improvement I've seen in your work.",
      "This is good progress—keep building on it.",
      "Thank you for your dedication; continue working hard.",
      "Your steady effort shows real promise.",
      "Well done on this solid performance.",
      "You have demonstrated clear growth—let's keep going.",
      "Your commitment is paying off; maintain this pace.",
      "I appreciate the focus you bring to each lesson.",
      "This result is a step in the right direction.",
      "You're improving; aim to deepen your understanding next term.",
      "Keep up your positive attitude toward learning.",
      "Your hard work is beginning to yield results.",
      "Thank you for striving to do your best every day.",
      "I see real progress—let's work on consistency.",
      "You have great potential; continue to apply yourself.",
      "Stay engaged and ask questions to boost your understanding.",
      "Your perseverance will lead to even better results.",
      "This performance is a foundation—let's build higher.",
      "I'm pleased with your efforts; let's target further improvement."
    ],
    grades_2_3: [
      "[Name], we still expect a lot from you—continue working hard.",
      "I believe in your ability to improve; keep trying.",
      "We have high hopes for you, [Name]. Let's see more effort.",
      "Your potential is clear—focus and determination will help.",
      "You can perform better than this with consistent effort.",
      "Let's work together to raise your achievement.",
      "I encourage you to engage more actively in class.",
      "Keep practicing to strengthen your skills.",
      "You have the ability; believe in yourself and work hard.",
      "I'd like to see you take more initiative in your learning.",
      "Let's set clear goals to boost your performance.",
      "You show promise; focus on improving your weak areas.",
      "Your teachers are here to support your progress.",
      "Let's develop a study plan to help you succeed.",
      "I know you can do better—let's make it happen.",
      "Try to apply feedback more consistently in your work.",
      "Continue to ask questions when you're unsure.",
      "Your attitude can make a big difference—stay positive.",
      "We will work together to help you reach your potential.",
      "Let's aim to see steady improvement next term."
    ],
    grades_4_u: [
      "There is still room for improvement, [Name]. Work harder.",
      "We shall work together to ensure improvement in all subjects.",
      "Let's develop strategies to improve your performance.",
      "Your progress has stalled—let's refocus and try again.",
      "I encourage you to seek extra help where needed.",
      "Let's set realistic goals to guide your improvement.",
      "Please spend more time reviewing your lessons.",
      "Practice and repetition will help you grasp the material.",
      "I am here to support you—let's schedule additional practice.",
      "You can improve with consistent daily effort.",
      "Focus on one subject at a time to build confidence.",
      "Let's track your progress with small, measurable steps.",
      "Try to complete all assignments thoroughly.",
      "Ask for clarification whenever you feel stuck.",
      "A positive attitude will help you overcome challenges.",
      "Persistence will be key to raising your grades.",
      "Let's review past mistakes and learn from them.",
      "I'm confident that targeted practice will yield results.",
      "We'll work together to develop stronger study habits.",
      "Keep trying—your hard work will pay off in due course."
    ]
  },
  head_teacher: {
    aggregate_4: [
      "Congratulations on this outstanding achievement, [Name].",
      "Your dedication has produced superb results.",
      "Well done on maintaining such a high standard of work.",
      "Your hard work shines through these excellent results.",
      "I'm proud of your exemplary performance this term.",
      "You've set a wonderful example for your classmates.",
      "Such consistent excellence is truly impressive.",
      "Keep up this brilliant level of achievement, [Name].",
      "Your focus and perseverance have paid off handsomely.",
      "I appreciate the enthusiasm you bring to every lesson.",
      "Your mastery of the material is outstanding.",
      "You've exceeded all expectations—congratulations!",
      "Exceptional work like this deserves to be celebrated.",
      "Your commitment to learning is admirable.",
      "This level of success reflects your hard work.",
      "Your results are a testament to your effort.",
      "I'm thrilled by the quality of your contributions.",
      "Keep riding this wave of excellence, [Name].",
      "You've raised the bar for yourself this term.",
      "Fantastic performance—keep it going!"
    ],
    aggregate_5_6: [
      "Well done on a commendable performance, [Name].",
      "Your progress is encouraging; aim for aggregate 4 next term.",
      "This result shows real promise—keep striving higher.",
      "You're on the right track; maintain this momentum.",
      "Your growing confidence is reflected in your work.",
      "Continue to refine your skills to reach the next level.",
      "Your determination will help you achieve even more.",
      "Thank you for your steady effort this term.",
      "You have the ability to aim for the top grade.",
      "Keep up this positive attitude toward learning.",
      "Let's push together to reach aggregate 4 soon.",
      "Your effort is clear—let's build on it next term.",
      "I appreciate the focus you bring to each task.",
      "Your work is solid; aim to make it even stronger.",
      "Consistency will take you closer to your goal.",
      "You're improving—let's keep the progress going.",
      "I believe you can achieve aggregate 4 with effort.",
      "Well done; let's set our sights a bit higher.",
      "You're closing the gap—keep pushing forward.",
      "Excellent work so far—let's take it up a notch."
    ],
    aggregate_7_12: [
      "[Name], your improvement this term is very encouraging.",
      "You've made good strides—continue to build on this.",
      "This performance is a solid foundation for growth.",
      "Thank you for your dedication; keep working hard.",
      "Your focus in class is beginning to pay off.",
      "You've shown clear progress—aim for even more next term.",
      "Stay engaged and ask questions to deepen your understanding.",
      "Your steady effort will lead to better results.",
      "Keep this positive momentum going, [Name].",
      "I appreciate the persistence you're showing.",
      "Let's work on consistency to boost your performance.",
      "Your progress is promising—continue to apply yourself.",
      "Well done on this encouraging level of achievement.",
      "You have the potential; let's unlock it together.",
      "Your hard work is beginning to shine through.",
      "Continue to challenge yourself in every subject.",
      "You're on the right path—remain focused.",
      "Small, daily efforts will bring about big gains.",
      "Thank you for rising to the challenge this term.",
      "Use this progress as a springboard to greater success."
    ],
    grades_2_3: [
      "I believe in your ability to achieve better results, [Name].",
      "Let's aim for more consistent effort next term.",
      "You can perform at a higher level with focused practice.",
      "Take initiative in your learning to see real improvement.",
      "Your potential is clear—let's work on strengthening your skills.",
      "Regular revision will help you gain confidence.",
      "I encourage you to seek help whenever you need it.",
      "Let's set clear goals to guide your progress.",
      "Try to apply feedback more consistently in your work.",
      "Your attitude toward learning will shape your success.",
      "You can unlock better results through daily practice.",
      "Focus on tricky areas first to build a stronger foundation.",
      "I'm here to support you—reach out when you feel stuck.",
      "Believe in yourself and the improvements will follow.",
      "We expect more from you; rise to the challenge.",
      "Consistent effort will lead to real growth.",
      "Keep asking questions to clarify your understanding.",
      "Let's establish a study routine that works for you.",
      "Your teachers are ready to help—use their guidance.",
      "I'm confident you can exceed these results next term."
    ],
    grades_4_u: [
      "There is room for significant improvement, [Name]; let's focus on that.",
      "Please engage more actively in every lesson.",
      "A targeted study plan will help raise your grades.",
      "Your current performance needs more consistent effort.",
      "Daily review sessions will strengthen your learning.",
      "Practice fundamentals before moving on to new topics.",
      "You must take greater responsibility for your studies.",
      "Let's check your progress regularly to stay on track.",
      "Persistence and hard work will yield better results.",
      "Ask for clarification whenever a concept is unclear.",
      "Concentrate on one subject at a time for deeper understanding.",
      "I recommend extra practice in your weaker areas.",
      "Developing strong study habits is essential.",
      "I expect to see more effort in your next assessment.",
      "Consistent practice will build your confidence.",
      "Keep trying—your hard work will pay off.",
      "Let's review past mistakes and learn from them.",
      "You have the capacity to improve; please show it.",
      "Stay positive and persistent in your studies.",
      "I anticipate marked improvement next term."
    ]
  }
};

// Helper function to determine commentary category based on total aggregates
const getCommentaryCategory = (totalAggregates: number): string => {
  if (totalAggregates === 4) {
    return 'aggregate_4';
  } else if (totalAggregates >= 5 && totalAggregates <= 6) {
    return 'aggregate_5_6';
  } else if (totalAggregates >= 7 && totalAggregates <= 12) {
    return 'aggregate_7_12';
  } else if (totalAggregates >= 13 && totalAggregates <= 24) {
    return 'grades_2_3'; // Division II and III correspond to Second & Third Grade
  } else {
    return 'grades_4_u'; // Division IV and U correspond to Fourth Grade & U
  }
};

// Helper function to convert name to proper case
const toProperCase = (name: string): string => {
  return name.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
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

// Enhanced function to generate class teacher report with Commentary Box logic
const generateClassTeacherReport = (result: ExamResult): string => {
  const commentaryCategory = getCommentaryCategory(result.totalAggregates);
  const comments = DYNAMIC_COMMENTS.class_teacher[commentaryCategory as keyof typeof DYNAMIC_COMMENTS.class_teacher] || DYNAMIC_COMMENTS.class_teacher.aggregate_7_12;
  const randomComment = getRandomComment(comments);
  return substituteName(randomComment, result.pupilInfo.name);
};

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

// Helper function to calculate age
const calculateAge = (dateOfBirth?: string): number => {
  if (!dateOfBirth) return 12; // Default age like Modern Report
  try {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch {
    return 12; // Default age like Modern Report
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
  // Modern Beautiful Border Styles - positioned EXACTLY 1cm from ALL page edges
  borderContainer: {
    position: 'absolute',
    top: 28,     // EXACTLY 1cm from top page edge
    left: 28,    // EXACTLY 1cm from left page edge  
    right: 28,   // EXACTLY 1cm from right page edge
    bottom: 28,  // EXACTLY 1cm from bottom page edge
    borderWidth: 3,
    borderColor: '#1e40af',
    borderRadius: 12,
    backgroundColor: 'transparent',
    // Prevent border from extending beyond page
    maxWidth: 595 - (28 * 2), // A4 width minus margins
    maxHeight: 842 - (28 * 2), // A4 height minus margins
    // Modern shadow effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  innerBorder: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderWidth: 1,
    borderColor: '#60a5fa',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    position: 'relative',
    zIndex: 10,
    margin: 42, // 1.5cm margin on ALL sides (1cm to border + 0.5cm inside border)
    // Strict bounds to prevent page overflow  
    maxWidth: 595 - (42 * 2),
    maxHeight: 842 - (42 * 2),
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
    marginBottom: 15, // More margin after first report
    height: '48%', // Take up more of the page
    borderWidth: 2,
    borderColor: '#1e40af',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#ffffff',
    // Modern shadow effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  pupilSectionSecond: {
    marginBottom: 5, // Less margin after second report
    height: '48%', // Take up more of the page
    borderWidth: 2,
    borderColor: '#1e40af',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#ffffff',
    // Modern shadow effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
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
            }> = ({ pupil, subjects, majorSubjects, schoolName, examTitle, className, schoolInfo, examDetails }) => {
              // Use ageAtExam if available, otherwise calculate from dateOfBirth
              const age = pupil.pupilInfo.ageAtExam || calculateAge(pupil.pupilInfo.dateOfBirth);

              // Generate QR code data - match Modern Report exactly
              const qrData = `Name: ${pupil.pupilInfo.name}
            Class: ${className}
            Age: ${age} years
            PIN: ${pupil.pupilInfo.admissionNumber || 'N/A'}
            Year: ${examDetails.academicYearName || new Date().getFullYear().toString()}
            Term: ${examDetails.termName || 'TERM'}
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
                        <Text style={styles.infoValue}>{examDetails.termName || 'TERM'}</Text>
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
                            {subject.name} {isMajor && subjects.length > 4 ? '★' : ''}
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
                         {generateClassTeacherReport(pupil)}
                       </Text>
                     </View>

                     {/* Class Teacher Signature */}
                     <View style={styles.signatureSection}>
                       <Text style={styles.signatureText}>Class Teacher's Signature: </Text>
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
            name: subject.name,
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
                name: subject.name,
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
              {/* Beautiful Official Border */}
              <View style={styles.borderContainer}>
                <View style={styles.innerBorder} />
              </View>
              
                                        {/* Content Container */}
                          <View style={styles.contentContainer}>
                                                        {/* First Pupil Section (Top Half) */}
                            <View style={styles.pupilSection}>
                              <PupilAssessmentCard
                                pupil={result}
                                subjects={processedSubjects}
                                majorSubjects={majorSubjects}
                                schoolName={schoolInfo.name}
                                examTitle={examDetails.name}
                                className={classSnap.name}
                                schoolInfo={schoolInfo}
                                examDetails={examDetails}
                              />
                            </View>

                            {/* Second Pupil Section (Bottom Half) */}
                            {nextResult && (
                              <View style={styles.pupilSectionSecond}>
                                <PupilAssessmentCard
                                  pupil={nextResult}
                                  subjects={nextProcessedSubjects}
                                  majorSubjects={majorSubjects}
                                  schoolName={schoolInfo.name}
                                  examTitle={examDetails.name}
                                  className={classSnap.name}
                                  schoolInfo={schoolInfo}
                                  examDetails={examDetails}
                                />
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
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${examDetails.name.replace(/\s+/g, '_')}_detailed_assessment.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Detailed Assessment PDF generation error:", error);
    throw error;
  }
};
