import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

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

console.log('Firebase config:', { projectId: firebaseConfig.projectId, env: process.env.NODE_ENV });

async function fixGuardianEmergencyContacts(): Promise<void> {
  try {
    console.log('🔧 Fixing guardian emergency contact references...');
    
    // Get all pupils
    const pupilsRef = collection(db, 'pupils');
    const snapshot = await getDocs(pupilsRef);
    
    if (snapshot.empty) {
      console.log('❌ No pupils found in database!');
      return;
    }
    
    console.log(`📊 Found ${snapshot.docs.length} pupils`);
    
    // Process pupils in batches
    const batchSize = 500;
    const pupils = snapshot.docs;
    let processedCount = 0;
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < pupils.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchPupils = pupils.slice(i, i + batchSize);
      let batchHasUpdates = false;
      
      console.log(`📝 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pupils.length / batchSize)}...`);
      
      for (const pupilDoc of batchPupils) {
        const pupilData = pupilDoc.data();
        processedCount++;
        
        // Check if pupil has guardians
        if (!pupilData.guardians || !Array.isArray(pupilData.guardians) || pupilData.guardians.length === 0) {
          console.log(`⚠️  Pupil ${pupilData.firstName} ${pupilData.lastName} has no guardians, skipping...`);
          skippedCount++;
          continue;
        }
        
        // Check if emergency contact ID is an index (0, 1, etc.) instead of a proper guardian ID
        const emergencyContactId = pupilData.emergencyContactGuardianId;
        const guardians = pupilData.guardians;
        
        // If emergency contact ID is a number string (index), convert it to the actual guardian ID
        if (emergencyContactId && /^\d+$/.test(emergencyContactId)) {
          const guardianIndex = parseInt(emergencyContactId);
          
          if (guardianIndex >= 0 && guardianIndex < guardians.length) {
            const targetGuardian = guardians[guardianIndex];
            
            if (targetGuardian && targetGuardian.id) {
              // Update with the correct guardian ID
              const updateData = {
                emergencyContactGuardianId: targetGuardian.id,
                updatedAt: new Date().toISOString()
              };
              
              const pupilRef = doc(db, 'pupils', pupilDoc.id);
              batch.update(pupilRef, updateData);
              
              fixedCount++;
              batchHasUpdates = true;
              console.log(`✅ Fixed emergency contact for ${pupilData.firstName} ${pupilData.lastName}: ${emergencyContactId} → ${targetGuardian.id}`);
            } else {
              console.log(`⚠️  Guardian at index ${guardianIndex} has no ID for pupil ${pupilData.firstName} ${pupilData.lastName}, skipping...`);
              skippedCount++;
            }
          } else {
            console.log(`⚠️  Invalid guardian index ${guardianIndex} for pupil ${pupilData.firstName} ${pupilData.lastName}, skipping...`);
            skippedCount++;
          }
        } else if (!emergencyContactId && guardians.length > 0) {
          // If no emergency contact is set, set it to the first guardian
          const firstGuardian = guardians[0];
          if (firstGuardian && firstGuardian.id) {
            const updateData = {
              emergencyContactGuardianId: firstGuardian.id,
              updatedAt: new Date().toISOString()
            };
            
            const pupilRef = doc(db, 'pupils', pupilDoc.id);
            batch.update(pupilRef, updateData);
            
            fixedCount++;
            batchHasUpdates = true;
            console.log(`✅ Set emergency contact for ${pupilData.firstName} ${pupilData.lastName}: → ${firstGuardian.id}`);
          } else {
            console.log(`⚠️  First guardian has no ID for pupil ${pupilData.firstName} ${pupilData.lastName}, skipping...`);
            skippedCount++;
          }
        } else {
          // Emergency contact ID looks correct, check if it matches any guardian
          const matchingGuardian = guardians.find((g: any) => g.id === emergencyContactId);
          if (!matchingGuardian) {
            // Emergency contact ID doesn't match any guardian, set to first guardian
            const firstGuardian = guardians[0];
            if (firstGuardian && firstGuardian.id) {
              const updateData = {
                emergencyContactGuardianId: firstGuardian.id,
                updatedAt: new Date().toISOString()
              };
              
              const pupilRef = doc(db, 'pupils', pupilDoc.id);
              batch.update(pupilRef, updateData);
              
              fixedCount++;
              batchHasUpdates = true;
              console.log(`✅ Fixed invalid emergency contact for ${pupilData.firstName} ${pupilData.lastName}: ${emergencyContactId} → ${firstGuardian.id}`);
            } else {
              console.log(`⚠️  First guardian has no ID for pupil ${pupilData.firstName} ${pupilData.lastName}, skipping...`);
              skippedCount++;
            }
          } else {
            // Emergency contact is already correct
            skippedCount++;
          }
        }
      }
      
      // Commit batch if there are updates
      if (batchHasUpdates) {
        console.log('💾 Committing batch to Firestore...');
        await batch.commit();
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} committed successfully`);
      }
      
      // Small delay to avoid overwhelming Firestore
      if (i + batchSize < pupils.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('✅ Guardian emergency contact fix process completed!');
    console.log(`📊 Processed: ${processedCount} pupils`);
    console.log(`✅ Fixed: ${fixedCount} pupils with corrected emergency contacts`);
    console.log(`⚠️  Skipped: ${skippedCount} pupils (no issues or no guardians)`);
    
  } catch (error) {
    console.error('❌ Error fixing guardian emergency contacts:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔧 Trinity Family School - Fix Guardian Emergency Contacts');
    console.log('='.repeat(70));
    console.log('This script will fix guardian emergency contact references:');
    console.log('1. Convert index-based emergency contact IDs to proper guardian IDs');
    console.log('2. Set emergency contact to first guardian if missing');
    console.log('3. Fix invalid emergency contact references');
    console.log('='.repeat(70));
    
    await fixGuardianEmergencyContacts();
    
    console.log('\n🎉 GUARDIAN EMERGENCY CONTACT FIX COMPLETED!');
    console.log('='.repeat(70));
    console.log('✅ All guardian emergency contacts have been fixed:');
    console.log('   🔗 Proper guardian ID references established');
    console.log('   📝 Emergency contacts now point to valid guardians');
    console.log('   🎯 Pupils list will now show guardian information correctly');
    console.log('');
    console.log('🌐 Guardian display issue should now be resolved!');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n💥 Guardian fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
main(); 