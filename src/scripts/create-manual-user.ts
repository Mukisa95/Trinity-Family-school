import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { readline } from 'readline';

const USERS_COLLECTION = 'users';
const STAFF_COLLECTION = 'staff';

// Simple readline implementation for Node.js
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createManualUser() {
  try {
    console.log('🔧 Manual User Creation Tool');
    console.log('This will create a user record in the users collection.\n');
    
    // Get user input
    const userId = await askQuestion('Enter the Firebase User ID (UID): ');
    const username = await askQuestion('Enter username: ');
    const email = await askQuestion('Enter email: ');
    const firstName = await askQuestion('Enter first name: ');
    const lastName = await askQuestion('Enter last name: ');
    const staffId = await askQuestion('Enter staff ID (optional, press Enter to skip): ');
    
    if (!userId || !username || !firstName || !lastName) {
      console.log('❌ User ID, username, first name, and last name are required!');
      return;
    }
    
    // Check if user already exists
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      console.log('❌ User already exists with this ID!');
      return;
    }
    
    // Verify staff ID if provided
    if (staffId) {
      const staffDocRef = doc(db, STAFF_COLLECTION, staffId);
      const staffDocSnap = await getDoc(staffDocRef);
      
      if (!staffDocSnap.exists()) {
        console.log('⚠️  Warning: Staff ID not found in staff collection');
        const continueAnyway = await askQuestion('Continue anyway? (y/n): ');
        if (continueAnyway.toLowerCase() !== 'y') {
          console.log('❌ User creation cancelled');
          return;
        }
      } else {
        const staffData = staffDocSnap.data();
        console.log(`✅ Found staff member: ${staffData.firstName} ${staffData.lastName}`);
      }
    }
    
    // Create user data
    const userData = {
      username,
      email: email || undefined,
      role: 'Staff',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      firstName,
      lastName,
      ...(staffId && { staffId }),
    };
    
    // Create the user document
    await setDoc(userDocRef, userData);
    
    console.log('\n✅ User created successfully!');
    console.log(`   - User ID: ${userId}`);
    console.log(`   - Username: ${username}`);
    console.log(`   - Name: ${firstName} ${lastName}`);
    console.log(`   - Email: ${email || 'N/A'}`);
    console.log(`   - Staff ID: ${staffId || 'N/A'}`);
    console.log(`   - Role: Staff`);
    
    console.log('\n🎉 User record created!');
    console.log('🔄 Please refresh your browser to see the updated digital signatures.');
    
  } catch (error) {
    console.error('❌ Error creating user:', error);
  }
}

// Run the script
createManualUser();
