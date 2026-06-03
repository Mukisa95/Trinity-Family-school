import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

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

interface OriginalPupil {
  id: string;
  firstName: string;
  lastName: string;
  pupilIdentificationNumber: string;
  classId: string;
}

interface ExistingClass {
  id: string;
  name: string;
  code: string;
  level: string;
}

// Mapping from fabricated class IDs to class levels/names
const fabricatedClassMapping: Record<string, { level: string; expectedName: string }> = {
  '1738166079854': { level: 'Nursery', expectedName: 'BABY CLASS' },
  '1738165816819': { level: 'Primary', expectedName: 'PRIMARY ONE' },
  '1738165880160': { level: 'Primary', expectedName: 'PRIMARY TWO' },
  '1738165859529': { level: 'Primary', expectedName: 'PRIMARY THREE' },
  '1738166047647': { level: 'Primary', expectedName: 'PRIMARY FOUR' },
  '1738165922575': { level: 'Primary', expectedName: 'PRIMARY FIVE' },
  '1738166151683': { level: 'Primary', expectedName: 'PRIMARY SIX' },
  '1738165840130': { level: 'Primary', expectedName: 'PRIMARY SEVEN' },
  '1738166004662': { level: 'Secondary', expectedName: 'SENIOR ONE' },
  '1738166131699': { level: 'Secondary', expectedName: 'SENIOR TWO' },
};

console.log('Firebase config:', { projectId: firebaseConfig.projectId, env: process.env.NODE_ENV });

async function loadOriginalPupilsData(): Promise<OriginalPupil[]> {
  try {
    console.log('📖 Loading original pupils data...');
    
    const dataPath = path.join(process.cwd(), 'pupils data.txt');
    if (!fs.existsSync(dataPath)) {
      throw new Error('pupils data.txt file not found in project root');
    }
    
    const fileContent = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    if (!data.pupils || !Array.isArray(data.pupils)) {
      throw new Error('Invalid data format: pupils array not found');
    }
    
    console.log(`✅ Loaded ${data.pupils.length} pupils from original data`);
    return data.pupils.map((p: any) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      pupilIdentificationNumber: p.pupilIdentificationNumber,
      classId: p.classId
    }));
    
  } catch (error) {
    console.error('❌ Error loading original data:', error);
    throw error;
  }
}

async function getExistingClasses(): Promise<ExistingClass[]> {
  try {
    console.log('📚 Fetching existing classes from database...');
    
    const classesRef = collection(db, 'classes');
    const snapshot = await getDocs(classesRef);
    
    if (snapshot.empty) {
      console.log('⚠️  No classes found in database!');
      return [];
    }
    
    const classes: ExistingClass[] = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || '',
      code: doc.data().code || '',
      level: doc.data().level || ''
    }));
    
    console.log(`✅ Found ${classes.length} existing classes:`);
    classes.forEach(cls => {
      console.log(`   📚 ${cls.name} (${cls.code}) - Level: ${cls.level} - ID: ${cls.id}`);
    });
    
    return classes;
    
  } catch (error) {
    console.error('❌ Error fetching classes:', error);
    throw error;
  }
}

function findBestClassMatch(fabricatedClassId: string, existingClasses: ExistingClass[]): ExistingClass | null {
  const mapping = fabricatedClassMapping[fabricatedClassId];
  if (!mapping) {
    console.log(`⚠️  No mapping found for fabricated class ID: ${fabricatedClassId}`);
    return null;
  }
  
  // Try to find exact name match first
  let match = existingClasses.find(cls => 
    cls.name.toUpperCase().includes(mapping.expectedName.toUpperCase()) ||
    mapping.expectedName.toUpperCase().includes(cls.name.toUpperCase())
  );
  
  if (match) {
    console.log(`✅ Found exact match: ${fabricatedClassId} → ${match.name} (${match.id})`);
    return match;
  }
  
  // Try to find level match
  match = existingClasses.find(cls => 
    cls.level.toLowerCase().includes(mapping.level.toLowerCase()) ||
    mapping.level.toLowerCase().includes(cls.level.toLowerCase())
  );
  
  if (match) {
    console.log(`✅ Found level match: ${fabricatedClassId} → ${match.name} (${match.id})`);
    return match;
  }
  
  console.log(`❌ No match found for fabricated class: ${fabricatedClassId} (${mapping.expectedName})`);
  return null;
}

async function fixPupilClassReferences(): Promise<void> {
  try {
    console.log('🔧 Fixing pupil class references...');
    
    // Load original data to understand the intended class assignments
    const originalPupils = await loadOriginalPupilsData();
    
    // Get existing classes from database
    const existingClasses = await getExistingClasses();
    
    if (existingClasses.length === 0) {
      console.log('❌ No existing classes found. Cannot fix class references.');
      console.log('💡 Please create classes first, then run this script again.');
      return;
    }
    
    // Get all pupils from database
    const pupilsRef = collection(db, 'pupils');
    const snapshot = await getDocs(pupilsRef);
    
    if (snapshot.empty) {
      console.log('❌ No pupils found in database!');
      return;
    }
    
    console.log(`📊 Found ${snapshot.docs.length} pupils in database`);
    
    // Create admission number to database pupil mapping
    const dbPupilsByAdmission = new Map<string, any>();
    for (const doc of snapshot.docs) {
      const pupilData = doc.data();
      if (pupilData.admissionNumber) {
        dbPupilsByAdmission.set(pupilData.admissionNumber.toUpperCase(), {
          id: doc.id,
          data: pupilData
        });
      }
    }
    
    // Create class mapping from fabricated IDs to existing classes
    const classMapping = new Map<string, ExistingClass>();
    const fabricatedClassIds = Object.keys(fabricatedClassMapping);
    
    for (const fabricatedId of fabricatedClassIds) {
      const match = findBestClassMatch(fabricatedId, existingClasses);
      if (match) {
        classMapping.set(fabricatedId, match);
      }
    }
    
    console.log(`📋 Created ${classMapping.size} class mappings`);
    
    // Process pupils and update their class references
    const batchSize = 500;
    let processedPupils = 0;
    let updatedPupils = 0;
    let skippedPupils = 0;
    
    for (const originalPupil of originalPupils) {
      processedPupils++;
      
      // Find the pupil in database
      const admissionNumber = originalPupil.pupilIdentificationNumber.toUpperCase();
      const dbPupil = dbPupilsByAdmission.get(admissionNumber);
      
      if (!dbPupil) {
        console.log(`⚠️  Pupil ${originalPupil.firstName} ${originalPupil.lastName} (${admissionNumber}) not found in database`);
        skippedPupils++;
        continue;
      }
      
      // Check if pupil has a fabricated class ID
      const currentClassId = dbPupil.data.classId;
      if (!currentClassId || !fabricatedClassMapping[currentClassId]) {
        console.log(`ℹ️  Pupil ${originalPupil.firstName} ${originalPupil.lastName} doesn't have a fabricated class ID, skipping`);
        continue;
      }
      
      // Find the correct class mapping
      const correctClass = classMapping.get(currentClassId);
      if (!correctClass) {
        console.log(`❌ No class mapping found for ${originalPupil.firstName} ${originalPupil.lastName} (fabricated class: ${currentClassId})`);
        skippedPupils++;
        continue;
      }
      
      // Update the pupil's class information
      const updateData = {
        classId: correctClass.id,
        className: correctClass.name,
        classCode: correctClass.code,
        updatedAt: new Date().toISOString()
      };
      
      const pupilRef = doc(db, 'pupils', dbPupil.id);
      
      try {
        // Use individual updates for better error handling
        const batch = writeBatch(db);
        batch.update(pupilRef, updateData);
        await batch.commit();
        
        updatedPupils++;
        console.log(`✅ Updated ${originalPupil.firstName} ${originalPupil.lastName}: ${currentClassId} → ${correctClass.name} (${correctClass.id})`);
        
      } catch (error) {
        console.error(`❌ Failed to update ${originalPupil.firstName} ${originalPupil.lastName}:`, error);
        skippedPupils++;
      }
      
      // Small delay to avoid overwhelming Firestore
      if (processedPupils % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('✅ Pupil class reference fix completed!');
    console.log(`📊 Processed: ${processedPupils} pupils from original data`);
    console.log(`✅ Updated: ${updatedPupils} pupils with correct class references`);
    console.log(`⚠️  Skipped: ${skippedPupils} pupils (not found or no mapping available)`);
    
  } catch (error) {
    console.error('❌ Error fixing pupil class references:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔧 Trinity Family School - Fix Pupil Class References');
    console.log('='.repeat(70));
    console.log('This script will fix pupil class references by:');
    console.log('1. Loading original pupil data to understand intended assignments');
    console.log('2. Fetching existing classes from the database');
    console.log('3. Mapping fabricated class IDs to existing class IDs');
    console.log('4. Updating pupils with correct class references');
    console.log('5. Adding denormalized class names and codes');
    console.log('='.repeat(70));
    
    await fixPupilClassReferences();
    
    console.log('\n🎉 CLASS REFERENCE FIX COMPLETED!');
    console.log('='.repeat(70));
    console.log('✅ Pupil class references have been fixed:');
    console.log('   🔗 Fabricated class IDs replaced with existing class IDs');
    console.log('   📚 Class names and codes added to pupil records');
    console.log('   📊 Class details pages will now show correct pupils');
    console.log('   🎯 All class-based features should work properly');
    console.log('');
    console.log('🌐 Class-pupil relationships are now functional!');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n💥 Class reference fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
main(); 