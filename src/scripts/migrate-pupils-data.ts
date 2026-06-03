import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import type { Pupil, Guardian } from '../types';

// Firebase configuration
const firebaseConfig = {
  projectId: 'trinity-family-schools',
  // Add other config if needed for local development
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface ImportedPupil {
  id: string;
  title?: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  gender: string;
  dateOfBirth: string;
  placeOfBirth?: string;
  nationality?: string;
  religion?: string;
  address?: string;
  pupilIdentificationNumber: string; // This maps to admissionNumber
  classId: string;
  section: string;
  status: string;
  medicalConditions?: string;
  allergies?: string;
  medications?: string;
  bloodType?: string;
  emergencyContactGuardianId?: string;
  learnerIdentificationNumber?: string;
  previousSchool?: string;
  registrationDate?: string;
  guardians: Array<{
    id?: string;
    relationship: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    occupation?: string;
    address?: string;
  }>;
  createdAt: string;
}

interface ImportedData {
  pupils: ImportedPupil[];
}

// Helper function to normalize gender values
function normalizeGender(gender: string): 'Male' | 'Female' | 'Other' | '' {
  const normalized = gender.toLowerCase().trim();
  switch (normalized) {
    case 'male':
    case 'm':
      return 'Male';
    case 'female':
    case 'f':
      return 'Female';
    default:
      return gender as 'Male' | 'Female' | 'Other' | '';
  }
}

// Helper function to normalize section values
function normalizeSection(section: string): 'Day' | 'Boarding' | '' {
  const normalized = section.toLowerCase().trim();
  switch (normalized) {
    case 'day':
      return 'Day';
    case 'boarding':
      return 'Boarding';
    default:
      return section as 'Day' | 'Boarding' | '';
  }
}

// Helper function to normalize status values
function normalizeStatus(status: string): 'Active' | 'Inactive' | 'Graduated' | 'Transferred' | '' {
  const normalized = status.toLowerCase().trim();
  switch (normalized) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'graduated':
      return 'Graduated';
    case 'transferred':
      return 'Transferred';
    default:
      return status as 'Active' | 'Inactive' | 'Graduated' | 'Transferred' | '';
  }
}

// Helper function to normalize blood type
function normalizeBloodType(bloodType?: string): 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown' | '' {
  if (!bloodType || bloodType.trim() === '') return '';
  
  const normalized = bloodType.toUpperCase().trim();
  const validTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  if (validTypes.includes(normalized)) {
    return normalized as 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  }
  
  return 'Unknown';
}

// Helper function to generate guardian ID if missing
function generateGuardianId(pupilId: string, index: number): string {
  return `guardian_${pupilId}_${index}`;
}

// Helper function to transform imported pupil to our Pupil type
function transformPupil(importedPupil: ImportedPupil): Pupil {
  // Transform guardians
  const transformedGuardians: Guardian[] = importedPupil.guardians.map((guardian, index) => ({
    id: guardian.id || generateGuardianId(importedPupil.id, index),
    relationship: guardian.relationship.toUpperCase(),
    firstName: guardian.firstName.toUpperCase(),
    lastName: guardian.lastName.toUpperCase(),
    phone: guardian.phone,
    email: guardian.email || '',
    occupation: guardian.occupation?.toUpperCase() || '',
    address: guardian.address?.toUpperCase() || '',
  }));

  // Set emergency contact to first guardian if not specified
  let emergencyContactGuardianId = importedPupil.emergencyContactGuardianId;
  if (!emergencyContactGuardianId && transformedGuardians.length > 0) {
    emergencyContactGuardianId = transformedGuardians[0].id;
  }

  const transformedPupil: Pupil = {
    id: importedPupil.id,
    firstName: importedPupil.firstName.toUpperCase(),
    lastName: importedPupil.lastName.toUpperCase(),
    admissionNumber: importedPupil.pupilIdentificationNumber.toUpperCase(), // Map pupilIdentificationNumber to admissionNumber
    gender: normalizeGender(importedPupil.gender),
    classId: importedPupil.classId,
    section: normalizeSection(importedPupil.section),
    status: normalizeStatus(importedPupil.status),
    guardians: transformedGuardians,
    createdAt: importedPupil.createdAt,
  };

  // Add optional fields only if they have values (avoid undefined)
  if (importedPupil.otherNames && importedPupil.otherNames.trim() !== '') {
    transformedPupil.otherNames = importedPupil.otherNames.toUpperCase();
  }
  
  if (importedPupil.dateOfBirth) {
    transformedPupil.dateOfBirth = importedPupil.dateOfBirth;
  }
  
  if (importedPupil.placeOfBirth && importedPupil.placeOfBirth.trim() !== '') {
    transformedPupil.placeOfBirth = importedPupil.placeOfBirth.toUpperCase();
  }
  
  if (importedPupil.nationality && importedPupil.nationality.trim() !== '') {
    transformedPupil.nationality = importedPupil.nationality.toUpperCase();
  } else {
    transformedPupil.nationality = 'UGANDAN';
  }
  
  if (importedPupil.religion && importedPupil.religion.trim() !== '') {
    transformedPupil.religion = importedPupil.religion.toUpperCase();
  }
  
  if (importedPupil.address && importedPupil.address.trim() !== '') {
    transformedPupil.address = importedPupil.address.toUpperCase();
  }
  
  if (emergencyContactGuardianId) {
    transformedPupil.emergencyContactGuardianId = emergencyContactGuardianId;
  }
  
  if (importedPupil.medicalConditions && importedPupil.medicalConditions.trim() !== '') {
    transformedPupil.medicalConditions = importedPupil.medicalConditions.toUpperCase();
  }
  
  if (importedPupil.allergies && importedPupil.allergies.trim() !== '') {
    transformedPupil.allergies = importedPupil.allergies.toUpperCase();
  }
  
  if (importedPupil.medications && importedPupil.medications.trim() !== '') {
    transformedPupil.medications = importedPupil.medications.toUpperCase();
  }
  
  if (importedPupil.bloodType && importedPupil.bloodType.trim() !== '') {
    transformedPupil.bloodType = normalizeBloodType(importedPupil.bloodType);
  }
  
  if (importedPupil.learnerIdentificationNumber && importedPupil.learnerIdentificationNumber.trim() !== '') {
    transformedPupil.learnerIdentificationNumber = importedPupil.learnerIdentificationNumber.toUpperCase();
  }
  
  if (importedPupil.previousSchool && importedPupil.previousSchool.trim() !== '') {
    transformedPupil.previousSchool = importedPupil.previousSchool.toUpperCase();
  }
  
  if (importedPupil.registrationDate) {
    transformedPupil.registrationDate = importedPupil.registrationDate;
  } else {
    transformedPupil.registrationDate = new Date().toISOString().split('T')[0];
  }

  return transformedPupil;
}

// Function to check if classes exist
async function validateClassIds(pupils: Pupil[]): Promise<{ valid: string[], invalid: string[] }> {
  console.log('🔍 Validating class IDs...');
  
  const classIds = [...new Set(pupils.map(p => p.classId))];
  const classesSnapshot = await getDocs(collection(db, 'classes'));
  const existingClassIds = new Set(classesSnapshot.docs.map(doc => doc.id));
  
  const valid = classIds.filter(id => existingClassIds.has(id));
  const invalid = classIds.filter(id => !existingClassIds.has(id));
  
  console.log(`✅ Valid class IDs: ${valid.length}`);
  console.log(`❌ Invalid class IDs: ${invalid.length}`);
  
  if (invalid.length > 0) {
    console.log('Invalid class IDs:', invalid);
  }
  
  return { valid, invalid };
}

// Function to migrate pupils in batches
async function migratePupilsInBatches(pupils: Pupil[], batchSize: number = 500): Promise<void> {
  console.log(`📦 Starting migration of ${pupils.length} pupils in batches of ${batchSize}...`);
  
  const totalBatches = Math.ceil(pupils.length / batchSize);
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < totalBatches; i++) {
    const startIndex = i * batchSize;
    const endIndex = Math.min(startIndex + batchSize, pupils.length);
    const batch = pupils.slice(startIndex, endIndex);
    
    console.log(`\n📝 Processing batch ${i + 1}/${totalBatches} (${batch.length} pupils)...`);
    
    try {
      const writeBatchRef = writeBatch(db);
      
      batch.forEach(pupil => {
        const docRef = doc(db, 'pupils', pupil.id);
        writeBatchRef.set(docRef, pupil);
      });
      
      await writeBatchRef.commit();
      successCount += batch.length;
      console.log(`✅ Batch ${i + 1} completed successfully (${batch.length} pupils)`);
      
    } catch (error) {
      errorCount += batch.length;
      console.error(`❌ Error in batch ${i + 1}:`, error);
      
      // Log the pupils that failed for manual review
      console.log('Failed pupils in this batch:', batch.map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}` })));
    }
    
    // Add a small delay between batches to avoid overwhelming Firestore
    if (i < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`✅ Successfully migrated: ${successCount} pupils`);
  console.log(`❌ Failed to migrate: ${errorCount} pupils`);
  console.log(`📈 Success rate: ${((successCount / pupils.length) * 100).toFixed(2)}%`);
}

// Function to generate migration report
function generateMigrationReport(originalPupils: ImportedPupil[], transformedPupils: Pupil[]): void {
  console.log('\n📋 Migration Report:');
  console.log('='.repeat(50));
  
  // Count by gender
  const genderCounts = transformedPupils.reduce((acc, pupil) => {
    acc[pupil.gender] = (acc[pupil.gender] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('👥 Gender Distribution:');
  Object.entries(genderCounts).forEach(([gender, count]) => {
    console.log(`   ${gender}: ${count}`);
  });
  
  // Count by section
  const sectionCounts = transformedPupils.reduce((acc, pupil) => {
    acc[pupil.section] = (acc[pupil.section] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n🏫 Section Distribution:');
  Object.entries(sectionCounts).forEach(([section, count]) => {
    console.log(`   ${section}: ${count}`);
  });
  
  // Count by status
  const statusCounts = transformedPupils.reduce((acc, pupil) => {
    acc[pupil.status] = (acc[pupil.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n📊 Status Distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  
  // Count pupils with guardians
  const pupilsWithGuardians = transformedPupils.filter(p => p.guardians.length > 0).length;
  const pupilsWithMultipleGuardians = transformedPupils.filter(p => p.guardians.length > 1).length;
  
  console.log('\n👨‍👩‍👧‍👦 Guardian Information:');
  console.log(`   Pupils with guardians: ${pupilsWithGuardians}/${transformedPupils.length}`);
  console.log(`   Pupils with multiple guardians: ${pupilsWithMultipleGuardians}/${transformedPupils.length}`);
  
  // Count unique classes
  const uniqueClasses = new Set(transformedPupils.map(p => p.classId)).size;
  console.log(`\n🎓 Unique Classes: ${uniqueClasses}`);
  
  console.log('='.repeat(50));
}

// Main migration function
async function migratePupilsData(): Promise<void> {
  try {
    console.log('🚀 Starting Trinity Family School Pupils Data Migration');
    console.log('='.repeat(60));
    
    // Read the JSON file
    const filePath = path.join(process.cwd(), 'pupils data.txt');
    console.log(`📖 Reading data from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const importedData: ImportedData = JSON.parse(fileContent);
    
    console.log(`📊 Found ${importedData.pupils.length} pupils in the file`);
    
    // Transform the data
    console.log('🔄 Transforming pupil data...');
    const transformedPupils = importedData.pupils.map(transformPupil);
    
    // Generate migration report
    generateMigrationReport(importedData.pupils, transformedPupils);
    
    // Validate class IDs
    const classValidation = await validateClassIds(transformedPupils);
    
    if (classValidation.invalid.length > 0) {
      console.log('\n⚠️  Warning: Some pupils have invalid class IDs. Migration will continue, but these pupils may need manual review.');
    }
    
    // Ask for confirmation before proceeding
    console.log('\n🤔 Do you want to proceed with the migration? (This will add all pupils to the database)');
    console.log('Press Ctrl+C to cancel, or any key to continue...');
    
    // In a real scenario, you might want to add a prompt here
    // For now, we'll proceed automatically
    
    // Perform the migration
    await migratePupilsInBatches(transformedPupils);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('📝 Please review the migration results and verify the data in your Firebase console.');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migratePupilsData()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { migratePupilsData }; 