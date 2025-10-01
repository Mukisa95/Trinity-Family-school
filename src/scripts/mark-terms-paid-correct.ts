import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';

const PUPILS_COLLECTION = 'pupils';
const PAYMENTS_COLLECTION = 'payments';
const FEE_STRUCTURES_COLLECTION = 'feeStructures';

async function markTermsAsPaidCorrect() {
  try {
    console.log('💰 Marking Term 1 and Term 2 Fees as PAID for All Pupils');
    console.log('This will create payment records to mark fees as fully paid.\n');
    
    // Get all pupils
    console.log('📋 Fetching all pupils...');
    const pupilsSnapshot = await getDocs(collection(db, PUPILS_COLLECTION));
    const pupils = pupilsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${pupils.length} pupils to process.\n`);
    
    // Get all fee structures to create payments for
    console.log('📋 Fetching fee structures...');
    const feeStructuresSnapshot = await getDocs(collection(db, FEE_STRUCTURES_COLLECTION));
    const feeStructures = feeStructuresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${feeStructures.length} fee structures.\n`);
    
    let processedCount = 0;
    let errorCount = 0;
    let paymentRecordsCreated = 0;
    
    for (const pupil of pupils) {
      try {
        console.log(`Processing pupil: ${pupil.firstName} ${pupil.lastName} (${pupil.id})`);
        
        // Check if payments already exist for this pupil for terms 1 and 2
        const existingPaymentsQuery = query(
          collection(db, PAYMENTS_COLLECTION),
          where('pupilId', '==', pupil.id)
        );
        
        const existingPaymentsSnapshot = await getDocs(existingPaymentsQuery);
        const existingPayments = existingPaymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log(`  Found ${existingPayments.length} existing payment records`);
        
        // Process Term 1 and Term 2
        const termsToProcess = [
          { termId: 't1-2025', termName: 'Term 1' },
          { termId: 't2-2025', termName: 'Term 2' }
        ];
        
        for (const term of termsToProcess) {
          // Check if payments already exist for this term
          const existingTermPayments = existingPayments.filter(p => p.termId === term.termId);
          
          if (existingTermPayments.length > 0) {
            console.log(`    Payments already exist for ${term.termName} (${existingTermPayments.length} records)`);
            continue;
          }
          
          // Create payment records for each fee structure
          for (const feeStructure of feeStructures) {
            // Skip if this fee structure is not applicable to this pupil
            if (feeStructure.category === 'Discount' || feeStructure.amount <= 0) {
              continue;
            }
            
            // Create a payment record marking this fee as fully paid
            const paymentRecord = {
              pupilId: pupil.id,
              feeStructureId: feeStructure.id,
              academicYearId: 'FXhxeUDDEUNNva2x8vg4', // 2025 academic year
              termId: term.termId,
              amount: feeStructure.amount,
              paymentDate: new Date().toISOString(),
              balance: 0, // No balance remaining
              paidBy: {
                id: 'system-admin',
                name: 'System Administrator',
                role: 'Administrator'
              },
              notes: `Marked as fully paid for fresh start in Term 3. Created on ${new Date().toISOString()}`,
              reverted: false,
              createdAt: new Date().toISOString(),
              
              // Add metadata to identify this as a system-created payment
              isSystemCreated: true,
              createdForTerm3FreshStart: true,
              originalFeeAmount: feeStructure.amount,
              paymentType: 'full-payment'
            };
            
            await addDoc(collection(db, PAYMENTS_COLLECTION), paymentRecord);
            paymentRecordsCreated++;
          }
          
          console.log(`    ✅ Created payment records for ${term.termName}`);
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing pupil ${pupil.firstName} ${pupil.lastName}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Payment Records Creation Complete!');
    console.log('=====================================');
    console.log(`✅ Successfully processed: ${processedCount} pupils`);
    console.log(`💳 Payment records created: ${paymentRecordsCreated}`);
    console.log(`❌ Errors encountered: ${errorCount} pupils`);
    console.log(`📊 Total pupils: ${pupils.length}`);
    console.log(`📊 Total fee structures: ${feeStructures.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎯 All pupils now have Term 1 and Term 2 fees marked as PAID!');
      console.log('Term 3 will start with zero balances - no carryover from previous terms.');
      console.log(`\n📝 Created ${paymentRecordsCreated} payment records across ${feeStructures.length} fee structures.`);
    } else {
      console.log('\n⚠️ Some pupils had errors. Please check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Critical error during payment record creation:', error);
  }
}

// Run the script
markTermsAsPaidCorrect();

