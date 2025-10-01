import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { SchoolSettingsService } from '../lib/services/school-settings.service';
import { sampleSchoolSettings } from '../lib/sample-data';

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

async function migrateSchoolSettings() {
  console.log('Firebase config:', { projectId: firebaseConfig.projectId, env: process.env.NODE_ENV });
  console.log('Firebase initialized with project:', firebaseConfig.projectId);
  console.log('Starting school settings migration to Firebase...');
  
  try {
    // Check if settings already exist
    const existingSettings = await SchoolSettingsService.getSchoolSettings();
    
    if (existingSettings) {
      console.log('✅ School settings already exist in Firebase');
      console.log('School Name:', existingSettings.generalInfo.name);
      console.log('Established:', existingSettings.generalInfo.establishedYear);
    } else {
      console.log('📝 Initializing school settings in Firebase...');
      await SchoolSettingsService.initializeSchoolSettings(sampleSchoolSettings);
      console.log('✅ School settings migration completed successfully!');
      console.log('School Name:', sampleSchoolSettings.generalInfo.name);
      console.log('Established:', sampleSchoolSettings.generalInfo.establishedYear);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateSchoolSettings(); 