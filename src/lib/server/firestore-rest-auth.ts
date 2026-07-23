import { getFirebaseAdminApp } from '@/lib/firebase-admin';

export async function getServerFirestoreRestHeaders() {
  const credential = getFirebaseAdminApp().options.credential;
  if (!credential) throw new Error('Firebase Admin credentials are not configured.');
  const token = await credential.getAccessToken();
  if (!token.access_token) throw new Error('Could not obtain a Firebase Admin access token.');
  return {
    Authorization: `Bearer ${token.access_token}`,
    'Content-Type': 'application/json',
  };
}
