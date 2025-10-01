import { db } from '../lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

const USERS_COLLECTION = 'users';
const STAFF_COLLECTION = 'staff';

async function debugUserData() {
  try {
    console.log('🔍 Debugging user and staff data...');
    
    // Check users collection
    console.log('\n📊 Checking users collection...');
    const usersRef = collection(db, USERS_COLLECTION);
    const usersSnapshot = await getDocs(usersRef);
    
    console.log(`Found ${usersSnapshot.docs.length} users:`);
    usersSnapshot.docs.forEach((userDoc, index) => {
      const userData = userDoc.data();
      console.log(`  ${index + 1}. User ID: ${userDoc.id}`);
      console.log(`     - Username: ${userData.username || 'N/A'}`);
      console.log(`     - First Name: ${userData.firstName || 'N/A'}`);
      console.log(`     - Last Name: ${userData.lastName || 'N/A'}`);
      console.log(`     - Staff ID: ${userData.staffId || 'N/A'}`);
      console.log(`     - Role: ${userData.role || 'N/A'}`);
      console.log('');
    });
    
    // Check staff collection
    console.log('\n📊 Checking staff collection...');
    const staffRef = collection(db, STAFF_COLLECTION);
    const staffSnapshot = await getDocs(staffRef);
    
    console.log(`Found ${staffSnapshot.docs.length} staff members:`);
    staffSnapshot.docs.forEach((staffDoc, index) => {
      const staffData = staffDoc.data();
      console.log(`  ${index + 1}. Staff ID: ${staffDoc.id}`);
      console.log(`     - First Name: ${staffData.firstName || 'N/A'}`);
      console.log(`     - Last Name: ${staffData.lastName || 'N/A'}`);
      console.log(`     - Role: ${staffData.role || 'N/A'}`);
      console.log('');
    });
    
    // Check if there are any users with staffId but missing names
    console.log('\n🔍 Checking for users with staffId but missing names...');
    const usersWithStaffId = usersSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.staffId && (!data.firstName || !data.lastName);
    });
    
    if (usersWithStaffId.length > 0) {
      console.log(`Found ${usersWithStaffId.length} users with staffId but missing names:`);
      usersWithStaffId.forEach((userDoc, index) => {
        const userData = userDoc.data();
        console.log(`  ${index + 1}. User ID: ${userDoc.id}`);
        console.log(`     - Username: ${userData.username}`);
        console.log(`     - Staff ID: ${userData.staffId}`);
        console.log(`     - First Name: ${userData.firstName || 'MISSING'}`);
        console.log(`     - Last Name: ${userData.lastName || 'MISSING'}`);
        
        // Try to get staff data
        if (userData.staffId) {
          try {
            const staffDocRef = doc(db, STAFF_COLLECTION, userData.staffId);
            const staffDocSnap = getDoc(staffDocRef);
            staffDocSnap.then(snap => {
              if (snap.exists()) {
                const staffData = snap.data();
                console.log(`     - Staff First Name: ${staffData.firstName || 'N/A'}`);
                console.log(`     - Staff Last Name: ${staffData.lastName || 'N/A'}`);
              } else {
                console.log(`     - Staff record not found for staffId: ${userData.staffId}`);
              }
            });
          } catch (error) {
            console.log(`     - Error fetching staff data: ${error}`);
          }
        }
        console.log('');
      });
    } else {
      console.log('✅ No users found with staffId but missing names');
    }
    
  } catch (error) {
    console.error('❌ Error debugging user data:', error);
  }
}

// Run the script
debugUserData();
