/**
 * Date Corruption Fix Script
 * 
 * This script identifies and fixes date corruption issues caused by timezone shifts
 * in the pupil database. It looks for common patterns of date corruption and provides
 * options to fix them.
 * 
 * IMPORTANT: Always backup your database before running this script!
 */

import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Pupil } from '../types';
import { formatDateForStorage, parseLocalDate, isValidDateString } from '../lib/utils/date-utils';

interface DateCorrectionCandidate {
  pupilId: string;
  pupilName: string;
  admissionNumber: string;
  field: 'dateOfBirth' | 'registrationDate';
  currentValue: string;
  suggestedFix: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

class DateCorruptionFixer {
  private candidates: DateCorrectionCandidate[] = [];
  
  async analyzeDatabase(): Promise<DateCorrectionCandidate[]> {
    console.log('🔍 Analyzing database for date corruption...');
    
    try {
      const pupilsRef = collection(db, 'pupils');
      const q = query(pupilsRef, orderBy('lastName', 'asc'));
      const snapshot = await getDocs(q);
      
      const pupils = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (Pupil & { id: string })[];
      
      console.log(`📊 Found ${pupils.length} pupils to analyze`);
      
      for (const pupil of pupils) {
        // Check date of birth
        if (pupil.dateOfBirth) {
          const dobCandidate = this.analyzeDate(
            pupil.id,
            `${pupil.firstName} ${pupil.lastName}`,
            pupil.admissionNumber,
            'dateOfBirth',
            pupil.dateOfBirth
          );
          if (dobCandidate) this.candidates.push(dobCandidate);
        }
        
        // Check registration date
        if (pupil.registrationDate) {
          const regCandidate = this.analyzeDate(
            pupil.id,
            `${pupil.firstName} ${pupil.lastName}`,
            pupil.admissionNumber,
            'registrationDate',
            pupil.registrationDate
          );
          if (regCandidate) this.candidates.push(regCandidate);
        }
      }
      
      console.log(`⚠️  Found ${this.candidates.length} potential date corruption issues`);
      return this.candidates;
      
    } catch (error) {
      console.error('❌ Error analyzing database:', error);
      throw error;
    }
  }
  
  private analyzeDate(
    pupilId: string,
    pupilName: string,
    admissionNumber: string,
    field: 'dateOfBirth' | 'registrationDate',
    dateValue: string
  ): DateCorrectionCandidate | null {
    
    // Check if date string is valid format
    if (!isValidDateString(dateValue)) {
      return {
        pupilId,
        pupilName,
        admissionNumber,
        field,
        currentValue: dateValue,
        suggestedFix: 'Manual review required',
        confidence: 'high',
        reason: 'Invalid date format detected'
      };
    }
    
    // Parse the date safely
    const parsedDate = parseLocalDate(dateValue);
    if (!parsedDate) return null;
    
    // Check for timezone shift indicators
    const dayShiftCandidate = this.detectDayShift(dateValue);
    if (dayShiftCandidate) {
      return {
        pupilId,
        pupilName,
        admissionNumber,
        field,
        currentValue: dateValue,
        suggestedFix: dayShiftCandidate.suggestedDate,
        confidence: dayShiftCandidate.confidence,
        reason: dayShiftCandidate.reason
      };
    }
    
    // Check for unrealistic dates
    const today = new Date();
    const dateYear = parsedDate.getFullYear();
    
    if (field === 'dateOfBirth') {
      // Birth dates shouldn't be in the future or too far in the past
      if (parsedDate > today) {
        return {
          pupilId,
          pupilName,
          admissionNumber,
          field,
          currentValue: dateValue,
          suggestedFix: 'Manual review required',
          confidence: 'high',
          reason: 'Date of birth is in the future'
        };
      }
      
      if (dateYear < 1990) {
        return {
          pupilId,
          pupilName,
          admissionNumber,
          field,
          currentValue: dateValue,
          suggestedFix: 'Manual review required',
          confidence: 'medium',
          reason: 'Date of birth seems too old for a student'
        };
      }
    }
    
    if (field === 'registrationDate') {
      // Registration dates shouldn't be in the future
      if (parsedDate > today) {
        return {
          pupilId,
          pupilName,
          admissionNumber,
          field,
          currentValue: dateValue,
          suggestedFix: formatDateForStorage(today),
          confidence: 'medium',
          reason: 'Registration date is in the future, suggesting today'
        };
      }
    }
    
    return null;
  }
  
  private detectDayShift(dateString: string): { suggestedDate: string; confidence: 'high' | 'medium' | 'low'; reason: string } | null {
    // This is a heuristic approach to detect common day shifts
    // You may need to customize this based on your specific patterns
    
    const date = parseLocalDate(dateString);
    if (!date) return null;
    
    const day = date.getDate();
    
    // Look for patterns that suggest timezone shifts
    // For example, if many dates end up on the last day of the month,
    // it might indicate a shift from the 1st of the next month
    
    // This is a simplified example - you might want to add more sophisticated logic
    // based on the specific patterns you observe in your data
    
    return null;
  }
  
  async fixDate(pupilId: string, field: 'dateOfBirth' | 'registrationDate', newValue: string): Promise<void> {
    try {
      const pupilRef = doc(db, 'pupils', pupilId);
      await updateDoc(pupilRef, {
        [field]: newValue,
        updatedAt: new Date().toISOString(),
        dateCorrectionApplied: true,
        dateCorrectionTimestamp: new Date().toISOString()
      });
      
      console.log(`✅ Fixed ${field} for pupil ${pupilId}: ${newValue}`);
    } catch (error) {
      console.error(`❌ Error fixing date for pupil ${pupilId}:`, error);
      throw error;
    }
  }
  
  generateReport(): string {
    let report = '\n📋 DATE CORRUPTION ANALYSIS REPORT\n';
    report += '=' .repeat(50) + '\n\n';
    
    if (this.candidates.length === 0) {
      report += '✅ No date corruption issues detected!\n';
      return report;
    }
    
    const grouped = this.groupCandidatesByConfidence();
    
    for (const [confidence, candidates] of Object.entries(grouped)) {
      if (candidates.length === 0) continue;
      
      report += `🔍 ${confidence.toUpperCase()} CONFIDENCE ISSUES (${candidates.length})\n`;
      report += '-'.repeat(30) + '\n';
      
      for (const candidate of candidates) {
        report += `👤 ${candidate.pupilName} (${candidate.admissionNumber})\n`;
        report += `   Field: ${candidate.field}\n`;
        report += `   Current: ${candidate.currentValue}\n`;
        report += `   Suggested: ${candidate.suggestedFix}\n`;
        report += `   Reason: ${candidate.reason}\n\n`;
      }
    }
    
    report += '\n📝 RECOMMENDATIONS:\n';
    report += '1. Review HIGH confidence issues first\n';
    report += '2. Always backup your database before applying fixes\n';
    report += '3. Test fixes on a small subset before bulk operations\n';
    report += '4. Implement the new date utility functions to prevent future issues\n';
    
    return report;
  }
  
  private groupCandidatesByConfidence(): Record<string, DateCorrectionCandidate[]> {
    return {
      high: this.candidates.filter(c => c.confidence === 'high'),
      medium: this.candidates.filter(c => c.confidence === 'medium'),
      low: this.candidates.filter(c => c.confidence === 'low')
    };
  }
}

// Main execution function
export async function runDateCorruptionAnalysis(): Promise<void> {
  console.log('🚀 Starting Date Corruption Analysis...\n');
  
  const fixer = new DateCorruptionFixer();
  
  try {
    const candidates = await fixer.analyzeDatabase();
    const report = fixer.generateReport();
    
    console.log(report);
    
    // Optionally, write report to file
    // You can uncomment this if running in Node.js environment
    // import fs from 'fs';
    // fs.writeFileSync('date-corruption-report.txt', report);
    // console.log('📄 Report saved to date-corruption-report.txt');
    
  } catch (error) {
    console.error('💥 Analysis failed:', error);
  }
}

// Export the class for use in other scripts
export { DateCorruptionFixer };
export type { DateCorrectionCandidate };

// Uncomment to run directly
// runDateCorruptionAnalysis(); 