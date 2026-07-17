import type { ClassLevel, ExamAssessmentMode } from '@/types';

export const NURSERY_COMMENTARY_OPTIONS = [
  'EXCELLENT',
  'VERY GOOD',
  'GOOD',
  'FAIR GOOD',
  'NEEDS IMPROVEMENT',
] as const;

export type NurseryCommentary = (typeof NURSERY_COMMENTARY_OPTIONS)[number];

type NurseryClassLike = {
  level?: ClassLevel;
  name?: string;
  code?: string;
};

type AssessmentLike = {
  assessmentMode?: ExamAssessmentMode;
};

export const isNurseryClass = (schoolClass?: NurseryClassLike | null): boolean => {
  if (!schoolClass) return false;
  if (schoolClass.level) return schoolClass.level === 'Nursery';

  const classIdentity = `${schoolClass.name || ''} ${schoolClass.code || ''}`.toLowerCase();
  return /\b(nursery|baby|middle|top)\b/.test(classIdentity);
};

export const getAssessmentModeForClass = (
  schoolClass?: NurseryClassLike | null
): ExamAssessmentMode => isNurseryClass(schoolClass) ? 'nursery_commentary' : 'marks';

export const isNurseryAssessment = (
  exam?: AssessmentLike | null,
  examResult?: AssessmentLike | null,
  classSnapshot?: NurseryClassLike | null
): boolean => (
  exam?.assessmentMode === 'nursery_commentary' ||
  examResult?.assessmentMode === 'nursery_commentary' ||
  isNurseryClass(classSnapshot)
);

export const isNurseryCommentary = (value: unknown): value is NurseryCommentary =>
  typeof value === 'string' && NURSERY_COMMENTARY_OPTIONS.includes(value as NurseryCommentary);
