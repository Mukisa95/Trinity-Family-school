import { collection, getDocs } from 'firebase/firestore';
import { db } from './src/lib/firebase';

async function checkDatabase() {
    console.log('📊 Checking Firestore collections...\n');

    try {
        // Check users collection
        const usersSnapshot = await getDocs(collection(db, 'users'));
        console.log(`✅ Users collection: ${usersSnapshot.size} documents`);

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`  - ${doc.id}: ${data.username || data.email} (${data.role || 'no role'})`);
        });

        // Check staff collection
        const staffSnapshot = await getDocs(collection(db, 'staff'));
        console.log(`\n✅ Staff collection: ${staffSnapshot.size} documents`);

        // Check pupils
        const pupilsSnapshot = await getDocs(collection(db, 'pupils'));
        console.log(`✅ Pupils collection: ${pupilsSnapshot.size} documents\n`);

        console.log('CONCLUSION:');
        console.log(`- Only ${usersSnapshot.size} user account(s) exist in 'users' collection`);
        console.log(`- But ${staffSnapshot.size} staff records exist in 'staff' collection`);
        console.log(`- Staff and parents need user accounts created in 'users' collection to receive notifications`);

    } catch (error) {
        console.error('Error:', error);
    }
}

checkDatabase();

export { };
