import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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

async function debugClassPupils(): Promise<void> {
  try {
    console.log('🔍 Debugging Class-Pupil Relationships');
    console.log('='.repeat(60));
    
    // Get all classes
    console.log('📚 Fetching all classes...');
    const classesRef = collection(db, 'classes');
    const classesSnapshot = await getDocs(classesRef);
    
    if (classesSnapshot.empty) {
      console.log('❌ No classes found!');
      return;
    }
    
    const classes = classesSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      code: doc.data().code,
      level: doc.data().level
    }));
    
    console.log(`✅ Found ${classes.length} classes:`);
    classes.forEach(cls => {
      console.log(`   📚 ${cls.name} (${cls.code}) - ID: ${cls.id}`);
    });
    
    console.log('\n👥 Fetching all pupils...');
    const pupilsRef = collection(db, 'pupils');
    const pupilsSnapshot = await getDocs(pupilsRef);
    
    if (pupilsSnapshot.empty) {
      console.log('❌ No pupils found!');
      return;
    }
    
    const pupils = pupilsSnapshot.docs.map(doc => ({
      id: doc.id,
      firstName: doc.data().firstName,
      lastName: doc.data().lastName,
      admissionNumber: doc.data().admissionNumber,
      classId: doc.data().classId,
      className: doc.data().className,
      classCode: doc.data().classCode
    }));
    
    console.log(`✅ Found ${pupils.length} pupils total`);
    
    // Group pupils by classId
    const pupilsByClass = new Map<string, any[]>();
    const pupilsWithoutClass: any[] = [];
    
    for (const pupil of pupils) {
      if (pupil.classId) {
        if (!pupilsByClass.has(pupil.classId)) {
          pupilsByClass.set(pupil.classId, []);
        }
        pupilsByClass.get(pupil.classId)!.push(pupil);
      } else {
        pupilsWithoutClass.push(pupil);
      }
    }
    
    console.log('\n📊 Pupils by Class:');
    console.log('='.repeat(60));
    
    for (const cls of classes) {
      const classPupils = pupilsByClass.get(cls.id) || [];
      console.log(`\n📚 ${cls.name} (${cls.code}) - ID: ${cls.id}`);
      console.log(`   👥 ${classPupils.length} pupils assigned`);
      
      if (classPupils.length > 0) {
        classPupils.forEach(pupil => {
          console.log(`      - ${pupil.firstName} ${pupil.lastName} (${pupil.admissionNumber})`);
        });
      } else {
        console.log(`      ⚠️  No pupils assigned to this class`);
      }
      
      // Test the specific query that the app uses
      console.log(`   🔍 Testing query: where('classId', '==', '${cls.id}')`);
      try {
        const testQuery = query(
          collection(db, 'pupils'),
          where('classId', '==', cls.id)
        );
        const testSnapshot = await getDocs(testQuery);
        const testPupils = testSnapshot.docs.map(doc => ({
          id: doc.id,
          firstName: doc.data().firstName,
          lastName: doc.data().lastName,
          admissionNumber: doc.data().admissionNumber
        }));
        
        console.log(`   ✅ Query returned ${testPupils.length} pupils`);
        if (testPupils.length !== classPupils.length) {
          console.log(`   ⚠️  MISMATCH: Expected ${classPupils.length}, got ${testPupils.length}`);
        }
      } catch (error) {
        console.log(`   ❌ Query failed:`, error);
      }
    }
    
    // Check for pupils with invalid class IDs
    console.log('\n🔍 Checking for pupils with invalid class IDs:');
    const validClassIds = new Set(classes.map(c => c.id));
    const pupilsWithInvalidClass: any[] = [];
    
    for (const pupil of pupils) {
      if (pupil.classId && !validClassIds.has(pupil.classId)) {
        pupilsWithInvalidClass.push(pupil);
      }
    }
    
    if (pupilsWithInvalidClass.length > 0) {
      console.log(`❌ Found ${pupilsWithInvalidClass.length} pupils with invalid class IDs:`);
      pupilsWithInvalidClass.forEach(pupil => {
        console.log(`   - ${pupil.firstName} ${pupil.lastName} (${pupil.admissionNumber}) → classId: ${pupil.classId}`);
      });
    } else {
      console.log('✅ All pupils have valid class IDs');
    }
    
    if (pupilsWithoutClass.length > 0) {
      console.log(`\n⚠️  Found ${pupilsWithoutClass.length} pupils without class assignment:`);
      pupilsWithoutClass.forEach(pupil => {
        console.log(`   - ${pupil.firstName} ${pupil.lastName} (${pupil.admissionNumber})`);
      });
    }
    
    console.log('\n📋 Summary:');
    console.log(`   📚 Total Classes: ${classes.length}`);
    console.log(`   👥 Total Pupils: ${pupils.length}`);
    console.log(`   ✅ Pupils with valid classes: ${pupils.length - pupilsWithoutClass.length - pupilsWithInvalidClass.length}`);
    console.log(`   ⚠️  Pupils without classes: ${pupilsWithoutClass.length}`);
    console.log(`   ❌ Pupils with invalid classes: ${pupilsWithInvalidClass.length}`);
    
  } catch (error) {
    console.error('❌ Error debugging class-pupil relationships:', error);
    throw error;
  }
}

async function main() {
  try {
    await debugClassPupils();
    console.log('\n🎉 Debug completed!');
  } catch (error) {
    console.error('\n💥 Debug failed:', error);
    process.exit(1);
  }
}

// Run the debug
main(); 