/** Coalesce busy cache streams, retry failures, and leave foreground work first. */
export function createAndroidSnapshotScheduler(
  synchronize: () => Promise<void>,
  canRun: () => boolean,
  onError: (error: unknown) => void,
) {
  let disposed = false;
  let running = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastStartedAt: number | undefined;
  let retryAt = 0;
  let failures = 0;

  const schedule = () => {
    if (disposed || running || timer || !dirty || !canRun()) return;
    const now = Date.now();
    const delay = Math.max(1500, lastStartedAt === undefined ? 0 : 15_000 - (now - lastStartedAt), retryAt - now);
    // Keep the first deadline rather than postponing it on every cache event.
    timer = setTimeout(() => { timer = undefined; void run(); }, delay);
  };
  const run = async () => {
    if (disposed || !canRun()) return;
    running = true; dirty = false; lastStartedAt = Date.now();
    try {
      await synchronize();
      failures = 0; retryAt = 0;
    } catch (error) {
      if (!disposed) {
        dirty = true;
        retryAt = Date.now() + Math.min(60_000, 5000 * 2 ** Math.min(4, failures++));
        onError(error);
      }
    } finally { running = false; schedule(); }
  };
  return {
    request() { if (!disposed) { dirty = true; schedule(); } },
    resume() { schedule(); },
    dispose() { disposed = true; clearTimeout(timer); timer = undefined; },
  };
}
