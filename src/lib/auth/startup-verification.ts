export const SAVED_VIEW_DELAY_MS = 3000;
export const VERIFICATION_DEADLINE_MS = 8000;
export const verificationRetryDelay = (attempt: number) => [5000, 15000, 60000][Math.min(attempt, 2)];

/** A timed-out SDK promise may finish later; its owner must still check generation. */
export function verificationDeadline<T>(operation: Promise<T>, timeoutMs = VERIFICATION_DEADLINE_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('Session verification is waiting for a connection.'), { code: 'auth/timeout' })), timeoutMs);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
