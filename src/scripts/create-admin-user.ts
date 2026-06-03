import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const USERS_COLLECTION = 'users';

async function createAdminUser() {
  try {
    console.log('🔧 Creating Admin User...');
    
    // You can modify this UID with your actual Firebase UID
    // For now, we'll create a user with a common admin UID pattern
    const firebaseUid = 'admin-user-001'; // Replace with your actual UID
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
    console.log('');
    console.log('⚠️  IMPORTANT: This user ID may not match your Firebase Auth UID.');
    console.log('   You may need to update the user ID to match your actual Firebase UID.');
    console.log('   Check the browser console for your actual UID.');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
}

// Run the script
createAdminUser();
