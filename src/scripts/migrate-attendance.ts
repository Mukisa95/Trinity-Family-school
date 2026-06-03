import { DataMigration } from '../lib/utils/data-migration';

async function migrateAttendance() {
  try {
    console.log('Starting attendance migration...');
    await DataMigration.migrateAttendanceRecords();
    console.log('Attendance migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateAttendance(); 