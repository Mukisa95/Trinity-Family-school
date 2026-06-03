/**
 * 🔍 Debug Parent Subscription Mismatch
 * 
 * This script helps identify WHY parents have subscriptions but pushSent is still 0
 * 
 * Run in browser console on your app
 */

async function debugParentSubscriptionMismatch() {
  console.log('🔍 ===== DEBUGGING PARENT SUBSCRIPTION MISMATCH =====');
  console.log('');
  
  try {
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const { db } = await import('./src/lib/firebase');
    
    // Step 1: Get all push subscriptions
    console.log('📊 Step 1: Fetching ALL push subscriptions...');
    const subscriptionsRef = collection(db, 'pushSubscriptions');
    const allSubscriptionsSnapshot = await getDocs(subscriptionsRef);
    
    console.log(`✅ Found ${allSubscriptionsSnapshot.size} total subscriptions`);
    
    const subscriptions = [];
    allSubscriptionsSnapshot.forEach(doc => {
      subscriptions.push({
        id: doc.id,
        userId: doc.data().userId,
        isActive: doc.data().isActive,
        endpoint: doc.data().endpoint?.substring(0, 50) + '...'
      });
    });
    
    console.log('Subscriptions:', subscriptions);
    console.log('');
    
    // Step 2: Get all parents from system_users
    console.log('📊 Step 2: Fetching parents from system_users collection...');
    const systemUsersRef = collection(db, 'system_users');
    const systemParentsQuery = query(
      systemUsersRef,
      where('role', '==', 'Parent'),
      where('isActive', '==', true)
    );
    const systemParentsSnapshot = await getDocs(systemParentsQuery);
    
    console.log(`✅ Found ${systemParentsSnapshot.size} parents in system_users`);
    
    const systemParents = [];
    systemParentsSnapshot.forEach(doc => {
      systemParents.push({
        id: doc.id,
        email: doc.data().email,
        name: doc.data().name,
        role: doc.data().role
      });
    });
    
    console.log('System Users Parents:', systemParents);
    console.log('');
    
    // Step 3: Get all users from users collection (if exists)
    console.log('📊 Step 3: Fetching parents from users collection...');
    try {
      const usersRef = collection(db, 'users');
      const usersParentsQuery = query(
        usersRef,
        where('role', '==', 'Parent')
      );
      const usersParentsSnapshot = await getDocs(usersParentsQuery);
      
      console.log(`✅ Found ${usersParentsSnapshot.size} parents in users collection`);
      
      const usersParents = [];
      usersParentsSnapshot.forEach(doc => {
        usersParents.push({
          id: doc.id,
          email: doc.data().email,
          name: doc.data().name,
          role: doc.data().role
        });
      });
      
      console.log('Users Collection Parents:', usersParents);
    } catch (e) {
      console.log('⚠️ users collection might not exist or no parent role there');
    }
    console.log('');
    
    // Step 4: Check for mismatches
    console.log('📊 Step 4: Checking for mismatches...');
    console.log('');
    
    const subscriptionUserIds = subscriptions.map(s => s.userId);
    const systemParentIds = systemParents.map(p => p.id);
    
    console.log('👥 Subscription User IDs:', subscriptionUserIds);
    console.log('👥 System Parents IDs:', systemParentIds);
    console.log('');
    
    // Find subscriptions that don't match any parent
    const orphanedSubscriptions = subscriptions.filter(sub => 
      !systemParentIds.includes(sub.userId)
    );
    
    if (orphanedSubscriptions.length > 0) {
      console.log('❌ PROBLEM FOUND: Orphaned subscriptions (userId not in system_users)');
      console.log(`   ${orphanedSubscriptions.length} subscriptions have userIds that don't exist in system_users`);
      console.log('   Orphaned subscriptions:', orphanedSubscriptions);
      console.log('');
      console.log('💡 SOLUTION: These parent accounts might be in a different collection');
      console.log('   Check if these userIds exist in:');
      console.log('   - users collection');
      console.log('   - auth collection');
      console.log('   - Or if they need role: "Parent" in system_users');
    } else {
      console.log('✅ All subscriptions match parents in system_users');
    }
    console.log('');
    
    // Find parents without subscriptions
    const parentsWithoutSubscriptions = systemParents.filter(parent =>
      !subscriptionUserIds.includes(parent.id)
    );
    
    if (parentsWithoutSubscriptions.length > 0) {
      console.log(`⚠️ ${parentsWithoutSubscriptions.length} parents don't have subscriptions:`);
      parentsWithoutSubscriptions.forEach(parent => {
        console.log(`   - ${parent.name || parent.email} (ID: ${parent.id})`);
      });
    }
    console.log('');
    
    // Step 5: Check specific subscription details
    console.log('📊 Step 5: Checking subscription details...');
    for (const sub of subscriptions) {
      const parentExists = systemParentIds.includes(sub.userId);
      const parent = systemParents.find(p => p.id === sub.userId);
      
      console.log(`Subscription ${sub.id}:`);
      console.log(`  userId: ${sub.userId}`);
      console.log(`  isActive: ${sub.isActive}`);
      console.log(`  Parent exists in system_users: ${parentExists ? '✅' : '❌'}`);
      if (parent) {
        console.log(`  Parent: ${parent.name || parent.email}`);
      }
      console.log('');
    }
    
    // Step 6: Final diagnosis
    console.log('📊 ===== DIAGNOSIS =====');
    console.log('');
    
    if (orphanedSubscriptions.length > 0) {
      console.log('❌ ROOT CAUSE: Parent userIds in subscriptions don\'t match userIds in system_users');
      console.log('');
      console.log('🔧 TO FIX:');
      console.log('1. Check which collection stores parent user accounts');
      console.log('2. Make sure getUsersByRole("parent") queries the correct collection');
      console.log('3. Or update subscriptions to use the correct userId');
      console.log('');
      console.log('Run this to check where the userId exists:');
      orphanedSubscriptions.forEach(sub => {
        console.log(`   Check userId ${sub.userId} in all collections`);
      });
    } else if (subscriptions.length === 0) {
      console.log('❌ ROOT CAUSE: No subscriptions found at all');
      console.log('   Parents need to enable push notifications');
    } else if (systemParents.length === 0) {
      console.log('❌ ROOT CAUSE: No parent accounts in system_users');
      console.log('   Parent accounts might be in a different collection');
    } else {
      console.log('✅ Subscriptions and parents match correctly');
      console.log('   The issue might be elsewhere (permissions, VAPID keys, etc.)');
    }
    
    console.log('');
    console.log('🔍 ===== DEBUG COMPLETE =====');
    
  } catch (error) {
    console.error('❌ Error running diagnostic:', error);
  }
}

console.log('✅ Debug script loaded!');
console.log('📝 Run: await debugParentSubscriptionMismatch()');

