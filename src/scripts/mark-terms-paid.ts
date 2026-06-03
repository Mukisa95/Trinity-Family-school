import { db } from '../lib/firebase';
import { collection, getDocs, updateDoc, doc, query, where, addDoc } from 'firebase/firestore';

const PUPILS_COLLECTION = 'pupils';
const FEE_COLLECTIONS_COLLECTION = 'feeCollections';

async function markTermsAsPaid() {
  try {
    console.log('💰 Marking Term 1 and Term 2 Fees as PAID for All Pupils');
    console.log('This will create fee records and mark them as fully paid to prevent carryover to Term 3.\n');
    
    // Get all pupils
    console.log('📋 Fetching all pupils...');
    const pupilsSnapshot = await getDocs(collection(db, PUPILS_COLLECTION));
    const pupils = pupilsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${pupils.length} pupils to process.\n`);
    
    let processedCount = 0;
    let errorCount = 0;
    let feeRecordsCreated = 0;
    
    for (const pupil of pupils) {
      try {
        console.log(`Processing pupil: ${pupil.firstName} ${pupil.lastName} (${pupil.id})`);
        
        // Check if fee collections already exist for this pupil
        const feeCollectionsQuery = query(
          collection(db, FEE_COLLECTIONS_COLLECTION),
          where('pupilId', '==', pupil.id)
        );
        
        const feeCollectionsSnapshot = await getDocs(feeCollectionsQuery);
        const existingFeeCollections = feeCollectionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log(`  Found ${existingFeeCollections.length} existing fee collections`);
        
        // Process Term 1 and Term 2
        const termsToProcess = ['t1-2025', 't2-2025'];
        
        for (const termId of termsToProcess) {
          // Check if fee collection already exists for this term
          const existingCollection = existingFeeCollections.find(fc => fc.termId === termId);
          
          if (existingCollection) {
            // Update existing fee collection to mark as fully paid
            console.log(`    Updating existing fee collection for term: ${termId}`);
            
            const updatedData = {
              // Set reasonable fee amounts (you can adjust these)
              tuitionFee: 500000,
              developmentFee: 100000,
              examinationFee: 50000,
              libraryFee: 30000,
              sportsFee: 20000,
              medicalFee: 25000,
              transportFee: 150000,
              uniformFee: 100000,
              otherFees: 0,
              
              // Mark all as fully paid
              tuitionFeePaid: 500000,
              developmentFeePaid: 100000,
              examinationFeePaid: 50000,
              libraryFeePaid: 30000,
              sportsFeePaid: 20000,
              medicalFeePaid: 25000,
              transportFeePaid: 150000,
              uniformFeePaid: 100000,
              otherFeesPaid: 0,
              
              // Set all balances to zero
              tuitionFeeBalance: 0,
              developmentFeeBalance: 0,
              examinationFeeBalance: 0,
              libraryFeeBalance: 0,
              sportsFeeBalance: 0,
              medicalFeeBalance: 0,
              transportFeeBalance: 0,
              uniformFeeBalance: 0,
              otherFeesBalance: 0,
              
              // Calculate totals
              totalFees: 1080000,
              totalPaid: 1080000,
              totalBalance: 0,
              
              // Add payment history
              paymentHistory: [{
                amount: 1080000,
                date: new Date().toISOString(),
                method: 'Bank Transfer',
                reference: `TERM-${termId}-FULL-PAYMENT`,
                notes: 'Marked as fully paid to prevent carryover to Term 3',
                recordedBy: 'System Administrator'
              }],
              
              // Update timestamp
              updatedAt: new Date().toISOString(),
              
              // Add note about the marking
              notes: `Fees marked as fully paid for fresh start in Term 3. Marked on ${new Date().toISOString()}`,
            };
            
            await updateDoc(doc(db, FEE_COLLECTIONS_COLLECTION, existingCollection.id), updatedData);
            console.log(`    ✅ Updated fee collection for term ${termId}`);
            
          } else {
            // Create new fee collection marked as fully paid
            console.log(`    Creating new fee collection for term: ${termId}`);
            
            const newFeeCollection = {
              pupilId: pupil.id,
              pupilName: `${pupil.firstName} ${pupil.lastName}`,
              termId: termId,
              academicYearId: 'FXhxeUDDEUNNva2x8vg4', // 2025 academic year
              academicYearName: '2025',
              
              // Set reasonable fee amounts (you can adjust these)
              tuitionFee: 500000,
              developmentFee: 100000,
              examinationFee: 50000,
              libraryFee: 30000,
              sportsFee: 20000,
              medicalFee: 25000,
              transportFee: 150000,
              uniformFee: 100000,
              otherFees: 0,
              
              // Mark all as fully paid
              tuitionFeePaid: 500000,
              developmentFeePaid: 100000,
              examinationFeePaid: 50000,
              libraryFeePaid: 30000,
              sportsFeePaid: 20000,
              medicalFeePaid: 25000,
              transportFeePaid: 150000,
              uniformFeePaid: 100000,
              otherFeesPaid: 0,
              
              // Set all balances to zero
              tuitionFeeBalance: 0,
              developmentFeeBalance: 0,
              examinationFeeBalance: 0,
              libraryFeeBalance: 0,
              sportsFeeBalance: 0,
              medicalFeeBalance: 0,
              transportFeeBalance: 0,
              uniformFeeBalance: 0,
              otherFeesBalance: 0,
              
              // Calculate totals
              totalFees: 1080000,
              totalPaid: 1080000,
              totalBalance: 0,
              
              // Add payment history
              paymentHistory: [{
                amount: 1080000,
                date: new Date().toISOString(),
                method: 'Bank Transfer',
                reference: `TERM-${termId}-FULL-PAYMENT`,
                notes: 'Marked as fully paid to prevent carryover to Term 3',
                recordedBy: 'System Administrator'
              }],
              
              // Status and metadata
              status: 'Paid',
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              
              // Add note about the creation
              notes: `Fees marked as fully paid for fresh start in Term 3. Created on ${new Date().toISOString()}`,
            };
            
            await addDoc(collection(db, FEE_COLLECTIONS_COLLECTION), newFeeCollection);
            feeRecordsCreated++;
            console.log(`    ✅ Created fee collection for term ${termId}`);
          }
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing pupil ${pupil.firstName} ${pupil.lastName}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Fee Marking Complete!');
    console.log('========================');
    console.log(`✅ Successfully processed: ${processedCount} pupils`);
    console.log(`📝 Fee records created: ${feeRecordsCreated}`);
    console.log(`❌ Errors encountered: ${errorCount} pupils`);
    console.log(`📊 Total pupils: ${pupils.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎯 All pupils now have Term 1 and Term 2 fees marked as PAID!');
      console.log('Term 3 will start with zero balances - no carryover from previous terms.');
    } else {
      console.log('\n⚠️ Some pupils had errors. Please check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Critical error during fee marking:', error);
  }
}

// Run the script
markTermsAsPaid();
