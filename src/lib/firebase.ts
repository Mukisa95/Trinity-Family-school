import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  enableNetwork,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCMFVoGNdrBAuPoDjaNpsgionEnkq45JSA").trim(),
  authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "trinity-family-schools.firebaseapp.com").trim(),
  projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "trinity-family-schools").trim(),
  storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "trinity-family-schools.appspot.com").trim(),
  messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "488395806096").trim(),
  appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:488395806096:web:a8e8f2b4c7d6e9f0a1b2c3").trim(),
};

const isBrowser = typeof window !== 'undefined';
const isLocalDev = isBrowser && window.location.hostname === 'localhost';
const isEmbeddedBrowser = isBrowser && /CursorBrowser|Electron|wv/i.test(navigator.userAgent);
const shouldForceLongPolling = isLocalDev || isEmbeddedBrowser;

// Initialize Firebase — singleton to prevent duplicate instances (e.g. during HMR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with persistent multi-tab cache.
// Uses try/catch singleton pattern: initializeFirestore throws if called twice,
// so the catch ensures we safely reuse the already-initialized instance.
// persistentLocalCache + persistentMultipleTabManager replaces the deprecated
// enableMultiTabIndexedDbPersistence and eliminates "Failed to obtain primary lease" errors.
let db: ReturnType<typeof getFirestore>;

try {
  db = initializeFirestore(app, isBrowser
    ? {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
        experimentalForceLongPolling: shouldForceLongPolling,
        experimentalAutoDetectLongPolling: !shouldForceLongPolling,
        // Embedded browsers can be unreliable with fetch streams for Firestore listeners.
        ...(shouldForceLongPolling ? ({ useFetchStreams: false } as any) : {}),
      }
    : {});
} catch {
  // initializeFirestore throws "Firestore has already been started" on re-import / HMR.
  // In that case, retrieve the existing properly-configured instance.
  db = getFirestore(app);
}

export { db };
export const firebaseProjectId = firebaseConfig.projectId;

// Reconnect when the device comes back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    enableNetwork(db).catch(() => { /* already connected */ });
  });
}

// Initialize Auth & Storage
export const auth = getAuth(app);
export const storage = getStorage(app);

// Analytics disabled to avoid console noise
export const analytics = null;

export default app;
