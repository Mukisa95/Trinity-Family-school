import { auth } from '@/lib/firebase';
export async function authorizedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('Please sign in again.');
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${await auth.currentUser.getIdToken()}`);
  return fetch(input, { ...init, headers, cache: 'no-store' });
}
