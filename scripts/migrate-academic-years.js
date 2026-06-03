/**
 * Migration Script: Copy Academic Years from Dev to Production
 * 
 * This script safely copies academic years data from trinity-family-schools (dev)
 * to trinity-family-ganda (production).
 */

const admin = require('firebase-admin');
const fs = require('fs');

// Initialize dev Firebase (source)
const devServiceAccount = require('../service-account-dev.json'); // You'll need to download this
const devApp = admin.initializeApp({
  credential: admin.credential.cert(devServiceAccount),
  databaseURL: 'https://trinity-family-schools.firebaseio.com'
}, 'dev');

const devDb = devApp.firestore();

// Initialize production Firebase (destination)
const prodServiceAccount = require('../service-account-prod.json'); // You'll need to download this
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(prodServiceAccount),
  databaseURL: 'https://trinity-family-ganda.firebaseio.com'
}, 'prod');

const prodDb = prodApp.firestore();

async function migrateAcademicYears() {
  try {
    console.log('🚀 Starting Academic Years Migration...\n');
    
    // Step 1: Fetch from dev
    console.log('📥 Fetching academic years from DEV (trinity-family-schools)...');
    const devSnapshot = await devDb.collection('academicYears').get();
    
    if (devSnapshot.empty) {
      console.log('❌ No academic years found in dev database!');
      return;
    }

    const academicYears = [];
    devSnapshot.forEach(doc => {
      academicYears.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`✅ Found ${academicYears.length} academic years in dev database\n`);

    // Display what will be migrated
    console.log('📋 Academic Years to migrate:');
    console.log('═'.repeat(80));
    academicYears.forEach((year, index) => {
      console.log(`\n${index + 1}. Year: ${year.year}`);
      console.log(`   ID: ${year.id}`);
      console.log(`   Active: ${year.isActive ? '✅ Yes' : '❌ No'}`);
      console.log(`   Current Term: ${year.currentTermId || 'Not set'}`);
      console.log(`   Terms: ${year.terms ? year.terms.length : 0}`);
      if (year.terms) {
        year.terms.forEach(term => {
          console.log(`      - ${term.name || term.id}: ${term.startDate} to ${term.endDate}`);
        });
      }
    });
    console.log('\n' + '═'.repeat(80) + '\n');

    // Export to JSON file for backup
    const backupFile = 'academic-years-backup.json';
    fs.writeFileSync(backupFile, JSON.stringify(academicYears, null, 2));
    console.log(`💾 Backup saved to: ${backupFile}\n`);

    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('⚠️  Do you want to migrate these to PRODUCTION? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Migration cancelled.');
        readline.close();
        process.exit(0);
      }

      try {
        console.log('\n📤 Migrating to PRODUCTION (trinity-family-ganda)...\n');

        // Step 2: Check if production already has data
        const prodSnapshot = await prodDb.collection('academicYears').get();
        if (!prodSnapshot.empty) {
          console.log(`⚠️  Production database already has ${prodSnapshot.size} academic years!`);
          readline.question('Do you want to OVERWRITE them? (yes/no): ', async (overwrite) => {
            if (overwrite.toLowerCase() !== 'yes') {
              console.log('❌ Migration cancelled to prevent data loss.');
              readline.close();
              process.exit(0);
            }

            await performMigration(academicYears);
            readline.close();
          });
        } else {
          await performMigration(academicYears);
          readline.close();
        }
      } catch (error) {
        console.error('❌ Migration failed:', error);
        readline.close();
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

async function performMigration(academicYears) {
  const batch = prodDb.batch();
  let count = 0;

  for (const year of academicYears) {
    const { id, ...data } = year;
    const docRef = prodDb.collection('academicYears').doc(id);
    batch.set(docRef, data);
    count++;
  }

  await batch.commit();
  
  console.log(`\n✅ Successfully migrated ${count} academic years to production!`);
  console.log('🎉 Migration complete!\n');
  
  console.log('📍 Next steps:');
  console.log('1. Verify data at: https://console.firebase.google.com/project/trinity-family-ganda/firestore');
  console.log('2. Hard refresh your Vercel app (when deployment limit resets)');
  console.log('3. Navigate to /fees/analytics');
  console.log('4. Analytics should now load successfully!\n');
}

// Run the migration
migrateAcademicYears();

