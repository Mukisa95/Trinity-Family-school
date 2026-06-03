import { commentaryService } from '@/services/commentaryService';

// Extract the existing comments from the NurseryAssessmentReport
const existingComments = {
  good: [
    "Outstanding achievement! Your hard work and commitment are truly paying off.",
    "Excellent work across the board. Keep pushing yourself and reaching new heights!",
    "You are consistently showing great understanding and effort. Very impressive!",
    "Brilliant performance this term! Maintain this positive momentum.",
  ],
  fair: [
    "A strong effort! With just a bit more focus, you'll achieve even greater success.",
    "You're building a solid foundation; keep aiming higher.",
    "Good progress! Let's keep up the energy and reach for excellence.",
    "You are on the right track. A little more consistency will take you even further!",
  ],
  young: [
    "You're showing promise. Let's channel your energy into steady learning habits.",
    "With greater attention to detail, you can achieve wonderful results.",
    "There is so much potential here — let's work together to develop it.",
    "You're at the beginning of an exciting journey. Stay focused and enthusiastic!",
  ],
  weak: [
    "Improvement is within reach! Let's put more effort into challenging areas.",
    "A stronger commitment to study will help you unlock your full potential.",
    "You have the ability — now let's work on consistency and effort.",
    "Focus and persistence will lead to much better results next term.",
  ],
  irregular: [
    "More consistent attendance will greatly boost your performance.",
    "Regular participation is key to achieving your true potential.",
    "With steady attendance, your understanding and results will significantly improve.",
    "Frequent engagement will help you build stronger skills and confidence.",
  ],
};

const existingHeadTeacherComments = {
  good: [
    "You are doing well, but there's always room to reach even higher.",
    "Excellent effort so far — aim for even greater achievements!",
    "You're performing strongly; now challenge yourself to reach your fullest potential.",
    "Solid results! Push yourself a little further for even bigger success.",
  ],
  fair: [
    "Good progress, but greater focus will lead to even better results.",
    "You've done well — now aim to double your efforts for outstanding achievements.",
    "A strong performance, but there's more you can accomplish with extra dedication.",
    "With continued hard work, you can move from good to exceptional.",
  ],
  young: [
    "Patience and practice will lead to steady improvement.",
    "Keep developing your skills — growth takes time.",
    "You have the foundation; consistent effort will bring visible results.",
    "With persistence and guidance, your abilities will continue to grow.",
  ],
  weak: [
    "Greater effort and focus are key to better outcomes.",
    "A stronger commitment to learning will greatly improve your results.",
    "Let's aim to strengthen your understanding for better future results.",
    "You can do much better with more consistent effort and attention.",
  ],
  irregular: [
    "Consistent attendance is essential for steady improvement.",
    "Making it to class regularly will boost both confidence and performance.",
    "Frequent class participation will support much better results.",
    "Attendance needs to be more regular for you to achieve your best.",
  ],
};

export const populateDefaultComments = async (): Promise<void> => {
  console.log('🚀 Starting to populate default comment templates...');
  
  try {
    const performanceStatuses = ['good', 'fair', 'young', 'weak', 'irregular'];
    let totalAdded = 0;

    for (const status of performanceStatuses) {
      console.log(`📝 Adding ${status} performance comments...`);
      
      // Add class teacher comments
      const classTeacherComments = existingComments[status as keyof typeof existingComments];
      for (const comment of classTeacherComments) {
        try {
          await commentaryService.addCommentTemplate({
            comment,
            status: status as 'good' | 'fair' | 'weak' | 'young' | 'irregular',
            type: 'class_teacher',
            isActive: true,
          });
          totalAdded++;
        } catch (error) {
          console.error(`❌ Error adding class teacher comment for ${status}:`, error);
        }
      }

      // Add head teacher comments
      const headTeacherComments = existingHeadTeacherComments[status as keyof typeof existingHeadTeacherComments];
      for (const comment of headTeacherComments) {
        try {
          await commentaryService.addCommentTemplate({
            comment,
            status: status as 'good' | 'fair' | 'weak' | 'young' | 'irregular',
            type: 'head_teacher',
            isActive: true,
          });
          totalAdded++;
        } catch (error) {
          console.error(`❌ Error adding head teacher comment for ${status}:`, error);
        }
      }
    }

    console.log(`✅ Successfully added ${totalAdded} default comment templates!`);
    console.log('🎉 Default comments population completed!');
    
  } catch (error) {
    console.error('❌ Error populating default comments:', error);
    throw error;
  }
};

// Function to check if default comments already exist
export const checkDefaultCommentsExist = async (): Promise<boolean> => {
  try {
    const templates = await commentaryService.getAllCommentTemplates();
    return templates.length > 0;
  } catch (error) {
    console.error('Error checking existing templates:', error);
    return false;
  }
};

// Main function to run the population (with check to avoid duplicates)
export const initializeDefaultComments = async (): Promise<void> => {
  try {
    const commentsExist = await checkDefaultCommentsExist();
    
    if (commentsExist) {
      console.log('ℹ️ Default comments already exist in the database. Skipping population.');
      return;
    }
    
    console.log('🔄 No existing comments found. Populating with defaults...');
    await populateDefaultComments();
    
  } catch (error) {
    console.error('❌ Error initializing default comments:', error);
    throw error;
  }
}; 