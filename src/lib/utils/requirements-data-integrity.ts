import type { 
  Pupil, 
  AcademicYear, 
  Term, 
  RequirementItem, 
  RequirementTracking,
  PupilTermSnapshot 
} from '@/types';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';

/**
 * Determines if an academic year is valid for a pupil based on registration date
 */
export function isAcademicYearValidForPupil(
  academicYear: AcademicYear,
  pupilRegistrationDate?: string
): boolean {
  if (!pupilRegistrationDate) return true; // If no registration date, allow all terms
  
  const registrationDate = new Date(pupilRegistrationDate);
  const yearEndDate = new Date(academicYear.endDate);
  
  // Academic year is valid if it ended on or after the pupil's registration date
  return yearEndDate >= registrationDate;
}

/**
 * Determines if a term is valid for a pupil based on registration date
 */
export function isTermValidForPupil(
  term: { id: string; name: string; startDate: string; endDate: string },
  pupilRegistrationDate?: string
): boolean {
  if (!pupilRegistrationDate) return true; // If no registration date, allow all terms
  
  const registrationDate = new Date(pupilRegistrationDate);
  const termStartDate = new Date(term.startDate);
  
  // Term is valid if the pupil was registered before or on the term's start date
  // (i.e., registration date is on or before the term's start date)
  return registrationDate <= termStartDate;
}

/**
 * Filters academic years to only include those valid for a pupil
 */
export function getValidAcademicYearsForPupil(
  academicYears: AcademicYear[],
  pupilRegistrationDate?: string
): AcademicYear[] {
  if (!pupilRegistrationDate) return academicYears;
  
  return academicYears.filter(year => 
    isAcademicYearValidForPupil(year, pupilRegistrationDate)
  );
}

/**
 * Filters terms within an academic year to only include those valid for a pupil
 */
export function getValidTermsForPupil(
  academicYear: AcademicYear,
  pupilRegistrationDate?: string
): AcademicYear['terms'] {
  if (!pupilRegistrationDate) return academicYear.terms;
  
  return academicYear.terms.filter(term => 
    isTermValidForPupil(term, pupilRegistrationDate)
  );
}

/**
 * Determines if a pupil should appear in the requirements list for a given term
 */
export function isPupilValidForTerm(
  pupil: Pupil,
  term: { id: string; name: string; startDate: string; endDate: string },
  academicYear: AcademicYear
): boolean {
  if (!pupil.registrationDate) return true; // If no registration date, show in all terms
  
  const registrationDate = new Date(pupil.registrationDate);
  const termStartDate = new Date(term.startDate);
  
  // Pupil should appear if the term started on or after their registration date
  return termStartDate >= registrationDate;
}

/**
 * Gets all previous academic periods before the current term/year, 
 * filtered by pupil registration date
 */
export function getPreviousPeriods(
  currentTermId: string,
  currentAcademicYear: AcademicYear,
  allAcademicYears: AcademicYear[],
  pupilRegistrationDate?: string
): Array<{ termId: string; termName: string; academicYear: AcademicYear }> {
  const periods: Array<{ termId: string; termName: string; academicYear: AcademicYear }> = [];
  
  console.log('🔍 Getting previous periods for requirements:', {
    currentTermId,
    currentAcademicYear: currentAcademicYear.name,
    currentAcademicYearTerms: currentAcademicYear.terms.map(t => ({ id: t.id, name: t.name })),
    allAcademicYears: allAcademicYears.map(y => ({ id: y.id, name: y.name })),
    pupilRegistrationDate
  });
  
  // Find the current term index in the current academic year
  const currentTermIndex = currentAcademicYear.terms.findIndex(term => term.id === currentTermId);
  
  console.log(`📍 Current term "${currentTermId}" found at index: ${currentTermIndex}`);
  
  // Sort academic years by start date for proper chronological order
  const sortedYears = allAcademicYears.sort((a, b) => {
    const dateA = new Date(a.startDate).getTime();
    const dateB = new Date(b.startDate).getTime();
    return dateA - dateB;
  });
  
  // Current academic year date for comparison
  const currentYearStartDate = new Date(currentAcademicYear.startDate);
  
  for (const year of sortedYears) {
    const yearStartDate = new Date(year.startDate);
    
    console.log(`🗓️ Processing year: ${year.name} (start: ${year.startDate}, current: ${currentAcademicYear.name})`);
    
    // Skip future years (years that start after current academic year)
    if (yearStartDate > currentYearStartDate) {
      console.log(`⏭️ Skipping future year: ${year.name}`);
      continue;
    }
    
    // Skip entire academic year if it ended before pupil registration
    if (pupilRegistrationDate && !isAcademicYearValidForPupil(year, pupilRegistrationDate)) {
      console.log(`⏭️ Skipping year ${year.name}: ended before pupil registration (${pupilRegistrationDate})`);
      continue;
    }
    
    // For current year, only include previous terms
    if (year.id === currentAcademicYear.id) {
      console.log(`📅 Processing current year terms (before index ${currentTermIndex})`);
      for (let i = 0; i < currentTermIndex; i++) {
        const term = year.terms[i];
        if (term) {
          // Check if term is valid for pupil (started on or after registration)
          if (pupilRegistrationDate && !isTermValidForPupil(term, pupilRegistrationDate)) {
            console.log(`⏭️ Skipping term ${term.name}: started before pupil registration`);
            continue;
          }
          
          periods.push({ 
            termId: term.id, 
            termName: term.name, 
            academicYear: year 
          });
          console.log(`✅ Added previous term: ${term.name} (${term.id})`);
        }
      }
    } else {
      // For previous years, include all terms (that are valid for the pupil)
      console.log(`📅 Processing previous year: ${year.name}`);
      for (const term of year.terms) {
        // Check if term is valid for pupil (started on or after registration)
        if (pupilRegistrationDate && !isTermValidForPupil(term, pupilRegistrationDate)) {
          console.log(`⏭️ Skipping term ${term.name}: started before pupil registration`);
          continue;
        }
        
        periods.push({ 
          termId: term.id, 
          termName: term.name, 
          academicYear: year 
        });
        console.log(`✅ Added term from previous year: ${term.name} (${term.id})`);
      }
    }
  }
  
  console.log(`📊 Total previous periods found: ${periods.length}`);
  
  return periods;
}

/**
 * Filters requirements applicable to a pupil for a specific term, considering registration date
 */
export function filterApplicableRequirements(
  requirements: RequirementItem[],
  pupil: Pupil,
  termId: string,
  academicYear: AcademicYear,
  allAcademicYears: AcademicYear[] = []
): RequirementItem[] {
  console.log('🔍 Filtering requirements with registration date integrity:', {
    totalRequirements: requirements.length,
    pupilClassId: pupil.classId,
    pupilSection: pupil.section,
    pupilRegistrationDate: pupil.registrationDate,
    termId,
    academicYearId: academicYear.id,
    academicYearName: academicYear.name,
    academicYearStartDate: academicYear.startDate,
    allAcademicYearsCount: allAcademicYears.length
  });

  // First, check if the term is valid for this pupil
  const currentTerm = academicYear.terms.find(t => t.id === termId);
  if (!currentTerm) {
    console.log(`❌ Term ${termId} not found in academic year ${academicYear.name}`);
    return [];
  }

  if (!isTermValidForPupil(currentTerm, pupil.registrationDate)) {
    console.log(`❌ Term ${currentTerm.name} is not valid for pupil (started before registration date ${pupil.registrationDate})`);
    return [];
  }

  const filteredRequirements = requirements.filter(requirement => {
    // Check gender compatibility
    if (requirement.gender !== 'all') {
      const pupilGender = pupil.gender === 'Male' ? 'male' : pupil.gender === 'Female' ? 'female' : 'all';
      if (requirement.gender !== pupilGender) {
        console.log(`❌ Requirement "${requirement.name}" rejected: gender mismatch (requirement: ${requirement.gender}, pupil: ${pupilGender})`);
        return false;
      }
    }

    // Check class compatibility
    if (requirement.classType === 'specific' && requirement.classIds) {
      if (!requirement.classIds.includes(pupil.classId)) {
        console.log(`❌ Requirement "${requirement.name}" rejected: class mismatch (requirement classes: ${requirement.classIds.join(', ')}, pupil class: ${pupil.classId})`);
        return false;
      }
    }

    // Check section compatibility
    if (requirement.sectionType === 'specific' && requirement.section) {
      if (requirement.section !== pupil.section) {
        console.log(`❌ Requirement "${requirement.name}" rejected: section mismatch (requirement: ${requirement.section}, pupil: ${pupil.section})`);
        return false;
      }
    }

    // Check if requirement is active
    if (!requirement.isActive) {
      console.log(`❌ Requirement "${requirement.name}" rejected: not active`);
      return false;
    }

    console.log(`✅ Requirement "${requirement.name}" accepted for pupil`);
    return true;
  });

  console.log(`📊 Filtered requirements: ${filteredRequirements.length} out of ${requirements.length}`);
  return filteredRequirements;
}

/**
 * Gets historical pupil data for a specific term to maintain data integrity
 */
export async function getHistoricalPupilDataForTerm(
  pupil: Pupil,
  termId: string,
  academicYear: AcademicYear
): Promise<{ classId: string; section: string; admissionNumber: string; dateOfBirth?: string } | null> {
  try {
    console.log(`🔍 Getting historical pupil data for term ${termId}:`, {
      pupilId: pupil.id,
      currentClassId: pupil.classId,
      currentSection: pupil.section,
      currentAdmissionNumber: pupil.admissionNumber
    });

    // Check if this is a current/ongoing term
    const currentTerm = academicYear.terms.find(t => t.id === termId);
    if (!currentTerm) {
      console.log(`❌ Term ${termId} not found in academic year ${academicYear.name}`);
      return null;
    }

    const termEndDate = new Date(currentTerm.endDate);
    const now = new Date();

    // If term is still ongoing, use current pupil data
    if (now <= termEndDate) {
      console.log(`✅ Term ${currentTerm.name} is ongoing, using current pupil data`);
      return {
        classId: pupil.classId,
        section: pupil.section,
        admissionNumber: pupil.admissionNumber,
        dateOfBirth: pupil.dateOfBirth
      };
    }

    // If term has ended, try to get historical data from snapshots
    console.log(`📸 Term ${currentTerm.name} has ended, attempting to get historical data`);
    const historicalData = await PupilSnapshotsService.getHistoricalPupilData(pupil, termId, academicYear);
    
    if (historicalData) {
      console.log(`✅ Found historical data for term ${currentTerm.name}:`, historicalData);
      return historicalData;
    }

    // Fallback to current data if no historical data found
    console.log(`⚠️ No historical data found for term ${currentTerm.name}, using current data as fallback`);
    return {
      classId: pupil.classId,
      section: pupil.section,
      admissionNumber: pupil.admissionNumber,
      dateOfBirth: pupil.dateOfBirth
    };

  } catch (error) {
    console.error('Error getting historical pupil data:', error);
    // Fallback to current data on error
    return {
      classId: pupil.classId,
      section: pupil.section,
      admissionNumber: pupil.admissionNumber,
      dateOfBirth: pupil.dateOfBirth
    };
  }
}

/**
 * Validates if a requirement tracking record should be created for a pupil in a specific term
 */
export function validateRequirementTrackingCreation(
  pupil: Pupil,
  termId: string,
  academicYear: AcademicYear,
  requirement: RequirementItem
): { isValid: boolean; reason?: string } {
  // Check if term is valid for pupil
  const currentTerm = academicYear.terms.find(t => t.id === termId);
  if (!currentTerm) {
    return { isValid: false, reason: `Term ${termId} not found in academic year ${academicYear.name}` };
  }

  if (!isTermValidForPupil(currentTerm, pupil.registrationDate)) {
    return { 
      isValid: false, 
      reason: `Pupil was not registered when term ${currentTerm.name} started (registration: ${pupil.registrationDate}, term start: ${currentTerm.startDate})` 
    };
  }

  // Check if requirement is applicable to pupil
  const applicableRequirements = filterApplicableRequirements([requirement], pupil, termId, academicYear);
  if (applicableRequirements.length === 0) {
    return { isValid: false, reason: `Requirement "${requirement.name}" is not applicable to this pupil for term ${currentTerm.name}` };
  }

  return { isValid: true };
}

/**
 * Creates an enhanced requirement tracking record with historical data integrity
 */
export async function createEnhancedRequirementTracking(
  pupil: Pupil,
  termId: string,
  academicYear: AcademicYear,
  requirementId: string | string[],
  trackingData: Omit<RequirementTracking, 'id' | 'pupilId' | 'requirementId' | 'academicYearId' | 'termId' | 'createdAt' | 'updatedAt'>
): Promise<RequirementTracking> {
  // Validate the creation
  const validation = validateRequirementTrackingCreation(pupil, termId, academicYear, { id: Array.isArray(requirementId) ? requirementId[0] : requirementId } as RequirementItem);
  if (!validation.isValid) {
    throw new Error(`Cannot create requirement tracking: ${validation.reason}`);
  }

  // Get historical pupil data for this term
  const historicalData = await getHistoricalPupilDataForTerm(pupil, termId, academicYear);
  
  if (!historicalData) {
    throw new Error(`Could not determine historical pupil data for term ${termId}`);
  }

  // Create the enhanced tracking record
  const enhancedTracking: RequirementTracking = {
    id: '', // Will be set by Firebase
    pupilId: pupil.id,
    requirementId,
    academicYearId: academicYear.id,
    termId,
    paymentStatus: trackingData.paymentStatus,
    paidAmount: trackingData.paidAmount,
    paymentDate: trackingData.paymentDate,
    coverageMode: trackingData.coverageMode,
    totalItemQuantityRequired: trackingData.totalItemQuantityRequired,
    itemQuantityProvided: trackingData.itemQuantityProvided,
    remainingQuantity: trackingData.remainingQuantity,
    itemQuantityReceived: trackingData.itemQuantityReceived,
    itemQuantityReceivedFromOffice: trackingData.itemQuantityReceivedFromOffice,
    itemQuantityReceivedFromParent: trackingData.itemQuantityReceivedFromParent,
    lastClassReceiptDate: trackingData.lastClassReceiptDate,
    lastClassReceivedBy: trackingData.lastClassReceivedBy,
    releaseStatus: trackingData.releaseStatus,
    releaseDate: trackingData.releaseDate,
    releasedBy: trackingData.releasedBy,
    receivedBy: trackingData.receivedBy,
    releasedItems: trackingData.releasedItems,
    history: trackingData.history || [],
    selectionMode: trackingData.selectionMode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Add historical data for integrity
    pupilSnapshotData: {
      classId: historicalData.classId,
      section: historicalData.section,
      admissionNumber: historicalData.admissionNumber,
      dateOfBirth: historicalData.dateOfBirth,
      dataSource: 'snapshot' as const,
      snapshotId: undefined // Will be set if from actual snapshot
    }
  };

  console.log(`✅ Created enhanced requirement tracking with historical data integrity:`, {
    pupilId: pupil.id,
    termId,
    requirementId,
    historicalClassId: historicalData.classId,
    historicalSection: historicalData.section
  });

  return enhancedTracking;
}
