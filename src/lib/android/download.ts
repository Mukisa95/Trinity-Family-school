import release from './app-release.json';

/** Next.js can use an internal server URL behind a deployment proxy. */
export function androidRequestOrigin(headers: Pick<Headers, 'get'>, fallbackOrigin = '', development = false) {
  const host = headers.get('x-forwarded-host') || headers.get('host');
  if (!host) return fallbackOrigin;
  if (/[\s,/@?#]/.test(host)) return '';
  const protocol = headers.get('x-forwarded-proto') || (development ? 'http' : 'https');
  return `${protocol}://${host}`;
}

/** Distribution belongs to the configured school website and Firebase project. */
export function androidReleaseForSite(origin: string, projectId: string, development = false) {
  try {
    const url = new URL(origin);
    const local = development && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (projectId !== release.firebaseProjectId || (!local && url.origin !== release.websiteOrigin)) return null;
    return release;
  } catch { return null; }
}
export function websiteFirebaseProjectId() {
  return (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools').trim();
}
