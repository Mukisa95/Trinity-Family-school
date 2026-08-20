import type { CommentTemplate, SubjectCommentType, SubjectStatus } from '@/types';

export function getTermAliases(termId?: string, termName?: string): string[] {
  const aliases = new Set<string>();
  [termId, termName].filter(Boolean).forEach(value => aliases.add(value as string));
  const normalized = `${termId || ''} ${termName || ''}`.toLowerCase().replace(/[\s_-]/g, '');

  if (normalized.includes('term1') || normalized.includes('t1')) {
    aliases.add('term_1'); aliases.add('term1'); aliases.add('t1');
  }
  if (normalized.includes('term2') || normalized.includes('t2')) {
    aliases.add('term_2'); aliases.add('term2'); aliases.add('t2');
  }
  if (normalized.includes('term3') || normalized.includes('t3')) {
    aliases.add('term_3'); aliases.add('term3'); aliases.add('t3');
  }

  return Array.from(aliases);
}

export function getCanonicalTermTemplateId(termId?: string, termName?: string): string {
  const aliases = getTermAliases(termId, termName);
  return aliases.find(alias => /^term_[123]$/.test(alias)) || termId || 'all';
}

export function getApplicableSubjectComments(
  templates: CommentTemplate[],
  subject: SubjectCommentType,
  status: SubjectStatus,
  classId: string,
  termAliases: string[],
): CommentTemplate[] {
  const exactMatches = templates.filter(template => {
    const appliesToTerm = !template.applicableTerms?.length
      || template.applicableTerms.includes('all')
      || termAliases.some(alias => template.applicableTerms?.includes(alias));

    return template.isActive
      && template.type === 'subject'
      && template.subject === subject
      && template.subjectStatus === status
      && appliesToTerm;
  });
  const classSpecific = exactMatches.filter(template => template.classId === classId);

  return classSpecific.length > 0
    ? classSpecific
    : exactMatches.filter(template => !template.classId);
}
