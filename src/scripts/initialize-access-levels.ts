import { AccessLevelsService } from '../lib/services/access-levels.service';

async function initializeAccessLevels() {
  try {
    console.log('Initializing predefined access levels...');
    
    // Initialize predefined access levels
    await AccessLevelsService.initializePredefinedLevels('system');
    
    console.log('✅ Predefined access levels initialized successfully!');
    console.log('\nAvailable access levels:');
    console.log('- Teacher: Standard teacher access with pupil management and attendance recording');
    console.log('- Accountant: Financial management access for fee collection and banking');
    console.log('- Administrator: Administrative access with user management and system settings');
    console.log('- Procurement Officer: Procurement and inventory management access');
    
    console.log('\nYou can now:');
    console.log('1. Go to Settings > Access Levels to manage these levels');
    console.log('2. Use them when creating new staff accounts');
    console.log('3. Create custom access levels for specific roles');
    
  } catch (error) {
    console.error('❌ Error initializing access levels:', error);
    process.exit(1);
  }
}

// Run the script
initializeAccessLevels();
