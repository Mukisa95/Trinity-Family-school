import { auth } from '@/lib/firebase';
import { assertLiveWorkspace } from '@/lib/auth/saved-view';
export async function authorizedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!['GET', 'HEAD', 'OPTIONS'].includes((init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase())) assertLiveWorkspace();
  if (!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('Please sign in again.');
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${await auth.currentUser.getIdToken()}`);
  return fetch(input, { ...init, headers, cache: 'no-store' });
}
