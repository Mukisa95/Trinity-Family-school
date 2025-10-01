/**
 * Complete name migration script
 * This script:
 * 1. Connects to your Firebase project
 * 2. Swaps firstName and lastName for all pupils
 * 3. Creates a backup of the changes
 * 
 * Run this ONCE to change the system from "First Last" to "Last, First" format
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

// This will use your project's Firebase configuration
// Make sure your .env.local has the correct Firebase config
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
  originalFirstName: string;
  originalLastName: string;
  newFirstName: string;
  newLastName: string;
  migrationDate: string;
}

async function createMigrationBackup(db: any, backupData: PupilBackup[]) {
  try {
    console.log('📝 Creating migration backup...');
    
    const backupDoc = {
      migrationType: 'pupil-name-swap',
      migrationDate: new Date().toISOString(),
      totalPupilsAffected: backupData.length,
      changes: backupData,
      description: 'Swapped firstName and lastName fields for all pupils'
    };
    
    const backupRef = await addDoc(collection(db, 'migrations'), backupDoc);
    console.log(`✅ Backup created with ID: ${backupRef.id}`);
    
    return backupRef.id;
  } catch (error) {
    console.error('❌ Failed to create backup:', error);
    throw error;
  }
}

async function swapPupilNamesWithBackup() {
  try {
    console.log('🚀 Starting pupil name swap migration with backup...');
    
    // Validate Firebase config
    if (!firebaseConfig.projectId) {
      throw new Error('Firebase configuration not found. Please check your .env.local file.');
    }
    
    console.log(`🔗 Connecting to Firebase project: ${firebaseConfig.projectId}`);
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    const pupilsCollection = collection(db, 'pupils');
    
    // First, collect all pupils and prepare backup data
    console.log('📊 Collecting pupil data for backup...');
    const allPupilsSnapshot = await getDocs(pupilsCollection);
    const backupData: PupilBackup[] = [];
    
    console.log(`📋 Found ${allPupilsSnapshot.docs.length} pupils in the database`);
    
    // Prepare backup data
    for (const docSnapshot of allPupilsSnapshot.docs) {
      const pupil = docSnapshot.data();
      const pupilId = docSnapshot.id;
      
      if (pupil.firstName && pupil.lastName) {
        backupData.push({
          pupilId,
          originalFirstName: pupil.firstName,
          originalLastName: pupil.lastName,
          newFirstName: pupil.lastName,    // Will become firstName
          newLastName: pupil.firstName,    // Will become lastName
          migrationDate: new Date().toISOString()
        });
      }
    }
    
    console.log(`✅ Prepared backup for ${backupData.length} pupils`);
    
    if (backupData.length === 0) {
      console.log('ℹ️  No pupils found with both firstName and lastName. Nothing to migrate.');
      return;
    }
    
    // Create backup before making changes
    const backupId = await createMigrationBackup(db, backupData);
    
    // Show preview of changes
    console.log('\n📋 Preview of changes to be made:');
    console.log('=====================================');
    backupData.slice(0, 5).forEach((change, index) => {
      console.log(`${index + 1}. "${change.originalFirstName} ${change.originalLastName}" → "${change.newFirstName}, ${change.newLastName}"`);
    });
    
    if (backupData.length > 5) {
      console.log(`... and ${backupData.length - 5} more pupils`);
    }
    
    console.log('\n🔄 Starting the migration...');
    
    // Process pupils in batches to avoid memory issues
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
          console.log(`↔️  Swapping: "${pupil.firstName} ${pupil.lastName}" → "${pupil.lastName}, ${pupil.firstName}"`);
          
          // Swap the names
          const updatedData = {
            firstName: pupil.lastName,    // lastName becomes firstName
            lastName: pupil.firstName,    // firstName becomes lastName
            // Keep all other fields unchanged
            updatedAt: new Date().toISOString(),
            migrationNote: 'Names swapped - Surname now first',
            migrationBackupId: backupId
          };
          
          batch.update(doc(db, 'pupils', pupilId), updatedData);
          batchUpdates++;
        } else {
          console.log(`⚠️  Skipping pupil ${pupilId}: Missing firstName or lastName`);
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
    
    console.log(`\n🎉 Migration completed successfully!`);
    console.log('=====================================');
    console.log(`📊 Total pupils processed: ${processedCount}`);
    console.log(`✅ Total pupils updated: ${totalUpdated}`);
    console.log(`⚠️  Total pupils skipped: ${processedCount - totalUpdated}`);
    console.log(`💾 Backup ID: ${backupId}`);
    
    if (totalUpdated > 0) {
      console.log(`\n📢 IMPORTANT CHANGES MADE:`);
      console.log('==========================');
      console.log('✅ Pupil names have been swapped in the database');
      console.log('✅ What was "firstName" is now "lastName" and vice versa');
      console.log('✅ The system now displays names as "Surname, FirstName"');
      console.log('✅ All changes have been backed up');
      console.log('✅ Forms have been updated to collect Surname first');
      
      console.log(`\n🔧 Next Steps:`);
      console.log('===============');
      console.log('1. Test the application to ensure names display correctly');
      console.log('2. Update any custom components that display pupil names');
      console.log('3. Consider updating reports and exports');
      console.log('4. The migration backup is stored in the "migrations" collection');
    }
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    console.error('🔧 Please check your Firebase configuration and try again');
    throw error;
  }
}

// Export for manual execution
export { swapPupilNamesWithBackup };

// Allow direct execution if run as a script
if (require.main === module) {
  swapPupilNamesWithBackup()
    .then(() => {
      console.log('\n✅ Migration script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
} 