/**
 * 🔍 Diagnostic Script: Check Parent Push Subscriptions
 * 
 * Run this in browser console on your app to debug why parents aren't getting push notifications
 * 
 * Usage:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Run: await checkParentSubscriptions()
 */

async function checkParentSubscriptions() {
  console.log('🔍 ===== PARENT PUSH NOTIFICATIONS DIAGNOSTIC =====');
  console.log('');
  
  try {
    // Import Firebase modules
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const { db } = await import('./src/lib/firebase');
    
    console.log('📊 Step 1: Checking all push subscriptions...');
    const subscriptionsRef = collection(db, 'pushSubscriptions');
    const allSubscriptionsSnapshot = await getDocs(subscriptionsRef);
    
    console.log(`✅ Total subscriptions in database: ${allSubscriptionsSnapshot.size}`);
    
    if (allSubscriptionsSnapshot.empty) {
      console.log('❌ NO SUBSCRIPTIONS FOUND IN DATABASE!');
      console.log('💡 This means NO users (staff or parents) have subscribed yet.');
      console.log('');
      console.log('📝 To fix:');
      console.log('1. Ask users to visit /notifications page');
      console.log('2. Users should see a bell icon that turns GREEN when clicked');
      console.log('3. Users must allow notifications when browser prompts');
      return;
    }
    
    // Group subscriptions by user ID
    const subscriptionsByUser = {};
    allSubscriptionsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (!subscriptionsByUser[data.userId]) {
        subscriptionsByUser[data.userId] = [];
      }
      subscriptionsByUser[data.userId].push({
        id: doc.id,
        userId: data.userId,
        isActive: data.isActive,
        createdAt: data.createdAt,
        endpoint: data.endpoint?.substring(0, 50) + '...'
      });
    });
    
    console.log(`✅ Subscriptions for ${Object.keys(subscriptionsByUser).length} unique users`);
    console.log('');
    
    // Now check users collection to identify parents
    console.log('📊 Step 2: Checking all users and their roles...');
    const usersRef = collection(db, 'users');
    const allUsersSnapshot = await getDocs(usersRef);
    
    console.log(`✅ Total users in database: ${allUsersSnapshot.size}`);
    console.log('');
    
    const parents = [];
    const staff = [];
    const admins = [];
    const others = [];
    
    allUsersSnapshot.forEach((doc) => {
      const user = { id: doc.id, ...doc.data() };
      
      switch(user.role?.toLowerCase()) {
        case 'parent':
          parents.push(user);
          break;
        case 'staff':
        case 'teacher':
          staff.push(user);
          break;
        case 'admin':
          admins.push(user);
          break;
        default:
          others.push(user);
      }
    });
    
    console.log('👥 Users by role:');
    console.log(`   👨‍👩‍👧‍👦 Parents: ${parents.length}`);
    console.log(`   👔 Staff/Teachers: ${staff.length}`);
    console.log(`   👑 Admins: ${admins.length}`);
    console.log(`   👤 Others: ${others.length}`);
    console.log('');
    
    // Check which parents have subscriptions
    console.log('📊 Step 3: Checking which parents have push subscriptions...');
    
    const parentsWithSubscriptions = parents.filter(parent => subscriptionsByUser[parent.id]);
    const parentsWithoutSubscriptions = parents.filter(parent => !subscriptionsByUser[parent.id]);
    
    console.log(`✅ Parents WITH subscriptions: ${parentsWithSubscriptions.length}`);
    if (parentsWithSubscriptions.length > 0) {
      console.log('   Parents who can receive push notifications:');
      parentsWithSubscriptions.forEach(parent => {
        const subs = subscriptionsByUser[parent.id];
        const activeSubs = subs.filter(s => s.isActive);
        console.log(`   - ${parent.name || parent.email} (${activeSubs.length} active)`);
      });
    }
    console.log('');
    
    console.log(`❌ Parents WITHOUT subscriptions: ${parentsWithoutSubscriptions.length}`);
    if (parentsWithoutSubscriptions.length > 0) {
      console.log('   Parents who CANNOT receive push notifications:');
      parentsWithoutSubscriptions.slice(0, 10).forEach(parent => {
        console.log(`   - ${parent.name || parent.email} (ID: ${parent.id})`);
      });
      if (parentsWithoutSubscriptions.length > 10) {
        console.log(`   ... and ${parentsWithoutSubscriptions.length - 10} more`);
      }
    }
    console.log('');
    
    // Check which staff have subscriptions
    console.log('📊 Step 4: Checking which staff have push subscriptions...');
    
    const staffWithSubscriptions = staff.filter(s => subscriptionsByUser[s.id]);
    const staffWithoutSubscriptions = staff.filter(s => !subscriptionsByUser[s.id]);
    
    console.log(`✅ Staff WITH subscriptions: ${staffWithSubscriptions.length}`);
    if (staffWithSubscriptions.length > 0) {
      console.log('   Staff who can receive push notifications:');
      staffWithSubscriptions.forEach(s => {
        const subs = subscriptionsByUser[s.id];
        const activeSubs = subs.filter(sub => sub.isActive);
        console.log(`   - ${s.name || s.email} (${activeSubs.length} active)`);
      });
    }
    console.log('');
    
    console.log(`❌ Staff WITHOUT subscriptions: ${staffWithoutSubscriptions.length}`);
    console.log('');
    
    // Summary and recommendations
    console.log('📊 ===== SUMMARY =====');
    console.log('');
    
    if (parentsWithoutSubscriptions.length === 0) {
      console.log('✅ All parents have push subscriptions! No issue detected.');
    } else {
      console.log('❌ PROBLEM IDENTIFIED:');
      console.log(`   ${parentsWithoutSubscriptions.length} out of ${parents.length} parents have NO push subscriptions`);
      console.log('');
      console.log('💡 SOLUTION:');
      console.log('   These parents need to:');
      console.log('   1. Log in to their account');
      console.log('   2. Visit the /notifications page');
      console.log('   3. Click the bell icon (🔔) in the top right');
      console.log('   4. Allow notifications when the browser prompts');
      console.log('');
      console.log('   OR (if auto-subscribe is enabled):');
      console.log('   1. Log in to their account');
      console.log('   2. Visit the /notifications page');
      console.log('   3. Allow notifications when automatically prompted');
      console.log('');
      console.log('   The bell icon should turn GREEN when subscribed.');
    }
    
    // Check if the current user is a parent without subscription
    const currentUserId = localStorage.getItem('userId');
    if (currentUserId) {
      const currentUser = parents.find(p => p.id === currentUserId) || 
                         staff.find(s => s.id === currentUserId) ||
                         admins.find(a => a.id === currentUserId);
      
      if (currentUser) {
        console.log('');
        console.log('👤 CURRENT USER STATUS:');
        console.log(`   Name: ${currentUser.name || currentUser.email}`);
        console.log(`   Role: ${currentUser.role}`);
        console.log(`   ID: ${currentUser.id}`);
        
        if (subscriptionsByUser[currentUser.id]) {
          const subs = subscriptionsByUser[currentUser.id];
          const activeSubs = subs.filter(s => s.isActive);
          console.log(`   ✅ HAS ${activeSubs.length} active subscription(s)`);
          console.log('   You should be able to receive push notifications!');
        } else {
          console.log('   ❌ NO SUBSCRIPTIONS FOUND');
          console.log('   Click the bell icon (🔔) at the top of this page to subscribe!');
        }
      }
    }
    
    console.log('');
    console.log('🔍 ===== DIAGNOSTIC COMPLETE =====');
    
    return {
      totalUsers: allUsersSnapshot.size,
      totalSubscriptions: allSubscriptionsSnapshot.size,
      parents: {
        total: parents.length,
        withSubscriptions: parentsWithSubscriptions.length,
        withoutSubscriptions: parentsWithoutSubscriptions.length,
        list: parentsWithoutSubscriptions.map(p => ({ id: p.id, name: p.name || p.email }))
      },
      staff: {
        total: staff.length,
        withSubscriptions: staffWithSubscriptions.length,
        withoutSubscriptions: staffWithoutSubscriptions.length
      }
    };
    
  } catch (error) {
    console.error('❌ Error running diagnostic:', error);
    console.error('Make sure you are running this in the browser console on your app.');
  }
}

console.log('✅ Diagnostic script loaded!');
console.log('📝 Run: await checkParentSubscriptions()');

