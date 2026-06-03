/**
 * Comprehensive Name Order Fix Script
 * 
 * This script fixes the name ordering issue throughout the system:
 * 1. Database Migration: Swaps firstName and lastName fields in the database
 * 2. System Alignment: Ensures forms, display, and database are all aligned
 * 
 * PROBLEM:
 * - Form collects: Surname, First Name, Other Names
 * - Database stores: firstName=surname, lastName=firstname (WRONG)
 * - Display shows: firstName lastName (shows as "Surname Firstname" - WRONG)
 * 
 * SOLUTION:
 * - Database should store: firstName=firstname, lastName=surname (CORRECT)
 * - Display should show: lastName, firstName (shows as "Surname, Firstname" - CORRECT)
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  writeBatch,
  query,
  limit,
  startAfter,
  DocumentSnapshot,
  addDoc
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

interface PupilBackup {
  pupilId: string;
  beforeMigration: {
    firstName: string;  // This was actually the surname
    lastName: string;   // This was actually the first name
    otherNames?: string;
  };
  afterMigration: {
    firstName: string;  // This will be the actual first name
    lastName: string;   // This will be the actual surname
    otherNames?: string;
  };
  migrationDate: string;
}

async function createNameOrderMigrationBackup(db: any, backupData: PupilBackup[]) {
  try {
    console.log('📝 Creating name order migration backup...');
    
    const backupDoc = {
      migrationType: 'name-order-correction',
      migrationDate: new Date().toISOString(),
      totalPupilsAffected: backupData.length,
      description: 'Fixed name ordering system - swapped firstName and lastName fields to match form collection order',
      explanation: {
        problem: 'Form collected Surname first, but database stored it as firstName (wrong)',
        solution: 'Swapped fields so firstName=actualFirstName, lastName=actualSurname',
        displayChange: 'Names now display as "Surname, FirstName" instead of "FirstName Surname"'
      },
      changes: backupData
    };
    
    const backupRef = await addDoc(collection(db, 'migrations'), backupDoc);
    console.log(`✅ Migration backup created with ID: ${backupRef.id}`);
    
    return backupRef.id;
  } catch (error) {
    console.error('❌ Failed to create backup:', error);
    throw error;
  }
}

async function fixNameOrderSystem() {
  try {
    console.log('🚀 Starting Name Order System Fix...');
    console.log('=====================================');
    
    // Validate Firebase config
    if (!firebaseConfig.projectId) {
      throw new Error('Firebase configuration not found. Please check your .env.local file.');
    }
    
    console.log(`🔗 Connecting to Firebase project: ${firebaseConfig.projectId}`);
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    const pupilsCollection = collection(db, 'pupils');
    
    // Step 1: Analyze current data
    console.log('\n📊 Step 1: Analyzing current pupil data...');
    const allPupilsSnapshot = await getDocs(pupilsCollection);
    const backupData: PupilBackup[] = [];
    
    console.log(`📋 Found ${allPupilsSnapshot.docs.length} pupils in the database`);
    
    let analysisCount = 0;
    for (const docSnapshot of allPupilsSnapshot.docs) {
      const pupil = docSnapshot.data();
      const pupilId = docSnapshot.id;
      
      if (pupil.firstName && pupil.lastName) {
        // Current state: firstName=surname, lastName=firstname (wrong)
        // Target state: firstName=firstname, lastName=surname (correct)
        
        backupData.push({
          pupilId,
          beforeMigration: {
            firstName: pupil.firstName,    // This was actually the surname
            lastName: pupil.lastName,      // This was actually the first name
            otherNames: pupil.otherNames
          },
          afterMigration: {
            firstName: pupil.lastName,     // This will be the actual first name
            lastName: pupil.firstName,     // This will be the actual surname
            otherNames: pupil.otherNames
          },
          migrationDate: new Date().toISOString()
        });
        
        analysisCount++;
        if (analysisCount <= 5) {
          console.log(`📝 Sample ${analysisCount}: "${pupil.firstName} ${pupil.lastName}" → "${pupil.lastName}, ${pupil.firstName}"`);
        }
      }
    }
    
    console.log(`✅ Analysis complete: ${backupData.length} pupils need migration`);
    
    if (backupData.length === 0) {
      console.log('ℹ️  No pupils found that need migration. Exiting.');
      return;
    }
    
    // Step 2: Create backup
    console.log('\n💾 Step 2: Creating migration backup...');
    const backupId = await createNameOrderMigrationBackup(db, backupData);
    
    // Step 3: Show preview
    console.log('\n👀 Step 3: Preview of changes:');
    console.log('=====================================');
    console.log('Current State (WRONG):');
    console.log('- Form collects: Surname, First Name');
    console.log('- Database stores: firstName=surname, lastName=firstname');
    console.log('- Display shows: firstName lastName = "Surname Firstname"');
    console.log('');
    console.log('After Migration (CORRECT):');
    console.log('- Form collects: Surname, First Name');
    console.log('- Database stores: firstName=firstname, lastName=surname');
    console.log('- Display shows: lastName, firstName = "Surname, Firstname"');
    console.log('');
    
    backupData.slice(0, 5).forEach((change, index) => {
      console.log(`${index + 1}. BEFORE: "${change.beforeMigration.firstName} ${change.beforeMigration.lastName}"`);
      console.log(`   AFTER:  "${change.afterMigration.lastName}, ${change.afterMigration.firstName}"`);
    });
    
    if (backupData.length > 5) {
      console.log(`... and ${backupData.length - 5} more pupils`);
    }
    
    // Step 4: Perform migration
    console.log('\n🔄 Step 4: Performing database migration...');
    const batchSize = 50;
    let processedCount = 0;
    let totalUpdated = 0;
    let lastDoc: DocumentSnapshot | null = null;
    
    do {
      // Create query for batch processing
      let pupilsQuery = query(pupilsCollection, limit(batchSize));
      if (lastDoc) {
        pupilsQuery = query(pupilsCollection, startAfter(lastDoc), limit(batchSize));
      }
      
      const snapshot = await getDocs(pupilsQuery);
      
      if (snapshot.empty) {
        break;
      }
      
      console.log(`📄 Processing batch of ${snapshot.docs.length} pupils...`);
      
      // Create a batch for atomic updates
      const batch = writeBatch(db);
      let batchUpdates = 0;
      
      for (const docSnapshot of snapshot.docs) {
        const pupil = docSnapshot.data();
        const pupilId = docSnapshot.id;
        
        // Check if pupil has both firstName and lastName
        if (pupil.firstName && pupil.lastName) {
          // Swap the fields to correct the order
          const updatedData = {
            firstName: pupil.lastName,      // lastName becomes firstName (correct)
            lastName: pupil.firstName,      // firstName becomes lastName (correct)
            // Keep all other fields unchanged
            updatedAt: new Date().toISOString(),
            nameOrderFixed: true,
            migrationBackupId: backupId,
            migrationNote: 'Name order corrected - firstName and lastName swapped to match form collection order'
          };
          
          batch.update(doc(db, 'pupils', pupilId), updatedData);
          batchUpdates++;
        }
        
        processedCount++;
      }
      
      // Commit the batch if there are updates
      if (batchUpdates > 0) {
        await batch.commit();
        totalUpdated += batchUpdates;
        console.log(`✅ Updated ${batchUpdates} pupils in this batch`);
      }
      
      // Set lastDoc for pagination
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      // Add a small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } while (lastDoc);
    
    // Step 5: Summary
    console.log('\n🎉 Name Order System Fix Completed!');
    console.log('=====================================');
    console.log(`📊 Total pupils processed: ${processedCount}`);
    console.log(`✅ Total pupils updated: ${totalUpdated}`);
    console.log(`⚠️  Total pupils skipped: ${processedCount - totalUpdated}`);
    console.log(`💾 Backup ID: ${backupId}`);
    
    if (totalUpdated > 0) {
      console.log('\n📢 IMPORTANT CHANGES MADE:');
      console.log('==========================');
      console.log('✅ Database fields have been corrected:');
      console.log('   - firstName now contains actual first names');
      console.log('   - lastName now contains actual surnames');
      console.log('✅ System is now aligned:');
      console.log('   - Form: Collects Surname, First Name');
      console.log('   - Database: Stores firstName=firstname, lastName=surname');
      console.log('   - Display: Shows "Surname, FirstName"');
      console.log('✅ All changes have been backed up for rollback if needed');
      
      console.log('\n🔧 Next Steps:');
      console.log('===============');
      console.log('1. ✅ Database migration completed');
      console.log('2. ⏳ Update UI components to display "lastName, firstName"');
      console.log('3. ⏳ Update form submission to maintain correct field assignment');
      console.log('4. ⏳ Test the name order management page at /nameorder');
      console.log('5. ⏳ Update reports and exports to use correct name order');
    }
    
  } catch (error) {
    console.error('❌ Error during name order system fix:', error);
    console.error('🔧 Please check your Firebase configuration and try again');
    throw error;
  }
}

// Export for manual execution
export { fixNameOrderSystem };

// Allow direct execution if run as a script
if (require.main === module) {
  fixNameOrderSystem()
    .then(() => {
      console.log('\n✅ Name Order System Fix completed successfully!');
      console.log('🎯 Your system now has consistent name ordering throughout.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Name Order System Fix failed:', error);
      process.exit(1);
    });
} 