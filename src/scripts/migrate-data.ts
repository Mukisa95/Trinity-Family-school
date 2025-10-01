import { DataMigration } from '../lib/utils/data-migration';

async function main() {
  try {
    console.log('Starting data migration to Firebase...');
    await DataMigration.migrateAllData();
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main(); 