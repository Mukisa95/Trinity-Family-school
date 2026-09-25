export const DEV_CONTROL_PATHS = {
  seeding: '/pupils/historical-seeding',
  firestoreUsage: '/settings/firebase-usage',
  deployment: '/settings/deployment',
  systemAudit: '/history-log/system-audit',
} as const;

const devControlPaths = Object.values(DEV_CONTROL_PATHS);

export function isDevControlPath(pathname: string | null | undefined): boolean {
  return typeof pathname === 'string' && devControlPaths.some(
    path => pathname === path || pathname.startsWith(`${path}/`)
  );
}
