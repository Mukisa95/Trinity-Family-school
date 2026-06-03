import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, Timestamp } from 'firebase/firestore';

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

async function fixAcademicYearTermDates() {
  try {
    console.log('🚀 Starting academic year term dates fix...');
    
    // Fetch all academic years
    const yearsQuery = query(collection(db, 'academicYears'));
    const snapshot = await getDocs(yearsQuery);
    
    console.log(`📊 Found ${snapshot.docs.length} academic years in database`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const yearId = docSnapshot.id;
      const yearName = data.name;
      
      console.log(`\n📅 Checking academic year: ${yearName} (${yearId})`);
      
      // Check if terms have valid dates
      let needsUpdate = false;
      const terms = data.terms || [];
      
      for (let i = 0; i < terms.length; i++) {
        const term = terms[i];
        
        // Check if dates are invalid (null, empty, or not proper Timestamps)
        const hasInvalidStartDate = !term.startDate || 
          (typeof term.startDate === 'string' && term.startDate.trim() === '') ||
          (term.startDate && !term.startDate.toDate && typeof term.startDate !== 'string');
          
        const hasInvalidEndDate = !term.endDate || 
          (typeof term.endDate === 'string' && term.endDate.trim() === '') ||
          (term.endDate && !term.endDate.toDate && typeof term.endDate !== 'string');
        
        if (hasInvalidStartDate || hasInvalidEndDate) {
          console.log(`   ⚠️ Term ${term.name || i+1} has invalid dates:`, {
            startDate: term.startDate,
            endDate: term.endDate
          });
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        console.log(`   ❌ Academic year ${yearName} has invalid term dates`);
        console.log(`   🗑️ This year should be deleted and re-created with correct data`);
        errorCount++;
        // We don't auto-delete here to avoid data loss - user should run cleanup script
      } else {
        console.log(`   ✅ Academic year ${yearName} has valid term dates`);
        skippedCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Total academic years checked: ${snapshot.docs.length}`);
    console.log(`   - Years with valid dates: ${skippedCount}`);
    console.log(`   - Years with invalid dates: ${errorCount}`);
    console.log(`   - Years fixed: ${fixedCount}`);
    
    if (errorCount > 0) {
      console.log(`\n⚠️ Found ${errorCount} academic years with invalid term dates.`);
      console.log(`\n📝 Recommended actions:`);
      console.log(`   1. Run the cleanup script to remove these years:`);
      console.log(`      npm run cleanup-academic-years`);
      console.log(`   2. Run the repopulation script to add them back with correct dates:`);
      console.log(`      npm run repopulate-academic-years`);
    } else {
      console.log(`\n✅ All academic years have valid term dates!`);
    }
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
    throw error;
  }
}

// Run the fix
fixAcademicYearTermDates()
  .then(() => {
    console.log('\n🎉 Term dates check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix script failed:', error);
    process.exit(1);
  });

