declare global { interface Window { trinityAndroidConnected?: boolean } }

/** Either known offline signal pauses downloads; native state may update first. */
export function canDownloadWorkspaceRecords(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine && (typeof window === 'undefined' || window.trinityAndroidConnected !== false);
}
