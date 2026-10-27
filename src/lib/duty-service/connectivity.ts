export function isDutyServiceOffline() {
  return typeof window !== 'undefined' && (!navigator.onLine || window.trinityAndroidConnected === false);
}

export function requireDutyServiceOnline() {
  if (isDutyServiceOffline()) throw new Error('Connect to save Duty & Service changes. Saved information remains available offline.');
}
