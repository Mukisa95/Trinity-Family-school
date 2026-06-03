/**
 * Shared exam report commentary templates and aggregate-based selection.
 * Kept in sync with admin Commentary Box default categories.
 */

export type ExamCommentaryCategory =
  | 'aggregate_4'
  | 'aggregate_5_6'
  | 'aggregate_7_12'
  | 'aggregate_13_28'
  | 'aggregate_29_36';

export const EXAM_REPORT_COMMENTARY: Record<
  'class_teacher' | 'head_teacher',
  Record<ExamCommentaryCategory, string[]>
> = {
  class_teacher: {
    aggregate_4: [
      'I am delighted with this outstanding performance, [Name].',
      'Thank you for your consistent effort and exceptional results.',
      '[Name], your dedication has produced remarkable outcomes.',
      'I am proud of your exemplary achievement this term.',
      'Well done on maintaining such a high standard of work.',
      'Your hard work is clearly reflected in these excellent results.',
      'Congratulations on achieving such a superb aggregate.',
      'Your enthusiasm and commitment are truly commendable.',
      'I appreciate the enthusiasm you bring to every lesson.',
      'Keep up this brilliant level of performance, [Name].',
      'Your focus and determination have paid off handsomely.',
      'Thank you for setting such an impressive example for your peers.',
      'You have demonstrated exceptional mastery of the material.',
      'Your work ethic has been nothing short of inspiring.',
      'I value the positive attitude you display every day.',
      'You consistently exceed our expectations—well done.',
      'Your achievements this term are a testament to your perseverance.',
      'Keep up this wonderful momentum, [Name].',
      'I am thrilled by the quality of your contributions in class.',
      'This level of performance is truly outstanding—congratulations!',
    ],
    aggregate_5_6: [
      'Thank you, [Name], for your commendable effort this term.',
      'Your work shows real promise—aiming for aggregate 4 is within reach.',
      'Well done on this encouraging performance.',
      "I can see your progress; let's push toward that top grade.",
      'Your dedication is evident—keep striving for aggregate 4.',
      'I appreciate your focus and growing confidence.',
      'You have made good strides; continue to build on this.',
      'This result is promising—keep working hard.',
      'Your determination will help you close the gap to aggregate 4.',
      "Thank you for your steady effort—let's aim higher next term.",
      'You are on the right track; consistency will lead to excellence.',
      'Keep up this positive attitude, [Name].',
      'I encourage you to maintain this level of effort.',
      'You have the ability; continue to challenge yourself.',
      'This performance is solid—strive to make it even stronger.',
      "Your improvement is clear—let's keep the momentum going.",
      'Aim for precision in your work to reach the next level.',
      'I appreciate your willingness to learn and improve.',
      "You are making good progress—let's target aggregate 4 next.",
      'Your effort is commendable; I believe you can do even better.',
    ],
    aggregate_7_12: [
      '[Name], your progress this term is encouraging.',
      "I am pleased with the improvement I've seen in your work.",
      'This is good progress—keep building on it.',
      'Thank you for your dedication; continue working hard.',
      'Your steady effort shows real promise.',
      'Well done on this solid performance.',
      "You have demonstrated clear growth—let's keep going.",
      'Your commitment is paying off; maintain this pace.',
      'I appreciate the focus you bring to each lesson.',
      'This result is a step in the right direction.',
      "You're improving; aim to deepen your understanding next term.",
      'Keep up your positive attitude toward learning.',
      'Your hard work is beginning to yield results.',
      'Thank you for striving to do your best every day.',
      "I see real progress—let's work on consistency.",
      'You have great potential; continue to apply yourself.',
      'Stay engaged and ask questions to boost your understanding.',
      'Your perseverance will lead to even better results.',
      "This performance is a foundation—let's build higher.",
      "I'm pleased with your efforts; let's target further improvement.",
    ],
    aggregate_13_28: [
      '[Name], we still expect a lot from you—continue working hard.',
      'I believe in your ability to improve; keep trying.',
      "We have high hopes for you, [Name]. Let's see more effort.",
      'Your potential is clear—focus and determination will help.',
      'You can perform better than this with consistent effort.',
      "Let's work together to raise your achievement.",
      'I encourage you to engage more actively in class.',
      'Keep practicing to strengthen your skills.',
      'You have the ability; believe in yourself and work hard.',
      "I'd like to see you take more initiative in your learning.",
      "Let's set clear goals to boost your performance.",
      'You show promise; focus on improving your weak areas.',
      'Your teachers are here to support your progress.',
      "Let's develop a study plan to help you succeed.",
      "I know you can do better—let's make it happen.",
      'Try to apply feedback more consistently in your work.',
      "Continue to ask questions when you're unsure.",
      'Your attitude can make a big difference—stay positive.',
      'We will work together to help you reach your potential.',
      "Let's aim to see steady improvement next term.",
    ],
    aggregate_29_36: [
      'There is still room for improvement, [Name]. Work harder.',
      'We shall work together to ensure improvement in all subjects.',
      "Let's develop strategies to improve your performance.",
      "Your progress has stalled—let's refocus and try again.",
      'I encourage you to seek extra help where needed.',
      "Let's set realistic goals to guide your improvement.",
      'Please spend more time reviewing your lessons.',
      'Practice and repetition will help you grasp the material.',
      "I am here to support you—let's schedule additional practice.",
      'You can improve with consistent daily effort.',
      'Focus on one subject at a time to build confidence.',
      "Let's track your progress with small, measurable steps.",
      'Try to complete all assignments thoroughly.',
      'Ask for clarification whenever you feel stuck.',
      'A positive attitude will help you overcome challenges.',
      'Persistence will be key to raising your grades.',
      "Let's review past mistakes and learn from them.",
      "I'm confident that targeted practice will yield results.",
      "We'll work together to develop stronger study habits.",
      'Keep trying—your hard work will pay off in due course.',
    ],
  },
  head_teacher: {
    aggregate_4: [
      'Congratulations on this outstanding achievement, [Name].',
      'Your dedication has produced superb results.',
      'Well done on maintaining such a high standard of work.',
      'Your hard work shines through these excellent results.',
      "I'm proud of your exemplary performance this term.",
      "You've set a wonderful example for your classmates.",
      'Such consistent excellence is truly impressive.',
      'Keep up this brilliant level of achievement, [Name].',
      'Your focus and perseverance have paid off handsomely.',
      'I appreciate the enthusiasm you bring to every lesson.',
      'Your mastery of the material is outstanding.',
      "You've exceeded all expectations—congratulations!",
      'Exceptional work like this deserves to be celebrated.',
      'Your commitment to learning is admirable.',
      'This level of success reflects your hard work.',
      'Your results are a testament to your effort.',
      "I'm thrilled by the quality of your contributions.",
      'Keep riding this wave of excellence, [Name].',
      "You've raised the bar for yourself this term.",
      'Fantastic performance—keep it going!',
    ],
    aggregate_5_6: [
      'Well done on a commendable performance, [Name].',
      'Your progress is encouraging; aim for aggregate 4 next term.',
      'This result shows real promise—keep striving higher.',
      "You're on the right track; maintain this momentum.",
      'Your growing confidence is reflected in your work.',
      'Continue to refine your skills to reach the next level.',
      'Your determination will help you achieve even more.',
      'Thank you for your steady effort this term.',
      'You have the ability to aim for the top grade.',
      'Keep up this positive attitude toward learning.',
      "Let's push together to reach aggregate 4 soon.",
      "Your effort is clear—let's build on it next term.",
      'I appreciate the focus you bring to each task.',
      'Your work is solid; aim to make it even stronger.',
      'Consistency will take you closer to your goal.',
      "You're improving—let's keep the progress going.",
      'I believe you can achieve aggregate 4 with effort.',
      "Well done; let's set our sights a bit higher.",
      "You're closing the gap—keep pushing forward.",
      "Excellent work so far—let's take it up a notch.",
    ],
    aggregate_7_12: [
      '[Name], your improvement this term is very encouraging.',
      "You've made good strides—continue to build on this.",
      'This performance is a solid foundation for growth.',
      'Thank you for your dedication; keep working hard.',
      'Your focus in class is beginning to pay off.',
      "You've shown clear progress—aim for even more next term.",
      'Stay engaged and ask questions to deepen your understanding.',
      'Your steady effort will lead to better results.',
      'Keep this positive momentum going, [Name].',
      "I appreciate the persistence you're showing.",
      "Let's work on consistency to boost your performance.",
      'Your progress is promising—continue to apply yourself.',
      'Well done on this encouraging level of achievement.',
      "You have the potential; let's unlock it together.",
      'Your hard work is beginning to shine through.',
      'Continue to challenge yourself in every subject.',
      "You're on the right path—remain focused.",
      'Small, daily efforts will bring about big gains.',
      'Thank you for rising to the challenge this term.',
      'Use this progress as a springboard to greater success.',
    ],
    aggregate_13_28: [
      'I believe in your ability to achieve better results, [Name].',
      "Let's aim for more consistent effort next term.",
      'You can perform at a higher level with focused practice.',
      'Take initiative in your learning to see real improvement.',
      "Your potential is clear—let's work on strengthening your skills.",
      'Regular revision will help you gain confidence.',
      'I encourage you to seek help whenever you need it.',
      "Let's set clear goals to guide your progress.",
      'Try to apply feedback more consistently in your work.',
      'Your attitude toward learning will shape your success.',
      'You can unlock better results through daily practice.',
      'Focus on tricky areas first to build a stronger foundation.',
      "I'm here to support you—reach out when you feel stuck.",
      'Believe in yourself and the improvements will follow.',
      'We expect more from you; rise to the challenge.',
      'Consistent effort will lead to real growth.',
      'Keep asking questions to clarify your understanding.',
      "Let's establish a study routine that works for you.",
      'Your teachers are ready to help—use their guidance.',
      "I'm confident you can exceed these results next term.",
    ],
    aggregate_29_36: [
      "There is room for significant improvement, [Name]; let's focus on that.",
      'Please engage more actively in every lesson.',
      'A targeted study plan will help raise your grades.',
      'Your current performance needs more consistent effort.',
      'Daily review sessions will strengthen your learning.',
      'Practice fundamentals before moving on to new topics.',
      'You must take greater responsibility for your studies.',
      "Let's check your progress regularly to stay on track.",
      'Persistence and hard work will yield better results.',
      'Ask for clarification whenever a concept is unclear.',
      'Concentrate on one subject at a time for deeper understanding.',
      'I recommend extra practice in your weaker areas.',
      'Developing strong study habits is essential.',
      'I expect to see more effort in your next assessment.',
      'Consistent practice will build your confidence.',
      'Keep trying—your hard work will pay off.',
      "Let's review past mistakes and learn from them.",
      'You have the capacity to improve; please show it.',
      'Stay positive and persistent in your studies.',
      'I anticipate marked improvement next term.',
    ],
  },
};

export function getCommentaryCategoryFromTotal(totalAggregates: number): ExamCommentaryCategory {
  const n = Number(totalAggregates);
  if (!Number.isFinite(n)) {
    return 'aggregate_7_12';
  }
  if (n === 4) {
    return 'aggregate_4';
  }
  if (n < 4) {
    return 'aggregate_4';
  }
  if (n <= 6) {
    return 'aggregate_5_6';
  }
  if (n <= 12) {
    return 'aggregate_7_12';
  }
  if (n <= 28) {
    return 'aggregate_13_28';
  }
  if (n <= 36) {
    return 'aggregate_29_36';
  }
  return 'aggregate_29_36';
}

function toProperCase(name: string): string {
  return name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function extractFirstName(fullName: string): string {
  if (!fullName) return '';

  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);

  if (nameParts.length === 1) {
    return nameParts[0];
  }
  if (nameParts.length === 2) {
    return nameParts[0];
  }
  return nameParts[1];
}

function substituteName(comment: string, fullName: string): string {
  const firstName = extractFirstName(fullName);
  const properCaseName = toProperCase(firstName);
  return comment.replace(/\[Name\]/g, properCaseName);
}

function getRandomComment(comments: string[]): string {
  const randomIndex = Math.floor(Math.random() * comments.length);
  return comments[randomIndex];
}

/**
 * Random aggregate-based comments, but avoids reusing the same final line
 * within one document / batch (separate pools for class vs head).
 * When all variants for a role are exhausted, the pool resets so generation can continue.
 */
export class AggregateCommentPicker {
  private readonly usedClass = new Set<string>();
  private readonly usedHead = new Set<string>();

  classTeacher(fullName: string, totalAggregates: number): string {
    const key = getCommentaryCategoryFromTotal(totalAggregates);
    return this.pickUnique(EXAM_REPORT_COMMENTARY.class_teacher[key], fullName, this.usedClass);
  }

  headTeacher(fullName: string, totalAggregates: number): string {
    const key = getCommentaryCategoryFromTotal(totalAggregates);
    return this.pickUnique(EXAM_REPORT_COMMENTARY.head_teacher[key], fullName, this.usedHead);
  }

  private pickUnique(pool: string[], fullName: string, used: Set<string>): string {
    const rendered = pool.map((template) => substituteName(template, fullName));
    const distinct = [...new Set(rendered)];
    let available = distinct.filter((line) => !used.has(line));
    if (available.length === 0) {
      used.clear();
      available = distinct;
    }
    const line = available[Math.floor(Math.random() * available.length)];
    used.add(line);
    return line;
  }
}

export function generateExamClassTeacherComment(
  fullName: string,
  totalAggregates: number,
  picker?: AggregateCommentPicker
): string {
  if (picker) {
    return picker.classTeacher(fullName, totalAggregates);
  }
  const key = getCommentaryCategoryFromTotal(totalAggregates);
  const pool = EXAM_REPORT_COMMENTARY.class_teacher[key];
  return substituteName(getRandomComment(pool), fullName);
}

export function generateExamHeadTeacherComment(
  fullName: string,
  totalAggregates: number,
  picker?: AggregateCommentPicker
): string {
  if (picker) {
    return picker.headTeacher(fullName, totalAggregates);
  }
  const key = getCommentaryCategoryFromTotal(totalAggregates);
  const pool = EXAM_REPORT_COMMENTARY.head_teacher[key];
  return substituteName(getRandomComment(pool), fullName);
}
