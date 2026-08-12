import type { Exam } from '@/types';
import { liteRead, liteWrite } from './lite-cache';

const EXAM_CACHE_TTL = Number.MAX_SAFE_INTEGER;
const EXAM_CACHE_SCHEMA = 1;

export type ExamCacheSnapshot = {
  schema: number;
  revision: number;
  data: Exam[];
};

/**
 * Exam definitions can reveal school-wide class and scheduling data. Keep the
 * snapshot separated by Firebase project, signed-in user, and role. Parents
 * deliberately have no full-collection cache; their views use safe projections.
 */
export function getExamCacheScope(userId?: string, role?: string): string {
  if (!userId || !role || role === 'Parent') return '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return [projectId, userId, role].map(encodeURIComponent).join(':');
}

export function getExamCacheKey(scope: string): string {
  return `exams:${scope}`;
}

function toIso(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

/** Normalize timestamps once so the localStorage snapshot is JSON-safe. */
export function normaliseExams(exams: Exam[]): Exam[] {
  // A creation can reach this cache through two valid paths at nearly the
  // same time: the mutation's optimistic patch and the revision-triggered
  // server reconciliation. Keep the first complete copy of each Firestore
  // document so that race never renders the same exam twice.
  const seenExamIds = new Set<string>();
  return exams
    .map(exam => ({
      ...exam,
      createdAt: (toIso(exam.createdAt) || '') as string,
      updatedAt: toIso(exam.updatedAt) as Exam['updatedAt'],
      startDate: (toIso(exam.startDate) || '') as string,
      endDate: (toIso(exam.endDate) || '') as string,
    }))
    .filter(exam => {
      if (seenExamIds.has(exam.id)) return false;
      seenExamIds.add(exam.id);
      return true;
    })
    .sort((a, b) => {
      const byCreatedAt = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      return byCreatedAt || a.id.localeCompare(b.id);
    });
}

export function readExamCache(scope: string): ExamCacheSnapshot | null {
  if (!scope) return null;
  const snapshot = liteRead<ExamCacheSnapshot>(getExamCacheKey(scope));
  if (!snapshot || snapshot.schema !== EXAM_CACHE_SCHEMA || !Array.isArray(snapshot.data)) return null;

  return {
    ...snapshot,
    data: normaliseExams(snapshot.data),
  };
}

export function writeExamCache(scope: string, revision: number, exams: Exam[]): void {
  if (!scope) return;
  liteWrite(
    getExamCacheKey(scope),
    {
      schema: EXAM_CACHE_SCHEMA,
      revision,
      data: normaliseExams(exams),
    } satisfies ExamCacheSnapshot,
    EXAM_CACHE_TTL,
  );
}
