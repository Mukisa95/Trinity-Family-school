/** Feature detection also covers iPads using a desktop Safari user agent. */
export function isAppleMobile() {
  return typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/i.test(navigator.userAgent)
    || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isHomeScreenApp() {
  return typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export function hasBrowserOfflineWorkspace() {
  return isHomeScreenApp() && !window.TrinityOffline && typeof indexedDB !== 'undefined' && 'serviceWorker' in navigator;
}

export function formatDeviceTime(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  const date = new Date(); date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}
