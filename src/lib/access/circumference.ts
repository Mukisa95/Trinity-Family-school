import type { Pupil, SystemUser } from '@/types';

/** null means all; an empty selection grants no access. Axes intersect. */
export type Circumference = {
  classIds: string[] | null;
  sections: Array<'Day' | 'Boarding'> | null;
  genders: Array<'Male' | 'Female'> | null;
};
export const ALL_CIRCUMFERENCE: Circumference = { classIds: null, sections: null, genders: null };
export const NO_CIRCUMFERENCE: Circumference = { classIds: [], sections: [], genders: [] };

export function validateCircumference(input: unknown): Circumference {
  if (input === undefined || input === null) return { ...ALL_CIRCUMFERENCE };
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid Circumference.');
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(key => !['classIds', 'sections', 'genders'].includes(key))) throw new Error('Invalid Circumference option.');
  const axis = (key: string, allowed?: string[]) => {
    const value = data[key];
    if (value === undefined || value === null) return null;
    if (!Array.isArray(value) || value.length > 200 || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 160 || item.includes('/') || allowed && !allowed.includes(item))) throw new Error(`Invalid Circumference ${key}.`);
    return [...new Set(value as string[])].sort();
  };
  return { classIds: axis('classIds'), sections: axis('sections', ['Day', 'Boarding']) as Circumference['sections'], genders: axis('genders', ['Male', 'Female']) as Circumference['genders'] };
}

export function circumferenceOf(user?: Pick<SystemUser, 'role' | 'circumference'> | null): Circumference {
  if (user?.role === 'Admin' || user?.role === 'Parent') return { ...ALL_CIRCUMFERENCE };
  try { return validateCircumference(user?.circumference); } catch { return { ...NO_CIRCUMFERENCE }; }
}
export function circumferenceKey(user?: Pick<SystemUser, 'role' | 'circumference'> | null): string {
  return JSON.stringify(circumferenceOf(user));
}
export function circumferenceSummary(user?: Pick<SystemUser, 'role' | 'circumference'> | null): string {
  const scope = circumferenceOf(user);
  return [scope.classIds === null ? 'All classes' : `${scope.classIds.length} selected ${scope.classIds.length === 1 ? 'class' : 'classes'}`,
    scope.sections === null ? 'All sections' : scope.sections.length ? scope.sections.join(', ') : 'No sections',
    scope.genders === null ? 'All genders' : scope.genders.length ? scope.genders.map(value => value === 'Female' ? 'Girls' : 'Boys').join(', ') : 'No genders'].join(' · ');
}
export function hasCircumference(user?: Pick<SystemUser, 'role' | 'circumference'> | null): boolean {
  const scope = circumferenceOf(user);
  return scope.classIds !== null || scope.sections !== null || scope.genders !== null;
}
export function permitsClass(scope: Circumference, classId?: string): boolean {
  return scope.classIds === null || !!classId && scope.classIds.includes(classId);
}
export function permitsPupil(scope: Circumference, pupil: Pick<Pupil, 'classId' | 'section' | 'gender'>): boolean {
  return permitsClass(scope, pupil.classId)
    && (scope.sections === null || (scope.sections as string[]).includes(pupil.section))
    && (scope.genders === null || (scope.genders as string[]).includes(pupil.gender));
}
export function circumferenceWithin(child: Circumference, parent: Circumference): boolean {
  return (['classIds', 'sections', 'genders'] as const).every(key => parent[key] === null || child[key] !== null && child[key]!.every(value => (parent[key] as string[]).includes(value)));
}
export function scopeFilters(scope: Circumference): Array<Array<{ field: string; op: '==' | 'in'; value: unknown }>> {
  if ([scope.classIds, scope.sections, scope.genders].some(axis => axis?.length === 0)) return [];
  const selected = [scope.classIds, scope.sections, scope.genders].filter(axis => axis !== null) as string[][];
  const products = selected.reduce<string[][]>((plans, axis) => plans.flatMap(plan => axis.map(value => [...plan, value])), [[]]);
  // Equality-only query partitions avoid Firestore's multiplicative IN limits.
  const fields = ['classId', 'section', 'gender'].filter((_, i) => [scope.classIds, scope.sections, scope.genders][i] !== null);
  return products.map(values => fields.map((field, index) => ({ field, op: '==' as const, value: values[index] })));
}

export function projectExamResult<T extends { pupilSnapshots?: any[]; results?: Record<string, unknown>; [key: string]: any }>(record: T, pupilIds: Set<string>): T {
  return { ...record, pupilSnapshots: record.pupilSnapshots?.filter(pupil => pupilIds.has(pupil.pupilId || pupil.id)),
    results: Object.fromEntries(Object.entries(record.results || {}).filter(([id]) => pupilIds.has(id))) };
}
