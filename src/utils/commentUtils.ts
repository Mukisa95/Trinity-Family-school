import { commentaryService } from '@/services/commentaryService';
import { SubjectCommentType, SubjectStatus, Gender } from '@/types';
import { adjustCommentForGender } from '@/utils/commentGenderUtils';

// Fallback comments if no templates are found in the database
const fallbackComments = {
  good: {
    class_teacher: [
      "Excellent performance throughout the term. Shows great understanding of concepts.",
      "Outstanding work ethic and consistent high-quality submissions.",
      "Demonstrates exceptional learning abilities and positive attitude.",
      "Commendable academic achievement. Keep up the excellent work."
    ],
    head_teacher: [
      "Exceptional performance this term. Continue with the same dedication.",
      "Outstanding academic progress. A role model for other students.",
      "Excellent work ethic and academic achievement. Well done!",
      "Remarkable improvement and consistent high performance."
    ]
  },
  fair: {
    class_teacher: [
      "Shows good understanding but needs more practice in some areas.",
      "Making steady progress with room for improvement.",
      "Satisfactory performance with potential for better results.",
      "Good effort shown, continue working hard to improve."
    ],
    head_teacher: [
      "Satisfactory performance with potential for better results.",
      "Encouraged to put in more effort to reach full potential.",
      "Good progress made, keep working towards excellence.",
      "Shows promise, needs consistent effort to improve further."
    ]
  },
  weak: {
    class_teacher: [
      "Requires additional support and practice to improve understanding.",
      "Struggling with concepts but showing willingness to learn.",
      "Needs focused attention and extra support to improve performance.",
      "Shows effort but requires more practice and guidance."
    ],
    head_teacher: [
      "Needs focused attention and extra support to improve performance.",
      "Recommended for additional tutoring and practice sessions.",
      "Requires consistent effort and additional support to improve.",
      "Parent conference recommended to discuss improvement strategies."
    ]
  },
  young: {
    class_teacher: [
      "Age-appropriate development with good social skills.",
      "Shows promise and is developing at an appropriate pace.",
      "Developing well for age group with positive learning attitude.",
      "Good social interaction and age-appropriate learning progress."
    ],
    head_teacher: [
      "Developing well for age group with positive learning attitude.",
      "Encouraged to continue building confidence and skills.",
      "Age-appropriate progress with good potential for growth.",
      "Shows good development for age, continue encouraging learning."
    ]
  },
  irregular: {
    class_teacher: [
      "Attendance issues affecting academic progress. Needs consistent participation.",
      "Inconsistent performance due to irregular attendance.",
      "Regular attendance is crucial for academic improvement.",
      "Potential shown when present, needs consistent attendance."
    ],
    head_teacher: [
      "Regular attendance is crucial for academic improvement.",
      "Parent conference recommended to address attendance concerns.",
      "Attendance improvement needed for better academic progress.",
      "Shows ability when present, consistent attendance required."
    ]
  }
};

/**
 * Get a dynamic comment for a specific performance status and category
 * First tries to get from database, falls back to predefined comments
 */
export const getDynamicComment = async (
  performanceStatus: string,
  category: 'class_teacher' | 'head_teacher',
  pupilGender?: Gender
): Promise<string> => {
  try {
    console.log(`🔍 getDynamicComment: Fetching comment for ${performanceStatus} - ${category}`);

    // Try to get a random comment from the database
    const template = await commentaryService.getRandomCommentTemplate(performanceStatus, category);

    console.log(`📋 getDynamicComment: Database result:`, template);

    if (template && template.isActive) {
      console.log(`✅ getDynamicComment: Using database comment`);
      if (pupilGender && template.comment) {
        return adjustCommentForGender(template.comment, pupilGender);
      }
      return template.comment;
    }

    console.log(`⚠️ getDynamicComment: No active database comment found, using fallback`);

    // Fallback to predefined comments
    const fallbackCategory = fallbackComments[performanceStatus as keyof typeof fallbackComments];
    if (fallbackCategory) {
      const comments = fallbackCategory[category];
      if (comments && comments.length > 0) {
        const randomIndex = Math.floor(Math.random() * comments.length);
        console.log(`📝 getDynamicComment: Using fallback comment #${randomIndex}`);
        return comments[randomIndex];
      }
    }

    console.log(`🔄 getDynamicComment: Using ultimate fallback`);

    // Ultimate fallback
    return category === 'class_teacher'
      ? "Continue working hard and stay focused on your studies."
      : "Keep up the good work and strive for excellence.";

  } catch (error) {
    console.error('❌ getDynamicComment Error:', error);

    // Fallback to predefined comments on error
    const fallbackCategory = fallbackComments[performanceStatus as keyof typeof fallbackComments];
    if (fallbackCategory) {
      const comments = fallbackCategory[category];
      if (comments && comments.length > 0) {
        const randomIndex = Math.floor(Math.random() * comments.length);
        console.log(`📝 getDynamicComment: Using error fallback comment #${randomIndex}`);
        return comments[randomIndex];
      }
    }

    console.log(`🔄 getDynamicComment: Using ultimate error fallback`);

    // Ultimate fallback
    return category === 'class_teacher'
      ? "Continue working hard and stay focused on your studies."
      : "Keep up the good work and strive for excellence.";
  }
};

/**
 * Get both class teacher and head teacher comments for a performance status
 */
export const getDynamicComments = async (performanceStatus: string, pupilGender?: Gender): Promise<{
  classTeacherComment: string;
  headTeacherComment: string;
}> => {
  const [classTeacherComment, headTeacherComment] = await Promise.all([
    getDynamicComment(performanceStatus, 'class_teacher', pupilGender),
    getDynamicComment(performanceStatus, 'head_teacher', pupilGender)
  ]);

  return {
    classTeacherComment,
    headTeacherComment
  };
};

/**
 * Get a subject comment for a specific subject and status
 */
export const getSubjectComment = async (
  subject: SubjectCommentType,
  subjectStatus: SubjectStatus,
  classId?: string,
  pupilGender?: Gender,
  termId?: string
): Promise<string> => {
  try {
    const template = await commentaryService.getRandomSubjectComment(subject, subjectStatus, classId, termId);

    if (template && template.isActive) {
      if (pupilGender && template.comment) {
        return adjustCommentForGender(template.comment, pupilGender);
      }
      return template.comment;
    }

    // Fallback
    return '';
  } catch (error) {
    console.error('Error getting subject comment:', error);
    return '';
  }
};

/**
 * Get subject comments for all subjects based on their statuses
 */
export const getSubjectComments = async (
  subjectStatuses: Record<SubjectCommentType, SubjectStatus>,
  classId?: string,
  pupilGender?: Gender,
  termId?: string
): Promise<Record<SubjectCommentType, string>> => {
  const comments: Record<SubjectCommentType, string> = {} as Record<SubjectCommentType, string>;

  const promises = Object.entries(subjectStatuses).map(async ([subject, status]) => {
    if (status) {
      comments[subject as SubjectCommentType] = await getSubjectComment(
        subject as SubjectCommentType,
        status as SubjectStatus,
        classId,
        pupilGender,
        termId
      );
    }
  });

  await Promise.all(promises);

  return comments;
};
