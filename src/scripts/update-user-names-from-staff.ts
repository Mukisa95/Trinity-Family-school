import { db } from '../lib/firebase';
import { collection, getDocs, updateDoc, doc, query, where, getDoc } from 'firebase/firestore';
import { UsersService } from '../lib/services/users.service';

const USERS_COLLECTION = 'users';
const STAFF_COLLECTION = 'staff';

async function updateUserNamesFromStaff() {
  try {
    console.log('🔍 Scanning for users with missing names...');
    
    // Get all users
    const usersRef = collection(db, USERS_COLLECTION);
    const usersSnapshot = await getDocs(usersRef);
    
    let updatedCount = 0;
    let totalCount = usersSnapshot.docs.length;
    
    console.log(`📊 Found ${totalCount} users to check`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Check if user has staffId but missing firstName or lastName
      if (userData.staffId && (!userData.firstName || !userData.lastName)) {
        console.log(`🔧 Checking user ${userDoc.id} with staffId: ${userData.staffId}`);
        
        try {
          // Get staff data
          const staffDocRef = doc(db, STAFF_COLLECTION, userData.staffId);
          const staffDocSnap = await getDoc(staffDocRef);
          
          if (staffDocSnap.exists()) {
            const staffData = staffDocSnap.data();
            
            // Prepare update data
            const updateData: any = {};
            let needsUpdate = false;
            
            if (!userData.firstName && staffData.firstName) {
              updateData.firstName = staffData.firstName;
              needsUpdate = true;
            }
            
            if (!userData.lastName && staffData.lastName) {
              updateData.lastName = staffData.lastName;
              needsUpdate = true;
            }
            
            if (needsUpdate) {
              await updateDoc(doc(db, USERS_COLLECTION, userDoc.id), updateData);
              
              console.log(`✅ Updated user ${userDoc.id}:`);
              if (updateData.firstName) console.log(`   - firstName: "${userData.firstName}" → "${updateData.firstName}"`);
              if (updateData.lastName) console.log(`   - lastName: "${userData.lastName}" → "${updateData.lastName}"`);
              
              updatedCount++;
            } else {
              console.log(`ℹ️  User ${userDoc.id} already has complete name data`);
            }
          } else {
            console.log(`⚠️  Staff record not found for staffId: ${userData.staffId}`);
          }
        } catch (error) {
          console.log(`❌ Error updating user ${userDoc.id}:`, error);
        }
      } else if (!userData.staffId) {
        console.log(`ℹ️  User ${userDoc.id} has no staffId, skipping`);
      } else {
        console.log(`ℹ️  User ${userDoc.id} already has complete name data`);
      }
    }
    
    console.log('\n🎉 User name update completed!');
    console.log(`📈 Summary:`);
    console.log(`   - Users updated: ${updatedCount}/${totalCount}`);
    console.log(`   - Users with staffId: ${usersSnapshot.docs.filter(doc => doc.data().staffId).length}`);
    
    if (updatedCount > 0) {
      console.log('\n✨ User names have been updated from staff records!');
      console.log('🔄 Please refresh your browser or log out and log back in to see the changes.');
    } else {
      console.log('\n✨ No users needed name updates - all names were already complete!');
    }
    
  } catch (error) {
    console.error('❌ Error updating user names:', error);
    process.exit(1);
  }
}

// Run the script
updateUserNamesFromStaff();
