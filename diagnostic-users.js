/**
 * Quick diagnostic script to check where users are stored
 * Run this in browser console while on /users page
 */

// Check what the Users page is showing
console.log('=== USERS PAGE DIAGNOSTIC ===');

// 1. Check React Query cache for 'users' key
const queryClient = window.__REACT_QUERY_DEVTOOLS_GLOBAL_HOOK__?.queryClient;
if (queryClient) {
    const usersData = queryClient.getQueryData(['users']);
    console.log('📊 Users in React Query cache:', usersData?.length || 0);
    if (usersData) {
        console.log('Sample user:', usersData[0]);
    }
}

// 2. Check Firestore directly
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

async function checkFirestore() {
    console.log('\n=== FIRESTORE CHECK ===');

    // Check users collection
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`📁 'users' collection: ${usersSnap.size} documents`);

    // Check staff collection  
    const staffSnap = await getDocs(collection(db, 'staff'));
    console.log(`📁 'staff' collection: ${staffSnap.size} documents`);

    // Check pupils collection
    const pupilsSnap = await getDocs(collection(db, 'pupils'));
    console.log(`📁 'pupils' collection: ${pupilsSnap.size} documents`);

    console.log('\n✅ Run this in browser console on /users page');
}

checkFirestore();
