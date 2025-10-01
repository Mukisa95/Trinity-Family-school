import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig, 'test-rules-app');
} else {
  app = getApps().find(a => a.name === 'test-rules-app') || getApps()[0];
}

const storage = getStorage(app);
const auth = getAuth(app);

export async function GET() {
  const results: {
    tests: Array<{
      name: string;
      success: boolean;
      details: any;
    }>;
    summary: {
      passed: number;
      failed: number;
      total: number;
    };
  } = {
    tests: [],
    summary: {
      passed: 0,
      failed: 0,
      total: 0
    }
  };

  function addTest(name: string, success: boolean, details: any) {
    results.tests.push({
      name,
      success,
      details
    });
    if (success) results.summary.passed++;
    else results.summary.failed++;
    results.summary.total++;
  }

  try {
    console.log('🧪 Starting Firebase Storage rules test...');

    // Test 1: Authentication
    try {
      const userCredential = await signInAnonymously(auth);
      addTest('Anonymous Authentication', true, {
        uid: userCredential.user.uid,
        isAnonymous: userCredential.user.isAnonymous
      });
    } catch (authError: any) {
      addTest('Anonymous Authentication', false, {
        error: authError.message,
        code: authError.code
      });
      return NextResponse.json(results);
    }

    // Test 2: List root directory (should work with read: true)
    try {
      const rootRef = ref(storage, '/');
      const listResult = await listAll(rootRef);
      addTest('List Root Directory', true, {
        itemsCount: listResult.items.length,
        prefixesCount: listResult.prefixes.length
      });
    } catch (listError: any) {
      addTest('List Root Directory', false, {
        error: listError.message,
        code: listError.code
      });
    }

    // Test 3: List school-photos directory
    try {
      const schoolPhotosRef = ref(storage, 'school-photos/');
      const listResult = await listAll(schoolPhotosRef);
      addTest('List school-photos Directory', true, {
        itemsCount: listResult.items.length,
        prefixesCount: listResult.prefixes.length
      });
    } catch (listError: any) {
      addTest('List school-photos Directory', false, {
        error: listError.message,
        code: listError.code
      });
    }

    // Test 4: Upload a small test file
    try {
      const testData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const testRef = ref(storage, 'school-photos/test/rules-test.txt');
      
      const uploadResult = await uploadBytes(testRef, testData, {
        contentType: 'text/plain',
        customMetadata: {
          test: 'rules-diagnostic',
          timestamp: new Date().toISOString()
        }
      });

      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      addTest('Upload Test File', true, {
        path: uploadResult.ref.fullPath,
        downloadURL: downloadURL,
        size: uploadResult.metadata.size
      });
    } catch (uploadError: any) {
      addTest('Upload Test File', false, {
        error: uploadError.message,
        code: uploadError.code,
        serverResponse: uploadError.customData?.serverResponse || 'No server response'
      });
    }

    // Test 5: Try upload to other directory (should fail)
    try {
      const testData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const testRef = ref(storage, 'unauthorized/test.txt');
      
      await uploadBytes(testRef, testData);
      addTest('Upload to Unauthorized Directory', false, {
        note: 'This should have failed but succeeded - rules may be too permissive'
      });
    } catch (uploadError: any) {
      addTest('Upload to Unauthorized Directory', true, {
        note: 'Correctly blocked unauthorized upload',
        error: uploadError.message,
        code: uploadError.code
      });
    }

    return NextResponse.json({
      ...results,
      bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      timestamp: new Date().toISOString(),
      message: results.summary.failed === 0 
        ? 'All tests passed! Firebase Storage should work.' 
        : `${results.summary.failed} tests failed. Check the details.`
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Test suite failed',
      details: error.message,
      results
    }, { status: 500 });
  }
} 