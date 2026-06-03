// Quick script to check users in Firestore
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./trinity-family-schools-firebase-adminsdk-z6uxi-a40c8c1abb.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUsers() {
    console.log('📊 Checking Firestore users collection...\n');

    // Check users collection
    const usersSnapshot = await db.collection('users').get();
    console.log(`✅ Users collection: ${usersSnapshot.size} documents`);

    usersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${doc.id}: ${data.username || data.email} (${data.role})`);
    });

    console.log('\n📊 Checking staff collection...\n');

    // Check staff collection
    const staffSnapshot = await db.collection('staff').get();
    console.log(`✅ Staff collection: ${staffSnapshot.size} documents`);

    console.log('\n📊 Checking pupils for guardians...\n');

    // Check pupils collection for guardians
    const pupilsSnapshot = await db.collection('pupils').get();
    const guardians = new Set();

    pupilsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.guardians && Array.isArray(data.guardians)) {
            data.guardians.forEach(guardian => {
                if (guardian.email || guardian.phone) {
                    guardians.add(JSON.stringify(guardian));
                }
            });
        }
    });

    console.log(`✅ Pupils collection: ${pupilsSnapshot.size} documents`);
    console.log(`✅ Unique guardians found: ${guardians.size}`);

    process.exit(0);
}

checkUsers().catch(console.error);
