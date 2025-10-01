import { db, auth } from '../lib/firebase';
import { collection, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const USERS_COLLECTION = 'users';
const STAFF_COLLECTION = 'staff';

async function createUserFromFirebaseAuth() {
  try {
    console.log('🔍 Checking Firebase Auth and creating user record...');
    
    return new Promise<void>((resolve, reject) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          console.log('❌ No Firebase user is currently authenticated');
          console.log('Please log in to the application first, then run this script');
          resolve();
          return;
        }
        
        console.log(`✅ Found authenticated user: ${firebaseUser.uid}`);
        console.log(`   - Email: ${firebaseUser.email || 'N/A'}`);
        console.log(`   - Display Name: ${firebaseUser.displayName || 'N/A'}`);
        
        try {
          // Check if user already exists in users collection
          const userDocRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            console.log('ℹ️  User already exists in users collection');
            const userData = userDocSnap.data();
            console.log(`   - Username: ${userData.username || 'N/A'}`);
            console.log(`   - First Name: ${userData.firstName || 'N/A'}`);
            console.log(`   - Last Name: ${userData.lastName || 'N/A'}`);
            console.log(`   - Staff ID: ${userData.staffId || 'N/A'}`);
            resolve();
            return;
          }
          
          // Create new user record
          console.log('🔧 Creating new user record...');
          
          // Try to find matching staff member by email or name
          let staffData = null;
          const staffRef = collection(db, STAFF_COLLECTION);
          const staffSnapshot = await getDocs(staffRef);
          
          // Look for staff member with matching email or name
          for (const staffDoc of staffSnapshot.docs) {
            const staff = staffDoc.data();
            const staffEmail = staff.email?.toLowerCase();
            const firebaseEmail = firebaseUser.email?.toLowerCase();
            
            // Check email match
            if (staffEmail && firebaseEmail && staffEmail === firebaseEmail) {
              staffData = { id: staffDoc.id, ...staff };
              console.log(`✅ Found matching staff member by email: ${staff.firstName} ${staff.lastName}`);
              break;
            }
            
            // Check name match (if display name is available)
            if (firebaseUser.displayName) {
              const displayName = firebaseUser.displayName.toLowerCase();
              const staffName = `${staff.firstName} ${staff.lastName}`.toLowerCase();
              if (displayName === staffName) {
                staffData = { id: staffDoc.id, ...staff };
                console.log(`✅ Found matching staff member by name: ${staff.firstName} ${staff.lastName}`);
                break;
              }
            }
          }
          
          // Create user data
          const userData = {
            username: firebaseUser.displayName || firebaseUser.email || firebaseUser.uid,
            email: firebaseUser.email,
            role: 'Staff', // Default role
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            
            // Add staff data if found
            ...(staffData && {
              staffId: staffData.id,
              firstName: staffData.firstName,
              lastName: staffData.lastName,
            }),
            
            // Add Firebase display name if no staff data
            ...(!staffData && firebaseUser.displayName && {
              firstName: firebaseUser.displayName.split(' ')[0],
              lastName: firebaseUser.displayName.split(' ').slice(1).join(' '),
            }),
          };
          
          // Create the user document
          await setDoc(userDocRef, userData);
          
          console.log('✅ User record created successfully!');
          console.log(`   - User ID: ${firebaseUser.uid}`);
          console.log(`   - Username: ${userData.username}`);
          console.log(`   - First Name: ${userData.firstName || 'N/A'}`);
          console.log(`   - Last Name: ${userData.lastName || 'N/A'}`);
          console.log(`   - Staff ID: ${userData.staffId || 'N/A'}`);
          console.log(`   - Role: ${userData.role}`);
          
          if (staffData) {
            console.log('\n🎉 User has been linked to staff record!');
            console.log('🔄 Please refresh your browser to see the updated digital signatures.');
          } else {
            console.log('\n⚠️  User created but not linked to any staff record.');
            console.log('You may need to manually link this user to a staff member.');
          }
          
        } catch (error) {
          console.error('❌ Error creating user record:', error);
          reject(error);
        }
        
        resolve();
      });
    });
    
  } catch (error) {
    console.error('❌ Error in createUserFromFirebaseAuth:', error);
    process.exit(1);
  }
}

// Run the script
createUserFromFirebaseAuth();
