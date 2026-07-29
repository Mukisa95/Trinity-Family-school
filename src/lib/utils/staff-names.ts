import type { Staff } from '@/types';

export function getStaffDisplayName(staff?: Pick<Staff, 'firstName' | 'lastName'>): string {
  const name = `${staff?.firstName || ''} ${staff?.lastName || ''}`.trim();
  return name || 'Unknown Teacher';
}

/**
 * Builds report labels exclusively from the canonical staff snapshot. Missing
 * IDs are historical/deleted records and must not trigger a private fetch.
 */
export function createStaffNameMap(staff: Staff[], ids: Iterable<string | undefined | null>): Map<string, string> {
  const byId = new Map(staff.map(member => [member.id, getStaffDisplayName(member)]));
  const names = new Map<string, string>();
  for (const id of ids) {
    const name = id ? byId.get(id) : undefined;
    if (id && name) names.set(id, name);
  }
  return names;
}
