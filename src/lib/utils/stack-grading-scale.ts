import type { CreateExamData, Exam, ExamResult, ExamStackGradingPolicy, GradingScaleItem } from '@/types';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';

type StackExam = Pick<Exam, 'name' | 'baseName' | 'batchId' | 'examTypeId' | 'academicYearId' | 'termId'> & { id?: string };

export function examStackKey(exam: StackExam): string {
  return JSON.stringify(exam.examTypeId === 'et_cat'
    ? ['cat', exam.baseName || exam.name.split(' - ')[0], exam.academicYearId || '', exam.termId || '']
    : ['batch', exam.batchId || exam.id || '', exam.academicYearId || '', exam.termId || '']);
}

export function scaleSignature(scale?: GradingScaleItem[]): string {
  return JSON.stringify((scale?.length ? scale : DEFAULT_GRADING_SCALE).map(item => ({
    minMark: Number(item.minMark), maxMark: Number(item.maxMark), grade: item.grade.trim(),
    aggregates: Number(item.aggregates ?? 0), comment: item.comment || '',
  })).sort((a, b) => a.minMark - b.minMark));
}

export function latestStackPolicy(exams: Exam[], key = exams[0] ? examStackKey(exams[0]) : ''): ExamStackGradingPolicy | undefined {
  return exams.filter(exam => examStackKey(exam) === key).map(exam => exam.stackGradingPolicy)
    .filter((policy): policy is ExamStackGradingPolicy => !!policy?.scale?.length && policy.key === key)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.revision.localeCompare(a.revision))[0];
}

/** An independent result never becomes the template for a later CAT set. */
export function inheritStackGradingPolicy(data: CreateExamData, existing: Exam[]): CreateExamData {
  const policy = latestStackPolicy(existing, examStackKey(data));
  return policy ? { ...data, stackGradingPolicy: policy } : data;
}

export function resolveStackScale(exams: Exam[], results: (ExamResult | null)[]): GradingScaleItem[] {
  const policy = latestStackPolicy(exams);
  if (policy) return policy.scale;
  // Older stacks have no template metadata. Use the most common recorded scale
  // rather than mistaking the first independently edited class for the default.
  const counts = new Map<string, { count: number; scale: GradingScaleItem[] }>();
  exams.forEach((exam, index) => {
    if (exam.assessmentMode === 'nursery_commentary' || results[index]?.gradingScaleSource === 'independent' || exam.gradingScaleOverride?.length) return;
    const scale = results[index]?.gradingScale?.length ? results[index]!.gradingScale! : DEFAULT_GRADING_SCALE;
    const signature = scaleSignature(scale), current = counts.get(signature);
    counts.set(signature, { count: (current?.count || 0) + 1, scale });
  });
  const fallback = scaleSignature(DEFAULT_GRADING_SCALE);
  return [...counts.entries()].sort(([a, left], [b, right]) => right.count - left.count || Number(b === fallback) - Number(a === fallback) || a.localeCompare(b))[0]?.[1].scale || DEFAULT_GRADING_SCALE;
}

export function isIndependentScale(exam: Exam, result: ExamResult | null, stackScale: GradingScaleItem[]): boolean {
  return !!exam.gradingScaleOverride?.length || result?.gradingScaleSource === 'independent'
    || (!!result?.gradingScale?.length && scaleSignature(result.gradingScale) !== scaleSignature(stackScale));
}

export function validateGradingScale(scale: GradingScaleItem[]): GradingScaleItem[] {
  if (!scale.length) throw new Error('Add at least one grading band.');
  const cleaned = scale.map(item => ({ minMark: Number(item.minMark), maxMark: Number(item.maxMark), grade: item.grade.trim(), aggregates: Number(item.aggregates ?? 0), ...(item.comment !== undefined ? { comment: item.comment } : {}) }));
  if (cleaned.some(item => !Number.isFinite(item.minMark) || !Number.isFinite(item.maxMark) || !Number.isFinite(item.aggregates) || item.minMark < 0 || item.minMark > item.maxMark || !item.grade)) throw new Error('Every band needs a valid range, grade and aggregate.');
  const sorted = [...cleaned].sort((a, b) => a.minMark - b.minMark);
  if (sorted.some((item, index) => index > 0 && item.minMark <= sorted[index - 1].maxMark)) throw new Error('Grading bands must not overlap.');
  return cleaned;
}

export function regradeExamResults(result: ExamResult, scale: GradingScaleItem[]): ExamResult['results'] {
  const sorted = [...scale].sort((a, b) => b.minMark - a.minMark);
  return Object.fromEntries(Object.entries(result.results || {}).map(([pupilId, subjects]) => [pupilId,
    Object.fromEntries(Object.entries(subjects).map(([subjectId, entry]) => {
      if (entry.status === 'missed') return [subjectId, { ...entry, grade: 'F9', aggregates: 9 }];
      if (typeof entry.marks !== 'number' || !Number.isFinite(entry.marks)) return [subjectId, entry];
      const band = sorted.find(item => entry.marks! >= item.minMark);
      return [subjectId, { ...entry, grade: band?.grade || 'F9', aggregates: band ? band.aggregates ?? 0 : 9 }];
    })),
  ]));
}
