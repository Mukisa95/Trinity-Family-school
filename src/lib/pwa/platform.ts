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
