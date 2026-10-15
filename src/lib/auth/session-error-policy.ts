// Only authoritative credential failures invalidate a previously signed identity.
// Unknown SDK/service failures must remain retryable rather than erase the session.
const invalidCodes = new Set([
  'auth/user-disabled', 'auth/user-token-expired', 'auth/invalid-user-token',
  'auth/user-not-found', 'auth/id-token-revoked', 'auth/session-cookie-revoked',
  'app/invalid-claims', 'app/profile-mismatch',
]);

export function sessionErrorCode(error: unknown): string {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' && /^(auth|app)\/[a-z-]{1,60}$/.test(code) ? code : 'unknown';
}

export function isDefinitiveSessionError(error: unknown): boolean {
  return invalidCodes.has(sessionErrorCode(error));
}
