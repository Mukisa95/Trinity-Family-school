// Session-owned state, never persisted and never an authority for server access.
let savedOnly = false;
let fetchGuardInstalled = false;
export const isSavedWorkspaceView = () => savedOnly;
export function setSavedWorkspaceView(value: boolean) {
  savedOnly = value;
  if (fetchGuardInstalled || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  fetchGuardInstalled = true;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
    // Authentication and the existing read-only projection POST remain usable.
    if (savedOnly && url.origin === location.origin && url.pathname.startsWith('/api/')
      && !url.pathname.startsWith('/api/auth/') && url.pathname !== '/api/access/circumference'
      && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      try { assertLiveWorkspace(); } catch (error) { return Promise.reject(error); }
    }
    return original(input, init);
  };
}
export function assertLiveWorkspace() {
  if (savedOnly) throw Object.assign(new Error('Your saved workspace is read-only while your secure session is being verified.'), { code: 'app/verification-pending' });
}
