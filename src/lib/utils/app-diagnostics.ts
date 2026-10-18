// Deliberately accept only codes and numbers, never user records, credentials,
// query strings, console messages, or arbitrary exception text.
export type DiagnosticEvent = { at: string; code: string; durationMs?: number };
declare global { interface Window { trinityNativeDiagnostics?: boolean } }
const KEY = 'trinity_reliability_v1';
let events: DiagnosticEvent[] | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

function readEvents() {
  if (events) return events;
  events = [];
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(saved)) events = saved.filter(item => item && typeof item.at === 'string'
      && typeof item.code === 'string' && /^[a-z0-9_./-]{1,100}$/.test(item.code)).slice(-80)
      .map(item => ({ at: item.at, code: item.code, ...(Number.isFinite(item.durationMs) ? { durationMs: item.durationMs } : {}) }));
  } catch { /* Diagnostics must remain usable with unavailable storage. */ }
  return events!;
}

export function flushAppDiagnostics() {
  if (typeof window === 'undefined') return;
  if (timer) clearTimeout(timer);
  timer = undefined;
  try { localStorage.setItem(KEY, JSON.stringify(readEvents())); } catch { /* Best effort. */ }
}

export function recordAppDiagnostic(code: string, durationMs?: number) {
  if (typeof window === 'undefined' || !/^[a-z0-9_./-]{1,100}$/.test(code)) return;
  const list = readEvents();
  list.push({ at: new Date().toISOString(), code, ...(Number.isFinite(durationMs) ? { durationMs: Math.round(durationMs!) } : {}) });
  if (list.length > 80) list.splice(0, list.length - 80);
  if (!timer) timer = setTimeout(flushAppDiagnostics, 1500);
  try {
    window.TrinityOffline?.postMessage(JSON.stringify({ id: crypto.randomUUID(), action: 'recordDiagnostic', code, durationMs }));
  } catch { /* Older Android releases still keep the local report. */ }
}

export function createAppDiagnosticReport() {
  recordAppDiagnostic('report_requested');
  flushAppDiagnostics();
  return JSON.stringify({ schema: 1, bugId: `TRI-${crypto.randomUUID()}`, createdAt: new Date().toISOString(),
    online: navigator.onLine, nativeConnected: window.trinityAndroidConnected ?? null,
    environment: { homeScreen: window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      iosVersion: /(?:iPhone|iPad|iPod).*OS ([\d_]+)/.exec(navigator.userAgent)?.[1]?.replaceAll('_', '.') || null,
      webPush: 'PushManager' in window && 'Notification' in window, serviceWorker: 'serviceWorker' in navigator },
    events: readEvents() }, null, 2);
}

export function installAppDiagnosticMonitor() {
  recordAppDiagnostic('web_started');
  recordAppDiagnostic('web_release/session_recovery_v2');
  const route = () => {
    const section = location.pathname.split('/')[1];
    return ['', 'login', 'parent', 'pupils', 'pupil-detail', 'timetable', 'fees', 'attendance', 'exams', 'staff', 'settings'].includes(section)
      ? `web_route/${section || 'dashboard'}` : 'web_route/other';
  };
  let lastRoute = route();
  recordAppDiagnostic(lastRoute);
  const error = (event: ErrorEvent) => {
    recordAppDiagnostic('javascript_error');
    // Keep a compiled chunk and source position, excluding URL paths/queries.
    const chunk = /\/_next\/static\/[^?]*\/([a-zA-Z0-9_.-]{1,60}\.js)(?:\?|$)/.exec(event.filename || '');
    if (chunk) recordAppDiagnostic(`javascript_source/${chunk[1].toLowerCase()}/line_${Math.max(0, Math.min(1000000, event.lineno))}`);
  };
  const rejection = (event: PromiseRejectionEvent) => {
    const code = event.reason?.code;
    recordAppDiagnostic(typeof code === 'string' && /^auth\/[a-z-]{1,60}$/.test(code) ? code : 'unhandled_rejection');
  };
  const online = () => recordAppDiagnostic('network_online');
  const offline = () => recordAppDiagnostic('network_offline');
  let last = performance.now();
  const visibility = () => {
    last = performance.now();
    recordAppDiagnostic(document.visibilityState === 'hidden' ? 'app_hidden' : 'app_visible');
    flushAppDiagnostics();
  };
  const heartbeat = setInterval(() => {
    const now = performance.now();
    const currentRoute = route();
    if (currentRoute !== lastRoute) { recordAppDiagnostic(currentRoute); lastRoute = currentRoute; }
    if (document.visibilityState === 'visible' && now - last > 6000) recordAppDiagnostic('web_thread_stall', now - last - 2000);
    last = now;
  }, 2000);
  window.addEventListener('error', error);
  window.addEventListener('unhandledrejection', rejection);
  window.addEventListener('online', online);
  window.addEventListener('offline', offline);
  window.addEventListener('pagehide', flushAppDiagnostics);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    clearInterval(heartbeat);
    window.removeEventListener('error', error);
    window.removeEventListener('unhandledrejection', rejection);
    window.removeEventListener('online', online);
    window.removeEventListener('offline', offline);
    window.removeEventListener('pagehide', flushAppDiagnostics);
    document.removeEventListener('visibilitychange', visibility);
    flushAppDiagnostics();
  };
}
