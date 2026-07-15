import type { Class } from '@/types';

/**
 * Sorts classes by their administrator-defined ordinal `order` field.
 * Classes without an `order` value are placed at the end.
 */
export function sortClassesByOrder<T extends { order?: number }>(classes: T[]): T[] {
  return [...classes].sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : Infinity;
    const orderB = typeof b.order === 'number' ? b.order : Infinity;
    return orderA - orderB;
  });
}

/**
 * Comparator function for sorting class objects or items with an `order` field.
 */
export function classOrderComparator(a: { order?: number }, b: { order?: number }): number {
  const orderA = typeof a.order === 'number' ? a.order : Infinity;
  const orderB = typeof b.order === 'number' ? b.order : Infinity;
  return orderA - orderB;
}
