import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { AcademicYearsService } from '../lib/services/academic-years.service';

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

async function verifyMigration() {
  try {
    console.log('🔍 Verifying academic years migration...');
    
    const academicYears = await AcademicYearsService.getAllAcademicYears();
    
    console.log(`✅ Found ${academicYears.length} academic years in Firebase`);
    
    if (academicYears.length > 0) {
      console.log('\n📋 Sample academic years:');
      academicYears.slice(0, 5).forEach((year, index) => {
        console.log(`${index + 1}. ${year.name} (${year.startDate} - ${year.endDate}) - ${year.terms.length} terms`);
        if (year.isActive) {
          console.log(`   🟢 ACTIVE YEAR`);
        }
      });
      
      const activeYear = academicYears.find(year => year.isActive);
      if (activeYear) {
        console.log(`\n🎯 Active Academic Year: ${activeYear.name}`);
        console.log(`📅 Period: ${activeYear.startDate} to ${activeYear.endDate}`);
        console.log(`📚 Terms: ${activeYear.terms.length}`);
        activeYear.terms.forEach((term, index) => {
          console.log(`   ${index + 1}. ${term.name}: ${term.startDate} - ${term.endDate}`);
        });
      }
    } else {
      console.log('❌ No academic years found in Firebase');
    }
    
  } catch (error) {
    console.error('❌ Error verifying migration:', error);
  }
}

verifyMigration(); 