import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const USERS_COLLECTION = 'users';
const STAFF_COLLECTION = 'staff';

async function autoCreateUser() {
  try {
    console.log('🔧 Auto User Creation Tool');
    console.log('This will create a user record for the current Firebase Auth user.\n');
    
    // Since we can't access the browser's Firebase Auth session from Node.js,
    // we'll create a user record for a common admin user
    // You can modify this script with your actual Firebase UID
    
    const commonAdminUids = [
      // Add common admin UIDs here - you can get these from Firebase Console
      // For now, we'll create a sample admin user
    ];
    
    console.log('Since we cannot access the browser Firebase Auth session from Node.js,');
    console.log('we need to create the user record manually.\n');
    
    console.log('📋 INSTRUCTIONS:');
    console.log('================');
    console.log('1. Open your browser and go to http://localhost:9004');
    console.log('2. Open Developer Tools (F12)');
    console.log('3. Go to Console tab');
    console.log('4. Type: firebase.auth().currentUser.uid');
    console.log('5. Copy the UID that appears');
    console.log('6. Run: npm run create-manual-user');
    console.log('7. Enter the UID when prompted');
    console.log('');
    
    console.log('💡 ALTERNATIVE - Create Admin User:');
    console.log('===================================');
    console.log('If you want to create a general admin user, you can use this script.');
    console.log('Modify the script with your Firebase UID and run it.\n');
    
    // Example: Create a user record for a specific UID
    // Uncomment and modify the following lines with your actual Firebase UID
    
    /*
    const firebaseUid = 'YOUR_FIREBASE_UID_HERE'; // Replace with your actual UID
    const username = 'admin';
    const email = 'admin@trinityfamilyschool.com';
    const firstName = 'Admin';
    const lastName = 'User';
    
    // Check if user already exists
    const userDocRef = doc(db, USERS_COLLECTION, firebaseUid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      console.log('✅ User already exists!');
      const userData = userDocSnap.data();
      console.log(`   - Username: ${userData.username}`);
      console.log(`   - Name: ${userData.firstName} ${userData.lastName}`);
      return;
    }
    
    // Create user data
    const userData = {
      username,
      email,
      role: 'Admin',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      firstName,
      lastName,
    };
    
    // Create the user document
    await setDoc(userDocRef, userData);
    
    console.log('✅ Admin user created successfully!');
    console.log(`   - User ID: ${firebaseUid}`);
    console.log(`   - Username: ${username}`);
    console.log(`   - Name: ${firstName} ${lastName}`);
    console.log(`   - Role: Admin`);
    */
    
    console.log('🔍 To find your Firebase UID:');
    console.log('=============================');
    console.log('1. Go to http://localhost:9004 in your browser');
    console.log('2. Make sure you are logged in');
    console.log('3. Open Developer Tools (F12)');
    console.log('4. Go to Console tab');
    console.log('5. Type: firebase.auth().currentUser.uid');
    console.log('6. Copy the UID');
    console.log('7. Run: npm run create-manual-user');
    console.log('8. Enter the UID when prompted');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
autoCreateUser();
