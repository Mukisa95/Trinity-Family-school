import { SubjectCommentType, SubjectStatus } from '@/types';

export const SUBJECT_COMMENT_TYPES: { value: SubjectCommentType; label: string }[] = [
  { value: 'mathematical_concepts', label: 'Mathematical concepts' },
  { value: 'reading', label: 'Reading' },
  { value: 'writing_concepts', label: 'Writing Concepts' },
  { value: 'god_and_his_creation', label: 'God and his creation' },
  { value: 'life_skills', label: 'Life skills' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'story_telling', label: 'Story Telling' },
  { value: 'general_knowledge', label: 'General Knowledge' },
  { value: 'rhymes_music', label: 'Rhymes / Music' },
  { value: 'outdoor_activities', label: 'Outdoor activities' },
  { value: 'punctuality', label: 'Punctuality' },
];

export const SUBJECT_STATUS_OPTIONS: { value: SubjectStatus; label: string; color: string }[] = [
  { value: 'very_good', label: 'Very Good', color: 'bg-blue-100 text-blue-800' },
  { value: 'good', label: 'Good', color: 'bg-green-100 text-green-800' },
  { value: 'fair', label: 'Fair', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'weak', label: 'Weak', color: 'bg-red-100 text-red-800' },
];

export function getSubjectLabel(subject: SubjectCommentType): string {
  return SUBJECT_COMMENT_TYPES.find(s => s.value === subject)?.label || subject;
}

export function getSubjectStatusLabel(status: SubjectStatus): string {
  return SUBJECT_STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}































