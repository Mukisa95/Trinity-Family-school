export const PARENT_OFFLINE_APP_ROUTES = ['/parent', '/parent/settings'] as const;

type ParentShellResponse = {
  type?: string;
  message?: string;
};

/**
 * Ask the existing worker to save the normal parent pages and the hashed
 * JavaScript/CSS files which the browser has already loaded. The worker owns
 * validation and cache writes. The normal path is cache-first; a confirmed
 * Firebase interface release can explicitly replace the saved shell.
 */
export async function prepareParentAppShell(options: { force?: boolean } = {}): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const worker = registration.active;
  if (!worker) throw new Error('The offline service is still starting.');

  const assetUrls = performance
    .getEntriesByType('resource')
    .map(entry => entry.name)
    .filter(name => {
      try {
        const url = new URL(name);
        return url.origin === window.location.origin && url.pathname.startsWith('/_next/static/');
      } catch {
        return false;
      }
    });

  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('The parent interface did not finish saving.'));
    }, 30_000);

    channel.port1.onmessage = event => {
      window.clearTimeout(timeout);
      channel.port1.close();
      const result = event.data as ParentShellResponse;
      if (result?.type === 'PARENT_APP_SHELL_CACHED') resolve();
      else reject(new Error(result?.message || 'The parent interface could not be saved.'));
    };

    worker.postMessage({
      type: 'CACHE_PARENT_APP_SHELL',
      routes: PARENT_OFFLINE_APP_ROUTES,
      assetUrls,
      force: options.force === true,
    }, [channel.port2]);
  });
}

/**
 * This is the only application-controlled hosting update check for an
 * already-prepared parent device. Call it only after the Firebase release
 * document has published a newer parent interface version.
 */
export async function refreshParentAppShellForReleasedVersion(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration()
    || await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  await registration.update();
  await prepareParentAppShell({ force: true });
}
