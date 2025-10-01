import { StaffService } from '../services/staff.service';
import { PupilsService } from '../services/pupils.service';
import { FeesService } from '../services/fees.service';
import { SchoolSettingsService } from '../services/school-settings.service';
import { ClassesService } from '../services/classes.service';
import { SubjectsService } from '../services/subjects.service';
import { AcademicYearsService } from '../services/academic-years.service';
import { AttendanceService } from '../services/attendance.service';
import { ExamsService } from '../services/exams.service';
import { ExcludedDaysService } from '../services/excluded-days.service';
import { 
  sampleStaff, 
  samplePupils, 
  sampleClasses,
  sampleSubjects,
  initialSampleAcademicYears,
  initialAttendanceRecords,
  initialExamsData,
  initialExamResultsData,
  initialFeeStructures, 
  initialFeeAdjustments,
  initialExcludedDays,
  sampleSchoolSettings 
} from '../sample-data';
import { getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '../firebase';

const ACADEMIC_YEARS_COLLECTION = 'academicYears';

export class DataMigration {
  static async migrateAllData(): Promise<void> {
    console.log('Starting data migration...');
    
    try {
      await this.migrateAcademicYears();
      await this.migrateStaff();
      await this.migrateClasses();
      await this.migrateSubjects();
      await this.migratePupils();
      await this.migrateAttendanceRecords();
      await this.migrateExcludedDays();
      await this.migrateExams();
      await this.migrateExamResults();
      await this.migrateFeeStructures();
      await this.migrateFeeAdjustments();
      await this.migrateSchoolSettings();
      
      console.log('Data migration completed successfully!');
    } catch (error) {
      console.error('Error during data migration:', error);
      throw error;
    }
  }

  static async migrateAcademicYears(): Promise<void> {
    console.log('Migrating academic years data...');
    let createdCount = 0;
    let skippedCount = 0;
    
    try {
      // Fetch all existing academic year names once for efficiency
      const existingYearsQuery = query(collection(db, ACADEMIC_YEARS_COLLECTION));
      const existingYearsSnapshot = await getDocs(existingYearsQuery);
      const existingYearNames = new Set(existingYearsSnapshot.docs.map(doc => doc.data().name as string));
      console.log(`Found ${existingYearNames.size} existing academic year names in Firestore.`);

      for (const year of initialSampleAcademicYears) {
        const { id, ...yearData } = year; 

        if (existingYearNames.has(yearData.name)) {
          console.log(`Academic year "${yearData.name}" already exists. Skipping.`);
          skippedCount++;
          continue; 
        }
        
        await AcademicYearsService.createAcademicYear(yearData);
        existingYearNames.add(yearData.name); 
        createdCount++;
      }
      console.log(`Migration complete: Created ${createdCount} academic years, skipped ${skippedCount} existing years.`);
    } catch (error) {
      console.error('Error migrating academic years:', error);
      throw error;
    }
  }

  static async migrateStaff(): Promise<void> {
    console.log('Migrating staff data...');
    
    try {
      for (const staff of sampleStaff) {
        const { id, ...staffData } = staff;
        await StaffService.createStaff(staffData);
      }
      console.log(`Migrated ${sampleStaff.length} staff members`);
    } catch (error) {
      console.error('Error migrating staff:', error);
      throw error;
    }
  }

  static async migrateClasses(): Promise<void> {
    console.log('Migrating classes data...');
    
    try {
      for (const classItem of sampleClasses) {
        const { id, createdAt, ...classData } = classItem;
        await ClassesService.create(classData);
      }
      console.log(`Migrated ${sampleClasses.length} classes`);
    } catch (error) {
      console.error('Error migrating classes:', error);
      throw error;
    }
  }

  static async migrateSubjects(): Promise<void> {
    console.log('Migrating subjects data...');
    
    try {
      for (const subject of sampleSubjects) {
        const { id, createdAt, ...subjectData } = subject;
        await SubjectsService.createSubject(subjectData);
      }
      console.log(`Migrated ${sampleSubjects.length} subjects`);
    } catch (error) {
      console.error('Error migrating subjects:', error);
      throw error;
    }
  }

  static async migratePupils(): Promise<void> {
    console.log('Migrating pupils data...');
    
    try {
      for (const pupil of samplePupils) {
        const { id, ...pupilData } = pupil;
        await PupilsService.createPupil(pupilData);
      }
      console.log(`Migrated ${samplePupils.length} pupils`);
    } catch (error) {
      console.error('Error migrating pupils:', error);
      throw error;
    }
  }

  static async migrateAttendanceRecords(): Promise<void> {
    console.log('Migrating attendance records data...');
    
    try {
      for (const record of initialAttendanceRecords) {
        const { id, recordedAt, ...recordData } = record;
        await AttendanceService.createAttendanceRecord(recordData);
      }
      console.log(`Migrated ${initialAttendanceRecords.length} attendance records`);
    } catch (error) {
      console.error('Error migrating attendance records:', error);
      throw error;
    }
  }

  static async migrateExcludedDays(): Promise<void> {
    console.log('Migrating excluded days data...');
    
    try {
      for (const excludedDay of initialExcludedDays) {
        const { id, createdAt, ...excludedDayData } = excludedDay;
        await ExcludedDaysService.createExcludedDay(excludedDayData);
      }
      console.log(`Migrated ${initialExcludedDays.length} excluded days`);
    } catch (error) {
      console.error('Error migrating excluded days:', error);
      throw error;
    }
  }

  static async migrateExams(): Promise<void> {
    console.log('Migrating exams data...');
    
    try {
      for (const exam of initialExamsData) {
        const { id, createdAt, updatedAt, ...examData } = exam;
        await ExamsService.createExam(examData);
      }
      console.log(`Migrated ${initialExamsData.length} exams`);
    } catch (error) {
      console.error('Error migrating exams:', error);
      throw error;
    }
  }

  static async migrateExamResults(): Promise<void> {
    console.log('Migrating exam results data...');
    
    try {
      for (const result of initialExamResultsData) {
        const { id, ...resultData } = result;
        await ExamsService.createExamResult(resultData);
      }
      console.log(`Migrated ${initialExamResultsData.length} exam results`);
    } catch (error) {
      console.error('Error migrating exam results:', error);
      throw error;
    }
  }

  static async migrateFeeStructures(): Promise<void> {
    console.log('Migrating fee structures...');
    
    try {
      for (const feeStructure of initialFeeStructures) {
        const { id, createdAt, status, disableHistory, ...feeData } = feeStructure;
        await FeesService.createFeeStructure(feeData);
      }
      console.log(`Migrated ${initialFeeStructures.length} fee structures`);
    } catch (error) {
      console.error('Error migrating fee structures:', error);
      throw error;
    }
  }

  static async migrateFeeAdjustments(): Promise<void> {
    console.log('Migrating fee adjustments...');
    
    try {
      for (const adjustment of initialFeeAdjustments) {
        const { id, createdAt, ...adjustmentData } = adjustment;
        await FeesService.createFeeAdjustment(adjustmentData);
      }
      console.log(`Migrated ${initialFeeAdjustments.length} fee adjustments`);
    } catch (error) {
      console.error('Error migrating fee adjustments:', error);
      throw error;
    }
  }

  static async migrateSchoolSettings(): Promise<void> {
    console.log('Migrating school settings...');
    
    try {
      await SchoolSettingsService.initializeSchoolSettings(sampleSchoolSettings);
      console.log('Migrated school settings');
    } catch (error) {
      console.error('Error migrating school settings:', error);
      throw error;
    }
  }

  static async removeDuplicateAcademicYears(): Promise<void> {
    console.log('Removing duplicate academic years...');
    
    try {
      // Fetch all academic years
      const academicYearsQuery = query(collection(db, ACADEMIC_YEARS_COLLECTION));
      const snapshot = await getDocs(academicYearsQuery);
      
      const yearsByName = new Map<string, any[]>();
      
      // Group academic years by name
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const yearName = data.name;
        
        if (!yearsByName.has(yearName)) {
          yearsByName.set(yearName, []);
        }
        
        yearsByName.get(yearName)!.push({
          id: doc.id,
          data: data,
          createdAt: data.createdAt
        });
      });
      
      let deletedCount = 0;
      
      // For each year name, keep only the first one (by creation date) and delete the rest
      for (const [yearName, years] of yearsByName.entries()) {
        if (years.length > 1) {
          console.log(`Found ${years.length} duplicates for year "${yearName}"`);
          
          // Sort by createdAt to keep the oldest one
          years.sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return aTime - bTime;
          });
          
          // Delete all except the first one
          for (let i = 1; i < years.length; i++) {
            try {
              await AcademicYearsService.deleteAcademicYear(years[i].id);
              console.log(`Deleted duplicate academic year "${yearName}" with ID: ${years[i].id}`);
              deletedCount++;
            } catch (error) {
              console.error(`Failed to delete duplicate academic year ${years[i].id}:`, error);
            }
          }
        }
      }
      
      console.log(`Removed ${deletedCount} duplicate academic years`);
    } catch (error) {
      console.error('Error removing duplicate academic years:', error);
      throw error;
    }
  }

  static async clearAllData(): Promise<void> {
    console.log('Clearing all data is not implemented for safety reasons.');
    console.log('Please use Firebase console to clear data if needed.');
  }
} 