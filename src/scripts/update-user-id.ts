import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const USERS_COLLECTION = 'users';

async function updateUserId() {
  try {
    console.log('🔧 User ID Update Tool');
    console.log('This will update the user ID to match your Firebase Auth UID.\n');
    
    const oldUserId = 'admin-user-001';
    const newUserId = 'YOUR_FIREBASE_UID_HERE'; // Replace with your actual UID
    
    console.log('⚠️  IMPORTANT: You need to replace "YOUR_FIREBASE_UID_HERE" with your actual Firebase UID.');
    console.log('   Get your UID from the browser console: firebase.auth().currentUser.uid\n');
    
    if (newUserId === 'YOUR_FIREBASE_UID_HERE') {
      console.log('❌ Please update the script with your actual Firebase UID first!');
      console.log('');
      console.log('📋 INSTRUCTIONS:');
      console.log('================');
      console.log('1. Open http://localhost:9004 in your browser');
      console.log('2. Open Developer Tools (F12)');
      console.log('3. Go to Console tab');
      console.log('4. Type: firebase.auth().currentUser.uid');
      console.log('5. Copy the UID that appears');
      console.log('6. Edit this script and replace "YOUR_FIREBASE_UID_HERE" with your actual UID');
      console.log('7. Run this script again');
      return;
    }
    
    // Get the existing user data
    const oldUserDocRef = doc(db, USERS_COLLECTION, oldUserId);
    const oldUserDocSnap = await getDoc(oldUserDocRef);
    
    if (!oldUserDocSnap.exists()) {
      console.log('❌ Old user record not found!');
      return;
    }
    
    const userData = oldUserDocSnap.data();
    console.log('📋 Current user data:');
    console.log(`   - Username: ${userData.username}`);
    console.log(`   - Name: ${userData.firstName} ${userData.lastName}`);
    console.log(`   - Email: ${userData.email}`);
    console.log(`   - Role: ${userData.role}`);
    
    // Check if new user ID already exists
    const newUserDocRef = doc(db, USERS_COLLECTION, newUserId);
    const newUserDocSnap = await getDoc(newUserDocRef);
    
    if (newUserDocSnap.exists()) {
      console.log('⚠️  User with new ID already exists!');
      const existingData = newUserDocSnap.data();
      console.log(`   - Username: ${existingData.username}`);
      console.log(`   - Name: ${existingData.firstName} ${existingData.lastName}`);
      return;
    }
    
    // Create new user record with correct ID
    await setDoc(newUserDocRef, userData);
    
    // Delete old user record
    await deleteDoc(oldUserDocRef);
    
    console.log('\n✅ User ID updated successfully!');
    console.log(`   - Old ID: ${oldUserId}`);
    console.log(`   - New ID: ${newUserId}`);
    console.log(`   - Username: ${userData.username}`);
    console.log(`   - Name: ${userData.firstName} ${userData.lastName}`);
    console.log('');
    console.log('🔄 Please refresh your browser to see the updated digital signatures!');
    
  } catch (error) {
    console.error('❌ Error updating user ID:', error);
  }
}

// Run the script
updateUserId();
