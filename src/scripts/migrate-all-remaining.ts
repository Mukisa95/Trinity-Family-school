import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCMFVoGNdrBAuPoDjaNpsgionEnkq45JSA",
  authDomain: "trinity-family-schools.firebaseapp.com",
  projectId: "trinity-family-schools",
  storageBucket: "trinity-family-schools.firebasestorage.app",
  messagingSenderId: "148171496339",
  appId: "1:148171496339:web:c441b0e1e3116f129ba666",
  measurementId: "G-Z3G3D3EXRW"
};
import { AcademicYearsService } from '../lib/services/academic-years.service';
import { ClassesService } from '../lib/services/classes.service';
import { SubjectsService } from '../lib/services/subjects.service';
import { FeeStructuresService } from '../lib/services/fee-structures.service';
import { 
  initialFeeStructures, 
  initialFeeAdjustments,
  sampleSubjects,
  sampleSchoolSettings
} from '../lib/sample-data';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('Firebase config:', { projectId: firebaseConfig.projectId, env: process.env.NODE_ENV });
console.log('Firebase initialized with project:', firebaseConfig.projectId);

async function migrateFeeStructures() {
  console.log('\n=== Migrating Fee Structures ===');
  
  try {
    // Check if fee structures already exist
    const existingFeeStructures = await FeeStructuresService.getAllFeeStructures();
    if (existingFeeStructures.length > 0) {
      console.log(`Found ${existingFeeStructures.length} existing fee structures. Skipping migration.`);
      return;
    }

    console.log(`Migrating ${initialFeeStructures.length} fee structures...`);
    
    for (const feeStructure of initialFeeStructures) {
      const { id, createdAt, updatedAt, ...feeStructureData } = feeStructure;
      
      try {
        const created = await FeeStructuresService.createFeeStructure(feeStructureData);
        console.log(`✓ Migrated fee structure: ${created.name} (${created.type})`);
      } catch (error) {
        console.error(`✗ Failed to migrate fee structure ${feeStructure.name}:`, error);
      }
    }
    
    const finalCount = await FeeStructuresService.getAllFeeStructures();
    console.log(`Fee structures migration completed. Total: ${finalCount.length}`);
    
  } catch (error) {
    console.error('Error during fee structures migration:', error);
    throw error;
  }
}

async function migrateSubjects() {
  console.log('\n=== Migrating Subjects ===');
  
  try {
    // Check if subjects already exist
    const existingSubjects = await SubjectsService.getAllSubjects();
    if (existingSubjects.length > 0) {
      console.log(`Found ${existingSubjects.length} existing subjects. Skipping migration.`);
      return;
    }

    console.log(`Migrating ${sampleSubjects.length} subjects...`);
    
    for (const subject of sampleSubjects) {
      const { id, createdAt, updatedAt, ...subjectData } = subject;
      
      try {
        const created = await SubjectsService.createSubject(subjectData);
        console.log(`✓ Migrated subject: ${created.name} (${created.code})`);
      } catch (error) {
        console.error(`✗ Failed to migrate subject ${subject.name}:`, error);
      }
    }
    
    const finalCount = await SubjectsService.getAllSubjects();
    console.log(`Subjects migration completed. Total: ${finalCount.length}`);
    
  } catch (error) {
    console.error('Error during subjects migration:', error);
    throw error;
  }
}

async function displayMigrationSummary() {
  console.log('\n=== Migration Summary ===');
  
  try {
    const academicYears = await AcademicYearsService.getAllAcademicYears();
    const classes = await ClassesService.getAllClasses();
    const subjects = await SubjectsService.getAllSubjects();
    const feeStructures = await FeeStructuresService.getAllFeeStructures();
    
    console.log(`Academic Years: ${academicYears.length}`);
    console.log(`Classes: ${classes.length}`);
    console.log(`Subjects: ${subjects.length}`);
    console.log(`Fee Structures: ${feeStructures.length}`);
    
    console.log('\n=== Remaining Components to Migrate Manually ===');
    console.log('HIGH PRIORITY:');
    console.log('- Fees system (src/app/fees/page.tsx) - uses initialFeeStructures, initialFeeAdjustments');
    console.log('- Pupil detail pages (src/app/pupils/[id]/page.tsx) - uses initialFeeStructures');
    console.log('- Classes detail (src/app/classes/[id]/page.tsx) - uses sampleSubjects');
    console.log('- Classes management (src/app/classes/page.tsx) - uses sampleSubjects');
    
    console.log('\nMEDIUM PRIORITY:');
    console.log('- School settings (src/app/about-school/page.tsx) - uses sampleSchoolSettings');
    console.log('- App layout (src/components/layout/app-layout.tsx) - uses sampleSchoolSettings');
    
    console.log('\nLOW PRIORITY:');
    console.log('- Users management (src/app/users/page.tsx) - uses local sampleUsers');
    
    console.log('\n=== Next Steps ===');
    console.log('1. Update remaining components to use Firebase hooks');
    console.log('2. Create services for school settings and users if needed');
    console.log('3. Test all components thoroughly');
    console.log('4. Remove sample data files once migration is complete');
    
  } catch (error) {
    console.error('Error generating migration summary:', error);
  }
}

async function main() {
  console.log('Starting comprehensive migration of remaining components...');
  
  try {
    await migrateSubjects();
    await migrateFeeStructures();
    await displayMigrationSummary();
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error); 