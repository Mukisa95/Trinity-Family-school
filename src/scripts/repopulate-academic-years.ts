import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, query, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { initialSampleAcademicYears } from '../lib/sample-data';
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

const getYearArgument = (name: '--from' | '--to'): number | undefined => {
  const argument = process.argv.find(value => value.startsWith(`${name}=`));
  if (!argument) return undefined;

  const year = Number(argument.slice(name.length + 1));
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new Error(`${name} must be a four-digit year, received "${argument}".`);
  }

  return year;
};

async function repopulateAcademicYears() {
  try {
    const fromYear = getYearArgument('--from');
    const toYear = getYearArgument('--to');
    const replaceExisting = process.argv.includes('--replace-existing');
    if (fromYear && toYear && fromYear > toYear) {
      throw new Error('--from must be earlier than or equal to --to.');
    }

    const yearsToRepopulate = initialSampleAcademicYears.filter(year => {
      const yearNumber = Number(year.name);
      return (!fromYear || yearNumber >= fromYear) && (!toYear || yearNumber <= toYear);
    });

    console.log('🚀 Starting academic years repopulation...');
    console.log(`📊 Selected ${yearsToRepopulate.length} academic years`);
    
    // Fetch existing academic years
    const existingYearsQuery = query(collection(db, 'academicYears'));
    const existingYearsSnapshot = await getDocs(existingYearsQuery);
    const existingYearNames = new Set(existingYearsSnapshot.docs.map(doc => doc.data().name as string));
    
    console.log(`📅 Found ${existingYearNames.size} existing academic years in Firestore`);
    console.log(`   Existing years: ${Array.from(existingYearNames).join(', ')}`);
    
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const year of yearsToRepopulate) {
      const { id, ...yearData } = year; // Remove the sample ID
      
      if (existingYearNames.has(yearData.name)) {
        if (replaceExisting) {
          const existingYear = existingYearsSnapshot.docs.find(existing => existing.data().name === yearData.name);
          if (!existingYear) {
            throw new Error(`Could not find the existing record for academic year "${yearData.name}".`);
          }

          await updateDoc(doc(db, 'academicYears', existingYear.id), {
            ...yearData,
            startDate: yearData.startDate ? Timestamp.fromDate(new Date(yearData.startDate)) : null,
            endDate: yearData.endDate ? Timestamp.fromDate(new Date(yearData.endDate)) : null,
            terms: yearData.terms?.map(term => ({
              ...term,
              startDate: term.startDate ? Timestamp.fromDate(new Date(term.startDate)) : null,
              endDate: term.endDate ? Timestamp.fromDate(new Date(term.endDate)) : null,
            })) || [],
            updatedAt: Timestamp.now(),
          });
          console.log(`   ✅ Updated academic year: ${yearData.name}`);
          updatedCount++;
          continue;
        }

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
    if (createdCount + updatedCount > 0) await publishAcademicYearsRevision(db);
    
    console.log(`\n✅ Repopulation complete!`);
    console.log(`   - Created: ${createdCount} new academic years`);
    console.log(`   - Updated: ${updatedCount} existing academic years`);
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
