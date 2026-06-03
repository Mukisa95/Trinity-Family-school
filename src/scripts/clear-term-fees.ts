import { db } from '../lib/firebase';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';

const PUPILS_COLLECTION = 'pupils';
const FEE_COLLECTIONS_COLLECTION = 'feeCollections';

async function clearTermFees() {
  try {
    console.log('🧹 Clearing Term 1 and Term 2 Fees for All Pupils');
    console.log('This will reset all fee balances to zero for terms 1 and 2.\n');
    
    // Get all pupils
    console.log('📋 Fetching all pupils...');
    const pupilsSnapshot = await getDocs(collection(db, PUPILS_COLLECTION));
    const pupils = pupilsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${pupils.length} pupils to process.\n`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const pupil of pupils) {
      try {
        console.log(`Processing pupil: ${pupil.firstName} ${pupil.lastName} (${pupil.id})`);
        
        // Get all fee collections for this pupil
        const feeCollectionsQuery = query(
          collection(db, FEE_COLLECTIONS_COLLECTION),
          where('pupilId', '==', pupil.id)
        );
        
        const feeCollectionsSnapshot = await getDocs(feeCollectionsQuery);
        const feeCollections = feeCollectionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log(`  Found ${feeCollections.length} fee collections`);
        
        let updatedCollections = 0;
        
        for (const feeCollection of feeCollections) {
          // Check if this fee collection is for term 1 or term 2
          const termId = feeCollection.termId;
          
          if (termId === 't1-2025' || termId === 't2-2025') {
            console.log(`    Clearing fees for term: ${termId}`);
            
            // Update the fee collection to clear all balances
            const updatedData = {
              // Clear all fee amounts
              tuitionFee: 0,
              developmentFee: 0,
              examinationFee: 0,
              libraryFee: 0,
              sportsFee: 0,
              medicalFee: 0,
              transportFee: 0,
              uniformFee: 0,
              otherFees: 0,
              
              // Clear all paid amounts
              tuitionFeePaid: 0,
              developmentFeePaid: 0,
              examinationFeePaid: 0,
              libraryFeePaid: 0,
              sportsFeePaid: 0,
              medicalFeePaid: 0,
              transportFeePaid: 0,
              uniformFeePaid: 0,
              otherFeesPaid: 0,
              
              // Clear all balances
              tuitionFeeBalance: 0,
              developmentFeeBalance: 0,
              examinationFeeBalance: 0,
              libraryFeeBalance: 0,
              sportsFeeBalance: 0,
              medicalFeeBalance: 0,
              transportFeeBalance: 0,
              uniformFeeBalance: 0,
              otherFeesBalance: 0,
              
              // Clear total amounts
              totalFees: 0,
              totalPaid: 0,
              totalBalance: 0,
              
              // Clear payment history
              paymentHistory: [],
              
              // Update timestamp
              updatedAt: new Date().toISOString(),
              
              // Add note about the clearing
              notes: `Fees cleared for fresh start in Term 3. Original data preserved in backup. Cleared on ${new Date().toISOString()}`,
            };
            
            await updateDoc(doc(db, FEE_COLLECTIONS_COLLECTION, feeCollection.id), updatedData);
            updatedCollections++;
            
            console.log(`    ✅ Cleared fees for term ${termId}`);
          }
        }
        
        if (updatedCollections > 0) {
          console.log(`  ✅ Updated ${updatedCollections} fee collections for ${pupil.firstName} ${pupil.lastName}`);
        } else {
          console.log(`  ⚠️ No fee collections found for terms 1 or 2`);
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing pupil ${pupil.firstName} ${pupil.lastName}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Fee Clearing Complete!');
    console.log('========================');
    console.log(`✅ Successfully processed: ${processedCount} pupils`);
    console.log(`❌ Errors encountered: ${errorCount} pupils`);
    console.log(`📊 Total pupils: ${pupils.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎯 All pupils now have zero balances for Term 1 and Term 2!');
      console.log('You can now start fresh with Term 3 fees.');
    } else {
      console.log('\n⚠️ Some pupils had errors. Please check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Critical error during fee clearing:', error);
  }
}

// Run the script
clearTermFees();
