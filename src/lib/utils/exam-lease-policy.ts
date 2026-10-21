export const EXAM_LEASE_DURATION_MS = 2 * 60_000;
export const EXAM_LEASE_RENEW_MS = 30_000;
export const EXAM_LEASE_CLOCK_SKEW_MS = 15_000;

function millis(value: unknown): number {
  if (typeof value === 'string') return Date.parse(value);
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().getTime();
  return Number.NaN;
}

export function examLeaseDeadline(lease: { expiresAt?: unknown; renewedAt?: unknown }): number {
  const expiry = millis(lease.expiresAt);
  const renewed = millis(lease.renewedAt);
  // Bound older ten-minute leases by their last heartbeat too.
  return Number.isFinite(renewed) ? Math.min(expiry, renewed + EXAM_LEASE_DURATION_MS) : expiry;
}

export function isExamLeaseExpired(lease: { expiresAt?: unknown; renewedAt?: unknown }, now = Date.now()): boolean {
  const deadline = examLeaseDeadline(lease);
  return !Number.isFinite(deadline) || deadline <= now - EXAM_LEASE_CLOCK_SKEW_MS;
}
