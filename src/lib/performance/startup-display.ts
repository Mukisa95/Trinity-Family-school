export const STARTUP_SCREEN_ID = 'trinity-startup-screen';
export const NON_LOGIN_PUBLIC_ROUTES = ['/download', '/about-trinity', '/admin/setup', '/test-firebase'];

export function isNonLoginPublicPath(pathname: string | null) {
  return !!pathname && NON_LOGIN_PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

/** One frame can run before paint. The second yields a paint opportunity. */
export function afterStartupPaint(callback: () => void) {
  let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(callback); });
  return () => cancelAnimationFrame(frame);
}

/** Access verification owns its decision; startup only waits for its next paint. */
export function afterStartupContentPaint(callback: () => void) {
  let cancelPaint = () => {};
  let disposed = false;
  const pending = () => !!document.querySelector('[data-startup-access-pending]');
  let waiting = pending();
  const observer = new MutationObserver(() => {
    const next = pending();
    if (next === waiting) return;
    waiting = next;
    schedule();
  });
  const schedule = () => {
    cancelPaint();
    if (disposed || pending()) return;
    cancelPaint = afterStartupPaint(() => {
      if (disposed || pending()) return;
      observer.disconnect();
      callback();
    });
  };
  observer.observe(document.documentElement, { childList: true, subtree: true });
  schedule();
  return () => { disposed = true; observer.disconnect(); cancelPaint(); };
}
