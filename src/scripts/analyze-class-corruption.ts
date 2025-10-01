/**
 * Class Corruption Analysis Script
 * 
 * This script identifies and analyzes class corruption issues that could cause
 * class shifting problems in the pupil database. It looks for inconsistencies,
 * race conditions, and data integrity issues.
 * 
 * IMPORTANT: Run this script to identify issues before running fixes!
 */

import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Pupil } from '../types';

interface ClassCorruptionIssue {
  pupilId: string;
  pupilName: string;
  admissionNumber: string;
  issueType: 'missing_class_name' | 'missing_class_code' | 'invalid_class_id' | 'orphaned_class_reference' | 'inconsistent_denormalization';
  currentClassId?: string;
  currentClassName?: string;
  currentClassCode?: string;
  expectedClassName?: string;
  expectedClassCode?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface ClassIntegrityReport {
  totalPupils: number;
  issuesFound: ClassCorruptionIssue[];
  pupilsWithoutClass: number;
  pupilsWithInvalidClass: number;
  pupilsWithInconsistentData: number;
  classOrphans: number;
  summary: {
    criticalIssues: number;
    highPriorityIssues: number;
    mediumPriorityIssues: number;
    lowPriorityIssues: number;
  };
}

export async function analyzeClassCorruption(): Promise<ClassIntegrityReport> {
  console.log('🔍 Starting class corruption analysis...');
  
  try {
    // Get all pupils
    const pupilsRef = collection(db, 'pupils');
    const pupilsSnapshot = await getDocs(query(pupilsRef, orderBy('lastName', 'asc')));
    
    if (pupilsSnapshot.empty) {
      console.log('❌ No pupils found in database!');
      throw new Error('No pupils found');
    }
    
    console.log(`📊 Found ${pupilsSnapshot.docs.length} pupils to analyze`);
    
    // Get all classes for reference
    const classesRef = collection(db, 'classes');
    const classesSnapshot = await getDocs(classesRef);
    const validClasses = new Map<string, { name: string; code: string }>();
    
    classesSnapshot.docs.forEach(doc => {
      const classData = doc.data();
      validClasses.set(doc.id, {
        name: classData.name || 'Unknown',
        code: classData.code || 'UNK'
      });
    });
    
    console.log(`📋 Found ${validClasses.size} valid classes for validation`);
    
    const issues: ClassCorruptionIssue[] = [];
    let pupilsWithoutClass = 0;
    let pupilsWithInvalidClass = 0;
    let pupilsWithInconsistentData = 0;
    let classOrphans = 0;
    
    // Analyze each pupil
    for (const pupilDoc of pupilsSnapshot.docs) {
      const pupil = pupilDoc.data() as Pupil;
      const pupilId = pupilDoc.id;
      const pupilName = `${pupil.lastName || 'Unknown'}, ${pupil.firstName || 'Unknown'}`;
      
      // Check for missing class assignment
      if (!pupil.classId) {
        pupilsWithoutClass++;
        issues.push({
          pupilId,
          pupilName,
          admissionNumber: pupil.admissionNumber || 'N/A',
          issueType: 'missing_class_name',
          severity: 'high',
          description: 'Pupil has no class assignment (classId is missing or null)'
        });
        continue;
      }
      
      // Check if classId references a valid class
      const validClass = validClasses.get(pupil.classId);
      if (!validClass) {
        pupilsWithInvalidClass++;
        classOrphans++;
        issues.push({
          pupilId,
          pupilName,
          admissionNumber: pupil.admissionNumber || 'N/A',
          issueType: 'orphaned_class_reference',
          currentClassId: pupil.classId,
          currentClassName: pupil.className,
          currentClassCode: pupil.classCode,
          severity: 'critical',
          description: `Pupil references invalid/deleted class ID: ${pupil.classId}`
        });
        continue;
      }
      
      // Check for missing denormalized class name
      if (!pupil.className) {
        issues.push({
          pupilId,
          pupilName,
          admissionNumber: pupil.admissionNumber || 'N/A',
          issueType: 'missing_class_name',
          currentClassId: pupil.classId,
          expectedClassName: validClass.name,
          severity: 'medium',
          description: 'Missing className field (denormalized data corruption)'
        });
      }
      
      // Check for missing denormalized class code
      if (!pupil.classCode) {
        issues.push({
          pupilId,
          pupilName,
          admissionNumber: pupil.admissionNumber || 'N/A',
          issueType: 'missing_class_code',
          currentClassId: pupil.classId,
          expectedClassCode: validClass.code,
          severity: 'medium',
          description: 'Missing classCode field (denormalized data corruption)'
        });
      }
      
      // Check for inconsistent denormalized data
      if (pupil.className && pupil.className !== validClass.name) {
        pupilsWithInconsistentData++;
        issues.push({
          pupilId,
          pupilName,
          admissionNumber: pupil.admissionNumber || 'N/A',
          issueType: 'inconsistent_denormalization',
          currentClassId: pupil.classId,
          currentClassName: pupil.className,
          expectedClassName: validClass.name,
          severity: 'high',
          description: `Inconsistent className: has "${pupil.className}" but should be "${validClass.name}"`
        });
      }
      
      if (pupil.classCode && pupil.classCode !== validClass.code) {
        pupilsWithInconsistentData++;
        issues.push({
          pupilId,
          pupilName,
          admissionNumber: pupil.admissionNumber || 'N/A',
          issueType: 'inconsistent_denormalization',
          currentClassId: pupil.classId,
          currentClassCode: pupil.classCode,
          expectedClassCode: validClass.code,
          severity: 'high',
          description: `Inconsistent classCode: has "${pupil.classCode}" but should be "${validClass.code}"`
        });
      }
    }
    
    // Calculate summary statistics
    const summary = {
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highPriorityIssues: issues.filter(i => i.severity === 'high').length,
      mediumPriorityIssues: issues.filter(i => i.severity === 'medium').length,
      lowPriorityIssues: issues.filter(i => i.severity === 'low').length,
    };
    
    const report: ClassIntegrityReport = {
      totalPupils: pupilsSnapshot.docs.length,
      issuesFound: issues,
      pupilsWithoutClass,
      pupilsWithInvalidClass,
      pupilsWithInconsistentData,
      classOrphans,
      summary
    };
    
    // Print detailed report
    console.log('\n📊 CLASS CORRUPTION ANALYSIS REPORT');
    console.log('=====================================');
    console.log(`📈 Total Pupils Analyzed: ${report.totalPupils}`);
    console.log(`🚨 Total Issues Found: ${issues.length}`);
    console.log(`⚠️  Pupils Without Class: ${pupilsWithoutClass}`);
    console.log(`💥 Pupils With Invalid Class: ${pupilsWithInvalidClass}`);
    console.log(`🔄 Pupils With Inconsistent Data: ${pupilsWithInconsistentData}`);
    console.log(`🏷️  Class Orphans: ${classOrphans}`);
    
    console.log('\n🎯 ISSUE SEVERITY BREAKDOWN:');
    console.log(`🔴 Critical Issues: ${summary.criticalIssues}`);
    console.log(`🟠 High Priority Issues: ${summary.highPriorityIssues}`);
    console.log(`🟡 Medium Priority Issues: ${summary.mediumPriorityIssues}`);
    console.log(`🟢 Low Priority Issues: ${summary.lowPriorityIssues}`);
    
    if (summary.criticalIssues > 0) {
      console.log('\n🚨 CRITICAL ISSUES REQUIRE IMMEDIATE ATTENTION:');
      const criticalIssues = issues.filter(i => i.severity === 'critical');
      criticalIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.pupilName} (${issue.admissionNumber}): ${issue.description}`);
      });
    }
    
    if (summary.highPriorityIssues > 0) {
      console.log('\n⚠️  HIGH PRIORITY ISSUES:');
      const highIssues = issues.filter(i => i.severity === 'high').slice(0, 10); // Show first 10
      highIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.pupilName}: ${issue.description}`);
      });
      if (summary.highPriorityIssues > 10) {
        console.log(`... and ${summary.highPriorityIssues - 10} more high priority issues`);
      }
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (summary.criticalIssues > 0) {
      console.log('🔴 URGENT: Fix critical issues immediately - these prevent proper class functionality');
    }
    if (summary.highPriorityIssues > 0) {
      console.log('🟠 IMPORTANT: Fix high priority issues - these cause data inconsistency and confusion');
    }
    if (summary.mediumPriorityIssues > 0) {
      console.log('🟡 MODERATE: Fix medium priority issues - these improve data completeness');
    }
    
    return report;
    
  } catch (error) {
    console.error('❌ Error during class corruption analysis:', error);
    throw error;
  }
}

export async function fixClassCorruption(report: ClassIntegrityReport, autoFix: boolean = false): Promise<void> {
  if (!autoFix) {
    console.log('🛠️  Class corruption fix script ready. Set autoFix=true to execute fixes.');
    return;
  }
  
  console.log('🔧 Starting class corruption fixes...');
  
  // Get classes reference data
  const classesRef = collection(db, 'classes');
  const classesSnapshot = await getDocs(classesRef);
  const validClasses = new Map<string, { name: string; code: string }>();
  
  classesSnapshot.docs.forEach(doc => {
    const classData = doc.data();
    validClasses.set(doc.id, {
      name: classData.name || 'Unknown',
      code: classData.code || 'UNK'
    });
  });
  
  let fixedCount = 0;
  let skippedCount = 0;
  
  // Process fixable issues
  const fixableIssues = report.issuesFound.filter(issue => 
    issue.issueType !== 'orphaned_class_reference' && issue.currentClassId
  );
  
  console.log(`🔧 Processing ${fixableIssues.length} fixable issues...`);
  
  for (const issue of fixableIssues) {
    if (!issue.currentClassId) continue;
    
    const validClass = validClasses.get(issue.currentClassId);
    if (!validClass) continue;
    
    try {
      const updateData: any = {};
      
      if (issue.issueType === 'missing_class_name' || 
          (issue.issueType === 'inconsistent_denormalization' && issue.currentClassName !== validClass.name)) {
        updateData.className = validClass.name;
      }
      
      if (issue.issueType === 'missing_class_code' || 
          (issue.issueType === 'inconsistent_denormalization' && issue.currentClassCode !== validClass.code)) {
        updateData.classCode = validClass.code;
      }
      
      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date().toISOString();
        updateData.classCorruptionFixed = true;
        
        const pupilRef = doc(db, 'pupils', issue.pupilId);
        await updateDoc(pupilRef, updateData);
        
        fixedCount++;
        console.log(`✅ Fixed ${issue.pupilName}: ${issue.description}`);
      } else {
        skippedCount++;
      }
      
    } catch (error) {
      console.error(`❌ Failed to fix ${issue.pupilName}:`, error);
      skippedCount++;
    }
  }
  
  console.log('\n✅ Class corruption fix completed!');
  console.log(`🔧 Fixed: ${fixedCount} issues`);
  console.log(`⚠️  Skipped: ${skippedCount} issues`);
  
  // Report critical issues that need manual intervention
  const criticalIssues = report.issuesFound.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES REQUIRING MANUAL INTERVENTION:');
    criticalIssues.forEach(issue => {
      console.log(`- ${issue.pupilName} (${issue.admissionNumber}): ${issue.description}`);
    });
    console.log('\n💡 These pupils reference deleted/invalid classes and need manual class assignment.');
  }
}

// Main execution function
async function main() {
  try {
    console.log('🚀 Starting Class Corruption Analysis & Fix Tool');
    console.log('===============================================\n');
    
    // Run analysis
    const report = await analyzeClassCorruption();
    
    // Determine if auto-fix should run
    const shouldAutoFix = process.argv.includes('--fix');
    
    if (shouldAutoFix) {
      console.log('\n🔧 Auto-fix enabled. Proceeding with fixes...');
      await fixClassCorruption(report, true);
    } else {
      console.log('\n💡 To fix issues automatically, run: npm run analyze-class-corruption -- --fix');
    }
    
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
} 