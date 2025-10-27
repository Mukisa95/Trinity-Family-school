// Simple script to export academic years from Firestore
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exportAcademicYears() {
  try {
    console.log('📥 Fetching academic years from Firestore...');
    
    const snapshot = await db.collection('academicYears').get();
    
    if (snapshot.empty) {
      console.log('❌ No academic years found!');
      return;
    }

    const academicYears = [];
    snapshot.forEach(doc => {
      academicYears.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Save to JSON file
    const outputFile = 'academic-years-export.json';
    fs.writeFileSync(outputFile, JSON.stringify(academicYears, null, 2));
    
    console.log(`✅ Exported ${academicYears.length} academic years to ${outputFile}`);
    console.log('\nAcademic Years:');
    academicYears.forEach((year, i) => {
      console.log(`${i + 1}. ${year.year} (${year.terms?.length || 0} terms) - Active: ${year.isActive}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

exportAcademicYears();

