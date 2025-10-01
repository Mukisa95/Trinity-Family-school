import { db } from '../lib/firebase';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { UsersService } from '../lib/services/users.service';

const SIGNATURES_COLLECTION = 'signatures';
const AUDIT_TRAIL_COLLECTION = 'auditTrail';

async function fixDigitalSignatureNames() {
  try {
    console.log('🔍 Scanning for digital signatures with undefined names...');
    
    // Get all signatures
    const signaturesRef = collection(db, SIGNATURES_COLLECTION);
    const signaturesSnapshot = await getDocs(signaturesRef);
    
    let fixedCount = 0;
    let totalCount = signaturesSnapshot.docs.length;
    
    console.log(`📊 Found ${totalCount} signatures to check`);
    
    for (const signatureDoc of signaturesSnapshot.docs) {
      const signatureData = signatureDoc.data();
      
      // Check if userName contains 'undefined' or is empty
      if (!signatureData.userName || signatureData.userName.includes('undefined')) {
        console.log(`🔧 Fixing signature ${signatureDoc.id} with userName: "${signatureData.userName}"`);
        
        let newUserName = 'Unknown User';
        
        // Try to get user data to fix the name
        if (signatureData.userId) {
          try {
            const user = await UsersService.getUserById(signatureData.userId);
            if (user) {
              if (user.firstName && user.lastName) {
                newUserName = `${user.firstName} ${user.lastName}`.trim();
              } else if (user.firstName) {
                newUserName = user.firstName;
              } else if (user.lastName) {
                newUserName = user.lastName;
              } else if (user.username) {
                newUserName = user.username;
              }
            }
          } catch (error) {
            console.log(`⚠️  Could not fetch user data for ${signatureData.userId}, using fallback`);
          }
        }
        
        // Update the signature
        await updateDoc(doc(db, SIGNATURES_COLLECTION, signatureDoc.id), {
          userName: newUserName
        });
        
        console.log(`✅ Updated signature ${signatureDoc.id}: "${signatureData.userName}" → "${newUserName}"`);
        fixedCount++;
      }
    }
    
    // Also fix audit trail entries
    console.log('\n🔍 Scanning audit trail entries...');
    
    const auditTrailRef = collection(db, AUDIT_TRAIL_COLLECTION);
    const auditTrailSnapshot = await getDocs(auditTrailRef);
    
    let auditFixedCount = 0;
    let auditTotalCount = auditTrailSnapshot.docs.length;
    
    console.log(`📊 Found ${auditTotalCount} audit trail entries to check`);
    
    for (const auditDoc of auditTrailSnapshot.docs) {
      const auditData = auditDoc.data();
      
      // Check if signature.userName contains 'undefined' or is empty
      if (auditData.signature && 
          (!auditData.signature.userName || auditData.signature.userName.includes('undefined'))) {
        
        console.log(`🔧 Fixing audit trail ${auditDoc.id} with userName: "${auditData.signature.userName}"`);
        
        let newUserName = 'Unknown User';
        
        // Try to get user data to fix the name
        if (auditData.signature.userId) {
          try {
            const user = await UsersService.getUserById(auditData.signature.userId);
            if (user) {
              if (user.firstName && user.lastName) {
                newUserName = `${user.firstName} ${user.lastName}`.trim();
              } else if (user.firstName) {
                newUserName = user.firstName;
              } else if (user.lastName) {
                newUserName = user.lastName;
              } else if (user.username) {
                newUserName = user.username;
              }
            }
          } catch (error) {
            console.log(`⚠️  Could not fetch user data for ${auditData.signature.userId}, using fallback`);
          }
        }
        
        // Update the audit trail entry
        await updateDoc(doc(db, AUDIT_TRAIL_COLLECTION, auditDoc.id), {
          'signature.userName': newUserName
        });
        
        console.log(`✅ Updated audit trail ${auditDoc.id}: "${auditData.signature.userName}" → "${newUserName}"`);
        auditFixedCount++;
      }
    }
    
    console.log('\n🎉 Digital signature name fix completed!');
    console.log(`📈 Summary:`);
    console.log(`   - Signatures fixed: ${fixedCount}/${totalCount}`);
    console.log(`   - Audit trail entries fixed: ${auditFixedCount}/${auditTotalCount}`);
    console.log(`   - Total records processed: ${fixedCount + auditFixedCount}`);
    
    if (fixedCount > 0 || auditFixedCount > 0) {
      console.log('\n✨ All digital signatures should now display proper names!');
    } else {
      console.log('\n✨ No signatures needed fixing - all names were already correct!');
    }
    
  } catch (error) {
    console.error('❌ Error fixing digital signature names:', error);
    process.exit(1);
  }
}

// Run the script
fixDigitalSignatureNames();
