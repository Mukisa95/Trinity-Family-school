type ErrorLike = {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
};

function isQuotaCandidate(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as ErrorLike;
  const code = String(candidate.code ?? '').toLowerCase();
  const message = String(candidate.message ?? '').toLowerCase();

  return code === '8'
    || code === 'resource-exhausted'
    || code.endsWith('/resource-exhausted')
    || message.includes('resource_exhausted')
    || message.includes('quota exceeded');
}

/** Recognizes the public and server Firestore forms of quota exhaustion. */
export function isFirestoreQuotaError(error: unknown): boolean {
  if (isQuotaCandidate(error)) return true;
  if (!error || typeof error !== 'object') return false;
  return isQuotaCandidate((error as ErrorLike).cause);
}
