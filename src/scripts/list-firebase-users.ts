import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

const USERS_COLLECTION = 'users';
const STAFF_COLLECTION = 'staff';

async function listFirebaseUsers() {
  try {
    console.log('🔍 Listing all users and staff members...\n');
    
    // List staff members
    console.log('📊 STAFF MEMBERS:');
    console.log('================');
    const staffRef = collection(db, STAFF_COLLECTION);
    const staffSnapshot = await getDocs(staffRef);
    
    staffSnapshot.docs.forEach((staffDoc, index) => {
      const staffData = staffDoc.data();
      console.log(`${index + 1}. Staff ID: ${staffDoc.id}`);
      console.log(`   Name: ${staffData.firstName} ${staffData.lastName}`);
      console.log(`   Role: ${staffData.role || 'N/A'}`);
      console.log(`   Email: ${staffData.email || 'N/A'}`);
      console.log('');
    });
    
    // List existing users
    console.log('📊 EXISTING USERS:');
    console.log('==================');
    const usersRef = collection(db, USERS_COLLECTION);
    const usersSnapshot = await getDocs(usersRef);
    
    if (usersSnapshot.docs.length === 0) {
      console.log('No users found in users collection.\n');
    } else {
      usersSnapshot.docs.forEach((userDoc, index) => {
        const userData = userDoc.data();
        console.log(`${index + 1}. User ID: ${userDoc.id}`);
        console.log(`   Username: ${userData.username || 'N/A'}`);
        console.log(`   Name: ${userData.firstName || 'N/A'} ${userData.lastName || 'N/A'}`);
        console.log(`   Email: ${userData.email || 'N/A'}`);
        console.log(`   Staff ID: ${userData.staffId || 'N/A'}`);
        console.log(`   Role: ${userData.role || 'N/A'}`);
        console.log('');
      });
    }
    
    console.log('💡 TO CREATE A USER:');
    console.log('====================');
    console.log('1. Find the staff member you want to create a user for');
    console.log('2. Note their Staff ID');
    console.log('3. Run: npm run create-manual-user');
    console.log('4. You will need the Firebase User ID (UID) from the browser console');
    console.log('');
    console.log('🔍 TO GET FIREBASE UID:');
    console.log('========================');
    console.log('1. Open browser developer tools (F12)');
    console.log('2. Go to Console tab');
    console.log('3. Type: firebase.auth().currentUser.uid');
    console.log('4. Copy the UID that appears');
    console.log('5. Use this UID when creating the user');
    
  } catch (error) {
    console.error('❌ Error listing users:', error);
  }
}

// Run the script
listFirebaseUsers();
