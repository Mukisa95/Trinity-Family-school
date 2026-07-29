import type { AcademicYear } from '@/types';
import { liteRead, liteWrite } from './lite-cache';

const ACADEMIC_YEAR_CACHE_TTL = Number.MAX_SAFE_INTEGER;
const ACADEMIC_YEAR_CACHE_SCHEMA = 1;

export type AcademicYearCacheSnapshot = {
  schema: number;
  revision: number;
  data: AcademicYear[];
};

export function getAcademicYearCacheScope(userId?: string, role?: string): string {
  if (!userId || !role) return '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return [projectId, userId, role].map(encodeURIComponent).join(':');
}

export function getAcademicYearCacheKey(scope: string): string {
  return `academic-years:${scope}`;
}

function toIso(value: unknown): string {
  if (!value) return '';
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;

  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

/** Normalises dates and keeps historical years in a predictable newest-first order. */
export function normaliseAcademicYears(years: AcademicYear[]): AcademicYear[] {
  return [...years]
    .map(year => ({
      ...year,
      startDate: toIso(year.startDate) || year.startDate,
      endDate: toIso(year.endDate) || year.endDate,
      terms: (year.terms ?? []).map(term => ({
        ...term,
        startDate: toIso(term.startDate) || term.startDate,
        endDate: toIso(term.endDate) || term.endDate,
      })),
    }))
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

export function readAcademicYearCache(scope: string): AcademicYearCacheSnapshot | null {
  if (!scope) return null;
  const snapshot = liteRead<AcademicYearCacheSnapshot>(getAcademicYearCacheKey(scope));
  if (!snapshot || snapshot.schema !== ACADEMIC_YEAR_CACHE_SCHEMA || !Array.isArray(snapshot.data)) {
    return null;
  }

  return { ...snapshot, data: normaliseAcademicYears(snapshot.data) };
}

export function writeAcademicYearCache(
  scope: string,
  revision: number,
  years: AcademicYear[],
): void {
  if (!scope) return;
  liteWrite(
    getAcademicYearCacheKey(scope),
    {
      schema: ACADEMIC_YEAR_CACHE_SCHEMA,
      revision,
      data: normaliseAcademicYears(years),
    } satisfies AcademicYearCacheSnapshot,
    ACADEMIC_YEAR_CACHE_TTL,
  );
}
