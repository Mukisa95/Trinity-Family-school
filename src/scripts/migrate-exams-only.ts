import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { DataMigration } from '../lib/utils/data-migration';

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

async function migrateExamsOnly() {
  console.log('Firebase config:', { projectId: firebaseConfig.projectId, env: process.env.NODE_ENV });
  console.log('Firebase initialized with project:', firebaseConfig.projectId);
  console.log('Starting exams-only migration to Firebase...');
  
  try {
    await DataMigration.migrateExams();
    await DataMigration.migrateExamResults();
    console.log('✅ Exams migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateExamsOnly(); 