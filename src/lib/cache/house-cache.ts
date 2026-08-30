import type { House } from '@/types';
import { liteRead, liteWrite } from './lite-cache';

const HOUSE_CACHE_TTL = Number.MAX_SAFE_INTEGER;
const HOUSE_CACHE_SCHEMA = 1;

export type HouseCacheSnapshot = {
  schema: number;
  revision: number;
  data: House[];
};

export function getHouseCacheScope(userId?: string, role?: string): string {
  if (!userId || !role) return '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return [projectId, userId, role].map(encodeURIComponent).join(':');
}

export function getHouseCacheKey(scope: string): string {
  return `houses:${scope}`;
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

/** Produces one JSON-safe, predictable house list for every consumer. */
export function normaliseHouses(houses: House[]): House[] {
  return [...houses]
    .map(house => ({
      ...house,
      createdAt: toIso(house.createdAt) || house.createdAt || '',
      updatedAt: toIso(house.updatedAt) || house.updatedAt,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function readHouseCache(scope: string): HouseCacheSnapshot | null {
  if (!scope) return null;
  const snapshot = liteRead<HouseCacheSnapshot>(getHouseCacheKey(scope));
  if (!snapshot || snapshot.schema !== HOUSE_CACHE_SCHEMA || !Array.isArray(snapshot.data)) {
    return null;
  }
  return { ...snapshot, data: normaliseHouses(snapshot.data) };
}

export function writeHouseCache(scope: string, revision: number, houses: House[]): void {
  if (!scope) return;
  liteWrite(
    getHouseCacheKey(scope),
    {
      schema: HOUSE_CACHE_SCHEMA,
      revision,
      data: normaliseHouses(houses),
    } satisfies HouseCacheSnapshot,
    HOUSE_CACHE_TTL,
  );
}
