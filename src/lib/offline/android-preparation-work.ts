import { isNavigationPending, subscribeNavigationWork } from '@/lib/navigation/navigation-work';

/** Give taps and route commits priority, including when an export is already running. */
export async function yieldAndroidPreparation(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException('Preparation cancelled', 'AbortError');
  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    const cleanup = () => {
      clearTimeout(timer); unsubscribe?.();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', resume);
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => { cleanup(); reject(new DOMException('Preparation cancelled', 'AbortError')); };
    const resume = () => {
      clearTimeout(timer);
      if (signal?.aborted) return abort();
      if (isNavigationPending() || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) return;
      timer = setTimeout(() => {
        if (isNavigationPending() || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) return;
        cleanup(); resolve();
      }, 0);
    };
    unsubscribe = subscribeNavigationWork(resume);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', resume);
    signal?.addEventListener('abort', abort, { once: true });
    resume();
  });
}

export async function projectAndroidRecords<T, R>(records: readonly T[], project: (record: T) => R, signal?: AbortSignal): Promise<R[]> {
  const result: R[] = [];
  let started = performance.now();
  await yieldAndroidPreparation(signal);
  for (let index = 0; index < records.length; index++) {
    result.push(project(records[index]));
    if ((index + 1) % 32 === 0 || performance.now() - started >= 6) {
      await yieldAndroidPreparation(signal); started = performance.now();
    }
  }
  return result;
}
