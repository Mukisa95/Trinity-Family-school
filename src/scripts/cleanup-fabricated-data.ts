import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { publishClassesRevision } from './cache-revision-helper';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCMFVoGNdrBAuPoDjaNpsgionEnkq45JSA",
  authDomain: "trinity-family-schools.firebaseapp.com",
  projectId: "trinity-family-schools",
  storageBucket: "trinity-family-schools.firebasestorage.app",
  messagingSenderId: "148171496339",
  appId: "1:148171496339:web:c441b0e1e3116f129ba666",
  measurementId: "G-Z3G3D3EXRW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('Firebase config:', { projectId: firebaseConfig.projectId, env: process.env.NODE_ENV });

// Class IDs that were fabricated and need to be removed
const fabricatedClassIds = [
  '1738166079854', // NURSERY
  '1738165816819', // PRIMARY ONE
  '1738165880160', // PRIMARY TWO
  '1738165859529', // PRIMARY THREE
  '1738166047647', // PRIMARY FOUR
  '1738165922575', // PRIMARY FIVE
  '1738166151683', // PRIMARY SIX
  '1738165840130', // PRIMARY SEVEN
  '1738166004662', // SENIOR ONE
  '1738166131699', // SENIOR TWO
];

async function removeFabricatedClasses(): Promise<void> {
  try {
    console.log('🗑️  Removing fabricated classes...');
    
    let deletedCount = 0;
    
    for (const classId of fabricatedClassIds) {
      try {
        const classRef = doc(db, 'classes', classId);
        await deleteDoc(classRef);
        deletedCount++;
        console.log(`❌ Deleted fabricated class: ${classId}`);
      } catch (error) {
        console.log(`⚠️  Class ${classId} not found or already deleted`);
      }
    }
    
    console.log(`✅ Removed ${deletedCount} fabricated classes`);
    
  } catch (error) {
    console.error('❌ Error removing fabricated classes:', error);
    throw error;
  }
}

async function removeFabricatedPhotosAndClassInfo(): Promise<void> {
  try {
    console.log('🗑️  Removing fabricated photos and class info from pupils...');
    
    // Get all pupils
    const pupilsRef = collection(db, 'pupils');
    const snapshot = await getDocs(pupilsRef);
    
    if (snapshot.empty) {
      console.log('❌ No pupils found in database!');
      return;
    }
    
    console.log(`📊 Found ${snapshot.docs.length} pupils`);
    
    // Process pupils in batches
    const batchSize = 500;
    const pupils = snapshot.docs;
    let processedCount = 0;
    let updatedCount = 0;
    
    for (let i = 0; i < pupils.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchPupils = pupils.slice(i, i + batchSize);
      let batchHasUpdates = false;
      
      console.log(`📝 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pupils.length / batchSize)}...`);
      
      for (const pupilDoc of batchPupils) {
        const pupilData = pupilDoc.data();
        processedCount++;
        
        const updateData: any = {};
        let needsUpdate = false;
        
        // Remove fabricated photos (DiceBear API URLs)
        if (pupilData.photo && pupilData.photo.includes('dicebear.com')) {
          updateData.photo = null;
          needsUpdate = true;
          console.log(`📸 Removing fabricated photo for: ${pupilData.firstName} ${pupilData.lastName}`);
        }
        
        // Remove fabricated class info (className and classCode)
        if (pupilData.className) {
          updateData.className = null;
          needsUpdate = true;
        }
        
        if (pupilData.classCode) {
          updateData.classCode = null;
          needsUpdate = true;
        }
        
        // Remove classId if it references a fabricated class
        if (pupilData.classId && fabricatedClassIds.includes(pupilData.classId)) {
          updateData.classId = null;
          needsUpdate = true;
          console.log(`🔗 Removing fabricated classId for: ${pupilData.firstName} ${pupilData.lastName}`);
        }
        
        if (needsUpdate) {
          const pupilRef = doc(db, 'pupils', pupilDoc.id);
          batch.update(pupilRef, updateData);
          updatedCount++;
          batchHasUpdates = true;
        }
      }
      
      // Commit batch if there are updates
      if (batchHasUpdates) {
        console.log('💾 Committing batch to Firestore...');
        await batch.commit();
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} committed successfully`);
      }
      
      // Small delay to avoid overwhelming Firestore
      if (i + batchSize < pupils.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Processed ${processedCount} pupils, updated ${updatedCount} with fabricated data removal`);
    
  } catch (error) {
    console.error('❌ Error removing fabricated data from pupils:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🧹 Trinity Family School - Fabricated Data Cleanup');
    console.log('='.repeat(60));
    console.log('This script will remove all fabricated data:');
    console.log('1. Delete fabricated class records');
    console.log('2. Remove placeholder photos from pupils');
    console.log('3. Remove fabricated class names and codes');
    console.log('4. Remove references to fabricated classes');
    console.log('='.repeat(60));
    
    // Step 1: Remove fabricated classes
    await removeFabricatedClasses();
    
    // Step 2: Remove fabricated photos and class info from pupils
    await removeFabricatedPhotosAndClassInfo();
    await publishClassesRevision(db);
    
    console.log('\n🎉 FABRICATED DATA CLEANUP COMPLETED!');
    console.log('='.repeat(60));
    console.log('✅ All fabricated data has been removed:');
    console.log('   ❌ Fabricated class records deleted');
    console.log('   📸 Placeholder photos removed');
    console.log('   📝 Fabricated class names/codes removed');
    console.log('   🔗 References to fabricated classes removed');
    console.log('');
    console.log('📊 Your database now contains only original data:');
    console.log('   👥 Original pupil records (with basic info only)');
    console.log('   📚 Original class records (if any existed before)');
    console.log('   🔄 Ready for proper data entry');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
main();
