import { SMSProvidersService } from '@/lib/services/sms-providers.service';

async function initializeSMSProviders() {
  try {
    console.log('Initializing SMS providers...');
    
    await SMSProvidersService.initializeDefaultProviders();
    
    console.log('✅ SMS providers initialized successfully!');
    
    // List all providers
    const providers = await SMSProvidersService.getProviders();
    console.log('\n📋 Available SMS Providers:');
    providers.forEach(provider => {
      console.log(`  • ${provider.name} (${provider.isActive ? 'Active' : 'Inactive'})${provider.isDefault ? ' - Default' : ''}`);
    });
    
    // Show active provider
    const activeProvider = await SMSProvidersService.getActiveProvider();
    if (activeProvider) {
      console.log(`\n🎯 Active Provider: ${activeProvider.name}`);
    } else {
      console.log('\n⚠️  No active provider found');
    }
    
  } catch (error) {
    console.error('❌ Error initializing SMS providers:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeSMSProviders();
