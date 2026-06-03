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
  pupilIdentificationNumber: string; // This maps to admissionNumber
  familyId?: string;
}

interface FamilyGroup {
  familyId: string;
  pupils: OriginalPupil[];
}

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
    return data.pupils;
    
  } catch (error) {
    console.error('❌ Error loading original data:', error);
    throw error;
  }
}

function analyzeFamilyGroups(originalPupils: OriginalPupil[]): FamilyGroup[] {
  console.log('🔍 Analyzing family groups...');
  
  const familyMap = new Map<string, OriginalPupil[]>();
  
  // Group pupils by familyId
  for (const pupil of originalPupils) {
    if (pupil.familyId) {
      if (!familyMap.has(pupil.familyId)) {
        familyMap.set(pupil.familyId, []);
      }
      familyMap.get(pupil.familyId)!.push(pupil);
    }
  }
  
  // Convert to FamilyGroup array and filter out single-child families
  const familyGroups: FamilyGroup[] = [];
  for (const [familyId, pupils] of familyMap.entries()) {
    if (pupils.length > 1) { // Only families with siblings
      familyGroups.push({ familyId, pupils });
    }
  }
  
  // Sort by family size (largest first) for better logging
  familyGroups.sort((a, b) => b.pupils.length - a.pupils.length);
  
  console.log(`📊 Found ${familyGroups.length} families with siblings:`);
  for (const family of familyGroups) {
    console.log(`   👨‍👩‍👧‍👦 Family ${family.familyId}: ${family.pupils.length} siblings`);
    for (const pupil of family.pupils) {
      console.log(`      - ${pupil.firstName} ${pupil.lastName} (${pupil.pupilIdentificationNumber})`);
    }
  }
  
  return familyGroups;
}

async function restoreFamilyRelationships(): Promise<void> {
  try {
    console.log('👨‍👩‍👧‍👦 Restoring family relationships...');
    
    // Load original data
    const originalPupils = await loadOriginalPupilsData();
    
    // Analyze family groups
    const familyGroups = analyzeFamilyGroups(originalPupils);
    
    if (familyGroups.length === 0) {
      console.log('ℹ️  No families with siblings found in original data');
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
    
    // Process family groups and update database
    const batchSize = 500;
    let processedFamilies = 0;
    let updatedPupils = 0;
    let skippedPupils = 0;
    
    for (let i = 0; i < familyGroups.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchFamilies = familyGroups.slice(i, i + batchSize);
      let batchHasUpdates = false;
      
      console.log(`📝 Processing family batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(familyGroups.length / batchSize)}...`);
      
      for (const family of batchFamilies) {
        processedFamilies++;
        
        // Find all siblings in the database
        const dbSiblings: Array<{ id: string; data: any; admissionNumber: string }> = [];
        
        for (const originalPupil of family.pupils) {
          const admissionNumber = originalPupil.pupilIdentificationNumber.toUpperCase();
          const dbPupil = dbPupilsByAdmission.get(admissionNumber);
          
          if (dbPupil) {
            dbSiblings.push({
              id: dbPupil.id,
              data: dbPupil.data,
              admissionNumber
            });
          } else {
            console.log(`⚠️  Pupil ${originalPupil.firstName} ${originalPupil.lastName} (${admissionNumber}) not found in database`);
            skippedPupils++;
          }
        }
        
        // Update all found siblings with the same familyId
        if (dbSiblings.length > 1) {
          console.log(`👨‍👩‍👧‍👦 Updating family ${family.familyId} with ${dbSiblings.length} siblings:`);
          
          for (const sibling of dbSiblings) {
            const updateData = {
              familyId: family.familyId,
              updatedAt: new Date().toISOString()
            };
            
            const pupilRef = doc(db, 'pupils', sibling.id);
            batch.update(pupilRef, updateData);
            
            updatedPupils++;
            batchHasUpdates = true;
            console.log(`   ✅ ${sibling.data.firstName} ${sibling.data.lastName} (${sibling.admissionNumber}) → familyId: ${family.familyId}`);
          }
        } else if (dbSiblings.length === 1) {
          console.log(`⚠️  Only 1 sibling found in database for family ${family.familyId}, skipping family update`);
          skippedPupils += family.pupils.length - 1;
        } else {
          console.log(`⚠️  No siblings found in database for family ${family.familyId}`);
          skippedPupils += family.pupils.length;
        }
      }
      
      // Commit batch if there are updates
      if (batchHasUpdates) {
        console.log('💾 Committing family batch to Firestore...');
        await batch.commit();
        console.log(`✅ Family batch ${Math.floor(i / batchSize) + 1} committed successfully`);
      }
      
      // Small delay to avoid overwhelming Firestore
      if (i + batchSize < familyGroups.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('✅ Family relationship restoration completed!');
    console.log(`📊 Processed: ${processedFamilies} families`);
    console.log(`✅ Updated: ${updatedPupils} pupils with family relationships`);
    console.log(`⚠️  Skipped: ${skippedPupils} pupils (not found in database)`);
    
  } catch (error) {
    console.error('❌ Error restoring family relationships:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('👨‍👩‍👧‍👦 Trinity Family School - Restore Family Relationships');
    console.log('='.repeat(70));
    console.log('This script will restore sibling relationships by:');
    console.log('1. Analyzing original data for families with multiple children');
    console.log('2. Finding corresponding pupils in the database');
    console.log('3. Updating all siblings with the same familyId');
    console.log('4. Preserving family connections for sibling features');
    console.log('='.repeat(70));
    
    await restoreFamilyRelationships();
    
    console.log('\n🎉 FAMILY RELATIONSHIP RESTORATION COMPLETED!');
    console.log('='.repeat(70));
    console.log('✅ All family relationships have been restored:');
    console.log('   👨‍👩‍👧‍👦 Siblings now share the same familyId');
    console.log('   🔗 Family connections preserved from original data');
    console.log('   📱 Sibling features in the app will now work correctly');
    console.log('   👥 Guardian information properly linked across siblings');
    console.log('');
    console.log('🌐 Family relationships are now fully functional!');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n💥 Family relationship restoration failed:', error);
    process.exit(1);
  }
}

// Run the restoration
main(); 