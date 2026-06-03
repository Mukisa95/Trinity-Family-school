import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch, query } from 'firebase/firestore';

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

async function cleanupAcademicYears() {
  try {
    console.log('🚀 Starting academic years cleanup...');
    
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 2; // Keep years from 2 years ago
    const maxYear = currentYear + 2; // Keep years up to 2 years in the future
    
    console.log(`📅 Keeping academic years: ${minYear} to ${maxYear}`);
    
    // Fetch all academic years
    const yearsQuery = query(collection(db, 'academicYears'));
    const snapshot = await getDocs(yearsQuery);
    
    console.log(`📊 Found ${snapshot.docs.length} academic years in database`);
    
    const yearsToDelete: string[] = [];
    const yearsToKeep: string[] = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const yearName = parseInt(data.name);
      
      if (isNaN(yearName) || yearName < minYear || yearName > maxYear) {
        yearsToDelete.push(doc.id);
        console.log(`❌ Will delete: ${data.name} (${doc.id})`);
      } else {
        yearsToKeep.push(data.name);
        console.log(`✅ Will keep: ${data.name} (${doc.id})`);
      }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Total academic years: ${snapshot.docs.length}`);
    console.log(`   - Years to keep: ${yearsToKeep.length}`);
    console.log(`   - Years to delete: ${yearsToDelete.length}`);
    
    if (yearsToDelete.length === 0) {
      console.log('✅ No academic years to delete. Database is already clean!');
      return;
    }
    
    // Delete in batches (Firestore limit is 500 per batch)
    console.log(`\n🗑️ Deleting ${yearsToDelete.length} academic years...`);
    
    const batchSize = 500;
    let deletedCount = 0;
    
    for (let i = 0; i < yearsToDelete.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchIds = yearsToDelete.slice(i, i + batchSize);
      
      batchIds.forEach(id => {
        const docRef = doc(db, 'academicYears', id);
        batch.delete(docRef);
      });
      
      await batch.commit();
      deletedCount += batchIds.length;
      console.log(`   ✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${deletedCount}/${yearsToDelete.length} years`);
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   - Deleted: ${deletedCount} academic years`);
    console.log(`   - Remaining: ${yearsToKeep.length} academic years (${yearsToKeep.join(', ')})`);
    console.log('\n📝 Next steps:');
    console.log('   1. Run the migration script to re-populate with the new academic years:');
    console.log('      npm run migrate:academic-years');
    console.log('   2. Or run the dev tools page to initialize remaining years if needed');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupAcademicYears()
  .then(() => {
    console.log('\n🎉 Cleanup script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup script failed:', error);
    process.exit(1);
  });

