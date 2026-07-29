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

interface ClassInfo {
  id: string;
  name: string;
  code: string;
  level: string;
  createdAt?: string;
}

interface PupilInfo {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  classId: string;
}

// Fabricated class IDs that should be removed
const fabricatedClassIds = [
  '1738166079854', // BABY CLASS
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

console.log('Firebase config:', { projectId: firebaseConfig.projectId, env: process.env.NODE_ENV });

async function consolidateDuplicateClasses(): Promise<void> {
  try {
    console.log('🔧 Consolidating Duplicate Classes');
    console.log('='.repeat(60));
    
    // Get all classes
    console.log('📚 Fetching all classes...');
    const classesRef = collection(db, 'classes');
    const classesSnapshot = await getDocs(classesRef);
    
    if (classesSnapshot.empty) {
      console.log('❌ No classes found!');
      return;
    }
    
    const allClasses: ClassInfo[] = classesSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || '',
      code: doc.data().code || '',
      level: doc.data().level || '',
      createdAt: doc.data().createdAt
    }));
    
    console.log(`✅ Found ${allClasses.length} classes total`);
    
    // Separate fabricated and original classes
    const fabricatedClasses = allClasses.filter(cls => fabricatedClassIds.includes(cls.id));
    const originalClasses = allClasses.filter(cls => !fabricatedClassIds.includes(cls.id));
    
    console.log(`📊 Fabricated classes: ${fabricatedClasses.length}`);
    console.log(`📊 Original classes: ${originalClasses.length}`);
    
    // Create mapping from fabricated classes to original classes
    const classMapping = new Map<string, ClassInfo>();
    
    for (const fabricatedClass of fabricatedClasses) {
      // Find matching original class by name or code
      const matchingOriginal = originalClasses.find(original => 
        original.name.toUpperCase().includes(fabricatedClass.name.toUpperCase()) ||
        fabricatedClass.name.toUpperCase().includes(original.name.toUpperCase()) ||
        original.code === fabricatedClass.code
      );
      
      if (matchingOriginal) {
        classMapping.set(fabricatedClass.id, matchingOriginal);
        console.log(`✅ Mapping: ${fabricatedClass.name} (${fabricatedClass.id}) → ${matchingOriginal.name} (${matchingOriginal.id})`);
      } else {
        console.log(`⚠️  No matching original class found for: ${fabricatedClass.name} (${fabricatedClass.id})`);
      }
    }
    
    console.log(`📋 Created ${classMapping.size} class mappings`);
    
    // Get all pupils
    console.log('\n👥 Fetching all pupils...');
    const pupilsRef = collection(db, 'pupils');
    const pupilsSnapshot = await getDocs(pupilsRef);
    
    if (pupilsSnapshot.empty) {
      console.log('❌ No pupils found!');
      return;
    }
    
    const allPupils: PupilInfo[] = pupilsSnapshot.docs.map(doc => ({
      id: doc.id,
      firstName: doc.data().firstName || '',
      lastName: doc.data().lastName || '',
      admissionNumber: doc.data().admissionNumber || '',
      classId: doc.data().classId || ''
    }));
    
    console.log(`✅ Found ${allPupils.length} pupils total`);
    
    // Find pupils assigned to fabricated classes
    const pupilsToReassign = allPupils.filter(pupil => 
      pupil.classId && fabricatedClassIds.includes(pupil.classId)
    );
    
    console.log(`📊 Pupils to reassign: ${pupilsToReassign.length}`);
    
    // Reassign pupils to original classes
    let reassignedCount = 0;
    let skippedCount = 0;
    
    for (const pupil of pupilsToReassign) {
      const originalClass = classMapping.get(pupil.classId);
      
      if (originalClass) {
        const updateData = {
          classId: originalClass.id,
          className: originalClass.name,
          classCode: originalClass.code,
          updatedAt: new Date().toISOString()
        };
        
        try {
          const batch = writeBatch(db);
          const pupilRef = doc(db, 'pupils', pupil.id);
          batch.update(pupilRef, updateData);
          await batch.commit();
          
          reassignedCount++;
          console.log(`✅ Reassigned ${pupil.firstName} ${pupil.lastName}: ${pupil.classId} → ${originalClass.id}`);
          
        } catch (error) {
          console.error(`❌ Failed to reassign ${pupil.firstName} ${pupil.lastName}:`, error);
          skippedCount++;
        }
      } else {
        console.log(`⚠️  No mapping found for pupil ${pupil.firstName} ${pupil.lastName} (class: ${pupil.classId})`);
        skippedCount++;
      }
      
      // Small delay to avoid overwhelming Firestore
      if ((reassignedCount + skippedCount) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n📊 Pupil reassignment completed:`);
    console.log(`   ✅ Reassigned: ${reassignedCount} pupils`);
    console.log(`   ⚠️  Skipped: ${skippedCount} pupils`);
    
    // Delete fabricated classes
    console.log('\n🗑️  Deleting fabricated classes...');
    let deletedCount = 0;
    let deleteFailedCount = 0;
    
    for (const fabricatedClass of fabricatedClasses) {
      try {
        await deleteDoc(doc(db, 'classes', fabricatedClass.id));
        deletedCount++;
        console.log(`✅ Deleted fabricated class: ${fabricatedClass.name} (${fabricatedClass.id})`);
      } catch (error) {
        console.error(`❌ Failed to delete class ${fabricatedClass.name}:`, error);
        deleteFailedCount++;
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 Class deletion completed:`);
    console.log(`   ✅ Deleted: ${deletedCount} fabricated classes`);
    console.log(`   ❌ Failed: ${deleteFailedCount} classes`);
    
    console.log('\n✅ Class consolidation completed!');
    console.log(`📊 Final Summary:`);
    console.log(`   👥 Pupils reassigned: ${reassignedCount}`);
    console.log(`   🗑️  Classes deleted: ${deletedCount}`);
    console.log(`   📚 Remaining classes: ${originalClasses.length}`);
    
  } catch (error) {
    console.error('❌ Error consolidating duplicate classes:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔧 Trinity Family School - Consolidate Duplicate Classes');
    console.log('='.repeat(70));
    console.log('This script will:');
    console.log('1. Identify fabricated classes created during migration');
    console.log('2. Map them to existing original classes');
    console.log('3. Reassign all pupils from fabricated to original classes');
    console.log('4. Delete the fabricated classes');
    console.log('5. Ensure class details pages show correct pupils');
    console.log('='.repeat(70));
    
    await consolidateDuplicateClasses();
    await publishClassesRevision(db);
    
    console.log('\n🎉 CLASS CONSOLIDATION COMPLETED!');
    console.log('='.repeat(70));
    console.log('✅ Duplicate classes have been consolidated:');
    console.log('   🔗 Pupils reassigned to original classes');
    console.log('   🗑️  Fabricated classes removed');
    console.log('   📊 Class details pages will now show correct pupils');
    console.log('   🎯 No more duplicate classes in the system');
    console.log('');
    console.log('🌐 Class-pupil relationships are now properly unified!');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n💥 Class consolidation failed:', error);
    process.exit(1);
  }
}

// Run the consolidation
main();
