import { db } from '../lib/firebase';
import { collection, getDocs, deleteDoc, query, where, doc } from 'firebase/firestore';

const PAYMENTS_COLLECTION = 'payments';
const FEE_COLLECTIONS_COLLECTION = 'feeCollections';

async function undoFeeChanges() {
  try {
    console.log('🗑️ Removing all incorrect fee changes made for Terms 1 and 2');
    console.log('This will delete delete payment records and fee collections created by the scripts.\n');
    
    let deletedPayments = 0;
    let deletedFeeCollections = 0;
    let errorCount = 0;
    
    // Delete system-created payment records
    console.log('💳 Deleting system-created payment records...');
    try {
      const paymentsQuery = query(
        collection(db, PAYMENTS_COLLECTION),
        where('isSystemCreated', '==', true)
      );
      
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const systemPayments = paymentsSnapshot.docs;
      
      console.log(`Found ${systemPayments.length} system-created payment records to delete`);
      
      for (const paymentDoc of systemPayments) {
        try {
          await deleteDoc(doc(db, PAYMENTS_COLLECTION, paymentDoc.id));
          deletedPayments++;
        } catch (error) {
          console.error(`Error deleting payment ${paymentDoc.id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`✅ Deleted ${deletedPayments} payment records`);
      
    } catch (error) {
      console.error('Error querying payment records:', error);
      errorCount++;
    }
    
    // Delete fee collections with the specific notes we added
    console.log('\n📋 Deleting fee collections created by scripts...');
    try {
      const feeCollectionsQuery = query(
        collection(db, FEE_COLLECTIONS_COLLECTION),
        where('notes', '>=', 'Fees marked as fully paid for fresh start in Term 3')
      );
      
      const feeCollectionsSnapshot = await getDocs(feeCollectionsQuery);
      const scriptFeeCollections = feeCollectionsSnapshot.docs;
      
      console.log(`Found ${scriptFeeCollections.length} fee collections created by scripts to delete`);
      
      for (const feeCollectionDoc of scriptFeeCollections) {
        try {
          const data = feeCollectionDoc.data();
          if (data.notes && data.notes.includes('fresh start in Term 3')) {
            await deleteDoc(doc(db, FEE_COLLECTIONS_COLLECTION, feeCollectionDoc.id));
            deletedFeeCollections++;
          }
        } catch (error) {
          console.error(`Error deleting fee collection ${feeCollectionDoc.id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`✅ Deleted ${deletedFeeCollections} fee collections`);
      
    } catch (error) {
      console.error('Error querying fee collections:', error);
      errorCount++;
    }
    
    // Also delete any fee collections that have the specific reference pattern
    console.log('\n🔍 Checking for fee collections with TERM- pattern...');
    try {
      const allFeeCollectionsSnapshot = await getDocs(collection(db, FEE_COLLECTIONS_COLLECTION));
      const allFeeCollections = allFeeCollectionsSnapshot.docs;
      
      let additionalDeleted = 0;
      
      for (const feeCollectionDoc of allFeeCollections) {
        try {
          const data = feeCollectionDoc.data();
          
          // Check if this has the payment history we created
          if (data.paymentHistory && Array.isArray(data.paymentHistory)) {
            const hasSystemPayment = data.paymentHistory.some((payment: any) => 
              payment.reference && payment.reference.includes('TERM-') && 
              payment.notes && payment.notes.includes('prevent carryover to Term 3')
            );
            
            if (hasSystemPayment) {
              await deleteDoc(doc(db, FEE_COLLECTIONS_COLLECTION, feeCollectionDoc.id));
              additionalDeleted++;
            }
          }
        } catch (error) {
          console.error(`Error processing fee collection ${feeCollectionDoc.id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`✅ Deleted ${additionalDeleted} additional fee collections with TERM- pattern`);
      deletedFeeCollections += additionalDeleted;
      
    } catch (error) {
      console.error('Error checking fee collections:', error);
      errorCount++;
    }
    
    console.log('\n🎉 Undo Complete!');
    console.log('================');
    console.log(`💳 Payment records deleted: ${deletedPayments}`);
    console.log(`📋 Fee collections deleted: ${deletedFeeCollections}`);
    console.log(`❌ Errors encountered: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n✅ All incorrect fee changes have been removed!');
      console.log('The fee system is now back to its original state.');
    } else {
      console.log('\n⚠️ Some errors occurred during cleanup. Check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Critical error during undo operation:', error);
  }
}

// Run the cleanup script
undoFeeChanges();
