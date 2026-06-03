import * as fs from 'fs';
import * as path from 'path';

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
  pupilIdentificationNumber: string;
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

interface AnalysisReport {
  totalPupils: number;
  genderDistribution: Record<string, number>;
  sectionDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  classDistribution: Record<string, number>;
  nationalityDistribution: Record<string, number>;
  religionDistribution: Record<string, number>;
  bloodTypeDistribution: Record<string, number>;
  guardiansAnalysis: {
    pupilsWithGuardians: number;
    pupilsWithMultipleGuardians: number;
    averageGuardiansPerPupil: number;
    relationshipDistribution: Record<string, number>;
  };
  dataQualityIssues: {
    missingFirstNames: string[];
    missingLastNames: string[];
    missingAdmissionNumbers: string[];
    missingClassIds: string[];
    invalidGenders: string[];
    invalidSections: string[];
    invalidStatuses: string[];
    pupilsWithoutGuardians: string[];
    duplicateAdmissionNumbers: string[];
    invalidDates: string[];
  };
  fieldCompleteness: Record<string, { filled: number; empty: number; percentage: number }>;
}

function analyzePupilsData(): AnalysisReport {
  console.log('🔍 Starting Trinity Family School Pupils Data Analysis');
  console.log('='.repeat(60));
  
  // Read the JSON file
  const filePath = path.join(process.cwd(), 'pupils data.txt');
  console.log(`📖 Reading data from: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const importedData: ImportedData = JSON.parse(fileContent);
  const pupils = importedData.pupils;
  
  console.log(`📊 Found ${pupils.length} pupils in the file`);
  
  // Initialize analysis report
  const report: AnalysisReport = {
    totalPupils: pupils.length,
    genderDistribution: {},
    sectionDistribution: {},
    statusDistribution: {},
    classDistribution: {},
    nationalityDistribution: {},
    religionDistribution: {},
    bloodTypeDistribution: {},
    guardiansAnalysis: {
      pupilsWithGuardians: 0,
      pupilsWithMultipleGuardians: 0,
      averageGuardiansPerPupil: 0,
      relationshipDistribution: {}
    },
    dataQualityIssues: {
      missingFirstNames: [],
      missingLastNames: [],
      missingAdmissionNumbers: [],
      missingClassIds: [],
      invalidGenders: [],
      invalidSections: [],
      invalidStatuses: [],
      pupilsWithoutGuardians: [],
      duplicateAdmissionNumbers: [],
      invalidDates: []
    },
    fieldCompleteness: {}
  };
  
  // Track admission numbers for duplicate detection
  const admissionNumbers = new Map<string, string[]>();
  
  // Analyze each pupil
  pupils.forEach(pupil => {
    // Gender distribution
    const gender = pupil.gender || 'Unknown';
    report.genderDistribution[gender] = (report.genderDistribution[gender] || 0) + 1;
    
    // Section distribution
    const section = pupil.section || 'Unknown';
    report.sectionDistribution[section] = (report.sectionDistribution[section] || 0) + 1;
    
    // Status distribution
    const status = pupil.status || 'Unknown';
    report.statusDistribution[status] = (report.statusDistribution[status] || 0) + 1;
    
    // Class distribution
    const classId = pupil.classId || 'Unknown';
    report.classDistribution[classId] = (report.classDistribution[classId] || 0) + 1;
    
    // Nationality distribution
    const nationality = pupil.nationality || 'Unknown';
    report.nationalityDistribution[nationality] = (report.nationalityDistribution[nationality] || 0) + 1;
    
    // Religion distribution
    const religion = pupil.religion || 'Unknown';
    report.religionDistribution[religion] = (report.religionDistribution[religion] || 0) + 1;
    
    // Blood type distribution
    const bloodType = pupil.bloodType || 'Unknown';
    report.bloodTypeDistribution[bloodType] = (report.bloodTypeDistribution[bloodType] || 0) + 1;
    
    // Guardians analysis
    if (pupil.guardians && pupil.guardians.length > 0) {
      report.guardiansAnalysis.pupilsWithGuardians++;
      if (pupil.guardians.length > 1) {
        report.guardiansAnalysis.pupilsWithMultipleGuardians++;
      }
      
      pupil.guardians.forEach(guardian => {
        const relationship = guardian.relationship || 'Unknown';
        report.guardiansAnalysis.relationshipDistribution[relationship] = 
          (report.guardiansAnalysis.relationshipDistribution[relationship] || 0) + 1;
      });
    } else {
      report.dataQualityIssues.pupilsWithoutGuardians.push(`${pupil.firstName} ${pupil.lastName} (ID: ${pupil.id})`);
    }
    
    // Data quality checks
    if (!pupil.firstName || pupil.firstName.trim() === '') {
      report.dataQualityIssues.missingFirstNames.push(`ID: ${pupil.id}`);
    }
    
    if (!pupil.lastName || pupil.lastName.trim() === '') {
      report.dataQualityIssues.missingLastNames.push(`ID: ${pupil.id}`);
    }
    
    if (!pupil.pupilIdentificationNumber || pupil.pupilIdentificationNumber.trim() === '') {
      report.dataQualityIssues.missingAdmissionNumbers.push(`${pupil.firstName} ${pupil.lastName} (ID: ${pupil.id})`);
    } else {
      // Track for duplicate detection
      const admissionNum = pupil.pupilIdentificationNumber.trim().toUpperCase();
      if (!admissionNumbers.has(admissionNum)) {
        admissionNumbers.set(admissionNum, []);
      }
      admissionNumbers.get(admissionNum)!.push(`${pupil.firstName} ${pupil.lastName} (ID: ${pupil.id})`);
    }
    
    if (!pupil.classId || pupil.classId.trim() === '') {
      report.dataQualityIssues.missingClassIds.push(`${pupil.firstName} ${pupil.lastName} (ID: ${pupil.id})`);
    }
    
    // Validate gender
    const validGenders = ['male', 'female', 'other'];
    if (pupil.gender && !validGenders.includes(pupil.gender.toLowerCase())) {
      report.dataQualityIssues.invalidGenders.push(`${pupil.firstName} ${pupil.lastName}: "${pupil.gender}"`);
    }
    
    // Validate section
    const validSections = ['day', 'boarding'];
    if (pupil.section && !validSections.includes(pupil.section.toLowerCase())) {
      report.dataQualityIssues.invalidSections.push(`${pupil.firstName} ${pupil.lastName}: "${pupil.section}"`);
    }
    
    // Validate status
    const validStatuses = ['active', 'inactive', 'graduated', 'transferred'];
    if (pupil.status && !validStatuses.includes(pupil.status.toLowerCase())) {
      report.dataQualityIssues.invalidStatuses.push(`${pupil.firstName} ${pupil.lastName}: "${pupil.status}"`);
    }
    
    // Validate date of birth
    if (pupil.dateOfBirth) {
      const date = new Date(pupil.dateOfBirth);
      if (isNaN(date.getTime())) {
        report.dataQualityIssues.invalidDates.push(`${pupil.firstName} ${pupil.lastName}: "${pupil.dateOfBirth}"`);
      }
    }
  });
  
  // Check for duplicate admission numbers
  admissionNumbers.forEach((pupils, admissionNum) => {
    if (pupils.length > 1) {
      report.dataQualityIssues.duplicateAdmissionNumbers.push(`${admissionNum}: ${pupils.join(', ')}`);
    }
  });
  
  // Calculate average guardians per pupil
  const totalGuardians = pupils.reduce((sum, pupil) => sum + (pupil.guardians?.length || 0), 0);
  report.guardiansAnalysis.averageGuardiansPerPupil = totalGuardians / pupils.length;
  
  // Calculate field completeness
  const fields = [
    'firstName', 'lastName', 'otherNames', 'gender', 'dateOfBirth', 'placeOfBirth',
    'nationality', 'religion', 'address', 'pupilIdentificationNumber', 'classId',
    'section', 'status', 'medicalConditions', 'allergies', 'medications',
    'bloodType', 'learnerIdentificationNumber', 'previousSchool', 'registrationDate'
  ];
  
  fields.forEach(field => {
    const filled = pupils.filter(pupil => {
      const value = (pupil as any)[field];
      return value !== null && value !== undefined && value !== '';
    }).length;
    const empty = pupils.length - filled;
    const percentage = (filled / pupils.length) * 100;
    
    report.fieldCompleteness[field] = { filled, empty, percentage };
  });
  
  return report;
}

function printAnalysisReport(report: AnalysisReport): void {
  console.log('\n📋 COMPREHENSIVE ANALYSIS REPORT');
  console.log('='.repeat(60));
  
  console.log(`\n📊 OVERVIEW:`);
  console.log(`   Total Pupils: ${report.totalPupils}`);
  
  console.log(`\n👥 GENDER DISTRIBUTION:`);
  Object.entries(report.genderDistribution)
    .sort(([,a], [,b]) => b - a)
    .forEach(([gender, count]) => {
      const percentage = ((count / report.totalPupils) * 100).toFixed(1);
      console.log(`   ${gender}: ${count} (${percentage}%)`);
    });
  
  console.log(`\n🏫 SECTION DISTRIBUTION:`);
  Object.entries(report.sectionDistribution)
    .sort(([,a], [,b]) => b - a)
    .forEach(([section, count]) => {
      const percentage = ((count / report.totalPupils) * 100).toFixed(1);
      console.log(`   ${section}: ${count} (${percentage}%)`);
    });
  
  console.log(`\n📈 STATUS DISTRIBUTION:`);
  Object.entries(report.statusDistribution)
    .sort(([,a], [,b]) => b - a)
    .forEach(([status, count]) => {
      const percentage = ((count / report.totalPupils) * 100).toFixed(1);
      console.log(`   ${status}: ${count} (${percentage}%)`);
    });
  
  console.log(`\n🎓 CLASS DISTRIBUTION (Top 10):`);
  Object.entries(report.classDistribution)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([classId, count]) => {
      console.log(`   ${classId}: ${count} pupils`);
    });
  
  console.log(`\n🌍 NATIONALITY DISTRIBUTION:`);
  Object.entries(report.nationalityDistribution)
    .sort(([,a], [,b]) => b - a)
    .forEach(([nationality, count]) => {
      const percentage = ((count / report.totalPupils) * 100).toFixed(1);
      console.log(`   ${nationality}: ${count} (${percentage}%)`);
    });
  
  console.log(`\n⛪ RELIGION DISTRIBUTION:`);
  Object.entries(report.religionDistribution)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([religion, count]) => {
      const percentage = ((count / report.totalPupils) * 100).toFixed(1);
      console.log(`   ${religion}: ${count} (${percentage}%)`);
    });
  
  console.log(`\n👨‍👩‍👧‍👦 GUARDIANS ANALYSIS:`);
  console.log(`   Pupils with guardians: ${report.guardiansAnalysis.pupilsWithGuardians}/${report.totalPupils} (${((report.guardiansAnalysis.pupilsWithGuardians / report.totalPupils) * 100).toFixed(1)}%)`);
  console.log(`   Pupils with multiple guardians: ${report.guardiansAnalysis.pupilsWithMultipleGuardians}/${report.totalPupils} (${((report.guardiansAnalysis.pupilsWithMultipleGuardians / report.totalPupils) * 100).toFixed(1)}%)`);
  console.log(`   Average guardians per pupil: ${report.guardiansAnalysis.averageGuardiansPerPupil.toFixed(2)}`);
  
  console.log(`\n   Guardian Relationships:`);
  Object.entries(report.guardiansAnalysis.relationshipDistribution)
    .sort(([,a], [,b]) => b - a)
    .forEach(([relationship, count]) => {
      console.log(`     ${relationship}: ${count}`);
    });
  
  console.log(`\n📋 FIELD COMPLETENESS:`);
  Object.entries(report.fieldCompleteness)
    .sort(([,a], [,b]) => b.percentage - a.percentage)
    .forEach(([field, stats]) => {
      const status = stats.percentage >= 90 ? '✅' : stats.percentage >= 50 ? '⚠️' : '❌';
      console.log(`   ${status} ${field}: ${stats.filled}/${report.totalPupils} (${stats.percentage.toFixed(1)}%)`);
    });
  
  console.log(`\n⚠️  DATA QUALITY ISSUES:`);
  
  if (report.dataQualityIssues.missingFirstNames.length > 0) {
    console.log(`   ❌ Missing First Names (${report.dataQualityIssues.missingFirstNames.length}):`);
    report.dataQualityIssues.missingFirstNames.slice(0, 5).forEach(issue => console.log(`     - ${issue}`));
    if (report.dataQualityIssues.missingFirstNames.length > 5) {
      console.log(`     ... and ${report.dataQualityIssues.missingFirstNames.length - 5} more`);
    }
  }
  
  if (report.dataQualityIssues.missingLastNames.length > 0) {
    console.log(`   ❌ Missing Last Names (${report.dataQualityIssues.missingLastNames.length}):`);
    report.dataQualityIssues.missingLastNames.slice(0, 5).forEach(issue => console.log(`     - ${issue}`));
    if (report.dataQualityIssues.missingLastNames.length > 5) {
      console.log(`     ... and ${report.dataQualityIssues.missingLastNames.length - 5} more`);
    }
  }
  
  if (report.dataQualityIssues.missingAdmissionNumbers.length > 0) {
    console.log(`   ❌ Missing Admission Numbers (${report.dataQualityIssues.missingAdmissionNumbers.length}):`);
    report.dataQualityIssues.missingAdmissionNumbers.slice(0, 5).forEach(issue => console.log(`     - ${issue}`));
    if (report.dataQualityIssues.missingAdmissionNumbers.length > 5) {
      console.log(`     ... and ${report.dataQualityIssues.missingAdmissionNumbers.length - 5} more`);
    }
  }
  
  if (report.dataQualityIssues.duplicateAdmissionNumbers.length > 0) {
    console.log(`   ⚠️  Duplicate Admission Numbers (${report.dataQualityIssues.duplicateAdmissionNumbers.length}):`);
    report.dataQualityIssues.duplicateAdmissionNumbers.forEach(issue => console.log(`     - ${issue}`));
  }
  
  if (report.dataQualityIssues.pupilsWithoutGuardians.length > 0) {
    console.log(`   ⚠️  Pupils Without Guardians (${report.dataQualityIssues.pupilsWithoutGuardians.length}):`);
    report.dataQualityIssues.pupilsWithoutGuardians.slice(0, 5).forEach(issue => console.log(`     - ${issue}`));
    if (report.dataQualityIssues.pupilsWithoutGuardians.length > 5) {
      console.log(`     ... and ${report.dataQualityIssues.pupilsWithoutGuardians.length - 5} more`);
    }
  }
  
  if (report.dataQualityIssues.invalidGenders.length > 0) {
    console.log(`   ❌ Invalid Genders (${report.dataQualityIssues.invalidGenders.length}):`);
    report.dataQualityIssues.invalidGenders.slice(0, 5).forEach(issue => console.log(`     - ${issue}`));
    if (report.dataQualityIssues.invalidGenders.length > 5) {
      console.log(`     ... and ${report.dataQualityIssues.invalidGenders.length - 5} more`);
    }
  }
  
  if (report.dataQualityIssues.invalidSections.length > 0) {
    console.log(`   ❌ Invalid Sections (${report.dataQualityIssues.invalidSections.length}):`);
    report.dataQualityIssues.invalidSections.forEach(issue => console.log(`     - ${issue}`));
  }
  
  if (report.dataQualityIssues.invalidStatuses.length > 0) {
    console.log(`   ❌ Invalid Statuses (${report.dataQualityIssues.invalidStatuses.length}):`);
    report.dataQualityIssues.invalidStatuses.forEach(issue => console.log(`     - ${issue}`));
  }
  
  if (report.dataQualityIssues.invalidDates.length > 0) {
    console.log(`   ❌ Invalid Dates (${report.dataQualityIssues.invalidDates.length}):`);
    report.dataQualityIssues.invalidDates.slice(0, 5).forEach(issue => console.log(`     - ${issue}`));
    if (report.dataQualityIssues.invalidDates.length > 5) {
      console.log(`     ... and ${report.dataQualityIssues.invalidDates.length - 5} more`);
    }
  }
  
  console.log(`\n✅ MIGRATION READINESS:`);
  const criticalIssues = 
    report.dataQualityIssues.missingFirstNames.length +
    report.dataQualityIssues.missingLastNames.length +
    report.dataQualityIssues.missingAdmissionNumbers.length +
    report.dataQualityIssues.duplicateAdmissionNumbers.length;
  
  if (criticalIssues === 0) {
    console.log(`   🎉 Data is ready for migration! No critical issues found.`);
  } else {
    console.log(`   ⚠️  Found ${criticalIssues} critical issues that should be resolved before migration.`);
  }
  
  console.log(`   📊 Data quality score: ${((1 - (criticalIssues / report.totalPupils)) * 100).toFixed(1)}%`);
  
  console.log('\n='.repeat(60));
}

// Run the analysis
if (require.main === module) {
  try {
    const report = analyzePupilsData();
    printAnalysisReport(report);
    
    // Save report to file
    const reportPath = path.join(process.cwd(), 'pupils-data-analysis-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

export { analyzePupilsData }; 