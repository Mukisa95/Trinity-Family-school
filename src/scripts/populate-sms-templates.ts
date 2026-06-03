import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { SMSService } from '../lib/services/sms.service';
import { sampleSMSTemplates } from '../lib/sample-data/sms-templates';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCMFVoGNdrBAuPoDjaNpsgionEnkq45JSA",
  authDomain: "trinity-family-schools.firebaseapp.com",
  projectId: "trinity-family-schools",
  storageBucket: "trinity-family-schools.firebasestorage.app",
  messagingSenderId: "148171496339",
  appId: "1:148171496339:web:c441b0e1e3116f129ba666",
  measurementId: "G-Z3G3D3EXRW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('Firebase config:', { projectId: firebaseConfig.projectId });

async function populateSMSTemplates() {
  console.log('🚀 Starting SMS Templates Population');
  console.log(`📝 Found ${sampleSMSTemplates.length} templates to create`);

  try {
    let successCount = 0;
    let errorCount = 0;

    for (const template of sampleSMSTemplates) {
      try {
        console.log(`📤 Creating template: ${template.name}`);
        const templateId = await SMSService.createSMSTemplate(template);
        console.log(`✅ Created template: ${template.name} (ID: ${templateId})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to create template: ${template.name}`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Population Summary:');
    console.log(`✅ Successfully created: ${successCount} templates`);
    console.log(`❌ Failed to create: ${errorCount} templates`);
    console.log(`📝 Total processed: ${successCount + errorCount} templates`);

    if (successCount > 0) {
      console.log('\n🎉 SMS Templates population completed successfully!');
      console.log('You can now use these templates in the Bulk SMS feature.');
    }

    if (errorCount > 0) {
      console.log('\n⚠️  Some templates failed to be created. Please check the errors above.');
    }

  } catch (error) {
    console.error('💥 Fatal error during SMS templates population:', error);
    process.exit(1);
  }
}

// Run the population script
populateSMSTemplates()
  .then(() => {
    console.log('\n🏁 Script execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }); 