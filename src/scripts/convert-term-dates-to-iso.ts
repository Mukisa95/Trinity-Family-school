import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query } from 'firebase/firestore';
import { publishAcademicYearsRevision } from './cache-revision-helper';

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

async function convertTermDatesToISO() {
  try {
    console.log('🚀 Starting term dates conversion to ISO strings...');
    
    // Fetch all academic years
    const yearsQuery = query(collection(db, 'academicYears'));
    const snapshot = await getDocs(yearsQuery);
    
    console.log(`📊 Found ${snapshot.docs.length} academic years in database`);
    
    let convertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const yearId = docSnapshot.id;
      const yearName = data.name;
      
      console.log(`\n📅 Processing academic year: ${yearName} (${yearId})`);
      
      const terms = data.terms || [];
      let needsConversion = false;
      const convertedTerms = [];
      
      for (let i = 0; i < terms.length; i++) {
        const term = { ...terms[i] };
        
        // Check if startDate needs conversion
        if (term.startDate && typeof term.startDate === 'object' && 'seconds' in term.startDate) {
          // Convert Timestamp to ISO string
          const startDateObj = new Date(term.startDate.seconds * 1000);
          term.startDate = startDateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
          needsConversion = true;
          console.log(`   🔄 Converted start date for ${term.name}: ${term.startDate}`);
        }
        
        // Check if endDate needs conversion
        if (term.endDate && typeof term.endDate === 'object' && 'seconds' in term.endDate) {
          // Convert Timestamp to ISO string
          const endDateObj = new Date(term.endDate.seconds * 1000);
          term.endDate = endDateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
          needsConversion = true;
          console.log(`   🔄 Converted end date for ${term.name}: ${term.endDate}`);
        }
        
        convertedTerms.push(term);
      }
      
      if (needsConversion) {
        try {
          // Also convert year start/end dates if needed
          let startDate = data.startDate;
          let endDate = data.endDate;
          
          if (startDate && typeof startDate === 'object' && 'seconds' in startDate) {
            const startDateObj = new Date(startDate.seconds * 1000);
            startDate = startDateObj.toISOString().split('T')[0];
            console.log(`   🔄 Converted year start date: ${startDate}`);
          }
          
          if (endDate && typeof endDate === 'object' && 'seconds' in endDate) {
            const endDateObj = new Date(endDate.seconds * 1000);
            endDate = endDateObj.toISOString().split('T')[0];
            console.log(`   🔄 Converted year end date: ${endDate}`);
          }
          
          // Update the document
          const docRef = doc(db, 'academicYears', yearId);
          await updateDoc(docRef, {
            terms: convertedTerms,
            startDate,
            endDate
          });
          
          console.log(`   ✅ Successfully updated ${yearName} with ISO date strings`);
          convertedCount++;
        } catch (error) {
          console.error(`   ❌ Failed to update ${yearName}:`, error);
          errorCount++;
        }
      } else {
        console.log(`   ⏭️ ${yearName} already has ISO date strings, skipping`);
        skippedCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Total academic years checked: ${snapshot.docs.length}`);
    console.log(`   - Years converted: ${convertedCount}`);
    console.log(`   - Years skipped (already ISO): ${skippedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    
    if (convertedCount > 0) {
      await publishAcademicYearsRevision(db);
      console.log(`\n✅ Successfully converted ${convertedCount} academic years to use ISO date strings!`);
      console.log(`\n📝 Next step:`);
      console.log(`   1. Refresh your parent dashboard to see the fix in action`);
      console.log(`   2. Check console - you should see no more "Invalid term.endDate" warnings`);
    } else if (skippedCount === snapshot.docs.length) {
      console.log(`\n✅ All academic years already use ISO date strings - no conversion needed!`);
    }
    
  } catch (error) {
    console.error('❌ Error during conversion:', error);
    throw error;
  }
}

// Run the conversion
convertTermDatesToISO()
  .then(() => {
    console.log('\n🎉 Conversion completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Conversion failed:', error);
    process.exit(1);
  });
