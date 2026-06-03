/**
 * Quick script to check push subscriptions in your database
 * Run this in your browser console on any authenticated page
 */

async function checkPushSubscriptions() {
  console.log('🔍 Checking push subscriptions...\n');
  
  try {
    // Import Firestore
    const { collection, getDocs } = await import('firebase/firestore');
    const { db } = await import('./src/lib/firebase');
    
    // Get all subscriptions
    const subscriptionsRef = collection(db, 'pushSubscriptions');
    const snapshot = await getDocs(subscriptionsRef);
    
    console.log(`📊 Total subscriptions found: ${snapshot.size}\n`);
    
    if (snapshot.size === 0) {
      console.log('⚠️ NO SUBSCRIPTIONS FOUND!');
      console.log('💡 Users need to click the bell icon to enable push notifications');
      console.log('💡 Location: /notifications page → top-right bell button\n');
      return;
    }
    
    // Show details
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n📱 Subscription #${index + 1}:`);
      console.log(`   User ID: ${data.userId}`);
      console.log(`   Active: ${data.isActive ? '✅ Yes' : '❌ No'}`);
      console.log(`   Endpoint: ${data.endpoint?.substring(0, 50)}...`);
      console.log(`   Has keys: ${(data.keys?.p256dh || data.p256dh) ? '✅ Yes' : '❌ No'}`);
      console.log(`   Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
    });
    
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error checking subscriptions:', error);
  }
}

// Run the check
checkPushSubscriptions();


