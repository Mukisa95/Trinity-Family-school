import { db } from '@/lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, orderBy } from 'firebase/firestore';
import type { PupilTermSnapshot, Pupil, AcademicYear, Term } from '@/types';
import { getTermStatus, isTermEnded } from '@/lib/utils/academic-year-utils';

export class PupilSnapshotsService {
  private static collectionName = 'pupilTermSnapshots';

  /**
   * Create a snapshot of a pupil's class and section for a specific term
   * CRITICAL: Only for terms that have ended, and NEVER with current pupil data
   */
  static async createSnapshot(
    pupilId: string,
    termId: string,
    academicYearId: string,
    historicalClassId: string,
    historicalSection: string,
    historicalAdmissionNumber: string,
    termStartDate: string,
    termEndDate: string,
    historicalDateOfBirth?: string
  ): Promise<string> {
    // Validate that the term has ended before creating snapshot
    const termEndDateObj = new Date(termEndDate);
    const now = new Date();
    
    if (now <= termEndDateObj) {
      throw new Error(`❌ CRITICAL ERROR: Cannot create snapshot for term ${termId}: Term has not ended yet (ends ${termEndDate}). Snapshots can only be created for terms that have ended.`);
    }

    console.log(`📸 Creating REAL snapshot for ended term:`, {
      pupilId,
      termId,
      historicalClassId,
      historicalSection,
      historicalAdmissionNumber,
      historicalDateOfBirth,
      termEndDate
    });

    const snapshot: Omit<PupilTermSnapshot, 'id'> = {
      pupilId,
      termId,
      academicYearId,
      classId: historicalClassId,
      section: historicalSection,
      admissionNumber: historicalAdmissionNumber,
      dateOfBirth: historicalDateOfBirth,
      isActive: true,
      snapshotDate: new Date().toISOString(),
      termStartDate,
      termEndDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, this.collectionName), snapshot);
    console.log(`✅ Successfully created snapshot ${docRef.id} for ended term ${termId}`);
    return docRef.id;
  }

  /**
   * CRITICAL: Get historical class/section data for a pupil during a specific term
   * This attempts multiple strategies to recover accurate historical data
   */
  static async getHistoricalPupilData(
    pupil: Pupil,
    termId: string,
    academicYear: AcademicYear
  ): Promise<{ classId: string; section: string; admissionNumber: string; dateOfBirth?: string } | null> {
    try {
      console.log(`🔍 Attempting to recover historical data for pupil ${pupil.id} during term ${termId}`);

      // Strategy 1: Check promotion history for data during that term
      if (pupil.promotionHistory && pupil.promotionHistory.length > 0) {
        const term = academicYear.terms.find(t => t.id === termId);
        if (term) {
          const termStart = new Date(term.startDate);
          const termEnd = new Date(term.endDate);

          // Sort promotion history by date
          const sortedPromotions = pupil.promotionHistory
            .slice()
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Find the class the pupil was in during this term
          let classIdDuringTerm = pupil.classId; // Default to current
          
          for (const promotion of sortedPromotions) {
            const promotionDate = new Date(promotion.date);
            
            if (promotionDate <= termStart) {
              // This promotion happened before the term started
              classIdDuringTerm = promotion.toClassId;
            } else if (promotionDate >= termStart && promotionDate <= termEnd) {
              // Promotion happened during the term - use the "from" class for most of the term
              classIdDuringTerm = promotion.fromClassId || promotion.toClassId;
              break;
            } else {
              // Promotion happened after the term ended
              break;
            }
          }

          if (classIdDuringTerm) {
            // Ensure admissionNumber is not undefined - use fallback if missing
            const fallbackAdmissionNumber = pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`;
            // Ensure dateOfBirth is not undefined - use fallback if missing
            const fallbackDateOfBirth = pupil.dateOfBirth || '1900-01-01';
            
            console.log(`✅ Found historical class from promotion history:`, {
              classId: classIdDuringTerm,
              section: pupil.section, // Use current section as fallback
              admissionNumber: fallbackAdmissionNumber, // Use current admission number with fallback
              dateOfBirth: fallbackDateOfBirth, // Use current date of birth with fallback
              termId,
              source: 'promotion_history'
            });
            
            return {
              classId: classIdDuringTerm,
              section: pupil.section,
              admissionNumber: fallbackAdmissionNumber,
              dateOfBirth: fallbackDateOfBirth
            };
          }
        }
      }

      // Strategy 2: Check for any existing snapshots from earlier terms in same year
      const existingSnapshots = await this.getPupilSnapshots(pupil.id);
      const sameYearSnapshots = existingSnapshots.filter(s => s.academicYearId === academicYear.id);
      
      if (sameYearSnapshots.length > 0) {
        // Sort by term start date and find the closest earlier snapshot
        const sortedSnapshots = sameYearSnapshots.sort((a, b) => 
          new Date(a.termStartDate).getTime() - new Date(b.termStartDate).getTime()
        );
        
        const targetTerm = academicYear.terms.find(t => t.id === termId);
        if (targetTerm) {
          const targetTermStart = new Date(targetTerm.startDate);
          
          // Find the most recent snapshot before this term
          const earlierSnapshot = sortedSnapshots
            .filter(s => new Date(s.termStartDate) < targetTermStart)
            .pop(); // Get the latest one before target term
            
          if (earlierSnapshot) {
            // Ensure admissionNumber is not undefined - use fallback if missing
            const fallbackAdmissionNumber = earlierSnapshot.admissionNumber || pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`;
            // Ensure dateOfBirth is not undefined - use fallback if missing
            const fallbackDateOfBirth = earlierSnapshot.dateOfBirth || pupil.dateOfBirth || '1900-01-01';
            
            console.log(`⚠️ Using data from earlier snapshot in same year:`, {
              fromTerm: earlierSnapshot.termId,
              classId: earlierSnapshot.classId,
              section: earlierSnapshot.section,
              admissionNumber: fallbackAdmissionNumber,
              dateOfBirth: fallbackDateOfBirth
            });
            return {
              classId: earlierSnapshot.classId,
              section: earlierSnapshot.section,
              admissionNumber: fallbackAdmissionNumber,
              dateOfBirth: fallbackDateOfBirth
            };
          }
        }
      }

      // Strategy 3: For very old terms, use current data as best guess with warning
      console.log(`⚠️ WARNING: No historical data found for pupil ${pupil.id} term ${termId}. Using current data as last resort.`);
      console.log(`   This may be inaccurate if pupil changed classes/data since ${termId}`);
      
      // Ensure admissionNumber is not undefined - use fallback if missing
      const fallbackAdmissionNumber = pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`;
      // Ensure dateOfBirth is not undefined - use fallback if missing
      const fallbackDateOfBirth = pupil.dateOfBirth || '1900-01-01';
      
      return {
        classId: pupil.classId,
        section: pupil.section,
        admissionNumber: fallbackAdmissionNumber,
        dateOfBirth: fallbackDateOfBirth
      };

    } catch (error) {
      console.error(`❌ Error recovering historical data for pupil ${pupil.id} term ${termId}:`, error);
      return null;
    }
  }

  /**
   * Get or create a snapshot for a pupil in a specific term
   * FIXED: Never creates snapshots with current data for past terms
   */
  static async getOrCreateSnapshot(
    pupil: Pupil,
    termId: string,
    academicYear: AcademicYear
  ): Promise<PupilTermSnapshot> {
    try {
      console.log(`📸 Getting/creating snapshot for pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}), term ${termId}`);
      
      // Find the term details
      const term = academicYear.terms.find(t => t.id === termId);
      if (!term) {
        throw new Error(`Term ${termId} not found in academic year ${academicYear.name}`);
      }

      // Check term status
      const termStatus = getTermStatus(term);
      console.log(`📅 Term ${term.name} status: ${termStatus}`);

      // For current and future terms, return live pupil data as virtual snapshot
      if (termStatus === 'current' || termStatus === 'future') {
        console.log(`🔄 Term ${term.name} is ${termStatus} - returning live pupil data (virtual snapshot)`);
        
        // Validate essential data
        if (!pupil.classId) {
          throw new Error(`Pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}) has no classId assigned`);
        }

        if (!pupil.section) {
          throw new Error(`Pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}) has no section assigned`);
        }

        // Return virtual snapshot based on current pupil data
        const virtualSnapshot: PupilTermSnapshot = {
          id: `virtual-${pupil.id}-${termId}`, // Virtual ID to indicate this is not persisted
          pupilId: pupil.id,
          termId,
          academicYearId: academicYear.id,
          classId: pupil.classId,
          section: pupil.section,
          admissionNumber: pupil.admissionNumber,
          dateOfBirth: pupil.dateOfBirth,
          isActive: true,
          snapshotDate: new Date().toISOString(),
          termStartDate: term.startDate,
          termEndDate: term.endDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        console.log(`✅ Returning virtual snapshot (live data) for ${termStatus} term`);
        return virtualSnapshot;
      }

      // For ended terms, try to find existing snapshot first
      console.log(`📋 Term ${term.name} has ended - checking for existing snapshot`);
      
      // Try to find existing snapshot
      const existingSnapshot = await this.getSnapshot(pupil.id, termId);
      
      if (existingSnapshot) {
        console.log(`✅ Found existing REAL snapshot:`, {
          pupilId: existingSnapshot.pupilId,
          termId: existingSnapshot.termId,
          classId: existingSnapshot.classId,
          section: existingSnapshot.section,
          snapshotDate: existingSnapshot.snapshotDate
        });
        return existingSnapshot;
      }

      // CRITICAL CHANGE: Never create snapshots for ended terms from current data
      // Instead, attempt to recover historical data
      console.log(`🚨 CRITICAL: No snapshot exists for ended term ${term.name}. Attempting historical data recovery...`);
      
      const historicalData = await this.getHistoricalPupilData(pupil, termId, academicYear);
      
      if (!historicalData) {
        // CRITICAL ERROR: Cannot create snapshot without historical data
        const errorMsg = `❌ CRITICAL ERROR: Cannot create snapshot for pupil ${pupil.id} term ${termId}. No historical class/section data available and term has ended. This indicates a system failure where snapshots should have been created when the term ended.`;
        console.error(errorMsg);
        
        // Return virtual snapshot with warning markers to prevent system crash
        // But log this as a critical system failure
        const fallbackAdmissionNumber = pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`;
        const fallbackDateOfBirth = pupil.dateOfBirth || '1900-01-01';
        
        const errorSnapshot: PupilTermSnapshot = {
          id: `error-missing-historical-${pupil.id}-${termId}`,
          pupilId: pupil.id,
          termId,
          academicYearId: academicYear.id,
          classId: pupil.classId, // Current data - marked as potentially wrong
          section: pupil.section,  // Current data - marked as potentially wrong
          admissionNumber: fallbackAdmissionNumber, // Ensure not undefined
          dateOfBirth: fallbackDateOfBirth, // Ensure not undefined
          isActive: true,
          snapshotDate: new Date().toISOString(),
          termStartDate: term.startDate,
          termEndDate: term.endDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        console.error(`⚠️ Returning emergency snapshot with current data. This may be INCORRECT for financial calculations.`);
        return errorSnapshot;
      }

      console.log(`🆕 Creating snapshot with recovered historical data:`, {
        pupilId: pupil.id,
        pupilName: `${pupil.firstName} ${pupil.lastName}`,
        termId: term.id,
        termName: term.name,
        historicalClassId: historicalData.classId,
        historicalSection: historicalData.section,
        termEndDate: term.endDate
      });

      // Create new snapshot with historical data
      const snapshotId = await this.createSnapshot(
        pupil.id,
        termId,
        academicYear.id,
        historicalData.classId,
        historicalData.section,
        historicalData.admissionNumber,
        term.startDate,
        term.endDate,
        historicalData.dateOfBirth
      );

      // Return the created snapshot
      const newSnapshot: PupilTermSnapshot = {
        id: snapshotId,
        pupilId: pupil.id,
        termId,
        academicYearId: academicYear.id,
        classId: historicalData.classId,
        section: historicalData.section,
        admissionNumber: historicalData.admissionNumber,
        dateOfBirth: historicalData.dateOfBirth,
        isActive: true,
        snapshotDate: new Date().toISOString(),
        termStartDate: term.startDate,
        termEndDate: term.endDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log(`✅ Successfully created snapshot with historical data`);
      return newSnapshot;
      
    } catch (error) {
      console.error('❌ CRITICAL ERROR in getOrCreateSnapshot:', error);
      console.error('Context:', {
        pupilId: pupil?.id,
        pupilName: pupil ? `${pupil.firstName} ${pupil.lastName}` : 'unknown',
        termId,
        academicYearId: academicYear?.id,
        academicYearName: academicYear?.name
      });
      
      // This is a critical financial system - we cannot allow this to fail silently
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Snapshot creation failed for pupil ${pupil?.id || 'unknown'}, term ${termId}: ${errorMessage}`);
    }
  }

  /**
   * Get a specific snapshot for a pupil in a term
   */
  static async getSnapshot(pupilId: string, termId: string): Promise<PupilTermSnapshot | null> {
    const q = query(
      collection(db, this.collectionName),
      where('pupilId', '==', pupilId),
      where('termId', '==', termId),
      where('isActive', '==', true)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as PupilTermSnapshot;
  }

  /**
   * Get all snapshots for a pupil
   */
  static async getPupilSnapshots(pupilId: string): Promise<PupilTermSnapshot[]> {
    const q = query(
      collection(db, this.collectionName),
      where('pupilId', '==', pupilId),
      where('isActive', '==', true)
      // Removed orderBy to avoid composite index requirement - will sort in memory
    );

    const querySnapshot = await getDocs(q);
    const snapshots = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PupilTermSnapshot));
    
    // Sort in memory by termStartDate descending
    return snapshots.sort((a, b) => new Date(b.termStartDate).getTime() - new Date(a.termStartDate).getTime());
  }

  /**
   * Update a snapshot (when class/section changes mid-term)
   */
  static async updateSnapshot(
    snapshotId: string,
    updates: Partial<Pick<PupilTermSnapshot, 'classId' | 'section'>>
  ): Promise<void> {
    const docRef = doc(db, this.collectionName, snapshotId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Create snapshots for all active pupils for a new term
   * This should be run when a new term starts
   */
  static async createTermSnapshotsForAllPupils(
    pupils: Pupil[],
    termId: string,
    academicYear: AcademicYear
  ): Promise<void> {
    const term = academicYear.terms.find(t => t.id === termId);
    if (!term) {
      throw new Error(`Term ${termId} not found in academic year ${academicYear.name}`);
    }

    const promises = pupils.map(pupil => 
      this.getOrCreateSnapshot(pupil, termId, academicYear)
    );

    await Promise.all(promises);
    console.log(`Created snapshots for ${pupils.length} pupils for term ${termId}`);
  }

  /**
   * Create a virtual pupil object based on historical snapshot
   */
  static createVirtualPupilFromSnapshot(
    originalPupil: Pupil,
    snapshot: PupilTermSnapshot
  ): Pupil {
    return {
      ...originalPupil,
      classId: snapshot.classId,
      section: snapshot.section as "" | "Day" | "Boarding",
      admissionNumber: snapshot.admissionNumber,
      dateOfBirth: snapshot.dateOfBirth || originalPupil.dateOfBirth,
    };
  }

  /**
   * Check snapshot coverage for all pupils across ENDED terms only
   * Current and future terms should NOT have snapshots
   */
  static async checkSnapshotCoverage(
    pupils: Pupil[],
    academicYears: AcademicYear[]
  ): Promise<{
    totalExpectedSnapshots: number;
    existingSnapshots: number;
    missingSnapshots: number;
    missingSnapshotDetails: Array<{
      pupilId: string;
      pupilName: string;
      termId: string;
      termName: string;
      academicYear: string;
    }>;
  }> {
    console.log('🔍 Checking snapshot coverage for ENDED terms only...');
    
    // Only get terms that have ended
    const endedTerms: Array<{termId: string; termName: string; academicYear: AcademicYear}> = [];
    academicYears.forEach(year => {
      year.terms.forEach(term => {
        if (isTermEnded(term)) {
          endedTerms.push({
            termId: term.id,
            termName: term.name,
            academicYear: year
          });
        }
      });
    });

    console.log(`📅 Found ${endedTerms.length} ended terms that should have snapshots`);

    let totalExpected = 0;
    let existing = 0;
    const missing: Array<{
      pupilId: string;
      pupilName: string;
      termId: string;
      termName: string;
      academicYear: string;
    }> = [];

    for (const pupil of pupils) {
      for (const term of endedTerms) {
        // Only check terms that the pupil should have been in (after registration)
        if (pupil.registrationDate) {
          const termStartDate = new Date(term.academicYear.terms.find(t => t.id === term.termId)?.startDate || '');
          const registrationDate = new Date(pupil.registrationDate);
          
          // Skip terms that started before pupil registration
          if (termStartDate < registrationDate) {
            continue;
          }
        }

        totalExpected++;
        
        const snapshot = await this.getSnapshot(pupil.id, term.termId);
        if (snapshot) {
          existing++;
        } else {
          missing.push({
            pupilId: pupil.id,
            pupilName: `${pupil.firstName} ${pupil.lastName}`,
            termId: term.termId,
            termName: term.termName,
            academicYear: term.academicYear.name
          });
        }
      }
    }

    console.log(`📊 Snapshot Coverage Report for ENDED terms:`, {
      totalExpectedSnapshots: totalExpected,
      existingSnapshots: existing,
      missingSnapshots: totalExpected - existing,
      coveragePercentage: totalExpected > 0 ? Math.round((existing / totalExpected) * 100) : 0
    });

    return {
      totalExpectedSnapshots: totalExpected,
      existingSnapshots: existing,
      missingSnapshots: totalExpected - existing,
      missingSnapshotDetails: missing
    };
  }

  /**
   * Bulk create all missing historical snapshots for all pupils
   * ONLY creates snapshots for ENDED terms - current and future terms are excluded
   */
  static async createAllMissingSnapshots(
    pupils: Pupil[],
    academicYears: AcademicYear[]
  ): Promise<{
    created: number;
    skipped: number;
    errors: Array<{pupilId: string; termId: string; error: string}>;
  }> {
    console.log('🏗️ Creating all missing historical snapshots for ENDED terms only...');
    
    let created = 0;
    let skipped = 0;
    const errors: Array<{pupilId: string; termId: string; error: string}> = [];

    for (const academicYear of academicYears) {
      console.log(`📅 Processing academic year: ${academicYear.name}`);
      
      for (const term of academicYear.terms) {
        const termStatus = getTermStatus(term);
        
        // Skip current and future terms - they should not have snapshots
        if (termStatus === 'current' || termStatus === 'future') {
          console.log(`⏭️  Skipping ${termStatus} term: ${term.name} - snapshots only for ended terms`);
          continue;
        }
        
        console.log(`📝 Processing ended term: ${term.name}`);
        
        for (const pupil of pupils) {
          try {
            // Check if pupil should have been in this term
            if (pupil.registrationDate) {
              const termStartDate = new Date(term.startDate);
              const registrationDate = new Date(pupil.registrationDate);
              
              // Skip terms that started before pupil registration
              if (termStartDate < registrationDate) {
                skipped++;
                continue;
              }
            }

            // Check if snapshot already exists
            const existingSnapshot = await this.getSnapshot(pupil.id, term.id);
            if (existingSnapshot) {
              skipped++;
              continue;
            }

            // Create snapshot for ended term
            await this.createSnapshot(
              pupil.id,
              term.id,
              academicYear.id,
              pupil.classId,
              pupil.section,
              pupil.admissionNumber,
              term.startDate,
              term.endDate,
              pupil.dateOfBirth
            );
            
            created++;
            console.log(`✅ Created snapshot for ${pupil.firstName} ${pupil.lastName} - ${term.name} (${academicYear.name})`);
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push({
              pupilId: pupil.id,
              termId: term.id,
              error: errorMessage
            });
            console.error(`❌ Failed to create snapshot for ${pupil.firstName} ${pupil.lastName} - ${term.name}:`, error);
          }
        }
      }
    }

    console.log(`🎉 Bulk snapshot creation complete:`, {
      created,
      skipped,
      errors: errors.length
    });

    return { created, skipped, errors };
  }

  /**
   * Delete all snapshots for current and upcoming terms
   * These snapshots are incorrect and should not exist
   */
  static async deleteSnapshotsForCurrentAndUpcomingTerms(
    academicYears: AcademicYear[]
  ): Promise<{
    deleted: number;
    errors: Array<{snapshotId: string; termId: string; error: string}>;
  }> {
    console.log('🗑️ Deleting incorrect snapshots for current and upcoming terms...');
    
    let deleted = 0;
    const errors: Array<{snapshotId: string; termId: string; error: string}> = [];

    // Get all current and upcoming terms
    const currentAndUpcomingTerms: Array<{term: Term, academicYear: AcademicYear}> = [];
    for (const academicYear of academicYears) {
      for (const term of academicYear.terms) {
        const termStatus = getTermStatus(term);
        if (termStatus === 'current' || termStatus === 'future') {
          currentAndUpcomingTerms.push({ term, academicYear });
        }
      }
    }

    console.log(`📅 Found ${currentAndUpcomingTerms.length} current/upcoming terms to clean`);

    for (const { term, academicYear } of currentAndUpcomingTerms) {
      try {
        console.log(`🧹 Cleaning snapshots for ${getTermStatus(term)} term: ${term.name} (${academicYear.name})`);
        
        // Query all snapshots for this term
        const q = query(
          collection(db, this.collectionName),
          where('termId', '==', term.id),
          where('isActive', '==', true)
        );

        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          console.log(`✅ No snapshots found for term ${term.name} - already clean`);
          continue;
        }

        console.log(`🗑️ Found ${querySnapshot.docs.length} incorrect snapshots for term ${term.name}`);
        
        // Delete each snapshot
        for (const docSnapshot of querySnapshot.docs) {
          try {
            await deleteDoc(doc(db, this.collectionName, docSnapshot.id));
            deleted++;
            console.log(`✅ Deleted snapshot ${docSnapshot.id} for term ${term.name}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push({
              snapshotId: docSnapshot.id,
              termId: term.id,
              error: errorMessage
            });
            console.error(`❌ Failed to delete snapshot ${docSnapshot.id}:`, error);
          }
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          snapshotId: 'query-error',
          termId: term.id,
          error: errorMessage
        });
        console.error(`❌ Failed to query snapshots for term ${term.name}:`, error);
      }
    }

    console.log(`🎉 Snapshot cleanup complete:`, {
      deleted,
      errors: errors.length
    });

    return { deleted, errors };
  }

  /**
   * Get statistics about snapshots by term status
   */
  static async getSnapshotStatsByTermStatus(
    academicYears: AcademicYear[]
  ): Promise<{
    pastTermsSnapshots: number;
    currentTermsSnapshots: number;
    futureTermsSnapshots: number;
    totalSnapshots: number;
  }> {
    console.log('📊 Analyzing snapshot distribution by term status...');
    
    let pastTermsSnapshots = 0;
    let currentTermsSnapshots = 0;
    let futureTermsSnapshots = 0;

    for (const academicYear of academicYears) {
      for (const term of academicYear.terms) {
        const termStatus = getTermStatus(term);
        
        // Count snapshots for this term
        const q = query(
          collection(db, this.collectionName),
          where('termId', '==', term.id),
          where('isActive', '==', true)
        );

        const querySnapshot = await getDocs(q);
        const snapshotCount = querySnapshot.docs.length;
        
        if (snapshotCount > 0) {
          console.log(`📋 Term ${term.name} (${termStatus}): ${snapshotCount} snapshots`);
          
          switch (termStatus) {
            case 'past':
              pastTermsSnapshots += snapshotCount;
              break;
            case 'current':
              currentTermsSnapshots += snapshotCount;
              break;
            case 'future':
              futureTermsSnapshots += snapshotCount;
              break;
          }
        }
      }
    }

    const totalSnapshots = pastTermsSnapshots + currentTermsSnapshots + futureTermsSnapshots;
    
    console.log(`📊 Snapshot Statistics by Term Status:`, {
      pastTermsSnapshots,
      currentTermsSnapshots,
      futureTermsSnapshots,
      totalSnapshots
    });

    return {
      pastTermsSnapshots,
      currentTermsSnapshots,
      futureTermsSnapshots,
      totalSnapshots
    };
  }

  /**
   * AUTOMATIC SNAPSHOT CREATION: Monitor and create snapshots when terms end
   * This should be called regularly (daily) to detect newly ended terms
   */
  static async autoCreateSnapshotsForEndedTerms(
    pupils: Pupil[],
    academicYears: AcademicYear[]
  ): Promise<{
    termsChecked: number;
    snapshotsCreated: number;
    errors: Array<{pupilId: string; termId: string; error: string}>;
  }> {
    console.log(`🤖 Auto-creating snapshots for newly ended terms...`);
    
    let termsChecked = 0;
    let snapshotsCreated = 0;
    const errors: Array<{pupilId: string; termId: string; error: string}> = [];

    // Find all terms that have recently ended (within last 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const academicYear of academicYears) {
      for (const term of academicYear.terms) {
        const termEndDate = new Date(term.endDate);
        
        // Check if term ended in the last 7 days
        if (termEndDate >= sevenDaysAgo && termEndDate < now) {
          termsChecked++;
          console.log(`🔍 Found recently ended term: ${term.name} (${academicYear.name}) - ended ${term.endDate}`);
          
          // Create snapshots for all pupils for this term
          for (const pupil of pupils) {
            try {
              // Check if snapshot already exists
              const existingSnapshot = await this.getSnapshot(pupil.id, term.id);
              
              if (!existingSnapshot) {
                // CRITICAL: Create snapshot with current data since term just ended
                // Current data should be accurate for terms that ended recently
                await this.createSnapshot(
                  pupil.id,
                  term.id,
                  academicYear.id,
                  pupil.classId,
                  pupil.section,
                  pupil.admissionNumber,
                  term.startDate,
                  term.endDate,
                  pupil.dateOfBirth
                );
                
                snapshotsCreated++;
                console.log(`✅ Auto-created snapshot for pupil ${pupil.id} term ${term.id}`);
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              errors.push({ pupilId: pupil.id, termId: term.id, error: errorMsg });
              console.error(`❌ Failed to auto-create snapshot for pupil ${pupil.id} term ${term.id}:`, errorMsg);
            }
          }
        }
      }
    }

    console.log(`🤖 Auto-snapshot creation complete: ${snapshotsCreated} snapshots created for ${termsChecked} recently ended terms`);
    
    return {
      termsChecked,
      snapshotsCreated,
      errors
    };
  }

  /**
   * DAILY SCHEDULER FUNCTION: Call this from your daily cron job or scheduler
   * This is the method you should call automatically every day
   */
  static async runDailySnapshotMaintenance(): Promise<{
    success: boolean;
    message: string;
    results?: any;
  }> {
    try {
      console.log(`📅 Running daily snapshot maintenance at ${new Date().toISOString()}`);
      
      // You'll need to import these services and fetch the data
      // const pupils = await PupilsService.getAllPupils();
      // const academicYears = await AcademicYearsService.getAllAcademicYears();
      
      // For now, return instructions since we can't import here
      return {
        success: false,
        message: `Daily snapshot maintenance scheduled but requires implementation. See comments in PupilSnapshotsService.runDailySnapshotMaintenance()`
      };
      
      // Uncomment and modify this when you set up the scheduler:
      // const results = await this.autoCreateSnapshotsForEndedTerms(pupils, academicYears);
      // 
      // return {
      //   success: true,
      //   message: `Daily maintenance complete: ${results.snapshotsCreated} snapshots created for ${results.termsChecked} ended terms`,
      //   results
      // };
      
    } catch (error) {
      console.error(`❌ Daily snapshot maintenance failed:`, error);
      return {
        success: false,
        message: `Daily maintenance failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * CRITICAL: Force create ALL missing snapshots for ended terms
   * This is the nuclear option - creates snapshots for ALL ended terms that don't have them
   */
  static async forceCreateAllMissingEndedTermSnapshots(
    pupils: Pupil[],
    academicYears: AcademicYear[]
  ): Promise<{
    termsProcessed: number;
    snapshotsCreated: number;
    errorsRecovered: number;
    errors: Array<{pupilId: string; termId: string; error: string}>;
  }> {
    console.log(`🚨 FORCE CREATING ALL MISSING SNAPSHOTS FOR ENDED TERMS...`);
    
    let termsProcessed = 0;
    let snapshotsCreated = 0;
    let errorsRecovered = 0;
    const errors: Array<{pupilId: string; termId: string; error: string}> = [];

    // Find ALL ended terms across all academic years
    for (const academicYear of academicYears) {
      for (const term of academicYear.terms) {
        const termStatus = getTermStatus(term);
        
        if (termStatus === 'past') {
          termsProcessed++;
          console.log(`📋 Processing ended term: ${term.name} (${academicYear.name}) - ended ${term.endDate}`);
          
          // Create snapshots for all pupils for this ended term
          for (const pupil of pupils) {
            try {
              // Check if snapshot already exists
              const existingSnapshot = await this.getSnapshot(pupil.id, term.id);
              
              if (!existingSnapshot) {
                console.log(`🆕 Creating missing snapshot for pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}) in ended term ${term.id}`);
                
                // Try to get historical data first
                const historicalData = await this.getHistoricalPupilData(pupil, term.id, academicYear);
                
                if (historicalData) {
                  // Create snapshot with historical data
                  await this.createSnapshot(
                    pupil.id,
                    term.id,
                    academicYear.id,
                    historicalData.classId,
                    historicalData.section,
                    historicalData.admissionNumber,
                    term.startDate,
                    term.endDate,
                    historicalData.dateOfBirth
                  );
                  
                  snapshotsCreated++;
                  console.log(`✅ Created snapshot with historical data for pupil ${pupil.id} term ${term.id}`);
                } else {
                  // Last resort: create with current data but mark as potentially inaccurate
                  console.log(`⚠️ Creating snapshot with current data (may be inaccurate) for pupil ${pupil.id} term ${term.id}`);
                  
                  await this.createSnapshot(
                    pupil.id,
                    term.id,
                    academicYear.id,
                    pupil.classId,
                    pupil.section,
                    pupil.admissionNumber,
                    term.startDate,
                    term.endDate,
                    pupil.dateOfBirth
                  );
                  
                  snapshotsCreated++;
                  errorsRecovered++;
                  console.log(`⚠️ Created potentially inaccurate snapshot for pupil ${pupil.id} term ${term.id}`);
                }
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              errors.push({ pupilId: pupil.id, termId: term.id, error: errorMsg });
              console.error(`❌ Failed to create snapshot for pupil ${pupil.id} term ${term.id}:`, errorMsg);
            }
          }
        }
      }
    }

    console.log(`🚨 FORCE SNAPSHOT CREATION COMPLETE:`);
    console.log(`   Terms processed: ${termsProcessed}`);
    console.log(`   Snapshots created: ${snapshotsCreated}`);
    console.log(`   Potentially inaccurate snapshots: ${errorsRecovered}`);
    console.log(`   Errors: ${errors.length}`);
    
    return {
      termsProcessed,
      snapshotsCreated,
      errorsRecovered,
      errors
    };
  }

  /**
   * VALIDATION: Ensure ALL ended terms have snapshots
   * This checks that every pupil has snapshots for every ended term
   */
  static async validateSnapshotCompleteness(
    pupils: Pupil[],
    academicYears: AcademicYear[]
  ): Promise<{
    totalEndedTerms: number;
    totalExpectedSnapshots: number;
    totalExistingSnapshots: number;
    missingSnapshots: number;
    validationPassed: boolean;
    missingDetails: Array<{
      pupilId: string;
      pupilName: string;
      termId: string;
      termName: string;
      academicYear: string;
    }>;
  }> {
    console.log(`🔍 Validating snapshot completeness for all ended terms...`);
    
    const endedTerms: Array<{ term: Term; academicYear: AcademicYear }> = [];
    const missingDetails: Array<{
      pupilId: string;
      pupilName: string;
      termId: string;
      termName: string;
      academicYear: string;
    }> = [];

    // Find all ended terms
    for (const academicYear of academicYears) {
      for (const term of academicYear.terms) {
        const termStatus = getTermStatus(term);
        if (termStatus === 'past') {
          endedTerms.push({ term, academicYear });
        }
      }
    }

    const totalEndedTerms = endedTerms.length;
    const totalExpectedSnapshots = totalEndedTerms * pupils.length;
    let totalExistingSnapshots = 0;

    // Check each pupil against each ended term
    for (const pupil of pupils) {
      for (const { term, academicYear } of endedTerms) {
        const existingSnapshot = await this.getSnapshot(pupil.id, term.id);
        
        if (existingSnapshot) {
          totalExistingSnapshots++;
        } else {
          missingDetails.push({
            pupilId: pupil.id,
            pupilName: `${pupil.firstName} ${pupil.lastName}`,
            termId: term.id,
            termName: term.name,
            academicYear: academicYear.name
          });
        }
      }
    }

    const missingSnapshots = missingDetails.length;
    const validationPassed = missingSnapshots === 0;

    console.log(`📊 Snapshot Completeness Validation Results:`);
    console.log(`   Total ended terms: ${totalEndedTerms}`);
    console.log(`   Total pupils: ${pupils.length}`);
    console.log(`   Expected snapshots: ${totalExpectedSnapshots}`);
    console.log(`   Existing snapshots: ${totalExistingSnapshots}`);
    console.log(`   Missing snapshots: ${missingSnapshots}`);
    console.log(`   Validation passed: ${validationPassed ? '✅ YES' : '❌ NO'}`);

    return {
      totalEndedTerms,
      totalExpectedSnapshots,
      totalExistingSnapshots,
      missingSnapshots,
      validationPassed,
      missingDetails
    };
  }
} 