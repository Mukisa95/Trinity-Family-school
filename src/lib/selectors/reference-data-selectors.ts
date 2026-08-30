import type { House } from '@/types';
import type { AccessLevel } from '@/types/access-levels';

export function selectHouseById(houses: House[] | undefined, id: string): House | null {
  if (!id) return null;
  return houses?.find(house => house.id === id) ?? null;
}

export function selectActiveAccessLevels(levels: AccessLevel[] | undefined): AccessLevel[] {
  return (levels ?? []).filter(level => level.isActive);
}

export function selectAccessLevelById(
  levels: AccessLevel[] | undefined,
  id: string,
): AccessLevel | null {
  if (!id) return null;
  return levels?.find(level => level.id === id) ?? null;
}

export function selectDefaultAccessLevel(levels: AccessLevel[] | undefined): AccessLevel | null {
  return levels?.find(level => level.isDefault && level.isActive) ?? null;
}
