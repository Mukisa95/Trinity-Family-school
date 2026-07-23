import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

let serverAuthPromise: Promise<void> | null = null;

/**
 * Compatibility bridge for existing server routes that still call services
 * implemented with the Firebase Web SDK. The Vercel service account mints a
 * short-lived server-only Firebase identity before those services access
 * Firestore, so closing public rules does not break webhooks or cron jobs.
 */
export function ensureServerFirestoreAuth() {
  if (typeof window !== 'undefined') {
    return Promise.reject(new Error('Server Firestore authentication cannot run in a browser.'));
  }
  if (auth.currentUser && !auth.currentUser.isAnonymous) return Promise.resolve();
  if (serverAuthPromise) return serverAuthPromise;

  serverAuthPromise = (async () => {
    const customToken = await getAdminAuth(getFirebaseAdminApp()).createCustomToken(
      'trinity-vercel-server',
      {
        appUser: true,
        isActive: true,
        serverApp: true,
        role: 'Server',
      },
    );
    await signInWithCustomToken(auth, customToken);
  })().catch(error => {
    serverAuthPromise = null;
    throw error;
  });

  return serverAuthPromise;
}
