import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';

/**
 * Creates the server-only Firebase Admin app used by protected operational pages.
 * Browser Firebase configuration is intentionally not used here: it cannot access
 * Cloud Monitoring or a project's billing/usage metrics.
 */
export function getFirebaseAdminApp(): App {
  if (getApps().length) return getApp();

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const storageBucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  // On Firebase/Google Cloud, the default application credentials are available
  // automatically. On Vercel or another host, use the three FIREBASE_ADMIN_* vars.
  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
      storageBucket,
    });
  }

  return initializeApp({ projectId, storageBucket });
}

export function getFirebaseAdminProjectId(): string | undefined {
  return process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
}
