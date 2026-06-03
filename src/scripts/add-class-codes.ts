import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

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

console.log('Firebase config:', { projectId: firebaseConfig.projectId, env: process.env.NODE_ENV });
console.log('Firebase initialized with project:', firebaseConfig.projectId);

// Function to generate class code based on name and level
function generateClassCode(name: string, level: string): string {
  const nameLower = name.toLowerCase();
  
  // Nursery classes
  if (level === 'Nursery') {
    if (nameLower.includes('nursery')) return 'N.1';
    if (nameLower.includes('pre-k')) return 'N.2';
    return 'N.1';
  }
  
  // Primary classes
  if (level === 'Lower Primary' || level === 'Upper Primary') {
    if (nameLower.includes('year 1') || nameLower.includes('grade 1') || nameLower.includes('primary 1')) return 'P.1';
    if (nameLower.includes('year 2') || nameLower.includes('grade 2') || nameLower.includes('primary 2')) return 'P.2';
    if (nameLower.includes('year 3') || nameLower.includes('grade 3') || nameLower.includes('primary 3')) return 'P.3';
    if (nameLower.includes('year 4') || nameLower.includes('grade 4') || nameLower.includes('primary 4')) return 'P.4';
    if (nameLower.includes('year 5') || nameLower.includes('grade 5') || nameLower.includes('primary 5')) return 'P.5';
    if (nameLower.includes('year 6') || nameLower.includes('grade 6') || nameLower.includes('primary 6')) return 'P.6';
    if (nameLower.includes('year 7') || nameLower.includes('grade 7') || nameLower.includes('primary 7')) return 'P.7';
    if (nameLower.includes('year 8') || nameLower.includes('grade 8') || nameLower.includes('primary 8')) return 'P.8';
    return 'P.1'; // Default
  }
  
  // Secondary classes
  if (level === 'Secondary') {
    if (nameLower.includes('grade 9') || nameLower.includes('form 1') || nameLower.includes('year 9')) return 'S.1';
    if (nameLower.includes('grade 10') || nameLower.includes('form 2') || nameLower.includes('year 10')) return 'S.2';
    if (nameLower.includes('grade 11') || nameLower.includes('form 3') || nameLower.includes('year 11')) return 'S.3';
    if (nameLower.includes('grade 12') || nameLower.includes('form 4') || nameLower.includes('year 12')) return 'S.4';
    
    // Handle specific cases like "Grade 10A", "Grade 11B"
    const match = nameLower.match(/grade (\d+)([a-z]?)/);
    if (match) {
      const gradeNum = parseInt(match[1]);
      const section = match[2] ? match[2].toUpperCase() : '';
      if (gradeNum >= 9 && gradeNum <= 12) {
        const secondaryLevel = gradeNum - 8; // Grade 9 = S.1, Grade 10 = S.2, etc.
        return `S.${secondaryLevel}${section}`;
      }
    }
    
    return 'S.1'; // Default
  }
  
  // Default fallback
  return 'CLS.1';
}

async function addClassCodes() {
  try {
    console.log('Starting class codes migration...');
    
    // Get all classes
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const classes = classesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<{id: string; name: string; level: string; code?: string}>;
    
    console.log(`Found ${classes.length} classes to update`);
    
    let updatedCount = 0;
    
    for (const classData of classes) {
      // Check if class already has a code
      if (classData.code) {
        console.log(`Class "${classData.name}" already has code: ${classData.code}`);
        continue;
      }
      
      // Generate code
      const code = generateClassCode(classData.name, classData.level);
      
      // Update the class
      const classRef = doc(db, 'classes', classData.id);
      await updateDoc(classRef, { code });
      
      console.log(`Updated class "${classData.name}" with code: ${code}`);
      updatedCount++;
    }
    
    console.log(`\n✅ Migration completed successfully!`);
    console.log(`📊 Updated ${updatedCount} classes with codes`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
addClassCodes().then(() => {
  console.log('Migration script finished');
  process.exit(0);
}).catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
}); 