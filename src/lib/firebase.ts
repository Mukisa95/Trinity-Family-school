import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCMFVoGNdrBAuPoDjaNpsgionEnkq45JSA").trim(),
  authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "trinity-family-schools.firebaseapp.com").trim(),
  projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "trinity-family-schools").trim(),
  storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "trinity-family-schools.appspot.com").trim(),
  messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "488395806096").trim(),
  appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:488395806096:web:a8e8f2b4c7d6e9f0a1b2c3").trim(),
  // Temporarily remove measurementId to disable Analytics
  // measurementId: "G-Z3G3D3EXRW"
};


// Initialize Firebase with singleton pattern to prevent multiple instances
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with singleton pattern
let db: any = null;
try {
  db = getFirestore(app);
} catch (error) {
  // If getFirestore fails, try to get the existing instance
  db = getFirestore();
}

export { db };

// Configure Firestore settings for better offline handling and CORS
if (typeof window !== 'undefined' && db) {
  // Enable offline persistence for better performance and offline support
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn('Firestore persistence already enabled in another tab');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Firestore persistence not supported in this browser');
    } else {
      console.warn('Failed to enable Firestore persistence:', err);
    }
  });

  // Simplified connection handling to prevent "Target ID already exists" errors
  const initializeConnection = async () => {
    try {
      // Only try to enable network if not already connected
      await enableNetwork(db);
      console.log('Firestore connected successfully');
    } catch (error: any) {
      // Handle known Firebase connection issues gracefully
      if (error?.message && (
        error.message.includes('Target ID already exists') ||
        error.message.includes('Failed to obtain primary lease') ||
        error.message.includes('Release target')
      )) {
        console.log('Firestore connection managed (expected behavior)');
      } else {
        console.warn('Firestore connection issue:', error);
      }
    }
  };

  // Initialize connection
  initializeConnection();

  // Handle online/offline events
  window.addEventListener('online', () => {
    console.log('Network restored, checking Firestore connection...');
    initializeConnection();
  });

  window.addEventListener('offline', () => {
    console.log('Network lost, Firestore will use cache');
  });
}

// Initialize Auth
export const auth = getAuth(app);

// Initialize Storage
export const storage = getStorage(app);

// Disable Analytics temporarily to avoid console errors
export const analytics = null;
// export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app; 