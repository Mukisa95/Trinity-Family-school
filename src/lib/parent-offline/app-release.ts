const PARENT_APP_RELEASE_STORAGE_KEY = 'trinity-parent-app-release-version';

export function isParentAppReleaseVersion(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

export function shouldRefreshParentAppRelease({
  previousVersion,
  releasedVersion,
  isServerSnapshot,
}: {
  previousVersion: string | null;
  releasedVersion: unknown;
  isServerSnapshot: boolean;
}) {
  return isServerSnapshot
    && isParentAppReleaseVersion(previousVersion)
    && isParentAppReleaseVersion(releasedVersion)
    && previousVersion !== releasedVersion;
}

export function readParentAppReleaseVersion() {
  if (typeof window === 'undefined') return null;
  try {
    const version = window.localStorage.getItem(PARENT_APP_RELEASE_STORAGE_KEY);
    return isParentAppReleaseVersion(version) ? version : null;
  } catch {
    return null;
  }
}

export function writeParentAppReleaseVersion(version: string) {
  if (typeof window === 'undefined' || !isParentAppReleaseVersion(version)) return;
  try {
    window.localStorage.setItem(PARENT_APP_RELEASE_STORAGE_KEY, version);
  } catch {
    // The app shell still works in private browsing; it simply cannot remember
    // that a release has already been processed.
  }
}
