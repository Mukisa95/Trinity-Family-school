/** Recover interrupted reads without refreshing successful, revision-owned caches. */
export function isConnectionReadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: unknown }).code || '').split('/').pop();
  return code === 'unavailable' || code === 'deadline-exceeded' || code === 'network-request-failed';
}

export function recoverFailedConnectionRead(query: { state: { status: string; error: unknown } }): 'always' | false {
  // Make recovery explicit even for Infinity-fresh catalogues with retained
  // data. Successful reads and authorization failures never use `always`.
  return query.state.status === 'error' && isConnectionReadError(query.state.error) ? 'always' : false;
}

export function retryConnectionRead(failureCount: number, error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const code = String((error as { code?: unknown } | null)?.code || '').split('/').pop();
  if (code === 'permission-denied' || code === 'unauthenticated') return false;
  return failureCount < (isConnectionReadError(error) ? 1 : 3);
}
