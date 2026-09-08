/**
 * Firestore rejects `undefined` anywhere in a document write. Optional form
 * values are intentionally absent rather than stored as an invalid value.
 */
export function omitUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as T;
}
