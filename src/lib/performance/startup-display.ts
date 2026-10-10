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
