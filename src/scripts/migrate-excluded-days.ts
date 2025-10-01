import { DataMigration } from '../lib/utils/data-migration';

async function migrateExcludedDays() {
  try {
    console.log('Starting excluded days migration...');
    await DataMigration.migrateExcludedDays();
    console.log('Excluded days migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateExcludedDays(); 