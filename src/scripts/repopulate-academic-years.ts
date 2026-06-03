import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, addDoc, Timestamp } from 'firebase/firestore';
import { initialSampleAcademicYears } from '../lib/sample-data';

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

async function repopulateAcademicYears() {
  try {
    console.log('🚀 Starting academic years repopulation...');
    console.log(`📊 Sample data contains ${initialSampleAcademicYears.length} academic years`);
    
    // Fetch existing academic years
    const existingYearsQuery = query(collection(db, 'academicYears'));
    const existingYearsSnapshot = await getDocs(existingYearsQuery);
    const existingYearNames = new Set(existingYearsSnapshot.docs.map(doc => doc.data().name as string));
    
    console.log(`📅 Found ${existingYearNames.size} existing academic years in Firestore`);
    console.log(`   Existing years: ${Array.from(existingYearNames).join(', ')}`);
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const year of initialSampleAcademicYears) {
      const { id, ...yearData } = year; // Remove the sample ID
      
      if (existingYearNames.has(yearData.name)) {
        console.log(`   ⏭️ Academic year "${yearData.name}" already exists. Skipping.`);
        skippedCount++;
        continue;
      }
      
      // Convert dates to Firestore Timestamps
      const newYear = {
        ...yearData,
        startDate: yearData.startDate ? Timestamp.fromDate(new Date(yearData.startDate)) : null,
        endDate: yearData.endDate ? Timestamp.fromDate(new Date(yearData.endDate)) : null,
        terms: yearData.terms?.map(term => ({
          ...term,
          startDate: term.startDate ? Timestamp.fromDate(new Date(term.startDate)) : null,
          endDate: term.endDate ? Timestamp.fromDate(new Date(term.endDate)) : null,
        })) || [],
        createdAt: Timestamp.now()
      };
      
      await addDoc(collection(db, 'academicYears'), newYear);
      console.log(`   ✅ Created academic year: ${yearData.name}`);
      createdCount++;
      existingYearNames.add(yearData.name);
    }
    
    console.log(`\n✅ Repopulation complete!`);
    console.log(`   - Created: ${createdCount} new academic years`);
    console.log(`   - Skipped: ${skippedCount} existing academic years`);
    console.log(`   - Total: ${existingYearNames.size} academic years in database`);
    console.log(`\n📝 Academic years in database: ${Array.from(existingYearNames).sort().join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error during repopulation:', error);
    throw error;
  }
}

// Run the repopulation
repopulateAcademicYears()
  .then(() => {
    console.log('\n🎉 Repopulation script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Repopulation script failed:', error);
    process.exit(1);
  });

