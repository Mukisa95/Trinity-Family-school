import type { SystemUser } from '@/types';
import type { LeadershipTerm, PrefectoralPost, PostAssignment, DutyRota, DutyAssignment, Poll, PerformanceRanking } from '@/types/duty-service';
import { sessionAccessKey } from '@/lib/access/session-profile';

export interface DutyServiceData {
  leadershipTerms: LeadershipTerm[];
  prefectoralPosts: PrefectoralPost[];
  postAssignments: PostAssignment[];
  dutyRotas: DutyRota[];
  dutyAssignments: DutyAssignment[];
  polls: Poll[];
  performanceRankings: PerformanceRanking[];
}

export const DUTY_SERVICE_COLLECTIONS = ['leadershipTerms', 'prefectoralPosts', 'postAssignments', 'dutyRotas', 'dutyAssignments', 'polls', 'performanceRankings'] as const;
export function dutyServiceCacheName(user: SystemUser): string {
  return `duty-service:${encodeURIComponent(sessionAccessKey(user))}`;
}

export interface OfflineDutyService extends DutyServiceData {
  staff: Array<{ id: string; name: string }>;
  pupils: Array<{ id: string; name: string; classId?: string; className?: string }>;
}

export function isDutyServiceData(value: unknown): value is DutyServiceData {
  return !!value && typeof value === 'object' && DUTY_SERVICE_COLLECTIONS.every(name =>
    Array.isArray((value as DutyServiceData)[name]) && (value as DutyServiceData)[name].every(item => !!item && typeof item.id === 'string'));
}
