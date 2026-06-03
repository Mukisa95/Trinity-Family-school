/**
 * Script to swap firstName and lastName fields for all existing pupils
 * This changes the system from "First Last" to "Last First" format
 * 
 * Run this script ONCE to migrate existing data
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
  DocumentSnapshot
} from 'firebase/firestore';

// Firebase configuration (use your actual config)
const firebaseConfig = {
  // Add your Firebase config here - you can get this from your Firebase console
  // For now, this will use environment variables or default config
};

async function swapPupilNames() {
  try {
    console.log('🚀 Starting pupil name swap migration...');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    const pupilsCollection = collection(db, 'pupils');
    
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
          console.log(`↔️  Swapping: "${pupil.firstName} ${pupil.lastName}" → "${pupil.lastName} ${pupil.firstName}"`);
          
          // Swap the names
          const updatedData = {
            firstName: pupil.lastName,    // lastName becomes firstName
            lastName: pupil.firstName,    // firstName becomes lastName
            // Keep all other fields unchanged
            updatedAt: new Date().toISOString(),
            migrationNote: 'Names swapped - Surname now first'
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
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } while (lastDoc);
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`📊 Total pupils processed: ${processedCount}`);
    console.log(`✅ Total pupils updated: ${totalUpdated}`);
    console.log(`⚠️  Total pupils skipped: ${processedCount - totalUpdated}`);
    
    if (totalUpdated > 0) {
      console.log(`\n⚠️  IMPORTANT: The pupil names have been swapped in the database.`);
      console.log(`   What was "firstName" is now "lastName" and vice versa.`);
      console.log(`   Update your UI components to display names in the new order.`);
    }
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

// Export for manual execution
export { swapPupilNames };

// Allow direct execution if run as a script
if (require.main === module) {
  swapPupilNames()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
} 